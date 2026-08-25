import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import { writeJsonFileAtomic } from "./atomicFile.js";
import { readBibleJson, type BibleVerse } from "./bibleJson.js";
import { getOriginalStrongOccurrences } from "./completeAlignment.js";
import { applyCuratedStrongOverrides } from "./curatedStrongOverrides.js";
import { stemWord, type StrongLexicon } from "./align.js";
import { buildStrongLexicon } from "./lexicon.js";
import {
  readOriginalSourceTsv,
  summarizeOriginalSource,
  type OriginalSourceSummary,
  type OriginalVerse,
  type OriginalVerseMap
} from "./originalSource.js";
import {
  buildStrongPhraseLexicon,
  type StrongPhraseLexicon
} from "./phraseTranslationLexicon.js";
import {
  alignReaderVerse,
  type ReaderAlignmentResult
} from "./readerAlignment.js";
import {
  buildStrongVerseMap,
  readStrongCsv,
  referenceKey,
  type StrongRow,
  type StrongVerseMap
} from "./strongCsv.js";
import { readStrongDictionaryTranslationCandidates } from "./strongDictionaryLexicon.js";
import { tokenizeText } from "./tokenize.js";
import { withReviewFileLock } from "./reviewFileLock.js";
import {
  buildStrongTranslationLexicon,
  findTranslationCandidate,
  type StrongTranslationLexicon
} from "./translationLexicon.js";
import {
  getTranslationProfile,
  type TranslationProfile
} from "./translationProfiles.js";

interface CliOptions {
  command: "missing" | "plan" | "validate";
  bible: string;
  biblePath: string;
  outputDir: string;
  onlyRef?: string;
  books?: string[];
  chunkSize: "chapter" | "book";
  inputPath?: string;
  apply: boolean;
  includeFunction: boolean;
  minConfidence: number;
  overridesPath: string;
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

interface V3Context {
  bible: string;
  verses: BibleVerse[];
  references: ReferenceMap[];
  originals: Map<string, OriginalBundleVerse>;
  lexicon: StrongLexicon;
  translationLexicon: StrongTranslationLexicon;
  phraseLexicon: StrongPhraseLexicon;
  profile: TranslationProfile;
}

interface TargetWord {
  wordIndex: number;
  text: string;
  normalized: string;
  currentStrong: string[];
}

type MissingPriority =
  | "semantic-high"
  | "semantic-medium"
  | "function"
  | "not-rendered-candidate";

export interface SemanticMissingItem {
  bible: string;
  ref: string;
  book: string;
  chapter: number;
  verse: number;
  targetText: string;
  targetWords: TargetWord[];
  strong: string;
  originalStrong: string;
  original: {
    occurrenceId: string;
    tokenId: string;
    tokenIndex: number;
    text: string;
    lemma: string;
    gloss: string;
    pos: string;
    morph: string;
  };
  references: ReferenceEvidence[];
  alreadyPlacedStrong: string[];
  reason: string;
  priority: MissingPriority;
  deterministicProposal?: V3Decision;
}

interface ReferenceEvidence {
  name: string;
  occurrenceCount: number;
  taggedTokens: Array<{
    index: number;
    text: string;
    normalized: string;
    strong: string[];
  }>;
}

export interface V3Decision {
  bible: string;
  book: string;
  scope: string;
  ref: string;
  strong: string[];
  target: "word" | "phrase" | "empty";
  wordIndex: number;
  startWordIndex?: number;
  endWordIndex?: number;
  normalized: string;
  normalizedPhrase?: string[];
  confidence: number;
  decision:
    | "accept-word"
    | "accept-phrase"
    | "accept-empty"
    | "reject-duplicate"
    | "reject-not-rendered"
    | "reject-wrong"
    | "pending-human";
  source: string;
  reason: string;
  evidence?: Record<string, unknown>;
}

interface MissingOutput {
  bible: string;
  generatedAt: string;
  scope: string;
  source: string;
  summary: Record<string, number | Record<string, number>>;
  items: SemanticMissingItem[];
}

interface SplitMissingManifest {
  bible: string;
  generatedAt: string;
  scope: string;
  source: string;
  summary: Record<string, number | Record<string, number>>;
  split: true;
  itemFiles: Array<{
    book: string;
    path: string;
    itemCount: number;
  }>;
}

interface ValidationOutput {
  bible: string;
  generatedAt: string;
  inputPath: string;
  validated: V3Decision[];
  rejected: Array<V3Decision & { rejectionReason: string }>;
  pendingHuman: V3Decision[];
  applied?: {
    outputPath: string;
    added: number;
    skipped: number;
  };
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

const IGNORED_CANONICAL_STRONG = new Set(["H0853"]);
const SPLIT_MISSING_ITEM_THRESHOLD = 10_000;
const FUNCTION_POS = new Set(["prep", "cj", "rel", "pron"]);
const NOT_RENDERED_POS = new Set(["art", "om"]);
const SEMANTIC_HIGH_POS = new Set(["noun", "verb", "Name", "adj"]);
const SEMANTIC_MEDIUM_POS = new Set(["adv", "num"]);
const WEAK_FUNCTION_WORDS = new Set([
  "a",
  "au",
  "aux",
  "aucun",
  "aucune",
  "autre",
  "autres",
  "ce",
  "ces",
  "cet",
  "cette",
  "celui",
  "ceux",
  "donc",
  "de",
  "des",
  "du",
  "en",
  "et",
  "est",
  "j",
  "je",
  "il",
  "ils",
  "la",
  "le",
  "les",
  "leur",
  "leurs",
  "lui",
  "m",
  "ma",
  "me",
  "mes",
  "moi",
  "ne",
  "ni",
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
  "t",
  "ta",
  "te",
  "tes",
  "toi",
  "tu",
  "tout",
  "tous",
  "toute",
  "toutes",
  "un",
  "une",
  "votre",
  "vous",
  "vos",
  "y"
]);

export function canonicalStrong(strong: string): string | undefined {
  return strong.toUpperCase().match(/^([HG]\d{4})/u)?.[1];
}

export function classifyOriginalStrong(options: {
  strong: string;
  pos: string;
}): MissingPriority {
  const strong = canonicalStrong(options.strong);
  if (!strong || IGNORED_CANONICAL_STRONG.has(strong)) {
    return "not-rendered-candidate";
  }
  if (NOT_RENDERED_POS.has(options.pos)) {
    return "not-rendered-candidate";
  }
  if (FUNCTION_POS.has(options.pos)) {
    return "function";
  }
  if (SEMANTIC_HIGH_POS.has(options.pos)) {
    return "semantic-high";
  }
  if (SEMANTIC_MEDIUM_POS.has(options.pos)) {
    return "semantic-medium";
  }
  return "semantic-medium";
}

export async function buildSemanticMissingOutput(
  options: CliOptions
): Promise<MissingOutput> {
  const context = await loadContext(options);
  const items: SemanticMissingItem[] = [];
  const allMissingPriorities = new Map<MissingPriority, number>();

  for (const verse of context.verses) {
    const analyzed = analyzeVerseForMissing({
      verse,
      context,
      includeFunction: options.includeFunction
    });
    for (const [priority, count] of analyzed.allMissingPriorities) {
      allMissingPriorities.set(
        priority,
        (allMissingPriorities.get(priority) ?? 0) + count
      );
    }
    items.push(...analyzed.items);
  }

  const proposals = items.filter((item) => item.deterministicProposal).length;
  const highConfidenceProposals = items.filter(
    (item) =>
      (item.deterministicProposal?.confidence ?? 0) >= options.minConfidence
  ).length;

  return {
    bible: options.bible,
    generatedAt: new Date().toISOString(),
    scope: scopeLabel(options),
    source:
      "semantic-v3 inventory-first missing Strong audit using original WLC/SBLGNT inventory, local Strong references, current diagnostic alignment, and curated overrides.",
    summary: {
      verseCount: context.verses.length,
      missingItemCount: items.length,
      deterministicProposalCount: proposals,
      highConfidenceProposalCount: highConfidenceProposals,
      allMissingByPriority: Object.fromEntries(allMissingPriorities)
    },
    items
  };
}

export async function writeMissing(options: CliOptions): Promise<string> {
  const output = await buildSemanticMissingOutput(options);
  const dir = scopedOutputDir(options);
  await mkdir(dir, { recursive: true });
  const outputPath = path.join(dir, "missing-semantic-strong.json");
  if (output.items.length > SPLIT_MISSING_ITEM_THRESHOLD) {
    await writeSplitMissingOutput(outputPath, output);
  } else {
    await writeJson(outputPath, output);
  }

  const decisions = output.items
    .map((item) => item.deterministicProposal)
    .filter((decision): decision is V3Decision => Boolean(decision));
  await writeJson(path.join(dir, "proposed-decisions.json"), {
    bible: options.bible,
    generatedAt: new Date().toISOString(),
    scope: output.scope,
    decisions
  });

  return outputPath;
}

async function writeSplitMissingOutput(
  outputPath: string,
  output: MissingOutput
): Promise<void> {
  const dir = path.dirname(outputPath);
  const itemDir = path.join(dir, "items");
  await mkdir(itemDir, { recursive: true });
  const itemFiles: SplitMissingManifest["itemFiles"] = [];

  for (const [book, items] of groupItemsByBook(output.items)) {
    const filePath = path.join(itemDir, `${book}.json`);
    await writeJson(filePath, {
      bible: output.bible,
      generatedAt: output.generatedAt,
      scope: book,
      items
    });
    itemFiles.push({ book, path: filePath, itemCount: items.length });
  }

  await writeJson(outputPath, {
    bible: output.bible,
    generatedAt: output.generatedAt,
    scope: output.scope,
    source: output.source,
    summary: output.summary,
    split: true,
    itemFiles
  } satisfies SplitMissingManifest);
}

export async function writePlan(options: CliOptions): Promise<string> {
  const output = options.inputPath
    ? readMissingOutputForPlan(options.inputPath)
    : await buildSemanticMissingOutput(options);
  const dir = scopedOutputDir(options);
  const workItemDir = path.join(dir, "work-items");
  await mkdir(workItemDir, { recursive: true });

  const groups = groupWorkItems(output.items, options.chunkSize);
  const files: Array<{ scope: string; path: string; itemCount: number }> = [];

  for (const [scope, items] of groups) {
    const filePath = path.join(workItemDir, `${scope}.json`);
    await writeJson(filePath, {
      bible: options.bible,
      scope,
      generatedAt: new Date().toISOString(),
      instructions: [
        "Propose seulement des decisions JSON structurees.",
        "N'invente jamais un Strong absent de l'inventaire original fourni.",
        "Utilise accept-word quand un mot francais porte clairement le Strong.",
        "Utilise accept-phrase quand une locution francaise porte le Strong.",
        "Utilise accept-empty seulement si le Strong original n'est pas rendu naturellement par un mot visible.",
        "Utilise pending-human si la cible ou la synonymie restent incertaines."
      ],
      expectedDecisionSchema: {
        ref: "Gen.6.6",
        strong: ["H5162"],
        target: "word|phrase|empty",
        wordIndex: 2,
        startWordIndex: 2,
        endWordIndex: 2,
        normalized: "regretta",
        normalizedPhrase: ["regretta"],
        confidence: 0.94,
        decision:
          "accept-word|accept-phrase|accept-empty|reject-duplicate|reject-not-rendered|reject-wrong|pending-human",
        reason: "Pourquoi cette cible rend le Strong."
      },
      items
    });
    files.push({ scope, path: filePath, itemCount: items.length });
  }

  const manifestPath = path.join(dir, "work-items-manifest.json");
  await writeJson(manifestPath, {
    bible: options.bible,
    generatedAt: new Date().toISOString(),
    scope: output.scope,
    chunkSize: options.chunkSize,
    files
  });

  return manifestPath;
}

function readMissingOutputForPlan(inputPath: string): MissingOutput {
  const raw = JSON.parse(readFileSync(inputPath, "utf8")) as unknown;
  if (!isRecord(raw)) {
    throw new Error(`Invalid missing audit JSON: ${inputPath}`);
  }

  const items = readMissingItemsFromAudit(raw, inputPath);
  return {
    bible: typeof raw.bible === "string" ? raw.bible : "unknown",
    generatedAt:
      typeof raw.generatedAt === "string"
        ? raw.generatedAt
        : new Date().toISOString(),
    scope: typeof raw.scope === "string" ? raw.scope : "unknown",
    source:
      typeof raw.source === "string"
        ? raw.source
        : `semantic-v3 missing audit loaded from ${inputPath}`,
    summary: isRecord(raw.summary)
      ? (raw.summary as Record<string, number | Record<string, number>>)
      : {
          missingItemCount: items.length
        },
    items
  };
}

function readMissingItemsFromAudit(
  raw: Record<string, unknown>,
  inputPath: string
): SemanticMissingItem[] {
  if (Array.isArray(raw.items)) {
    return raw.items.filter(isSemanticMissingItem);
  }

  if (raw.split === true && Array.isArray(raw.itemFiles)) {
    const baseDir = path.dirname(inputPath);
    return raw.itemFiles.flatMap((file) => {
      if (!isRecord(file) || typeof file.path !== "string") return [];
      const filePath = path.isAbsolute(file.path)
        ? file.path
        : path.resolve(baseDir, path.relative(baseDir, file.path));
      const itemRaw = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
      if (!isRecord(itemRaw) || !Array.isArray(itemRaw.items)) return [];
      return itemRaw.items.filter(isSemanticMissingItem);
    });
  }

  return [];
}

function isSemanticMissingItem(value: unknown): value is SemanticMissingItem {
  if (!isRecord(value)) return false;
  return (
    typeof value.bible === "string" &&
    typeof value.ref === "string" &&
    typeof value.book === "string" &&
    typeof value.chapter === "number" &&
    typeof value.verse === "number" &&
    typeof value.targetText === "string" &&
    Array.isArray(value.targetWords) &&
    typeof value.strong === "string" &&
    typeof value.originalStrong === "string" &&
    isRecord(value.original) &&
    Array.isArray(value.references) &&
    Array.isArray(value.alreadyPlacedStrong) &&
    typeof value.reason === "string" &&
    typeof value.priority === "string"
  );
}

export async function validateDecisions(
  options: CliOptions
): Promise<ValidationOutput> {
  if (!options.inputPath) {
    throw new Error(
      "semanticStrongV3 validate requires --input <file-or-directory>"
    );
  }

  const context = await loadContext({ ...options, onlyRef: undefined });
  const decisions = readDecisionInput(options.inputPath, options.minConfidence);
  const verseState = new Map<
    string,
    ReturnType<typeof buildVerseValidationState>
  >();
  const validated: V3Decision[] = [];
  const rejected: Array<V3Decision & { rejectionReason: string }> = [];
  const pendingHuman: V3Decision[] = [];

  for (const decision of decisions) {
    if (decision.bible !== options.bible) {
      rejected.push({ ...decision, rejectionReason: "wrong-bible" });
      continue;
    }

    const state =
      verseState.get(decision.ref) ??
      buildVerseValidationState(context, decision.ref);
    verseState.set(decision.ref, state);

    const result = validateDecisionAgainstState(
      decision,
      state,
      options.minConfidence
    );

    if (result.status === "pending") {
      pendingHuman.push(decision);
      continue;
    }

    if (result.status === "rejected") {
      rejected.push({ ...decision, rejectionReason: result.reason });
      continue;
    }

    validated.push(decision);
    for (const strong of decision.strong.map((code) => canonicalStrong(code))) {
      if (!strong) continue;
      state.representedCounts.set(
        strong,
        (state.representedCounts.get(strong) ?? 0) + 1
      );
    }
  }

  const output: ValidationOutput = {
    bible: options.bible,
    generatedAt: new Date().toISOString(),
    inputPath: options.inputPath,
    validated,
    rejected,
    pendingHuman
  };

  if (options.apply) {
    output.applied = await applyValidatedDecisions(
      validated,
      options.overridesPath
    );
  }

  const dir = validationOutputDir(options);
  await mkdir(dir, { recursive: true });
  await writeJson(path.join(dir, "validated-decisions.json"), {
    bible: options.bible,
    generatedAt: output.generatedAt,
    decisions: validated
  });
  await writeJson(path.join(dir, "rejected-decisions.json"), {
    bible: options.bible,
    generatedAt: output.generatedAt,
    decisions: rejected
  });
  await writeJson(path.join(dir, "pending-human.json"), {
    bible: options.bible,
    generatedAt: output.generatedAt,
    decisions: pendingHuman
  });

  return output;
}

function analyzeVerseForMissing(options: {
  verse: BibleVerse;
  context: V3Context;
  includeFunction: boolean;
}): {
  items: SemanticMissingItem[];
  allMissingPriorities: Map<MissingPriority, number>;
} {
  const key = referenceKey(
    options.verse.bookId,
    options.verse.chapter,
    options.verse.verse
  );
  const original = options.context.originals.get(key);
  if (!original) {
    return { items: [], allMissingPriorities: new Map() };
  }

  const result = buildCurrentAlignment(
    options.context,
    options.verse,
    original
  );
  const targetWords = getTargetWords(result);
  const representedCounts = countCanonicalStrongValues([
    ...[...result.assignments.values()].flatMap(
      (assignment) => assignment.strong
    ),
    ...result.phraseAssignments.flatMap((assignment) => assignment.strong),
    ...result.emptyAssignments.map((assignment) => assignment.strong)
  ]);
  const originalOccurrences = getOriginalStrongOccurrences(original.verse);
  const seenOriginalCounts = new Map<string, number>();
  const allMissingPriorities = new Map<MissingPriority, number>();
  const items: SemanticMissingItem[] = [];

  for (const occurrence of originalOccurrences) {
    const strong = canonicalStrong(occurrence.strong);
    if (!strong) continue;

    const seen = (seenOriginalCounts.get(strong) ?? 0) + 1;
    seenOriginalCounts.set(strong, seen);

    if (seen <= (representedCounts.get(strong) ?? 0)) {
      continue;
    }

    const priority = classifyOriginalStrong({
      strong: occurrence.strong,
      pos: occurrence.pos
    });
    allMissingPriorities.set(
      priority,
      (allMissingPriorities.get(priority) ?? 0) + 1
    );

    if (!options.includeFunction && !isSemanticPriority(priority)) {
      continue;
    }

    const referenceEvidence = buildReferenceEvidence(
      options.context.references,
      key,
      strong
    );
    const proposal = proposeDeterministicDecision({
      bible: options.context.bible,
      verse: options.verse,
      occurrence: {
        strong,
        originalStrong: occurrence.sourceStrong,
        tokenIndex: occurrence.tokenIndex,
        occurrenceId: occurrence.occurrenceId,
        lemma: occurrence.lemma,
        gloss: occurrence.gloss
      },
      originalOccurrenceCount: originalOccurrences.length,
      targetWords,
      representedCounts,
      translationLexicon: options.context.translationLexicon,
      priority,
      referenceEvidence
    });

    items.push({
      bible: options.context.bible,
      ref: formatRef(options.verse),
      book: options.verse.bookId,
      chapter: options.verse.chapter,
      verse: options.verse.verse,
      targetText: options.verse.text,
      targetWords,
      strong,
      originalStrong: occurrence.strong,
      original: {
        occurrenceId: occurrence.occurrenceId,
        tokenId: occurrence.tokenId,
        tokenIndex: occurrence.tokenIndex,
        text: occurrence.text,
        lemma: occurrence.lemma,
        gloss: occurrence.gloss,
        pos: occurrence.pos,
        morph: occurrence.morph
      },
      references: referenceEvidence,
      alreadyPlacedStrong: [...representedCounts.keys()].sort(),
      reason: `Original occurrence ${occurrence.occurrenceId} (${strong}) is not represented by the current Strong output.`,
      priority,
      deterministicProposal: proposal
    });
  }

  return { items, allMissingPriorities };
}

function proposeDeterministicDecision(options: {
  bible: string;
  verse: BibleVerse;
  occurrence: {
    strong: string;
    originalStrong: string;
    tokenIndex: number;
    occurrenceId: string;
    lemma: string;
    gloss: string;
  };
  originalOccurrenceCount: number;
  targetWords: TargetWord[];
  representedCounts: Map<string, number>;
  translationLexicon: StrongTranslationLexicon;
  priority: MissingPriority;
  referenceEvidence: ReferenceEvidence[];
}): V3Decision | undefined {
  if (!isSemanticPriority(options.priority)) {
    return undefined;
  }

  const candidates = options.targetWords
    .map((word) => {
      if (word.currentStrong.includes(options.occurrence.strong)) {
        return undefined;
      }
      if (word.currentStrong.length >= 3) {
        return undefined;
      }
      if (WEAK_FUNCTION_WORDS.has(word.normalized)) {
        return undefined;
      }

      const translation = findTranslationCandidate(
        options.translationLexicon,
        options.occurrence.strong,
        word.normalized,
        options.occurrence.originalStrong
      );
      if (!translation) {
        return undefined;
      }
      if (
        !isSupportedBySameVerseReference({
          strong: options.occurrence.strong,
          normalized: word.normalized,
          referenceEvidence: options.referenceEvidence
        })
      ) {
        return undefined;
      }

      const position = scorePosition(
        options.occurrence.tokenIndex,
        options.originalOccurrenceCount,
        word.wordIndex,
        options.targetWords.length
      );
      const referenceAgreement = Math.min(
        1,
        options.referenceEvidence.filter(
          (reference) => reference.occurrenceCount > 0
        ).length / 3
      );
      const score =
        translation.score * 0.62 + position * 0.26 + referenceAgreement * 0.12;

      return {
        word,
        score,
        source: `${translation.source}:semantic-v3`,
        reason: `${word.normalized} matches learned or dictionary lexical evidence for ${options.occurrence.strong} (${options.occurrence.gloss || options.occurrence.lemma}).`
      };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> =>
      Boolean(candidate)
    )
    .sort((left, right) => right.score - left.score);

  const best = candidates[0];
  if (!best || best.score < 0.42) {
    return undefined;
  }

  const confidence = Math.min(0.94, 0.56 + best.score * 0.38);

  return {
    bible: options.bible,
    book: options.verse.bookId,
    scope: `${options.verse.bookId}.${options.verse.chapter}`,
    ref: formatRef(options.verse),
    strong: [options.occurrence.strong],
    target: "word",
    wordIndex: best.word.wordIndex,
    normalized: best.word.normalized,
    confidence: roundRatio(confidence),
    decision: "accept-word",
    source: best.source,
    reason: best.reason,
    evidence: {
      originalStrong: options.occurrence.originalStrong,
      originalOccurrenceId: options.occurrence.occurrenceId,
      originalLemma: options.occurrence.lemma,
      originalGloss: options.occurrence.gloss,
      referenceCount: options.referenceEvidence.filter(
        (reference) => reference.occurrenceCount > 0
      ).length
    }
  };
}

function isSupportedBySameVerseReference(options: {
  strong: string;
  normalized: string;
  referenceEvidence: ReferenceEvidence[];
}): boolean {
  const normalizedStem = stemWord(options.normalized);

  for (const reference of options.referenceEvidence) {
    for (const token of reference.taggedTokens) {
      if (token.normalized === options.normalized) {
        return true;
      }
      if (
        normalizedStem.length >= 4 &&
        stemWord(token.normalized) === normalizedStem
      ) {
        return true;
      }
    }
  }

  return false;
}

function buildCurrentAlignment(
  context: V3Context,
  verse: BibleVerse,
  original: OriginalBundleVerse
): ReaderAlignmentResult {
  const key = referenceKey(verse.bookId, verse.chapter, verse.verse);
  const references = context.references.map((reference) => ({
    name: reference.name,
    verse: reference.map.get(key)
  }));
  const result = alignReaderVerse({
    targetText: verse.text,
    references,
    lexicon: context.lexicon,
    originalVerse: original.verse,
    translationLexicon: context.translationLexicon,
    phraseLexicon: context.phraseLexicon,
    original: {
      strongSet: new Set(
        [...original.verse.strongSet]
          .map((strong) => canonicalStrong(strong))
          .filter((strong): strong is string => Boolean(strong))
      ),
      source: original.sourceNames.join("+")
    },
    readerPolicy: context.profile.readerAlignment
  });

  applyCuratedStrongOverrides({
    bible: context.bible,
    ref: formatRef(verse),
    result
  });

  return result;
}

function buildReferenceEvidence(
  references: ReferenceMap[],
  key: string,
  strong: string
): ReferenceEvidence[] {
  return references.map((reference) => {
    const verse = reference.map.get(key);
    const taggedTokens = (verse?.tokens ?? [])
      .map((token, index) => ({ token, index }))
      .filter(({ token }) =>
        token.strong.some((code) => canonicalStrong(code) === strong)
      )
      .map(({ token, index }) => ({
        index,
        text: token.text,
        normalized: token.normalized,
        strong: token.strong
      }));

    return {
      name: reference.name,
      occurrenceCount: taggedTokens.reduce(
        (sum, token) =>
          sum +
          token.strong.filter((code) => canonicalStrong(code) === strong)
            .length,
        0
      ),
      taggedTokens
    };
  });
}

function buildVerseValidationState(
  context: V3Context,
  ref: string
): {
  verse?: BibleVerse;
  words: TargetWord[];
  originalCounts: Map<string, number>;
  representedCounts: Map<string, number>;
  existingOverrides: Set<string>;
} {
  const verse = context.verses.find(
    (candidate) => formatRef(candidate) === ref
  );
  if (!verse) {
    return {
      words: [],
      originalCounts: new Map(),
      representedCounts: new Map(),
      existingOverrides: getExistingOverrideKeys()
    };
  }

  const original = context.originals.get(
    referenceKey(verse.bookId, verse.chapter, verse.verse)
  );
  if (!original) {
    return {
      verse,
      words: tokenizeText(verse.text)
        .filter((segment) => segment.kind === "word")
        .map((word, wordIndex) => ({
          wordIndex,
          text: word.text,
          normalized: word.normalized,
          currentStrong: []
        })),
      originalCounts: new Map(),
      representedCounts: new Map(),
      existingOverrides: getExistingOverrideKeys()
    };
  }

  const result = buildCurrentAlignment(context, verse, original);
  const originalCounts = countCanonicalStrongValues(
    getOriginalStrongOccurrences(original.verse).flatMap((occurrence) => {
      const priority = classifyOriginalStrong({
        strong: occurrence.strong,
        pos: occurrence.pos
      });
      return priority === "not-rendered-candidate" ? [] : [occurrence.strong];
    })
  );
  const representedCounts = countCanonicalStrongValues([
    ...[...result.assignments.values()].flatMap(
      (assignment) => assignment.strong
    ),
    ...result.phraseAssignments.flatMap((assignment) => assignment.strong),
    ...result.emptyAssignments.map((assignment) => assignment.strong)
  ]);

  return {
    verse,
    words: getTargetWords(result),
    originalCounts,
    representedCounts,
    existingOverrides: getExistingOverrideKeys()
  };
}

export function validateDecisionAgainstState(
  decision: V3Decision,
  state: {
    verse?: BibleVerse;
    words: TargetWord[];
    originalCounts: Map<string, number>;
    representedCounts: Map<string, number>;
    existingOverrides: Set<string>;
  },
  minConfidence: number
):
  | { status: "validated" }
  | { status: "pending" }
  | { status: "rejected"; reason: string } {
  if (!state.verse) {
    return { status: "rejected", reason: "missing-target-verse" };
  }
  if (decision.decision === "pending-human") {
    return { status: "pending" };
  }
  if (decision.strong.length === 0) {
    return { status: "rejected", reason: "missing-strong" };
  }

  for (const code of decision.strong) {
    const strong = canonicalStrong(code);
    if (!strong) {
      return { status: "rejected", reason: "invalid-strong-format" };
    }
    if (!state.originalCounts.has(strong)) {
      return {
        status: "rejected",
        reason: "strong-absent-from-original-inventory"
      };
    }
    if (
      (state.representedCounts.get(strong) ?? 0) >=
      (state.originalCounts.get(strong) ?? 0)
    ) {
      return { status: "rejected", reason: "duplicate-or-already-represented" };
    }
  }

  if (state.existingOverrides.has(overrideKey(decision))) {
    return { status: "rejected", reason: "duplicate-existing-override" };
  }

  if (decision.target === "empty") {
    if (
      !Number.isInteger(decision.wordIndex) ||
      decision.wordIndex < -1 ||
      decision.wordIndex >= state.words.length
    ) {
      return { status: "rejected", reason: "invalid-empty-index" };
    }
    if (decision.confidence < minConfidence) {
      return { status: "pending" };
    }
    return { status: "validated" };
  }

  if (decision.target === "phrase") {
    const start = decision.startWordIndex ?? decision.wordIndex;
    const end = decision.endWordIndex ?? decision.wordIndex;
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 0 ||
      end < start ||
      end >= state.words.length
    ) {
      return { status: "rejected", reason: "invalid-phrase-range" };
    }
    const phrase = state.words
      .slice(start, end + 1)
      .map((word) => word.normalized);
    if (
      phrase.length !== end - start + 1 ||
      JSON.stringify(phrase) !== JSON.stringify(decision.normalizedPhrase ?? [])
    ) {
      return { status: "rejected", reason: "phrase-normalization-mismatch" };
    }
    if (!phrase.some((word) => !WEAK_FUNCTION_WORDS.has(word))) {
      return { status: "rejected", reason: "weak-function-phrase-target" };
    }
    if (decision.confidence < minConfidence) {
      return { status: "pending" };
    }
    return { status: "validated" };
  }

  const word = state.words[decision.wordIndex];
  if (!word) {
    return { status: "rejected", reason: "invalid-word-index" };
  }
  if (word.normalized !== decision.normalized) {
    return { status: "rejected", reason: "word-normalization-mismatch" };
  }
  if (WEAK_FUNCTION_WORDS.has(word.normalized)) {
    return { status: "rejected", reason: "weak-function-word-target" };
  }
  if (decision.confidence < minConfidence) {
    return { status: "pending" };
  }

  return { status: "validated" };
}

async function applyValidatedDecisions(
  decisions: V3Decision[],
  overridesPath: string
): Promise<{ outputPath: string; added: number; skipped: number }> {
  return withReviewFileLock(async () => {
    const current = existsSync(overridesPath)
      ? (JSON.parse(readFileSync(overridesPath, "utf8")) as unknown[])
      : [];
    const currentOverrides = current.filter(isRecord);
    const existing = new Set(currentOverrides.map(overrideKeyFromRecord));
    let added = 0;
    let skipped = 0;

    for (const decision of decisions) {
      const override = decisionToOverride(decision);
      const key = overrideKeyFromRecord(override);
      if (existing.has(key)) {
        skipped += 1;
        continue;
      }
      currentOverrides.push(override);
      existing.add(key);
      added += 1;
    }

    await writeJsonFileAtomic(
      overridesPath,
      sortOverrideRecords(currentOverrides)
    );

    return { outputPath: overridesPath, added, skipped };
  });
}

function decisionToOverride(decision: V3Decision): Record<string, unknown> {
  return {
    bible: decision.bible,
    ref: decision.ref,
    target: decision.target,
    wordIndex: decision.wordIndex,
    normalized: decision.target === "empty" ? "" : decision.normalized,
    startWordIndex: decision.startWordIndex,
    endWordIndex: decision.endWordIndex,
    normalizedPhrase: decision.normalizedPhrase,
    strong: decision.strong,
    confidence: decision.confidence,
    source: `semantic-v3:${decision.source}`,
    reason: decision.reason
  };
}

function readDecisionInput(
  inputPath: string,
  minConfidence: number
): V3Decision[] {
  const paths =
    existsSync(inputPath) && isDirectory(inputPath)
      ? readdirSync(inputPath)
          .filter((file) => file.endsWith(".json"))
          .map((file) => path.join(inputPath, file))
      : [inputPath];
  const decisions: V3Decision[] = [];

  for (const filePath of paths) {
    const raw = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
    decisions.push(...extractDecisions(raw, minConfidence));
  }

  return decisions;
}

function extractDecisions(raw: unknown, minConfidence: number): V3Decision[] {
  if (Array.isArray(raw)) {
    return raw.filter(isV3Decision);
  }
  if (!isRecord(raw)) {
    return [];
  }
  if (Array.isArray(raw.decisions)) {
    return raw.decisions.filter(isV3Decision);
  }
  if (Array.isArray(raw.items)) {
    return raw.items.flatMap((item) => {
      if (!isRecord(item)) return [];
      const proposal = item.deterministicProposal;
      if (isV3Decision(proposal)) return [proposal];
      return [];
    });
  }
  if (Array.isArray(raw.validated)) {
    return raw.validated.filter(isV3Decision);
  }
  if (Array.isArray(raw.approvedOverrides)) {
    return raw.approvedOverrides.flatMap((override) =>
      overrideRecordToDecision(override, minConfidence)
    );
  }
  return [];
}

function overrideRecordToDecision(
  value: unknown,
  minConfidence: number
): V3Decision[] {
  if (!isRecord(value)) return [];
  if (
    typeof value.bible !== "string" ||
    typeof value.ref !== "string" ||
    !Array.isArray(value.strong) ||
    !value.strong.every((strong) => typeof strong === "string") ||
    typeof value.wordIndex !== "number" ||
    typeof value.normalized !== "string"
  ) {
    return [];
  }
  const [book, chapter] = value.ref.split(".");
  const target =
    value.target === "phrase" || value.target === "empty"
      ? value.target
      : "word";
  return [
    {
      bible: value.bible,
      book: book ?? "",
      scope: book && chapter ? `${book}.${chapter}` : value.ref,
      ref: value.ref,
      strong: value.strong,
      target,
      wordIndex: value.wordIndex,
      startWordIndex:
        typeof value.startWordIndex === "number"
          ? value.startWordIndex
          : undefined,
      endWordIndex:
        typeof value.endWordIndex === "number" ? value.endWordIndex : undefined,
      normalized: value.normalized,
      normalizedPhrase: Array.isArray(value.normalizedPhrase)
        ? value.normalizedPhrase.filter((item) => typeof item === "string")
        : undefined,
      confidence:
        typeof value.confidence === "number" ? value.confidence : minConfidence,
      decision:
        target === "phrase"
          ? "accept-phrase"
          : target === "empty"
            ? "accept-empty"
            : "accept-word",
      source: typeof value.source === "string" ? value.source : "semantic-v3",
      reason:
        typeof value.reason === "string" ? value.reason : "Imported override."
    }
  ];
}

function isV3Decision(value: unknown): value is V3Decision {
  if (!isRecord(value)) return false;
  return (
    typeof value.bible === "string" &&
    typeof value.book === "string" &&
    typeof value.scope === "string" &&
    typeof value.ref === "string" &&
    Array.isArray(value.strong) &&
    value.strong.every((strong) => typeof strong === "string") &&
    (value.target === "word" ||
      value.target === "phrase" ||
      value.target === "empty") &&
    Number.isInteger(value.wordIndex) &&
    typeof value.normalized === "string" &&
    typeof value.confidence === "number" &&
    typeof value.decision === "string" &&
    typeof value.source === "string" &&
    typeof value.reason === "string"
  );
}

async function loadContext(options: CliOptions): Promise<V3Context> {
  const references = await loadReferences();
  const originals = mergeOriginalSources(await loadOriginalSources());
  const verses = filterVerses(await readBibleJson(options.biblePath), options);
  const dictionaryCandidates = readStrongDictionaryTranslationCandidates();

  return {
    bible: options.bible,
    verses,
    references,
    originals,
    lexicon: buildStrongLexicon(references),
    translationLexicon: buildStrongTranslationLexicon(references, {
      dictionaryCandidates
    }),
    phraseLexicon: buildStrongPhraseLexicon(references),
    profile: getTranslationProfile(options.bible)
  };
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
      for (const strong of verse.strongSet) {
        const canonical = canonicalStrong(strong);
        if (canonical) existing.verse.strongSet.add(canonical);
      }
      if (!existing.sourceNames.includes(original.name)) {
        existing.sourceNames.push(original.name);
      }
      merged.set(key, existing);
    }
  }

  return merged;
}

function filterVerses(verses: BibleVerse[], options: CliOptions): BibleVerse[] {
  if (options.onlyRef) {
    const [bookId, chapter, verse] = options.onlyRef.split(".");
    return verses.filter(
      (candidate) =>
        candidate.bookId === bookId &&
        (!chapter || candidate.chapter === Number.parseInt(chapter, 10)) &&
        (!verse || candidate.verse === Number.parseInt(verse, 10))
    );
  }

  if (options.books && options.books.length > 0) {
    const books = new Set(options.books);
    return verses.filter((verse) => books.has(verse.bookId));
  }

  return verses;
}

function getTargetWords(result: ReaderAlignmentResult): TargetWord[] {
  const words: TargetWord[] = [];
  let wordIndex = -1;

  for (const segment of result.segments) {
    if (segment.kind !== "word") continue;
    wordIndex += 1;
    words.push({
      wordIndex,
      text: segment.text,
      normalized: segment.normalized,
      currentStrong: getCurrentStrongAtWord(result, wordIndex)
    });
  }

  return words;
}

function getCurrentStrongAtWord(
  result: ReaderAlignmentResult,
  wordIndex: number
): string[] {
  const strong = new Set<string>();
  for (const code of result.assignments.get(wordIndex)?.strong ?? []) {
    const canonical = canonicalStrong(code);
    if (canonical) strong.add(canonical);
  }
  for (const phrase of result.phraseAssignments) {
    if (wordIndex < phrase.startWordIndex || wordIndex > phrase.endWordIndex) {
      continue;
    }
    for (const code of phrase.strong) {
      const canonical = canonicalStrong(code);
      if (canonical) strong.add(canonical);
    }
  }
  return [...strong].sort();
}

function countCanonicalStrongValues(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    const strong = canonicalStrong(value);
    if (!strong || IGNORED_CANONICAL_STRONG.has(strong)) continue;
    counts.set(strong, (counts.get(strong) ?? 0) + 1);
  }
  return counts;
}

function groupWorkItems(
  items: SemanticMissingItem[],
  chunkSize: "chapter" | "book"
): Map<string, SemanticMissingItem[]> {
  const groups = new Map<string, SemanticMissingItem[]>();

  for (const item of items) {
    const scope =
      chunkSize === "book" ? item.book : `${item.book}.${item.chapter}`;
    const current = groups.get(scope) ?? [];
    current.push(item);
    groups.set(scope, current);
  }

  return groups;
}

function groupItemsByBook(
  items: SemanticMissingItem[]
): Map<string, SemanticMissingItem[]> {
  const groups = new Map<string, SemanticMissingItem[]>();

  for (const item of items) {
    const current = groups.get(item.book) ?? [];
    current.push(item);
    groups.set(item.book, current);
  }

  return groups;
}

function isSemanticPriority(priority: MissingPriority): boolean {
  return priority === "semantic-high" || priority === "semantic-medium";
}

function scorePosition(
  originalIndex: number,
  originalCount: number,
  wordIndex: number,
  wordCount: number
): number {
  if (originalCount <= 1 || wordCount <= 1) return 1;
  const originalRatio = originalIndex / (originalCount - 1);
  const wordRatio = wordIndex / (wordCount - 1);
  return Math.max(0, 1 - Math.abs(originalRatio - wordRatio));
}

function validationOutputDir(options: CliOptions): string {
  if (!options.inputPath) return scopedOutputDir(options);
  const basename = path.basename(options.inputPath, ".json");
  return path.join(path.dirname(options.inputPath), `validation-${basename}`);
}

function scopedOutputDir(options: CliOptions): string {
  return path.join(options.outputDir, options.bible, scopePathSegment(options));
}

function scopePathSegment(options: CliOptions): string {
  if (options.onlyRef) return options.onlyRef;
  if (options.books?.length === 1) return options.books[0] ?? "all";
  if (options.books && options.books.length > 1) return "multi-book";
  return "all";
}

function scopeLabel(options: CliOptions): string {
  if (options.onlyRef) return options.onlyRef;
  if (options.books?.length) return options.books.join(",");
  return "all";
}

function formatRef(verse: BibleVerse): string {
  return `${verse.bookId}.${verse.chapter}.${verse.verse}`;
}

function parseCliOptions(argv: string[]): CliOptions {
  const command =
    argv[0] === "plan" || argv[0] === "validate" ? argv[0] : "missing";
  const args = new Map<string, string>();
  const flags = new Set<string>();

  for (let index = 1; index < argv.length; index += 1) {
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

  const bible = (args.get("bible") ?? "nbs").toLowerCase();
  const books = args
    .get("books")
    ?.split(",")
    .map((book) => book.trim())
    .filter(Boolean);
  const chunkSize = args.get("chunk-size") === "book" ? "book" : "chapter";

  return {
    command,
    bible,
    biblePath: args.get("bible-path") ?? `data/bibles/bible-${bible}.json`,
    outputDir: args.get("output-dir") ?? "outputs/semantic-v3",
    onlyRef: args.get("only"),
    books,
    chunkSize,
    inputPath: args.get("input"),
    apply: flags.has("apply") || args.get("apply") === "true",
    includeFunction:
      flags.has("include-function") || args.get("include-function") === "true",
    minConfidence: Number.parseFloat(args.get("min-confidence") ?? "0.84"),
    overridesPath: args.get("overrides") ?? "data/curated-strong-overrides.json"
  };
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeJsonFileAtomic(filePath, value);
}

function getExistingOverrideKeys(): Set<string> {
  const raw = existsSync("data/curated-strong-overrides.json")
    ? (JSON.parse(
        readFileSync("data/curated-strong-overrides.json", "utf8")
      ) as unknown[])
    : [];
  return new Set(raw.filter(isRecord).map(overrideKeyFromRecord));
}

function overrideKey(decision: V3Decision): string {
  return [
    decision.bible,
    decision.ref,
    decision.target,
    decision.wordIndex,
    decision.startWordIndex ?? "",
    decision.endWordIndex ?? "",
    decision.normalized,
    decision.normalizedPhrase?.join(" ") ?? "",
    decision.strong.map((code) => canonicalStrong(code) ?? code).join(" ")
  ].join("|");
}

function overrideKeyFromRecord(record: Record<string, unknown>): string {
  const strong = Array.isArray(record.strong)
    ? record.strong
        .filter((code) => typeof code === "string")
        .map((code) => canonicalStrong(code) ?? code)
        .join(" ")
    : "";
  const phrase = Array.isArray(record.normalizedPhrase)
    ? record.normalizedPhrase
        .filter((word) => typeof word === "string")
        .join(" ")
    : "";
  return [
    record.bible,
    record.ref,
    record.target ?? "word",
    record.wordIndex,
    record.startWordIndex ?? "",
    record.endWordIndex ?? "",
    record.normalized,
    phrase,
    strong
  ].join("|");
}

function sortOverrideRecords(
  records: Array<Record<string, unknown>>
): Array<Record<string, unknown>> {
  return [...records].sort((left, right) =>
    overrideKeyFromRecord(left).localeCompare(overrideKeyFromRecord(right))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isDirectory(filePath: string): boolean {
  return existsSync(filePath) && statSync(filePath).isDirectory();
}

function roundRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10_000) / 10_000;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseCliOptions(process.argv.slice(2));

  if (options.command === "plan") {
    const outputPath = await writePlan(options);
    console.log(`Wrote semantic V3 work-items manifest: ${outputPath}`);
  } else if (options.command === "validate") {
    const output = await validateDecisions(options);
    console.log(
      `Validated ${output.validated.length}; pending ${output.pendingHuman.length}; rejected ${output.rejected.length}`
    );
    if (output.applied) {
      console.log(
        `Applied ${output.applied.added} overrides to ${output.applied.outputPath}; skipped ${output.applied.skipped}`
      );
    }
  } else {
    const outputPath = await writeMissing(options);
    console.log(`Wrote semantic V3 missing audit: ${outputPath}`);
  }
}
