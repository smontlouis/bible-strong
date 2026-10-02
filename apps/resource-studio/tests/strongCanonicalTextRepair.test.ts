import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { splitEmbeddedVerse } from "../src/strongCanonicalTextRepair.js";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
test("splits only the declared numbering marker and proves lossless text recovery", () => {
  const text = "Texte précédent.\n 19 Texte suivant.";
  const r = splitEmbeddedVerse(text, sha(text), "\n 19 ");
  assert.equal(r.left, "Texte précédent.");
  assert.equal(r.right, "Texte suivant.");
  assert.equal(r.left + r.receipt.removedMarker + r.right, text);
});
test("refuses changed bytes, ambiguous markers, and an empty resulting verse", () => {
  assert.throws(
    () => splitEmbeddedVerse("other", sha("original"), " 19 "),
    /source-drift/
  );
  for (const text of ["avant 19 milieu 19 après", "avant 19 "])
    assert.throws(() => splitEmbeddedVerse(text, sha(text), " 19 "));
});
