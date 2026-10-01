import { createHash } from "node:crypto";

import {
  buildCanonicalBibleTextRevision,
  hashCanonicalBibleVerses,
  type CanonicalBibleLayoutEvent,
  type CanonicalBiblePublication,
  type CanonicalBibleVerse
} from "./strongBibleMobilePublication.js";

export const WORDS_OF_JESUS_FORMAT = "bible-strong-words-of-jesus";
export const WORDS_OF_JESUS_SCHEMA_VERSION = 1;
export const WORDS_OF_JESUS_TAG = "wj";

// Tags that already mark the words of Jesus in a publication: OSIS/USFM `wj`
// and the `red` emitted for rich SWORD sources.
const WORDS_OF_JESUS_MARKUP_TAGS = new Set(["wj", "red"]);

/**
 * Where a verse decision comes from. `legacy-red-words` was converted from the
 * historical word-index files; `aligned` was transferred from reference Bibles
 * and reviewed; `manual` was set by hand.
 */
export type WordsOfJesusOrigin = "legacy-red-words" | "aligned" | "manual";

const ORIGINS = new Set<WordsOfJesusOrigin>([
  "legacy-red-words",
  "aligned",
  "manual"
]);

/**
 * One verse decision. Spans are half-open UTF-16 ranges into the verse text,
 * anchored by a truncated SHA-256 of that text so a changed text fails
 * instead of shifting red letters silently. An empty `spans` array records a
 * reviewed verse without words of Jesus.
 */
export interface WordsOfJesusVerse {
  ref: string;
  verseSha256: string;
  spans: Array<[number, number]>;
  origin: WordsOfJesusOrigin;
}

export interface WordsOfJesusDataset {
  format: typeof WORDS_OF_JESUS_FORMAT;
  schemaVersion: number;
  versionId: string;
  verses: WordsOfJesusVerse[];
}

export type LegacyRedWords = Record<
  string,
  Array<{ start: number; end: number }>
>;

const VERSE_REF = /^([1-9]\d*)-([1-9]\d*)-(\d+)$/u;

export const hashVerseText = (text: string) =>
  createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);

export const parseVerseRef = (ref: string) => {
  const match = VERSE_REF.exec(ref);
  if (!match) throw new Error(`words-of-jesus-ref-invalid:${ref}`);
  return { book: match[1]!, chapter: match[2]!, verse: match[3]! };
};

export const compareVerseRefs = (left: string, right: string) => {
  const a = left.split("-").map(Number);
  const b = right.split("-").map(Number);
  return a[0]! - b[0]! || a[1]! - b[1]! || a[2]! - b[2]!;
};

const getVerse = (
  publication: Pick<CanonicalBiblePublication, "verses">,
  ref: string
): CanonicalBibleVerse | undefined => {
  const { book, chapter, verse } = parseVerseRef(ref);
  return publication.verses[book]?.[chapter]?.[verse];
};

/**
 * Trims whitespace out of spans, drops empty ones and merges overlapping or
 * touching spans, so equivalent decisions serialize identically.
 */
export const normalizeSpans = (
  text: string,
  spans: ReadonlyArray<readonly [number, number]>
): Array<[number, number]> => {
  const trimmed: Array<[number, number]> = [];
  for (const [rawStart, rawEnd] of spans) {
    let start = Math.max(0, rawStart);
    let end = Math.min(text.length, rawEnd);
    while (start < end && /\s/u.test(text[start]!)) start += 1;
    while (end > start && /\s/u.test(text[end - 1]!)) end -= 1;
    if (end > start) trimmed.push([start, end]);
  }
  trimmed.sort((left, right) => left[0] - right[0] || left[1] - right[1]);
  const merged: Array<[number, number]> = [];
  for (const span of trimmed) {
    const previous = merged.at(-1);
    if (previous && span[0] <= previous[1]) {
      previous[1] = Math.max(previous[1], span[1]);
    } else {
      merged.push([span[0], span[1]]);
    }
  }
  return merged;
};

/** Word boundaries used by the historical red-word files and the app. */
export const wordBoundaries = (text: string): Array<[number, number]> =>
  [...text.matchAll(/\S+/gu)].map((match) => [
    match.index,
    match.index + match[0].length
  ]);

/**
 * Converts inclusive word-index ranges into character spans. Ranges that start
 * past the last word are reported, because they prove the ranges were authored
 * against another text.
 */
export const wordRangesToSpans = (
  text: string,
  ranges: ReadonlyArray<{ start: number; end: number }>
): { spans: Array<[number, number]>; outOfRange: boolean } => {
  const words = wordBoundaries(text);
  let outOfRange = false;
  const spans: Array<[number, number]> = [];
  for (const range of ranges) {
    if (
      !Number.isSafeInteger(range.start) ||
      !Number.isSafeInteger(range.end) ||
      range.start < 0 ||
      range.end < range.start
    ) {
      outOfRange = true;
      continue;
    }
    if (range.start >= words.length || range.end >= words.length) {
      outOfRange = true;
    }
    if (range.start >= words.length) continue;
    const last = Math.min(range.end, words.length - 1);
    spans.push([words[range.start]![0], words[last]![1]]);
  }
  return { spans: normalizeSpans(text, spans), outOfRange };
};

/** Comparison key of a word: case, accents, apostrophes and punctuation ignored. */
const wordKey = (word: string) =>
  word
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");

const OPENING_MARKS = /^[«“‘„‹([—–-]+$/u;
// Closing quotes and sentence-final punctuation set apart by French spacing.
const CLOSING_MARKS = /^[»”’›)\]!?.…;]+$/u;

/**
 * Longest common subsequence of the word keys of two texts, as a map from
 * source word index to target word index. Punctuation-only words are ignored.
 */
const alignWordIndexes = (sourceKeys: string[], targetKeys: string[]) => {
  const rows = sourceKeys.length;
  const columns = targetKeys.length;
  const lengths = Array.from(
    { length: rows + 1 },
    () => new Uint16Array(columns + 1)
  );
  for (let row = rows - 1; row >= 0; row -= 1) {
    for (let column = columns - 1; column >= 0; column -= 1) {
      lengths[row]![column] =
        sourceKeys[row] && sourceKeys[row] === targetKeys[column]
          ? lengths[row + 1]![column + 1]! + 1
          : Math.max(lengths[row + 1]![column]!, lengths[row]![column + 1]!);
    }
  }
  const matches = new Map<number, number>();
  let row = 0;
  let column = 0;
  while (row < rows && column < columns) {
    if (sourceKeys[row] && sourceKeys[row] === targetKeys[column]) {
      matches.set(row, column);
      row += 1;
      column += 1;
    } else if (lengths[row + 1]![column]! >= lengths[row]![column + 1]!) {
      row += 1;
    } else {
      column += 1;
    }
  }
  return matches;
};

/**
 * Transfers spans between two wordings of the same verse by aligning their
 * words. A span transfers only when most of its words have a counterpart and
 * each boundary is anchored: its first and last words align, and so do their
 * outer neighbours (or both wordings start or end there). Otherwise the verse
 * needs review, since short words like "il" or "he" align ambiguously.
 */
export function transferSpans(
  sourceText: string,
  sourceSpans: ReadonlyArray<readonly [number, number]>,
  targetText: string,
  minimumMatchedShare = 0.6
): Array<[number, number]> | undefined {
  const sourceWords = wordBoundaries(sourceText);
  const targetWords = wordBoundaries(targetText);
  const sourceKeys = sourceWords.map(([start, end]) =>
    wordKey(sourceText.slice(start, end))
  );
  const targetKeys = targetWords.map(([start, end]) =>
    wordKey(targetText.slice(start, end))
  );
  const matches = alignWordIndexes(sourceKeys, targetKeys);
  const neighbour = (keys: string[], index: number, step: -1 | 1) => {
    let next = index + step;
    while (next >= 0 && next < keys.length && !keys[next]) next += step;
    return next >= 0 && next < keys.length ? next : undefined;
  };
  const anchored = (sourceIndex: number, targetIndex: number, step: -1 | 1) => {
    const sourceNeighbour = neighbour(sourceKeys, sourceIndex, step);
    const targetNeighbour = neighbour(targetKeys, targetIndex, step);
    if (sourceNeighbour === undefined || targetNeighbour === undefined) {
      return sourceNeighbour === targetNeighbour;
    }
    return matches.get(sourceNeighbour) === targetNeighbour;
  };
  const spans: Array<[number, number]> = [];
  for (const [spanStart, spanEnd] of sourceSpans) {
    const inside = sourceWords
      .map((word, index) => ({ word, index }))
      .filter(
        ({ word, index }) =>
          word[0] < spanEnd && word[1] > spanStart && sourceKeys[index]
      )
      .map(({ index }) => index);
    if (inside.length === 0) continue;
    const first = matches.get(inside[0]!);
    const last = matches.get(inside.at(-1)!);
    const matched = inside.filter((index) => matches.has(index)).length;
    if (
      first === undefined ||
      last === undefined ||
      matched / inside.length < minimumMatchedShare ||
      !anchored(inside[0]!, first, -1) ||
      !anchored(inside.at(-1)!, last, 1)
    ) {
      return undefined;
    }
    let targetFirst = first;
    let targetLast = last;
    while (
      targetFirst > 0 &&
      OPENING_MARKS.test(targetText.slice(...targetWords[targetFirst - 1]!))
    ) {
      targetFirst -= 1;
    }
    while (
      targetLast < targetWords.length - 1 &&
      CLOSING_MARKS.test(targetText.slice(...targetWords[targetLast + 1]!))
    ) {
      targetLast += 1;
    }
    spans.push([targetWords[targetFirst]![0], targetWords[targetLast]![1]]);
  }
  return normalizeSpans(targetText, spans);
}

/**
 * Word-level decisions cannot split a word, but some translations glue a
 * change of speaker to the neighbouring word ("paraboles.—Écoutez"). Starts
 * such a span at the dash or quote and ends it before a glued dash.
 */
export function refineGluedBoundaries(
  text: string,
  spans: ReadonlyArray<readonly [number, number]>
): Array<[number, number]> {
  return normalizeSpans(
    text,
    spans.map(([start, end]) => {
      let refinedStart = start;
      let refinedEnd = end;
      const firstWord = /^\S+/u.exec(text.slice(start, end))?.[0] ?? "";
      const opening = /^[^\s—«“]*[\p{L}\p{N}][.!?:;,…]*[—«“]/u.exec(firstWord);
      if (opening) refinedStart = start + opening[0].length - 1;
      const lastWord = /\S+$/u.exec(text.slice(refinedStart, end))?.[0] ?? "";
      const closing = /[\p{L}\p{N}][.!?:;,…»”]*(?=—[^\s—]*\p{L}[^\s—]*$)/u.exec(
        lastWord
      );
      if (closing) {
        refinedEnd = end - lastWord.length + closing.index + closing[0].length;
      }
      // A neighbouring word excluded because it glues narration and speech
      // ("dit:Heureux", "nom!Et") still contributes its speech half.
      const previousWord = /(\S+)\s$/u.exec(text.slice(0, refinedStart));
      const speechTail = previousWord
        ? /\p{L}[:.!?](\p{Lu}\S*)$/u.exec(previousWord[1]!)
        : null;
      if (speechTail) refinedStart -= speechTail[1]!.length + 1;
      const nextWord = /^\s(\S+)/u.exec(text.slice(refinedEnd));
      const speechHead = nextWord
        ? /^(\S*?\p{L}[.!?])\p{Lu}/u.exec(nextWord[1]!)
        : null;
      if (speechHead) refinedEnd += speechHead[1]!.length + 1;
      return [refinedStart, refinedEnd] as [number, number];
    })
  );
}

/**
 * Carries spans exactly through a wording that only gained spaces, as when
 * separators lost around notes are restored. `undefined` when the next text
 * changed anything else.
 */
export function carrySpansThroughInsertedSpaces(
  previous: string,
  next: string,
  spans: ReadonlyArray<readonly [number, number]>
): Array<[number, number]> | undefined {
  const positions: number[] = [];
  let index = 0;
  for (let offset = 0; offset < next.length; offset += 1) {
    if (index < previous.length && next[offset] === previous[index]) {
      positions.push(offset);
      index += 1;
    } else if (next[offset] !== " ") {
      return undefined;
    }
  }
  if (index !== previous.length) return undefined;
  return normalizeSpans(
    next,
    spans.map(([start, end]) => [positions[start]!, positions[end - 1]! + 1])
  );
}

export interface LegacyRedWordsImport {
  dataset: WordsOfJesusDataset;
  missingVerseRefs: string[];
  outOfRangeVerseRefs: string[];
  /** Verses whose spans could not be carried from the authored text. */
  untransferredVerseRefs: string[];
}

/**
 * Imports a historical red-word file. When the file was authored against an
 * earlier wording of the Bible (`authoredPublication`), its word indexes are
 * resolved against that wording and carried to the current text by word
 * alignment, so typographic changes do not shift the spans.
 */
export function importLegacyRedWords(options: {
  versionId: string;
  publication: Pick<CanonicalBiblePublication, "verses">;
  redWords: LegacyRedWords;
  authoredPublication?: Pick<CanonicalBiblePublication, "verses">;
}): LegacyRedWordsImport {
  const missingVerseRefs: string[] = [];
  const outOfRangeVerseRefs: string[] = [];
  const untransferredVerseRefs: string[] = [];
  const verses: WordsOfJesusVerse[] = [];
  for (const [ref, ranges] of Object.entries(options.redWords)) {
    if (!VERSE_REF.test(ref) || !Array.isArray(ranges)) {
      throw new Error(`words-of-jesus-legacy-entry-invalid:${ref}`);
    }
    const verse = getVerse(options.publication, ref);
    const authored = options.authoredPublication
      ? getVerse(options.authoredPublication, ref)
      : verse;
    if (!verse || !authored) {
      missingVerseRefs.push(ref);
      continue;
    }
    const resolved = wordRangesToSpans(authored.text, ranges);
    if (resolved.outOfRange) outOfRangeVerseRefs.push(ref);
    let spans = resolved.spans;
    if (authored !== verse && authored.text !== verse.text) {
      const transferred = transferSpans(authored.text, spans, verse.text, 0.9);
      if (!transferred) {
        untransferredVerseRefs.push(ref);
        continue;
      }
      spans = transferred;
    }
    if (spans.length === 0) continue;
    verses.push({
      ref,
      verseSha256: hashVerseText(verse.text),
      spans,
      origin: "legacy-red-words"
    });
  }
  verses.sort((left, right) => compareVerseRefs(left.ref, right.ref));
  return {
    dataset: {
      format: WORDS_OF_JESUS_FORMAT,
      schemaVersion: WORDS_OF_JESUS_SCHEMA_VERSION,
      versionId: options.versionId,
      verses
    },
    missingVerseRefs: missingVerseRefs.sort(compareVerseRefs),
    outOfRangeVerseRefs: outOfRangeVerseRefs.sort(compareVerseRefs),
    untransferredVerseRefs: untransferredVerseRefs.sort(compareVerseRefs)
  };
}

export function serializeWordsOfJesusDataset(
  dataset: WordsOfJesusDataset
): string {
  const lines = [
    JSON.stringify({
      format: dataset.format,
      schemaVersion: dataset.schemaVersion,
      versionId: dataset.versionId
    })
  ];
  for (const verse of [...dataset.verses].sort((left, right) =>
    compareVerseRefs(left.ref, right.ref)
  )) {
    lines.push(
      JSON.stringify({
        ref: verse.ref,
        verseSha256: verse.verseSha256,
        spans: verse.spans,
        origin: verse.origin
      })
    );
  }
  return `${lines.join("\n")}\n`;
}

export function parseWordsOfJesusDataset(source: string): WordsOfJesusDataset {
  const lines = source.split("\n").filter((line) => line.trim().length > 0);
  const header = JSON.parse(lines[0] ?? "null") as Partial<WordsOfJesusDataset>;
  if (
    header?.format !== WORDS_OF_JESUS_FORMAT ||
    header.schemaVersion !== WORDS_OF_JESUS_SCHEMA_VERSION ||
    typeof header.versionId !== "string" ||
    header.versionId.length === 0
  ) {
    throw new Error("words-of-jesus-header-invalid");
  }
  const seen = new Set<string>();
  const verses = lines.slice(1).map((line, index) => {
    const value = JSON.parse(line) as Partial<WordsOfJesusVerse>;
    const location = `${header.versionId}:${index + 2}`;
    if (
      typeof value.ref !== "string" ||
      !VERSE_REF.test(value.ref) ||
      typeof value.verseSha256 !== "string" ||
      !/^[0-9a-f]{16}$/u.test(value.verseSha256) ||
      !Array.isArray(value.spans) ||
      !ORIGINS.has(value.origin as WordsOfJesusOrigin)
    ) {
      throw new Error(`words-of-jesus-verse-invalid:${location}`);
    }
    if (seen.has(value.ref)) {
      throw new Error(
        `words-of-jesus-verse-duplicate:${header.versionId}:${value.ref}`
      );
    }
    seen.add(value.ref);
    let previousEnd = -1;
    for (const span of value.spans) {
      if (
        !Array.isArray(span) ||
        span.length !== 2 ||
        !Number.isSafeInteger(span[0]) ||
        !Number.isSafeInteger(span[1]) ||
        span[0] < 0 ||
        span[1] <= span[0] ||
        span[0] <= previousEnd
      ) {
        throw new Error(
          `words-of-jesus-span-invalid:${header.versionId}:${value.ref}`
        );
      }
      previousEnd = span[1];
    }
    return value as WordsOfJesusVerse;
  });
  return {
    format: WORDS_OF_JESUS_FORMAT,
    schemaVersion: WORDS_OF_JESUS_SCHEMA_VERSION,
    versionId: header.versionId,
    verses
  };
}

const hasWordsOfJesusMarkup = (verse: CanonicalBibleVerse) =>
  verse.startTags.some((tag) =>
    WORDS_OF_JESUS_MARKUP_TAGS.has(tag.tag.toLowerCase())
  ) ||
  verse.layout.some((event) =>
    WORDS_OF_JESUS_MARKUP_TAGS.has(event.tag.toLowerCase())
  );

// Container tags the reader closes as blocks; a `wj` span crossing one of
// their boundaries is split there so it stays properly nested.
const BLOCK_CONTAINER_TAGS = new Set(["p", "l", "lg", "item", "list"]);

const splitAtBlockBoundaries = (
  verse: CanonicalBibleVerse,
  spans: ReadonlyArray<readonly [number, number]>
): Array<[number, number]> => {
  const boundaries = [
    ...new Set(
      verse.layout
        .filter(
          (event) =>
            event.type !== "self" &&
            BLOCK_CONTAINER_TAGS.has(event.tag.toLowerCase())
        )
        .map((event) => event.offset)
    )
  ].sort((left, right) => left - right);
  return spans.flatMap(([start, end]) => {
    const cuts = boundaries.filter((offset) => offset > start && offset < end);
    const points = [start, ...cuts, end];
    return points
      .slice(1)
      .map((point, index) => [points[index]!, point] as [number, number])
      .filter(([from, to]) => /\S/u.test(verse.text.slice(from, to)));
  });
};

/**
 * Inserts `wj` spans into a verse. Existing layout events and notes keep their
 * relative order; at a shared offset a `wj` close comes first and a `wj` open
 * comes last, so the words of Jesus nest inside paragraphs and poetry lines.
 * Layout and notes share one order space and are renumbered together.
 */
export function insertWordsOfJesusSpans(
  verse: CanonicalBibleVerse,
  rawSpans: ReadonlyArray<readonly [number, number]>
): CanonicalBibleVerse {
  const spans = splitAtBlockBoundaries(verse, rawSpans);
  type Ordered =
    | { kind: "layout"; event: CanonicalBibleLayoutEvent }
    | { kind: "note"; note: CanonicalBibleVerse["notes"][number] }
    | { kind: "wj"; type: "open" | "close"; offset: number };
  const existing: Ordered[] = [
    ...verse.layout.map((event) => ({ kind: "layout" as const, event })),
    ...verse.notes.map((note) => ({ kind: "note" as const, note }))
  ].sort((left, right) => {
    const a = left.kind === "layout" ? left.event : left.note;
    const b = right.kind === "layout" ? right.event : right.note;
    return a.offset - b.offset || a.order - b.order;
  });
  const offsetOf = (item: Ordered) =>
    item.kind === "layout"
      ? item.event.offset
      : item.kind === "note"
        ? item.note.offset
        : item.offset;
  const rank = (item: Ordered) =>
    item.kind === "wj" ? (item.type === "close" ? 0 : 2) : 1;
  const sequence: Ordered[] = [
    ...existing,
    ...spans.flatMap(([start, end]) => [
      { kind: "wj" as const, type: "open" as const, offset: start },
      { kind: "wj" as const, type: "close" as const, offset: end }
    ])
  ];
  const position = new Map(existing.map((item, index) => [item, index]));
  sequence.sort(
    (left, right) =>
      offsetOf(left) - offsetOf(right) ||
      rank(left) - rank(right) ||
      (position.get(left) ?? 0) - (position.get(right) ?? 0)
  );
  const layout: CanonicalBibleLayoutEvent[] = [];
  const notes: CanonicalBibleVerse["notes"] = [];
  sequence.forEach((item, order) => {
    if (item.kind === "layout") layout.push({ ...item.event, order });
    else if (item.kind === "note") notes.push({ ...item.note, order });
    else {
      layout.push({
        offset: item.offset,
        order,
        type: item.type,
        tag: WORDS_OF_JESUS_TAG
      });
    }
  });
  return { ...verse, layout, notes };
}

export interface WordsOfJesusApplication {
  publication: CanonicalBiblePublication;
  verseCount: number;
  spanCount: number;
}

/**
 * Applies a reviewed words-of-Jesus dataset to a canonical publication and
 * recomputes its text identity. Fails closed when a verse is missing, its text
 * changed since the decision was recorded, or it already carries red-letter
 * markup from its source.
 */
export function applyWordsOfJesus(
  publication: CanonicalBiblePublication,
  dataset: WordsOfJesusDataset
): WordsOfJesusApplication {
  if (dataset.versionId !== publication.applicationVersionId) {
    throw new Error(
      `words-of-jesus-version-mismatch:${dataset.versionId}:${publication.applicationVersionId}`
    );
  }
  const verses = structuredClone(publication.verses);
  let verseCount = 0;
  let spanCount = 0;
  for (const decision of dataset.verses) {
    if (decision.spans.length === 0) continue;
    const { book, chapter, verse: verseNumber } = parseVerseRef(decision.ref);
    const verse = verses[book]?.[chapter]?.[verseNumber];
    if (!verse) {
      throw new Error(
        `words-of-jesus-verse-missing:${dataset.versionId}:${decision.ref}`
      );
    }
    if (hashVerseText(verse.text) !== decision.verseSha256) {
      throw new Error(
        `words-of-jesus-text-drift:${dataset.versionId}:${decision.ref}`
      );
    }
    if (hasWordsOfJesusMarkup(verse)) {
      throw new Error(
        `words-of-jesus-source-markup-conflict:${dataset.versionId}:${decision.ref}`
      );
    }
    if (decision.spans.some(([, end]) => end > verse.text.length)) {
      throw new Error(
        `words-of-jesus-span-out-of-bounds:${dataset.versionId}:${decision.ref}`
      );
    }
    verses[book]![chapter]![verseNumber] = insertWordsOfJesusSpans(
      verse,
      decision.spans
    );
    verseCount += 1;
    spanCount += decision.spans.length;
  }
  const textSha256 = hashCanonicalBibleVerses(verses);
  return {
    publication: {
      ...publication,
      textSha256,
      textRevision: buildCanonicalBibleTextRevision(
        publication.applicationVersionId,
        textSha256
      ),
      verses
    },
    verseCount,
    spanCount
  };
}

/**
 * Reads the words of Jesus already marked in a publication (`wj` or `red`),
 * including spans inherited from the previous verse through `startTags`.
 */
export function extractWordsOfJesusSpans(
  verse: CanonicalBibleVerse
): Array<[number, number]> {
  let depth = verse.startTags.filter((tag) =>
    WORDS_OF_JESUS_MARKUP_TAGS.has(tag.tag.toLowerCase())
  ).length;
  let openedAt = depth > 0 ? 0 : -1;
  const spans: Array<[number, number]> = [];
  const events = [...verse.layout]
    .filter((event) => WORDS_OF_JESUS_MARKUP_TAGS.has(event.tag.toLowerCase()))
    .sort(
      (left, right) => left.offset - right.offset || left.order - right.order
    );
  for (const event of events) {
    if (event.type === "open") {
      if (depth === 0) openedAt = event.offset;
      depth += 1;
    } else if (event.type === "close" && depth > 0) {
      depth -= 1;
      if (depth === 0) spans.push([openedAt, event.offset]);
    }
  }
  if (depth > 0) spans.push([openedAt, verse.text.length]);
  return normalizeSpans(verse.text, spans);
}

/** Share of the verse's letters and digits covered by the spans. */
export function spanCoverage(
  text: string,
  spans: ReadonlyArray<readonly [number, number]>
): number {
  const isWordCharacter = (character: string) =>
    /[\p{L}\p{N}]/u.test(character);
  let total = 0;
  let covered = 0;
  const marked = new Uint8Array(text.length);
  for (const [start, end] of spans) marked.fill(1, start, end);
  for (let index = 0; index < text.length; index += 1) {
    if (!isWordCharacter(text[index]!)) continue;
    total += 1;
    if (marked[index]) covered += 1;
  }
  return total === 0 ? 0 : covered / total;
}
