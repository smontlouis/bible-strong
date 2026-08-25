import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  assertFrenchInternalConfigurationMatchesManifest,
  readFrenchInternalArbiterArtifacts,
  readFrenchInternalAuditorArtifacts,
  readFrenchInternalProposerArtifacts,
  type FrenchInternalArbiterArtifact,
  type FrenchInternalAuditorArtifact
} from "./assembleLexiconV3FrenchInternalReview.js";
import {
  assertFrenchCodexAdjudicationBatchManifest,
  buildLexiconV3FrenchCodexAdjudicationBatches,
  type BuildFrenchCodexAdjudicationBatchesOptions,
  type FrenchCodexAdjudicationBatchManifest,
  type FrenchCodexAdjudicationBatchRecord,
  type FrenchCodexAdjudicationRole,
  type FrenchCodexAdjudicationView
} from "./buildLexiconV3FrenchCodexAdjudicationBatches.js";
import type { FrenchCodexPilotBatchRecord } from "./buildLexiconV3FrenchCodexPilotBatches.js";
import {
  assertFrenchCodexAnyBatchManifest,
  type FrenchCodexAnyBatchManifest,
  type FrenchCodexManifestContext
} from "./buildLexiconV3FrenchCodexBatches.js";
import {
  FRENCH_CODEX_EXECUTOR_POLICY_VERSION,
  FRENCH_CODEX_PROPOSER_RUN_SCHEMA_VERSION,
  buildFrenchCodexProposerPrompt,
  type FrenchCodexProposerRun
} from "./runLexiconV3FrenchCodexProposerBatch.js";
import {
  buildLexiconV3FrenchInternalArbiterWork,
  buildLexiconV3FrenchInternalAuditorWork,
  finalizeLexiconV3FrenchInternalArbiterDrafts,
  finalizeLexiconV3FrenchInternalAuditorDrafts,
  frenchInternalAdjudicationViewHash
} from "./lexiconV3FrenchInternalAdjudication.js";
import {
  assertFrenchInternalArbiterDraft,
  assertFrenchInternalAuditorDraft,
  FRENCH_INTERNAL_PROPOSER_DRAFT_SCHEMA_VERSION,
  type FrenchInternalArbiterDraft,
  type FrenchInternalAuditorDraft
} from "../src/lexiconV3/frenchAgentDrafts.js";
import {
  FRENCH_INTERNAL_ROLE_PROMPTS,
  frenchInternalPromptHash
} from "../src/lexiconV3/frenchAgentPrompts.js";
import {
  FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE,
  FRENCH_INTERNAL_EXECUTION_RECEIPT_SCHEMA_VERSION,
  FRENCH_INTERNAL_PINNED_CODEX_SHA256,
  FRENCH_INTERNAL_PINNED_CODEX_VERSION,
  canonicalFrenchInternalJson,
  finalizeFrenchInternalExecutionReceipt,
  hashFrenchInternalJson,
  type FrenchInternalExecutionReceipt,
  type FrenchInternalRole
} from "../src/lexiconV3/frenchInternalReview.js";
import {
  assertFrenchCodexImmutableBinary,
  ensureFrenchCodexImmutableBinary,
  FRENCH_CODEX_IMMUTABLE_BINARY_PATH,
  prepareFrenchCodexImmutableExecution
} from "../src/lexiconV3/frenchCodexImmutableBinary.js";
import {
  acquireFrenchCodexSqliteLockWithTimeout,
  FrenchCodexLockBusyError,
  frenchCodexSqliteLockIsActive
} from "../src/lexiconV3/frenchCodexSqliteLock.js";

export const FRENCH_CODEX_ADJUDICATION_RUN_SCHEMA_VERSION =
  "lexicon-v3-french-codex-adjudication-run@2" as const;
export const FRENCH_CODEX_ADJUDICATION_EXECUTOR_POLICY_VERSION =
  "lexicon-v3-french-codex-executor-policy@3" as const;
export const FRENCH_CODEX_ADJUDICATION_AGGREGATE_SCHEMA_VERSION =
  "lexicon-v3-french-codex-adjudication-aggregate@2" as const;
export const FRENCH_CODEX_PILOT_ADJUDICATION_SUMMARY_SCHEMA_VERSION =
  "lexicon-v3-french-codex-pilot-adjudication-summary@2" as const;
export const FRENCH_CODEX_ADJUDICATION_PROGRESS_SCHEMA_VERSION =
  "lexicon-v3-french-codex-adjudication-progress@1" as const;
export const FRENCH_CODEX_EXECUTION_RECEIPTS_SUMMARY_SCHEMA_VERSION =
  "lexicon-v3-french-codex-execution-receipts-summary@1" as const;

export interface FrenchCodexAdjudicationSummaryReplay<T> {
  summary: T;
  reused: boolean;
}

/** Keep a valid legacy wall-clock timestamp without changing pinned bytes. */
export function resolveFrenchCodexAdjudicationSummaryForReplay<
  T extends { schemaVersion: string; generatedAt: string; summaryHash: string }
>(expected: T, existingText?: string): FrenchCodexAdjudicationSummaryReplay<T> {
  const { summaryHash: expectedHash, ...expectedContent } = expected;
  if (
    !isCanonicalIsoTimestamp(expected.generatedAt) ||
    expectedHash !== hashFrenchInternalJson(expectedContent)
  ) {
    throw new Error("french-codex-adjudication-expected-summary-invalid");
  }
  if (existingText === undefined) {
    return { summary: expected, reused: false };
  }

  let existing: T;
  try {
    existing = JSON.parse(existingText) as T;
  } catch {
    throw new Error("french-codex-adjudication-existing-summary-stale");
  }
  if (existing === null || typeof existing !== "object") {
    throw new Error("french-codex-adjudication-existing-summary-stale");
  }
  const { summaryHash, ...existingContent } = existing;
  const { generatedAt: expectedGeneratedAt, ...expectedStable } =
    expectedContent;
  const { generatedAt: existingGeneratedAt, ...existingStable } =
    existingContent;
  void expectedGeneratedAt;
  void existingGeneratedAt;
  if (
    existing.schemaVersion !== expected.schemaVersion ||
    !isCanonicalIsoTimestamp(existing.generatedAt) ||
    summaryHash !== hashFrenchInternalJson(existingContent) ||
    canonicalFrenchInternalJson(existingStable) !==
      canonicalFrenchInternalJson(expectedStable)
  ) {
    throw new Error("french-codex-adjudication-existing-summary-stale");
  }
  return { summary: existing, reused: true };
}

function isCanonicalIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function latestCanonicalIsoTimestamp(values: readonly string[]): string {
  if (
    values.length === 0 ||
    values.some((value) => !isCanonicalIsoTimestamp(value))
  ) {
    throw new Error("french-codex-adjudication-summary-timestamp-invalid");
  }
  return [...values]
    .sort(
      (left, right) =>
        Date.parse(left) - Date.parse(right) || left.localeCompare(right)
    )
    .at(-1)!;
}

const DEFAULT_ROOT = "outputs/lexicon-v3/fr-internal";
const DEFAULT_PILOT_ROOT = `${DEFAULT_ROOT}/pilot`;
const DEFAULT_CODEX_BINARY = FRENCH_CODEX_IMMUTABLE_BINARY_PATH;
const DEFAULT_CODEX_HOME = `${DEFAULT_ROOT}/codex-agent-home`;
const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000;
const DEFAULT_CODEX_VERSION = "codex-cli 0.144.0-alpha.4";
const DEFAULT_CODEX_SHA256 =
  "e48ce8a0455b97ba25aa6b373f694ad7788f960c4bfc311f68b6d5bf7121f2f4";
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const THREAD_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const DISABLED_CODEX_FEATURES = [
  "apps",
  "browser_use",
  "browser_use_external",
  "code_mode",
  "code_mode_host",
  "computer_use",
  "goals",
  "hooks",
  "image_generation",
  "in_app_browser",
  "multi_agent",
  "plugins",
  "shell_snapshot",
  "shell_tool",
  "skill_mcp_dependency_install",
  "standalone_web_search",
  "tool_suggest",
  "unified_exec",
  "workspace_dependencies"
] as const;
const SEALED_ENVIRONMENT_POLICY = {
  keys: [
    "CODEX_HOME",
    "HOME",
    "LANG",
    "LC_ALL",
    "LOGNAME",
    "NO_COLOR",
    "PATH",
    "SHELL",
    "TERM",
    "TMPDIR",
    "USER"
  ],
  fixed: {
    HOME: "<codex-home>",
    CODEX_HOME: "<codex-home>",
    SHELL: "/bin/zsh",
    PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
    TERM: "dumb",
    NO_COLOR: "1"
  },
  inheritedWithSafeFallback: ["USER", "LOGNAME", "TMPDIR"]
} as const;

type Phase = "all" | FrenchCodexAdjudicationRole;

export interface FrenchCodexAdjudicationProfile {
  model: string;
  reasoningEffort: string;
}

interface AgentUsage {
  input_tokens?: number;
  cached_input_tokens?: number;
  output_tokens?: number;
  reasoning_output_tokens?: number;
}

interface CodexBinaryIdentity {
  path: string;
  sha256: string;
  version: string;
}

export interface FrenchCodexAdjudicationRun {
  schemaVersion: typeof FRENCH_CODEX_ADJUDICATION_RUN_SCHEMA_VERSION;
  executorPolicyVersion: typeof FRENCH_CODEX_ADJUDICATION_EXECUTOR_POLICY_VERSION;
  batchId: string;
  role: FrenchCodexAdjudicationRole;
  taskName: string;
  agentId: string;
  threadId: string;
  model: string;
  reasoningEffort: string;
  sandbox: "read-only";
  externalTools: "disabled";
  executor: CodexBinaryIdentity;
  capabilities: {
    localTools: "disabled";
    networkDataTools: "disabled";
    shell: "disabled";
    eventPolicy: "agent-message-only";
    sealedWorkingDirectory: string;
    disabledFeaturesHash: string;
    environmentPolicyHash: string;
  };
  startedAt: string;
  completedAt: string;
  promptHash: string;
  rolePromptHash: string;
  sourceHashes: {
    manifestFile: string;
    manifest: string;
    batch: string;
    input: string;
    outputSchema: string;
    selection: string;
    packets: string;
    proposerA: string;
    proposerB: string;
    configuration: string;
    arbiterViews?: string;
    arbiters?: string;
  };
  resultHashes: {
    agentEvents: string;
    agentStderr: string;
    structuredResponse: string;
    drafts: string;
    artifacts: string;
    artifactSummary: string;
  };
  counts: {
    expected: number;
    drafts: number;
    artifacts: number;
  };
  usage: AgentUsage | null;
  runHash: string;
}

export interface FrenchCodexAdjudicationAggregateSummary {
  schemaVersion: typeof FRENCH_CODEX_ADJUDICATION_AGGREGATE_SCHEMA_VERSION;
  role: FrenchCodexAdjudicationRole;
  generatedAt: string;
  manifestHash: string;
  manifestFileHash: string;
  profile: FrenchCodexAdjudicationProfile;
  counts: {
    entries: number;
    batches: number;
    distinctAgentThreads: number;
    accept?: number;
    reviewNeeded?: number;
    safe?: number;
    hold?: number;
    block?: number;
  };
  usage: {
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    reasoningOutputTokens: number;
  };
  output: {
    path: string;
    sha256: string;
    bytes: number;
    logicalDigest: string;
  };
  attestationLinks: {
    path: string;
    sha256: string;
    bytes: number;
    records: number;
    logicalDigest: string;
  };
  upstreamProofDigest: string;
  runHashesDigest: string;
  summaryHash: string;
}

export interface FrenchCodexExecutionReceiptsSummary {
  schemaVersion: typeof FRENCH_CODEX_EXECUTION_RECEIPTS_SUMMARY_SCHEMA_VERSION;
  namespace: string;
  releaseKey: string;
  releaseSnapshotFingerprint: string;
  selectionHash: string;
  keyOrderHash: string;
  coverage: "exact";
  profiles: typeof FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE;
  sourcePaths: {
    proposerManifest: string;
    proposerSummary: string;
    proposerRuns: string;
    proposerAttestationLinks: string;
    arbiterManifest: string;
    arbiterSummary: string;
    arbiterAttestationLinks: string;
    auditorManifest: string;
    auditorSummary: string;
    auditorAttestationLinks: string;
  };
  sourceDigests: Record<
    keyof FrenchCodexExecutionReceiptsSummary["sourcePaths"],
    string
  >;
  counts: {
    entries: number;
    receipts: number;
    distinctThreads: number;
  };
  output: {
    path: string;
    sha256: string;
    bytes: number;
    records: number;
    logicalDigest: string;
  };
  summaryHash: string;
}

export interface RunFrenchCodexPilotAdjudicationOptions {
  phase: Phase;
  packetsPath: string;
  proposerAPath: string;
  proposerBPath: string;
  configurationPath: string;
  selectionPath: string;
  outputDir: string;
  proposerRunsPath: string;
  proposerSummaryPath: string;
  proposerBatchManifestPath: string;
  codexBinary: string;
  codexHome: string;
  arbiter: FrenchCodexAdjudicationProfile;
  auditor: FrenchCodexAdjudicationProfile;
  concurrency: number;
  maxAttempts: number;
  timeoutMs: number;
  expectedEntries: number;
  arbiterMaxItems: number;
  auditorMaxItems: number;
  maxInputBytes: number;
  rebuildBatches: boolean;
  forceRuns: boolean;
  expectedCodexVersion: string;
  expectedCodexSha256: string;
  namespace: string;
  batchSelection: {
    batchIds?: string[];
    batchRange?: { start: number; end: number };
    aggregateOnly: boolean;
  };
}

interface CodexExecution {
  threadId: string;
  stdout: string;
  stderr: string;
  responseText: string;
  usage: AgentUsage | null;
  startedAt: string;
  completedAt: string;
}

interface Failure {
  batchId: string;
  role: FrenchCodexAdjudicationRole;
  attempts: number;
  error: string;
}

interface ProposerAttestationVerification {
  entries: number;
  runs: number;
  summaryHash: string;
  proofDigest: string;
  linksPath: string;
  linksSha256: string;
  verifiedGeneratedAt: string;
}

interface ProposerAggregateFile {
  path: string;
  sha256: string;
  bytes: number;
  records: number;
  logicalDigest: string;
}

interface ProposerSummaryV2 {
  schemaVersion: "lexicon-v3-french-codex-proposer-summary@3";
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
  profiles: Record<"proposerA" | "proposerB", FrenchCodexAdjudicationProfile>;
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
  usage: Record<string, number>;
  outputs: {
    proposerA: ProposerAggregateFile;
    proposerB: ProposerAggregateFile;
    runs: ProposerAggregateFile;
  };
  runHashesDigest: string;
  summaryHash: string;
}

export function verifyFrenchCodexProposerAttestations(
  options: RunFrenchCodexPilotAdjudicationOptions
): ProposerAttestationVerification {
  for (const path of [
    options.proposerBatchManifestPath,
    options.proposerSummaryPath,
    options.proposerRunsPath,
    options.proposerAPath,
    options.proposerBPath,
    options.configurationPath
  ]) {
    if (!existsSync(path)) {
      throw new Error(`french-codex-proposer-attestation-missing:${path}`);
    }
  }
  const manifestText = readFileSync(options.proposerBatchManifestPath, "utf8");
  const manifest = JSON.parse(manifestText) as FrenchCodexAnyBatchManifest;
  const manifestContext = assertFrenchCodexAnyBatchManifest(manifest, {
    verifyFiles: true,
    expectedEntries: options.expectedEntries
  });
  assertFrenchInternalConfigurationMatchesManifest(
    manifestContext,
    options.configurationPath
  );
  if (
    resolve(options.packetsPath) !==
    resolve(manifestContext.selectedPackets.path)
  ) {
    throw new Error("french-codex-adjudication-selected-packets-mismatch");
  }
  const summary = JSON.parse(
    readFileSync(options.proposerSummaryPath, "utf8")
  ) as ProposerSummaryV2;
  const { summaryHash, ...summaryContent } = summary;
  if (
    options.namespace !== manifestContext.namespace ||
    summary.schemaVersion !== "lexicon-v3-french-codex-proposer-summary@3" ||
    !isCanonicalIsoTimestamp(summary.generatedAt) ||
    !SHA256_PATTERN.test(summaryHash) ||
    hashFrenchInternalJson(summaryContent) !== summaryHash ||
    summary.manifestHash !== manifest.manifestHash ||
    summary.sourceManifestDigest !== sha256(manifestText) ||
    summary.runKind !== manifestContext.runKind ||
    summary.namespace !== manifestContext.namespace ||
    summary.selectionHash !== manifestContext.selectionHash ||
    summary.keyOrderHash !== manifestContext.keyOrderHash ||
    summary.coverage !== "exact" ||
    summary.selectedBatchIds.length !== manifest.batches.length ||
    summary.selectedBatchIds.some(
      (id, index) => id !== manifest.batches[index]?.batchId
    ) ||
    summary.selectedBatchIdsHash !==
      hashFrenchInternalJson(
        manifest.batches.map((batch) => ({
          batchId: batch.batchId,
          batchHash: batch.batchHash
        }))
      ) ||
    summary.counts.entries !== options.expectedEntries ||
    summary.counts.batches !== manifest.batches.length ||
    summary.counts.jobs !== manifest.batches.length * 2 ||
    summary.counts.proposerA !== options.expectedEntries ||
    summary.counts.proposerB !== options.expectedEntries ||
    summary.counts.distinctAgentThreads !== summary.counts.jobs
  ) {
    throw new Error("french-codex-proposer-summary-invalid");
  }
  assertProposerAggregateFile(
    summary.outputs.proposerA,
    options.proposerAPath,
    options.expectedEntries,
    "proposerA"
  );
  assertProposerAggregateFile(
    summary.outputs.proposerB,
    options.proposerBPath,
    options.expectedEntries,
    "proposerB"
  );
  assertProposerAggregateFile(
    summary.outputs.runs,
    options.proposerRunsPath,
    manifest.batches.length * 2,
    "runs"
  );

  const runs = readJsonlStrict<FrenchCodexProposerRun>(
    options.proposerRunsPath,
    "proposer-run"
  );
  const runByJob = new Map<string, FrenchCodexProposerRun>();
  const executor = codexBinaryIdentity(options);
  for (const run of runs) {
    const jobKey = `${run.batchId}:${run.role}`;
    const batch = manifest.batches.find(
      (candidate) => candidate.batchId === run.batchId
    );
    if (
      runByJob.has(jobKey) ||
      !batch ||
      (run.role !== "proposerA" && run.role !== "proposerB")
    ) {
      throw new Error(`french-codex-proposer-run-job-invalid:${jobKey}`);
    }
    assertProposerRun({
      run,
      batch,
      manifestText,
      configurationPath: options.configurationPath,
      profile: summary.profiles[run.role],
      executor,
      namespace: manifestContext.namespace
    });
    runByJob.set(jobKey, run);
  }
  if (
    runs.length !== manifest.batches.length * 2 ||
    runByJob.size !== runs.length ||
    new Set(runs.map((run) => run.threadId)).size !== runs.length
  ) {
    throw new Error("french-codex-proposer-run-coverage-invalid");
  }
  const expectedValidatorCounts = runs.reduce(
    (counts, run) => ({
      clean: counts.clean + run.counts.validatorClean,
      review: counts.review + run.counts.validatorReview
    }),
    { clean: 0, review: 0 }
  );
  const expectedUsage = runs.reduce(
    (usage, run) => ({
      inputTokens: usage.inputTokens + (run.usage?.input_tokens ?? 0),
      cachedInputTokens:
        usage.cachedInputTokens + (run.usage?.cached_input_tokens ?? 0),
      outputTokens: usage.outputTokens + (run.usage?.output_tokens ?? 0),
      reasoningOutputTokens:
        usage.reasoningOutputTokens + (run.usage?.reasoning_output_tokens ?? 0)
    }),
    {
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      reasoningOutputTokens: 0
    }
  );
  if (
    summary.counts.validatorClean !== expectedValidatorCounts.clean ||
    summary.counts.validatorReview !== expectedValidatorCounts.review ||
    hashFrenchInternalJson(summary.usage) !==
      hashFrenchInternalJson(expectedUsage)
  ) {
    throw new Error("french-codex-proposer-summary-totals-invalid");
  }
  for (const batch of manifest.batches) {
    for (const role of ["proposerA", "proposerB"] as const) {
      if (!runByJob.has(`${batch.batchId}:${role}`)) {
        throw new Error(
          `french-codex-proposer-run-missing:${batch.batchId}:${role}`
        );
      }
    }
  }

  const proposerA = readFrenchInternalProposerArtifacts(
    options.proposerAPath,
    "proposerA"
  ).records;
  const proposerB = readFrenchInternalProposerArtifacts(
    options.proposerBPath,
    "proposerB"
  ).records;
  const aggregateByRole = {
    proposerA: new Map(proposerA.map((record) => [record.entryKey, record])),
    proposerB: new Map(proposerB.map((record) => [record.entryKey, record]))
  };
  const expectedEntryOrder = manifest.batches.flatMap((batch) => batch.keys);
  if (
    aggregateByRole.proposerA.size !== options.expectedEntries ||
    aggregateByRole.proposerB.size !== options.expectedEntries ||
    proposerA.some(
      (record, index) => record.entryKey !== expectedEntryOrder[index]
    ) ||
    proposerB.some(
      (record, index) => record.entryKey !== expectedEntryOrder[index]
    ) ||
    summary.outputs.proposerA.logicalDigest !==
      hashFrenchInternalJson(
        proposerA.map((record) => ({
          entryKey: record.entryKey,
          inputHash: record.inputHash,
          artifactHash: record.artifactHash
        }))
      ) ||
    summary.outputs.proposerB.logicalDigest !==
      hashFrenchInternalJson(
        proposerB.map((record) => ({
          entryKey: record.entryKey,
          inputHash: record.inputHash,
          artifactHash: record.artifactHash
        }))
      )
  ) {
    throw new Error("french-codex-proposer-aggregate-coverage-invalid");
  }
  const entryProofs: Array<Record<string, unknown>> = [];
  for (const batch of manifest.batches) {
    for (const role of ["proposerA", "proposerB"] as const) {
      const run = runByJob.get(`${batch.batchId}:${role}`)!;
      const expectedHashes =
        role === "proposerA"
          ? batch.proposerAViewHashes
          : batch.proposerBViewHashes;
      const paths = proposerRunPaths(batch, role);
      const batchArtifacts = readFrenchInternalProposerArtifacts(
        paths.artifacts,
        role
      ).records;
      if (batchArtifacts.length !== batch.keys.length) {
        throw new Error(
          `french-codex-proposer-batch-artifact-cardinality:${batch.batchId}:${role}`
        );
      }
      for (const [index, artifact] of batchArtifacts.entries()) {
        const aggregate = aggregateByRole[role].get(artifact.entryKey);
        if (
          artifact.entryKey !== batch.keys[index] ||
          artifact.inputHash !== expectedHashes[index] ||
          artifact.agentId !== run.agentId ||
          artifact.taskName !== run.taskName ||
          artifact.completedAt !== run.completedAt ||
          !aggregate ||
          aggregate.artifactHash !== artifact.artifactHash
        ) {
          throw new Error(
            `french-codex-proposer-artifact-attestation-mismatch:${batch.batchId}:${role}:${index}`
          );
        }
        entryProofs.push({
          entryKey: artifact.entryKey,
          role,
          batchId: batch.batchId,
          inputHash: artifact.inputHash,
          artifactHash: artifact.artifactHash,
          agentId: run.agentId,
          taskName: run.taskName,
          completedAt: run.completedAt,
          threadId: run.threadId,
          runHash: run.runHash
        });
      }
    }
  }
  for (const entryKey of aggregateByRole.proposerA.keys()) {
    if (
      aggregateByRole.proposerA.get(entryKey)?.agentId ===
      aggregateByRole.proposerB.get(entryKey)?.agentId
    ) {
      throw new Error(`french-codex-proposer-agent-collision:${entryKey}`);
    }
  }
  const sortedRunProofs = runs
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
    );
  if (
    summary.runHashesDigest !== hashFrenchInternalJson(sortedRunProofs) ||
    summary.outputs.runs.logicalDigest !==
      hashFrenchInternalJson(
        runs.map((run) => ({
          batchId: run.batchId,
          role: run.role,
          agentId: run.agentId,
          threadId: run.threadId,
          runHash: run.runHash
        }))
      )
  ) {
    throw new Error("french-codex-proposer-run-digest-mismatch");
  }
  const sortedEntryProofs = entryProofs.sort((left, right) =>
    `${String(left.entryKey)}:${String(left.role)}`.localeCompare(
      `${String(right.entryKey)}:${String(right.role)}`
    )
  );
  const linksText = `${sortedEntryProofs
    .map((record) => JSON.stringify(record))
    .join("\n")}\n`;
  const linksPath = resolve(
    options.outputDir,
    "proposer-attestation-links.jsonl"
  );
  installTextAtomically(linksPath, linksText);
  return {
    entries: options.expectedEntries,
    runs: runs.length,
    summaryHash,
    proofDigest: hashFrenchInternalJson(sortedEntryProofs),
    linksPath,
    linksSha256: sha256(linksText),
    verifiedGeneratedAt: summary.generatedAt
  };
}

function assertProposerAggregateFile(
  artifact: ProposerAggregateFile,
  expectedPath: string,
  expectedRecords: number,
  label: string
): void {
  if (
    resolve(artifact.path) !== resolve(expectedPath) ||
    !existsSync(expectedPath) ||
    artifact.sha256 !== sha256File(expectedPath) ||
    artifact.bytes !== readFileSync(expectedPath).byteLength ||
    artifact.records !== expectedRecords ||
    !SHA256_PATTERN.test(artifact.logicalDigest)
  ) {
    throw new Error(`french-codex-proposer-aggregate-file-invalid:${label}`);
  }
}

function assertProposerRun(input: {
  run: FrenchCodexProposerRun;
  batch: FrenchCodexPilotBatchRecord;
  manifestText: string;
  configurationPath: string;
  profile: FrenchCodexAdjudicationProfile;
  executor: CodexBinaryIdentity;
  namespace: string;
}): void {
  const { run, batch } = input;
  const paths = proposerRunPaths(batch, run.role);
  const { runHash, ...content } = run;
  const expectedPrompt = buildExpectedProposerPrompt(
    run.role,
    batch,
    paths.input
  );
  const expectedCapabilities = {
    localTools: "disabled",
    networkDataTools: "disabled",
    shell: "disabled",
    eventPolicy: "agent-message-only",
    sealedWorkingDirectory: resolve(dirname(paths.input)),
    disabledFeaturesHash: hashFrenchInternalJson(DISABLED_CODEX_FEATURES),
    environmentPolicyHash: hashFrenchInternalJson(SEALED_ENVIRONMENT_POLICY)
  };
  if (
    run.schemaVersion !== FRENCH_CODEX_PROPOSER_RUN_SCHEMA_VERSION ||
    run.executorPolicyVersion !== FRENCH_CODEX_EXECUTOR_POLICY_VERSION ||
    run.batchId !== batch.batchId ||
    run.taskName !== `${input.namespace}/${run.role}/${batch.batchId}` ||
    run.agentId !== `codex-agent:${run.threadId}` ||
    !THREAD_ID_PATTERN.test(run.threadId) ||
    run.model !== input.profile.model ||
    run.reasoningEffort !== input.profile.reasoningEffort ||
    run.sandbox !== "read-only" ||
    run.capabilities?.localTools !== "disabled" ||
    run.capabilities?.networkDataTools !== "disabled" ||
    run.capabilities?.shell !== "disabled" ||
    run.capabilities?.eventPolicy !== "agent-message-only" ||
    run.capabilities?.sealedWorkingDirectory !==
      resolve(dirname(paths.input)) ||
    run.capabilities?.disabledFeaturesHash !==
      hashFrenchInternalJson(DISABLED_CODEX_FEATURES) ||
    run.capabilities?.environmentPolicyHash !==
      hashFrenchInternalJson(SEALED_ENVIRONMENT_POLICY) ||
    hashFrenchInternalJson(run.capabilities) !==
      hashFrenchInternalJson(expectedCapabilities) ||
    hashFrenchInternalJson(run.executor) !==
      hashFrenchInternalJson(input.executor) ||
    run.promptHash !== sha256(expectedPrompt) ||
    run.rolePromptHash !== frenchInternalPromptHash(run.role) ||
    run.sourceHashes.manifest !== sha256(input.manifestText) ||
    run.sourceHashes.batch !== batch.batchHash ||
    run.sourceHashes.input !== sha256File(paths.input) ||
    run.sourceHashes.schema !== sha256File(paths.schema) ||
    run.sourceHashes.packets !== sha256File(batch.inputs.packets.path) ||
    run.sourceHashes.configuration !== sha256File(input.configurationPath) ||
    run.counts.expected !== batch.keys.length ||
    run.counts.drafts !== batch.keys.length ||
    run.counts.artifacts !== batch.keys.length ||
    run.counts.validatorClean + run.counts.validatorReview !==
      batch.keys.length ||
    !Number.isInteger(run.counts.validatorClean) ||
    !Number.isInteger(run.counts.validatorReview) ||
    run.counts.validatorClean < 0 ||
    run.counts.validatorReview < 0 ||
    !Number.isFinite(Date.parse(run.startedAt)) ||
    !Number.isFinite(Date.parse(run.completedAt)) ||
    Date.parse(run.startedAt) > Date.parse(run.completedAt) ||
    !SHA256_PATTERN.test(runHash) ||
    hashFrenchInternalJson(content) !== runHash
  ) {
    throw new Error(
      `french-codex-proposer-run-invalid:${batch.batchId}:${run.role}`
    );
  }
  const resultFiles: Array<[string, string]> = [
    [paths.events, run.resultHashes.agentEvents],
    [paths.stderr, run.resultHashes.agentStderr],
    [paths.response, run.resultHashes.structuredResponse],
    [paths.drafts, run.resultHashes.drafts],
    [paths.artifacts, run.resultHashes.artifacts],
    [paths.artifactSummary, run.resultHashes.artifactSummary]
  ];
  for (const [path, digest] of resultFiles) {
    if (!existsSync(path) || sha256File(path) !== digest) {
      throw new Error(
        `french-codex-proposer-run-result-stale:${batch.batchId}:${run.role}:${path}`
      );
    }
  }
  const response = readFileSync(paths.response, "utf8");
  const eventProof = parseFrenchCodexThreadEvents(
    readFileSync(paths.events, "utf8"),
    response
  );
  if (eventProof.threadId !== run.threadId) {
    throw new Error(
      `french-codex-proposer-thread-mismatch:${batch.batchId}:${run.role}`
    );
  }
  const artifacts = readFrenchInternalProposerArtifacts(
    paths.artifacts,
    run.role
  ).records;
  const expectedHashes =
    run.role === "proposerA"
      ? batch.proposerAViewHashes
      : batch.proposerBViewHashes;
  if (artifacts.length !== batch.keys.length) {
    throw new Error(
      `french-codex-proposer-run-artifact-cardinality:${batch.batchId}:${run.role}`
    );
  }
  for (const [index, artifact] of artifacts.entries()) {
    if (
      artifact.entryKey !== batch.keys[index] ||
      artifact.inputHash !== expectedHashes[index] ||
      artifact.agentId !== run.agentId ||
      artifact.taskName !== run.taskName ||
      artifact.completedAt !== run.completedAt
    ) {
      throw new Error(
        `french-codex-proposer-run-artifact-lineage:${batch.batchId}:${run.role}:${index}`
      );
    }
  }
}

function proposerRunPaths(
  batch: FrenchCodexPilotBatchRecord,
  role: "proposerA" | "proposerB"
) {
  const isA = role === "proposerA";
  const input = isA ? batch.inputs.proposerA : batch.inputs.proposerB;
  const schema = isA ? batch.schemas.proposerA : batch.schemas.proposerB;
  const prefix = isA ? "proposer-a" : "proposer-b";
  const directory = dirname(input.path);
  return {
    input: input.path,
    schema: schema.path,
    response: resolve(directory, `${prefix}-structured-response.json`),
    events: resolve(directory, `${prefix}-agent-events.jsonl`),
    stderr: resolve(directory, `${prefix}-agent-stderr.log`),
    drafts: resolve(directory, `${prefix}-drafts.jsonl`),
    artifacts: resolve(directory, `${prefix}-artifacts.jsonl`),
    artifactSummary: resolve(directory, `${prefix}-artifacts.summary.json`)
  };
}

function buildExpectedProposerPrompt(
  role: "proposerA" | "proposerB",
  batch: FrenchCodexPilotBatchRecord,
  inputPath: string
): string {
  return buildFrenchCodexProposerPrompt(role, batch, inputPath);
}

function readJsonlStrict<T>(path: string, label: string): T[] {
  const result: T[] = [];
  for (const [index, line] of readFileSync(path, "utf8")
    .split(/\r?\n/u)
    .entries()) {
    if (!line.trim()) continue;
    try {
      result.push(JSON.parse(line) as T);
    } catch {
      throw new Error(`french-codex-${label}-invalid-json:${index + 1}`);
    }
  }
  if (result.length === 0) throw new Error(`french-codex-${label}-empty`);
  return result;
}

export async function runLexiconV3FrenchCodexPilotAdjudication(
  options: RunFrenchCodexPilotAdjudicationOptions
): Promise<{
  arbiter?: FrenchCodexAdjudicationAggregateSummary;
  auditor?: FrenchCodexAdjudicationAggregateSummary;
  executionReceipts?: FrenchCodexExecutionReceiptsSummary;
  summaryPath: string;
}> {
  assertOptions(options);
  ensureFrenchCodexImmutableBinary({ requestedPath: options.codexBinary });
  mkdirSync(options.outputDir, { recursive: true });
  const release = await acquireExclusiveLock(
    resolve(options.outputDir, "adjudication-orchestrator.lock"),
    Math.min(options.timeoutMs, 60_000)
  );
  try {
    return await runLexiconV3FrenchCodexPilotAdjudicationUnlocked(options);
  } finally {
    release();
  }
}

async function runLexiconV3FrenchCodexPilotAdjudicationUnlocked(
  options: RunFrenchCodexPilotAdjudicationOptions
): Promise<{
  arbiter?: FrenchCodexAdjudicationAggregateSummary;
  auditor?: FrenchCodexAdjudicationAggregateSummary;
  executionReceipts?: FrenchCodexExecutionReceiptsSummary;
  summaryPath: string;
}> {
  const proposerVerification = verifyFrenchCodexProposerAttestations(options);
  const { verifiedGeneratedAt: proposerGeneratedAt, ...proposerProof } =
    proposerVerification;
  let arbiterSummary: FrenchCodexAdjudicationAggregateSummary | undefined;
  let auditorSummary: FrenchCodexAdjudicationAggregateSummary | undefined;

  if (options.phase === "all" || options.phase === "arbiter") {
    const paths = rolePaths(options.outputDir, "arbiter");
    const viewSummary = await buildLexiconV3FrenchInternalArbiterWork({
      packetsPath: options.packetsPath,
      proposerAPath: options.proposerAPath,
      proposerBPath: options.proposerBPath,
      configurationPath: options.configurationPath,
      selectionPath: options.selectionPath,
      outputPath: paths.views,
      summaryPath: paths.viewSummary
    });
    assertExpectedEntries(viewSummary.counts.records, options);
    const manifest = await ensureManifest(options, "arbiter");
    const result = await runRoleBatches(options, manifest);
    if (result.completeCoverage) {
      arbiterSummary = aggregateRole(
        manifest,
        result.runs,
        options.arbiter,
        paths.artifacts,
        paths.aggregateSummary
      );
    }
  }

  if (options.phase === "all" || options.phase === "auditor") {
    const arbiterPaths = rolePaths(options.outputDir, "arbiter");
    if (!existsSync(arbiterPaths.artifacts)) {
      throw new Error("french-codex-auditor-requires-aggregate-arbiters");
    }
    const arbiterManifest = await ensureManifest(options, "arbiter");
    verifyFrenchCodexAdjudicationAggregate(
      options,
      arbiterManifest,
      arbiterPaths.artifacts,
      arbiterPaths.aggregateSummary
    );
    const paths = rolePaths(options.outputDir, "auditor");
    const viewSummary = await buildLexiconV3FrenchInternalAuditorWork({
      packetsPath: options.packetsPath,
      proposerAPath: options.proposerAPath,
      proposerBPath: options.proposerBPath,
      configurationPath: options.configurationPath,
      selectionPath: options.selectionPath,
      arbiterViewsPath: arbiterPaths.views,
      arbiterPath: arbiterPaths.artifacts,
      outputPath: paths.views,
      summaryPath: paths.viewSummary
    });
    assertExpectedEntries(viewSummary.counts.records, options);
    const manifest = await ensureManifest(options, "auditor");
    const result = await runRoleBatches(options, manifest);
    if (result.completeCoverage) {
      auditorSummary = aggregateRole(
        manifest,
        result.runs,
        options.auditor,
        paths.artifacts,
        paths.aggregateSummary
      );
    }
  }

  const executionReceipts =
    arbiterSummary && auditorSummary
      ? buildFrenchCodexExecutionReceipts({
          options,
          proposerProof,
          arbiterSummary,
          auditorSummary
        })
      : undefined;
  const summaryRoot = adjudicationRunOutputRoot(options);
  const summaryPath = resolve(summaryRoot, "adjudication-summary.json");
  const content = {
    schemaVersion: FRENCH_CODEX_PILOT_ADJUDICATION_SUMMARY_SCHEMA_VERSION,
    generatedAt: latestCanonicalIsoTimestamp([
      proposerGeneratedAt,
      ...(arbiterSummary ? [arbiterSummary.generatedAt] : []),
      ...(auditorSummary ? [auditorSummary.generatedAt] : [])
    ]),
    namespace: options.namespace,
    phase: options.phase,
    expectedEntries: options.expectedEntries,
    batchSelection: options.batchSelection,
    profiles: { arbiter: options.arbiter, auditor: options.auditor },
    proposerProof,
    outputs: {
      ...(arbiterSummary
        ? {
            arbiter: {
              summaryHash: arbiterSummary.summaryHash,
              output: arbiterSummary.output
            }
          }
        : {}),
      ...(auditorSummary
        ? {
            auditor: {
              summaryHash: auditorSummary.summaryHash,
              output: auditorSummary.output
            }
          }
        : {}),
      ...(executionReceipts
        ? {
            executionReceipts: {
              summaryHash: executionReceipts.summaryHash,
              output: executionReceipts.output
            }
          }
        : {})
    }
  };
  const expectedSummary = {
    ...content,
    summaryHash: hashFrenchInternalJson(content)
  };
  const replay = resolveFrenchCodexAdjudicationSummaryForReplay(
    expectedSummary,
    existsSync(summaryPath) ? readFileSync(summaryPath, "utf8") : undefined
  );
  if (!replay.reused) {
    installTextAtomically(
      summaryPath,
      `${JSON.stringify(replay.summary, null, 2)}\n`
    );
  }
  return {
    arbiter: arbiterSummary,
    auditor: auditorSummary,
    executionReceipts,
    summaryPath
  };
}

export async function runFrenchCodexAdjudicationBatch(input: {
  options: RunFrenchCodexPilotAdjudicationOptions;
  manifest: FrenchCodexAdjudicationBatchManifest;
  manifestText: string;
  batch: FrenchCodexAdjudicationBatchRecord;
}): Promise<FrenchCodexAdjudicationRun> {
  const release = await acquireExclusiveLock(
    `${input.batch.expected.runPath}.lock`,
    input.options.timeoutMs
  );
  try {
    return await runFrenchCodexAdjudicationBatchUnlocked(input);
  } finally {
    release();
  }
}

async function runFrenchCodexAdjudicationBatchUnlocked(input: {
  options: RunFrenchCodexPilotAdjudicationOptions;
  manifest: FrenchCodexAdjudicationBatchManifest;
  manifestText: string;
  batch: FrenchCodexAdjudicationBatchRecord;
}): Promise<FrenchCodexAdjudicationRun> {
  const { options, manifest, manifestText, batch } = input;
  const profile = options[batch.role];
  assertBatchFiles(batch);
  if (!existsSync(options.configurationPath)) {
    throw new Error("french-codex-adjudication-configuration-missing");
  }
  if (!existsSync(options.codexBinary)) {
    throw new Error(`french-codex-binary-missing:${options.codexBinary}`);
  }
  const executor = codexBinaryIdentity(options);
  if (!options.forceRuns && existsSync(batch.expected.runPath)) {
    return assertExistingRun({
      path: batch.expected.runPath,
      options,
      manifest,
      manifestText,
      batch
    });
  }
  if (options.batchSelection.aggregateOnly) {
    throw new Error(
      `french-codex-adjudication-existing-run-missing:${batch.batchId}`
    );
  }
  if (!existsSync(resolve(options.codexHome, "auth.json"))) {
    throw new Error(`french-codex-agent-auth-missing:${options.codexHome}`);
  }
  const views = readAndValidateViews(batch);
  const prompt = buildFrenchCodexAdjudicationPrompt(
    batch.role,
    batch,
    readFileSync(batch.input.path, "utf8")
  );
  const responseTemp = `${batch.expected.responsePath}.tmp-${process.pid}-${Date.now()}`;
  const execution = await executeCodex({
    options,
    role: batch.role,
    prompt,
    schemaPath: batch.outputSchema.path,
    responsePath: responseTemp,
    failureDir: dirname(batch.expected.runPath),
    batchId: batch.batchId
  });
  assertCodexBinaryUnchanged(options, executor);
  const drafts = parseFrenchCodexAdjudicationResponse(
    execution.responseText,
    batch.role,
    batch,
    views
  );
  const draftsText = `${drafts.map((draft) => JSON.stringify(draft)).join("\n")}\n`;
  installFilesAtomically([
    {
      path: batch.expected.responsePath,
      text: `${execution.responseText.trim()}\n`
    },
    { path: batch.expected.eventsPath, text: execution.stdout },
    { path: batch.expected.stderrPath, text: execution.stderr },
    { path: batch.expected.draftsPath, text: draftsText }
  ]);
  rmSync(responseTemp, { force: true });

  const agentId = `codex-agent:${execution.threadId}`;
  const taskName = `${manifest.namespace}/${batch.role}/${batch.batchId}`;
  assertFrenchCodexAdjudicationAgentSeparation(batch, agentId);
  const artifactSummary =
    batch.role === "arbiter"
      ? await finalizeLexiconV3FrenchInternalArbiterDrafts({
          packetsPath: batch.context.packets.path,
          proposerAPath: batch.context.proposerA.path,
          proposerBPath: batch.context.proposerB.path,
          configurationPath: options.configurationPath,
          selectionPath: batch.selection.path,
          viewsPath: batch.input.path,
          draftsPath: batch.expected.draftsPath,
          outputPath: batch.expected.artifactsPath,
          summaryPath: batch.expected.artifactSummaryPath,
          agentId,
          taskName,
          completedAt: execution.completedAt
        })
      : await finalizeLexiconV3FrenchInternalAuditorDrafts({
          packetsPath: batch.context.packets.path,
          proposerAPath: batch.context.proposerA.path,
          proposerBPath: batch.context.proposerB.path,
          configurationPath: options.configurationPath,
          selectionPath: batch.selection.path,
          arbiterViewsPath: batch.context.arbiterViews!.path,
          arbiterPath: batch.context.arbiters!.path,
          viewsPath: batch.input.path,
          draftsPath: batch.expected.draftsPath,
          outputPath: batch.expected.artifactsPath,
          summaryPath: batch.expected.artifactSummaryPath,
          agentId,
          taskName,
          completedAt: execution.completedAt
        });
  assertFinalizedArtifacts(batch, {
    agentId,
    taskName,
    completedAt: execution.completedAt
  });

  const content = {
    schemaVersion: FRENCH_CODEX_ADJUDICATION_RUN_SCHEMA_VERSION,
    executorPolicyVersion: FRENCH_CODEX_ADJUDICATION_EXECUTOR_POLICY_VERSION,
    batchId: batch.batchId,
    role: batch.role,
    taskName,
    agentId,
    threadId: execution.threadId,
    model: profile.model,
    reasoningEffort: profile.reasoningEffort,
    sandbox: "read-only" as const,
    externalTools: "disabled" as const,
    executor,
    capabilities: {
      localTools: "disabled" as const,
      networkDataTools: "disabled" as const,
      shell: "disabled" as const,
      eventPolicy: "agent-message-only" as const,
      sealedWorkingDirectory: resolve(dirname(batch.input.path)),
      disabledFeaturesHash: hashFrenchInternalJson(DISABLED_CODEX_FEATURES),
      environmentPolicyHash: hashFrenchInternalJson(SEALED_ENVIRONMENT_POLICY)
    },
    startedAt: execution.startedAt,
    completedAt: execution.completedAt,
    promptHash: sha256(prompt),
    rolePromptHash: frenchInternalPromptHash(batch.role),
    sourceHashes: sourceHashes(
      manifest,
      manifestText,
      batch,
      options.configurationPath
    ),
    resultHashes: {
      agentEvents: sha256File(batch.expected.eventsPath),
      agentStderr: sha256File(batch.expected.stderrPath),
      structuredResponse: sha256File(batch.expected.responsePath),
      drafts: sha256File(batch.expected.draftsPath),
      artifacts: sha256File(batch.expected.artifactsPath),
      artifactSummary: sha256File(batch.expected.artifactSummaryPath)
    },
    counts: {
      expected: batch.keys.length,
      drafts: drafts.length,
      artifacts: artifactSummary.counts.records
    },
    usage: execution.usage
  };
  const run: FrenchCodexAdjudicationRun = {
    ...content,
    runHash: hashFrenchInternalJson(content)
  };
  installTextAtomically(
    batch.expected.runPath,
    `${JSON.stringify(run, null, 2)}\n`
  );
  return run;
}

export function buildFrenchCodexAdjudicationPrompt(
  role: FrenchCodexAdjudicationRole,
  batch: FrenchCodexAdjudicationBatchRecord,
  sealedViews: string
): string {
  const roleSpecific =
    role === "arbiter"
      ? `Pour chaque vue, choisis uniquement proposalA ou proposalB. Il est interdit de fusionner, corriger ou réécrire. verdict=accept exige reasons=[]; sinon utilise review_needed et des raisons précises.`
      : `Pour chaque vue, rends exactement les douze contrôles demandés. safe exige douze pass, reasons=[], et confidence>=0.90. Toute incertitude donne hold; toute erreur de source, identité ou contenu protégé donne block. Tu n'as pas le droit de réécrire la traduction.`;
  return `${FRENCH_INTERNAL_ROLE_PROMPTS[role]}

PROTOCOLE D'EXÉCUTION SCELLÉ :
- Aucun outil, réseau, web, plugin, application, fichier ou sous-agent n'est autorisé. Tout le contexte utilisable est inclus ci-dessous.
- Les vues JSONL scellées sont incluses intégralement et contiennent exactement ${batch.keys.length} vues ${role}, dans l'ordre.
- Une vue est l'entrée exacte du rôle. inputHash doit être égal octet pour octet à viewHash.
- ${roleSpecific}
- Rends exactement un draft par clé, sans doublon ni omission, et uniquement l'objet JSON imposé par le schéma. Aucun Markdown ni commentaire.

CLÉS ATTENDUES, DANS CET ORDRE :
${batch.keys.join("\n")}

<sealed_views_jsonl>
${sealedViews}</sealed_views_jsonl>`;
}

export function parseFrenchCodexAdjudicationResponse(
  text: string,
  role: FrenchCodexAdjudicationRole,
  batch: FrenchCodexAdjudicationBatchRecord,
  views: Map<string, FrenchCodexAdjudicationView>
): Array<FrenchInternalArbiterDraft | FrenchInternalAuditorDraft> {
  let root: unknown;
  try {
    root = JSON.parse(text) as unknown;
  } catch {
    throw new Error("french-codex-adjudication-response-invalid-json");
  }
  if (
    !isObject(root) ||
    Object.keys(root).length !== 1 ||
    !Array.isArray(root.drafts)
  ) {
    throw new Error("french-codex-adjudication-response-invalid-root");
  }
  if (root.drafts.length !== batch.keys.length) {
    throw new Error(
      `french-codex-adjudication-draft-cardinality:${root.drafts.length}:${batch.keys.length}`
    );
  }
  const rawByKey = new Map<string, unknown>();
  for (const raw of root.drafts) {
    if (!isObject(raw) || typeof raw.entryKey !== "string") {
      throw new Error("french-codex-adjudication-draft-key-missing");
    }
    if (rawByKey.has(raw.entryKey)) {
      throw new Error(
        `french-codex-adjudication-draft-duplicate:${raw.entryKey}`
      );
    }
    rawByKey.set(raw.entryKey, raw);
  }
  return batch.keys.map((entryKey) => {
    const view = views.get(entryKey);
    const raw = rawByKey.get(entryKey);
    if (!view || !raw) {
      throw new Error(`french-codex-adjudication-draft-missing:${entryKey}`);
    }
    return role === "arbiter"
      ? assertFrenchInternalArbiterDraft(raw, entryKey, view.viewHash)
      : assertFrenchInternalAuditorDraft(raw, entryKey, view.viewHash);
  });
}

export function frenchCodexAdjudicationExecArgs(input: {
  model: string;
  reasoningEffort: string;
  schemaPath: string;
  responsePath: string;
  cwd: string;
}): string[] {
  return [
    "exec",
    "--ignore-user-config",
    "--ignore-rules",
    "--ephemeral",
    "--skip-git-repo-check",
    "-m",
    input.model,
    "-c",
    `model_reasoning_effort=${JSON.stringify(input.reasoningEffort)}`,
    ...DISABLED_CODEX_FEATURES.flatMap((feature) => ["--disable", feature]),
    "-s",
    "read-only",
    "--json",
    "--output-schema",
    resolve(input.schemaPath),
    "-o",
    resolve(input.responsePath),
    "-C",
    resolve(input.cwd),
    "-"
  ];
}

export function parseFrenchCodexThreadEvents(
  stdout: string,
  structuredResponse?: string
): {
  threadId: string;
  usage: AgentUsage | null;
} {
  let threadId: string | null = null;
  let usage: AgentUsage | null = null;
  let state:
    | "expect-thread"
    | "expect-turn"
    | "expect-message"
    | "messages"
    | "complete" = "expect-thread";
  const messages: string[] = [];
  for (const [index, line] of stdout.split(/\r?\n/u).entries()) {
    if (!line.trim()) continue;
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(line) as Record<string, unknown>;
    } catch {
      throw new Error(
        `french-codex-adjudication-event-invalid-json:${index + 1}`
      );
    }
    if (event.type === "thread.started") {
      if (
        state !== "expect-thread" ||
        typeof event.thread_id !== "string" ||
        !THREAD_ID_PATTERN.test(event.thread_id)
      ) {
        throw new Error("french-codex-adjudication-thread-event-invalid");
      }
      threadId = event.thread_id;
      state = "expect-turn";
      continue;
    }
    if (event.type === "turn.started") {
      if (state !== "expect-turn") {
        throw new Error("french-codex-adjudication-turn-start-event-invalid");
      }
      state = "expect-message";
      continue;
    }
    if (event.type === "item.completed") {
      if (
        (state !== "expect-message" && state !== "messages") ||
        !isObject(event.item) ||
        event.item.type !== "agent_message" ||
        typeof event.item.text !== "string"
      ) {
        throw new Error("french-codex-adjudication-item-event-forbidden");
      }
      messages.push(event.item.text);
      state = "messages";
      continue;
    }
    if (event.type === "turn.completed") {
      if (state !== "messages") {
        throw new Error(
          "french-codex-adjudication-turn-complete-event-invalid"
        );
      }
      if (event.usage !== undefined && !isObject(event.usage)) {
        throw new Error("french-codex-adjudication-usage-invalid");
      }
      usage = isObject(event.usage) ? (event.usage as AgentUsage) : null;
      state = "complete";
      continue;
    }
    throw new Error(
      `french-codex-adjudication-event-forbidden:${String(event.type)}`
    );
  }
  if (state !== "complete" || !threadId || messages.length < 1) {
    throw new Error("french-codex-adjudication-event-sequence-incomplete");
  }
  if (
    structuredResponse !== undefined &&
    normalizeAgentMessage(messages.at(-1) ?? "") !==
      normalizeAgentMessage(structuredResponse)
  ) {
    throw new Error("french-codex-adjudication-response-message-mismatch");
  }
  return { threadId, usage };
}

async function executeCodex(input: {
  options: RunFrenchCodexPilotAdjudicationOptions;
  role: FrenchCodexAdjudicationRole;
  prompt: string;
  schemaPath: string;
  responsePath: string;
  failureDir: string;
  batchId: string;
}): Promise<CodexExecution> {
  mkdirSync(dirname(input.responsePath), { recursive: true });
  rmSync(input.responsePath, { force: true });
  const profile = input.options[input.role];
  const sealedCwd = resolve(dirname(input.schemaPath));
  const startedAt = new Date().toISOString();
  const executable = prepareFrenchCodexImmutableExecution(
    input.options.codexBinary
  );
  let child;
  try {
    child = spawn(
      executable.executionPath,
      frenchCodexAdjudicationExecArgs({
        model: profile.model,
        reasoningEffort: profile.reasoningEffort,
        schemaPath: input.schemaPath,
        responsePath: input.responsePath,
        cwd: sealedCwd
      }),
      {
        cwd: sealedCwd,
        env: buildSealedCodexEnvironment(input.options.codexHome),
        stdio: ["pipe", "pipe", "pipe"],
        detached: process.platform !== "win32"
      }
    );
  } catch (error) {
    executable.dispose();
    throw error;
  }
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });
  child.stdin.end(input.prompt);
  let timedOut = false;
  let exitCode: number;
  try {
    exitCode = await new Promise<number>((resolveExit, reject) => {
      let killTimer: ReturnType<typeof setTimeout> | undefined;
      const timeout = setTimeout(() => {
        timedOut = true;
        signalChildProcessGroup(child.pid, "SIGTERM");
        killTimer = setTimeout(
          () => signalChildProcessGroup(child.pid, "SIGKILL"),
          2_000
        );
      }, input.options.timeoutMs);
      child.on("error", (error) => {
        clearTimeout(timeout);
        if (killTimer) clearTimeout(killTimer);
        reject(error);
      });
      child.on("close", (code) => {
        clearTimeout(timeout);
        if (killTimer) clearTimeout(killTimer);
        resolveExit(code ?? -1);
      });
    });
  } finally {
    try {
      executable.assertUnchanged();
    } finally {
      executable.dispose();
    }
  }
  const completedAt = new Date().toISOString();
  if (timedOut || exitCode !== 0 || !existsSync(input.responsePath)) {
    const nonce = `${Date.now()}-${process.pid}`;
    installFilesAtomically([
      {
        path: join(
          input.failureDir,
          `${input.role}-${input.batchId}-${nonce}.failed-events.jsonl`
        ),
        text: stdout
      },
      {
        path: join(
          input.failureDir,
          `${input.role}-${input.batchId}-${nonce}.failed-stderr.log`
        ),
        text: stderr
      }
    ]);
    throw new Error(
      timedOut
        ? `french-codex-adjudication-timeout:${input.options.timeoutMs}`
        : `french-codex-adjudication-agent-failed:${exitCode}`
    );
  }
  const responseText = readFileSync(input.responsePath, "utf8");
  const parsed = parseFrenchCodexThreadEvents(stdout, responseText);
  return {
    threadId: parsed.threadId,
    stdout,
    stderr,
    responseText,
    usage: parsed.usage,
    startedAt,
    completedAt
  };
}

async function runRoleBatches(
  options: RunFrenchCodexPilotAdjudicationOptions,
  manifest: FrenchCodexAdjudicationBatchManifest
): Promise<{
  runs: FrenchCodexAdjudicationRun[];
  completeCoverage: boolean;
}> {
  const manifestPath = resolve(
    options.outputDir,
    "agent-batches",
    manifest.role,
    "manifest.json"
  );
  const manifestText = readFileSync(manifestPath, "utf8");
  const selected = selectFrenchCodexAdjudicationBatches(
    manifest.batches,
    options.batchSelection
  );
  const completeCoverage = selected.length === manifest.batches.length;
  if (options.batchSelection.aggregateOnly && !completeCoverage) {
    throw new Error(
      "french-codex-adjudication-aggregate-only-requires-full-coverage"
    );
  }
  const jobs = selected.map((batch) => ({ batch, attempts: 0 }));
  const queue = [...jobs];
  const completed: FrenchCodexAdjudicationRun[] = [];
  const failures: Failure[] = [];
  const progressPath = resolve(
    adjudicationRunOutputRoot(options),
    `${manifest.role}-progress.json`
  );
  const worker = async (): Promise<void> => {
    while (queue.length > 0) {
      const job = queue.shift();
      if (!job) return;
      job.attempts += 1;
      try {
        const run = await runFrenchCodexAdjudicationBatch({
          options,
          manifest,
          manifestText,
          batch: job.batch
        });
        completed.push(run);
        process.stdout.write(
          `${JSON.stringify({
            event: "french-codex-adjudication-batch-complete",
            role: manifest.role,
            batchId: job.batch.batchId,
            entries: run.counts.artifacts,
            completed: completed.length,
            total: jobs.length
          })}\n`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (job.attempts < options.maxAttempts && !message.includes("stale")) {
          queue.push(job);
        } else {
          failures.push({
            batchId: job.batch.batchId,
            role: manifest.role,
            attempts: job.attempts,
            error: message
          });
        }
      }
      writeProgress(progressPath, manifest, jobs.length, completed, failures);
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(options.concurrency, Math.max(1, jobs.length)) },
      () => worker()
    )
  );
  if (failures.length > 0 || completed.length !== jobs.length) {
    throw new Error(
      `french-codex-adjudication-incomplete:${manifest.role}:${completed.length}:${failures.length}:${jobs.length}`
    );
  }
  if (new Set(completed.map((run) => run.threadId)).size !== completed.length) {
    throw new Error(`french-codex-adjudication-thread-reuse:${manifest.role}`);
  }
  return {
    runs: completed.sort((left, right) =>
      left.batchId.localeCompare(right.batchId)
    ),
    completeCoverage
  };
}

async function ensureManifest(
  options: RunFrenchCodexPilotAdjudicationOptions,
  role: FrenchCodexAdjudicationRole
): Promise<FrenchCodexAdjudicationBatchManifest> {
  const paths = rolePaths(options.outputDir, role);
  const release = await acquireExclusiveLock(
    `${paths.batchDir}.build.lock`,
    Math.min(options.timeoutMs, 60_000)
  );
  try {
    return ensureManifestUnlocked(options, role);
  } finally {
    release();
  }
}

function ensureManifestUnlocked(
  options: RunFrenchCodexPilotAdjudicationOptions,
  role: FrenchCodexAdjudicationRole
): FrenchCodexAdjudicationBatchManifest {
  const paths = rolePaths(options.outputDir, role);
  const batchOptions: BuildFrenchCodexAdjudicationBatchesOptions = {
    role,
    namespace: options.namespace,
    viewsPath: paths.views,
    viewSummaryPath: paths.viewSummary,
    packetsPath: options.packetsPath,
    proposerAPath: options.proposerAPath,
    proposerBPath: options.proposerBPath,
    configurationPath: options.configurationPath,
    proposerRunsPath: options.proposerRunsPath,
    proposerSummaryPath: options.proposerSummaryPath,
    proposerBatchManifestPath: options.proposerBatchManifestPath,
    proposerAttestationLinksPath: resolve(
      options.outputDir,
      "proposer-attestation-links.jsonl"
    ),
    arbiterViewsPath:
      role === "auditor"
        ? rolePaths(options.outputDir, "arbiter").views
        : undefined,
    arbiterPath:
      role === "auditor"
        ? rolePaths(options.outputDir, "arbiter").artifacts
        : undefined,
    arbiterSummaryPath:
      role === "auditor"
        ? rolePaths(options.outputDir, "arbiter").aggregateSummary
        : undefined,
    outputDir: paths.batchDir,
    maxItems:
      role === "arbiter" ? options.arbiterMaxItems : options.auditorMaxItems,
    maxInputBytes: options.maxInputBytes,
    replaceExisting: options.rebuildBatches
  };
  const manifestPath = join(paths.batchDir, "manifest.json");
  if (existsSync(manifestPath) && !options.rebuildBatches) {
    const manifest = JSON.parse(
      readFileSync(manifestPath, "utf8")
    ) as FrenchCodexAdjudicationBatchManifest;
    assertFrenchCodexAdjudicationBatchManifest(manifest);
    if (manifest.counts.entries !== options.expectedEntries) {
      throw new Error(
        `french-codex-adjudication-manifest-entry-count:${manifest.counts.entries}:${options.expectedEntries}`
      );
    }
    assertManifestCurrent(manifest, batchOptions);
    for (const batch of manifest.batches) assertBatchFiles(batch);
    return manifest;
  }
  if (existsSync(manifestPath) && options.rebuildBatches) {
    const previous = JSON.parse(
      readFileSync(manifestPath, "utf8")
    ) as FrenchCodexAdjudicationBatchManifest;
    assertFrenchCodexAdjudicationBatchManifest(previous);
    for (const batch of previous.batches) {
      const lockPath = `${batch.expected.runPath}.lock`;
      if (existsSync(lockPath) && frenchCodexSqliteLockIsActive(lockPath)) {
        throw new Error(
          `french-codex-adjudication-rebuild-active-run:${batch.batchId}`
        );
      }
    }
  }
  const manifest = buildLexiconV3FrenchCodexAdjudicationBatches(batchOptions);
  if (manifest.counts.entries !== options.expectedEntries) {
    throw new Error(
      `french-codex-adjudication-manifest-entry-count:${manifest.counts.entries}:${options.expectedEntries}`
    );
  }
  return manifest;
}

function assertManifestCurrent(
  manifest: FrenchCodexAdjudicationBatchManifest,
  options: BuildFrenchCodexAdjudicationBatchesOptions
): void {
  const expectedPaths = {
    views: resolve(options.viewsPath),
    viewSummary: resolve(options.viewSummaryPath),
    packets: resolve(options.packetsPath),
    proposerA: resolve(options.proposerAPath),
    proposerB: resolve(options.proposerBPath),
    configuration: resolve(options.configurationPath),
    proposerRuns: resolve(options.proposerRunsPath!),
    proposerSummary: resolve(options.proposerSummaryPath!),
    proposerBatchManifest: resolve(options.proposerBatchManifestPath!),
    proposerAttestationLinks: resolve(options.proposerAttestationLinksPath!),
    ...(options.role === "auditor"
      ? {
          arbiterViews: resolve(options.arbiterViewsPath!),
          arbiters: resolve(options.arbiterPath!),
          arbiterSummary: resolve(options.arbiterSummaryPath!)
        }
      : {})
  };
  if (
    manifest.role !== options.role ||
    manifest.namespace !== options.namespace ||
    manifest.batching.maxItems !== options.maxItems ||
    manifest.batching.maxInputBytes !== options.maxInputBytes ||
    hashFrenchInternalJson(manifest.sourcePaths) !==
      hashFrenchInternalJson(expectedPaths)
  ) {
    throw new Error("french-codex-adjudication-manifest-stale-options");
  }
  for (const [key, path] of Object.entries(expectedPaths)) {
    if (!existsSync(path) || manifest.sourceDigests[key] !== sha256File(path)) {
      throw new Error(`french-codex-adjudication-manifest-stale-source:${key}`);
    }
  }
}

function aggregateRole(
  manifest: FrenchCodexAdjudicationBatchManifest,
  runs: FrenchCodexAdjudicationRun[],
  profile: FrenchCodexAdjudicationProfile,
  outputPath: string,
  summaryPath: string
): FrenchCodexAdjudicationAggregateSummary {
  const runByBatch = new Map(runs.map((run) => [run.batchId, run]));
  const records: Array<
    FrenchInternalArbiterArtifact | FrenchInternalAuditorArtifact
  > = [];
  const attestationLinks: Array<Record<string, unknown>> = [];
  for (const batch of manifest.batches) {
    const run = runByBatch.get(batch.batchId);
    if (!run) {
      throw new Error(
        `french-codex-adjudication-aggregate-run-missing:${batch.batchId}`
      );
    }
    assertRunResultFiles(run, batch);
    const batchRecords =
      manifest.role === "arbiter"
        ? readFrenchInternalArbiterArtifacts(batch.expected.artifactsPath)
            .records
        : readFrenchInternalAuditorArtifacts(batch.expected.artifactsPath)
            .records;
    if (batchRecords.length !== batch.keys.length) {
      throw new Error(
        `french-codex-adjudication-aggregate-cardinality:${batch.batchId}`
      );
    }
    for (const [index, record] of batchRecords.entries()) {
      if (
        record.entryKey !== batch.keys[index] ||
        record.inputHash !== batch.viewHashes[index] ||
        record.agentId !== run.agentId ||
        record.taskName !== run.taskName ||
        record.completedAt !== run.completedAt
      ) {
        throw new Error(
          `french-codex-adjudication-aggregate-lineage:${batch.batchId}:${index}`
        );
      }
      records.push(record);
      attestationLinks.push({
        entryKey: record.entryKey,
        role: manifest.role,
        batchId: batch.batchId,
        inputHash: record.inputHash,
        artifactHash: record.artifactHash,
        agentId: run.agentId,
        taskName: run.taskName,
        completedAt: run.completedAt,
        threadId: run.threadId,
        runHash: run.runHash
      });
    }
  }
  const keys = manifest.batches.flatMap((batch) => batch.keys);
  if (
    records.length !== manifest.counts.entries ||
    hashFrenchInternalJson(records.map((record) => record.entryKey)) !==
      hashFrenchInternalJson(keys)
  ) {
    throw new Error("french-codex-adjudication-aggregate-coverage");
  }
  const outputText = `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
  const linksText = `${attestationLinks
    .map((record) => JSON.stringify(record))
    .join("\n")}\n`;
  const linksPath = resolve(
    dirname(outputPath),
    `${manifest.role}-attestation-links.jsonl`
  );
  const usage = sumUsage(runs);
  const verdicts = records.reduce(
    (counts, record) => {
      if (record.role === "arbiter") {
        if (record.verdict === "accept") counts.accept += 1;
        else counts.reviewNeeded += 1;
      } else counts[record.verdict] += 1;
      return counts;
    },
    { accept: 0, reviewNeeded: 0, safe: 0, hold: 0, block: 0 }
  );
  const manifestPath = resolve(
    dirname(manifest.batches[0]!.input.path),
    "..",
    "manifest.json"
  );
  const content = {
    schemaVersion: FRENCH_CODEX_ADJUDICATION_AGGREGATE_SCHEMA_VERSION,
    role: manifest.role,
    generatedAt: [...runs]
      .map((run) => run.completedAt)
      .sort()
      .at(-1)!,
    manifestHash: manifest.manifestHash,
    manifestFileHash: sha256File(manifestPath),
    profile,
    counts: {
      entries: records.length,
      batches: manifest.batches.length,
      distinctAgentThreads: new Set(runs.map((run) => run.threadId)).size,
      ...(manifest.role === "arbiter"
        ? { accept: verdicts.accept, reviewNeeded: verdicts.reviewNeeded }
        : {
            safe: verdicts.safe,
            hold: verdicts.hold,
            block: verdicts.block
          })
    },
    usage,
    output: {
      path: resolve(outputPath),
      sha256: sha256(outputText),
      bytes: Buffer.byteLength(outputText),
      logicalDigest: hashFrenchInternalJson(
        records.map((record) => ({
          entryKey: record.entryKey,
          inputHash: record.inputHash,
          agentId: record.agentId,
          artifactHash: record.artifactHash
        }))
      )
    },
    attestationLinks: {
      path: linksPath,
      sha256: sha256(linksText),
      bytes: Buffer.byteLength(linksText),
      records: attestationLinks.length,
      logicalDigest: hashFrenchInternalJson(attestationLinks)
    },
    upstreamProofDigest: hashFrenchInternalJson(manifest.sourceDigests),
    runHashesDigest: hashFrenchInternalJson(
      runs.map((run) => ({
        batchId: run.batchId,
        agentId: run.agentId,
        runHash: run.runHash
      }))
    )
  };
  const summary: FrenchCodexAdjudicationAggregateSummary = {
    ...content,
    summaryHash: hashFrenchInternalJson(content)
  };
  installFilesAtomically([
    { path: outputPath, text: outputText },
    { path: linksPath, text: linksText },
    { path: summaryPath, text: `${JSON.stringify(summary, null, 2)}\n` }
  ]);
  return summary;
}

export function buildFrenchCodexExecutionReceipts(input: {
  options: RunFrenchCodexPilotAdjudicationOptions;
  proposerProof: Omit<ProposerAttestationVerification, "verifiedGeneratedAt">;
  arbiterSummary: FrenchCodexAdjudicationAggregateSummary;
  auditorSummary: FrenchCodexAdjudicationAggregateSummary;
}): FrenchCodexExecutionReceiptsSummary {
  const { options } = input;
  assertApprovedExecutionProfile(options);
  const proposerManifestText = readFileSync(
    options.proposerBatchManifestPath,
    "utf8"
  );
  const proposerManifest = JSON.parse(
    proposerManifestText
  ) as FrenchCodexAnyBatchManifest;
  const proposerContext = assertFrenchCodexAnyBatchManifest(proposerManifest, {
    verifyFiles: true,
    expectedEntries: options.expectedEntries
  });
  const arbiterManifestPath = resolve(
    options.outputDir,
    "agent-batches",
    "arbiter",
    "manifest.json"
  );
  const auditorManifestPath = resolve(
    options.outputDir,
    "agent-batches",
    "auditor",
    "manifest.json"
  );
  const arbiterManifest = JSON.parse(
    readFileSync(arbiterManifestPath, "utf8")
  ) as FrenchCodexAdjudicationBatchManifest;
  const auditorManifest = JSON.parse(
    readFileSync(auditorManifestPath, "utf8")
  ) as FrenchCodexAdjudicationBatchManifest;
  assertFrenchCodexAdjudicationBatchManifest(arbiterManifest);
  assertFrenchCodexAdjudicationBatchManifest(auditorManifest);
  if (
    arbiterManifest.namespace !== proposerContext.namespace ||
    auditorManifest.namespace !== proposerContext.namespace ||
    arbiterManifest.counts.entries !== options.expectedEntries ||
    auditorManifest.counts.entries !== options.expectedEntries
  ) {
    throw new Error("french-codex-execution-receipt-manifest-lineage");
  }
  verifyFrenchCodexAdjudicationAggregate(
    options,
    arbiterManifest,
    rolePaths(options.outputDir, "arbiter").artifacts,
    rolePaths(options.outputDir, "arbiter").aggregateSummary
  );
  verifyFrenchCodexAdjudicationAggregate(
    options,
    auditorManifest,
    rolePaths(options.outputDir, "auditor").artifacts,
    rolePaths(options.outputDir, "auditor").aggregateSummary
  );

  const proposerRuns = readJsonlStrict<FrenchCodexProposerRun>(
    options.proposerRunsPath,
    "execution-proposer-run"
  );
  const adjudicationRuns = [arbiterManifest, auditorManifest].flatMap(
    (manifest) =>
      manifest.batches.map(
        (batch) =>
          JSON.parse(
            readFileSync(batch.expected.runPath, "utf8")
          ) as FrenchCodexAdjudicationRun
      )
  );
  const runByJob = new Map<
    string,
    FrenchCodexProposerRun | FrenchCodexAdjudicationRun
  >();
  for (const run of [...proposerRuns, ...adjudicationRuns]) {
    const key = `${run.role}:${run.batchId}`;
    if (runByJob.has(key)) {
      throw new Error(`french-codex-execution-receipt-run-duplicate:${key}`);
    }
    runByJob.set(key, run);
  }
  const linkPaths = {
    proposerA: input.proposerProof.linksPath,
    proposerB: input.proposerProof.linksPath,
    arbiter: input.arbiterSummary.attestationLinks.path,
    auditor: input.auditorSummary.attestationLinks.path
  } as const;
  const proposerLinks = readJsonlStrict<Record<string, unknown>>(
    input.proposerProof.linksPath,
    "execution-proposer-link"
  );
  const linksByRole: Record<
    FrenchInternalRole,
    Array<Record<string, unknown>>
  > = {
    proposerA: proposerLinks.filter((link) => link.role === "proposerA"),
    proposerB: proposerLinks.filter((link) => link.role === "proposerB"),
    arbiter: readJsonlStrict<Record<string, unknown>>(
      linkPaths.arbiter,
      "execution-arbiter-link"
    ),
    auditor: readJsonlStrict<Record<string, unknown>>(
      linkPaths.auditor,
      "execution-auditor-link"
    )
  };
  const expectedOrder = proposerManifest.batches.flatMap((batch) => batch.keys);
  const receipts: FrenchInternalExecutionReceipt[] = [];
  for (const entryKey of expectedOrder) {
    for (const role of [
      "proposerA",
      "proposerB",
      "arbiter",
      "auditor"
    ] as const) {
      const link = linksByRole[role].find(
        (candidate) => candidate.entryKey === entryKey
      );
      if (!link || typeof link.batchId !== "string") {
        throw new Error(
          `french-codex-execution-receipt-link-missing:${entryKey}:${role}`
        );
      }
      const run = runByJob.get(`${role}:${link.batchId}`);
      if (
        !run ||
        link.agentId !== run.agentId ||
        link.taskName !== run.taskName ||
        link.completedAt !== run.completedAt ||
        link.threadId !== run.threadId ||
        link.runHash !== run.runHash ||
        typeof link.inputHash !== "string" ||
        typeof link.artifactHash !== "string"
      ) {
        throw new Error(
          `french-codex-execution-receipt-link-run-mismatch:${entryKey}:${role}`
        );
      }
      const manifestHash =
        role === "proposerA" || role === "proposerB"
          ? proposerManifest.manifestHash
          : role === "arbiter"
            ? arbiterManifest.manifestHash
            : auditorManifest.manifestHash;
      if (
        run.executor.version !== FRENCH_INTERNAL_PINNED_CODEX_VERSION ||
        run.executor.sha256 !== FRENCH_INTERNAL_PINNED_CODEX_SHA256
      ) {
        throw new Error(`french-codex-execution-receipt-binary:${role}`);
      }
      let receiptSourcePaths: Record<string, string>;
      let receiptResultPaths: Record<string, string>;
      if (role === "proposerA" || role === "proposerB") {
        const batch = proposerManifest.batches.find(
          (candidate) => candidate.batchId === link.batchId
        );
        if (!batch) {
          throw new Error(
            `french-codex-execution-receipt-batch-missing:${role}:${link.batchId}`
          );
        }
        const isA = role === "proposerA";
        const inputArtifact = isA
          ? batch.inputs.proposerA
          : batch.inputs.proposerB;
        const schemaArtifact = isA
          ? batch.schemas.proposerA
          : batch.schemas.proposerB;
        const prefix = isA ? "proposer-a" : "proposer-b";
        const directory = dirname(inputArtifact.path);
        receiptSourcePaths = {
          manifest: resolve(options.proposerBatchManifestPath),
          input: resolve(inputArtifact.path),
          schema: resolve(schemaArtifact.path),
          packets: resolve(batch.inputs.packets.path),
          configuration: resolve(options.configurationPath),
          runPointer: resolve(directory, `${prefix}-agent-run.json`)
        };
        receiptResultPaths = {
          agentEvents: resolve(directory, `${prefix}-agent-events.jsonl`),
          agentStderr: resolve(directory, `${prefix}-agent-stderr.log`),
          structuredResponse: resolve(
            directory,
            `${prefix}-structured-response.json`
          ),
          drafts: resolve(directory, `${prefix}-drafts.jsonl`),
          artifacts: resolve(directory, `${prefix}-artifacts.jsonl`),
          artifactSummary: resolve(
            directory,
            `${prefix}-artifacts.summary.json`
          )
        };
      } else {
        const adjudicationManifest =
          role === "arbiter" ? arbiterManifest : auditorManifest;
        const adjudicationManifestPath =
          role === "arbiter" ? arbiterManifestPath : auditorManifestPath;
        const batch = adjudicationManifest.batches.find(
          (candidate) => candidate.batchId === link.batchId
        );
        if (!batch) {
          throw new Error(
            `french-codex-execution-receipt-batch-missing:${role}:${link.batchId}`
          );
        }
        receiptSourcePaths = {
          manifestFile: resolve(adjudicationManifestPath),
          input: resolve(batch.input.path),
          outputSchema: resolve(batch.outputSchema.path),
          selection: resolve(batch.selection.path),
          packets: resolve(batch.context.packets.path),
          proposerA: resolve(batch.context.proposerA.path),
          proposerB: resolve(batch.context.proposerB.path),
          configuration: resolve(options.configurationPath),
          ...(role === "auditor"
            ? {
                arbiterViews: resolve(batch.context.arbiterViews!.path),
                arbiters: resolve(batch.context.arbiters!.path)
              }
            : {}),
          runPointer: resolve(batch.expected.runPath)
        };
        receiptResultPaths = {
          agentEvents: resolve(batch.expected.eventsPath),
          agentStderr: resolve(batch.expected.stderrPath),
          structuredResponse: resolve(batch.expected.responsePath),
          drafts: resolve(batch.expected.draftsPath),
          artifacts: resolve(batch.expected.artifactsPath),
          artifactSummary: resolve(batch.expected.artifactSummaryPath)
        };
      }
      for (const path of [
        ...Object.values(receiptSourcePaths),
        ...Object.values(receiptResultPaths)
      ]) {
        if (!existsSync(path)) {
          throw new Error(
            `french-codex-execution-receipt-file-missing:${role}:${path}`
          );
        }
      }
      receipts.push(
        finalizeFrenchInternalExecutionReceipt({
          schemaVersion: FRENCH_INTERNAL_EXECUTION_RECEIPT_SCHEMA_VERSION,
          role,
          entryKey,
          batchId: link.batchId,
          namespace: proposerContext.namespace,
          manifestHash,
          selectionHash: proposerContext.selectionHash,
          inputHash: link.inputHash,
          artifactHash: link.artifactHash,
          agentId: run.agentId,
          taskName: run.taskName,
          threadId: run.threadId,
          model: run.model,
          reasoningEffort: run.reasoningEffort,
          executorPolicyVersion: run.executorPolicyVersion,
          executor: {
            path: run.executor.path,
            version: FRENCH_INTERNAL_PINNED_CODEX_VERSION,
            sha256: FRENCH_INTERNAL_PINNED_CODEX_SHA256
          },
          capabilities: run.capabilities,
          sourcePaths: receiptSourcePaths,
          sourceHashes: {
            ...run.sourceHashes,
            runPointer: sha256File(receiptSourcePaths.runPointer!)
          },
          resultPaths: receiptResultPaths,
          resultHashes: { ...run.resultHashes },
          startedAt: run.startedAt,
          completedAt: run.completedAt,
          runHash: run.runHash
        })
      );
    }
  }
  if (
    receipts.length !== options.expectedEntries * 4 ||
    new Set(receipts.map((receipt) => receipt.threadId)).size !==
      proposerRuns.length + adjudicationRuns.length
  ) {
    throw new Error("french-codex-execution-receipt-coverage");
  }
  const roleOrder: Record<FrenchInternalRole, number> = {
    proposerA: 0,
    proposerB: 1,
    arbiter: 2,
    auditor: 3
  };
  receipts.sort(
    (left, right) =>
      left.entryKey.localeCompare(right.entryKey) ||
      roleOrder[left.role] - roleOrder[right.role]
  );
  const outputPath = resolve(options.outputDir, "execution-receipts.jsonl");
  const outputText = `${receipts.map((receipt) => JSON.stringify(receipt)).join("\n")}\n`;
  const sourcePaths = {
    proposerManifest: resolve(options.proposerBatchManifestPath),
    proposerSummary: resolve(options.proposerSummaryPath),
    proposerRuns: resolve(options.proposerRunsPath),
    proposerAttestationLinks: resolve(input.proposerProof.linksPath),
    arbiterManifest: arbiterManifestPath,
    arbiterSummary: rolePaths(options.outputDir, "arbiter").aggregateSummary,
    arbiterAttestationLinks: resolve(
      input.arbiterSummary.attestationLinks.path
    ),
    auditorManifest: auditorManifestPath,
    auditorSummary: rolePaths(options.outputDir, "auditor").aggregateSummary,
    auditorAttestationLinks: resolve(input.auditorSummary.attestationLinks.path)
  };
  const sourceDigests = Object.fromEntries(
    Object.entries(sourcePaths).map(([key, path]) => [key, sha256File(path)])
  ) as FrenchCodexExecutionReceiptsSummary["sourceDigests"];
  const content = {
    schemaVersion: FRENCH_CODEX_EXECUTION_RECEIPTS_SUMMARY_SCHEMA_VERSION,
    namespace: proposerContext.namespace,
    releaseKey: proposerContext.lineage.releaseKey,
    releaseSnapshotFingerprint:
      proposerContext.lineage.releaseSnapshotFingerprint,
    selectionHash: proposerContext.selectionHash,
    keyOrderHash: proposerContext.keyOrderHash,
    coverage: "exact" as const,
    profiles: FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE,
    sourcePaths,
    sourceDigests,
    counts: {
      entries: options.expectedEntries,
      receipts: receipts.length,
      distinctThreads: new Set(receipts.map((receipt) => receipt.threadId)).size
    },
    output: {
      path: outputPath,
      sha256: sha256(outputText),
      bytes: Buffer.byteLength(outputText),
      records: receipts.length,
      logicalDigest: hashFrenchInternalJson(
        receipts.map((receipt) => ({
          entryKey: receipt.entryKey,
          role: receipt.role,
          receiptHash: receipt.receiptHash
        }))
      )
    }
  };
  const summary: FrenchCodexExecutionReceiptsSummary = {
    ...content,
    summaryHash: hashFrenchInternalJson(content)
  };
  installFilesAtomically([
    { path: outputPath, text: outputText },
    {
      path: resolve(options.outputDir, "execution-receipts.summary.json"),
      text: `${JSON.stringify(summary, null, 2)}\n`
    }
  ]);
  return summary;
}

export function verifyFrenchCodexAdjudicationAggregate(
  options: RunFrenchCodexPilotAdjudicationOptions,
  manifest: FrenchCodexAdjudicationBatchManifest,
  outputPath: string,
  summaryPath: string
): FrenchCodexAdjudicationAggregateSummary {
  if (!existsSync(outputPath) || !existsSync(summaryPath)) {
    throw new Error(
      `french-codex-adjudication-aggregate-missing:${manifest.role}`
    );
  }
  const manifestPath = resolve(
    options.outputDir,
    "agent-batches",
    manifest.role,
    "manifest.json"
  );
  const manifestText = readFileSync(manifestPath, "utf8");
  const runs = manifest.batches.map((batch) =>
    assertExistingRun({
      path: batch.expected.runPath,
      options,
      manifest,
      manifestText,
      batch
    })
  );
  const summary = JSON.parse(
    readFileSync(summaryPath, "utf8")
  ) as FrenchCodexAdjudicationAggregateSummary;
  const { summaryHash, ...content } = summary;
  const aggregateRecords =
    manifest.role === "arbiter"
      ? readFrenchInternalArbiterArtifacts(outputPath).records
      : readFrenchInternalAuditorArtifacts(outputPath).records;
  const expectedRecords: Array<
    FrenchInternalArbiterArtifact | FrenchInternalAuditorArtifact
  > = [];
  for (const batch of manifest.batches) {
    if (manifest.role === "arbiter") {
      expectedRecords.push(
        ...readFrenchInternalArbiterArtifacts(batch.expected.artifactsPath)
          .records
      );
    } else {
      expectedRecords.push(
        ...readFrenchInternalAuditorArtifacts(batch.expected.artifactsPath)
          .records
      );
    }
  }
  if (
    hashFrenchInternalJson(aggregateRecords) !==
    hashFrenchInternalJson(expectedRecords)
  ) {
    throw new Error(
      `french-codex-adjudication-aggregate-artifact-mismatch:${manifest.role}`
    );
  }
  const runByBatch = new Map(runs.map((run) => [run.batchId, run]));
  const expectedLinks = manifest.batches.flatMap((batch) => {
    const run = runByBatch.get(batch.batchId);
    if (!run) {
      throw new Error(
        `french-codex-adjudication-attestation-run-missing:${batch.batchId}`
      );
    }
    return expectedRecords
      .filter((record) => batch.keys.includes(record.entryKey))
      .sort(
        (left, right) =>
          batch.keys.indexOf(left.entryKey) - batch.keys.indexOf(right.entryKey)
      )
      .map((record) => ({
        entryKey: record.entryKey,
        role: manifest.role,
        batchId: batch.batchId,
        inputHash: record.inputHash,
        artifactHash: record.artifactHash,
        agentId: run.agentId,
        taskName: run.taskName,
        completedAt: run.completedAt,
        threadId: run.threadId,
        runHash: run.runHash
      }));
  });
  const linksPath = resolve(
    dirname(outputPath),
    `${manifest.role}-attestation-links.jsonl`
  );
  const linksText = existsSync(linksPath)
    ? readFileSync(linksPath, "utf8")
    : "";
  const actualLinks = linksText
    ? readJsonlStrict<Record<string, unknown>>(
        linksPath,
        `${manifest.role}-attestation-link`
      )
    : [];
  const expectedCounts = aggregateRecords.length;
  const expectedUsage = sumUsage(runs);
  const expectedGeneratedAt = [...runs]
    .map((run) => run.completedAt)
    .sort()
    .at(-1)!;
  const expectedVerdicts = aggregateRecords.reduce(
    (counts, record) => {
      if (record.role === "arbiter") {
        if (record.verdict === "accept") counts.accept += 1;
        else counts.reviewNeeded += 1;
      } else counts[record.verdict] += 1;
      return counts;
    },
    { accept: 0, reviewNeeded: 0, safe: 0, hold: 0, block: 0 }
  );
  if (
    summary.schemaVersion !==
      FRENCH_CODEX_ADJUDICATION_AGGREGATE_SCHEMA_VERSION ||
    summary.role !== manifest.role ||
    summary.generatedAt !== expectedGeneratedAt ||
    !SHA256_PATTERN.test(summaryHash) ||
    hashFrenchInternalJson(content) !== summaryHash ||
    summary.manifestHash !== manifest.manifestHash ||
    summary.manifestFileHash !== sha256(manifestText) ||
    hashFrenchInternalJson(summary.profile) !==
      hashFrenchInternalJson(options[manifest.role]) ||
    summary.counts.entries !== manifest.counts.entries ||
    summary.counts.entries !== expectedCounts ||
    summary.counts.batches !== manifest.counts.batches ||
    summary.counts.distinctAgentThreads !== runs.length ||
    (manifest.role === "arbiter"
      ? summary.counts.accept !== expectedVerdicts.accept ||
        summary.counts.reviewNeeded !== expectedVerdicts.reviewNeeded
      : summary.counts.safe !== expectedVerdicts.safe ||
        summary.counts.hold !== expectedVerdicts.hold ||
        summary.counts.block !== expectedVerdicts.block) ||
    hashFrenchInternalJson(summary.usage) !==
      hashFrenchInternalJson(expectedUsage) ||
    resolve(summary.output.path) !== resolve(outputPath) ||
    summary.output.sha256 !== sha256File(outputPath) ||
    summary.output.bytes !== readFileSync(outputPath).byteLength ||
    resolve(summary.attestationLinks?.path ?? "") !== linksPath ||
    summary.attestationLinks?.sha256 !== sha256(linksText) ||
    summary.attestationLinks?.bytes !== Buffer.byteLength(linksText) ||
    summary.attestationLinks?.records !== expectedLinks.length ||
    summary.attestationLinks?.logicalDigest !==
      hashFrenchInternalJson(expectedLinks) ||
    hashFrenchInternalJson(actualLinks) !==
      hashFrenchInternalJson(expectedLinks) ||
    summary.upstreamProofDigest !==
      hashFrenchInternalJson(manifest.sourceDigests) ||
    summary.output.logicalDigest !==
      hashFrenchInternalJson(
        aggregateRecords.map((record) => ({
          entryKey: record.entryKey,
          inputHash: record.inputHash,
          agentId: record.agentId,
          artifactHash: record.artifactHash
        }))
      ) ||
    summary.runHashesDigest !==
      hashFrenchInternalJson(
        runs.map((run) => ({
          batchId: run.batchId,
          agentId: run.agentId,
          runHash: run.runHash
        }))
      )
  ) {
    throw new Error(
      `french-codex-adjudication-aggregate-invalid:${manifest.role}`
    );
  }
  return summary;
}

function readAndValidateViews(
  batch: FrenchCodexAdjudicationBatchRecord
): Map<string, FrenchCodexAdjudicationView> {
  const result = new Map<string, FrenchCodexAdjudicationView>();
  const lines = readFileSync(batch.input.path, "utf8").split(/\r?\n/u);
  for (const line of lines) {
    if (!line.trim()) continue;
    const view = JSON.parse(line) as FrenchCodexAdjudicationView;
    if (
      view.role !== batch.role ||
      frenchInternalAdjudicationViewHash(view) !== view.viewHash ||
      result.has(view.entryKey)
    ) {
      throw new Error(
        `french-codex-adjudication-batch-view-invalid:${view.entryKey}`
      );
    }
    result.set(view.entryKey, view);
  }
  for (const [index, entryKey] of batch.keys.entries()) {
    if (result.get(entryKey)?.viewHash !== batch.viewHashes[index]) {
      throw new Error(
        `french-codex-adjudication-batch-view-lineage:${entryKey}`
      );
    }
  }
  if (result.size !== batch.keys.length) {
    throw new Error("french-codex-adjudication-batch-view-cardinality");
  }
  return result;
}

export function assertFrenchCodexAdjudicationAgentSeparation(
  batch: FrenchCodexAdjudicationBatchRecord,
  agentId: string
): void {
  const proposerA = new Map(
    readFrenchInternalProposerArtifacts(
      batch.context.proposerA.path,
      "proposerA"
    ).records.map((record) => [record.entryKey, record])
  );
  const proposerB = new Map(
    readFrenchInternalProposerArtifacts(
      batch.context.proposerB.path,
      "proposerB"
    ).records.map((record) => [record.entryKey, record])
  );
  const arbiters =
    batch.role === "auditor"
      ? new Map(
          readFrenchInternalArbiterArtifacts(
            batch.context.arbiters!.path
          ).records.map((record) => [record.entryKey, record])
        )
      : undefined;
  for (const entryKey of batch.keys) {
    const identities = [
      proposerA.get(entryKey)?.agentId,
      proposerB.get(entryKey)?.agentId,
      ...(arbiters ? [arbiters.get(entryKey)?.agentId] : [])
    ];
    if (
      identities.some((identity) => !identity) ||
      new Set(identities).size !== identities.length ||
      identities.includes(agentId)
    ) {
      throw new Error(`french-codex-adjudication-agent-collision:${entryKey}`);
    }
  }
}

function assertFinalizedArtifacts(
  batch: FrenchCodexAdjudicationBatchRecord,
  lineage: { agentId: string; taskName: string; completedAt: string }
): void {
  const records =
    batch.role === "arbiter"
      ? readFrenchInternalArbiterArtifacts(batch.expected.artifactsPath).records
      : readFrenchInternalAuditorArtifacts(batch.expected.artifactsPath)
          .records;
  if (records.length !== batch.keys.length) {
    throw new Error("french-codex-adjudication-finalized-cardinality");
  }
  for (const [index, record] of records.entries()) {
    if (
      record.entryKey !== batch.keys[index] ||
      record.inputHash !== batch.viewHashes[index] ||
      record.agentId !== lineage.agentId ||
      record.taskName !== lineage.taskName ||
      record.completedAt !== lineage.completedAt
    ) {
      throw new Error(
        `french-codex-adjudication-finalized-lineage:${record.entryKey}`
      );
    }
  }
}

function assertExistingRun(input: {
  path: string;
  options: RunFrenchCodexPilotAdjudicationOptions;
  manifest: FrenchCodexAdjudicationBatchManifest;
  manifestText: string;
  batch: FrenchCodexAdjudicationBatchRecord;
}): FrenchCodexAdjudicationRun {
  const run = JSON.parse(
    readFileSync(input.path, "utf8")
  ) as FrenchCodexAdjudicationRun;
  const { runHash, ...content } = run;
  const profile = input.options[input.batch.role];
  const expectedSources = sourceHashes(
    input.manifest,
    input.manifestText,
    input.batch,
    input.options.configurationPath
  );
  const expectedPrompt = buildFrenchCodexAdjudicationPrompt(
    input.batch.role,
    input.batch,
    readFileSync(input.batch.input.path, "utf8")
  );
  const expectedExecutor = codexBinaryIdentity(input.options);
  if (
    run.schemaVersion !== FRENCH_CODEX_ADJUDICATION_RUN_SCHEMA_VERSION ||
    run.executorPolicyVersion !==
      FRENCH_CODEX_ADJUDICATION_EXECUTOR_POLICY_VERSION ||
    run.batchId !== input.batch.batchId ||
    run.role !== input.batch.role ||
    run.taskName !==
      `${input.manifest.namespace}/${input.batch.role}/${input.batch.batchId}` ||
    run.model !== profile.model ||
    run.reasoningEffort !== profile.reasoningEffort ||
    run.sandbox !== "read-only" ||
    run.externalTools !== "disabled" ||
    run.capabilities?.localTools !== "disabled" ||
    run.capabilities?.networkDataTools !== "disabled" ||
    run.capabilities?.shell !== "disabled" ||
    run.capabilities?.eventPolicy !== "agent-message-only" ||
    run.capabilities?.sealedWorkingDirectory !==
      resolve(dirname(input.batch.input.path)) ||
    run.capabilities?.disabledFeaturesHash !==
      hashFrenchInternalJson(DISABLED_CODEX_FEATURES) ||
    run.capabilities?.environmentPolicyHash !==
      hashFrenchInternalJson(SEALED_ENVIRONMENT_POLICY) ||
    hashFrenchInternalJson(run.executor) !==
      hashFrenchInternalJson(expectedExecutor) ||
    run.agentId !== `codex-agent:${run.threadId}` ||
    !THREAD_ID_PATTERN.test(run.threadId) ||
    run.promptHash !== sha256(expectedPrompt) ||
    run.rolePromptHash !== frenchInternalPromptHash(input.batch.role) ||
    !SHA256_PATTERN.test(runHash) ||
    hashFrenchInternalJson(content) !== runHash ||
    hashFrenchInternalJson(run.sourceHashes) !==
      hashFrenchInternalJson(expectedSources) ||
    run.counts?.expected !== input.batch.keys.length ||
    run.counts?.drafts !== input.batch.keys.length ||
    run.counts?.artifacts !== input.batch.keys.length ||
    !Number.isFinite(Date.parse(run.startedAt)) ||
    !Number.isFinite(Date.parse(run.completedAt)) ||
    Date.parse(run.startedAt) > Date.parse(run.completedAt)
  ) {
    throw new Error(
      `french-codex-adjudication-existing-run-stale:${input.batch.batchId}`
    );
  }
  assertRunResultFiles(run, input.batch);
  const eventThread = parseFrenchCodexThreadEvents(
    readFileSync(input.batch.expected.eventsPath, "utf8"),
    readFileSync(input.batch.expected.responsePath, "utf8")
  ).threadId;
  if (eventThread !== run.threadId) {
    throw new Error(
      `french-codex-adjudication-existing-run-stale-thread:${input.batch.batchId}`
    );
  }
  assertFrenchCodexAdjudicationAgentSeparation(input.batch, run.agentId);
  assertFinalizedArtifacts(input.batch, {
    agentId: run.agentId,
    taskName: run.taskName,
    completedAt: run.completedAt
  });
  return run;
}

function assertRunResultFiles(
  run: FrenchCodexAdjudicationRun,
  batch: FrenchCodexAdjudicationBatchRecord
): void {
  const resultPaths: Array<[string, string]> = [
    [batch.expected.eventsPath, run.resultHashes.agentEvents],
    [batch.expected.stderrPath, run.resultHashes.agentStderr],
    [batch.expected.responsePath, run.resultHashes.structuredResponse],
    [batch.expected.draftsPath, run.resultHashes.drafts],
    [batch.expected.artifactsPath, run.resultHashes.artifacts],
    [batch.expected.artifactSummaryPath, run.resultHashes.artifactSummary]
  ];
  for (const [path, digest] of resultPaths) {
    if (!existsSync(path) || sha256File(path) !== digest) {
      throw new Error(
        `french-codex-adjudication-run-result-stale:${batch.batchId}:${path}`
      );
    }
  }
}

function sourceHashes(
  manifest: FrenchCodexAdjudicationBatchManifest,
  manifestText: string,
  batch: FrenchCodexAdjudicationBatchRecord,
  configurationPath: string
): FrenchCodexAdjudicationRun["sourceHashes"] {
  return {
    manifestFile: sha256(manifestText),
    manifest: manifest.manifestHash,
    batch: batch.batchHash,
    input: sha256File(batch.input.path),
    outputSchema: sha256File(batch.outputSchema.path),
    selection: sha256File(batch.selection.path),
    packets: sha256File(batch.context.packets.path),
    proposerA: sha256File(batch.context.proposerA.path),
    proposerB: sha256File(batch.context.proposerB.path),
    configuration: sha256File(configurationPath),
    ...(batch.role === "auditor"
      ? {
          arbiterViews: sha256File(batch.context.arbiterViews!.path),
          arbiters: sha256File(batch.context.arbiters!.path)
        }
      : {})
  };
}

function assertBatchFiles(batch: FrenchCodexAdjudicationBatchRecord): void {
  const files = [
    batch.input,
    batch.outputSchema,
    batch.selection,
    batch.context.packets,
    batch.context.proposerA,
    batch.context.proposerB,
    ...(batch.role === "auditor"
      ? [batch.context.arbiterViews!, batch.context.arbiters!]
      : [])
  ];
  for (const file of files) {
    if (
      !existsSync(file.path) ||
      sha256File(file.path) !== file.sha256 ||
      readFileSync(file.path).byteLength !== file.bytes
    ) {
      throw new Error(
        `french-codex-adjudication-batch-file-stale:${file.path}`
      );
    }
  }
}

function writeProgress(
  path: string,
  manifest: FrenchCodexAdjudicationBatchManifest,
  total: number,
  completed: FrenchCodexAdjudicationRun[],
  failures: Failure[]
): void {
  const content = {
    schemaVersion: FRENCH_CODEX_ADJUDICATION_PROGRESS_SCHEMA_VERSION,
    role: manifest.role,
    manifestHash: manifest.manifestHash,
    updatedAt: new Date().toISOString(),
    totalJobs: total,
    completedJobs: completed.length,
    completedEntries: completed.reduce(
      (sum, run) => sum + run.counts.artifacts,
      0
    ),
    failedJobs: failures.length,
    failures
  };
  installTextAtomically(
    path,
    `${JSON.stringify(
      { ...content, progressHash: hashFrenchInternalJson(content) },
      null,
      2
    )}\n`
  );
}

function sumUsage(runs: FrenchCodexAdjudicationRun[]) {
  return runs.reduce(
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
}

function rolePaths(outputDir: string, role: FrenchCodexAdjudicationRole) {
  return {
    views: resolve(outputDir, `${role}-input.jsonl`),
    viewSummary: resolve(outputDir, `${role}-input.summary.json`),
    artifacts: resolve(outputDir, `${role}.jsonl`),
    aggregateSummary: resolve(outputDir, `${role}.summary.json`),
    batchDir: resolve(outputDir, "agent-batches", role)
  };
}

function adjudicationRunOutputRoot(
  options: RunFrenchCodexPilotAdjudicationOptions
): string {
  if (!options.batchSelection.batchIds && !options.batchSelection.batchRange) {
    return options.outputDir;
  }
  return resolve(
    options.outputDir,
    "partials",
    hashFrenchInternalJson(options.batchSelection)
  );
}

function assertExpectedEntries(
  actual: number,
  options: RunFrenchCodexPilotAdjudicationOptions
): void {
  if (actual !== options.expectedEntries) {
    throw new Error(
      `french-codex-adjudication-view-entry-count:${actual}:${options.expectedEntries}`
    );
  }
}

export function selectFrenchCodexAdjudicationBatches(
  batches: FrenchCodexAdjudicationBatchRecord[],
  selection: RunFrenchCodexPilotAdjudicationOptions["batchSelection"]
): FrenchCodexAdjudicationBatchRecord[] {
  const finalize = (
    selected: FrenchCodexAdjudicationBatchRecord[]
  ): FrenchCodexAdjudicationBatchRecord[] => {
    if (selection.aggregateOnly && selected.length !== batches.length) {
      throw new Error(
        "french-codex-adjudication-aggregate-only-requires-full-coverage"
      );
    }
    return selected;
  };
  if (selection.batchIds && selection.batchRange) {
    throw new Error("french-codex-adjudication-selection-conflict");
  }
  if (new Set(batches.map((batch) => batch.batchId)).size !== batches.length) {
    throw new Error("french-codex-adjudication-manifest-batch-duplicate");
  }
  if (selection.batchIds) {
    if (
      selection.batchIds.length < 1 ||
      new Set(selection.batchIds).size !== selection.batchIds.length
    ) {
      throw new Error("french-codex-adjudication-batch-ids-invalid");
    }
    const positions = selection.batchIds.map((id) =>
      batches.findIndex((batch) => batch.batchId === id)
    );
    if (positions.some((position) => position < 0)) {
      throw new Error("french-codex-adjudication-batch-id-unknown");
    }
    if (
      positions.some(
        (position, index) => index > 0 && position <= positions[index - 1]!
      )
    ) {
      throw new Error("french-codex-adjudication-batch-ids-order-invalid");
    }
    return finalize(positions.map((position) => batches[position]!));
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
      throw new Error("french-codex-adjudication-batch-range-invalid");
    }
    return finalize(batches.slice(start, end));
  }
  if (batches.length < 1) {
    throw new Error("french-codex-adjudication-no-batches");
  }
  return finalize([...batches]);
}

function assertOptions(options: RunFrenchCodexPilotAdjudicationOptions): void {
  assertApprovedExecutionProfile(options);
  if (!(["all", "arbiter", "auditor"] as const).includes(options.phase)) {
    throw new Error(`french-codex-adjudication-phase-invalid:${options.phase}`);
  }
  const partialSelection = Boolean(
    options.batchSelection.batchIds || options.batchSelection.batchRange
  );
  if (options.phase === "all" && partialSelection) {
    throw new Error("french-codex-adjudication-partial-requires-single-phase");
  }
  if (options.forceRuns && options.batchSelection.aggregateOnly) {
    throw new Error("french-codex-adjudication-force-aggregate-conflict");
  }
  for (const profile of [options.arbiter, options.auditor]) {
    if (!profile.model.trim() || !profile.reasoningEffort.trim()) {
      throw new Error("french-codex-adjudication-profile-invalid");
    }
  }
  if (
    !options.expectedCodexVersion.trim() ||
    !SHA256_PATTERN.test(options.expectedCodexSha256) ||
    !/^\/fr-internal\/(?:pilot|full|custom\/[a-z0-9][a-z0-9._-]*)$/u.test(
      options.namespace
    )
  ) {
    throw new Error("french-codex-adjudication-binary-pin-invalid");
  }
  for (const [value, label] of [
    [options.concurrency, "concurrency"],
    [options.maxAttempts, "attempts"],
    [options.timeoutMs, "timeout"],
    [options.expectedEntries, "expected-entries"],
    [options.arbiterMaxItems, "arbiter-max-items"],
    [options.auditorMaxItems, "auditor-max-items"],
    [options.maxInputBytes, "max-input-bytes"]
  ] as const) {
    if (!Number.isInteger(value) || value < 1) {
      throw new Error(`french-codex-adjudication-${label}-invalid`);
    }
  }
}

function assertApprovedExecutionProfile(
  options: RunFrenchCodexPilotAdjudicationOptions
): void {
  if (
    hashFrenchInternalJson(options.arbiter) !==
      hashFrenchInternalJson(
        FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.arbiter
      ) ||
    hashFrenchInternalJson(options.auditor) !==
      hashFrenchInternalJson(
        FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.auditor
      ) ||
    options.expectedCodexVersion !==
      FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.codexVersion ||
    options.expectedCodexSha256 !==
      FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.codexSha256
  ) {
    throw new Error("french-codex-adjudication-unapproved-execution-profile");
  }
}

function installTextAtomically(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(temporary, text, "utf8");
  renameSync(temporary, path);
}

export function buildSealedCodexEnvironment(
  codexHome: string
): Record<string, string> {
  const home = resolve(codexHome);
  const user = process.env.USER?.trim() || "codex-agent";
  return {
    HOME: home,
    CODEX_HOME: home,
    USER: user,
    LOGNAME: process.env.LOGNAME?.trim() || user,
    SHELL: "/bin/zsh",
    PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
    TMPDIR: process.env.TMPDIR?.trim() || "/tmp",
    TERM: "dumb",
    NO_COLOR: "1"
  };
}

function codexBinaryIdentity(
  options: RunFrenchCodexPilotAdjudicationOptions
): CodexBinaryIdentity {
  const path = resolve(options.codexBinary);
  const identity = assertFrenchCodexImmutableBinary(path);
  if (
    identity.sha256 !== options.expectedCodexSha256 ||
    identity.version !== options.expectedCodexVersion
  ) {
    throw new Error(
      `french-codex-adjudication-binary-unpinned:${identity.version}:${identity.sha256}`
    );
  }
  return identity;
}

function assertCodexBinaryUnchanged(
  options: RunFrenchCodexPilotAdjudicationOptions,
  before: CodexBinaryIdentity
): void {
  const after = codexBinaryIdentity(options);
  if (hashFrenchInternalJson(after) !== hashFrenchInternalJson(before)) {
    throw new Error("french-codex-adjudication-binary-drift-during-execution");
  }
}

function signalChildProcessGroup(
  pid: number | undefined,
  signal: NodeJS.Signals
): void {
  if (!pid) return;
  try {
    process.kill(process.platform === "win32" ? pid : -pid, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}

async function acquireExclusiveLock(
  path: string,
  timeoutMs: number
): Promise<() => void> {
  try {
    return await acquireFrenchCodexSqliteLockWithTimeout(path, timeoutMs);
  } catch (error) {
    if (error instanceof FrenchCodexLockBusyError) {
      throw new Error(`french-codex-adjudication-lock-timeout:${path}`);
    }
    throw error;
  }
}

function normalizeAgentMessage(value: string): string {
  return value.replace(/\r\n?/gu, "\n").trim();
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
      if (file.backedUp && existsSync(file.backup)) {
        renameSync(file.backup, file.path);
      }
    }
    throw error;
  }
}

function sha256File(path: string): string {
  return sha256(readFileSync(path));
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseFrenchCodexAdjudicationArgs(
  args: readonly string[]
): RunFrenchCodexPilotAdjudicationOptions {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  const flagNames = new Set([
    "rebuild-batches",
    "force-runs",
    "aggregate-only"
  ]);
  const valueNames = new Set([
    "phase",
    "namespace",
    "packets",
    "proposer-a",
    "proposer-b",
    "configuration",
    "selection",
    "output-dir",
    "proposer-runs",
    "proposer-summary",
    "proposer-batch-manifest",
    "codex-binary",
    "codex-home",
    "arbiter-model",
    "arbiter-reasoning-effort",
    "auditor-model",
    "auditor-reasoning-effort",
    "concurrency",
    "max-attempts",
    "timeout-ms",
    "expected-entries",
    "arbiter-max-items",
    "auditor-max-items",
    "max-input-bytes",
    "batch-ids",
    "batch-range",
    "codex-version",
    "codex-sha256"
  ]);
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index] ?? "";
    if (!token.startsWith("--"))
      throw new Error(`unexpected-argument:${token}`);
    const key = token.slice(2);
    if (flagNames.has(key)) {
      if (flags.has(key)) throw new Error(`duplicate-option:${key}`);
      flags.add(key);
      continue;
    }
    if (!valueNames.has(key)) throw new Error(`unknown-option:${key}`);
    if (values.has(key)) throw new Error(`duplicate-option:${key}`);
    const value = args[index + 1];
    if (!value || value.startsWith("--"))
      throw new Error(`missing-value:${key}`);
    values.set(key, value);
    index += 1;
  }
  const phase = values.get("phase") ?? "all";
  if (phase !== "all" && phase !== "arbiter" && phase !== "auditor") {
    throw new Error(`french-codex-adjudication-phase-invalid:${phase}`);
  }
  const outputDir = resolve(values.get("output-dir") ?? DEFAULT_PILOT_ROOT);
  const scopeName = basename(outputDir) === "full" ? "full" : "pilot";
  const namespace = values.get("namespace") ?? `/fr-internal/${scopeName}`;
  const proposerBatchManifestPath = resolve(
    values.get("proposer-batch-manifest") ??
      `${DEFAULT_ROOT}/agent-batches/${scopeName}/manifest.json`
  );
  const expectedEntries = values.has("expected-entries")
    ? Number(values.get("expected-entries"))
    : inferManifestEntryCount(proposerBatchManifestPath);
  const selectedPacketsPath = inferManifestSelectedPacketsPath(
    proposerBatchManifestPath
  );
  const rangeValue = values.get("batch-range");
  let batchRange: { start: number; end: number } | undefined;
  if (rangeValue) {
    const match = /^(\d+):(\d+)$/u.exec(rangeValue);
    if (!match) throw new Error("french-codex-adjudication-batch-range-format");
    batchRange = { start: Number(match[1]), end: Number(match[2]) };
  }
  return {
    phase,
    namespace,
    packetsPath: resolve(values.get("packets") ?? selectedPacketsPath),
    proposerAPath: resolve(
      values.get("proposer-a") ?? join(outputDir, "proposer-a.jsonl")
    ),
    proposerBPath: resolve(
      values.get("proposer-b") ?? join(outputDir, "proposer-b.jsonl")
    ),
    configurationPath: resolve(
      values.get("configuration") ?? `${DEFAULT_ROOT}/configuration.json`
    ),
    selectionPath: resolve(
      values.get("selection") ??
        (scopeName === "full"
          ? proposerBatchManifestPath
          : `${DEFAULT_ROOT}/work/pilot-keys.json`)
    ),
    outputDir,
    proposerRunsPath: resolve(
      values.get("proposer-runs") ?? join(outputDir, "proposer-runs.jsonl")
    ),
    proposerSummaryPath: resolve(
      values.get("proposer-summary") ?? join(outputDir, "proposer-summary.json")
    ),
    proposerBatchManifestPath,
    codexBinary: resolve(values.get("codex-binary") ?? DEFAULT_CODEX_BINARY),
    codexHome: resolve(values.get("codex-home") ?? DEFAULT_CODEX_HOME),
    arbiter: {
      model: values.get("arbiter-model") ?? "gpt-5.6-terra",
      reasoningEffort: values.get("arbiter-reasoning-effort") ?? "medium"
    },
    auditor: {
      model: values.get("auditor-model") ?? "gpt-5.6-sol",
      reasoningEffort: values.get("auditor-reasoning-effort") ?? "medium"
    },
    concurrency: Number(values.get("concurrency") ?? 4),
    maxAttempts: Number(values.get("max-attempts") ?? 2),
    timeoutMs: Number(values.get("timeout-ms") ?? DEFAULT_TIMEOUT_MS),
    expectedEntries,
    arbiterMaxItems: Number(values.get("arbiter-max-items") ?? 8),
    auditorMaxItems: Number(values.get("auditor-max-items") ?? 4),
    maxInputBytes: Number(values.get("max-input-bytes") ?? 450_000),
    rebuildBatches: flags.has("rebuild-batches"),
    forceRuns: flags.has("force-runs"),
    expectedCodexVersion: values.get("codex-version") ?? DEFAULT_CODEX_VERSION,
    expectedCodexSha256: values.get("codex-sha256") ?? DEFAULT_CODEX_SHA256,
    batchSelection: {
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
      aggregateOnly: flags.has("aggregate-only")
    }
  };
}

function inferManifestSelectedPacketsPath(manifestPath: string): string {
  if (!existsSync(manifestPath)) {
    throw new Error(`french-codex-manifest-missing:${manifestPath}`);
  }
  let manifest: FrenchCodexAnyBatchManifest;
  try {
    manifest = JSON.parse(
      readFileSync(manifestPath, "utf8")
    ) as FrenchCodexAnyBatchManifest;
  } catch {
    throw new Error(`french-codex-manifest-invalid-json:${manifestPath}`);
  }
  return assertFrenchCodexAnyBatchManifest(manifest).selectedPackets.path;
}

function inferManifestEntryCount(path: string): number {
  if (!existsSync(path)) {
    throw new Error(
      `french-codex-adjudication-expected-entries-required:${path}`
    );
  }
  const parsed = JSON.parse(readFileSync(path, "utf8")) as {
    counts?: { entries?: unknown };
  };
  const count = parsed.counts?.entries;
  if (!Number.isInteger(count) || Number(count) < 1) {
    throw new Error("french-codex-adjudication-manifest-entry-count-invalid");
  }
  return Number(count);
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  runLexiconV3FrenchCodexPilotAdjudication(
    parseFrenchCodexAdjudicationArgs(process.argv.slice(2))
  )
    .then((result) => {
      process.stdout.write(
        `${JSON.stringify(
          {
            event: "french-codex-pilot-adjudication-complete",
            arbiter: result.arbiter?.counts,
            auditor: result.auditor?.counts,
            summaryPath: result.summaryPath
          },
          null,
          2
        )}\n`
      );
    })
    .catch((error: unknown) => {
      process.stderr.write(
        `${basename(process.argv[1] ?? "runLexiconV3FrenchCodexPilotAdjudication")}: ${
          error instanceof Error ? error.stack : String(error)
        }\n`
      );
      process.exitCode = 1;
    });
}
