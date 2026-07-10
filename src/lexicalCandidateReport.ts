import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createGunzip } from "node:zlib";
import { createReadStream } from "node:fs";
import readline from "node:readline";

import { stemWord } from "./align.js";
import { BOOK_IDS } from "./books.js";
import { readStrongDictionaryTranslationCandidates } from "./strongDictionaryLexicon.js";
import { normalizeWord, tokenizeText } from "./tokenize.js";
import { type StrongTranslationCandidate } from "./translationLexicon.js";
import { type StrongLedger } from "./strongLedger.js";
import {
  readStrongLedgerSqlite,
  strongLedgerSqlitePath
} from "./strongLedgerStore.js";
import {
  defaultKaikkiSqlitePath,
  hasKaikkiSqliteIndex,
  readKaikkiSqliteIndex
} from "./kaikkiSqliteIndex.js";

interface CliOptions {
  bible: string;
  onlyRef?: string;
  inputDir: string;
  outputDir: string;
  ledgerPath?: string;
  kaikkiPath?: string;
  jdmCacheDir?: string;
  fetchJdm: boolean;
  fetchJdmLimit: number;
  openOfficePath?: string;
  wolfPath?: string;
  maxCandidatesPerEmpty: number;
}

interface SourceConfig {
  strongDictionary: boolean;
  kaikki?: string;
  rezoJdmCache?: string;
  rezoJdmFetch: boolean;
  openOffice?: string;
  wolf?: string;
}

export interface LexicalCandidateReport {
  bible: string;
  generatedAt: string;
  inputPath: string;
  scope: string;
  sources: SourceConfig;
  metrics: {
    verses: number;
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
    occupiedCandidates: number;
    openCandidates: number;
    reviewableCandidates: number;
    autoSafeCandidates: number;
    autoSafeItems: number;
    groupAutoSafeItems: number;
    ambiguousHighItems: number;
    openHighItems: number;
    relocationBetterOpenItems: number;
    evidenceSourceCounts: Record<string, number>;
  };
  items: LexicalCandidateItem[];
}

export interface LexicalCandidateItem {
  auditKind: "empty" | "relocation";
  annotationId: string;
  ref: string;
  text: string;
  strong: string;
  sourceStrong?: string;
  insertAfterWordIndex?: number;
  currentTarget?: {
    wordIndex: number;
    text: string;
    normalized: string;
    otherStrong: string[];
  };
  stepGlosses: string[];
  dictionaryTerms: string[];
  inferredTerms: string[];
  groupAutoSafe?: LexicalGroupAutoSafe;
  candidates: LexicalCandidate[];
}

interface LexicalGroupAutoSafe {
  groupId: string;
  assignedWordIndex: number;
  assignedText: string;
  sourceRank: number;
  groupSize: number;
  targetCount: number;
  capacityPerTarget: number;
  reason: string;
}

export interface LexicalCandidate {
  target: "word" | "phrase";
  wordIndex: number;
  startWordIndex?: number;
  endWordIndex?: number;
  text: string;
  normalized: string;
  lemma: string;
  score: number;
  confidence: "high" | "medium" | "low";
  occupied: boolean;
  evidence: CandidateEvidence[];
}

export interface LexicalAutoSafePlacement {
  item: LexicalCandidateItem;
  candidate: LexicalCandidate;
  kind: "auto-safe" | "group-auto-safe";
}

interface CandidateEvidence {
  source: string;
  detail: string;
  weight: number;
}

interface KaikkiIndex {
  formToLemma: Map<string, string>;
  lemmaGlossTokens: Map<string, Set<string>>;
  englishGlossToFrench: Map<string, Set<string>>;
}

interface KaikkiEntry {
  word?: unknown;
  lang_code?: unknown;
  forms?: Array<{ form?: unknown }>;
  senses?: KaikkiSense[];
}

interface KaikkiSense {
  glosses?: unknown;
  form_of?: Array<{ word?: unknown }>;
}

interface SynonymSource {
  name: string;
  synonymsByLemma: Map<string, Map<string, number>>;
  phraseSynonymsByLemma: Map<string, Map<string, PhraseSynonym>>;
}

interface PhraseSynonym {
  phrase: string[];
  weight: number;
}

interface BuildOptions extends CliOptions {
  dictionaryCandidates?: StrongTranslationCandidate[];
  ledger?: Pick<StrongLedger, "verses">;
  sourceCache?: LexicalCandidateSourceCache;
}

export interface LexicalCandidateSourceCache {
  dictionaryCandidates?: StrongTranslationCandidate[];
  kaikki: Map<string, KaikkiIndex>;
  synonymSources: Map<string, SynonymSource[]>;
}

const FUNCTION_WORDS = new Set([
  "a",
  "au",
  "aux",
  "avec",
  "ce",
  "ces",
  "cet",
  "cette",
  "dans",
  "de",
  "des",
  "du",
  "en",
  "et",
  "il",
  "ils",
  "la",
  "le",
  "les",
  "leur",
  "lui",
  "ne",
  "ou",
  "par",
  "pas",
  "pour",
  "qu",
  "que",
  "qui",
  "sans",
  "se",
  "son",
  "sur",
  "un",
  "une"
]);

export const HIGH_CONFIDENCE_THRESHOLD = 0.72;
const MEDIUM_CONFIDENCE_THRESHOLD = 0.48;

export function createLexicalCandidateSourceCache(
  dictionaryCandidates?: StrongTranslationCandidate[]
): LexicalCandidateSourceCache {
  return {
    dictionaryCandidates,
    kaikki: new Map(),
    synonymSources: new Map()
  };
}

export async function buildLexicalCandidateReport(
  options: BuildOptions
): Promise<LexicalCandidateReport> {
  const inputPath =
    options.ledgerPath ??
    strongLedgerSqlitePath(options.inputDir, options.bible);
  const ledger =
    options.ledger ?? (await readStrongLedger(inputPath, options.onlyRef));
  const verses = ledger.verses.filter((verse) =>
    options.onlyRef ? verseMatchesScope(verse, options.onlyRef) : true
  );
  const dictionaryCandidates =
    options.dictionaryCandidates ??
    options.sourceCache?.dictionaryCandidates ??
    readStrongDictionaryTranslationCandidates();
  const dictionaryByStrong = groupDictionaryTerms(dictionaryCandidates);
  const emptyItems = verses.flatMap((verse) =>
    verse.annotations.filter(isCandidateEmptyAnnotation).map((annotation) => ({
      kind: "empty" as const,
      verse,
      annotation
    }))
  );
  const relocationItems = verses.flatMap((verse) =>
    relocationCandidateAnnotations(verse).map((annotation) => ({
      kind: "relocation" as const,
      verse,
      annotation
    }))
  );
  const auditItems = [...emptyItems, ...relocationItems];
  const targetWords = new Set(
    verses.flatMap((verse) =>
      verse.tokens
        .filter((token) => isContentWord(token.normalized))
        .map((token) => token.normalized)
    )
  );
  const sourceAnnotations = options.sourceCache
    ? verses.flatMap((verse) =>
        verse.annotations.filter(
          (annotation) => annotation.lexiconLookup !== false
        )
      )
    : auditItems.map(({ annotation }) => annotation);
  const englishHints = new Set(
    sourceAnnotations.flatMap((annotation) =>
      stepGlossTokens(annotation.step?.map((step) => step.gloss) ?? [])
    )
  );
  const kaikki = options.kaikkiPath
    ? await readCachedKaikkiIndex(
        options.kaikkiPath,
        targetWords,
        englishHints,
        options.sourceCache
      )
    : emptyKaikkiIndex();
  const dictionaryStrongSet = new Set(
    sourceAnnotations.map((annotation) => annotation.strong)
  );
  const synonymSources = await readCachedSynonymSources(
    options,
    {
      targetWords: new Set([...targetWords, ...kaikki.formToLemma.values()]),
      dictionaryTerms: new Set(
        [...dictionaryStrongSet].flatMap((strong) => [
          ...(dictionaryByStrong.get(strong)?.keys() ?? [])
        ])
      ),
      inferredTerms: new Set(
        [...kaikki.englishGlossToFrench.values()].flatMap((terms) => [...terms])
      )
    },
    options.sourceCache
  );

  const items = auditItems.map(({ kind, verse, annotation }) =>
    buildCandidateItem({
      auditKind: kind,
      verse,
      annotation,
      dictionaryTerms: dictionaryByStrong.get(annotation.strong) ?? new Map(),
      kaikki,
      synonymSources,
      maxCandidates: options.maxCandidatesPerEmpty
    })
  );
  applyProperNameGroupAutoSafe(items);
  applyProperNameSequenceAutoSafe(items);
  applyLexicalDuplicateGroupAutoSafe(items);

  const candidateCount = items.reduce(
    (sum, item) => sum + item.candidates.length,
    0
  );
  const highConfidenceCandidates = items.reduce(
    (sum, item) =>
      sum +
      item.candidates.filter((candidate) => candidate.confidence === "high")
        .length,
    0
  );
  const mediumConfidenceCandidates = items.reduce(
    (sum, item) =>
      sum +
      item.candidates.filter((candidate) => candidate.confidence === "medium")
        .length,
    0
  );
  const lowConfidenceCandidates = items.reduce(
    (sum, item) =>
      sum +
      item.candidates.filter((candidate) => candidate.confidence === "low")
        .length,
    0
  );
  const occupiedCandidates = items.reduce(
    (sum, item) =>
      sum + item.candidates.filter((candidate) => candidate.occupied).length,
    0
  );
  const openCandidates = candidateCount - occupiedCandidates;
  const reviewableCandidates = items.reduce(
    (sum, item) =>
      sum +
      item.candidates.filter(
        (candidate) =>
          candidate.confidence !== "low" ||
          candidate.evidence.some((evidence) => evidence.source === "seed-term")
      ).length,
    0
  );
  const autoSafeItems = items.filter(isAutoSafeItem).length;
  const groupAutoSafeItems = items.filter((item) => item.groupAutoSafe).length;
  const autoSafeCandidates = items.reduce((sum, item) => {
    if (item.groupAutoSafe) return sum + 1;
    if (!isAutoSafeItem(item)) return sum;
    return (
      sum +
      item.candidates.filter((candidate) =>
        isAutoSafeCandidate(item, candidate)
      ).length
    );
  }, 0);
  const ambiguousHighItems = items.filter(
    (item) =>
      !item.groupAutoSafe &&
      item.candidates.filter((candidate) => candidate.confidence === "high")
        .length > 1
  ).length;
  const openHighItems = items.filter((item) =>
    item.candidates.some(
      (candidate) => candidate.confidence === "high" && !candidate.occupied
    )
  ).length;
  const relocationBetterOpenItems = items.filter(
    (item) =>
      item.auditKind === "relocation" &&
      bestOpenCandidate(item) &&
      bestOpenCandidate(item)!.score >= currentTargetScore(item) + 0.12
  ).length;
  const evidenceSourceCounts = countEvidenceSources(items);
  const emptyAnnotations = emptyItems.length;
  const relocationAnnotations = relocationItems.length;

  return {
    bible: options.bible,
    generatedAt: new Date().toISOString(),
    inputPath,
    scope: options.onlyRef ?? "all",
    sources: {
      strongDictionary: true,
      kaikki: options.kaikkiPath,
      rezoJdmCache: options.jdmCacheDir,
      rezoJdmFetch: options.fetchJdm,
      openOffice: options.openOfficePath,
      wolf: options.wolfPath
    },
    metrics: {
      verses: verses.length,
      auditItems: auditItems.length,
      emptyAnnotations,
      readerEmptyAnnotations: emptyItems.filter(
        (item) => item.annotation.visibility === "reader"
      ).length,
      advancedEmptyAnnotations: emptyItems.filter(
        (item) => item.annotation.visibility === "advanced"
      ).length,
      relocationAnnotations,
      itemsWithCandidates: items.filter((item) => item.candidates.length > 0)
        .length,
      emptyWithCandidates: items.filter(
        (item) => item.auditKind === "empty" && item.candidates.length > 0
      ).length,
      relocationWithCandidates: items.filter(
        (item) => item.auditKind === "relocation" && item.candidates.length > 0
      ).length,
      candidateCount,
      highConfidenceCandidates,
      mediumConfidenceCandidates,
      lowConfidenceCandidates,
      occupiedCandidates,
      openCandidates,
      reviewableCandidates,
      autoSafeCandidates,
      autoSafeItems,
      groupAutoSafeItems,
      ambiguousHighItems,
      openHighItems,
      relocationBetterOpenItems,
      evidenceSourceCounts
    },
    items
  };
}

export async function writeLexicalCandidateReport(
  report: LexicalCandidateReport,
  outputDir: string
): Promise<{ jsonPath: string; markdownPath: string }> {
  await mkdir(outputDir, { recursive: true });
  const scopeSlug = report.scope.replace(/[^\p{L}\p{N}.-]+/gu, "_");
  const jsonPath = path.join(
    outputDir,
    `bible-${report.bible}-lexical-candidates-${scopeSlug}.json`
  );
  const markdownPath = path.join(
    outputDir,
    `bible-${report.bible}-lexical-candidates-${scopeSlug}.md`
  );

  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8"),
    writeFile(markdownPath, renderMarkdownReport(report), "utf8")
  ]);

  return { jsonPath, markdownPath };
}

function buildCandidateItem(options: {
  auditKind: LexicalCandidateItem["auditKind"];
  verse: StrongLedger["verses"][number];
  annotation: StrongLedger["verses"][number]["annotations"][number];
  dictionaryTerms: Map<string, number>;
  kaikki: KaikkiIndex;
  synonymSources: SynonymSource[];
  maxCandidates: number;
}): LexicalCandidateItem {
  const stepGlosses = options.annotation.step?.map((step) => step.gloss) ?? [];
  const englishHints = stepGlossTokens(stepGlosses);
  const inferredTerms = inferredFrenchTerms(englishHints, options.kaikki);
  const seedTerms = new Map<string, number>();

  for (const [term, score] of options.dictionaryTerms) {
    seedTerms.set(term, Math.max(seedTerms.get(term) ?? 0, score));
  }
  for (const term of inferredTerms) {
    seedTerms.set(term, Math.max(seedTerms.get(term) ?? 0, 0.42));
  }

  const scoredCandidates = options.verse.tokens
    .filter((token) => shouldScoreToken(token, options.annotation))
    .map((token) =>
      scoreTargetToken({
        token,
        verse: options.verse,
        seedTerms,
        englishHints,
        annotation: options.annotation,
        kaikki: options.kaikki,
        synonymSources: options.synonymSources
      })
    )
    .filter((candidate): candidate is LexicalCandidate => Boolean(candidate))
    .concat(
      scorePhraseCandidates({
        verse: options.verse,
        seedTerms,
        annotation: options.annotation,
        kaikki: options.kaikki,
        synonymSources: options.synonymSources
      })
    );

  const candidates = applyRelocationDirectTargetGuard({
    auditKind: options.auditKind,
    annotation: options.annotation,
    candidates: scoredCandidates
  })
    .sort(
      (left, right) =>
        right.score - left.score ||
        Number(left.occupied) - Number(right.occupied) ||
        left.wordIndex - right.wordIndex
    )
    .slice(0, options.maxCandidates);

  return {
    annotationId: options.annotation.id,
    auditKind: options.auditKind,
    ref: options.verse.ref,
    text: options.verse.text,
    strong: options.annotation.strong,
    sourceStrong: options.annotation.sourceStrong,
    insertAfterWordIndex: options.annotation.insertAfterWordIndex,
    currentTarget: currentTargetForAnnotation(
      options.verse,
      options.annotation
    ),
    stepGlosses,
    dictionaryTerms: [...options.dictionaryTerms.keys()].slice(0, 20),
    inferredTerms: [...inferredTerms].slice(0, 30),
    candidates
  };
}

function scoreTargetToken(options: {
  token: StrongLedger["verses"][number]["tokens"][number];
  verse: StrongLedger["verses"][number];
  seedTerms: Map<string, number>;
  englishHints: string[];
  annotation: StrongLedger["verses"][number]["annotations"][number];
  kaikki: KaikkiIndex;
  synonymSources: SynonymSource[];
}): LexicalCandidate | undefined {
  const lemma = lemmaForToken(options.token.normalized, options.kaikki);
  const evidence: CandidateEvidence[] = [];
  const properName = isProperNameAnnotation(options.annotation);

  if (properName) {
    evidence.push(
      ...properNameEvidence({
        targetText: options.token.text,
        annotation: options.annotation,
        seedTerms: options.seedTerms
      })
    );
  } else {
    const numberEvidence = numberComponentEvidence({
      targetText: options.token.text,
      normalized: options.token.normalized,
      annotation: options.annotation
    });
    if (numberEvidence) evidence.push(numberEvidence);

    const exactSeedScore =
      Math.max(
        options.seedTerms.get(options.token.normalized) ?? 0,
        options.seedTerms.get(lemma) ?? 0
      ) || 0;
    if (exactSeedScore > 0) {
      evidence.push({
        source: "seed-term",
        detail: `${lemma} matches Strong lexical hint`,
        weight: Math.min(0.5, 0.26 + exactSeedScore * 0.4)
      });
    } else {
      const stemMatch = bestSeedStemMatch(lemma, options.seedTerms);
      if (stemMatch) {
        evidence.push({
          source: "seed-stem",
          detail: `${lemma} shares Strong lexical stem ${stemMatch.seed}`,
          weight: Math.min(0.42, 0.24 + stemMatch.score * 0.42)
        });
      }
    }

    const glossOverlap = overlapCount(
      options.kaikki.lemmaGlossTokens.get(lemma) ?? new Set(),
      new Set(options.englishHints)
    );
    if (glossOverlap > 0) {
      evidence.push({
        source: "kaikki-gloss",
        detail: `${lemma} gloss overlaps ${options.englishHints.join(", ")}`,
        weight: Math.min(0.32, 0.16 + glossOverlap * 0.08)
      });
    }

    for (const source of options.synonymSources) {
      const synonymEvidence = synonymSourceEvidence(
        source,
        lemma,
        options.seedTerms
      );
      if (synonymEvidence) evidence.push(synonymEvidence);
    }
  }

  if (evidence.length === 0) return undefined;

  const occupied = isWordOccupied(options.verse, options.token.wordIndex);
  const position = positionScore(
    options.annotation.insertAfterWordIndex,
    options.token.wordIndex,
    options.verse.tokens.length
  );
  const sourceDiversity = new Set(evidence.map((item) => item.source)).size;
  const safeOccupiedStack =
    occupied && isStackSafeLexicalCandidateEvidence(evidence);
  const rawScore =
    evidence.reduce((sum, item) => sum + item.weight, 0) +
    position * 0.12 +
    Math.min(0.14, (sourceDiversity - 1) * 0.07) -
    (occupied && !safeOccupiedStack ? 0.34 : 0);
  const score = roundRatio(Math.max(0, Math.min(1, rawScore)));

  return {
    target: "word",
    wordIndex: options.token.wordIndex,
    text: options.token.text,
    normalized: options.token.normalized,
    lemma,
    score,
    confidence: candidateConfidence(score, evidence),
    occupied,
    evidence
  };
}

function applyRelocationDirectTargetGuard(options: {
  auditKind: LexicalCandidateItem["auditKind"];
  annotation: StrongLedger["verses"][number]["annotations"][number];
  candidates: LexicalCandidate[];
}): LexicalCandidate[] {
  if (
    options.auditKind !== "relocation" ||
    options.annotation.wordIndex === undefined
  ) {
    return options.candidates;
  }

  const currentCandidate = options.candidates.find(
    (candidate) => candidate.wordIndex === options.annotation.wordIndex
  );
  if (
    !currentCandidate ||
    currentCandidate.score < HIGH_CONFIDENCE_THRESHOLD ||
    !hasDirectLexicalEvidence(currentCandidate)
  ) {
    return options.candidates;
  }

  return options.candidates.map((candidate) => {
    if (candidate.wordIndex === options.annotation.wordIndex) return candidate;
    if (hasDirectLexicalEvidence(candidate)) return candidate;
    if (candidate.occupied) return candidate;
    return capCandidateScore(candidate, MEDIUM_CONFIDENCE_THRESHOLD - 0.02, {
      source: "relocation-guard",
      detail: `current target ${currentCandidate.text} has direct lexical evidence`,
      weight: 0
    });
  });
}

function hasDirectLexicalEvidence(candidate: LexicalCandidate): boolean {
  return candidate.evidence.some((evidence) =>
    DIRECT_LEXICAL_EVIDENCE_SOURCES.has(evidence.source)
  );
}

function candidateConfidence(
  score: number,
  evidence: CandidateEvidence[]
): LexicalCandidate["confidence"] {
  if (score < MEDIUM_CONFIDENCE_THRESHOLD) return "low";
  if (
    score >= HIGH_CONFIDENCE_THRESHOLD &&
    evidence.some((item) => DIRECT_LEXICAL_EVIDENCE_SOURCES.has(item.source))
  ) {
    return "high";
  }
  return "medium";
}

const DIRECT_LEXICAL_EVIDENCE_SOURCES = new Set([
  "seed-term",
  "seed-stem",
  "number-component",
  "kaikki-gloss",
  "proper-name-step",
  "proper-name-dictionary"
]);

function numberComponentEvidence(options: {
  targetText: string;
  normalized: string;
  annotation: StrongLedger["verses"][number]["annotations"][number];
}): CandidateEvidence | undefined {
  const expectedValues = numericValuesForAnnotation(options.annotation);
  if (expectedValues.size === 0) return undefined;

  const targetValues = numericValuesForTarget(options.normalized);
  const matchingValue = firstIntersection(expectedValues, targetValues);
  if (matchingValue === undefined) return undefined;

  return {
    source: "number-component",
    detail: `${options.targetText} contains numeric component ${matchingValue}`,
    weight: 0.78
  };
}

function numericValuesForAnnotation(
  annotation: StrongLedger["verses"][number]["annotations"][number]
): Set<number> {
  const values = new Set<number>();
  if (!hasNumericStepMorphology(annotation)) return values;
  for (const token of stepGlossTokens(
    annotation.step?.map((step) => step.gloss) ?? []
  )) {
    const value = NUMERIC_WORD_VALUES.get(token);
    if (value !== undefined) values.add(value);
  }
  return values;
}

function hasNumericStepMorphology(
  annotation: StrongLedger["verses"][number]["annotations"][number]
): boolean {
  return (
    annotation.step?.some((step) =>
      /(?:^|[/=;+ ])H?Ac[A-Za-z]*/u.test(step.morphology)
    ) ?? false
  );
}

function numericValuesForTarget(normalized: string): Set<number> {
  const values = new Set<number>();
  const numericValue = Number(normalized);
  if (Number.isInteger(numericValue) && numericValue > 0) {
    for (const value of decomposeIntegerNumber(numericValue)) {
      values.add(value);
    }
    return values;
  }

  const parts = normalized
    .split(/[-\s'’]+/u)
    .map((part) => part.replace(/[^\p{L}\p{N}]+/gu, ""))
    .filter(Boolean);
  let sum = 0;
  let allPartsAreNumeric = parts.length > 0;
  for (const part of parts) {
    const value = NUMERIC_WORD_VALUES.get(part);
    if (value === undefined) {
      allPartsAreNumeric = false;
      continue;
    }
    for (const decomposed of decomposeIntegerNumber(value)) {
      values.add(decomposed);
    }
    sum += value;
  }
  addFrenchCompoundNumberValues(parts, values);
  if (allPartsAreNumeric && sum > 0) values.add(sum);
  return values;
}

function decomposeIntegerNumber(value: number): Set<number> {
  const values = new Set([value]);
  const teenUnit = TEEN_UNIT_VALUES.get(value);
  if (teenUnit !== undefined) {
    values.add(10);
    values.add(teenUnit);
  }
  if (value >= 100) {
    const hundreds = Math.floor(value / 100);
    if (hundreds > 0) {
      values.add(hundreds);
      values.add(100);
      values.add(hundreds * 100);
    }
  }
  const lastTwoDigits = value % 100;
  if (lastTwoDigits >= 20) {
    const tens = Math.floor(lastTwoDigits / 10) * 10;
    const units = lastTwoDigits % 10;
    if (tens > 0) values.add(tens);
    if (units > 0) values.add(units);
  } else if (lastTwoDigits > 0 && lastTwoDigits !== value) {
    values.add(lastTwoDigits);
  }
  return values;
}

function addFrenchCompoundNumberValues(
  parts: string[],
  values: Set<number>
): void {
  const compoundValue = frenchCompoundNumberValue(parts);
  if (compoundValue !== undefined) {
    for (const value of decomposeIntegerNumber(compoundValue)) {
      values.add(value);
    }
  }

  const quatreVingtIndex = parts.findIndex(
    (part, index) =>
      part === "quatre" && ["vingt", "vingts"].includes(parts[index + 1] ?? "")
  );
  if (quatreVingtIndex !== -1) {
    values.add(80);
    const rest = parts.slice(quatreVingtIndex + 2);
    const restValue = frenchCompoundNumberValue(rest);
    if (restValue !== undefined) {
      for (const value of decomposeIntegerNumber(restValue)) values.add(value);
      for (const value of decomposeIntegerNumber(80 + restValue)) {
        values.add(value);
      }
    }
  }

  const soixanteDixIndex = parts.findIndex(
    (part, index) => part === "soixante" && parts[index + 1] === "dix"
  );
  if (soixanteDixIndex !== -1) {
    values.add(70);
    const rest = parts.slice(soixanteDixIndex + 2);
    const restValue = frenchCompoundNumberValue(rest);
    if (restValue !== undefined) {
      for (const value of decomposeIntegerNumber(restValue)) values.add(value);
      for (const value of decomposeIntegerNumber(70 + restValue)) {
        values.add(value);
      }
    }
  }

  const soixanteIndex = parts.findIndex((part) => part === "soixante");
  const teenAfterSixty =
    soixanteIndex !== -1
      ? NUMERIC_WORD_VALUES.get(parts[soixanteIndex + 1] ?? "")
      : undefined;
  if (teenAfterSixty !== undefined && teenAfterSixty >= 11) {
    values.add(70);
    for (const value of decomposeIntegerNumber(60 + teenAfterSixty)) {
      values.add(value);
    }
  }
}

function frenchCompoundNumberValue(parts: string[]): number | undefined {
  if (parts.length === 0) return undefined;
  if (
    parts.length >= 2 &&
    parts[0] === "quatre" &&
    ["vingt", "vingts"].includes(parts[1] ?? "")
  ) {
    return 80 + (frenchCompoundNumberValue(parts.slice(2)) ?? 0);
  }
  if (parts.length >= 2 && parts[0] === "soixante" && parts[1] === "dix") {
    return 70 + (frenchCompoundNumberValue(parts.slice(2)) ?? 0);
  }

  let total = 0;
  for (const part of parts) {
    const value = NUMERIC_WORD_VALUES.get(part);
    if (value === undefined) return undefined;
    total += value;
  }
  return total > 0 ? total : undefined;
}

function isStackSafeLexicalCandidateEvidence(
  evidence: CandidateEvidence[]
): boolean {
  return evidence.some((item) => item.source === "number-component");
}

const NUMERIC_WORD_VALUES = new Map<string, number>([
  ["one", 1],
  ["un", 1],
  ["une", 1],
  ["two", 2],
  ["deux", 2],
  ["three", 3],
  ["trois", 3],
  ["four", 4],
  ["quatre", 4],
  ["five", 5],
  ["cinq", 5],
  ["six", 6],
  ["seven", 7],
  ["sept", 7],
  ["eight", 8],
  ["huit", 8],
  ["nine", 9],
  ["neuf", 9],
  ["ten", 10],
  ["dix", 10],
  ["eleven", 11],
  ["onze", 11],
  ["twelve", 12],
  ["douze", 12],
  ["thirteen", 13],
  ["treize", 13],
  ["fourteen", 14],
  ["quatorze", 14],
  ["fifteen", 15],
  ["quinze", 15],
  ["sixteen", 16],
  ["seize", 16],
  ["twenty", 20],
  ["vingt", 20],
  ["thirty", 30],
  ["trente", 30],
  ["forty", 40],
  ["quarante", 40],
  ["fifty", 50],
  ["cinquante", 50],
  ["sixty", 60],
  ["soixante", 60],
  ["hundred", 100],
  ["hundreds", 100],
  ["cent", 100],
  ["cents", 100],
  ["thousand", 1000],
  ["thousands", 1000],
  ["mille", 1000]
]);

const TEEN_UNIT_VALUES = new Map<number, number>([
  [11, 1],
  [12, 2],
  [13, 3],
  [14, 4],
  [15, 5],
  [16, 6],
  [17, 7],
  [18, 8],
  [19, 9]
]);

function bestSeedStemMatch(
  lemma: string,
  seedTerms: Map<string, number>
): { seed: string; score: number } | undefined {
  const targetVariants = lexicalStemVariants(lemma);
  const matches: Array<{ seed: string; score: number }> = [];

  for (const [seed, score] of seedTerms) {
    const seedVariants = lexicalStemVariants(seed);
    if (
      [...targetVariants].some((targetVariant) =>
        [...seedVariants].some((seedVariant) =>
          isSafeLexicalStemMatch(targetVariant, seedVariant)
        )
      )
    ) {
      matches.push({ seed, score });
    }
  }

  return matches.sort((left, right) => right.score - left.score)[0];
}

function lexicalStemVariants(term: string): Set<string> {
  const variants = new Set([term]);
  const stem = stemWord(term);
  if (stem.length >= 5) variants.add(stem);
  return variants;
}

function isSafeLexicalStemMatch(left: string, right: string): boolean {
  if (left.length < 7 || right.length < 7) return false;
  if (left === right) return true;
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length > right.length ? left : right;
  if (!longer.startsWith(shorter)) return false;
  return SAFE_LEXICAL_STEM_SUFFIXES.has(longer.slice(shorter.length));
}

const SAFE_LEXICAL_STEM_SUFFIXES = new Set([
  "s",
  "e",
  "es",
  "r",
  "er",
  "ir",
  "ie",
  "ies",
  "ique",
  "iques",
  "ant",
  "ante",
  "ants",
  "antes"
]);

function capCandidateScore(
  candidate: LexicalCandidate,
  maxScore: number,
  evidence: CandidateEvidence
): LexicalCandidate {
  if (candidate.score <= maxScore) return candidate;
  const score = roundRatio(maxScore);
  const evidenceList = [...candidate.evidence, evidence];
  return {
    ...candidate,
    score,
    confidence: candidateConfidence(score, evidenceList),
    evidence: evidenceList
  };
}

function isProperNameAnnotation(
  annotation: StrongLedger["verses"][number]["annotations"][number]
): boolean {
  return (
    annotation.step?.some((step) => {
      const morphology = step.morphology.trim();
      return (
        /^[HG]?N[Pp]/u.test(morphology) ||
        /(?:^|[/=;+ ])(?:[HG]?N[Pp])/u.test(morphology) ||
        /N-?PRI/iu.test(morphology) ||
        /proper/iu.test(morphology)
      );
    }) ?? false
  );
}

function properNameEvidence(options: {
  targetText: string;
  annotation: StrongLedger["verses"][number]["annotations"][number];
  seedTerms: Map<string, number>;
}): CandidateEvidence[] {
  if (isLowercaseProperNameStopTarget(options.targetText)) return [];

  const targetKeys = nameKeyVariantsFromText(options.targetText, {
    suffixMode: "french-prefix"
  });
  const stepKeys = properNameStepKeys(options.annotation);
  const matchingStepKey = firstNameKeyMatch(targetKeys, stepKeys);
  if (!matchingStepKey) return [];

  const evidence: CandidateEvidence[] = [
    {
      source: "proper-name-step",
      detail: `${options.targetText} matches STEP name key ${matchingStepKey}`,
      weight: 0.62
    }
  ];

  const dictionaryKeys = properNameDictionaryKeys(options.seedTerms, stepKeys);
  const matchingDictionaryKey = firstNameKeyMatch(targetKeys, dictionaryKeys);
  if (matchingDictionaryKey) {
    evidence.push({
      source: "proper-name-dictionary",
      detail: `${options.targetText} matches Strong dictionary name key ${matchingDictionaryKey}`,
      weight: 0.22
    });
  }

  return evidence;
}

function isLowercaseProperNameStopTarget(text: string): boolean {
  const words = tokenizeText(text).filter((segment) => segment.kind === "word");
  if (words.length !== 1) return false;
  const word = words[0];
  return (
    word !== undefined &&
    !/\p{Lu}/u.test(word.text) &&
    PROPER_NAME_STOP_TARGETS.has(word.normalized)
  );
}

const PROPER_NAME_STOP_TARGETS = new Set(["est", "vous"]);

function properNameStepKeys(
  annotation: StrongLedger["verses"][number]["annotations"][number]
): Set<string> {
  const keys = new Set<string>();
  const primaryParts: string[][] = [];

  for (const step of annotation.step ?? []) {
    const texts = [step.gloss, step.transliteration].filter(hasLatinLetter);
    for (const text of texts) {
      addAll(keys, nameKeyVariantsFromText(text));
    }

    const primaryText = [step.gloss, step.transliteration].find(hasLatinLetter);
    const parts = primaryText ? nameParts(primaryText) : [];
    if (parts.length > 0) primaryParts.push(parts);
  }

  for (let index = 0; index < primaryParts.length; index += 1) {
    const combined: string[] = [];
    for (
      let end = index;
      end < primaryParts.length && end < index + 4;
      end += 1
    ) {
      combined.push(...(primaryParts[end] ?? []));
      if (combined.length >= 2) {
        addAll(keys, nameKeyVariantsFromParts(combined));
      }
    }
  }

  return keys;
}

function properNameDictionaryKeys(
  seedTerms: Map<string, number>,
  stepKeys: Set<string>
): Set<string> {
  const keys = new Set<string>();
  for (const seed of seedTerms.keys()) {
    const seedKeys = nameKeyVariantsFromText(seed);
    if (!firstNameKeyMatch(seedKeys, stepKeys)) continue;
    addAll(keys, seedKeys);
  }
  return keys;
}

function firstNameKeyMatch(
  left: Set<string>,
  right: Set<string>
): string | undefined {
  const exact = firstIntersection(left, right);
  if (exact) return exact;

  for (const leftKey of left) {
    for (const rightKey of right) {
      if (isApproximateNameKeyMatch(leftKey, rightKey)) return rightKey;
    }
  }
  return undefined;
}

function isApproximateNameKeyMatch(left: string, right: string): boolean {
  if (left.length < 5 || right.length < 5) return false;
  if (isNameSkeleton(left) || isNameSkeleton(right)) return false;
  const leftSkeleton = nameConsonantSkeleton(left);
  const rightSkeleton = nameConsonantSkeleton(right);
  if (
    leftSkeleton.length >= 3 &&
    rightSkeleton.length >= 3 &&
    levenshteinDistance(leftSkeleton, rightSkeleton, 1) > 1
  ) {
    return false;
  }
  const maxLength = Math.max(left.length, right.length);
  const maxDistance = maxLength >= 9 ? 4 : 2;
  return levenshteinDistance(left, right, maxDistance) <= maxDistance;
}

function isNameSkeleton(value: string): boolean {
  return !/[aeiouy]/u.test(value);
}

function nameConsonantSkeleton(value: string): string {
  return value.replace(/[aeiouy]/gu, "");
}

function levenshteinDistance(
  left: string,
  right: string,
  limit: number
): number {
  if (Math.abs(left.length - right.length) > limit) return limit + 1;

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const current = [leftIndex + 1];
    let rowMin = current[0] ?? 0;
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const cost = left[leftIndex] === right[rightIndex] ? 0 : 1;
      const value = Math.min(
        (previous[rightIndex + 1] ?? 0) + 1,
        (current[rightIndex] ?? 0) + 1,
        (previous[rightIndex] ?? 0) + cost
      );
      current[rightIndex + 1] = value;
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > limit) return limit + 1;
    previous = current;
  }

  return previous[right.length] ?? limit + 1;
}

function nameKeyVariantsFromText(
  text: string,
  options: { suffixMode?: "all" | "french-prefix" } = {}
): Set<string> {
  const parts = nameParts(text);
  const variants = nameKeyVariantsFromParts(parts);

  for (let index = 1; index < parts.length; index += 1) {
    if (
      options.suffixMode === "french-prefix" &&
      !parts.slice(0, index).every(isFrenchNamePrefixPart)
    ) {
      continue;
    }
    addAll(variants, nameKeyVariantsFromParts(parts.slice(index)));
  }

  return variants;
}

function isFrenchNamePrefixPart(part: string): boolean {
  return FRENCH_NAME_PREFIX_PARTS.has(part);
}

const FRENCH_NAME_PREFIX_PARTS = new Set([
  "d",
  "l",
  "de",
  "du",
  "des",
  "le",
  "la",
  "les"
]);

function nameKeyVariantsFromParts(parts: string[]): Set<string> {
  const base = parts.join("");
  if (!base) return new Set();
  const variants = new Set([base]);
  const replacements: Array<[RegExp, string]> = [
    [/th/gu, "t"],
    [/sh/gu, "s"],
    [/kh/gu, "k"],
    [/ch/gu, "h"],
    [/ch/gu, "k"],
    [/j/gu, "y"],
    [/ou/gu, "u"],
    [/v/gu, "b"],
    [/k/gu, "c"],
    [/c/gu, "k"],
    [/y/gu, "i"]
  ];

  for (const [pattern, replacement] of replacements) {
    for (const variant of [...variants]) {
      variants.add(variant.replace(pattern, replacement));
    }
  }

  for (const variant of [...variants]) {
    const skeleton = variant.replace(/[aeiouy]/gu, "");
    if (skeleton.length >= 2) variants.add(skeleton);
  }

  return new Set([...variants].filter((variant) => variant.length >= 2));
}

function nameParts(text: string): string[] {
  return tokenizeText(text)
    .filter((segment) => segment.kind === "word")
    .flatMap((segment) => segment.normalized.split(/[-'’]+/u))
    .map((part) => part.replace(/[^\p{L}\p{N}]+/gu, ""))
    .filter((part) => part.length > 0);
}

function hasLatinLetter(value: string | undefined): value is string {
  return typeof value === "string" && /[A-Za-z]/u.test(value);
}

function firstIntersection<T>(left: Set<T>, right: Set<T>): T | undefined {
  for (const value of left) {
    if (right.has(value)) return value;
  }
  return undefined;
}

function addAll<T>(target: Set<T>, values: Iterable<T>): void {
  for (const value of values) target.add(value);
}

function scorePhraseCandidates(options: {
  verse: StrongLedger["verses"][number];
  seedTerms: Map<string, number>;
  annotation: StrongLedger["verses"][number]["annotations"][number];
  kaikki: KaikkiIndex;
  synonymSources: SynonymSource[];
}): LexicalCandidate[] {
  if (isProperNameAnnotation(options.annotation)) return [];

  const phraseHints = phraseHintsFromSynonyms(
    options.seedTerms,
    options.synonymSources
  );
  const candidates: LexicalCandidate[] = [];
  const maxLength = 5;

  if (phraseHints.size > 0) {
    for (let start = 0; start < options.verse.tokens.length; start += 1) {
      for (
        let end = start + 1;
        end < options.verse.tokens.length && end < start + maxLength;
        end += 1
      ) {
        const span = options.verse.tokens.slice(start, end + 1);
        const normalizedPhrase = span.map((token) => token.normalized);
        if (!isUsefulPhrase(normalizedPhrase)) continue;

        const matchingKey = phraseKeysForSpan(span, options.kaikki).find(
          (key) => phraseHints.has(key)
        );
        if (!matchingKey) continue;
        const hint = phraseHints.get(matchingKey);
        if (!hint) continue;

        const startWordIndex = span[0]?.wordIndex ?? start;
        const endWordIndex = span[span.length - 1]?.wordIndex ?? end;
        const occupied = isPhraseOccupied(
          options.verse,
          startWordIndex,
          endWordIndex
        );
        const position = positionScore(
          options.annotation.insertAfterWordIndex,
          startWordIndex,
          options.verse.tokens.length
        );
        const sourceDiversity = new Set(
          hint.evidence.map((item) => item.source)
        ).size;
        const rawScore =
          hint.evidence.reduce((sum, item) => sum + item.weight, 0) +
          position * 0.12 +
          Math.min(0.14, (sourceDiversity - 1) * 0.07) +
          0.22 -
          (occupied ? 0.34 : 0);
        const score = roundRatio(Math.max(0, Math.min(1, rawScore)));

        candidates.push({
          target: "phrase",
          wordIndex: startWordIndex,
          startWordIndex,
          endWordIndex,
          text: span.map((token) => token.text).join(" "),
          normalized: normalizedPhrase.join(" "),
          lemma: matchingKey,
          score,
          confidence: candidateConfidence(score, hint.evidence),
          occupied,
          evidence: hint.evidence
        });
      }
    }
  }

  candidates.push(...scoreAuxiliaryVerbPhraseCandidates(options));

  return dedupePhraseCandidates(candidates);
}

function scoreAuxiliaryVerbPhraseCandidates(options: {
  verse: StrongLedger["verses"][number];
  seedTerms: Map<string, number>;
  annotation: StrongLedger["verses"][number]["annotations"][number];
  kaikki: KaikkiIndex;
  synonymSources: SynonymSource[];
}): LexicalCandidate[] {
  if (!hasVerbStepMorphology(options.annotation)) return [];
  const expectedAuxiliaries = auxiliaryFamiliesForAnnotation(
    options.annotation
  );
  if (expectedAuxiliaries.size === 0) return [];

  const candidates: LexicalCandidate[] = [];
  for (let index = 0; index < options.verse.tokens.length - 1; index += 1) {
    const auxiliary = options.verse.tokens[index];
    const participle = options.verse.tokens[index + 1];
    if (!auxiliary || !participle) continue;

    const auxiliaryFamily = FRENCH_AUXILIARY_FORMS.get(auxiliary.normalized);
    if (!auxiliaryFamily || !expectedAuxiliaries.has(auxiliaryFamily)) {
      continue;
    }

    const participleCandidate = scoreTargetToken({
      token: participle,
      verse: options.verse,
      seedTerms: options.seedTerms,
      englishHints: stepGlossTokens(
        options.annotation.step?.map((step) => step.gloss) ?? []
      ),
      annotation: options.annotation,
      kaikki: options.kaikki,
      synonymSources: options.synonymSources
    });
    if (
      !participleCandidate ||
      !hasDirectLexicalEvidence(participleCandidate)
    ) {
      continue;
    }

    const startWordIndex = auxiliary.wordIndex;
    const endWordIndex = participle.wordIndex;
    const occupied = isPhraseOccupied(
      options.verse,
      startWordIndex,
      endWordIndex
    );
    const position = positionScore(
      options.annotation.insertAfterWordIndex,
      startWordIndex,
      options.verse.tokens.length
    );
    const evidence: CandidateEvidence[] = [
      {
        source: "french-auxiliary-phrase",
        detail: `${auxiliary.text} carries STEP auxiliary ${auxiliaryFamily}`,
        weight: 0.28
      },
      ...participleCandidate.evidence
    ];
    const sourceDiversity = new Set(evidence.map((item) => item.source)).size;
    const rawScore =
      participleCandidate.score +
      0.28 +
      position * 0.12 +
      Math.min(0.14, (sourceDiversity - 1) * 0.07) -
      (occupied ? 0.34 : 0);
    const score = roundRatio(Math.max(0, Math.min(1, rawScore)));

    candidates.push({
      target: "phrase",
      wordIndex: startWordIndex,
      startWordIndex,
      endWordIndex,
      text: `${auxiliary.text} ${participle.text}`,
      normalized: `${auxiliary.normalized} ${participle.normalized}`,
      lemma: `${auxiliaryFamily} ${participleCandidate.lemma}`,
      score,
      confidence: candidateConfidence(score, evidence),
      occupied,
      evidence
    });
  }

  return candidates;
}

function hasVerbStepMorphology(
  annotation: StrongLedger["verses"][number]["annotations"][number]
): boolean {
  return (
    annotation.step?.some((step) =>
      /(?:^|[/=;+ ])[HG]?V[A-Za-z]*/u.test(step.morphology)
    ) ?? false
  );
}

function auxiliaryFamiliesForAnnotation(
  annotation: StrongLedger["verses"][number]["annotations"][number]
): Set<string> {
  const tokens = new Set(
    stepGlossTokens(annotation.step?.map((step) => step.gloss) ?? [])
  );
  const families = new Set<string>();
  if (["had", "has", "have", "having"].some((token) => tokens.has(token))) {
    families.add("avoir");
  }
  if (
    ["am", "are", "be", "been", "being", "is", "was", "were"].some((token) =>
      tokens.has(token)
    )
  ) {
    families.add("etre");
  }
  return families;
}

const FRENCH_AUXILIARY_FORMS = new Map<string, string>([
  ["ai", "avoir"],
  ["as", "avoir"],
  ["a", "avoir"],
  ["avons", "avoir"],
  ["avez", "avoir"],
  ["ont", "avoir"],
  ["avais", "avoir"],
  ["avait", "avoir"],
  ["avions", "avoir"],
  ["aviez", "avoir"],
  ["avaient", "avoir"],
  ["eus", "avoir"],
  ["eut", "avoir"],
  ["eumes", "avoir"],
  ["eutes", "avoir"],
  ["eurent", "avoir"],
  ["aurai", "avoir"],
  ["auras", "avoir"],
  ["aura", "avoir"],
  ["aurons", "avoir"],
  ["aurez", "avoir"],
  ["auront", "avoir"],
  ["suis", "etre"],
  ["es", "etre"],
  ["est", "etre"],
  ["sommes", "etre"],
  ["etes", "etre"],
  ["sont", "etre"],
  ["etais", "etre"],
  ["etait", "etre"],
  ["etions", "etre"],
  ["etiez", "etre"],
  ["etaient", "etre"],
  ["fus", "etre"],
  ["fut", "etre"],
  ["fumes", "etre"],
  ["futes", "etre"],
  ["furent", "etre"],
  ["serai", "etre"],
  ["seras", "etre"],
  ["sera", "etre"],
  ["serons", "etre"],
  ["serez", "etre"],
  ["seront", "etre"]
]);

function phraseHintsFromSynonyms(
  seedTerms: Map<string, number>,
  synonymSources: SynonymSource[]
): Map<string, { evidence: CandidateEvidence[] }> {
  const hints = new Map<string, { evidence: CandidateEvidence[] }>();

  for (const seed of seedTerms.keys()) {
    for (const source of synonymSources) {
      for (const phrase of source.phraseSynonymsByLemma.get(seed)?.values() ??
        []) {
        const key = phraseKey(phrase.phrase);
        const existing = hints.get(key) ?? { evidence: [] };
        existing.evidence.push({
          source: `${source.name}-phrase`,
          detail: `${phrase.phrase.join(" ")} links to seed ${seed}`,
          weight: weightedSynonymScore(phrase.weight, source.name) + 0.08
        });
        hints.set(key, existing);
      }
    }
  }

  return hints;
}

function dedupePhraseCandidates(
  candidates: LexicalCandidate[]
): LexicalCandidate[] {
  const bestBySpan = new Map<string, LexicalCandidate>();
  for (const candidate of candidates) {
    const key = `${candidate.startWordIndex}:${candidate.endWordIndex}:${candidate.lemma}`;
    const existing = bestBySpan.get(key);
    if (!existing || candidate.score > existing.score) {
      bestBySpan.set(key, candidate);
    }
  }
  return [...bestBySpan.values()];
}

function synonymSourceEvidence(
  source: SynonymSource,
  lemma: string,
  seedTerms: Map<string, number>
): CandidateEvidence | undefined {
  const targetSynonyms = source.synonymsByLemma.get(lemma);
  const seedTermSet = new Set(seedTerms.keys());
  const matchingTargetSynonym = bestWeightedIntersection(
    targetSynonyms,
    seedTermSet
  );
  if (matchingTargetSynonym) {
    return {
      source: source.name,
      detail: `${lemma} links to seed ${matchingTargetSynonym.term}`,
      weight: weightedSynonymScore(matchingTargetSynonym.weight, source.name)
    };
  }

  for (const seed of seedTermSet) {
    const seedSynonyms = source.synonymsByLemma.get(seed);
    const weight = seedSynonyms?.get(lemma);
    if (weight && weight > 0) {
      return {
        source: source.name,
        detail: `${seed} links to target ${lemma}`,
        weight: weightedSynonymScore(weight, source.name)
      };
    }
  }

  return undefined;
}

function weightedSynonymScore(weight: number, source: string): number {
  const normalized = weight > 1 ? Math.min(1, weight / 500) : weight;
  const base = source === "rezojdm" ? 0.24 : 0.18;
  const scale = source === "rezojdm" ? 0.32 : 0.22;
  return base + normalized * scale;
}

function bestWeightedIntersection(
  values: Map<string, number> | undefined,
  expected: Set<string>
): { term: string; weight: number } | undefined {
  if (!values) return undefined;
  return [...values]
    .filter(([term]) => expected.has(term))
    .map(([term, weight]) => ({ term, weight }))
    .sort((left, right) => right.weight - left.weight)[0];
}

async function readSynonymSources(
  options: CliOptions,
  terms: {
    targetWords: Set<string>;
    dictionaryTerms: Set<string>;
    inferredTerms: Set<string>;
  }
): Promise<SynonymSource[]> {
  const sourceTerms = new Set([
    ...terms.targetWords,
    ...terms.dictionaryTerms,
    ...terms.inferredTerms
  ]);
  const sources: SynonymSource[] = [];

  if (options.jdmCacheDir) {
    sources.push({
      name: "rezojdm",
      synonymsByLemma: await readRezoJdmSynonyms({
        terms: sourceTerms,
        cacheDir: options.jdmCacheDir,
        fetchMissing: options.fetchJdm,
        fetchLimit: options.fetchJdmLimit
      }),
      phraseSynonymsByLemma: new Map()
    });
  }

  if (options.openOfficePath) {
    const openOffice = readOpenOfficeSynonymData(
      options.openOfficePath,
      sourceTerms
    );
    sources.push({
      name: "openoffice-synonyms",
      synonymsByLemma: openOffice.synonymsByLemma,
      phraseSynonymsByLemma: openOffice.phraseSynonymsByLemma
    });
  }

  if (options.wolfPath) {
    const wolf = readWolfSynonymData(options.wolfPath, sourceTerms);
    sources.push({
      name: "wolf",
      synonymsByLemma: wolf.synonymsByLemma,
      phraseSynonymsByLemma: wolf.phraseSynonymsByLemma
    });
  }

  return sources;
}

async function readCachedSynonymSources(
  options: CliOptions,
  terms: {
    targetWords: Set<string>;
    dictionaryTerms: Set<string>;
    inferredTerms: Set<string>;
  },
  cache?: LexicalCandidateSourceCache
): Promise<SynonymSource[]> {
  if (!cache) return readSynonymSources(options, terms);

  const key = lexicalSourceCacheKey([
    options.jdmCacheDir ?? "",
    String(options.fetchJdm),
    String(options.fetchJdmLimit),
    options.openOfficePath ?? "",
    options.wolfPath ?? "",
    lexicalSetKey(terms.targetWords),
    lexicalSetKey(terms.dictionaryTerms),
    lexicalSetKey(terms.inferredTerms)
  ]);
  const cached = cache.synonymSources.get(key);
  if (cached) return cached;

  const sources = await readSynonymSources(options, terms);
  cache.synonymSources.set(key, sources);
  return sources;
}

async function readRezoJdmSynonyms(options: {
  terms: Set<string>;
  cacheDir: string;
  fetchMissing: boolean;
  fetchLimit: number;
}): Promise<Map<string, Map<string, number>>> {
  await mkdir(options.cacheDir, { recursive: true });
  const synonyms = new Map<string, Map<string, number>>();
  let fetched = 0;

  for (const term of options.terms) {
    const cachePath = rezoJdmCachePath(options.cacheDir, term);
    if (
      !existsSync(cachePath) &&
      options.fetchMissing &&
      fetched < options.fetchLimit
    ) {
      fetched += 1;
      await fetchRezoJdm(term, cachePath);
    }
    if (existsSync(cachePath)) {
      synonyms.set(term, parseRezoJdmFile(cachePath, term));
    }
  }

  return synonyms;
}

function rezoJdmCachePath(cacheDir: string, term: string): string {
  const safe = encodeURIComponent(term);
  const preferred = path.join(cacheDir, `jdm-${safe}.json`);
  if (existsSync(preferred)) return preferred;
  const legacy = path.join(cacheDir, `${safe}.json`);
  return existsSync(legacy) ? legacy : preferred;
}

async function fetchRezoJdm(term: string, cachePath: string): Promise<void> {
  try {
    const response = await fetch(
      `https://jdm-api.demo.lirmm.fr/v0/relations/from/${encodeURIComponent(
        term
      )}?types=5`
    );
    if (!response.ok) return;
    await writeFile(cachePath, await response.text(), "utf8");
  } catch {
    // Network lookup is opportunistic; the report remains useful from cache.
  }
}

function parseRezoJdmFile(filePath: string, term: string): Map<string, number> {
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as {
      nodes?: Array<{ id: number; name: string }>;
      relations?: Array<{
        node1: number;
        node2: number;
        type: number;
        w: number;
      }>;
      request?: { node1?: string };
    };
    const requestedTerm = normalizeWord(parsed.request?.node1 ?? term);
    const nodes = parsed.nodes ?? [];
    const nodeById = new Map(nodes.map((node) => [node.id, node.name]));
    const sourceNode = nodes.find(
      (node) => normalizeWord(node.name) === requestedTerm
    );
    if (!sourceNode) return new Map();

    const synonyms = new Map<string, number>();
    for (const relation of parsed.relations ?? []) {
      if (
        relation.node1 !== sourceNode.id ||
        relation.type !== 5 ||
        relation.w <= 0
      ) {
        continue;
      }
      const rawName = nodeById.get(relation.node2);
      if (!rawName || isTechnicalLexicalNode(rawName)) continue;
      const normalized = normalizeWord(rawName);
      if (isContentWord(normalized)) {
        synonyms.set(
          normalized,
          Math.max(synonyms.get(normalized) ?? 0, relation.w)
        );
      }
    }
    return synonyms;
  } catch {
    return new Map();
  }
}

function readOpenOfficeSynonymData(
  filePath: string,
  terms: Set<string>
): {
  synonymsByLemma: Map<string, Map<string, number>>;
  phraseSynonymsByLemma: Map<string, Map<string, PhraseSynonym>>;
} {
  const text = readFileSync(filePath, "utf8");
  const body = text.includes("return []byte(`")
    ? text.slice(text.indexOf("`") + 1, text.lastIndexOf("`"))
    : text;
  const lines = body.split(/\r?\n/u);
  const synonyms = new Map<string, Map<string, number>>();
  const phraseSynonyms = new Map<string, Map<string, PhraseSynonym>>();

  for (let index = 1; index < lines.length; ) {
    const [word, countRaw] = (lines[index++] ?? "").split("|");
    const normalizedWord = normalizeWord(word ?? "");
    const count = Number(countRaw ?? 0);
    const forms = new Map<string, number>();

    for (let offset = 0; offset < count; offset += 1, index += 1) {
      const parts = (lines[index] ?? "").split("|").slice(1);
      for (const synonym of parts) {
        const phrase = normalizedPhraseWords(synonym);
        if (phrase.length > 1) {
          addPhraseSynonym(phraseSynonyms, normalizedWord, phrase, 1);
          continue;
        }
        const normalized = phrase[0] ?? normalizeWord(synonym);
        if (isContentWord(normalized)) forms.set(normalized, 1);
      }
    }

    if (terms.has(normalizedWord) && forms.size > 0) {
      synonyms.set(normalizedWord, forms);
    }
  }

  return { synonymsByLemma: synonyms, phraseSynonymsByLemma: phraseSynonyms };
}

function readWolfSynonymData(
  filePath: string,
  terms: Set<string>
): {
  synonymsByLemma: Map<string, Map<string, number>>;
  phraseSynonymsByLemma: Map<string, Map<string, PhraseSynonym>>;
} {
  const text = readTextPossiblyCompressed(filePath);
  const synonyms = new Map<string, Map<string, number>>();
  const phraseSynonyms = new Map<string, Map<string, PhraseSynonym>>();
  const synsets = text.match(/<SYNSET>.*?<\/SYNSET>/gsu) ?? [];

  for (const synset of synsets) {
    const literals = [
      ...synset.matchAll(/<LITERAL(?: [^>]*)?>(.*?)<\/LITERAL>/gsu)
    ].map((match) => normalizedPhraseWords(stripXml(match[1] ?? "")));
    const singleLiterals = literals
      .filter((phrase) => phrase.length === 1)
      .map((phrase) => phrase[0] ?? "")
      .filter(isContentWord);
    const phraseLiterals = literals.filter(
      (phrase) => phrase.length > 1 && isUsefulPhrase(phrase)
    );
    const relevant = singleLiterals.filter((literal) => terms.has(literal));
    if (relevant.length === 0) continue;

    for (const literal of relevant) {
      const forms = synonyms.get(literal) ?? new Map();
      for (const other of singleLiterals) {
        if (other !== literal) forms.set(other, 1);
      }
      synonyms.set(literal, forms);
      for (const phrase of phraseLiterals) {
        addPhraseSynonym(phraseSynonyms, literal, phrase, 1);
      }
    }
  }

  return { synonymsByLemma: synonyms, phraseSynonymsByLemma: phraseSynonyms };
}

function readTextPossiblyCompressed(filePath: string): string {
  if (filePath.endsWith(".bz2")) {
    try {
      return execFileSync("bzcat", [filePath], {
        encoding: "utf8",
        maxBuffer: 256 * 1024 * 1024
      });
    } catch {
      return "";
    }
  }

  return readFileSync(filePath, "utf8");
}

async function readKaikkiIndex(
  filePath: string,
  targetWords: Set<string>,
  englishHints: Set<string>
): Promise<KaikkiIndex> {
  const sqlitePath = defaultKaikkiSqlitePath(filePath);
  if (hasKaikkiSqliteIndex(sqlitePath)) {
    return readKaikkiSqliteIndex({ sqlitePath, targetWords, englishHints });
  }

  const index = emptyKaikkiIndex();
  const input = filePath.endsWith(".gz")
    ? createReadStream(filePath).pipe(createGunzip())
    : createReadStream(filePath);
  const lines = readline.createInterface({ input });

  for await (const line of lines) {
    const entry = safeJsonParse(line);
    if (!entry || entry.lang_code !== "fr" || typeof entry.word !== "string") {
      continue;
    }

    const normalizedWord = normalizeWord(entry.word);
    const glossTokens = new Set(entryGlossTokens(entry));

    for (const token of glossTokens) {
      if (englishHints.has(token)) {
        const terms =
          index.englishGlossToFrench.get(token) ?? new Set<string>();
        terms.add(normalizedWord);
        index.englishGlossToFrench.set(token, terms);
      }
    }

    if (targetWords.has(normalizedWord)) {
      const lemma = formOfLemma(entry) ?? normalizedWord;
      index.formToLemma.set(normalizedWord, lemma);
      index.lemmaGlossTokens.set(lemma, glossTokens);
    }

    for (const form of entry.forms ?? []) {
      if (typeof form?.form !== "string") continue;
      const normalizedForm = normalizeWord(form.form);
      if (targetWords.has(normalizedForm)) {
        index.formToLemma.set(normalizedForm, normalizedWord);
        index.lemmaGlossTokens.set(normalizedWord, glossTokens);
      }
    }
  }

  return index;
}

async function readCachedKaikkiIndex(
  filePath: string,
  targetWords: Set<string>,
  englishHints: Set<string>,
  cache?: LexicalCandidateSourceCache
): Promise<KaikkiIndex> {
  if (!cache) return readKaikkiIndex(filePath, targetWords, englishHints);

  const key = lexicalSourceCacheKey([
    filePath,
    lexicalSetKey(targetWords),
    lexicalSetKey(englishHints)
  ]);
  const cached = cache.kaikki.get(key);
  if (cached) return cached;

  const index = await readKaikkiIndex(filePath, targetWords, englishHints);
  cache.kaikki.set(key, index);
  return index;
}

function lexicalSourceCacheKey(parts: string[]): string {
  return parts.join("\u0000");
}

function lexicalSetKey(values: Set<string>): string {
  return [...values].sort().join("\u0001");
}

function safeJsonParse(line: string): KaikkiEntry | undefined {
  try {
    return JSON.parse(line) as KaikkiEntry;
  } catch {
    return undefined;
  }
}

function entryGlossTokens(entry: KaikkiEntry): string[] {
  const tokens = (entry.senses ?? [])
    .flatMap((sense) => (Array.isArray(sense.glosses) ? sense.glosses : []))
    .filter((gloss): gloss is string => typeof gloss === "string")
    .flatMap((gloss) => englishTokens(gloss));
  return [...new Set<string>(tokens)];
}

function formOfLemma(entry: KaikkiEntry): string | undefined {
  for (const sense of entry.senses ?? []) {
    const lemma = sense.form_of?.[0]?.word;
    if (typeof lemma === "string") return normalizeWord(lemma);
  }
  return undefined;
}

function emptyKaikkiIndex(): KaikkiIndex {
  return {
    formToLemma: new Map(),
    lemmaGlossTokens: new Map(),
    englishGlossToFrench: new Map()
  };
}

function lemmaForToken(normalized: string, kaikki: KaikkiIndex): string {
  return kaikki.formToLemma.get(normalized) ?? normalized;
}

function inferredFrenchTerms(
  englishHints: string[],
  kaikki: KaikkiIndex
): Set<string> {
  const terms = new Set<string>();
  for (const hint of englishHints) {
    for (const term of kaikki.englishGlossToFrench.get(hint) ?? []) {
      if (isContentWord(term)) terms.add(term);
    }
  }
  return terms;
}

async function readStrongLedger(
  ledgerPath: string,
  onlyRef?: string
): Promise<StrongLedger> {
  if (ledgerPath.endsWith(".sqlite")) {
    return readStrongLedgerSqlite({ sqlitePath: ledgerPath, onlyRef });
  }

  const ledger = JSON.parse(await readFile(ledgerPath, "utf8")) as StrongLedger;
  if (!ledger.split) return ledger;

  const verses = (
    await Promise.all(
      (ledger.verseFiles ?? []).map(async (file) => {
        return JSON.parse(
          await readFile(file.path, "utf8")
        ) as StrongLedger["verses"];
      })
    )
  ).flat();

  return { ...ledger, verses };
}

function groupDictionaryTerms(
  candidates: StrongTranslationCandidate[]
): Map<string, Map<string, number>> {
  const grouped = new Map<string, Map<string, number>>();

  for (const candidate of candidates) {
    if (!isContentWord(candidate.normalized)) continue;
    const terms = grouped.get(candidate.strong) ?? new Map();
    terms.set(
      candidate.normalized,
      Math.max(terms.get(candidate.normalized) ?? 0, candidate.score)
    );
    grouped.set(candidate.strong, terms);
  }

  return grouped;
}

function isCandidateEmptyAnnotation(
  annotation: StrongLedger["verses"][number]["annotations"][number]
): boolean {
  return (
    (annotation.visibility === "reader" ||
      annotation.visibility === "advanced") &&
    annotation.placement === "empty" &&
    annotation.lexiconLookup !== false
  );
}

function relocationCandidateAnnotations(
  verse: StrongLedger["verses"][number]
): Array<StrongLedger["verses"][number]["annotations"][number]> {
  const visibleWordAnnotations = verse.annotations.filter(
    (annotation) =>
      annotation.visibility === "reader" &&
      annotation.placement === "word" &&
      annotation.wordIndex !== undefined &&
      annotation.lexiconLookup !== false
  );
  const strongByWord = new Map<number, Set<string>>();

  for (const annotation of visibleWordAnnotations) {
    const wordIndex = annotation.wordIndex;
    if (wordIndex === undefined) continue;
    const strong = strongByWord.get(wordIndex) ?? new Set<string>();
    strong.add(annotation.strong);
    strongByWord.set(wordIndex, strong);
  }

  return visibleWordAnnotations.filter((annotation) => {
    const wordIndex = annotation.wordIndex;
    return (
      wordIndex !== undefined &&
      (strongByWord.get(wordIndex)?.size ?? 0) > 1 &&
      isContentWord(annotation.normalizedWord ?? "")
    );
  });
}

function currentTargetForAnnotation(
  verse: StrongLedger["verses"][number],
  annotation: StrongLedger["verses"][number]["annotations"][number]
): LexicalCandidateItem["currentTarget"] {
  if (annotation.placement !== "word" || annotation.wordIndex === undefined) {
    return undefined;
  }
  const token = verse.tokens.find(
    (candidate) => candidate.wordIndex === annotation.wordIndex
  );
  if (!token) return undefined;
  const otherStrong = verse.annotations
    .filter(
      (candidate) =>
        candidate.visibility === "reader" &&
        candidate.placement === "word" &&
        candidate.wordIndex === annotation.wordIndex &&
        candidate.strong !== annotation.strong
    )
    .map((candidate) => candidate.strong);

  return {
    wordIndex: token.wordIndex,
    text: token.text,
    normalized: token.normalized,
    otherStrong
  };
}

function isWordOccupied(
  verse: StrongLedger["verses"][number],
  wordIndex: number
): boolean {
  return verse.annotations.some((annotation) => {
    if (annotation.visibility !== "reader") return false;
    if (annotation.placement === "word") {
      return annotation.wordIndex === wordIndex;
    }
    if (annotation.placement !== "phrase") return false;
    return (
      annotation.startWordIndex !== undefined &&
      annotation.endWordIndex !== undefined &&
      wordIndex >= annotation.startWordIndex &&
      wordIndex <= annotation.endWordIndex
    );
  });
}

function isPhraseOccupied(
  verse: StrongLedger["verses"][number],
  startWordIndex: number,
  endWordIndex: number
): boolean {
  for (
    let wordIndex = startWordIndex;
    wordIndex <= endWordIndex;
    wordIndex += 1
  ) {
    if (isWordOccupied(verse, wordIndex)) return true;
  }
  return false;
}

function stepGlossTokens(glosses: string[]): string[] {
  return [...new Set(glosses.flatMap(englishTokens))];
}

function englishTokens(text: string): string[] {
  return tokenizeText(text)
    .filter((segment) => segment.kind === "word")
    .map((segment) => englishStem(segment.normalized))
    .filter((token) => token.length >= 3 && !ENGLISH_STOP_WORDS.has(token));
}

function englishStem(word: string): string {
  if (word.endsWith("ing") && word.length > 5) return word.slice(0, -3);
  if (word.endsWith("ed") && word.length > 4) return word.slice(0, -2);
  if (word.endsWith("s") && word.length > 4) return word.slice(0, -1);
  return word;
}

const ENGLISH_STOP_WORDS = new Set([
  "and",
  "are",
  "for",
  "her",
  "him",
  "his",
  "let",
  "not",
  "she",
  "the",
  "them",
  "they",
  "this",
  "that",
  "with",
  "you"
]);

function isContentWord(word: string): boolean {
  return word.length >= 3 && !FUNCTION_WORDS.has(word) && !/^\d+$/u.test(word);
}

function shouldScoreToken(
  token: StrongLedger["verses"][number]["tokens"][number],
  annotation: StrongLedger["verses"][number]["annotations"][number]
): boolean {
  if (isContentWord(token.normalized)) return true;
  if (numericValuesForAnnotation(annotation).size === 0) {
    return false;
  }
  return numericValuesForTarget(token.normalized).size > 0;
}

function isUsefulPhrase(words: string[]): boolean {
  return (
    words.length >= 2 &&
    words.length <= 5 &&
    words.some((word) => isContentWord(word))
  );
}

function normalizedPhraseWords(text: string): string[] {
  return tokenizeText(text)
    .filter((segment) => segment.kind === "word")
    .map((segment) => segment.normalized)
    .filter((word) => word.length > 0);
}

function phraseKeysForSpan(
  span: StrongLedger["verses"][number]["tokens"],
  kaikki: KaikkiIndex
): string[] {
  const variants = span.map((token) => {
    const lemma = lemmaForToken(token.normalized, kaikki);
    return lemma === token.normalized
      ? [token.normalized]
      : [lemma, token.normalized];
  });
  const keys: string[] = [];

  const visit = (index: number, words: string[]) => {
    if (index >= variants.length) {
      keys.push(phraseKey(words));
      return;
    }
    for (const variant of variants[index] ?? []) {
      visit(index + 1, [...words, variant]);
    }
  };

  visit(0, []);
  return [...new Set(keys)];
}

function phraseKey(words: string[]): string {
  return words.join(" ");
}

function addPhraseSynonym(
  phraseSynonyms: Map<string, Map<string, PhraseSynonym>>,
  lemma: string,
  phrase: string[],
  weight: number
): void {
  if (!isContentWord(lemma) || !isUsefulPhrase(phrase)) return;
  const key = phraseKey(phrase);
  const entries = phraseSynonyms.get(lemma) ?? new Map<string, PhraseSynonym>();
  const existing = entries.get(key);
  if (!existing || weight > existing.weight) {
    entries.set(key, { phrase, weight });
  }
  phraseSynonyms.set(lemma, entries);
}

function isTechnicalLexicalNode(name: string): boolean {
  return (
    name.startsWith("_") ||
    name.includes(":") ||
    name.includes(">") ||
    name.includes("=")
  );
}

function overlapCount(left: Set<string>, right: Set<string>): number {
  let count = 0;
  for (const value of left) {
    if (right.has(value)) count += 1;
  }
  return count;
}

function positionScore(
  sourceWordIndex: number | undefined,
  targetWordIndex: number,
  wordCount: number
): number {
  if (sourceWordIndex === undefined || wordCount <= 1) return 0.5;
  const distance = Math.abs(targetWordIndex - sourceWordIndex);
  return Math.max(0, 1 - distance / Math.max(1, wordCount - 1));
}

function verseMatchesScope(
  verse: StrongLedger["verses"][number],
  scope: string
): boolean {
  if (scope.includes("-")) {
    const range = parseScopeRange(scope);
    if (!range) return false;
    return (
      compareVerseRef(verse, range.start) >= 0 &&
      compareVerseRef(verse, range.end) <= 0
    );
  }
  return verse.ref === scope || verse.ref.startsWith(`${scope}.`);
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
  verse: { bookId: string; chapter: number; verse: number },
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

function stripXml(text: string): string {
  return text.replace(/<[^>]+>/gu, "");
}

function roundRatio(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function countEvidenceSources(
  items: LexicalCandidateItem[]
): Record<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const candidate of item.candidates) {
      for (const evidence of candidate.evidence) {
        counts.set(evidence.source, (counts.get(evidence.source) ?? 0) + 1);
      }
    }
  }
  return Object.fromEntries(
    [...counts].sort((left, right) => left[0].localeCompare(right[0]))
  );
}

function applyProperNameGroupAutoSafe(items: LexicalCandidateItem[]): void {
  const groups = new Map<string, LexicalCandidateItem[]>();
  for (const item of items) {
    if (!item.candidates.some(isProperNameCandidate)) continue;
    const key = `${item.ref}:${item.strong}`;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }

  for (const [groupId, group] of groups) {
    const targetCandidates = new Map<number, LexicalCandidate>();
    for (const item of group) {
      for (const candidate of item.candidates.filter(
        isOpenHighProperNameCandidate
      )) {
        const existing = targetCandidates.get(candidate.wordIndex);
        if (!existing || candidate.score > existing.score) {
          targetCandidates.set(candidate.wordIndex, candidate);
        }
      }
    }

    const targets = [...targetCandidates.values()].sort(
      (left, right) => left.wordIndex - right.wordIndex
    );
    if (targets.length < 2) continue;
    if (group.length < targets.length || group.length % targets.length !== 0) {
      continue;
    }

    const capacityPerTarget = group.length / targets.length;
    const slots = targets.flatMap((target) =>
      Array.from({ length: capacityPerTarget }, () => target)
    );
    const orderedItems = [...group].sort(
      (left, right) =>
        lexicalItemSourceAnchor(left) - lexicalItemSourceAnchor(right) ||
        lexicalItemCurrentAnchor(left) - lexicalItemCurrentAnchor(right) ||
        left.auditKind.localeCompare(right.auditKind)
    );

    const assignments = orderedItems.map((item, index) => {
      const slot = slots[index];
      if (!slot) return undefined;
      const candidate = item.candidates.find(
        (candidate) =>
          candidate.wordIndex === slot.wordIndex &&
          isOpenHighProperNameCandidate(candidate)
      );
      return candidate;
    });

    if (assignments.some((candidate) => !candidate)) continue;

    assignments.forEach((candidate, index) => {
      const item = orderedItems[index];
      if (!item || !candidate) return;
      item.groupAutoSafe = {
        groupId,
        assignedWordIndex: candidate.wordIndex,
        assignedText: candidate.text,
        sourceRank: index + 1,
        groupSize: orderedItems.length,
        targetCount: targets.length,
        capacityPerTarget,
        reason: `proper-name group resolved by source order across ${targets.length} French carriers`
      };
    });
  }
}

function applyProperNameSequenceAutoSafe(items: LexicalCandidateItem[]): void {
  const groups = new Map<string, LexicalCandidateItem[]>();
  for (const item of items) {
    if (item.groupAutoSafe || item.auditKind !== "empty") continue;
    if (!item.candidates.some(isOpenHighProperNameCandidate)) continue;
    const group = groups.get(item.ref) ?? [];
    group.push(item);
    groups.set(item.ref, group);
  }

  for (const [ref, group] of groups) {
    if (group.length < 2) continue;

    const orderedItems = [...group].sort(
      (left, right) =>
        lexicalItemSourceAnchor(left) - lexicalItemSourceAnchor(right) ||
        lexicalItemCurrentAnchor(left) - lexicalItemCurrentAnchor(right) ||
        left.strong.localeCompare(right.strong)
    );
    const properNameCandidatesByItem = new Map<
      LexicalCandidateItem,
      LexicalCandidate[]
    >(
      orderedItems.map((item) => [
        item,
        item.candidates.filter(isOpenHighProperNameCandidate)
      ])
    );
    if (
      [...properNameCandidatesByItem.values()].every(
        (candidates) => candidates.length === 1
      )
    ) {
      continue;
    }

    const targetsByWordIndex = new Map<number, LexicalCandidate>();
    for (const item of orderedItems) {
      for (const candidate of properNameCandidatesByItem.get(item) ?? []) {
        const existing = targetsByWordIndex.get(candidate.wordIndex);
        if (!existing || candidate.score > existing.score) {
          targetsByWordIndex.set(candidate.wordIndex, candidate);
        }
      }
    }

    const targets = [...targetsByWordIndex.values()].sort(
      (left, right) => left.wordIndex - right.wordIndex
    );
    if (targets.length !== orderedItems.length) continue;

    const assignments = orderedItems.map((item, index) => {
      const slot = targets[index];
      if (!slot || slot.wordIndex < lexicalItemSourceAnchor(item)) {
        return undefined;
      }
      return (properNameCandidatesByItem.get(item) ?? []).find(
        (candidate) => candidate.wordIndex === slot.wordIndex
      );
    });
    if (assignments.some((candidate) => !candidate)) continue;

    const groupId = `${ref}:proper-name-sequence`;
    assignments.forEach((candidate, index) => {
      const item = orderedItems[index];
      if (!item || !candidate) return;
      item.groupAutoSafe = {
        groupId,
        assignedWordIndex: candidate.wordIndex,
        assignedText: candidate.text,
        sourceRank: index + 1,
        groupSize: orderedItems.length,
        targetCount: targets.length,
        capacityPerTarget: 1,
        reason: `proper-name sequence resolved by source order across ${targets.length} French carriers`
      };
    });
  }
}

function applyLexicalDuplicateGroupAutoSafe(
  items: LexicalCandidateItem[]
): void {
  const groups = new Map<string, LexicalCandidateItem[]>();
  for (const item of items) {
    if (item.groupAutoSafe || item.auditKind !== "empty") continue;
    if (!item.candidates.some(isOpenHighLexicalDuplicateCandidate)) continue;
    const key = `${item.ref}:${item.strong}`;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }

  for (const [groupId, group] of groups) {
    if (group.length < 2) continue;
    const candidatesByLexeme = new Map<string, Map<number, LexicalCandidate>>();

    for (const item of group) {
      for (const candidate of item.candidates.filter(
        isOpenHighLexicalDuplicateCandidate
      )) {
        const lexemeKey = lexicalDuplicateCandidateKey(candidate);
        const candidates =
          candidatesByLexeme.get(lexemeKey) ??
          new Map<number, LexicalCandidate>();
        const existing = candidates.get(candidate.wordIndex);
        if (!existing || candidate.score > existing.score) {
          candidates.set(candidate.wordIndex, candidate);
        }
        candidatesByLexeme.set(lexemeKey, candidates);
      }
    }

    for (const [lexemeKey, candidatesByWordIndex] of candidatesByLexeme) {
      const targets = [...candidatesByWordIndex.values()].sort(
        (left, right) => left.wordIndex - right.wordIndex
      );
      if (targets.length !== group.length) continue;

      const orderedItems = [...group].sort(
        (left, right) =>
          lexicalItemSourceAnchor(left) - lexicalItemSourceAnchor(right) ||
          lexicalItemCurrentAnchor(left) - lexicalItemCurrentAnchor(right) ||
          left.auditKind.localeCompare(right.auditKind)
      );

      const assignments = orderedItems.map((item, index) => {
        const slot = targets[index];
        if (!slot) return undefined;
        return item.candidates.find(
          (candidate) =>
            candidate.wordIndex === slot.wordIndex &&
            lexicalDuplicateCandidateKey(candidate) === lexemeKey &&
            isOpenHighLexicalDuplicateCandidate(candidate)
        );
      });

      if (assignments.some((candidate) => !candidate)) continue;

      assignments.forEach((candidate, index) => {
        const item = orderedItems[index];
        if (!item || !candidate) return;
        item.groupAutoSafe = {
          groupId,
          assignedWordIndex: candidate.wordIndex,
          assignedText: candidate.text,
          sourceRank: index + 1,
          groupSize: orderedItems.length,
          targetCount: targets.length,
          capacityPerTarget: 1,
          reason: `duplicate lexical group resolved by source order across ${targets.length} matching French carriers`
        };
      });
      break;
    }
  }
}

function isProperNameCandidate(candidate: LexicalCandidate): boolean {
  return candidate.evidence.some(
    (evidence) => evidence.source === "proper-name-step"
  );
}

function isOpenHighProperNameCandidate(candidate: LexicalCandidate): boolean {
  return (
    candidate.confidence === "high" &&
    !candidate.occupied &&
    isProperNameCandidate(candidate)
  );
}

function isOpenHighLexicalDuplicateCandidate(
  candidate: LexicalCandidate
): boolean {
  return (
    candidate.target === "word" &&
    candidate.confidence === "high" &&
    !candidate.occupied &&
    !isProperNameCandidate(candidate) &&
    !isStackSafeLexicalCandidateEvidence(candidate.evidence) &&
    hasDirectLexicalEvidence(candidate) &&
    new Set(candidate.evidence.map((evidence) => evidence.source)).size >= 2
  );
}

function lexicalDuplicateCandidateKey(candidate: LexicalCandidate): string {
  return candidate.lemma || candidate.normalized;
}

function lexicalItemSourceAnchor(item: LexicalCandidateItem): number {
  return item.insertAfterWordIndex ?? item.currentTarget?.wordIndex ?? 0;
}

function lexicalItemCurrentAnchor(item: LexicalCandidateItem): number {
  return item.currentTarget?.wordIndex ?? Number.MAX_SAFE_INTEGER;
}

function isAutoSafeItem(item: LexicalCandidateItem): boolean {
  return Boolean(item.groupAutoSafe) || Boolean(selectAutoSafeCandidate(item));
}

export function lexicalAutoSafePlacements(
  report: LexicalCandidateReport
): LexicalAutoSafePlacement[] {
  const placements: LexicalAutoSafePlacement[] = [];

  for (const item of report.items) {
    if (item.groupAutoSafe) {
      const candidate = item.candidates.find(
        (candidate) =>
          candidate.wordIndex === item.groupAutoSafe?.assignedWordIndex
      );
      if (candidate) {
        placements.push({ item, candidate, kind: "group-auto-safe" });
      }
      continue;
    }

    const candidate = selectAutoSafeCandidate(item);
    if (candidate) {
      placements.push({
        item,
        candidate,
        kind: "auto-safe"
      });
    }
  }

  return placements;
}

function selectAutoSafeCandidate(
  item: LexicalCandidateItem
): LexicalCandidate | undefined {
  const candidates = item.candidates.filter((candidate) =>
    isAutoSafeCandidate(item, candidate)
  );
  if (candidates.length === 1) return candidates[0];

  const phraseCandidates = candidates.filter(isAuxiliaryPhraseCandidate);
  for (const phrase of phraseCandidates) {
    if (
      candidates.every(
        (candidate) =>
          candidate === phrase ||
          isCandidateContainedInPhrase(candidate, phrase)
      )
    ) {
      return phrase;
    }
  }

  return undefined;
}

function isAuxiliaryPhraseCandidate(candidate: LexicalCandidate): boolean {
  return (
    candidate.target === "phrase" &&
    candidate.evidence.some(
      (evidence) => evidence.source === "french-auxiliary-phrase"
    )
  );
}

function isCandidateContainedInPhrase(
  candidate: LexicalCandidate,
  phrase: LexicalCandidate
): boolean {
  if (
    phrase.startWordIndex === undefined ||
    phrase.endWordIndex === undefined
  ) {
    return false;
  }
  if (candidate.target !== "word") return false;
  return (
    candidate.wordIndex >= phrase.startWordIndex &&
    candidate.wordIndex <= phrase.endWordIndex
  );
}

export function isAutoSafeCandidate(
  item: LexicalCandidateItem,
  candidate: LexicalCandidate
): boolean {
  if (candidate.confidence !== "high") return false;
  const stackSafe = isStackSafeLexicalCandidateEvidence(candidate.evidence);
  if (candidate.occupied && !stackSafe) return false;
  if (!hasDirectLexicalEvidence(candidate)) return false;
  if (isSimpleStepProperNameAutoSafeCandidate(item, candidate)) return true;
  if (
    !stackSafe &&
    new Set(candidate.evidence.map((evidence) => evidence.source)).size < 2
  ) {
    return false;
  }
  if (item.auditKind === "relocation") {
    if (isNumericCompoundRelocationCandidate(item, candidate)) return true;
    if (isNumericCompoundBacktrackCandidate(item, candidate)) return false;
    return candidate.score >= currentTargetScore(item) + 0.12;
  }
  if (isDominantPhraseAutoSafeCandidate(item, candidate)) return true;
  if (isNumericCompoundEmptyDuplicateCandidate(item, candidate)) return true;
  const highSafeCount = item.candidates.filter(
    isHighScoringAutoSafeAmbiguityCandidate
  ).length;
  return highSafeCount === 1;
}

function isHighScoringAutoSafeAmbiguityCandidate(
  candidate: LexicalCandidate
): boolean {
  return (
    candidate.score >= HIGH_CONFIDENCE_THRESHOLD &&
    (!candidate.occupied ||
      isStackSafeLexicalCandidateEvidence(candidate.evidence))
  );
}

function isSimpleStepProperNameAutoSafeCandidate(
  item: LexicalCandidateItem,
  candidate: LexicalCandidate
): boolean {
  if (item.auditKind !== "empty") return false;
  if (candidate.target !== "word" || candidate.occupied) return false;
  if (item.stepGlosses.length !== 1) return false;
  if (!isStepOnlyProperNameCandidate(candidate)) return false;

  const eligibleCandidates = item.candidates.filter(
    isStepOnlyProperNameCandidate
  );
  return eligibleCandidates.length === 1;
}

function isStepOnlyProperNameCandidate(candidate: LexicalCandidate): boolean {
  if (!isOpenHighProperNameCandidate(candidate)) return false;
  const sources = new Set(
    candidate.evidence.map((evidence) => evidence.source)
  );
  return sources.size === 1 && sources.has("proper-name-step");
}

function isNumericCompoundEmptyDuplicateCandidate(
  item: LexicalCandidateItem,
  candidate: LexicalCandidate
): boolean {
  if (item.auditKind !== "empty") return false;
  if (candidate.target !== "word" || !candidate.occupied) return false;
  if (!isStackSafeLexicalCandidateEvidence(candidate.evidence)) return false;

  const candidateValueCount = numericValuesForTarget(candidate.normalized).size;
  if (candidateValueCount < 2) return false;

  const stackSafeCandidates = item.candidates.filter(
    (other) =>
      other.confidence === "high" &&
      other.target === "word" &&
      isStackSafeLexicalCandidateEvidence(other.evidence)
  );
  const richerCandidates = stackSafeCandidates.filter(
    (other) => numericValuesForTarget(other.normalized).size >= 2
  );
  if (richerCandidates.length !== 1) return false;
  return richerCandidates[0]?.wordIndex === candidate.wordIndex;
}

function isDominantPhraseAutoSafeCandidate(
  item: LexicalCandidateItem,
  candidate: LexicalCandidate
): boolean {
  if (item.auditKind !== "empty" || candidate.target !== "phrase") {
    return false;
  }
  if (
    candidate.startWordIndex === undefined ||
    candidate.endWordIndex === undefined
  ) {
    return false;
  }
  if (
    !candidate.evidence.some(
      (evidence) => evidence.source === "french-auxiliary-phrase"
    )
  ) {
    return false;
  }

  const highOpenCandidates = item.candidates.filter(
    (other) =>
      other.confidence === "high" &&
      !other.occupied &&
      other.wordIndex >= candidate.startWordIndex! &&
      other.wordIndex <= candidate.endWordIndex!
  );
  const highOpenOutsidePhrase = item.candidates.filter(
    (other) =>
      other.confidence === "high" &&
      !other.occupied &&
      (other.wordIndex < candidate.startWordIndex! ||
        other.wordIndex > candidate.endWordIndex!)
  );
  const highOpenDirectOutsidePhrase = highOpenOutsidePhrase.filter((other) =>
    hasDirectLexicalEvidence(other)
  );

  if (highOpenCandidates.length >= 2) {
    return highOpenDirectOutsidePhrase.length === 0;
  }

  return candidate.score >= 0.98 && highOpenDirectOutsidePhrase.length === 0;
}

function currentTargetScore(item: LexicalCandidateItem): number {
  if (!item.currentTarget) return 0;
  return (
    item.candidates.find(
      (candidate) => candidate.wordIndex === item.currentTarget?.wordIndex
    )?.score ?? 0
  );
}

function isNumericCompoundRelocationCandidate(
  item: LexicalCandidateItem,
  candidate: LexicalCandidate
): boolean {
  if (item.auditKind !== "relocation" || !item.currentTarget) return false;
  if (candidate.wordIndex === item.currentTarget.wordIndex) return false;
  if (candidate.wordIndex < item.currentTarget.wordIndex) return false;
  if (!candidate.occupied) return false;
  if (item.currentTarget.otherStrong.length === 0) return false;
  if (!isStackSafeLexicalCandidateEvidence(candidate.evidence)) return false;

  const currentCandidate = item.candidates.find(
    (current) => current.wordIndex === item.currentTarget?.wordIndex
  );
  if (
    !currentCandidate ||
    !isStackSafeLexicalCandidateEvidence(currentCandidate.evidence)
  ) {
    return false;
  }

  const currentValues = numericValuesForTarget(item.currentTarget.normalized);
  const targetValues = numericValuesForTarget(candidate.normalized);
  return targetValues.size > currentValues.size;
}

function isNumericCompoundBacktrackCandidate(
  item: LexicalCandidateItem,
  candidate: LexicalCandidate
): boolean {
  if (item.auditKind !== "relocation" || !item.currentTarget) return false;
  if (candidate.wordIndex >= item.currentTarget.wordIndex) return false;
  if (!isStackSafeLexicalCandidateEvidence(candidate.evidence)) return false;

  const currentCandidate = item.candidates.find(
    (current) => current.wordIndex === item.currentTarget?.wordIndex
  );
  if (
    !currentCandidate ||
    !isStackSafeLexicalCandidateEvidence(currentCandidate.evidence)
  ) {
    return false;
  }

  return (
    numericValuesForTarget(item.currentTarget.normalized).size >
    numericValuesForTarget(candidate.normalized).size
  );
}

function bestOpenCandidate(
  item: LexicalCandidateItem
): LexicalCandidate | undefined {
  return item.candidates.find((candidate) => !candidate.occupied);
}

function renderMarkdownReport(report: LexicalCandidateReport): string {
  const lines = [
    `# Lexical Candidate Report`,
    "",
    `Bible: \`${report.bible}\``,
    `Scope: \`${report.scope}\``,
    `Generated: \`${report.generatedAt}\``,
    "",
    "## Metrics",
    "",
    `- Verses: ${report.metrics.verses}`,
    `- Audit items: ${report.metrics.auditItems}`,
    `- Advanced empty annotations: ${report.metrics.emptyAnnotations}`,
    `- Reader empty annotations: ${report.metrics.readerEmptyAnnotations}`,
    `- STEP/advanced empty annotations: ${report.metrics.advancedEmptyAnnotations}`,
    `- Relocation annotations: ${report.metrics.relocationAnnotations}`,
    `- Items with candidates: ${report.metrics.itemsWithCandidates}`,
    `- Empty annotations with candidates: ${report.metrics.emptyWithCandidates}`,
    `- Relocation annotations with candidates: ${report.metrics.relocationWithCandidates}`,
    `- Candidate count: ${report.metrics.candidateCount}`,
    `- High-confidence candidates: ${report.metrics.highConfidenceCandidates}`,
    `- Medium-confidence candidates: ${report.metrics.mediumConfidenceCandidates}`,
    `- Low-confidence candidates: ${report.metrics.lowConfidenceCandidates}`,
    `- Open candidates: ${report.metrics.openCandidates}`,
    `- Occupied candidates: ${report.metrics.occupiedCandidates}`,
    `- Reviewable candidates: ${report.metrics.reviewableCandidates}`,
    `- Auto-safe candidates: ${report.metrics.autoSafeCandidates}`,
    `- Auto-safe items: ${report.metrics.autoSafeItems}`,
    `- Group auto-safe items: ${report.metrics.groupAutoSafeItems}`,
    `- High-confidence ambiguous items: ${report.metrics.ambiguousHighItems}`,
    `- Items with open high candidate: ${report.metrics.openHighItems}`,
    `- Relocation items with better open candidate: ${report.metrics.relocationBetterOpenItems}`,
    `- Evidence sources: ${
      Object.entries(report.metrics.evidenceSourceCounts)
        .map(([source, count]) => `${source}=${count}`)
        .join(", ") || "none"
    }`,
    "",
    "## Sources",
    "",
    `- Strong dictionary: ${report.sources.strongDictionary ? "yes" : "no"}`,
    `- Kaikki: ${report.sources.kaikki ?? "not used"}`,
    `- RezoJDM cache: ${report.sources.rezoJdmCache ?? "not used"}`,
    `- RezoJDM fetch: ${report.sources.rezoJdmFetch ? "yes" : "no"}`,
    `- OpenOffice synonyms: ${report.sources.openOffice ?? "not used"}`,
    `- WOLF: ${report.sources.wolf ?? "not used"}`,
    "",
    "## Candidates",
    ""
  ];

  for (const item of report.items.filter((row) => row.candidates.length > 0)) {
    lines.push(`### ${item.ref} ${item.strong} (${item.auditKind})`, "");
    if (item.currentTarget) {
      lines.push(
        `Current target: ${item.currentTarget.wordIndex}: \`${item.currentTarget.text}\`${
          item.currentTarget.otherStrong.length > 0
            ? ` with ${item.currentTarget.otherStrong.map((strong) => `\`${strong}\``).join(", ")}`
            : ""
        }`
      );
    }
    if (item.sourceStrong)
      lines.push(`Source Strong: \`${item.sourceStrong}\``);
    if (item.stepGlosses.length > 0) {
      lines.push(
        `STEP gloss: ${item.stepGlosses.map((gloss) => `\`${gloss}\``).join(", ")}`
      );
    }
    if (item.dictionaryTerms.length > 0) {
      lines.push(
        `Dictionary terms: ${item.dictionaryTerms
          .slice(0, 12)
          .map((term) => `\`${term}\``)
          .join(", ")}`
      );
    }
    if (item.inferredTerms.length > 0) {
      lines.push(
        `Inferred terms: ${item.inferredTerms
          .slice(0, 12)
          .map((term) => `\`${term}\``)
          .join(", ")}`
      );
    }
    if (item.groupAutoSafe) {
      lines.push(
        `Group auto-safe: ${item.groupAutoSafe.assignedWordIndex}: \`${item.groupAutoSafe.assignedText}\` (${item.groupAutoSafe.sourceRank}/${item.groupAutoSafe.groupSize}, capacity ${item.groupAutoSafe.capacityPerTarget})`
      );
    }
    lines.push(
      "",
      "| Word | Score | Confidence | Evidence |",
      "| --- | ---: | --- | --- |"
    );
    for (const candidate of item.candidates) {
      lines.push(
        `| ${candidateLabel(candidate)}: ${candidate.text} | ${candidate.score.toFixed(
          2
        )} | ${candidate.confidence}${candidate.occupied ? " / occupied" : ""} | ${candidate.evidence
          .map((evidence) => `${evidence.source}: ${evidence.detail}`)
          .join("<br>")} |`
      );
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function candidateLabel(candidate: LexicalCandidate): string {
  if (
    candidate.target === "phrase" &&
    candidate.startWordIndex !== undefined &&
    candidate.endWordIndex !== undefined
  ) {
    return `${candidate.startWordIndex}-${candidate.endWordIndex}`;
  }
  return String(candidate.wordIndex);
}

function parseCliOptions(argv: string[]): CliOptions {
  const bible = readOption(argv, "--bible") ?? "nbs";
  const inputDir =
    readOption(argv, "--input-dir") ?? path.join("outputs", "strong", bible);
  const outputDir =
    readOption(argv, "--output-dir") ??
    path.join("outputs", "lexical-candidates", bible);
  return {
    bible,
    onlyRef: readOption(argv, "--only"),
    inputDir,
    outputDir,
    ledgerPath: readOption(argv, "--ledger"),
    kaikkiPath: readOption(argv, "--kaikki"),
    jdmCacheDir: readOption(argv, "--jdm-cache"),
    fetchJdm: readBooleanOption(argv, "--fetch-jdm", false),
    fetchJdmLimit: Number(readOption(argv, "--fetch-jdm-limit") ?? 80),
    openOfficePath: readOption(argv, "--openoffice"),
    wolfPath: readOption(argv, "--wolf"),
    maxCandidatesPerEmpty: Number(readOption(argv, "--max-candidates") ?? 8)
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
  const report = await buildLexicalCandidateReport(options);
  const paths = await writeLexicalCandidateReport(report, options.outputDir);

  console.log(`Lexical candidates JSON: ${paths.jsonPath}`);
  console.log(`Lexical candidates report: ${paths.markdownPath}`);
  console.log(
    `Candidates: ${report.metrics.emptyWithCandidates}/${report.metrics.emptyAnnotations} empty annotations have candidates (${report.metrics.highConfidenceCandidates} high confidence)`
  );
}

if (
  process.argv[1]
    ?.replaceAll("\\", "/")
    .endsWith("src/lexicalCandidateReport.ts")
) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
