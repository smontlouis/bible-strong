import assert from "node:assert/strict";
import test from "node:test";
import {
  LEXICAL_MORPHOLOGY_SUPPLEMENTS,
  normalizeMorphologyCode
} from "../src/lexiconV3/morphologySupplements.js";

test("the STEP lexical morphology supplements are complete and bilingual", () => {
  assert.equal(LEXICAL_MORPHOLOGY_SUPPLEMENTS.length, 26);
  assert.equal(
    new Set(LEXICAL_MORPHOLOGY_SUPPLEMENTS.map((row) => row.code)).size,
    LEXICAL_MORPHOLOGY_SUPPLEMENTS.length
  );
  for (const row of LEXICAL_MORPHOLOGY_SUPPLEMENTS) {
    assert.ok(row.meaning.trim(), `${row.code}: missing English meaning`);
    assert.ok(row.description.trim(), `${row.code}: missing English description`);
    assert.ok(row.meaningFr.trim(), `${row.code}: missing French meaning`);
    assert.ok(row.descriptionFr.trim(), `${row.code}: missing French description`);
    assert.equal(row.normalizedCode, normalizeMorphologyCode(row.code));
  }
});

test("STEP separator spacing normalizes consistently", () => {
  assert.equal(normalizeMorphologyCode("G:A/ G:ADV"), "G:A/G:ADV");
  assert.equal(normalizeMorphologyCode("G:N-F / G:A-F"), "G:N-F/G:A-F");
  assert.equal(normalizeMorphologyCode("G:CONJ + G:P-1"), "G:CONJ+G:P-1");
});
