import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import {
  closeSync,
  existsSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  acquireExclusiveRoleLock,
  buildSealedFrenchCodexProposerEnvironment,
  frenchCodexDisabledFeaturesHash,
  frenchCodexEnvironmentPolicyHash,
  frenchCodexProposerExecArgs,
  parseFrenchCodexAgentEvents
} from "./runLexiconV3FrenchCodexProposerBatch.js";
import {
  assertFrenchCodexAnyBatchManifest,
  type FrenchCodexAnyBatchManifest
} from "./buildLexiconV3FrenchCodexBatches.js";
import {
  FRENCH_CODEX_PILOT_BATCH_MANIFEST_SCHEMA_VERSION,
  frenchCodexSelectedPacketsLogicalDigest,
  type FrenchCodexPilotBatchManifest
} from "./buildLexiconV3FrenchCodexPilotBatches.js";
import {
  FRENCH_INTERNAL_ASSEMBLY_CONFIG_SCHEMA_VERSION,
  type FrenchInternalAssemblyConfigurationFile
} from "./assembleLexiconV3FrenchInternalReview.js";
import {
  FRENCH_BLIND_REAUDIT_RUNTIME_POLICY_VERSION,
  assertFrenchBlindReauditView,
  buildFrenchBlindReauditPrompt,
  buildFrenchBlindReauditView,
  frenchBlindReauditDecisionEnvelope,
  frenchBlindReauditOutputSchema,
  parseFrenchBlindReauditAgentResponse,
  type FrenchBlindReauditAgentDecision
} from "../src/lexiconV3/frenchBlindReauditRuntime.js";
import {
  FRENCH_INTERNAL_EXECUTION_RECEIPT_SCHEMA_VERSION,
  assertFrenchCodexExecutionReceipt,
  finalizeFrenchCodexExecutionReceipt,
  hashFrenchInternalJson,
  type FrenchCodexExecutionCapabilities,
  type FrenchCodexExecutionReceipt
} from "../src/lexiconV3/frenchCodexExecutionReceipt.js";
import {
  FRENCH_CODEX_IMMUTABLE_BINARY_PATH,
  FRENCH_CODEX_MUTABLE_BUNDLE_BINARY,
  assertFrenchCodexImmutableBinary,
  ensureFrenchCodexImmutableBinary,
  prepareFrenchCodexImmutableExecution,
  type FrenchCodexImmutableBinaryIdentity
} from "../src/lexiconV3/frenchCodexImmutableBinary.js";
import {
  FRENCH_PILOT_BLIND_REAUDIT_MANIFEST_SCHEMA_VERSION,
  FRENCH_PILOT_BLIND_REAUDIT_NAMESPACE,
  FRENCH_PILOT_BLIND_REAUDIT_POLICY_VERSION,
  FRENCH_PILOT_BLIND_REAUDIT_POPULATION_SIZE,
  FRENCH_PILOT_BLIND_REAUDIT_RECEIPT_SCHEMA_VERSION,
  FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE,
  FRENCH_PILOT_BLIND_REAUDIT_SUMMARY_SCHEMA_VERSION,
  buildFrenchPilotBlindReauditSelection,
  frenchPilotBlindReauditDecisionHash,
  frenchPilotBlindReauditReceiptHash,
  hashFrenchPilotBlindReauditBytes,
  type FrenchPilotBlindReauditBatch,
  type FrenchPilotBlindReauditDecision,
  type FrenchPilotBlindReauditFileArtifact,
  type FrenchPilotBlindReauditManifest,
  type FrenchPilotBlindReauditPopulationItem,
  type FrenchPilotBlindReauditReceipt,
  type FrenchPilotBlindReauditSummary,
  type FrenchPilotBlindReauditView
} from "../src/lexiconV3/frenchPilotBlindReaudit.js";
import {
  FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE,
  canonicalFrenchInternalJson,
  evaluateFrenchInternalReview,
  frenchInternalExecutionReceiptHash,
  frenchInternalGenerationConfigHash,
  frenchInternalSiblingFamilyKey,
  type FrenchInternalReviewRecord,
  type FrenchInternalRole
} from "../src/lexiconV3/frenchInternalReview.js";
import {
  FRENCH_INTERNAL_PILOT_SCHEMA_VERSION,
  FRENCH_INTERNAL_WORK_POLICY_VERSION,
  hashFrenchInternalWorkJson,
  type FrenchInternalPilotPlan
} from "../src/lexiconV3/frenchInternalWork.js";
import { frenchInternalRemediationReviewLogicalDigest } from "../src/lexiconV3/frenchInternalRemediation.js";
import {
  validateFrenchPacket,
  type LexiconV3FrenchPacket
} from "../src/lexiconV3/frenchPackets.js";

export const FRENCH_PILOT_BLIND_REAUDIT_RUN_SCHEMA_VERSION =
  "lexicon-v3-french-pilot-blind-reaudit-run@1" as const;

const ROOT = "outputs/lexicon-v3/fr-internal";
const DEFAULT_PILOT_MANIFEST = `${ROOT}/agent-batches/pilot/manifest.json`;
const DEFAULT_PILOT_SELECTION = `${ROOT}/work/pilot-keys.json`;
const DEFAULT_CONFIGURATION = `${ROOT}/configuration.json`;
const DEFAULT_FINAL_REVIEW = `${ROOT}/pilot/remediation/french-review.jsonl`;
const DEFAULT_OUTPUT_DIR = `${ROOT}/pilot/blind-reaudit`;
const DEFAULT_CODEX_BINARY = FRENCH_CODEX_IMMUTABLE_BINARY_PATH;
const DEFAULT_CODEX_SOURCE_BINARY = FRENCH_CODEX_MUTABLE_BUNDLE_BINARY;
const DEFAULT_CODEX_HOME = `${ROOT}/codex-agent-home`;
const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000;
const DEFAULT_CONCURRENCY = 3;
const DEFAULT_MAX_ATTEMPTS = 2;
const PILOT_BATCH_SIZE = 4;
const THREAD_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const ROLES = ["proposerA", "proposerB", "arbiter", "auditor"] as const;

export interface RunFrenchPilotBlindReauditOptions {
  pilotManifestPath: string;
  pilotSelectionPath: string;
  selectedPacketsPath: string;
  configurationPath: string;
  finalReviewPath: string;
  outputDir: string;
  codexBinary: string;
  codexSourceBinary: string;
  codexHome: string;
  timeoutMs: number;
  concurrency: number;
  maxAttempts: number;
  prepareOnly: boolean;
  existingOnly: boolean;
}

export interface FrenchPilotBlindReauditRunResult {
  manifest: FrenchPilotBlindReauditManifest;
  manifestPath: string;
  summary?: FrenchPilotBlindReauditSummary;
  summaryPath?: string;
  receiptsPath?: string;
  decisionsPath?: string;
}

interface PreparedBlindReaudit {
  manifest: FrenchPilotBlindReauditManifest;
  manifestPath: string;
  manifestFileHash: string;
  views: Map<string, FrenchPilotBlindReauditView>;
  priorThreads: Map<string, Record<FrenchInternalRole, string>>;
  priorAgents: Map<string, Record<FrenchInternalRole, string>>;
  sourceFileHashes: Record<string, string>;
}

type CodexBinaryIdentity = FrenchCodexImmutableBinaryIdentity;

interface AgentUsage {
  input_tokens?: number;
  cached_input_tokens?: number;
  output_tokens?: number;
  reasoning_output_tokens?: number;
}

export interface FrenchBlindReauditExecution {
  threadId: string;
  responseText: string;
  stdout: string;
  stderr: string;
  usage: AgentUsage | null;
  startedAt: string;
  completedAt: string;
}

interface FrenchPilotBlindReauditRun {
  schemaVersion: typeof FRENCH_PILOT_BLIND_REAUDIT_RUN_SCHEMA_VERSION;
  runtimePolicyVersion: typeof FRENCH_BLIND_REAUDIT_RUNTIME_POLICY_VERSION;
  namespace: string;
  batchId: string;
  manifestHash: string;
  selectionHash: string;
  batchHash: string;
  taskName: string;
  agentId: string;
  threadId: string;
  model: string;
  reasoningEffort: string;
  executorPolicyVersion: string;
  executor: CodexBinaryIdentity;
  capabilities: FrenchCodexExecutionCapabilities;
  startedAt: string;
  completedAt: string;
  promptHash: string;
  sourceHashes: Record<string, string>;
  resultPaths: Record<string, string>;
  resultHashes: Record<string, string>;
  counts: { expected: number; decisions: number };
  usage: AgentUsage | null;
  runHash: string;
}

interface CompletedBatch {
  batch: FrenchPilotBlindReauditBatch;
  run: FrenchPilotBlindReauditRun;
  decisions: FrenchBlindReauditAgentDecision[];
}

export async function runLexiconV3FrenchPilotBlindReaudit(
  options: RunFrenchPilotBlindReauditOptions
): Promise<FrenchPilotBlindReauditRunResult> {
  assertOptions(options);
  const release = acquireExclusiveRoleLock(
    resolve(options.outputDir, "blind-reaudit.lock")
  );
  try {
    const prepared = prepareFrenchPilotBlindReaudit(options);
    if (options.prepareOnly) {
      return {
        manifest: prepared.manifest,
        manifestPath: prepared.manifestPath
      };
    }
    const executor = prepareImmutableCodexBinary(options);
    assertFrenchPilotBlindReauditCodexAuthentication(options.codexHome);
    const completed = await mapConcurrent(
      prepared.manifest.batches,
      options.concurrency,
      (batch) => runBlindReauditBatch({ options, prepared, batch, executor })
    );
    assertExecutionFreshness(
      completed,
      prepared.priorThreads,
      prepared.priorAgents
    );
    const finalized = finalizePilotBlindReaudit({
      options,
      prepared,
      completed
    });
    return {
      manifest: prepared.manifest,
      manifestPath: prepared.manifestPath,
      summary: finalized.summary,
      summaryPath: finalized.summaryPath,
      receiptsPath: finalized.receiptsPath,
      decisionsPath: finalized.decisionsPath
    };
  } finally {
    release();
  }
}

export function prepareFrenchPilotBlindReaudit(
  options: RunFrenchPilotBlindReauditOptions
): PreparedBlindReaudit {
  const sources = {
    pilotManifest: readArtifact(options.pilotManifestPath),
    pilotSelection: readArtifact(options.pilotSelectionPath),
    selectedPackets: readArtifact(options.selectedPacketsPath),
    configuration: readArtifact(options.configurationPath),
    finalReview: readArtifact(options.finalReviewPath)
  };
  const pilotManifest = parseJson<FrenchCodexAnyBatchManifest>(
    sources.pilotManifest.text,
    "pilot-manifest"
  );
  const context = assertFrenchCodexAnyBatchManifest(pilotManifest, {
    verifyFiles: true,
    expectedEntries: FRENCH_PILOT_BLIND_REAUDIT_POPULATION_SIZE
  });
  if (
    pilotManifest.schemaVersion !==
      FRENCH_CODEX_PILOT_BATCH_MANIFEST_SCHEMA_VERSION ||
    context.runKind !== "pilot"
  ) {
    throw new Error("french-pilot-blind-reaudit-manifest-not-pilot");
  }
  const manifest = pilotManifest as FrenchCodexPilotBatchManifest;
  if (
    resolve(manifest.sourcePaths.pilot) !==
      resolve(options.pilotSelectionPath) ||
    resolve(manifest.selectedPackets.path) !==
      resolve(options.selectedPacketsPath)
  ) {
    throw new Error("french-pilot-blind-reaudit-source-path-lineage");
  }

  const pilot = parseJson<FrenchInternalPilotPlan>(
    sources.pilotSelection.text,
    "pilot-selection"
  );
  assertPilotSelection(pilot, manifest);
  const packets = parseJsonl<LexiconV3FrenchPacket>(
    sources.selectedPackets.text,
    "selected-packets"
  );
  assertSelectedPackets(packets, pilot, manifest);
  const reviews = parseJsonl<FrenchInternalReviewRecord>(
    sources.finalReview.text,
    "final-review"
  );
  const configuration = parseJson<FrenchInternalAssemblyConfigurationFile>(
    sources.configuration.text,
    "configuration"
  );
  assertConfiguration(configuration);
  assertFinalReviews(reviews, packets, configuration.generationConfigHash);

  const finalReviewLogicalDigest =
    frenchInternalRemediationReviewLogicalDigest(reviews);
  const packetByKey = new Map(
    packets.map((packet) => [packet.entryKey, packet])
  );
  const reviewByKey = new Map(
    reviews.map((review) => [review.entryKey, review])
  );
  const population: FrenchPilotBlindReauditPopulationItem[] =
    pilot.selections.map((selected) => {
      const packet = packetByKey.get(selected.entryKey);
      const review = reviewByKey.get(selected.entryKey);
      if (!packet || !review) {
        throw new Error(
          `french-pilot-blind-reaudit-population-entry-missing:${selected.entryKey}`
        );
      }
      return {
        entryKey: selected.entryKey,
        packetHash: packet.packetHash,
        englishHash: packet.english.contentHash,
        finalReviewArtifactHash: review.artifactHash,
        strata: structuredClone(selected.strata)
      };
    });
  const selection = buildFrenchPilotBlindReauditSelection({
    pilotSelectionHash: pilot.contentHash,
    finalReviewLogicalDigest,
    population
  });

  const views = new Map<string, FrenchPilotBlindReauditView>();
  const priorThreads = new Map<string, Record<FrenchInternalRole, string>>();
  const priorAgents = new Map<string, Record<FrenchInternalRole, string>>();
  const familyMembers = new Map<
    string,
    FrenchPilotBlindReauditView["siblingContext"]["members"]
  >();
  for (const packet of packets) {
    const review = reviewByKey.get(packet.entryKey)!;
    const proposal = review.arbiter!.proposal;
    const familyKey = frenchInternalSiblingFamilyKey(packet);
    const members = familyMembers.get(familyKey) ?? [];
    members.push({
      entryKey: packet.entryKey,
      identity: structuredClone(packet.identity) as unknown as Record<
        string,
        unknown
      >,
      english: structuredClone(packet.english) as unknown as Record<
        string,
        unknown
      >,
      finalFrench: {
        glossFr: proposal.glossFr,
        meaningFr: proposal.meaningFr,
        meaningHtmlFr: proposal.meaningHtmlFr,
        notesFr: proposal.notesFr,
        carrierTermsFr: [...proposal.carrierTermsFr]
      }
    });
    familyMembers.set(familyKey, members);
  }
  for (const members of familyMembers.values()) {
    members.sort((left, right) => left.entryKey.localeCompare(right.entryKey));
  }
  for (const entryKey of selection.keys) {
    const packet = packetByKey.get(entryKey)!;
    const review = reviewByKey.get(entryKey)!;
    const familyKey = frenchInternalSiblingFamilyKey(packet);
    const view = buildFrenchBlindReauditView({
      packet,
      finalReview: review,
      siblingContext: {
        scope: "selected-pilot-family-members",
        familyKey,
        members: structuredClone(familyMembers.get(familyKey)!)
      }
    });
    assertFrenchBlindReauditView(view);
    views.set(entryKey, view);
    const prior = extractPriorIdentities(review);
    priorThreads.set(entryKey, prior.threads);
    priorAgents.set(entryKey, prior.agents);
  }

  const outputDir = resolve(options.outputDir);
  mkdirSync(outputDir, { recursive: true });
  const batches: FrenchPilotBlindReauditBatch[] = [];
  for (
    let offset = 0;
    offset < selection.keys.length;
    offset += PILOT_BATCH_SIZE
  ) {
    const keys = selection.keys.slice(offset, offset + PILOT_BATCH_SIZE);
    if (keys.length !== PILOT_BATCH_SIZE) {
      throw new Error("french-pilot-blind-reaudit-batch-cardinality");
    }
    const batchId = `blind-reaudit-${String(
      offset / PILOT_BATCH_SIZE + 1
    ).padStart(3, "0")}`;
    const directory = resolve(outputDir, "batches", batchId);
    mkdirSync(directory, { recursive: true });
    const batchViews = keys.map((key) => views.get(key)!);
    const inputText = `${batchViews.map((view) => JSON.stringify(view)).join("\n")}\n`;
    const schemaText = `${JSON.stringify(
      frenchBlindReauditOutputSchema(keys.length),
      null,
      2
    )}\n`;
    const inputPath = resolve(directory, "views.jsonl");
    const schemaPath = resolve(directory, "output-schema.json");
    installImmutableText(inputPath, inputText);
    installImmutableText(schemaPath, schemaText);
    const inputArtifact = fileArtifact(inputPath);
    const outputSchema = fileArtifact(schemaPath);
    const content = {
      batchId,
      keys,
      viewHashes: batchViews.map((view) => view.viewHash),
      input: inputArtifact,
      outputSchema,
      expectedRunPath: resolve(directory, "agent-run.json")
    };
    batches.push({ ...content, batchHash: hashFrenchInternalJson(content) });
  }
  if (
    batches.length !==
      FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE / PILOT_BATCH_SIZE ||
    new Set(batches.flatMap((batch) => batch.keys)).size !==
      FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE
  ) {
    throw new Error("french-pilot-blind-reaudit-batches-invalid");
  }

  const sourcePaths = {
    pilotManifest: resolve(options.pilotManifestPath),
    pilotSelection: resolve(options.pilotSelectionPath),
    selectedPackets: resolve(options.selectedPacketsPath),
    configuration: resolve(options.configurationPath),
    finalReview: resolve(options.finalReviewPath)
  };
  const sourceDigests = {
    pilotManifest: sources.pilotManifest.sha256,
    pilotSelection: sources.pilotSelection.sha256,
    selectedPackets: sources.selectedPackets.sha256,
    configuration: sources.configuration.sha256,
    finalReview: sources.finalReview.sha256
  };
  const manifestContent = {
    schemaVersion: FRENCH_PILOT_BLIND_REAUDIT_MANIFEST_SCHEMA_VERSION,
    policyVersion: FRENCH_PILOT_BLIND_REAUDIT_POLICY_VERSION,
    namespace: FRENCH_PILOT_BLIND_REAUDIT_NAMESPACE,
    lineage: {
      releaseKey: context.lineage.releaseKey,
      releaseSnapshotFingerprint: context.lineage.releaseSnapshotFingerprint,
      sourceLogicalDigest: context.lineage.sourceLogicalDigest,
      pilotManifestHash: manifest.manifestHash,
      pilotSelectionHash: pilot.contentHash,
      finalReviewLogicalDigest,
      generationConfigHash: configuration.generationConfigHash
    },
    inputPolicy: {
      sourceEnglishAndProtectedOnly: true as const,
      finalFrenchDisplayOnly: true as const,
      proposerOutputsForbidden: true as const,
      arbiterOutputForbidden: true as const,
      auditorOutputForbidden: true as const,
      priorReasonsAndVerdictsForbidden: true as const,
      historicalAndResourceFrenchForbidden: true as const
    },
    sourcePaths,
    sourceDigests,
    selection,
    batches
  };
  const blindManifest: FrenchPilotBlindReauditManifest = {
    ...manifestContent,
    manifestHash: hashFrenchInternalJson(manifestContent)
  };
  const manifestPath = resolve(outputDir, "manifest.json");
  installImmutableText(
    manifestPath,
    `${JSON.stringify(blindManifest, null, 2)}\n`
  );
  return {
    manifest: blindManifest,
    manifestPath,
    manifestFileHash: sha256File(manifestPath),
    views,
    priorThreads,
    priorAgents,
    sourceFileHashes: sourceDigests
  };
}

async function runBlindReauditBatch(input: {
  options: RunFrenchPilotBlindReauditOptions;
  prepared: PreparedBlindReaudit;
  batch: FrenchPilotBlindReauditBatch;
  executor: CodexBinaryIdentity;
}): Promise<CompletedBatch> {
  const { options, prepared, batch, executor } = input;
  const batchDir = dirname(batch.input.path);
  const pointerPath = resolve(batch.expectedRunPath);
  if (pointerPath !== resolve(batchDir, "agent-run.json")) {
    throw new Error(
      `french-pilot-blind-reaudit-run-path-invalid:${batch.batchId}`
    );
  }
  if (existsSync(pointerPath)) {
    return readExistingBatchRun({ prepared, batch, executor, pointerPath });
  }
  if (options.existingOnly) {
    throw new Error(`french-pilot-blind-reaudit-run-missing:${batch.batchId}`);
  }
  const views = batch.keys.map((key) => prepared.views.get(key)!);
  const prompt = buildFrenchBlindReauditPrompt({
    namespace: prepared.manifest.namespace,
    batchId: batch.batchId,
    views
  });
  const taskName = `${prepared.manifest.namespace}/blindReauditor/${batch.batchId}`;
  let lastError: unknown;
  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    const attemptDir = resolve(
      batchDir,
      "attempts",
      `${Date.now()}-${process.pid}-${attempt}`
    );
    mkdirSync(attemptDir, { recursive: true });
    try {
      const capabilities = executionCapabilities(attemptDir);
      const execution = await executeFrenchBlindReauditBatch({
        options: {
          codexHome: options.codexHome,
          timeoutMs: options.timeoutMs
        },
        executor,
        prompt,
        schemaPath: batch.outputSchema.path,
        attemptDir
      });
      assertExecutorUnchanged(executor);
      const response = parseFrenchBlindReauditAgentResponse({
        responseText: execution.responseText,
        views
      });
      const priorThreadIds = batch.keys.flatMap((key) =>
        Object.values(prepared.priorThreads.get(key)!)
      );
      const agentId = `codex-agent:${execution.threadId}`;
      const priorAgentIds = batch.keys.flatMap((key) =>
        Object.values(prepared.priorAgents.get(key)!)
      );
      if (
        priorThreadIds.includes(execution.threadId) ||
        priorAgentIds.includes(agentId)
      ) {
        throw new Error(
          `french-pilot-blind-reaudit-thread-not-fresh:${execution.threadId}`
        );
      }
      const responsePath = resolve(attemptDir, "structured-response.json");
      const eventsPath = resolve(attemptDir, "agent-events.jsonl");
      const stderrPath = resolve(attemptDir, "agent-stderr.log");
      installImmutableText(responsePath, execution.responseText);
      installImmutableText(eventsPath, execution.stdout);
      installImmutableText(stderrPath, execution.stderr);
      const sourceHashes = batchSourceHashes(prepared, batch);
      const resultPaths = {
        agentEvents: eventsPath,
        agentStderr: stderrPath,
        structuredResponse: responsePath
      };
      const resultHashes = {
        agentEvents: sha256File(eventsPath),
        agentStderr: sha256File(stderrPath),
        structuredResponse: sha256File(responsePath)
      };
      const runContent = {
        schemaVersion: FRENCH_PILOT_BLIND_REAUDIT_RUN_SCHEMA_VERSION,
        runtimePolicyVersion: FRENCH_BLIND_REAUDIT_RUNTIME_POLICY_VERSION,
        namespace: prepared.manifest.namespace,
        batchId: batch.batchId,
        manifestHash: prepared.manifest.manifestHash,
        selectionHash: prepared.manifest.selection.selectionHash,
        batchHash: batch.batchHash,
        taskName,
        agentId,
        threadId: execution.threadId,
        model: FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.auditor.model,
        reasoningEffort:
          FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.auditor.reasoningEffort,
        executorPolicyVersion:
          FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.executorPolicyVersion,
        executor,
        capabilities,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        promptHash: sha256(prompt),
        sourceHashes,
        resultPaths,
        resultHashes,
        counts: {
          expected: batch.keys.length,
          decisions: response.decisions.length
        },
        usage: execution.usage
      };
      const run: FrenchPilotBlindReauditRun = {
        ...runContent,
        runHash: hashFrenchInternalJson(runContent)
      };
      installImmutableText(pointerPath, `${JSON.stringify(run, null, 2)}\n`);
      return { batch, run, decisions: response.decisions };
    } catch (error) {
      lastError = error;
      installImmutableText(
        resolve(attemptDir, "rejected.json"),
        `${JSON.stringify(
          {
            rejectedAt: new Date().toISOString(),
            reason: error instanceof Error ? error.message : String(error)
          },
          null,
          2
        )}\n`
      );
    }
  }
  throw new Error(
    `french-pilot-blind-reaudit-attempts-exhausted:${batch.batchId}:${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}

function readExistingBatchRun(input: {
  prepared: PreparedBlindReaudit;
  batch: FrenchPilotBlindReauditBatch;
  executor: CodexBinaryIdentity;
  pointerPath: string;
}): CompletedBatch {
  const run = parseJson<FrenchPilotBlindReauditRun>(
    readFileSync(input.pointerPath, "utf8"),
    `existing-run:${input.batch.batchId}`
  );
  const { runHash, ...content } = run;
  const expectedTaskName = `${input.prepared.manifest.namespace}/blindReauditor/${input.batch.batchId}`;
  if (
    run.schemaVersion !== FRENCH_PILOT_BLIND_REAUDIT_RUN_SCHEMA_VERSION ||
    run.runtimePolicyVersion !== FRENCH_BLIND_REAUDIT_RUNTIME_POLICY_VERSION ||
    run.namespace !== input.prepared.manifest.namespace ||
    run.batchId !== input.batch.batchId ||
    run.manifestHash !== input.prepared.manifest.manifestHash ||
    run.selectionHash !== input.prepared.manifest.selection.selectionHash ||
    run.batchHash !== input.batch.batchHash ||
    run.taskName !== expectedTaskName ||
    run.agentId !== `codex-agent:${run.threadId}` ||
    !THREAD_ID_PATTERN.test(run.threadId) ||
    run.model !== FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.auditor.model ||
    run.reasoningEffort !==
      FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.auditor.reasoningEffort ||
    run.executorPolicyVersion !==
      FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.executorPolicyVersion ||
    canonicalFrenchInternalJson(run.executor) !==
      canonicalFrenchInternalJson(input.executor) ||
    canonicalFrenchInternalJson(run.capabilities) !==
      canonicalFrenchInternalJson(
        executionCapabilities(dirname(run.resultPaths.structuredResponse ?? ""))
      ) ||
    run.promptHash !==
      sha256(
        buildFrenchBlindReauditPrompt({
          namespace: input.prepared.manifest.namespace,
          batchId: input.batch.batchId,
          views: input.batch.keys.map((key) => input.prepared.views.get(key)!)
        })
      ) ||
    canonicalFrenchInternalJson(run.sourceHashes) !==
      canonicalFrenchInternalJson(
        batchSourceHashes(input.prepared, input.batch)
      ) ||
    run.counts.expected !== input.batch.keys.length ||
    run.counts.decisions !== input.batch.keys.length ||
    runHash !== hashFrenchInternalJson(content)
  ) {
    throw new Error(
      `french-pilot-blind-reaudit-existing-run-stale:${input.batch.batchId}`
    );
  }
  for (const label of [
    "agentEvents",
    "agentStderr",
    "structuredResponse"
  ] as const) {
    const path = run.resultPaths[label];
    if (
      !path ||
      !existsSync(path) ||
      sha256File(path) !== run.resultHashes[label]
    ) {
      throw new Error(
        `french-pilot-blind-reaudit-existing-result-stale:${input.batch.batchId}:${label}`
      );
    }
  }
  const responseText = readFileSync(run.resultPaths.structuredResponse, "utf8");
  const events = parseFrenchCodexAgentEvents(
    readFileSync(run.resultPaths.agentEvents, "utf8"),
    responseText
  );
  if (events.threadId !== run.threadId) {
    throw new Error(
      `french-pilot-blind-reaudit-existing-thread-stale:${input.batch.batchId}`
    );
  }
  const decisions = parseFrenchBlindReauditAgentResponse({
    responseText,
    views: input.batch.keys.map((key) => input.prepared.views.get(key)!)
  }).decisions;
  return { batch: input.batch, run, decisions };
}

function finalizePilotBlindReaudit(input: {
  options: RunFrenchPilotBlindReauditOptions;
  prepared: PreparedBlindReaudit;
  completed: CompletedBatch[];
}): {
  summary: FrenchPilotBlindReauditSummary;
  summaryPath: string;
  receiptsPath: string;
  decisionsPath: string;
} {
  const byBatch = new Map(
    input.completed.map((completed) => [completed.batch.batchId, completed])
  );
  const receiptByEntry = new Map<string, FrenchPilotBlindReauditReceipt>();
  const decisionByEntry = new Map<string, FrenchPilotBlindReauditDecision>();
  for (const batch of input.prepared.manifest.batches) {
    const completed = byBatch.get(batch.batchId);
    if (!completed) {
      throw new Error(
        `french-pilot-blind-reaudit-batch-run-missing:${batch.batchId}`
      );
    }
    const rawArtifactHash = completed.run.resultHashes.structuredResponse;
    for (const agentDecision of completed.decisions) {
      const priorThreads = input.prepared.priorThreads.get(
        agentDecision.entryKey
      )!;
      const priorAgents = input.prepared.priorAgents.get(
        agentDecision.entryKey
      )!;
      const priorRoleThreadsDigest = priorThreadsDigest(priorThreads);
      const priorRoleAgentsDigest = priorAgentsDigest(priorAgents);
      const genericSourcePaths: FrenchPilotBlindReauditReceipt["sourcePaths"] =
        {
          ...batchSourcePaths(input.prepared, batch),
          runPointer: resolve(batch.expectedRunPath)
        };
      const genericSourceHashes = {
        manifest: completed.run.sourceHashes.manifest!,
        input: completed.run.sourceHashes.input!,
        outputSchema: completed.run.sourceHashes.outputSchema!,
        pilotManifest: completed.run.sourceHashes.pilotManifest!,
        pilotSelection: completed.run.sourceHashes.pilotSelection!,
        selectedPackets: completed.run.sourceHashes.selectedPackets!,
        configuration: completed.run.sourceHashes.configuration!,
        finalReview: completed.run.sourceHashes.finalReview!,
        runPointer: sha256File(batch.expectedRunPath)
      };
      const genericReceipt: FrenchCodexExecutionReceipt<"blindReauditor"> =
        finalizeFrenchCodexExecutionReceipt({
          schemaVersion: FRENCH_INTERNAL_EXECUTION_RECEIPT_SCHEMA_VERSION,
          role: "blindReauditor",
          entryKey: agentDecision.entryKey,
          batchId: batch.batchId,
          namespace: input.prepared.manifest.namespace,
          manifestHash: input.prepared.manifest.manifestHash,
          selectionHash: input.prepared.manifest.selection.selectionHash,
          inputHash: agentDecision.inputHash,
          artifactHash: rawArtifactHash,
          agentId: completed.run.agentId,
          taskName: completed.run.taskName,
          threadId: completed.run.threadId,
          model: completed.run.model,
          reasoningEffort: completed.run.reasoningEffort,
          executorPolicyVersion: completed.run.executorPolicyVersion,
          executor: completed.run.executor,
          capabilities: completed.run.capabilities,
          sourcePaths: genericSourcePaths,
          sourceHashes: genericSourceHashes,
          resultPaths: completed.run.resultPaths,
          resultHashes: completed.run.resultHashes,
          startedAt: completed.run.startedAt,
          completedAt: completed.run.completedAt,
          runHash: completed.run.runHash
        });
      assertFrenchCodexExecutionReceipt(genericReceipt, {
        expectedRole: "blindReauditor"
      });
      const receiptContent: Omit<
        FrenchPilotBlindReauditReceipt,
        "receiptHash"
      > = {
        schemaVersion: FRENCH_PILOT_BLIND_REAUDIT_RECEIPT_SCHEMA_VERSION,
        policyVersion: FRENCH_PILOT_BLIND_REAUDIT_POLICY_VERSION,
        role: "blindReauditor",
        namespace: FRENCH_PILOT_BLIND_REAUDIT_NAMESPACE,
        entryKey: agentDecision.entryKey,
        batchId: batch.batchId,
        manifestHash: input.prepared.manifest.manifestHash,
        selectionHash: input.prepared.manifest.selection.selectionHash,
        inputHash: agentDecision.inputHash,
        artifactHash: rawArtifactHash,
        agentId: completed.run.agentId,
        taskName: completed.run.taskName,
        threadId: completed.run.threadId,
        model: FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.auditor.model,
        reasoningEffort:
          FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.auditor.reasoningEffort,
        executorPolicyVersion:
          FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.executorPolicyVersion,
        executor: completed.run.executor,
        capabilities: completed.run.capabilities,
        priorRoleThreadsDigest,
        priorRoleAgentsDigest,
        sourcePaths: genericSourcePaths,
        sourceHashes: genericSourceHashes,
        resultPaths: completed.run
          .resultPaths as FrenchPilotBlindReauditReceipt["resultPaths"],
        resultHashes: completed.run.resultHashes,
        startedAt: completed.run.startedAt,
        completedAt: completed.run.completedAt,
        runHash: completed.run.runHash
      };
      const receipt: FrenchPilotBlindReauditReceipt = {
        ...receiptContent,
        receiptHash: frenchPilotBlindReauditReceiptHash(receiptContent)
      };
      const decisionContent = frenchBlindReauditDecisionEnvelope({
        decision: agentDecision,
        agentId: receipt.agentId,
        taskName: receipt.taskName,
        threadId: receipt.threadId,
        completedAt: receipt.completedAt,
        receiptHash: receipt.receiptHash
      });
      const decision: FrenchPilotBlindReauditDecision = {
        ...decisionContent,
        artifactHash: frenchPilotBlindReauditDecisionHash(decisionContent)
      };
      receiptByEntry.set(agentDecision.entryKey, receipt);
      decisionByEntry.set(agentDecision.entryKey, decision);
    }
  }
  const receipts = input.prepared.manifest.selection.keys.map((key) => {
    const receipt = receiptByEntry.get(key);
    if (!receipt)
      throw new Error(`french-pilot-blind-reaudit-receipt-missing:${key}`);
    return receipt;
  });
  const decisions = input.prepared.manifest.selection.keys.map((key) => {
    const decision = decisionByEntry.get(key);
    if (!decision)
      throw new Error(`french-pilot-blind-reaudit-decision-missing:${key}`);
    return decision;
  });
  const hold = decisions.filter(
    (decision) => decision.verdict === "hold"
  ).length;
  const block = decisions.filter(
    (decision) => decision.verdict === "block"
  ).length;
  const violations = decisions.reduce(
    (count, decision) =>
      count +
      Object.values(decision.checks).filter((check) => check === "fail").length,
    0
  );
  if (
    receipts.length !== FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE ||
    decisions.length !== FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE ||
    receiptByEntry.size !== receipts.length ||
    decisionByEntry.size !== decisions.length ||
    hold !== 0 ||
    block !== 0 ||
    violations !== 0
  ) {
    throw new Error(
      `french-pilot-blind-reaudit-not-all-safe:hold=${hold}:block=${block}:violations=${violations}`
    );
  }

  const outputDir = resolve(input.options.outputDir);
  const receiptsPath = resolve(outputDir, "receipts.jsonl");
  const decisionsPath = resolve(outputDir, "decisions.jsonl");
  installImmutableText(
    receiptsPath,
    `${receipts.map((receipt) => JSON.stringify(receipt)).join("\n")}\n`
  );
  installImmutableText(
    decisionsPath,
    `${decisions.map((decision) => JSON.stringify(decision)).join("\n")}\n`
  );
  const receiptsArtifact = fileArtifact(receiptsPath);
  const decisionsArtifact = fileArtifact(decisionsPath);
  const distinctAgentThreads = new Set(
    receipts.map((receipt) => receipt.threadId)
  ).size;
  const distinctAgentIds = new Set(receipts.map((receipt) => receipt.agentId))
    .size;
  if (distinctAgentThreads !== input.prepared.manifest.batches.length) {
    throw new Error("french-pilot-blind-reaudit-thread-cardinality");
  }
  if (distinctAgentIds !== input.prepared.manifest.batches.length) {
    throw new Error("french-pilot-blind-reaudit-agent-cardinality");
  }
  const runHashesDigest = hashFrenchInternalJson(
    input.prepared.manifest.batches.map((batch) => {
      const receipt = receiptByEntry.get(batch.keys[0]!)!;
      return {
        batchId: batch.batchId,
        threadId: receipt.threadId,
        runHash: receipt.runHash
      };
    })
  );
  const freshnessProofDigest = hashFrenchInternalJson(
    input.prepared.manifest.selection.keys.map((entryKey) => {
      const receipt = receiptByEntry.get(entryKey)!;
      return {
        entryKey,
        priorRoleAgentsDigest: receipt.priorRoleAgentsDigest,
        priorRoleThreadsDigest: receipt.priorRoleThreadsDigest,
        agentId: receipt.agentId,
        threadId: receipt.threadId
      };
    })
  );
  const generatedAt = [
    ...new Set(receipts.map((receipt) => receipt.completedAt))
  ]
    .sort()
    .at(-1)!;
  const runs: FrenchPilotBlindReauditSummary["runs"] =
    input.prepared.manifest.batches.map((batch) => {
      const completed = byBatch.get(batch.batchId)!;
      if (
        resolve(batch.expectedRunPath) !==
        resolve(dirname(batch.input.path), "agent-run.json")
      ) {
        throw new Error(
          `french-pilot-blind-reaudit-run-pointer-path:${batch.batchId}`
        );
      }
      return {
        batchId: batch.batchId,
        pointer: fileArtifact(batch.expectedRunPath),
        runHash: completed.run.runHash,
        resultPaths: {
          agentEvents: completed.run.resultPaths.agentEvents!,
          agentStderr: completed.run.resultPaths.agentStderr!,
          structuredResponse: completed.run.resultPaths.structuredResponse!
        },
        resultHashes: {
          agentEvents: completed.run.resultHashes.agentEvents!,
          agentStderr: completed.run.resultHashes.agentStderr!,
          structuredResponse: completed.run.resultHashes.structuredResponse!
        }
      };
    });
  const summaryContent: Omit<FrenchPilotBlindReauditSummary, "summaryHash"> = {
    schemaVersion: FRENCH_PILOT_BLIND_REAUDIT_SUMMARY_SCHEMA_VERSION,
    policyVersion: FRENCH_PILOT_BLIND_REAUDIT_POLICY_VERSION,
    namespace: FRENCH_PILOT_BLIND_REAUDIT_NAMESPACE,
    manifestHash: input.prepared.manifest.manifestHash,
    manifestFileHash: input.prepared.manifestFileHash,
    selectionHash: input.prepared.manifest.selection.selectionHash,
    generatedAt,
    profile: FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.auditor,
    coverage: "exact",
    counts: {
      population: FRENCH_PILOT_BLIND_REAUDIT_POPULATION_SIZE,
      sampled: FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE,
      batches: input.prepared.manifest.batches.length,
      receipts: FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE,
      decisions: FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE,
      safe: FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE,
      hold: 0,
      block: 0,
      violations: 0,
      distinctAgentIds,
      distinctAgentThreads,
      freshAgainstPriorAgents: FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE,
      freshAgainstPriorThreads: FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE
    },
    runs,
    outputs: {
      receipts: {
        ...receiptsArtifact,
        records: FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE,
        logicalDigest: hashFrenchInternalJson(
          receipts.map((receipt) => ({
            entryKey: receipt.entryKey,
            receiptHash: receipt.receiptHash
          }))
        )
      },
      decisions: {
        ...decisionsArtifact,
        records: FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE,
        logicalDigest: hashFrenchInternalJson(
          decisions.map((decision) => ({
            entryKey: decision.entryKey,
            verdict: decision.verdict,
            artifactHash: decision.artifactHash
          }))
        )
      }
    },
    runHashesDigest,
    freshnessProofDigest
  };
  const summary: FrenchPilotBlindReauditSummary = {
    ...summaryContent,
    summaryHash: hashFrenchInternalJson(summaryContent)
  };
  const summaryPath = resolve(outputDir, "summary.json");
  installImmutableText(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  return { summary, summaryPath, receiptsPath, decisionsPath };
}

function assertExecutionFreshness(
  completed: readonly CompletedBatch[],
  priorThreads: Map<string, Record<FrenchInternalRole, string>>,
  priorAgents: Map<string, Record<FrenchInternalRole, string>>
): void {
  const currentThreads = completed.map((item) => item.run.threadId);
  if (new Set(currentThreads).size !== completed.length) {
    throw new Error("french-pilot-blind-reaudit-thread-reused-between-batches");
  }
  const currentAgents = completed.map((item) => item.run.agentId);
  if (new Set(currentAgents).size !== completed.length) {
    throw new Error("french-pilot-blind-reaudit-agent-reused-between-batches");
  }
  for (const item of completed) {
    for (const entryKey of item.batch.keys) {
      if (
        Object.values(priorThreads.get(entryKey)!).includes(
          item.run.threadId
        ) ||
        Object.values(priorAgents.get(entryKey)!).includes(item.run.agentId)
      ) {
        throw new Error(
          `french-pilot-blind-reaudit-thread-not-fresh:${entryKey}:${item.run.threadId}`
        );
      }
    }
  }
}

function extractPriorIdentities(review: FrenchInternalReviewRecord): {
  threads: Record<FrenchInternalRole, string>;
  agents: Record<FrenchInternalRole, string>;
} {
  const attestation = review.executionAttestation;
  if (!attestation) {
    throw new Error(
      `french-pilot-blind-reaudit-attestation-missing:${review.entryKey}`
    );
  }
  const entries = ROLES.map((role) => {
    const receipt = attestation.roleReceipts[role];
    if (
      receipt.role !== role ||
      receipt.entryKey !== review.entryKey ||
      receipt.receiptHash !== frenchInternalExecutionReceiptHash(receipt) ||
      !THREAD_ID_PATTERN.test(receipt.threadId)
    ) {
      throw new Error(
        `french-pilot-blind-reaudit-prior-receipt-invalid:${review.entryKey}:${role}`
      );
    }
    if (receipt.agentId !== `codex-agent:${receipt.threadId}`) {
      throw new Error(
        `french-pilot-blind-reaudit-prior-agent-invalid:${review.entryKey}:${role}`
      );
    }
    return { role, threadId: receipt.threadId, agentId: receipt.agentId };
  });
  const threads = Object.fromEntries(
    entries.map(({ role, threadId }) => [role, threadId])
  ) as Record<FrenchInternalRole, string>;
  const agents = Object.fromEntries(
    entries.map(({ role, agentId }) => [role, agentId])
  ) as Record<FrenchInternalRole, string>;
  if (
    new Set(Object.values(threads)).size !== ROLES.length ||
    new Set(Object.values(agents)).size !== ROLES.length
  ) {
    throw new Error(
      `french-pilot-blind-reaudit-prior-threads-not-distinct:${review.entryKey}`
    );
  }
  return { threads, agents };
}

function priorThreadsDigest(
  threads: Record<FrenchInternalRole, string>
): string {
  return hashFrenchInternalJson(
    ROLES.map((role) => ({ role, threadId: threads[role] }))
  );
}

function priorAgentsDigest(agents: Record<FrenchInternalRole, string>): string {
  return hashFrenchInternalJson(
    ROLES.map((role) => ({ role, agentId: agents[role] }))
  );
}

function batchSourceHashes(
  prepared: PreparedBlindReaudit,
  batch: FrenchPilotBlindReauditBatch
): Record<string, string> {
  return {
    manifest: prepared.manifestFileHash,
    batch: batch.batchHash,
    input: batch.input.sha256,
    outputSchema: batch.outputSchema.sha256,
    pilotManifest: prepared.sourceFileHashes.pilotManifest!,
    pilotSelection: prepared.sourceFileHashes.pilotSelection!,
    selectedPackets: prepared.sourceFileHashes.selectedPackets!,
    configuration: prepared.sourceFileHashes.configuration!,
    finalReview: prepared.sourceFileHashes.finalReview!
  };
}

function batchSourcePaths(
  prepared: PreparedBlindReaudit,
  batch: FrenchPilotBlindReauditBatch
): Omit<FrenchPilotBlindReauditReceipt["sourcePaths"], "runPointer"> {
  return {
    manifest: resolve(prepared.manifestPath),
    input: resolve(batch.input.path),
    outputSchema: resolve(batch.outputSchema.path),
    pilotManifest: resolve(prepared.manifest.sourcePaths.pilotManifest),
    pilotSelection: resolve(prepared.manifest.sourcePaths.pilotSelection),
    selectedPackets: resolve(prepared.manifest.sourcePaths.selectedPackets),
    configuration: resolve(prepared.manifest.sourcePaths.configuration),
    finalReview: resolve(prepared.manifest.sourcePaths.finalReview)
  };
}

function executionCapabilities(
  sealedWorkingDirectory: string
): FrenchCodexExecutionCapabilities {
  return {
    localTools: "disabled",
    networkDataTools: "disabled",
    shell: "disabled",
    eventPolicy: "agent-message-only",
    sealedWorkingDirectory: resolve(sealedWorkingDirectory),
    disabledFeaturesHash: frenchCodexDisabledFeaturesHash(),
    environmentPolicyHash: frenchCodexEnvironmentPolicyHash()
  };
}

/**
 * Generic sealed execution kernel. A post-full selector can reuse it with a
 * different namespace and sample size by building its own views, prompt, and
 * output schema through frenchBlindReauditRuntime.
 */
export async function executeFrenchBlindReauditBatch(input: {
  options: { codexHome: string; timeoutMs: number };
  executor: CodexBinaryIdentity;
  prompt: string;
  schemaPath: string;
  attemptDir: string;
}): Promise<FrenchBlindReauditExecution> {
  const responseTemp = resolve(
    input.attemptDir,
    "structured-response.tmp.json"
  );
  rmSync(responseTemp, { force: true });
  const startedAt = new Date().toISOString();
  const args = frenchCodexProposerExecArgs({
    model: FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.auditor.model,
    reasoningEffort:
      FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.auditor.reasoningEffort,
    schemaPath: input.schemaPath,
    responsePath: responseTemp,
    cwd: input.attemptDir
  });
  const executable = prepareFrenchCodexImmutableExecution(input.executor.path);
  if (
    canonicalFrenchInternalJson(executable.identity) !==
    canonicalFrenchInternalJson(input.executor)
  ) {
    executable.dispose();
    throw new Error("french-pilot-blind-reaudit-codex-snapshot-identity");
  }
  let child;
  try {
    child = spawn(executable.executionPath, args, {
      cwd: input.attemptDir,
      env: buildSealedFrenchCodexProposerEnvironment(input.options.codexHome),
      stdio: ["pipe", "pipe", "pipe"],
      detached: process.platform !== "win32"
    });
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
        signalProcessGroup(child.pid, "SIGTERM");
        killTimer = setTimeout(
          () => signalProcessGroup(child.pid, "SIGKILL"),
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
  if (timedOut || exitCode !== 0 || !existsSync(responseTemp)) {
    installImmutableText(
      resolve(input.attemptDir, "agent-events.jsonl"),
      stdout
    );
    installImmutableText(resolve(input.attemptDir, "agent-stderr.log"), stderr);
    throw new Error(
      timedOut
        ? `french-pilot-blind-reaudit-timeout:${input.options.timeoutMs}`
        : `french-pilot-blind-reaudit-codex-failed:${exitCode}`
    );
  }
  const responseText = readFileSync(responseTemp, "utf8");
  const responsePath = resolve(input.attemptDir, "structured-response.json");
  installImmutableText(responsePath, responseText);
  installImmutableText(resolve(input.attemptDir, "agent-events.jsonl"), stdout);
  installImmutableText(resolve(input.attemptDir, "agent-stderr.log"), stderr);
  const events = parseFrenchCodexAgentEvents(stdout, responseText);
  rmSync(responseTemp, { force: true });
  return {
    threadId: events.threadId,
    responseText,
    stdout,
    stderr,
    usage: events.usage,
    startedAt,
    completedAt
  };
}

function signalProcessGroup(
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

function prepareImmutableCodexBinary(
  options: RunFrenchPilotBlindReauditOptions
): CodexBinaryIdentity {
  return ensureFrenchCodexImmutableBinary({
    requestedPath: options.codexBinary,
    sourcePath: options.codexSourceBinary
  });
}

function assertExecutorUnchanged(executor: CodexBinaryIdentity): void {
  const current = assertFrenchCodexImmutableBinary(executor.path);
  if (
    canonicalFrenchInternalJson(current) !==
    canonicalFrenchInternalJson(executor)
  ) {
    throw new Error("french-pilot-blind-reaudit-codex-drift-during-run");
  }
}

export function assertFrenchPilotBlindReauditCodexAuthentication(
  codexHome: string
): void {
  const auth = resolve(codexHome, "auth.json");
  let authStat: ReturnType<typeof lstatSync>;
  try {
    authStat = lstatSync(auth);
  } catch {
    throw new Error(`french-pilot-blind-reaudit-auth-missing:${auth}`);
  }
  let target = auth;
  if (authStat.isSymbolicLink()) {
    try {
      target = realpathSync.native(auth);
    } catch {
      throw new Error(
        `french-pilot-blind-reaudit-auth-dangling-symlink:${auth}`
      );
    }
  }
  let targetStat: ReturnType<typeof lstatSync>;
  try {
    targetStat = lstatSync(target);
  } catch {
    throw new Error(`french-pilot-blind-reaudit-auth-target-missing:${auth}`);
  }
  if (!targetStat.isFile() || targetStat.isSymbolicLink()) {
    throw new Error(
      `french-pilot-blind-reaudit-auth-target-not-regular:${auth}`
    );
  }
  const currentUid = process.getuid?.();
  if (currentUid === undefined || targetStat.uid !== currentUid) {
    throw new Error(`french-pilot-blind-reaudit-auth-owner-invalid:${auth}`);
  }
  if ((targetStat.mode & 0o077) !== 0) {
    throw new Error(
      `french-pilot-blind-reaudit-auth-permissions-insecure:${auth}`
    );
  }
}

function assertPilotSelection(
  pilot: FrenchInternalPilotPlan,
  manifest: FrenchCodexPilotBatchManifest
): void {
  const { contentHash, ...content } = pilot;
  const manifestKeys = manifest.batches.flatMap((batch) => batch.keys);
  if (
    pilot.schemaVersion !== FRENCH_INTERNAL_PILOT_SCHEMA_VERSION ||
    pilot.policyVersion !== FRENCH_INTERNAL_WORK_POLICY_VERSION ||
    pilot.pilotSize !== FRENCH_PILOT_BLIND_REAUDIT_POPULATION_SIZE ||
    pilot.keys.length !== pilot.pilotSize ||
    pilot.selections.length !== pilot.pilotSize ||
    new Set(pilot.keys).size !== pilot.pilotSize ||
    contentHash !== hashFrenchInternalWorkJson(content) ||
    pilot.releaseKey !== manifest.lineage.releaseKey ||
    pilot.releaseSnapshotFingerprint !==
      manifest.lineage.releaseSnapshotFingerprint ||
    pilot.sourceLogicalDigest !== manifest.lineage.sourceLogicalDigest ||
    pilot.keys.some((key, index) => key !== manifestKeys[index]) ||
    pilot.selections.some(
      (selection, index) =>
        selection.entryKey !== pilot.keys[index] ||
        selection.lineage.packetHash.length !== 64
    )
  ) {
    throw new Error("french-pilot-blind-reaudit-pilot-selection-invalid");
  }
}

function assertSelectedPackets(
  packets: readonly LexiconV3FrenchPacket[],
  pilot: FrenchInternalPilotPlan,
  manifest: FrenchCodexPilotBatchManifest
): void {
  if (
    packets.length !== FRENCH_PILOT_BLIND_REAUDIT_POPULATION_SIZE ||
    packets.some(
      (packet, index) =>
        validateFrenchPacket(packet).length > 0 ||
        packet.entryKey !== pilot.keys[index] ||
        packet.packetHash !== pilot.selections[index]?.lineage.packetHash ||
        packet.english.contentHash !==
          pilot.selections[index]?.lineage.englishHash
    ) ||
    frenchCodexSelectedPacketsLogicalDigest(packets) !==
      manifest.selectedPackets.logicalDigest
  ) {
    throw new Error("french-pilot-blind-reaudit-packets-invalid");
  }
}

function assertConfiguration(
  configuration: FrenchInternalAssemblyConfigurationFile
): void {
  if (
    configuration.schemaVersion !==
      FRENCH_INTERNAL_ASSEMBLY_CONFIG_SCHEMA_VERSION ||
    configuration.generationConfigHash !==
      frenchInternalGenerationConfigHash(configuration.configuration) ||
    canonicalFrenchInternalJson(
      configuration.configuration.approvedExecutionProfile
    ) !==
      canonicalFrenchInternalJson(FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE)
  ) {
    throw new Error("french-pilot-blind-reaudit-configuration-invalid");
  }
}

function assertFinalReviews(
  reviews: readonly FrenchInternalReviewRecord[],
  packets: readonly LexiconV3FrenchPacket[],
  generationConfigHash: string
): void {
  if (
    reviews.length !== FRENCH_PILOT_BLIND_REAUDIT_POPULATION_SIZE ||
    new Set(reviews.map((review) => review.entryKey)).size !== reviews.length ||
    reviews.some(
      (review, index) => review.entryKey !== packets[index]?.entryKey
    )
  ) {
    throw new Error("french-pilot-blind-reaudit-final-review-coverage");
  }
  for (let index = 0; index < reviews.length; index += 1) {
    const review = reviews[index]!;
    const packet = packets[index]!;
    const evaluation = evaluateFrenchInternalReview({
      record: review,
      packet,
      expectedGenerationConfigHash: generationConfigHash
    });
    if (
      review.status !== "auto_validated" ||
      !evaluation.structurallyValid ||
      !evaluation.autoEligible ||
      evaluation.structuralIssues.length > 0 ||
      evaluation.autoEligibilityIssues.length > 0
    ) {
      throw new Error(
        `french-pilot-blind-reaudit-final-review-invalid:${review.entryKey}`
      );
    }
  }
}

async function mapConcurrent<T, R>(
  values: readonly T[],
  concurrency: number,
  worker: (value: T) => Promise<R>
): Promise<R[]> {
  const output = new Array<R>(values.length);
  let next = 0;
  const run = async (): Promise<void> => {
    while (true) {
      const index = next;
      next += 1;
      if (index >= values.length) return;
      output[index] = await worker(values[index]!);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => run())
  );
  return output;
}

function readArtifact(path: string): {
  path: string;
  text: string;
  sha256: string;
  bytes: number;
} {
  const absolute = resolve(path);
  assertRegularNonSymlink(absolute, "source");
  const buffer = readFileSync(absolute);
  return {
    path: absolute,
    text: buffer.toString("utf8"),
    sha256: hashFrenchPilotBlindReauditBytes(buffer),
    bytes: buffer.byteLength
  };
}

function parseJson<T>(text: string, label: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`french-pilot-blind-reaudit-invalid-json:${label}`);
  }
}

function parseJsonl<T>(text: string, label: string): T[] {
  const lines = text.split(/\r?\n/u);
  if (lines.at(-1) === "") lines.pop();
  if (lines.length === 0 || lines.some((line) => !line.trim())) {
    throw new Error(`french-pilot-blind-reaudit-invalid-jsonl:${label}`);
  }
  return lines.map((line, index) =>
    parseJson<T>(line, `${label}:${index + 1}`)
  );
}

function fileArtifact(path: string): FrenchPilotBlindReauditFileArtifact {
  const absolute = resolve(path);
  const buffer = readFileSync(absolute);
  return {
    path: absolute,
    sha256: hashFrenchPilotBlindReauditBytes(buffer),
    bytes: buffer.byteLength
  };
}

function installImmutableText(path: string, text: string): void {
  const absolute = resolve(path);
  mkdirSync(dirname(absolute), { recursive: true });
  if (existsSync(absolute)) {
    assertRegularNonSymlink(absolute, "immutable-output");
    if (readFileSync(absolute, "utf8") !== text) {
      throw new Error(`french-pilot-blind-reaudit-output-conflict:${absolute}`);
    }
    return;
  }
  const temporary = `${absolute}.tmp-${process.pid}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
  let descriptor: number | null = null;
  try {
    descriptor = openSync(temporary, "wx", 0o600);
    writeFileSync(descriptor, text, "utf8");
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = null;
    try {
      linkSync(temporary, absolute);
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code !== "EEXIST" ||
        readFileSync(absolute, "utf8") !== text
      ) {
        throw error;
      }
    }
    fsyncDirectory(dirname(absolute));
  } finally {
    if (descriptor !== null) closeSync(descriptor);
    rmSync(temporary, { force: true });
  }
}

function assertRegularNonSymlink(path: string, label: string): void {
  if (!existsSync(path)) {
    throw new Error(`french-pilot-blind-reaudit-${label}-missing:${path}`);
  }
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`french-pilot-blind-reaudit-${label}-not-regular:${path}`);
  }
}

function fsyncDirectory(path: string): void {
  const descriptor = openSync(path, "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function assertOptions(options: RunFrenchPilotBlindReauditOptions): void {
  if (
    !Number.isInteger(options.timeoutMs) ||
    options.timeoutMs < 1 ||
    !Number.isInteger(options.concurrency) ||
    options.concurrency < 1 ||
    options.concurrency > 15 ||
    !Number.isInteger(options.maxAttempts) ||
    options.maxAttempts < 1 ||
    options.maxAttempts > 3 ||
    (options.prepareOnly && options.existingOnly)
  ) {
    throw new Error("french-pilot-blind-reaudit-options-invalid");
  }
}

export function parseFrenchPilotBlindReauditArgs(
  args: readonly string[]
): RunFrenchPilotBlindReauditOptions {
  const allowed = new Set([
    "pilot-manifest",
    "pilot-selection",
    "selected-packets",
    "configuration",
    "final-review",
    "output-dir",
    "codex-binary",
    "codex-source-binary",
    "codex-home",
    "timeout-ms",
    "concurrency",
    "max-attempts",
    "prepare-only",
    "existing-only"
  ]);
  const booleans = new Set(["prepare-only", "existing-only"]);
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index] ?? "";
    if (!token.startsWith("--"))
      throw new Error(`unexpected-argument:${token}`);
    const [key, inline] = token.slice(2).split("=", 2);
    if (!allowed.has(key)) throw new Error(`unknown-option:${key}`);
    if (values.has(key)) throw new Error(`duplicate-option:${key}`);
    if (booleans.has(key)) {
      if (inline !== undefined) throw new Error(`boolean-option-value:${key}`);
      values.set(key, "true");
      continue;
    }
    const next = args[index + 1];
    if (inline !== undefined) {
      if (!inline) throw new Error(`missing-value:${key}`);
      values.set(key, inline);
    } else if (next && !next.startsWith("--")) {
      values.set(key, next);
      index += 1;
    } else {
      throw new Error(`missing-value:${key}`);
    }
  }
  const pilotManifestPath = resolve(
    values.get("pilot-manifest") ?? DEFAULT_PILOT_MANIFEST
  );
  let selectedPackets = `${ROOT}/agent-batches/pilot/selected-packets.jsonl`;
  if (existsSync(pilotManifestPath)) {
    const manifest = parseJson<FrenchCodexPilotBatchManifest>(
      readFileSync(pilotManifestPath, "utf8"),
      "pilot-manifest-defaults"
    );
    if (manifest.selectedPackets?.path)
      selectedPackets = manifest.selectedPackets.path;
  }
  const parsedOptions: RunFrenchPilotBlindReauditOptions = {
    pilotManifestPath,
    pilotSelectionPath: resolve(
      values.get("pilot-selection") ?? DEFAULT_PILOT_SELECTION
    ),
    selectedPacketsPath: resolve(
      values.get("selected-packets") ?? selectedPackets
    ),
    configurationPath: resolve(
      values.get("configuration") ?? DEFAULT_CONFIGURATION
    ),
    finalReviewPath: resolve(
      values.get("final-review") ?? DEFAULT_FINAL_REVIEW
    ),
    outputDir: resolve(values.get("output-dir") ?? DEFAULT_OUTPUT_DIR),
    codexBinary: resolve(values.get("codex-binary") ?? DEFAULT_CODEX_BINARY),
    codexSourceBinary: resolve(
      values.get("codex-source-binary") ?? DEFAULT_CODEX_SOURCE_BINARY
    ),
    codexHome: resolve(values.get("codex-home") ?? DEFAULT_CODEX_HOME),
    timeoutMs: Number(values.get("timeout-ms") ?? DEFAULT_TIMEOUT_MS),
    concurrency: Number(values.get("concurrency") ?? DEFAULT_CONCURRENCY),
    maxAttempts: Number(values.get("max-attempts") ?? DEFAULT_MAX_ATTEMPTS),
    prepareOnly: values.has("prepare-only"),
    existingOnly: values.has("existing-only")
  };
  assertOptions(parsedOptions);
  return parsedOptions;
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  runLexiconV3FrenchPilotBlindReaudit(
    parseFrenchPilotBlindReauditArgs(process.argv.slice(2))
  )
    .then((result) => {
      process.stdout.write(
        `${JSON.stringify(
          {
            event: result.summary
              ? "french-pilot-blind-reaudit-passed"
              : "french-pilot-blind-reaudit-prepared",
            manifestHash: result.manifest.manifestHash,
            selectionHash: result.manifest.selection.selectionHash,
            sampleSize: result.manifest.selection.sampleSize,
            batches: result.manifest.batches.length,
            manifestPath: result.manifestPath,
            ...(result.summary
              ? {
                  summaryHash: result.summary.summaryHash,
                  summaryPath: result.summaryPath,
                  receiptsPath: result.receiptsPath,
                  decisionsPath: result.decisionsPath
                }
              : {})
          },
          null,
          2
        )}\n`
      );
    })
    .catch((error: unknown) => {
      process.stderr.write(
        `${basename(process.argv[1] ?? "runLexiconV3FrenchPilotBlindReaudit")}: ${
          error instanceof Error ? error.message : String(error)
        }\n`
      );
      process.exitCode = 1;
    });
}
