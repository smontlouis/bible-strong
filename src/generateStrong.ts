import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { alignVerse } from "./align.js";
import { readBibleJson, type BibleVerse } from "./bibleJson.js";
import { buildStrongLexicon } from "./lexicon.js";
import { renderTaggedText, tsvEscape } from "./render.js";
import {
  buildStrongVerseMap,
  readStrongCsv,
  referenceKey,
  type StrongVerseMap
} from "./strongCsv.js";

interface CliOptions {
  bible: string;
  biblePath: string;
  outputDir: string;
  references: Array<{ name: string; path: string }>;
}

interface VerseDiagnostic {
  ref: string;
  reason: string;
  wordCount: number;
  taggedWordCount: number;
  confidence: number;
}

interface GenerationMetrics {
  bible: string;
  generatedAt: string;
  inputPath: string;
  outputPath: string;
  diagnosticsPath: string;
  references: Array<{ name: string; path: string; verses: number }>;
  lexicon: {
    exactEntries: number;
    stemEntries: number;
  };
  verseCount: number;
  generatedVerseCount: number;
  failedVerseCount: number;
  lowConfidenceVerseCount: number;
  wordCount: number;
  taggedWordCount: number;
  lowConfidenceWordCount: number;
  verseCoverage: number;
  taggedTokenCoverage: number;
  averageTaggedConfidence: number;
  method: string;
}

const DEFAULT_REFERENCES = [
  { name: "Sg1910", path: "data/strongs/Sg1910.csv" },
  { name: "Darby", path: "data/strongs/Darby.csv" },
  { name: "DarbyR", path: "data/strongs/DarbyR.csv" }
];

export async function generateStrongBible(
  options: CliOptions
): Promise<GenerationMetrics> {
  const verses = await readBibleJson(options.biblePath);
  const referenceMaps = await loadReferences(options.references);
  const lexicon = buildStrongLexicon(referenceMaps);
  await mkdir(options.outputDir, { recursive: true });

  const outputPath = path.join(
    options.outputDir,
    `bible-${options.bible}-strong.tsv`
  );
  const metricsPath = path.join(
    options.outputDir,
    `bible-${options.bible}-strong.metrics.json`
  );
  const diagnosticsPath = path.join(
    options.outputDir,
    `bible-${options.bible}-strong.diagnostics.json`
  );

  const lines = ["book_id\tnum_chapter\tnum_verse\ttext"];
  const diagnostics: VerseDiagnostic[] = [];
  let wordCount = 0;
  let taggedWordCount = 0;
  let lowConfidenceWordCount = 0;
  let confidenceSum = 0;
  let assignmentCount = 0;
  let lowConfidenceVerseCount = 0;
  let failedVerseCount = 0;

  for (const verse of verses) {
    const key = referenceKey(verse.bookId, verse.chapter, verse.verse);
    const references = referenceMaps.map((reference) => ({
      name: reference.name,
      verse: reference.map.get(key)
    }));
    const hasReference = references.some((reference) => reference.verse);

    if (!hasReference) {
      failedVerseCount += 1;
      diagnostics.push({
        ref: formatRef(verse),
        reason: "missing-reference",
        wordCount: 0,
        taggedWordCount: 0,
        confidence: 0
      });
      lines.push(
        `${verse.bookId}\t${verse.chapter}\t${verse.verse}\t${tsvEscape(verse.text)}`
      );
      continue;
    }

    const result = alignVerse(verse.text, references, lexicon);
    const taggedText = renderTaggedText(result);
    const confidence = averageConfidence(result.assignments.values());

    wordCount += result.wordCount;
    taggedWordCount += result.taggedWordCount;
    lowConfidenceWordCount += result.lowConfidenceWordCount;
    confidenceSum += [...result.assignments.values()].reduce(
      (sum, assignment) => sum + assignment.confidence,
      0
    );
    assignmentCount += result.assignments.size;

    if (result.wordCount === 0 || result.taggedWordCount === 0) {
      failedVerseCount += 1;
      diagnostics.push({
        ref: formatRef(verse),
        reason:
          result.wordCount === 0
            ? "empty-target-verse"
            : "no-tagged-target-words",
        wordCount: result.wordCount,
        taggedWordCount: result.taggedWordCount,
        confidence
      });
    } else if (
      result.taggedWordCount / result.wordCount < 0.25 ||
      confidence < 0.6
    ) {
      lowConfidenceVerseCount += 1;
      diagnostics.push({
        ref: formatRef(verse),
        reason: "low-confidence",
        wordCount: result.wordCount,
        taggedWordCount: result.taggedWordCount,
        confidence
      });
    }

    lines.push(
      `${verse.bookId}\t${verse.chapter}\t${verse.verse}\t${tsvEscape(taggedText)}`
    );
  }

  const metrics: GenerationMetrics = {
    bible: options.bible,
    generatedAt: new Date().toISOString(),
    inputPath: options.biblePath,
    outputPath,
    diagnosticsPath,
    references: referenceMaps.map((reference) => ({
      name: reference.name,
      path: reference.path,
      verses: reference.map.size
    })),
    lexicon: {
      exactEntries: lexicon.exact.size,
      stemEntries: lexicon.stem.size
    },
    verseCount: verses.length,
    generatedVerseCount: verses.length - failedVerseCount,
    failedVerseCount,
    lowConfidenceVerseCount,
    wordCount,
    taggedWordCount,
    lowConfidenceWordCount,
    verseCoverage: roundRatio(
      (verses.length - failedVerseCount) / verses.length
    ),
    taggedTokenCoverage: roundRatio(taggedWordCount / wordCount),
    averageTaggedConfidence: roundRatio(
      confidenceSum / Math.max(1, assignmentCount)
    ),
    method:
      "Verse-level French reference transfer from Sg1910, Darby, and DarbyR using exact, stem, and conservative prefix matches, followed by a conservative global lexicon fallback for statistically dominant French word-to-Strong pairs. Every generated tag carries confidence, source, and method attributes."
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

function parseCliOptions(argv: string[]): CliOptions {
  const args = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg?.startsWith("--")) {
      const [key, inlineValue] = arg.slice(2).split("=", 2);
      const value = inlineValue ?? argv[index + 1];

      if (!inlineValue) {
        index += 1;
      }

      if (key && value) {
        args.set(key, value);
      }
    }
  }

  const bible = args.get("bible") ?? "bds";

  return {
    bible,
    biblePath: args.get("input") ?? `data/bibles/bible-${bible}.json`,
    outputDir: args.get("output-dir") ?? "outputs",
    references: DEFAULT_REFERENCES
  };
}

async function loadReferences(references: CliOptions["references"]): Promise<
  Array<{
    name: string;
    path: string;
    map: StrongVerseMap;
  }>
> {
  return Promise.all(
    references.map(async (reference) => ({
      ...reference,
      map: buildStrongVerseMap(await readStrongCsv(reference.path))
    }))
  );
}

function averageConfidence(
  assignments: Iterable<{ confidence: number }>
): number {
  const values = [...assignments].map((assignment) => assignment.confidence);

  if (values.length === 0) {
    return 0;
  }

  return roundRatio(
    values.reduce((sum, value) => sum + value, 0) / values.length
  );
}

function roundRatio(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value * 10_000) / 10_000;
}

function formatRef(verse: BibleVerse): string {
  return `${verse.bookId}.${verse.chapter}.${verse.verse}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseCliOptions(process.argv.slice(2));
  const metrics = await generateStrongBible(options);

  console.log(`Generated ${metrics.outputPath}`);
  console.log(
    `Verses: ${metrics.generatedVerseCount}/${metrics.verseCount}; tagged-token coverage: ${(
      metrics.taggedTokenCoverage * 100
    ).toFixed(2)}%; low-confidence verses: ${metrics.lowConfidenceVerseCount}`
  );
}
