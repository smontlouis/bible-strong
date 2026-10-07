import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  buildCanonicalBibleTextRevision,
  hashCanonicalBibleVerses,
  verifyCanonicalBiblePublication,
  type CanonicalBiblePublication
} from "./strongBibleMobilePublication.js";

export interface PlainTextWitness {
  ref: string;
  name: string;
  text: string;
}
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const canonicalCharacter = (character: string) =>
  character.toLowerCase().replaceAll("’", "'");
function compact(text: string) {
  return canonicalCharacter(text).replace(/\s/gu, "");
}
/** A whole-verse text match supports only spaces at suspicious lower/upper joins.
 * No annotated target, synonym, character substitution or guessed split is used.
 */
export function repairJoinedText(text: string, witnesses: PlainTextWitness[]) {
  const offsets = [...text.matchAll(/\p{Ll}(?=\p{Lu}\p{Ll})/gu)].map(
    (m) => m.index! + m[0].length
  );
  const matching = witnesses.filter((w) => compact(w.text) === compact(text));
  const accepted = offsets.filter(
    (offset) =>
      matching.length &&
      matching.every((w) => {
        const before = compact(text.slice(0, offset));
        let consumed = "";
        for (let i = 0; i < w.text.length; i++) {
          const char = w.text[i];
          if (/\s/u.test(char)) {
            if (consumed === before) return true;
          } else consumed += canonicalCharacter(char);
        }
        return false;
      })
  );
  let repaired = text;
  for (const offset of [...accepted].reverse())
    repaired = repaired.slice(0, offset) + " " + repaired.slice(offset);
  let roundtrip = repaired;
  for (let i = accepted.length - 1; i >= 0; i--) {
    const offset = accepted[i] + i;
    assert.equal(roundtrip[offset], " ");
    roundtrip = roundtrip.slice(0, offset) + roundtrip.slice(offset + 1);
  }
  assert.equal(roundtrip, text, "text-repair-roundtrip-drift");
  return {
    text: repaired,
    insertions: accepted,
    unresolvedOffsets: offsets.filter((offset) => !accepted.includes(offset)),
    witnesses: accepted.length
      ? matching.map((w) => ({
          ref: w.ref,
          name: w.name,
          textSha256: sha(w.text)
        }))
      : [],
    beforeSha256: sha(text),
    afterSha256: sha(repaired)
  };
}

export function repairJoinedBibleText(
  publication: CanonicalBiblePublication,
  witnesses: PlainTextWitness[]
) {
  verifyCanonicalBiblePublication(publication);
  const index = new Map<string, PlainTextWitness[]>();
  for (const w of witnesses) {
    const key = compact(w.text),
      entries = index.get(key) ?? [];
    entries.push(w);
    index.set(key, entries);
  }
  const output = structuredClone(publication),
    changes = [],
    unresolved = [];
  for (const [book, chapters] of Object.entries(output.verses))
    for (const [chapter, verses] of Object.entries(chapters))
      for (const [verse, entry] of Object.entries(verses)) {
        const result = repairJoinedText(
          entry.text,
          index.get(compact(entry.text)) ?? []
        );
        if (result.unresolvedOffsets.length)
          unresolved.push({
            book,
            chapter,
            verse,
            offsets: result.unresolvedOffsets
          });
        if (!result.insertions.length) continue;
        for (const event of [
          ...entry.layout,
          ...entry.notes,
          ...entry.headings
        ]) {
          assert(
            !result.insertions.includes(event.offset),
            "ambiguous-presentation-at-repair-boundary"
          );
          event.offset += result.insertions.filter(
            (at) => at < event.offset
          ).length;
        }
        entry.text = result.text;
        changes.push({ book, chapter, verse, ...result });
      }
  output.textSha256 = hashCanonicalBibleVerses(output.verses);
  output.textRevision = buildCanonicalBibleTextRevision(
    output.applicationVersionId,
    output.textSha256
  );
  verifyCanonicalBiblePublication(output);
  return {
    publication: output,
    receipt: {
      policy: "whole-text-witness-whitespace-repair-v1",
      status: "unpublished-candidate",
      beforeRevision: publication.textRevision,
      afterRevision: output.textRevision,
      changedVerses: changes.length,
      insertedSpaces: changes.reduce(
        (sum, change) => sum + change.insertions.length,
        0
      ),
      changes,
      unresolved
    }
  };
}
