import assert from "node:assert/strict";
import test from "node:test";
import type {
  BaselineVerse,
  EvalVerse
} from "../strong-alignment-benchmark/shared.js";
import type { Case, Result } from "../strong-arbitration-benchmark/core.js";
import { makeUnits, parseSourceRow, validateRelation } from "./model.js";
import { replay } from "./replay.js";
import { identityEvidence, readIdentityEvidence } from "./identity-evidence.js";

function raw(
  alternatives = "G2258",
  reading = "NKO",
  variants = "",
  primary = "G1510",
  index = "05"
) {
  return parseSourceRow(
    [
      `Luk.4.33#${index}=${reading}`,
      "ἦν",
      "was",
      `${primary}=V-IAI-3S`,
      "εἰμί=to be",
      "NA28+TR",
      variants,
      "",
      "",
      "",
      "",
      primary,
      alternatives
    ].join("\t"),
    "TAGNT fixture.txt",
    1
  )!;
}
function fixture() {
  const row = raw();
  const verse: EvalVerse = {
    ref: "Luke.4.33",
    split: "test",
    text: "il y avait ici",
    words: ["il", "y", "avait", "ici"],
    normalized: [],
    strong: [],
    surface: [],
    source: ["G1510", "G2258"].map((strong, i) => ({
      occurrenceId: `o${i}`,
      tokenId: "t",
      tokenIndex: 5,
      sourceIdentity: row.id,
      strong,
      sourceStrong: "G1510",
      text: "ἦν",
      gloss: "was",
      lemma: "",
      morph: "",
      pos: "NKO"
    }))
  };
  const units = makeUnits(verse, new Map([[row.id, row]]));
  const baseline: BaselineVerse = {
    ref: verse.ref,
    placements: [],
    original: [],
    items: []
  };
  const c: Case = {
    id: "alias",
    gold: "Darby",
    ref: verse.ref,
    split: "test",
    category: "missing",
    sourceIndex: 1,
    occurrenceId: "o1",
    annotationId: "alias-new",
    strong: "G2258",
    lexical: [],
    enriched: [
      {
        key: "C2_2",
        description: "avait",
        placement: {
          strong: "G2258",
          kind: "word",
          startWordIndex: 2,
          endWordIndex: 2
        }
      }
    ],
    isolatedState: "",
    contextState: ""
  };
  const result: Result = {
    id: "alias:context",
    status: "ok",
    choice: "C2_2",
    probability: 0.98,
    requestSha256: "archived"
  };
  return {
    row,
    verse,
    units,
    baseline,
    c,
    results: new Map([[result.id, result]])
  };
}
test("a source row retains alternative sets without treating meaning variants as aliases", () => {
  const f = fixture();
  assert.equal(f.units.length, 1);
  assert.deepEqual(
    f.units[0].taggings.map((t) => t.codes),
    [["G1510"], ["G2258"]]
  );
  const variant = raw("G2258", "N(K)O", "another reading");
  f.verse.source.forEach((s) => {
    s.sourceIdentity = variant.id;
  });
  const unit = makeUnits(f.verse, new Map([[variant.id, variant]]))[0];
  assert.equal(unit.structure, "variant-conditioned");
  assert.equal(unit.taggings.length, 1);
  assert.deepEqual(unit.unresolvedIdentifiers, ["G2258"]);
});
test("comma lists are unresolved, while an explicit primary decomposition stays a set", () => {
  const f = fixture();
  const ambiguous = raw("G2258, G2252");
  assert.equal(
    makeUnits(f.verse, new Map([[ambiguous.id, ambiguous]]))[0].structure,
    "unresolved-alternatives"
  );
  const compound = raw("", "NKO", "", "G2532+G1473");
  f.verse.source.forEach((s, i) => {
    s.strong = ["G2532", "G1473"][i];
  });
  const unit = makeUnits(f.verse, new Map([[compound.id, compound]]))[0];
  assert.equal(unit.structure, "multiple-components");
  assert.deepEqual(unit.taggings[0].codes, ["G2532", "G1473"]);
});
test("Hebrew alternative roots stay unresolved and technical affixes are retained separately", () => {
  const row = parseSourceRow(
    [
      "Gen.1.1#01=L",
      "בְּרֵאשִׁית",
      "",
      "in beginning",
      "H9003/{H7225G}",
      "",
      "",
      "",
      "H7225",
      "H7223",
      "",
      "H9003=ב=in/{H7225G=beginning}"
    ].join("\t"),
    "TAHOT fixture.txt",
    1
  )!;
  assert.deepEqual(row.primary, ["H7225G"]);
  assert.deepEqual(row.technicalMarkers, ["H9003"]);
  const f = fixture();
  f.verse.source.forEach((s, i) => {
    s.sourceIdentity = row.id;
    s.strong = ["H7225", "H7223"][i];
    s.text = row.surface;
  });
  assert.equal(
    makeUnits(f.verse, new Map([[row.id, row]]))[0].structure,
    "unresolved-alternatives"
  );
});
test("repeated words and reading branches retain separate physical identities", () => {
  const f = fixture();
  const repeat = raw("G2258", "NKO", "", "G1510", "06");
  f.verse.source.push({
    ...f.verse.source[0],
    occurrenceId: "o2",
    sourceIdentity: repeat.id
  });
  const branch = raw("G2258", "K");
  f.verse.source.push({
    ...f.verse.source[0],
    occurrenceId: "o3",
    sourceIdentity: branch.id
  });
  const units = makeUnits(
    f.verse,
    new Map([f.row, repeat, branch].map((r) => [r.id, r]))
  );
  assert.equal(units.length, 3);
  assert.deepEqual(
    units.map((u) => u.occurrenceIds.length),
    [2, 1, 1]
  );
});
test("guard retains a relation but defers a missing display identity; primary projects it", () => {
  const f = fixture();
  const guard = replay(f.baseline, [f.c], f.results, f.units, "guard");
  assert.equal(guard.placements.length, 0);
  assert.deepEqual(guard.relations[0].targetWordIndices, [2]);
  assert.equal(guard.relations[0].status, "proposed");
  const primary = replay(
    f.baseline,
    [f.c],
    f.results,
    f.units,
    "source-primary"
  );
  assert.equal(primary.placements[0].strong, "G1510");
  assert.equal(primary.placements[0].originalOccurrenceId, "o0");
});
test("an alias reuses the existing owner without changing its identity or mutating inputs", () => {
  const f = fixture();
  f.baseline.placements.push({
    id: "owner",
    strong: "G1510",
    originalOccurrenceId: "o0",
    kind: "word",
    startWordIndex: 2,
    endWordIndex: 2
  });
  const before = JSON.stringify(f.baseline);
  const out = replay(f.baseline, [f.c], f.results, f.units, "guard");
  assert.deepEqual(out.placements, f.baseline.placements);
  assert.equal(out.changed.length, 0);
  assert.equal(out.events[0].kind, "existing-relation-reused");
  assert.equal(JSON.stringify(f.baseline), before);
});
test("disagreeing archived alias votes abstain, and agreement is not double-counted", () => {
  const f = fixture();
  const second: Case = {
    ...f.c,
    id: "primary",
    strong: "G1510",
    occurrenceId: "o0",
    enriched: [
      {
        key: "C3_3",
        description: "ici",
        placement: {
          strong: "G1510",
          kind: "word",
          startWordIndex: 3,
          endWordIndex: 3
        }
      }
    ]
  };
  f.results.set("primary:context", {
    ...f.results.get("alias:context")!,
    id: "primary:context",
    choice: "C3_3"
  });
  assert.equal(
    replay(f.baseline, [f.c, second], f.results, f.units, "source-primary")
      .placements.length,
    0
  );
  second.enriched = f.c.enriched;
  f.results.get("primary:context")!.choice = "C2_2";
  assert.equal(
    replay(f.baseline, [f.c, second], f.results, f.units, "source-primary")
      .placements.length,
    1
  );
});
test("deduplication only removes identical carriers, and overlap guards still apply", () => {
  const f = fixture();
  f.baseline.placements = ["G1510", "G2258"].map((strong, i) => ({
    id: `b${i}`,
    strong,
    originalOccurrenceId: `o${i}`,
    kind: "word",
    startWordIndex: 2,
    endWordIndex: 2
  }));
  assert.equal(
    replay(f.baseline, [], f.results, f.units, "guard").placements.length,
    2
  );
  const out = replay(f.baseline, [], f.results, f.units, "source-primary");
  assert.equal(out.placements.length, 1);
  assert.equal(out.placements[0].strong, "G1510");
  f.baseline.placements[1].startWordIndex = 3;
  f.baseline.placements[1].endWordIndex = 3;
  assert.equal(
    replay(f.baseline, [], f.results, f.units, "source-primary").placements
      .length,
    2
  );
  f.baseline.placements = [
    {
      id: "other",
      strong: "G9999",
      kind: "word",
      startWordIndex: 2,
      endWordIndex: 2
    }
  ];
  assert.equal(
    replay(f.baseline, [f.c], f.results, f.units, "source-primary").changed
      .length,
    0
  );
});
test("relations admit many-to-many and discontinuous spans without declaring absence", () => {
  const f = fixture();
  const relation = {
    sourceUnitIds: [f.units[0].id],
    targetWordIndices: [0, 2],
    status: "proposed" as const,
    evidenceIds: []
  };
  validateRelation(relation, f.units, 4);
  assert.throws(() =>
    validateRelation({ ...relation, status: "reviewed-absent" }, f.units, 4)
  );
  assert.throws(() =>
    validateRelation({ ...relation, targetWordIndices: [] }, f.units, 4)
  );
  validateRelation(
    { ...relation, targetWordIndices: [], status: "unresolved" },
    f.units,
    4
  );
});

test("a dictionary form relationship supplies evidence beyond the raw alias column", () => {
  const f = fixture();
  const lexicon = readIdentityEvidence(
    [
      "G1510\tG1510 =\tG1510\tεἰμί\teimi\tG:V\tto be",
      "G2258\tG2258 = a Form of\tG1510\tἦν\ten\tG:V\twas"
    ].join("\n"),
    "TBESG fixture"
  );
  assert.equal(
    identityEvidence(f.units, lexicon)[0].status,
    "documented-form-or-spelling-family"
  );
  assert.equal(identityEvidence(f.units, new Map())[0].status, "unresolved");
});

test("a combined identifier may span two source rows and is never an equivalent singleton", () => {
  const f = fixture();
  const first = raw("G3363", "NKO", "", "G2443", "14");
  const second = raw("", "NKO", "", "G3361", "15");
  f.verse.source = ["G2443", "G3363", "G3361"].map((strong, i) => ({
    ...f.verse.source[0],
    occurrenceId: `o${i}`,
    strong,
    sourceIdentity: i < 2 ? first.id : second.id
  }));
  const units = makeUnits(
    f.verse,
    new Map([first, second].map((r) => [r.id, r]))
  );
  const lexicon = readIdentityEvidence(
    "G3363\tG3363 = a Combination of\tG3361 (G2443+G3361)\tἵνα μή\tina me\tG:ADV-N\tlest",
    "TBESG fixture"
  );
  const evidence = identityEvidence(units, lexicon)[0];
  assert.equal(evidence.status, "documented-decomposition");
  assert.deepEqual(evidence.decompositions[0].componentCodes, [
    "G2443",
    "G3361"
  ]);
  assert.deepEqual(evidence.decompositions[0].matchingSourceSpans, [
    [first.id, second.id]
  ]);
  assert.equal(
    identityEvidence(units.slice(0, 1), lexicon)[0].decompositions[0]
      .matchingSourceSpans.length,
    0
  );
});

test("a Combination label without explicit components does not invent a decomposition", () => {
  const f = fixture();
  const row = raw("G4275", "NKO", "", "G4308");
  f.verse.source.forEach((s, i) => {
    s.strong = ["G4308", "G4275"][i];
  });
  const units = makeUnits(f.verse, new Map([[row.id, row]]));
  const lexicon = readIdentityEvidence(
    "G4275\tG4275 = a Combination of\tG4308\tπροεῖδον\tproeidon\tG:V\tforesee",
    "TBESG fixture"
  );
  const evidence = identityEvidence(units, lexicon)[0];
  assert.equal(evidence.status, "unresolved");
  assert.deepEqual(evidence.decompositions, []);
});
