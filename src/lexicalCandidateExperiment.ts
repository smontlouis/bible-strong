import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  type LexicalCandidate,
  type LexicalCandidateReport
} from "./lexicalCandidateReport.js";
import {
  type StrongLedger,
  type StrongLedgerAnnotation,
  type StrongLedgerMetrics,
  type StrongLedgerVerse,
  type StrongLedgerVerseMetrics
} from "./strongLedger.js";
import {
  readStrongLedgerSqlite,
  strongLedgerSqlitePath
} from "./strongLedgerStore.js";
import { escapeHtml, tokenizeText } from "./tokenize.js";

interface CliOptions {
  bible: string;
  ledgerPath: string;
  candidatesPath: string;
  outputPath: string;
  minScore: number;
  confidence: "high" | "medium" | "low";
  allowOccupied: boolean;
  maxPlacements?: number;
}

interface ExperimentAnnotation extends StrongLedgerAnnotation {
  experiment?: {
    type: "lexical-candidate";
    candidateScore: number;
    candidateConfidence: string;
    candidateLemma: string;
    evidence: Array<{ source: string; detail: string; weight: number }>;
  };
}

type ExperimentVerse = Omit<StrongLedgerVerse, "annotations"> & {
  annotations: ExperimentAnnotation[];
  metrics: StrongLedgerVerseMetrics & ExperimentVerseMetrics;
};

interface ExperimentVerseMetrics {
  lexicalExperimentPlacedCount: number;
  lexicalExperimentHighCount: number;
  lexicalExperimentMediumCount: number;
  lexicalExperimentOccupiedCount: number;
}

interface ExperimentMetrics {
  lexicalExperimentPlacedCount: number;
  lexicalExperimentHighCount: number;
  lexicalExperimentMediumCount: number;
  lexicalExperimentOccupiedCount: number;
}

interface ExperimentResult {
  ledger: StrongLedger & {
    experiment: {
      type: "lexical-candidate-placement";
      candidateReport: string;
      minScore: number;
      confidence: string;
      allowOccupied: boolean;
      placedCount: number;
    };
    metrics: StrongLedgerMetrics & ExperimentMetrics;
    verses: ExperimentVerse[];
  };
  placed: number;
}

const CONFIDENCE_ORDER = {
  low: 1,
  medium: 2,
  high: 3
} as const;

export async function applyLexicalCandidateExperiment(
  options: CliOptions
): Promise<ExperimentResult> {
  const ledger = options.ledgerPath.endsWith(".sqlite")
    ? readStrongLedgerSqlite({ sqlitePath: options.ledgerPath })
    : (JSON.parse(await readFile(options.ledgerPath, "utf8")) as StrongLedger);
  const report = JSON.parse(
    await readFile(options.candidatesPath, "utf8")
  ) as LexicalCandidateReport;
  const candidateByAnnotation = buildCandidateIndex(report, options);
  let placed = 0;

  const verses = ledger.verses.map((verse) => {
    const occupiedWordIndexes = buildOccupiedWordIndex(verse);
    const annotations = verse.annotations.map((annotation) => {
      const key = candidateKey(verse.ref, annotation.strong);
      const candidate = candidateByAnnotation.get(key);
      if (
        !candidate ||
        placed >= (options.maxPlacements ?? Number.MAX_SAFE_INTEGER) ||
        !isPlaceableEmpty(annotation) ||
        (!options.allowOccupied && occupiedWordIndexes.has(candidate.wordIndex))
      ) {
        return annotation as ExperimentAnnotation;
      }

      placed += 1;
      occupiedWordIndexes.add(candidate.wordIndex);
      return applyCandidate(annotation, candidate);
    });

    return rebuildVerse({ ...verse, annotations });
  });

  const metrics = aggregateExperimentMetrics(
    {
      ...ledger.metrics,
      lexicalExperimentPlacedCount: 0,
      lexicalExperimentHighCount: 0,
      lexicalExperimentMediumCount: 0,
      lexicalExperimentOccupiedCount: 0
    } as StrongLedgerMetrics & ExperimentMetrics,
    verses
  );

  return {
    placed,
    ledger: {
      ...ledger,
      generatedAt: new Date().toISOString(),
      experiment: {
        type: "lexical-candidate-placement",
        candidateReport: options.candidatesPath,
        minScore: options.minScore,
        confidence: options.confidence,
        allowOccupied: options.allowOccupied,
        placedCount: placed
      },
      metrics,
      verses
    }
  };
}

export async function writeLexicalCandidateExperiment(
  result: ExperimentResult,
  outputPath: string
): Promise<void> {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify(result.ledger, null, 2)}\n`,
    "utf8"
  );
}

function buildCandidateIndex(
  report: LexicalCandidateReport,
  options: CliOptions
): Map<string, LexicalCandidate> {
  const candidates = new Map<string, LexicalCandidate>();

  for (const item of report.items) {
    const best = item.candidates.find(
      (candidate) =>
        candidate.score >= options.minScore &&
        CONFIDENCE_ORDER[candidate.confidence] >=
          CONFIDENCE_ORDER[options.confidence] &&
        (options.allowOccupied || !candidate.occupied)
    );
    if (best) {
      candidates.set(candidateKey(item.ref, item.strong), best);
    }
  }

  return candidates;
}

function candidateKey(ref: string, strong: string): string {
  return `${ref}:${strong}`;
}

function isPlaceableEmpty(annotation: StrongLedgerAnnotation): boolean {
  return (
    annotation.visibility === "advanced" &&
    annotation.placement === "empty" &&
    annotation.lexiconLookup !== false
  );
}

function buildOccupiedWordIndex(verse: StrongLedgerVerse): Set<number> {
  const occupied = new Set<number>();
  for (const annotation of verse.annotations) {
    if (annotation.visibility !== "reader") continue;
    if (annotation.placement === "word" && annotation.wordIndex !== undefined) {
      occupied.add(annotation.wordIndex);
    }
    if (
      annotation.placement === "phrase" &&
      annotation.startWordIndex !== undefined &&
      annotation.endWordIndex !== undefined
    ) {
      for (
        let index = annotation.startWordIndex;
        index <= annotation.endWordIndex;
        index += 1
      ) {
        occupied.add(index);
      }
    }
  }
  return occupied;
}

function applyCandidate(
  annotation: StrongLedgerAnnotation,
  candidate: LexicalCandidate
): ExperimentAnnotation {
  return {
    ...annotation,
    visibility: "reader",
    placement: "word",
    source: "semantic-lexicon",
    confidence: Math.max(
      annotation.confidence,
      Math.min(0.86, candidate.score)
    ),
    reason:
      "Visible in lexical experiment because external lexical sources suggested this French carrier. This is not production placement.",
    diagnostics: [
      ...new Set([
        ...annotation.diagnostics,
        "lexical-candidate-experiment",
        ...candidate.evidence.map((evidence) => evidence.source)
      ])
    ],
    wordIndex: candidate.wordIndex,
    normalizedWord: candidate.normalized,
    insertAfterWordIndex: undefined,
    experiment: {
      type: "lexical-candidate",
      candidateScore: candidate.score,
      candidateConfidence: candidate.confidence,
      candidateLemma: candidate.lemma,
      evidence: candidate.evidence
    }
  };
}

function rebuildVerse(
  verse: StrongLedgerVerse & { annotations: ExperimentAnnotation[] }
): ExperimentVerse {
  const metrics = calculateVerseMetrics(verse);
  return {
    ...verse,
    inventories: {
      ...verse.inventories,
      reader: verse.annotations
        .filter((annotation) => annotation.visibility === "reader")
        .map((annotation) => annotation.strong),
      advanced: verse.annotations
        .filter((annotation) =>
          ["reader", "advanced"].includes(annotation.visibility)
        )
        .map((annotation) => annotation.strong)
    },
    metrics,
    views: {
      ...verse.views,
      readerHtml: renderVerseHtml(verse, "reader"),
      advancedHtml: renderVerseHtml(verse, "advanced"),
      debugHtml: renderVerseHtml(verse, "debug")
    }
  };
}

function calculateVerseMetrics(
  verse: StrongLedgerVerse & { annotations: ExperimentAnnotation[] }
): StrongLedgerVerseMetrics & ExperimentVerseMetrics {
  const readerAnnotations = verse.annotations.filter(
    (annotation) => annotation.visibility === "reader"
  );
  const advancedVisible = verse.annotations.filter((annotation) =>
    ["reader", "advanced"].includes(annotation.visibility)
  );
  const advancedCarriers = advancedVisible.filter((annotation) =>
    ["word", "phrase"].includes(annotation.placement)
  );
  const referenceInventory = collapseReferenceInventories(
    verse.inventories.references
  );
  const originalInventory = verse.inventories.original;
  const experimentAnnotations = readerAnnotations.filter(
    isExperimentAnnotation
  );
  const readerTaggedTokenCount = countTaggedTokens(readerAnnotations);
  const placementRiskCount =
    countMultiStrongReaderWords(readerAnnotations) +
    countOverBudgetStrong(readerAnnotations, [
      ...referenceInventory,
      ...originalInventory
    ]);

  return {
    wordCount: verse.tokens.length,
    readerVisibleStrongCount: readerAnnotations.length,
    advancedStrongCount: advancedVisible.length,
    emptyStrongCount: advancedVisible.filter((annotation) =>
      ["empty", "technical", "not-rendered"].includes(annotation.placement)
    ).length,
    phraseStrongCount: advancedVisible.filter(
      (annotation) => annotation.placement === "phrase"
    ).length,
    technicalStrongCount: advancedVisible.filter(
      (annotation) => annotation.placement === "technical"
    ).length,
    pendingHumanCount: verse.annotations.filter(
      (annotation) => annotation.visibility === "pending"
    ).length,
    rejectedCount: verse.annotations.filter(
      (annotation) => annotation.visibility === "rejected"
    ).length,
    referenceStrongOccurrenceCount: referenceInventory.length,
    referenceStrongRepresentedCount: countRepresentedOccurrences(
      referenceInventory,
      advancedVisible.map((annotation) => annotation.strong)
    ),
    referenceStrongCoverage: ratio(
      countRepresentedOccurrences(
        referenceInventory,
        advancedVisible.map((annotation) => annotation.strong)
      ),
      referenceInventory.length
    ),
    referenceStrongCarrierCount: countRepresentedOccurrences(
      referenceInventory,
      advancedCarriers.map((annotation) => annotation.strong)
    ),
    referenceStrongCarrierCoverage: ratio(
      countRepresentedOccurrences(
        referenceInventory,
        advancedCarriers.map((annotation) => annotation.strong)
      ),
      referenceInventory.length
    ),
    originalStrongOccurrenceCount: originalInventory.length,
    originalRepresentedStrongOccurrenceCount: countRepresentedOccurrences(
      originalInventory,
      advancedVisible.map((annotation) => annotation.strong)
    ),
    originalRepresentationRate: ratio(
      countRepresentedOccurrences(
        originalInventory,
        advancedVisible.map((annotation) => annotation.strong)
      ),
      originalInventory.length
    ),
    originalStrongCarrierCount: countRepresentedOccurrences(
      originalInventory,
      advancedCarriers.map((annotation) => annotation.strong)
    ),
    originalStrongCarrierRate: ratio(
      countRepresentedOccurrences(
        originalInventory,
        advancedCarriers.map((annotation) => annotation.strong)
      ),
      originalInventory.length
    ),
    semanticMissingCount: Math.max(
      0,
      referenceInventory.length -
        countRepresentedOccurrences(
          referenceInventory,
          advancedVisible.map((annotation) => annotation.strong)
        )
    ),
    readerMultiStrongWordCount: countMultiStrongReaderWords(readerAnnotations),
    readerOverBudgetStrongCount: countOverBudgetStrong(readerAnnotations, [
      ...referenceInventory,
      ...originalInventory
    ]),
    placementRiskCount,
    placementQuality: ratio(
      readerTaggedTokenCount - placementRiskCount,
      readerTaggedTokenCount
    ),
    readerTaggedTokenCount,
    advancedTaggedTokenCount: countTaggedTokens(advancedVisible),
    readerTokenCoverage: ratio(readerTaggedTokenCount, verse.tokens.length),
    advancedTokenCoverage: ratio(
      countTaggedTokens(advancedVisible),
      verse.tokens.length
    ),
    lexicalExperimentPlacedCount: experimentAnnotations.length,
    lexicalExperimentHighCount: experimentAnnotations.filter(
      (annotation) => annotation.experiment?.candidateConfidence === "high"
    ).length,
    lexicalExperimentMediumCount: experimentAnnotations.filter(
      (annotation) => annotation.experiment?.candidateConfidence === "medium"
    ).length,
    lexicalExperimentOccupiedCount: experimentAnnotations.filter((annotation) =>
      isWordOccupied(
        {
          ...verse,
          annotations: verse.annotations.filter((item) => item !== annotation)
        },
        annotation.wordIndex ?? -1
      )
    ).length
  };
}

function isExperimentAnnotation(
  annotation: ExperimentAnnotation
): annotation is ExperimentAnnotation & {
  experiment: NonNullable<ExperimentAnnotation["experiment"]>;
} {
  return annotation.experiment?.type === "lexical-candidate";
}

function aggregateExperimentMetrics(
  base: StrongLedgerMetrics & ExperimentMetrics,
  verses: ExperimentVerse[]
): StrongLedgerMetrics & ExperimentMetrics {
  const metrics = {
    ...base,
    lexicalExperimentPlacedCount: 0,
    lexicalExperimentHighCount: 0,
    lexicalExperimentMediumCount: 0,
    lexicalExperimentOccupiedCount: 0,
    verseCount: 0,
    wordCount: 0,
    readerVisibleStrongCount: 0,
    advancedStrongCount: 0,
    emptyStrongCount: 0,
    phraseStrongCount: 0,
    technicalStrongCount: 0,
    pendingHumanCount: 0,
    rejectedCount: 0,
    referenceStrongOccurrenceCount: 0,
    referenceStrongRepresentedCount: 0,
    referenceStrongCarrierCount: 0,
    originalStrongOccurrenceCount: 0,
    originalRepresentedStrongOccurrenceCount: 0,
    originalStrongCarrierCount: 0,
    semanticMissingCount: 0,
    readerMultiStrongWordCount: 0,
    readerOverBudgetStrongCount: 0,
    placementRiskCount: 0,
    readerTaggedTokenCount: 0,
    advancedTaggedTokenCount: 0
  };

  for (const verse of verses) {
    metrics.verseCount += 1;
    metrics.wordCount += verse.metrics.wordCount;
    metrics.readerVisibleStrongCount += verse.metrics.readerVisibleStrongCount;
    metrics.advancedStrongCount += verse.metrics.advancedStrongCount;
    metrics.emptyStrongCount += verse.metrics.emptyStrongCount;
    metrics.phraseStrongCount += verse.metrics.phraseStrongCount;
    metrics.technicalStrongCount += verse.metrics.technicalStrongCount;
    metrics.pendingHumanCount += verse.metrics.pendingHumanCount;
    metrics.rejectedCount += verse.metrics.rejectedCount;
    metrics.referenceStrongOccurrenceCount +=
      verse.metrics.referenceStrongOccurrenceCount;
    metrics.referenceStrongRepresentedCount +=
      verse.metrics.referenceStrongRepresentedCount;
    metrics.referenceStrongCarrierCount +=
      verse.metrics.referenceStrongCarrierCount;
    metrics.originalStrongOccurrenceCount +=
      verse.metrics.originalStrongOccurrenceCount;
    metrics.originalRepresentedStrongOccurrenceCount +=
      verse.metrics.originalRepresentedStrongOccurrenceCount;
    metrics.originalStrongCarrierCount +=
      verse.metrics.originalStrongCarrierCount;
    metrics.semanticMissingCount += verse.metrics.semanticMissingCount;
    metrics.readerMultiStrongWordCount +=
      verse.metrics.readerMultiStrongWordCount;
    metrics.readerOverBudgetStrongCount +=
      verse.metrics.readerOverBudgetStrongCount;
    metrics.placementRiskCount += verse.metrics.placementRiskCount;
    metrics.readerTaggedTokenCount += verse.metrics.readerTaggedTokenCount;
    metrics.advancedTaggedTokenCount += verse.metrics.advancedTaggedTokenCount;
    metrics.lexicalExperimentPlacedCount +=
      verse.metrics.lexicalExperimentPlacedCount;
    metrics.lexicalExperimentHighCount +=
      verse.metrics.lexicalExperimentHighCount;
    metrics.lexicalExperimentMediumCount +=
      verse.metrics.lexicalExperimentMediumCount;
    metrics.lexicalExperimentOccupiedCount +=
      verse.metrics.lexicalExperimentOccupiedCount;
  }

  return {
    ...metrics,
    referenceStrongCoverage: ratio(
      metrics.referenceStrongRepresentedCount,
      metrics.referenceStrongOccurrenceCount
    ),
    referenceStrongCarrierCoverage: ratio(
      metrics.referenceStrongCarrierCount,
      metrics.referenceStrongOccurrenceCount
    ),
    originalRepresentationRate: ratio(
      metrics.originalRepresentedStrongOccurrenceCount,
      metrics.originalStrongOccurrenceCount
    ),
    originalStrongCarrierRate: ratio(
      metrics.originalStrongCarrierCount,
      metrics.originalStrongOccurrenceCount
    ),
    readerTokenCoverage: ratio(
      metrics.readerTaggedTokenCount,
      metrics.wordCount
    ),
    advancedTokenCoverage: ratio(
      metrics.advancedTaggedTokenCount,
      metrics.wordCount
    ),
    placementQuality: ratio(
      metrics.readerTaggedTokenCount - metrics.placementRiskCount,
      metrics.readerTaggedTokenCount
    )
  };
}

function renderVerseHtml(
  verse: StrongLedgerVerse & { annotations: ExperimentAnnotation[] },
  mode: "reader" | "advanced" | "debug"
): string {
  const visible = verse.annotations.filter((annotation) =>
    mode === "reader"
      ? annotation.visibility === "reader"
      : ["reader", "advanced"].includes(annotation.visibility)
  );
  const wordAnnotations = groupByWord(
    visible.filter((annotation) => annotation.placement === "word")
  );
  const phraseStarts = buildPhraseStartMap(
    visible.filter((annotation) => annotation.placement === "phrase")
  );
  const emptyAfter = groupEmptyAfter(
    visible.filter((annotation) =>
      ["empty", "technical", "not-rendered"].includes(annotation.placement)
    )
  );
  let output = "";
  let wordIndex = 0;
  let activePhrase:
    | { endWordIndex: number; annotations: ExperimentAnnotation[] }
    | undefined;

  for (const segment of tokenizeText(verse.text)) {
    if (segment.kind === "text") {
      output += escapeHtml(segment.text);
      continue;
    }

    const phrase = phraseStarts.get(wordIndex);
    if (phrase) {
      activePhrase = phrase;
      output += openStrongTag(phrase.annotations);
    }

    const annotations = activePhrase
      ? []
      : (wordAnnotations.get(wordIndex) ?? []);
    if (annotations.length > 0) output += openStrongTag(annotations);
    output += escapeHtml(segment.text);
    if (annotations.length > 0) output += "</w>";
    if (activePhrase && wordIndex === activePhrase.endWordIndex) {
      output += "</w>";
      activePhrase = undefined;
    }

    for (const empty of emptyAfter.get(wordIndex) ?? []) {
      output += openStrongTag([empty]) + "</w>";
    }

    wordIndex += 1;
  }

  return output;
}

function openStrongTag(annotations: ExperimentAnnotation[]): string {
  const strong = annotations.map((annotation) => annotation.strong).join(" ");
  const sourceStrong = uniqueStrings(
    annotations.flatMap((annotation) => annotation.sourceStrong ?? [])
  ).join(" ");
  const stepStrong = uniqueStrings(
    annotations.flatMap(
      (annotation) => annotation.step?.map((evidence) => evidence.dStrong) ?? []
    )
  ).join(" ");
  const lexicalStrong = annotations
    .map((annotation) => annotation.strong)
    .join(" ");
  const confidence = Math.max(
    ...annotations.map((annotation) => annotation.confidence)
  );
  const source = [
    ...new Set(annotations.map((annotation) => annotation.source))
  ].join("+");
  const placement = [
    ...new Set(annotations.map((annotation) => annotation.placement))
  ].join("+");
  const reason = annotations[0]?.reason ?? "";
  const experiment = annotations.some(
    (annotation) => annotation.experiment?.type === "lexical-candidate"
  );

  return `<w strong="${escapeHtml(strong)}" data-lexical-strong="${escapeHtml(
    lexicalStrong
  )}"${sourceStrong ? ` data-source-strong="${escapeHtml(sourceStrong)}"` : ""}${stepStrong ? ` data-step-strong="${escapeHtml(stepStrong)}"` : ""} data-confidence="${confidence.toFixed(2)}" data-source="${escapeHtml(
    source
  )}" data-method="${escapeHtml(source)}" data-placement="${escapeHtml(
    placement
  )}" data-reason="${escapeHtml(reason)}"${experiment ? ' data-experiment="lexical-candidate"' : ""}>`;
}

function groupByWord(
  annotations: ExperimentAnnotation[]
): Map<number, ExperimentAnnotation[]> {
  const grouped = new Map<number, ExperimentAnnotation[]>();
  for (const annotation of annotations) {
    if (annotation.wordIndex === undefined) continue;
    const items = grouped.get(annotation.wordIndex) ?? [];
    items.push(annotation);
    grouped.set(annotation.wordIndex, items);
  }
  return grouped;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function buildPhraseStartMap(
  annotations: ExperimentAnnotation[]
): Map<number, { endWordIndex: number; annotations: ExperimentAnnotation[] }> {
  const starts = new Map<
    number,
    { endWordIndex: number; annotations: ExperimentAnnotation[] }
  >();
  for (const annotation of annotations) {
    if (
      annotation.startWordIndex === undefined ||
      annotation.endWordIndex === undefined
    ) {
      continue;
    }
    const existing = starts.get(annotation.startWordIndex);
    starts.set(annotation.startWordIndex, {
      endWordIndex: Math.max(
        existing?.endWordIndex ?? annotation.endWordIndex,
        annotation.endWordIndex
      ),
      annotations: [...(existing?.annotations ?? []), annotation]
    });
  }
  return starts;
}

function groupEmptyAfter(
  annotations: ExperimentAnnotation[]
): Map<number, ExperimentAnnotation[]> {
  const grouped = new Map<number, ExperimentAnnotation[]>();
  for (const annotation of annotations) {
    const index = annotation.insertAfterWordIndex ?? -1;
    const items = grouped.get(index) ?? [];
    items.push(annotation);
    grouped.set(index, items);
  }
  return grouped;
}

function isWordOccupied(
  verse: { annotations: ExperimentAnnotation[] | StrongLedgerAnnotation[] },
  wordIndex: number
): boolean {
  return verse.annotations.some(
    (annotation) =>
      annotation.visibility === "reader" &&
      annotation.placement === "word" &&
      annotation.wordIndex === wordIndex
  );
}

function collapseReferenceInventories(
  inventories: Record<string, string[]>
): string[] {
  const countsByReference = Object.values(inventories).map(countByStrong);
  const strongSet = new Set(
    countsByReference.flatMap((counts) => [...counts.keys()])
  );
  const collapsed: string[] = [];
  for (const strong of strongSet) {
    const expectedCount = Math.max(
      ...countsByReference.map((counts) => counts.get(strong) ?? 0)
    );
    for (let index = 0; index < expectedCount; index += 1) {
      collapsed.push(strong);
    }
  }
  return collapsed;
}

function countByStrong(strongCodes: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const strong of strongCodes) {
    counts.set(strong, (counts.get(strong) ?? 0) + 1);
  }
  return counts;
}

function countRepresentedOccurrences(
  expected: string[],
  actual: string[]
): number {
  const actualCounts = countByStrong(actual);
  let represented = 0;
  for (const [strong, expectedCount] of countByStrong(expected)) {
    represented += Math.min(expectedCount, actualCounts.get(strong) ?? 0);
  }
  return represented;
}

function countOverBudgetStrong(
  annotations: ExperimentAnnotation[],
  expected: string[]
): number {
  const actualCounts = countByStrong(
    annotations.map((annotation) => annotation.strong)
  );
  const expectedCounts = countByStrong(expected);
  let overBudget = 0;
  for (const [strong, actualCount] of actualCounts) {
    overBudget += Math.max(0, actualCount - (expectedCounts.get(strong) ?? 0));
  }
  return overBudget;
}

function countMultiStrongReaderWords(
  annotations: ExperimentAnnotation[]
): number {
  const countsByWord = new Map<number, number>();
  for (const annotation of annotations) {
    if (annotation.placement !== "word" || annotation.wordIndex === undefined) {
      continue;
    }
    countsByWord.set(
      annotation.wordIndex,
      (countsByWord.get(annotation.wordIndex) ?? 0) + 1
    );
  }
  return [...countsByWord.values()].filter((count) => count > 1).length;
}

function countTaggedTokens(annotations: ExperimentAnnotation[]): number {
  const indexes = new Set<number>();
  for (const annotation of annotations) {
    if (annotation.placement === "word" && annotation.wordIndex !== undefined) {
      indexes.add(annotation.wordIndex);
    }
    if (
      annotation.placement === "phrase" &&
      annotation.startWordIndex !== undefined &&
      annotation.endWordIndex !== undefined
    ) {
      for (
        let index = annotation.startWordIndex;
        index <= annotation.endWordIndex;
        index += 1
      ) {
        indexes.add(index);
      }
    }
  }
  return indexes.size;
}

function ratio(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 10000) / 10000 : 0;
}

function parseCliOptions(argv: string[]): CliOptions {
  const bible = readOption(argv, "--bible") ?? "nbs";
  const ledgerPath =
    readOption(argv, "--ledger") ??
    strongLedgerSqlitePath(path.join("outputs", "strong", bible), bible);
  const candidatesPath =
    readOption(argv, "--candidates") ??
    path.join(
      "outputs",
      "lexical-candidates",
      bible,
      `bible-${bible}-lexical-candidates-Gen.1-Gen.6.json`
    );
  return {
    bible,
    ledgerPath,
    candidatesPath,
    outputPath:
      readOption(argv, "--output") ??
      path.join(
        "outputs",
        "strong",
        bible,
        `bible-${bible}-strong-ledger.lexical-experiment.json`
      ),
    minScore: Number(readOption(argv, "--min-score") ?? 0.72),
    confidence: readConfidence(readOption(argv, "--confidence") ?? "high"),
    allowOccupied: readBooleanOption(argv, "--allow-occupied", false),
    maxPlacements: readOption(argv, "--max-placements")
      ? Number(readOption(argv, "--max-placements"))
      : undefined
  };
}

function readConfidence(value: string): "high" | "medium" | "low" {
  return value === "medium" || value === "low" ? value : "high";
}

function readOption(argv: string[], name: string): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === name) return argv[index + 1];
    if (arg?.startsWith(`${name}=`)) return arg.slice(name.length + 1);
  }
  return undefined;
}

function readBooleanOption(
  argv: string[],
  name: string,
  fallback: boolean
): boolean {
  const value = readOption(argv, name);
  if (value === undefined) return argv.includes(name) ? true : fallback;
  return value !== "false";
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const result = await applyLexicalCandidateExperiment(options);
  await writeLexicalCandidateExperiment(result, options.outputPath);
  console.log(`Lexical experiment ledger: ${options.outputPath}`);
  console.log(`Placed ${result.placed} lexical candidates`);
  console.log(
    `Reference carriers: ${result.ledger.metrics.referenceStrongCarrierCount}/${result.ledger.metrics.referenceStrongOccurrenceCount}`
  );
  console.log(
    `Original carriers: ${result.ledger.metrics.originalStrongCarrierCount}/${result.ledger.metrics.originalStrongOccurrenceCount}`
  );
}

if (
  process.argv[1]
    ?.replaceAll("\\", "/")
    .endsWith("src/lexicalCandidateExperiment.ts")
) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
