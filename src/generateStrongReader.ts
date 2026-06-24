import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { readBibleJson, type BibleVerse } from "./bibleJson.js";
import { buildStrongLexicon } from "./lexicon.js";
import {
  readOriginalSourceTsv,
  summarizeOriginalSource,
  type OriginalVerse,
  type OriginalSourceSummary,
  type OriginalVerseMap
} from "./originalSource.js";
import {
  alignReaderVerse,
  renderReaderTaggedText,
  type ReaderAlignmentResult
} from "./readerAlignment.js";
import { tsvEscape } from "./render.js";
import {
  buildStrongVerseMap,
  parseStrongOccurrences,
  readStrongCsv,
  referenceKey,
  type StrongRow,
  type StrongVerseMap
} from "./strongCsv.js";
import { readStrongDictionaryTranslationCandidates } from "./strongDictionaryLexicon.js";
import { buildStrongTranslationLexicon } from "./translationLexicon.js";

interface ReaderOptions {
  bible: string;
  biblePath: string;
  outputDir: string;
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

interface ReaderDiagnostic {
  ref: string;
  reason: string;
  wordCount: number;
  taggedWordCount: number;
  strongWordOccurrenceCount: number;
  emptyStrongOccurrenceCount: number;
  originalConfirmedTaggedWordCount: number;
  confidence: number;
}

interface ReferenceProfile {
  occurrenceCounts: Record<string, number>;
  emptyCounts: Record<string, number>;
  averageOccurrenceCount: number;
  averageEmptyCount: number;
  averageEmptyRate: number;
}

interface ReaderMetrics {
  bible: string;
  generatedAt: string;
  inputPath: string;
  outputPath: string;
  diagnosticsPath: string;
  references: Array<{ name: string; path: string; verses: number }>;
  originalSources: OriginalSourceSummary[];
  verseCount: number;
  generatedVerseCount: number;
  failedVerseCount: number;
  lowConfidenceVerseCount: number;
  originalSourceVerseCount: number;
  wordCount: number;
  taggedWordCount: number;
  strongWordOccurrenceCount: number;
  emptyStrongOccurrenceCount: number;
  totalStrongOccurrenceCount: number;
  multiStrongWordCount: number;
  lowConfidenceWordCount: number;
  originalConfirmedTaggedWordCount: number;
  taggedTokenCoverage: number;
  strongOccurrencePerTaggedWord: number;
  emptyStrongRate: number;
  originalConfirmationRate: number;
  averageTaggedConfidence: number;
  referenceProfile: ReferenceProfile;
  comparisonToExisting?: {
    v1TaggedTokenCoverage?: number;
    v2TaggedTokenCoverage?: number;
    completeEmptyStrongRate?: number;
    completeTotalStrongOccurrenceCount?: number;
  };
  method: string;
}

const REFERENCES = [
  { name: "Sg1910", path: "data/strongs/Sg1910.csv" },
  { name: "Darby", path: "data/strongs/Darby.csv" },
  { name: "DarbyR", path: "data/strongs/DarbyR.csv" }
];

const ORIGINAL_SOURCES = [
  {
    name: "WLC",
    path: "data/external/Alignments/data/sources/WLC.tsv",
    license:
      "CC BY 4.0 via Clear-Bible/Alignments; WLC text may be viewed or copied without restriction per repository license notes.",
    url: "https://github.com/Clear-Bible/Alignments"
  },
  {
    name: "SBLGNT",
    path: "data/external/Alignments/data/sources/SBLGNT.tsv",
    license:
      "CC BY 4.0 via Clear-Bible/Alignments, derived from Clear Bible data and SBLGNT source notes.",
    url: "https://github.com/Clear-Bible/Alignments"
  }
];

export async function generateStrongReader(
  options: ReaderOptions
): Promise<ReaderMetrics> {
  const verses = await readBibleJson(options.biblePath);
  const references = await loadReferences();
  const originals = await loadOriginalSources();
  const originalByRef = mergeOriginalSources(originals);
  const lexicon = buildStrongLexicon(references);
  const dictionaryCandidates = readStrongDictionaryTranslationCandidates();
  const translationLexicon = buildStrongTranslationLexicon(references, {
    dictionaryCandidates
  });
  await mkdir(options.outputDir, { recursive: true });

  const outputPath = path.join(
    options.outputDir,
    `bible-${options.bible}-strong-reader.tsv`
  );
  const metricsPath = path.join(
    options.outputDir,
    `bible-${options.bible}-strong-reader.metrics.json`
  );
  const diagnosticsPath = path.join(
    options.outputDir,
    `bible-${options.bible}-strong-reader.diagnostics.json`
  );
  const lines = ["book_id\tnum_chapter\tnum_verse\ttext"];
  const diagnostics: ReaderDiagnostic[] = [];

  let generatedVerseCount = 0;
  let failedVerseCount = 0;
  let lowConfidenceVerseCount = 0;
  let originalSourceVerseCount = 0;
  let wordCount = 0;
  let taggedWordCount = 0;
  let strongWordOccurrenceCount = 0;
  let emptyStrongOccurrenceCount = 0;
  let multiStrongWordCount = 0;
  let lowConfidenceWordCount = 0;
  let originalConfirmedTaggedWordCount = 0;
  let confidenceSum = 0;
  let assignmentCount = 0;

  for (const verse of verses) {
    const key = referenceKey(verse.bookId, verse.chapter, verse.verse);
    const original = originalByRef.get(key);
    if (original) originalSourceVerseCount += 1;

    const result = alignReaderVerse({
      targetText: verse.text,
      references: references.map((reference) => ({
        name: reference.name,
        verse: reference.map.get(key)
      })),
      lexicon,
      originalVerse: original?.verse,
      translationLexicon,
      original: original
        ? {
            strongSet: original.verse.strongSet,
            source: original.sourceNames.join("+")
          }
        : undefined
    });

    const average = averageConfidence(result);
    const originalConfirmed = countOriginalConfirmed(result);
    wordCount += result.wordCount;
    taggedWordCount += result.taggedWordCount;
    strongWordOccurrenceCount += result.strongWordOccurrenceCount;
    emptyStrongOccurrenceCount += result.emptyStrongOccurrenceCount;
    multiStrongWordCount += result.multiStrongWordCount;
    lowConfidenceWordCount += result.lowConfidenceWordCount;
    originalConfirmedTaggedWordCount += originalConfirmed;
    confidenceSum += [...result.assignments.values()].reduce(
      (sum, assignment) => sum + assignment.confidence,
      0
    );
    assignmentCount += result.assignments.size;

    if (result.wordCount === 0 || result.taggedWordCount === 0) {
      failedVerseCount += 1;
      diagnostics.push(
        toDiagnostic(verse, result, originalConfirmed, average, "no-tags")
      );
    } else {
      generatedVerseCount += 1;
      const taggedRate = result.taggedWordCount / result.wordCount;
      const originalRate =
        originalConfirmed / Math.max(1, result.taggedWordCount);

      if (
        taggedRate < 0.22 ||
        average < 0.58 ||
        (original && originalRate < 0.45)
      ) {
        lowConfidenceVerseCount += 1;
        diagnostics.push(
          toDiagnostic(
            verse,
            result,
            originalConfirmed,
            average,
            original && originalRate < 0.45
              ? "low-original-confirmation"
              : "low-confidence"
          )
        );
      }
    }

    lines.push(
      `${verse.bookId}\t${verse.chapter}\t${verse.verse}\t${tsvEscape(
        renderReaderTaggedText(result)
      )}`
    );
  }

  const totalStrongOccurrenceCount =
    strongWordOccurrenceCount + emptyStrongOccurrenceCount;
  const metrics: ReaderMetrics = {
    bible: options.bible,
    generatedAt: new Date().toISOString(),
    inputPath: options.biblePath,
    outputPath,
    diagnosticsPath,
    references: references.map((reference) => ({
      name: reference.name,
      path: reference.path,
      verses: reference.map.size
    })),
    originalSources: originals.map((original) => original.summary),
    verseCount: verses.length,
    generatedVerseCount,
    failedVerseCount,
    lowConfidenceVerseCount,
    originalSourceVerseCount,
    wordCount,
    taggedWordCount,
    strongWordOccurrenceCount,
    emptyStrongOccurrenceCount,
    totalStrongOccurrenceCount,
    multiStrongWordCount,
    lowConfidenceWordCount,
    originalConfirmedTaggedWordCount,
    taggedTokenCoverage: roundRatio(taggedWordCount / wordCount),
    strongOccurrencePerTaggedWord: roundRatio(
      strongWordOccurrenceCount / taggedWordCount
    ),
    emptyStrongRate: roundRatio(
      emptyStrongOccurrenceCount / Math.max(1, totalStrongOccurrenceCount)
    ),
    originalConfirmationRate: roundRatio(
      originalConfirmedTaggedWordCount / Math.max(1, taggedWordCount)
    ),
    averageTaggedConfidence: roundRatio(
      confidenceSum / Math.max(1, assignmentCount)
    ),
    referenceProfile: buildReferenceProfile(references),
    comparisonToExisting: await readExistingMetrics(
      options.outputDir,
      options.bible
    ),
    method:
      "Reader-mode Strong generation. Tags are transferred from Sg1910, Darby, and DarbyR to matching French words, checked against WLC/SBLGNT verse inventories when available, then ledgerVerse from original Strong occurrences when a learned French translation or curated reader rule identifies a real target word. Only editorial empty Strong tags that appear in at least two local Strong references are added. The goal is a fluent Strong Bible, not complete morphological coverage."
  };

  await writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");
  await writeFile(metricsPath, `${JSON.stringify(metrics, null, 2)}\n`, "utf8");
  await writeFile(
    diagnosticsPath,
    `${JSON.stringify(diagnostics, null, 2)}\n`,
    "utf8"
  );

  return metrics;
}

function parseCliOptions(argv: string[]): ReaderOptions {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg?.startsWith("--")) continue;
    const [key, inlineValue] = arg.slice(2).split("=", 2);
    const value = inlineValue ?? argv[index + 1];
    if (!inlineValue) index += 1;
    if (key && value) args.set(key, value);
  }

  const bible = args.get("bible") ?? "nbs";
  return {
    bible,
    biblePath: args.get("input") ?? `data/bibles/bible-${bible}.json`,
    outputDir: args.get("output-dir") ?? "outputs"
  };
}

async function loadReferences(): Promise<ReferenceMap[]> {
  return Promise.all(
    REFERENCES.map(async (reference) => {
      const rows = await readStrongCsv(reference.path);
      return {
        ...reference,
        rows,
        map: buildStrongVerseMap(rows)
      };
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

function mergeOriginalSources(originals: OriginalBundle[]): Map<
  string,
  {
    verse: OriginalVerse;
    sourceNames: string[];
  }
> {
  const merged = new Map<
    string,
    { verse: OriginalVerse; sourceNames: string[] }
  >();

  for (const original of originals) {
    for (const [key, verse] of original.map) {
      const existing =
        merged.get(key) ??
        ({
          verse: {
            bookId: verse.bookId,
            chapter: verse.chapter,
            verse: verse.verse,
            tokens: [],
            strongSet: new Set<string>()
          },
          sourceNames: []
        } satisfies {
          verse: OriginalVerse;
          sourceNames: string[];
        });
      existing.verse.tokens.push(...verse.tokens);
      for (const strong of verse.strongSet) {
        existing.verse.strongSet.add(strong);
      }
      if (!existing.sourceNames.includes(original.name)) {
        existing.sourceNames.push(original.name);
      }
      merged.set(key, existing);
    }
  }

  return merged;
}

function averageConfidence(result: ReaderAlignmentResult): number {
  const assignments = [...result.assignments.values()];
  if (assignments.length === 0) return 0;
  return roundRatio(
    assignments.reduce((sum, assignment) => sum + assignment.confidence, 0) /
      assignments.length
  );
}

function countOriginalConfirmed(result: ReaderAlignmentResult): number {
  return [...result.assignments.values()].filter(
    (assignment) => assignment.originalConfirmed
  ).length;
}

function toDiagnostic(
  verse: BibleVerse,
  result: ReaderAlignmentResult,
  originalConfirmedTaggedWordCount: number,
  confidence: number,
  reason: string
): ReaderDiagnostic {
  return {
    ref: `${verse.bookId}.${verse.chapter}.${verse.verse}`,
    reason,
    wordCount: result.wordCount,
    taggedWordCount: result.taggedWordCount,
    strongWordOccurrenceCount: result.strongWordOccurrenceCount,
    emptyStrongOccurrenceCount: result.emptyStrongOccurrenceCount,
    originalConfirmedTaggedWordCount,
    confidence
  };
}

function buildReferenceProfile(references: ReferenceMap[]): ReferenceProfile {
  const occurrenceCounts: Record<string, number> = {};
  const emptyCounts: Record<string, number> = {};

  for (const reference of references) {
    occurrenceCounts[reference.name] = 0;
    emptyCounts[reference.name] = 0;
    for (const row of reference.rows) {
      occurrenceCounts[reference.name] += parseStrongOccurrences(
        row.text
      ).length;
      emptyCounts[reference.name] += countEmptyStrongTags(row.text);
    }
  }

  const occurrenceValues = Object.values(occurrenceCounts);
  const emptyValues = Object.values(emptyCounts);
  const averageOccurrenceCount = average(occurrenceValues);
  const averageEmptyCount = average(emptyValues);

  return {
    occurrenceCounts,
    emptyCounts,
    averageOccurrenceCount: Math.round(averageOccurrenceCount),
    averageEmptyCount: Math.round(averageEmptyCount),
    averageEmptyRate: roundRatio(averageEmptyCount / averageOccurrenceCount)
  };
}

function countEmptyStrongTags(text: string): number {
  return (text.match(/<w\b[^>]*><\/w>/giu) ?? []).length;
}

async function readExistingMetrics(
  outputDir: string,
  bible: string
): Promise<ReaderMetrics["comparisonToExisting"]> {
  const [v1, v2, complete] = await Promise.all([
    readJson(path.join(outputDir, `bible-${bible}-strong.metrics.json`)),
    readJson(path.join(outputDir, `bible-${bible}-strong-v2.metrics.json`)),
    readJson(path.join(outputDir, `bible-${bible}-strong-align.metrics.json`))
  ]);

  return {
    v1TaggedTokenCoverage: asNumber(v1?.taggedTokenCoverage),
    v2TaggedTokenCoverage: asNumber(v2?.taggedTokenCoverage),
    completeEmptyStrongRate: asNumber(complete?.emptyStrongRate),
    completeTotalStrongOccurrenceCount: asNumber(
      complete?.representedStrongOccurrenceCount
    )
  };
}

async function readJson(
  pathname: string
): Promise<Record<string, unknown> | undefined> {
  try {
    return JSON.parse(await readFile(pathname, "utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    return undefined;
  }
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10_000) / 10_000;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseCliOptions(process.argv.slice(2));
  const metrics = await generateStrongReader(options);

  console.log(`Generated ${metrics.outputPath}`);
  console.log(
    `Verses: ${metrics.generatedVerseCount}/${metrics.verseCount}; tags: ${metrics.totalStrongOccurrenceCount}; empty: ${(
      metrics.emptyStrongRate * 100
    ).toFixed(2)}%; tagged-token coverage: ${(
      metrics.taggedTokenCoverage * 100
    ).toFixed(2)}%`
  );
}
