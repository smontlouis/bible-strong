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
    wordIndex: number;
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
  wordIndex: number;
  word: string;
  normalized: string;
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
      const word = words[suggestion.wordIndex];
      if (!word) continue;
      const item: ReviewItem = {
        id: [
          options.bible,
          diagnostic.ref,
          suggestion.wordIndex,
          suggestion.strong.join("+")
        ].join(":"),
        bible: options.bible,
        ref: diagnostic.ref,
        reasons: diagnostic.reasons ?? [],
        wordIndex: suggestion.wordIndex,
        word: word.text,
        normalized: word.normalized,
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
      "Accept only suggestions that clearly attach a Strong code to the intended French word.",
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
  const bible = await readBibleJson(`data/bibles/bible-${options.bible}.json`);
  const verses = new Map(
    bible.map((verse) => [
      referenceKey(verse.bookId, verse.chapter, verse.verse),
      verse
    ])
  );
  const accepted = extractAcceptedOverrides(options.decisions);
  const existing = getCuratedStrongOverrides();
  const currentJson = existsSync(overridesPath)
    ? readJsonFile<CuratedStrongOverride[]>(overridesPath)
    : [];
  const next = [...currentJson];
  let added = 0;
  let skipped = 0;

  for (const override of accepted) {
    const verse = verses.get(override.ref);
    const isEmptyOverride = (override.target ?? "word") === "empty";
    const words = verse ? getWords(verse) : [];
    const word = words[override.wordIndex];
    const validEmptyIndex =
      isEmptyOverride &&
      verse &&
      override.wordIndex >= -1 &&
      override.wordIndex < words.length;
    const validWordTarget =
      !isEmptyOverride && word && word.normalized === override.normalized;

    if (
      override.bible !== options.bible ||
      (!validWordTarget && !validEmptyIndex) ||
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
  if (item.decision === "accept-empty") {
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
      `- word index: \`${item.wordIndex}\``,
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
  return (
    left.bible === right.bible &&
    left.ref === right.ref &&
    (left.target ?? "word") === (right.target ?? "word") &&
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
      a.wordIndex - b.wordIndex ||
      a.strong.join(" ").localeCompare(b.strong.join(" "))
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
