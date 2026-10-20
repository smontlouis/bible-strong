import { liftHeadingNotes } from "./projectEnglishStrongMobileJsonl.js";
import {
  buildCanonicalBibleTextRevision,
  hashCanonicalBibleVerses,
  type CanonicalBiblePublication,
  type CanonicalBibleVerse
} from "./strongBibleMobilePublication.js";

/**
 * Adds notes before the first word of a verse, after every layout event and
 * note already at that offset, so a paragraph or line opening there still
 * comes first.
 */
export function prependVerseNotes(
  verse: CanonicalBibleVerse,
  markups: readonly string[]
): void {
  if (markups.length === 0) return;
  const orders = [
    ...verse.layout.filter((event) => event.offset === 0),
    ...verse.notes.filter((note) => note.offset === 0)
  ].map((event) => event.order);
  const first = orders.length > 0 ? Math.max(...orders) + 1 : 0;
  verse.notes.push(
    ...markups.map((markup, index) => ({
      offset: 0,
      order: first + index,
      kind: "note" as const,
      markup
    }))
  );
}

/**
 * A heading never reads its own notes. Notes a source keeps inside a heading
 * (SWORD psalm superscriptions) become notes of the verse the heading opens,
 * before its first word, and the heading keeps its title alone. A publication
 * without such notes is returned as is.
 */
export function liftCanonicalHeadingNotes(
  publication: CanonicalBiblePublication
): CanonicalBiblePublication {
  let liftedCount = 0;
  const verses = structuredClone(publication.verses);
  for (const chapters of Object.values(verses)) {
    for (const chapterVerses of Object.values(chapters)) {
      for (const verse of Object.values(chapterVerses)) {
        const notes: string[] = [];
        verse.headings = verse.headings.map((heading) => {
          const lifted = liftHeadingNotes(heading.markup);
          if (!lifted) return heading;
          notes.push(...lifted.notes);
          return { ...heading, text: lifted.text, markup: lifted.markup };
        });
        prependVerseNotes(verse, notes);
        liftedCount += notes.length;
      }
    }
  }
  if (liftedCount === 0) return publication;
  const textSha256 = hashCanonicalBibleVerses(verses);
  return {
    ...publication,
    textRevision: buildCanonicalBibleTextRevision(
      publication.applicationVersionId,
      textSha256
    ),
    textSha256,
    noteCount: publication.noteCount + liftedCount,
    verses
  };
}
