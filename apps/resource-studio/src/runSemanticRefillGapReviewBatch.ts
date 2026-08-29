import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import {
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import { BOOK_IDS } from "./books.js";
import {
  cacheRecordIsCurrent,
  cacheRecordMatches,
  contentFingerprint,
  directoryCacheMetadataPath,
  fileCacheMetadataPath,
  writeCacheRecord
} from "./contentAddressedCache.js";
import { withReviewFileLock } from "./reviewFileLock.js";
import {
  beginReviewTransaction,
  commitReviewTransaction,
  DEFAULT_REVIEW_TRANSACTION_MARKER,
  markReviewTransactionPhase,
  recoverReviewTransaction,
  rollbackReviewTransaction,
  type ReviewTransactionRecovery
} from "./reviewTransaction.js";

type CandidateConfidence = "high" | "medium" | "low";

interface LexicalCandidate {
  target: "word" | "phrase";
  confidence: CandidateConfidence;
  occupied: boolean;
  [key: string]: unknown;
}

interface LexicalCandidateItem {
  annotationId?: string;
  ref: string;
  strong: string;
  auditKind: "empty" | "relocation";
  candidates: LexicalCandidate[];
  [key: string]: unknown;
}

interface LexicalCandidateReport {
  bible: string;
  metrics?: {
    autoSafeItems?: number;
    groupAutoSafeItems?: number;
    openHighItems?: number;
    reviewableCandidates?: number;
  };
  items: LexicalCandidateItem[];
}

interface AgentPacketFile {
  bible: string;
  scope: string;
  summary?: {
    selectedItems?: number;
    candidates?: number;
    verses?: number;
    topStrong?: Array<[string, number]>;
    [key: string]: unknown;
  };
  verses?: Array<{ ref: string; [key: string]: unknown }>;
  candidates: AgentPacketCandidate[];
  [key: string]: unknown;
}

interface AgentPacketCandidate {
  id: string;
  ref: string;
  strong: string;
  choices?: Array<{ id: string; decision: string }>;
  [key: string]: unknown;
}

interface AgentReviewDecision {
  id: string;
  choiceId: string;
  ref: string;
  decision: string;
  strong: string[];
  confidence: number;
  reason?: string;
  wordIndex?: number | null;
  normalized?: string | null;
  startWordIndex?: number | null;
  endWordIndex?: number | null;
  normalizedPhrase?: string[] | null;
  evidence?: string[];
  [key: string]: unknown;
}

interface ValidatedReviewDecision {
  ref?: string;
  strong?: string[];
  confidence?: number;
  target?: string;
  wordIndex?: number;
  normalized?: string;
  startWordIndex?: number;
  endWordIndex?: number;
  normalizedPhrase?: string[] | string;
}

interface AgentReviewFile {
  bible?: string;
  books?: string[];
  scope?: string;
  generatedAt?: string;
  sourcePacket?: string;
  model?: string;
  rawContent?: string;
  decisions?: AgentReviewDecision[];
  parseError?: unknown;
  contract?: {
    version?: unknown;
    schemaName?: unknown;
    candidateCount?: unknown;
  };
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

interface ValidationSummary {
  accepted: number;
  pending: number;
  rejected: number;
}

interface LedgerQualityGateMetrics {
  verseCount?: number;
  placementRiskCount?: number;
  originalRepresentationRate?: number;
  referenceStrongCoverage?: number;
}

interface FilterReport {
  counts: {
    input: number;
    acceptedSafe: number;
    needsWitnessReview: number;
    rejectedRisky: number;
  };
}

interface BatchTask {
  id: string;
  scope: string;
  book: string;
  chapters: string[];
  offset: number;
  itemCount: number;
  itemIds: string[];
}

interface TaskResult {
  id: string;
  scope: string;
  status: "completed" | "skipped" | "failed";
  packetPath: string;
  candidateCount: number;
  consensusCount: number;
  acceptedSafe: number;
  needsWitnessReview: number;
  rejectedRisky: number;
  applied: number;
  error?: string;
}

interface BatchManifest {
  generatedAt: string;
  bible: string;
  lexicalReport: string;
  outputRoot: string;
  runFingerprint: string;
  ledgerFingerprintAfter: string;
  policy: {
    minConfidence: CandidateConfidence;
    maxItemsPerTask: number;
    taskBatchSize: number;
    llmAttempts: number;
    models: string[];
    adaptiveSecondModel: boolean;
  };
  lexicalMetrics?: LexicalCandidateReport["metrics"];
  totals: {
    tasks: number;
    completed: number;
    skipped: number;
    failed: number;
    candidates: number;
    consensus: number;
    acceptedSafe: number;
    applied: number;
    needsWitnessReview: number;
    rejectedRisky: number;
  };
  tasks: TaskResult[];
}

interface BatchPlan {
  generatedAt: string;
  bible: string;
  lexicalReport: string;
  outputRoot: string;
  runFingerprint: string;
  ledgerFingerprintAtPlan: string;
  policy: BatchManifest["policy"];
  lexicalMetrics?: LexicalCandidateReport["metrics"];
  totals: { tasks: number };
  tasks: BatchTask[];
}

interface CliOptions {
  bible: string;
  lexicalReportPath: string;
  outputRoot: string;
  maxItemsPerTask: number;
  taskBatchSize: number;
  minConfidence: CandidateConfidence;
  leftModel: string;
  rightModel: string;
  timeoutMs: number;
  llmAttempts: number;
  skipExisting: boolean;
  dryRun: boolean;
  planOnly: boolean;
  allowResidualAutoSafe: boolean;
  adaptiveSecondModel: boolean;
  runFingerprint?: string;
  ledgerFingerprint?: string;
  forceDecisionReplay?: boolean;
}

const DEFAULT_LEFT_MODEL = "openai/gpt-5.4-mini";
const DEFAULT_RIGHT_MODEL = "deepseek/deepseek-v4-flash";
const BATCH_CACHE_VERSION = "semantic-refill-batch-v6";
const BOOK_ORDER = new Map<string, number>(
  BOOK_IDS.map((book, index) => [book, index])
);
let serializedCommandChain: Promise<void> = Promise.resolve();

export async function runBatchStartupRecovery(options: {
  withLock: (
    operation: () => Promise<ReviewTransactionRecovery>
  ) => Promise<ReviewTransactionRecovery>;
  recover: () => Promise<ReviewTransactionRecovery>;
}): Promise<ReviewTransactionRecovery> {
  return options.withLock(options.recover);
}

async function runBatch(
  options: CliOptions
): Promise<BatchManifest | BatchPlan> {
  await runBatchStartupRecovery({
    withLock: (operation) =>
      withReviewFileLock(operation, {
        timeoutMs: 10 * 60_000,
        staleAfterMs: 60 * 60_000
      }),
    recover: () =>
      recoverReviewTransaction({
        refresh: (target) => refreshReviewTransactionTarget(target, options)
      })
  });
  assertValidBatchLimits(options);
  assertDistinctBatchModels(options.leftModel, options.rightModel);
  const report = await readJson<LexicalCandidateReport>(
    options.lexicalReportPath
  );
  const autoSafeItems =
    (report.metrics?.autoSafeItems ?? 0) +
    (report.metrics?.groupAutoSafeItems ?? 0);
  if (autoSafeItems > 0 && !options.allowResidualAutoSafe) {
    throw new Error(
      `residual-autosafe-items:${autoSafeItems}. Run strong:generate before LLM batch.`
    );
  }

  await mkdir(options.outputRoot, { recursive: true });
  const tasks = buildTasks(report, options);
  const existingManifest = options.skipExisting
    ? readExistingManifest(options.outputRoot)
    : undefined;
  options.runFingerprint = fingerprintBatchRun(options);
  options.ledgerFingerprint = fingerprintLedgerState(options);
  options.forceDecisionReplay = durableDecisionReplayRequired({
    skipExisting: options.skipExisting,
    manifestRunFingerprint: existingManifest?.runFingerprint,
    manifestStateFingerprint: existingManifest?.ledgerFingerprintAfter,
    currentRunFingerprint: options.runFingerprint,
    currentStateFingerprint: options.ledgerFingerprint
  });
  const previousResults =
    existingManifest?.runFingerprint === options.runFingerprint &&
    existingManifest.ledgerFingerprintAfter === options.ledgerFingerprint
      ? existingManifest.tasks
      : [];
  const results: TaskResult[] = [];
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const previousById = new Map(
    previousResults
      .filter((item) => {
        if (item.status !== "completed") return false;
        const task = tasksById.get(item.id);
        return task ? previousResultIsReusable(task, item, options) : false;
      })
      .map((item) => [item.id, item])
  );

  if (options.planOnly) {
    return writePlan(options, report, tasks);
  }

  for (const taskBatch of chunk(tasks, options.taskBatchSize)) {
    const activeTasks = taskBatch.filter((task) => {
      const previous = previousById.get(task.id);
      if (!previous) return true;
      results.push(previous);
      return false;
    });
    if (activeTasks.length === 0) {
      await writeManifest(options, report, tasks, results);
      continue;
    }

    const prepared = await Promise.all(
      activeTasks.map((task) => prepareFilteredReview(task, options, report))
    );
    for (const item of prepared) {
      let result: TaskResult;
      if (!item.ok) {
        result = item.result;
      } else {
        try {
          result = await applyFilteredReview(
            item.task,
            item.artifacts,
            options
          );
        } catch (error) {
          result = await applyFailureResult(item.task, item.artifacts, error);
        }
      }
      results.push(result);
      await writeManifest(options, report, tasks, results);
    }
  }

  const manifest = await writeManifest(options, report, tasks, results);
  assertBatchSucceeded(manifest);
  return manifest;
}

export function buildTasks(
  report: LexicalCandidateReport,
  options: CliOptions
): BatchTask[] {
  assertPositiveInteger("maxItemsPerTask", options.maxItemsPerTask);
  const byChapter = new Map<string, LexicalCandidateItem[]>();
  for (const item of report.items) {
    if (!hasOpenCandidateAtConfidence(item, options.minConfidence)) continue;
    const parsed = parseRef(item.ref);
    if (!parsed) continue;
    const key = `${parsed.book}.${parsed.chapter}`;
    byChapter.set(key, [...(byChapter.get(key) ?? []), item]);
  }

  const chapters = [...byChapter.entries()].sort(([left], [right]) =>
    compareScope(left, right)
  );
  const byBook = new Map<string, Array<[string, LexicalCandidateItem[]]>>();
  for (const [scope, items] of chapters) {
    const parsed = parseScope(scope);
    if (!parsed) continue;
    byBook.set(parsed.book, [
      ...(byBook.get(parsed.book) ?? []),
      [scope, items]
    ]);
  }

  const tasks: BatchTask[] = [];
  for (const book of BOOK_IDS) {
    const bookChapters = byBook.get(book) ?? [];
    let current: Array<[string, LexicalCandidateItem[]]> = [];
    let count = 0;
    const flush = (): void => {
      if (current.length === 0) return;
      const scopes = current.map(([scope]) => scope);
      const itemCount = current.reduce(
        (sum, [, items]) => sum + items.length,
        0
      );
      const itemIds = current.flatMap(([, items]) =>
        items.map(lexicalItemIdentity)
      );
      const scope = scopes.join(",");
      const offset = 0;
      tasks.push({
        id: stableTaskId(book, scope, itemIds),
        scope,
        book,
        chapters: scopes,
        offset,
        itemCount,
        itemIds
      });
      current = [];
      count = 0;
    };

    for (const chapter of bookChapters) {
      const chapterCount = chapter[1].length;
      if (chapterCount > options.maxItemsPerTask) {
        flush();
        for (const items of chunk(chapter[1], options.maxItemsPerTask)) {
          const itemIds = items.map(lexicalItemIdentity);
          tasks.push({
            id: stableTaskId(book, chapter[0], itemIds),
            scope: chapter[0],
            book,
            chapters: [chapter[0]],
            offset: 0,
            itemCount: items.length,
            itemIds
          });
        }
        continue;
      }
      if (
        current.length > 0 &&
        count + chapterCount > options.maxItemsPerTask
      ) {
        flush();
      }
      current.push(chapter);
      count += chapterCount;
    }
    flush();
  }

  return tasks;
}

export function lexicalItemIdentity(item: LexicalCandidateItem): string {
  if (item.annotationId) {
    return `${item.ref}|${item.annotationId}|${item.auditKind}|${item.strong.toUpperCase()}`;
  }
  const fallback = JSON.stringify({
    ref: item.ref,
    strong: item.strong.toUpperCase(),
    auditKind: item.auditKind,
    insertAfterWordIndex: item.insertAfterWordIndex ?? null,
    currentTarget: item.currentTarget ?? null,
    candidates: item.candidates.map((candidate) => ({
      target: candidate.target,
      wordIndex: candidate.wordIndex ?? null,
      startWordIndex: candidate.startWordIndex ?? null,
      endWordIndex: candidate.endWordIndex ?? null
    }))
  });
  return `${item.ref}|fallback:${createHash("sha256")
    .update(fallback)
    .digest("hex")
    .slice(0, 20)}`;
}

export function selectTaskLexicalItems(
  report: LexicalCandidateReport,
  task: BatchTask
): LexicalCandidateItem[] {
  const byId = new Map(
    report.items.map((item) => [lexicalItemIdentity(item), item])
  );
  const selected = task.itemIds.map((id) => byId.get(id));
  const missing = task.itemIds.filter((_, index) => !selected[index]);
  if (missing.length > 0) {
    throw new Error(
      `task-lexical-items-missing:${task.id}:${missing.join(",")}`
    );
  }
  return selected.filter((item): item is LexicalCandidateItem => !!item);
}

function hasOpenCandidateAtConfidence(
  item: LexicalCandidateItem,
  minConfidence: CandidateConfidence
): boolean {
  return item.candidates.some(
    (candidate) =>
      confidenceRank(candidate.confidence) >= confidenceRank(minConfidence) &&
      !candidate.occupied
  );
}

async function prepareFilteredReview(
  task: BatchTask,
  options: CliOptions,
  report: LexicalCandidateReport
): Promise<
  | {
      ok: true;
      task: BatchTask;
      artifacts: ReturnType<typeof artifactPaths>;
    }
  | { ok: false; result: TaskResult }
> {
  const artifacts = artifactPaths(task, options);
  try {
    await mkdir(path.dirname(artifacts.packet), { recursive: true });
    await mkdir(path.dirname(artifacts.leftReview), { recursive: true });
    await mkdir(path.dirname(artifacts.filterReportJson), { recursive: true });

    const taskReportFingerprint = fingerprintTaskLexicalReport(task, options);
    if (
      !options.skipExisting ||
      !fileArtifactIsReusable(
        artifacts.taskLexicalReport,
        taskReportFingerprint
      )
    ) {
      await writeJson(artifacts.taskLexicalReport, {
        ...report,
        scope: task.scope,
        items: selectTaskLexicalItems(report, task)
      });
      await markFileArtifact(
        artifacts.taskLexicalReport,
        taskReportFingerprint
      );
    }

    const packetFingerprint = fingerprintPacket(
      task,
      options,
      artifacts.taskLexicalReport
    );
    if (
      !options.skipExisting ||
      !fileArtifactIsReusable(artifacts.packet, packetFingerprint)
    ) {
      await runSerialized(() =>
        runNpm(
          [
            "run",
            "strong:review:gaps:lexical-packet",
            "--",
            "--bible",
            options.bible,
            "--only",
            task.scope,
            "--lexical-report",
            artifacts.taskLexicalReport,
            "--output",
            artifacts.packet,
            "--limit",
            String(task.itemCount),
            "--offset",
            "0",
            "--min-confidence",
            options.minConfidence
          ],
          options
        )
      );
      await markFileArtifact(artifacts.packet, packetFingerprint);
    }

    const packet = await readJson<AgentPacketFile>(artifacts.packet);
    if (packet.candidates.length === 0) {
      return {
        ok: false,
        result: emptyResult(task, artifacts.packet, "skipped", "empty-packet")
      };
    }

    await runLlmIfNeeded({
      input: artifacts.packet,
      output: artifacts.leftReview,
      model: options.leftModel,
      options
    });

    await validateIfNeeded({
      input: artifacts.leftReview,
      outputDir: artifacts.leftValidation,
      options,
      referenceStyle: true,
      recordDecisions: true
    });
    if (options.adaptiveSecondModel) {
      await runAdaptiveSecondModel({
        packet,
        artifacts,
        options,
        minConfidence: 0.84
      });
    } else {
      await runLlmIfNeeded({
        input: artifacts.packet,
        output: artifacts.rightReview,
        model: options.rightModel,
        options
      });
    }
    await validateIfNeeded({
      input: artifacts.rightReview,
      outputDir: artifacts.rightValidation,
      options,
      referenceStyle: true,
      recordDecisions: true
    });

    const consensusFingerprint = fingerprintConsensus(artifacts, options);
    if (
      !options.skipExisting ||
      !fileArtifactIsReusable(artifacts.consensusReview, consensusFingerprint)
    ) {
      await runNpm(
        [
          "run",
          "strong:review:gaps:consensus",
          "--",
          "--left-review",
          artifacts.leftReview,
          "--right-review",
          artifacts.rightReview,
          "--left-validation-dir",
          artifacts.leftValidation,
          "--right-validation-dir",
          artifacts.rightValidation,
          "--output",
          artifacts.consensusReview,
          "--min-confidence",
          "0.84"
        ],
        options
      );
      await markFileArtifact(artifacts.consensusReview, consensusFingerprint);
    }

    await validateIfNeeded({
      input: artifacts.consensusReview,
      outputDir: artifacts.consensusValidation,
      options,
      referenceStyle: false,
      recordDecisions: true
    });

    const filterFingerprint = fingerprintFilter(artifacts, options);
    if (
      !options.skipExisting ||
      ![
        artifacts.filteredReview,
        artifacts.filterReportJson,
        artifacts.filterReportMd
      ].every((output) => fileArtifactIsReusable(output, filterFingerprint))
    ) {
      await runNpm(
        [
          "run",
          "strong:review:gaps:filter",
          "--",
          "--review",
          artifacts.consensusReview,
          "--output",
          artifacts.filteredReview,
          "--report-json",
          artifacts.filterReportJson,
          "--report-md",
          artifacts.filterReportMd
        ],
        options
      );
      await Promise.all([
        markFileArtifact(artifacts.filteredReview, filterFingerprint),
        markFileArtifact(artifacts.filterReportJson, filterFingerprint),
        markFileArtifact(artifacts.filterReportMd, filterFingerprint)
      ]);
    }

    await validateIfNeeded({
      input: artifacts.filteredReview,
      outputDir: artifacts.filteredValidation,
      options,
      referenceStyle: false,
      recordDecisions: true
    });

    return { ok: true, task, artifacts };
  } catch (error) {
    return {
      ok: false,
      result: emptyResult(
        task,
        artifacts.packet,
        "failed",
        error instanceof Error ? error.message : "unknown-error"
      )
    };
  }
}

async function applyFilteredReview(
  task: BatchTask,
  artifacts: ReturnType<typeof artifactPaths>,
  options: CliOptions
): Promise<TaskResult> {
  const packet = await readJson<AgentPacketFile>(artifacts.packet);
  const consensus = await readJson<AgentReviewFile>(artifacts.consensusReview);
  const filterReport = await readJson<FilterReport>(artifacts.filterReportJson);
  const validation = await validationSummary(artifacts.filteredValidation);

  if (options.dryRun || validation.accepted === 0) {
    return {
      id: task.id,
      scope: task.scope,
      status: "completed",
      packetPath: artifacts.packet,
      candidateCount: packet.candidates.length,
      consensusCount: consensus.decisions?.length ?? 0,
      acceptedSafe: filterReport.counts.acceptedSafe,
      needsWitnessReview: filterReport.counts.needsWitnessReview,
      rejectedRisky: filterReport.counts.rejectedRisky,
      applied: 0
    };
  }

  return withReviewFileLock(
    async () => {
      if (existsSync(DEFAULT_REVIEW_TRANSACTION_MARKER)) {
        const recovery = await recoverReviewTransaction({
          refresh: (target) => refreshReviewTransactionTarget(target, options)
        });
        if (recovery === "rolled-back") {
          options.ledgerFingerprint = fingerprintLedgerState(options);
        }
      }

      await mkdir(path.dirname(artifacts.beforeMetrics), { recursive: true });
      await copyFile(
        `outputs/strong/${options.bible}/bible-${options.bible}-strong-metrics.json`,
        artifacts.beforeMetrics
      );

      const overridesPath = "data/curated-strong-overrides.json";
      const decisionLedgerPath = "data/strong-review-decisions.json";
      let transaction = await beginReviewTransaction({
        bible: options.bible,
        scope: task.scope,
        files: [
          {
            role: "curated-overrides",
            filePath: overridesPath,
            backupPath: artifacts.overrideBackup
          },
          {
            role: "decision-ledger",
            filePath: decisionLedgerPath,
            backupPath: artifacts.decisionLedgerBackup
          }
        ]
      });

      try {
        await runNpm(
          [
            "run",
            "strong:review:gaps:apply",
            "--",
            "--bible",
            options.bible,
            "--ledger-dir",
            path.join("outputs", "strong", options.bible),
            "--input",
            artifacts.filteredReview,
            "--output-dir",
            artifacts.appliedDir,
            "--apply",
            "--lock-held"
          ],
          options
        );
        transaction = await markReviewTransactionPhase(transaction, "applied");
        const application = await readJson<{
          validatedCount: number;
          appliedOverrideCount: number;
        }>(path.join(artifacts.appliedDir, "application.json"));
        if (
          !Number.isInteger(application.appliedOverrideCount) ||
          application.appliedOverrideCount < 0
        ) {
          throw new Error("invalid-applied-override-count");
        }

        await refreshScope(task.scope, options);
        transaction = await markReviewTransactionPhase(
          transaction,
          "refreshed"
        );
        await assertPostApplyGates(artifacts.beforeMetrics, options);
        options.ledgerFingerprint = fingerprintLedgerState(options);

        await runNpm(
          [
            "run",
            "strong:review:gaps:report",
            "--",
            "--packet",
            artifacts.packet,
            "--review",
            artifacts.filteredReview,
            "--validation-dir",
            artifacts.filteredValidation,
            "--applied-dir",
            artifacts.appliedDir,
            "--before-metrics",
            artifacts.beforeMetrics,
            "--after-metrics",
            `outputs/strong/${options.bible}/bible-${options.bible}-strong-metrics.json`,
            "--metrics-scope",
            task.scope,
            "--output-json",
            artifacts.benchmarkJson,
            "--output-md",
            artifacts.benchmarkMd
          ],
          options
        );

        await commitReviewTransaction(transaction);

        return {
          id: task.id,
          scope: task.scope,
          status: "completed" as const,
          packetPath: artifacts.packet,
          candidateCount: packet.candidates.length,
          consensusCount: consensus.decisions?.length ?? 0,
          acceptedSafe: filterReport.counts.acceptedSafe,
          needsWitnessReview: filterReport.counts.needsWitnessReview,
          rejectedRisky: filterReport.counts.rejectedRisky,
          applied: application.appliedOverrideCount
        };
      } catch (error) {
        try {
          await rollbackReviewTransaction({
            refresh: (target) => refreshReviewTransactionTarget(target, options)
          });
          options.ledgerFingerprint = fingerprintLedgerState(options);
        } catch (rollbackError) {
          throw new Error(
            `post-apply-failed-and-rollback-refresh-failed:${errorMessage(error)}:${errorMessage(rollbackError)};override-backup=${artifacts.overrideBackup}`
          );
        }
        throw new Error(
          `post-apply-gate-failed-rolled-back:${errorMessage(error)}`
        );
      }
    },
    { timeoutMs: 10 * 60_000, staleAfterMs: 60 * 60_000 }
  );
}

async function refreshScope(scope: string, options: CliOptions): Promise<void> {
  await refreshReviewTransactionTarget(
    { bible: options.bible, scope },
    options
  );
}

async function refreshReviewTransactionTarget(
  target: { bible: string; scope: string },
  options: CliOptions
): Promise<void> {
  await runNpm(
    [
      "run",
      "strong:refresh",
      "--",
      "--bible",
      target.bible,
      "--only",
      target.scope
    ],
    options
  );
}

async function assertPostApplyGates(
  beforeMetricsPath: string,
  options: CliOptions
): Promise<void> {
  const metricsPath = `outputs/strong/${options.bible}/bible-${options.bible}-strong-metrics.json`;
  const before = await readJson<LedgerQualityGateMetrics>(beforeMetricsPath);
  const after = await readJson<LedgerQualityGateMetrics>(metricsPath);
  if (
    before.verseCount !== undefined &&
    after.verseCount !== before.verseCount
  ) {
    throw new Error(
      `verse-count-regression:${before.verseCount}->${after.verseCount}`
    );
  }
  if (
    before.placementRiskCount !== undefined &&
    after.placementRiskCount !== undefined &&
    after.placementRiskCount > before.placementRiskCount
  ) {
    throw new Error(
      `placement-risk-regression:${before.placementRiskCount}->${after.placementRiskCount}`
    );
  }
  for (const key of [
    "originalRepresentationRate",
    "referenceStrongCoverage"
  ] as const) {
    const beforeValue = before[key];
    const afterValue = after[key];
    if (
      beforeValue !== undefined &&
      afterValue !== undefined &&
      afterValue + 1e-12 < beforeValue
    ) {
      throw new Error(`${key}-regression:${beforeValue}->${afterValue}`);
    }
  }

  const sqlitePath = `outputs/strong/${options.bible}/bible-${options.bible}-strong.sqlite`;
  const integrity = await runCommand(
    "sqlite3",
    [sqlitePath, "pragma integrity_check;"],
    process.env
  );
  if (!integrity.split(/\s+/u).includes("ok")) {
    throw new Error(`sqlite-integrity-failed:${integrity.trim()}`);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function runLlmIfNeeded(options: {
  input: string;
  output: string;
  model: string;
  options: CliOptions;
}): Promise<void> {
  const fingerprint = fingerprintLlmReview(
    options.input,
    options.model,
    options.options
  );
  if (
    options.options.skipExisting &&
    reviewFileIsUsableForPacket(
      options.output,
      options.input,
      options.model,
      false
    ) &&
    !reviewFileIsAdaptiveScreen(options.output) &&
    fileArtifactIsReusable(options.output, fingerprint)
  )
    return;
  for (let attempt = 1; attempt <= options.options.llmAttempts; attempt += 1) {
    const attemptOutput = `${options.output}.attempt-${process.pid}-${attempt}-${Date.now()}`;
    await rm(attemptOutput, { force: true });
    let runError: unknown;
    try {
      await runNpm(
        [
          "run",
          "strong:review:gaps:llm",
          "--",
          "--input",
          options.input,
          "--output",
          attemptOutput,
          "--model",
          options.model
        ],
        options.options
      );
    } catch (error) {
      runError = error;
    }

    if (
      !runError &&
      reviewFileIsUsableForPacket(
        attemptOutput,
        options.input,
        options.model,
        false
      )
    ) {
      await rename(attemptOutput, options.output);
      await markFileArtifact(options.output, fingerprint);
      return;
    }
    await rm(attemptOutput, { force: true });

    if (attempt >= options.options.llmAttempts) {
      if (runError) throw runError;
      throw new Error(
        `unusable-llm-output:${options.model}:${path.basename(options.output)}`
      );
    }

    const message =
      runError instanceof Error ? runError.message : String(runError);
    console.error(
      `LLM attempt ${attempt}/${options.options.llmAttempts} produced unusable output for ${options.model} on ${path.basename(options.input)}; retrying: ${message.slice(-500)}`
    );
    await sleep(5000);
  }
}

export function hasConsensusEligibleVisible(
  accepted: Array<{ target?: string; confidence?: number }>,
  minConfidence: number
): boolean {
  return accepted.some(
    (decision) =>
      (decision.target ?? "word") !== "empty" &&
      (decision.confidence ?? 0) >= minConfidence
  );
}

export type AdaptiveSecondModelMode = "screen" | "subset" | "full";

export function adaptiveSecondModelMode(
  eligibleCandidateCount: number,
  candidateCount: number
): AdaptiveSecondModelMode {
  if (
    !Number.isInteger(eligibleCandidateCount) ||
    !Number.isInteger(candidateCount) ||
    eligibleCandidateCount < 0 ||
    candidateCount < 1 ||
    eligibleCandidateCount > candidateCount
  ) {
    throw new Error(
      `invalid-adaptive-candidate-count:${eligibleCandidateCount}/${candidateCount}`
    );
  }
  if (eligibleCandidateCount === 0) return "screen";
  if (eligibleCandidateCount === candidateCount) return "full";
  return "subset";
}

export function consensusEligibleCandidateIds(options: {
  packet: AgentPacketFile;
  review: AgentReviewFile;
  accepted: ValidatedReviewDecision[];
  minConfidence: number;
}): string[] {
  const rawById = new Map<string, AgentReviewDecision>();
  for (const decision of options.review.decisions ?? []) {
    if (rawById.has(decision.id)) continue;
    rawById.set(decision.id, decision);
  }
  const usedAccepted = new Set<number>();
  const eligible: string[] = [];

  for (const candidate of options.packet.candidates) {
    const raw = rawById.get(candidate.id);
    if (
      !raw ||
      (raw.decision !== "word" && raw.decision !== "phrase") ||
      raw.confidence < options.minConfidence ||
      raw.ref !== candidate.ref ||
      !sameStrongSequence(raw.strong, [candidate.strong]) ||
      !candidate.choices?.some(
        (choice) =>
          choice.id === raw.choiceId && choice.decision === raw.decision
      )
    ) {
      continue;
    }
    const acceptedIndex = options.accepted.findIndex(
      (accepted, index) =>
        !usedAccepted.has(index) &&
        (accepted.confidence ?? 0) >= options.minConfidence &&
        validatedDecisionMatchesRaw(accepted, raw)
    );
    if (acceptedIndex < 0) continue;
    usedAccepted.add(acceptedIndex);
    eligible.push(candidate.id);
  }
  return eligible;
}

export function deriveAdaptiveSecondModelPacket(
  packet: AgentPacketFile,
  eligibleCandidateIds: readonly string[]
): AgentPacketFile {
  const eligible = new Set(eligibleCandidateIds);
  if (eligible.size !== eligibleCandidateIds.length) {
    throw new Error("duplicate-adaptive-candidate-id");
  }
  const candidates = packet.candidates.filter((candidate) =>
    eligible.has(candidate.id)
  );
  if (candidates.length !== eligible.size) {
    const found = new Set(candidates.map((candidate) => candidate.id));
    const missing = [...eligible].filter((id) => !found.has(id));
    throw new Error(`unknown-adaptive-candidate-id:${missing.join(",")}`);
  }
  const refs = new Set(candidates.map((candidate) => candidate.ref));
  const verses = packet.verses?.filter((verse) => refs.has(verse.ref));
  const summary = packet.summary
    ? {
        ...packet.summary,
        selectedItems: candidates.length,
        candidates: candidates.length,
        verses: verses?.length ?? packet.summary.verses,
        topStrong: topStrongFromPacketCandidates(candidates)
      }
    : undefined;
  return {
    ...packet,
    ...(summary ? { summary } : {}),
    ...(verses ? { verses } : {}),
    candidates
  };
}

export function buildAdaptiveMergedReview(options: {
  packet: AgentPacketFile;
  packetPath: string;
  model: string;
  eligibleCandidateIds: readonly string[];
  subsetReview: AgentReviewFile;
  minConfidence: number;
}): AgentReviewFile {
  if (options.subsetReview.parseError) {
    throw new Error("adaptive-subset-review-has-parse-error");
  }
  const eligible = new Set(options.eligibleCandidateIds);
  const subsetDecisions = options.subsetReview.decisions ?? [];
  const subsetById = new Map<string, AgentReviewDecision>();
  for (const decision of subsetDecisions) {
    if (!eligible.has(decision.id)) {
      throw new Error(`unexpected-adaptive-subset-decision:${decision.id}`);
    }
    if (subsetById.has(decision.id)) {
      throw new Error(`duplicate-adaptive-subset-decision:${decision.id}`);
    }
    subsetById.set(decision.id, decision);
  }
  if (subsetById.size !== eligible.size) {
    const missing = [...eligible].filter((id) => !subsetById.has(id));
    throw new Error(`missing-adaptive-subset-decision:${missing.join(",")}`);
  }

  const decisions = options.packet.candidates.map((candidate) => {
    const subsetDecision = subsetById.get(candidate.id);
    if (subsetDecision) return subsetDecision;
    return adaptiveRejectDecision(
      candidate,
      `adaptive-second-model-screen: proposer A did not produce a validated visible decision at confidence >=${options.minConfidence}`
    );
  });
  const review: AgentReviewFile = {
    bible: options.packet.bible,
    books: [
      ...new Set(
        options.packet.candidates.map(
          (candidate) => candidate.ref.split(".")[0] ?? ""
        )
      )
    ].filter(Boolean),
    scope: options.packet.scope,
    generatedAt: options.subsetReview.generatedAt ?? new Date().toISOString(),
    sourcePacket: options.packetPath,
    model: options.model,
    rawContent: JSON.stringify({ decisions }),
    contract: {
      version: 2,
      schemaName:
        typeof options.subsetReview.contract?.schemaName === "string"
          ? options.subsetReview.contract.schemaName
          : "semantic_refill_llm_decisions",
      candidateCount: options.packet.candidates.length
    },
    usage: options.subsetReview.usage,
    decisions
  };
  return review;
}

async function runAdaptiveSecondModel(options: {
  packet: AgentPacketFile;
  artifacts: ReturnType<typeof artifactPaths>;
  options: CliOptions;
  minConfidence: number;
}): Promise<void> {
  const [leftReview, accepted] = await Promise.all([
    readJson<AgentReviewFile>(options.artifacts.leftReview),
    readJson<ValidatedReviewDecision[]>(
      path.join(options.artifacts.leftValidation, "accepted.json")
    )
  ]);
  const eligibleCandidateIds = consensusEligibleCandidateIds({
    packet: options.packet,
    review: leftReview,
    accepted,
    minConfidence: options.minConfidence
  });
  const mode = adaptiveSecondModelMode(
    eligibleCandidateIds.length,
    options.packet.candidates.length
  );

  if (mode === "screen") {
    await writeAdaptiveScreenReview({
      packetPath: options.artifacts.packet,
      outputPath: options.artifacts.rightReview,
      model: options.options.rightModel,
      fingerprint: fingerprintAdaptiveRightReview({
        artifacts: options.artifacts,
        options: options.options,
        mode,
        eligibleCandidateIds
      }),
      options: options.options
    });
    return;
  }
  if (mode === "full") {
    await runLlmIfNeeded({
      input: options.artifacts.packet,
      output: options.artifacts.rightReview,
      model: options.options.rightModel,
      options: options.options
    });
    return;
  }

  const derivedPacket = deriveAdaptiveSecondModelPacket(
    options.packet,
    eligibleCandidateIds
  );
  const derivedPacketFingerprint = fingerprintAdaptivePacket({
    artifacts: options.artifacts,
    options: options.options,
    eligibleCandidateIds
  });
  if (
    !options.options.skipExisting ||
    !fileArtifactIsReusable(
      options.artifacts.rightAdaptivePacket,
      derivedPacketFingerprint
    )
  ) {
    await writeJson(options.artifacts.rightAdaptivePacket, derivedPacket);
    await markFileArtifact(
      options.artifacts.rightAdaptivePacket,
      derivedPacketFingerprint
    );
  }
  await runLlmIfNeeded({
    input: options.artifacts.rightAdaptivePacket,
    output: options.artifacts.rightAdaptiveReview,
    model: options.options.rightModel,
    options: options.options
  });
  const mergedFingerprint = fingerprintAdaptiveRightReview({
    artifacts: options.artifacts,
    options: options.options,
    mode,
    eligibleCandidateIds,
    subsetReviewPath: options.artifacts.rightAdaptiveReview
  });
  if (
    options.options.skipExisting &&
    reviewFileIsUsableForPacket(
      options.artifacts.rightReview,
      options.artifacts.packet,
      options.options.rightModel
    ) &&
    fileArtifactIsReusable(options.artifacts.rightReview, mergedFingerprint)
  ) {
    return;
  }
  const subsetReview = await readJson<AgentReviewFile>(
    options.artifacts.rightAdaptiveReview
  );
  const merged = buildAdaptiveMergedReview({
    packet: options.packet,
    packetPath: options.artifacts.packet,
    model: options.options.rightModel,
    eligibleCandidateIds,
    subsetReview,
    minConfidence: options.minConfidence
  });
  await writeJson(options.artifacts.rightReview, merged);
  if (
    !reviewFileIsUsableForPacket(
      options.artifacts.rightReview,
      options.artifacts.packet,
      options.options.rightModel
    )
  ) {
    throw new Error(
      `invalid-adaptive-merged-review:${options.artifacts.rightReview}`
    );
  }
  await markFileArtifact(options.artifacts.rightReview, mergedFingerprint);
}

async function writeAdaptiveScreenReview(options: {
  packetPath: string;
  outputPath: string;
  model: string;
  fingerprint: string;
  options: CliOptions;
}): Promise<void> {
  if (
    options.options.skipExisting &&
    reviewFileIsUsableForPacket(
      options.outputPath,
      options.packetPath,
      options.model,
      true
    ) &&
    fileArtifactIsReusable(options.outputPath, options.fingerprint)
  ) {
    return;
  }
  const packet = await readJson<AgentPacketFile>(options.packetPath);
  const decisions = packet.candidates.map((candidate) =>
    adaptiveRejectDecision(
      candidate,
      "adaptive-second-model-screen: proposer A produced no visible consensus-eligible decision in this task"
    )
  );
  await writeJson(options.outputPath, {
    bible: packet.bible,
    books: [
      ...new Set(
        packet.candidates.map((candidate) => candidate.ref.split(".")[0])
      )
    ],
    scope: packet.scope,
    generatedAt: new Date().toISOString(),
    sourcePacket: options.packetPath,
    model: `adaptive-screen(${options.model})`,
    rawContent: JSON.stringify({ decisions }),
    contract: {
      version: 2,
      schemaName: "semantic_refill_llm_decisions",
      candidateCount: packet.candidates.length
    },
    decisions
  });
  if (
    !reviewFileIsUsableForPacket(
      options.outputPath,
      options.packetPath,
      options.model,
      true
    )
  ) {
    throw new Error(`invalid-adaptive-screen-review:${options.outputPath}`);
  }
  await markFileArtifact(options.outputPath, options.fingerprint);
}

function adaptiveRejectDecision(
  candidate: AgentPacketCandidate,
  reason: string
): AgentReviewDecision {
  const choice = candidate.choices?.find(
    (candidateChoice) => candidateChoice.decision === "reject"
  );
  if (!choice) {
    throw new Error(`adaptive-screen-reject-choice-missing:${candidate.id}`);
  }
  return {
    id: candidate.id,
    choiceId: choice.id,
    ref: candidate.ref,
    decision: "reject",
    strong: [candidate.strong],
    confidence: 1,
    reason,
    wordIndex: null,
    normalized: null,
    startWordIndex: null,
    endWordIndex: null,
    normalizedPhrase: null,
    evidence: ["deterministic-adaptive-screen"]
  };
}

function validatedDecisionMatchesRaw(
  accepted: ValidatedReviewDecision,
  raw: AgentReviewDecision
): boolean {
  if (
    accepted.ref !== raw.ref ||
    !sameStrongSequence(accepted.strong, raw.strong) ||
    (accepted.target ?? "word") !== raw.decision
  ) {
    return false;
  }
  if (raw.decision === "word") {
    return (
      raw.wordIndex !== null &&
      raw.wordIndex === accepted.wordIndex &&
      (accepted.normalized === undefined ||
        raw.normalized === accepted.normalized)
    );
  }
  if (raw.decision !== "phrase") return false;
  const acceptedPhrase = Array.isArray(accepted.normalizedPhrase)
    ? accepted.normalizedPhrase
    : typeof accepted.normalizedPhrase === "string"
      ? accepted.normalizedPhrase.split(" ")
      : undefined;
  return (
    raw.startWordIndex !== null &&
    raw.endWordIndex !== null &&
    raw.startWordIndex === accepted.startWordIndex &&
    raw.endWordIndex === accepted.endWordIndex &&
    (!acceptedPhrase ||
      sameNullableStringSequence(raw.normalizedPhrase, acceptedPhrase))
  );
}

function sameStrongSequence(
  left: string[] | undefined,
  right: string[] | undefined
): boolean {
  return (
    !!left &&
    !!right &&
    left.length === right.length &&
    left.every(
      (value, index) => value.toUpperCase() === right[index]?.toUpperCase()
    )
  );
}

function sameNullableStringSequence(
  left: string[] | null | undefined,
  right: string[] | null | undefined
): boolean {
  if (!left || !right) return left === right;
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function topStrongFromPacketCandidates(
  candidates: AgentPacketCandidate[]
): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const candidate of candidates) {
    counts.set(candidate.strong, (counts.get(candidate.strong) ?? 0) + 1);
  }
  return [...counts.entries()].sort(
    ([leftStrong, leftCount], [rightStrong, rightCount]) =>
      rightCount - leftCount || leftStrong.localeCompare(rightStrong)
  );
}

async function validateIfNeeded(options: {
  input: string;
  outputDir: string;
  options: CliOptions;
  referenceStyle: boolean;
  recordDecisions?: boolean;
}): Promise<void> {
  const fingerprint = fingerprintValidation(
    options.input,
    options.referenceStyle,
    options.options
  );
  if (
    options.options.skipExisting &&
    !(options.recordDecisions && options.options.forceDecisionReplay) &&
    validationOutputIsComplete(options.outputDir) &&
    directoryArtifactIsReusable(options.outputDir, fingerprint)
  ) {
    return;
  }
  const args = [
    "run",
    "strong:review:gaps:apply",
    "--",
    "--bible",
    options.options.bible,
    "--ledger-dir",
    path.join("outputs", "strong", options.options.bible),
    "--input",
    options.input,
    "--output-dir",
    options.outputDir
  ];
  if (options.referenceStyle) args.push("--finalize-reference-style");
  if (options.recordDecisions) args.push("--record-decisions");
  await runSerialized(() => runNpm(args, options.options));
  await markDirectoryArtifact(options.outputDir, fingerprint);
}

export function durableDecisionReplayRequired(options: {
  skipExisting: boolean;
  manifestRunFingerprint?: string;
  manifestStateFingerprint?: string;
  currentRunFingerprint: string;
  currentStateFingerprint: string;
}): boolean {
  if (!options.skipExisting) return false;
  return (
    options.manifestRunFingerprint !== options.currentRunFingerprint ||
    options.manifestStateFingerprint !== options.currentStateFingerprint
  );
}

function artifactPaths(task: BatchTask, options: CliOptions) {
  const slug = `${sanitize(task.scope).slice(0, 75)}-${sanitize(task.id).slice(-28)}`;
  const packet = path.join(
    options.outputRoot,
    "agent-packets",
    `agent-packet-${options.bible}-${slug}.json`
  );
  const reviewRoot = path.join(options.outputRoot, "agent-review");
  const reportRoot = path.join(options.outputRoot, "reports");
  const baselineRoot = path.join(options.outputRoot, "baseline");
  const base = `llm-review-${options.bible}-${slug}`;
  const left = `${base}-${modelSlug(options.leftModel)}`;
  const right = `${base}-${modelSlug(options.rightModel)}`;
  const consensus = `${base}-consensus-visible-high`;
  const filtered = `${consensus}-auto-filtered`;
  return {
    packet,
    taskLexicalReport: path.join(
      options.outputRoot,
      "task-inputs",
      `lexical-report-${options.bible}-${slug}.json`
    ),
    leftReview: path.join(reviewRoot, `${left}.json`),
    rightReview: path.join(reviewRoot, `${right}.json`),
    rightAdaptivePacket: path.join(
      path.dirname(packet),
      `${path.basename(packet, ".json")}-${modelSlug(options.rightModel)}-eligible.json`
    ),
    rightAdaptiveReview: path.join(reviewRoot, `${right}-eligible-subset.json`),
    leftValidation: path.join(reviewRoot, `${left}-validated`),
    rightValidation: path.join(reviewRoot, `${right}-validated`),
    consensusReview: path.join(reviewRoot, `${consensus}.json`),
    consensusValidation: path.join(reviewRoot, `${consensus}-validated`),
    filteredReview: path.join(reviewRoot, `${filtered}.json`),
    filterReportJson: path.join(reportRoot, `${filtered}-filter.json`),
    filterReportMd: path.join(reportRoot, `${filtered}-filter.md`),
    filteredValidation: path.join(
      reviewRoot,
      `${filtered}-validated-visible-only`
    ),
    appliedDir: path.join(reviewRoot, `${filtered}-applied`),
    beforeMetrics: path.join(
      baselineRoot,
      `bible-${options.bible}-strong-metrics-before-${slug}.json`
    ),
    overrideBackup: path.join(
      baselineRoot,
      `curated-strong-overrides-before-${slug}.json`
    ),
    decisionLedgerBackup: path.join(
      baselineRoot,
      `strong-review-decisions-before-${slug}.json`
    ),
    benchmarkJson: path.join(reportRoot, `${filtered}-applied.json`),
    benchmarkMd: path.join(reportRoot, `${filtered}-applied.md`)
  };
}

async function writeManifest(
  options: CliOptions,
  report: LexicalCandidateReport,
  tasks: BatchTask[],
  results: TaskResult[]
): Promise<BatchManifest> {
  // Model validation records decisions even before an override is applied.
  // Recompute the complete durable state at every checkpoint so a resumed run
  // cannot silently reuse tasks after either state file was removed or edited.
  options.ledgerFingerprint = fingerprintLedgerState(options);
  const manifest: BatchManifest = {
    generatedAt: new Date().toISOString(),
    bible: options.bible,
    lexicalReport: options.lexicalReportPath,
    outputRoot: options.outputRoot,
    runFingerprint: options.runFingerprint ?? fingerprintBatchRun(options),
    ledgerFingerprintAfter:
      options.ledgerFingerprint ?? fingerprintLedgerState(options),
    policy: {
      minConfidence: options.minConfidence,
      maxItemsPerTask: options.maxItemsPerTask,
      taskBatchSize: options.taskBatchSize,
      llmAttempts: options.llmAttempts,
      models: [options.leftModel, options.rightModel],
      adaptiveSecondModel: options.adaptiveSecondModel
    },
    lexicalMetrics: report.metrics,
    totals: summarizeResults(tasks, results),
    tasks: results
  };
  await writeJson(path.join(options.outputRoot, "manifest.json"), manifest);
  return manifest;
}

async function writePlan(
  options: CliOptions,
  report: LexicalCandidateReport,
  tasks: BatchTask[]
): Promise<BatchPlan> {
  options.ledgerFingerprint = fingerprintLedgerState(options);
  const plan: BatchPlan = {
    generatedAt: new Date().toISOString(),
    bible: options.bible,
    lexicalReport: options.lexicalReportPath,
    outputRoot: options.outputRoot,
    runFingerprint: options.runFingerprint ?? fingerprintBatchRun(options),
    ledgerFingerprintAtPlan: options.ledgerFingerprint,
    policy: {
      minConfidence: options.minConfidence,
      maxItemsPerTask: options.maxItemsPerTask,
      taskBatchSize: options.taskBatchSize,
      llmAttempts: options.llmAttempts,
      models: [options.leftModel, options.rightModel],
      adaptiveSecondModel: options.adaptiveSecondModel
    },
    lexicalMetrics: report.metrics,
    totals: { tasks: tasks.length },
    tasks
  };
  await writeJson(
    path.join(options.outputRoot, batchOutputFileName(true)),
    plan
  );
  return plan;
}

export function assertBatchSucceeded(manifest: {
  outputRoot: string;
  totals: { failed: number };
  tasks: Array<{ id: string; status: string }>;
}): void {
  if (manifest.totals.failed === 0) return;
  const failedIds = manifest.tasks
    .filter((task) => task.status === "failed")
    .map((task) => task.id)
    .join(",");
  throw new Error(
    `semantic-refill-batch-failed:${manifest.totals.failed};tasks=${failedIds};manifest=${path.join(manifest.outputRoot, batchOutputFileName(false))}`
  );
}

export function batchOutputFileName(planOnly: boolean): string {
  return planOnly ? "plan.json" : "manifest.json";
}

function summarizeResults(
  tasks: BatchTask[],
  results: TaskResult[]
): BatchManifest["totals"] {
  return {
    tasks: tasks.length,
    completed: results.filter((item) => item.status === "completed").length,
    skipped: results.filter((item) => item.status === "skipped").length,
    failed: results.filter((item) => item.status === "failed").length,
    candidates: sum(results, "candidateCount"),
    consensus: sum(results, "consensusCount"),
    acceptedSafe: sum(results, "acceptedSafe"),
    applied: sum(results, "applied"),
    needsWitnessReview: sum(results, "needsWitnessReview"),
    rejectedRisky: sum(results, "rejectedRisky")
  };
}

function emptyResult(
  task: BatchTask,
  packetPath: string,
  status: TaskResult["status"],
  error?: string
): TaskResult {
  return {
    id: task.id,
    scope: task.scope,
    status,
    packetPath,
    candidateCount: 0,
    consensusCount: 0,
    acceptedSafe: 0,
    needsWitnessReview: 0,
    rejectedRisky: 0,
    applied: 0,
    error
  };
}

async function applyFailureResult(
  task: BatchTask,
  artifacts: ReturnType<typeof artifactPaths>,
  error: unknown
): Promise<TaskResult> {
  const [packet, consensus, filterReport] = await Promise.all([
    readJsonOrUndefined<AgentPacketFile>(artifacts.packet),
    readJsonOrUndefined<AgentReviewFile>(artifacts.consensusReview),
    readJsonOrUndefined<FilterReport>(artifacts.filterReportJson)
  ]);
  return {
    id: task.id,
    scope: task.scope,
    status: "failed",
    packetPath: artifacts.packet,
    candidateCount: packet?.candidates.length ?? 0,
    consensusCount: consensus?.decisions?.length ?? 0,
    acceptedSafe: filterReport?.counts.acceptedSafe ?? 0,
    needsWitnessReview: filterReport?.counts.needsWitnessReview ?? 0,
    rejectedRisky: filterReport?.counts.rejectedRisky ?? 0,
    applied: 0,
    error: `apply-failed:${errorMessage(error)}`
  };
}

async function validationSummary(
  outputDir: string
): Promise<ValidationSummary> {
  const [accepted, pending, rejected] = await Promise.all([
    readJson<unknown[]>(path.join(outputDir, "accepted.json")),
    readJson<unknown[]>(path.join(outputDir, "pending.json")),
    readJson<unknown[]>(path.join(outputDir, "rejected.json"))
  ]);
  return {
    accepted: accepted.length,
    pending: pending.length,
    rejected: rejected.length
  };
}

async function runNpm(args: string[], options: CliOptions): Promise<string> {
  return runCommand("npm", args, {
    ...process.env,
    ...readDotEnv(".env"),
    AI_GATEWAY_TIMEOUT_MS: String(options.timeoutMs)
  });
}

async function runSerialized<T>(operation: () => Promise<T>): Promise<T> {
  const previous = serializedCommandChain;
  let release!: () => void;
  serializedCommandChain = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
}

async function runCommand(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv
): Promise<string> {
  const output = await new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
    text: string;
  }>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env
    });
    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
      process.stderr.write(chunk);
    });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      resolve({
        code,
        signal,
        text: Buffer.concat(chunks).toString("utf8")
      });
    });
  });

  if (output.code !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with ${
        output.signal ?? output.code
      }: ${output.text.slice(-2000)}`
    );
  }
  return output.text;
}

function readDotEnv(filePath: string): NodeJS.ProcessEnv {
  if (!existsSync(filePath)) return {};
  const env: NodeJS.ProcessEnv = {};
  const text = readFileSyncUtf8(filePath);
  for (const line of text.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed
      .slice(index + 1)
      .trim()
      .replace(/^["']|["']$/gu, "");
    env[key] = value;
  }
  return env;
}

export function readExistingManifest(
  outputRoot: string
): BatchManifest | undefined {
  const manifestPath = path.join(outputRoot, "manifest.json");
  if (!existsSync(manifestPath)) return undefined;
  try {
    return JSON.parse(readFileSync(manifestPath, "utf8")) as BatchManifest;
  } catch {
    return undefined;
  }
}

function previousResultIsReusable(
  task: BatchTask,
  result: TaskResult,
  options: CliOptions
): boolean {
  const artifacts = artifactPaths(task, options);
  if (!fileArtifactRecordIsCurrent(artifacts.taskLexicalReport)) return false;
  if (!fileArtifactRecordIsCurrent(artifacts.packet)) return false;
  if (
    !reviewFileIsUsableForPacket(
      artifacts.leftReview,
      artifacts.packet,
      options.leftModel,
      false
    ) ||
    !fileArtifactRecordIsCurrent(artifacts.leftReview)
  )
    return false;
  if (
    !reviewFileIsUsableForPacket(
      artifacts.rightReview,
      artifacts.packet,
      options.rightModel,
      true
    ) ||
    !fileArtifactRecordIsCurrent(artifacts.rightReview)
  )
    return false;
  if (
    !validationOutputIsComplete(artifacts.leftValidation) ||
    !directoryArtifactRecordIsCurrent(artifacts.leftValidation) ||
    !validationOutputIsComplete(artifacts.rightValidation) ||
    !directoryArtifactRecordIsCurrent(artifacts.rightValidation)
  ) {
    return false;
  }
  if (
    !fileArtifactRecordIsCurrent(artifacts.consensusReview) ||
    !validationOutputIsComplete(artifacts.consensusValidation) ||
    !directoryArtifactRecordIsCurrent(artifacts.consensusValidation)
  ) {
    return false;
  }
  if (
    ![
      artifacts.filteredReview,
      artifacts.filterReportJson,
      artifacts.filterReportMd
    ].every((output) => fileArtifactRecordIsCurrent(output)) ||
    !validationOutputIsComplete(artifacts.filteredValidation) ||
    !directoryArtifactRecordIsCurrent(artifacts.filteredValidation)
  ) {
    return false;
  }
  if (result.acceptedSafe > 0) {
    if (!validationOutputIsComplete(artifacts.appliedDir)) return false;
    if (!existsSync(path.join(artifacts.appliedDir, "application.json"))) {
      return false;
    }
    if (!existsSync(artifacts.benchmarkJson)) return false;
  }
  return true;
}

export function reviewFileIsUsableForPacket(
  filePath: string,
  packetPath: string,
  expectedModel: string,
  allowAdaptiveScreen = false
): boolean {
  if (!existsSync(filePath) || !existsSync(packetPath)) return false;
  try {
    const review = JSON.parse(
      readFileSync(filePath, "utf8")
    ) as AgentReviewFile;
    const packet = JSON.parse(
      readFileSync(packetPath, "utf8")
    ) as AgentPacketFile;
    const allowedModels = new Set([
      expectedModel,
      ...(allowAdaptiveScreen ? [`adaptive-screen(${expectedModel})`] : [])
    ]);
    if (
      !Array.isArray(review.decisions) ||
      review.parseError ||
      typeof review.sourcePacket !== "string" ||
      path.resolve(review.sourcePacket) !== path.resolve(packetPath) ||
      typeof review.model !== "string" ||
      !allowedModels.has(review.model) ||
      review.contract?.version !== 2 ||
      !Number.isInteger(review.contract.candidateCount) ||
      review.contract.candidateCount !== packet.candidates.length ||
      review.decisions.length !== packet.candidates.length
    ) {
      return false;
    }
    const candidateById = new Map(
      packet.candidates.map((candidate) => [candidate.id, candidate])
    );
    const ids = new Set<string>();
    return review.decisions.every((decision) => {
      if (!decision || typeof decision !== "object") return false;
      const item = decision as {
        id?: unknown;
        choiceId?: unknown;
        ref?: unknown;
        strong?: unknown;
      };
      if (
        typeof item.id !== "string" ||
        typeof item.choiceId !== "string" ||
        ids.has(item.id)
      ) {
        return false;
      }
      const candidate = candidateById.get(item.id);
      if (
        !candidate ||
        item.ref !== candidate.ref ||
        !Array.isArray(item.strong) ||
        !item.strong.includes(candidate.strong) ||
        !candidate.choices?.some((choice) => choice.id === item.choiceId)
      ) {
        return false;
      }
      ids.add(item.id);
      return true;
    });
  } catch {
    return false;
  }
}

function reviewFileIsAdaptiveScreen(filePath: string): boolean {
  if (!existsSync(filePath)) return false;
  try {
    const review = JSON.parse(readFileSync(filePath, "utf8")) as {
      model?: unknown;
    };
    return (
      typeof review.model === "string" &&
      review.model.startsWith("adaptive-screen(")
    );
  } catch {
    return false;
  }
}

function validationOutputIsComplete(outputDir: string): boolean {
  return (
    existsSync(path.join(outputDir, "accepted.json")) &&
    existsSync(path.join(outputDir, "pending.json")) &&
    existsSync(path.join(outputDir, "rejected.json"))
  );
}

function fingerprintBatchRun(options: CliOptions): string {
  return contentFingerprint({
    namespace: `${BATCH_CACHE_VERSION}:run`,
    inputPaths: [
      options.lexicalReportPath,
      "package.json",
      "data/strongs/Sg1910.csv",
      "data/strongs/Darby.csv",
      "data/strongs/DarbyR.csv",
      "src/books.ts",
      "src/atomicFile.ts",
      "src/contentAddressedCache.ts",
      "src/curatedStrongOverrides.ts",
      "src/frenchLexicalSafety.ts",
      "src/reviewFileLock.ts",
      "src/runSemanticRefillGapReviewBatch.ts",
      "src/runSemanticRefillPacketLlm.ts",
      "src/semanticRefill.ts",
      "src/semanticRefillAgentReview.ts",
      "src/semanticRefillBenchmarkReport.ts",
      "src/semanticRefillConsensusFilter.ts",
      "src/semanticRefillConsensusReview.ts",
      "src/semanticRefillLexicalPacket.ts",
      "src/semanticRefillLlm.ts",
      "src/strongCsv.ts",
      "src/strongLedger.ts",
      "src/strongLedgerStore.ts",
      "src/tokenize.ts"
    ],
    values: {
      bible: options.bible,
      maxItemsPerTask: options.maxItemsPerTask,
      minConfidence: options.minConfidence,
      leftModel: options.leftModel,
      rightModel: options.rightModel,
      timeoutMs: options.timeoutMs,
      llmAttempts: options.llmAttempts,
      adaptiveSecondModel: options.adaptiveSecondModel,
      dryRun: options.dryRun,
      reasoningEffort: process.env.AI_GATEWAY_REASONING_EFFORT ?? null
    }
  });
}

function fingerprintLedgerState(options: CliOptions): string {
  return contentFingerprint({
    namespace: `${BATCH_CACHE_VERSION}:ledger-state`,
    inputPaths: [
      `outputs/strong/${options.bible}/bible-${options.bible}-strong.sqlite`,
      "data/curated-strong-overrides.json",
      "data/strong-review-decisions.json"
    ],
    values: { bible: options.bible }
  });
}

function fingerprintTaskLexicalReport(
  task: BatchTask,
  options: CliOptions
): string {
  return contentFingerprint({
    namespace: `${BATCH_CACHE_VERSION}:task-lexical-report`,
    inputPaths: [
      options.lexicalReportPath,
      "src/runSemanticRefillGapReviewBatch.ts"
    ],
    values: {
      bible: options.bible,
      taskId: task.id,
      scope: task.scope,
      itemIds: task.itemIds
    }
  });
}

function fingerprintPacket(
  task: BatchTask,
  options: CliOptions,
  taskLexicalReportPath: string
): string {
  return contentFingerprint({
    namespace: `${BATCH_CACHE_VERSION}:packet`,
    inputPaths: [
      taskLexicalReportPath,
      `outputs/strong/${options.bible}/bible-${options.bible}-strong.sqlite`,
      "src/semanticRefill.ts",
      "src/semanticRefillLexicalPacket.ts",
      "src/semanticRefillLlm.ts"
    ],
    values: {
      bible: options.bible,
      scope: task.scope,
      itemIds: task.itemIds,
      limit: task.itemCount,
      minConfidence: options.minConfidence
    }
  });
}

function fingerprintLlmReview(
  packetPath: string,
  model: string,
  options: CliOptions
): string {
  return contentFingerprint({
    namespace: `${BATCH_CACHE_VERSION}:llm-review`,
    inputPaths: [
      packetPath,
      "src/runSemanticRefillPacketLlm.ts",
      "src/semanticRefillLlm.ts"
    ],
    values: {
      model,
      reasoningEffort: process.env.AI_GATEWAY_REASONING_EFFORT ?? null,
      timeoutMs: options.timeoutMs,
      adaptiveSecondModel: options.adaptiveSecondModel
    }
  });
}

function fingerprintAdaptivePacket(options: {
  artifacts: ReturnType<typeof artifactPaths>;
  options: CliOptions;
  eligibleCandidateIds: readonly string[];
}): string {
  return contentFingerprint({
    namespace: `${BATCH_CACHE_VERSION}:adaptive-packet`,
    inputPaths: [
      options.artifacts.packet,
      options.artifacts.leftReview,
      ...validationOutputPaths(options.artifacts.leftValidation),
      "src/runSemanticRefillGapReviewBatch.ts"
    ],
    values: {
      bible: options.options.bible,
      rightModel: options.options.rightModel,
      eligibleCandidateIds: options.eligibleCandidateIds
    }
  });
}

function fingerprintAdaptiveRightReview(options: {
  artifacts: ReturnType<typeof artifactPaths>;
  options: CliOptions;
  mode: Exclude<AdaptiveSecondModelMode, "full">;
  eligibleCandidateIds: readonly string[];
  subsetReviewPath?: string;
}): string {
  return contentFingerprint({
    namespace: `${BATCH_CACHE_VERSION}:adaptive-right-review`,
    inputPaths: [
      options.artifacts.packet,
      options.artifacts.leftReview,
      ...validationOutputPaths(options.artifacts.leftValidation),
      ...(options.subsetReviewPath ? [options.subsetReviewPath] : []),
      "src/runSemanticRefillGapReviewBatch.ts"
    ],
    values: {
      bible: options.options.bible,
      mode: options.mode,
      rightModel: options.options.rightModel,
      minConfidence: 0.84,
      eligibleCandidateIds: options.eligibleCandidateIds
    }
  });
}

function fingerprintValidation(
  inputPath: string,
  referenceStyle: boolean,
  options: CliOptions
): string {
  return contentFingerprint({
    namespace: `${BATCH_CACHE_VERSION}:validation`,
    inputPaths: [
      inputPath,
      `outputs/strong/${options.bible}/bible-${options.bible}-strong.sqlite`,
      "src/curatedStrongOverrides.ts",
      "src/reviewFileLock.ts",
      "src/semanticRefill.ts",
      "src/semanticRefillAgentReview.ts",
      "src/semanticRefillLlm.ts",
      "src/strongLedgerStore.ts"
    ],
    values: { bible: options.bible, referenceStyle }
  });
}

function fingerprintConsensus(
  artifacts: ReturnType<typeof artifactPaths>,
  options: CliOptions
): string {
  return contentFingerprint({
    namespace: `${BATCH_CACHE_VERSION}:consensus`,
    inputPaths: [
      artifacts.leftReview,
      artifacts.rightReview,
      ...validationOutputPaths(artifacts.leftValidation),
      ...validationOutputPaths(artifacts.rightValidation),
      "src/semanticRefill.ts",
      "src/semanticRefillLlm.ts",
      "src/semanticRefillConsensusReview.ts"
    ],
    values: { bible: options.bible, minConfidence: 0.84 }
  });
}

function fingerprintFilter(
  artifacts: ReturnType<typeof artifactPaths>,
  options: CliOptions
): string {
  return contentFingerprint({
    namespace: `${BATCH_CACHE_VERSION}:filter`,
    inputPaths: [
      artifacts.consensusReview,
      artifacts.packet,
      `outputs/strong/${options.bible}/bible-${options.bible}-strong.sqlite`,
      "data/strongs/Sg1910.csv",
      "data/strongs/Darby.csv",
      "data/strongs/DarbyR.csv",
      "src/semanticRefillConsensusFilter.ts",
      "src/frenchLexicalSafety.ts",
      "src/strongCsv.ts",
      "src/tokenize.ts"
    ],
    values: { bible: options.bible }
  });
}

function validationOutputPaths(outputDir: string): string[] {
  return ["accepted.json", "pending.json", "rejected.json"].map((fileName) =>
    path.join(outputDir, fileName)
  );
}

function fileArtifactIsReusable(
  outputPath: string,
  fingerprint: string
): boolean {
  return (
    existsSync(outputPath) &&
    cacheRecordMatches(
      fileCacheMetadataPath(outputPath),
      fingerprint,
      outputPath
    )
  );
}

function fileArtifactRecordIsCurrent(outputPath: string): boolean {
  return (
    existsSync(outputPath) &&
    cacheRecordIsCurrent(fileCacheMetadataPath(outputPath), outputPath)
  );
}

async function markFileArtifact(
  outputPath: string,
  fingerprint: string
): Promise<void> {
  if (!existsSync(outputPath)) {
    throw new Error(`missing-cache-output:${outputPath}`);
  }
  await writeCacheRecord(
    fileCacheMetadataPath(outputPath),
    fingerprint,
    outputPath
  );
}

function directoryArtifactIsReusable(
  outputDir: string,
  fingerprint: string
): boolean {
  return cacheRecordMatches(
    directoryCacheMetadataPath(outputDir),
    fingerprint,
    validationOutputPaths(outputDir)
  );
}

function directoryArtifactRecordIsCurrent(outputDir: string): boolean {
  return cacheRecordIsCurrent(
    directoryCacheMetadataPath(outputDir),
    validationOutputPaths(outputDir)
  );
}

async function markDirectoryArtifact(
  outputDir: string,
  fingerprint: string
): Promise<void> {
  await writeCacheRecord(
    directoryCacheMetadataPath(outputDir),
    fingerprint,
    validationOutputPaths(outputDir)
  );
}

function readFileSyncUtf8(filePath: string): string {
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function readJsonOrUndefined<T>(
  filePath: string
): Promise<T | undefined> {
  try {
    return await readJson<T>(filePath);
  } catch {
    return undefined;
  }
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  try {
    await writeFile(
      temporaryPath,
      `${JSON.stringify(value, null, 2)}\n`,
      "utf8"
    );
    await rename(temporaryPath, filePath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

function parseRef(ref: string): { book: string; chapter: number } | null {
  const match = /^(?<book>[1-3]?[A-Za-z]+)\.(?<chapter>\d+)\./u.exec(ref);
  if (!match?.groups) return null;
  return {
    book: match.groups.book,
    chapter: Number.parseInt(match.groups.chapter, 10)
  };
}

function parseScope(scope: string): { book: string; chapter: number } | null {
  const [book, rawChapter] = scope.split(".");
  if (!book || !rawChapter) return null;
  return { book, chapter: Number.parseInt(rawChapter, 10) };
}

function compareScope(left: string, right: string): number {
  const parsedLeft = parseScope(left);
  const parsedRight = parseScope(right);
  if (!parsedLeft || !parsedRight) return left.localeCompare(right);
  return (
    compareBook(parsedLeft.book, parsedRight.book) ||
    parsedLeft.chapter - parsedRight.chapter
  );
}

function compareBook(left: string, right: string): number {
  return (
    (BOOK_ORDER.get(left) ?? Number.MAX_SAFE_INTEGER) -
      (BOOK_ORDER.get(right) ?? Number.MAX_SAFE_INTEGER) ||
    left.localeCompare(right)
  );
}

function confidenceRank(confidence: CandidateConfidence): number {
  switch (confidence) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
  }
}

export function modelArtifactSlug(model: string): string {
  const identity = normalizeModelIdentity(model);
  const label =
    identity
      .replace(/[^0-9A-Za-z]+/gu, "-")
      .replace(/^-|-$/gu, "")
      .slice(0, 64) || "model";
  const hash = createHash("sha256").update(identity).digest("hex").slice(0, 10);
  return `${label}-${hash}`;
}

function modelSlug(model: string): string {
  return modelArtifactSlug(model);
}

export function assertDistinctBatchModels(
  leftModel: string,
  rightModel: string
): void {
  if (
    normalizeModelIdentity(leftModel) === normalizeModelIdentity(rightModel)
  ) {
    throw new Error(
      `consensus-requires-distinct-models:${leftModel}:${rightModel}`
    );
  }
}

export function assertValidBatchLimits(
  options: Pick<
    CliOptions,
    "maxItemsPerTask" | "taskBatchSize" | "llmAttempts" | "timeoutMs"
  >
): void {
  assertPositiveInteger("maxItemsPerTask", options.maxItemsPerTask);
  assertPositiveInteger("taskBatchSize", options.taskBatchSize);
  assertPositiveInteger("llmAttempts", options.llmAttempts);
  assertPositiveInteger("timeoutMs", options.timeoutMs);
}

function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`invalid-positive-integer:${name}:${value}`);
  }
}

function normalizeModelIdentity(model: string): string {
  return model.trim().toLowerCase();
}

function sanitize(value: string): string {
  return value.replace(/[^0-9A-Za-z]+/gu, "-").replace(/^-|-$/gu, "");
}

function scopeHash(scope: string): string {
  return createHash("sha1").update(scope).digest("hex").slice(0, 8);
}

function stableTaskId(
  book: string,
  scope: string,
  itemIds: readonly string[]
): string {
  const identity = `${book}|${scope}|${itemIds.join("\n")}`;
  return `${book}-${scopeHash(identity)}`;
}

function chunk<T>(items: T[], size: number): T[][] {
  assertPositiveInteger("chunkSize", size);
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function sum(items: TaskResult[], key: keyof TaskResult): number {
  return items.reduce((total, item) => {
    const value = item[key];
    return total + (typeof value === "number" ? value : 0);
  }, 0);
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

function readNumberArg(
  args: Map<string, string | boolean>,
  name: string,
  fallback: number
): number {
  const value = args.get(name);
  if (typeof value !== "string") return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readConfidenceArg(
  args: Map<string, string | boolean>
): CandidateConfidence {
  const value = args.get("min-confidence");
  if (value === "medium" || value === "low" || value === "high") return value;
  return "high";
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const bible = readStringArg(args, "bible", "nbs").toLowerCase();
  const outputRoot = readStringArg(
    args,
    "output-root",
    path.join("outputs", "gap-review", bible, "full-bible-llm-current")
  );
  const options: CliOptions = {
    bible,
    lexicalReportPath: readStringArg(
      args,
      "lexical-report",
      path.join(
        "outputs",
        "lexical-candidates",
        bible,
        `bible-${bible}-lexical-candidates-all.json`
      )
    ),
    outputRoot,
    maxItemsPerTask: readNumberArg(args, "max-items-per-task", 30),
    taskBatchSize: readNumberArg(args, "task-batch-size", 1),
    minConfidence: readConfidenceArg(args),
    leftModel: readStringArg(args, "left-model", DEFAULT_LEFT_MODEL),
    rightModel: readStringArg(args, "right-model", DEFAULT_RIGHT_MODEL),
    timeoutMs: readNumberArg(args, "timeout-ms", 120000),
    llmAttempts: readNumberArg(args, "llm-attempts", 2),
    skipExisting:
      args.get("skip-existing") === true ||
      args.get("skip-existing") === "true",
    dryRun: args.get("dry-run") === true,
    planOnly: args.get("plan-only") === true,
    allowResidualAutoSafe: args.get("allow-residual-autosafe") === true,
    adaptiveSecondModel: args.get("adaptive-second-model") !== "false"
  };

  const manifest = await runBatch(options);
  console.log(JSON.stringify(manifest.totals, null, 2));
  const outputName = batchOutputFileName(options.planOnly);
  console.log(
    `${options.planOnly ? "Plan" : "Manifest"}: ${path.join(options.outputRoot, outputName)}`
  );
}

if (process.argv[1]?.endsWith("runSemanticRefillGapReviewBatch.ts")) {
  await main();
}
