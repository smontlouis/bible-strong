import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { BOOK_IDS } from "./books.js";

const TARGET_BIBLES = ["bds", "bfc", "fmar", "frc97", "nfc", "ost", "nvs78p"];

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
  decision: ReviewDecision;
  reviewerNote?: string;
  strong?: string[];
  confidence?: number;
}

interface ReviewFile {
  bible: string;
  items: ReviewItem[];
}

interface BookReviewResult {
  book: string;
  status: "completed" | "skipped" | "failed";
  reviewPath: string;
  metricsPath: string;
  itemCount: number;
  autoAcceptedCount: number;
  pendingCount: number;
  llmAttemptedVerseCount: number;
  llmTotalTokenCount: number;
  error?: string;
}

interface BookMetrics {
  llmPromptTokenCount?: number;
  llmCompletionTokenCount?: number;
  llmTotalTokenCount?: number;
}

interface BatchManifest {
  bible: string;
  model: string;
  reviewCount: number;
  itemCount: number;
  autoAcceptedCount: number;
  pendingCount: number;
  failedCount: number;
  reviews: BookReviewResult[];
}

interface DiagnosticMetrics {
  bible: string;
  generatedAt: string;
  outputPath: string;
  diagnosticsPath: string;
  verseCount: number;
  generatedVerseCount: number;
  hardVerseCount: number;
  totalStrongOccurrenceCount: number;
  strongWordOccurrenceCount: number;
  emptyStrongOccurrenceCount: number;
  multiStrongWordCount: number;
  taggedTokenCoverage: number;
  visibleStrongRate: number;
  emptyStrongRate: number;
  multiStrongWordRate: number;
  originalRepresentationRate: number;
  originalUnrepresentedStrongOccurrenceCount: number;
  curatedOverrideStrongOccurrenceCount: number;
  profileTokenCoverageStatus: string;
  translationProfile?: {
    bible: string;
    family: string;
    label: string;
    strongDensityPolicy: string;
  };
}

interface BibleStatus {
  bible: string;
  biblePath: string;
  bibleExists: boolean;
  metricsPath: string;
  metrics?: DiagnosticMetrics;
  manifestPath: string;
  manifest?: BatchManifest;
  completedBookCount: number;
  missingBooks: string[];
  failedBooks: BookReviewResult[];
  decisionPath: string;
  decisionCounts: Record<string, number>;
}

interface DecisionFile {
  bible: string;
  generatedAt: string;
  source: string;
  decisions: Array<{
    id: string;
    decision: ReviewDecision;
    reviewerNote: string;
  }>;
  items: ReviewItem[];
}

const DECISION_ORDER: ReviewDecision[] = [
  "accept-word",
  "accept-empty",
  "reject-wrong",
  "reject-duplicate",
  "pending-human",
  "accept",
  "reject",
  "pending"
];

const DEEPSEEK_V4_FLASH_PRICING = {
  inputUsdPerMillion: 0.14,
  outputUsdPerMillion: 0.28,
  source:
    "https://api-docs.deepseek.com/quick_start/pricing and https://vercel.com/ai-gateway/models/deepseek-v4-flash"
};

async function main(): Promise<void> {
  const command = process.argv[2] ?? "status";
  const statuses = collectStatuses();

  if (command === "merge-decisions") {
    await mergeDecisions(statuses);
    return;
  }

  if (command === "report") {
    await writeReports(statuses);
    return;
  }

  printStatus(statuses);
}

function collectStatuses(): BibleStatus[] {
  return TARGET_BIBLES.map((bible) => {
    const biblePath = `data/bibles/bible-${bible}.json`;
    const metricsPath = `outputs/bible-${bible}-strong-diagnostic.metrics.json`;
    const manifestPath = `outputs/llm-books/${bible}/llm-review-${bible}-manifest.json`;
    const decisionPath = `outputs/llm-books/${bible}/llm-review-${bible}-merged-decisions.json`;
    const manifest = readJsonIfExists<BatchManifest>(manifestPath);
    const completedBooks = new Set(
      (manifest?.reviews ?? [])
        .filter((review) => review.status !== "failed")
        .map((review) => review.book)
    );
    const decisionFile = readJsonIfExists<DecisionFile>(decisionPath);

    return {
      bible,
      biblePath,
      bibleExists: existsSync(biblePath),
      metricsPath,
      metrics: readJsonIfExists<DiagnosticMetrics>(metricsPath),
      manifestPath,
      manifest,
      completedBookCount: completedBooks.size,
      missingBooks: BOOK_IDS.filter((book) => !completedBooks.has(book)),
      failedBooks: (manifest?.reviews ?? []).filter(
        (review) => review.status === "failed"
      ),
      decisionPath,
      decisionCounts: countDecisions(decisionFile?.items ?? [])
    };
  });
}

async function mergeDecisions(statuses: BibleStatus[]): Promise<void> {
  for (const status of statuses) {
    if (!status.manifest) {
      console.log(`[${status.bible}] skip: missing manifest`);
      continue;
    }

    const items: ReviewItem[] = [];
    for (const review of status.manifest.reviews) {
      if (review.status === "failed" || !existsSync(review.reviewPath))
        continue;
      const reviewFile = readJsonIfExists<ReviewFile>(review.reviewPath);
      if (!reviewFile) continue;
      items.push(...reviewFile.items.map(normalizeDecisionItem));
    }

    const decisionFile: DecisionFile = {
      bible: status.bible,
      generatedAt: new Date().toISOString(),
      source: status.manifestPath,
      decisions: items.map((item) => ({
        id: item.id,
        decision: item.decision,
        reviewerNote: item.reviewerNote ?? ""
      })),
      items
    };

    await mkdir(path.dirname(status.decisionPath), { recursive: true });
    await writeFile(
      status.decisionPath,
      `${JSON.stringify(decisionFile, null, 2)}\n`,
      "utf8"
    );
    console.log(
      `[${status.bible}] wrote ${status.decisionPath} (${items.length} item(s))`
    );
  }
}

async function writeReports(statuses: BibleStatus[]): Promise<void> {
  await mkdir("reports", { recursive: true });
  for (const status of statuses) {
    await writeFile(
      `reports/strong-generation-${status.bible}.md`,
      renderBibleReport(status),
      "utf8"
    );
  }
  await writeFile(
    "reports/strong-generation-multi-bible-report.md",
    renderGlobalReport(statuses),
    "utf8"
  );
  console.log("Wrote reports/strong-generation-multi-bible-report.md");
}

function normalizeDecisionItem(item: ReviewItem): ReviewItem {
  if (item.decision === "accept") {
    return {
      ...item,
      decision: "accept-word",
      reviewerNote: appendNote(
        item.reviewerNote,
        "Normalized legacy accept to accept-word for durable application."
      )
    };
  }
  if (item.decision === "reject") {
    return {
      ...item,
      decision: "reject-wrong",
      reviewerNote: appendNote(
        item.reviewerNote,
        "Normalized legacy reject to reject-wrong."
      )
    };
  }
  if (item.decision === "pending") {
    return {
      ...item,
      decision: "pending-human",
      reviewerNote: appendNote(
        item.reviewerNote,
        "Left for human review; not applied automatically."
      )
    };
  }
  return item;
}

function renderGlobalReport(statuses: BibleStatus[]): string {
  const lines = [
    "# Multi-Bible Strong Generation Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
    "| Bible | Verses | Tags | Empty | Token coverage | Original repr. | Hard verses | LLM books | Pending human | Failed books |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"
  ];

  for (const status of statuses) {
    const metrics = status.metrics;
    lines.push(
      [
        status.bible,
        metrics
          ? `${metrics.generatedVerseCount}/${metrics.verseCount}`
          : "missing",
        metrics?.totalStrongOccurrenceCount ?? "missing",
        metrics?.emptyStrongOccurrenceCount ?? "missing",
        formatRatio(metrics?.taggedTokenCoverage),
        formatRatio(metrics?.originalRepresentationRate),
        metrics?.hardVerseCount ?? "missing",
        `${status.completedBookCount}/66`,
        status.decisionCounts["pending-human"] ?? 0,
        status.failedBooks.length
      ].join(" | ")
    );
  }

  const totalUsage = statuses.reduce(
    (total, status) => addUsage(total, getLlmUsage(status)),
    emptyUsage()
  );

  lines.push(
    "",
    "## LLM Cost Estimate",
    "",
    `- model: \`deepseek/deepseek-v4-flash\``,
    `- uncached input price: $${DEEPSEEK_V4_FLASH_PRICING.inputUsdPerMillion}/1M tokens`,
    `- output price: $${DEEPSEEK_V4_FLASH_PRICING.outputUsdPerMillion}/1M tokens`,
    `- prompt tokens: ${totalUsage.promptTokens}`,
    `- completion tokens: ${totalUsage.completionTokens}`,
    `- estimated uncached cost: $${estimateCost(totalUsage).toFixed(4)}`,
    `- pricing source checked 2026-06-20: ${DEEPSEEK_V4_FLASH_PRICING.source}`,
    "",
    "## Notes",
    "",
    "- Full generated Bible TSV files remain under `outputs/` and are ignored by Git.",
    "- LLM review is checkpointed per book under `outputs/llm-books/<id>/`.",
    "- Legacy `accept` decisions are normalized to `accept-word`; undecided `pending` items are normalized to `pending-human` and are not silently applied."
  );

  return `${lines.join("\n")}\n`;
}

function renderBibleReport(status: BibleStatus): string {
  const metrics = status.metrics;
  const manifest = status.manifest;
  const lines = [
    `# Strong Generation ${status.bible.toUpperCase()}`,
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Inputs",
    "",
    `- Bible JSON: \`${status.biblePath}\` (${status.bibleExists ? "present" : "missing"})`,
    `- Metrics: \`${status.metricsPath}\` (${metrics ? "present" : "missing"})`,
    `- LLM manifest: \`${status.manifestPath}\` (${manifest ? "present" : "missing"})`,
    `- Merged decisions: \`${status.decisionPath}\``,
    "",
    "## Metrics",
    ""
  ];

  if (metrics) {
    lines.push(
      `- verse coverage: ${metrics.generatedVerseCount}/${metrics.verseCount}`,
      `- total Strong occurrences: ${metrics.totalStrongOccurrenceCount}`,
      `- tagged token coverage: ${formatRatio(metrics.taggedTokenCoverage)}`,
      `- visible Strong rate: ${formatRatio(metrics.visibleStrongRate)}`,
      `- empty Strong rate: ${formatRatio(metrics.emptyStrongRate)}`,
      `- multi-Strong word rate: ${formatRatio(metrics.multiStrongWordRate)}`,
      `- original representation rate: ${formatRatio(metrics.originalRepresentationRate)}`,
      `- original unrepresented Strong count: ${metrics.originalUnrepresentedStrongOccurrenceCount}`,
      `- hard verse count: ${metrics.hardVerseCount}`,
      `- profile token coverage status: ${metrics.profileTokenCoverageStatus}`,
      `- translation profile: ${metrics.translationProfile?.label ?? "missing"} (${metrics.translationProfile?.family ?? "unknown"}, ${metrics.translationProfile?.strongDensityPolicy ?? "unknown"})`,
      `- curated override Strong occurrences: ${metrics.curatedOverrideStrongOccurrenceCount}`
    );
  } else {
    lines.push(
      "- missing metrics; run `npm run strong:diagnose -- --bible <id>`."
    );
  }

  lines.push("", "## LLM Review", "");
  if (manifest) {
    const usage = getLlmUsage(status);
    const attempted = manifest.reviews.reduce(
      (total, review) => total + review.llmAttemptedVerseCount,
      0
    );
    lines.push(
      `- reviewed books: ${status.completedBookCount}/66`,
      `- missing books: ${status.missingBooks.join(", ") || "none"}`,
      `- failed books: ${status.failedBooks.map((book) => `${book.book}: ${book.error ?? "failed"}`).join("; ") || "none"}`,
      `- LLM attempted verses: ${attempted}`,
      `- LLM prompt tokens: ${usage.promptTokens}`,
      `- LLM completion tokens: ${usage.completionTokens}`,
      `- LLM total token count: ${usage.totalTokens}`,
      `- estimated uncached LLM cost: $${estimateCost(usage).toFixed(4)} using DeepSeek V4 Flash at $${DEEPSEEK_V4_FLASH_PRICING.inputUsdPerMillion}/1M input and $${DEEPSEEK_V4_FLASH_PRICING.outputUsdPerMillion}/1M output tokens`,
      `- review items: ${manifest.itemCount}`,
      `- auto accepted items: ${manifest.autoAcceptedCount}`,
      `- pending items in manifest: ${manifest.pendingCount}`
    );
  } else {
    lines.push(
      "- missing LLM review manifest; run the 66-book bounded review command from the goal."
    );
  }

  lines.push("", "## Decision Counts", "");
  for (const decision of DECISION_ORDER) {
    lines.push(`- ${decision}: ${status.decisionCounts[decision] ?? 0}`);
  }
  for (const [decision, count] of Object.entries(
    status.decisionCounts
  ).sort()) {
    if (!DECISION_ORDER.includes(decision as ReviewDecision)) {
      lines.push(`- ${decision}: ${count}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function printStatus(statuses: BibleStatus[]): void {
  for (const status of statuses) {
    const metrics = status.metrics;
    console.log(
      [
        status.bible,
        `bible=${status.bibleExists ? "ok" : "missing"}`,
        `metrics=${metrics ? "ok" : "missing"}`,
        `manifest=${status.manifest ? `${status.completedBookCount}/66` : "missing"}`,
        `failed=${status.failedBooks.length}`,
        `pendingHuman=${status.decisionCounts["pending-human"] ?? 0}`,
        metrics ? `coverage=${formatRatio(metrics.taggedTokenCoverage)}` : ""
      ]
        .filter(Boolean)
        .join(" ")
    );
  }
}

function countDecisions(items: ReviewItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item.decision] = (counts[item.decision] ?? 0) + 1;
  }
  return counts;
}

function getLlmUsage(status: BibleStatus): {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
} {
  const usage = emptyUsage();
  for (const review of status.manifest?.reviews ?? []) {
    const metrics = readJsonIfExists<BookMetrics>(review.metricsPath);
    usage.promptTokens += metrics?.llmPromptTokenCount ?? 0;
    usage.completionTokens += metrics?.llmCompletionTokenCount ?? 0;
    usage.totalTokens +=
      metrics?.llmTotalTokenCount ?? review.llmTotalTokenCount;
  }
  return usage;
}

function emptyUsage(): {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
} {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
}

function addUsage(
  left: ReturnType<typeof emptyUsage>,
  right: ReturnType<typeof emptyUsage>
): ReturnType<typeof emptyUsage> {
  return {
    promptTokens: left.promptTokens + right.promptTokens,
    completionTokens: left.completionTokens + right.completionTokens,
    totalTokens: left.totalTokens + right.totalTokens
  };
}

function estimateCost(usage: ReturnType<typeof emptyUsage>): number {
  return (
    (usage.promptTokens / 1_000_000) *
      DEEPSEEK_V4_FLASH_PRICING.inputUsdPerMillion +
    (usage.completionTokens / 1_000_000) *
      DEEPSEEK_V4_FLASH_PRICING.outputUsdPerMillion
  );
}

function appendNote(current: string | undefined, note: string): string {
  return current ? `${current} ${note}` : note;
}

function formatRatio(value: number | undefined): string {
  return value === undefined ? "missing" : `${(value * 100).toFixed(2)}%`;
}

function readJsonIfExists<T>(filePath: string): T | undefined {
  if (!existsSync(filePath)) return undefined;
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

await main();
