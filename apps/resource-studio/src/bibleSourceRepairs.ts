import { readFile } from "node:fs/promises";
import path from "node:path";

import { legacyVerseNumber } from "./legacyBiblePublication.js";
import {
  compareVerseRefs,
  hashVerseText,
  normalizeSpans,
  parseVerseRef,
  type WordsOfJesusDataset,
  type WordsOfJesusVerse
} from "./wordsOfJesus.js";

export const BIBLE_SOURCE_REPAIRS_PATH =
  "config/ordinary-bible-source-repairs.json";

type LegacyBible = Record<string, Record<string, Record<string, string>>>;

interface RepairBase {
  /** Why the source is known to be wrong here. Never quotes Bible text. */
  evidence: string;
}

/**
 * One reviewed correction of a legacy Bible source, applied to its parsed
 * value before conversion. The source bytes stay untouched. Anchors are
 * truncated SHA-256 hashes of verse texts (`hashVerseText`): the repository
 * is public and stores no Bible text.
 */
export type BibleSourceRepair =
  /**
   * The verse holds the next verse too, behind a literal verse number. The
   * marker, read at UTF-16 offset `at`, is dropped; the text after it becomes
   * the next verse, whose row must be missing.
   */
  | (RepairBase & {
      op: "split";
      ref: string;
      at: number;
      marker: string;
      expect: string;
      result: [string, string];
    })
  /** The verse was cut in two rows: the next row is appended to it. */
  | (RepairBase & {
      op: "join";
      ref: string;
      separator: string;
      expect: [string, string];
      result: string;
    })
  /**
   * The verse prints a digit where the edition has a letter (`I1` for `Il`).
   * The digit, read at UTF-16 offset `at`, is replaced by the letter. Nothing
   * else may be rewritten this way: one digit, one letter, same position.
   */
  | (RepairBase & {
      op: "misprint";
      ref: string;
      at: number;
      printed: string;
      reads: string;
      expect: string;
      result: string;
    })
  /** The row is filed under a wrong reference; `to` must be missing. */
  | (RepairBase & { op: "move"; ref: string; to: string; expect: string })
  /**
   * Rows `first` to `last` of a chapter are numbered `by` too low or too
   * high. `expect` hashes their texts, in order, as a JSON array.
   */
  | (RepairBase & {
      op: "shift";
      chapter: string;
      first: number;
      last: number;
      by: number;
      expect: string;
    });

export interface BibleSourceRepairSet {
  /** SHA-256 of the source entry the repairs were reviewed against. */
  sourceSha256: string;
  repairs: BibleSourceRepair[];
}

export interface BibleSourceRepairs {
  schemaVersion: 1;
  bibles: Record<string, BibleSourceRepairSet>;
}

/** Part of a repaired verse, and where it sits in the unrepaired source. */
export interface RepairedVerseSegment {
  sourceRef: string;
  sourceStart: number;
  sourceEnd: number;
  targetStart: number;
}

export interface BibleSourceRepairChange {
  repair: BibleSourceRepair;
  before: Array<{ ref: string; text: string }>;
  after: Array<{ ref: string; text: string }>;
}

export interface AppliedBibleSourceRepairs {
  bible: unknown;
  changes: BibleSourceRepairChange[];
  /** Composition of every verse a repair wrote, by its final reference. */
  origins: Record<string, RepairedVerseSegment[]>;
  /** Unrepaired text of every source verse a repair read. */
  sourceTexts: Record<string, string>;
}

const CHAPTER_REF = /^([1-9]\d*)-([1-9]\d*)$/u;

export async function readBibleSourceRepairs(
  root: string
): Promise<BibleSourceRepairs> {
  const repairs = JSON.parse(
    await readFile(path.join(root, BIBLE_SOURCE_REPAIRS_PATH), "utf8")
  ) as BibleSourceRepairs;
  if (repairs.schemaVersion !== 1 || !repairs.bibles) {
    throw new Error("bible-source-repairs-invalid");
  }
  return repairs;
}

/** Anchor of a run of verses: the hash of their texts as a JSON array. */
export const hashVerseTexts = (texts: readonly string[]) =>
  hashVerseText(JSON.stringify(texts));

/**
 * Applies the reviewed repairs of one Bible to its legacy source value. Fails
 * when the source is not the one the repairs were reviewed against, when a
 * verse no longer matches its anchor, or when a repair would overwrite a row.
 * `anchored: false` skips the hash anchors, to draft a repair and read the
 * hashes it produces.
 */
export function applyBibleSourceRepairs(options: {
  versionId: string;
  sourceSha256: string;
  bible: unknown;
  repairs?: BibleSourceRepairSet;
  anchored?: boolean;
}): AppliedBibleSourceRepairs {
  const { versionId, repairs } = options;
  const anchored = options.anchored !== false;
  if (!repairs || repairs.repairs.length === 0) {
    return { bible: options.bible, changes: [], origins: {}, sourceTexts: {} };
  }
  if (anchored && repairs.sourceSha256 !== options.sourceSha256) {
    throw new Error(
      `bible-source-repairs-source-mismatch:${versionId}:${options.sourceSha256}`
    );
  }
  const bible = structuredClone(options.bible) as LegacyBible;
  const origins: Record<string, RepairedVerseSegment[]> = {};
  const sourceTexts: Record<string, string> = {};
  const changes: BibleSourceRepairChange[] = [];

  function fail(code: string, ref: string, detail = ""): never {
    throw new Error(
      `bible-source-repair-${code}:${versionId}:${ref}${detail ? `:${detail}` : ""}`
    );
  }
  const refOf = (book: string, chapter: string, verse: number | string) =>
    `${book}-${chapter}-${verse}`;
  const keyOf = (ref: string) => {
    const { book, chapter, verse } = parseVerseRef(ref);
    return Object.keys(bible[book]?.[chapter] ?? {}).find(
      (key) => legacyVerseNumber(book, chapter, key) === verse
    );
  };
  const read = (ref: string): string => {
    const { book, chapter } = parseVerseRef(ref);
    const key = keyOf(ref);
    const text = key === undefined ? undefined : bible[book]![chapter]![key];
    if (typeof text !== "string") fail("verse-missing", ref);
    return text;
  };
  const originOf = (ref: string, text: string): RepairedVerseSegment[] => {
    if (origins[ref]) return origins[ref];
    sourceTexts[ref] = text;
    return [
      { sourceRef: ref, sourceStart: 0, sourceEnd: text.length, targetStart: 0 }
    ];
  };
  const remove = (ref: string) => {
    const { book, chapter } = parseVerseRef(ref);
    delete bible[book]![chapter]![keyOf(ref)!];
    delete origins[ref];
  };
  const write = (
    ref: string,
    text: string,
    segments: RepairedVerseSegment[]
  ) => {
    const { book, chapter, verse } = parseVerseRef(ref);
    if (keyOf(ref) !== undefined) fail("target-occupied", ref);
    ((bible[book] ??= {})[chapter] ??= {})[verse] = text;
    origins[ref] = segments;
  };
  // A draft has no anchors yet: they are read only when they are checked.
  const expectHash = (ref: string, expected: () => string, actual: string) => {
    if (anchored && expected() !== actual)
      fail("anchor-mismatch", ref, `expected=${expected()}:actual=${actual}`);
  };
  /** Keeps the part of a verse between two offsets, re-based at zero. */
  const slice = (
    segments: readonly RepairedVerseSegment[],
    start: number,
    end: number
  ) =>
    segments.flatMap((segment) => {
      const length = segment.sourceEnd - segment.sourceStart;
      const from = Math.max(start, segment.targetStart);
      const to = Math.min(end, segment.targetStart + length);
      if (to <= from) return [];
      return [
        {
          sourceRef: segment.sourceRef,
          sourceStart: segment.sourceStart + (from - segment.targetStart),
          sourceEnd: segment.sourceStart + (to - segment.targetStart),
          targetStart: from - start
        }
      ];
    });

  for (const repair of repairs.repairs) {
    if (!repair.evidence) fail("evidence-missing", JSON.stringify(repair));
    if (repair.op === "split") {
      const { book, chapter, verse } = parseVerseRef(repair.ref);
      const nextRef = refOf(book, chapter, Number(verse) + 1);
      const text = read(repair.ref);
      expectHash(repair.ref, () => repair.expect, hashVerseText(text));
      const { at } = repair;
      if (
        repair.marker.length === 0 ||
        !Number.isSafeInteger(at) ||
        text.slice(at, at + repair.marker.length) !== repair.marker
      )
        fail("marker-missing", repair.ref);
      const kept = text.slice(0, at);
      const next = text.slice(at + repair.marker.length);
      if (kept.trim().length === 0 || next.trim().length === 0)
        fail("split-empty", repair.ref);
      const segments = originOf(repair.ref, text);
      remove(repair.ref);
      write(repair.ref, kept, slice(segments, 0, at));
      write(
        nextRef,
        next,
        slice(segments, at + repair.marker.length, text.length)
      );
      expectHash(repair.ref, () => repair.result[0], hashVerseText(kept));
      expectHash(nextRef, () => repair.result[1], hashVerseText(next));
      changes.push({
        repair,
        before: [{ ref: repair.ref, text }],
        after: [
          { ref: repair.ref, text: kept },
          { ref: nextRef, text: next }
        ]
      });
    } else if (repair.op === "join") {
      const { book, chapter, verse } = parseVerseRef(repair.ref);
      const nextRef = refOf(book, chapter, Number(verse) + 1);
      const text = read(repair.ref);
      const next = read(nextRef);
      expectHash(repair.ref, () => repair.expect[0], hashVerseText(text));
      expectHash(nextRef, () => repair.expect[1], hashVerseText(next));
      const offset = text.length + repair.separator.length;
      const segments = [
        ...originOf(repair.ref, text),
        ...originOf(nextRef, next).map((segment) => ({
          ...segment,
          targetStart: segment.targetStart + offset
        }))
      ];
      const joined = `${text}${repair.separator}${next}`;
      remove(repair.ref);
      remove(nextRef);
      write(repair.ref, joined, segments);
      expectHash(repair.ref, () => repair.result, hashVerseText(joined));
      changes.push({
        repair,
        before: [
          { ref: repair.ref, text },
          { ref: nextRef, text: next }
        ],
        after: [{ ref: repair.ref, text: joined }]
      });
    } else if (repair.op === "misprint") {
      const text = read(repair.ref);
      expectHash(repair.ref, () => repair.expect, hashVerseText(text));
      if (
        !/^\d$/u.test(repair.printed) ||
        !/^\p{L}$/u.test(repair.reads) ||
        repair.reads.length !== 1 ||
        !Number.isSafeInteger(repair.at) ||
        text.slice(repair.at, repair.at + 1) !== repair.printed
      )
        fail("misprint-invalid", repair.ref);
      const corrected = `${text.slice(0, repair.at)}${repair.reads}${text.slice(repair.at + 1)}`;
      // One character for another: every offset of the verse is unchanged.
      const segments = originOf(repair.ref, text);
      remove(repair.ref);
      write(repair.ref, corrected, segments);
      expectHash(repair.ref, () => repair.result, hashVerseText(corrected));
      changes.push({
        repair,
        before: [{ ref: repair.ref, text }],
        after: [{ ref: repair.ref, text: corrected }]
      });
    } else if (repair.op === "move") {
      parseVerseRef(repair.to);
      const text = read(repair.ref);
      expectHash(repair.ref, () => repair.expect, hashVerseText(text));
      const segments = originOf(repair.ref, text);
      remove(repair.ref);
      write(repair.to, text, segments);
      changes.push({
        repair,
        before: [{ ref: repair.ref, text }],
        after: [{ ref: repair.to, text }]
      });
    } else if (repair.op === "shift") {
      const chapterRef = CHAPTER_REF.exec(repair.chapter);
      if (
        !chapterRef ||
        !Number.isSafeInteger(repair.first) ||
        !Number.isSafeInteger(repair.last) ||
        !Number.isSafeInteger(repair.by) ||
        repair.first > repair.last ||
        repair.by === 0 ||
        repair.first + repair.by < 0
      )
        fail("shift-invalid", repair.chapter);
      const book = chapterRef[1]!;
      const chapter = chapterRef[2]!;
      const rows = [];
      for (let verse = repair.first; verse <= repair.last; verse += 1) {
        const ref = refOf(book, chapter, verse);
        const text = read(ref);
        rows.push({ ref, verse, text, segments: originOf(ref, text) });
      }
      expectHash(
        repair.chapter,
        () => repair.expect,
        hashVerseTexts(rows.map((row) => row.text))
      );
      for (const row of rows) remove(row.ref);
      const moved = rows.map((row) => ({
        ref: refOf(book, chapter, row.verse + repair.by),
        text: row.text,
        segments: row.segments
      }));
      for (const row of moved) write(row.ref, row.text, row.segments);
      changes.push({
        repair,
        before: rows.map(({ ref, text }) => ({ ref, text })),
        after: moved.map(({ ref, text }) => ({ ref, text }))
      });
    } else {
      fail("op-unknown", JSON.stringify(repair));
    }
  }
  return { bible, changes, origins, sourceTexts };
}

/**
 * Carries words-of-Jesus decisions through the repairs of their Bible: a
 * decision follows its text to the verse it now belongs to, and its spans are
 * cut where a verse was split. Decisions already anchored to the repaired
 * text, and decisions on untouched verses, are returned unchanged.
 */
export function carryWordsOfJesusThroughRepairs(
  dataset: WordsOfJesusDataset,
  applied: Pick<AppliedBibleSourceRepairs, "origins" | "sourceTexts">,
  repairedText: (ref: string) => string | undefined
): { dataset: WordsOfJesusDataset; carried: string[] } {
  const anchors = (decision: WordsOfJesusVerse) => {
    const text = repairedText(decision.ref);
    return text !== undefined && hashVerseText(text) === decision.verseSha256;
  };
  const touched = new Set([
    ...Object.keys(applied.origins),
    ...Object.keys(applied.sourceTexts)
  ]);
  // Already carried: every decision on a repaired verse anchors to its text.
  if (
    dataset.verses.every(
      (decision) => !touched.has(decision.ref) || anchors(decision)
    )
  )
    return { dataset, carried: [] };
  const pending = new Map<string, WordsOfJesusVerse>();
  const kept: WordsOfJesusVerse[] = [];
  for (const decision of dataset.verses) {
    const sourceText = applied.sourceTexts[decision.ref];
    if (
      sourceText !== undefined &&
      hashVerseText(sourceText) === decision.verseSha256
    ) {
      pending.set(decision.ref, decision);
    } else {
      kept.push(decision);
    }
  }
  const carried: WordsOfJesusVerse[] = [];
  for (const [ref, segments] of Object.entries(applied.origins)) {
    const sources = segments
      .map((segment) => pending.get(segment.sourceRef))
      .filter((decision) => decision !== undefined);
    const text = repairedText(ref);
    if (sources.length === 0 || text === undefined) continue;
    const spans: Array<[number, number]> = [];
    for (const segment of segments) {
      const decision = pending.get(segment.sourceRef);
      for (const [start, end] of decision?.spans ?? []) {
        const from = Math.max(start, segment.sourceStart);
        const to = Math.min(end, segment.sourceEnd);
        if (to <= from) continue;
        spans.push([
          segment.targetStart + (from - segment.sourceStart),
          segment.targetStart + (to - segment.sourceStart)
        ]);
      }
    }
    carried.push({
      ref,
      verseSha256: hashVerseText(text),
      spans: normalizeSpans(text, spans),
      origin: sources[0]!.origin
    });
  }
  const carriedRefs = new Set(carried.map((decision) => decision.ref));
  return {
    dataset: {
      ...dataset,
      verses: [
        ...kept.filter((decision) => !carriedRefs.has(decision.ref)),
        ...carried
      ].sort((left, right) => compareVerseRefs(left.ref, right.ref))
    },
    carried: carried.map((decision) => decision.ref).sort(compareVerseRefs)
  };
}
