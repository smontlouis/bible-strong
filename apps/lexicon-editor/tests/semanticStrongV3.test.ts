import test from "node:test";
import assert from "node:assert/strict";

import {
  canonicalStrong,
  classifyOriginalStrong,
  validateDecisionAgainstState,
  type V3Decision
} from "../src/semanticStrongV3.js";

test("canonicalizes STEP-style suffixed Strong values", () => {
  assert.equal(canonicalStrong("H6087a"), "H6087");
  assert.equal(canonicalStrong("g3056"), "G3056");
  assert.equal(canonicalStrong("lemma"), undefined);
});

test("classifies original Strong priorities from morphology position", () => {
  assert.equal(
    classifyOriginalStrong({ strong: "H0120", pos: "noun" }),
    "semantic-high"
  );
  assert.equal(
    classifyOriginalStrong({ strong: "H0871a", pos: "prep" }),
    "function"
  );
  assert.equal(
    classifyOriginalStrong({ strong: "H1886a", pos: "art" }),
    "not-rendered-candidate"
  );
  assert.equal(
    classifyOriginalStrong({ strong: "H0853", pos: "om" }),
    "not-rendered-candidate"
  );
});

test("validates word, phrase, and empty decisions against verse state", () => {
  const state = validationState();

  assert.deepEqual(
    validateDecisionAgainstState(
      decision({ strong: ["H0120"], wordIndex: 1, normalized: "humains" }),
      state,
      0.84
    ),
    { status: "validated" }
  );

  assert.deepEqual(
    validateDecisionAgainstState(
      decision({
        strong: ["H5162"],
        target: "phrase",
        wordIndex: 2,
        startWordIndex: 2,
        endWordIndex: 3,
        normalized: "regrette fort",
        normalizedPhrase: ["regrette", "fort"],
        decision: "accept-phrase"
      }),
      state,
      0.84
    ),
    { status: "validated" }
  );

  assert.deepEqual(
    validateDecisionAgainstState(
      decision({
        strong: ["H6440"],
        target: "empty",
        wordIndex: 3,
        normalized: "",
        decision: "accept-empty"
      }),
      state,
      0.84
    ),
    { status: "validated" }
  );
});

test("rejects invalid V3 decisions", () => {
  const state = validationState();

  assert.deepEqual(
    validateDecisionAgainstState(
      decision({ strong: ["H9999"], wordIndex: 1, normalized: "humains" }),
      state,
      0.84
    ),
    { status: "rejected", reason: "strong-absent-from-original-inventory" }
  );

  assert.deepEqual(
    validateDecisionAgainstState(
      decision({ strong: ["H0120"], wordIndex: 99, normalized: "humains" }),
      state,
      0.84
    ),
    { status: "rejected", reason: "invalid-word-index" }
  );

  assert.deepEqual(
    validateDecisionAgainstState(
      decision({
        strong: ["H5162"],
        target: "phrase",
        wordIndex: 2,
        startWordIndex: 2,
        endWordIndex: 3,
        normalized: "regrette fort",
        normalizedPhrase: ["regrette", "mal"],
        decision: "accept-phrase"
      }),
      state,
      0.84
    ),
    { status: "rejected", reason: "phrase-normalization-mismatch" }
  );

  assert.deepEqual(
    validateDecisionAgainstState(
      decision({
        strong: ["H0120"],
        wordIndex: 0,
        normalized: "les",
        confidence: 0.5
      }),
      state,
      0.84
    ),
    { status: "rejected", reason: "weak-function-word-target" }
  );
});

function validationState() {
  return {
    verse: {
      bookNumber: "1",
      bookId: "Gen",
      chapter: 6,
      verse: 6,
      text: "Les humains regrettent fort."
    },
    words: [
      { wordIndex: 0, text: "Les", normalized: "les", currentStrong: [] },
      {
        wordIndex: 1,
        text: "humains",
        normalized: "humains",
        currentStrong: []
      },
      {
        wordIndex: 2,
        text: "regrettent",
        normalized: "regrette",
        currentStrong: []
      },
      { wordIndex: 3, text: "fort", normalized: "fort", currentStrong: [] }
    ],
    originalCounts: new Map([
      ["H0120", 1],
      ["H5162", 1],
      ["H6440", 1]
    ]),
    representedCounts: new Map<string, number>(),
    existingOverrides: new Set<string>()
  };
}

function decision(overrides: Partial<V3Decision>): V3Decision {
  return {
    bible: "nbs",
    book: "Gen",
    scope: "Gen.6",
    ref: "Gen.6.6",
    strong: ["H0120"],
    target: "word",
    wordIndex: 1,
    normalized: "humains",
    confidence: 0.9,
    decision: "accept-word",
    source: "test",
    reason: "test",
    ...overrides
  };
}
