import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  alignCompleteVerse,
  countFrenchTokens,
  renderCompleteTaggedText,
  type CompleteAlignmentResult
} from "./completeAlignment.js";
import { readBibleJson, type BibleVerse } from "./bibleJson.js";
import { buildStrongLexicon } from "./lexicon.js";
import {
  readOriginalSourceTsv,
  summarizeOriginalSource,
  type OriginalSourceSummary,
  type OriginalVerseMap
} from "./originalSource.js";
import { tsvEscape } from "./render.js";
import {
  buildStrongVerseMap,
  parseStrongOccurrences,
  readStrongCsv,
  referenceKey,
  type StrongRow,
  type StrongVerseMap
} from "./strongCsv.js";

interface AlignOptions {
  bible: string;
  biblePath: string;
  outputDir: string;
  evaluationReference: "Sg1910" | "Darby";
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

interface AlignDiagnostic {
  ref: string;
  reason: string;
  frenchTokenCount: number;
  taggedFrenchTokenCount: number;
  originalStrongOccurrenceCount: number;
  representedStrongOccurrenceCount: number;
  realWordStrongOccurrenceCount: number;
  emptyStrongOccurrenceCount: number;
}

interface EvaluationMetrics {
  reference: string;
  evaluatedVerseCount: number;
  expectedOccurrenceCount: number;
  generatedOccurrenceCount: number;
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  precision: number;
  recall: number;
  f1: number;
}

interface AlignMetrics {
  bible: string;
  generatedAt: string;
  inputPath: string;
  outputPath: string;
  diagnosticsPath: string;
  references: Array<{ name: string; path: string; verses: number }>;
  originalSources: OriginalSourceSummary[];
  verseCount: number;
  processedVerseCount: number;
  skippedVerseCount: number;
  frenchTokenCount: number;
  taggedFrenchTokenCount: number;
  originalStrongOccurrenceCount: number;
  representedStrongOccurrenceCount: number;
  missingStrongOccurrenceCount: number;
  realWordStrongOccurrenceCount: number;
  emptyStrongOccurrenceCount: number;
  multiStrongWordCount: number;
  sourceTextMismatchCount: number;
  fallbackStrongOccurrenceCount: number;
  originalDirectStrongOccurrenceCount: number;
  strongCoverage: number;
  emptyStrongRate: number;
  realWordStrongRate: number;
  taggedFrenchTokenRate: number;
  comparisonToV1V2?: {
    v1TaggedTokenCoverage?: number;
    v2TaggedTokenCoverage?: number;
    v2OriginalConfirmationRate?: number;
  };
  evaluation: EvaluationMetrics;
  method: string;
}

const REFERENCES = [
  { name: "Sg1910", path: "data/strongs/Sg1910.csv" },
  { name: "Darby", path: "data/strongs/Darby.csv" },
  { name: "DarbyR", path: "data/strongs/DarbyR.csv" }
] as const;

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

export async function generateStrongAlign(
  options: AlignOptions
): Promise<AlignMetrics> {
  const verses = await readBibleJson(options.biblePath);
  const references = await loadReferences();
  const originals = await loadOriginalSources();
  const originalByRef = mergeOriginalSources(originals);
  const lexicon = buildStrongLexicon(references);
  await mkdir(options.outputDir, { recursive: true });

  const outputPath = path.join(
    options.outputDir,
    `bible-${options.bible}-strong-align.tsv`
  );
  const metricsPath = path.join(
    options.outputDir,
    `bible-${options.bible}-strong-align.metrics.json`
  );
  const diagnosticsPath = path.join(
    options.outputDir,
    `bible-${options.bible}-strong-align.diagnostics.json`
  );
  const lines = ["book_id\tnum_chapter\tnum_verse\ttext"];
  const diagnostics: AlignDiagnostic[] = [];
  const generatedOccurrencesByRef = new Map<string, string[]>();
  const metrics = createEmptyMetrics(options, outputPath, diagnosticsPath);

  metrics.verseCount = verses.length;
  metrics.references = references.map((reference) => ({
    name: reference.name,
    path: reference.path,
    verses: reference.map.size
  }));
  metrics.originalSources = originals.map((original) => original.summary);

  for (const verse of verses) {
    const key = referenceKey(verse.bookId, verse.chapter, verse.verse);
    const original = originalByRef.get(key);

    if (!original) {
      metrics.skippedVerseCount += 1;
      metrics.sourceTextMismatchCount += 1;
      metrics.frenchTokenCount += countFrenchTokens(verse.text);
      diagnostics.push({
        ref: formatRef(verse),
        reason: "sourceTextMismatch",
        frenchTokenCount: countFrenchTokens(verse.text),
        taggedFrenchTokenCount: 0,
        originalStrongOccurrenceCount: 0,
        representedStrongOccurrenceCount: 0,
        realWordStrongOccurrenceCount: 0,
        emptyStrongOccurrenceCount: 0
      });
      lines.push(
        `${verse.bookId}\t${verse.chapter}\t${verse.verse}\t${tsvEscape(verse.text)}`
      );
      continue;
    }

    const result = alignCompleteVerse({
      targetText: verse.text,
      references: references.map((reference) => ({
        name: reference.name,
        verse: reference.map.get(key)
      })),
      lexicon,
      original
    });

    addResultMetrics(metrics, result);
    metrics.processedVerseCount += 1;
    generatedOccurrencesByRef.set(
      key,
      result.originalOccurrences.map((occurrence) => occurrence.strong)
    );

    if (result.missingStrongOccurrenceCount > 0) {
      diagnostics.push(toDiagnostic(verse, result, "missingStrongOccurrences"));
    } else if (
      result.emptyStrongOccurrenceCount > result.realWordStrongOccurrenceCount
    ) {
      diagnostics.push(
        toDiagnostic(verse, result, "mostlyEmptyStrongOccurrences")
      );
    }

    lines.push(
      `${verse.bookId}\t${verse.chapter}\t${verse.verse}\t${tsvEscape(
        renderCompleteTaggedText(result)
      )}`
    );
  }

  finalizeMetrics(metrics);
  metrics.comparisonToV1V2 = await readBaselineMetrics(
    options.outputDir,
    options.bible
  );
  metrics.evaluation = evaluateAgainstReference(
    options.evaluationReference,
    references,
    generatedOccurrencesByRef
  );

  await writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");
  await writeFile(metricsPath, `${JSON.stringify(metrics, null, 2)}\n`, "utf8");
  await writeFile(
    diagnosticsPath,
    `${JSON.stringify(diagnostics, null, 2)}\n`,
    "utf8"
  );

  return metrics;
}

function parseCliOptions(argv: string[]): AlignOptions {
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
  const evaluationReference =
    args.get("evaluation-reference") === "Darby" ? "Darby" : "Sg1910";

  return {
    bible,
    biblePath: args.get("input") ?? `data/bibles/bible-${bible}.json`,
    outputDir: args.get("output-dir") ?? "outputs",
    evaluationReference
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

function mergeOriginalSources(originals: OriginalBundle[]): OriginalVerseMap {
  const merged: OriginalVerseMap = new Map();

  for (const original of originals) {
    for (const [key, verse] of original.map) {
      merged.set(key, verse);
    }
  }

  return merged;
}

function createEmptyMetrics(
  options: AlignOptions,
  outputPath: string,
  diagnosticsPath: string
): AlignMetrics {
  return {
    bible: options.bible,
    generatedAt: new Date().toISOString(),
    inputPath: options.biblePath,
    outputPath,
    diagnosticsPath,
    references: [],
    originalSources: [],
    verseCount: 0,
    processedVerseCount: 0,
    skippedVerseCount: 0,
    frenchTokenCount: 0,
    taggedFrenchTokenCount: 0,
    originalStrongOccurrenceCount: 0,
    representedStrongOccurrenceCount: 0,
    missingStrongOccurrenceCount: 0,
    realWordStrongOccurrenceCount: 0,
    emptyStrongOccurrenceCount: 0,
    multiStrongWordCount: 0,
    sourceTextMismatchCount: 0,
    fallbackStrongOccurrenceCount: 0,
    originalDirectStrongOccurrenceCount: 0,
    strongCoverage: 0,
    emptyStrongRate: 0,
    realWordStrongRate: 0,
    taggedFrenchTokenRate: 0,
    evaluation: {
      reference: options.evaluationReference,
      evaluatedVerseCount: 0,
      expectedOccurrenceCount: 0,
      generatedOccurrenceCount: 0,
      truePositive: 0,
      falsePositive: 0,
      falseNegative: 0,
      precision: 0,
      recall: 0,
      f1: 0
    },
    method:
      "Complete original Strong occurrence representation. French words are aligned to original Strong occurrences when candidate evidence is available; every remaining original Strong occurrence is represented as an empty tag."
  };
}

function addResultMetrics(
  metrics: AlignMetrics,
  result: CompleteAlignmentResult
): void {
  metrics.frenchTokenCount += result.frenchTokenCount;
  metrics.taggedFrenchTokenCount += result.taggedFrenchTokenCount;
  metrics.originalStrongOccurrenceCount += result.originalStrongOccurrenceCount;
  metrics.representedStrongOccurrenceCount +=
    result.representedStrongOccurrenceCount;
  metrics.missingStrongOccurrenceCount += result.missingStrongOccurrenceCount;
  metrics.realWordStrongOccurrenceCount += result.realWordStrongOccurrenceCount;
  metrics.emptyStrongOccurrenceCount += result.emptyStrongOccurrenceCount;
  metrics.multiStrongWordCount += result.multiStrongWordCount;
  metrics.fallbackStrongOccurrenceCount += result.fallbackStrongOccurrenceCount;
  metrics.originalDirectStrongOccurrenceCount +=
    result.originalDirectStrongOccurrenceCount;
}

function finalizeMetrics(metrics: AlignMetrics): void {
  metrics.strongCoverage = roundRatio(
    metrics.representedStrongOccurrenceCount /
      metrics.originalStrongOccurrenceCount
  );
  metrics.emptyStrongRate = roundRatio(
    metrics.emptyStrongOccurrenceCount /
      metrics.representedStrongOccurrenceCount
  );
  metrics.realWordStrongRate = roundRatio(
    metrics.realWordStrongOccurrenceCount /
      metrics.representedStrongOccurrenceCount
  );
  metrics.taggedFrenchTokenRate = roundRatio(
    metrics.taggedFrenchTokenCount / metrics.frenchTokenCount
  );
}

function toDiagnostic(
  verse: BibleVerse,
  result: CompleteAlignmentResult,
  reason: string
): AlignDiagnostic {
  return {
    ref: formatRef(verse),
    reason,
    frenchTokenCount: result.frenchTokenCount,
    taggedFrenchTokenCount: result.taggedFrenchTokenCount,
    originalStrongOccurrenceCount: result.originalStrongOccurrenceCount,
    representedStrongOccurrenceCount: result.representedStrongOccurrenceCount,
    realWordStrongOccurrenceCount: result.realWordStrongOccurrenceCount,
    emptyStrongOccurrenceCount: result.emptyStrongOccurrenceCount
  };
}

function evaluateAgainstReference(
  referenceName: AlignOptions["evaluationReference"],
  references: ReferenceMap[],
  generatedOccurrencesByRef: Map<string, string[]>
): EvaluationMetrics {
  const reference = references.find(
    (candidate) => candidate.name === referenceName
  );
  if (!reference) {
    throw new Error(`Missing evaluation reference ${referenceName}`);
  }

  const metrics: EvaluationMetrics = {
    reference: referenceName,
    evaluatedVerseCount: 0,
    expectedOccurrenceCount: 0,
    generatedOccurrenceCount: 0,
    truePositive: 0,
    falsePositive: 0,
    falseNegative: 0,
    precision: 0,
    recall: 0,
    f1: 0
  };

  for (const row of reference.rows) {
    const key = referenceKey(row.bookId, row.chapter, row.verse);
    const generated = generatedOccurrencesByRef.get(key);
    if (!generated) continue;

    const expected = parseStrongOccurrences(row.text);
    const comparison = compareMultisets(expected, generated);
    metrics.evaluatedVerseCount += 1;
    metrics.expectedOccurrenceCount += expected.length;
    metrics.generatedOccurrenceCount += generated.length;
    metrics.truePositive += comparison.truePositive;
    metrics.falsePositive += comparison.falsePositive;
    metrics.falseNegative += comparison.falseNegative;
  }

  metrics.precision = roundRatio(
    metrics.truePositive /
      Math.max(1, metrics.truePositive + metrics.falsePositive)
  );
  metrics.recall = roundRatio(
    metrics.truePositive /
      Math.max(1, metrics.truePositive + metrics.falseNegative)
  );
  metrics.f1 = roundRatio(
    (2 * metrics.precision * metrics.recall) /
      Math.max(0.0001, metrics.precision + metrics.recall)
  );

  return metrics;
}

function compareMultisets(
  expected: string[],
  generated: string[]
): {
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
} {
  const expectedCounts = countValues(expected);
  const generatedCounts = countValues(generated);
  const keys = new Set([...expectedCounts.keys(), ...generatedCounts.keys()]);
  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;

  for (const key of keys) {
    const expectedCount = expectedCounts.get(key) ?? 0;
    const generatedCount = generatedCounts.get(key) ?? 0;
    truePositive += Math.min(expectedCount, generatedCount);
    falsePositive += Math.max(0, generatedCount - expectedCount);
    falseNegative += Math.max(0, expectedCount - generatedCount);
  }

  return { truePositive, falsePositive, falseNegative };
}

function countValues(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

async function readBaselineMetrics(
  outputDir: string,
  bible: string
): Promise<AlignMetrics["comparisonToV1V2"]> {
  const [v1, v2] = await Promise.all([
    readJsonIfExists(
      path.join(outputDir, `bible-${bible}-strong.metrics.json`)
    ),
    readJsonIfExists(
      path.join(outputDir, `bible-${bible}-strong-v2.metrics.json`)
    )
  ]);

  return {
    v1TaggedTokenCoverage: numberOrUndefined(v1?.taggedTokenCoverage),
    v2TaggedTokenCoverage: numberOrUndefined(v2?.taggedTokenCoverage),
    v2OriginalConfirmationRate: numberOrUndefined(v2?.originalConfirmationRate)
  };
}

async function readJsonIfExists(
  file: string
): Promise<Record<string, unknown> | undefined> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function formatRef(verse: BibleVerse): string {
  return `${verse.bookId}.${verse.chapter}.${verse.verse}`;
}

function roundRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10_000) / 10_000;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const metrics = await generateStrongAlign(
    parseCliOptions(process.argv.slice(2))
  );
  console.log(`Generated ${metrics.outputPath}`);
  console.log(
    `Verses: ${metrics.processedVerseCount}/${metrics.verseCount}; Strong coverage: ${(
      metrics.strongCoverage * 100
    ).toFixed(2)}%; real-word Strong rate: ${(
      metrics.realWordStrongRate * 100
    ).toFixed(
      2
    )}%; empty Strong rate: ${(metrics.emptyStrongRate * 100).toFixed(2)}%`
  );
}
