import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  parseStrongOccurrences,
  readStrongCsv,
  referenceKey
} from "./strongCsv.js";

interface SampleChapter {
  bookId: string;
  concordanceBook: string;
  chapter: number;
}

interface VerseComparison {
  ref: string;
  localTags: number;
  concordanceTags: number;
  localEmpty: number;
  concordanceEmpty: number;
  exactStrongMultiset: boolean;
  missingInLocal: string[];
  extraInLocal: string[];
}

interface ChapterComparison {
  ref: string;
  localTags: number;
  concordanceTags: number;
  localEmpty: number;
  concordanceEmpty: number;
  exactStrongMultisetVerses: number;
  verseCount: number;
  verses: VerseComparison[];
}

interface ComparisonReport {
  generatedAt: string;
  localPath: string;
  source: string;
  chapters: ChapterComparison[];
  totals: Omit<ChapterComparison, "ref" | "verses">;
}

const DEFAULT_SAMPLE: SampleChapter[] = [
  { bookId: "Gen", concordanceBook: "Gen", chapter: 1 },
  { bookId: "Gen", concordanceBook: "Gen", chapter: 2 },
  { bookId: "Ps", concordanceBook: "Ps", chapter: 23 },
  { bookId: "Isa", concordanceBook: "Isa", chapter: 53 },
  { bookId: "Matt", concordanceBook: "Matt", chapter: 1 },
  { bookId: "John", concordanceBook: "John", chapter: 1 },
  { bookId: "Rom", concordanceBook: "Rom", chapter: 8 }
];

const SOURCE_BASE_URL = "https://concordance.bible/SG21";

async function compareS21Concordance(): Promise<ComparisonReport> {
  const localPath = "outputs/bible-s21-strong-reader.tsv";
  const outputPath = "outputs/s21-concordance-comparison.metrics.json";
  const localRows = await readStrongCsv(localPath);
  const localByRef = new Map(
    localRows.map((row) => [
      referenceKey(row.bookId, row.chapter, row.verse),
      summarizeLocalVerse(row.text)
    ])
  );

  const chapters: ChapterComparison[] = [];
  for (const sample of DEFAULT_SAMPLE) {
    const html = await fetchChapter(sample);
    chapters.push(compareChapter(sample, html, localByRef));
  }

  const totals = chapters.reduce(
    (sum, chapter) => ({
      localTags: sum.localTags + chapter.localTags,
      concordanceTags: sum.concordanceTags + chapter.concordanceTags,
      localEmpty: sum.localEmpty + chapter.localEmpty,
      concordanceEmpty: sum.concordanceEmpty + chapter.concordanceEmpty,
      exactStrongMultisetVerses:
        sum.exactStrongMultisetVerses + chapter.exactStrongMultisetVerses,
      verseCount: sum.verseCount + chapter.verseCount
    }),
    {
      localTags: 0,
      concordanceTags: 0,
      localEmpty: 0,
      concordanceEmpty: 0,
      exactStrongMultisetVerses: 0,
      verseCount: 0
    }
  );

  const report: ComparisonReport = {
    generatedAt: new Date().toISOString(),
    localPath,
    source: SOURCE_BASE_URL,
    chapters,
    totals
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
}

async function fetchChapter(sample: SampleChapter): Promise<string> {
  const url = `${SOURCE_BASE_URL}/${sample.concordanceBook}/${sample.chapter}/`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  }

  return response.text();
}

function compareChapter(
  sample: SampleChapter,
  html: string,
  localByRef: Map<string, VerseSummary>
): ChapterComparison {
  const remote = parseConcordanceChapter(html);
  const verses: VerseComparison[] = [];

  for (const [verse, concordance] of remote) {
    const ref = referenceKey(sample.bookId, sample.chapter, verse);
    const local = localByRef.get(ref) ?? emptyVerseSummary();
    const localStrong = sortStrong(local.strong);
    const concordanceStrong = sortStrong(concordance.strong);

    verses.push({
      ref,
      localTags: local.strong.length,
      concordanceTags: concordance.strong.length,
      localEmpty: local.empty,
      concordanceEmpty: concordance.empty,
      exactStrongMultiset: arrayEquals(localStrong, concordanceStrong),
      missingInLocal: multisetDifference(concordanceStrong, localStrong),
      extraInLocal: multisetDifference(localStrong, concordanceStrong)
    });
  }

  return {
    ref: `${sample.bookId}.${sample.chapter}`,
    localTags: sum(verses, "localTags"),
    concordanceTags: sum(verses, "concordanceTags"),
    localEmpty: sum(verses, "localEmpty"),
    concordanceEmpty: sum(verses, "concordanceEmpty"),
    exactStrongMultisetVerses: verses.filter(
      (verse) => verse.exactStrongMultiset
    ).length,
    verseCount: verses.length,
    verses
  };
}

interface VerseSummary {
  strong: string[];
  empty: number;
}

function summarizeLocalVerse(text: string): VerseSummary {
  return {
    strong: parseStrongOccurrences(text),
    empty: countLocalEmptyOccurrences(text)
  };
}

function emptyVerseSummary(): VerseSummary {
  return { strong: [], empty: 0 };
}

function parseConcordanceChapter(html: string): Map<number, VerseSummary> {
  const verses = new Map<number, VerseSummary>();
  const chunks = html
    .split(/<span class="verse"><sup class="numverse" id="v/gu)
    .slice(1);

  for (const chunk of chunks) {
    const match = chunk.match(/^(\d+)"/u);
    if (!match?.[1]) continue;

    const verse = Number.parseInt(match[1], 10);
    verses.set(verse, {
      strong: parseConcordanceStrongCodes(chunk),
      empty: countConcordanceEmptyOccurrences(chunk)
    });
  }

  return verses;
}

function parseConcordanceStrongCodes(html: string): string[] {
  const codes: string[] = [];
  const dataPaPattern = /\bdata-pa="([^"]*)"/giu;

  for (const match of html.matchAll(dataPaPattern)) {
    codes.push(...parseStrongCodes(match[1] ?? ""));
  }

  return codes;
}

function countConcordanceEmptyOccurrences(html: string): number {
  let count = 0;
  const emptyPattern =
    /<span\b[^>]*class="[^"]*\bstrong-untranslated\b[^"]*"[^>]*>([\s\S]*?)<\/span>/giu;

  for (const match of html.matchAll(emptyPattern)) {
    count += parseStrongCodes(match[1] ?? "").length;
  }

  return count;
}

function countLocalEmptyOccurrences(text: string): number {
  let count = 0;
  const emptyPattern = /<w\b([^>]*)\bdata-empty="true"[^>]*>/giu;

  for (const match of text.matchAll(emptyPattern)) {
    count += parseStrongCodes(match[1] ?? "").length;
  }

  return count;
}

function parseStrongCodes(input: string): string[] {
  return [...input.matchAll(/[HG]\d{4}|[hg]\d{4}/gu)]
    .map((match) => match[0]?.toUpperCase() ?? "")
    .filter((code) => code.length > 0 && code !== "H0000" && code !== "G0000");
}

function sortStrong(values: string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function arrayEquals(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function multisetDifference(left: string[], right: string[]): string[] {
  const remaining = [...right];
  const difference: string[] = [];

  for (const value of left) {
    const index = remaining.indexOf(value);
    if (index === -1) {
      difference.push(value);
    } else {
      remaining.splice(index, 1);
    }
  }

  return difference;
}

function sum<T extends keyof VerseComparison>(
  verses: VerseComparison[],
  key: T
): number {
  return verses.reduce((total, verse) => {
    const value = verse[key];
    return total + (typeof value === "number" ? value : 0);
  }, 0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await compareS21Concordance();

  console.log("Compared local S21 reader output with concordance.bible SG21");
  console.log(
    `Sample tags: local ${report.totals.localTags}, concordance.bible ${report.totals.concordanceTags}`
  );
  console.log(
    `Sample empty: local ${report.totals.localEmpty}, concordance.bible ${report.totals.concordanceEmpty}`
  );
  console.log(
    `Exact verse multisets: ${report.totals.exactStrongMultisetVerses}/${report.totals.verseCount}`
  );
  console.log("Metrics: outputs/s21-concordance-comparison.metrics.json");
}
