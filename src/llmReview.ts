import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { readBibleJson, type BibleVerse } from "./bibleJson.js";
import {
  getCuratedStrongOverrides,
  type CuratedStrongOverride
} from "./curatedStrongOverrides.js";
import { referenceKey } from "./strongCsv.js";
import { tokenizeText } from "./tokenize.js";

export interface ReviewOptions {
  command: "prepare" | "apply";
  bible: string;
  onlyRef?: string;
  diagnosticsPath: string;
  reviewPath: string;
  decisionsPath: string;
  outputDir: string;
  overridesPath: string;
  autoAccept: boolean;
  autoAcceptThreshold: number;
}

interface HardVerseDiagnostic {
  ref: string;
  reasons?: string[];
  llmAttempted?: boolean;
  llmEligible?: boolean;
  llmAcceptedAssignments?: number;
  llmRejectedAssignments?: number;
  llmSuggestions?: Array<{
    target?: "word" | "phrase" | "empty";
    wordIndex: number;
    startWordIndex?: number;
    endWordIndex?: number;
    normalizedPhrase?: string[];
    strong: string[];
    confidence: number;
    reason: string;
  }>;
  llmUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  llmError?: string;
}

interface ReviewWord {
  wordIndex: number;
  text: string;
  normalized: string;
}

type ReviewDecision =
  | "pending"
  | "accept"
  | "reject"
  | "accept-word"
  | "accept-empty"
  | "reject-wrong"
  | "reject-duplicate"
  | "pending-human";

interface ReviewItem {
  id: string;
  bible: string;
  ref: string;
  reasons: string[];
  target?: "word" | "empty" | "phrase";
  wordIndex: number;
  word: string;
  normalized: string;
  startWordIndex?: number;
  endWordIndex?: number;
  normalizedPhrase?: string[];
  strong: string[];
  confidence: number;
  llmReason: string;
  llmUsage?: HardVerseDiagnostic["llmUsage"];
  targetWords: ReviewWord[];
  decision: ReviewDecision;
  reviewerNote: string;
}

export interface ReviewFile {
  generatedAt: string;
  bible: string;
  diagnosticsPath: string;
  decisionsPath: string;
  instructions: string[];
  items: ReviewItem[];
}

export interface DecisionFile {
  bible: string;
  decisions?: Array<{
    id: string;
    decision: ReviewDecision;
    reviewerNote?: string;
  }>;
  items?: ReviewItem[];
  approvedOverrides?: CuratedStrongOverride[];
}

export async function prepareReview(
  options: ReviewOptions
): Promise<ReviewFile> {
  const biblePath = `data/bibles/bible-${options.bible}.json`;
  const bible = await readBibleJson(biblePath);
  const verses = new Map(
    bible.map((verse) => [
      referenceKey(verse.bookId, verse.chapter, verse.verse),
      verse
    ])
  );
  const diagnostics = readJsonFile<HardVerseDiagnostic[]>(
    options.diagnosticsPath
  ).filter((diagnostic) =>
    options.onlyRef ? refMatches(diagnostic.ref, options.onlyRef) : true
  );
  const items: ReviewItem[] = [];

  for (const diagnostic of diagnostics) {
    const verse = verses.get(diagnostic.ref);
    if (!verse || !diagnostic.llmSuggestions?.length) continue;
    const words = getWords(verse);

    for (const suggestion of diagnostic.llmSuggestions) {
      const target = normalizeReviewTarget(suggestion.target);
      const startWordIndex = suggestion.startWordIndex ?? suggestion.wordIndex;
      const endWordIndex = suggestion.endWordIndex ?? suggestion.wordIndex;
      const word =
        target === "empty"
          ? (words[Math.max(0, suggestion.wordIndex)] ?? words[0])
          : words[suggestion.wordIndex];
      const phraseWords =
        target === "phrase"
          ? words.filter(
              (candidate) =>
                candidate.wordIndex >= startWordIndex &&
                candidate.wordIndex <= endWordIndex
            )
          : [];
      if (target !== "empty" && !word) continue;
      if (
        target === "phrase" &&
        phraseWords.length !== endWordIndex - startWordIndex + 1
      ) {
        continue;
      }
      const item: ReviewItem = {
        id: [
          options.bible,
          diagnostic.ref,
          target,
          target === "phrase"
            ? `${startWordIndex}-${endWordIndex}`
            : suggestion.wordIndex,
          suggestion.strong.join("+")
        ].join(":"),
        bible: options.bible,
        ref: diagnostic.ref,
        reasons: diagnostic.reasons ?? [],
        target,
        wordIndex: suggestion.wordIndex,
        word:
          target === "phrase"
            ? phraseWords.map((phraseWord) => phraseWord.text).join(" ")
            : (word?.text ?? ""),
        normalized:
          target === "phrase"
            ? phraseWords.map((phraseWord) => phraseWord.normalized).join(" ")
            : (word?.normalized ?? ""),
        startWordIndex: target === "phrase" ? startWordIndex : undefined,
        endWordIndex: target === "phrase" ? endWordIndex : undefined,
        normalizedPhrase:
          target === "phrase"
            ? (suggestion.normalizedPhrase ??
              phraseWords.map((phraseWord) => phraseWord.normalized))
            : undefined,
        strong: suggestion.strong.map((strong) => strong.toUpperCase()),
        confidence: suggestion.confidence,
        llmReason: suggestion.reason,
        llmUsage: diagnostic.llmUsage,
        targetWords: words,
        decision: "pending",
        reviewerNote: ""
      };
      autoAcceptReviewItem(item, options);
      items.push(item);
    }
  }

  const review: ReviewFile = {
    generatedAt: new Date().toISOString(),
    bible: options.bible,
    diagnosticsPath: options.diagnosticsPath,
    decisionsPath: options.decisionsPath,
    instructions: [
      "Open this JSON in the local viewer LLM Review mode.",
      "High-confidence mechanically safe suggestions may already be marked accept; review them and reject if needed.",
      "Accept only suggestions that clearly attach a Strong code to the intended French word, phrase, or justified empty target.",
      "Use phrase targets for real French locutions instead of forcing the Strong onto a single head word.",
      "Reject token-index drift, weak function-word tags, duplicate over-tagging, and unrendered original particles.",
      "Click Save decisions in the viewer to write accepted suggestions into data/curated-strong-overrides.json."
    ],
    items
  };

  await mkdir(path.dirname(options.reviewPath), { recursive: true });
  await writeFile(
    options.reviewPath,
    `${JSON.stringify(review, null, 2)}\n`,
    "utf8"
  );
  await writeFile(
    options.reviewPath.replace(/\.json$/u, ".md"),
    renderReviewMarkdown(review),
    "utf8"
  );

  return review;
}

async function applyReviewDecisions(options: ReviewOptions): Promise<{
  accepted: number;
  skipped: number;
  outputPath: string;
}> {
  const decisions = readJsonFile<DecisionFile>(options.decisionsPath);
  return applyReviewDecisionPayload({
    bible: options.bible,
    decisions,
    overridesPath: options.overridesPath
  });
}

export async function applyReviewDecisionPayload(options: {
  bible: string;
  decisions: DecisionFile;
  overridesPath?: string;
}): Promise<{
  accepted: number;
  skipped: number;
  outputPath: string;
}> {
  const overridesPath =
    options.overridesPath ?? "data/curated-strong-overrides.json";
  const accepted = extractAcceptedOverrides(options.decisions);
  const versesByBible = new Map<string, Map<string, BibleVerse>>();
  const existing = getCuratedStrongOverrides();
  const currentJson = existsSync(overridesPath)
    ? readJsonFile<CuratedStrongOverride[]>(overridesPath)
    : [];
  const next = [...currentJson];
  let added = 0;
  let skipped = 0;

  for (const override of accepted) {
    if (options.bible !== "multi" && override.bible !== options.bible) {
      skipped += 1;
      continue;
    }

    const verses = await getVersesForBible(override.bible, versesByBible);
    const verse = verses.get(override.ref);
    const target = override.target ?? "word";
    const isEmptyOverride = target === "empty";
    const isPhraseOverride = target === "phrase";
    const words = verse ? getWords(verse) : [];
    const word = words[override.wordIndex];
    const validEmptyIndex =
      isEmptyOverride &&
      verse &&
      override.wordIndex >= -1 &&
      override.wordIndex < words.length;
    const validPhraseTarget =
      isPhraseOverride && verse && isValidPhraseTarget(override, words);
    const validWordTarget =
      target === "word" && word && word.normalized === override.normalized;

    if (
      (!validWordTarget && !validEmptyIndex && !validPhraseTarget) ||
      existing.some((candidate) => sameOverride(candidate, override)) ||
      next.some((candidate) => sameOverride(candidate, override))
    ) {
      skipped += 1;
      continue;
    }

    next.push(override);
    added += 1;
  }

  await writeFile(
    overridesPath,
    `${JSON.stringify(sortOverrides(next), null, 2)}\n`,
    "utf8"
  );

  return { accepted: added, skipped, outputPath: overridesPath };
}

function extractAcceptedOverrides(
  decisions: DecisionFile
): CuratedStrongOverride[] {
  if (decisions.approvedOverrides) return decisions.approvedOverrides;

  if (decisions.items) {
    return decisions.items
      .filter(
        (item) =>
          item.decision === "accept" ||
          item.decision === "accept-word" ||
          item.decision === "accept-empty"
      )
      .map(itemToOverride);
  }

  return [];
}

function autoAcceptReviewItem(item: ReviewItem, options: ReviewOptions): void {
  if (!options.autoAccept) return;
  if ((item.target ?? "word") !== "word") return;
  if (item.confidence < options.autoAcceptThreshold) return;
  if (item.strong.some((strong) => WEAK_AUTO_ACCEPT_STRONG.has(strong))) return;
  if (WEAK_AUTO_ACCEPT_WORDS.has(item.normalized)) return;

  item.decision = "accept";
  item.reviewerNote = `Auto-accepted by review:llm because confidence >= ${options.autoAcceptThreshold}, target word is not a weak function word, and Strong is not in the weak auto-accept denylist.`;
}

const WEAK_AUTO_ACCEPT_STRONG = new Set([
  "H0853",
  "H0834",
  "H0996",
  "H8033",
  "H5921",
  "H0413",
  "G1722",
  "G1519",
  "G3588"
]);

const WEAK_AUTO_ACCEPT_WORDS = new Set([
  "a",
  "au",
  "aux",
  "avec",
  "avant",
  "apres",
  "chez",
  "contre",
  "ce",
  "ces",
  "cet",
  "cette",
  "de",
  "dans",
  "des",
  "depuis",
  "du",
  "en",
  "et",
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
  "parmi",
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
  "sous",
  "un",
  "une",
  "vers",
  "y"
]);

function itemToOverride(item: ReviewItem): CuratedStrongOverride {
  if (item.target === "phrase") {
    const startWordIndex = item.startWordIndex ?? item.wordIndex;
    const endWordIndex = item.endWordIndex ?? item.wordIndex;
    return {
      bible: item.bible,
      ref: item.ref,
      target: "phrase",
      wordIndex: startWordIndex,
      normalized: (item.normalizedPhrase ?? [item.normalized]).join(" "),
      startWordIndex,
      endWordIndex,
      normalizedPhrase: item.normalizedPhrase ?? [item.normalized],
      strong: item.strong,
      confidence: Math.min(0.92, Math.max(0.72, item.confidence)),
      source: "llm-review:human-approved-phrase",
      reason: [item.llmReason, item.reviewerNote].filter(Boolean).join(" | ")
    };
  }

  if (item.target === "empty" || item.decision === "accept-empty") {
    return {
      bible: item.bible,
      ref: item.ref,
      target: "empty",
      wordIndex: item.wordIndex,
      normalized: "",
      strong: item.strong,
      confidence: Math.min(0.9, Math.max(0.64, item.confidence)),
      source: "llm-review:human-approved-empty",
      reason: [item.llmReason, item.reviewerNote].filter(Boolean).join(" | ")
    };
  }

  return {
    bible: item.bible,
    ref: item.ref,
    target: "word",
    wordIndex: item.wordIndex,
    normalized: item.normalized,
    strong: item.strong,
    confidence: Math.min(0.92, Math.max(0.72, item.confidence)),
    source: "llm-review:human-approved",
    reason: [item.llmReason, item.reviewerNote].filter(Boolean).join(" | ")
  };
}

function normalizeReviewTarget(
  target: "word" | "phrase" | "empty" | undefined
): "word" | "phrase" | "empty" {
  if (target === "phrase" || target === "empty") return target;
  return "word";
}

function renderReviewMarkdown(review: ReviewFile): string {
  const lines = [
    `# LLM Review ${review.bible.toUpperCase()}`,
    "",
    `Generated: ${review.generatedAt}`,
    `Diagnostics: \`${review.diagnosticsPath}\``,
    "",
    "## Workflow",
    "",
    "1. Open the JSON review file in the local viewer.",
    "2. Accept only suggestions that are clearly correct.",
    "3. Click Save decisions in the viewer.",
    "4. Regenerate the Bible with `npm run generate:strong:hybrid -- --bible <id>`.",
    "",
    "## Pending Suggestions",
    ""
  ];

  for (const item of review.items) {
    lines.push(
      `### ${item.ref} -> ${item.word}/${item.strong.join(" ")}`,
      "",
      `- decision: \`${item.decision}\``,
      `- target: \`${item.target ?? "word"}\``,
      `- word index: \`${item.wordIndex}\``,
      ...(item.target === "phrase"
        ? [
            `- phrase range: \`${item.startWordIndex}-${item.endWordIndex}\``,
            `- normalized phrase: \`${item.normalizedPhrase?.join(" ") ?? ""}\``
          ]
        : []),
      `- confidence: \`${item.confidence}\``,
      `- reasons: \`${item.reasons.join(", ") || "none"}\``,
      `- LLM reason: ${item.llmReason}`,
      `- context: ${item.targetWords
        .map((word) =>
          word.wordIndex === item.wordIndex ? `**${word.text}**` : word.text
        )
        .join(" ")}`,
      ""
    );
  }

  return `${lines.join("\n")}\n`;
}

function getWords(verse: BibleVerse): ReviewWord[] {
  return tokenizeText(verse.text)
    .filter((segment) => segment.kind === "word")
    .map((segment, wordIndex) => ({
      wordIndex,
      text: segment.text,
      normalized: segment.normalized
    }));
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function sameOverride(
  left: CuratedStrongOverride,
  right: CuratedStrongOverride
): boolean {
  if ((left.target ?? "word") !== (right.target ?? "word")) return false;
  if ((left.target ?? "word") === "phrase") {
    return (
      left.bible === right.bible &&
      left.ref === right.ref &&
      left.startWordIndex === right.startWordIndex &&
      left.endWordIndex === right.endWordIndex &&
      left.normalizedPhrase?.join(" ") === right.normalizedPhrase?.join(" ") &&
      left.strong.join(" ") === right.strong.join(" ")
    );
  }

  return (
    left.bible === right.bible &&
    left.ref === right.ref &&
    left.wordIndex === right.wordIndex &&
    left.normalized === right.normalized &&
    left.strong.join(" ") === right.strong.join(" ")
  );
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

function sortOverrides(
  overrides: CuratedStrongOverride[]
): CuratedStrongOverride[] {
  return [...overrides].sort(
    (a, b) =>
      a.bible.localeCompare(b.bible) ||
      a.ref.localeCompare(b.ref, undefined, { numeric: true }) ||
      (a.target ?? "word").localeCompare(b.target ?? "word") ||
      (a.startWordIndex ?? a.wordIndex) - (b.startWordIndex ?? b.wordIndex) ||
      (a.endWordIndex ?? a.wordIndex) - (b.endWordIndex ?? b.wordIndex) ||
      a.wordIndex - b.wordIndex ||
      a.strong.join(" ").localeCompare(b.strong.join(" "))
  );
}

async function getVersesForBible(
  bible: string,
  cache: Map<string, Map<string, BibleVerse>>
): Promise<Map<string, BibleVerse>> {
  const normalizedBible = bible.toLowerCase();
  const cached = cache.get(normalizedBible);
  if (cached) return cached;

  const bibleRows = await readBibleJson(
    `data/bibles/bible-${normalizedBible}.json`
  );
  const verses = new Map(
    bibleRows.map((verse) => [
      referenceKey(verse.bookId, verse.chapter, verse.verse),
      verse
    ])
  );
  cache.set(normalizedBible, verses);
  return verses;
}

function isValidPhraseTarget(
  override: CuratedStrongOverride,
  words: ReviewWord[]
): boolean {
  const startWordIndex = override.startWordIndex ?? override.wordIndex;
  const endWordIndex = override.endWordIndex ?? override.wordIndex;
  const expected = override.normalizedPhrase ?? [];
  if (
    startWordIndex < 0 ||
    endWordIndex < startWordIndex ||
    expected.length !== endWordIndex - startWordIndex + 1
  ) {
    return false;
  }

  return expected.every(
    (normalized, offset) =>
      words[startWordIndex + offset]?.normalized === normalized
  );
}

function parseCliOptions(argv: string[]): ReviewOptions {
  const command = argv[0] === "apply" ? "apply" : "prepare";
  const args = new Map<string, string>();
  for (
    let index = command === "prepare" ? 0 : 1;
    index < argv.length;
    index += 1
  ) {
    const arg = argv[index];
    if (!arg?.startsWith("--")) continue;
    const [key, inlineValue] = arg.slice(2).split("=", 2);
    const value = inlineValue ?? argv[index + 1];
    if (!inlineValue) index += 1;
    if (key && value) args.set(key, value);
  }

  const bible = (args.get("bible") ?? "nbs").toLowerCase();
  const outputDir = args.get("output-dir") ?? "outputs";

  return {
    command,
    bible,
    onlyRef: args.get("only"),
    outputDir,
    diagnosticsPath:
      args.get("diagnostics") ??
      path.join(outputDir, `bible-${bible}-strong-hybrid.hard-verses.json`),
    reviewPath:
      args.get("review") ?? path.join(outputDir, `llm-review-${bible}.json`),
    decisionsPath:
      args.get("decisions") ??
      path.join(outputDir, `llm-review-${bible}.decisions.json`),
    overridesPath:
      args.get("overrides") ?? "data/curated-strong-overrides.json",
    autoAccept: args.get("auto-accept") !== "false",
    autoAcceptThreshold: Number.parseFloat(
      args.get("auto-accept-threshold") ?? "0.84"
    )
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseCliOptions(process.argv.slice(2));

  if (options.command === "apply") {
    const result = await applyReviewDecisions(options);
    console.log(
      `Applied ${result.accepted} approved overrides to ${result.outputPath}; skipped ${result.skipped}`
    );
  } else {
    const review = await prepareReview(options);
    const autoAccepted = review.items.filter(
      (item) => item.decision === "accept"
    ).length;
    console.log(
      `Prepared ${review.items.length} LLM review items (${autoAccepted} auto-accepted): ${options.reviewPath}`
    );
  }
}
