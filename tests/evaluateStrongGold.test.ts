import assert from "node:assert/strict";
import test from "node:test";

import {
  excludedReferenceNamesForGold,
  extractGoldCarrierPlacements,
  isEvaluateStrongGoldMain,
  placementsFromReaderResult,
  scoreCarrierAwareVerse,
  selectStratifiedRefs,
  type CarrierPlacement
} from "../src/evaluateStrongGold.js";
import { alignReaderVerse } from "../src/readerAlignment.js";

test("extracts exact word, phrase, and empty carriers from gold markup", () => {
  const placements = extractGoldCarrierPlacements(
    '<w strong="H0000"></w>Au <w strong="H0001">commencement</w>, <w strong="H0002 H0003">Dieu vivant</w><w strong="H0004"></w>.'
  );

  assert.deepEqual(placements, [
    {
      strong: "H0000",
      kind: "empty",
      insertAfterWordIndex: -1
    },
    {
      strong: "H0001",
      kind: "word",
      startWordIndex: 1,
      endWordIndex: 1
    },
    {
      strong: "H0002",
      kind: "phrase",
      startWordIndex: 2,
      endWordIndex: 3
    },
    {
      strong: "H0003",
      kind: "phrase",
      startWordIndex: 2,
      endWordIndex: 3
    },
    {
      strong: "H0004",
      kind: "empty",
      insertAfterWordIndex: 3
    }
  ]);
});

test("maps tagged elisions to the token indexes of the stripped verse", () => {
  const placements = extractGoldCarrierPlacements(
    'de l’<w strong="H8415">abîme</w> et <w strong="H1961">qu’</w>elle soit'
  );

  assert.deepEqual(placements, [
    {
      strong: "H8415",
      kind: "word",
      startWordIndex: 1,
      endWordIndex: 1
    },
    {
      strong: "H1961",
      kind: "word",
      startWordIndex: 3,
      endWordIndex: 3
    }
  ]);
});

test("includes word, phrase, and empty reader assignments", () => {
  const result = alignReaderVerse({
    targetText: "Au commencement Dieu vivant.",
    references: []
  });
  result.assignments.set(1, {
    strong: ["H0001"],
    confidence: 0.96,
    source: "test",
    method: "exact",
    originalConfirmed: true
  });
  result.phraseAssignments.push({
    strong: ["H0002", "H0003"],
    confidence: 0.88,
    source: "test",
    method: "learned-phrase",
    startWordIndex: 2,
    endWordIndex: 3,
    originalConfirmed: true
  });
  result.emptyAssignments.push({
    strong: "H0004",
    confidence: 0.7,
    source: "test",
    method: "editorial-empty",
    insertAfterWordIndex: 3
  });

  assert.deepEqual(placementsFromReaderResult(result), [
    {
      strong: "H0001",
      kind: "word",
      startWordIndex: 1,
      endWordIndex: 1,
      confidence: 0.96,
      source: "exact"
    },
    {
      strong: "H0002",
      kind: "phrase",
      startWordIndex: 2,
      endWordIndex: 3,
      confidence: 0.88,
      source: "learned-phrase"
    },
    {
      strong: "H0003",
      kind: "phrase",
      startWordIndex: 2,
      endWordIndex: 3,
      confidence: 0.88,
      source: "learned-phrase"
    },
    {
      strong: "H0004",
      kind: "empty",
      insertAfterWordIndex: 3,
      confidence: 0.7,
      source: "editorial-empty"
    }
  ]);
});

test("scores exact carrier occurrences separately from inventory", () => {
  const expected: CarrierPlacement[] = [
    word("H0001", 1),
    phrase("H0002", 2, 3),
    empty("H0003", 3)
  ];
  const predicted: CarrierPlacement[] = [
    { ...word("H0001", 1), confidence: 0.98 },
    { ...phrase("H0002", 2, 3), confidence: 0.92 },
    { ...empty("H0003", 3), confidence: 0.86 }
  ];

  const score = scoreCarrierAwareVerse("Gen.1.1", predicted, expected);

  assert.equal(score.inventoryOccurrence.f1, 1);
  assert.equal(score.carrierExact.f1, 1);
  assert.equal(score.carrierOverlap.f1, 1);
  assert.equal(score.visibleCarrierExact.truePositive, 2);
  assert.equal(score.emptyCarrierExact.truePositive, 1);
  assert.equal(score.cardinality.exactVerseRate, 1);
  assert.equal(score.confidence.riskCoverage.at(-1)?.coverage, 1);
  assert.equal(score.confidence.riskCoverage.at(-1)?.precision, 1);
  assert.deepEqual(score.predictionSources, [
    {
      source: "unknown",
      predictedCount: 3,
      correctExactCarrierCount: 3,
      precision: 1,
      averageConfidence: 0.92
    }
  ]);
});

test("distinguishes wrong carriers, overlapping spans, and empty visibility", () => {
  const expected: CarrierPlacement[] = [
    word("H0001", 0),
    phrase("H0002", 1, 2),
    empty("H0003", 2)
  ];
  const predicted: CarrierPlacement[] = [
    { ...word("H0001", 1), confidence: 0.99 },
    { ...word("H0002", 2), confidence: 0.8 },
    { ...empty("H0003", 1), confidence: 0.4 }
  ];

  const score = scoreCarrierAwareVerse("Gen.1.2", predicted, expected);

  assert.equal(score.inventoryOccurrence.truePositive, 3);
  assert.equal(score.inventoryOccurrence.f1, 1);
  assert.equal(score.carrierExact.truePositive, 0);
  assert.equal(score.carrierOverlap.truePositive, 1);
  assert.equal(score.carrierOverlap.meanSpanIoU, 0.5);
  assert.equal(score.visibilityClassification.truePositive, 3);
  assert.equal(score.emptyCarrierExact.truePositive, 0);
  assert.equal(score.cardinality.exactVerseRate, 1);
  assert.equal(score.category, "wrong-carrier");
});

test("reports per-Strong occurrence cardinality errors even at equal totals", () => {
  const score = scoreCarrierAwareVerse(
    "Gen.1.3",
    [word("H0001", 0), word("H0002", 1)],
    [word("H0001", 0), word("H0001", 1)]
  );

  assert.equal(score.cardinality.expectedCount, 2);
  assert.equal(score.cardinality.predictedCount, 2);
  assert.equal(score.cardinality.absoluteOccurrenceError, 2);
  assert.equal(score.cardinality.comparedStrongTypeCount, 2);
  assert.equal(score.cardinality.exactStrongTypeCount, 0);
  assert.equal(score.cardinality.exactVerseRate, 0);
});

test("selects a deterministic proportional sample spread across books", () => {
  const refs = [
    "Gen.1.1",
    "Gen.1.2",
    "Gen.1.3",
    "Gen.1.4",
    "Gen.1.5",
    "Gen.1.6",
    "Exod.1.1",
    "Exod.1.2",
    "Exod.1.3",
    "Exod.1.4",
    "Matt.1.1",
    "Matt.1.2"
  ];

  const selected = selectStratifiedRefs(refs, 6);

  assert.deepEqual(selectStratifiedRefs([...refs].reverse(), 6), selected);
  assert.equal(selected.length, 6);
  assert.deepEqual(
    new Set(selected.map((ref) => ref.split(".")[0])),
    new Set(["Gen", "Exod", "Matt"])
  );
  assert.notDeepEqual(selected, refs.slice(0, 6));
  assert.ok(selected.includes("Gen.1.2"));
  assert.ok(selected.includes("Gen.1.6"));
});

test("holds out the complete editorial family of the gold reference", () => {
  assert.deepEqual(excludedReferenceNamesForGold("Sg1910", false), ["Sg1910"]);
  assert.deepEqual(excludedReferenceNamesForGold("Darby", false), [
    "Darby",
    "DarbyR"
  ]);
  assert.deepEqual(excludedReferenceNamesForGold("DarbyR", false), [
    "Darby",
    "DarbyR"
  ]);
  assert.deepEqual(excludedReferenceNamesForGold("Darby", true), []);
});

test("main-module guard remains false for an imported evaluator", () => {
  assert.equal(
    isEvaluateStrongGoldMain(
      "file:///workspace/src/evaluateStrongGold.ts",
      "/workspace/tests/evaluateStrongGold.test.ts"
    ),
    false
  );
});

function word(strong: string, wordIndex: number): CarrierPlacement {
  return {
    strong,
    kind: "word",
    startWordIndex: wordIndex,
    endWordIndex: wordIndex
  };
}

function phrase(
  strong: string,
  startWordIndex: number,
  endWordIndex: number
): CarrierPlacement {
  return {
    strong,
    kind: "phrase",
    startWordIndex,
    endWordIndex
  };
}

function empty(strong: string, insertAfterWordIndex: number): CarrierPlacement {
  return {
    strong,
    kind: "empty",
    insertAfterWordIndex
  };
}
