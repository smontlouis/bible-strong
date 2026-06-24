import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { type AssignedStrong, type ReferenceSource } from "./align.js";
import { readBibleJson, type BibleVerse } from "./bibleJson.js";
import { BOOK_IDS } from "./books.js";
import {
  alignCompleteVerse,
  type CompleteAlignmentResult,
  type CompleteWordAssignment,
  type EmptyStrongAssignment,
  getOriginalStrongOccurrences
} from "./completeAlignment.js";
import { applyCuratedStrongOverrides } from "./curatedStrongOverrides.js";
import { buildStrongLexicon } from "./lexicon.js";
import {
  readOriginalSourceTsv,
  summarizeOriginalSource,
  type OriginalSourceSummary,
  type OriginalVerse,
  type OriginalVerseMap
} from "./originalSource.js";
import {
  alignReaderVerse,
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
import { readStrongDictionaryTranslationCandidates } from "./strongDictionaryLexicon.js";
import {
  readStepOriginalEvidenceIndex,
  type StepOriginalEvidenceIndex,
  type StepStrongEvidence as SourceStepStrongEvidence
} from "./stepOriginals.js";
import { escapeHtml, type TextSegment } from "./tokenize.js";
import { buildStrongPhraseLexicon } from "./phraseTranslationLexicon.js";
import { buildStrongTranslationLexicon } from "./translationLexicon.js";
import {
  getTranslationProfile,
  type TranslationProfile
} from "./translationProfiles.js";

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
  | "original-complete"
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
  translationProfile: TranslationProfile;
  references: Array<{ name: ReferenceName; path: string; verses: number }>;
  originalSources: OriginalSourceSummary[];
  outputPaths: {
    canonical: string;
    readerTsv: string;
    advancedTsv: string;
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

interface StrongLedgerOptions {
  bible: string;
  biblePath: string;
  outputDir: string;
  onlyRef?: string;
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

interface OriginalBundleVerse {
  verse: OriginalVerse;
  sourceNames: string[];
}

const REFERENCES: Array<{ name: ReferenceName; path: string }> = [
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

const STEP_ORIGINAL_SOURCES = [
  "data/external/stepbible/amalgamated/TAHOT Gen-Deu.txt",
  "data/external/stepbible/amalgamated/TAHOT Jos-Est.txt",
  "data/external/stepbible/amalgamated/TAHOT Job-Sng.txt",
  "data/external/stepbible/amalgamated/TAHOT Isa-Mal.txt",
  "data/external/stepbible/amalgamated/TAGNT Mat-Jhn.txt",
  "data/external/stepbible/amalgamated/TAGNT Act-Rev.txt"
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

export async function generateStrongLedger(
  options: StrongLedgerOptions
): Promise<StrongLedger> {
  const verses = filterVerses(await readBibleJson(options.biblePath), options);
  const references = await loadReferences();
  const originals = await loadOriginalSources();
  const originalByRef = mergeOriginalSources(originals);
  const stepEvidenceByRef = await loadStepEvidence();
  const lexicon = buildStrongLexicon(references);
  const dictionaryCandidates = readStrongDictionaryTranslationCandidates();
  const translationLexicon = buildStrongTranslationLexicon(references, {
    dictionaryCandidates
  });
  const phraseLexicon = buildStrongPhraseLexicon(references);
  const translationProfile = getTranslationProfile(options.bible);
  await mkdir(options.outputDir, { recursive: true });

  const paths = outputPaths(options);
  const ledgerVerses: StrongLedgerVerse[] = [];
  const ledgerByBook = new Map<string, StrongLedgerVerse[]>();

  for (const verse of verses) {
    const key = referenceKey(verse.bookId, verse.chapter, verse.verse);
    const original = originalByRef.get(key);
    const stepEvidence = stepEvidenceByRef.get(key);
    const verseReferences = references.map((reference) => ({
      name: reference.name,
      verse: reference.map.get(key)
    }));

    const reader = alignReaderVerse({
      targetText: verse.text,
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
        : undefined,
      readerPolicy: translationProfile.readerAlignment
    });
    applyCuratedStrongOverrides({
      bible: options.bible,
      ref: formatRef(verse),
      result: reader
    });

    const complete = alignCompleteVerse({
      targetText: verse.text,
      references: verseReferences,
      lexicon,
      translationLexicon,
      original: original?.verse
    });

    const ledgerVerse = buildStrongLedgerVerse({
      bible: options.bible,
      verse,
      reader,
      complete,
      original: original?.verse,
      stepEvidence,
      references: verseReferences,
      profile: translationProfile
    });

    ledgerVerses.push(ledgerVerse);
    const bookVerses = ledgerByBook.get(verse.bookId) ?? [];
    bookVerses.push(ledgerVerse);
    ledgerByBook.set(verse.bookId, bookVerses);
  }

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
    method:
      "Canonical Strong ledger. Reader annotations come from the calibrated reader pipeline. Advanced annotations add original-complete WLC/SBLGNT coverage as technical, empty, duplicate, or extra visible annotations. Macula/original inventory verifies and explains density but does not force reader visibility.",
    translationProfile,
    references: references.map((reference) => ({
      name: reference.name,
      path: reference.path,
      verses: reference.map.size
    })),
    originalSources: originals.map((original) => original.summary),
    outputPaths: paths,
    metrics,
    verses: ledgerVerses
  };

  await writeStrongLedgerOutputs(bible, ledgerByBook, paths);
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
  const canonical = await readStrongLedger(paths.canonical);
  const outputPath =
    options.mode === "reader" ? paths.readerTsv : paths.advancedTsv;
  await writeTsv(outputPath, canonical.verses, options.mode);
  return outputPath;
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
  const phrases = buildPhraseStartMap(visible);
  const words = groupAnnotations(
    visible.filter(
      (annotation) =>
        annotation.placement === "word" ||
        (mode === "debug" &&
          annotation.placement === "duplicate" &&
          annotation.wordIndex !== undefined)
    ),
    (annotation) => String(annotation.wordIndex)
  );
  const empties = groupAnnotations(
    visible.filter((annotation) =>
      ["empty", "technical", "not-rendered"].includes(annotation.placement)
    ),
    (annotation) => String(annotation.insertAfterWordIndex ?? -1)
  );

  let output = renderEmptyAnnotations(empties.get("-1") ?? []);
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
    const startingPhrase = phrases.get(wordIndex);
    if (startingPhrase) {
      activePhrase = {
        endWordIndex: startingPhrase.endWordIndex,
        annotations: startingPhrase.annotations
      };
      output += openStrongTag(startingPhrase.annotations, "phrase");
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
      output += `${openStrongTag(wordAnnotations, "word")}${escapeHtml(
        segment.text
      )}</w>`;
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
  const annotations = [
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
  ];
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

  const normalizedAnnotations = annotations
    .filter((annotation) =>
      validateStrongLedgerAnnotation({ annotation, allowedStrong })
    )
    .map((annotation, index) => ({
      ...annotation,
      step: stepEvidenceForStrong(options.stepEvidence, annotation.strong),
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
      const source = assignment.method.includes("curated")
        ? "curated-override"
        : assignment.method.includes("learned") ||
            assignment.method.includes("dictionary")
          ? "semantic-lexicon"
          : "reference-transfer";
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

    return {
      id: "",
      strong: normalizedStrong,
      visibility: duplicate ? "hidden" : "advanced",
      placement: duplicate ? "duplicate" : "word",
      source: "original-complete",
      confidence: duplicate
        ? Math.max(options.assignment.confidence, 0.9)
        : options.assignment.confidence,
      reason: duplicate
        ? "Already represented in reader mode; kept in debug ledger to explain the original occurrence."
        : "Visible only in advanced mode because the original-complete alignment found a defensible extra carrier beyond reader density.",
      diagnostics: [options.assignment.method, options.assignment.source],
      wordIndex: options.wordIndex,
      normalizedWord: options.tokens[options.wordIndex]?.normalized,
      originalTokenId: options.assignment.originalTokenIds[index],
      originalOccurrenceId,
      referenceSupport: options.referenceSupport.get(normalizedStrong) ?? [],
      profile: options.profile.bible
    };
  });
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

  return {
    id: "",
    strong,
    visibility: duplicate ? "hidden" : "advanced",
    placement: duplicate ? "duplicate" : technical ? "technical" : "empty",
    source: "original-complete",
    confidence: options.assignment.confidence,
    reason: duplicate
      ? "Already represented in reader mode; kept in debug ledger to explain the original occurrence."
      : technical
        ? "Original Strong is technical or weakly rendered; hidden in reader mode and exposed only in advanced/debug mode."
        : "Original Strong has no reliable French word carrier; exposed as an empty Strong only in advanced/debug mode.",
    diagnostics: [options.assignment.method],
    insertAfterWordIndex: options.assignment.insertAfterWordIndex,
    originalTokenId: options.assignment.originalTokenId,
    originalOccurrenceId: options.assignment.originalOccurrenceId,
    sourceStrong: options.assignment.sourceStrong,
    lexiconLookup: !(technical && options.assignment.sourceStrong),
    referenceSupport: options.referenceSupport.get(strong) ?? [],
    profile: options.profile.bible
  };
}

async function writeStrongLedgerOutputs(
  bible: StrongLedger,
  ledgerByBook: Map<string, StrongLedgerVerse[]>,
  paths: StrongLedger["outputPaths"]
): Promise<void> {
  const split = bible.verses.length > 2000;
  const verseFiles = split
    ? await writeVerseFiles(ledgerByBook, paths.verseDir)
    : undefined;

  await writeCanonicalJson(bible, paths, verseFiles);
  await writeDebugJson(bible, paths, verseFiles);
  await Promise.all([
    writeFile(
      paths.metrics,
      `${JSON.stringify(bible.metrics, null, 2)}\n`,
      "utf8"
    ),
    writeTsv(paths.readerTsv, bible.verses, "reader"),
    writeTsv(paths.advancedTsv, bible.verses, "advanced"),
    verseFiles
      ? writeLedgerManifestFromFiles(verseFiles, paths.ledgerManifest)
      : writeLedgerFiles(ledgerByBook, paths.ledgerManifest)
  ]);
}

async function writeCanonicalJson(
  bible: StrongLedger,
  paths: StrongLedger["outputPaths"],
  verseFiles?: Array<{ bookId: string; path: string; verses: number }>
): Promise<void> {
  if (!verseFiles) {
    await writeFile(
      paths.canonical,
      `${JSON.stringify(bible, null, 2)}\n`,
      "utf8"
    );
    return;
  }

  const manifest: StrongLedger = {
    ...bible,
    split: true,
    verseFiles,
    verses: []
  };
  await writeFile(
    paths.canonical,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );
}

async function writeDebugJson(
  bible: StrongLedger,
  paths: StrongLedger["outputPaths"],
  verseFiles?: Array<{ bookId: string; path: string; verses: number }>
): Promise<void> {
  if (!verseFiles) {
    await writeFile(
      paths.debugJson,
      `${JSON.stringify(bible, null, 2)}\n`,
      "utf8"
    );
    return;
  }

  const debug: StrongLedger = {
    ...bible,
    split: true,
    verseFiles,
    verses: []
  };
  await writeFile(
    paths.debugJson,
    `${JSON.stringify(debug, null, 2)}\n`,
    "utf8"
  );
}

async function writeVerseFiles(
  ledgerByBook: Map<string, StrongLedgerVerse[]>,
  verseDir: string
): Promise<Array<{ bookId: string; path: string; verses: number }>> {
  await mkdir(verseDir, { recursive: true });
  const files: Array<{ bookId: string; path: string; verses: number }> = [];

  for (const [bookId, verses] of ledgerByBook) {
    const versePath = path.join(verseDir, `${bookId}.json`);
    await writeFile(versePath, `${JSON.stringify(verses, null, 2)}\n`, "utf8");
    files.push({ bookId, path: versePath, verses: verses.length });
  }

  return files;
}

async function writeLedgerFiles(
  ledgerByBook: Map<string, StrongLedgerVerse[]>,
  manifestPath: string
): Promise<void> {
  const ledgerDir = path.dirname(manifestPath);
  await mkdir(ledgerDir, { recursive: true });
  const books: Array<{ bookId: string; path: string; verses: number }> = [];

  for (const [bookId, verses] of ledgerByBook) {
    const bookPath = path.join(ledgerDir, `${bookId}.json`);
    await writeFile(bookPath, `${JSON.stringify(verses, null, 2)}\n`, "utf8");
    books.push({ bookId, path: bookPath, verses: verses.length });
  }

  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        books
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

async function writeLedgerManifestFromFiles(
  verseFiles: Array<{ bookId: string; path: string; verses: number }>,
  manifestPath: string
): Promise<void> {
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        books: verseFiles
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

async function writeTsv(
  outputPath: string,
  verses: StrongLedgerVerse[],
  mode: "reader" | "advanced"
): Promise<void> {
  const lines = ["book_id\tnum_chapter\tnum_verse\ttext"];

  for (const verse of verses) {
    lines.push(
      `${verse.bookId}\t${verse.chapter}\t${verse.verse}\t${tsvEscape(
        mode === "reader" ? verse.views.readerHtml : verse.views.advancedHtml
      )}`
    );
  }

  await writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");
}

function outputPaths(
  options: Pick<StrongLedgerOptions, "bible" | "outputDir">
): StrongLedger["outputPaths"] {
  const outputDir = options.outputDir;
  return {
    canonical: path.join(
      outputDir,
      `bible-${options.bible}-strong-ledger.json`
    ),
    readerTsv: path.join(outputDir, `bible-${options.bible}-strong-reader.tsv`),
    advancedTsv: path.join(
      outputDir,
      `bible-${options.bible}-strong-advanced.tsv`
    ),
    debugJson: path.join(outputDir, `bible-${options.bible}-strong-debug.json`),
    metrics: path.join(outputDir, `bible-${options.bible}-strong-metrics.json`),
    ledgerManifest: path.join(outputDir, "ledger", "manifest.json"),
    verseDir: path.join(outputDir, "verses")
  };
}

async function readStrongLedger(canonicalPath: string): Promise<StrongLedger> {
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
  const readerOverBudgetStrongCount = countOverBudgetStrong(readerAnnotations, [
    ...expected.references,
    ...expected.original
  ]);
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
  const countsByWord = new Map<number, number>();

  for (const annotation of annotations) {
    if (
      annotation.visibility !== "reader" ||
      annotation.placement !== "word" ||
      annotation.wordIndex === undefined
    ) {
      continue;
    }
    countsByWord.set(
      annotation.wordIndex,
      (countsByWord.get(annotation.wordIndex) ?? 0) + 1
    );
  }

  return [...countsByWord.values()].filter((count) => count > 1).length;
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

function buildPhraseStartMap(annotations: StrongLedgerAnnotation[]): Map<
  number,
  {
    endWordIndex: number;
    annotations: StrongLedgerAnnotation[];
  }
> {
  const phrases = groupAnnotations(
    annotations.filter(
      (annotation) =>
        annotation.placement === "phrase" &&
        annotation.startWordIndex !== undefined &&
        annotation.endWordIndex !== undefined
    ),
    (annotation) => `${annotation.startWordIndex}:${annotation.endWordIndex}`
  );
  const byStart = new Map<
    number,
    {
      endWordIndex: number;
      annotations: StrongLedgerAnnotation[];
    }
  >();
  let coveredUntil = -1;

  for (const group of [...phrases.values()].sort(
    (left, right) =>
      (left[0]?.startWordIndex ?? 0) - (right[0]?.startWordIndex ?? 0) ||
      (right[0]?.endWordIndex ?? 0) - (left[0]?.endWordIndex ?? 0)
  )) {
    const startWordIndex = group[0]?.startWordIndex ?? -1;
    const endWordIndex = group[0]?.endWordIndex ?? -1;
    if (startWordIndex <= coveredUntil) continue;
    if (endWordIndex < startWordIndex) continue;
    byStart.set(startWordIndex, { endWordIndex, annotations: group });
    coveredUntil = endWordIndex;
  }

  return byStart;
}

function renderEmptyAnnotations(annotations: StrongLedgerAnnotation[]): string {
  return annotations
    .map(
      (annotation) => `${openStrongTag([annotation], annotation.placement)}</w>`
    )
    .join("");
}

function openStrongTag(
  annotations: StrongLedgerAnnotation[],
  target: string
): string {
  const strong = annotations
    .map((annotation) => annotation.sourceStrong ?? annotation.strong)
    .join(" ");
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

  return `<w strong="${escapeHtml(strong)}" data-lexical-strong="${escapeHtml(
    lexicalStrong
  )}" data-lexicon="${lexiconLookup ? "true" : "false"}" data-confidence="${confidence.toFixed(
    2
  )}" data-source="${escapeHtml(source)}" data-method="${escapeHtml(
    source
  )}" data-placement="${escapeHtml(placement)}" data-target="${escapeHtml(
    target
  )}" data-empty="${target === "word" || target === "phrase" ? "false" : "true"}" data-reason="${escapeHtml(
    reason
  )}">`;
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

function stepEvidenceForStrong(
  evidenceByStrong: Map<string, SourceStepStrongEvidence[]> | undefined,
  strong: string
): StrongStepEvidence[] | undefined {
  const evidence = evidenceByStrong?.get(strong.toUpperCase());
  if (!evidence || evidence.length === 0) return undefined;

  return evidence.slice(0, 4).map((item) => ({
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

async function loadStepEvidence(): Promise<StepOriginalEvidenceIndex> {
  const paths = STEP_ORIGINAL_SOURCES.filter((sourcePath) =>
    existsSync(sourcePath)
  );
  if (paths.length === 0) {
    return new Map();
  }
  return readStepOriginalEvidenceIndex(paths);
}

async function loadReferences(): Promise<ReferenceMap[]> {
  const references: ReferenceMap[] = [];

  for (const reference of REFERENCES) {
    const rows = await readStrongCsv(reference.path);
    references.push({
      ...reference,
      rows,
      map: buildStrongVerseMap(rows)
    });
  }

  return references;
}

async function loadOriginalSources(): Promise<OriginalBundle[]> {
  const bundles: OriginalBundle[] = [];

  for (const source of ORIGINAL_SOURCES) {
    if (!existsSync(source.path)) {
      continue;
    }
    const map = await readOriginalSourceTsv(source.path);
    bundles.push({
      name: source.name,
      path: source.path,
      map,
      summary: summarizeOriginalSource(source.name, source.path, map, source)
    });
  }

  return bundles;
}

function mergeOriginalSources(
  originals: OriginalBundle[]
): Map<string, OriginalBundleVerse> {
  const merged = new Map<string, OriginalBundleVerse>();

  for (const original of originals) {
    for (const [key, verse] of original.map) {
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, {
          verse: {
            ...verse,
            tokens: [...verse.tokens],
            strongSet: new Set(verse.strongSet)
          },
          sourceNames: [original.name]
        });
        continue;
      }

      existing.verse.tokens.push(...verse.tokens);
      for (const strong of verse.strongSet) {
        existing.verse.strongSet.add(strong);
      }
      existing.sourceNames.push(original.name);
    }
  }

  return merged;
}

function filterVerses(
  verses: BibleVerse[],
  options: StrongLedgerOptions
): BibleVerse[] {
  if (!options.onlyRef) {
    return verses;
  }

  if (options.onlyRef.includes("-")) {
    const range = parseScopeRange(options.onlyRef);
    if (range) {
      return verses.filter(
        (candidate) =>
          compareVerseRef(candidate, range.start) >= 0 &&
          compareVerseRef(candidate, range.end) <= 0
      );
    }
  }

  const [book, chapter, verse] = options.onlyRef.split(".");
  return verses.filter((candidate) => {
    if (book && candidate.bookId !== book) return false;
    if (chapter && candidate.chapter !== Number.parseInt(chapter, 10))
      return false;
    if (verse && candidate.verse !== Number.parseInt(verse, 10)) return false;
    return true;
  });
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
  command: "generate" | "export";
  bible: string;
  onlyRef?: string;
  outputDir: string;
  mode: "reader" | "advanced";
} {
  const args = new Map<string, string>();
  const command = argv[2] === "export" ? "export" : "generate";

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
    mode
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
  const result = await generateStrongLedger({
    bible: args.bible,
    biblePath,
    outputDir: args.outputDir,
    onlyRef: args.onlyRef
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
