import assert from "node:assert/strict";
import test from "node:test";
import { buildIsbeEntries, transformIsbeDefinition } from "./acquire-isbe.mjs";

test("converts ISBE TEI references and safe formatting", () => {
  const html = transformIsbeDefinition({
    html: '<entryFree n="AARON"><p><hi rend="underline">Family:</hi> <ref osisRef="Bible:Exod.6.20">Ex 6:20</ref>; see <ref target="ISBE:PRIEST">PRIEST</ref>.</p></entryFree>',
    titles: new Map([["priest", "Priest"]])
  });
  assert.equal(
    html,
    '<p><strong>Family:</strong> <a class="verse" href="Exod.6.20">Ex 6:20</a>; see <a class="word" href="Priest">PRIEST</a>.</p>'
  );
});

test("builds readable ISBE headings", () => {
  const [entry] = buildIsbeEntries([
    { word: "AARON'S ROD", definition: "<p>Text</p>" }
  ]);
  assert.equal(entry.word, "Aaron's Rod");
  assert.equal(entry.normalizedWord, "aaron s rod");
});
