import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  assertFrenchInternalConfigurationMatchesManifest,
  readFrenchInternalProposerArtifacts,
  type FrenchInternalProposerArtifact
} from "./assembleLexiconV3FrenchInternalReview.js";
import type { FrenchCodexPilotBatchRecord } from "./buildLexiconV3FrenchCodexPilotBatches.js";
import {
  assertFrenchCodexAnyBatchManifest,
  type FrenchCodexAnyBatchManifest,
  type FrenchCodexManifestContext
} from "./buildLexiconV3FrenchCodexBatches.js";
import {
  acquireExclusiveRoleLock,
  runLexiconV3FrenchCodexProposerBatch,
  type FrenchCodexProposerBatchOptions,
  type FrenchCodexProposerRun
} from "./runLexiconV3FrenchCodexProposerBatch.js";
import {
  FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE,
  canonicalFrenchInternalJson,
  hashFrenchInternalJson
} from "../src/lexiconV3/frenchInternalReview.js";
import {
  ensureFrenchCodexImmutableBinary,
  FRENCH_CODEX_IMMUTABLE_BINARY_PATH
} from "../src/lexiconV3/frenchCodexImmutableBinary.js";

export const FRENCH_CODEX_PILOT_PROPOSER_PROGRESS_SCHEMA_VERSION =
  "lexicon-v3-french-codex-pilot-proposer-progress@1" as const;
export const FRENCH_CODEX_PILOT_PROPOSER_SUMMARY_SCHEMA_VERSION =
  "lexicon-v3-french-codex-proposer-summary@3" as const;

const DEFAULT_MANIFEST =
  "outputs/lexicon-v3/fr-internal/agent-batches/pilot/manifest.json";
const DEFAULT_CONFIGURATION =
  "outputs/lexicon-v3/fr-internal/configuration.json";
const DEFAULT_OUTPUT_DIR = "outputs/lexicon-v3/fr-internal/pilot";
const DEFAULT_CODEX_BINARY = FRENCH_CODEX_IMMUTABLE_BINARY_PATH;
const DEFAULT_CODEX_HOME = "outputs/lexicon-v3/fr-internal/codex-agent-home";
const DEFAULT_CODEX_VERSION = "codex-cli 0.144.0-alpha.4";
const DEFAULT_CODEX_SHA256 =
  "e48ce8a0455b97ba25aa6b373f694ad7788f960c4bfc311f68b6d5bf7121f2f4";

type Role = "proposerA" | "proposerB";

interface RoleProfile {
  model: string;
  reasoningEffort: string;
}

interface Job {
  batch: FrenchCodexPilotBatchRecord;
  role: Role;
  attempts: number;
  force: boolean;
}

interface Failure {
  batchId: string;
  role: Role;
  attempts: number;
  error: string;
}

export interface FrenchCodexProposerSelection {
  batchIds?: string[];
  batchRange?: { start: number; end: number };
  shardIds?: string[];
  aggregateOnly: boolean;
}

export interface RunFrenchCodexProposersOptions {
  manifestPath: string;
  configurationPath: string;
  outputDir: string;
  codexBinary: string;
  codexHome: string;
  proposerA: RoleProfile;
  proposerB: RoleProfile;
  concurrency: number;
  maxAttempts: number;
  timeoutMs: number;
  expectedEntries?: number;
  selection: FrenchCodexProposerSelection;
  expectedCodexVersion: string;
  expectedCodexSha256: string;
}

interface Progress {
  schemaVersion: typeof FRENCH_CODEX_PILOT_PROPOSER_PROGRESS_SCHEMA_VERSION;
  manifestHash: string;
  updatedAt: string;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  completedEntries: { proposerA: number; proposerB: number };
  failures: Failure[];
  progressHash: string;
}

interface AggregateArtifact {
  path: string;
  sha256: string;
  bytes: number;
  records: number;
  logicalDigest: string;
}

export interface FrenchCodexProposerSummary {
  schemaVersion: typeof FRENCH_CODEX_PILOT_PROPOSER_SUMMARY_SCHEMA_VERSION;
  runKind: FrenchCodexManifestContext["runKind"];
  namespace: string;
  selectionHash: string;
  keyOrderHash: string;
  coverage: "exact" | "partial";
  selectedBatchIds: string[];
  selectedBatchIdsHash: string;
  manifestHash: string;
  sourceManifestDigest: string;
  generatedAt: string;
  profiles: { proposerA: RoleProfile; proposerB: RoleProfile };
  counts: {
    entries: number;
    batches: number;
    jobs: number;
    proposerA: number;
    proposerB: number;
    distinctAgentThreads: number;
    validatorClean: number;
    validatorReview: number;
  };
  usage: {
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    reasoningOutputTokens: number;
  };
  outputs: {
    proposerA: AggregateArtifact;
    proposerB: AggregateArtifact;
    runs: AggregateArtifact;
  };
  runHashesDigest: string;
  summaryHash: string;
}

export interface FrenchCodexProposerSummaryResolution {
  summary: FrenchCodexProposerSummary;
  reused: boolean;
}

/**
 * Preserve an already sealed aggregate when its substantive inputs are still
 * exact. Older summaries used wall-clock aggregation time for `generatedAt`;
 * retaining that valid timestamp keeps downstream adjudication manifests
 * byte-stable across a resume. New summaries use the last sealed run time.
 */
export function resolveFrenchCodexProposerSummaryForAggregation(
  expected: FrenchCodexProposerSummary,
  existingText?: string
): FrenchCodexProposerSummaryResolution {
  const { summaryHash: expectedHash, ...expectedContent } = expected;
  if (
    !isCanonicalIsoTimestamp(expected.generatedAt) ||
    expectedHash !== hashFrenchInternalJson(expectedContent)
  ) {
    throw new Error("french-codex-proposer-expected-aggregate-invalid");
  }
  if (existingText === undefined) {
    return { summary: expected, reused: false };
  }

  let existing: FrenchCodexProposerSummary;
  try {
    existing = JSON.parse(existingText) as FrenchCodexProposerSummary;
  } catch {
    throw new Error("french-codex-proposer-existing-aggregate-stale");
  }
  if (existing === null || typeof existing !== "object") {
    throw new Error("french-codex-proposer-existing-aggregate-stale");
  }
  const { summaryHash, ...existingContent } = existing;
  const { generatedAt: _expectedGeneratedAt, ...expectedStableContent } =
    expectedContent;
  const { generatedAt: _existingGeneratedAt, ...existingStableContent } =
    existingContent;
  void _expectedGeneratedAt;
  void _existingGeneratedAt;
  if (
    existing.schemaVersion !==
      FRENCH_CODEX_PILOT_PROPOSER_SUMMARY_SCHEMA_VERSION ||
    !isCanonicalIsoTimestamp(existing.generatedAt) ||
    summaryHash !== hashFrenchInternalJson(existingContent) ||
    canonicalFrenchInternalJson(existingStableContent) !==
      canonicalFrenchInternalJson(expectedStableContent)
  ) {
    throw new Error("french-codex-proposer-existing-aggregate-stale");
  }
  return { summary: existing, reused: true };
}

export async function runLexiconV3FrenchCodexPilotProposers(
  options: RunFrenchCodexProposersOptions
): Promise<FrenchCodexProposerSummary> {
  assertOptions(options);
  ensureFrenchCodexImmutableBinary({ requestedPath: options.codexBinary });
  mkdirSync(options.outputDir, { recursive: true });
  const releaseLock = acquireExclusiveRoleLock(
    resolve(options.outputDir, "proposer-orchestrator.lock")
  );
  try {
    return await runLexiconV3FrenchCodexPilotProposersUnlocked(options);
  } finally {
    releaseLock();
  }
}

async function runLexiconV3FrenchCodexPilotProposersUnlocked(
  options: RunFrenchCodexProposersOptions
): Promise<FrenchCodexProposerSummary> {
  const manifestText = readFileSync(options.manifestPath, "utf8");
  const manifest = JSON.parse(manifestText) as FrenchCodexAnyBatchManifest;
  const context = assertFrenchCodexAnyBatchManifest(manifest, {
    verifyFiles: true,
    expectedEntries: options.expectedEntries
  });
  assertFrenchInternalConfigurationMatchesManifest(
    context,
    options.configurationPath
  );
  const selectedBatches = selectFrenchCodexBatches(
    manifest.batches,
    options.selection
  );
  const selectionHash = hashFrenchInternalJson(
    selectedBatches.map((batch) => ({
      batchId: batch.batchId,
      batchHash: batch.batchHash
    }))
  );
  const completeCoverage = selectedBatches.length === manifest.batches.length;
  if (options.selection.aggregateOnly && !completeCoverage) {
    throw new Error(
      "french-codex-proposer-aggregate-only-requires-full-coverage"
    );
  }
  const runOutputDir = completeCoverage
    ? options.outputDir
    : resolve(options.outputDir, "partials", selectionHash);
  const progressPath = resolve(runOutputDir, "proposer-progress.json");
  const jobs: Job[] = selectedBatches.flatMap((batch) => [
    { batch, role: "proposerA" as const, attempts: 0, force: false },
    { batch, role: "proposerB" as const, attempts: 0, force: false }
  ]);
  const completed: FrenchCodexProposerRun[] = [];
  const failures: Failure[] = [];
  const queue = [...jobs];

  const worker = async (): Promise<void> => {
    while (queue.length > 0) {
      const job = queue.shift();
      if (!job) return;
      job.attempts += 1;
      const profile = options[job.role];
      try {
        const run = await runLexiconV3FrenchCodexProposerBatch({
          manifestPath: options.manifestPath,
          configurationPath: options.configurationPath,
          batchId: job.batch.batchId,
          role: job.role,
          codexBinary: options.codexBinary,
          codexHome: options.codexHome,
          model: profile.model,
          reasoningEffort: profile.reasoningEffort,
          timeoutMs: options.timeoutMs,
          force: job.force,
          manifestPrevalidated: true,
          expectedEntries: context.expectedEntries,
          existingOnly: options.selection.aggregateOnly,
          expectedCodexVersion: options.expectedCodexVersion,
          expectedCodexSha256: options.expectedCodexSha256
        } satisfies FrenchCodexProposerBatchOptions);
        completed.push(run);
        process.stdout.write(
          `${JSON.stringify({
            event: "completed",
            batchId: job.batch.batchId,
            role: job.role,
            entries: run.counts.artifacts,
            validatorReview: run.counts.validatorReview,
            completedJobs: completed.length,
            totalJobs: jobs.length
          })}\n`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (
          !options.selection.aggregateOnly &&
          [
            "french-codex-existing-run-stale:",
            "french-codex-existing-run-artifact-stale:",
            "french-codex-existing-run-thread-mismatch:",
            "french-codex-existing-run-drafts-mismatch:",
            "french-codex-existing-run-artifacts-mismatch:",
            "french-codex-existing-run-summary-mismatch:"
          ].some((prefix) => message.startsWith(prefix))
        ) {
          job.force = true;
        }
        if (job.attempts < options.maxAttempts) {
          queue.push(job);
          process.stdout.write(
            `${JSON.stringify({
              event: "retry",
              batchId: job.batch.batchId,
              role: job.role,
              attempt: job.attempts,
              error: message
            })}\n`
          );
        } else {
          failures.push({
            batchId: job.batch.batchId,
            role: job.role,
            attempts: job.attempts,
            error: message
          });
          process.stdout.write(
            `${JSON.stringify({
              event: "failed",
              batchId: job.batch.batchId,
              role: job.role,
              attempts: job.attempts,
              error: message
            })}\n`
          );
        }
      }
      writeProgress(
        progressPath,
        manifest.manifestHash,
        jobs,
        completed,
        failures
      );
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(options.concurrency, jobs.length) }, () =>
      worker()
    )
  );
  if (failures.length > 0 || completed.length !== jobs.length) {
    throw new Error(
      `french-codex-pilot-proposers-incomplete:${completed.length}:${failures.length}:${jobs.length}`
    );
  }
  return aggregatePilotProposers(
    { ...options, outputDir: runOutputDir },
    manifest,
    manifestText,
    completed,
    context,
    selectedBatches,
    completeCoverage
  );
}

function aggregatePilotProposers(
  options: RunFrenchCodexProposersOptions,
  manifest: FrenchCodexAnyBatchManifest,
  manifestText: string,
  runs: FrenchCodexProposerRun[],
  context: FrenchCodexManifestContext,
  selectedBatches: FrenchCodexPilotBatchRecord[],
  completeCoverage: boolean
): FrenchCodexProposerSummary {
  const expectedRunCount = selectedBatches.length * 2;
  const runByJob = new Map<string, FrenchCodexProposerRun>();
  for (const run of runs) {
    const key = `${run.batchId}:${run.role}`;
    if (
      runByJob.has(key) ||
      run.sourceHashes.manifest !== sha256(manifestText) ||
      !selectedBatches.some(
        (batch) =>
          batch.batchId === run.batchId &&
          batch.batchHash === run.sourceHashes.batch
      )
    ) {
      throw new Error(`french-codex-pilot-run-lineage:${key}`);
    }
    runByJob.set(key, run);
  }
  if (
    runs.length !== expectedRunCount ||
    runByJob.size !== expectedRunCount ||
    new Set(runs.map((run) => run.threadId)).size !== expectedRunCount
  ) {
    throw new Error("french-codex-pilot-run-coverage");
  }
  const records = {
    proposerA: [] as FrenchInternalProposerArtifact[],
    proposerB: [] as FrenchInternalProposerArtifact[]
  };
  for (const batch of selectedBatches) {
    for (const role of ["proposerA", "proposerB"] as const) {
      const run = runByJob.get(`${batch.batchId}:${role}`);
      if (!run) {
        throw new Error(
          `french-codex-pilot-run-missing:${batch.batchId}:${role}`
        );
      }
      const path = artifactPath(batch, role);
      if (
        !existsSync(path) ||
        sha256(readFileSync(path)) !== run.resultHashes.artifacts
      ) {
        throw new Error(
          `french-codex-pilot-artifact-run-mismatch:${batch.batchId}:${role}`
        );
      }
      const read = readFrenchInternalProposerArtifacts(path, role);
      if (read.records.length !== batch.keys.length) {
        throw new Error(
          `french-codex-pilot-artifact-cardinality:${batch.batchId}:${role}`
        );
      }
      const expectedHashes =
        role === "proposerA"
          ? batch.proposerAViewHashes
          : batch.proposerBViewHashes;
      for (const [index, record] of read.records.entries()) {
        if (
          record.entryKey !== batch.keys[index] ||
          record.inputHash !== expectedHashes[index] ||
          record.agentId !== run.agentId ||
          record.taskName !== run.taskName ||
          record.completedAt !== run.completedAt
        ) {
          throw new Error(
            `french-codex-pilot-artifact-lineage:${batch.batchId}:${role}:${index}`
          );
        }
      }
      records[role].push(...read.records);
    }
  }
  const selectedKeyOrder = selectedBatches.flatMap((batch) => batch.keys);
  const selectedPosition = new Map(
    selectedKeyOrder.map((entryKey, index) => [entryKey, index])
  );
  for (const role of ["proposerA", "proposerB"] as const) {
    records[role].sort(
      (left, right) =>
        (selectedPosition.get(left.entryKey) ?? Number.MAX_SAFE_INTEGER) -
        (selectedPosition.get(right.entryKey) ?? Number.MAX_SAFE_INTEGER)
    );
    if (
      records[role].length !==
        selectedBatches.reduce(
          (total, batch) => total + batch.keys.length,
          0
        ) ||
      new Set(records[role].map((record) => record.entryKey)).size !==
        records[role].length ||
      records[role].some(
        (record, index) => record.entryKey !== selectedKeyOrder[index]
      )
    ) {
      throw new Error(`french-codex-pilot-aggregate-coverage:${role}`);
    }
  }
  const aByKey = new Map(
    records.proposerA.map((record) => [record.entryKey, record])
  );
  for (const record of records.proposerB) {
    if (aByKey.get(record.entryKey)?.agentId === record.agentId) {
      throw new Error(
        `french-codex-pilot-proposer-agent-collision:${record.entryKey}`
      );
    }
  }
  const aText = `${records.proposerA.map((record) => JSON.stringify(record)).join("\n")}\n`;
  const bText = `${records.proposerB.map((record) => JSON.stringify(record)).join("\n")}\n`;
  const aPath = resolve(options.outputDir, "proposer-a.jsonl");
  const bPath = resolve(options.outputDir, "proposer-b.jsonl");
  const runsPath = resolve(options.outputDir, "proposer-runs.jsonl");
  const outputA = metadata(aPath, aText, records.proposerA);
  const outputB = metadata(bPath, bText, records.proposerB);
  const sortedRuns = [...runs].sort((left, right) =>
    `${left.batchId}:${left.role}`.localeCompare(
      `${right.batchId}:${right.role}`
    )
  );
  const runsText = `${sortedRuns.map((run) => JSON.stringify(run)).join("\n")}\n`;
  const outputRuns: AggregateArtifact = {
    path: runsPath,
    sha256: sha256(runsText),
    bytes: Buffer.byteLength(runsText),
    records: sortedRuns.length,
    logicalDigest: hashFrenchInternalJson(
      sortedRuns.map((run) => ({
        batchId: run.batchId,
        role: run.role,
        agentId: run.agentId,
        threadId: run.threadId,
        runHash: run.runHash
      }))
    )
  };
  const usage = runs.reduce(
    (total, run) => ({
      inputTokens: total.inputTokens + (run.usage?.input_tokens ?? 0),
      cachedInputTokens:
        total.cachedInputTokens + (run.usage?.cached_input_tokens ?? 0),
      outputTokens: total.outputTokens + (run.usage?.output_tokens ?? 0),
      reasoningOutputTokens:
        total.reasoningOutputTokens + (run.usage?.reasoning_output_tokens ?? 0)
    }),
    {
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      reasoningOutputTokens: 0
    }
  );
  const validatorClean = runs.reduce(
    (total, run) => total + run.counts.validatorClean,
    0
  );
  const validatorReview = runs.reduce(
    (total, run) => total + run.counts.validatorReview,
    0
  );
  const generatedAt = [...runs]
    .map((run) => run.completedAt)
    .sort()
    .at(-1)!;
  const content = {
    schemaVersion: FRENCH_CODEX_PILOT_PROPOSER_SUMMARY_SCHEMA_VERSION,
    runKind: context.runKind,
    namespace: context.namespace,
    selectionHash: context.selectionHash,
    keyOrderHash: completeCoverage
      ? context.keyOrderHash
      : hashFrenchInternalJson(selectedBatches.flatMap((batch) => batch.keys)),
    coverage: completeCoverage ? ("exact" as const) : ("partial" as const),
    selectedBatchIds: selectedBatches.map((batch) => batch.batchId),
    selectedBatchIdsHash: hashFrenchInternalJson(
      selectedBatches.map((batch) => ({
        batchId: batch.batchId,
        batchHash: batch.batchHash
      }))
    ),
    manifestHash: manifest.manifestHash,
    sourceManifestDigest: sha256(manifestText),
    generatedAt,
    profiles: { proposerA: options.proposerA, proposerB: options.proposerB },
    counts: {
      entries: records.proposerA.length,
      batches: selectedBatches.length,
      jobs: runs.length,
      proposerA: records.proposerA.length,
      proposerB: records.proposerB.length,
      distinctAgentThreads: new Set(runs.map((run) => run.threadId)).size,
      validatorClean,
      validatorReview
    },
    usage,
    outputs: { proposerA: outputA, proposerB: outputB, runs: outputRuns },
    runHashesDigest: hashFrenchInternalJson(
      runs
        .map((run) => ({
          batchId: run.batchId,
          role: run.role,
          agentId: run.agentId,
          runHash: run.runHash
        }))
        .sort((left, right) =>
          `${left.batchId}:${left.role}`.localeCompare(
            `${right.batchId}:${right.role}`
          )
        )
    )
  };
  const expectedSummary: FrenchCodexProposerSummary = {
    ...content,
    summaryHash: hashFrenchInternalJson(content)
  };
  const summaryPath = resolve(options.outputDir, "proposer-summary.json");
  const resolution = resolveFrenchCodexProposerSummaryForAggregation(
    expectedSummary,
    existsSync(summaryPath) ? readFileSync(summaryPath, "utf8") : undefined
  );
  const summary = resolution.summary;
  const aggregateFiles = [
    { path: aPath, text: aText },
    { path: bPath, text: bText },
    { path: runsPath, text: runsText }
  ];
  if (resolution.reused) {
    if (
      aggregateFiles.some(
        (file) =>
          !existsSync(file.path) ||
          readFileSync(file.path, "utf8") !== file.text
      )
    ) {
      throw new Error("french-codex-proposer-existing-aggregate-stale");
    }
    return summary;
  }
  installFilesAtomically([
    ...aggregateFiles,
    {
      path: summaryPath,
      text: `${JSON.stringify(summary, null, 2)}\n`
    }
  ]);
  return summary;
}

function writeProgress(
  path: string,
  manifestHash: string,
  jobs: Job[],
  completed: FrenchCodexProposerRun[],
  failures: Failure[]
): void {
  const content = {
    schemaVersion: FRENCH_CODEX_PILOT_PROPOSER_PROGRESS_SCHEMA_VERSION,
    manifestHash,
    updatedAt: new Date().toISOString(),
    totalJobs: jobs.length,
    completedJobs: completed.length,
    failedJobs: failures.length,
    completedEntries: {
      proposerA: completed
        .filter((run) => run.role === "proposerA")
        .reduce((total, run) => total + run.counts.artifacts, 0),
      proposerB: completed
        .filter((run) => run.role === "proposerB")
        .reduce((total, run) => total + run.counts.artifacts, 0)
    },
    failures
  };
  const progress: Progress = {
    ...content,
    progressHash: hashFrenchInternalJson(content)
  };
  installTextAtomically(path, `${JSON.stringify(progress, null, 2)}\n`);
}

function artifactPath(batch: FrenchCodexPilotBatchRecord, role: Role): string {
  return resolve(
    dirname(
      role === "proposerA"
        ? batch.inputs.proposerA.path
        : batch.inputs.proposerB.path
    ),
    role === "proposerA"
      ? "proposer-a-artifacts.jsonl"
      : "proposer-b-artifacts.jsonl"
  );
}

function metadata(
  path: string,
  text: string,
  records: FrenchInternalProposerArtifact[]
): AggregateArtifact {
  return {
    path,
    sha256: sha256(text),
    bytes: Buffer.byteLength(text),
    records: records.length,
    logicalDigest: hashFrenchInternalJson(
      records.map((record) => ({
        entryKey: record.entryKey,
        inputHash: record.inputHash,
        artifactHash: record.artifactHash
      }))
    )
  };
}

function installTextAtomically(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(temp, text, "utf8");
  renameSync(temp, path);
}

function installFilesAtomically(
  files: Array<{ path: string; text: string }>
): void {
  const nonce = `${process.pid}-${Date.now()}`;
  const staged = files.map((file) => ({
    ...file,
    temp: `${file.path}.tmp-${nonce}`,
    backup: `${file.path}.bak-${nonce}`,
    existed: existsSync(file.path),
    backedUp: false,
    installed: false
  }));
  try {
    for (const file of staged) {
      mkdirSync(dirname(file.path), { recursive: true });
      writeFileSync(file.temp, file.text, "utf8");
    }
    for (const file of staged) {
      if (file.existed) {
        renameSync(file.path, file.backup);
        file.backedUp = true;
      }
      renameSync(file.temp, file.path);
      file.installed = true;
    }
    for (const file of staged) rmSync(file.backup, { force: true });
  } catch (error) {
    for (const file of staged) {
      rmSync(file.temp, { force: true });
      if (file.installed) rmSync(file.path, { force: true });
      if (file.backedUp) renameSync(file.backup, file.path);
    }
    throw error;
  }
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function isCanonicalIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

export function selectFrenchCodexBatches(
  batches: FrenchCodexPilotBatchRecord[],
  selection: FrenchCodexProposerSelection
): FrenchCodexPilotBatchRecord[] {
  const finalize = (
    selected: FrenchCodexPilotBatchRecord[]
  ): FrenchCodexPilotBatchRecord[] => {
    if (selection.aggregateOnly && selected.length !== batches.length) {
      throw new Error(
        "french-codex-proposer-aggregate-only-requires-full-coverage"
      );
    }
    return selected;
  };
  if (
    [selection.batchIds, selection.batchRange, selection.shardIds].filter(
      Boolean
    ).length > 1
  ) {
    throw new Error("french-codex-proposer-selection-conflict");
  }
  if (new Set(batches.map((batch) => batch.batchId)).size !== batches.length) {
    throw new Error("french-codex-proposer-manifest-batch-duplicate");
  }
  if (selection.batchIds) {
    if (
      selection.batchIds.length < 1 ||
      new Set(selection.batchIds).size !== selection.batchIds.length
    ) {
      throw new Error("french-codex-proposer-batch-ids-invalid");
    }
    const positions = selection.batchIds.map((id) =>
      batches.findIndex((batch) => batch.batchId === id)
    );
    if (positions.some((position) => position < 0)) {
      throw new Error("french-codex-proposer-batch-id-unknown");
    }
    if (
      positions.some(
        (position, index) => index > 0 && position <= positions[index - 1]!
      )
    ) {
      throw new Error("french-codex-proposer-batch-ids-order-invalid");
    }
    return finalize(positions.map((position) => batches[position]!));
  }
  if (selection.shardIds) {
    if (
      selection.shardIds.length < 1 ||
      new Set(selection.shardIds).size !== selection.shardIds.length
    ) {
      throw new Error("french-codex-proposer-shard-ids-invalid");
    }
    const selected: FrenchCodexPilotBatchRecord[] = [];
    let previousPosition = -1;
    for (const shardId of selection.shardIds) {
      if (!/^(?:short|medium|long|very_long)-\d{4}$/u.test(shardId)) {
        throw new Error(`french-codex-proposer-shard-id-invalid:${shardId}`);
      }
      const prefix = `full-${shardId}-p`;
      const matches = batches.filter((batch) =>
        batch.batchId.startsWith(prefix)
      );
      if (matches.length < 1) {
        throw new Error(`french-codex-proposer-shard-id-unknown:${shardId}`);
      }
      const firstPosition = batches.indexOf(matches[0]!);
      if (firstPosition <= previousPosition) {
        throw new Error("french-codex-proposer-shard-ids-order-invalid");
      }
      selected.push(...matches);
      previousPosition = batches.indexOf(matches.at(-1)!);
    }
    return finalize(selected);
  }
  if (selection.batchRange) {
    const { start, end } = selection.batchRange;
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 0 ||
      end <= start ||
      end > batches.length
    ) {
      throw new Error("french-codex-proposer-batch-range-invalid");
    }
    return finalize(batches.slice(start, end));
  }
  if (batches.length < 1) throw new Error("french-codex-proposer-no-batches");
  return finalize([...batches]);
}

function assertOptions(options: RunFrenchCodexProposersOptions): void {
  for (const value of [options.proposerA, options.proposerB]) {
    if (!value.model.trim() || !value.reasoningEffort.trim()) {
      throw new Error("french-codex-pilot-proposer-profile-invalid");
    }
  }
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1) {
    throw new Error("french-codex-pilot-proposer-concurrency-invalid");
  }
  if (!Number.isInteger(options.maxAttempts) || options.maxAttempts < 1) {
    throw new Error("french-codex-pilot-proposer-attempts-invalid");
  }
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1) {
    throw new Error("french-codex-pilot-proposer-timeout-invalid");
  }
  if (
    options.expectedEntries !== undefined &&
    (!Number.isInteger(options.expectedEntries) || options.expectedEntries < 1)
  ) {
    throw new Error("french-codex-proposer-expected-entries-invalid");
  }
  if (
    !options.expectedCodexVersion.trim() ||
    !/^[a-f0-9]{64}$/u.test(options.expectedCodexSha256)
  ) {
    throw new Error("french-codex-proposer-binary-pin-invalid");
  }
  if (
    hashFrenchInternalJson(options.proposerA) !==
      hashFrenchInternalJson(
        FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.proposerA
      ) ||
    hashFrenchInternalJson(options.proposerB) !==
      hashFrenchInternalJson(
        FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.proposerB
      ) ||
    options.expectedCodexVersion !==
      FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.codexVersion ||
    options.expectedCodexSha256 !==
      FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.codexSha256
  ) {
    throw new Error("french-codex-proposer-unapproved-execution-profile");
  }
}

export function parseFrenchCodexProposersArgs(
  args: readonly string[]
): RunFrenchCodexProposersOptions {
  const allowed = new Set([
    "manifest",
    "configuration",
    "output-dir",
    "codex-binary",
    "codex-home",
    "a-model",
    "a-reasoning-effort",
    "b-model",
    "b-reasoning-effort",
    "concurrency",
    "max-attempts",
    "timeout-ms",
    "expected-entries",
    "batch-ids",
    "batch-range",
    "shard-ids",
    "aggregate-only",
    "codex-version",
    "codex-sha256"
  ]);
  const values = new Map<string, string>();
  const seen = new Set<string>();
  let aggregateOnly = false;
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index] ?? "";
    if (!token.startsWith("--"))
      throw new Error(`unexpected-argument:${token}`);
    const key = token.slice(2);
    if (!allowed.has(key)) throw new Error(`unknown-option:${key}`);
    if (seen.has(key)) throw new Error(`duplicate-option:${key}`);
    seen.add(key);
    if (key === "aggregate-only") {
      aggregateOnly = true;
      continue;
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--"))
      throw new Error(`missing-value:${key}`);
    values.set(key, value);
    index += 1;
  }
  const rangeValue = values.get("batch-range");
  let batchRange: { start: number; end: number } | undefined;
  if (rangeValue) {
    const match = /^(\d+):(\d+)$/u.exec(rangeValue);
    if (!match) throw new Error("french-codex-proposer-batch-range-format");
    batchRange = { start: Number(match[1]), end: Number(match[2]) };
  }
  const positiveInteger = (key: string, fallback?: number): number => {
    const raw = values.get(key);
    if (raw === undefined) {
      if (fallback === undefined) throw new Error(`missing-value:${key}`);
      return fallback;
    }
    if (!/^[1-9]\d*$/u.test(raw)) {
      throw new Error(`invalid-positive-integer:${key}:${raw}`);
    }
    return Number(raw);
  };
  return {
    manifestPath: resolve(values.get("manifest") ?? DEFAULT_MANIFEST),
    configurationPath: resolve(
      values.get("configuration") ?? DEFAULT_CONFIGURATION
    ),
    outputDir: resolve(values.get("output-dir") ?? DEFAULT_OUTPUT_DIR),
    codexBinary: resolve(values.get("codex-binary") ?? DEFAULT_CODEX_BINARY),
    codexHome: resolve(values.get("codex-home") ?? DEFAULT_CODEX_HOME),
    proposerA: {
      model: values.get("a-model") ?? "gpt-5.6-luna",
      reasoningEffort: values.get("a-reasoning-effort") ?? "medium"
    },
    proposerB: {
      model: values.get("b-model") ?? "gpt-5.6-sol",
      reasoningEffort: values.get("b-reasoning-effort") ?? "low"
    },
    concurrency: positiveInteger("concurrency", 4),
    maxAttempts: positiveInteger("max-attempts", 2),
    timeoutMs: positiveInteger("timeout-ms", 20 * 60 * 1000),
    ...(values.has("expected-entries")
      ? { expectedEntries: positiveInteger("expected-entries") }
      : {}),
    selection: {
      ...(values.has("batch-ids")
        ? {
            batchIds: values
              .get("batch-ids")!
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean)
          }
        : {}),
      ...(batchRange ? { batchRange } : {}),
      ...(values.has("shard-ids")
        ? {
            shardIds: values
              .get("shard-ids")!
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean)
          }
        : {}),
      aggregateOnly
    },
    expectedCodexVersion: values.get("codex-version") ?? DEFAULT_CODEX_VERSION,
    expectedCodexSha256: values.get("codex-sha256") ?? DEFAULT_CODEX_SHA256
  };
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  runLexiconV3FrenchCodexPilotProposers(
    parseFrenchCodexProposersArgs(process.argv.slice(2))
  )
    .then((summary) => {
      process.stdout.write(
        `${JSON.stringify(
          {
            event: "french-codex-proposers-complete",
            runKind: summary.runKind,
            namespace: summary.namespace,
            coverage: summary.coverage,
            counts: summary.counts,
            usage: summary.usage,
            outputs: summary.outputs,
            summaryHash: summary.summaryHash
          },
          null,
          2
        )}\n`
      );
    })
    .catch((error: unknown) => {
      process.stderr.write(
        `${basename(process.argv[1] ?? "runLexiconV3FrenchCodexPilotProposers")}: ${
          error instanceof Error ? error.message : String(error)
        }\n`
      );
      process.exitCode = 1;
    });
}
