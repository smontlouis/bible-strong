import { readFile } from "node:fs/promises";
import { BOOK_IDS } from "../../src/books.js";
import { selectStratifiedRefs } from "../../src/evaluateStrongGold.js";
import { readStrongCsv } from "../../src/strongCsv.js";
import {
  GENRE_GROUPS,
  chapterOfRef,
  fileSha256,
  genreOfBook,
  sha256,
  testamentOfBook,
  type Testament
} from "./shared.js";

export const PLAN_VERSION = "strong-concordance-rebuild-plan-v1";

export interface PlannedChapter {
  chapter: string;
  bookId: string;
  genre: string;
  testament: Testament;
  verses: number;
  /** True when no earlier evaluation selection of this session touched it. */
  fresh: boolean;
}

export interface ExperimentPlan {
  version: typeof PLAN_VERSION;
  createdAt: string;
  seed: string;
  policy: {
    countsPerGenre: Record<string, { development: number; test: number }>;
    minVerses: number;
    maxVerses: number;
    testRequiresFreshChapters: true;
    ranking: "sha256(seed|chapter) ascending, one book per genre before repeats";
  };
  chapterSource: { path: string; sha256: string };
  priorSelections: Array<{ path: string; sha256: string; chapters: number }>;
  canarySamples: Array<{ witness: string; limit: number; chapters: number }>;
  /** Chapters whose Concordance annotations were seen before the split (never test). */
  consultedBeforeSplit: string[];
  /** Consulted chapters deliberately placed in development. */
  forcedDevelopment: string[];
  development: PlannedChapter[];
  test: PlannedChapter[];
}

const DEFAULT_COUNTS: ExperimentPlan["policy"]["countsPerGenre"] = {
  law: { development: 3, test: 3 },
  history: { development: 4, test: 4 },
  "poetry-wisdom": { development: 4, test: 4 },
  "major-prophets": { development: 3, test: 3 },
  "minor-prophets": { development: 2, test: 2 },
  "gospels-acts": { development: 3, test: 3 },
  pauline: { development: 3, test: 3 },
  "general-revelation": { development: 2, test: 2 }
};

const CHAPTER_OR_REF = /^((?:[1-3])?[A-Z][a-z]+)\.(\d+)(?:\.(\d+))?$/u;

/** Collect every chapter named by an exact ref or chapter string in a JSON file. */
export function chaptersNamedIn(
  value: unknown,
  books = new Set<string>(BOOK_IDS)
): Set<string> {
  const chapters = new Set<string>();
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === "object")
      Object.values(node).forEach(walk);
    else if (typeof node === "string") {
      const match = CHAPTER_OR_REF.exec(node);
      if (match && books.has(match[1]!))
        chapters.add(`${match[1]}.${match[2]}`);
    }
  };
  walk(value);
  return chapters;
}

export interface ChapterInventoryEntry {
  chapter: string;
  bookId: string;
  verses: number;
}

/** Deterministic, genre-stratified split; test chapters must be fresh. */
export function selectChapters(options: {
  inventory: ChapterInventoryEntry[];
  prior: Set<string>;
  consulted: string[];
  forcedDevelopment?: string[];
  seed: string;
  counts?: ExperimentPlan["policy"]["countsPerGenre"];
  minVerses?: number;
  maxVerses?: number;
}): { development: PlannedChapter[]; test: PlannedChapter[] } {
  const counts = options.counts ?? DEFAULT_COUNTS;
  const minVerses = options.minVerses ?? 4;
  const maxVerses = options.maxVerses ?? 60;
  const consulted = new Set(options.consulted);
  const forced = new Set(options.forcedDevelopment ?? []);
  const development: PlannedChapter[] = [];
  const test: PlannedChapter[] = [];
  const toPlanned = (entry: ChapterInventoryEntry): PlannedChapter => ({
    chapter: entry.chapter,
    bookId: entry.bookId,
    genre: genreOfBook(entry.bookId),
    testament: testamentOfBook(entry.bookId),
    verses: entry.verses,
    fresh: !options.prior.has(entry.chapter) && !consulted.has(entry.chapter)
  });
  for (const group of GENRE_GROUPS) {
    const wanted = counts[group.id] ?? { development: 0, test: 0 };
    const ranked = options.inventory
      .filter(
        (entry) =>
          group.books.includes(entry.bookId) &&
          entry.verses >= minVerses &&
          entry.verses <= maxVerses
      )
      .map(toPlanned)
      .sort(
        (left, right) =>
          sha256(`${options.seed}|${left.chapter}`).localeCompare(
            sha256(`${options.seed}|${right.chapter}`)
          ) || left.chapter.localeCompare(right.chapter)
      );
    const taken = new Set<string>();
    const pick = (
      pool: PlannedChapter[],
      count: number,
      into: PlannedChapter[]
    ): void => {
      const books = new Set<string>();
      for (let pass = 0; pass < 2 && count > 0; pass += 1) {
        for (const entry of pool) {
          if (count === 0) break;
          if (taken.has(entry.chapter)) continue;
          if (pass === 0 && books.has(entry.bookId)) continue;
          taken.add(entry.chapter);
          books.add(entry.bookId);
          into.push(entry);
          count -= 1;
        }
      }
    };
    const groupTest: PlannedChapter[] = [];
    pick(
      ranked.filter((entry) => entry.fresh),
      wanted.test,
      groupTest
    );
    if (groupTest.length < wanted.test)
      throw new Error(`not-enough-fresh-test-chapters:${group.id}`);
    const groupDevelopment: PlannedChapter[] = options.inventory
      .filter(
        (entry) =>
          forced.has(entry.chapter) && group.books.includes(entry.bookId)
      )
      .map(toPlanned);
    groupDevelopment.forEach((entry) => taken.add(entry.chapter));
    pick(
      [
        ...ranked.filter((entry) => entry.fresh),
        ...ranked.filter((entry) => !entry.fresh)
      ],
      Math.max(0, wanted.development - groupDevelopment.length),
      groupDevelopment
    );
    test.push(...groupTest);
    development.push(...groupDevelopment);
  }
  const order = (left: PlannedChapter, right: PlannedChapter) =>
    BOOK_IDS.indexOf(left.bookId as never) -
      BOOK_IDS.indexOf(right.bookId as never) ||
    Number(left.chapter.split(".")[1]) - Number(right.chapter.split(".")[1]);
  return { development: development.sort(order), test: test.sort(order) };
}

export async function chapterInventoryFromBibleJson(
  file: string
): Promise<ChapterInventoryEntry[]> {
  const bible = JSON.parse(await readFile(file, "utf8")) as Record<
    string,
    Record<string, Record<string, string>>
  >;
  const inventory: ChapterInventoryEntry[] = [];
  for (const [bookNumber, chapters] of Object.entries(bible)) {
    const bookId = BOOK_IDS[Number(bookNumber) - 1];
    if (!bookId) continue;
    for (const [chapter, verses] of Object.entries(chapters))
      inventory.push({
        chapter: `${bookId}.${chapter}`,
        bookId,
        verses: Object.keys(verses).length
      });
  }
  return inventory;
}

export async function buildPlan(options: {
  chapterSource: string;
  priorFiles: string[];
  seed: string;
  consulted: string[];
  forcedDevelopment: string[];
}): Promise<ExperimentPlan> {
  const inventory = await chapterInventoryFromBibleJson(options.chapterSource);
  const prior = new Set<string>();
  const priorSelections: ExperimentPlan["priorSelections"] = [];
  for (const file of options.priorFiles) {
    const chapters = chaptersNamedIn(JSON.parse(await readFile(file, "utf8")));
    chapters.forEach((chapter) => prior.add(chapter));
    priorSelections.push({
      path: file,
      sha256: await fileSha256(file),
      chapters: chapters.size
    });
  }
  // The canary-v2 evaluations used the deterministic 200-verse sample of each
  // witness; recompute it rather than trusting a copied list.
  const canarySamples: ExperimentPlan["canarySamples"] = [];
  for (const witness of ["Sg1910", "Darby", "DarbyR"]) {
    const rows = await readStrongCsv(`data/strongs/${witness}.csv`);
    const refs = selectStratifiedRefs(
      rows.map((row) => `${row.bookId}.${row.chapter}.${row.verse}`),
      200
    );
    const chapters = new Set(refs.map(chapterOfRef));
    chapters.forEach((chapter) => prior.add(chapter));
    canarySamples.push({ witness, limit: 200, chapters: chapters.size });
  }
  const split = selectChapters({
    inventory,
    prior,
    consulted: options.consulted,
    forcedDevelopment: options.forcedDevelopment,
    seed: options.seed
  });
  return {
    version: PLAN_VERSION,
    createdAt: new Date().toISOString(),
    seed: options.seed,
    policy: {
      countsPerGenre: DEFAULT_COUNTS,
      minVerses: 4,
      maxVerses: 60,
      testRequiresFreshChapters: true,
      ranking:
        "sha256(seed|chapter) ascending, one book per genre before repeats"
    },
    chapterSource: {
      path: options.chapterSource,
      sha256: await fileSha256(options.chapterSource)
    },
    priorSelections,
    canarySamples,
    consultedBeforeSplit: [...options.consulted].sort(),
    forcedDevelopment: [...options.forcedDevelopment].sort(),
    ...split
  };
}
