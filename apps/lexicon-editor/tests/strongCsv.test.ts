import test from "node:test";
import assert from "node:assert/strict";

import { parseStrongTokens } from "../src/strongCsv.js";

test("parses Strong tokens from tagged verse text", () => {
  const tokens = parseStrongTokens(
    'Au <w strong="H7225">commencement</w>, <w strong="H0430">Dieu</w> créa.'
  );

  assert.deepEqual(
    tokens.map((token) => [token.normalized, token.strong]),
    [
      ["au", []],
      ["commencement", ["H7225"]],
      ["dieu", ["H0430"]],
      ["crea", []]
    ]
  );
});

test("ignores wrapper tags around Strong words", () => {
  const tokens = parseStrongTokens(
    '<p><divineName><w strong="H0430">Dieu</w></divineName></p>'
  );

  assert.deepEqual(tokens, [
    {
      text: "Dieu",
      normalized: "dieu",
      strong: ["H0430"]
    }
  ]);
});
