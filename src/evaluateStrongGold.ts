import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { type ReferenceSource } from "./align.js";
import { BOOK_IDS } from "./books.js";
import { getOriginalStrongOccurrences } from "./completeAlignment.js";
import { buildStrongLexicon } from "./lexicon.js";
import {
  type OriginalSourceSummary,
  summarizeOriginalSource,
  type OriginalVerse,
  type OriginalVerseMap
} from "./originalSource.js";
import { buildStrongPhraseLexicon } from "./phraseTranslationLexicon.js";
import {
  alignReaderVerse,
  type ReaderAlignmentResult
} from "./readerAlignment.js";
import {
  buildStrongVerseMap,
  readStrongCsv,
  type StrongRow,
  type StrongVerseMap
} from "./strongCsv.js";
import { readStrongDictionaryTranslationCandidates } from "./strongDictionaryLexicon.js";
import { stripTags, tokenizeText } from "./tokenize.js";
import { buildStrongTranslationLexicon } from "./translationLexicon.js";
import { readStepOriginalData } from "./stepOriginals.js";
import { getTranslationProfile } from "./translationProfiles.js";
import {
  generateStrongLedger,
  type StrongLedgerVerse
} from "./strongLedger.js";

export interface EvaluationOptions {
  gold: string;
  onlyRef?: string;
  limit?: number;
  outputDir: string;
  includeGoldReference: boolean;
  backend?: "diagnostic" | "canonical";
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

export type CarrierKind = "word" | "phrase" | "empty";

/**
 * One Strong occurrence and its French carrier. Word indexes are zero-based.
 * Empty placements are anchored immediately after `insertAfterWordIndex` (-1
 * means before the first word).
 */
export interface CarrierPlacement {
  strong: string;
  kind: CarrierKind;
  startWordIndex?: number;
  endWordIndex?: number;
  insertAfterWordIndex?: number;
  confidence?: number;
  source?: string;
}

export interface PredictionSourceMetrics {
  source: string;
  predictedCount: number;
  correctExactCarrierCount: number;
  precision: number;
  averageConfidence: number;
}

export interface ScoreMetrics {
  expectedCount: number;
  predictedCount: number;
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface SpanScoreMetrics extends ScoreMetrics {
  matchedVisibleSpanCount: number;
  meanSpanIoU: number;
}

export interface CardinalityMetrics {
  expectedCount: number;
  predictedCount: number;
  absoluteOccurrenceError: number;
  comparedStrongTypeCount: number;
  exactStrongTypeCount: number;
  exactStrongTypeRate: number;
  exactVerseCount: number;
  exactVerseRate: number;
}

export interface CalibrationBucket {
  label: string;
  minConfidence: number;
  maxConfidence: number;
  includesUpperBound: boolean;
  predictedCount: number;
  correctExactCarrierCount: number;
  averageConfidence: number;
  empiricalPrecision: number;
  calibrationGap: number;
}

export interface RiskCoveragePoint {
  minConfidence: number;
  selectedPredictionCount: number;
  totalPredictionCount: number;
  coverage: number;
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  precision: number;
  recall: number;
  f1: number;
  risk: number;
}

export interface ConfidenceEvaluation {
  expectedCalibrationError: number;
  buckets: CalibrationBucket[];
  riskCoverage: RiskCoveragePoint[];
}

export interface VerseEvaluation {
  ref: string;
  bookId: string;
  testament: "OT" | "NT";
  /** Legacy multiset metric, now explicitly named as inventory-only. */
  inventoryOccurrence: ScoreMetrics;
  /** Same Strong on exactly the same word/span/empty anchor. */
  carrierExact: SpanScoreMetrics;
  /** Same Strong on an overlapping visible span (empty still requires anchor). */
  carrierOverlap: SpanScoreMetrics;
  /** Same Strong classified as visible versus empty, ignoring carrier position. */
  visibilityClassification: ScoreMetrics;
  visibleCarrierExact: SpanScoreMetrics;
  emptyCarrierExact: ScoreMetrics;
  cardinality: CardinalityMetrics;
  confidence: ConfidenceEvaluation;
  predictionSources: PredictionSourceMetrics[];
  category: ErrorCategory;
}

export interface AggregateEvaluation {
  scope: string;
  verseCount: number;
  inventoryOccurrence: ScoreMetrics;
  carrierExact: SpanScoreMetrics;
  carrierOverlap: SpanScoreMetrics;
  visibilityClassification: ScoreMetrics;
  visibleCarrierExact: SpanScoreMetrics;
  emptyCarrierExact: ScoreMetrics;
  cardinality: CardinalityMetrics;
}

export interface EvaluationReport {
  generatedAt: string;
  gold: string;
  includeGoldReference: boolean;
  backend: {
    name: "diagnostic-alignReaderVerse" | "canonical-masked-ledger";
    canonicalLedger: boolean;
    description: string;
  };
  sampling: {
    strategy: "book-proportional-even-spread-v1";
    eligibleVerseCount: number;
    requestedLimit?: number;
    selectedVerseCount: number;
    selectedByBook: Array<{ bookId: string; verseCount: number }>;
  };
  verseCount: number;
  inventoryOccurrence: ScoreMetrics;
  carrierExact: SpanScoreMetrics;
  carrierOverlap: SpanScoreMetrics;
  visibilityClassification: ScoreMetrics;
  visibleCarrierExact: SpanScoreMetrics;
  emptyCarrierExact: ScoreMetrics;
  cardinality: CardinalityMetrics;
  confidence: ConfidenceEvaluation;
  predictionSources: PredictionSourceMetrics[];
  outputPath: string;
  references: Array<{ name: string; path: string; verses: number }>;
  originalSources: OriginalSourceSummary[];
  byBook: AggregateEvaluation[];
  byTestament: AggregateEvaluation[];
  worstBooks: AggregateEvaluation[];
  worstVerses: VerseEvaluation[];
  errorCategories: Array<{ category: ErrorCategory; verseCount: number }>;
}

export type ErrorCategory =
  | "carrier-exact-or-near-exact"
  | "wrong-carrier"
  | "under-tagging"
  | "over-tagging"
  | "mixed-density-mismatch"
  | "low-signal";

interface MatchResult {
  pairs: Array<{ predictedIndex: number; expectedIndex: number }>;
  matchedPredicted: Set<number>;
}

const REFERENCES = [
  { name: "Sg1910", path: "data/strongs/Sg1910.csv" },
  { name: "Darby", path: "data/strongs/Darby.csv" },
  { name: "DarbyR", path: "data/strongs/DarbyR.csv" }
];

/**
 * Return every correlated editorial witness that must be held out with the
 * selected gold edition. Darby and DarbyR are two renderings of the same
 * editorial family, so retaining either one would leak the gold annotations.
 */
export function excludedReferenceNamesForGold(
  gold: string,
  includeGoldReference: boolean
): string[] {
  if (includeGoldReference) return [];
  const goldFamily = editorialReferenceFamily(gold);
  return REFERENCES.filter(
    (reference) => editorialReferenceFamily(reference.name) === goldFamily
  ).map((reference) => reference.name);
}

function editorialReferenceFamily(name: string): string {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]+/gu, "");
  if (normalized.startsWith("darby")) return "Darby-family";
  return normalized;
}

const ORIGINAL_SOURCES = [
  {
    name: "STEP TAHOT Gen-Deu",
    path: "data/external/stepbible/amalgamated/TAHOT Gen-Deu.txt"
  },
  {
    name: "STEP TAHOT Jos-Est",
    path: "data/external/stepbible/amalgamated/TAHOT Jos-Est.txt"
  },
  {
    name: "STEP TAHOT Job-Sng",
    path: "data/external/stepbible/amalgamated/TAHOT Job-Sng.txt"
  },
  {
    name: "STEP TAHOT Isa-Mal",
    path: "data/external/stepbible/amalgamated/TAHOT Isa-Mal.txt"
  },
  {
    name: "STEP TAGNT Mat-Jhn",
    path: "data/external/stepbible/amalgamated/TAGNT Mat-Jhn.txt"
  },
  {
    name: "STEP TAGNT Act-Rev",
    path: "data/external/stepbible/amalgamated/TAGNT Act-Rev.txt"
  }
].map((source) => ({
  ...source,
  license: "CC BY 4.0 via Tyndale House Cambridge / STEPBible-Data",
  url: "https://github.com/STEPBible/STEPBible-Data"
}));

const CALIBRATION_BUCKETS = [
  { label: "[0.00,0.55)", min: 0, max: 0.55, includesUpperBound: false },
  { label: "[0.55,0.70)", min: 0.55, max: 0.7, includesUpperBound: false },
  { label: "[0.70,0.84)", min: 0.7, max: 0.84, includesUpperBound: false },
  { label: "[0.84,0.95)", min: 0.84, max: 0.95, includesUpperBound: false },
  { label: "[0.95,1.00]", min: 0.95, max: 1, includesUpperBound: true }
] as const;

const RISK_COVERAGE_THRESHOLDS = [0.95, 0.9, 0.84, 0.7, 0.55, 0];

export async function evaluateStrongGold(
  options: EvaluationOptions
): Promise<EvaluationReport> {
  const goldRows = await readStrongCsv(`data/strongs/${options.gold}.csv`);
  const goldMap = buildStrongVerseMap(goldRows);
  const excludedReferenceNames = new Set(
    excludedReferenceNamesForGold(options.gold, options.includeGoldReference)
  );
  const references = (await loadReferences()).filter(
    (reference) => !excludedReferenceNames.has(reference.name)
  );
  const originals = await loadOriginalSources();
  const verseEvaluations: VerseEvaluation[] = [];
  const eligibleRefs = [...goldMap.keys()].filter((ref) =>
    options.onlyRef ? refMatches(ref, options.onlyRef) : true
  );
  const selectedRefs = selectStratifiedRefs(eligibleRefs, options.limit);
  const backend = options.backend ?? "diagnostic";
  const canonicalPredictions =
    backend === "canonical"
      ? await maskedCanonicalPredictions({
          gold: options.gold,
          goldMap,
          selectedRefs,
          includeGoldReference: options.includeGoldReference
        })
      : undefined;
  const diagnostic =
    backend === "diagnostic"
      ? buildDiagnosticEvaluationContext(references, originals, options.gold)
      : undefined;

  for (const ref of selectedRefs) {
    const gold = goldMap.get(ref);
    if (!gold) continue;

    const [bookId, chapter, verse] = ref.split(".");
    if (!bookId || !chapter || !verse) continue;
    const predicted = canonicalPredictions
      ? (canonicalPredictions.get(ref) ?? [])
      : diagnosticPredictions(ref, gold.row.text, references, diagnostic!);

    verseEvaluations.push(
      scoreCarrierAwareVerse(
        ref,
        predicted,
        extractGoldCarrierPlacements(gold.row.text)
      )
    );
  }

  const totals = aggregate("all", verseEvaluations);
  const outputPath = path.join(
    options.outputDir,
    `strong-gold-eval-${options.gold}-${backend}.json`
  );
  const byBook = aggregateBy(verseEvaluations, (verse) => verse.bookId);
  const report: EvaluationReport = {
    generatedAt: new Date().toISOString(),
    gold: options.gold,
    includeGoldReference: options.includeGoldReference,
    backend: {
      name:
        backend === "canonical"
          ? "canonical-masked-ledger"
          : "diagnostic-alignReaderVerse",
      canonicalLedger: backend === "canonical",
      description:
        backend === "canonical"
          ? "Masked-gold evaluation through the canonical ledger generator, including lexical auto-safe, with curated overrides disabled and the gold reference excluded unless explicitly requested."
          : "Masked-gold evaluation through alignReaderVerse with STEP TAHOT/TAGNT originals and the production reader profile; this does not execute lexical auto-safe or write the canonical SQLite ledger."
    },
    sampling: {
      strategy: "book-proportional-even-spread-v1",
      eligibleVerseCount: eligibleRefs.length,
      requestedLimit: options.limit,
      selectedVerseCount: verseEvaluations.length,
      selectedByBook: countRefsByBook(selectedRefs)
    },
    verseCount: verseEvaluations.length,
    inventoryOccurrence: totals.inventoryOccurrence,
    carrierExact: totals.carrierExact,
    carrierOverlap: totals.carrierOverlap,
    visibilityClassification: totals.visibilityClassification,
    visibleCarrierExact: totals.visibleCarrierExact,
    emptyCarrierExact: totals.emptyCarrierExact,
    cardinality: totals.cardinality,
    confidence: aggregateConfidence(verseEvaluations),
    predictionSources: aggregatePredictionSources(verseEvaluations),
    outputPath,
    references: references.map((reference) => ({
      name: reference.name,
      path: reference.path,
      verses: reference.map.size
    })),
    originalSources: originals.map((original) => original.summary),
    byBook,
    byTestament: aggregateBy(verseEvaluations, (verse) => verse.testament),
    worstBooks: [...byBook]
      .filter((book) => book.verseCount >= 5)
      .sort(
        (left, right) =>
          left.carrierExact.f1 - right.carrierExact.f1 ||
          left.inventoryOccurrence.f1 - right.inventoryOccurrence.f1
      )
      .slice(0, 12),
    worstVerses: [...verseEvaluations]
      .sort(
        (left, right) =>
          left.carrierExact.f1 - right.carrierExact.f1 ||
          left.inventoryOccurrence.f1 - right.inventoryOccurrence.f1
      )
      .slice(0, 75),
    errorCategories: summarizeCategories(verseEvaluations)
  };

  await mkdir(options.outputDir, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  return report;
}

interface DiagnosticEvaluationContext {
  originalByRef: Map<string, OriginalBundleVerse>;
  lexicon: ReturnType<typeof buildStrongLexicon>;
  translationLexicon: ReturnType<typeof buildStrongTranslationLexicon>;
  phraseLexicon: ReturnType<typeof buildStrongPhraseLexicon>;
  readerPolicy: ReturnType<typeof getTranslationProfile>["readerAlignment"];
}

function buildDiagnosticEvaluationContext(
  references: ReferenceMap[],
  originals: OriginalBundle[],
  gold: string
): DiagnosticEvaluationContext {
  const dictionaryCandidates = readStrongDictionaryTranslationCandidates();
  return {
    originalByRef: mergeOriginalSources(originals),
    lexicon: buildStrongLexicon(references),
    translationLexicon: buildStrongTranslationLexicon(references, {
      dictionaryCandidates
    }),
    phraseLexicon: buildStrongPhraseLexicon(references),
    readerPolicy: getTranslationProfile(gold === "Sg1910" ? "nbs" : "fmar")
      .readerAlignment
  };
}

function diagnosticPredictions(
  ref: string,
  taggedGoldText: string,
  references: ReferenceMap[],
  context: DiagnosticEvaluationContext
): CarrierPlacement[] {
  const original = context.originalByRef.get(ref);
  const verseReferences: ReferenceSource[] = references.map((reference) => ({
    name: reference.name,
    verse: reference.map.get(ref)
  }));
  const result = alignReaderVerse({
    targetText: stripTags(taggedGoldText),
    references: verseReferences,
    lexicon: context.lexicon,
    originalVerse: original?.verse,
    translationLexicon: context.translationLexicon,
    phraseLexicon: context.phraseLexicon,
    original: original
      ? {
          strongSet: original.verse.strongSet,
          source: original.sourceNames.join("+")
        }
      : undefined,
    readerPolicy: context.readerPolicy
  });
  return placementsFromReaderResult(result);
}

async function maskedCanonicalPredictions(options: {
  gold: string;
  goldMap: StrongVerseMap;
  selectedRefs: string[];
  includeGoldReference: boolean;
}): Promise<Map<string, CarrierPlacement[]>> {
  const directory = await mkdtemp(
    path.join(tmpdir(), "strong-gold-canonical-")
  );
  const biblePath = path.join(directory, "masked-gold.json");
  const outputDir = path.join(directory, "ledger");
  try {
    const bible: Record<string, Record<string, Record<string, string>>> = {};
    for (const ref of options.selectedRefs) {
      const verse = options.goldMap.get(ref);
      if (!verse) continue;
      const bookNumber = String(
        BOOK_IDS.indexOf(verse.row.bookId as never) + 1
      );
      if (bookNumber === "0") continue;
      bible[bookNumber] ??= {};
      bible[bookNumber]![String(verse.row.chapter)] ??= {};
      bible[bookNumber]![String(verse.row.chapter)]![String(verse.row.verse)] =
        stripTags(verse.row.text);
    }
    await writeFile(biblePath, `${JSON.stringify(bible)}\n`, "utf8");
    const ledger = await generateStrongLedger({
      bible: `gold-eval-${options.gold.toLowerCase()}`,
      profileBible: options.gold === "Sg1910" ? "nbs" : "fmar",
      biblePath,
      outputDir,
      writeArtifacts: false,
      writeLexicalReport: false,
      applyCuratedOverrides: false,
      excludedReferenceNames: excludedReferenceNamesForGold(
        options.gold,
        options.includeGoldReference
      )
    });
    return new Map(
      ledger.verses.map((verse) => [
        verse.ref,
        placementsFromLedgerVerse(verse)
      ])
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export function placementsFromLedgerVerse(
  verse: StrongLedgerVerse
): CarrierPlacement[] {
  return verse.annotations
    .filter((annotation) => annotation.visibility === "reader")
    .map((annotation) => {
      if (annotation.placement === "word") {
        return {
          strong: annotation.strong,
          kind: "word" as const,
          startWordIndex: annotation.wordIndex,
          endWordIndex: annotation.wordIndex,
          confidence: annotation.confidence,
          source: `${annotation.source}:${annotation.diagnostics[0] ?? annotation.placement}`
        };
      }
      if (annotation.placement === "phrase") {
        return {
          strong: annotation.strong,
          kind: "phrase" as const,
          startWordIndex: annotation.startWordIndex,
          endWordIndex: annotation.endWordIndex,
          confidence: annotation.confidence,
          source: `${annotation.source}:${annotation.diagnostics[0] ?? annotation.placement}`
        };
      }
      return {
        strong: annotation.strong,
        kind: "empty" as const,
        insertAfterWordIndex: annotation.insertAfterWordIndex,
        confidence: annotation.confidence,
        source: `${annotation.source}:${annotation.diagnostics[0] ?? annotation.placement}`
      };
    });
}

/** Parse the gold markup into word, phrase, and empty Strong occurrences. */
export function extractGoldCarrierPlacements(
  taggedText: string
): CarrierPlacement[] {
  const placements: CarrierPlacement[] = [];
  const wordTagPattern = /<w\b([^>]*)>([\s\S]*?)<\/w>/giu;
  const plainText = stripTags(taggedText);
  const wordRanges = getWordRanges(plainText);
  let taggedCursor = 0;
  let plainOffset = 0;

  for (const match of taggedText.matchAll(wordTagPattern)) {
    const matchIndex = match.index ?? 0;
    plainOffset += stripTags(taggedText.slice(taggedCursor, matchIndex)).length;

    const strong = parseStrongAttribute(match[1] ?? "");
    const innerText = stripTags(match[2] ?? "");
    const carrierStart = plainOffset;
    const carrierEnd = carrierStart + innerText.length;
    const coveredWordIndexes = wordRanges.flatMap((range, wordIndex) =>
      rangesOverlap(carrierStart, carrierEnd, range.start, range.end)
        ? [wordIndex]
        : []
    );

    for (const strongCode of strong) {
      if (coveredWordIndexes.length === 0) {
        placements.push({
          strong: strongCode,
          kind: "empty",
          insertAfterWordIndex: findPrecedingWordIndex(wordRanges, carrierStart)
        });
      } else {
        const startWordIndex = coveredWordIndexes[0]!;
        const endWordIndex = coveredWordIndexes.at(-1)!;
        placements.push({
          strong: strongCode,
          kind: startWordIndex === endWordIndex ? "word" : "phrase",
          startWordIndex,
          endWordIndex
        });
      }
    }

    plainOffset = carrierEnd;
    taggedCursor = matchIndex + match[0].length;
  }

  return placements;
}

/** Convert every reader assignment, including phrases, to scored occurrences. */
export function placementsFromReaderResult(
  result: ReaderAlignmentResult
): CarrierPlacement[] {
  const placements: CarrierPlacement[] = [];

  for (const [wordIndex, assignment] of result.assignments) {
    for (const strong of assignment.strong) {
      placements.push({
        strong,
        kind: "word",
        startWordIndex: wordIndex,
        endWordIndex: wordIndex,
        confidence: assignment.confidence,
        source: assignment.method
      });
    }
  }

  for (const assignment of result.phraseAssignments) {
    for (const strong of assignment.strong) {
      placements.push({
        strong,
        kind: "phrase",
        startWordIndex: assignment.startWordIndex,
        endWordIndex: assignment.endWordIndex,
        confidence: assignment.confidence,
        source: assignment.method
      });
    }
  }

  for (const assignment of result.emptyAssignments) {
    placements.push({
      strong: assignment.strong,
      kind: "empty",
      insertAfterWordIndex: assignment.insertAfterWordIndex,
      confidence: assignment.confidence,
      source: assignment.method
    });
  }

  return placements;
}

export function scoreCarrierAwareVerse(
  ref: string,
  predicted: CarrierPlacement[],
  expected: CarrierPlacement[]
): VerseEvaluation {
  const inventoryMatch = maximumMatching(predicted, expected, sameStrong);
  const exactMatch = maximumMatching(predicted, expected, sameExactCarrier);
  const overlapMatch = maximumMatching(
    predicted,
    expected,
    sameOverlappingCarrier
  );
  const visibilityMatch = maximumMatching(
    predicted,
    expected,
    sameVisibilityClass
  );
  const visiblePredicted = predicted.filter(isVisiblePlacement);
  const visibleExpected = expected.filter(isVisiblePlacement);
  const visibleExactMatch = maximumMatching(
    visiblePredicted,
    visibleExpected,
    sameExactCarrier
  );
  const emptyPredicted = predicted.filter(isEmptyPlacement);
  const emptyExpected = expected.filter(isEmptyPlacement);
  const emptyExactMatch = maximumMatching(
    emptyPredicted,
    emptyExpected,
    sameExactCarrier
  );
  const inventoryOccurrence = metricsFromMatch(
    predicted.length,
    expected.length,
    inventoryMatch.pairs.length
  );
  const carrierExact = spanMetricsFromMatch(predicted, expected, exactMatch);
  const carrierOverlap = spanMetricsFromMatch(
    predicted,
    expected,
    overlapMatch
  );

  return {
    ref,
    bookId: ref.split(".")[0] ?? "unknown",
    testament: getTestament(ref),
    inventoryOccurrence,
    carrierExact,
    carrierOverlap,
    visibilityClassification: metricsFromMatch(
      predicted.length,
      expected.length,
      visibilityMatch.pairs.length
    ),
    visibleCarrierExact: spanMetricsFromMatch(
      visiblePredicted,
      visibleExpected,
      visibleExactMatch
    ),
    emptyCarrierExact: metricsFromMatch(
      emptyPredicted.length,
      emptyExpected.length,
      emptyExactMatch.pairs.length
    ),
    cardinality: scoreCardinality(predicted, expected),
    confidence: scoreConfidence(predicted, expected, exactMatch),
    predictionSources: scorePredictionSources(predicted, exactMatch),
    category: categorizeVerse({
      inventoryOccurrence,
      carrierExact
    })
  };
}

/**
 * Select a deterministic, book-stratified sample. Allocation is proportional
 * to book size (with one verse per book when the budget permits), and selected
 * verses are evenly spread through each book rather than taken from its start.
 */
export function selectStratifiedRefs(refs: string[], limit?: number): string[] {
  const canonicalRefs = [...new Set(refs)].sort(compareRefs);
  if (limit === undefined || limit >= canonicalRefs.length)
    return canonicalRefs;
  if (!Number.isFinite(limit) || limit <= 0) return [];

  const sampleSize = Math.min(canonicalRefs.length, Math.floor(limit));
  const byBook = new Map<string, string[]>();
  for (const ref of canonicalRefs) {
    const bookId = ref.split(".")[0] ?? "unknown";
    const group = byBook.get(bookId) ?? [];
    group.push(ref);
    byBook.set(bookId, group);
  }

  const groups = [...byBook.entries()]
    .map(([bookId, bookRefs]) => ({
      bookId,
      refs: bookRefs,
      allocation: 0,
      target: (sampleSize * bookRefs.length) / canonicalRefs.length
    }))
    .sort((left, right) => compareBooks(left.bookId, right.bookId));

  if (sampleSize >= groups.length) {
    for (const group of groups) group.allocation = 1;
  }

  let remaining =
    sampleSize - sumNumbers(groups.map((group) => group.allocation));
  while (remaining > 0) {
    const candidate = groups
      .filter((group) => group.allocation < group.refs.length)
      .sort(
        (left, right) =>
          right.target - right.allocation - (left.target - left.allocation) ||
          compareBooks(left.bookId, right.bookId)
      )[0];
    if (!candidate) break;
    candidate.allocation += 1;
    remaining -= 1;
  }

  return groups
    .flatMap((group) => evenlySpaced(group.refs, group.allocation))
    .sort(compareRefs);
}

function evenlySpaced(values: string[], count: number): string[] {
  if (count <= 0) return [];
  if (count >= values.length) return [...values];

  return Array.from({ length: count }, (_, index) => {
    const selectedIndex = Math.min(
      values.length - 1,
      Math.floor(((index + 0.5) * values.length) / count)
    );
    return values[selectedIndex]!;
  });
}

function sameStrong(
  predicted: CarrierPlacement,
  expected: CarrierPlacement
): boolean {
  return predicted.strong === expected.strong;
}

function sameExactCarrier(
  predicted: CarrierPlacement,
  expected: CarrierPlacement
): boolean {
  if (!sameStrong(predicted, expected)) return false;
  if (predicted.kind === "empty" || expected.kind === "empty") {
    return (
      predicted.kind === "empty" &&
      expected.kind === "empty" &&
      predicted.insertAfterWordIndex === expected.insertAfterWordIndex
    );
  }

  return (
    predicted.startWordIndex === expected.startWordIndex &&
    predicted.endWordIndex === expected.endWordIndex
  );
}

function sameOverlappingCarrier(
  predicted: CarrierPlacement,
  expected: CarrierPlacement
): boolean {
  if (!sameStrong(predicted, expected)) return false;
  if (predicted.kind === "empty" || expected.kind === "empty") {
    return sameExactCarrier(predicted, expected);
  }

  return spanIoU(predicted, expected) > 0;
}

function sameVisibilityClass(
  predicted: CarrierPlacement,
  expected: CarrierPlacement
): boolean {
  return (
    sameStrong(predicted, expected) &&
    (predicted.kind === "empty") === (expected.kind === "empty")
  );
}

function maximumMatching(
  predicted: CarrierPlacement[],
  expected: CarrierPlacement[],
  canMatch: (predicted: CarrierPlacement, expected: CarrierPlacement) => boolean
): MatchResult {
  const ownerByExpected = Array<number>(expected.length).fill(-1);
  const predictedOrder = predicted
    .map((placement, index) => ({
      index,
      confidence: normalizedConfidence(placement)
    }))
    .sort(
      (left, right) =>
        right.confidence - left.confidence || left.index - right.index
    )
    .map(({ index }) => index);

  const tryAssign = (
    predictedIndex: number,
    visitedExpected: Set<number>
  ): boolean => {
    for (
      let expectedIndex = 0;
      expectedIndex < expected.length;
      expectedIndex += 1
    ) {
      if (visitedExpected.has(expectedIndex)) continue;
      if (!canMatch(predicted[predictedIndex]!, expected[expectedIndex]!))
        continue;
      visitedExpected.add(expectedIndex);

      const currentOwner = ownerByExpected[expectedIndex]!;
      if (currentOwner === -1 || tryAssign(currentOwner, visitedExpected)) {
        ownerByExpected[expectedIndex] = predictedIndex;
        return true;
      }
    }

    return false;
  };

  for (const predictedIndex of predictedOrder) {
    tryAssign(predictedIndex, new Set<number>());
  }

  const pairs = ownerByExpected.flatMap((predictedIndex, expectedIndex) =>
    predictedIndex === -1 ? [] : [{ predictedIndex, expectedIndex }]
  );
  return {
    pairs,
    matchedPredicted: new Set(pairs.map((pair) => pair.predictedIndex))
  };
}

function metricsFromMatch(
  predictedCount: number,
  expectedCount: number,
  truePositive: number
): ScoreMetrics {
  const falsePositive = Math.max(0, predictedCount - truePositive);
  const falseNegative = Math.max(0, expectedCount - truePositive);
  const noSignal = predictedCount === 0 && expectedCount === 0;
  const precision = noSignal
    ? 1
    : truePositive / Math.max(1, truePositive + falsePositive);
  const recall = noSignal
    ? 1
    : truePositive / Math.max(1, truePositive + falseNegative);
  const f1 = harmonicMean(precision, recall);

  return {
    expectedCount,
    predictedCount,
    truePositive,
    falsePositive,
    falseNegative,
    precision: roundRatio(precision),
    recall: roundRatio(recall),
    f1: roundRatio(f1)
  };
}

function spanMetricsFromMatch(
  predicted: CarrierPlacement[],
  expected: CarrierPlacement[],
  match: MatchResult
): SpanScoreMetrics {
  const metrics = metricsFromMatch(
    predicted.length,
    expected.length,
    match.pairs.length
  );
  const visibleIou = match.pairs.flatMap((pair) => {
    const predictedPlacement = predicted[pair.predictedIndex]!;
    const expectedPlacement = expected[pair.expectedIndex]!;
    return isVisiblePlacement(predictedPlacement) &&
      isVisiblePlacement(expectedPlacement)
      ? [spanIoU(predictedPlacement, expectedPlacement)]
      : [];
  });

  return {
    ...metrics,
    matchedVisibleSpanCount: visibleIou.length,
    meanSpanIoU: roundRatio(average(visibleIou))
  };
}

function scoreCardinality(
  predicted: CarrierPlacement[],
  expected: CarrierPlacement[]
): CardinalityMetrics {
  const predictedCounts = countByStrong(predicted);
  const expectedCounts = countByStrong(expected);
  const strong = new Set([...predictedCounts.keys(), ...expectedCounts.keys()]);
  let absoluteOccurrenceError = 0;
  let exactStrongTypeCount = 0;

  for (const strongCode of strong) {
    const predictedCount = predictedCounts.get(strongCode) ?? 0;
    const expectedCount = expectedCounts.get(strongCode) ?? 0;
    absoluteOccurrenceError += Math.abs(predictedCount - expectedCount);
    if (predictedCount === expectedCount) exactStrongTypeCount += 1;
  }

  const exactVerse = absoluteOccurrenceError === 0;
  return {
    expectedCount: expected.length,
    predictedCount: predicted.length,
    absoluteOccurrenceError,
    comparedStrongTypeCount: strong.size,
    exactStrongTypeCount,
    exactStrongTypeRate: roundRatio(
      strong.size === 0 ? 1 : exactStrongTypeCount / strong.size
    ),
    exactVerseCount: exactVerse ? 1 : 0,
    exactVerseRate: exactVerse ? 1 : 0
  };
}

function scoreConfidence(
  predicted: CarrierPlacement[],
  expected: CarrierPlacement[],
  exactMatch = maximumMatching(predicted, expected, sameExactCarrier)
): ConfidenceEvaluation {
  const buckets = CALIBRATION_BUCKETS.map((definition) => {
    const indexes = predicted.flatMap((placement, index) => {
      const confidence = normalizedConfidence(placement);
      const withinUpper = definition.includesUpperBound
        ? confidence <= definition.max
        : confidence < definition.max;
      return confidence >= definition.min && withinUpper ? [index] : [];
    });
    const confidenceValues = indexes.map((index) =>
      normalizedConfidence(predicted[index]!)
    );
    const correctExactCarrierCount = indexes.filter((index) =>
      exactMatch.matchedPredicted.has(index)
    ).length;
    const empiricalPrecision =
      indexes.length === 0 ? 0 : correctExactCarrierCount / indexes.length;
    const averageConfidence = average(confidenceValues);

    return {
      label: definition.label,
      minConfidence: definition.min,
      maxConfidence: definition.max,
      includesUpperBound: definition.includesUpperBound,
      predictedCount: indexes.length,
      correctExactCarrierCount,
      averageConfidence: roundRatio(averageConfidence),
      empiricalPrecision: roundRatio(empiricalPrecision),
      calibrationGap: roundRatio(
        Math.abs(averageConfidence - empiricalPrecision)
      )
    };
  });
  const expectedCalibrationError = buckets.reduce(
    (total, bucket) =>
      total +
      (bucket.predictedCount / Math.max(1, predicted.length)) *
        bucket.calibrationGap,
    0
  );

  return {
    expectedCalibrationError: roundRatio(expectedCalibrationError),
    buckets,
    riskCoverage: RISK_COVERAGE_THRESHOLDS.map((minConfidence) => {
      const selected = predicted.filter(
        (placement) => normalizedConfidence(placement) >= minConfidence
      );
      const selectedMatch = maximumMatching(
        selected,
        expected,
        sameExactCarrier
      );
      const metrics = metricsFromMatch(
        selected.length,
        expected.length,
        selectedMatch.pairs.length
      );
      return {
        minConfidence,
        selectedPredictionCount: selected.length,
        totalPredictionCount: predicted.length,
        coverage: roundRatio(
          predicted.length === 0 ? 0 : selected.length / predicted.length
        ),
        truePositive: metrics.truePositive,
        falsePositive: metrics.falsePositive,
        falseNegative: metrics.falseNegative,
        precision: metrics.precision,
        recall: metrics.recall,
        f1: metrics.f1,
        risk: roundRatio(1 - metrics.precision)
      };
    })
  };
}

function scorePredictionSources(
  predicted: CarrierPlacement[],
  exactMatch: MatchResult
): PredictionSourceMetrics[] {
  const bySource = new Map<string, number[]>();
  for (let index = 0; index < predicted.length; index += 1) {
    const source = predicted[index]?.source ?? "unknown";
    const indexes = bySource.get(source) ?? [];
    indexes.push(index);
    bySource.set(source, indexes);
  }

  return [...bySource]
    .map(([source, indexes]) => {
      const correctExactCarrierCount = indexes.filter((index) =>
        exactMatch.matchedPredicted.has(index)
      ).length;
      return {
        source,
        predictedCount: indexes.length,
        correctExactCarrierCount,
        precision: roundRatio(correctExactCarrierCount / indexes.length),
        averageConfidence: roundRatio(
          average(
            indexes.map((index) => normalizedConfidence(predicted[index]!))
          )
        )
      };
    })
    .sort(
      (left, right) =>
        right.predictedCount - left.predictedCount ||
        left.source.localeCompare(right.source)
    );
}

function aggregateBy(
  verses: VerseEvaluation[],
  getScope: (verse: VerseEvaluation) => string
): AggregateEvaluation[] {
  const groups = new Map<string, VerseEvaluation[]>();

  for (const verse of verses) {
    const scope = getScope(verse);
    const group = groups.get(scope) ?? [];
    group.push(verse);
    groups.set(scope, group);
  }

  return [...groups]
    .map(([scope, group]) => aggregate(scope, group))
    .sort((left, right) => compareBooks(left.scope, right.scope));
}

function aggregate(
  scope: string,
  verses: VerseEvaluation[]
): AggregateEvaluation {
  return {
    scope,
    verseCount: verses.length,
    inventoryOccurrence: aggregateScore(
      verses.map((verse) => verse.inventoryOccurrence)
    ),
    carrierExact: aggregateSpanScore(verses.map((verse) => verse.carrierExact)),
    carrierOverlap: aggregateSpanScore(
      verses.map((verse) => verse.carrierOverlap)
    ),
    visibilityClassification: aggregateScore(
      verses.map((verse) => verse.visibilityClassification)
    ),
    visibleCarrierExact: aggregateSpanScore(
      verses.map((verse) => verse.visibleCarrierExact)
    ),
    emptyCarrierExact: aggregateScore(
      verses.map((verse) => verse.emptyCarrierExact)
    ),
    cardinality: aggregateCardinality(
      verses.map((verse) => verse.cardinality),
      verses.length
    )
  };
}

function aggregateScore(metrics: ScoreMetrics[]): ScoreMetrics {
  return metricsFromMatch(
    sumNumbers(metrics.map((metric) => metric.predictedCount)),
    sumNumbers(metrics.map((metric) => metric.expectedCount)),
    sumNumbers(metrics.map((metric) => metric.truePositive))
  );
}

function aggregateSpanScore(metrics: SpanScoreMetrics[]): SpanScoreMetrics {
  const score = aggregateScore(metrics);
  const matchedVisibleSpanCount = sumNumbers(
    metrics.map((metric) => metric.matchedVisibleSpanCount)
  );
  const iouSum = metrics.reduce(
    (total, metric) =>
      total + metric.meanSpanIoU * metric.matchedVisibleSpanCount,
    0
  );

  return {
    ...score,
    matchedVisibleSpanCount,
    meanSpanIoU: roundRatio(
      matchedVisibleSpanCount === 0 ? 0 : iouSum / matchedVisibleSpanCount
    )
  };
}

function aggregateCardinality(
  metrics: CardinalityMetrics[],
  verseCount: number
): CardinalityMetrics {
  const comparedStrongTypeCount = sumNumbers(
    metrics.map((metric) => metric.comparedStrongTypeCount)
  );
  const exactStrongTypeCount = sumNumbers(
    metrics.map((metric) => metric.exactStrongTypeCount)
  );
  const exactVerseCount = sumNumbers(
    metrics.map((metric) => metric.exactVerseCount)
  );

  return {
    expectedCount: sumNumbers(metrics.map((metric) => metric.expectedCount)),
    predictedCount: sumNumbers(metrics.map((metric) => metric.predictedCount)),
    absoluteOccurrenceError: sumNumbers(
      metrics.map((metric) => metric.absoluteOccurrenceError)
    ),
    comparedStrongTypeCount,
    exactStrongTypeCount,
    exactStrongTypeRate: roundRatio(
      comparedStrongTypeCount === 0
        ? 1
        : exactStrongTypeCount / comparedStrongTypeCount
    ),
    exactVerseCount,
    exactVerseRate: roundRatio(
      verseCount === 0 ? 1 : exactVerseCount / verseCount
    )
  };
}

function aggregateConfidence(verses: VerseEvaluation[]): ConfidenceEvaluation {
  const buckets = CALIBRATION_BUCKETS.map((definition, bucketIndex) => {
    const sourceBuckets = verses.map(
      (verse) => verse.confidence.buckets[bucketIndex]!
    );
    const predictedCount = sumNumbers(
      sourceBuckets.map((bucket) => bucket.predictedCount)
    );
    const correctExactCarrierCount = sumNumbers(
      sourceBuckets.map((bucket) => bucket.correctExactCarrierCount)
    );
    const confidenceSum = sourceBuckets.reduce(
      (total, bucket) =>
        total + bucket.averageConfidence * bucket.predictedCount,
      0
    );
    const averageConfidence =
      predictedCount === 0 ? 0 : confidenceSum / predictedCount;
    const empiricalPrecision =
      predictedCount === 0 ? 0 : correctExactCarrierCount / predictedCount;

    return {
      label: definition.label,
      minConfidence: definition.min,
      maxConfidence: definition.max,
      includesUpperBound: definition.includesUpperBound,
      predictedCount,
      correctExactCarrierCount,
      averageConfidence: roundRatio(averageConfidence),
      empiricalPrecision: roundRatio(empiricalPrecision),
      calibrationGap: roundRatio(
        Math.abs(averageConfidence - empiricalPrecision)
      )
    };
  });
  const totalPredictionCount = sumNumbers(
    buckets.map((bucket) => bucket.predictedCount)
  );
  const riskCoverage = RISK_COVERAGE_THRESHOLDS.map(
    (minConfidence, thresholdIndex) => {
      const points = verses.map(
        (verse) => verse.confidence.riskCoverage[thresholdIndex]!
      );
      const selectedPredictionCount = sumNumbers(
        points.map((point) => point.selectedPredictionCount)
      );
      const expectedCount = sumNumbers(
        points.map((point) => point.truePositive + point.falseNegative)
      );
      const truePositive = sumNumbers(
        points.map((point) => point.truePositive)
      );
      const metrics = metricsFromMatch(
        selectedPredictionCount,
        expectedCount,
        truePositive
      );

      return {
        minConfidence,
        selectedPredictionCount,
        totalPredictionCount,
        coverage: roundRatio(
          totalPredictionCount === 0
            ? 0
            : selectedPredictionCount / totalPredictionCount
        ),
        truePositive: metrics.truePositive,
        falsePositive: metrics.falsePositive,
        falseNegative: metrics.falseNegative,
        precision: metrics.precision,
        recall: metrics.recall,
        f1: metrics.f1,
        risk: roundRatio(1 - metrics.precision)
      };
    }
  );
  const expectedCalibrationError = buckets.reduce(
    (total, bucket) =>
      total +
      (bucket.predictedCount / Math.max(1, totalPredictionCount)) *
        bucket.calibrationGap,
    0
  );

  return {
    expectedCalibrationError: roundRatio(expectedCalibrationError),
    buckets,
    riskCoverage
  };
}

function aggregatePredictionSources(
  verses: VerseEvaluation[]
): PredictionSourceMetrics[] {
  const bySource = new Map<string, PredictionSourceMetrics[]>();
  for (const verse of verses) {
    for (const metrics of verse.predictionSources) {
      const items = bySource.get(metrics.source) ?? [];
      items.push(metrics);
      bySource.set(metrics.source, items);
    }
  }

  return [...bySource]
    .map(([source, items]) => {
      const predictedCount = sumNumbers(
        items.map((item) => item.predictedCount)
      );
      const correctExactCarrierCount = sumNumbers(
        items.map((item) => item.correctExactCarrierCount)
      );
      const confidenceSum = items.reduce(
        (total, item) => total + item.averageConfidence * item.predictedCount,
        0
      );
      return {
        source,
        predictedCount,
        correctExactCarrierCount,
        precision: roundRatio(
          correctExactCarrierCount / Math.max(1, predictedCount)
        ),
        averageConfidence: roundRatio(
          confidenceSum / Math.max(1, predictedCount)
        )
      };
    })
    .sort(
      (left, right) =>
        right.predictedCount - left.predictedCount ||
        left.source.localeCompare(right.source)
    );
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
  inventoryOccurrence: ScoreMetrics;
  carrierExact: ScoreMetrics;
}): ErrorCategory {
  if (options.carrierExact.f1 >= 0.985) {
    return "carrier-exact-or-near-exact";
  }
  if (
    options.inventoryOccurrence.f1 >= 0.9 &&
    options.carrierExact.f1 + 0.15 < options.inventoryOccurrence.f1
  ) {
    return "wrong-carrier";
  }
  if (
    options.carrierExact.predictedCount <= 2 &&
    options.carrierExact.expectedCount >= 6 &&
    options.carrierExact.recall < 0.6
  ) {
    return "low-signal";
  }
  if (
    options.carrierExact.falseNegative >=
      options.carrierExact.falsePositive * 2 &&
    options.carrierExact.recall < 0.9
  ) {
    return "under-tagging";
  }
  if (
    options.carrierExact.falsePositive >=
      options.carrierExact.falseNegative * 2 &&
    options.carrierExact.precision < 0.9
  ) {
    return "over-tagging";
  }

  return "mixed-density-mismatch";
}

function getWordRanges(text: string): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  let offset = 0;

  for (const segment of tokenizeText(text)) {
    const start = offset;
    offset += segment.text.length;
    if (segment.kind === "word") ranges.push({ start, end: offset });
  }

  return ranges;
}

function rangesOverlap(
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number
): boolean {
  return leftStart < rightEnd && rightStart < leftEnd;
}

function findPrecedingWordIndex(
  ranges: Array<{ start: number; end: number }>,
  offset: number
): number {
  let preceding = -1;
  for (let index = 0; index < ranges.length; index += 1) {
    if (ranges[index]!.end > offset) break;
    preceding = index;
  }
  return preceding;
}

function parseStrongAttribute(attributes: string): string[] {
  const match = attributes.match(/\bstrong=(["'])(.*?)\1/i);
  return (match?.[2] ?? "")
    .split(/\s+/)
    .map((strong) => strong.trim())
    .filter(Boolean);
}

function isVisiblePlacement(
  placement: CarrierPlacement
): placement is CarrierPlacement & {
  kind: "word" | "phrase";
  startWordIndex: number;
  endWordIndex: number;
} {
  return (
    placement.kind !== "empty" &&
    placement.startWordIndex !== undefined &&
    placement.endWordIndex !== undefined
  );
}

function isEmptyPlacement(
  placement: CarrierPlacement
): placement is CarrierPlacement & {
  kind: "empty";
  insertAfterWordIndex: number;
} {
  return placement.kind === "empty";
}

function spanIoU(left: CarrierPlacement, right: CarrierPlacement): number {
  if (!isVisiblePlacement(left) || !isVisiblePlacement(right)) return 0;
  const intersection = Math.max(
    0,
    Math.min(left.endWordIndex, right.endWordIndex) -
      Math.max(left.startWordIndex, right.startWordIndex) +
      1
  );
  const union =
    Math.max(left.endWordIndex, right.endWordIndex) -
    Math.min(left.startWordIndex, right.startWordIndex) +
    1;
  return union === 0 ? 0 : intersection / union;
}

function countByStrong(placements: CarrierPlacement[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const placement of placements) {
    counts.set(placement.strong, (counts.get(placement.strong) ?? 0) + 1);
  }
  return counts;
}

function countRefsByBook(
  refs: string[]
): Array<{ bookId: string; verseCount: number }> {
  const counts = new Map<string, number>();
  for (const ref of refs) {
    const bookId = ref.split(".")[0] ?? "unknown";
    counts.set(bookId, (counts.get(bookId) ?? 0) + 1);
  }
  return [...counts]
    .map(([bookId, verseCount]) => ({ bookId, verseCount }))
    .sort((left, right) => compareBooks(left.bookId, right.bookId));
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
      const map = (await readStepOriginalData([source.path])).verseMap;
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

function compareRefs(left: string, right: string): number {
  const [leftBook = "", leftChapter = "0", leftVerse = "0"] = left.split(".");
  const [rightBook = "", rightChapter = "0", rightVerse = "0"] =
    right.split(".");
  return (
    compareBooks(leftBook, rightBook) ||
    Number(leftChapter) - Number(rightChapter) ||
    Number(leftVerse) - Number(rightVerse) ||
    left.localeCompare(right)
  );
}

function compareBooks(left: string, right: string): number {
  const leftIndex = BOOK_IDS.indexOf(left as (typeof BOOK_IDS)[number]);
  const rightIndex = BOOK_IDS.indexOf(right as (typeof BOOK_IDS)[number]);
  if (leftIndex !== -1 && rightIndex !== -1) return leftIndex - rightIndex;
  if (leftIndex !== -1) return -1;
  if (rightIndex !== -1) return 1;
  return left.localeCompare(right);
}

function parseCliOptions(argv: string[]): EvaluationOptions {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg?.startsWith("--")) continue;
    const [key, inlineValue] = arg.slice(2).split("=", 2);
    if (!key) continue;
    if (key === "include-gold-reference") {
      args.set(key, inlineValue ?? "true");
      continue;
    }
    const value = inlineValue ?? argv[index + 1];
    if (inlineValue === undefined) index += 1;
    if (value) args.set(key, value);
  }

  return {
    gold: args.get("gold") ?? "Sg1910",
    onlyRef: args.get("only"),
    limit: args.has("limit")
      ? Number.parseInt(args.get("limit") ?? "", 10)
      : undefined,
    outputDir: args.get("output-dir") ?? "outputs",
    includeGoldReference: args.get("include-gold-reference") !== undefined,
    backend: args.get("backend") === "canonical" ? "canonical" : "diagnostic"
  };
}

function normalizedConfidence(placement: CarrierPlacement): number {
  const confidence = placement.confidence ?? 0;
  return Math.min(1, Math.max(0, confidence));
}

function harmonicMean(left: number, right: number): number {
  return left + right === 0 ? 0 : (2 * left * right) / (left + right);
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : sumNumbers(values) / values.length;
}

function sumNumbers(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function roundRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10_000) / 10_000;
}

export function isEvaluateStrongGoldMain(
  moduleUrl = import.meta.url,
  executablePath = process.argv[1]
): boolean {
  return (
    Boolean(executablePath) && moduleUrl === pathToFileURL(executablePath).href
  );
}

if (isEvaluateStrongGoldMain()) {
  const report = await evaluateStrongGold(
    parseCliOptions(process.argv.slice(2))
  );
  console.log(`Evaluated ${report.gold}: ${report.verseCount} verses`);
  console.log(
    `Carrier exact precision: ${report.carrierExact.precision}; recall: ${report.carrierExact.recall}; F1: ${report.carrierExact.f1}`
  );
  console.log(
    `Inventory-only precision: ${report.inventoryOccurrence.precision}; recall: ${report.inventoryOccurrence.recall}; F1: ${report.inventoryOccurrence.f1}`
  );
  console.log(`Wrote ${report.outputPath}`);
}
