import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { type AssignedStrong, type ReferenceSource } from "./align.js";
import { readBibleJson, type BibleVerse } from "./bibleJson.js";
import { getOriginalStrongOccurrences } from "./completeAlignment.js";
import { applyCuratedStrongOverrides } from "./curatedStrongOverrides.js";
import { buildStrongLexicon } from "./lexicon.js";
import {
  readOriginalSourceTsv,
  summarizeOriginalSource,
  type OriginalSourceSummary,
  type OriginalVerse,
  type OriginalVerseMap
} from "./originalSource.js";
import { buildStrongPhraseLexicon } from "./phraseTranslationLexicon.js";
import {
  alignReaderVerse,
  renderReaderTaggedText,
  type ReaderAlignmentResult
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
import { tokenizeText } from "./tokenize.js";
import { buildStrongTranslationLexicon } from "./translationLexicon.js";
import {
  getTranslationProfile,
  type TranslationProfile
} from "./translationProfiles.js";

interface DiagnosticOptions {
  bible: string;
  biblePath: string;
  outputDir: string;
  onlyRef?: string;
  useLlm: boolean;
  applyLlm: boolean;
  llmLimit: number;
  llmModel: string;
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

interface HardVerseDiagnostic {
  ref: string;
  reasons: string[];
  wordCount: number;
  taggedWordCount: number;
  taggedTokenCoverage: number;
  originalConfirmationRate: number;
  missingOriginalStrongCount: number;
  readerStrongOccurrenceCount: number;
  phraseStrongAssignmentCount: number;
  learnedPhraseStrongAssignmentCount: number;
  curatedPhraseStrongAssignmentCount: number;
  referenceMedianStrongOccurrenceCount: number;
  llmAttempted: boolean;
  llmEligible: boolean;
  llmAcceptedAssignments: number;
  llmRejectedAssignments: number;
  llmSuggestions?: LlmAssignment[];
  llmUsage?: LlmUsage;
  llmError?: string;
}

interface DiagnosticMetrics {
  bible: string;
  generatedAt: string;
  inputPath: string;
  outputPath: string;
  diagnosticsPath: string;
  hardVerseCount: number;
  llmEnabled: boolean;
  llmApplied: boolean;
  llmModel: string;
  llmAttemptedVerseCount: number;
  llmAcceptedAssignmentCount: number;
  llmRejectedAssignmentCount: number;
  llmPromptTokenCount: number;
  llmCompletionTokenCount: number;
  llmTotalTokenCount: number;
  curatedOverrideStrongOccurrenceCount: number;
  phraseStrongAssignmentCount: number;
  learnedPhraseStrongAssignmentCount: number;
  curatedPhraseStrongAssignmentCount: number;
  verseCount: number;
  generatedVerseCount: number;
  wordCount: number;
  taggedWordCount: number;
  strongWordOccurrenceCount: number;
  emptyStrongOccurrenceCount: number;
  totalStrongOccurrenceCount: number;
  multiStrongWordCount: number;
  taggedTokenCoverage: number;
  visibleStrongRate: number;
  emptyStrongRate: number;
  multiStrongWordRate: number;
  originalConfirmationRate: number;
  originalActionableStrongOccurrenceCount: number;
  originalRepresentedStrongOccurrenceCount: number;
  originalUnrepresentedStrongOccurrenceCount: number;
  originalRepresentationRate: number;
  profileTokenCoverageStatus:
    | "below-expected"
    | "within-expected"
    | "above-expected";
  references: Array<{ name: string; path: string; verses: number }>;
  originalSources: OriginalSourceSummary[];
  translationProfile: TranslationProfile;
  method: string;
}

interface LlmAssignment {
  target?: "word" | "phrase" | "empty";
  wordIndex: number;
  startWordIndex?: number;
  endWordIndex?: number;
  normalizedPhrase?: string[];
  strong: string[];
  confidence: number;
  reason: string;
}

interface LlmResponse {
  assignments: LlmAssignment[];
}

interface LlmApplyResult {
  attempted: boolean;
  accepted: number;
  rejected: number;
  suggestions?: LlmAssignment[];
  usage?: LlmUsage;
  error?: string;
}

interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
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

export async function diagnoseStrong(
  options: DiagnosticOptions
): Promise<DiagnosticMetrics> {
  loadDotEnv();

  const verses = filterVerses(await readBibleJson(options.biblePath), options);
  const references = await loadReferences();
  const originals = await loadOriginalSources();
  const originalByRef = mergeOriginalSources(originals);
  const lexicon = buildStrongLexicon(references);
  const dictionaryCandidates = readStrongDictionaryTranslationCandidates();
  const translationLexicon = buildStrongTranslationLexicon(references, {
    dictionaryCandidates
  });
  const phraseLexicon = buildStrongPhraseLexicon(references);
  const translationProfile = getTranslationProfile(options.bible);
  await mkdir(options.outputDir, { recursive: true });

  const outputPath = path.join(
    options.outputDir,
    `bible-${options.bible}-strong-diagnostic.tsv`
  );
  const metricsPath = path.join(
    options.outputDir,
    `bible-${options.bible}-strong-diagnostic.metrics.json`
  );
  const diagnosticsPath = path.join(
    options.outputDir,
    `bible-${options.bible}-strong-diagnostic.hard-verses.json`
  );
  const lines = ["book_id\tnum_chapter\tnum_verse\ttext"];
  const diagnostics: HardVerseDiagnostic[] = [];

  let llmAttemptedVerseCount = 0;
  let llmAcceptedAssignmentCount = 0;
  let llmRejectedAssignmentCount = 0;
  let llmPromptTokenCount = 0;
  let llmCompletionTokenCount = 0;
  let llmTotalTokenCount = 0;
  let curatedOverrideStrongOccurrenceCount = 0;
  let phraseStrongAssignmentCount = 0;
  let learnedPhraseStrongAssignmentCount = 0;
  let curatedPhraseStrongAssignmentCount = 0;
  let wordCount = 0;
  let taggedWordCount = 0;
  let strongWordOccurrenceCount = 0;
  let emptyStrongOccurrenceCount = 0;
  let multiStrongWordCount = 0;
  let originalConfirmedTaggedWordCount = 0;
  let originalActionableStrongOccurrenceCount = 0;
  let originalRepresentedStrongOccurrenceCount = 0;

  for (const verse of verses) {
    const key = referenceKey(verse.bookId, verse.chapter, verse.verse);
    const original = originalByRef.get(key);
    const verseReferences = references.map((reference) => ({
      name: reference.name,
      verse: reference.map.get(key)
    }));

    const result = alignReaderVerse({
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
    curatedOverrideStrongOccurrenceCount += applyCuratedStrongOverrides({
      bible: options.bible,
      ref: formatRef(verse),
      result
    });
    const hard = diagnoseHardVerse(
      result,
      original?.verse,
      verseReferences,
      translationProfile
    );
    let llm: LlmApplyResult = { attempted: false, accepted: 0, rejected: 0 };
    const llmEligible = isLlmEligibleHardVerse(hard.reasons);

    if (
      options.useLlm &&
      llmEligible &&
      hard.reasons.length > 0 &&
      llmAttemptedVerseCount < options.llmLimit
    ) {
      llm = await arbitrateWithLlm({
        verse,
        result,
        original: original?.verse,
        references: verseReferences,
        reasons: hard.reasons,
        model: options.llmModel,
        apply: options.applyLlm
      });
      if (llm.attempted) {
        llmAttemptedVerseCount += 1;
        llmAcceptedAssignmentCount += llm.accepted;
        llmRejectedAssignmentCount += llm.rejected;
        llmPromptTokenCount += llm.usage?.promptTokens ?? 0;
        llmCompletionTokenCount += llm.usage?.completionTokens ?? 0;
        llmTotalTokenCount += llm.usage?.totalTokens ?? 0;
      }
    }

    if (hard.reasons.length > 0 || llm.attempted) {
      diagnostics.push({
        ref: formatRef(verse),
        ...hard,
        llmAttempted: llm.attempted,
        llmEligible,
        llmAcceptedAssignments: llm.accepted,
        llmRejectedAssignments: llm.rejected,
        llmSuggestions: llm.suggestions,
        llmUsage: llm.usage,
        llmError: llm.error
      });
    }

    wordCount += result.wordCount;
    taggedWordCount += result.taggedWordCount;
    strongWordOccurrenceCount += countAssignedStrong(result);
    emptyStrongOccurrenceCount += result.emptyAssignments.length;
    phraseStrongAssignmentCount += result.phraseAssignments.length;
    learnedPhraseStrongAssignmentCount += result.phraseAssignments.filter(
      (assignment) => assignment.method === "learned-phrase"
    ).length;
    curatedPhraseStrongAssignmentCount += result.phraseAssignments.filter(
      (assignment) => assignment.method === "curated-phrase"
    ).length;
    multiStrongWordCount += result.multiStrongWordCount;
    originalConfirmedTaggedWordCount +=
      countOriginalConfirmedTaggedWords(result);
    if (original) {
      const representation = summarizeOriginalRepresentation(
        result,
        original.verse
      );
      originalActionableStrongOccurrenceCount += representation.actionable;
      originalRepresentedStrongOccurrenceCount += representation.represented;
    }

    lines.push(
      `${verse.bookId}\t${verse.chapter}\t${verse.verse}\t${tsvEscape(
        renderReaderTaggedText(result)
      )}`
    );
  }

  const totalStrongOccurrenceCount =
    strongWordOccurrenceCount + emptyStrongOccurrenceCount;
  const taggedTokenCoverage = roundRatio(
    taggedWordCount / Math.max(1, wordCount)
  );
  const originalUnrepresentedStrongOccurrenceCount = Math.max(
    0,
    originalActionableStrongOccurrenceCount -
      originalRepresentedStrongOccurrenceCount
  );
  const metrics: DiagnosticMetrics = {
    bible: options.bible,
    generatedAt: new Date().toISOString(),
    inputPath: options.biblePath,
    outputPath,
    diagnosticsPath,
    hardVerseCount: diagnostics.length,
    llmEnabled: options.useLlm,
    llmApplied: options.applyLlm,
    llmModel: options.llmModel,
    llmAttemptedVerseCount,
    llmAcceptedAssignmentCount,
    llmRejectedAssignmentCount,
    llmPromptTokenCount,
    llmCompletionTokenCount,
    llmTotalTokenCount,
    curatedOverrideStrongOccurrenceCount,
    phraseStrongAssignmentCount,
    learnedPhraseStrongAssignmentCount,
    curatedPhraseStrongAssignmentCount,
    verseCount: verses.length,
    generatedVerseCount: verses.length,
    wordCount,
    taggedWordCount,
    strongWordOccurrenceCount,
    emptyStrongOccurrenceCount,
    totalStrongOccurrenceCount,
    multiStrongWordCount,
    taggedTokenCoverage,
    visibleStrongRate: roundRatio(
      strongWordOccurrenceCount / Math.max(1, totalStrongOccurrenceCount)
    ),
    emptyStrongRate: roundRatio(
      emptyStrongOccurrenceCount / Math.max(1, totalStrongOccurrenceCount)
    ),
    multiStrongWordRate: roundRatio(
      multiStrongWordCount / Math.max(1, taggedWordCount)
    ),
    originalConfirmationRate: roundRatio(
      originalConfirmedTaggedWordCount / Math.max(1, taggedWordCount)
    ),
    originalActionableStrongOccurrenceCount,
    originalRepresentedStrongOccurrenceCount,
    originalUnrepresentedStrongOccurrenceCount,
    originalRepresentationRate: roundRatio(
      originalRepresentedStrongOccurrenceCount /
        Math.max(1, originalActionableStrongOccurrenceCount)
    ),
    profileTokenCoverageStatus: classifyTokenCoverage(
      taggedTokenCoverage,
      translationProfile
    ),
    references: references.map((reference) => ({
      name: reference.name,
      path: reference.path,
      verses: reference.map.size
    })),
    originalSources: originals.map((original) => original.summary),
    translationProfile,
    method:
      "Diagnostic Strong generation. Starts from reader alignment, applies the Bible translation profile to density, learned enrichment, learned phrase wrappers, empty-word consensus, diagnostics, and LLM escalation, then applies reviewed deterministic overrides promoted from LLM reference-transfer. LLM review suggestions support word, phrase, and empty targets but are persisted only through reviewed overrides."
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

function diagnoseHardVerse(
  result: ReaderAlignmentResult,
  original: OriginalVerse | undefined,
  references: ReferenceSource[],
  profile: TranslationProfile
): Omit<
  HardVerseDiagnostic,
  | "ref"
  | "llmAttempted"
  | "llmEligible"
  | "llmAcceptedAssignments"
  | "llmRejectedAssignments"
  | "llmSuggestions"
  | "llmError"
> {
  const reasons: string[] = [];
  const taggedTokenCoverage =
    result.taggedWordCount / Math.max(1, result.wordCount);
  const originalConfirmationRate =
    countOriginalConfirmedTaggedWords(result) /
    Math.max(1, result.taggedWordCount);
  const missingOriginalStrongCount = original
    ? countMissingOriginalStrong(result, original)
    : 0;
  const readerStrongOccurrenceCount = countAssignedStrong(result);
  const referenceMedianStrongOccurrenceCount = median(
    references
      .map((reference) =>
        reference.verse
          ? parseStrongOccurrences(reference.verse.row.text).length
          : 0
      )
      .filter((count) => count > 0)
  );

  if (result.taggedWordCount === 0 && result.wordCount > 0)
    reasons.push("no-tags");
  if (taggedTokenCoverage < profile.hardVerseThresholds.lowTokenCoverage) {
    reasons.push("low-token-coverage");
  }
  if (
    original &&
    originalConfirmationRate <
      profile.hardVerseThresholds.lowOriginalConfirmation
  ) {
    reasons.push("low-original-confirmation");
  }
  if (
    original &&
    missingOriginalStrongCount >=
      profile.hardVerseThresholds.manyOriginalStrongUnplaced
  ) {
    reasons.push("many-original-strong-unplaced");
  }
  if (
    referenceMedianStrongOccurrenceCount > 0 &&
    readerStrongOccurrenceCount <
      referenceMedianStrongOccurrenceCount *
        profile.hardVerseThresholds.referenceDensityRatio
  ) {
    reasons.push("below-reference-strong-density");
  }

  return {
    reasons,
    wordCount: result.wordCount,
    taggedWordCount: result.taggedWordCount,
    taggedTokenCoverage: roundRatio(taggedTokenCoverage),
    originalConfirmationRate: roundRatio(originalConfirmationRate),
    missingOriginalStrongCount,
    readerStrongOccurrenceCount,
    phraseStrongAssignmentCount: result.phraseAssignments.length,
    learnedPhraseStrongAssignmentCount: result.phraseAssignments.filter(
      (assignment) => assignment.method === "learned-phrase"
    ).length,
    curatedPhraseStrongAssignmentCount: result.phraseAssignments.filter(
      (assignment) => assignment.method === "curated-phrase"
    ).length,
    referenceMedianStrongOccurrenceCount
  };
}

function isLlmEligibleHardVerse(reasons: string[]): boolean {
  if (reasons.includes("no-tags")) return true;
  if (reasons.includes("low-original-confirmation")) return true;
  if (reasons.includes("low-token-coverage")) return true;
  return (
    reasons.includes("many-original-strong-unplaced") &&
    reasons.includes("below-reference-strong-density")
  );
}

async function arbitrateWithLlm(options: {
  verse: BibleVerse;
  result: ReaderAlignmentResult;
  original?: OriginalVerse;
  references: ReferenceSource[];
  reasons: string[];
  model: string;
  apply: boolean;
}): Promise<LlmApplyResult> {
  if (!options.original) {
    return { attempted: false, accepted: 0, rejected: 0 };
  }
  const original = options.original;

  const apiKey = process.env.AI_GATEWAY_KEY ?? process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    return {
      attempted: true,
      accepted: 0,
      rejected: 0,
      error: "missing-ai-gateway-key"
    };
  }

  try {
    const payload = buildLlmPayload({ ...options, original });
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      Number.parseInt(process.env.AI_GATEWAY_TIMEOUT_MS ?? "120000", 10)
    );
    const response = await fetch(
      "https://ai-gateway.vercel.sh/v1/chat/completions",
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: options.model,
          temperature: 0,
          messages: [
            {
              role: "system",
              content:
                "Tu es un expert d'alignement biblique Strong. Réponds uniquement en JSON valide. N'invente jamais de Strong absent de l'inventaire original fourni."
            },
            {
              role: "user",
              content: JSON.stringify(payload)
            }
          ]
        })
      }
    ).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      const errorBody = await response.text();
      return {
        attempted: true,
        accepted: 0,
        rejected: 0,
        error: `ai-gateway-http-${response.status}:${errorBody.slice(0, 240)}`
      };
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
      };
    };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(extractJson(content)) as LlmResponse;
    return {
      attempted: true,
      ...applyLlmAssignments(options.result, original, parsed, options.apply),
      usage: normalizeUsage(json.usage)
    };
  } catch (error) {
    return {
      attempted: true,
      accepted: 0,
      rejected: 0,
      error: error instanceof Error ? error.message : "unknown-llm-error"
    };
  }
}

function normalizeUsage(
  usage:
    | {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
      }
    | undefined
): LlmUsage | undefined {
  if (!usage) return undefined;

  const promptTokens = usage.prompt_tokens ?? usage.promptTokens ?? 0;
  const completionTokens =
    usage.completion_tokens ?? usage.completionTokens ?? 0;
  const totalTokens =
    usage.total_tokens ?? usage.totalTokens ?? promptTokens + completionTokens;

  return {
    promptTokens,
    completionTokens,
    totalTokens
  };
}

function buildLlmPayload(options: {
  verse: BibleVerse;
  result: ReaderAlignmentResult;
  original: OriginalVerse;
  references: ReferenceSource[];
  reasons: string[];
}): Record<string, unknown> {
  return {
    task: 'Propose uniquement des Strong manquants réellement représentés dans le français. Retourne {"assignments":[{"target":"word|phrase|empty","wordIndex":number,"startWordIndex":number,"endWordIndex":number,"normalizedPhrase":["..."],"strong":["H0000"],"confidence":0.0,"reason":"..."}]}. Utilise target="word" pour un équivalent lexical simple, target="phrase" quand l’équivalent français est une locution ou expression syntaxique, target="empty" seulement quand le mot original n’est pas naturellement rendu par un mot français visible. Pour phrase, startWordIndex/endWordIndex doivent couvrir une plage contiguë et normalizedPhrase doit correspondre aux mots normalisés. Ne tague pas les articles/pronoms/conjonctions sauf préposition clairement traduite. Ignore les Strong non canoniques avec suffixe et le marqueur objet H0853. Explique pourquoi la cible choisie est meilleure qu’un mot tête quand target="phrase".',
    ref: formatRef(options.verse),
    hardReasons: options.reasons,
    targetWords: tokenizeText(options.verse.text)
      .filter((segment) => segment.kind === "word")
      .map((segment, index) => ({
        wordIndex: index,
        text: segment.text,
        normalized: segment.normalized,
        currentStrong: [
          ...(options.result.assignments.get(index)?.strong ?? []),
          ...options.result.phraseAssignments
            .filter(
              (assignment) =>
                index >= assignment.startWordIndex &&
                index <= assignment.endWordIndex
            )
            .flatMap((assignment) => assignment.strong)
        ]
      })),
    originalOccurrences: getOriginalStrongOccurrences(options.original).map(
      (occurrence, index) => ({
        occurrenceIndex: index,
        strong: occurrence.strong,
        text: occurrence.text,
        lemma: occurrence.lemma,
        gloss: occurrence.gloss,
        morph: occurrence.morph,
        pos: occurrence.pos
      })
    ),
    referenceVerses: options.references
      .filter((reference) => reference.verse)
      .map((reference) => ({
        name: reference.name,
        taggedTokens: reference.verse?.tokens.map((token, index) => ({
          index,
          text: token.text,
          normalized: token.normalized,
          strong: token.strong
        }))
      }))
  };
}

function applyLlmAssignments(
  result: ReaderAlignmentResult,
  original: OriginalVerse,
  response: LlmResponse,
  apply: boolean
): { accepted: number; rejected: number; suggestions: LlmAssignment[] } {
  const words = getResultWords(result);
  const originalCounts = countStrongValues(
    getOriginalStrongOccurrences(original).map(
      (occurrence) => occurrence.strong
    )
  );
  const usedCounts = countStrongValues([
    ...[...result.assignments.values()].flatMap(
      (assignment) => assignment.strong
    ),
    ...result.phraseAssignments.flatMap((assignment) => assignment.strong),
    ...result.emptyAssignments.map((assignment) => assignment.strong)
  ]);
  let accepted = 0;
  let rejected = 0;
  const suggestions: LlmAssignment[] = [];

  for (const assignment of response.assignments ?? []) {
    const target = normalizeLlmTarget(assignment.target);
    const startWordIndex = assignment.startWordIndex ?? assignment.wordIndex;
    const endWordIndex = assignment.endWordIndex ?? assignment.wordIndex;
    if (
      !Number.isInteger(assignment.wordIndex) ||
      (target !== "empty" && assignment.wordIndex < 0) ||
      assignment.wordIndex >= result.wordCount ||
      assignment.confidence < 0.64 ||
      assignment.strong.length === 0
    ) {
      rejected += 1;
      continue;
    }

    const targetWord = words[assignment.wordIndex];
    const phraseWords = words.filter(
      (word) =>
        word.wordIndex >= startWordIndex && word.wordIndex <= endWordIndex
    );
    if (
      (target === "word" && !targetWord) ||
      (target === "phrase" &&
        (!Number.isInteger(startWordIndex) ||
          !Number.isInteger(endWordIndex) ||
          startWordIndex < 0 ||
          endWordIndex < startWordIndex ||
          endWordIndex >= result.wordCount ||
          phraseWords.length !== endWordIndex - startWordIndex + 1 ||
          !isAllowedLlmPhraseTarget(
            phraseWords.map((word) => word.normalized)
          )))
    ) {
      rejected += 1;
      continue;
    }

    const existing =
      target === "word"
        ? result.assignments.get(assignment.wordIndex)
        : undefined;
    const currentStrongCount =
      target === "word"
        ? (existing?.strong.length ?? 0)
        : result.phraseAssignments
            .filter(
              (phrase) =>
                phrase.startWordIndex === startWordIndex &&
                phrase.endWordIndex === endWordIndex
            )
            .reduce((sum, phrase) => sum + phrase.strong.length, 0);
    if (currentStrongCount >= 3) {
      rejected += 1;
      continue;
    }

    const acceptedStrong: string[] = [];
    for (const strong of assignment.strong.map((code) => code.toUpperCase())) {
      if (!/^[HG]\d{4}$/u.test(strong)) continue;
      if (
        target === "word" &&
        targetWord &&
        !isAllowedLlmTarget(targetWord.normalized, strong)
      ) {
        continue;
      }
      if (!originalCounts.has(strong)) continue;
      if ((usedCounts.get(strong) ?? 0) >= (originalCounts.get(strong) ?? 0)) {
        continue;
      }
      if (
        existing?.strong.includes(strong) ||
        acceptedStrong.includes(strong)
      ) {
        continue;
      }
      acceptedStrong.push(strong);
    }

    if (
      acceptedStrong.length === 0 ||
      currentStrongCount + acceptedStrong.length > 3
    ) {
      rejected += 1;
      continue;
    }

    const confidence = Math.min(0.84, assignment.confidence);
    suggestions.push({
      target,
      wordIndex: assignment.wordIndex,
      startWordIndex: target === "phrase" ? startWordIndex : undefined,
      endWordIndex: target === "phrase" ? endWordIndex : undefined,
      normalizedPhrase:
        target === "phrase"
          ? phraseWords.map((word) => word.normalized)
          : undefined,
      strong: acceptedStrong,
      confidence,
      reason: assignment.reason
    });

    for (const strong of acceptedStrong) {
      usedCounts.set(strong, (usedCounts.get(strong) ?? 0) + 1);
    }

    if (!apply || target !== "word") {
      accepted += acceptedStrong.length;
      continue;
    }

    if (existing) {
      existing.strong.push(...acceptedStrong);
      existing.confidence = Math.max(existing.confidence, confidence);
      existing.source = mergeLabel(existing.source, "ai-gateway");
      existing.method = "llm-arbiter";
      existing.originalConfirmed = true;
    } else {
      result.assignments.set(assignment.wordIndex, {
        strong: acceptedStrong,
        confidence,
        source: "ai-gateway",
        method: "llm-arbiter",
        originalConfirmed: true
      } satisfies AssignedStrong);
    }

    accepted += acceptedStrong.length;
  }

  return { accepted, rejected, suggestions };
}

function normalizeLlmTarget(
  target: LlmAssignment["target"] | undefined
): "word" | "phrase" | "empty" {
  if (target === "phrase" || target === "empty") return target;
  return "word";
}

function isAllowedLlmPhraseTarget(normalizedPhrase: string[]): boolean {
  if (normalizedPhrase.length < 2) return false;
  return normalizedPhrase.some((word) => !LLM_FUNCTION_WORDS.has(word));
}

function getResultWords(
  result: ReaderAlignmentResult
): Array<{ wordIndex: number; normalized: string }> {
  const words: Array<{ wordIndex: number; normalized: string }> = [];
  let wordIndex = -1;

  for (const segment of result.segments) {
    if (segment.kind !== "word") continue;
    wordIndex += 1;
    words.push({ wordIndex, normalized: segment.normalized });
  }

  return words;
}

function isAllowedLlmTarget(normalized: string, strong: string): boolean {
  if (!LLM_FUNCTION_WORDS.has(normalized)) return true;

  return LLM_ALLOWED_FUNCTION_STRONG.has(strong);
}

const LLM_ALLOWED_FUNCTION_STRONG = new Set([
  "H0996",
  "H5921",
  "H0413",
  "H1961",
  "G1519",
  "G1096",
  "G1722"
]);

const LLM_FUNCTION_WORDS = new Set([
  "a",
  "au",
  "aux",
  "ce",
  "ces",
  "cet",
  "cette",
  "de",
  "des",
  "du",
  "en",
  "et",
  "est",
  "eut",
  "ait",
  "fut",
  "il",
  "ils",
  "la",
  "le",
  "les",
  "leur",
  "leurs",
  "lui",
  "nous",
  "on",
  "ou",
  "par",
  "pour",
  "qu",
  "que",
  "qui",
  "sa",
  "se",
  "ses",
  "son",
  "sur",
  "un",
  "une",
  "y"
]);

function countMissingOriginalStrong(
  result: ReaderAlignmentResult,
  original: OriginalVerse
): number {
  const originalCounts = countStrongValues(
    getOriginalStrongOccurrences(original)
      .map((occurrence) => occurrence.strong)
      .filter(isActionableOriginalStrong)
  );
  const representedCounts = countStrongValues([
    ...[...result.assignments.values()].flatMap(
      (assignment) => assignment.strong
    ),
    ...result.phraseAssignments.flatMap((assignment) => assignment.strong),
    ...result.emptyAssignments.map((assignment) => assignment.strong)
  ]);
  let missing = 0;

  for (const [strong, count] of originalCounts) {
    missing += Math.max(0, count - (representedCounts.get(strong) ?? 0));
  }

  return missing;
}

function summarizeOriginalRepresentation(
  result: ReaderAlignmentResult,
  original: OriginalVerse
): { actionable: number; represented: number } {
  const originalCounts = countStrongValues(
    getOriginalStrongOccurrences(original)
      .map((occurrence) => occurrence.strong)
      .filter(isActionableOriginalStrong)
  );
  const representedCounts = countStrongValues([
    ...[...result.assignments.values()].flatMap(
      (assignment) => assignment.strong
    ),
    ...result.phraseAssignments.flatMap((assignment) => assignment.strong),
    ...result.emptyAssignments.map((assignment) => assignment.strong)
  ]);
  let actionable = 0;
  let represented = 0;

  for (const [strong, count] of originalCounts) {
    actionable += count;
    represented += Math.min(count, representedCounts.get(strong) ?? 0);
  }

  return { actionable, represented };
}

function classifyTokenCoverage(
  taggedTokenCoverage: number,
  profile: TranslationProfile
): DiagnosticMetrics["profileTokenCoverageStatus"] {
  if (taggedTokenCoverage < profile.expectedTokenCoverage.low) {
    return "below-expected";
  }
  if (taggedTokenCoverage > profile.expectedTokenCoverage.high) {
    return "above-expected";
  }
  return "within-expected";
}

function isActionableOriginalStrong(strong: string): boolean {
  return /^[HG]\d{4}$/u.test(strong) && !IGNORED_ORIGINAL_STRONG.has(strong);
}

const IGNORED_ORIGINAL_STRONG = new Set(["H0853"]);

function countAssignedStrong(result: ReaderAlignmentResult): number {
  return (
    [...result.assignments.values()].reduce(
      (sum, assignment) => sum + assignment.strong.length,
      0
    ) +
    result.phraseAssignments.reduce(
      (sum, assignment) => sum + assignment.strong.length,
      0
    )
  );
}

function countOriginalConfirmedTaggedWords(
  result: ReaderAlignmentResult
): number {
  const confirmedWordIndexes = new Set<number>();
  for (const [wordIndex, assignment] of result.assignments) {
    if (assignment.originalConfirmed) confirmedWordIndexes.add(wordIndex);
  }
  for (const phrase of result.phraseAssignments) {
    if (!phrase.originalConfirmed) continue;
    for (
      let wordIndex = phrase.startWordIndex;
      wordIndex <= phrase.endWordIndex;
      wordIndex += 1
    ) {
      confirmedWordIndexes.add(wordIndex);
    }
  }
  return confirmedWordIndexes.size;
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

function mergeOriginalSources(
  originals: OriginalBundle[]
): Map<string, OriginalBundleVerse> {
  const merged = new Map<string, OriginalBundleVerse>();

  for (const original of originals) {
    for (const [key, verse] of original.map) {
      const existing =
        merged.get(key) ??
        ({
          verse: {
            bookId: verse.bookId,
            chapter: verse.chapter,
            verse: verse.verse,
            tokens: [],
            strongSet: new Set<string>()
          },
          sourceNames: []
        } satisfies OriginalBundleVerse);
      existing.verse.tokens.push(...verse.tokens);
      for (const strong of verse.strongSet)
        existing.verse.strongSet.add(strong);
      if (!existing.sourceNames.includes(original.name)) {
        existing.sourceNames.push(original.name);
      }
      merged.set(key, existing);
    }
  }

  return merged;
}

function filterVerses(
  verses: BibleVerse[],
  options: DiagnosticOptions
): BibleVerse[] {
  if (!options.onlyRef) return verses;
  const [bookId, chapter, verse] = options.onlyRef.split(".");
  return verses.filter(
    (candidate) =>
      candidate.bookId === bookId &&
      (!chapter || candidate.chapter === Number.parseInt(chapter, 10)) &&
      (!verse || candidate.verse === Number.parseInt(verse, 10))
  );
}

function parseCliOptions(argv: string[]): DiagnosticOptions {
  const args = new Map<string, string>();
  const flags = new Set<string>();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg?.startsWith("--")) continue;
    const [key, inlineValue] = arg.slice(2).split("=", 2);
    if (!key) continue;
    if (inlineValue !== undefined) {
      args.set(key, inlineValue);
    } else if (argv[index + 1] && !argv[index + 1]?.startsWith("--")) {
      args.set(key, argv[index + 1] ?? "");
      index += 1;
    } else {
      flags.add(key);
    }
  }

  const bible = args.get("bible") ?? "s21";
  const applyLlm = flags.has("llm-apply") || args.get("llm-apply") === "true";
  return {
    bible,
    biblePath: args.get("input") ?? `data/bibles/bible-${bible}.json`,
    outputDir: args.get("output-dir") ?? "outputs",
    onlyRef: args.get("only"),
    useLlm: flags.has("llm") || args.get("llm") === "true" || applyLlm,
    applyLlm,
    llmLimit: Number.parseInt(args.get("llm-limit") ?? "25", 10),
    llmModel:
      args.get("model") ??
      process.env.AI_GATEWAY_MODEL ??
      "anthropic/claude-sonnet-4.6"
  };
}

function loadDotEnv(): void {
  try {
    const content = readFileSyncText(".env");
    for (const line of content.split(/\r?\n/u)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/u);
      if (!match?.[1] || process.env[match[1]]) continue;
      process.env[match[1]] = (match[2] ?? "").replace(/^["']|["']$/gu, "");
    }
  } catch {
    // .env is optional; shell-provided environment variables still work.
  }
}

function readFileSyncText(pathname: string): string {
  // Keep dotenv loading dependency-free for this small CLI.
  return readFileSync(pathname, "utf8");
}

function countStrongValues(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    const strong = value.toUpperCase();
    counts.set(strong, (counts.get(strong) ?? 0) + 1);
  }
  return counts;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function mergeLabel(current: string, next: string): string {
  const labels = new Set([...current.split("+"), ...next.split("+")]);
  return [...labels].filter(Boolean).join("+");
}

function extractJson(content: string): string {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/u)?.[1];
  if (fenced) return fenced.trim();
  const first = content.indexOf("{");
  const last = content.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return content.slice(first, last + 1);
  }
  return content;
}

function formatRef(verse: BibleVerse): string {
  return `${verse.bookId}.${verse.chapter}.${verse.verse}`;
}

function roundRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10_000) / 10_000;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseCliOptions(process.argv.slice(2));
  const metrics = await diagnoseStrong(options);

  console.log(`Generated ${metrics.outputPath}`);
  console.log(
    `Verses: ${metrics.generatedVerseCount}; tags: ${metrics.totalStrongOccurrenceCount}; hard: ${metrics.hardVerseCount}; llm: ${metrics.llmAttemptedVerseCount} verses/${metrics.llmAcceptedAssignmentCount} accepted`
  );
}
