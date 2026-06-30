import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { readBibleJson } from "./bibleJson.js";
import { BOOK_IDS } from "./books.js";
import {
  generateStrongLedger,
  type StrongLedger,
  type StrongLedgerMetrics
} from "./strongLedger.js";
import {
  readStrongLedgerSqlite,
  strongLedgerSqlitePath
} from "./strongLedgerStore.js";
import {
  HIGH_CONFIDENCE_THRESHOLD,
  type LexicalCandidate,
  type LexicalCandidateItem,
  type LexicalCandidateReport
} from "./lexicalCandidateReport.js";

const DEFAULT_BIBLE = "nbs";
const DEFAULT_SEED = "nbs-strong-audit-2026-06-25";
const DEFAULT_BOOK_COUNT = 10;
const DEFAULT_CHAPTERS_PER_BOOK = 5;
const DEFAULT_OUTPUT_DIR = path.join("outputs", "strong-audit", DEFAULT_BIBLE);
const DEFAULT_BASELINE_PATH = path.join(
  "tests",
  "fixtures",
  "strong-audit",
  "nbs-10x5-snapshot.json"
);

export interface StrongAuditOptions {
  bible: string;
  seed: string;
  bookCount: number;
  chaptersPerBook: number;
  outputDir: string;
  resume: boolean;
}

interface EligibleBook {
  bookId: string;
  chapterCount: number;
}

export interface StrongAuditManifest {
  version: 1;
  bible: string;
  seed: string;
  bookCount: number;
  chaptersPerBook: number;
  generatedAt: string;
  selectedBooks: string[];
  scopes: StrongAuditScopeReport[];
  totals: StrongAuditTotals;
}

export interface StrongAuditSnapshot {
  version: 1;
  bible: string;
  seed: string;
  bookCount: number;
  chaptersPerBook: number;
  selectedBooks: string[];
  scopes: StrongAuditScopeSnapshot[];
  totals: StrongAuditTotals;
}

interface StrongAuditScopeReport extends StrongAuditScopeSnapshot {
  outputDir: string;
  ledgerPath: string;
  viewerUrl: string;
  lexicalReportPath: string;
}

interface StrongAuditScopeSnapshot {
  bookId: string;
  scope: string;
  verseCount: number;
  metrics: StableScopeMetrics;
  signatures: {
    annotations: string;
    readerHtml: string;
    advancedHtml: string;
    lexicalResidual: string;
  };
  lexicalMetrics?: StableLexicalMetrics;
}

interface StrongAuditTotals {
  verseCount: number;
  readerVisibleStrongCount: number;
  advancedStrongCount: number;
  emptyStrongCount: number;
  referenceStrongCoverage: number;
  referenceStrongCarrierCoverage: number;
  originalRepresentationRate: number;
  originalStrongOccurrenceCount: number;
  originalRepresentedStrongOccurrenceCount: number;
  originalStrongCarrierRate: number;
  semanticMissingCount: number;
  readerMultiStrongWordCount: number;
  placementRiskCount: number;
  placementQuality: number;
  readerTokenCoverage: number;
  advancedTokenCoverage: number;
  lexicalAuditItems: number;
  lexicalEmptyAnnotations: number;
  lexicalAutoSafeItems: number;
  lexicalHighConfidenceCandidates: number;
}

interface StableScopeMetrics {
  verseCount: number;
  wordCount: number;
  readerVisibleStrongCount: number;
  advancedStrongCount: number;
  emptyStrongCount: number;
  phraseStrongCount: number;
  technicalStrongCount: number;
  referenceStrongCoverage: number;
  referenceStrongCarrierCoverage: number;
  originalRepresentationRate: number;
  originalStrongOccurrenceCount: number;
  originalRepresentedStrongOccurrenceCount: number;
  originalStrongCarrierRate: number;
  semanticMissingCount: number;
  readerMultiStrongWordCount: number;
  placementRiskCount: number;
  placementQuality: number;
  readerTokenCoverage: number;
  readerTaggedTokenCount: number;
  advancedTokenCoverage: number;
  advancedTaggedTokenCount: number;
}

interface StableLexicalMetrics {
  auditItems: number;
  emptyAnnotations: number;
  readerEmptyAnnotations: number;
  advancedEmptyAnnotations: number;
  relocationAnnotations: number;
  itemsWithCandidates: number;
  emptyWithCandidates: number;
  relocationWithCandidates: number;
  candidateCount: number;
  highConfidenceCandidates: number;
  mediumConfidenceCandidates: number;
  lowConfidenceCandidates: number;
  openCandidates: number;
  occupiedCandidates: number;
  autoSafeItems: number;
  groupAutoSafeItems: number;
  ambiguousHighItems: number;
  openHighItems: number;
  relocationBetterOpenItems: number;
}

interface LexicalCandidateReportFile {
  metrics?: Partial<StableLexicalMetrics>;
  items?: LexicalCandidateItem[];
}

export interface StrongAuditResidualReport {
  version: 1;
  bible: string;
  seed: string;
  generatedAt: string;
  totals: {
    sampledItems: number;
    groupAutoSafeLeftovers: number;
    compoundProperNameItems: number;
    inferredSeedHighItems: number;
    cleanSingleOpenHighItems: number;
    blockedSingleOpenHighItems: number;
    mediumBlockedSingleOpenHighItems: number;
    highBlockedSingleOpenHighItems: number;
    singleOpenHighItems: number;
    highScoringMediumOpenItems: number;
    ambiguousHighItems: number;
    relocationBetterOpenItems: number;
  };
  categories: StrongAuditResidualCategory[];
}

interface StrongAuditResidualCategory {
  key: string;
  label: string;
  count: number;
  samples: StrongAuditResidualSample[];
}

interface StrongAuditResidualSample {
  occurrences: number;
  scope: string;
  ref: string;
  strong: string;
  auditKind: LexicalCandidateItem["auditKind"];
  gloss: string;
  currentTarget?: string;
  sourceAnchor?: number;
  candidate?: {
    target: LexicalCandidate["target"];
    text: string;
    wordIndex: number;
    span?: string;
    score: number;
    confidence: LexicalCandidate["confidence"];
    occupied: boolean;
    evidenceSources: string[];
    evidenceDetails: string[];
  };
  note: string;
}

export async function eligibleBooksForAudit(
  bible: string,
  chaptersPerBook: number
): Promise<EligibleBook[]> {
  const verses = await readBibleJson(biblePath(bible));
  const chaptersByBook = new Map<string, Set<number>>();
  for (const verse of verses) {
    const chapters = chaptersByBook.get(verse.bookId) ?? new Set<number>();
    chapters.add(verse.chapter);
    chaptersByBook.set(verse.bookId, chapters);
  }

  return BOOK_IDS.map((bookId) => ({
    bookId,
    chapterCount: chaptersByBook.get(bookId)?.size ?? 0
  })).filter((book) => book.chapterCount >= chaptersPerBook);
}

export function selectAuditBooks(
  eligibleBooks: EligibleBook[],
  options: Pick<StrongAuditOptions, "seed" | "bookCount">
): string[] {
  if (eligibleBooks.length < options.bookCount) {
    throw new Error(
      `Not enough eligible books: requested ${options.bookCount}, found ${eligibleBooks.length}`
    );
  }

  return [...eligibleBooks]
    .sort((left, right) => {
      const leftHash = hashText(`${options.seed}:${left.bookId}`);
      const rightHash = hashText(`${options.seed}:${right.bookId}`);
      return leftHash.localeCompare(rightHash);
    })
    .slice(0, options.bookCount)
    .map((book) => book.bookId);
}

export async function runStrongAudit(
  options: StrongAuditOptions
): Promise<StrongAuditManifest> {
  const eligibleBooks = await eligibleBooksForAudit(
    options.bible,
    options.chaptersPerBook
  );
  const selectedBooks = selectAuditBooks(eligibleBooks, options);
  const scopes: StrongAuditScopeReport[] = [];

  await mkdir(options.outputDir, { recursive: true });

  for (const [index, bookId] of selectedBooks.entries()) {
    const scope = `${bookId}.1-${bookId}.${options.chaptersPerBook}`;
    const scopeOutputDir = path.join(options.outputDir, "scopes", bookId);
    const expectedLedgerPath = strongLedgerSqlitePath(
      scopeOutputDir,
      options.bible
    );
    const expectedLexicalReportPath = lexicalReportPathFor(
      options.bible,
      scope
    );
    const canResume =
      options.resume &&
      existsSync(expectedLedgerPath) &&
      existsSync(expectedLexicalReportPath);

    console.log(
      `[${index + 1}/${selectedBooks.length}] ${scope} ${canResume ? "reuse" : "generate"}`
    );
    const ledger = canResume
      ? readStrongLedgerSqlite({ sqlitePath: expectedLedgerPath })
      : await generateStrongLedger({
          bible: options.bible,
          biblePath: biblePath(options.bible),
          outputDir: scopeOutputDir,
          onlyRef: scope
        });
    scopes.push(scopeReport(ledger, scopeOutputDir));
  }

  const manifest: StrongAuditManifest = {
    version: 1,
    bible: options.bible,
    seed: options.seed,
    bookCount: options.bookCount,
    chaptersPerBook: options.chaptersPerBook,
    generatedAt: new Date().toISOString(),
    selectedBooks,
    scopes,
    totals: aggregateAuditTotals(scopes)
  };

  await writeJson(path.join(options.outputDir, "manifest.json"), manifest);
  await writeJson(
    path.join(options.outputDir, "snapshot.json"),
    snapshotFromManifest(manifest)
  );

  return manifest;
}

export function snapshotFromManifest(
  manifest: StrongAuditManifest
): StrongAuditSnapshot {
  return {
    version: 1,
    bible: manifest.bible,
    seed: manifest.seed,
    bookCount: manifest.bookCount,
    chaptersPerBook: manifest.chaptersPerBook,
    selectedBooks: manifest.selectedBooks,
    scopes: manifest.scopes.map(
      ({ bookId, scope, verseCount, metrics, signatures, lexicalMetrics }) => ({
        bookId,
        scope,
        verseCount,
        metrics,
        signatures,
        lexicalMetrics
      })
    ),
    totals: manifest.totals
  };
}

export function residualReportFromManifest(
  manifest: StrongAuditManifest,
  sampleLimit = 12
): StrongAuditResidualReport {
  const categories = new Map<string, StrongAuditResidualCategory>();
  let sampledItems = 0;

  const addSample = (
    key: string,
    label: string,
    sample: StrongAuditResidualSample
  ): void => {
    const category = categories.get(key) ?? {
      key,
      label,
      count: 0,
      samples: []
    };
    category.count += 1;
    const existingSample = category.samples.find(
      (existing) => residualSampleKey(existing) === residualSampleKey(sample)
    );
    if (existingSample) {
      existingSample.occurrences += sample.occurrences;
    } else if (category.samples.length < sampleLimit) {
      category.samples.push(sample);
    }
    categories.set(key, category);
  };

  for (const scope of manifest.scopes) {
    const lexicalReport = readJsonIfExists<LexicalCandidateReport>(
      scope.lexicalReportPath
    );
    if (!lexicalReport) continue;

    for (const item of lexicalReport.items) {
      sampledItems += 1;
      const highOpenCandidates = item.candidates.filter(
        (candidate) => candidate.confidence === "high" && !candidate.occupied
      );
      const highCandidates = item.candidates.filter(
        (candidate) => candidate.confidence === "high"
      );
      const compoundProperNameOpenCandidates = highOpenCandidates.filter(
        (candidate) => isCompoundProperNameCandidate(item, candidate)
      );
      const simpleHighOpenCandidates = highOpenCandidates.filter(
        (candidate) => !isCompoundProperNameCandidate(item, candidate)
      );
      const simpleHighCandidates = highCandidates.filter(
        (candidate) => !isCompoundProperNameCandidate(item, candidate)
      );
      const highScoringMediumOpenCandidates = item.candidates.filter(
        (candidate) =>
          candidate.confidence !== "high" &&
          !candidate.occupied &&
          candidate.score >= HIGH_CONFIDENCE_THRESHOLD
      );

      if (item.groupAutoSafe) {
        const candidate = item.candidates.find(
          (candidate) =>
            candidate.wordIndex === item.groupAutoSafe?.assignedWordIndex
        );
        addSample(
          "group-auto-safe-leftovers",
          "Group auto-safe leftovers to be absorbed",
          residualSample(
            scope.scope,
            item,
            candidate,
            item.groupAutoSafe.reason
          )
        );
      }

      if (compoundProperNameOpenCandidates.length > 0) {
        addSample(
          "compound-proper-name-open",
          "Compound STEP proper-name candidates for review",
          residualSample(
            scope.scope,
            item,
            compoundProperNameOpenCandidates[0],
            "STEP proper-name evidence spans multiple gloss parts; review before stacking or splitting"
          )
        );
      }

      const inferredSeedCandidate = simpleHighOpenCandidates.find((candidate) =>
        usesInferredSeedEvidence(item, candidate)
      );
      if (inferredSeedCandidate) {
        addSample(
          "inferred-seed-high",
          "High candidates using inferred seed evidence",
          residualSample(
            scope.scope,
            item,
            inferredSeedCandidate,
            "direct seed evidence comes from inferred French terms rather than Strong dictionary terms"
          )
        );
      }

      if (
        simpleHighOpenCandidates.length === 1 &&
        simpleHighCandidates.length === 1 &&
        highScoringMediumOpenCandidates.length === 0
      ) {
        addSample(
          "clean-single-open-high",
          "Clean single open high-confidence candidates",
          residualSample(
            scope.scope,
            item,
            simpleHighOpenCandidates[0],
            "one high open candidate; no high occupied or high-scoring medium open blocker"
          )
        );
      }

      if (
        simpleHighOpenCandidates.length === 1 &&
        simpleHighCandidates.length === 1 &&
        highScoringMediumOpenCandidates.length > 0
      ) {
        addSample(
          "medium-blocked-single-open-high",
          "Single open high-confidence candidates blocked by medium synonym candidates",
          residualSample(
            scope.scope,
            item,
            simpleHighOpenCandidates[0],
            `${highScoringMediumOpenCandidates.length} high-scoring medium open candidates`
          )
        );
      }

      if (
        simpleHighOpenCandidates.length === 1 &&
        simpleHighCandidates.length > 1
      ) {
        addSample(
          "high-blocked-single-open-high",
          "Single open high-confidence candidates blocked by other high candidates",
          residualSample(
            scope.scope,
            item,
            simpleHighOpenCandidates[0],
            `${simpleHighCandidates.length} non-compound high candidates; ${highScoringMediumOpenCandidates.length} high-scoring medium open candidates`
          )
        );
      }

      if (highScoringMediumOpenCandidates.length > 0) {
        addSample(
          "high-scoring-medium-open",
          "High-scoring medium open candidates",
          residualSample(
            scope.scope,
            item,
            highScoringMediumOpenCandidates[0],
            "score reaches the high threshold but confidence is capped below high"
          )
        );
      }

      if (simpleHighOpenCandidates.length > 1) {
        addSample(
          "ambiguous-open-high",
          "Ambiguous open high-confidence candidates",
          residualSample(
            scope.scope,
            item,
            simpleHighOpenCandidates[0],
            `${simpleHighOpenCandidates.length} non-compound open high candidates compete`
          )
        );
      }

      if (
        item.auditKind === "relocation" &&
        simpleHighOpenCandidates.length > 0
      ) {
        addSample(
          "relocation-better-open",
          "Relocation candidates with better open carriers",
          residualSample(
            scope.scope,
            item,
            simpleHighOpenCandidates[0],
            "visible Strong may be on a weaker/current carrier"
          )
        );
      }
    }
  }

  const categoryList = [...categories.values()].sort(
    (left, right) =>
      residualCategoryPriority(left.key) -
        residualCategoryPriority(right.key) ||
      right.count - left.count ||
      left.key.localeCompare(right.key)
  );

  return {
    version: 1,
    bible: manifest.bible,
    seed: manifest.seed,
    generatedAt: new Date().toISOString(),
    totals: {
      sampledItems,
      groupAutoSafeLeftovers:
        categories.get("group-auto-safe-leftovers")?.count ?? 0,
      compoundProperNameItems:
        categories.get("compound-proper-name-open")?.count ?? 0,
      inferredSeedHighItems: categories.get("inferred-seed-high")?.count ?? 0,
      cleanSingleOpenHighItems:
        categories.get("clean-single-open-high")?.count ?? 0,
      mediumBlockedSingleOpenHighItems:
        categories.get("medium-blocked-single-open-high")?.count ?? 0,
      highBlockedSingleOpenHighItems:
        categories.get("high-blocked-single-open-high")?.count ?? 0,
      blockedSingleOpenHighItems:
        (categories.get("medium-blocked-single-open-high")?.count ?? 0) +
        (categories.get("high-blocked-single-open-high")?.count ?? 0),
      singleOpenHighItems:
        (categories.get("clean-single-open-high")?.count ?? 0) +
        (categories.get("medium-blocked-single-open-high")?.count ?? 0) +
        (categories.get("high-blocked-single-open-high")?.count ?? 0),
      highScoringMediumOpenItems:
        categories.get("high-scoring-medium-open")?.count ?? 0,
      ambiguousHighItems: categories.get("ambiguous-open-high")?.count ?? 0,
      relocationBetterOpenItems:
        categories.get("relocation-better-open")?.count ?? 0
    },
    categories: categoryList
  };
}

function residualCategoryPriority(key: string): number {
  switch (key) {
    case "clean-single-open-high":
      return 10;
    case "compound-proper-name-open":
      return 15;
    case "inferred-seed-high":
      return 18;
    case "group-auto-safe-leftovers":
      return 20;
    case "medium-blocked-single-open-high":
      return 30;
    case "high-blocked-single-open-high":
      return 35;
    case "ambiguous-open-high":
      return 40;
    case "relocation-better-open":
      return 50;
    case "high-scoring-medium-open":
      return 60;
    default:
      return 100;
  }
}

function isCompoundProperNameCandidate(
  item: LexicalCandidateItem,
  candidate: LexicalCandidate
): boolean {
  return (
    item.stepGlosses.length > 1 &&
    candidate.evidence.some(
      (evidence) => evidence.source === "proper-name-step"
    )
  );
}

function usesInferredSeedEvidence(
  item: LexicalCandidateItem,
  candidate: LexicalCandidate
): boolean {
  const dictionaryTerms = new Set(item.dictionaryTerms);
  const inferredTerms = new Set(item.inferredTerms);
  if (inferredTerms.size === 0) return false;

  return candidate.evidence.some((evidence) => {
    if (evidence.source === "seed-term") {
      const term = seedTermEvidenceTerm(evidence.detail) ?? candidate.lemma;
      return inferredTerms.has(term) && !dictionaryTerms.has(term);
    }
    if (evidence.source === "seed-stem") {
      const seed = seedStemEvidenceSeed(evidence.detail);
      return Boolean(
        seed && inferredTerms.has(seed) && !dictionaryTerms.has(seed)
      );
    }
    return false;
  });
}

function seedTermEvidenceTerm(detail: string): string | undefined {
  return detail.match(/^(.+?) matches Strong lexical hint$/u)?.[1];
}

function seedStemEvidenceSeed(detail: string): string | undefined {
  return detail.match(/ stem (.+)$/u)?.[1];
}

function residualSample(
  scope: string,
  item: LexicalCandidateItem,
  candidate: LexicalCandidate | undefined,
  note: string
): StrongAuditResidualSample {
  return {
    occurrences: 1,
    scope,
    ref: item.ref,
    strong: item.strong,
    auditKind: item.auditKind,
    gloss: item.stepGlosses.join(" / "),
    currentTarget: item.currentTarget
      ? `${item.currentTarget.wordIndex}:${item.currentTarget.text}`
      : undefined,
    sourceAnchor: item.insertAfterWordIndex,
    candidate: candidate ? residualCandidate(candidate) : undefined,
    note
  };
}

function residualCandidate(
  candidate: LexicalCandidate
): StrongAuditResidualSample["candidate"] {
  return {
    target: candidate.target,
    text: candidate.text,
    wordIndex: candidate.wordIndex,
    span:
      candidate.startWordIndex !== undefined &&
      candidate.endWordIndex !== undefined
        ? `${candidate.startWordIndex}-${candidate.endWordIndex}`
        : undefined,
    score: candidate.score,
    confidence: candidate.confidence,
    occupied: candidate.occupied,
    evidenceSources: candidate.evidence.map((evidence) => evidence.source),
    evidenceDetails: candidate.evidence.map(
      (evidence) => `${evidence.source}: ${evidence.detail}`
    )
  };
}

export function residualReportMarkdown(
  report: StrongAuditResidualReport
): string {
  const lines = [
    "# Strong Audit Residuals",
    "",
    `Bible: \`${report.bible}\``,
    `Seed: \`${report.seed}\``,
    "",
    "## Totals",
    "",
    `- Sampled items: ${report.totals.sampledItems}`,
    `- Group auto-safe leftovers: ${report.totals.groupAutoSafeLeftovers}`,
    `- Compound STEP proper-name candidates: ${report.totals.compoundProperNameItems}`,
    `- Inferred-seed high candidates: ${report.totals.inferredSeedHighItems}`,
    `- Clean single open high candidates: ${report.totals.cleanSingleOpenHighItems}`,
    `- Blocked single open high candidates: ${report.totals.blockedSingleOpenHighItems}`,
    `- Medium-blocked single open high candidates: ${report.totals.mediumBlockedSingleOpenHighItems}`,
    `- High-blocked single open high candidates: ${report.totals.highBlockedSingleOpenHighItems}`,
    `- Single open high candidates total: ${report.totals.singleOpenHighItems}`,
    `- High-scoring medium open candidates: ${report.totals.highScoringMediumOpenItems}`,
    `- Ambiguous open high candidates: ${report.totals.ambiguousHighItems}`,
    `- Relocation better-open candidates: ${report.totals.relocationBetterOpenItems}`
  ];

  for (const category of report.categories) {
    lines.push("", `## ${category.label}`, "", `Count: ${category.count}`, "");
    for (const sample of category.samples) {
      lines.push(
        `- ${sample.scope} ${sample.ref} ${sample.strong} (${sample.auditKind})`,
        `  - occurrences: ${sample.occurrences}`,
        `  - gloss: ${sample.gloss || "(none)"}`,
        `  - candidate: ${formatResidualCandidate(sample.candidate)}`,
        `  - evidence: ${formatResidualCandidateEvidence(sample.candidate)}`,
        `  - current: ${sample.currentTarget ?? "(none)"}; anchor: ${
          sample.sourceAnchor ?? "(none)"
        }`,
        `  - note: ${sample.note}`
      );
    }
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

function residualSampleKey(sample: StrongAuditResidualSample): string {
  return [
    sample.scope,
    sample.ref,
    sample.strong,
    sample.auditKind,
    sample.currentTarget ?? "",
    sample.sourceAnchor ?? "",
    sample.note,
    sample.candidate?.wordIndex ?? "",
    sample.candidate?.text ?? "",
    sample.candidate?.span ?? "",
    sample.candidate?.score ?? "",
    sample.candidate?.confidence ?? "",
    sample.candidate?.occupied ?? "",
    sample.candidate?.evidenceDetails.join("|") ?? ""
  ].join("\u0000");
}

function formatResidualCandidate(
  candidate: StrongAuditResidualSample["candidate"]
): string {
  if (!candidate) return "(none)";
  const span = candidate.span ? ` span ${candidate.span}` : "";
  const occupied = candidate.occupied ? " occupied" : " open";
  return `${candidate.wordIndex}:${candidate.text}${span} ${candidate.score} ${candidate.confidence}${occupied} [${candidate.evidenceSources.join(", ")}]`;
}

function formatResidualCandidateEvidence(
  candidate: StrongAuditResidualSample["candidate"]
): string {
  if (!candidate || candidate.evidenceDetails.length === 0) return "(none)";
  const details = candidate.evidenceDetails.slice(0, 4);
  const suffix =
    candidate.evidenceDetails.length > details.length ? "; ..." : "";
  return `${details.join("; ")}${suffix}`;
}

function scopeReport(
  ledger: StrongLedger,
  outputDir: string
): StrongAuditScopeReport {
  const bookId = ledger.verses[0]?.bookId ?? ledger.scope.split(".")[0] ?? "";
  const lexicalReportPath = lexicalReportPathFor(ledger.bible, ledger.scope);
  const lexicalReport =
    readJsonIfExists<LexicalCandidateReportFile>(lexicalReportPath);
  const lexicalMetrics = stableLexicalMetrics(lexicalReport?.metrics);

  return {
    bookId,
    scope: ledger.scope,
    verseCount: ledger.verses.length,
    outputDir,
    ledgerPath: ledger.outputPaths.canonical,
    viewerUrl: `/viewer/?file=/${ledger.outputPaths.canonical}`,
    lexicalReportPath,
    metrics: stableMetrics(ledger.metrics),
    signatures: {
      annotations: hashJson(stableAnnotations(ledger)),
      readerHtml: hashJson(
        ledger.verses.map((verse) => verse.views.readerHtml)
      ),
      advancedHtml: hashJson(
        ledger.verses.map((verse) => verse.views.advancedHtml)
      ),
      lexicalResidual: hashJson(lexicalReport?.items ?? [])
    },
    lexicalMetrics
  };
}

function stableAnnotations(ledger: StrongLedger): unknown[] {
  return ledger.verses.map((verse) => ({
    ref: verse.ref,
    annotations: verse.annotations.map((annotation) => ({
      strong: annotation.strong,
      visibility: annotation.visibility,
      placement: annotation.placement,
      source: annotation.source,
      wordIndex: annotation.wordIndex,
      startWordIndex: annotation.startWordIndex,
      endWordIndex: annotation.endWordIndex,
      insertAfterWordIndex: annotation.insertAfterWordIndex,
      normalizedWord: annotation.normalizedWord,
      normalizedPhrase: annotation.normalizedPhrase,
      sourceStrong: annotation.sourceStrong,
      lexiconLookup: annotation.lexiconLookup,
      diagnostics: [...annotation.diagnostics].sort()
    }))
  }));
}

function stableMetrics(metrics: StrongLedgerMetrics): StableScopeMetrics {
  return {
    verseCount: metrics.verseCount,
    wordCount: metrics.wordCount,
    readerVisibleStrongCount: metrics.readerVisibleStrongCount,
    advancedStrongCount: metrics.advancedStrongCount,
    emptyStrongCount: metrics.emptyStrongCount,
    phraseStrongCount: metrics.phraseStrongCount,
    technicalStrongCount: metrics.technicalStrongCount,
    referenceStrongCoverage: metrics.referenceStrongCoverage,
    referenceStrongCarrierCoverage: metrics.referenceStrongCarrierCoverage,
    originalRepresentationRate: metrics.originalRepresentationRate,
    originalStrongOccurrenceCount: metrics.originalStrongOccurrenceCount,
    originalRepresentedStrongOccurrenceCount:
      metrics.originalRepresentedStrongOccurrenceCount,
    originalStrongCarrierRate: metrics.originalStrongCarrierRate,
    semanticMissingCount: metrics.semanticMissingCount,
    readerMultiStrongWordCount: metrics.readerMultiStrongWordCount,
    placementRiskCount: metrics.placementRiskCount,
    placementQuality: metrics.placementQuality,
    readerTokenCoverage: metrics.readerTokenCoverage,
    readerTaggedTokenCount: metrics.readerTaggedTokenCount,
    advancedTokenCoverage: metrics.advancedTokenCoverage,
    advancedTaggedTokenCount: metrics.advancedTaggedTokenCount
  };
}

function stableLexicalMetrics(
  metrics: Partial<StableLexicalMetrics> | undefined
): StableLexicalMetrics | undefined {
  if (!metrics) return undefined;
  return {
    auditItems: metrics.auditItems ?? 0,
    emptyAnnotations: metrics.emptyAnnotations ?? 0,
    readerEmptyAnnotations: metrics.readerEmptyAnnotations ?? 0,
    advancedEmptyAnnotations: metrics.advancedEmptyAnnotations ?? 0,
    relocationAnnotations: metrics.relocationAnnotations ?? 0,
    itemsWithCandidates: metrics.itemsWithCandidates ?? 0,
    emptyWithCandidates: metrics.emptyWithCandidates ?? 0,
    relocationWithCandidates: metrics.relocationWithCandidates ?? 0,
    candidateCount: metrics.candidateCount ?? 0,
    highConfidenceCandidates: metrics.highConfidenceCandidates ?? 0,
    mediumConfidenceCandidates: metrics.mediumConfidenceCandidates ?? 0,
    lowConfidenceCandidates: metrics.lowConfidenceCandidates ?? 0,
    openCandidates: metrics.openCandidates ?? 0,
    occupiedCandidates: metrics.occupiedCandidates ?? 0,
    autoSafeItems: metrics.autoSafeItems ?? 0,
    groupAutoSafeItems: metrics.groupAutoSafeItems ?? 0,
    ambiguousHighItems: metrics.ambiguousHighItems ?? 0,
    openHighItems: metrics.openHighItems ?? 0,
    relocationBetterOpenItems: metrics.relocationBetterOpenItems ?? 0
  };
}

function aggregateAuditTotals(
  scopes: Array<Pick<StrongAuditScopeSnapshot, "metrics" | "lexicalMetrics">>
): StrongAuditTotals {
  const metrics = scopes.map((scope) => scope.metrics);
  const lexicalMetrics = scopes
    .map((scope) => scope.lexicalMetrics)
    .filter((value): value is StableLexicalMetrics => Boolean(value));
  const verseCount = sum(metrics, "verseCount");
  const wordCount = sum(metrics, "wordCount");
  const originalStrongOccurrenceCount = sum(
    metrics,
    "originalStrongOccurrenceCount"
  );

  return {
    verseCount,
    readerVisibleStrongCount: sum(metrics, "readerVisibleStrongCount"),
    advancedStrongCount: sum(metrics, "advancedStrongCount"),
    emptyStrongCount: sum(metrics, "emptyStrongCount"),
    referenceStrongCoverage: weightedAverage(
      metrics,
      "referenceStrongCoverage",
      "readerVisibleStrongCount"
    ),
    referenceStrongCarrierCoverage: weightedAverage(
      metrics,
      "referenceStrongCarrierCoverage",
      "readerVisibleStrongCount"
    ),
    originalRepresentationRate:
      originalStrongOccurrenceCount > 0
        ? roundRatio(
            sum(metrics, "originalRepresentedStrongOccurrenceCount") /
              originalStrongOccurrenceCount
          )
        : 0,
    originalStrongOccurrenceCount,
    originalRepresentedStrongOccurrenceCount: sum(
      metrics,
      "originalRepresentedStrongOccurrenceCount"
    ),
    originalStrongCarrierRate: weightedAverage(
      metrics,
      "originalStrongCarrierRate",
      "advancedStrongCount"
    ),
    semanticMissingCount: sum(metrics, "semanticMissingCount"),
    readerMultiStrongWordCount: sum(metrics, "readerMultiStrongWordCount"),
    placementRiskCount: sum(metrics, "placementRiskCount"),
    placementQuality: weightedAverage(
      metrics,
      "placementQuality",
      "advancedStrongCount"
    ),
    readerTokenCoverage:
      wordCount > 0
        ? roundRatio(sum(metrics, "readerTaggedTokenCount") / wordCount)
        : 0,
    advancedTokenCoverage:
      wordCount > 0
        ? roundRatio(sum(metrics, "advancedTaggedTokenCount") / wordCount)
        : 0,
    lexicalAuditItems: sum(lexicalMetrics, "auditItems"),
    lexicalEmptyAnnotations: sum(lexicalMetrics, "emptyAnnotations"),
    lexicalAutoSafeItems: sum(lexicalMetrics, "autoSafeItems"),
    lexicalHighConfidenceCandidates: sum(
      lexicalMetrics,
      "highConfidenceCandidates"
    )
  };
}

function sum<T, K extends keyof T>(values: T[], key: K): number {
  return sumBy(values, (value) => Number(value[key] ?? 0));
}

function sumBy<T>(values: T[], getter: (value: T) => number): number {
  return values.reduce((total, value) => total + getter(value), 0);
}

function weightedAverage<
  T,
  ValueKey extends keyof T,
  WeightKey extends keyof T
>(values: T[], valueKey: ValueKey, weightKey: WeightKey): number {
  const weight = sum(values, weightKey);
  if (weight === 0) return 0;
  return roundRatio(
    values.reduce(
      (total, value) =>
        total + Number(value[valueKey] ?? 0) * Number(value[weightKey] ?? 0),
      0
    ) / weight
  );
}

function lexicalReportPathFor(bible: string, scope: string): string {
  const scopeSlug = scope.replace(/[^\p{L}\p{N}.-]+/gu, "_");
  return path.join(
    "outputs",
    "lexical-candidates",
    bible,
    `bible-${bible}-lexical-candidates-${scopeSlug}.json`
  );
}

function biblePath(bible: string): string {
  return path.join("data", "bibles", `bible-${bible}.json`);
}

function hashJson(value: unknown): string {
  return hashText(JSON.stringify(value));
}

function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function roundRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10000) / 10000;
}

function readJsonIfExists<T>(filePath: string): T | undefined {
  if (!existsSync(filePath)) return undefined;
  return readJsonFile<T>(filePath);
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseOptions(argv: string[]): {
  command: "plan" | "run" | "snapshot" | "verify" | "residuals";
  options: StrongAuditOptions;
  manifestPath?: string;
  snapshotPath?: string;
  baselinePath?: string;
} {
  const command = ["run", "snapshot", "verify", "residuals"].includes(
    argv[2] ?? ""
  )
    ? (argv[2] as "run" | "snapshot" | "verify" | "residuals")
    : "plan";
  const bible = readOption(argv, "--bible") ?? DEFAULT_BIBLE;
  const outputDir =
    readOption(argv, "--output-dir") ??
    (bible === DEFAULT_BIBLE
      ? DEFAULT_OUTPUT_DIR
      : path.join("outputs", "strong-audit", bible));
  return {
    command,
    options: {
      bible,
      seed: readOption(argv, "--seed") ?? DEFAULT_SEED,
      bookCount: Number(readOption(argv, "--books") ?? DEFAULT_BOOK_COUNT),
      chaptersPerBook: Number(
        readOption(argv, "--chapters") ?? DEFAULT_CHAPTERS_PER_BOOK
      ),
      outputDir,
      resume: !hasFlag(argv, "--no-resume")
    },
    manifestPath: readOption(argv, "--manifest"),
    snapshotPath: readOption(argv, "--snapshot"),
    baselinePath: readOption(argv, "--baseline")
  };
}

function readOption(argv: string[], name: string): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === name) return argv[index + 1];
    if (arg?.startsWith(`${name}=`)) return arg.slice(name.length + 1);
  }
  return undefined;
}

function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(name);
}

async function main(): Promise<void> {
  const { command, options, manifestPath, snapshotPath, baselinePath } =
    parseOptions(process.argv);

  if (command === "snapshot") {
    const manifest = readJsonIfExists<StrongAuditManifest>(
      manifestPath ?? path.join(options.outputDir, "manifest.json")
    );
    if (!manifest) throw new Error("Missing audit manifest for snapshot");
    const snapshot = snapshotFromManifest(manifest);
    const outputPath =
      snapshotPath ?? path.join(options.outputDir, "snapshot.json");
    await writeJson(outputPath, snapshot);
    console.log(`Wrote audit snapshot: ${outputPath}`);
    return;
  }

  if (command === "verify") {
    const actualPath =
      snapshotPath ?? path.join(options.outputDir, "snapshot.json");
    const expectedPath = baselinePath ?? DEFAULT_BASELINE_PATH;
    const actual = readJsonFile<StrongAuditSnapshot>(actualPath);
    const expected = readJsonFile<StrongAuditSnapshot>(expectedPath);
    const actualJson = JSON.stringify(actual, null, 2);
    const expectedJson = JSON.stringify(expected, null, 2);

    if (actualJson !== expectedJson) {
      console.error(
        `Audit snapshot mismatch: ${actualPath} != ${expectedPath}`
      );
      console.error(snapshotMismatchSummary(actual, expected));
      process.exitCode = 1;
      return;
    }

    console.log(`Audit snapshot matches baseline: ${expectedPath}`);
    return;
  }

  if (command === "residuals") {
    const manifest = readJsonIfExists<StrongAuditManifest>(
      manifestPath ?? path.join(options.outputDir, "manifest.json")
    );
    if (!manifest) throw new Error("Missing audit manifest for residuals");
    const report = residualReportFromManifest(manifest);
    const jsonPath = path.join(options.outputDir, "residuals.json");
    const markdownPath = path.join(options.outputDir, "residuals.md");
    await writeJson(jsonPath, report);
    await writeFile(markdownPath, residualReportMarkdown(report), "utf8");
    console.log(`Wrote audit residual report: ${jsonPath}`);
    console.log(`Wrote audit residual markdown: ${markdownPath}`);
    return;
  }

  const eligibleBooks = await eligibleBooksForAudit(
    options.bible,
    options.chaptersPerBook
  );
  const selectedBooks = selectAuditBooks(eligibleBooks, options);

  if (command === "plan") {
    console.log(
      JSON.stringify(
        {
          bible: options.bible,
          seed: options.seed,
          bookCount: options.bookCount,
          chaptersPerBook: options.chaptersPerBook,
          eligibleBookCount: eligibleBooks.length,
          selectedBooks
        },
        null,
        2
      )
    );
    return;
  }

  const manifest = await runStrongAudit(options);
  console.log(
    `Wrote audit manifest: ${path.join(options.outputDir, "manifest.json")}`
  );
  console.log(
    `Wrote audit snapshot: ${path.join(options.outputDir, "snapshot.json")}`
  );
  console.log(
    `Generated ${manifest.scopes.length} scopes; reader coverage ${manifest.totals.readerTokenCoverage}; placement quality ${manifest.totals.placementQuality}`
  );
}

function snapshotMismatchSummary(
  actual: StrongAuditSnapshot,
  expected: StrongAuditSnapshot
): string {
  if (actual.selectedBooks.join(",") !== expected.selectedBooks.join(",")) {
    return `selectedBooks differ\nactual:   ${actual.selectedBooks.join(", ")}\nexpected: ${expected.selectedBooks.join(", ")}`;
  }

  const actualByScope = new Map(
    actual.scopes.map((scope) => [scope.scope, scope])
  );
  for (const expectedScope of expected.scopes) {
    const actualScope = actualByScope.get(expectedScope.scope);
    if (!actualScope) return `missing scope: ${expectedScope.scope}`;
    if (
      JSON.stringify(actualScope.signatures) !==
      JSON.stringify(expectedScope.signatures)
    ) {
      return `signature mismatch in ${expectedScope.scope}`;
    }
    if (
      JSON.stringify(actualScope.metrics) !==
      JSON.stringify(expectedScope.metrics)
    ) {
      return `metrics mismatch in ${expectedScope.scope}`;
    }
    if (
      JSON.stringify(actualScope.lexicalMetrics) !==
      JSON.stringify(expectedScope.lexicalMetrics)
    ) {
      return `lexical metrics mismatch in ${expectedScope.scope}`;
    }
  }

  return "snapshot metadata or totals differ";
}

if (
  process.argv.some((arg) =>
    arg.replaceAll("\\", "/").endsWith("src/strongAuditWorkflow.ts")
  )
) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
