import { createHash } from "node:crypto";

import { prependVerseNotes } from "./canonicalHeadingNotes.js";

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

interface LegacyPericopeRepairBase {
  /** `<book>-<chapter>-<verse>`, the verse the heading opens. */
  ref: string;
  level: keyof typeof HEADING_TYPES;
  /** Truncated SHA-256 of the heading as the source prints it. */
  expect: string;
  /** Why the heading is corrected. Never quotes Bible text. */
  evidence: string;
}

/**
 * One reviewed correction of a historical pericope heading. The repository is
 * public and stores no Bible text: a repair is anchored on the hash of the
 * heading, and names parts of it by UTF-16 offsets.
 */
export type LegacyPericopeRepair =
  /**
   * The level alone cannot tell a title from a line of references: the
   * repair names what the heading is and tags its references.
   */
  | (LegacyPericopeRepairBase & {
      op: "retype";
      kind: "pericope" | "heading" | "parallel";
      type: string;
      /** Each cited passage, in reading order, as it is printed. */
      references: Array<{ text: string; osisRef: string }>;
    })
  /**
   * The source flattened the heading with its notes inline behind their
   * label (`Title#38.21 note…`). `remove` are the spans of the notes, label
   * included, that the title loses; `notes` are the spans of their contents,
   * each becoming a note of `verse` in the same chapter, before its first word.
   */
  | (LegacyPericopeRepairBase & {
      op: "notes";
      remove: Array<[number, number]>;
      notes: Array<{ at: [number, number]; verse: string }>;
      /** The provider chapter the spans were read from. */
      provider: { url: string; sha256: string };
    });

export interface LegacyPericopeRepairSet {
  /** SHA-256 of the pericope entry the repairs were reviewed against. */
  pericopeSha256: string;
  repairs: LegacyPericopeRepair[];
}

export const hashHeadingText = (text: string) =>
  createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);

const markupWithReferences = (
  level: string,
  text: string,
  references: Array<{ text: string; osisRef: string }>
) => {
  let cursor = 0;
  let markup = "";
  for (const reference of references) {
    const start = text.indexOf(reference.text, cursor);
    if (start < 0)
      throw new Error(
        `legacy-pericope-repair-reference-missing:${reference.text}`
      );
    markup +=
      escapeMarkup(text.slice(cursor, start)) +
      `<reference osisRef="${escapeMarkup(reference.osisRef)}">` +
      `${escapeMarkup(reference.text)}</reference>`;
    cursor = start + reference.text.length;
  }
  return `<${level}>${markup}${escapeMarkup(text.slice(cursor))}</${level}>`;
};

const isSpan = (span: [number, number], length: number) =>
  Number.isSafeInteger(span[0]) &&
  Number.isSafeInteger(span[1]) &&
  span[0] >= 0 &&
  span[0] < span[1] &&
  span[1] <= length;

/** The heading without the spans of its notes, its spacing made whole. */
const headingWithoutNotes = (
  text: string,
  remove: Array<[number, number]>,
  key: string
) => {
  let cursor = 0;
  let title = "";
  for (const span of remove) {
    if (!isSpan(span, text.length) || span[0] < cursor)
      throw new Error(`legacy-pericope-repair-span-invalid:${key}`);
    title += text.slice(cursor, span[0]);
    // A note between two words must not glue them.
    if (
      /[\p{L}\p{N}]$/u.test(title) &&
      /^[\p{L}\p{N}]/u.test(text.slice(span[1]))
    )
      title += " ";
    cursor = span[1];
  }
  title += text.slice(cursor);
  // Removing a note leaves the spaces on both of its sides; a run holding a
  // no-break space is the French one before `?` or `!`.
  const clean = title
    .replace(/\s{2,}/gu, (run) => (run.includes("\u00a0") ? "\u00a0" : " "))
    .trim();
  if (!clean) throw new Error(`legacy-pericope-repair-title-empty:${key}`);
  return clean;
};

/** Repairs not yet applied, by `<ref>:<level>`, and the notes they lift. */
interface PericopeRepairState {
  pending: Map<string, LegacyPericopeRepair>;
  notes: Array<{
    book: string;
    chapter: string;
    verse: string;
    markup: string;
  }>;
}

const pericopeRepairState = (
  repairs: readonly LegacyPericopeRepair[] = []
): PericopeRepairState => {
  const pending = new Map<string, LegacyPericopeRepair>();
  for (const repair of repairs) {
    const key = `${repair.ref}:${repair.level}`;
    if (pending.has(key))
      throw new Error(`legacy-pericope-repair-duplicate:${key}`);
    pending.set(key, repair);
  }
  return { pending, notes: [] };
};

/**
 * Every repair must find its heading, and every lifted note its verse: none
 * is skipped silently. Places the notes and returns how many.
 */
const completePericopeRepairs = (
  state: PericopeRepairState,
  verses: CanonicalBiblePublication["verses"]
) => {
  const [key] = state.pending.keys();
  if (key) throw new Error(`legacy-pericope-repair-unused:${key}`);
  const byVerse = new Map<string, string[]>();
  for (const note of state.notes) {
    const verseKey = `${note.book}-${note.chapter}-${note.verse}`;
    if (!verses[note.book]?.[note.chapter]?.[note.verse])
      throw new Error(`legacy-pericope-note-verse-missing:${verseKey}`);
    byVerse.set(verseKey, [...(byVerse.get(verseKey) ?? []), note.markup]);
  }
  for (const [verseKey, markups] of byVerse) {
    const [book, chapter, verse] = verseKey.split("-") as [
      string,
      string,
      string
    ];
    prependVerseNotes(verses[book]![chapter]![verse]!, markups);
  }
  return state.notes.length;
};

const legacyPericopeHeadings = (
  pericope: LegacyPericope,
  book: string,
  chapter: string,
  verse: string,
  state: PericopeRepairState
) =>
  Object.entries(pericope[book]?.[chapter]?.[verse] ?? {})
    .filter(
      (entry): entry is [keyof typeof HEADING_TYPES, string] =>
        entry[0] in HEADING_TYPES &&
        typeof entry[1] === "string" &&
        entry[1].length > 0
    )
    .map(([level, headingText], order) => {
      const key = `${book}-${chapter}-${verse}:${level}`;
      const repair = state.pending.get(key);
      const heading = {
        offset: 0,
        order,
        kind: "pericope" as "pericope" | "heading" | "parallel",
        type: HEADING_TYPES[level] as string,
        text: headingText,
        markup: `<${level}>${escapeMarkup(headingText)}</${level}>`
      };
      if (!repair) return heading;
      if (hashHeadingText(headingText) !== repair.expect)
        throw new Error(`legacy-pericope-repair-anchor-mismatch:${key}`);
      state.pending.delete(key);
      if (repair.op === "retype")
        return {
          ...heading,
          kind: repair.kind,
          type: repair.type,
          markup: markupWithReferences(level, headingText, repair.references)
        };
      const text = headingWithoutNotes(headingText, repair.remove, key);
      for (const note of repair.notes) {
        const covered = repair.remove.some(
          ([start, end]) => start <= note.at[0] && note.at[1] <= end
        );
        if (!isSpan(note.at, headingText.length) || !covered)
          throw new Error(`legacy-pericope-repair-span-invalid:${key}`);
        const content = headingText.slice(note.at[0], note.at[1]).trim();
        if (!content || !/^[1-9]\d*$/u.test(note.verse))
          throw new Error(`legacy-pericope-repair-note-invalid:${key}`);
        state.notes.push({
          book,
          chapter,
          verse: note.verse,
          markup: `<note>${escapeMarkup(content)}</note>`
        });
      }
      return {
        ...heading,
        text,
        markup: `<${level}>${escapeMarkup(text)}</${level}>`
      };
    });

/**
 * Adds historical pericopes to a canonical publication whose source carries no
 * headings, and recomputes its text identity. Sources with their own headings
 * are left untouched rather than mixing two editorial apparatuses.
 */
export function applyLegacyPericope(
  publication: CanonicalBiblePublication,
  pericope: unknown,
  pericopeRepairs?: readonly LegacyPericopeRepair[]
): CanonicalBiblePublication {
  if (publication.headingCount > 0) return publication;
  const verses = structuredClone(publication.verses);
  const repairs = pericopeRepairState(pericopeRepairs);
  let headingCount = 0;
  for (const [book, chapters] of Object.entries(verses)) {
    for (const [chapter, chapterVerses] of Object.entries(chapters)) {
      for (const [verse, value] of Object.entries(chapterVerses)) {
        const headings = legacyPericopeHeadings(
          pericope as LegacyPericope,
          book,
          chapter,
          verse,
          repairs
        );
        if (headings.length === 0) continue;
        value.headings = headings;
        headingCount += headings.length;
      }
    }
  }
  const liftedNoteCount = completePericopeRepairs(repairs, verses);
  if (headingCount === 0) return publication;
  const textSha256 = hashCanonicalBibleVerses(verses);
  return {
    ...publication,
    textRevision: buildCanonicalBibleTextRevision(
      publication.applicationVersionId,
      textSha256
    ),
    textSha256,
    noteCount: publication.noteCount + liftedNoteCount,
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
  pericopeRepairs?: readonly LegacyPericopeRepair[];
  redWords?: unknown;
}): CanonicalBiblePublication {
  const bible = options.bible as LegacyBible;
  const pericope = (options.pericope ?? {}) as LegacyPericope;
  const repairs = pericopeRepairState(options.pericopeRepairs);
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
        const headings = legacyPericopeHeadings(
          pericope,
          book,
          chapter,
          verse,
          repairs
        );
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

  const noteCount = completePericopeRepairs(repairs, verses);
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
    noteCount,
    headingCount,
    verses
  };
}
