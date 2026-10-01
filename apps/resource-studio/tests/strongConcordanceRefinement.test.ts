import assert from "node:assert/strict";
import test from "node:test";
import type { CanonicalOccurrenceDecision } from "../src/strongCanonicalResolution.js";
import {
  refineStrongReconstruction,
  learnWitnessDisplayHeads,
  type ReconstructionPlacement,
  type ReconstructionVerse,
  type RefinementPolicy
} from "../src/strongConcordanceRefinement.js";

const policy: RefinementPolicy = {
  numeric: true,
  phraseHeads: true,
  accountability: false,
  minimumHeadFamilies: 1
};
function unit(
  n: number,
  strong: string,
  gloss: string,
  morphology: string,
  state: "visible" | "unresolved" = "unresolved"
): CanonicalOccurrenceDecision {
  return {
    sourceUnitId: `TAHOT.Gen.1.1.${n}.L`,
    occurrenceIds: [`occurrence-${n}`],
    strong: [strong],
    source: {
      file: "fixture-step",
      line: n,
      surface: "source",
      gloss,
      morphology,
      evidenceSha256: "fixture",
      readingUnresolved: false
    },
    state,
    assurance: "fixture",
    targetWordIndices: [],
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
  };
}
const word = (
  n: number,
  strong: string,
  at: number
): ReconstructionPlacement => ({
  id: `p${n}`,
  originalOccurrenceId: `occurrence-${n}`,
  strong,
  kind: "word",
  startWordIndex: at,
  endWordIndex: at
});
function fixture(): ReconstructionVerse {
  return {
    ref: "Gen.1.1",
    text: "4 anneaux et 4 pieds",
    words: ["4", "anneaux", "et", "4", "pieds"],
    units: [
      unit(1, "H0702", "four", "HAcfsa"),
      unit(2, "H2885", "rings", "HNcfpc", "visible"),
      unit(3, "H0702", "[the] four", "HR/Acbsc"),
      unit(4, "H7272", "feet", "HNcfda", "visible")
    ],
    placements: [word(2, "H2885", 1), word(4, "H7272", 4)],
    issues: [],
    unownedAnnotationIds: []
  };
}
test("numeric recovery is a source-owned bijection with local noun evidence", () => {
  const input = fixture(),
    before = structuredClone(input);
  const result = refineStrongReconstruction(input, [], policy);
  assert.deepEqual(input, before);
  assert.equal(result.changes.length, 2);
  assert.deepEqual(
    result.changes.map((c) => [c.sourceUnitId, c.after[0].startWordIndex]),
    [
      [input.units[0].sourceUnitId, 0],
      [input.units[2].sourceUnitId, 3]
    ]
  );
  assert(result.prediction.units.every((u) => u.state === "visible"));
  assert.deepEqual(result, refineStrongReconstruction(input, [], policy));
});
test("unequal repetition cardinality, conflicting owner, and missing noun abstain", () => {
  const input = fixture();
  input.units.splice(2, 1);
  assert.equal(refineStrongReconstruction(input, [], policy).changes.length, 0);
  const swapped = fixture();
  swapped.placements.push(word(1, "H0702", 3));
  assert.equal(
    refineStrongReconstruction(swapped, [], policy).changes.length,
    0
  );
  const noNoun = fixture();
  noNoun.placements = [];
  assert.equal(
    refineStrongReconstruction(noNoun, [], policy).changes.length,
    0
  );
});
test("decimal quantities and unit conversions are never matched by digit components", () => {
  const input = fixture();
  input.text = "4,5 anneaux et 4,5 pieds";
  input.words = ["4", "5", "anneaux", "et", "4", "5", "pieds"];
  assert.equal(refineStrongReconstruction(input, [], policy).changes.length, 0);
  input.text = "125 anneaux et 125 pieds";
  input.words = ["125", "anneaux", "et", "125", "pieds"];
  input.units[0].source.gloss = input.units[2].source.gloss = "two";
  assert.equal(refineStrongReconstruction(input, [], policy).changes.length, 0);
});
test("a source variant blocks numeric placement without inventing an empty", () => {
  const input = fixture();
  input.units[0].source.readingUnresolved = true;
  const result = refineStrongReconstruction(input, [], policy);
  assert.equal(result.changes.length, 0);
  assert.equal(result.prediction.units[0].state, "unresolved");
  assert(result.prediction.placements.every((p) => p.kind !== "empty"));
});
test("display head narrows collocation but preserves its translation relation", () => {
  const u = unit(1, "G0976", "book", "N-GSN", "visible");
  u.targetWordIndices = [0, 1, 2];
  const input: ReconstructionVerse = {
    ref: "Rev.1.1",
    text: "livre de vie",
    words: ["livre", "de", "vie"],
    units: [u],
    placements: [
      {
        ...word(1, "G0976", 0),
        kind: "phrase",
        endWordIndex: 2,
        source: "phrase-transfer:learned-phrase"
      }
    ],
    issues: [],
    unownedAnnotationIds: []
  };
  const witnesses = ["Darby", "DarbyR"].map((name) => ({
    name,
    family: "Darby-family",
    words: ["livre", "de", "vie"],
    placements: [word(1, "G0976", 0)]
  }));
  const result = refineStrongReconstruction(input, witnesses, policy);
  assert.equal(result.prediction.placements[0].kind, "word");
  assert.deepEqual(result.changes[0].relationWordIndices, [0, 1, 2]);
  assert.equal(
    refineStrongReconstruction(input, witnesses, {
      ...policy,
      minimumHeadFamilies: 2
    }).changes.length,
    0
  );
});
test("unknown owners and uncertified empty anchors are removed as uncertainties", () => {
  const input = fixture();
  input.placements.push({
    id: "unknown",
    strong: "G0001",
    kind: "word",
    startWordIndex: 2,
    endWordIndex: 2
  });
  input.placements.push({
    id: "empty",
    strong: "H0702",
    kind: "empty",
    originalOccurrenceId: "occurrence-1",
    insertAfterWordIndex: 1
  });
  input.unownedAnnotationIds = ["unknown"];
  const result = refineStrongReconstruction(input, [], {
    ...policy,
    numeric: false,
    accountability: true
  });
  assert.equal(result.changes.length, 2);
  assert.equal(result.prediction.units[0].state, "unresolved");
  assert.deepEqual(result.prediction.unownedAnnotationIds, []);
  assert(result.prediction.placements.every((p) => p.kind !== "empty"));
});

test("established grammatical empties retain a distinct anchor and relation", () => {
  const input = fixture();
  const marker = unit(9, "H0853", "object marker", "HTo");
  marker.state = "empty";
  marker.assurance = "linguistic-rule";
  marker.anchor = {
    insertAfterWordIndex: 0,
    method: "before-object",
    assurance: "editorial-convention",
    absenceEstablished: true,
    reasons: ["Display before the object; separate from absence."],
    relatedSourceUnits: [input.units[1].sourceUnitId]
  };
  input.units.push(marker);
  const result = refineStrongReconstruction(input, [], {
    ...policy,
    numeric: false,
    accountability: true
  });
  const empty = result.prediction.placements.find((p) => p.strong === "H0853")!;
  assert.equal(empty.kind, "empty");
  assert.equal(empty.insertAfterWordIndex, 0);
  assert.equal(result.prediction.units.at(-1)!.state, "empty");
});

test("learned head evidence requires three distinct family/verse pairs and no conflicting spans", () => {
  const request = { strong: "G0976", phrase: ["le", "livre"] };
  const witness = (ref: string, name: string) => ({
    ref,
    name,
    family: "Darby-family",
    words: ["le", "livre"],
    placements: [word(1, "G0976", 1)]
  });
  assert.equal(
    learnWitnessDisplayHeads(
      [request],
      [
        witness("Gen.1.1", "Darby"),
        witness("Gen.1.1", "DarbyR"),
        witness("Gen.1.2", "Darby")
      ]
    ).length,
    0
  );
  const corpus = [1, 2, 3].map((i) => witness(`Gen.1.${i}`, "Darby"));
  const learned = learnWitnessDisplayHeads([request], corpus);
  assert.equal(learned.length, 1);
  assert.equal(learned[0].offset, 1);
  assert.deepEqual(learned[0].families, ["Darby-family"]);
  corpus.push({
    ...witness("Gen.1.4", "Darby"),
    placements: [{ ...word(1, "G0976", 0), kind: "phrase", endWordIndex: 1 }]
  });
  assert.equal(learnWitnessDisplayHeads([request], corpus).length, 0);
});
