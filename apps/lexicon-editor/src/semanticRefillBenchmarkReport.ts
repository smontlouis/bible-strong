import { statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  type SemanticRefillLlmCandidatePacket,
  type SemanticRefillLlmRawDecision
} from "./semanticRefillLlm.js";
import { type SemanticRefillDecision } from "./semanticRefill.js";

interface AgentPacketFile {
  bible: string;
  scope: string;
  summary?: {
    verses: number;
    candidates: number;
    topStrong?: Array<[string, number]>;
  };
  candidates: SemanticRefillLlmCandidatePacket[];
}

interface AgentReviewFile {
  bible: string;
  scope: string;
  model?: string;
  sourcePacket?: string;
  parseError?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  decisions?: SemanticRefillLlmRawDecision[];
}

type MetricsFile = Record<string, unknown> & {
  books?: Record<string, Record<string, unknown>>;
};

interface BenchmarkSummary {
  generatedAt: string;
  bible: string;
  scope: string;
  model: string | null;
  packet: {
    path: string;
    bytes: number;
    verses: number;
    candidates: number;
    topStrong: Array<[string, number]>;
  };
  review: {
    path: string;
    rawDecisionCount: number;
    missingDecisionCount: number;
    byDecision: Record<string, number>;
    parseError?: string;
    usage?: AgentReviewFile["usage"];
  };
  validation: {
    dir: string;
    acceptedCount: number;
    pendingCount: number;
    rejectedCount: number;
    acceptedByTarget: Record<string, number>;
    visibleHighConfidenceCount: number;
    visibleLowConfidenceCount: number;
    emptyCount: number;
    fallbackEmptyCount: number;
    rejectedReasons: Record<string, number>;
  };
  applied?: {
    dir: string;
    validatedCount: number;
    acceptedCount: number;
    validatedByTarget: Record<string, number>;
  };
  metricsDelta?: Array<{
    metric: string;
    before: number | null;
    after: number | null;
    delta: number | null;
  }>;
  notableVisibleHighConfidence: Array<{
    ref: string;
    strong: string[];
    target: string;
    wordIndex: number;
    normalized: string;
    confidence: number;
  }>;
}

const DEFAULT_METRIC_KEYS = [
  "readerVisibleStrongCount",
  "advancedStrongCount",
  "emptyStrongCount",
  "phraseStrongCount",
  "referenceStrongCarrierCoverage",
  "originalStrongCarrierRate",
  "semanticMissingCount",
  "readerMultiStrongWordCount",
  "placementRiskCount",
  "placementQuality",
  "readerTaggedTokenCount",
  "advancedTaggedTokenCount",
  "readerTokenCoverage",
  "advancedTokenCoverage"
];

async function buildBenchmarkReport(options: {
  packetPath: string;
  reviewPath: string;
  validationDir: string;
  appliedDir?: string;
  beforeMetricsPath?: string;
  afterMetricsPath?: string;
  metricsScope?: string;
  outputJsonPath: string;
  outputMarkdownPath: string;
}): Promise<BenchmarkSummary> {
  const packet = await readJson<AgentPacketFile>(options.packetPath);
  const review = await readJson<AgentReviewFile>(options.reviewPath);
  const accepted = await readJson<SemanticRefillDecision[]>(
    path.join(options.validationDir, "accepted.json")
  );
  const pending = await readJson<unknown[]>(
    path.join(options.validationDir, "pending.json")
  );
  const rejected = await readJson<Array<{ reason?: string }>>(
    path.join(options.validationDir, "rejected.json")
  );
  const appliedAccepted = options.appliedDir
    ? await readJson<SemanticRefillDecision[]>(
        path.join(options.appliedDir, "accepted.json")
      )
    : undefined;
  const application = options.appliedDir
    ? await readJson<{
        validatedCount: number;
        appliedOverrideCount: number;
      }>(path.join(options.appliedDir, "application.json"))
    : undefined;

  const summary: BenchmarkSummary = {
    generatedAt: new Date().toISOString(),
    bible: packet.bible,
    scope: packet.scope,
    model: review.model ?? null,
    packet: {
      path: options.packetPath,
      bytes: statSync(options.packetPath).size,
      verses: packet.summary?.verses ?? countRefs(packet.candidates),
      candidates: packet.summary?.candidates ?? packet.candidates.length,
      topStrong: packet.summary?.topStrong ?? topStrong(packet.candidates)
    },
    review: {
      path: options.reviewPath,
      rawDecisionCount: review.decisions?.length ?? 0,
      missingDecisionCount: Math.max(
        0,
        (packet.summary?.candidates ?? packet.candidates.length) -
          (review.decisions?.length ?? 0)
      ),
      byDecision: countBy(review.decisions ?? [], (decision) =>
        String(decision.decision)
      ),
      parseError: review.parseError,
      usage: review.usage
    },
    validation: {
      dir: options.validationDir,
      acceptedCount: accepted.length,
      pendingCount: pending.length,
      rejectedCount: rejected.length,
      acceptedByTarget: countBy(accepted, decisionTarget),
      visibleHighConfidenceCount: accepted.filter(isVisibleHighConfidence)
        .length,
      visibleLowConfidenceCount: accepted.filter(isVisibleLowConfidence).length,
      emptyCount: accepted.filter((decision) => decision.target === "empty")
        .length,
      fallbackEmptyCount: accepted.filter((decision) =>
        decision.reason.includes("reference-style-empty-fallback")
      ).length,
      rejectedReasons: countBy(rejected, (item) => item.reason ?? "unknown")
    },
    applied:
      appliedAccepted && application
        ? {
            dir: options.appliedDir ?? "",
            validatedCount: application.validatedCount,
            acceptedCount: application.appliedOverrideCount,
            validatedByTarget: countBy(appliedAccepted, decisionTarget)
          }
        : undefined,
    metricsDelta:
      options.beforeMetricsPath && options.afterMetricsPath
        ? await buildMetricsDelta({
            beforePath: options.beforeMetricsPath,
            afterPath: options.afterMetricsPath,
            scope: options.metricsScope ?? packet.scope
          })
        : undefined,
    notableVisibleHighConfidence: accepted
      .filter(isVisibleHighConfidence)
      .map((decision) => ({
        ref: decision.ref,
        strong: decision.strong,
        target: decisionTarget(decision),
        wordIndex: decision.wordIndex,
        normalized: decision.normalized,
        confidence: decision.confidence
      }))
  };

  await mkdir(path.dirname(options.outputJsonPath), { recursive: true });
  await Promise.all([
    writeFile(
      options.outputJsonPath,
      `${JSON.stringify(summary, null, 2)}\n`,
      "utf8"
    ),
    writeFile(options.outputMarkdownPath, renderMarkdown(summary), "utf8")
  ]);
  return summary;
}

async function buildMetricsDelta(options: {
  beforePath: string;
  afterPath: string;
  scope: string;
}): Promise<BenchmarkSummary["metricsDelta"]> {
  const before = selectMetrics(
    await readJson<MetricsFile>(options.beforePath),
    options.scope
  );
  const after = selectMetrics(
    await readJson<MetricsFile>(options.afterPath),
    options.scope
  );
  return DEFAULT_METRIC_KEYS.map((metric) => {
    const beforeValue = readNumber(before[metric]);
    const afterValue = readNumber(after[metric]);
    return {
      metric,
      before: beforeValue,
      after: afterValue,
      delta:
        beforeValue === null || afterValue === null
          ? null
          : Number((afterValue - beforeValue).toFixed(6))
    };
  });
}

function selectMetrics(
  metrics: MetricsFile,
  scope: string
): Record<string, unknown> {
  const book = scope.split(/[.-]/u)[0] ?? "";
  return metrics.books?.[book] ?? metrics;
}

function renderMarkdown(summary: BenchmarkSummary): string {
  const lines = [
    `# LLM Gap-Review Benchmark: ${summary.bible} ${summary.scope}`,
    "",
    `- generatedAt: \`${summary.generatedAt}\``,
    `- model: \`${summary.model ?? "unknown"}\``,
    `- packet: \`${summary.packet.path}\``,
    `- packet bytes: \`${summary.packet.bytes}\``,
    `- packet verses: \`${summary.packet.verses}\``,
    `- packet candidates: \`${summary.packet.candidates}\``,
    `- raw decisions: \`${summary.review.rawDecisionCount}\``,
    `- missing decisions: \`${summary.review.missingDecisionCount}\``,
    `- validated accepted: \`${summary.validation.acceptedCount}\``,
    `- validated pending: \`${summary.validation.pendingCount}\``,
    `- validated rejected: \`${summary.validation.rejectedCount}\``,
    `- visible high-confidence: \`${summary.validation.visibleHighConfidenceCount}\``,
    `- visible low-confidence: \`${summary.validation.visibleLowConfidenceCount}\``,
    `- empty accepted: \`${summary.validation.emptyCount}\``,
    `- fallback empty: \`${summary.validation.fallbackEmptyCount}\``
  ];

  if (summary.review.usage) {
    lines.push(
      `- prompt tokens: \`${summary.review.usage.promptTokens ?? "unknown"}\``,
      `- completion tokens: \`${summary.review.usage.completionTokens ?? "unknown"}\``,
      `- total tokens: \`${summary.review.usage.totalTokens ?? "unknown"}\``
    );
  }
  if (summary.review.parseError) {
    lines.push(`- parse error: \`${summary.review.parseError}\``);
  }
  if (summary.applied) {
    lines.push(
      `- validated for application: \`${summary.applied.validatedCount}\``,
      `- actual override mutations: \`${summary.applied.acceptedCount}\``
    );
  }

  lines.push(
    "",
    "## Decision Counts",
    "",
    "| bucket | count |",
    "| --- | ---: |"
  );
  for (const [bucket, count] of Object.entries(summary.review.byDecision)) {
    lines.push(`| raw:${bucket} | ${count} |`);
  }
  for (const [bucket, count] of Object.entries(
    summary.validation.acceptedByTarget
  )) {
    lines.push(`| accepted:${bucket} | ${count} |`);
  }
  for (const [reason, count] of Object.entries(
    summary.validation.rejectedReasons
  )) {
    lines.push(`| rejected:${reason} | ${count} |`);
  }

  lines.push("", "## Visible High-Confidence Decisions", "");
  if (summary.notableVisibleHighConfidence.length === 0) {
    lines.push("None.");
  } else {
    lines.push(
      "| ref | Strong | target | wordIndex | normalized | confidence |"
    );
    lines.push("| --- | --- | --- | ---: | --- | ---: |");
    for (const decision of summary.notableVisibleHighConfidence) {
      lines.push(
        `| ${decision.ref} | ${decision.strong.join(", ")} | ${decision.target} | ${decision.wordIndex} | ${decision.normalized} | ${decision.confidence} |`
      );
    }
  }

  if (summary.metricsDelta) {
    lines.push("", "## Metrics Delta", "");
    lines.push("| metric | before | after | delta |");
    lines.push("| --- | ---: | ---: | ---: |");
    for (const row of summary.metricsDelta) {
      lines.push(
        `| ${row.metric} | ${formatMetric(row.before)} | ${formatMetric(row.after)} | ${formatMetric(row.delta)} |`
      );
    }
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

function decisionTarget(decision: SemanticRefillDecision): string {
  return decision.target ?? "word";
}

function isVisibleHighConfidence(decision: SemanticRefillDecision): boolean {
  return (
    decisionTarget(decision) !== "empty" &&
    decision.confidence >= 0.84 &&
    !decision.reason.includes("reference-style-empty-fallback")
  );
}

function isVisibleLowConfidence(decision: SemanticRefillDecision): boolean {
  return (
    decisionTarget(decision) !== "empty" &&
    decision.confidence < 0.84 &&
    !decision.reason.includes("reference-style-empty-fallback")
  );
}

function countRefs(candidates: SemanticRefillLlmCandidatePacket[]): number {
  return new Set(candidates.map((candidate) => candidate.ref)).size;
}

function topStrong(
  candidates: SemanticRefillLlmCandidatePacket[]
): Array<[string, number]> {
  return Object.entries(countBy(candidates, (candidate) => candidate.strong))
    .sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0])
    )
    .slice(0, 30);
}

function countBy<T>(
  values: T[],
  keyFor: (value: T) => string
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) {
    const key = keyFor(value);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatMetric(value: number | null): string {
  return value === null ? "" : String(value);
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

function parseArgs(argv: string[]): Map<string, string | boolean> {
  const args = new Map<string, string | boolean>();
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args.set(key, true);
      continue;
    }
    args.set(key, next);
    index += 1;
  }
  return args;
}

function readStringArg(
  args: Map<string, string | boolean>,
  name: string,
  fallback: string
): string {
  const value = args.get(name);
  return typeof value === "string" ? value : fallback;
}

function readOptionalStringArg(
  args: Map<string, string | boolean>,
  name: string
): string | undefined {
  const value = args.get(name);
  return typeof value === "string" ? value : undefined;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const outputJsonPath = readStringArg(
    args,
    "output-json",
    "outputs/gap-review/nbs/benchmark-summary.json"
  );
  const outputMarkdownPath = readStringArg(
    args,
    "output-md",
    outputJsonPath.replace(/\.json$/u, ".md")
  );
  const summary = await buildBenchmarkReport({
    packetPath: readStringArg(args, "packet", ""),
    reviewPath: readStringArg(args, "review", ""),
    validationDir: readStringArg(args, "validation-dir", ""),
    appliedDir: readOptionalStringArg(args, "applied-dir"),
    beforeMetricsPath: readOptionalStringArg(args, "before-metrics"),
    afterMetricsPath: readOptionalStringArg(args, "after-metrics"),
    metricsScope: readOptionalStringArg(args, "metrics-scope"),
    outputJsonPath,
    outputMarkdownPath
  });

  console.log(
    JSON.stringify(
      {
        outputJson: outputJsonPath,
        outputMarkdown: outputMarkdownPath,
        bible: summary.bible,
        scope: summary.scope,
        model: summary.model,
        candidates: summary.packet.candidates,
        rawDecisions: summary.review.rawDecisionCount,
        accepted: summary.validation.acceptedCount,
        visibleHighConfidence: summary.validation.visibleHighConfidenceCount
      },
      null,
      2
    )
  );
}

if (process.argv[1]?.endsWith("semanticRefillBenchmarkReport.ts")) {
  await main();
}
