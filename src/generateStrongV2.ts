import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { alignVerse, type AlignmentResult } from "./align.js";
import { readBibleJson, type BibleVerse } from "./bibleJson.js";
import { buildStrongLexicon } from "./lexicon.js";
import {
  readOriginalSourceTsv,
  summarizeOriginalSource,
  type OriginalSourceSummary,
  type OriginalVerseMap
} from "./originalSource.js";
import { renderTaggedText, tsvEscape } from "./render.js";
import {
  buildStrongVerseMap,
  readStrongCsv,
  referenceKey,
  type StrongVerseMap
} from "./strongCsv.js";

interface V2Options {
  bible: string;
  biblePath: string;
  outputDir: string;
}

interface ReferenceMap {
  name: string;
  path: string;
  map: StrongVerseMap;
}

interface OriginalBundle {
  name: string;
  path: string;
  map: OriginalVerseMap;
  summary: OriginalSourceSummary;
}

interface V2Diagnostic {
  ref: string;
  reason: string;
  wordCount: number;
  taggedWordCount: number;
  originalConfirmedTaggedWordCount: number;
  confidence: number;
}

interface V2Metrics {
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
  originalConfirmedTaggedWordCount: number;
  fallbackTaggedWordCount: number;
  lowConfidenceWordCount: number;
  verseCoverage: number;
  taggedTokenCoverage: number;
  originalConfirmedTaggedTokenCoverage: number;
  originalConfirmationRate: number;
  averageTaggedConfidence: number;
  comparisonToV1?: {
    v1TaggedTokenCoverage: number;
    v1VerseCoverage: number;
    v1TaggedWordCount: number;
    v1GeneratedVerseCount: number;
    deltaTaggedTokenCoverage: number;
    deltaVerseCoverage: number;
    deltaTaggedWordCount: number;
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

export async function generateStrongBibleV2(
  options: V2Options
): Promise<V2Metrics> {
  const verses = await readBibleJson(options.biblePath);
  const references = await loadReferences();
  const originals = await loadOriginalSources();
  const lexicon = buildStrongLexicon(references);
  const originalByRef = mergeOriginalSources(originals);

  const outputPath = path.join(
    options.outputDir,
    `bible-${options.bible}-strong-v2.tsv`
  );
  const metricsPath = path.join(
    options.outputDir,
    `bible-${options.bible}-strong-v2.metrics.json`
  );
  const diagnosticsPath = path.join(
    options.outputDir,
    `bible-${options.bible}-strong-v2.diagnostics.json`
  );
  const lines = ["book_id\tnum_chapter\tnum_verse\ttext"];
  const diagnostics: V2Diagnostic[] = [];

  let wordCount = 0;
  let taggedWordCount = 0;
  let lowConfidenceWordCount = 0;
  let originalConfirmedTaggedWordCount = 0;
  let confidenceSum = 0;
  let assignmentCount = 0;
  let failedVerseCount = 0;
  let lowConfidenceVerseCount = 0;
  let originalSourceVerseCount = 0;

  for (const verse of verses) {
    const key = referenceKey(verse.bookId, verse.chapter, verse.verse);
    const original = originalByRef.get(key);
    if (original) {
      originalSourceVerseCount += 1;
    }

    const result = alignVerse(
      verse.text,
      references.map((reference) => ({
        name: reference.name,
        verse: reference.map.get(key)
      })),
      lexicon,
      original
        ? {
            strongSet: original.strongSet,
            source: original.sourceNames.join("+")
          }
        : undefined
    );

    const originalConfirmed = countOriginalConfirmed(result);
    const average = averageConfidence(result);
    wordCount += result.wordCount;
    taggedWordCount += result.taggedWordCount;
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
    } else if (
      original &&
      originalConfirmed / Math.max(1, result.taggedWordCount) < 0.5
    ) {
      lowConfidenceVerseCount += 1;
      diagnostics.push(
        toDiagnostic(
          verse,
          result,
          originalConfirmed,
          average,
          "low-original-confirmation"
        )
      );
    } else if (
      result.taggedWordCount / result.wordCount < 0.25 ||
      average < 0.6
    ) {
      lowConfidenceVerseCount += 1;
      diagnostics.push(
        toDiagnostic(
          verse,
          result,
          originalConfirmed,
          average,
          "low-confidence"
        )
      );
    }

    lines.push(
      `${verse.bookId}\t${verse.chapter}\t${verse.verse}\t${tsvEscape(
        renderTaggedText(result)
      )}`
    );
  }

  const v1 = await readV1Metrics(options.outputDir, options.bible);
  const metrics: V2Metrics = {
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
    generatedVerseCount: verses.length - failedVerseCount,
    failedVerseCount,
    lowConfidenceVerseCount,
    originalSourceVerseCount,
    wordCount,
    taggedWordCount,
    originalConfirmedTaggedWordCount,
    fallbackTaggedWordCount: taggedWordCount - originalConfirmedTaggedWordCount,
    lowConfidenceWordCount,
    verseCoverage: roundRatio(
      (verses.length - failedVerseCount) / verses.length
    ),
    taggedTokenCoverage: roundRatio(taggedWordCount / wordCount),
    originalConfirmedTaggedTokenCoverage: roundRatio(
      originalConfirmedTaggedWordCount / wordCount
    ),
    originalConfirmationRate: roundRatio(
      originalConfirmedTaggedWordCount / taggedWordCount
    ),
    averageTaggedConfidence: roundRatio(
      confidenceSum / Math.max(1, assignmentCount)
    ),
    comparisonToV1: v1
      ? {
          v1TaggedTokenCoverage: v1.taggedTokenCoverage,
          v1VerseCoverage: v1.verseCoverage,
          v1TaggedWordCount: v1.taggedWordCount,
          v1GeneratedVerseCount: v1.generatedVerseCount,
          deltaTaggedTokenCoverage: roundRatio(
            taggedWordCount / wordCount - v1.taggedTokenCoverage
          ),
          deltaVerseCoverage: roundRatio(
            (verses.length - failedVerseCount) / verses.length -
              v1.verseCoverage
          ),
          deltaTaggedWordCount: taggedWordCount - v1.taggedWordCount
        }
      : undefined,
    method:
      "V2 constrains French reference-transfer tags against verse-level original-language Strong inventories from Clear-Bible/Alignments WLC and SBLGNT source TSV files. Source-confirmed tags are marked data-original=true; unconfirmed reference fallback tags remain explicit and lower confidence."
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

function parseCliOptions(argv: string[]): V2Options {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg?.startsWith("--")) continue;
    const [key, inlineValue] = arg.slice(2).split("=", 2);
    const value = inlineValue ?? argv[index + 1];
    if (!inlineValue) index += 1;
    if (key && value) args.set(key, value);
  }

  const bible = args.get("bible") ?? "bds";
  return {
    bible,
    biblePath: args.get("input") ?? `data/bibles/bible-${bible}.json`,
    outputDir: args.get("output-dir") ?? "outputs"
  };
}

async function loadReferences(): Promise<ReferenceMap[]> {
  return Promise.all(
    REFERENCES.map(async (reference) => ({
      ...reference,
      map: buildStrongVerseMap(await readStrongCsv(reference.path))
    }))
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
    strongSet: Set<string>;
    sourceNames: string[];
  }
> {
  const merged = new Map<
    string,
    { strongSet: Set<string>; sourceNames: string[] }
  >();

  for (const original of originals) {
    for (const [key, verse] of original.map) {
      const existing =
        merged.get(key) ??
        ({ strongSet: new Set<string>(), sourceNames: [] } satisfies {
          strongSet: Set<string>;
          sourceNames: string[];
        });
      for (const strong of verse.strongSet) existing.strongSet.add(strong);
      if (!existing.sourceNames.includes(original.name)) {
        existing.sourceNames.push(original.name);
      }
      merged.set(key, existing);
    }
  }

  return merged;
}

function countOriginalConfirmed(result: AlignmentResult): number {
  return [...result.assignments.values()].filter(
    (assignment) => assignment.originalConfirmed
  ).length;
}

function averageConfidence(result: AlignmentResult): number {
  const assignments = [...result.assignments.values()];
  if (assignments.length === 0) return 0;
  return roundRatio(
    assignments.reduce((sum, assignment) => sum + assignment.confidence, 0) /
      assignments.length
  );
}

function toDiagnostic(
  verse: BibleVerse,
  result: AlignmentResult,
  originalConfirmedTaggedWordCount: number,
  confidence: number,
  reason: string
): V2Diagnostic {
  return {
    ref: `${verse.bookId}.${verse.chapter}.${verse.verse}`,
    reason,
    wordCount: result.wordCount,
    taggedWordCount: result.taggedWordCount,
    originalConfirmedTaggedWordCount,
    confidence
  };
}

async function readV1Metrics(
  outputDir: string,
  bible: string
): Promise<
  | {
      taggedTokenCoverage: number;
      verseCoverage: number;
      taggedWordCount: number;
      generatedVerseCount: number;
    }
  | undefined
> {
  try {
    const content = await readFile(
      path.join(outputDir, `bible-${bible}-strong.metrics.json`),
      "utf8"
    );
    return JSON.parse(content) as {
      taggedTokenCoverage: number;
      verseCoverage: number;
      taggedWordCount: number;
      generatedVerseCount: number;
    };
  } catch {
    return undefined;
  }
}

function roundRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10_000) / 10_000;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const metrics = await generateStrongBibleV2(
    parseCliOptions(process.argv.slice(2))
  );
  console.log(`Generated ${metrics.outputPath}`);
  console.log(
    `Verses: ${metrics.generatedVerseCount}/${metrics.verseCount}; tagged-token coverage: ${(
      metrics.taggedTokenCoverage * 100
    ).toFixed(2)}%; original confirmation: ${(
      metrics.originalConfirmationRate * 100
    ).toFixed(2)}%; low-confidence verses: ${metrics.lowConfidenceVerseCount}`
  );
}
