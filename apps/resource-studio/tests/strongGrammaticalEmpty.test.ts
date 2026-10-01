import assert from "node:assert/strict";
import test from "node:test";
import { grammaticalEmptyDecisions } from "../src/strongGrammaticalEmpty.js";
import {
  resolveDossier,
  type ResolutionDossier
} from "../src/strongResolutionWorkflow.js";
import { resolutionTextHash } from "../src/strongResolution.js";

function fixture(text = "Il voit la maison"): ResolutionDossier {
  const words = text.split(" ");
  return {
    edition: "fr-test",
    ref: "Gen.1.1",
    split: "authoring",
    text,
    words,
    witnesses: [],
    units: [
      ["H7200", "HVqp3ms"],
      ["H0853", "HTo"],
      ["H1004", "HTd/Ncmsa"]
    ].map(([strong, morphology], i) => ({
      unit: {
        id: `u${i}`,
        occurrenceIds: [`o${i}`],
        strong: [strong],
        readingUnresolved: false,
        sourceEvidenceSha256: resolutionTextHash(strong)
      },
      surface: "source",
      morphology,
      gloss: "source gloss",
      sourceFile: "fixture.txt",
      sourceLine: i + 1
    })),
    placements: [
      {
        id: "v",
        strong: "H7200",
        originalOccurrenceId: "o0",
        kind: "word",
        startWordIndex: 1,
        endWordIndex: 1
      },
      {
        id: "n",
        strong: "H1004",
        originalOccurrenceId: "o2",
        kind: "word",
        startWordIndex: words.length - 1,
        endWordIndex: words.length - 1
      }
    ]
  };
}
test("bare object particle gets a lexical empty and retains its grammatical relation", () => {
  const d = fixture(),
    before = structuredClone(d);
  const [r] = grammaticalEmptyDecisions(d, "fr");
  assert.equal(r.status, "supported");
  assert.equal(r.absence?.assurance, "linguistic-rule");
  assert.equal(r.anchor?.assurance, "convention-over-existing-carriers");
  assert.equal(r.anchor?.insertAfterWordIndex, 1);
  assert.deepEqual(r.grammaticalRelation?.targetWordIndices, [2, 3]);
  assert.equal(r.grammaticalRelation?.objectUnitId, "u2");
  assert.deepEqual(d, before);
});
test("a target language must be explicit; French convention is not exported to other languages", () => {
  for (const lang of ["", "en", "he"])
    assert.equal(
      grammaticalEmptyDecisions(fixture(), lang)[0].status,
      "abstained"
    );
});
test("pronouns, conjunctions and prepositional components are never silently erased", () => {
  for (const morph of ["HTo/Sp3ms", "HC/To", "HR/To", "", "HR"]) {
    const d = fixture();
    d.units[1].morphology = morph;
    assert.equal(
      grammaticalEmptyDecisions(d, "fr")[0].status,
      "abstained",
      morph
    );
  }
  const homograph = fixture();
  homograph.units[1].unit.strong = ["H0854"];
  assert.deepEqual(grammaticalEmptyDecisions(homograph, "fr"), []);
});
test("source variants, aliases and ambiguous neighboring carriers abstain", () => {
  const variant = fixture();
  variant.units[1].unit.readingUnresolved = true;
  assert.equal(grammaticalEmptyDecisions(variant, "fr")[0].status, "abstained");
  const alias = fixture();
  alias.units[2].unit.strong.push("H0001");
  assert.equal(grammaticalEmptyDecisions(alias, "fr")[0].status, "abstained");
  const duplicate = fixture();
  duplicate.placements.push({ ...duplicate.placements[1], id: "duplicate" });
  assert.equal(
    grammaticalEmptyDecisions(duplicate, "fr")[0].status,
    "abstained"
  );
});
test("existing visible or empty decisions are never replaced, including unowned tags", () => {
  const d = fixture();
  d.placements.push({
    id: "old",
    strong: "H0853",
    kind: "word",
    startWordIndex: 0,
    endWordIndex: 0
  });
  assert.equal(grammaticalEmptyDecisions(d, "fr")[0].status, "abstained");
  d.placements[2] = {
    id: "old",
    strong: "H0853",
    originalOccurrenceId: "o1",
    kind: "empty",
    insertAfterWordIndex: 0
  };
  assert.equal(grammaticalEmptyDecisions(d, "fr")[0].status, "abstained");
});
test("French prepositions, inverted order and punctuation cannot masquerade as a direct local object", () => {
  for (const text of [
    "Il parle à Joseph",
    "Il parle de Joseph",
    "Il marche vers Joseph",
    "Il voit, la maison",
    "Il voit. La maison"
  ]) {
    assert.equal(
      grammaticalEmptyDecisions(fixture(text), "fr")[0].status,
      "abstained",
      text
    );
  }
  const inverted = fixture();
  inverted.placements[0].startWordIndex = 3;
  inverted.placements[0].endWordIndex = 3;
  inverted.placements[1].startWordIndex = 1;
  inverted.placements[1].endWordIndex = 1;
  assert.equal(
    grammaticalEmptyDecisions(inverted, "fr")[0].status,
    "abstained"
  );
});
test("French contractions remain distinct from removable articles", () => {
  assert.equal(
    grammaticalEmptyDecisions(fixture("Il voit l’homme"), "fr")[0].status,
    "supported"
  );
  assert.equal(
    grammaticalEmptyDecisions(fixture("Il parle d’Israël"), "fr")[0].status,
    "abstained"
  );
});
test("a determiner assigned to another source occurrence is not absorbed", () => {
  const d = fixture();
  d.placements.push({
    id: "article",
    strong: "H0003",
    kind: "word",
    startWordIndex: 2,
    endWordIndex: 2
  });
  assert.equal(grammaticalEmptyDecisions(d, "fr")[0].status, "abstained");
});
test("the automatic workflow changes only the supported occurrence and is opt-in", () => {
  const d = fixture();
  assert.equal(resolveDossier(d).decisions[1].state, "unresolved");
  const options = {
    applyExactWitness: false,
    applyAssistedReviews: false,
    applyGrammaticalEmpties: true,
    targetLanguage: "fr"
  };
  const result = resolveDossier(d, [], options);
  assert.equal(result.decisions[1].state, "empty");
  assert.equal(result.decisions[1].assurance, "linguistic-rule");
  assert.equal(result.summary.linguisticRule, 1);
  assert.equal(result.summary.humanReviewed, 0);
  assert.deepEqual(result.placements.slice(0, 2), d.placements);
  assert.equal(result.placements[2].insertAfterWordIndex, 1);
  assert.deepEqual(result, resolveDossier(d, [], options));
});
test("repeated Strong codes retain distinct source occurrences and object attachments", () => {
  const d = fixture("Il voit Joseph et suit Joseph");
  d.units.push(
    ...structuredClone(d.units).map((u, i) => ({
      ...u,
      unit: { ...u.unit, id: `u${i + 3}`, occurrenceIds: [`o${i + 3}`] }
    }))
  );
  d.placements[1].startWordIndex = 2;
  d.placements[1].endWordIndex = 2;
  d.placements.push(
    {
      ...d.placements[0],
      id: "v2",
      originalOccurrenceId: "o3",
      startWordIndex: 4,
      endWordIndex: 4
    },
    {
      ...d.placements[1],
      id: "n2",
      originalOccurrenceId: "o5",
      startWordIndex: 5,
      endWordIndex: 5
    }
  );
  const out = grammaticalEmptyDecisions(d, "fr");
  assert.deepEqual(
    out.map((r) => r.status),
    ["supported", "supported"]
  );
  assert.deepEqual(
    out.map((r) => r.anchor?.insertAfterWordIndex),
    [1, 4]
  );
  assert.deepEqual(
    out.map((r) => r.grammaticalRelation?.objectUnitId),
    ["u2", "u5"]
  );
});
