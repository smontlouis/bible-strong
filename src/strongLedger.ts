import { createWriteStream, existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { type AssignedStrong, type ReferenceSource } from "./align.js";
import { readBibleJson, type BibleVerse } from "./bibleJson.js";
import { BOOK_IDS } from "./books.js";
import {
  type CompleteAlignmentResult,
  type CompleteWordAssignment,
  type EmptyStrongAssignment,
  type OriginalStrongOccurrence,
  getOriginalStrongOccurrences
} from "./completeAlignment.js";
import {
  applyCuratedStrongOverrides,
  buildCuratedStrongOverrideIndex,
  getCuratedStrongOverrides,
  type CuratedStrongOverride
} from "./curatedStrongOverrides.js";
import { contentFingerprint } from "./contentAddressedCache.js";
import { maximumWeightMatching } from "./maximumWeightMatching.js";
import { buildStrongLexicon } from "./lexicon.js";
import {
  buildLexicalCandidateReport,
  createLexicalCandidateSourceCache,
  lexicalAutoSafePlacements,
  writeLexicalCandidateReport,
  type LexicalAutoSafePlacement,
  type LexicalCandidate
} from "./lexicalCandidateReport.js";
import {
  buildPermissivePromotionPlan,
  writePermissivePromotionPlan
} from "./permissiveStrongProjection.js";
import {
  summarizeOriginalSource,
  type OriginalSourceSummary,
  type OriginalToken,
  type OriginalVerse,
  type OriginalVerseMap
} from "./originalSource.js";
import {
  type ReaderAlignmentResult,
  type ReaderEmptyAssignment,
  type ReaderPhraseAssignment
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
import {
  readStrongDictionaryTranslationCandidates,
  resolveDefaultStrongDictionaryInput,
  type ResolvedDefaultStrongDictionaryInput
} from "./strongDictionaryLexicon.js";
import {
  defaultKaikkiSqlitePath,
  DEFAULT_KAIKKI_JSONL
} from "./kaikkiSqliteIndex.js";
import {
  readStepOriginalData,
  getStepSourceIdentity,
  selectStepEvidenceForRefs,
  selectStepOriginalTokensForRefs,
  selectStepEvidenceForOccurrence,
  type StepOriginalEvidenceIndex,
  type StepStrongEvidence as SourceStepStrongEvidence
} from "./stepOriginals.js";
import {
  validateVerseCorrespondenceManifest,
  type VerseCorrespondenceBlock,
  type VerseCorrespondenceManifest
} from "./verseCorrespondence.js";
import {
  alignVerseBlock,
  combineReferenceSourcesForRefs,
  originalVerseForTargetBlock,
  projectBlockReferences
} from "./verseBlockAlignment.js";
import { escapeHtml, tokenizeText, type TextSegment } from "./tokenize.js";
import { buildStrongPhraseLexicon } from "./phraseTranslationLexicon.js";
import { buildStrongTranslationLexicon } from "./translationLexicon.js";
import {
  getTranslationProfile,
  hasTranslationProfile,
  type TranslationProfile
} from "./translationProfiles.js";
import {
  DEFAULT_STRONG_PHRASE_LEXICON_SQLITE,
  readStrongPhraseLexiconSqlite,
  strongPhraseLexiconSourceFingerprint,
  writeStrongPhraseLexiconSqlite
} from "./strongPhraseLexiconStore.js";
import {
  exportStrongLedgerTsvSqlite,
  readStrongLedgerSqlite,
  replaceStrongLedgerSqliteVerses,
  strongLedgerSqlitePath,
  writeStrongLedgerSqlite
} from "./strongLedgerStore.js";

export type StrongVisibility =
  | "reader"
  | "advanced"
  | "hidden"
  | "pending"
  | "rejected";
export type StrongPlacement =
  | "word"
  | "phrase"
  | "empty"
  | "duplicate"
  | "not-rendered"
  | "technical";
export type StrongSource =
  | "reference-transfer"
  | "phrase-transfer"
  | "semantic-lexicon"
  | "reference-learned"
  | "reference-backed-original"
  | "dictionary-fr"
  | "original-complete"
  | "reference-only"
  | "manual-review"
  | "llm-review"
  | "curated-override";

export interface StrongStepEvidence {
  source: "TAHOT" | "TAGNT";
  classicalStrong: string;
  eStrong?: string;
  dStrong: string;
  uStrong?: string;
  tokenIndex: number;
  type: string;
  surface: string;
  transliteration: string;
  gloss: string;
  morphology: string;
  editions: string;
}

export interface StrongLedgerAnnotation {
  id: string;
  strong: string;
  visibility: StrongVisibility;
  placement: StrongPlacement;
  source: StrongSource;
  confidence: number;
  reason: string;
  diagnostics: string[];
  wordIndex?: number;
  startWordIndex?: number;
  endWordIndex?: number;
  insertAfterWordIndex?: number;
  normalizedWord?: string;
  normalizedPhrase?: string;
  originalLemma?: string;
  originalGloss?: string;
  originalOccurrenceIndex?: number;
  originalTokenId?: string;
  originalOccurrenceId?: string;
  sourceStrong?: string;
  lexiconLookup?: boolean;
  step?: StrongStepEvidence[];
  referenceSupport?: ReferenceName[];
  profile?: string;
}

export interface StrongLedgerVerse {
  ref: string;
  bookId: string;
  chapter: number;
  verse: number;
  text: string;
  tokens: StrongLedgerToken[];
  annotations: StrongLedgerAnnotation[];
  views: {
    readerHtml: string;
    advancedHtml: string;
    debugHtml: string;
  };
  inventories: {
    references: Record<ReferenceName, string[]>;
    original: string[];
    reader: string[];
    advanced: string[];
  };
  metrics: StrongLedgerVerseMetrics;
}

export interface StrongLedgerToken {
  wordIndex: number;
  text: string;
  normalized: string;
}

export interface StrongLedger {
  bible: string;
  generatedAt: string;
  inputPath: string;
  scope: string;
  split?: boolean;
  verseFiles?: Array<{ bookId: string; path: string; verses: number }>;
  method: string;
  inputFingerprint?: string;
  overrideFingerprint?: string;
  overrideFingerprintByRef?: Record<string, string>;
  translationProfile: TranslationProfile;
  references: Array<{ name: ReferenceName; path: string; verses: number }>;
  originalSources: OriginalSourceSummary[];
  outputPaths: {
    canonical: string;
    sqlite: string;
    readerTsv: string;
    advancedTsv: string;
    permissivePlan: string;
    debugJson: string;
    metrics: string;
    ledgerManifest: string;
    verseDir: string;
  };
  metrics: StrongLedgerMetrics;
  verses: StrongLedgerVerse[];
}

export interface StrongLedgerMetrics {
  bible: string;
  generatedAt: string;
  scope: string;
  verseCount: number;
  wordCount: number;
  readerVisibleStrongCount: number;
  advancedStrongCount: number;
  emptyStrongCount: number;
  phraseStrongCount: number;
  technicalStrongCount: number;
  pendingHumanCount: number;
  rejectedCount: number;
  referenceStrongOccurrenceCount: number;
  referenceStrongRepresentedCount: number;
  referenceStrongCoverage: number;
  referenceStrongCarrierCount: number;
  referenceStrongCarrierCoverage: number;
  originalStrongOccurrenceCount: number;
  originalRepresentedStrongOccurrenceCount: number;
  originalRepresentationRate: number;
  originalStrongCarrierCount: number;
  originalStrongCarrierRate: number;
  semanticMissingCount: number;
  readerMultiStrongWordCount: number;
  readerOverBudgetStrongCount: number;
  placementRiskCount: number;
  placementQuality: number;
  readerTaggedTokenCount: number;
  advancedTaggedTokenCount: number;
  readerTokenCoverage: number;
  advancedTokenCoverage: number;
  books: Record<string, StrongLedgerBookMetrics>;
}

export interface StrongLedgerBookMetrics extends Omit<
  StrongLedgerMetrics,
  "bible" | "generatedAt" | "scope" | "books"
> {
  bookId: string;
}

export interface StrongLedgerVerseMetrics {
  wordCount: number;
  readerVisibleStrongCount: number;
  advancedStrongCount: number;
  emptyStrongCount: number;
  phraseStrongCount: number;
  technicalStrongCount: number;
  pendingHumanCount: number;
  rejectedCount: number;
  referenceStrongOccurrenceCount: number;
  referenceStrongRepresentedCount: number;
  referenceStrongCoverage: number;
  referenceStrongCarrierCount: number;
  referenceStrongCarrierCoverage: number;
  originalStrongOccurrenceCount: number;
  originalRepresentedStrongOccurrenceCount: number;
  originalRepresentationRate: number;
  originalStrongCarrierCount: number;
  originalStrongCarrierRate: number;
  semanticMissingCount: number;
  readerMultiStrongWordCount: number;
  readerOverBudgetStrongCount: number;
  placementRiskCount: number;
  placementQuality: number;
  readerTaggedTokenCount: number;
  advancedTaggedTokenCount: number;
  readerTokenCoverage: number;
  advancedTokenCoverage: number;
}

export interface StrongLedgerOptions {
  bible: string;
  biblePath: string;
  outputDir: string;
  onlyRef?: string;
  writeArtifacts?: boolean;
  writeLexicalReport?: boolean;
  profileBible?: string;
  applyCuratedOverrides?: boolean;
  excludedReferenceNames?: string[];
  allowUnknownProfile?: boolean;
  /** Frozen full-Bible native-to-canonical versification manifest. */
  verseCorrespondencePath?: string;
}

interface StrongLedgerRefreshOptions extends StrongLedgerOptions {
  onlyRef: string;
}

interface ReferenceMap {
  name: ReferenceName;
  path: string;
  rows: StrongRow[];
  map: StrongVerseMap;
}

type ReferenceName = "Sg1910" | "Darby" | "DarbyR";

interface OriginalBundle {
  name: string;
  path: string;
  map: OriginalVerseMap;
  summary: OriginalSourceSummary;
}

const REFERENCES: Array<{ name: ReferenceName; path: string }> = [
  { name: "Sg1910", path: "data/strongs/Sg1910.csv" },
  { name: "Darby", path: "data/strongs/Darby.csv" },
  { name: "DarbyR", path: "data/strongs/DarbyR.csv" }
];

const STEP_ORIGINAL_SOURCES = [
  "data/external/stepbible/amalgamated/TAHOT Gen-Deu.txt",
  "data/external/stepbible/amalgamated/TAHOT Jos-Est.txt",
  "data/external/stepbible/amalgamated/TAHOT Job-Sng.txt",
  "data/external/stepbible/amalgamated/TAHOT Isa-Mal.txt",
  "data/external/stepbible/amalgamated/TAGNT Mat-Jhn.txt",
  "data/external/stepbible/amalgamated/TAGNT Act-Rev.txt"
];

const STEP_SOURCE_BOOK_RANGES = new Map<string, { start: string; end: string }>(
  [
    ["TAHOT Gen-Deu.txt", { start: "Gen", end: "Deut" }],
    ["TAHOT Jos-Est.txt", { start: "Josh", end: "Esth" }],
    ["TAHOT Job-Sng.txt", { start: "Job", end: "Song" }],
    ["TAHOT Isa-Mal.txt", { start: "Isa", end: "Mal" }],
    ["TAGNT Mat-Jhn.txt", { start: "Matt", end: "John" }],
    ["TAGNT Act-Rev.txt", { start: "Acts", end: "Rev" }]
  ]
);

const FRENCH_LEXICAL_SOURCES = {
  kaikki:
    "data/external/french-lexical/kaikki/kaikki.org-dictionary-French.jsonl",
  rezoJdmCache: "data/external/french-lexical/rezojdm-cache",
  openOffice:
    "data/external/french-lexical/openoffice/synonymes/handler/dictionary.go",
  wolf: "data/external/french-lexical/wolf/wolf-1.0b4.xml.bz2"
};

const MAX_LEXICAL_AUTOSAFE_PASSES = 32;
const STRONG_PERF_ENABLED = process.env.STRONG_PERF === "1";
const STRONG_LEDGER_INPUT_VERSION = "canonical-ledger-input-v5";
const STRONG_LEDGER_PIPELINE_SOURCES = [
  "src/align.ts",
  "src/atomicFile.ts",
  "src/bibleJson.ts",
  "src/books.ts",
  "src/completeAlignment.ts",
  "src/contentAddressedCache.ts",
  "src/curatedStrongOverrides.ts",
  "src/frenchLexicalSafety.ts",
  "src/kaikkiSqliteIndex.ts",
  "src/lexicalCandidateReport.ts",
  "src/lexicon.ts",
  "src/maximumWeightMatching.ts",
  "src/originalSource.ts",
  "src/permissiveStrongProjection.ts",
  "src/phraseTranslationLexicon.ts",
  "src/readerAlignment.ts",
  "src/render.ts",
  "src/stepOriginals.ts",
  "src/strongCsv.ts",
  "src/strongDictionaryLexicon.ts",
  "src/strongLedger.ts",
  "src/strongLedgerStore.ts",
  "src/strongPhraseLexiconStore.ts",
  "src/tokenize.ts",
  "src/translationLexicon.ts",
  "src/translationProfiles.ts",
  "src/verseBlockAlignment.ts",
  "src/verseCorrespondence.ts"
];

const TECHNICAL_STRONG = new Set([
  "H0853",
  "H0834",
  "H0871",
  "H0996",
  "H3807",
  "H5921",
  "H0413",
  "H1886",
  "H2050",
  "H3963",
  "G3588",
  "G1722",
  "G1519"
]);

export function strongLedgerInputFingerprint(
  options: StrongLedgerOptions,
  translationProfile = getTranslationProfile(
    options.profileBible ?? options.bible
  ),
  strongDictionaryInput = resolveDefaultStrongDictionaryInput()
): string {
  const excludedReferences = new Set(options.excludedReferenceNames ?? []);
  const verseCorrespondencePath = resolveVerseCorrespondencePath(options);
  const kaikkSqlite = defaultKaikkiSqlitePath(DEFAULT_KAIKKI_JSONL);
  const inputPaths = [
    options.biblePath,
    ...REFERENCES.filter(
      (reference) => !excludedReferences.has(reference.name)
    ).map((reference) => reference.path),
    ...STEP_ORIGINAL_SOURCES,
    ...(verseCorrespondencePath ? [verseCorrespondencePath] : []),
    strongDictionaryInput.path,
    DEFAULT_KAIKKI_JSONL,
    kaikkSqlite,
    DEFAULT_STRONG_PHRASE_LEXICON_SQLITE,
    FRENCH_LEXICAL_SOURCES.rezoJdmCache,
    FRENCH_LEXICAL_SOURCES.openOffice,
    FRENCH_LEXICAL_SOURCES.wolf,
    ...STRONG_LEDGER_PIPELINE_SOURCES
  ];

  return contentFingerprint({
    namespace: STRONG_LEDGER_INPUT_VERSION,
    inputPaths,
    values: {
      bible: options.bible,
      profileBible: options.profileBible ?? options.bible,
      applyCuratedOverrides: options.applyCuratedOverrides !== false,
      excludedReferenceNames: [...excludedReferences].sort(),
      strongDictionaryActivation: strongDictionaryInput.activation,
      verseCorrespondencePath: verseCorrespondencePath ?? null,
      translationProfile
    }
  });
}

export function curatedOverrideFingerprints(
  bible: string,
  overrides: CuratedStrongOverride[] = getCuratedStrongOverrides()
): Record<string, string> {
  const byRef = new Map<string, CuratedStrongOverride[]>();
  for (const override of overrides) {
    if (override.bible !== bible) continue;
    const entries = byRef.get(override.ref) ?? [];
    entries.push(override);
    byRef.set(override.ref, entries);
  }

  return Object.fromEntries(
    [...byRef]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([ref, entries]) => [
        ref,
        contentFingerprint({
          namespace: "curated-strong-overrides-by-ref-v1",
          values: entries.sort(compareCuratedOverride)
        })
      ])
  );
}

export function changedOverrideRefs(
  previous: Record<string, string> = {},
  current: Record<string, string> = {}
): string[] {
  return [...new Set([...Object.keys(previous), ...Object.keys(current)])]
    .filter((ref) => previous[ref] !== current[ref])
    .sort();
}

function fingerprintOverrideMap(fingerprints: Record<string, string>): string {
  return contentFingerprint({
    namespace: "curated-strong-overrides-v1",
    values: fingerprints
  });
}

function compareCuratedOverride(
  left: CuratedStrongOverride,
  right: CuratedStrongOverride
): number {
  return (
    left.wordIndex - right.wordIndex ||
    (left.startWordIndex ?? -1) - (right.startWordIndex ?? -1) ||
    (left.endWordIndex ?? -1) - (right.endWordIndex ?? -1) ||
    left.strong.join(" ").localeCompare(right.strong.join(" ")) ||
    left.source.localeCompare(right.source) ||
    left.reason.localeCompare(right.reason)
  );
}

export async function generateStrongLedger(
  options: StrongLedgerOptions
): Promise<StrongLedger> {
  return generateStrongLedgerWithDictionary(
    options,
    resolveDefaultStrongDictionaryInput()
  );
}

async function generateStrongLedgerWithDictionary(
  options: StrongLedgerOptions,
  strongDictionaryInput: ResolvedDefaultStrongDictionaryInput
): Promise<StrongLedger> {
  const generateStart = perfStart();
  const profileBible = options.profileBible ?? options.bible;
  if (!options.allowUnknownProfile && !hasTranslationProfile(profileBible)) {
    throw new Error(
      `missing-translation-profile:${profileBible}. Add an explicit calibrated profile or pass --allow-unknown-profile for an exploratory run.`
    );
  }
  const translationProfile = getTranslationProfile(profileBible);
  const inputFingerprint = measureSync("fingerprint ledger inputs", () =>
    strongLedgerInputFingerprint(
      options,
      translationProfile,
      strongDictionaryInput
    )
  );
  const overrideFingerprintByRef =
    options.applyCuratedOverrides === false
      ? {}
      : curatedOverrideFingerprints(options.bible);
  const overrideFingerprint = fingerprintOverrideMap(overrideFingerprintByRef);
  const curatedOverrideIndex =
    options.applyCuratedOverrides === false
      ? undefined
      : buildCuratedStrongOverrideIndex();
  const allTargetVerses = await measureAsync("read target bible", () =>
    readBibleJson(options.biblePath)
  );
  const references = await measureAsync("load Strong references", () =>
    loadReferences(options.excludedReferenceNames)
  );
  const correspondenceBlocks = await measureAsync(
    "load verse correspondence",
    () =>
      loadVerseCorrespondenceBlocks({
        options,
        targetVerses: allTargetVerses,
        references
      })
  );
  const targetByRef = new Map(
    allTargetVerses.map((verse) => [formatRef(verse), verse])
  );
  const verses = correspondenceBlocks.flatMap((block) =>
    block.targetRefs.flatMap((ref) => {
      const verse = targetByRef.get(ref);
      return verse ? [verse] : [];
    })
  );
  const scopedBooks = new Set(verses.map((verse) => verse.bookId));
  const referenceSummaries = references.map((reference) => ({
    name: reference.name,
    path: reference.path,
    verses: reference.map.size
  }));
  const originalData = await measureAsync("load STEP originals", () =>
    loadOriginalData(scopedBooks)
  );
  const originals = originalData.bundles;
  const originalSummaries = originals.map((original) => original.summary);
  const stepEvidenceByRef = originalData.evidence;
  const lexicon = measureSync("build Strong lexicon", () =>
    buildStrongLexicon(references)
  );
  const dictionaryCandidates = measureSync("load dictionary candidates", () =>
    readStrongDictionaryTranslationCandidates(strongDictionaryInput.path, {
      strict: true
    })
  );
  const translationLexicon = measureSync("build translation lexicon", () =>
    buildStrongTranslationLexicon(references, {
      dictionaryCandidates
    })
  );
  const phraseLexicon = await measureAsync("load phrase lexicon", () =>
    loadStrongPhraseLexicon(references)
  );
  const lexicalSourceCache =
    createLexicalCandidateSourceCache(dictionaryCandidates);
  await mkdir(options.outputDir, { recursive: true });

  const paths = outputPaths(options);
  const ledgerVerses: StrongLedgerVerse[] = [];
  let readerAlignMs = 0;
  let completeAlignMs = 0;
  let ledgerBuildMs = 0;

  for (const block of correspondenceBlocks) {
    if (block.targetRefs.length === 0) continue;
    const targetVerses = block.targetRefs.map((ref) => {
      const verse = targetByRef.get(ref);
      if (!verse) throw new Error(`verse-correspondence-target-missing:${ref}`);
      return verse;
    });
    const verseReferences = combineReferenceSourcesForRefs(
      references.map((reference) => ({
        name: reference.name,
        verses: reference.map
      })),
      block.canonicalRefs
    );
    const originalTokens = selectOriginalTokensForRefs(
      originals,
      block.canonicalRefs
    );
    const original = originalVerseForTargetBlock({
      targetVerse: targetVerses[0]!,
      tokens: originalTokens
    });
    const stepEvidence = selectStepEvidenceForRefs(
      stepEvidenceByRef,
      block.canonicalRefs,
      { preferAlternateRef: true }
    );

    const alignStart = perfStart();
    const projected = alignVerseBlock({
      targetVerses,
      references: verseReferences,
      original,
      lexicon,
      translationLexicon,
      phraseLexicon,
      readerPolicy: translationProfile.readerAlignment
    });
    const elapsed = perfElapsed(alignStart);
    readerAlignMs += elapsed;
    completeAlignMs += elapsed;
    const projectedReferences = projectBlockReferences({
      references: verseReferences,
      projected
    });

    for (const [index, item] of projected.entries()) {
      if (options.applyCuratedOverrides !== false) {
        applyCuratedStrongOverrides({
          bible: options.bible,
          ref: formatRef(item.verse),
          result: item.reader,
          overrideIndex: curatedOverrideIndex
        });
      }
      const ledgerBuildStart = perfStart();
      ledgerVerses.push(
        buildStrongLedgerVerse({
          bible: options.bible,
          verse: item.verse,
          reader: item.reader,
          complete: item.complete,
          original: item.original,
          stepEvidence,
          references: projectedReferences[index]!,
          profile: translationProfile
        })
      );
      ledgerBuildMs += perfElapsed(ledgerBuildStart);
    }
  }
  perfLog(
    `align ${verses.length} verses reader=${formatPerfMs(
      readerAlignMs
    )} complete=${formatPerfMs(completeAlignMs)} ledger=${formatPerfMs(
      ledgerBuildMs
    )}`
  );

  const lexicalReportOptions = {
    bible: options.bible,
    onlyRef: options.onlyRef,
    inputDir: options.outputDir,
    outputDir: lexicalCandidateOutputDir(options.bible),
    dictionaryCandidates,
    fetchJdm: false,
    fetchJdmLimit: 0,
    maxCandidatesPerEmpty: 8,
    sourceCache: lexicalSourceCache,
    ...availableFrenchLexicalSources()
  };
  let lexicalAutoSafeCount = 0;
  let residualLexicalReport:
    | Awaited<ReturnType<typeof buildLexicalCandidateReport>>
    | undefined;
  let incrementalLexicalPassRefs: Set<string> | undefined;
  let lexicalAutoSafeReachedPassLimit = false;
  let lexicalAutoSafeLastApplied = 0;
  for (let pass = 0; pass < MAX_LEXICAL_AUTOSAFE_PASSES; pass += 1) {
    const fullScopePass = incrementalLexicalPassRefs === undefined;
    const passVerses = fullScopePass
      ? ledgerVerses
      : ledgerVerses.filter((verse) =>
          incrementalLexicalPassRefs?.has(verse.ref)
        );
    if (passVerses.length === 0) break;
    const passStart = perfStart();
    const lexicalReport = await buildLexicalCandidateReport({
      ...lexicalReportOptions,
      ledger: { verses: passVerses }
    });
    const autoSafePlacements = lexicalAutoSafePlacements(lexicalReport);
    const autoSafePlacementRefs =
      lexicalAutoSafePlacementRefs(autoSafePlacements);
    const result = measureSync("apply lexical auto-safe placements", () =>
      applyLexicalAutoSafePlacementsToLedger({
        verses: ledgerVerses,
        placements: autoSafePlacements
      })
    );
    perfLog(
      `lexical auto-safe pass ${pass + 1}: ${formatPerfMs(
        perfElapsed(passStart)
      )}; verses=${passVerses.length}; applied=${result.applied}; changedRefs=${
        result.changedRefs.size
      }${formatChangedRefSample(result.changedRefs)}`
    );
    if (result.applied === 0) {
      if (fullScopePass) {
        residualLexicalReport = lexicalReport;
        break;
      }
      incrementalLexicalPassRefs = undefined;
      continue;
    }
    lexicalAutoSafeLastApplied = result.applied;
    lexicalAutoSafeCount += result.applied;
    rebuildLedgerVerses(
      ledgerVerses.filter((verse) => result.changedRefs.has(verse.ref))
    );
    incrementalLexicalPassRefs = new Set([
      ...result.changedRefs,
      ...autoSafePlacementRefs
    ]);
    if (pass === MAX_LEXICAL_AUTOSAFE_PASSES - 1) {
      lexicalAutoSafeReachedPassLimit = true;
    }
  }
  if (lexicalAutoSafeReachedPassLimit) {
    console.warn(
      `Lexical auto-safe reached pass limit after applying ${lexicalAutoSafeLastApplied} placement(s) in the final pass; inspect the residual lexical report for remaining auto-safe candidates.`
    );
  }
  if (options.writeLexicalReport !== false) {
    residualLexicalReport ??= await measureAsync(
      "build residual lexical report",
      () =>
        buildLexicalCandidateReport({
          ...lexicalReportOptions,
          ledger: { verses: ledgerVerses }
        })
    );
    const lexicalReportToWrite = residualLexicalReport;
    const permissivePlan = buildPermissivePromotionPlan({
      report: lexicalReportToWrite,
      inputFingerprint
    });
    await Promise.all([
      measureAsync("write lexical candidate report", () =>
        writeLexicalCandidateReport(
          lexicalReportToWrite,
          lexicalCandidateOutputDir(options.bible)
        )
      ),
      measureAsync("write permissive promotion plan", () =>
        writePermissivePromotionPlan(
          outputPaths(options).permissivePlan,
          permissivePlan
        )
      )
    ]);
    residualLexicalReport = undefined;
  }

  // Full-Bible inputs and lexical caches are substantially larger than the
  // final in-memory ledger. Release them before SQLite serialization so V8
  // does not need an oversized heap merely to keep already-consumed sources
  // alive across the final await.
  verses.length = 0;
  references.length = 0;
  originals.length = 0;
  stepEvidenceByRef.clear();
  lexicon.exact.clear();
  lexicon.stem.clear();
  translationLexicon.exact.clear();
  translationLexicon.stem.clear();
  translationLexicon.exactByStep?.clear();
  translationLexicon.stemByStep?.clear();
  phraseLexicon.byStrong.clear();
  phraseLexicon.byStrongFirst?.clear();
  dictionaryCandidates.length = 0;
  lexicalSourceCache.dictionaryCandidates = undefined;
  lexicalSourceCache.kaikki.clear();
  lexicalSourceCache.synonymSources.clear();
  incrementalLexicalPassRefs = undefined;

  const metrics = aggregateMetrics(
    options.bible,
    options.onlyRef,
    ledgerVerses
  );
  const bible: StrongLedger = {
    bible: options.bible,
    generatedAt: metrics.generatedAt,
    inputPath: options.biblePath,
    scope: options.onlyRef ?? "all",
    inputFingerprint,
    overrideFingerprint,
    overrideFingerprintByRef,
    method: `Canonical Strong ledger. Reader annotations come from the calibrated reader pipeline plus validated deterministic lexical auto-safe placement (${lexicalAutoSafeCount} placements). Advanced annotations add original-complete STEP TAHOT/TAGNT coverage as empty, duplicate, or extra visible annotations. STEP dStrong/eStrong evidence is preserved for lexical disambiguation; WLC/SBLGNT suffixes are not used as production lookup keys.`,
    translationProfile,
    references: referenceSummaries,
    originalSources: originalSummaries,
    outputPaths: paths,
    metrics,
    verses: ledgerVerses
  };

  if (options.writeArtifacts !== false) {
    await measureAsync("write ledger artifacts", () =>
      writeStrongLedgerOutputs(bible, paths)
    );
  }
  perfEnd("generate total", generateStart);
  return bible;
}

export async function exportStrongLedger(options: {
  bible: string;
  outputDir: string;
  mode: "reader" | "advanced";
}): Promise<string> {
  const paths = outputPaths({
    bible: options.bible,
    outputDir: options.outputDir
  });
  const outputPath =
    options.mode === "reader" ? paths.readerTsv : paths.advancedTsv;
  await exportStrongLedgerTsvSqlite({
    sqlitePath: paths.sqlite,
    bible: options.bible,
    outputPath,
    mode: options.mode
  });
  return outputPath;
}

export async function refreshStrongLedger(
  options: StrongLedgerRefreshOptions
): Promise<StrongLedger> {
  const scopes = parseRefreshScopes(options.onlyRef);
  if (scopes.length === 0) {
    throw new Error("Refresh requires --only with at least one scope.");
  }

  const paths = outputPaths(options);
  const existing = readStrongLedgerSqlite({
    sqlitePath: paths.sqlite,
    includeVerses: false
  });
  const profileBible = options.profileBible ?? options.bible;
  if (!options.allowUnknownProfile && !hasTranslationProfile(profileBible)) {
    throw new Error(`missing-translation-profile:${profileBible}`);
  }
  const strongDictionaryInput = resolveDefaultStrongDictionaryInput();
  const inputFingerprint = strongLedgerInputFingerprint(
    options,
    getTranslationProfile(profileBible),
    strongDictionaryInput
  );
  if (!existing.inputFingerprint) {
    throw new Error(
      "strong-ledger-input-fingerprint-missing: run a full generation before using scoped refresh"
    );
  }
  if (existing.inputFingerprint !== inputFingerprint) {
    throw new Error(
      "strong-ledger-input-fingerprint-mismatch: source data, derived indexes, profile, or pipeline code changed; run a full generation"
    );
  }
  const overrideFingerprintByRef =
    options.applyCuratedOverrides === false
      ? {}
      : curatedOverrideFingerprints(options.bible);
  const changedRefs = changedOverrideRefs(
    existing.overrideFingerprintByRef,
    overrideFingerprintByRef
  );
  const uncoveredChangedRefs = changedRefs.filter(
    (ref) => !scopes.some((scope) => strongRefMatchesScope(ref, scope))
  );
  if (uncoveredChangedRefs.length > 0) {
    throw new Error(
      `strong-ledger-override-scope-mismatch:${uncoveredChangedRefs
        .slice(0, 20)
        .join(
          ","
        )}: refresh every changed override scope or run a full generation`
    );
  }
  const refreshRoot = path.join(options.outputDir, ".refresh");
  const refreshedVerses: StrongLedgerVerse[] = [];

  try {
    for (const scope of scopes) {
      const scopedOutputDir = path.join(
        refreshRoot,
        sanitizeScopeForPath(scope)
      );
      const scopedLedger = await generateStrongLedgerWithDictionary(
        {
          ...options,
          onlyRef: scope,
          outputDir: scopedOutputDir,
          writeArtifacts: false,
          writeLexicalReport: false
        },
        strongDictionaryInput
      );
      if (scopedLedger.inputFingerprint !== inputFingerprint) {
        throw new Error("strong-ledger-scoped-input-fingerprint-mismatch");
      }
      refreshedVerses.push(...scopedLedger.verses);
    }
  } finally {
    await rm(refreshRoot, { recursive: true, force: true });
  }

  const method = `${existing.method} Refreshed scoped output for ${scopes.join(
    ", "
  )} without a full-Bible regeneration.`;
  const metrics = await replaceStrongLedgerSqliteVerses({
    sqlitePath: paths.sqlite,
    bible: options.bible,
    verses: refreshedVerses,
    method,
    metadata: {
      inputFingerprint,
      overrideFingerprint: fingerprintOverrideMap(overrideFingerprintByRef),
      overrideFingerprintByRef
    }
  });
  await Promise.all([
    writeFile(paths.metrics, `${JSON.stringify(metrics, null, 2)}\n`, "utf8"),
    exportStrongLedgerTsvSqlite({
      sqlitePath: paths.sqlite,
      bible: options.bible,
      outputPath: paths.readerTsv,
      mode: "reader"
    }),
    exportStrongLedgerTsvSqlite({
      sqlitePath: paths.sqlite,
      bible: options.bible,
      outputPath: paths.advancedTsv,
      mode: "advanced"
    })
  ]);

  return {
    ...existing,
    generatedAt: metrics.generatedAt,
    scope: "all",
    inputFingerprint,
    overrideFingerprint: fingerprintOverrideMap(overrideFingerprintByRef),
    overrideFingerprintByRef,
    method,
    outputPaths: paths,
    metrics,
    verses: refreshedVerses
  };
}

export async function migrateStrongLedgerToSqlite(
  options: StrongLedgerOptions
): Promise<StrongLedger> {
  const paths = outputPaths(options);
  const legacyPath = path.join(
    options.outputDir,
    `bible-${options.bible}-strong-ledger.json`
  );
  const ledger = await readLegacyStrongLedgerJson(legacyPath);
  const migrated: StrongLedger = {
    ...ledger,
    outputPaths: paths
  };
  await writeStrongLedgerOutputs(migrated, paths);
  return migrated;
}

export function mergeStrongLedgerVerseScopes(
  existingVerses: StrongLedgerVerse[],
  refreshedVerses: StrongLedgerVerse[]
): StrongLedgerVerse[] {
  const refreshedByRef = new Map(
    refreshedVerses.map((verse) => [verse.ref, verse])
  );
  const merged = existingVerses.map(
    (verse) => refreshedByRef.get(verse.ref) ?? verse
  );
  const existingRefs = new Set(existingVerses.map((verse) => verse.ref));

  for (const verse of refreshedVerses) {
    if (!existingRefs.has(verse.ref)) {
      merged.push(verse);
    }
  }

  return merged.sort(compareStrongLedgerVerseRef);
}

export function validateStrongLedgerAnnotation(options: {
  annotation: Pick<StrongLedgerAnnotation, "strong">;
  allowedStrong: Set<string>;
}): boolean {
  return options.allowedStrong.has(options.annotation.strong.toUpperCase());
}

export function renderStrongTaggedText(
  segments: TextSegment[],
  annotations: StrongLedgerAnnotation[],
  mode: "reader" | "advanced" | "debug"
): string {
  const visible = annotations.filter((annotation) =>
    isVisibleInMode(annotation, mode)
  );
  const wordCount = segments.filter(
    (segment) => segment.kind === "word"
  ).length;
  const phrasePlan = buildPhraseRenderPlan(visible, wordCount);
  const deferredMarkers = new Map<number, DeferredStrongMarker[]>();

  for (const marker of phrasePlan.markers) {
    addDeferredMarker(deferredMarkers, marker.anchorWordIndex, marker);
  }

  const renderableWordAnnotations: StrongLedgerAnnotation[] = [];
  for (const group of groupAnnotations(
    visible.filter(
      (annotation) =>
        annotation.placement === "word" ||
        (annotation.placement === "duplicate" &&
          annotation.wordIndex !== undefined)
    ),
    (annotation) => String(annotation.wordIndex)
  ).values()) {
    const wordIndex = group[0]?.wordIndex;
    if (wordIndex === undefined || wordIndex < 0 || wordIndex >= wordCount) {
      addDeferredMarker(deferredMarkers, -1, {
        anchorWordIndex: -1,
        annotations: group,
        target: "word",
        metadata: {
          marker: true,
          wordIndex
        }
      });
      continue;
    }

    const containingPhrase = phrasePlan.wrappers.find(
      (phrase) =>
        phrase.startWordIndex <= wordIndex && phrase.endWordIndex >= wordIndex
    );
    if (containingPhrase) {
      addDeferredMarker(deferredMarkers, containingPhrase.startWordIndex, {
        anchorWordIndex: containingPhrase.startWordIndex,
        annotations: group,
        target: "word",
        metadata: {
          marker: true,
          wordIndex
        }
      });
      continue;
    }

    renderableWordAnnotations.push(...group);
  }

  const renderableEmptyAnnotations: StrongLedgerAnnotation[] = [];
  for (const annotation of visible.filter(
    (item) =>
      ["empty", "technical", "not-rendered"].includes(item.placement) ||
      (item.placement === "duplicate" && item.wordIndex === undefined)
  )) {
    const insertAfterWordIndex = annotation.insertAfterWordIndex ?? -1;
    const containingPhrase = phrasePlan.wrappers.find(
      (phrase) =>
        phrase.startWordIndex <= insertAfterWordIndex &&
        phrase.endWordIndex > insertAfterWordIndex
    );

    if (containingPhrase) {
      addDeferredMarker(deferredMarkers, containingPhrase.startWordIndex, {
        anchorWordIndex: containingPhrase.startWordIndex,
        annotations: [annotation],
        target: annotation.placement,
        metadata: {
          marker: true,
          insertAfterWordIndex
        }
      });
      continue;
    }

    if (insertAfterWordIndex < -1 || insertAfterWordIndex >= wordCount) {
      addDeferredMarker(deferredMarkers, -1, {
        anchorWordIndex: -1,
        annotations: [annotation],
        target: annotation.placement,
        metadata: {
          marker: true,
          insertAfterWordIndex
        }
      });
      continue;
    }

    renderableEmptyAnnotations.push(annotation);
  }

  const words = groupAnnotations(renderableWordAnnotations, (annotation) =>
    String(annotation.wordIndex)
  );
  const empties = groupAnnotations(renderableEmptyAnnotations, (annotation) =>
    String(annotation.insertAfterWordIndex ?? -1)
  );

  let output = `${renderDeferredMarkers(
    deferredMarkers.get(-1) ?? []
  )}${renderEmptyAnnotations(empties.get("-1") ?? [])}`;
  let wordIndex = -1;
  let activePhrase:
    | {
        endWordIndex: number;
        annotations: StrongLedgerAnnotation[];
      }
    | undefined;

  for (const segment of segments) {
    if (segment.kind === "text") {
      output += escapeHtml(segment.text);
      continue;
    }

    wordIndex += 1;
    output += renderDeferredMarkers(deferredMarkers.get(wordIndex) ?? []);
    const startingPhrase = phrasePlan.byStart.get(wordIndex);
    if (startingPhrase) {
      activePhrase = {
        endWordIndex: startingPhrase.endWordIndex,
        annotations: startingPhrase.annotations
      };
      output += openStrongTag(startingPhrase.annotations, "phrase", {
        startWordIndex: wordIndex,
        endWordIndex: startingPhrase.endWordIndex
      });
    }

    if (activePhrase) {
      output += escapeHtml(segment.text);
      if (activePhrase.endWordIndex === wordIndex) {
        output += "</w>";
        activePhrase = undefined;
        output += renderEmptyAnnotations(empties.get(String(wordIndex)) ?? []);
      }
      continue;
    }

    const wordAnnotations = words.get(String(wordIndex)) ?? [];
    if (wordAnnotations.length > 0) {
      output += `${openStrongTag(wordAnnotations, "word", {
        wordIndex
      })}${escapeHtml(segment.text)}</w>`;
    } else {
      output += escapeHtml(segment.text);
    }
    output += renderEmptyAnnotations(empties.get(String(wordIndex)) ?? []);
  }

  if (activePhrase) {
    output += "</w>";
  }

  return output;
}

export function assertRenderedStrongInventory(options: {
  ref: string;
  wordCount: number;
  annotations: StrongLedgerAnnotation[];
  views: StrongLedgerVerse["views"];
}): void {
  const modes: Array<{
    mode: "reader" | "advanced" | "debug";
    html: string;
  }> = [
    { mode: "reader", html: options.views.readerHtml },
    { mode: "advanced", html: options.views.advancedHtml },
    { mode: "debug", html: options.views.debugHtml }
  ];

  for (const { mode, html } of modes) {
    const expected = countStrings(
      options.annotations
        .filter((annotation) => isVisibleInMode(annotation, mode))
        .map((annotation) =>
          expectedRenderedStrongSignature(annotation, options.wordCount)
        )
    );
    const actual = countStrings(renderedStrongSignatures(html));
    const signatures = new Set([...expected.keys(), ...actual.keys()]);
    const mismatches = [...signatures]
      .filter((signature) => expected.get(signature) !== actual.get(signature))
      .slice(0, 12)
      .map(
        (signature) =>
          `${signature}:${expected.get(signature) ?? 0}->${actual.get(signature) ?? 0}`
      );
    if (mismatches.length > 0) {
      throw new Error(
        `rendered-strong-inventory-mismatch:${options.ref}:${mode}:${mismatches.join(",")}`
      );
    }
  }
}

function expectedRenderedStrongSignature(
  annotation: StrongLedgerAnnotation,
  wordCount: number
): string {
  const strong = annotation.strong.toUpperCase();
  if (
    (annotation.placement === "word" || annotation.placement === "duplicate") &&
    annotation.wordIndex !== undefined
  ) {
    const carrier =
      annotation.wordIndex >= 0 && annotation.wordIndex < wordCount
        ? "text"
        : "marker";
    return `${strong}|word|${annotation.wordIndex}|${carrier}`;
  }
  if (annotation.placement === "phrase") {
    return `${strong}|phrase|${annotation.startWordIndex ?? ""}:${annotation.endWordIndex ?? ""}`;
  }
  return `${strong}|${annotation.placement}|${annotation.insertAfterWordIndex ?? -1}`;
}

function renderedStrongSignatures(html: string): string[] {
  const signatures: string[] = [];
  for (const match of html.matchAll(/<w\b([^>]*)>([\s\S]*?)<\/w>/giu)) {
    const attributes = match[1] ?? "";
    const body = match[2] ?? "";
    const target = readHtmlAttribute(attributes, "data-target") ?? "word";
    const strongCodes = (readHtmlAttribute(attributes, "strong") ?? "")
      .split(/\s+/u)
      .filter(Boolean)
      .map((strong) => strong.toUpperCase());
    for (const strong of strongCodes) {
      if (target === "word") {
        const index = readHtmlAttribute(attributes, "data-word-index") ?? "";
        signatures.push(
          `${strong}|word|${index}|${body.length > 0 ? "text" : "marker"}`
        );
        continue;
      }
      if (target === "phrase") {
        const start =
          readHtmlAttribute(attributes, "data-start-word-index") ?? "";
        const end = readHtmlAttribute(attributes, "data-end-word-index") ?? "";
        signatures.push(`${strong}|phrase|${start}:${end}`);
        continue;
      }
      const anchor =
        readHtmlAttribute(attributes, "data-insert-after-word-index") ?? "-1";
      signatures.push(`${strong}|${target}|${anchor}`);
    }
  }
  return signatures;
}

function readHtmlAttribute(
  attributes: string,
  name: string
): string | undefined {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`\\b${escapedName}=(["'])(.*?)\\1`, "iu").exec(
    attributes
  )?.[2];
}

function countStrings(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function buildStrongLedgerVerse(options: {
  bible: string;
  verse: BibleVerse;
  reader: ReaderAlignmentResult;
  complete: CompleteAlignmentResult;
  original?: OriginalVerse;
  stepEvidence?: Map<string, SourceStepStrongEvidence[]>;
  references: ReferenceSource[];
  profile: TranslationProfile;
}): StrongLedgerVerse {
  const tokens = getWordTokens(options.reader.segments);
  const referenceInventories = buildReferenceInventories(options.references);
  const originalOccurrences = options.original
    ? getOriginalStrongOccurrences(options.original)
    : [];
  const referenceSupport = buildReferenceSupport(referenceInventories);
  const allowedStrong = new Set([
    ...Object.values(referenceInventories).flat(),
    ...originalOccurrences.map((occurrence) => occurrence.strong)
  ]);
  const annotations = linkReaderAnnotationsToOriginalOccurrences({
    annotations: [
      ...readerPhraseAnnotations({
        assignments: options.reader.phraseAssignments,
        tokens,
        profile: options.profile,
        referenceSupport,
        allowedStrong
      }),
      ...readerWordAnnotations({
        assignments: options.reader.assignments,
        tokens,
        profile: options.profile,
        referenceSupport,
        allowedStrong
      }),
      ...readerEmptyAnnotations({
        assignments: options.reader.emptyAssignments,
        profile: options.profile,
        referenceSupport,
        allowedStrong
      })
    ],
    originalOccurrences,
    wordCount: tokens.length
  });
  const readerCounts = countVisibleReaderStrong(annotations);
  annotations.push(
    ...advancedAnnotations({
      complete: options.complete,
      tokens,
      profile: options.profile,
      referenceSupport,
      allowedStrong,
      readerCounts
    })
  );
  annotations.push(
    ...referenceOnlyAnnotations({
      referenceInventories,
      annotations,
      tokens,
      profile: options.profile,
      referenceSupport
    })
  );

  const normalizedAnnotations = annotations
    .filter((annotation) =>
      validateStrongLedgerAnnotation({ annotation, allowedStrong })
    )
    .map((annotation, index) => ({
      ...annotation,
      step: stepEvidenceForAnnotation(
        options.stepEvidence,
        annotation,
        originalOccurrences
      ),
      id: `${options.verse.bookId}.${options.verse.chapter}.${options.verse.verse}:${index}:${annotation.strong}`
    }));

  const readerHtml = renderStrongTaggedText(
    options.reader.segments,
    normalizedAnnotations,
    "reader"
  );
  const advancedHtml = renderStrongTaggedText(
    options.reader.segments,
    normalizedAnnotations,
    "advanced"
  );
  const debugHtml = renderStrongTaggedText(
    options.reader.segments,
    normalizedAnnotations,
    "debug"
  );
  assertRenderedStrongInventory({
    ref: formatRef(options.verse),
    wordCount: tokens.length,
    annotations: normalizedAnnotations,
    views: { readerHtml, advancedHtml, debugHtml }
  });
  const inventories = {
    references: referenceInventories,
    original: originalOccurrences.map((occurrence) => occurrence.strong),
    reader: normalizedAnnotations
      .filter((annotation) => annotation.visibility === "reader")
      .map((annotation) => annotation.strong),
    advanced: normalizedAnnotations
      .filter((annotation) =>
        ["reader", "advanced"].includes(annotation.visibility)
      )
      .map((annotation) => annotation.strong)
  };

  return {
    ref: formatRef(options.verse),
    bookId: options.verse.bookId,
    chapter: options.verse.chapter,
    verse: options.verse.verse,
    text: options.verse.text,
    tokens,
    annotations: normalizedAnnotations,
    views: { readerHtml, advancedHtml, debugHtml },
    inventories,
    metrics: calculateVerseMetrics(tokens.length, normalizedAnnotations, {
      references: collapseReferenceInventories(referenceInventories),
      original: originalOccurrences.map((occurrence) => occurrence.strong),
      originalCount: originalOccurrences.length,
      originalRepresentedCount: Math.min(
        originalOccurrences.length,
        options.complete.representedStrongOccurrenceCount
      )
    })
  };
}

function referenceOnlyAnnotations(options: {
  referenceInventories: Record<ReferenceName, string[]>;
  annotations: StrongLedgerAnnotation[];
  tokens: StrongLedgerToken[];
  profile: TranslationProfile;
  referenceSupport: Map<string, ReferenceName[]>;
}): StrongLedgerAnnotation[] {
  const expected = countStrings(
    collapseReferenceInventories(options.referenceInventories)
  );
  const represented = countStrings(
    options.annotations
      .filter((annotation) =>
        ["reader", "advanced"].includes(annotation.visibility)
      )
      .map((annotation) => annotation.strong)
  );
  const missing = [...expected].flatMap(([strong, count]) =>
    Array.from(
      { length: Math.max(0, count - (represented.get(strong) ?? 0)) },
      () => strong
    )
  );

  return missing.map((strong, index) => ({
    id: "",
    strong,
    visibility: "advanced",
    placement: "not-rendered",
    source: "reference-only",
    confidence: 0.3,
    reason:
      "Preserved in advanced mode because a Strong witness carries this occurrence, while STEP main-reference ownership and the target text provide no safe French carrier.",
    diagnostics: ["reference-inventory-only", "no-step-main-occurrence"],
    insertAfterWordIndex:
      options.tokens.length === 0
        ? -1
        : Math.min(
            options.tokens.length - 1,
            Math.max(
              -1,
              Math.round(
                ((index + 1) / (missing.length + 1)) * options.tokens.length
              ) - 1
            )
          ),
    lexiconLookup: false,
    referenceSupport: options.referenceSupport.get(strong) ?? [],
    profile: options.profile.bible
  }));
}

function readerPhraseAnnotations(options: {
  assignments: ReaderPhraseAssignment[];
  tokens: StrongLedgerToken[];
  profile: TranslationProfile;
  referenceSupport: Map<string, ReferenceName[]>;
  allowedStrong: Set<string>;
}): StrongLedgerAnnotation[] {
  return options.assignments.flatMap((assignment) =>
    assignment.strong.map((strong) => ({
      id: "",
      strong: strong.toUpperCase(),
      visibility: "reader" as const,
      placement: "phrase" as const,
      source: "phrase-transfer" as const,
      confidence: assignment.confidence,
      reason:
        "Visible in reader mode because the calibrated reader pipeline found a defensible French phrase carrier.",
      diagnostics: [assignment.method, assignment.source],
      startWordIndex: assignment.startWordIndex,
      endWordIndex: assignment.endWordIndex,
      normalizedPhrase: normalizedPhrase(
        options.tokens,
        assignment.startWordIndex,
        assignment.endWordIndex
      ),
      referenceSupport:
        options.referenceSupport.get(strong.toUpperCase()) ?? [],
      profile: options.profile.bible
    }))
  );
}

function readerWordAnnotations(options: {
  assignments: Map<number, AssignedStrong>;
  tokens: StrongLedgerToken[];
  profile: TranslationProfile;
  referenceSupport: Map<string, ReferenceName[]>;
  allowedStrong: Set<string>;
}): StrongLedgerAnnotation[] {
  const annotations: StrongLedgerAnnotation[] = [];

  for (const [wordIndex, assignment] of options.assignments) {
    for (const strong of assignment.strong) {
      const normalizedStrong = strong.toUpperCase();
      const source = readerAssignmentSource(assignment.method);
      annotations.push({
        id: "",
        strong: normalizedStrong,
        visibility: "reader",
        placement: "word",
        source,
        confidence: assignment.confidence,
        reason:
          "Visible in reader mode because the calibrated reader pipeline attached it to an existing French word.",
        diagnostics: [assignment.method, assignment.source],
        wordIndex,
        normalizedWord: options.tokens[wordIndex]?.normalized,
        referenceSupport: options.referenceSupport.get(normalizedStrong) ?? [],
        profile: options.profile.bible
      });
    }
  }

  return annotations;
}

function readerEmptyAnnotations(options: {
  assignments: ReaderEmptyAssignment[];
  profile: TranslationProfile;
  referenceSupport: Map<string, ReferenceName[]>;
  allowedStrong: Set<string>;
}): StrongLedgerAnnotation[] {
  return options.assignments.map((assignment) => ({
    id: "",
    strong: assignment.strong.toUpperCase(),
    visibility: "reader",
    placement: "empty",
    source: "reference-transfer",
    confidence: assignment.confidence,
    reason:
      "Visible as an empty reader Strong because multiple French reference Strong Bibles agree on an empty placement.",
    diagnostics: [assignment.method, assignment.source],
    insertAfterWordIndex: assignment.insertAfterWordIndex,
    referenceSupport:
      options.referenceSupport.get(assignment.strong.toUpperCase()) ?? [],
    profile: options.profile.bible
  }));
}

function advancedAnnotations(options: {
  complete: CompleteAlignmentResult;
  tokens: StrongLedgerToken[];
  profile: TranslationProfile;
  referenceSupport: Map<string, ReferenceName[]>;
  allowedStrong: Set<string>;
  readerCounts: Map<string, number>;
}): StrongLedgerAnnotation[] {
  const annotations: StrongLedgerAnnotation[] = [];

  for (const [wordIndex, assignment] of options.complete.wordAssignments) {
    annotations.push(
      ...completeWordAnnotations({
        wordIndex,
        assignment,
        tokens: options.tokens,
        profile: options.profile,
        referenceSupport: options.referenceSupport,
        readerCounts: options.readerCounts
      })
    );
  }

  for (const assignment of options.complete.emptyAssignments) {
    annotations.push(
      completeEmptyAnnotation({
        assignment,
        profile: options.profile,
        referenceSupport: options.referenceSupport,
        readerCounts: options.readerCounts
      })
    );
  }

  return annotations;
}

function readerAssignmentSource(
  method: AssignedStrong["method"]
): StrongSource {
  if (method.includes("curated")) return "curated-override";
  if (method.includes("dictionary")) return "dictionary-fr";
  if (method.includes("learned")) return "reference-learned";
  return "reference-transfer";
}

function completeWordAnnotations(options: {
  wordIndex: number;
  assignment: CompleteWordAssignment;
  tokens: StrongLedgerToken[];
  profile: TranslationProfile;
  referenceSupport: Map<string, ReferenceName[]>;
  readerCounts: Map<string, number>;
}): StrongLedgerAnnotation[] {
  return options.assignment.strong.map((strong, index) => {
    const normalizedStrong = strong.toUpperCase();
    const originalOccurrenceId =
      options.assignment.originalOccurrenceIds[index];
    const duplicate = consumeReaderStrong(
      options.readerCounts,
      normalizedStrong
    );
    const referenceSupport =
      options.referenceSupport.get(normalizedStrong) ?? [];

    return {
      id: "",
      strong: normalizedStrong,
      visibility: completeWordVisibility(duplicate),
      placement: duplicate ? "duplicate" : "word",
      source: "original-complete",
      confidence: duplicate
        ? Math.max(options.assignment.confidence, 0.9)
        : options.assignment.confidence,
      reason: duplicate
        ? "Already represented in reader mode; kept in debug ledger to explain the original occurrence."
        : referenceSupport.length > 0
          ? "A French Strong witness contains this code, but the original-complete pass is not independently calibrated as a reader carrier; retained only in advanced/debug mode."
          : "Visible only in advanced mode because STEP has an original Strong beyond the witness-backed normal view.",
      diagnostics: [options.assignment.method, options.assignment.source],
      wordIndex: options.wordIndex,
      normalizedWord: options.tokens[options.wordIndex]?.normalized,
      originalTokenId: options.assignment.originalTokenIds[index],
      originalOccurrenceId,
      referenceSupport,
      profile: options.profile.bible
    };
  });
}

export function completeWordVisibility(duplicate: boolean): StrongVisibility {
  return duplicate ? "hidden" : "advanced";
}

function completeEmptyAnnotation(options: {
  assignment: EmptyStrongAssignment;
  profile: TranslationProfile;
  referenceSupport: Map<string, ReferenceName[]>;
  readerCounts: Map<string, number>;
}): StrongLedgerAnnotation {
  const strong = options.assignment.strong.toUpperCase();
  const duplicate = consumeReaderStrong(options.readerCounts, strong);
  const technical = TECHNICAL_STRONG.has(strong);
  const referenceSupport = options.referenceSupport.get(strong) ?? [];

  return {
    id: "",
    strong,
    visibility: completeEmptyVisibility(duplicate),
    placement: duplicate ? "duplicate" : technical ? "technical" : "empty",
    source: "original-complete",
    confidence: options.assignment.confidence,
    reason: duplicate
      ? "Already represented in reader mode; kept in debug ledger to explain the original occurrence."
      : technical
        ? "STEP original Strong is technical or weakly rendered; exposed only in advanced/debug mode."
        : referenceSupport.length > 0
          ? "French Strong witnesses contain this code, but they do not prove an empty carrier in the target; retained only in advanced/debug mode."
          : "STEP original Strong has no reliable French word carrier; exposed as an empty Strong only in advanced/debug mode.",
    diagnostics: [options.assignment.method],
    insertAfterWordIndex: options.assignment.insertAfterWordIndex,
    originalTokenId: options.assignment.originalTokenId,
    originalOccurrenceId: options.assignment.originalOccurrenceId,
    sourceStrong: options.assignment.sourceStrong,
    lexiconLookup: !(technical && options.assignment.sourceStrong),
    referenceSupport,
    profile: options.profile.bible
  };
}

export function completeEmptyVisibility(duplicate: boolean): StrongVisibility {
  return duplicate ? "hidden" : "advanced";
}

export function applyLexicalAutoSafePlacementsToLedger(options: {
  verses: StrongLedgerVerse[];
  placements: LexicalAutoSafePlacement[];
}): { applied: number; changedRefs: Set<string> } {
  const verseByRef = new Map(options.verses.map((verse) => [verse.ref, verse]));
  const occupiedTargetsByRef = new Map(
    options.verses.map((verse) => [verse.ref, occupiedReaderTargets(verse)])
  );
  let applied = 0;
  const changedRefs = new Set<string>();

  for (const placement of options.placements) {
    const verse = verseByRef.get(placement.item.ref);
    const annotation = verse?.annotations.find(
      (annotation) => annotation.id === placement.item.annotationId
    );
    if (!verse || !annotation || !canApplyLexicalAutoSafe(annotation)) {
      continue;
    }
    const existingReader = verse.annotations.find((candidate) => {
      if (
        candidate === annotation ||
        candidate.visibility !== "reader" ||
        candidate.strong.toUpperCase() !== annotation.strong.toUpperCase()
      ) {
        return false;
      }
      const sameOccurrence =
        annotation.originalOccurrenceId !== undefined &&
        candidate.originalOccurrenceId === annotation.originalOccurrenceId;
      return (
        sameOccurrence ||
        readerAnnotationMatchesLexicalTarget(candidate, placement.candidate)
      );
    });
    if (existingReader) {
      collapseLexicalAutoSafeDuplicate(
        annotation,
        existingReader,
        annotation.originalOccurrenceId !== undefined &&
          existingReader.originalOccurrenceId ===
            annotation.originalOccurrenceId
      );
      changedRefs.add(verse.ref);
      applied += 1;
      continue;
    }
    const occupiedTargets =
      occupiedTargetsByRef.get(placement.item.ref) ?? new Set<string>();
    const targetKey = lexicalCandidateTargetKey(placement.candidate);
    if (
      targetKey &&
      lexicalCandidateConflictsWithOccupiedTarget(
        placement.candidate,
        occupiedTargets
      ) &&
      !canStackLexicalAutoSafe(placement)
    ) {
      continue;
    }
    if (!lexicalAutoSafePlacementWouldChange(annotation, placement.candidate)) {
      continue;
    }

    applyLexicalAutoSafePlacement(annotation, placement);
    changedRefs.add(verse.ref);
    if (targetKey) {
      addOccupiedLexicalTarget(occupiedTargets, placement.candidate);
    }
    occupiedTargetsByRef.set(placement.item.ref, occupiedTargets);
    applied += 1;
  }

  return { applied, changedRefs };
}

function readerAnnotationMatchesLexicalTarget(
  annotation: StrongLedgerAnnotation,
  candidate: LexicalCandidate
): boolean {
  if (
    candidate.target === "phrase" &&
    candidate.startWordIndex !== undefined &&
    candidate.endWordIndex !== undefined
  ) {
    return (
      annotation.placement === "phrase" &&
      annotation.startWordIndex === candidate.startWordIndex &&
      annotation.endWordIndex === candidate.endWordIndex
    );
  }
  return (
    annotation.placement === "word" &&
    annotation.wordIndex === candidate.wordIndex
  );
}

function collapseLexicalAutoSafeDuplicate(
  annotation: StrongLedgerAnnotation,
  existingReader: StrongLedgerAnnotation,
  sameOccurrence: boolean
): void {
  annotation.visibility = "hidden";
  annotation.placement = "duplicate";
  annotation.reason = sameOccurrence
    ? "The exact STEP occurrence is already represented by a reader annotation; the redundant lexical placement remains hidden for audit provenance."
    : "The same Strong identity is already visible on this reader carrier; the additional original occurrence remains hidden for audit provenance.";
  annotation.diagnostics = [
    ...new Set([
      ...annotation.diagnostics,
      "lexical-auto-safe",
      sameOccurrence
        ? "duplicate-reader-occurrence"
        : "duplicate-reader-carrier"
    ])
  ];
  annotation.insertAfterWordIndex = undefined;
  annotation.wordIndex = existingReader.wordIndex;
  annotation.normalizedWord = existingReader.normalizedWord;
  annotation.startWordIndex = existingReader.startWordIndex;
  annotation.endWordIndex = existingReader.endWordIndex;
  annotation.normalizedPhrase = existingReader.normalizedPhrase;
}

function lexicalAutoSafePlacementRefs(
  placements: LexicalAutoSafePlacement[]
): Set<string> {
  return new Set(placements.map((placement) => placement.item.ref));
}

function lexicalAutoSafePlacementWouldChange(
  annotation: StrongLedgerAnnotation,
  candidate: LexicalCandidate
): boolean {
  if (annotation.visibility !== "reader") return true;
  if (annotation.placement !== candidate.target) return true;

  if (
    candidate.target === "phrase" &&
    candidate.startWordIndex !== undefined &&
    candidate.endWordIndex !== undefined
  ) {
    return (
      annotation.startWordIndex !== candidate.startWordIndex ||
      annotation.endWordIndex !== candidate.endWordIndex
    );
  }

  return annotation.wordIndex !== candidate.wordIndex;
}

function formatChangedRefSample(refs: Set<string>): string {
  if (refs.size === 0) return "";
  const sample = [...refs].slice(0, 5).join(",");
  return `; refs=${sample}${refs.size > 5 ? ",..." : ""}`;
}

function canApplyLexicalAutoSafe(annotation: StrongLedgerAnnotation): boolean {
  if (annotation.lexiconLookup === false) return false;
  if (
    annotation.visibility === "reader" &&
    ["word", "phrase"].includes(annotation.placement)
  ) {
    return true;
  }
  return (
    (annotation.visibility === "reader" ||
      annotation.visibility === "advanced") &&
    annotation.placement === "empty"
  );
}

function applyLexicalAutoSafePlacement(
  annotation: StrongLedgerAnnotation,
  placement: LexicalAutoSafePlacement
): void {
  const { candidate, kind } = placement;
  const evidenceSources = candidate.evidence.map((evidence) => evidence.source);

  annotation.visibility = "reader";
  annotation.placement = candidate.target;
  annotation.source = "semantic-lexicon";
  annotation.confidence = Math.max(
    annotation.confidence,
    Math.min(0.9, candidate.score)
  );
  annotation.reason =
    "Visible in reader mode because deterministic lexical sources produced a validated auto-safe French carrier.";
  annotation.diagnostics = [
    ...new Set([
      ...annotation.diagnostics,
      "lexical-auto-safe",
      kind,
      ...evidenceSources
    ])
  ];
  annotation.insertAfterWordIndex = undefined;

  if (
    candidate.target === "phrase" &&
    candidate.startWordIndex !== undefined &&
    candidate.endWordIndex !== undefined
  ) {
    annotation.wordIndex = undefined;
    annotation.normalizedWord = undefined;
    annotation.startWordIndex = candidate.startWordIndex;
    annotation.endWordIndex = candidate.endWordIndex;
    annotation.normalizedPhrase = candidate.normalized;
    return;
  }

  annotation.wordIndex = candidate.wordIndex;
  annotation.normalizedWord = candidate.normalized;
  annotation.startWordIndex = undefined;
  annotation.endWordIndex = undefined;
  annotation.normalizedPhrase = undefined;
}

function occupiedReaderTargets(verse: StrongLedgerVerse): Set<string> {
  const targets = new Set<string>();
  for (const annotation of verse.annotations) {
    if (annotation.visibility !== "reader") continue;
    if (annotation.placement === "word" && annotation.wordIndex !== undefined) {
      targets.add(`word:${annotation.wordIndex}`);
      continue;
    }
    if (
      annotation.placement === "phrase" &&
      annotation.startWordIndex !== undefined &&
      annotation.endWordIndex !== undefined
    ) {
      targets.add(
        `phrase:${annotation.startWordIndex}:${annotation.endWordIndex}`
      );
      for (
        let wordIndex = annotation.startWordIndex;
        wordIndex <= annotation.endWordIndex;
        wordIndex += 1
      ) {
        targets.add(`word:${wordIndex}`);
      }
    }
  }
  return targets;
}

function lexicalCandidateConflictsWithOccupiedTarget(
  candidate: LexicalCandidate,
  occupiedTargets: Set<string>
): boolean {
  if (
    candidate.target !== "phrase" ||
    candidate.startWordIndex === undefined ||
    candidate.endWordIndex === undefined
  ) {
    return occupiedTargets.has(`word:${candidate.wordIndex}`);
  }

  for (
    let wordIndex = candidate.startWordIndex;
    wordIndex <= candidate.endWordIndex;
    wordIndex += 1
  ) {
    if (occupiedTargets.has(`word:${wordIndex}`)) return true;
  }
  return occupiedTargets.has(
    `phrase:${candidate.startWordIndex}:${candidate.endWordIndex}`
  );
}

function addOccupiedLexicalTarget(
  occupiedTargets: Set<string>,
  candidate: LexicalCandidate
): void {
  const targetKey = lexicalCandidateTargetKey(candidate);
  if (targetKey) occupiedTargets.add(targetKey);
  if (
    candidate.target !== "phrase" ||
    candidate.startWordIndex === undefined ||
    candidate.endWordIndex === undefined
  ) {
    return;
  }
  for (
    let wordIndex = candidate.startWordIndex;
    wordIndex <= candidate.endWordIndex;
    wordIndex += 1
  ) {
    occupiedTargets.add(`word:${wordIndex}`);
  }
}

function lexicalCandidateTargetKey(
  candidate: LexicalCandidate
): string | undefined {
  if (
    candidate.target === "phrase" &&
    candidate.startWordIndex !== undefined &&
    candidate.endWordIndex !== undefined
  ) {
    return `phrase:${candidate.startWordIndex}:${candidate.endWordIndex}`;
  }
  return `word:${candidate.wordIndex}`;
}

function canStackLexicalAutoSafe(placement: LexicalAutoSafePlacement): boolean {
  return (
    placement.kind === "group-auto-safe" ||
    placement.candidate.evidence.some(
      (evidence) => evidence.source === "number-component"
    )
  );
}

function rebuildLedgerVerses(verses: StrongLedgerVerse[]): void {
  for (const verse of verses) {
    verse.inventories = {
      ...verse.inventories,
      reader: verse.annotations
        .filter((annotation) => annotation.visibility === "reader")
        .map((annotation) => annotation.strong),
      advanced: verse.annotations
        .filter((annotation) =>
          ["reader", "advanced"].includes(annotation.visibility)
        )
        .map((annotation) => annotation.strong)
    };
    verse.metrics = calculateVerseMetrics(
      verse.tokens.length,
      verse.annotations,
      {
        references: collapseReferenceInventories(verse.inventories.references),
        original: verse.inventories.original,
        originalCount: verse.metrics.originalStrongOccurrenceCount,
        originalRepresentedCount:
          verse.metrics.originalRepresentedStrongOccurrenceCount
      }
    );
    verse.views = {
      readerHtml: renderStrongTaggedText(
        tokenizeText(verse.text),
        verse.annotations,
        "reader"
      ),
      advancedHtml: renderStrongTaggedText(
        tokenizeText(verse.text),
        verse.annotations,
        "advanced"
      ),
      debugHtml: renderStrongTaggedText(
        tokenizeText(verse.text),
        verse.annotations,
        "debug"
      )
    };
    assertRenderedStrongInventory({
      ref: verse.ref,
      wordCount: verse.tokens.length,
      annotations: verse.annotations,
      views: verse.views
    });
  }
}

function parseRefreshScopes(onlyRef: string): string[] {
  return onlyRef
    .split(",")
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0);
}

function sanitizeScopeForPath(scope: string): string {
  return scope.replace(/[^A-Za-z0-9_.-]+/gu, "_");
}

function lexicalCandidateOutputDir(bible: string): string {
  return path.join("outputs", "lexical-candidates", bible);
}

function availableFrenchLexicalSources(): {
  kaikkiPath?: string;
  jdmCacheDir?: string;
  openOfficePath?: string;
  wolfPath?: string;
} {
  return {
    kaikkiPath: existingPath(FRENCH_LEXICAL_SOURCES.kaikki),
    jdmCacheDir: existingPath(FRENCH_LEXICAL_SOURCES.rezoJdmCache),
    openOfficePath: existingPath(FRENCH_LEXICAL_SOURCES.openOffice),
    wolfPath: existingPath(FRENCH_LEXICAL_SOURCES.wolf)
  };
}

function existingPath(filePath: string): string | undefined {
  return existsSync(filePath) ? filePath : undefined;
}

function perfStart(): number {
  return STRONG_PERF_ENABLED ? performance.now() : 0;
}

function perfElapsed(start: number): number {
  return STRONG_PERF_ENABLED ? performance.now() - start : 0;
}

function perfEnd(label: string, start: number): void {
  if (!STRONG_PERF_ENABLED) return;
  perfLog(`${label}: ${formatPerfMs(performance.now() - start)}`);
}

function perfLog(message: string): void {
  if (!STRONG_PERF_ENABLED) return;
  const rssMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
  console.error(`[strong:perf] ${message}; rss=${rssMb}MB`);
}

function formatPerfMs(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

async function measureAsync<T>(
  label: string,
  action: () => Promise<T>
): Promise<T> {
  const start = perfStart();
  try {
    return await action();
  } finally {
    perfEnd(label, start);
  }
}

function measureSync<T>(label: string, action: () => T): T {
  const start = perfStart();
  try {
    return action();
  } finally {
    perfEnd(label, start);
  }
}

async function writeStrongLedgerOutputs(
  bible: StrongLedger,
  paths: StrongLedger["outputPaths"]
): Promise<void> {
  await writeStrongLedgerSqlite(bible, paths.sqlite);
  await Promise.all([
    writeFile(
      paths.metrics,
      `${JSON.stringify(bible.metrics, null, 2)}\n`,
      "utf8"
    ),
    writeTsv(paths.readerTsv, bible.verses, "reader"),
    writeTsv(paths.advancedTsv, bible.verses, "advanced")
  ]);
  await removeLegacyLedgerArtifacts(bible.bible, paths);
}

async function removeLegacyLedgerArtifacts(
  bible: string,
  paths: StrongLedger["outputPaths"]
): Promise<void> {
  const outputDir = path.dirname(paths.sqlite);
  await Promise.all([
    rm(path.join(outputDir, `bible-${bible}-strong-ledger.json`), {
      force: true
    }),
    rm(paths.debugJson, { force: true }),
    rm(paths.ledgerManifest, { force: true }),
    rm(paths.verseDir, { recursive: true, force: true }),
    rm(path.dirname(paths.ledgerManifest), { recursive: true, force: true })
  ]);
}

async function writeTsv(
  outputPath: string,
  verses: StrongLedgerVerse[],
  mode: "reader" | "advanced"
): Promise<void> {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const stream = createWriteStream(outputPath, { encoding: "utf8" });
  stream.write("book_id\tnum_chapter\tnum_verse\ttext\n");

  for (const verse of verses) {
    if (
      !stream.write(
        `${verse.bookId}\t${verse.chapter}\t${verse.verse}\t${tsvEscape(
          mode === "reader" ? verse.views.readerHtml : verse.views.advancedHtml
        )}\n`
      )
    ) {
      await onceDrain(stream);
    }
  }

  await closeStream(stream);
}

async function onceDrain(stream: NodeJS.WritableStream): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const cleanup = (): void => {
      stream.off("drain", onDrain);
      stream.off("error", onError);
    };
    const onDrain = (): void => {
      cleanup();
      resolve();
    };
    const onError = (error: Error): void => {
      cleanup();
      reject(error);
    };
    stream.once("drain", onDrain);
    stream.once("error", onError);
  });
}

async function closeStream(stream: NodeJS.WritableStream): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const cleanup = (): void => {
      stream.off("error", onError);
    };
    const onError = (error: Error): void => {
      cleanup();
      reject(error);
    };
    stream.once("error", onError);
    stream.end(() => {
      cleanup();
      resolve();
    });
  });
}

function outputPaths(
  options: Pick<StrongLedgerOptions, "bible" | "outputDir">
): StrongLedger["outputPaths"] {
  const outputDir = options.outputDir;
  const sqlite = strongLedgerSqlitePath(outputDir, options.bible);
  return {
    canonical: sqlite,
    sqlite,
    readerTsv: path.join(outputDir, `bible-${options.bible}-strong-reader.tsv`),
    advancedTsv: path.join(
      outputDir,
      `bible-${options.bible}-strong-advanced.tsv`
    ),
    permissivePlan: path.join(
      outputDir,
      `bible-${options.bible}-strong-permissive-plan.json`
    ),
    debugJson: path.join(outputDir, `bible-${options.bible}-strong-debug.json`),
    metrics: path.join(outputDir, `bible-${options.bible}-strong-metrics.json`),
    ledgerManifest: path.join(outputDir, "ledger", "manifest.json"),
    verseDir: path.join(outputDir, "verses")
  };
}

async function readLegacyStrongLedgerJson(
  canonicalPath: string
): Promise<StrongLedger> {
  const canonical = JSON.parse(
    await readFile(canonicalPath, "utf8")
  ) as StrongLedger;

  if (!canonical.split) {
    return canonical;
  }

  const verses = (
    await Promise.all(
      (canonical.verseFiles ?? []).map(async (file) => {
        const content = await readFile(file.path, "utf8");
        return JSON.parse(content) as StrongLedgerVerse[];
      })
    )
  ).flat();

  return {
    ...canonical,
    verses
  };
}

function calculateVerseMetrics(
  wordCount: number,
  annotations: StrongLedgerAnnotation[],
  expected: {
    references: string[];
    original: string[];
    originalCount: number;
    originalRepresentedCount: number;
  }
): StrongLedgerVerseMetrics {
  const readerAnnotations = annotations.filter(
    (annotation) => annotation.visibility === "reader"
  );
  const advancedVisible = annotations.filter((annotation) =>
    ["reader", "advanced"].includes(annotation.visibility)
  );
  const advancedCarriers = advancedVisible.filter((annotation) =>
    ["word", "phrase"].includes(annotation.placement)
  );
  const referenceStrongOccurrenceCount = expected.references.length;
  const referenceStrongRepresentedCount = countRepresentedOccurrences(
    expected.references,
    advancedVisible.map((annotation) => annotation.strong)
  );
  const referenceStrongCarrierCount = countRepresentedOccurrences(
    expected.references,
    advancedCarriers.map((annotation) => annotation.strong)
  );
  const originalStrongCarrierCount = countRepresentedOccurrences(
    expected.original,
    advancedCarriers.map((annotation) => annotation.strong)
  );
  const readerTaggedTokenCount = countTaggedTokens(readerAnnotations);
  const advancedTaggedTokenCount = countTaggedTokens(advancedVisible);
  const readerMultiStrongWordCount =
    countMultiStrongReaderWords(readerAnnotations);
  const readerOverBudgetStrongCount = countOverBudgetStrong(
    readerAnnotations,
    mergeStrongOccurrenceBudgets(expected.references, expected.original)
  );
  const placementRiskCount =
    readerMultiStrongWordCount + readerOverBudgetStrongCount;

  return {
    wordCount,
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
    pendingHumanCount: annotations.filter(
      (annotation) => annotation.visibility === "pending"
    ).length,
    rejectedCount: annotations.filter(
      (annotation) => annotation.visibility === "rejected"
    ).length,
    referenceStrongOccurrenceCount,
    referenceStrongRepresentedCount,
    referenceStrongCoverage: roundRatio(
      referenceStrongRepresentedCount /
        Math.max(1, referenceStrongOccurrenceCount)
    ),
    referenceStrongCarrierCount,
    referenceStrongCarrierCoverage: roundRatio(
      referenceStrongCarrierCount / Math.max(1, referenceStrongOccurrenceCount)
    ),
    originalStrongOccurrenceCount: expected.originalCount,
    originalRepresentedStrongOccurrenceCount: expected.originalRepresentedCount,
    originalRepresentationRate: roundRatio(
      expected.originalRepresentedCount / Math.max(1, expected.originalCount)
    ),
    originalStrongCarrierCount,
    originalStrongCarrierRate: roundRatio(
      originalStrongCarrierCount / Math.max(1, expected.originalCount)
    ),
    semanticMissingCount: Math.max(
      0,
      referenceStrongOccurrenceCount - referenceStrongRepresentedCount
    ),
    readerMultiStrongWordCount,
    readerOverBudgetStrongCount,
    placementRiskCount,
    placementQuality: roundRatio(
      1 - placementRiskCount / Math.max(1, readerTaggedTokenCount)
    ),
    readerTaggedTokenCount,
    advancedTaggedTokenCount,
    readerTokenCoverage: roundRatio(
      readerTaggedTokenCount / Math.max(1, wordCount)
    ),
    advancedTokenCoverage: roundRatio(
      advancedTaggedTokenCount / Math.max(1, wordCount)
    )
  };
}

function aggregateMetrics(
  bible: string,
  onlyRef: string | undefined,
  verses: StrongLedgerVerse[]
): StrongLedgerMetrics {
  const generatedAt = new Date().toISOString();
  const books: Record<string, StrongLedgerBookMetrics> = {};

  for (const verse of verses) {
    const existing = books[verse.bookId] ?? emptyBookMetrics(verse.bookId);
    addMetrics(existing, verse.metrics);
    books[verse.bookId] = existing;
  }

  for (const book of Object.values(books)) {
    finalizeCoverage(book);
  }

  const metrics: StrongLedgerMetrics = {
    bible,
    generatedAt,
    scope: onlyRef ?? "all",
    ...emptyMetricCounts(),
    books
  };

  for (const verse of verses) {
    addMetrics(metrics, verse.metrics);
  }

  finalizeCoverage(metrics);
  return metrics;
}

function emptyBookMetrics(bookId: string): StrongLedgerBookMetrics {
  return {
    bookId,
    ...emptyMetricCounts(),
    verseCount: 0
  };
}

function emptyMetricCounts(): Omit<
  StrongLedgerMetrics,
  "bible" | "generatedAt" | "scope" | "books"
> {
  return {
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
    referenceStrongCoverage: 0,
    referenceStrongCarrierCount: 0,
    referenceStrongCarrierCoverage: 0,
    originalStrongOccurrenceCount: 0,
    originalRepresentedStrongOccurrenceCount: 0,
    originalRepresentationRate: 0,
    originalStrongCarrierCount: 0,
    originalStrongCarrierRate: 0,
    semanticMissingCount: 0,
    readerMultiStrongWordCount: 0,
    readerOverBudgetStrongCount: 0,
    placementRiskCount: 0,
    placementQuality: 0,
    readerTaggedTokenCount: 0,
    advancedTaggedTokenCount: 0,
    readerTokenCoverage: 0,
    advancedTokenCoverage: 0
  };
}

function addMetrics(
  target: Omit<
    StrongLedgerMetrics,
    "bible" | "generatedAt" | "scope" | "books"
  >,
  source: StrongLedgerVerseMetrics
): void {
  target.verseCount += 1;
  target.wordCount += source.wordCount;
  target.readerVisibleStrongCount += source.readerVisibleStrongCount;
  target.advancedStrongCount += source.advancedStrongCount;
  target.emptyStrongCount += source.emptyStrongCount;
  target.phraseStrongCount += source.phraseStrongCount;
  target.technicalStrongCount += source.technicalStrongCount;
  target.pendingHumanCount += source.pendingHumanCount;
  target.rejectedCount += source.rejectedCount;
  target.referenceStrongOccurrenceCount +=
    source.referenceStrongOccurrenceCount;
  target.referenceStrongRepresentedCount +=
    source.referenceStrongRepresentedCount;
  target.referenceStrongCarrierCount += source.referenceStrongCarrierCount;
  target.originalStrongOccurrenceCount += source.originalStrongOccurrenceCount;
  target.originalRepresentedStrongOccurrenceCount +=
    source.originalRepresentedStrongOccurrenceCount;
  target.originalStrongCarrierCount += source.originalStrongCarrierCount;
  target.semanticMissingCount += source.semanticMissingCount;
  target.readerMultiStrongWordCount += source.readerMultiStrongWordCount;
  target.readerOverBudgetStrongCount += source.readerOverBudgetStrongCount;
  target.placementRiskCount += source.placementRiskCount;
  target.readerTaggedTokenCount += source.readerTaggedTokenCount;
  target.advancedTaggedTokenCount += source.advancedTaggedTokenCount;
}

function finalizeCoverage(
  target: Omit<StrongLedgerMetrics, "bible" | "generatedAt" | "scope" | "books">
): void {
  target.referenceStrongCoverage = roundRatio(
    target.referenceStrongRepresentedCount /
      Math.max(1, target.referenceStrongOccurrenceCount)
  );
  target.referenceStrongCarrierCoverage = roundRatio(
    target.referenceStrongCarrierCount /
      Math.max(1, target.referenceStrongOccurrenceCount)
  );
  target.originalRepresentationRate = roundRatio(
    target.originalRepresentedStrongOccurrenceCount /
      Math.max(1, target.originalStrongOccurrenceCount)
  );
  target.originalStrongCarrierRate = roundRatio(
    target.originalStrongCarrierCount /
      Math.max(1, target.originalStrongOccurrenceCount)
  );
  target.readerTokenCoverage = roundRatio(
    target.readerTaggedTokenCount / Math.max(1, target.wordCount)
  );
  target.advancedTokenCoverage = roundRatio(
    target.advancedTaggedTokenCount / Math.max(1, target.wordCount)
  );
  target.placementQuality = roundRatio(
    1 - target.placementRiskCount / Math.max(1, target.readerTaggedTokenCount)
  );
}

function buildReferenceInventories(
  references: ReferenceSource[]
): Record<ReferenceName, string[]> {
  return {
    Sg1910: parseStrongOccurrences(
      references.find((reference) => reference.name === "Sg1910")?.verse?.row
        .text ?? ""
    ).map((strong) => strong.toUpperCase()),
    Darby: parseStrongOccurrences(
      references.find((reference) => reference.name === "Darby")?.verse?.row
        .text ?? ""
    ).map((strong) => strong.toUpperCase()),
    DarbyR: parseStrongOccurrences(
      references.find((reference) => reference.name === "DarbyR")?.verse?.row
        .text ?? ""
    ).map((strong) => strong.toUpperCase())
  };
}

function buildReferenceSupport(
  inventories: Record<ReferenceName, string[]>
): Map<string, ReferenceName[]> {
  const support = new Map<string, ReferenceName[]>();

  for (const [name, strongCodes] of Object.entries(inventories) as Array<
    [ReferenceName, string[]]
  >) {
    for (const strong of new Set(strongCodes)) {
      const names = support.get(strong) ?? [];
      names.push(name);
      support.set(strong, names);
    }
  }

  return support;
}

function collapseReferenceInventories(
  inventories: Record<ReferenceName, string[]>
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

function countVisibleReaderStrong(
  annotations: StrongLedgerAnnotation[]
): Map<string, number> {
  return countByStrong(
    annotations
      .filter((annotation) => annotation.visibility === "reader")
      .map((annotation) => annotation.strong)
  );
}

function consumeReaderStrong(
  counts: Map<string, number>,
  strong: string
): boolean {
  const current = counts.get(strong) ?? 0;
  if (current <= 0) {
    return false;
  }
  counts.set(strong, current - 1);
  return true;
}

function countByStrong(strongCodes: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const strong of strongCodes) {
    const normalized = strong.toUpperCase();
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  return counts;
}

export function mergeStrongOccurrenceBudgets(
  ...inventories: string[][]
): string[] {
  const counts = inventories.map(countByStrong);
  const strong = new Set(counts.flatMap((items) => [...items.keys()]));
  return [...strong]
    .sort()
    .flatMap((code) =>
      Array.from(
        { length: Math.max(...counts.map((items) => items.get(code) ?? 0)) },
        () => code
      )
    );
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
  annotations: StrongLedgerAnnotation[],
  expected: string[]
): number {
  const actualCounts = countByStrong(
    annotations
      .filter((annotation) => annotation.visibility === "reader")
      .map((annotation) => annotation.strong)
  );
  const expectedCounts = countByStrong(expected);
  let overBudget = 0;

  for (const [strong, actualCount] of actualCounts) {
    overBudget += Math.max(0, actualCount - (expectedCounts.get(strong) ?? 0));
  }

  return overBudget;
}

function countMultiStrongReaderWords(
  annotations: StrongLedgerAnnotation[]
): number {
  const annotationsByWord = new Map<number, StrongLedgerAnnotation[]>();

  for (const annotation of annotations) {
    if (
      annotation.visibility !== "reader" ||
      annotation.placement !== "word" ||
      annotation.wordIndex === undefined
    ) {
      continue;
    }
    const items = annotationsByWord.get(annotation.wordIndex) ?? [];
    items.push(annotation);
    annotationsByWord.set(annotation.wordIndex, items);
  }

  return [...annotationsByWord.values()].filter(
    (items) => items.length > 1 && !isSafeNumericStack(items)
  ).length;
}

function isSafeNumericStack(annotations: StrongLedgerAnnotation[]): boolean {
  return annotations.every((annotation) =>
    annotation.step?.some((step) =>
      /(?:^|[/=;+ ])H?Ac[A-Za-z]*/u.test(step.morphology)
    )
  );
}

function countTaggedTokens(annotations: StrongLedgerAnnotation[]): number {
  const indexes = new Set<number>();

  for (const annotation of annotations) {
    if (annotation.placement === "word" && annotation.wordIndex !== undefined) {
      indexes.add(annotation.wordIndex);
      continue;
    }
    if (
      annotation.placement === "phrase" &&
      annotation.startWordIndex !== undefined &&
      annotation.endWordIndex !== undefined
    ) {
      for (
        let wordIndex = annotation.startWordIndex;
        wordIndex <= annotation.endWordIndex;
        wordIndex += 1
      ) {
        indexes.add(wordIndex);
      }
    }
  }

  return indexes.size;
}

function isVisibleInMode(
  annotation: StrongLedgerAnnotation,
  mode: "reader" | "advanced" | "debug"
): boolean {
  if (mode === "reader") return annotation.visibility === "reader";
  if (mode === "debug") return annotation.visibility !== "rejected";
  return (
    annotation.visibility === "reader" || annotation.visibility === "advanced"
  );
}

interface PhraseRenderGroup {
  startWordIndex: number;
  endWordIndex: number;
  annotations: StrongLedgerAnnotation[];
}

interface StrongTagRenderMetadata {
  marker?: boolean;
  wordIndex?: number;
  startWordIndex?: number;
  endWordIndex?: number;
  insertAfterWordIndex?: number;
}

interface DeferredStrongMarker {
  anchorWordIndex: number;
  annotations: StrongLedgerAnnotation[];
  target: string;
  metadata: StrongTagRenderMetadata;
}

function buildPhraseRenderPlan(
  annotations: StrongLedgerAnnotation[],
  wordCount: number
): {
  byStart: Map<number, PhraseRenderGroup>;
  wrappers: PhraseRenderGroup[];
  markers: DeferredStrongMarker[];
} {
  const wordCarrierIndexes = new Set(
    annotations
      .filter(
        (annotation) =>
          (annotation.placement === "word" ||
            annotation.placement === "duplicate") &&
          annotation.wordIndex !== undefined
      )
      .map((annotation) => annotation.wordIndex!)
  );
  const emptyCarrierAnchors = annotations
    .filter(
      (annotation) =>
        ["empty", "technical", "not-rendered"].includes(annotation.placement) ||
        (annotation.placement === "duplicate" &&
          annotation.wordIndex === undefined)
    )
    .map((annotation) => annotation.insertAfterWordIndex ?? -1);
  const phrases = groupAnnotations(
    annotations.filter((annotation) => annotation.placement === "phrase"),
    (annotation) => `${annotation.startWordIndex}:${annotation.endWordIndex}`
  );
  const byStart = new Map<number, PhraseRenderGroup>();
  const wrappers: PhraseRenderGroup[] = [];
  const markers: DeferredStrongMarker[] = [];
  let coveredUntil = -1;

  for (const group of [...phrases.values()].sort(
    (left, right) =>
      (left[0]?.startWordIndex ?? 0) - (right[0]?.startWordIndex ?? 0) ||
      (right[0]?.endWordIndex ?? 0) - (left[0]?.endWordIndex ?? 0)
  )) {
    const startWordIndex = group[0]?.startWordIndex;
    const endWordIndex = group[0]?.endWordIndex;
    if (
      startWordIndex === undefined ||
      endWordIndex === undefined ||
      startWordIndex < 0 ||
      endWordIndex < startWordIndex ||
      endWordIndex >= wordCount
    ) {
      markers.push({
        anchorWordIndex: -1,
        annotations: group,
        target: "phrase",
        metadata: {
          marker: true,
          startWordIndex,
          endWordIndex
        }
      });
      continue;
    }

    const masksExactCarrier =
      [...wordCarrierIndexes].some(
        (wordIndex) => wordIndex >= startWordIndex && wordIndex <= endWordIndex
      ) ||
      emptyCarrierAnchors.some(
        (anchor) => anchor >= startWordIndex && anchor < endWordIndex
      );
    if (masksExactCarrier) {
      const containingWrapper = wrappers.find(
        (wrapper) =>
          wrapper.startWordIndex <= startWordIndex &&
          wrapper.endWordIndex >= startWordIndex
      );
      markers.push({
        anchorWordIndex: containingWrapper?.startWordIndex ?? startWordIndex,
        annotations: group,
        target: "phrase",
        metadata: {
          marker: true,
          startWordIndex,
          endWordIndex
        }
      });
      continue;
    }

    if (startWordIndex <= coveredUntil) {
      const overlappingWrapper = wrappers.find(
        (wrapper) =>
          wrapper.startWordIndex <= endWordIndex &&
          wrapper.endWordIndex >= startWordIndex
      );
      markers.push({
        anchorWordIndex: overlappingWrapper?.startWordIndex ?? -1,
        annotations: group,
        target: "phrase",
        metadata: {
          marker: true,
          startWordIndex,
          endWordIndex
        }
      });
      continue;
    }

    const wrapper = {
      startWordIndex,
      endWordIndex,
      annotations: group
    };
    byStart.set(startWordIndex, wrapper);
    wrappers.push(wrapper);
    coveredUntil = endWordIndex;
  }

  return { byStart, wrappers, markers };
}

function addDeferredMarker(
  markers: Map<number, DeferredStrongMarker[]>,
  anchorWordIndex: number,
  marker: DeferredStrongMarker
): void {
  const group = markers.get(anchorWordIndex) ?? [];
  group.push(marker);
  markers.set(anchorWordIndex, group);
}

function renderDeferredMarkers(markers: DeferredStrongMarker[]): string {
  return markers
    .map(
      (marker) =>
        `${openStrongTag(
          marker.annotations,
          marker.target,
          marker.metadata
        )}</w>`
    )
    .join("");
}

function renderEmptyAnnotations(annotations: StrongLedgerAnnotation[]): string {
  return annotations
    .map(
      (annotation) =>
        `${openStrongTag([annotation], annotation.placement, {
          insertAfterWordIndex: annotation.insertAfterWordIndex ?? -1
        })}</w>`
    )
    .join("");
}

function openStrongTag(
  annotations: StrongLedgerAnnotation[],
  target: string,
  metadata: StrongTagRenderMetadata = {}
): string {
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
  const lexiconLookup = annotations.every(
    (annotation) => annotation.lexiconLookup !== false
  );
  const confidence = Math.max(
    ...annotations.map((annotation) => annotation.confidence)
  );
  const source = [
    ...new Set(annotations.map((annotation) => annotation.source))
  ]
    .filter(Boolean)
    .join("+");
  const placement = [
    ...new Set(annotations.map((annotation) => annotation.placement))
  ]
    .filter(Boolean)
    .join("+");
  const reason = annotations[0]?.reason ?? "";
  const positionAttributes = [
    metadata.marker ? ` data-marker="true"` : "",
    metadata.wordIndex !== undefined
      ? ` data-word-index="${metadata.wordIndex}"`
      : "",
    metadata.startWordIndex !== undefined
      ? ` data-start-word-index="${metadata.startWordIndex}"`
      : "",
    metadata.endWordIndex !== undefined
      ? ` data-end-word-index="${metadata.endWordIndex}"`
      : "",
    metadata.insertAfterWordIndex !== undefined
      ? ` data-insert-after-word-index="${metadata.insertAfterWordIndex}"`
      : ""
  ].join("");

  return `<w strong="${escapeHtml(strong)}" data-lexical-strong="${escapeHtml(
    lexicalStrong
  )}"${sourceStrong ? ` data-source-strong="${escapeHtml(sourceStrong)}"` : ""}${stepStrong ? ` data-step-strong="${escapeHtml(stepStrong)}"` : ""} data-lexicon="${lexiconLookup ? "true" : "false"}" data-confidence="${confidence.toFixed(
    2
  )}" data-source="${escapeHtml(source)}" data-method="${escapeHtml(
    source
  )}" data-placement="${escapeHtml(placement)}" data-target="${escapeHtml(
    target
  )}" data-empty="${
    !metadata.marker && (target === "word" || target === "phrase")
      ? "false"
      : "true"
  }"${positionAttributes} data-reason="${escapeHtml(reason)}">`;
}

function groupAnnotations<T extends StrongLedgerAnnotation>(
  annotations: T[],
  key: (annotation: T) => string
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const annotation of annotations) {
    const group = grouped.get(key(annotation)) ?? [];
    group.push(annotation);
    grouped.set(key(annotation), group);
  }

  return grouped;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function getWordTokens(segments: TextSegment[]): StrongLedgerToken[] {
  const tokens: StrongLedgerToken[] = [];
  let wordIndex = -1;

  for (const segment of segments) {
    if (segment.kind !== "word") continue;
    wordIndex += 1;
    tokens.push({
      wordIndex,
      text: segment.text,
      normalized: segment.normalized
    });
  }

  return tokens;
}

function normalizedPhrase(
  tokens: StrongLedgerToken[],
  startWordIndex: number,
  endWordIndex: number
): string {
  return tokens
    .filter(
      (token) =>
        token.wordIndex >= startWordIndex && token.wordIndex <= endWordIndex
    )
    .map((token) => token.normalized)
    .join(" ");
}

/**
 * Reader alignment is carrier-oriented while STEP evidence is occurrence-
 * oriented. Link repeated Strong codes globally by relative position so each
 * visible carrier can receive evidence from at most one original occurrence.
 */
export function linkReaderAnnotationsToOriginalOccurrences(options: {
  annotations: StrongLedgerAnnotation[];
  originalOccurrences: OriginalStrongOccurrence[];
  wordCount: number;
}): StrongLedgerAnnotation[] {
  const annotations = options.annotations.map((annotation) => ({
    ...annotation
  }));
  const annotationIndexesByStrong = new Map<string, number[]>();
  const occurrencesByStrong = new Map<string, OriginalStrongOccurrence[]>();

  for (const [index, annotation] of annotations.entries()) {
    if (annotation.originalOccurrenceId) continue;
    const strong = annotation.strong.toUpperCase();
    const indexes = annotationIndexesByStrong.get(strong) ?? [];
    indexes.push(index);
    annotationIndexesByStrong.set(strong, indexes);
  }
  for (const occurrence of options.originalOccurrences) {
    const strong = occurrence.strong.toUpperCase();
    const occurrences = occurrencesByStrong.get(strong) ?? [];
    occurrences.push(occurrence);
    occurrencesByStrong.set(strong, occurrences);
  }

  const originalDenominator = Math.max(
    1,
    ...options.originalOccurrences.map(
      (occurrence) => occurrence.ordinalTokenIndex ?? occurrence.tokenIndex
    )
  );
  const readerDenominator = Math.max(1, options.wordCount - 1);

  for (const [strong, annotationIndexes] of annotationIndexesByStrong) {
    const occurrences = occurrencesByStrong.get(strong) ?? [];
    const matches = maximumWeightMatching({
      leftCount: annotationIndexes.length,
      rightCount: occurrences.length,
      edges: annotationIndexes.flatMap((annotationIndex, left) => {
        const annotation = annotations[annotationIndex];
        if (!annotation) return [];
        const readerPosition = annotationCarrierPosition(annotation);
        return occurrences.map((occurrence, right) => {
          const ordinalTokenIndex =
            occurrence.ordinalTokenIndex ?? occurrence.tokenIndex;
          const distance = Math.abs(
            readerPosition / readerDenominator -
              ordinalTokenIndex / originalDenominator
          );
          return {
            left,
            right,
            // The tiny order term makes equal-distance repeated carriers
            // deterministic without overriding the positional objective.
            weight: 2 - distance - Math.abs(left - right) * 1e-6,
            value: { annotationIndex, occurrence }
          };
        });
      })
    });

    for (const match of matches) {
      const annotation = annotations[match.value.annotationIndex];
      if (!annotation) continue;
      annotation.originalOccurrenceId = match.value.occurrence.occurrenceId;
      annotation.sourceStrong = match.value.occurrence.sourceStrong;
    }
  }

  return annotations;
}

function annotationCarrierPosition(annotation: StrongLedgerAnnotation): number {
  if (annotation.placement === "word") return annotation.wordIndex ?? 0;
  if (annotation.placement === "phrase") {
    return (
      ((annotation.startWordIndex ?? 0) + (annotation.endWordIndex ?? 0)) / 2
    );
  }
  return Math.max(0, (annotation.insertAfterWordIndex ?? -1) + 0.5);
}

function stepEvidenceForAnnotation(
  evidenceByStrong: Map<string, SourceStepStrongEvidence[]> | undefined,
  annotation: StrongLedgerAnnotation,
  originalOccurrences: OriginalStrongOccurrence[]
): StrongStepEvidence[] | undefined {
  const evidence = evidenceByStrong?.get(annotation.strong.toUpperCase());
  if (!evidence || evidence.length === 0) return undefined;

  const occurrence = annotation.originalOccurrenceId
    ? originalOccurrences.find(
        (candidate) =>
          candidate.occurrenceId === annotation.originalOccurrenceId
      )
    : undefined;
  const selected = occurrence
    ? selectStepEvidenceForOccurrence(evidence, {
        tokenIndex: occurrence.sourceTokenIndex ?? occurrence.tokenIndex,
        sourceStrong: annotation.sourceStrong ?? occurrence.sourceStrong,
        sourceIdentity: occurrence.sourceIdentity
      })
    : uniqueStepEvidenceOccurrenceCount(evidence) === 1
      ? evidence.slice(0, 4)
      : [];

  if (selected.length === 0) return undefined;

  return selected.map((item) => ({
    source: item.source,
    classicalStrong: item.baseStrong,
    dStrong: item.stepStrong,
    tokenIndex: item.tokenIndex,
    type: item.type,
    surface: item.surface,
    transliteration: item.transliteration,
    gloss: item.gloss,
    morphology: item.morphology,
    editions: item.editions
  }));
}

function uniqueStepEvidenceOccurrenceCount(
  evidence: SourceStepStrongEvidence[]
): number {
  return new Set(
    evidence.map(
      (item) =>
        `${item.source}:${item.tokenIndex}:${item.stepStrong.toUpperCase()}`
    )
  ).size;
}

async function loadReferences(
  excludedReferenceNames: string[] = []
): Promise<ReferenceMap[]> {
  const references: ReferenceMap[] = [];
  const excluded = new Set(excludedReferenceNames);

  for (const reference of REFERENCES) {
    if (excluded.has(reference.name)) continue;
    const rows = await readStrongCsv(reference.path);
    references.push({
      ...reference,
      rows,
      map: buildStrongVerseMap(rows)
    });
  }

  return references;
}

async function loadStrongPhraseLexicon(
  references: ReferenceMap[]
): Promise<ReturnType<typeof buildStrongPhraseLexicon>> {
  const sourceFingerprint = strongPhraseLexiconSourceFingerprint(references);
  const cached = measureSync("read phrase lexicon sqlite", () =>
    readStrongPhraseLexiconSqlite({ sourceFingerprint })
  );
  if (cached) return cached;

  return measureSync("build phrase lexicon", () =>
    buildStrongPhraseLexicon(references)
  );
}

async function buildStrongPhraseLexiconIndex(): Promise<string> {
  const references = await measureAsync("load Strong references", () =>
    loadReferences()
  );
  const sourceFingerprint = strongPhraseLexiconSourceFingerprint(references);
  const lexicon = measureSync("build phrase lexicon", () =>
    buildStrongPhraseLexicon(references)
  );
  return measureAsync("write phrase lexicon sqlite", () =>
    writeStrongPhraseLexiconSqlite({ sourceFingerprint, lexicon })
  );
}

async function loadOriginalData(bookIds?: Set<string>): Promise<{
  bundles: OriginalBundle[];
  evidence: StepOriginalEvidenceIndex;
}> {
  const bundles: OriginalBundle[] = [];
  const evidence: StepOriginalEvidenceIndex = new Map();

  for (const sourcePath of stepOriginalSourcesForBooks(bookIds)) {
    if (!existsSync(sourcePath)) {
      throw new Error(`missing-step-original-source:${sourcePath}`);
    }

    const data = await readStepOriginalData([sourcePath], { bookIds });
    const source = stepOriginalSourceMetadata(sourcePath);
    bundles.push({
      name: source.name,
      path: sourcePath,
      map: data.verseMap,
      summary: summarizeOriginalSource(
        source.name,
        sourcePath,
        data.verseMap,
        source
      )
    });
    mergeStepEvidence(evidence, data.evidenceIndex);
  }

  return { bundles, evidence };
}

function mergeStepEvidence(
  target: StepOriginalEvidenceIndex,
  source: StepOriginalEvidenceIndex
): void {
  for (const [ref, byStrong] of source) {
    const targetByStrong = target.get(ref) ?? new Map();
    for (const [strong, evidence] of byStrong) {
      const items = targetByStrong.get(strong) ?? [];
      items.push(...evidence);
      targetByStrong.set(strong, items);
    }
    target.set(ref, targetByStrong);
  }
}

function stepOriginalSourcesForBooks(bookIds?: Set<string>): string[] {
  if (!bookIds || bookIds.size === 0 || bookIds.size === BOOK_IDS.length) {
    return STEP_ORIGINAL_SOURCES;
  }

  return STEP_ORIGINAL_SOURCES.filter((sourcePath) => {
    const range = STEP_SOURCE_BOOK_RANGES.get(path.basename(sourcePath));
    if (!range) return true;
    const start = bookOrderIndex(range.start);
    const end = bookOrderIndex(range.end);
    return [...bookIds].some((bookId) => {
      const index = bookOrderIndex(bookId);
      return index >= start && index <= end;
    });
  });
}

function stepOriginalSourceMetadata(
  sourcePath: string
): Pick<OriginalSourceSummary, "name" | "license" | "url"> {
  return {
    name: `STEP ${path.basename(sourcePath, ".txt")}`,
    license: "CC BY 4.0 via Tyndale House Cambridge / STEPBible-Data.",
    url: "https://github.com/STEPBible/STEPBible-Data"
  };
}

function resolveVerseCorrespondencePath(
  options: StrongLedgerOptions
): string | undefined {
  if (options.verseCorrespondencePath) {
    if (!existsSync(options.verseCorrespondencePath)) {
      throw new Error(
        `missing-verse-correspondence-manifest:${options.verseCorrespondencePath}`
      );
    }
    return options.verseCorrespondencePath;
  }
  const conventional = path.join(
    "data",
    "bibles",
    `bible-${options.bible}-verse-correspondence.json`
  );
  return existsSync(conventional) ? conventional : undefined;
}

async function loadVerseCorrespondenceBlocks(options: {
  options: StrongLedgerOptions;
  targetVerses: BibleVerse[];
  references: ReferenceMap[];
}): Promise<VerseCorrespondenceBlock[]> {
  const selected = filterVerses(options.targetVerses, options.options);
  const selectedRefs = new Set(selected.map(formatRef));
  const manifestPath = resolveVerseCorrespondencePath(options.options);
  if (!manifestPath) {
    return selected.map((verse) => ({
      kind: "identity" as const,
      targetRefs: [formatRef(verse)],
      canonicalRefs: [formatRef(verse)]
    }));
  }

  const manifest = JSON.parse(
    await readFile(manifestPath, "utf8")
  ) as VerseCorrespondenceManifest;
  if (manifest.bible !== options.options.bible) {
    throw new Error(
      `verse-correspondence-bible-mismatch:${manifest.bible}:${options.options.bible}`
    );
  }
  const targetBooks = new Set(
    options.targetVerses.map((verse) => verse.bookId)
  );
  const primaryReference = options.references[0];
  if (!primaryReference) {
    throw new Error("verse-correspondence-requires-a-canonical-reference");
  }
  validateVerseCorrespondenceManifest(manifest, {
    targetRefs: options.targetVerses.map(formatRef),
    canonicalRefs: primaryReference.rows
      .filter((row) => targetBooks.has(row.bookId))
      .map((row) => referenceKey(row.bookId, row.chapter, row.verse))
  });

  return manifest.blocks.filter((block) =>
    block.targetRefs.some((ref) => selectedRefs.has(ref))
  );
}

function selectOriginalTokensForRefs(
  originals: OriginalBundle[],
  refs: readonly string[]
): OriginalToken[] {
  const tokens: OriginalToken[] = [];
  const seen = new Set<string>();
  for (const original of originals) {
    const selection = selectStepOriginalTokensForRefs(original.map, refs, {
      preferAlternateRef: true
    });
    for (const token of selection.tokens) {
      const identity = getStepSourceIdentity(token) ?? token.id;
      if (seen.has(identity)) continue;
      seen.add(identity);
      tokens.push(token);
    }
  }
  return tokens;
}

function filterVerses(
  verses: BibleVerse[],
  options: StrongLedgerOptions
): BibleVerse[] {
  if (!options.onlyRef) {
    return verses;
  }

  const scopes = parseRefreshScopes(options.onlyRef);
  if (scopes.length > 1) {
    return verses.filter((candidate) =>
      scopes.some((scope) => verseMatchesScope(candidate, scope))
    );
  }

  return verses.filter((candidate) =>
    verseMatchesScope(candidate, options.onlyRef ?? "")
  );
}

function verseMatchesScope(candidate: BibleVerse, scope: string): boolean {
  if (scope.includes("-")) {
    const range = parseScopeRange(scope);
    if (range) {
      return (
        compareVerseRef(candidate, range.start) >= 0 &&
        compareVerseRef(candidate, range.end) <= 0
      );
    }
  }

  const [book, chapter, verse] = scope.split(".");
  if (book && candidate.bookId !== book) return false;
  if (chapter && candidate.chapter !== Number.parseInt(chapter, 10))
    return false;
  if (verse && candidate.verse !== Number.parseInt(verse, 10)) return false;
  return true;
}

function strongRefMatchesScope(ref: string, scope: string): boolean {
  const match = /^(?<bookId>[^.]+)\.(?<chapter>\d+)\.(?<verse>\d+)$/u.exec(ref);
  if (!match?.groups) return false;
  return verseMatchesScope(
    {
      bookNumber: "",
      bookId: match.groups.bookId ?? "",
      chapter: Number.parseInt(match.groups.chapter ?? "", 10),
      verse: Number.parseInt(match.groups.verse ?? "", 10),
      text: ""
    },
    scope
  );
}

function parseScopeRange(scope: string):
  | {
      start: { bookId: string; chapter: number; verse: number };
      end: { bookId: string; chapter: number; verse: number };
    }
  | undefined {
  const [rawStart, rawEnd] = scope.split("-");
  if (!rawStart || !rawEnd) return undefined;

  const start = parseScopeBound(rawStart);
  const end = parseScopeBound(rawEnd, start?.bookId);
  if (!start || !end) return undefined;

  return {
    start: {
      bookId: start.bookId,
      chapter: start.chapter ?? 1,
      verse: start.verse ?? 1
    },
    end: {
      bookId: end.bookId,
      chapter: end.chapter ?? Number.MAX_SAFE_INTEGER,
      verse: end.verse ?? Number.MAX_SAFE_INTEGER
    }
  };
}

function parseScopeBound(
  value: string,
  defaultBookId?: string
): { bookId: string; chapter?: number; verse?: number } | undefined {
  const parts = value.split(".");
  const bookId = parts[0]?.match(/^\d+$/u) ? defaultBookId : parts.shift();
  if (!bookId) return undefined;

  const [chapter, verse] = parts;
  return {
    bookId,
    chapter: chapter ? Number.parseInt(chapter, 10) : undefined,
    verse: verse ? Number.parseInt(verse, 10) : undefined
  };
}

function compareVerseRef(
  verse: BibleVerse,
  ref: { bookId: string; chapter: number; verse: number }
): number {
  const verseBookIndex = bookOrderIndex(verse.bookId);
  const refBookIndex = bookOrderIndex(ref.bookId);
  return (
    verseBookIndex - refBookIndex ||
    verse.chapter - ref.chapter ||
    verse.verse - ref.verse
  );
}

function compareStrongLedgerVerseRef(
  left: StrongLedgerVerse,
  right: StrongLedgerVerse
): number {
  return (
    bookOrderIndex(left.bookId) - bookOrderIndex(right.bookId) ||
    left.chapter - right.chapter ||
    left.verse - right.verse
  );
}

function bookOrderIndex(bookId: string): number {
  const index = BOOK_IDS.indexOf(bookId as (typeof BOOK_IDS)[number]);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function formatRef(verse: BibleVerse): string {
  return `${verse.bookId}.${verse.chapter}.${verse.verse}`;
}

function roundRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10000) / 10000;
}

function parseArgs(argv: string[]): {
  command: "generate" | "export" | "refresh" | "migrate" | "phrase-index";
  bible: string;
  onlyRef?: string;
  outputDir: string;
  mode: "reader" | "advanced";
  allowUnknownProfile: boolean;
  verseCorrespondencePath?: string;
} {
  const args = new Map<string, string>();
  const command = ["export", "refresh", "migrate", "phrase-index"].includes(
    argv[2] ?? ""
  )
    ? (argv[2] as "export" | "refresh" | "migrate" | "phrase-index")
    : "generate";

  for (let index = 3; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg?.startsWith("--")) continue;
    const key = arg.slice(2);
    const value = argv[index + 1];
    if (value && !value.startsWith("--")) {
      args.set(key, value);
      index += 1;
    } else {
      args.set(key, "true");
    }
  }

  const bible = args.get("bible") ?? "nbs";
  const requestedView = args.get("view") ?? args.get("mode");
  const mode = requestedView === "advanced" ? "advanced" : "reader";

  return {
    command,
    bible,
    onlyRef: args.get("only"),
    outputDir: args.get("output-dir") ?? path.join("outputs", "strong", bible),
    mode,
    allowUnknownProfile: args.get("allow-unknown-profile") === "true",
    verseCorrespondencePath: args.get("verse-correspondence")
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (args.command === "export") {
    const outputPath = await exportStrongLedger({
      bible: args.bible,
      outputDir: args.outputDir,
      mode: args.mode
    });
    console.log(`Exported ${args.mode} TSV: ${outputPath}`);
    return;
  }

  const biblePath = path.join("data", "bibles", `bible-${args.bible}.json`);

  if (args.command === "refresh") {
    if (!args.onlyRef) {
      throw new Error("Refresh requires --only <Book|Book.Chapter|range>.");
    }
    const result = await refreshStrongLedger({
      bible: args.bible,
      biblePath,
      outputDir: args.outputDir,
      onlyRef: args.onlyRef,
      allowUnknownProfile: args.allowUnknownProfile,
      verseCorrespondencePath: args.verseCorrespondencePath
    });
    console.log(
      `Refreshed canonical Strong ledger: ${result.outputPaths.canonical}`
    );
    console.log(`Scopes: ${args.onlyRef}`);
    console.log(
      `Reader coverage ${result.metrics.readerTokenCoverage}; advanced coverage ${result.metrics.advancedTokenCoverage}; original representation ${result.metrics.originalRepresentationRate}`
    );
    return;
  }

  if (args.command === "migrate") {
    const result = await migrateStrongLedgerToSqlite({
      bible: args.bible,
      biblePath,
      outputDir: args.outputDir,
      onlyRef: args.onlyRef
    });
    console.log(
      `Migrated canonical Strong ledger: ${result.outputPaths.sqlite}`
    );
    console.log(
      `Reader coverage ${result.metrics.readerTokenCoverage}; advanced coverage ${result.metrics.advancedTokenCoverage}; original representation ${result.metrics.originalRepresentationRate}`
    );
    return;
  }

  if (args.command === "phrase-index") {
    const sqlitePath = await buildStrongPhraseLexiconIndex();
    console.log(`Built Strong phrase lexicon index: ${sqlitePath}`);
    return;
  }

  const result = await generateStrongLedger({
    bible: args.bible,
    biblePath,
    outputDir: args.outputDir,
    onlyRef: args.onlyRef,
    allowUnknownProfile: args.allowUnknownProfile,
    verseCorrespondencePath: args.verseCorrespondencePath
  });

  console.log(
    `Generated canonical Strong ledger: ${result.outputPaths.canonical}`
  );
  console.log(`Reader TSV: ${result.outputPaths.readerTsv}`);
  console.log(`Advanced TSV: ${result.outputPaths.advancedTsv}`);
  console.log(
    `Reader coverage ${result.metrics.readerTokenCoverage}; advanced coverage ${result.metrics.advancedTokenCoverage}; original representation ${result.metrics.originalRepresentationRate}`
  );
}

if (
  process.argv.some((arg) =>
    arg.replaceAll("\\", "/").endsWith("src/strongLedger.ts")
  )
) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
