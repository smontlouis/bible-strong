import {
  CANONICAL_BIBLE_SCHEMA_VERSION,
  buildCanonicalBibleTextRevision,
  hashCanonicalBibleVerses,
  type CanonicalBibleLayoutEvent,
  type CanonicalBiblePublication,
  type CanonicalBibleVerse
} from "./strongBibleMobilePublication.js";

type LegacyBible = Record<string, Record<string, Record<string, string>>>;
type LegacyPericope = Record<
  string,
  Record<
    string,
    Record<string, Partial<Record<"h1" | "h2" | "h3" | "h4", string>>>
  >
>;
type LegacyRedWords = Record<string, Array<{ start: number; end: number }>>;

// USFM codes of the 66 books, by Bible Strong book number. Legacy sources name
// a block of verses translated as one `<first verse>+<USFM code>`.
const USFM_BOOK_CODES = (
  "GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB " +
  "PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP " +
  "HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI " +
  "2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV"
).split(" ");

const BOOK_OR_CHAPTER_KEY = /^[1-9]\d*$/u;
const VERSE_KEY = /^\d+$/u;
const COMBINED_VERSE_KEY = /^(\d+)\+([1-3A-Z][A-Z]{2})$/u;

/**
 * Verse number a legacy verse key is published under. A plain number is
 * itself. A combined block (`"14+EXO"`, verses 14 and 15 translated as one) is
 * published under its first verse number, like every other grouped verse of
 * the legacy sources. Any other key fails: a key is never skipped silently.
 */
export const legacyVerseNumber = (
  book: string,
  chapter: string,
  key: string
): string => {
  if (VERSE_KEY.test(key)) return key;
  const combined = COMBINED_VERSE_KEY.exec(key);
  if (combined && combined[2] === USFM_BOOK_CODES[Number(book) - 1])
    return String(Number(combined[1]));
  throw new Error(
    `legacy-bible-verse-key-unsupported:${book}:${chapter}:${key}`
  );
};

const HEADING_TYPES = {
  h1: "majorSection",
  h2: "scope",
  h3: "section",
  h4: "subsection"
} as const;

const escapeMarkup = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const toRedWordLayout = (
  text: string,
  ranges: readonly { start: number; end: number }[]
): CanonicalBibleLayoutEvent[] => {
  const words = [...text.matchAll(/\S+/gu)].map(
    (match) => [match.index, match.index + match[0].length] as const
  );
  const characterRanges = ranges
    .filter(
      (range) =>
        range.start >= 0 &&
        range.end >= range.start &&
        range.start < words.length
    )
    .map(
      (range) =>
        [
          words[range.start]![0],
          words[Math.min(range.end, words.length - 1)]![1]
        ] as [number, number]
    )
    .sort((left, right) => left[0] - right[0]);
  const merged: Array<[number, number]> = [];
  for (const range of characterRanges) {
    const previous = merged.at(-1);
    if (previous && range[0] <= previous[1])
      previous[1] = Math.max(previous[1], range[1]);
    else merged.push(range);
  }
  return merged.flatMap(([start, end], index) => [
    { offset: start, order: index * 2, type: "open" as const, tag: "wj" },
    { offset: end, order: index * 2 + 1, type: "close" as const, tag: "wj" }
  ]);
};

const legacyPericopeHeadings = (
  pericope: LegacyPericope,
  book: string,
  chapter: string,
  verse: string
) =>
  Object.entries(pericope[book]?.[chapter]?.[verse] ?? {})
    .filter(
      (entry): entry is [keyof typeof HEADING_TYPES, string] =>
        entry[0] in HEADING_TYPES &&
        typeof entry[1] === "string" &&
        entry[1].length > 0
    )
    .map(([level, headingText], order) => ({
      offset: 0,
      order,
      kind: "pericope" as const,
      type: HEADING_TYPES[level],
      text: headingText,
      markup: `<${level}>${escapeMarkup(headingText)}</${level}>`
    }));

/**
 * Adds historical pericopes to a canonical publication whose source carries no
 * headings, and recomputes its text identity. Sources with their own headings
 * are left untouched rather than mixing two editorial apparatuses.
 */
export function applyLegacyPericope(
  publication: CanonicalBiblePublication,
  pericope: unknown
): CanonicalBiblePublication {
  if (publication.headingCount > 0) return publication;
  const verses = structuredClone(publication.verses);
  let headingCount = 0;
  for (const [book, chapters] of Object.entries(verses)) {
    for (const [chapter, chapterVerses] of Object.entries(chapters)) {
      for (const [verse, value] of Object.entries(chapterVerses)) {
        const headings = legacyPericopeHeadings(
          pericope as LegacyPericope,
          book,
          chapter,
          verse
        );
        if (headings.length === 0) continue;
        value.headings = headings;
        headingCount += headings.length;
      }
    }
  }
  if (headingCount === 0) return publication;
  const textSha256 = hashCanonicalBibleVerses(verses);
  return {
    ...publication,
    textRevision: buildCanonicalBibleTextRevision(
      publication.applicationVersionId,
      textSha256
    ),
    textSha256,
    headingCount,
    verses
  };
}

/**
 * True when every verse key of a legacy Bible is a plain number, the only
 * shape its other readers (the Resource service, the reader) understand.
 */
export const legacyBibleHasOnlyPlainVerseKeys = (bible: unknown) =>
  Object.values(bible as LegacyBible).every((chapters) =>
    Object.values(chapters).every((verses) =>
      Object.keys(verses).every((key) => VERSE_KEY.test(key))
    )
  );

export function buildCanonicalBibleFromLegacy(options: {
  versionId: string;
  sourceVersion: string;
  sourceSha256: string;
  bible: unknown;
  pericope?: unknown;
  redWords?: unknown;
}): CanonicalBiblePublication {
  const bible = options.bible as LegacyBible;
  const pericope = (options.pericope ?? {}) as LegacyPericope;
  const redWords = (options.redWords ?? {}) as LegacyRedWords;
  const verses: CanonicalBiblePublication["verses"] = {};
  let verseCount = 0;
  let headingCount = 0;

  for (const [book, chapters] of Object.entries(bible)) {
    if (!BOOK_OR_CHAPTER_KEY.test(book))
      throw new Error(`legacy-bible-book-key-unsupported:${book}`);
    const outputChapters: Record<
      string,
      Record<string, CanonicalBibleVerse>
    > = {};
    for (const [chapter, chapterVerses] of Object.entries(chapters)) {
      if (!BOOK_OR_CHAPTER_KEY.test(chapter))
        throw new Error(
          `legacy-bible-chapter-key-unsupported:${book}:${chapter}`
        );
      const outputVerses: Record<string, CanonicalBibleVerse> = {};
      for (const [key, text] of Object.entries(chapterVerses)) {
        const verse = legacyVerseNumber(book, chapter, key);
        if (verse in outputVerses)
          throw new Error(
            `legacy-bible-verse-duplicate:${book}:${chapter}:${key}`
          );
        if (typeof text !== "string")
          throw new Error("legacy-bible-verse-invalid");
        const headings = legacyPericopeHeadings(pericope, book, chapter, verse);
        headingCount += headings.length;
        outputVerses[verse] = {
          text,
          startTags: [],
          layout: toRedWordLayout(
            text,
            redWords[`${book}-${chapter}-${verse}`] ?? []
          ),
          notes: [],
          headings
        };
        verseCount += 1;
      }
      if (Object.keys(outputVerses).length > 0)
        outputChapters[chapter] = outputVerses;
    }
    if (Object.keys(outputChapters).length > 0) verses[book] = outputChapters;
  }

  const textSha256 = hashCanonicalBibleVerses(verses);
  return {
    format: "bible-strong-canonical-bible",
    schemaVersion: CANONICAL_BIBLE_SCHEMA_VERSION,
    applicationVersionId: options.versionId,
    datasetId: `ordinary-bible-${options.versionId.toLowerCase()}`,
    sourceVersion: options.sourceVersion,
    textRevision: buildCanonicalBibleTextRevision(
      options.versionId,
      textSha256
    ),
    textSha256,
    sourceSha256: options.sourceSha256,
    verseCount,
    noteCount: 0,
    headingCount,
    verses
  };
}
