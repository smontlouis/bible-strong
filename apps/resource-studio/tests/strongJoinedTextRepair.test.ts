import assert from "node:assert/strict";
import test from "node:test";
import { repairJoinedText } from "../src/strongJoinedTextRepair.js";

test("repairs only a whole-text-witness-supported whitespace boundary and preserves every character", () => {
  const text = "La justiceDissipe le malEt protège.\n";
  const result = repairJoinedText(text, [
    {
      name: "witness",
      ref: "Prov.1.1",
      text: "La justice dissipe le mal et protège."
    }
  ]);
  assert.equal(result.text, "La justice Dissipe le mal Et protège.\n");
  assert.equal(result.insertions.length, 2);
  assert.equal(result.unresolvedOffsets.length, 0);
  assert.equal(result.text.replaceAll(" ", ""), text.replaceAll(" ", ""));
  assert.equal(result.witnesses.length, 1);
});
test("refuses guessed word boundaries, different lexical texts, and contradictory witness spacing", () => {
  const text = "La justiceDissipe le mal.";
  assert.equal(repairJoinedText(text, []).text, text);
  assert.equal(
    repairJoinedText(text, [
      { name: "w", ref: "r", text: "La justice dissipe un mal." }
    ]).text,
    text
  );
  assert.equal(
    repairJoinedText(text, [
      { name: "a", ref: "a", text: "La justice dissipe le mal." },
      { name: "b", ref: "b", text }
    ]).text,
    text
  );
});
test("does not split existing proper names, rewrite punctuation or normalize accents", () => {
  assert.equal(
    repairJoinedText("McDonald vient.", [
      { name: "w", ref: "r", text: "McDonald vient." }
    ]).text,
    "McDonald vient."
  );
  const text = "Le cafeEst fermé.";
  assert.equal(
    repairJoinedText(text, [
      { name: "w", ref: "r", text: "Le café est fermé." }
    ]).text,
    text
  );
});
