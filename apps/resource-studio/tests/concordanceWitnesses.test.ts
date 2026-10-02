import assert from "node:assert/strict";
import test from "node:test";
import { extendLocutions } from "../scripts/concordance-witnesses/locutions.js";

// Invented wording reproducing the two export formats.
const OSIS =
  '<w lemma="strong:H6435" type="x-split-1">de</w> <w lemma="strong:H6435" type="x-split-1">peur</w> <w lemma="strong:H6435" type="x-split-1">que</w> le <w lemma="strong:H4428">roi</w> <w lemma="strong:H0853"> </w> <w lemma="strong:H3808" type="x-split-2">ne</w> vienne <w lemma="strong:H3808" type="x-split-2">point</w>.';
const CSV =
  'de <w strong="H6435">peur</w> que le <w strong="H4428">roi</w> <w strong="H0853"></w> <w strong="H3808">ne</w> vienne point.';

test("the CSV tag of a locution widens over its contiguous OSIS group", () => {
  const result = extendLocutions(CSV, OSIS);
  assert.equal(
    result.text,
    '<w strong="H6435" head="peur">de peur que</w> le <w strong="H4428">roi</w> <w strong="H0853"></w> <w strong="H3808">ne</w> vienne point.'
  );
  // The discontinuous « ne … point » keeps its single tagged word.
  assert.deepEqual(
    { extended: result.extended, headOnly: result.headOnly },
    { extended: 1, headOnly: 1 }
  );
});

test("a verse whose tags do not align with the OSIS stays untouched", () => {
  const result = extendLocutions(CSV.replace("H4428", "H4430"), OSIS);
  assert.equal(result.text, CSV.replace("H4428", "H4430"));
  assert.equal(result.extended, 0);
  assert.equal(result.mismatch, "word:1");
});
