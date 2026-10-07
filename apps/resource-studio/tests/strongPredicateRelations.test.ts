import assert from "node:assert/strict";
import test from "node:test";
import { refinePredicateRelations } from "../src/strongPredicateRelations.js";
import type { ReconstructionVerse } from "../src/strongConcordanceRefinement.js";
import type { CanonicalOccurrenceDecision } from "../src/strongCanonicalResolution.js";
import { tokenizeText } from "../src/tokenize.js";

function fixture(
  text: string,
  spec: Array<[string, string, number, boolean?]>
): ReconstructionVerse {
  const units: CanonicalOccurrenceDecision[] = spec.map(
    ([strong, morphology, at, recovery = false]) => ({
      sourceUnitId: strong,
      occurrenceIds: [strong + ":0"],
      strong: [strong],
      source: {
        surface: "source",
        gloss: "fixture",
        morphology,
        evidenceSha256: "fixture",
        readingUnresolved: false
      },
      state: "visible",
      assurance: recovery ? "attested-neighbor-recovery" : "existing-generator",
      targetWordIndices: [at],
      reasons: [],
      annotationIds: [],
      placementEvidence: [],
      exploration: {
        status: "completed-locally",
        methods: [],
        exactWitnessProposal: null,
        lexicalCandidates: [],
        remainingReason: null
      }
    })
  );
  return {
    ref: "Gen.1.1",
    text,
    words: tokenizeText(text)
      .filter((t) => t.kind === "word")
      .map((t) => t.text),
    units,
    placements: spec.map(([strong, , at, recovery = false]) => ({
      id: `${recovery ? "recovery:" : "old:"}${strong}`,
      strong,
      originalOccurrenceId: strong + ":0",
      kind: "word",
      startWordIndex: at,
      endWordIndex: at
    })),
    issues: [],
    unownedAnnotationIds: []
  };
}
test("builds the complete support-verb expression while preserving the source occurrence", () => {
  const v = fixture("ils rendent la gloire au roi", [
    ["G1392", "V-PAI-3P", 3, true]
  ]);
  const result = refinePredicateRelations({
    initial: v,
    display: "expressions"
  });
  assert.deepEqual(result.prediction.units[0].targetWordIndices, [1, 2, 3]);
  assert.equal(result.prediction.placements[0].kind, "phrase");
  assert.equal(result.prediction.placements[0].startWordIndex, 1);
  assert.equal(
    result.prediction.placements[0].originalOccurrenceId,
    v.placements[0].originalOccurrenceId
  );
  assert.equal(v.placements[0].kind, "word");
  const heads = refinePredicateRelations({ initial: v, display: "heads" });
  assert.deepEqual(heads.prediction.units[0].targetWordIndices, [1, 2, 3]);
  assert.deepEqual(heads.prediction.placements, v.placements);
});
test("copular nominal translation retains its lexical head and records its predicate", () => {
  const v = fixture("nous en sommes témoins", [["G3140", "V-PAI-1P", 3, true]]);
  const result = refinePredicateRelations({
    initial: v,
    display: "expressions"
  });
  assert.deepEqual(result.prediction.units[0].targetWordIndices, [2, 3]);
  assert.equal(result.prediction.placements[0].startWordIndex, 3);
});
test("existing display remains stable while its complete relation is recorded", () => {
  const v = fixture("ils rendent gloire", [["G1392", "V-PAI-3P", 2]]);
  const result = refinePredicateRelations({
    initial: v,
    display: "expressions"
  });
  assert.deepEqual(result.prediction.placements, v.placements);
  assert.deepEqual(result.prediction.units[0].targetWordIndices, [1, 2]);
  assert.equal(
    refinePredicateRelations({
      initial: v,
      display: "expressions",
      preserveExistingDisplay: false
    }).prediction.placements[0].kind,
    "phrase"
  );
});
test("predicate extensions preserve already established complements outside the displayed head", () => {
  const v = fixture("ils sont jaloux de lui", [["H7065", "HVqp3mp", 2]]);
  v.units[0].targetWordIndices = [2, 3];
  const result = refinePredicateRelations({
    initial: v,
    display: "expressions"
  });
  assert.deepEqual(result.prediction.units[0].targetWordIndices, [1, 2, 3]);
  assert.deepEqual(result.prediction.placements, v.placements);
  const phrase = fixture("ils rendent gloire au roi", [
    ["G1392", "V-PAI-3P", 2, true]
  ]);
  phrase.units[0].targetWordIndices = [2, 3];
  const expanded = refinePredicateRelations({
    initial: phrase,
    display: "expressions"
  });
  assert.deepEqual(expanded.prediction.units[0].targetWordIndices, [1, 2, 3]);
  assert.deepEqual(expanded.prediction.placements[0].targetWordIndices, [1, 2]);
});
test("a repeated noun cannot silently become the head of a different source verb", () => {
  const v = fixture("l'accord du roi, l'accord qu'il a établi", [
    ["H1285", "HNcfsc", 0],
    ["H3772", "HVqp3ms", 3, true]
  ]);
  const result = refinePredicateRelations({
    initial: v,
    display: "expressions"
  });
  assert.equal(result.prediction.units[1].state, "unresolved");
  assert.equal(result.prediction.units[1].anchor, undefined);
  assert.equal(result.prediction.placements.length, 1);
  assert.equal(result.changes[0].rule, "competing-nominal-recovery");
});
test("support cannot steal another occurrence or cross a strong boundary", () => {
  const v = fixture("ils rendent la gloire", [
    ["G1392", "V-PAI-3P", 3],
    ["G1325", "V-PAI-3P", 1]
  ]);
  assert.equal(
    refinePredicateRelations({ initial: v, display: "expressions" }).changes
      .length,
    0
  );
  const punctuation = fixture("ils rendent ; la gloire", [
    ["G1392", "V-PAI-3P", 3]
  ]);
  assert.equal(
    refinePredicateRelations({ initial: punctuation, display: "expressions" })
      .changes.length,
    0
  );
});
test("preserves ambiguous sources, reviewed decisions and non-recovery nominal carriers", () => {
  const v = fixture("l'accord puis l'accord", [
    ["H1285", "HNcfsc", 0],
    ["H3772", "HVqp3ms", 2]
  ]);
  assert.equal(
    refinePredicateRelations({ initial: v, display: "expressions" }).changes
      .length,
    0
  );
  const reviewed = fixture("rendre gloire", [["G1392", "V-PAI-3P", 1, true]]);
  reviewed.units[0].assurance = "durable-reviewed-placement";
  assert.equal(
    refinePredicateRelations({ initial: reviewed, display: "expressions" })
      .changes.length,
    0
  );
  reviewed.units[0].assurance = "existing-generator";
  reviewed.units[0].source.readingUnresolved = true;
  assert.equal(
    refinePredicateRelations({ initial: reviewed, display: "expressions" })
      .changes.length,
    0
  );
});
