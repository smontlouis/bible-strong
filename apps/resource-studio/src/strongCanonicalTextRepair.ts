import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  buildCanonicalBibleTextRevision,
  hashCanonicalBibleVerses,
  verifyCanonicalBiblePublication,
  type CanonicalBiblePublication
} from "./strongBibleMobilePublication.js";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
export function splitEmbeddedVerse(
  text: string,
  expectedSha256: string,
  marker: string
) {
  assert.equal(sha(text), expectedSha256, "text-repair-source-drift");
  assert(
    marker.length > 0 &&
      text.includes(marker) &&
      text.indexOf(marker) === text.lastIndexOf(marker),
    "nonunique-verse-marker"
  );
  const at = text.indexOf(marker),
    left = text.slice(0, at),
    right = text.slice(at + marker.length);
  assert(left.trim() && right.trim(), "empty-repaired-verse");
  assert.equal(left + marker + right, text, "repair-roundtrip-drift");
  return {
    left,
    right,
    receipt: {
      sourceSha256: expectedSha256,
      removedMarker: marker,
      offset: at,
      leftSha256: sha(left),
      rightSha256: sha(right)
    }
  };
}
export const S21_JER_23_REPAIR = {
  id: "s21-jeremiah-23-18-19-v1",
  book: "24",
  chapter: "23",
  from: "18",
  to: "19",
  marker: "\n 19 ",
  beforeSha256:
    "9220139cea0123e37676c9607c4d279e77a7179cba1d721a617602d16ba6ff88"
} as const;
export function repairS21Jeremiah(publication: CanonicalBiblePublication) {
  verifyCanonicalBiblePublication(publication);
  assert.equal(publication.applicationVersionId, "S21");
  const spec = S21_JER_23_REPAIR,
    output = structuredClone(publication),
    chapter = output.verses[spec.book][spec.chapter];
  assert(!chapter[spec.to], "repair-target-already-exists");
  const original = chapter[spec.from];
  assert(original);
  for (const [key, value] of Object.entries(original))
    if (key !== "text")
      assert(
        Array.isArray(value) && value.length === 0,
        `presentation-migration-required:${key}`
      );
  const split = splitEmbeddedVerse(
    original.text,
    spec.beforeSha256,
    spec.marker
  );
  chapter[spec.from] = { ...structuredClone(original), text: split.left };
  chapter[spec.to] = { ...structuredClone(original), text: split.right };
  output.verseCount++;
  output.textSha256 = hashCanonicalBibleVerses(output.verses);
  output.textRevision = buildCanonicalBibleTextRevision(
    output.applicationVersionId,
    output.textSha256
  );
  verifyCanonicalBiblePublication(output);
  return {
    publication: output,
    receipt: {
      id: spec.id,
      status: "unpublished-candidate",
      beforeRevision: publication.textRevision,
      afterRevision: output.textRevision,
      from: "Jer.23.18",
      to: ["Jer.23.18", "Jer.23.19"],
      ...split.receipt
    }
  };
}
