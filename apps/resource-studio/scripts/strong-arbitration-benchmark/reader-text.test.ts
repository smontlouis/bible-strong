import assert from "node:assert/strict";
import test from "node:test";
import { withoutPublisherNotes } from "./reader-text.js";
import { extractGoldCarrierPlacements } from "../../src/evaluateStrongGold.js";
import { stripTags, tokenizeText } from "../../src/tokenize.js";
test("publisher note removal preserves adjacent carriers and recomputes target indices", () => {
  const input =
    '<w strong="H0413">sur</w><note n="a"><i>litt. : </i>à, dans<i>.</i></note> l’<w strong="H7549">étendue</w>';
  const cleaned = withoutPublisherNotes(input);
  assert.equal(stripTags(cleaned), "sur l’étendue");
  assert.deepEqual(
    tokenizeText(stripTags(cleaned))
      .filter((t) => t.kind === "word")
      .map((t) => t.text),
    ["sur", "l’étendue"]
  );
  assert.deepEqual(
    extractGoldCarrierPlacements(cleaned).map((p) => [
      p.strong,
      p.startWordIndex
    ]),
    [
      ["H0413", 0],
      ["H7549", 1]
    ]
  );
});
test("nested and self-closing notes are removed without losing surrounding text", () => {
  assert.equal(
    withoutPublisherNotes("a<note>x<note>y</note>z</note>b<note/>c"),
    "abc"
  );
  assert.equal(withoutPublisherNotes("<p>a<i>b</i></p>"), "<p>a<i>b</i></p>");
});
test("malformed note markup fails instead of swallowing verse text", () => {
  assert.throws(() => withoutPublisherNotes("a<note>b"), /unclosed-note/);
  assert.throws(
    () => withoutPublisherNotes("a</note>b"),
    /unmatched-note-close/
  );
});
