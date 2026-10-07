import assert from "node:assert/strict";
import test from "node:test";
import {
  detachedFrenchHead,
  recoverAttestedSurfaceCarriers
} from "../src/strongSurfaceRecovery.js";
import { learnRecoveryLexicon } from "../src/strongWitnessRecovery.js";
import {
  learnInflectionLexicon,
  learnWitnessInventory,
  type FrenchInflectionIndex
} from "../src/strongInflectionEvidence.js";
import type {
  ReconstructionVerse,
  ReconstructionWitness
} from "../src/strongConcordanceRefinement.js";

function fixture(
  words: string[],
  codes: string[],
  at: Array<number | undefined>
): ReconstructionVerse {
  const units: ReconstructionVerse["units"] = codes.map((strong, i) => ({
    sourceUnitId: `source-${i}`,
    occurrenceIds: [`occurrence-${i}`],
    strong: [strong],
    source: {
      surface: "fixture",
      gloss: "fixture",
      morphology: "V-PAI-3P",
      evidenceSha256: "fixture",
      readingUnresolved: false
    },
    state: at[i] === undefined ? "unresolved" : "visible",
    assurance: at[i] === undefined ? "unresolved" : "existing-generator",
    targetWordIndices: at[i] === undefined ? [] : [at[i]!],
    reasons:
      at[i] === undefined ? ["missing-carrier-is-not-absent-translation"] : [],
    annotationIds: [],
    placementEvidence: [],
    exploration: {
      status: "completed-locally",
      methods: [],
      exactWitnessProposal: null,
      lexicalCandidates: [],
      remainingReason:
        at[i] === undefined ? "missing-carrier-is-not-absent-translation" : null
    }
  }));
  return {
    ref: "John.10.1",
    text: words.join(" "),
    words,
    units,
    issues: [],
    unownedAnnotationIds: [],
    placements: units.flatMap((u, i) =>
      at[i] === undefined
        ? []
        : [
            {
              id: `p-${i}`,
              originalOccurrenceId: u.occurrenceIds[0],
              strong: codes[i],
              kind: "word" as const,
              startWordIndex: at[i],
              endWordIndex: at[i]
            }
          ]
    )
  };
}
function corpus(head: string): Array<ReconstructionWitness & { ref: string }> {
  return ["Segond-family", "Darby-family"].map((family, i) => ({
    name: family,
    family,
    ref: `Ps.${i + 1}.1`,
    words: [head],
    placements: [
      { strong: "G0002", kind: "word", startWordIndex: 0, endWordIndex: 0 }
    ]
  }));
}
const run = (
  initial: ReconstructionVerse,
  head = "dit",
  witnesses = corpus(head)
) =>
  recoverAttestedSurfaceCarriers({
    initial,
    lexicon: learnRecoveryLexicon(witnesses),
    witnessInventory: learnWitnessInventory(
      witnesses.map((w) => ({ ...w, ref: initial.ref }))
    ),
    display: "expressions"
  });
const clitic = () =>
  fixture(
    ["voient", "dit-il", "chantent"],
    ["G0001", "G0002", "G0003"],
    [0, undefined, 2]
  );
const repeated = () =>
  fixture(
    ["voient", "témoins", "annoncent", "témoins", "parlent"],
    ["G0001", "G0002", "G0003", "G0002", "G0004"],
    [0, undefined, 2, undefined, 4]
  );

test("French detachments preserve accents and reject ordinary compounds or incompatible source classes", () => {
  assert.equal(detachedFrenchHead("Lève-toi", "HVqv2ms")?.head, "lève");
  assert.equal(detachedFrenchHead("donne-le-moi", "V-PAM-2S")?.head, "donne");
  assert.equal(detachedFrenchHead("jour-là", "HNcmsa")?.head, "jour");
  assert.equal(detachedFrenchHead("dit-il", "HNcmsa"), null);
  assert.equal(detachedFrenchHead("porte-monnaie", "HNcmsa"), null);
  assert.equal(detachedFrenchHead("Beth-El", "HNpl"), null);
  assert.equal(detachedFrenchHead("lui-même", "P-DSM"), null);
});
test("recovers the whole hyphenated word only with independent attestations and two lexical anchors", () => {
  const initial = clitic(),
    before = structuredClone(initial),
    result = run(initial);
  assert.deepEqual(initial, before);
  assert.equal(result.changes.length, 1);
  assert.equal(result.changes[0].normalization, "attached-pronoun");
  assert.equal(result.prediction.text, initial.text);
  assert.deepEqual(result.prediction.words, initial.words);
  assert.equal(result.changes[0].placement.startWordIndex, 1);
  assert.deepEqual(
    result.prediction.placements.slice(0, 2),
    initial.placements
  );
  assert.deepEqual(result.prediction.units[0], initial.units[0]);
  assert.deepEqual(result.prediction.units[2], initial.units[2]);
});
test("correlated families, current-verse evidence, missing anchors and punctuation do not suffice", () => {
  assert.equal(
    run(
      clitic(),
      "dit",
      corpus("dit").map((w) => ({ ...w, family: "Darby-family" }))
    ).changes.length,
    0
  );
  assert.equal(
    run(
      clitic(),
      "dit",
      corpus("dit").map((w) => ({ ...w, ref: "John.10.1" }))
    ).changes.length,
    0
  );
  const noAnchor = clitic();
  noAnchor.placements.pop();
  assert.equal(run(noAnchor).changes.length, 0);
  const boundary = clitic();
  boundary.text = "voient. dit-il chantent";
  assert.equal(run(boundary).changes.length, 0);
});
test("preserves distinct repeated occurrences when each has a unique disjoint anchored carrier", () => {
  const initial = repeated(),
    result = run(initial, "témoins");
  assert.equal(result.changes.length, 2);
  assert.deepEqual(
    result.changes.map((c) => c.placement.startWordIndex),
    [1, 3]
  );
  assert.equal(
    new Set(result.changes.map((c) => c.placement.originalOccurrenceId)).size,
    2
  );
  assert.deepEqual(
    result.prediction.units.map((u) => [
      u.sourceUnitId,
      u.occurrenceIds,
      u.strong
    ]),
    initial.units.map((u) => [u.sourceUnitId, u.occurrenceIds, u.strong])
  );
});
test("a repeated group remains unresolved if one occurrence is ambiguous or its reading is unresolved", () => {
  const ambiguous = repeated();
  ambiguous.placements = ambiguous.placements.filter((p) => p.id !== "p-2");
  assert.equal(run(ambiguous, "témoins").changes.length, 0);
  const reading = repeated();
  reading.units[3].source.readingUnresolved = true;
  assert.equal(run(reading, "témoins").changes.length, 0);
});
test("refuses inversion against an already placed instance of the same source word", () => {
  const v = repeated();
  v.units[1].state = "visible";
  v.units[1].targetWordIndices = [3];
  v.placements.push({
    id: "existing-repeat",
    originalOccurrenceId: v.units[1].occurrenceIds[0],
    strong: "G0002",
    kind: "word",
    startWordIndex: 3,
    endWordIndex: 3
  });
  v.placements = v.placements.filter((p) => p.id !== "p-2");
  assert.equal(run(v, "témoins").changes.length, 0);
});
test("does not take an existing relation's undisplayed complement or restore a deliberate withdrawal", () => {
  const occupied = clitic();
  occupied.units[0].targetWordIndices.push(1);
  assert.equal(run(occupied).changes.length, 0);
  const withdrawal = clitic();
  withdrawal.units[1].assurance = "unresolved-predicate-relation";
  assert.equal(run(withdrawal).changes.length, 0);
});
test("does not turn absent evidence into an empty or invent a plain word match", () => {
  assert.equal(run(clitic(), "dis").changes.length, 0);
  const plain = clitic();
  plain.words[1] = "dit";
  plain.text = plain.words.join(" ");
  const result = run(plain);
  assert.equal(result.changes.length, 0);
  assert.equal(result.prediction.units[1].state, "unresolved");
  assert.equal(result.prediction.units[1].anchor, undefined);
});

test("an explicit inflection relation generalizes witnessed forms without importing dictionary meanings", () => {
  const initial = fixture(
    ["voient", "trompons", "chantent"],
    ["G0001", "G0002", "G0003"],
    [0, undefined, 2]
  );
  const index: FrenchInflectionIndex = {
    trompons: { verb: ["tromper"] },
    trompé: { verb: ["tromper"] }
  };
  const lexicon = learnRecoveryLexicon(corpus("trompé"));
  const result = recoverAttestedSurfaceCarriers({
    initial,
    lexicon,
    inflections: { index, lexicon: learnInflectionLexicon(lexicon, index) },
    display: "expressions",
    policy: {
      clitics: false,
      repeated: false,
      inflections: true,
      minimumFamilies: 2
    }
  });
  assert.equal(result.changes.length, 1);
  assert.equal(result.changes[0].lemma, "tromper");
  assert.equal(result.changes[0].normalization, "dictionary-inflection");
  assert.deepEqual(
    result.prediction.placements.slice(0, 2),
    initial.placements
  );
});

test("ambiguous dictionary lemmas and accent folding cannot create an inflection proof", () => {
  const initial = fixture(
    ["voient", "trompons", "chantent"],
    ["G0001", "G0002", "G0003"],
    [0, undefined, 2]
  );
  for (const index of [
    { trompons: { verb: ["tromper", "autre"] }, trompé: { verb: ["tromper"] } },
    { trompons: { verb: ["tromper"] }, trompe: { verb: ["tromper"] } }
  ] satisfies FrenchInflectionIndex[]) {
    const lexicon = learnRecoveryLexicon(corpus("trompé"));
    const result = recoverAttestedSurfaceCarriers({
      initial,
      lexicon,
      inflections: { index, lexicon: learnInflectionLexicon(lexicon, index) },
      display: "expressions",
      policy: {
        clitics: false,
        repeated: false,
        inflections: true,
        minimumFamilies: 2
      }
    });
    assert.equal(result.changes.length, 0);
  }
});

test("a French dictionary alone cannot associate a form with any Strong", () => {
  const initial = clitic();
  const index: FrenchInflectionIndex = { dit: { verb: ["dire"] } };
  const result = recoverAttestedSurfaceCarriers({
    initial,
    lexicon: new Map(),
    inflections: { index, lexicon: new Map() },
    display: "expressions",
    policy: {
      clitics: true,
      repeated: true,
      inflections: true,
      minimumFamilies: 2
    }
  });
  assert.equal(result.changes.length, 0);
  assert.deepEqual(result.prediction, initial);
});

test("a weaker plausible competitor remains ambiguous when only one form passes the consensus threshold", () => {
  const initial = fixture(
    ["voient", "vient", "arrive", "chantent"],
    ["G0001", "G0002", "G0003"],
    [0, undefined, 3]
  );
  const index: FrenchInflectionIndex = {
    vient: { verb: ["venir"] },
    venu: { verb: ["venir"] },
    arrive: { verb: ["arriver"] },
    arrivé: { verb: ["arriver"] }
  };
  const stronger = [
    ...corpus("venu"),
    ...corpus("venu").map((w) => ({
      ...w,
      ref: w.ref === "Ps.1.1" ? "Ps.2.1" : "Ps.1.1"
    }))
  ];
  const witnesses = [
    ...stronger,
    ...corpus("arrivé").map((w, i) => ({ ...w, ref: `Ps.${i + 3}.1` }))
  ];
  const lexicon = learnRecoveryLexicon(witnesses);
  const result = recoverAttestedSurfaceCarriers({
    initial,
    lexicon,
    inflections: { index, lexicon: learnInflectionLexicon(lexicon, index) },
    display: "heads",
    policy: {
      clitics: false,
      repeated: false,
      inflections: true,
      inflectionConsensus: true,
      minimumFamilies: 2
    }
  });
  assert.equal(result.changes.length, 0);
  assert.equal(result.prediction.units[1].state, "unresolved");
});

test("a grammatical preposition that is also a participle is not a standalone lexical recovery", () => {
  const initial = fixture(
    ["voient", "devant", "chantent"],
    ["G0001", "G0002", "G0003"],
    [0, undefined, 2]
  );
  const index: FrenchInflectionIndex = {
    devant: { verb: ["devoir"] },
    doivent: { verb: ["devoir"] }
  };
  const lexicon = learnRecoveryLexicon(corpus("doivent"));
  assert.equal(
    recoverAttestedSurfaceCarriers({
      initial,
      lexicon,
      inflections: { index, lexicon: learnInflectionLexicon(lexicon, index) },
      display: "heads",
      policy: {
        clitics: false,
        repeated: false,
        inflections: true,
        minimumFamilies: 2
      }
    }).changes.length,
    0
  );
});

test("the selected policy does not attach a neighboring apposition across a comma", () => {
  const initial = clitic();
  initial.text = "voient, dit-il chantent";
  const result = run(initial);
  assert.equal(result.changes.length, 0);
  assert.deepEqual(result.prediction, initial);
});

test("the selected policy leaves an uncorroborated source identity unresolved", () => {
  const initial = clitic(),
    lexicon = learnRecoveryLexicon(corpus("dit"));
  const result = recoverAttestedSurfaceCarriers({
    initial,
    lexicon,
    witnessInventory: learnWitnessInventory(corpus("dit")),
    display: "heads"
  });
  assert.equal(result.changes.length, 0);
  assert.equal(result.prediction.units[1].state, "unresolved");
  const supported = recoverAttestedSurfaceCarriers({
    initial,
    lexicon,
    witnessInventory: learnWitnessInventory(
      corpus("dit").map((w) => ({ ...w, ref: initial.ref }))
    ),
    display: "heads"
  });
  assert.equal(supported.changes.length, 1);
  assert.deepEqual(supported.changes[0].verseSupport?.families, [
    "Darby-family",
    "Segond-family"
  ]);
});

test("a differently numbered native verse cannot count as another attestation passage", () => {
  const initial = clitic();
  initial.units[1].sourceUnitId = "TAGNT.John.9.1.2.NKO";
  const witnesses = [
    ...corpus("disait").map((w) => ({ ...w, ref: "John.9.1" })),
    ...corpus("disait").map((w) => ({ ...w, ref: "John.8.1" }))
  ];
  const lexicon = learnRecoveryLexicon(witnesses);
  const index: FrenchInflectionIndex = {
    dit: { verb: ["dire"] },
    disait: { verb: ["dire"] }
  };
  const result = recoverAttestedSurfaceCarriers({
    initial,
    lexicon,
    witnessInventory: learnWitnessInventory(witnesses),
    inflections: { index, lexicon: learnInflectionLexicon(lexicon, index) },
    display: "heads"
  });
  assert.equal(result.changes.length, 0);
  assert.equal(result.prediction.units[1].state, "unresolved");
});
