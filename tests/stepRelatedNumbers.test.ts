import assert from "node:assert/strict";
import test from "node:test";

import {
  assertPinnedStepLexicon,
  parseStepRelatedNumbers
} from "../src/stepRelatedNumbers.js";

test("STEP related numbers preserve order and remove self-links and duplicates", () => {
  const entries = parseStepRelatedNumbers(`
$=H7225G=ראשית======================
@StrNo= H7225
@StepRelatedNos2= H7218A, H7225G, H7225H, H7218A, H7226,
$=H7225H=ראשית======================
@StepRelatedNos2= H7225G,
`);

  assert.deepEqual(entries, [
    {
      code: "H7225G",
      relatedCodes: ["H7218A", "H7225H", "H7226"],
      sourceLine: 2,
      fieldLine: 4
    },
    {
      code: "H7225H",
      relatedCodes: ["H7225G"],
      sourceLine: 5,
      fieldLine: 6
    }
  ]);
});

test("STEP compiled lexicons reject content outside the pinned digest", () => {
  assert.throws(
    () => assertPinnedStepLexicon("changed", "0".repeat(64), "hebrew"),
    /step-compiled-lexicon-sha256-mismatch:hebrew/u
  );
});
