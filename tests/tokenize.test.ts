import test from "node:test";
import assert from "node:assert/strict";

import { normalizeWord, tokenizeText } from "../src/tokenize.js";

test("normalizes French accents and elisions", () => {
  assert.equal(normalizeWord("l’Éternel"), "eternel");
  assert.equal(normalizeWord("créa"), "crea");
  assert.equal(normalizeWord("qu’il"), "il");
});

test("tokenizes words while preserving text segments", () => {
  const segments = tokenizeText("Au commencement, Dieu créa.");

  assert.deepEqual(
    segments.map((segment) => segment.kind),
    ["word", "text", "word", "text", "word", "text", "word", "text"]
  );
});
