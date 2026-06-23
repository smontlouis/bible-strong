import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { type AssignedStrong, type ReferenceSource } from "./align.js";
import { readBibleJson, type BibleVerse } from "./bibleJson.js";
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

export interface EnrichedStrongAnnotation {
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
  referenceSupport?: ReferenceName[];
  profile?: string;
}

export interface EnrichedVerse {
  ref: string;
  bookId: string;
  chapter: number;
  verse: number;
  text: string;
  tokens: EnrichedToken[];
  annotations: EnrichedStrongAnnotation[];
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
  metrics: EnrichedVerseMetrics;
}

export interface EnrichedToken {
  wordIndex: number;
  text: string;
  normalized: string;
}

export interface EnrichedStrongBible {
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
  metrics: EnrichedMetrics;
  verses: EnrichedVerse[];
}

export interface EnrichedMetrics {
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
  originalStrongOccurrenceCount: number;
  originalRepresentedStrongOccurrenceCount: number;
  originalRepresentationRate: number;
  semanticMissingCount: number;
  readerTaggedTokenCount: number;
  advancedTaggedTokenCount: number;
  readerTokenCoverage: number;
  advancedTokenCoverage: number;
  books: Record<string, EnrichedBookMetrics>;
}

export interface EnrichedBookMetrics extends Omit<
  EnrichedMetrics,
  "bible" | "generatedAt" | "scope" | "books"
> {
  bookId: string;
}

export interface EnrichedVerseMetrics {
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
  originalStrongOccurrenceCount: number;
  originalRepresentedStrongOccurrenceCount: number;
  originalRepresentationRate: number;
  semanticMissingCount: number;
  readerTaggedTokenCount: number;
  advancedTaggedTokenCount: number;
  readerTokenCoverage: number;
  advancedTokenCoverage: number;
}

interface EnrichedOptions {
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

const TECHNICAL_STRONG = new Set([
  "H0853",
  "H0834",
  "H0996",
  "H5921",
  "H0413",
  "G3588",
  "G1722",
  "G1519"
]);

export async function generateEnrichedStrongBible(
  options: EnrichedOptions
): Promise<EnrichedStrongBible> {
  const verses = filterVerses(await readBibleJson(options.biblePath), options);
  const references = await loadReferences();
  const originals = await loadOriginalSources();
  const originalByRef = mergeOriginalSources(originals);
  const lexicon = buildStrongLexicon(references);
  const translationLexicon = buildStrongTranslationLexicon(references);
  const phraseLexicon = buildStrongPhraseLexicon(references);
  const translationProfile = getTranslationProfile(options.bible);
  await mkdir(options.outputDir, { recursive: true });

  const paths = outputPaths(options);
  const enrichedVerses: EnrichedVerse[] = [];
  const ledgerByBook = new Map<string, EnrichedVerse[]>();

  for (const verse of verses) {
    const key = referenceKey(verse.bookId, verse.chapter, verse.verse);
    const original = originalByRef.get(key);
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

    const enriched = buildEnrichedVerse({
      bible: options.bible,
      verse,
      reader,
      complete,
      original: original?.verse,
      references: verseReferences,
      profile: translationProfile
    });

    enrichedVerses.push(enriched);
    const bookVerses = ledgerByBook.get(verse.bookId) ?? [];
    bookVerses.push(enriched);
    ledgerByBook.set(verse.bookId, bookVerses);
  }

  const metrics = aggregateMetrics(
    options.bible,
    options.onlyRef,
    enrichedVerses
  );
  const bible: EnrichedStrongBible = {
    bible: options.bible,
    generatedAt: metrics.generatedAt,
    inputPath: options.biblePath,
    scope: options.onlyRef ?? "all",
    method:
      "Canonical enriched Strong Bible. Reader annotations come from the calibrated hybrid reader pipeline. Advanced annotations add original-complete WLC/SBLGNT coverage as technical, empty, duplicate, or extra visible annotations. Macula/original inventory verifies and explains density but does not force reader visibility.",
    translationProfile,
    references: references.map((reference) => ({
      name: reference.name,
      path: reference.path,
      verses: reference.map.size
    })),
    originalSources: originals.map((original) => original.summary),
    outputPaths: paths,
    metrics,
    verses: enrichedVerses
  };

  await writeEnrichedOutputs(bible, ledgerByBook, paths);
  return bible;
}

export async function exportEnrichedStrongBible(options: {
  bible: string;
  outputDir: string;
  mode: "reader" | "advanced";
}): Promise<string> {
  const paths = outputPaths({
    bible: options.bible,
    outputDir: options.outputDir
  });
  const canonical = await readEnrichedStrongBible(paths.canonical);
  const outputPath =
    options.mode === "reader" ? paths.readerTsv : paths.advancedTsv;
  await writeTsv(outputPath, canonical.verses, options.mode);
  return outputPath;
}

export function validateEnrichedAnnotation(options: {
  annotation: Pick<EnrichedStrongAnnotation, "strong">;
  allowedStrong: Set<string>;
}): boolean {
  return options.allowedStrong.has(options.annotation.strong.toUpperCase());
}

export function renderEnrichedTaggedText(
  segments: TextSegment[],
  annotations: EnrichedStrongAnnotation[],
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
        annotations: EnrichedStrongAnnotation[];
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

function buildEnrichedVerse(options: {
  bible: string;
  verse: BibleVerse;
  reader: ReaderAlignmentResult;
  complete: CompleteAlignmentResult;
  original?: OriginalVerse;
  references: ReferenceSource[];
  profile: TranslationProfile;
}): EnrichedVerse {
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
      validateEnrichedAnnotation({ annotation, allowedStrong })
    )
    .map((annotation, index) => ({
      ...annotation,
      id: `${options.verse.bookId}.${options.verse.chapter}.${options.verse.verse}:${index}:${annotation.strong}`
    }));

  const readerHtml = renderEnrichedTaggedText(
    options.reader.segments,
    normalizedAnnotations,
    "reader"
  );
  const advancedHtml = renderEnrichedTaggedText(
    options.reader.segments,
    normalizedAnnotations,
    "advanced"
  );
  const debugHtml = renderEnrichedTaggedText(
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
  tokens: EnrichedToken[];
  profile: TranslationProfile;
  referenceSupport: Map<string, ReferenceName[]>;
  allowedStrong: Set<string>;
}): EnrichedStrongAnnotation[] {
  return options.assignments.flatMap((assignment) =>
    assignment.strong.map((strong) => ({
      id: "",
      strong: strong.toUpperCase(),
      visibility: "reader" as const,
      placement: "phrase" as const,
      source: "phrase-transfer" as const,
      confidence: assignment.confidence,
      reason:
        "Visible in reader mode because the calibrated hybrid pipeline found a defensible French phrase carrier.",
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
  tokens: EnrichedToken[];
  profile: TranslationProfile;
  referenceSupport: Map<string, ReferenceName[]>;
  allowedStrong: Set<string>;
}): EnrichedStrongAnnotation[] {
  const annotations: EnrichedStrongAnnotation[] = [];

  for (const [wordIndex, assignment] of options.assignments) {
    for (const strong of assignment.strong) {
      const normalizedStrong = strong.toUpperCase();
      const source = assignment.method.includes("curated")
        ? "curated-override"
        : assignment.method.includes("learned")
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
          "Visible in reader mode because the calibrated hybrid pipeline attached it to an existing French word.",
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
}): EnrichedStrongAnnotation[] {
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
  tokens: EnrichedToken[];
  profile: TranslationProfile;
  referenceSupport: Map<string, ReferenceName[]>;
  allowedStrong: Set<string>;
  readerCounts: Map<string, number>;
}): EnrichedStrongAnnotation[] {
  const annotations: EnrichedStrongAnnotation[] = [];

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
  tokens: EnrichedToken[];
  profile: TranslationProfile;
  referenceSupport: Map<string, ReferenceName[]>;
  readerCounts: Map<string, number>;
}): EnrichedStrongAnnotation[] {
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
}): EnrichedStrongAnnotation {
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
    referenceSupport: options.referenceSupport.get(strong) ?? [],
    profile: options.profile.bible
  };
}

async function writeEnrichedOutputs(
  bible: EnrichedStrongBible,
  ledgerByBook: Map<string, EnrichedVerse[]>,
  paths: EnrichedStrongBible["outputPaths"]
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
  bible: EnrichedStrongBible,
  paths: EnrichedStrongBible["outputPaths"],
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

  const manifest: EnrichedStrongBible = {
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
  bible: EnrichedStrongBible,
  paths: EnrichedStrongBible["outputPaths"],
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

  const debug: EnrichedStrongBible = {
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
  ledgerByBook: Map<string, EnrichedVerse[]>,
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
  ledgerByBook: Map<string, EnrichedVerse[]>,
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
  verses: EnrichedVerse[],
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
  options: Pick<EnrichedOptions, "bible" | "outputDir">
): EnrichedStrongBible["outputPaths"] {
  const outputDir = options.outputDir;
  return {
    canonical: path.join(
      outputDir,
      `bible-${options.bible}-strong-enriched.json`
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

async function readEnrichedStrongBible(
  canonicalPath: string
): Promise<EnrichedStrongBible> {
  const canonical = JSON.parse(
    await readFile(canonicalPath, "utf8")
  ) as EnrichedStrongBible;

  if (!canonical.split) {
    return canonical;
  }

  const verses = (
    await Promise.all(
      (canonical.verseFiles ?? []).map(async (file) => {
        const content = await readFile(file.path, "utf8");
        return JSON.parse(content) as EnrichedVerse[];
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
  annotations: EnrichedStrongAnnotation[],
  expected: {
    references: string[];
    originalCount: number;
    originalRepresentedCount: number;
  }
): EnrichedVerseMetrics {
  const readerAnnotations = annotations.filter(
    (annotation) => annotation.visibility === "reader"
  );
  const advancedVisible = annotations.filter((annotation) =>
    ["reader", "advanced"].includes(annotation.visibility)
  );
  const referenceStrongOccurrenceCount = expected.references.length;
  const referenceStrongRepresentedCount = countRepresentedOccurrences(
    expected.references,
    advancedVisible.map((annotation) => annotation.strong)
  );
  const readerTaggedTokenCount = countTaggedTokens(readerAnnotations);
  const advancedTaggedTokenCount = countTaggedTokens(advancedVisible);

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
    originalStrongOccurrenceCount: expected.originalCount,
    originalRepresentedStrongOccurrenceCount: expected.originalRepresentedCount,
    originalRepresentationRate: roundRatio(
      expected.originalRepresentedCount / Math.max(1, expected.originalCount)
    ),
    semanticMissingCount: Math.max(
      0,
      referenceStrongOccurrenceCount - referenceStrongRepresentedCount
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
  verses: EnrichedVerse[]
): EnrichedMetrics {
  const generatedAt = new Date().toISOString();
  const books: Record<string, EnrichedBookMetrics> = {};

  for (const verse of verses) {
    const existing = books[verse.bookId] ?? emptyBookMetrics(verse.bookId);
    addMetrics(existing, verse.metrics);
    books[verse.bookId] = existing;
  }

  for (const book of Object.values(books)) {
    finalizeCoverage(book);
  }

  const metrics: EnrichedMetrics = {
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

function emptyBookMetrics(bookId: string): EnrichedBookMetrics {
  return {
    bookId,
    ...emptyMetricCounts(),
    verseCount: 0
  };
}

function emptyMetricCounts(): Omit<
  EnrichedMetrics,
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
    originalStrongOccurrenceCount: 0,
    originalRepresentedStrongOccurrenceCount: 0,
    originalRepresentationRate: 0,
    semanticMissingCount: 0,
    readerTaggedTokenCount: 0,
    advancedTaggedTokenCount: 0,
    readerTokenCoverage: 0,
    advancedTokenCoverage: 0
  };
}

function addMetrics(
  target: Omit<EnrichedMetrics, "bible" | "generatedAt" | "scope" | "books">,
  source: EnrichedVerseMetrics
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
  target.originalStrongOccurrenceCount += source.originalStrongOccurrenceCount;
  target.originalRepresentedStrongOccurrenceCount +=
    source.originalRepresentedStrongOccurrenceCount;
  target.semanticMissingCount += source.semanticMissingCount;
  target.readerTaggedTokenCount += source.readerTaggedTokenCount;
  target.advancedTaggedTokenCount += source.advancedTaggedTokenCount;
}

function finalizeCoverage(
  target: Omit<EnrichedMetrics, "bible" | "generatedAt" | "scope" | "books">
): void {
  target.referenceStrongCoverage = roundRatio(
    target.referenceStrongRepresentedCount /
      Math.max(1, target.referenceStrongOccurrenceCount)
  );
  target.originalRepresentationRate = roundRatio(
    target.originalRepresentedStrongOccurrenceCount /
      Math.max(1, target.originalStrongOccurrenceCount)
  );
  target.readerTokenCoverage = roundRatio(
    target.readerTaggedTokenCount / Math.max(1, target.wordCount)
  );
  target.advancedTokenCoverage = roundRatio(
    target.advancedTaggedTokenCount / Math.max(1, target.wordCount)
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
  annotations: EnrichedStrongAnnotation[]
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

function countTaggedTokens(annotations: EnrichedStrongAnnotation[]): number {
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
  annotation: EnrichedStrongAnnotation,
  mode: "reader" | "advanced" | "debug"
): boolean {
  if (mode === "reader") return annotation.visibility === "reader";
  if (mode === "debug") return annotation.visibility !== "rejected";
  return (
    annotation.visibility === "reader" || annotation.visibility === "advanced"
  );
}

function buildPhraseStartMap(annotations: EnrichedStrongAnnotation[]): Map<
  number,
  {
    endWordIndex: number;
    annotations: EnrichedStrongAnnotation[];
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
      annotations: EnrichedStrongAnnotation[];
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

function renderEmptyAnnotations(
  annotations: EnrichedStrongAnnotation[]
): string {
  return annotations
    .map(
      (annotation) => `${openStrongTag([annotation], annotation.placement)}</w>`
    )
    .join("");
}

function openStrongTag(
  annotations: EnrichedStrongAnnotation[],
  target: string
): string {
  const strong = annotations.map((annotation) => annotation.strong).join(" ");
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

  return `<w strong="${escapeHtml(strong)}" data-confidence="${confidence.toFixed(
    2
  )}" data-source="${escapeHtml(source)}" data-method="${escapeHtml(
    source
  )}" data-placement="${escapeHtml(placement)}" data-target="${escapeHtml(
    target
  )}" data-empty="${target === "word" || target === "phrase" ? "false" : "true"}" data-reason="${escapeHtml(
    reason
  )}">`;
}

function groupAnnotations<T extends EnrichedStrongAnnotation>(
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

function getWordTokens(segments: TextSegment[]): EnrichedToken[] {
  const tokens: EnrichedToken[] = [];
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
  tokens: EnrichedToken[],
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
  options: EnrichedOptions
): BibleVerse[] {
  if (!options.onlyRef) {
    return verses;
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
  const mode = args.get("mode") === "advanced" ? "advanced" : "reader";

  return {
    command,
    bible,
    onlyRef: args.get("only"),
    outputDir:
      args.get("output-dir") ?? path.join("outputs", "enriched", bible),
    mode
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (args.command === "export") {
    const outputPath = await exportEnrichedStrongBible({
      bible: args.bible,
      outputDir: args.outputDir,
      mode: args.mode
    });
    console.log(`Exported ${args.mode} TSV: ${outputPath}`);
    return;
  }

  const biblePath = path.join("data", "bibles", `bible-${args.bible}.json`);
  const result = await generateEnrichedStrongBible({
    bible: args.bible,
    biblePath,
    outputDir: args.outputDir,
    onlyRef: args.onlyRef
  });

  console.log(
    `Generated canonical enriched Bible: ${result.outputPaths.canonical}`
  );
  console.log(`Reader TSV: ${result.outputPaths.readerTsv}`);
  console.log(`Advanced TSV: ${result.outputPaths.advancedTsv}`);
  console.log(
    `Reader coverage ${result.metrics.readerTokenCoverage}; advanced coverage ${result.metrics.advancedTokenCoverage}; original representation ${result.metrics.originalRepresentationRate}`
  );
}

if (
  process.argv.some((arg) =>
    arg.replaceAll("\\", "/").endsWith("src/enrichedStrongBible.ts")
  )
) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
