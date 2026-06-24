import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { type ReferenceSource } from "./align.js";
import { BOOK_IDS } from "./books.js";
import { getOriginalStrongOccurrences } from "./completeAlignment.js";
import { buildStrongLexicon } from "./lexicon.js";
import {
  readOriginalSourceTsv,
  type OriginalSourceSummary,
  summarizeOriginalSource,
  type OriginalVerse,
  type OriginalVerseMap
} from "./originalSource.js";
import { buildStrongPhraseLexicon } from "./phraseTranslationLexicon.js";
import { alignReaderVerse } from "./readerAlignment.js";
import {
  buildStrongVerseMap,
  parseStrongOccurrences,
  readStrongCsv,
  type StrongRow,
  type StrongVerseMap
} from "./strongCsv.js";
import { readStrongDictionaryTranslationCandidates } from "./strongDictionaryLexicon.js";
import { stripTags } from "./tokenize.js";
import { buildStrongTranslationLexicon } from "./translationLexicon.js";

interface EvaluationOptions {
  gold: string;
  onlyRef?: string;
  limit?: number;
  outputDir: string;
  includeGoldReference: boolean;
}

interface ReferenceMap {
  name: string;
  path: string;
  rows: StrongRow[];
  map: StrongVerseMap;
}

interface OriginalBundle {
  name: string;
  path: string;
  map: OriginalVerseMap;
  summary: OriginalSourceSummary;
}

interface OriginalBundleVerse {
  verse: OriginalVerse;
  sourceNames: string[];
}

interface VerseEvaluation {
  ref: string;
  bookId: string;
  testament: "OT" | "NT";
  expectedStrongCount: number;
  predictedStrongCount: number;
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  precision: number;
  recall: number;
  f1: number;
  category: ErrorCategory;
}

interface EvaluationReport {
  generatedAt: string;
  gold: string;
  includeGoldReference: boolean;
  verseCount: number;
  predictedStrongCount: number;
  expectedStrongCount: number;
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  precision: number;
  recall: number;
  f1: number;
  outputPath: string;
  references: Array<{ name: string; path: string; verses: number }>;
  originalSources: OriginalSourceSummary[];
  byBook: AggregateEvaluation[];
  byTestament: AggregateEvaluation[];
  worstBooks: AggregateEvaluation[];
  worstVerses: VerseEvaluation[];
  errorCategories: Array<{ category: ErrorCategory; verseCount: number }>;
}

interface AggregateEvaluation {
  scope: string;
  verseCount: number;
  predictedStrongCount: number;
  expectedStrongCount: number;
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  precision: number;
  recall: number;
  f1: number;
}

type ErrorCategory =
  | "exact-or-near-exact"
  | "under-tagging"
  | "over-tagging"
  | "mixed-density-mismatch"
  | "low-signal";

const REFERENCES = [
  { name: "Sg1910", path: "data/strongs/Sg1910.csv" },
  { name: "Darby", path: "data/strongs/Darby.csv" },
  { name: "DarbyR", path: "data/strongs/DarbyR.csv" }
];

const ORIGINAL_SOURCES = [
  {
    name: "WLC",
    path: "data/external/Alignments/data/sources/WLC.tsv",
    license: "CC BY 4.0 via Clear-Bible/Alignments",
    url: "https://github.com/Clear-Bible/Alignments"
  },
  {
    name: "SBLGNT",
    path: "data/external/Alignments/data/sources/SBLGNT.tsv",
    license: "CC BY 4.0 via Clear-Bible/Alignments",
    url: "https://github.com/Clear-Bible/Alignments"
  }
];

export async function evaluateStrongGold(
  options: EvaluationOptions
): Promise<EvaluationReport> {
  const goldRows = await readStrongCsv(`data/strongs/${options.gold}.csv`);
  const goldMap = buildStrongVerseMap(goldRows);
  const references = (await loadReferences()).filter(
    (reference) =>
      options.includeGoldReference || reference.name !== options.gold
  );
  const originals = await loadOriginalSources();
  const originalByRef = mergeOriginalSources(originals);
  const lexicon = buildStrongLexicon(references);
  const dictionaryCandidates = readStrongDictionaryTranslationCandidates();
  const translationLexicon = buildStrongTranslationLexicon(references, {
    dictionaryCandidates
  });
  const phraseLexicon = buildStrongPhraseLexicon(references);
  const verseEvaluations: VerseEvaluation[] = [];
  const refs = [...goldMap.keys()].filter((ref) =>
    options.onlyRef ? refMatches(ref, options.onlyRef) : true
  );

  for (const ref of refs.slice(0, options.limit ?? refs.length)) {
    const gold = goldMap.get(ref);
    if (!gold) continue;

    const [bookId, chapter, verse] = ref.split(".");
    if (!bookId || !chapter || !verse) continue;
    const original = originalByRef.get(ref);
    const verseReferences: ReferenceSource[] = references.map((reference) => ({
      name: reference.name,
      verse: reference.map.get(ref)
    }));
    const result = alignReaderVerse({
      targetText: stripTags(gold.row.text),
      references: verseReferences,
      lexicon,
      originalVerse: original?.verse,
      translationLexicon,
      phraseLexicon,
      original: original
        ? {
            strongSet: original.verse.strongSet,
            source: original.sourceNames.join("+")
          }
        : undefined
    });

    const predicted = [
      ...[...result.assignments.values()].flatMap(
        (assignment) => assignment.strong
      ),
      ...result.emptyAssignments.map((assignment) => assignment.strong)
    ];
    const expected = parseStrongOccurrences(gold.row.text);
    verseEvaluations.push(scoreVerse(ref, predicted, expected));
  }

  const truePositive = sum(verseEvaluations, "truePositive");
  const falsePositive = sum(verseEvaluations, "falsePositive");
  const falseNegative = sum(verseEvaluations, "falseNegative");
  const predictedStrongCount = sum(verseEvaluations, "predictedStrongCount");
  const expectedStrongCount = sum(verseEvaluations, "expectedStrongCount");
  const precision = truePositive / Math.max(1, truePositive + falsePositive);
  const recall = truePositive / Math.max(1, truePositive + falseNegative);
  const f1 =
    precision + recall === 0
      ? 0
      : (2 * precision * recall) / (precision + recall);
  const outputPath = path.join(
    options.outputDir,
    `strong-gold-eval-${options.gold}.json`
  );
  const report: EvaluationReport = {
    generatedAt: new Date().toISOString(),
    gold: options.gold,
    includeGoldReference: options.includeGoldReference,
    verseCount: verseEvaluations.length,
    predictedStrongCount,
    expectedStrongCount,
    truePositive,
    falsePositive,
    falseNegative,
    precision: roundRatio(precision),
    recall: roundRatio(recall),
    f1: roundRatio(f1),
    outputPath,
    references: references.map((reference) => ({
      name: reference.name,
      path: reference.path,
      verses: reference.map.size
    })),
    originalSources: originals.map((original) => original.summary),
    byBook: aggregateBy(verseEvaluations, (verse) => verse.bookId),
    byTestament: aggregateBy(verseEvaluations, (verse) => verse.testament),
    worstBooks: aggregateBy(verseEvaluations, (verse) => verse.bookId)
      .filter((book) => book.verseCount >= 5)
      .sort((left, right) => left.f1 - right.f1)
      .slice(0, 12),
    worstVerses: [...verseEvaluations]
      .sort((left, right) => left.f1 - right.f1)
      .slice(0, 75),
    errorCategories: summarizeCategories(verseEvaluations)
  };

  await mkdir(options.outputDir, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  return report;
}

function scoreVerse(
  ref: string,
  predicted: string[],
  expected: string[]
): VerseEvaluation {
  const truePositive = multisetIntersectionCount(predicted, expected);
  const falsePositive = Math.max(0, predicted.length - truePositive);
  const falseNegative = Math.max(0, expected.length - truePositive);
  const noSignal = predicted.length === 0 && expected.length === 0;
  const precision = noSignal
    ? 1
    : truePositive / Math.max(1, truePositive + falsePositive);
  const recall = noSignal
    ? 1
    : truePositive / Math.max(1, truePositive + falseNegative);
  const f1 =
    precision + recall === 0
      ? 0
      : (2 * precision * recall) / (precision + recall);

  return {
    ref,
    bookId: ref.split(".")[0] ?? "unknown",
    testament: getTestament(ref),
    expectedStrongCount: expected.length,
    predictedStrongCount: predicted.length,
    truePositive,
    falsePositive,
    falseNegative,
    precision: roundRatio(precision),
    recall: roundRatio(recall),
    f1: roundRatio(f1),
    category: categorizeVerse({
      expectedStrongCount: expected.length,
      predictedStrongCount: predicted.length,
      falsePositive,
      falseNegative,
      precision,
      recall,
      f1
    })
  };
}

function aggregateBy(
  verses: VerseEvaluation[],
  getScope: (verse: VerseEvaluation) => string
): AggregateEvaluation[] {
  const groups = new Map<string, VerseEvaluation[]>();

  for (const verse of verses) {
    const group = groups.get(getScope(verse)) ?? [];
    group.push(verse);
    groups.set(getScope(verse), group);
  }

  return [...groups]
    .map(([scope, group]) => aggregate(scope, group))
    .sort((left, right) => {
      const leftIndex = BOOK_IDS.indexOf(
        left.scope as (typeof BOOK_IDS)[number]
      );
      const rightIndex = BOOK_IDS.indexOf(
        right.scope as (typeof BOOK_IDS)[number]
      );
      if (leftIndex !== -1 && rightIndex !== -1) return leftIndex - rightIndex;
      return left.scope.localeCompare(right.scope);
    });
}

function aggregate(
  scope: string,
  verses: VerseEvaluation[]
): AggregateEvaluation {
  const truePositive = sum(verses, "truePositive");
  const falsePositive = sum(verses, "falsePositive");
  const falseNegative = sum(verses, "falseNegative");
  const predictedStrongCount = sum(verses, "predictedStrongCount");
  const expectedStrongCount = sum(verses, "expectedStrongCount");
  const precision = truePositive / Math.max(1, truePositive + falsePositive);
  const recall = truePositive / Math.max(1, truePositive + falseNegative);
  const f1 =
    precision + recall === 0
      ? 0
      : (2 * precision * recall) / (precision + recall);

  return {
    scope,
    verseCount: verses.length,
    predictedStrongCount,
    expectedStrongCount,
    truePositive,
    falsePositive,
    falseNegative,
    precision: roundRatio(precision),
    recall: roundRatio(recall),
    f1: roundRatio(f1)
  };
}

function summarizeCategories(
  verses: VerseEvaluation[]
): Array<{ category: ErrorCategory; verseCount: number }> {
  const counts = new Map<ErrorCategory, number>();

  for (const verse of verses) {
    counts.set(verse.category, (counts.get(verse.category) ?? 0) + 1);
  }

  return [...counts]
    .map(([category, verseCount]) => ({ category, verseCount }))
    .sort((left, right) => right.verseCount - left.verseCount);
}

function categorizeVerse(options: {
  expectedStrongCount: number;
  predictedStrongCount: number;
  falsePositive: number;
  falseNegative: number;
  precision: number;
  recall: number;
  f1: number;
}): ErrorCategory {
  if (options.f1 >= 0.985) return "exact-or-near-exact";
  if (
    options.predictedStrongCount <= 2 &&
    options.expectedStrongCount >= 6 &&
    options.recall < 0.6
  ) {
    return "low-signal";
  }
  if (
    options.falseNegative >= options.falsePositive * 2 &&
    options.recall < 0.9
  ) {
    return "under-tagging";
  }
  if (
    options.falsePositive >= options.falseNegative * 2 &&
    options.precision < 0.9
  ) {
    return "over-tagging";
  }

  return "mixed-density-mismatch";
}

function multisetIntersectionCount(left: string[], right: string[]): number {
  const remaining = [...right];
  let count = 0;

  for (const value of left) {
    const index = remaining.indexOf(value);
    if (index === -1) continue;
    remaining.splice(index, 1);
    count += 1;
  }

  return count;
}

async function loadReferences(): Promise<ReferenceMap[]> {
  return Promise.all(
    REFERENCES.map(async (reference) => {
      const rows = await readStrongCsv(reference.path);
      return { ...reference, rows, map: buildStrongVerseMap(rows) };
    })
  );
}

async function loadOriginalSources(): Promise<OriginalBundle[]> {
  return Promise.all(
    ORIGINAL_SOURCES.map(async (source) => {
      const map = await readOriginalSourceTsv(source.path);
      return {
        name: source.name,
        path: source.path,
        map,
        summary: summarizeOriginalSource(source.name, source.path, map, {
          license: source.license,
          url: source.url
        })
      };
    })
  );
}

function mergeOriginalSources(
  originals: OriginalBundle[]
): Map<string, OriginalBundleVerse> {
  const merged = new Map<string, OriginalBundleVerse>();

  for (const original of originals) {
    for (const [key, verse] of original.map) {
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, { verse, sourceNames: [original.name] });
        continue;
      }

      for (const token of verse.tokens) {
        existing.verse.tokens.push(token);
        for (const strong of token.strong) existing.verse.strongSet.add(strong);
      }
      existing.sourceNames.push(original.name);
    }
  }

  for (const value of merged.values()) {
    value.verse.tokens = getOriginalStrongOccurrences(value.verse).map(
      (occurrence) => ({
        id: occurrence.occurrenceId,
        text: occurrence.text,
        strong: [occurrence.strong],
        sourceStrong: [occurrence.sourceStrong],
        gloss: occurrence.gloss,
        lemma: occurrence.lemma,
        pos: occurrence.pos,
        morph: occurrence.morph
      })
    );
  }

  return merged;
}

function refMatches(ref: string, pattern: string): boolean {
  const [book, chapter, verse] = pattern.split(".");
  const [refBook, refChapter, refVerse] = ref.split(".");
  return (
    refBook === book &&
    (!chapter || refChapter === chapter) &&
    (!verse || refVerse === verse)
  );
}

function getTestament(ref: string): "OT" | "NT" {
  const bookId = ref.split(".")[0];
  const bookIndex = BOOK_IDS.indexOf(bookId as (typeof BOOK_IDS)[number]);
  return bookIndex >= 39 ? "NT" : "OT";
}

function sum<T extends keyof VerseEvaluation>(
  results: VerseEvaluation[],
  key: T
): number {
  return results.reduce((total, result) => total + Number(result[key]), 0);
}

function parseCliOptions(argv: string[]): EvaluationOptions {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg?.startsWith("--")) continue;
    const [key, inlineValue] = arg.slice(2).split("=", 2);
    const value = inlineValue ?? argv[index + 1];
    if (!inlineValue) index += 1;
    if (key && value) args.set(key, value);
  }

  return {
    gold: args.get("gold") ?? "Sg1910",
    onlyRef: args.get("only"),
    limit: args.has("limit")
      ? Number.parseInt(args.get("limit") ?? "", 10)
      : undefined,
    outputDir: args.get("output-dir") ?? "outputs",
    includeGoldReference: args.has("include-gold-reference")
  };
}

function roundRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10_000) / 10_000;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await evaluateStrongGold(
    parseCliOptions(process.argv.slice(2))
  );
  console.log(`Evaluated ${report.gold}: ${report.verseCount} verses`);
  console.log(
    `Precision: ${report.precision}; recall: ${report.recall}; F1: ${report.f1}`
  );
  console.log(`Wrote ${report.outputPath}`);
}
