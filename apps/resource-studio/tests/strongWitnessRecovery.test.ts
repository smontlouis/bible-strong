import assert from "node:assert/strict";
import test from "node:test";
import {
  learnRecoveryLexicon,
  recoverWitnessCarriers
} from "../src/strongWitnessRecovery.js";
import type {
  ReconstructionVerse,
  ReconstructionWitness
} from "../src/strongConcordanceRefinement.js";
import type { CanonicalOccurrenceDecision } from "../src/strongCanonicalResolution.js";

function unit(
  strong: string,
  at?: number,
  morphology = "V-PAI-1P"
): CanonicalOccurrenceDecision {
  return {
    sourceUnitId: `source-${strong}`,
    occurrenceIds: [`occurrence-${strong}`],
    strong: [strong],
    source: {
      surface: "source",
      gloss: "fixture",
      morphology,
      evidenceSha256: "fixture",
      readingUnresolved: false
    },
    state: at === undefined ? "unresolved" : "visible",
    assurance: at === undefined ? "unresolved" : "existing-generator",
    targetWordIndices: at === undefined ? [] : [at],
    reasons:
      at === undefined ? ["missing-carrier-is-not-absent-translation"] : [],
    annotationIds: [],
    placementEvidence: [],
    exploration: {
      status: "completed-locally",
      methods: [],
      exactWitnessProposal: null,
      lexicalCandidates: [],
      remainingReason:
        at === undefined ? "missing-carrier-is-not-absent-translation" : null
    }
  };
}
function fixture(
  words = ["vus", "nous", "sommes", "témoins", "et", "annonçons"]
): ReconstructionVerse {
  const units = [
    unit("G3708", 0),
    unit("G3140"),
    unit("G0518", words.length - 1)
  ];
  return {
    ref: "1John.1.2",
    text: words.join(" "),
    words,
    units,
    placements: units
      .filter((u) => u.state === "visible")
      .map((u) => ({
        id: u.sourceUnitId,
        originalOccurrenceId: u.occurrenceIds[0],
        strong: u.strong[0],
        kind: "word",
        startWordIndex: u.targetWordIndices[0],
        endWordIndex: u.targetWordIndices[0]
      })),
    issues: [],
    unownedAnnotationIds: []
  };
}
function corpus(
  strong = "G3140",
  text = "témoins"
): Array<ReconstructionWitness & { ref: string }> {
  return ["Segond-family", "Darby-family"].map((family, i) => ({
    family,
    name: family,
    ref: `John.${i + 1}.1`,
    words: [text],
    placements: [{ strong, kind: "word", startWordIndex: 0, endWordIndex: 0 }]
  }));
}
const run = (initial: ReconstructionVerse, witnesses = corpus()) =>
  recoverWitnessCarriers({ initial, lexicon: learnRecoveryLexicon(witnesses) });

test("recovers an attested unresolved verb between unique lexical neighbors without changing prior carriers", () => {
  const initial = fixture(),
    result = run(initial);
  assert.equal(result.changes.length, 1);
  assert.equal(result.changes[0].placement.startWordIndex, 3);
  assert.deepEqual(
    result.prediction.placements.slice(0, 2),
    initial.placements
  );
  assert.equal(initial.units[1].state, "unresolved");
  assert.equal(result.prediction.units[1].state, "visible");
  assert.equal(result.prediction.units[1].exploration.remainingReason, null);
  assert.equal(result.changes[0].anchors.length, 2);
});
test("correlated witnesses, a single passage, and the current passage do not establish recovery", () => {
  assert.equal(
    run(
      fixture(),
      corpus().map((w) => ({ ...w, family: "Darby-family" }))
    ).changes.length,
    0
  );
  assert.equal(
    run(
      fixture(),
      corpus().map((w) => ({ ...w, ref: "John.1.1" }))
    ).changes.length,
    0
  );
  assert.equal(
    run(
      fixture(),
      corpus().map((w) => ({ ...w, ref: "1John.1.2" }))
    ).changes.length,
    0
  );
});
test("ambiguous target repetitions and occupied words remain unresolved", () => {
  assert.equal(
    run(fixture(["vus", "témoins", "témoins", "annonçons"])).changes.length,
    0
  );
  const v = fixture();
  v.placements.push({
    id: "occupied",
    strong: "G9000",
    kind: "word",
    startWordIndex: 3,
    endWordIndex: 3
  });
  assert.equal(run(v).changes.length, 0);
});
test("source variants, repeated source codes, conflicting withdrawals and source issues are preserved", () => {
  const variant = fixture();
  variant.units[1].source.readingUnresolved = true;
  assert.equal(run(variant).changes.length, 0);
  const repeated = fixture();
  repeated.units.push({
    ...unit("G3140"),
    sourceUnitId: "second",
    occurrenceIds: ["second"]
  });
  assert.equal(run(repeated).changes.length, 0);
  const withdrawn = fixture();
  withdrawn.units[1].assurance = "conflicting-clause";
  assert.equal(run(withdrawn).changes.length, 0);
  const issue = fixture();
  issue.issues.push("ambiguous-correspondence");
  assert.equal(run(issue).changes.length, 0);
});
test("a candidate outside the neighboring interval or across a sentence boundary is rejected", () => {
  const outside = fixture();
  outside.placements[0].startWordIndex = outside.placements[0].endWordIndex = 4;
  assert.equal(run(outside).changes.length, 0);
  const sentence = fixture();
  sentence.text = "vus. nous sommes témoins et annonçons";
  assert.equal(run(sentence).changes.length, 0);
});
test("accent folding and grammatical words cannot fabricate lexical evidence", () => {
  assert.equal(run(fixture(), corpus("G3140", "temoins")).changes.length, 0);
  assert.equal(
    run(fixture(["vus", "dans", "annonçons"]), corpus("G3140", "dans")).changes
      .length,
    0
  );
});
test("learned homographs and elided auxiliary inflections cannot become recovered lexical heads", () => {
  for (const surface of [
    "s’étaient",
    "l'avaient",
    "devant",
    "derrière",
    "seulement",
    "seraient",
    "eussent",
    "chez",
    "contre",
    "afin",
    "parmi",
    "malgré",
    "hors",
    "puis"
  ])
    assert.equal(
      run(fixture(["vus", surface, "annonçons"]), corpus("G3140", surface))
        .changes.length,
      0,
      surface
    );
});
test("simultaneous lexical proposals cannot claim the same target word", () => {
  const v = fixture();
  v.units.splice(2, 0, unit("G9001"));
  assert.equal(run(v, [...corpus(), ...corpus("G9001")]).changes.length, 0);
});
test("a proper-name compound can retain one carrier and recover its independently attested companion", () => {
  const a = unit("G1001", 0, "N-GSM-P"),
    b = unit("G1002", undefined, "N-GSM-T");
  const v: ReconstructionVerse = {
    ref: "Gen.1.1",
    text: "Alpha-Bêta",
    words: ["Alpha-Bêta"],
    units: [a, b],
    placements: [
      {
        id: "a",
        originalOccurrenceId: a.occurrenceIds[0],
        strong: "G1001",
        kind: "word",
        startWordIndex: 0,
        endWordIndex: 0
      }
    ],
    issues: [],
    unownedAnnotationIds: []
  };
  const witnesses = [...corpus("G1001", "Alpha"), ...corpus("G1002", "Bêta")];
  const result = run(v, witnesses);
  assert.equal(result.changes[0].rule, "attested-compound-recovery");
  assert.equal(result.prediction.placements.length, 2);
  assert.equal(result.prediction.text, "Alpha-Bêta");
  assert.equal(run(v, corpus("G1002", "Bêta")).changes.length, 0);
  assert.equal(
    run({ ...v, text: "alpha-bêta", words: ["alpha-bêta"] }, witnesses).changes
      .length,
    0
  );
});
