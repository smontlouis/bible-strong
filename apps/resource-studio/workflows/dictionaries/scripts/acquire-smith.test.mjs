import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSmithEntries,
  canonicalizeSmithPassage,
  formatSmithHeadword,
  transformSmithDefinition
} from "./acquire-smith.mjs";

test("canonicalizes SWORD book abbreviations before BCV parsing", () => {
  assert.equal(canonicalizeSmithPassage("nu 33:39"), "Num 33:39");
  assert.equal(canonicalizeSmithPassage("de. 9:20"), "Deut 9:20");
  assert.equal(canonicalizeSmithPassage("ezr, 2:1"), "Ezra 2:1");
  assert.equal(canonicalizeSmithPassage("phm 4:3"), "Phil 4:3");
});

test("formats Smith headings and repairs the corrupt High Priest heading", () => {
  assert.equal(formatSmithHeadword("AARON"), "Aaron");
  assert.equal(
    formatSmithHeadword("PTOLEMAEUS, OR PTOLEMY"),
    "Ptolemaeus, or Ptolemy"
  );
  assert.equal(formatSmithHeadword("HIGH PLACES6813 PRIEST"), "High Priest");
});

test("converts ThML references and terms into dictionary anchors", () => {
  const html = transformSmithDefinition({
    html: '<i>See</i> <term>AARON</term> (<scripRef passage="nu 26:59">Numbers 26:59</scripRef>)',
    titles: new Map([["aaron", "Aaron"]])
  });
  assert.equal(
    html,
    '<i>See</i> <a class="word" href="Aaron">AARON</a> (<a class="verse" href="Num 26:59">Numbers 26:59</a>)'
  );
  assert.doesNotMatch(html, /scripRef|<term/iu);
});

test("merges duplicate headings without discarding definitions", () => {
  const entries = buildSmithEntries([
    { word: "AARON", definition: "First" },
    { word: "AARON", definition: "Second" }
  ]);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].word, "Aaron");
  assert.match(entries[0].definition, /First/iu);
  assert.match(entries[0].definition, /Additional entry[\s\S]*Second/iu);
});
