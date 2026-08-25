import { spawn, type ChildProcess } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  finalizeFrenchEntityRemediationExecutionBatch,
  finalizeFrenchEntityRemediationExecutionManifest,
  finalizeFrenchEntityRemediationIndex,
  finalizeFrenchEntityRemediationIndexRoundRef,
  frenchEntityRemediationRoleBatchInputHash,
  type FrenchEntityRemediationExecutionManifest,
  type FrenchEntityRemediationIndex
} from "../src/lexiconV3/frenchEntityMergeAttestationV2.js";
import {
  existsSync,
  linkSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  assertFrenchEntityAgentBatchManifest,
  assertFrenchEntityAgentInputArtifact,
  assertFrenchEntityAgentUnitArtifacts,
  frenchEntityAgentUnboundAlternateNameEntryKeys,
  frenchEntityAgentUnboundNameEntryKeys,
  frenchEntityAgentArbiterUnitInputHash,
  frenchEntityAgentArbitrationResponseSchema,
  frenchEntityAgentAuditorUnitInputHash,
  frenchEntityAgentAuditResponseSchema,
  frenchEntityAgentProposalResponseSchema,
  parseFrenchEntityAgentArbitrationResponse,
  parseFrenchEntityAgentAuditResponse,
  parseFrenchEntityAgentProposalResponse,
  FRENCH_ENTITY_AGENT_INPUT_SCHEMA_VERSION,
  FRENCH_ENTITY_AGENT_POLICY_VERSION,
  type FrenchEntityAgentArbitration,
  type FrenchEntityAgentArbitrationOutputContract,
  type FrenchEntityAgentAudit,
  type FrenchEntityAgentAuditOutputContract,
  type FrenchEntityAgentBatchManifest,
  type FrenchEntityAgentInputArtifact,
  type FrenchEntityAgentProposal,
  type FrenchEntityAgentProposalOutputContract,
  type FrenchEntityAgentProposerAView,
  type FrenchEntityAgentProposerBView,
  type FrenchEntityAgentProposerRole,
  type FrenchEntityAgentRole,
  type FrenchEntityAgentUnitArtifacts,
  type FrenchEntityAgentUnitInputHashes
} from "../src/lexiconV3/frenchEntityAgentReview.js";
import {
  FRENCH_ENTITY_CANONICALIZATION_DEFAULT_EXPECTATIONS,
  canonicalFrenchEntityJson,
  hashFrenchEntityJson,
  type FrenchEntityCanonicalizationExpectations,
  type FrenchEntityCanonicalizationPlan
} from "../src/lexiconV3/frenchEntityCanonicalization.js";
import {
  ensureFrenchCodexImmutableBinary,
  FRENCH_CODEX_IMMUTABLE_BINARY_PATH,
  prepareFrenchCodexImmutableExecution
} from "../src/lexiconV3/frenchCodexImmutableBinary.js";
import {
  assertFrenchCodexExecutionReceipt,
  finalizeFrenchCodexExecutionReceipt,
  FRENCH_INTERNAL_EXECUTION_RECEIPT_SCHEMA_VERSION,
  type FrenchCodexExecutionReceipt
} from "../src/lexiconV3/frenchCodexExecutionReceipt.js";
import { FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE } from "../src/lexiconV3/frenchInternalReview.js";
import {
  buildFrenchEntityRemediationRoundPlan,
  buildFrenchEntityRemediationConcordanceResolutionProofs,
  finalizeFrenchEntityRemediationRound,
  frenchEntityAgentQuartetHash,
  frenchEntityRemediationArbiterInputHash,
  frenchEntityRemediationAuditorInputHash,
  frenchEntityRemediationUnresolvedEvidenceConflictCodes,
  semanticFrenchEntityProposalHash,
  FRENCH_ENTITY_REMEDIATION_MAX_ROUNDS,
  FRENCH_ENTITY_REMEDIATION_POLICY_VERSION,
  FRENCH_ENTITY_REMEDIATION_ROUND_PLAN_SCHEMA_VERSION,
  type FrenchEntityRemediationBaseViews,
  type FrenchEntityRemediationRoundBundle,
  type FrenchEntityRemediationRoundPlan,
  type FrenchEntityRemediationRoundPlanUnit,
  type FrenchEntityRemediationRoundResult
} from "../src/lexiconV3/frenchEntityRemediation.js";
import {
  assertFrenchEntityAgentResultDirectory,
  assertFrenchEntityAgentRun,
  FRENCH_ENTITY_AGENT_DEFAULT_MAX_ATTEMPTS,
  FRENCH_ENTITY_AGENT_MAX_ATTEMPTS_LIMIT,
  FRENCH_ENTITY_AGENT_RUN_SCHEMA_VERSION,
  FRENCH_ENTITY_AGENT_RUNNER_POLICY_VERSION,
  replayFrenchEntityAgentStoredRole,
  runFrenchEntityAgentAttempts,
  FrenchEntityAgentRetryableAttemptError,
  type FrenchEntityAgentRun,
  type FrenchEntityAgentRunCliOptions
} from "./runLexiconV3FrenchEntityAgents.js";
import {
  acquireExclusiveRoleLock,
  buildSealedFrenchCodexProposerEnvironment,
  FRENCH_CODEX_EXECUTOR_POLICY_VERSION,
  frenchCodexDisabledFeaturesHash,
  frenchCodexEnvironmentPolicyHash,
  frenchCodexProposerExecArgs,
  parseFrenchCodexAgentEvents
} from "./runLexiconV3FrenchCodexProposerBatch.js";

export const FRENCH_ENTITY_REMEDIATION_ROLE_INPUT_SCHEMA_VERSION =
  "lexicon-v3-french-entity-remediation-role-input@1" as const;
export const FRENCH_ENTITY_REMEDIATION_RUNNER_POLICY_VERSION =
  "lexicon-v3-french-entity-remediation-runner-policy@3" as const;
export const FRENCH_ENTITY_REMEDIATION_RUN_POINTER_SCHEMA_VERSION =
  "lexicon-v3-french-entity-remediation-run-pointer@1" as const;
export const FRENCH_ENTITY_REMEDIATION_QUARANTINE_SCHEMA_VERSION =
  "lexicon-v3-french-entity-remediation-quarantine@1" as const;

const DEFAULT_MANIFEST =
  "outputs/lexicon-v3/french-entities/agent-batches/manifest.json";
const DEFAULT_RESULTS = "outputs/lexicon-v3/french-entities/agent-results";
const DEFAULT_CODEX_HOME = "outputs/lexicon-v3/fr-internal/codex-agent-home";
const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const THREAD_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export type FrenchEntityRemediationRunStage =
  | "proposerA"
  | "proposerB"
  | "proposers"
  | "arbiter"
  | "auditor"
  | "all";

export interface FrenchEntityRemediationRunCliOptions {
  manifest: string;
  roundPlan: string;
  resultsDir: string;
  releaseKey: string;
  stage: FrenchEntityRemediationRunStage;
  concurrency: number;
  codexBinary: string;
  codexHome: string;
  timeoutMs: number;
  maxAttempts: number;
  existingOnly: boolean;
}

export interface FrenchEntityRemediationExecutionBatch {
  batchId: string;
  sourceBatchHash: string;
  unitIds: string[];
  units: FrenchEntityRemediationRoundPlanUnit[];
  selectionHash: string;
  batchHash: string;
  unitPlanHashes: { unitId: string; planUnitHash: string }[];
}

interface AgentUsage {
  input_tokens?: number;
  cached_input_tokens?: number;
  output_tokens?: number;
  reasoning_output_tokens?: number;
}

export type FrenchEntityRemediationAgentRun = FrenchEntityAgentRun;

export interface FrenchEntityRemediationRoleExecutionInput {
  text: string;
  logicalHash: string;
  unitInputHashes: Map<string, string>;
  schema: object;
  prompt: string;
  parse(
    text: string
  ): Array<
    | FrenchEntityAgentProposal
    | FrenchEntityAgentArbitration
    | FrenchEntityAgentAudit
  >;
}

export type FrenchEntityRemediationResponseCollection =
  | "proposals"
  | "decisions"
  | "audits";

/**
 * Remediation batches use exact unit-id properties instead of a homogeneous
 * array. Array cardinality plus `items.anyOf` cannot prevent a model from
 * returning the same unit twice and omitting another one. Required object
 * properties make that state unrepresentable in structured output while the
 * values retain the historical per-unit entity-agent schemas.
 */
export function frenchEntityRemediationProposalResponseSchema(
  role: FrenchEntityAgentProposerRole,
  contracts: readonly FrenchEntityAgentProposalOutputContract[]
): object {
  frenchEntityAgentProposalResponseSchema(role, contracts);
  return remediationKeyedResponseSchema(contracts, (contract) =>
    responseCollectionItemSchema(
      frenchEntityAgentProposalResponseSchema(role, [contract]),
      "proposals"
    )
  );
}

export function frenchEntityRemediationArbitrationResponseSchema(
  contracts: readonly FrenchEntityAgentArbitrationOutputContract[]
): object {
  frenchEntityAgentArbitrationResponseSchema(contracts);
  return remediationKeyedResponseSchema(contracts, (contract) =>
    responseCollectionItemSchema(
      frenchEntityAgentArbitrationResponseSchema([contract]),
      "decisions"
    )
  );
}

export function frenchEntityRemediationAuditResponseSchema(
  contracts: readonly FrenchEntityAgentAuditOutputContract[]
): object {
  frenchEntityAgentAuditResponseSchema(contracts);
  return remediationKeyedResponseSchema(contracts, (contract) =>
    responseCollectionItemSchema(
      frenchEntityAgentAuditResponseSchema([contract]),
      "audits"
    )
  );
}

/**
 * Deterministically adapts the remediation-only keyed envelope to the legacy
 * array envelope consumed by the existing domain parsers. Exact key coverage
 * and the redundant value.unitId binding are checked before adaptation.
 */
export function adaptFrenchEntityRemediationKeyedResponse(input: {
  text: string;
  unitIds: readonly string[];
  collection: FrenchEntityRemediationResponseCollection;
}): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.text);
  } catch {
    throw new Error("french-entity-remediation-response-json-invalid");
  }
  const root = remediationResponseObject(parsed, "response");
  assertRemediationResponseExactKeys(root, ["units"], "response");
  const units = remediationResponseObject(root.units, "units");
  assertRemediationUnitIds(input.unitIds);
  assertRemediationResponseExactKeys(units, input.unitIds, "units");
  const values = input.unitIds.map((unitId) => {
    const value = remediationResponseObject(units[unitId], `unit:${unitId}`);
    if (value.unitId !== unitId) {
      throw new Error(
        `french-entity-remediation-response-unit-binding:${unitId}`
      );
    }
    return value;
  });
  return canonicalFrenchEntityJson({ [input.collection]: values });
}

export interface FrenchEntityRemediationRoleArtifacts {
  proposalA?: ReadonlyMap<string, FrenchEntityAgentProposal>;
  proposalB?: ReadonlyMap<string, FrenchEntityAgentProposal>;
  arbitration?: ReadonlyMap<string, FrenchEntityAgentArbitration>;
}

export interface FrenchEntityRemediationProcessExecution {
  threadId: string;
  stdout: string;
  stderr: string;
  responseText: string;
  usage: AgentUsage | null;
  startedAt: string;
  completedAt: string;
}

export interface FrenchEntityRemediationProcessInput {
  options: Pick<
    FrenchEntityRemediationRunCliOptions,
    "codexBinary" | "codexHome" | "timeoutMs"
  >;
  role: FrenchEntityAgentRole;
  profile: { model: string; reasoningEffort: string };
  prompt: string;
  schemaPath: string;
  responsePath: string;
  workingDirectory: string;
}

export interface FrenchEntityRemediationRunnerDependencies {
  executeAgent?: (
    input: FrenchEntityRemediationProcessInput
  ) => Promise<FrenchEntityRemediationProcessExecution>;
  executorMetadata?: {
    path: string;
    version: string;
    sha256: string;
  };
  /** Test/fixture-only override; CLI production always uses frozen defaults. */
  expectations?: FrenchEntityCanonicalizationExpectations;
}

export interface FrenchEntityRemediationExecutionSummary {
  releaseKey: string;
  round: number;
  roundPlanHash: string;
  stage: FrenchEntityRemediationRunStage;
  units: number;
  batches: number;
  runs: number;
  reused: number;
  executed: number;
  distinctThreads: number;
  roundResultPath: string | null;
  remediationIndexPath: string | null;
  residualUnitIds: string[] | null;
}

function remediationKeyedResponseSchema<T extends { unitId: string }>(
  contracts: readonly T[],
  itemSchema: (contract: T) => object
): object {
  assertRemediationUnitIds(contracts.map((contract) => contract.unitId));
  return {
    type: "object",
    additionalProperties: false,
    required: ["units"],
    properties: {
      units: {
        type: "object",
        additionalProperties: false,
        required: contracts.map((contract) => contract.unitId),
        properties: Object.fromEntries(
          contracts.map((contract) => [contract.unitId, itemSchema(contract)])
        )
      }
    }
  };
}

function responseCollectionItemSchema(
  schema: object,
  collection: FrenchEntityRemediationResponseCollection
): object {
  const root = remediationResponseObject(schema, "schema");
  const properties = remediationResponseObject(
    root.properties,
    "schema-properties"
  );
  const collectionSchema = remediationResponseObject(
    properties[collection],
    `schema-collection:${collection}`
  );
  return remediationResponseObject(
    collectionSchema.items,
    `schema-items:${collection}`
  );
}

function assertRemediationUnitIds(unitIds: readonly string[]): void {
  if (
    unitIds.length === 0 ||
    new Set(unitIds).size !== unitIds.length ||
    unitIds.some((unitId) => typeof unitId !== "string" || !unitId)
  ) {
    throw new Error("french-entity-remediation-response-unit-ids-invalid");
  }
}

function remediationResponseObject(
  value: unknown,
  label: string
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`french-entity-remediation-${label}-not-object`);
  }
  return value as Record<string, unknown>;
}

function assertRemediationResponseExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string
): void {
  const actual = Object.keys(value).sort(compareText);
  const sortedExpected = [...expected].sort(compareText);
  if (
    canonicalFrenchEntityJson(actual) !==
    canonicalFrenchEntityJson(sortedExpected)
  ) {
    throw new Error(`french-entity-remediation-${label}-coverage`);
  }
}

export class FrenchEntityRemediationChildSupervisor {
  private readonly active = new Map<ChildProcess, Promise<void>>();
  private shutdownSignal: "SIGINT" | "SIGTERM" | null = null;
  private forceKillTimer: ReturnType<typeof setTimeout> | null = null;

  track(child: ChildProcess): void {
    const closed = new Promise<void>((resolveClosed) => {
      const finish = (): void => {
        child.off("close", finish);
        child.off("error", finish);
        this.active.delete(child);
        resolveClosed();
      };
      child.once("close", finish);
      child.once("error", finish);
    });
    this.active.set(child, closed);
    if (this.shutdownSignal !== null) signalChild(child.pid, "SIGTERM");
  }

  requestShutdown(signal: "SIGINT" | "SIGTERM"): void {
    const repeated = this.shutdownSignal !== null;
    this.shutdownSignal ??= signal;
    this.signalAll(repeated ? "SIGKILL" : "SIGTERM");
    if (!repeated && this.forceKillTimer === null) {
      this.forceKillTimer = setTimeout(() => this.signalAll("SIGKILL"), 2_000);
      this.forceKillTimer.unref();
    }
  }

  assertRunning(): void {
    if (this.shutdownSignal !== null) {
      throw new Error(
        `french-entity-remediation-run-interrupted:${this.shutdownSignal}`
      );
    }
  }

  async terminateAndWait(): Promise<void> {
    if (this.active.size > 0 && this.shutdownSignal === null) {
      this.requestShutdown("SIGTERM");
    }
    while (this.active.size > 0) {
      await Promise.allSettled([...this.active.values()]);
    }
    if (this.forceKillTimer !== null) {
      clearTimeout(this.forceKillTimer);
      this.forceKillTimer = null;
    }
  }

  private signalAll(signal: NodeJS.Signals): void {
    for (const child of this.active.keys()) signalChild(child.pid, signal);
  }
}

export function installFrenchEntityRemediationSignalCleanup(
  supervisor: FrenchEntityRemediationChildSupervisor
): () => void {
  const onSigint = (): void => supervisor.requestShutdown("SIGINT");
  const onSigterm = (): void => supervisor.requestShutdown("SIGTERM");
  process.on("SIGINT", onSigint);
  process.on("SIGTERM", onSigterm);
  return () => {
    process.off("SIGINT", onSigint);
    process.off("SIGTERM", onSigterm);
  };
}

export interface FrenchEntityRemediationReplay {
  roundRoot: string;
  plan: FrenchEntityRemediationRoundPlan;
  result: FrenchEntityRemediationRoundResult;
  artifacts: Map<string, FrenchEntityAgentUnitArtifacts>;
  runs: FrenchEntityRemediationAgentRun[];
  receipts: FrenchCodexExecutionReceipt<FrenchEntityAgentRole>[];
  batches: FrenchEntityRemediationExecutionBatch[];
}

export interface BuildNextFrenchEntityRemediationRoundPlanInput {
  manifest: string;
  resultsDir: string;
  releaseKey: string;
  previousRoundPlan?: string;
  /** Test/fixture-only override; production callers must use frozen defaults. */
  expectations?: FrenchEntityCanonicalizationExpectations;
}

export interface BuiltNextFrenchEntityRemediationRoundPlan {
  plan: FrenchEntityRemediationRoundPlan;
  manifestHash: string;
  canonicalPlanHash: string;
  baseRunCount: number;
  historicalRoundCount: number;
  historicalRunCount: number;
}

interface LoadedBaseState {
  views: Map<string, FrenchEntityRemediationBaseViews>;
  artifacts: Map<string, FrenchEntityAgentUnitArtifacts>;
  runs: FrenchEntityAgentRun[];
}

interface LoadedExecutionContext {
  options: FrenchEntityRemediationRunCliOptions;
  manifest: FrenchEntityAgentBatchManifest;
  manifestText: string;
  canonicalPlan: FrenchEntityCanonicalizationPlan;
  canonicalPlanText: string;
  canonicalPlanPath: string;
  roundPlan: FrenchEntityRemediationRoundPlan;
  roundPlanText: string;
  executionManifest: FrenchEntityRemediationExecutionManifest;
  executionManifestText: string;
  batches: FrenchEntityRemediationExecutionBatch[];
  base: LoadedBaseState;
  history: FrenchEntityRemediationRoundBundle[];
  historicalRuns: FrenchEntityRemediationAgentRun[];
}

interface RoleState {
  proposalA: Map<string, FrenchEntityAgentProposal>;
  proposalB: Map<string, FrenchEntityAgentProposal>;
  arbitration: Map<string, FrenchEntityAgentArbitration>;
  audit: Map<string, FrenchEntityAgentAudit>;
  runs: FrenchEntityRemediationAgentRun[];
  receipts: FrenchCodexExecutionReceipt<FrenchEntityAgentRole>[];
}

class FrenchEntityRemediationProcessError extends Error {
  readonly evidence: Omit<
    FrenchEntityRemediationProcessExecution,
    "threadId" | "usage"
  >;

  constructor(
    message: string,
    evidence: Omit<
      FrenchEntityRemediationProcessExecution,
      "threadId" | "usage"
    >
  ) {
    super(message);
    this.name = "FrenchEntityRemediationProcessError";
    this.evidence = evidence;
  }
}

export function parseFrenchEntityRemediationRunArgs(
  args: readonly string[]
): FrenchEntityRemediationRunCliOptions {
  const valueOptions = new Set([
    "manifest",
    "round-plan",
    "results-dir",
    "release-key",
    "stage",
    "concurrency",
    "codex-binary",
    "codex-home",
    "timeout-ms",
    "max-attempts"
  ]);
  const flags = new Set(["existing-only"]);
  const values = new Map<string, string>();
  const seen = new Set<string>();
  let existingOnly = false;
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index] ?? "";
    if (!token.startsWith("--")) {
      throw new Error(`french-entity-remediation-unexpected-argument:${token}`);
    }
    const key = token.slice(2);
    if (!valueOptions.has(key) && !flags.has(key)) {
      throw new Error(`french-entity-remediation-unknown-option:${key}`);
    }
    if (seen.has(key)) {
      throw new Error(`french-entity-remediation-duplicate-option:${key}`);
    }
    seen.add(key);
    if (flags.has(key)) {
      existingOnly = true;
      continue;
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`french-entity-remediation-missing-value:${key}`);
    }
    values.set(key, value);
    index += 1;
  }
  const roundPlan = values.get("round-plan")?.trim();
  if (!roundPlan) {
    throw new Error("french-entity-remediation-round-plan-required");
  }
  const releaseKey = values.get("release-key")?.trim();
  if (!releaseKey) {
    throw new Error("french-entity-remediation-release-key-required");
  }
  const stage = (values.get("stage") ??
    "all") as FrenchEntityRemediationRunStage;
  if (
    ![
      "proposerA",
      "proposerB",
      "proposers",
      "arbiter",
      "auditor",
      "all"
    ].includes(stage)
  ) {
    throw new Error(`french-entity-remediation-stage-invalid:${stage}`);
  }
  return {
    manifest: resolve(values.get("manifest") ?? DEFAULT_MANIFEST),
    roundPlan: resolve(roundPlan),
    resultsDir: resolve(values.get("results-dir") ?? DEFAULT_RESULTS),
    releaseKey,
    stage,
    concurrency: positiveInteger(values.get("concurrency"), 3, "concurrency"),
    codexBinary: resolve(
      values.get("codex-binary") ?? FRENCH_CODEX_IMMUTABLE_BINARY_PATH
    ),
    codexHome: resolve(values.get("codex-home") ?? DEFAULT_CODEX_HOME),
    timeoutMs: positiveInteger(
      values.get("timeout-ms"),
      DEFAULT_TIMEOUT_MS,
      "timeout-ms"
    ),
    maxAttempts: boundedPositiveInteger(
      values.get("max-attempts"),
      FRENCH_ENTITY_AGENT_DEFAULT_MAX_ATTEMPTS,
      FRENCH_ENTITY_AGENT_MAX_ATTEMPTS_LIMIT,
      "max-attempts"
    ),
    existingOnly
  };
}

/**
 * Maps the exact remediation subset back onto the immutable base batches. No
 * offset/limit selector exists on purpose: a role always covers the whole plan.
 */
export function buildFrenchEntityRemediationExecutionBatches(
  manifest: FrenchEntityAgentBatchManifest,
  plan: FrenchEntityRemediationRoundPlan
): FrenchEntityRemediationExecutionBatch[] {
  const unitById = new Map(plan.units.map((unit) => [unit.unitId, unit]));
  if (
    plan.unitIds.length === 0 ||
    unitById.size !== plan.unitIds.length ||
    canonicalFrenchEntityJson(plan.unitIds) !==
      canonicalFrenchEntityJson([...plan.unitIds].sort(compareText))
  ) {
    throw new Error("french-entity-remediation-plan-unit-set-invalid");
  }
  const batches = manifest.batches.flatMap((sourceBatch) => {
    const unitIds = sourceBatch.unitIds.filter((unitId) =>
      unitById.has(unitId)
    );
    if (unitIds.length === 0) return [];
    const units = unitIds.map((unitId) => requiredMap(unitById, unitId));
    const attestedBatch = finalizeFrenchEntityRemediationExecutionBatch({
      round: plan.round,
      roundPlanHash: plan.planHash,
      batchId: sourceBatch.batchId,
      sourceBatchHash: sourceBatch.batchHash,
      units: units.map((unit) => ({
        unitId: unit.unitId,
        planUnitHash: unit.unitHash
      }))
    });
    return [
      {
        ...attestedBatch,
        sourceBatchHash: sourceBatch.batchHash,
        units
      }
    ];
  });
  const actual = batches.flatMap((batch) => batch.unitIds).sort(compareText);
  if (
    canonicalFrenchEntityJson(actual) !==
    canonicalFrenchEntityJson(plan.unitIds)
  ) {
    throw new Error("french-entity-remediation-selection-not-exact");
  }
  return batches;
}

export function frenchEntityRemediationRoundRoot(
  resultsDir: string,
  plan: Pick<FrenchEntityRemediationRoundPlan, "round" | "planHash">
): string {
  return resolve(
    resultsDir,
    "remediation",
    `round-${String(plan.round).padStart(2, "0")}-${plan.planHash.slice(0, 16)}`
  );
}

export function buildFrenchEntityRemediationRoleExecutionInput(input: {
  manifest: FrenchEntityAgentBatchManifest;
  canonicalPlan: FrenchEntityCanonicalizationPlan;
  roundPlan: FrenchEntityRemediationRoundPlan;
  batch: FrenchEntityRemediationExecutionBatch;
  role: FrenchEntityAgentRole;
  artifacts?: FrenchEntityRemediationRoleArtifacts;
}): FrenchEntityRemediationRoleExecutionInput {
  if (input.role === "proposerA" || input.role === "proposerB") {
    return buildProposerExecutionInput(input, input.role);
  }
  const proposalA = requiredArtifactMap(
    input.artifacts?.proposalA,
    "proposerA"
  );
  const proposalB = requiredArtifactMap(
    input.artifacts?.proposalB,
    "proposerB"
  );
  if (input.role === "arbiter") {
    const records = input.batch.units.map((unit) => {
      const left = requiredMap(proposalA, unit.unitId);
      const right = requiredMap(proposalB, unit.unitId);
      return {
        unitId: unit.unitId,
        round: input.roundPlan.round,
        planUnitHash: unit.unitHash,
        sourceView: unit.proposerB.view,
        remediationContext: unit.proposerB.context,
        proposalA: left,
        proposalB: right,
        inputHash: frenchEntityRemediationArbiterInputHash(unit, left, right)
      };
    });
    const content = roleInputContent(input, records);
    const unitInputHashes = new Map(
      records.map((record) => [record.unitId, record.inputHash])
    );
    const logicalHash = remediationRoleBatchInputHash(input, unitInputHashes);
    const text = `${canonicalFrenchEntityJson({ ...content, inputHash: logicalHash })}\n`;
    const contracts: FrenchEntityAgentArbitrationOutputContract[] = records.map(
      (record) => ({
        unitId: record.unitId,
        inputHash: record.inputHash,
        proposalAHash: record.proposalA.proposalHash,
        proposalBHash: record.proposalB.proposalHash
      })
    );
    return {
      text,
      logicalHash,
      unitInputHashes,
      schema: frenchEntityRemediationArbitrationResponseSchema(contracts),
      prompt: remediationArbiterPrompt(
        text,
        contracts,
        input.batch.unitIds.length
      ),
      parse: (response) =>
        parseFrenchEntityAgentArbitrationResponse({
          text: adaptFrenchEntityRemediationKeyedResponse({
            text: response,
            unitIds: input.batch.unitIds,
            collection: "decisions"
          }),
          unitIds: input.batch.unitIds,
          inputHashes: unitInputHashes,
          proposalA,
          proposalB
        })
    };
  }
  const arbitration = requiredArtifactMap(
    input.artifacts?.arbitration,
    "arbiter"
  );
  const records = input.batch.units.map((unit) => {
    const decision = requiredMap(arbitration, unit.unitId);
    if (
      decision.selectedProposal !== "proposalA" &&
      decision.selectedProposal !== "proposalB"
    ) {
      throw new Error(
        `french-entity-remediation-runner-selection-invalid:${unit.unitId}`
      );
    }
    const selectedProposal =
      decision.selectedProposal === "proposalA"
        ? requiredMap(proposalA, unit.unitId)
        : requiredMap(proposalB, unit.unitId);
    const quartet = {
      proposalA: requiredMap(proposalA, unit.unitId),
      proposalB: requiredMap(proposalB, unit.unitId),
      arbitration: decision
    };
    return {
      unitId: unit.unitId,
      round: input.roundPlan.round,
      planUnitHash: unit.unitHash,
      sourceView: unit.proposerB.view,
      remediationContext: unit.proposerB.context,
      arbitration: decision,
      selectedProposal,
      concordanceResolutionProofs:
        buildFrenchEntityRemediationConcordanceResolutionProofs({
          sourceView: unit.proposerB.view,
          selectedProposal,
          allowAutonomousLxxNamePreservation: input.roundPlan.round === 3
        }),
      inputHash: frenchEntityRemediationAuditorInputHash(unit, quartet)
    };
  });
  const content = roleInputContent(input, records);
  const unitInputHashes = new Map(
    records.map((record) => [record.unitId, record.inputHash])
  );
  const logicalHash = remediationRoleBatchInputHash(input, unitInputHashes);
  const text = `${canonicalFrenchEntityJson({ ...content, inputHash: logicalHash })}\n`;
  const selectedProposalRoles = new Map(
    records.map((record) => [record.unitId, record.selectedProposal.role])
  );
  const contracts: FrenchEntityAgentAuditOutputContract[] = records.map(
    (record) => ({
      unitId: record.unitId,
      inputHash: record.inputHash,
      auditedProposalHash: record.selectedProposal.proposalHash,
      selectedProposalRole: record.selectedProposal.role,
      evidenceConflictCodes:
        frenchEntityRemediationUnresolvedEvidenceConflictCodes({
          sourceView: record.sourceView,
          selectedProposal: record.selectedProposal,
          proofs: record.concordanceResolutionProofs
        })
    })
  );
  const effectiveEvidenceConflictCodes = new Map(
    contracts.map((contract) => [
      contract.unitId,
      contract.evidenceConflictCodes
    ])
  );
  const rejectedSemanticCycleUnitIds = records
    .filter((record) => {
      const unit = input.batch.units.find(
        (candidate) => candidate.unitId === record.unitId
      );
      if (!unit) {
        throw new Error(
          `french-entity-remediation-runner-unit-missing:${record.unitId}`
        );
      }
      const semanticHash = semanticFrenchEntityProposalHash(
        record.selectedProposal
      );
      if (
        record.concordanceResolutionProofs.some(
          (proof) =>
            proof.proofClass ===
            "exact-autonomous-lxx-name-preservation"
        )
      ) {
        return false;
      }
      return (
        semanticHash !== unit.previousSemanticProposalHash &&
        unit.proposerB.context.parentHashes.rejectedSemanticProposalHashes.includes(
          semanticHash
        )
      );
    })
    .map((record) => record.unitId);
  return {
    text,
    logicalHash,
    unitInputHashes,
    schema: frenchEntityRemediationAuditResponseSchema(contracts),
    prompt: remediationAuditorPrompt(
      text,
      contracts,
      input.batch.unitIds.length,
      rejectedSemanticCycleUnitIds,
      input.roundPlan.round === 3
    ),
    parse: (response) =>
      parseFrenchEntityAgentAuditResponse({
        text: adaptFrenchEntityRemediationKeyedResponse({
          text: response,
          unitIds: input.batch.unitIds,
          collection: "audits"
        }),
        unitIds: input.batch.unitIds,
        inputHashes: unitInputHashes,
        arbitrations: arbitration,
        selectedProposalRoles,
        sourceViews: new Map(
          records.map((record) => [record.unitId, record.sourceView])
        ),
        selectedProposals: new Map(
          records.map((record) => [record.unitId, record.selectedProposal])
        ),
        effectiveEvidenceConflictCodes
      })
  };
}

function buildProposerExecutionInput(
  input: Parameters<typeof buildFrenchEntityRemediationRoleExecutionInput>[0],
  role: FrenchEntityAgentProposerRole
): FrenchEntityRemediationRoleExecutionInput {
  const records = input.batch.units.map((unit) =>
    role === "proposerA" ? unit.proposerA : unit.proposerB
  );
  const content = roleInputContent(input, records);
  const unitInputHashes = new Map(
    records.map((record) => [record.context.unitId, record.inputHash])
  );
  const logicalHash = remediationRoleBatchInputHash(input, unitInputHashes);
  const text = `${canonicalFrenchEntityJson({ ...content, inputHash: logicalHash })}\n`;
  const contracts: FrenchEntityAgentProposalOutputContract[] = records.map(
    (record) => {
      const unboundNameEntryKeys = frenchEntityAgentUnboundNameEntryKeys(
        record.view
      );
      return {
        role,
        unitId: record.context.unitId,
        inputHash: record.inputHash,
        ownerEntityIds: [...record.view.ownerEntityIds],
        reviewEntryKeys: [...record.view.reviewUnit.reviewEntryKeys],
        ...(unboundNameEntryKeys.length > 0 ? { unboundNameEntryKeys } : {})
      };
    }
  );
  const artifactContent = {
    schemaVersion: FRENCH_ENTITY_AGENT_INPUT_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_AGENT_POLICY_VERSION,
    role,
    planHash: input.canonicalPlan.planHash,
    releaseKey: input.canonicalPlan.sourceLineage.releaseKey,
    releaseSnapshotFingerprint:
      input.canonicalPlan.sourceLineage.releaseSnapshotFingerprint,
    unitIds: input.batch.unitIds,
    views: records.map((record) => record.view)
  };
  const artifact: FrenchEntityAgentInputArtifact = {
    ...artifactContent,
    inputHash: hashFrenchEntityJson(artifactContent)
  };
  return {
    text,
    logicalHash,
    unitInputHashes,
    schema: frenchEntityRemediationProposalResponseSchema(role, contracts),
    prompt: remediationProposerPrompt(
      role,
      text,
      contracts,
      records.map((record) => record.view)
    ),
    parse: (response) =>
      parseFrenchEntityAgentProposalResponse({
        text: adaptFrenchEntityRemediationKeyedResponse({
          text: response,
          unitIds: input.batch.unitIds,
          collection: "proposals"
        }),
        role,
        artifact,
        plan: input.canonicalPlan,
        owners: input.manifest.owners,
        inputHashes: unitInputHashes
      })
  };
}

function roleInputContent(
  input: Parameters<typeof buildFrenchEntityRemediationRoleExecutionInput>[0],
  records: readonly unknown[]
): object {
  return {
    schemaVersion: FRENCH_ENTITY_REMEDIATION_ROLE_INPUT_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_REMEDIATION_RUNNER_POLICY_VERSION,
    entityPolicyVersion: FRENCH_ENTITY_AGENT_POLICY_VERSION,
    remediationPolicyVersion: FRENCH_ENTITY_REMEDIATION_POLICY_VERSION,
    round: input.roundPlan.round,
    roundPlanHash: input.roundPlan.planHash,
    role: input.role,
    batchId: input.batch.batchId,
    selectionHash: input.batch.selectionHash,
    unitIds: input.batch.unitIds,
    records
  };
}

function remediationRoleBatchInputHash(
  input: Parameters<typeof buildFrenchEntityRemediationRoleExecutionInput>[0],
  unitInputHashes: ReadonlyMap<string, string>
): string {
  return frenchEntityRemediationRoleBatchInputHash({
    round: input.roundPlan.round,
    roundPlanHash: input.roundPlan.planHash,
    batchId: input.batch.batchId,
    sourceBatchHash: input.batch.sourceBatchHash,
    selectionHash: input.batch.selectionHash,
    role: input.role,
    unitInputHashes: input.batch.unitIds.map((unitId) => ({
      unitId,
      inputHash: requiredMap(unitInputHashes, unitId)
    }))
  });
}

function remediationProposerPrompt(
  role: FrenchEntityAgentProposerRole,
  sealedInput: string,
  contracts: readonly FrenchEntityAgentProposalOutputContract[],
  views: readonly (
    | FrenchEntityAgentProposerAView
    | FrenchEntityAgentProposerBView
  )[]
): string {
  const lane =
    role === "proposerA"
      ? "Tu es la voie aveugle. Tu ne reçois que la vue anglaise de base, les codes des checks échoués et des hashes parents. Tu ne dois ni deviner ni reconstruire l'ancienne réponse française."
      : "Tu es la voie corrective informée. Tu reçois le quartet précédent complet; diagnostique précisément ses échecs sans traiter les témoins français historiques comme une autorité.";
  const hasUnboundNames = contracts.some(
    (contract) => (contract.unboundNameEntryKeys?.length ?? 0) > 0
  );
  const hasUnboundAlternateNames = views.some(
    (view) => frenchEntityAgentUnboundAlternateNameEntryKeys(view).length > 0
  );
  const structuralExceptions = [
    ...(hasUnboundNames
      ? [
          "- Exception scellée pour les seuls unboundNameEntryKeys du contrat : l'absence d'entité TIPNR ne transforme jamais automatiquement un nom en gloss commun. Pour un vrai nom de personne ou de lieu sans entité, utilise treatment=unregistered-proper-name, constraint=proper-name-without-entity, entityBindings=[], primaryFr=null, derivedFr=lemme français et englishForms=[englishGloss exact]. Pour un gentilé, titre ou nom composé sans entité, conserve respectivement treatment=gentilic, title-or-epithet ou compound-name avec entityBindings=[] et constraint=derived. Seul un sens réellement lexical peut utiliser etymological-or-common-gloss. Les entrées LXX G:N-PRI doivent rester une de ces formes nominales sans liaison et ne peuvent jamais devenir un gloss commun."
        ]
      : []),
    ...(hasUnboundAlternateNames
      ? [
          "- Exception scellée supplémentaire pour une entrée sans entité dont dStrong porte exactement 'a Spelling of' : conserve cette sémantique avec treatment=alternate-name, constraint=derived, entityBindings=[] et englishForms=[englishGloss exact]; ne la dégrade ni en gloss commun ni en nom propre autonome."
        ]
      : [])
  ].join("\n");
  return `Tu es ${role}, nouveau spécialiste indépendant pour un round additif de remédiation des noms bibliques.

PROTOCOLE SCELLÉ :
- Aucun outil, shell, réseau, fichier, plugin, application ou sous-agent.
- Utilise uniquement sealed_input_json ci-dessous.
- ${lane}
- Produis une proposition entièrement nouvelle pour chaque unité; ne recopie pas mécaniquement la proposition précédente.
- La réponse contient exactement un objet units. Chaque unitId du contrat est une propriété obligatoire et unique de units; aucune autre propriété n'est admise.
- Dans chaque valeur units[unitId], recopie exactement role, unitId et inputHash. Le hash global du lot est interdit comme inputHash.
- Chaque ownerEntityId reçoit exactement un primaryFr naturel, stable et éditorialement français, sous forme de lemme singulier.
- Chaque reviewEntryKey reçoit exactement une politique résolue; unresolved et blocked sont interdits.
- treatment porte la décision. canonical-name utilise primaryFr et derivedFr=null; les autres traitements utilisent derivedFr et primaryFr=null.
- allowedFrenchForms contient exactement une valeur : le seul lemme sélectionné, identique au primaryFr ou derivedFr non nul. Aucune flexion ni graphie témoin ne doit être ajoutée; elles seront dérivées localement après validation.
- Ne fusionne jamais des dStrong/sous-STEP. Préserve les relations primary, alias, gentilic, title, compound et etymological.
- Une forme de concordance contrôlée exactement identique peut soutenir la graphie française d'un nom dont l'identité et le rattachement sont déjà établis par la vue anglaise scellée. Ce n'est pas un gloss historique recopié. Elle ne prouve toutefois jamais ce rattachement et ne départage aucun sous-STEP ambigu.
- Un gloss commun ou étymologique reste treatment=etymological-or-common-gloss, constraint=lexical-translation et englishForms=[]; il ne devient jamais un nom propre.
- Chaque primaryFr/derivedFr doit être un lemme éditorial singulier. Un gentilé doit être attesté ou linguistiquement justifié, jamais créé par suffixation automatique; singularise explicitement une attestation plurielle, ou laisse l'audit bloquer si la forme reste incertaine.
${structuralExceptions ? `${structuralExceptions}\n` : ""}- Recopie exactement les identités, entryKey, entityId et hashes de preuve présents. Ne calcule aucun hash.
- Les raisons sont brèves. Réponds uniquement avec l'objet JSON imposé, sans Markdown.

<per_unit_output_contract>
${canonicalFrenchEntityJson(contracts)}
</per_unit_output_contract>

<sealed_input_json>
${sealedInput.trim()}
</sealed_input_json>`;
}

function remediationArbiterPrompt(
  sealedInput: string,
  contracts: readonly FrenchEntityAgentArbitrationOutputContract[],
  unitCount: number
): string {
  return `Tu es un nouvel arbitre indépendant du round additif pour ${unitCount} unités de noms bibliques.

PROTOCOLE SCELLÉ :
- Aucun outil, shell, réseau, fichier, plugin, application ou sous-agent.
- Pour chaque unité, choisis proposalA ou proposalB seulement.
- Interdiction absolue de fusionner, corriger, synthétiser ou réécrire les propositions.
- Examine les checks précédemment échoués, mais juge les deux nouvelles propositions sur toute la preuve contrôlée.
- Privilégie identité STEP exacte, lignée anglaise, français naturel, cohérence de groupe, lemme unique et relations explicites.
- Les témoins français sont non autoritaires. Ne fusionne aucun sous-STEP et ne dérive pas automatiquement un gentilé.
- Une surface de concordance contrôlée exactement identique est une preuve orthographique recevable si l'identité et le rattachement du nom sont déjà établis indépendamment par la vue anglaise scellée; elle ne peut jamais établir ce rattachement ni résoudre une ambiguïté de sous-STEP.
- La réponse contient exactement un objet units. Chaque unitId du contrat est une propriété obligatoire et unique de units; aucune autre propriété n'est admise.
- Dans chaque valeur units[unitId], recopie exactement unitId, inputHash et le selectedProposalHash associé au choix dans le contrat. Aucun hash global du lot n'est valide.
- Réponds uniquement avec l'objet JSON imposé, sans Markdown.

<per_unit_output_contract>
${canonicalFrenchEntityJson(contracts)}
</per_unit_output_contract>

<sealed_input_json>
${sealedInput.trim()}
</sealed_input_json>`;
}

function remediationAuditorPrompt(
  sealedInput: string,
  contracts: readonly FrenchEntityAgentAuditOutputContract[],
  unitCount: number,
  rejectedSemanticCycleUnitIds: readonly string[] = [],
  allowAutonomousLxxNamePreservation = false
): string {
  const rejectedSemanticCycleRule =
    rejectedSemanticCycleUnitIds.length > 0
      ? `- Cycle sémantique calculé : pour chacun de ces unitId, la proposition sélectionnée recycle exactement une décision sémantique déjà rejetée avant le quartet précédent : ${rejectedSemanticCycleUnitIds.join(", ")}. Un verdict safe est interdit. Garde au moins un check précédemment échoué à fail, choisis hold ou block, et explique explicitement le recyclage; une reformulation des raisons ne constitue pas une nouvelle décision.`
      : "";
  const concordanceProofRule = allowAutonomousLxxNamePreservation
    ? "- Les concordances sont des témoins du Strong classique, pas une preuve autonome du rattachement exact d'un sous-STEP ambigu. Les concordanceResolutionProofs scellées et recalculées par le code couvrent quatre cas bornés : surface contrôlée strictement identique comme preuve orthographique après rattachement anglais direct déjà sécurisé, composition exacte de composants, retrait exact du s pluriel pour un gentilé, ou conservation exacte du gloss STEP pour un nom propre LXX autonome à cinq chiffres sans entité ni concordance. Cette dernière preuve ne valide aucune réfection graphique : elle couvre uniquement la forme anglaise STEP exacte. Une preuve de graphie exacte n'est pas un « gloss historique seul » et n'exige aucun argument linguistique supplémentaire; elle ne peut cependant jamais prouver ou corriger l'attachement d'entité. Tout evidenceConflictCode restant dans le contrat impose canonicalPrimaryCoherence=fail et un verdict hold ou block; une modification cosmétique ne peut pas laver ce conflit."
    : "- Les concordances sont des témoins du Strong classique, pas une preuve autonome du rattachement exact d'un sous-STEP ambigu. Les concordanceResolutionProofs scellées et recalculées par le code couvrent seulement trois cas bornés : surface contrôlée strictement identique comme preuve orthographique après rattachement anglais direct déjà sécurisé, composition exacte de composants, ou retrait exact du s pluriel pour un gentilé. Une preuve de graphie exacte n'est pas un « gloss historique seul » et n'exige aucun argument linguistique supplémentaire; elle ne peut cependant jamais prouver ou corriger l'attachement d'entité. Tout evidenceConflictCode restant dans le contrat impose canonicalPrimaryCoherence=fail et un verdict hold ou block; une modification cosmétique ne peut pas laver ce conflit.";
  return `Tu es un nouvel auditeur adversarial indépendant du round additif pour ${unitCount} unités.

PROTOCOLE SCELLÉ :
- Aucun outil, shell, réseau, fichier, plugin, application ou sous-agent.
- Tu n'as pas le droit de proposer, corriger ou réécrire une solution.
- Audite strictement la proposition sélectionnée et les échecs du quartet précédent : identité STEP, parent anglais, cohérence du primaryFr, relations, lemme éditorial singulier, naturalité française et non-autorité des témoins historiques.
- exactStepIdentity, exactEnglishLineage et explicitMemberRelations sont prouvés mécaniquement et doivent être pass.
- singularEditorialLemma=pass exige que chaque primaryFr/derivedFr soit une forme de dictionnaire réellement singulière, y compris pour les gentilés. Une attestation uniquement plurielle sans singularisation linguistiquement sûre impose hold.
- allowedFrenchForms doit être exactement l'ensemble normatif dérivé localement du lemme singulier sélectionné. Toute graphie concurrente ou flexion non dérivée échoue.
${concordanceProofRule}
- safe exige les huit checks=pass et reasons=[]. Une proposition sémantiquement inchangée ne peut être close que lorsque le code rejoue une concordanceResolutionProof exacte couvrant le seul échec antérieur; toute autre clôture inchangée est refusée.
${rejectedSemanticCycleRule ? `${rejectedSemanticCycleRule}\n` : ""}- Toute incertitude donne hold; toute violation nette donne block.
- La réponse contient exactement un objet units. Chaque unitId du contrat est une propriété obligatoire et unique de units; aucune autre propriété n'est admise.
- Dans chaque valeur units[unitId], recopie exactement unitId, inputHash et auditedProposalHash depuis le contrat. Aucun hash global du lot n'est valide.
- Réponds uniquement avec l'objet JSON imposé, sans Markdown.

<per_unit_output_contract>
${canonicalFrenchEntityJson(contracts)}
</per_unit_output_contract>

<sealed_input_json>
${sealedInput.trim()}
</sealed_input_json>`;
}

export async function runFrenchEntityRemediationRoundCli(
  options: FrenchEntityRemediationRunCliOptions,
  dependencies: FrenchEntityRemediationRunnerDependencies = {}
): Promise<FrenchEntityRemediationExecutionSummary> {
  const context = loadExecutionContext(options, dependencies.expectations);
  const roundRoot = frenchEntityRemediationRoundRoot(
    options.resultsDir,
    context.roundPlan
  );
  mkdirSync(roundRoot, { recursive: true });
  ensureImmutableText(
    join(roundRoot, "round-plan.json"),
    context.roundPlanText,
    "round-plan"
  );
  ensureImmutableText(
    join(roundRoot, "execution-manifest.json"),
    context.executionManifestText,
    "execution-manifest"
  );
  const releaseLock = acquireExclusiveRoleLock(join(roundRoot, "run.lock"));
  const childSupervisor = new FrenchEntityRemediationChildSupervisor();
  const removeSignalHandlers =
    installFrenchEntityRemediationSignalCleanup(childSupervisor);
  let executed = 0;
  let reused = 0;
  try {
    quarantineInterruptedTemporaries(roundRoot);
    const historicalThreadIds = new Set([
      ...context.base.runs.map((run) => run.threadId),
      ...context.historicalRuns.map((run) => run.threadId)
    ]);
    const currentThreadIds = scanCurrentRoundThreadIds(
      roundRoot,
      context.roundPlan
    );
    for (const threadId of currentThreadIds) {
      if (historicalThreadIds.has(threadId)) {
        throw new Error(
          `french-entity-remediation-inter-round-thread-reuse:${threadId}`
        );
      }
    }
    const forbiddenThreads = new Set([
      ...historicalThreadIds,
      ...currentThreadIds
    ]);
    const state = emptyRoleState();

    const processRole = async (
      role: FrenchEntityAgentRole,
      mode: "skip" | "require" | "execute"
    ): Promise<void> => {
      if (mode === "skip") return;
      childSupervisor.assertRunning();
      await mapConcurrent(
        context.batches,
        options.concurrency,
        async (batch) => {
          childSupervisor.assertRunning();
          const executionInput = buildFrenchEntityRemediationRoleExecutionInput(
            {
              manifest: context.manifest,
              canonicalPlan: context.canonicalPlan,
              roundPlan: context.roundPlan,
              batch,
              role,
              artifacts: state
            }
          );
          const finalDirectory = remediationRoleDirectory(
            roundRoot,
            role,
            batch.batchId
          );
          let result: ValidatedRoleResult;
          if (existsSync(finalDirectory)) {
            result = validateExistingRemediationRoleResult({
              context,
              batch,
              role,
              executionInput,
              directory: finalDirectory
            });
            reused += 1;
          } else {
            if (mode === "require" || options.existingOnly) {
              throw new Error(
                `french-entity-remediation-dependency-missing:${role}:${batch.batchId}`
              );
            }
            result = await executeRemediationRole({
              context,
              batch,
              role,
              executionInput,
              roundRoot,
              forbiddenThreads,
              dependencies,
              childSupervisor
            });
            executed += 1;
          }
          childSupervisor.assertRunning();
          addValidatedRoleResult(state, role, result);
        }
      );
      childSupervisor.assertRunning();
    };

    const wantsA = ["proposerA", "proposers", "all"].includes(options.stage);
    const wantsB = ["proposerB", "proposers", "all"].includes(options.stage);
    const wantsArbiter = ["arbiter", "all"].includes(options.stage);
    const wantsAuditor = ["auditor", "all"].includes(options.stage);
    const needsProposers = wantsArbiter || wantsAuditor;
    await processRole(
      "proposerA",
      wantsA ? "execute" : needsProposers ? "require" : "skip"
    );
    await processRole(
      "proposerB",
      wantsB ? "execute" : needsProposers ? "require" : "skip"
    );
    await processRole(
      "arbiter",
      wantsArbiter ? "execute" : wantsAuditor ? "require" : "skip"
    );
    await processRole("auditor", wantsAuditor ? "execute" : "skip");

    let roundResultPath: string | null = null;
    let remediationIndexPath: string | null = null;
    let residualUnitIds: string[] | null = null;
    let replay: FrenchEntityRemediationReplay | null = null;
    if (isCompleteRoundDirectory(roundRoot, context.batches)) {
      replay = finalizeAndReplayRound(context, roundRoot, true);
      roundResultPath = join(roundRoot, "round-result.json");
      remediationIndexPath = publishRemediationIndex(context, replay);
      residualUnitIds = replay.result.residualUnitIds;
    }
    const runs = replay?.runs ?? state.runs;
    assertFreshThreads(
      runs,
      new Set([
        ...context.base.runs.map((run) => run.threadId),
        ...context.historicalRuns.map((run) => run.threadId)
      ])
    );
    const summary: FrenchEntityRemediationExecutionSummary = {
      releaseKey: options.releaseKey,
      round: context.roundPlan.round,
      roundPlanHash: context.roundPlan.planHash,
      stage: options.stage,
      units: context.roundPlan.unitIds.length,
      batches: context.batches.length,
      runs: runs.length,
      reused,
      executed,
      distinctThreads: new Set(runs.map((run) => run.threadId)).size,
      roundResultPath,
      remediationIndexPath,
      residualUnitIds
    };
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    return summary;
  } finally {
    try {
      await childSupervisor.terminateAndWait();
    } finally {
      removeSignalHandlers();
      releaseLock();
    }
  }
}

/**
 * Read-only entry point for attestation/merge. It replays the base lineage,
 * every role source/result hash, every per-unit receipt and the final core
 * round result. It never starts Codex and never repairs a file.
 */
export function replayFrenchEntityRemediationRoundExecution(input: {
  manifest: string;
  roundPlan: string;
  resultsDir: string;
  releaseKey: string;
  expectations?: FrenchEntityCanonicalizationExpectations;
}): FrenchEntityRemediationReplay {
  const options: FrenchEntityRemediationRunCliOptions = {
    manifest: resolve(input.manifest),
    roundPlan: resolve(input.roundPlan),
    resultsDir: resolve(input.resultsDir),
    releaseKey: input.releaseKey,
    stage: "all",
    concurrency: 1,
    codexBinary: FRENCH_CODEX_IMMUTABLE_BINARY_PATH,
    codexHome: resolve(DEFAULT_CODEX_HOME),
    timeoutMs: DEFAULT_TIMEOUT_MS,
    maxAttempts: FRENCH_ENTITY_AGENT_DEFAULT_MAX_ATTEMPTS,
    existingOnly: true
  };
  const context = loadExecutionContext(options, input.expectations);
  const roundRoot = frenchEntityRemediationRoundRoot(
    options.resultsDir,
    context.roundPlan
  );
  assertExactText(
    join(roundRoot, "round-plan.json"),
    context.roundPlanText,
    "round-plan"
  );
  assertExactText(
    join(roundRoot, "execution-manifest.json"),
    context.executionManifestText,
    "execution-manifest"
  );
  return finalizeAndReplayRound(context, roundRoot, false);
}

/**
 * Builds the next additive plan from stored, fully replayed evidence. This is
 * deliberately model-free: it validates the immutable base quartet, every
 * run/receipt/input hash, and every prior physical round before deriving the
 * residual set.
 */
export function buildNextFrenchEntityRemediationRoundPlanFromStoredState(
  input: BuildNextFrenchEntityRemediationRoundPlanInput
): BuiltNextFrenchEntityRemediationRoundPlan {
  const options: FrenchEntityRemediationRunCliOptions = {
    manifest: resolve(input.manifest),
    roundPlan: input.previousRoundPlan
      ? resolve(input.previousRoundPlan)
      : resolve(input.resultsDir, "remediation", "no-previous-round.json"),
    resultsDir: resolve(input.resultsDir),
    releaseKey: input.releaseKey,
    stage: "all",
    concurrency: 1,
    codexBinary: FRENCH_CODEX_IMMUTABLE_BINARY_PATH,
    codexHome: resolve(DEFAULT_CODEX_HOME),
    timeoutMs: DEFAULT_TIMEOUT_MS,
    maxAttempts: FRENCH_ENTITY_AGENT_DEFAULT_MAX_ATTEMPTS,
    existingOnly: true
  };
  const manifestText = readFileSync(options.manifest, "utf8");
  const manifest = JSON.parse(manifestText) as FrenchEntityAgentBatchManifest;
  const canonicalPlanPath = resolveReference(
    dirname(options.manifest),
    manifest.plan.path
  );
  const canonicalPlanText = readFileSync(canonicalPlanPath, "utf8");
  const canonicalPlan = JSON.parse(
    canonicalPlanText
  ) as FrenchEntityCanonicalizationPlan;
  assertFrenchEntityAgentBatchManifest(
    manifest,
    canonicalPlan,
    input.expectations ?? FRENCH_ENTITY_CANONICALIZATION_DEFAULT_EXPECTATIONS
  );
  if (
    sha256(canonicalPlanText) !== manifest.plan.fileDigest ||
    canonicalPlan.planHash !== manifest.plan.planHash ||
    canonicalPlan.sourceLineage.releaseKey !== options.releaseKey ||
    manifest.plan.releaseKey !== options.releaseKey
  ) {
    throw new Error("french-entity-remediation-plan-base-lineage-mismatch");
  }
  const base = loadBaseState({
    options,
    manifest,
    manifestText,
    canonicalPlan,
    canonicalPlanText
  });
  let targetRound = 1;
  let parentRoundHash: string | null = null;
  let explicitPreviousPlan: FrenchEntityRemediationRoundPlan | null = null;
  let explicitPreviousResult: FrenchEntityRemediationRoundResult | null = null;
  if (input.previousRoundPlan) {
    const previousPath = resolve(input.previousRoundPlan);
    explicitPreviousPlan =
      readJson<FrenchEntityRemediationRoundPlan>(previousPath);
    assertRoundPlanEnvelope(explicitPreviousPlan);
    const expectedPath = join(
      frenchEntityRemediationRoundRoot(
        options.resultsDir,
        explicitPreviousPlan
      ),
      "round-plan.json"
    );
    if (previousPath !== expectedPath) {
      throw new Error(
        "french-entity-remediation-plan-previous-content-address-mismatch"
      );
    }
    if (explicitPreviousPlan.round >= FRENCH_ENTITY_REMEDIATION_MAX_ROUNDS) {
      throw new Error(
        `french-entity-remediation-plan-round-exceeds-max:${explicitPreviousPlan.round + 1}`
      );
    }
    explicitPreviousResult = readJson<FrenchEntityRemediationRoundResult>(
      join(dirname(previousPath), "round-result.json")
    );
    if (
      explicitPreviousResult.planHash !== explicitPreviousPlan.planHash ||
      !isSha256(explicitPreviousResult.roundHash)
    ) {
      throw new Error("french-entity-remediation-plan-previous-result-invalid");
    }
    targetRound = explicitPreviousPlan.round + 1;
    parentRoundHash = explicitPreviousResult.roundHash;
  }
  const historyLoad = loadAndReplayHistory({
    options,
    manifest,
    canonicalPlan,
    base,
    targetPlan: { round: targetRound, parentRoundHash }
  });
  assertExactStoredHistory(options.resultsDir, historyLoad.history);
  if (explicitPreviousPlan && explicitPreviousResult) {
    const terminal = historyLoad.history.at(-1);
    if (
      !terminal ||
      canonicalFrenchEntityJson(terminal.plan) !==
        canonicalFrenchEntityJson(explicitPreviousPlan) ||
      canonicalFrenchEntityJson(terminal.result) !==
        canonicalFrenchEntityJson(explicitPreviousResult)
    ) {
      throw new Error("french-entity-remediation-plan-previous-round-mismatch");
    }
  }
  const previousRound = historyLoad.history.at(-1);
  const plan = buildFrenchEntityRemediationRoundPlan({
    round: targetRound,
    baseViews: base.views,
    currentArtifacts: historyLoad.currentArtifacts,
    ...(previousRound ? { previousRound } : {})
  });
  buildFrenchEntityRemediationExecutionBatches(manifest, plan);
  return {
    plan,
    manifestHash: manifest.manifestHash,
    canonicalPlanHash: canonicalPlan.planHash,
    baseRunCount: base.runs.length,
    historicalRoundCount: historyLoad.history.length,
    historicalRunCount: historyLoad.runs.length
  };
}

function loadExecutionContext(
  options: FrenchEntityRemediationRunCliOptions,
  expectations: FrenchEntityCanonicalizationExpectations = FRENCH_ENTITY_CANONICALIZATION_DEFAULT_EXPECTATIONS
): LoadedExecutionContext {
  const manifestText = readFileSync(options.manifest, "utf8");
  const manifest = JSON.parse(manifestText) as FrenchEntityAgentBatchManifest;
  const canonicalPlanPath = resolveReference(
    dirname(options.manifest),
    manifest.plan.path
  );
  const canonicalPlanText = readFileSync(canonicalPlanPath, "utf8");
  const canonicalPlan = JSON.parse(
    canonicalPlanText
  ) as FrenchEntityCanonicalizationPlan;
  assertFrenchEntityAgentBatchManifest(manifest, canonicalPlan, expectations);
  if (
    sha256(canonicalPlanText) !== manifest.plan.fileDigest ||
    canonicalPlan.planHash !== manifest.plan.planHash ||
    canonicalPlan.sourceLineage.releaseKey !== options.releaseKey ||
    manifest.plan.releaseKey !== options.releaseKey
  ) {
    throw new Error("french-entity-remediation-base-lineage-mismatch");
  }
  const rawRoundPlan = JSON.parse(
    readFileSync(options.roundPlan, "utf8")
  ) as FrenchEntityRemediationRoundPlan;
  assertRoundPlanEnvelope(rawRoundPlan);
  const base = loadBaseState({
    options,
    manifest,
    manifestText,
    canonicalPlan,
    canonicalPlanText
  });
  const historyLoad = loadAndReplayHistory({
    options,
    manifest,
    canonicalPlan,
    base,
    targetPlan: rawRoundPlan
  });
  const expectedPlan = buildFrenchEntityRemediationRoundPlan({
    round: rawRoundPlan.round,
    baseViews: base.views,
    currentArtifacts: historyLoad.currentArtifacts,
    ...(historyLoad.history.length > 0
      ? {
          previousRound: historyLoad.history.at(
            -1
          ) as FrenchEntityRemediationRoundBundle
        }
      : {})
  });
  if (
    canonicalFrenchEntityJson(expectedPlan) !==
    canonicalFrenchEntityJson(rawRoundPlan)
  ) {
    throw new Error(
      `french-entity-remediation-round-plan-replay:${rawRoundPlan.round}`
    );
  }
  const batches = buildFrenchEntityRemediationExecutionBatches(
    manifest,
    rawRoundPlan
  );
  const executionManifest = finalizeFrenchEntityRemediationExecutionManifest({
    releaseKey: options.releaseKey,
    releaseSnapshotFingerprint:
      canonicalPlan.sourceLineage.releaseSnapshotFingerprint,
    canonicalPlanHash: canonicalPlan.planHash,
    baseManifestHash: manifest.manifestHash,
    round: rawRoundPlan.round,
    roundPlanHash: rawRoundPlan.planHash,
    parentRoundHash: rawRoundPlan.parentRoundHash,
    namespace: `${manifest.namespace}/remediation/round-${String(rawRoundPlan.round).padStart(2, "0")}`,
    batches: batches.map(({ units: _units, ...batch }) => {
      void _units;
      return batch;
    })
  });
  return {
    options,
    manifest,
    manifestText,
    canonicalPlan,
    canonicalPlanText,
    canonicalPlanPath,
    roundPlan: rawRoundPlan,
    roundPlanText: `${canonicalFrenchEntityJson(rawRoundPlan)}\n`,
    executionManifest,
    executionManifestText: `${canonicalFrenchEntityJson(executionManifest)}\n`,
    batches,
    base,
    history: historyLoad.history,
    historicalRuns: historyLoad.runs
  };
}

function loadBaseState(input: {
  options: FrenchEntityRemediationRunCliOptions;
  manifest: FrenchEntityAgentBatchManifest;
  manifestText: string;
  canonicalPlan: FrenchEntityCanonicalizationPlan;
  canonicalPlanText: string;
}): LoadedBaseState {
  const replayOptions: FrenchEntityAgentRunCliOptions = {
    manifest: input.options.manifest,
    resultsDir: input.options.resultsDir,
    releaseKey: input.options.releaseKey,
    stage: "all",
    concurrency: 1,
    batchIds: [],
    offsetBatches: 0,
    limitBatches: null,
    codexBinary: input.options.codexBinary,
    codexHome: input.options.codexHome,
    timeoutMs: input.options.timeoutMs,
    maxAttempts: input.options.maxAttempts,
    existingOnly: true
  };
  const viewPairs = new Map<
    string,
    Partial<FrenchEntityRemediationBaseViews>
  >();
  const roleArtifacts: Record<
    FrenchEntityAgentRole,
    Map<
      string,
      | FrenchEntityAgentProposal
      | FrenchEntityAgentArbitration
      | FrenchEntityAgentAudit
    >
  > = {
    proposerA: new Map(),
    proposerB: new Map(),
    arbiter: new Map(),
    auditor: new Map()
  };
  const roleReceipts: Record<
    FrenchEntityAgentRole,
    Map<string, FrenchCodexExecutionReceipt<FrenchEntityAgentRole>>
  > = {
    proposerA: new Map(),
    proposerB: new Map(),
    arbiter: new Map(),
    auditor: new Map()
  };
  const runs: FrenchEntityAgentRun[] = [];
  for (const batch of input.manifest.batches) {
    for (const role of ["proposerA", "proposerB"] as const) {
      const proof = role === "proposerA" ? batch.proposerA : batch.proposerB;
      const path = resolveReference(
        dirname(input.options.manifest),
        proof.relativePath
      );
      const text = readFileSync(path, "utf8");
      if (sha256(text) !== proof.sha256) {
        throw new Error(
          `french-entity-remediation-base-view-source-drift:${role}:${batch.batchId}`
        );
      }
      const artifact = JSON.parse(text) as FrenchEntityAgentInputArtifact;
      assertFrenchEntityAgentInputArtifact(
        artifact,
        role,
        batch,
        input.canonicalPlan
      );
      for (const view of artifact.views) {
        const pair = viewPairs.get(view.unitId) ?? {};
        if (role === "proposerA") {
          pair.proposerA = view as FrenchEntityAgentProposerAView;
        } else {
          pair.proposerB = view as FrenchEntityAgentProposerBView;
        }
        viewPairs.set(view.unitId, pair);
      }
    }
    for (const role of [
      "proposerA",
      "proposerB",
      "arbiter",
      "auditor"
    ] as const) {
      const directory = resolve(input.options.resultsDir, role, batch.batchId);
      const run = replayFrenchEntityAgentStoredRole({
        options: replayOptions,
        manifest: input.manifest,
        manifestText: input.manifestText,
        plan: input.canonicalPlan,
        planText: input.canonicalPlanText,
        batch,
        role
      });
      assertFrenchEntityAgentResultDirectory({
        directory,
        run,
        expectedUnitIds: batch.unitIds,
        role
      });
      runs.push(run);
      for (const artifact of readJsonl<
        | FrenchEntityAgentProposal
        | FrenchEntityAgentArbitration
        | FrenchEntityAgentAudit
      >(join(directory, "artifacts.jsonl"))) {
        if (roleArtifacts[role].has(artifact.unitId)) {
          throw new Error(
            `french-entity-remediation-base-artifact-duplicate:${role}:${artifact.unitId}`
          );
        }
        roleArtifacts[role].set(artifact.unitId, artifact);
      }
      for (const receipt of readJsonl<
        FrenchCodexExecutionReceipt<FrenchEntityAgentRole>
      >(join(directory, "execution-receipts.jsonl"))) {
        if (roleReceipts[role].has(receipt.entryKey)) {
          throw new Error(
            `french-entity-remediation-base-receipt-duplicate:${role}:${receipt.entryKey}`
          );
        }
        roleReceipts[role].set(receipt.entryKey, receipt);
      }
    }
  }
  assertUniqueThreadIds(
    runs.map((run) => run.threadId),
    "base"
  );
  const views = new Map<string, FrenchEntityRemediationBaseViews>();
  const artifacts = new Map<string, FrenchEntityAgentUnitArtifacts>();
  for (const unit of input.canonicalPlan.reviewUnits) {
    const pair = viewPairs.get(unit.unitId);
    if (!pair?.proposerA || !pair.proposerB) {
      throw new Error(
        `french-entity-remediation-base-view-missing:${unit.unitId}`
      );
    }
    views.set(unit.unitId, {
      proposerA: pair.proposerA,
      proposerB: pair.proposerB
    });
    const quartet = {
      proposalA: requiredMap(
        roleArtifacts.proposerA,
        unit.unitId
      ) as FrenchEntityAgentProposal,
      proposalB: requiredMap(
        roleArtifacts.proposerB,
        unit.unitId
      ) as FrenchEntityAgentProposal,
      arbitration: requiredMap(
        roleArtifacts.arbiter,
        unit.unitId
      ) as FrenchEntityAgentArbitration,
      audit: requiredMap(
        roleArtifacts.auditor,
        unit.unitId
      ) as FrenchEntityAgentAudit
    };
    if (
      quartet.arbitration.selectedProposal !== "proposalA" &&
      quartet.arbitration.selectedProposal !== "proposalB"
    ) {
      throw new Error(
        `french-entity-remediation-base-selection-invalid:${unit.unitId}`
      );
    }
    const selectedProposal =
      quartet.arbitration.selectedProposal === "proposalA"
        ? quartet.proposalA
        : quartet.proposalB;
    const expectedInputHashes: FrenchEntityAgentUnitInputHashes = {
      proposerA: pair.proposerA.viewHash,
      proposerB: pair.proposerB.viewHash,
      arbiter: frenchEntityAgentArbiterUnitInputHash({
        unitId: unit.unitId,
        sourceView: pair.proposerB,
        proposalA: quartet.proposalA,
        proposalB: quartet.proposalB
      }),
      auditor: frenchEntityAgentAuditorUnitInputHash({
        unitId: unit.unitId,
        sourceView: pair.proposerB,
        arbitration: quartet.arbitration,
        selectedProposal
      })
    };
    assertFrenchEntityAgentUnitArtifacts({
      plan: input.canonicalPlan,
      manifest: input.manifest,
      unitId: unit.unitId,
      artifacts: quartet,
      expectedInputHashes
    });
    for (const role of [
      "proposerA",
      "proposerB",
      "arbiter",
      "auditor"
    ] as const) {
      const receipt = requiredMap(roleReceipts[role], unit.unitId);
      if (receipt.inputHash !== expectedInputHashes[role]) {
        throw new Error(
          `french-entity-remediation-base-receipt-input-hash:${role}:${unit.unitId}`
        );
      }
    }
    frenchEntityAgentQuartetHash(quartet);
    artifacts.set(unit.unitId, quartet);
  }
  return { views, artifacts, runs };
}

function loadAndReplayHistory(input: {
  options: FrenchEntityRemediationRunCliOptions;
  manifest: FrenchEntityAgentBatchManifest;
  canonicalPlan: FrenchEntityCanonicalizationPlan;
  base: LoadedBaseState;
  targetPlan: Pick<
    FrenchEntityRemediationRoundPlan,
    "round" | "parentRoundHash"
  >;
}): {
  history: FrenchEntityRemediationRoundBundle[];
  currentArtifacts: Map<string, FrenchEntityAgentUnitArtifacts>;
  runs: FrenchEntityRemediationAgentRun[];
} {
  const located: Array<{
    root: string;
    bundle: FrenchEntityRemediationRoundBundle;
  }> = [];
  let parentHash = input.targetPlan.parentRoundHash;
  for (let round = input.targetPlan.round - 1; round >= 1; round -= 1) {
    if (!parentHash) {
      throw new Error(
        `french-entity-remediation-history-parent-missing:${round}`
      );
    }
    const found = findStoredRoundByHash(
      input.options.resultsDir,
      round,
      parentHash
    );
    located.push(found);
    parentHash = found.bundle.plan.parentRoundHash;
  }
  if (parentHash !== null) {
    throw new Error("french-entity-remediation-history-round-one-parent");
  }
  located.reverse();
  const currentArtifacts = new Map(input.base.artifacts);
  const history: FrenchEntityRemediationRoundBundle[] = [];
  const runs: FrenchEntityRemediationAgentRun[] = [];
  let previousRound: FrenchEntityRemediationRoundBundle | undefined;
  for (let index = 0; index < located.length; index += 1) {
    const item = located[index];
    if (!item) throw new Error("french-entity-remediation-history-gap");
    const round = index + 1;
    const expectedPlan = buildFrenchEntityRemediationRoundPlan({
      round,
      baseViews: input.base.views,
      currentArtifacts,
      ...(previousRound ? { previousRound } : {})
    });
    if (
      canonicalFrenchEntityJson(expectedPlan) !==
      canonicalFrenchEntityJson(item.bundle.plan)
    ) {
      throw new Error(`french-entity-remediation-history-plan-replay:${round}`);
    }
    const expectedResult = finalizeFrenchEntityRemediationRound({
      plan: item.bundle.plan,
      artifacts: new Map(
        item.bundle.result.unitResults.map((result) => [
          result.unitId,
          result.quartet
        ])
      )
    });
    if (
      canonicalFrenchEntityJson(expectedResult) !==
      canonicalFrenchEntityJson(item.bundle.result)
    ) {
      throw new Error(
        `french-entity-remediation-history-result-replay:${round}`
      );
    }
    const historyExecution = validateCompleteRoundExecution({
      options: input.options,
      manifest: input.manifest,
      canonicalPlan: input.canonicalPlan,
      roundPlan: item.bundle.plan,
      roundRoot: item.root
    });
    if (
      canonicalFrenchEntityJson(
        [...historyExecution.artifacts].map(([unitId, quartet]) => ({
          unitId,
          quartetHash: frenchEntityAgentQuartetHash(quartet)
        }))
      ) !==
      canonicalFrenchEntityJson(
        item.bundle.result.unitResults.map((result) => ({
          unitId: result.unitId,
          quartetHash: frenchEntityAgentQuartetHash(result.quartet)
        }))
      )
    ) {
      throw new Error(
        `french-entity-remediation-history-execution-result:${round}`
      );
    }
    runs.push(...historyExecution.runs);
    for (const unitResult of item.bundle.result.unitResults) {
      currentArtifacts.set(unitResult.unitId, unitResult.quartet);
    }
    history.push(item.bundle);
    previousRound = item.bundle;
  }
  assertFreshThreads(runs, new Set(input.base.runs.map((run) => run.threadId)));
  return { history, currentArtifacts, runs };
}

function assertExactStoredHistory(
  resultsDir: string,
  history: readonly FrenchEntityRemediationRoundBundle[]
): void {
  const remediationRoot = resolve(resultsDir, "remediation");
  if (!existsSync(remediationRoot)) {
    if (history.length === 0) return;
    throw new Error("french-entity-remediation-plan-history-root-missing");
  }
  const expectedRoots = new Set(
    history.map((bundle) =>
      frenchEntityRemediationRoundRoot(resultsDir, bundle.plan)
    )
  );
  for (const entry of readdirSync(remediationRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^round-\d{2}-/u.test(entry.name)) continue;
    const root = resolve(remediationRoot, entry.name);
    if (
      (existsSync(join(root, "round-plan.json")) ||
        existsSync(join(root, "round-result.json"))) &&
      !expectedRoots.has(root)
    ) {
      throw new Error(
        `french-entity-remediation-plan-history-collision:${root}`
      );
    }
  }
}

function findStoredRoundByHash(
  resultsDir: string,
  round: number,
  roundHash: string
): { root: string; bundle: FrenchEntityRemediationRoundBundle } {
  const remediationRoot = resolve(resultsDir, "remediation");
  if (!existsSync(remediationRoot)) {
    throw new Error(`french-entity-remediation-history-root-missing:${round}`);
  }
  const matches: Array<{
    root: string;
    bundle: FrenchEntityRemediationRoundBundle;
  }> = [];
  for (const entry of readdirSync(remediationRoot, { withFileTypes: true })) {
    if (
      !entry.isDirectory() ||
      !entry.name.startsWith(`round-${String(round).padStart(2, "0")}-`)
    ) {
      continue;
    }
    const root = join(remediationRoot, entry.name);
    const planPath = join(root, "round-plan.json");
    const resultPath = join(root, "round-result.json");
    if (!existsSync(planPath) || !existsSync(resultPath)) continue;
    const plan = readJson<FrenchEntityRemediationRoundPlan>(planPath);
    const result = readJson<FrenchEntityRemediationRoundResult>(resultPath);
    if (result.roundHash !== roundHash) continue;
    assertRoundPlanEnvelope(plan);
    const expectedRoot = frenchEntityRemediationRoundRoot(resultsDir, plan);
    if (resolve(root) !== expectedRoot || result.planHash !== plan.planHash) {
      throw new Error(
        `french-entity-remediation-history-content-address:${round}`
      );
    }
    matches.push({ root, bundle: { plan, result } });
  }
  if (matches.length !== 1) {
    throw new Error(
      `french-entity-remediation-history-match:${round}:${matches.length}`
    );
  }
  return matches[0] as (typeof matches)[number];
}

function assertRoundPlanEnvelope(plan: FrenchEntityRemediationRoundPlan): void {
  const { planHash, ...content } = plan;
  if (
    plan.schemaVersion !==
      FRENCH_ENTITY_REMEDIATION_ROUND_PLAN_SCHEMA_VERSION ||
    plan.policyVersion !== FRENCH_ENTITY_REMEDIATION_POLICY_VERSION ||
    !Number.isInteger(plan.round) ||
    plan.round < 1 ||
    plan.round > FRENCH_ENTITY_REMEDIATION_MAX_ROUNDS ||
    (plan.round === 1
      ? plan.parentRoundHash !== null
      : !isSha256(plan.parentRoundHash)) ||
    plan.unitIds.length === 0 ||
    plan.units.length !== plan.unitIds.length ||
    new Set(plan.unitIds).size !== plan.unitIds.length ||
    canonicalFrenchEntityJson(plan.unitIds) !==
      canonicalFrenchEntityJson([...plan.unitIds].sort(compareText)) ||
    plan.units.some(
      (unit, index) =>
        unit.unitId !== plan.unitIds[index] ||
        !isSha256(unit.unitHash) ||
        hashFrenchEntityJson(stripHash(unit, "unitHash")) !== unit.unitHash
    ) ||
    hashFrenchEntityJson(content) !== planHash
  ) {
    throw new Error("french-entity-remediation-round-plan-envelope-invalid");
  }
}

interface ValidatedRoleResult {
  run: FrenchEntityRemediationAgentRun;
  artifacts: Array<
    | FrenchEntityAgentProposal
    | FrenchEntityAgentArbitration
    | FrenchEntityAgentAudit
  >;
  receipts: FrenchCodexExecutionReceipt<FrenchEntityAgentRole>[];
}

async function executeRemediationRole(input: {
  context: LoadedExecutionContext;
  batch: FrenchEntityRemediationExecutionBatch;
  role: FrenchEntityAgentRole;
  executionInput: FrenchEntityRemediationRoleExecutionInput;
  roundRoot: string;
  forbiddenThreads: Set<string>;
  dependencies: FrenchEntityRemediationRunnerDependencies;
  childSupervisor: FrenchEntityRemediationChildSupervisor;
}): Promise<ValidatedRoleResult> {
  const finalDirectory = remediationRoleDirectory(
    input.roundRoot,
    input.role,
    input.batch.batchId
  );
  mkdirSync(dirname(finalDirectory), { recursive: true });
  const seenAttemptThreads = new Set<string>();
  return runFrenchEntityAgentAttempts({
    maxAttempts: input.context.options.maxAttempts,
    label: `remediation:${input.context.roundPlan.round}:${input.role}:${input.batch.batchId}`,
    execute: (attempt) =>
      executeRemediationRoleAttempt({
        ...input,
        finalDirectory,
        seenAttemptThreads,
        attempt
      })
  });
}

async function executeRemediationRoleAttempt(input: {
  context: LoadedExecutionContext;
  batch: FrenchEntityRemediationExecutionBatch;
  role: FrenchEntityAgentRole;
  executionInput: FrenchEntityRemediationRoleExecutionInput;
  roundRoot: string;
  forbiddenThreads: Set<string>;
  dependencies: FrenchEntityRemediationRunnerDependencies;
  childSupervisor: FrenchEntityRemediationChildSupervisor;
  finalDirectory: string;
  seenAttemptThreads: Set<string>;
  attempt: number;
}): Promise<ValidatedRoleResult> {
  const temporaryDirectory = `${input.finalDirectory}.tmp-${process.pid}-${Date.now()}-${randomBytes(6).toString("hex")}`;
  mkdirSync(temporaryDirectory, { recursive: false });
  const paths = remediationAttemptPaths(temporaryDirectory);
  let processExecution: FrenchEntityRemediationProcessExecution | null = null;
  try {
    writeFileSync(
      paths.sealedInput,
      `${input.executionInput.text.trim()}\n`,
      "utf8"
    );
    writeFileSync(paths.prompt, input.executionInput.prompt, "utf8");
    writeFileSync(
      paths.outputSchema,
      `${canonicalFrenchEntityJson(input.executionInput.schema)}\n`,
      "utf8"
    );
    const profile = FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE[input.role];
    const processInput = {
      options: input.context.options,
      role: input.role,
      profile,
      prompt: input.executionInput.prompt,
      schemaPath: paths.outputSchema,
      responsePath: paths.structuredResponse,
      workingDirectory: temporaryDirectory
    };
    processExecution = input.dependencies.executeAgent
      ? await input.dependencies.executeAgent(processInput)
      : await executeFrenchEntityRemediationCodex(
          processInput,
          input.childSupervisor
        );
    input.childSupervisor.assertRunning();
    writeFileSync(
      paths.structuredResponse,
      processExecution.responseText,
      "utf8"
    );
    writeFileSync(paths.events, processExecution.stdout, "utf8");
    writeFileSync(paths.stderr, processExecution.stderr, "utf8");
    if (
      input.seenAttemptThreads.has(processExecution.threadId) ||
      input.forbiddenThreads.has(processExecution.threadId)
    ) {
      throw new Error(
        `french-entity-remediation-thread-reuse:${input.role}:${input.batch.batchId}:${processExecution.threadId}`
      );
    }
    input.seenAttemptThreads.add(processExecution.threadId);
    input.forbiddenThreads.add(processExecution.threadId);
    const artifacts = input.executionInput.parse(processExecution.responseText);
    writeFileSync(
      paths.artifacts,
      `${artifacts
        .map((artifact) => canonicalFrenchEntityJson(artifact))
        .join("\n")}\n`,
      "utf8"
    );
    const executor =
      input.dependencies.executorMetadata ??
      ensureFrenchCodexImmutableBinary({
        requestedPath: input.context.options.codexBinary
      });
    const capabilities = {
      localTools: "disabled" as const,
      networkDataTools: "disabled" as const,
      shell: "disabled" as const,
      eventPolicy: "agent-message-only" as const,
      sealedWorkingDirectory: input.finalDirectory,
      disabledFeaturesHash: frenchCodexDisabledFeaturesHash(),
      environmentPolicyHash: frenchCodexEnvironmentPolicyHash()
    };
    const sourceHashes = {
      manifest: sha256(input.context.executionManifestText),
      plan: sha256(input.context.canonicalPlanText),
      roundPlan: sha256(input.context.roundPlanText),
      baseManifest: sha256(input.context.manifestText),
      sealedInput: sha256(readFileSync(paths.sealedInput)),
      prompt: sha256(readFileSync(paths.prompt)),
      outputSchema: sha256(readFileSync(paths.outputSchema))
    };
    const resultHashes = {
      agentEvents: sha256(readFileSync(paths.events)),
      agentStderr: sha256(readFileSync(paths.stderr)),
      structuredResponse: sha256(readFileSync(paths.structuredResponse)),
      artifacts: sha256(readFileSync(paths.artifacts))
    };
    const unitArtifactHashes = Object.fromEntries(
      artifacts.map((artifact) => [artifact.unitId, artifactHash(artifact)])
    );
    const taskName = `${input.context.manifest.namespace}/remediation/round-${input.context.roundPlan.round}/${input.role}/${input.batch.batchId}/${input.context.roundPlan.planHash.slice(0, 16)}`;
    const runContent = {
      schemaVersion: FRENCH_ENTITY_AGENT_RUN_SCHEMA_VERSION,
      policyVersion: FRENCH_ENTITY_AGENT_RUNNER_POLICY_VERSION,
      entityPolicyVersion: FRENCH_ENTITY_AGENT_POLICY_VERSION,
      executorPolicyVersion: FRENCH_CODEX_EXECUTOR_POLICY_VERSION,
      role: input.role,
      batchId: input.batch.batchId,
      taskName,
      agentId: `codex-agent:${processExecution.threadId}`,
      threadId: processExecution.threadId,
      model: profile.model,
      reasoningEffort: profile.reasoningEffort,
      executor,
      capabilities,
      manifestHash: input.context.executionManifest.manifestHash,
      planHash: input.context.canonicalPlan.planHash,
      releaseKey: input.context.options.releaseKey,
      releaseSnapshotFingerprint:
        input.context.canonicalPlan.sourceLineage.releaseSnapshotFingerprint,
      batchHash: input.batch.batchHash,
      inputHash: input.executionInput.logicalHash,
      promptHash: hashFrenchEntityJson(input.executionInput.prompt),
      outputSchemaHash: hashFrenchEntityJson(input.executionInput.schema),
      sourceHashes,
      resultHashes,
      unitArtifactHashes,
      startedAt: processExecution.startedAt,
      completedAt: processExecution.completedAt,
      usage: processExecution.usage
    };
    const run: FrenchEntityRemediationAgentRun = {
      ...runContent,
      runHash: hashFrenchEntityJson(runContent)
    };
    const runPointer = {
      schemaVersion: FRENCH_ENTITY_REMEDIATION_RUN_POINTER_SCHEMA_VERSION,
      round: input.context.roundPlan.round,
      roundPlanHash: input.context.roundPlan.planHash,
      role: input.role,
      batchId: input.batch.batchId,
      selectionHash: input.batch.selectionHash,
      runHash: run.runHash
    };
    writeFileSync(
      paths.runPointer,
      `${canonicalFrenchEntityJson(runPointer)}\n`,
      "utf8"
    );
    const finalPaths = remediationAttemptPaths(input.finalDirectory);
    const receipts = buildRemediationReceipts({
      context: input.context,
      batch: input.batch,
      role: input.role,
      run,
      artifacts,
      temporaryPaths: paths,
      finalPaths
    });
    writeFileSync(
      paths.receipts,
      `${receipts
        .map((receipt) => canonicalFrenchEntityJson(receipt))
        .join("\n")}\n`,
      "utf8"
    );
    writeFileSync(paths.run, `${canonicalFrenchEntityJson(run)}\n`, "utf8");
    const validated = validateRemediationRoleResultFiles({
      context: input.context,
      batch: input.batch,
      role: input.role,
      executionInput: input.executionInput,
      directory: temporaryDirectory,
      expectedRun: run
    });
    renameSync(temporaryDirectory, input.finalDirectory);
    return validated;
  } catch (error) {
    materializeFailedRemediationEvidence(paths, error);
    let quarantineDirectory: string | null = null;
    try {
      quarantineDirectory = quarantineRemediationAttempt({
        roundRoot: input.roundRoot,
        temporaryDirectory,
        role: input.role,
        batch: input.batch,
        roundPlan: input.context.roundPlan,
        inputHash: input.executionInput.logicalHash,
        promptHash: hashFrenchEntityJson(input.executionInput.prompt),
        attempt: input.attempt,
        threadId: processExecution?.threadId ?? null,
        error
      });
    } catch (quarantineError) {
      if (error instanceof Error) {
        Object.defineProperty(error, "quarantineFailure", {
          value: quarantineError,
          enumerable: false
        });
      }
    }
    if (isNonRetryableRemediationError(error)) throw error;
    throw new FrenchEntityAgentRetryableAttemptError(
      error,
      quarantineDirectory
    );
  }
}

function buildRemediationReceipts(input: {
  context: LoadedExecutionContext;
  batch: FrenchEntityRemediationExecutionBatch;
  role: FrenchEntityAgentRole;
  run: FrenchEntityRemediationAgentRun;
  artifacts: Array<
    | FrenchEntityAgentProposal
    | FrenchEntityAgentArbitration
    | FrenchEntityAgentAudit
  >;
  temporaryPaths: ReturnType<typeof remediationAttemptPaths>;
  finalPaths: ReturnType<typeof remediationAttemptPaths>;
}): FrenchCodexExecutionReceipt<FrenchEntityAgentRole>[] {
  const unitById = new Map(
    input.batch.units.map((unit) => [unit.unitId, unit])
  );
  return input.artifacts.map((artifact) => {
    const unit = requiredMap(unitById, artifact.unitId);
    const sourcePaths = {
      manifest: join(
        frenchEntityRemediationRoundRoot(
          input.context.options.resultsDir,
          input.context.roundPlan
        ),
        "execution-manifest.json"
      ),
      plan: input.context.canonicalPlanPath,
      roundPlan: join(
        frenchEntityRemediationRoundRoot(
          input.context.options.resultsDir,
          input.context.roundPlan
        ),
        "round-plan.json"
      ),
      baseManifest: resolve(input.context.options.manifest),
      sealedInput: input.finalPaths.sealedInput,
      prompt: input.finalPaths.prompt,
      outputSchema: input.finalPaths.outputSchema,
      runPointer: input.finalPaths.runPointer
    };
    const resultPaths = {
      agentEvents: input.finalPaths.events,
      agentStderr: input.finalPaths.stderr,
      structuredResponse: input.finalPaths.structuredResponse,
      artifacts: input.finalPaths.artifacts
    };
    const receipt = finalizeFrenchCodexExecutionReceipt({
      schemaVersion: FRENCH_INTERNAL_EXECUTION_RECEIPT_SCHEMA_VERSION,
      role: input.role,
      entryKey: artifact.unitId,
      batchId: input.batch.batchId,
      namespace: `${input.context.manifest.namespace}/remediation/round-${input.context.roundPlan.round}`,
      manifestHash: input.context.executionManifest.manifestHash,
      selectionHash: canonicalReviewUnitHash(
        input.context.canonicalPlan,
        artifact.unitId
      ),
      inputHash: roleInputHash(unit, input.role, input.artifacts),
      artifactHash: artifactHash(artifact),
      agentId: input.run.agentId,
      taskName: input.run.taskName,
      threadId: input.run.threadId,
      model: input.run.model,
      reasoningEffort: input.run.reasoningEffort,
      executorPolicyVersion: input.run.executorPolicyVersion,
      executor: input.run.executor as FrenchCodexExecutionReceipt["executor"],
      capabilities: input.run.capabilities,
      sourcePaths,
      sourceHashes: {
        manifest: sha256(input.context.executionManifestText),
        plan: sha256(input.context.canonicalPlanText),
        roundPlan: sha256(input.context.roundPlanText),
        baseManifest: sha256(input.context.manifestText),
        sealedInput: sha256(readFileSync(input.temporaryPaths.sealedInput)),
        prompt: sha256(readFileSync(input.temporaryPaths.prompt)),
        outputSchema: sha256(readFileSync(input.temporaryPaths.outputSchema)),
        runPointer: sha256(readFileSync(input.temporaryPaths.runPointer))
      },
      resultPaths,
      resultHashes: {
        agentEvents: sha256(readFileSync(input.temporaryPaths.events)),
        agentStderr: sha256(readFileSync(input.temporaryPaths.stderr)),
        structuredResponse: sha256(
          readFileSync(input.temporaryPaths.structuredResponse)
        ),
        artifacts: sha256(readFileSync(input.temporaryPaths.artifacts))
      },
      startedAt: input.run.startedAt,
      completedAt: input.run.completedAt,
      runHash: input.run.runHash
    });
    assertFrenchCodexExecutionReceipt(receipt, { expectedRole: input.role });
    return receipt;
  });
}

function roleInputHash(
  unit: FrenchEntityRemediationRoundPlanUnit,
  role: FrenchEntityAgentRole,
  batchArtifacts: Array<
    | FrenchEntityAgentProposal
    | FrenchEntityAgentArbitration
    | FrenchEntityAgentAudit
  >
): string {
  if (role === "proposerA") return unit.proposerA.inputHash;
  if (role === "proposerB") return unit.proposerB.inputHash;
  const artifacts = new Map(
    batchArtifacts.map((artifact) => [artifact.unitId, artifact])
  );
  const artifact = requiredMap(artifacts, unit.unitId);
  if (role === "arbiter") {
    if (!("arbitrationHash" in artifact)) {
      throw new Error("french-entity-remediation-receipt-arbiter-artifact");
    }
    return artifact.inputHash;
  }
  if (!("auditHash" in artifact)) {
    throw new Error("french-entity-remediation-receipt-auditor-artifact");
  }
  return artifact.inputHash;
}

function validateExistingRemediationRoleResult(input: {
  context: LoadedExecutionContext;
  batch: FrenchEntityRemediationExecutionBatch;
  role: FrenchEntityAgentRole;
  executionInput: FrenchEntityRemediationRoleExecutionInput;
  directory: string;
}): ValidatedRoleResult {
  const run = readJson<FrenchEntityRemediationAgentRun>(
    join(input.directory, "run.json")
  );
  return validateRemediationRoleResultFiles({
    ...input,
    expectedRun: run
  });
}

function validateRemediationRoleResultFiles(input: {
  context: LoadedExecutionContext | HistoricalExecutionContext;
  batch: FrenchEntityRemediationExecutionBatch;
  role: FrenchEntityAgentRole;
  executionInput: FrenchEntityRemediationRoleExecutionInput;
  directory: string;
  expectedRun: FrenchEntityRemediationAgentRun;
}): ValidatedRoleResult {
  const run = input.expectedRun;
  assertFrenchEntityRemediationAgentRun(run);
  const storedRun = readJson<FrenchEntityRemediationAgentRun>(
    join(input.directory, "run.json")
  );
  if (
    canonicalFrenchEntityJson(storedRun) !== canonicalFrenchEntityJson(run) ||
    run.role !== input.role ||
    run.batchId !== input.batch.batchId ||
    run.manifestHash !== input.context.executionManifest.manifestHash ||
    run.planHash !== input.context.canonicalPlan.planHash ||
    run.releaseKey !== input.context.options.releaseKey ||
    run.releaseSnapshotFingerprint !==
      input.context.canonicalPlan.sourceLineage.releaseSnapshotFingerprint ||
    run.batchHash !== input.batch.batchHash ||
    run.inputHash !== input.executionInput.logicalHash ||
    run.promptHash !== hashFrenchEntityJson(input.executionInput.prompt) ||
    run.outputSchemaHash !== hashFrenchEntityJson(input.executionInput.schema)
  ) {
    throw new Error(
      `french-entity-remediation-existing-binding:${input.role}:${input.batch.batchId}`
    );
  }
  const paths = remediationAttemptPaths(input.directory);
  assertExactText(
    paths.sealedInput,
    `${input.executionInput.text.trim()}\n`,
    "sealed-input"
  );
  assertExactText(paths.prompt, input.executionInput.prompt, "prompt");
  assertExactText(
    paths.outputSchema,
    `${canonicalFrenchEntityJson(input.executionInput.schema)}\n`,
    "output-schema"
  );
  const expectedSourceHashes = {
    manifest: sha256(input.context.executionManifestText),
    plan: sha256(input.context.canonicalPlanText),
    roundPlan: sha256(input.context.roundPlanText),
    baseManifest: sha256(input.context.manifestText),
    sealedInput: sha256(readFileSync(paths.sealedInput)),
    prompt: sha256(readFileSync(paths.prompt)),
    outputSchema: sha256(readFileSync(paths.outputSchema))
  };
  const expectedResultHashes = {
    agentEvents: sha256(readFileSync(paths.events)),
    agentStderr: sha256(readFileSync(paths.stderr)),
    structuredResponse: sha256(readFileSync(paths.structuredResponse)),
    artifacts: sha256(readFileSync(paths.artifacts))
  };
  if (
    canonicalFrenchEntityJson(run.sourceHashes) !==
      canonicalFrenchEntityJson(expectedSourceHashes) ||
    canonicalFrenchEntityJson(run.resultHashes) !==
      canonicalFrenchEntityJson(expectedResultHashes)
  ) {
    throw new Error(
      `french-entity-remediation-file-hash-drift:${input.role}:${input.batch.batchId}`
    );
  }
  const artifacts = readJsonl<
    | FrenchEntityAgentProposal
    | FrenchEntityAgentArbitration
    | FrenchEntityAgentAudit
  >(paths.artifacts);
  const parsed = input.executionInput.parse(
    readFileSync(paths.structuredResponse, "utf8")
  );
  if (
    artifacts.length !== input.batch.unitIds.length ||
    canonicalFrenchEntityJson(artifacts) !==
      canonicalFrenchEntityJson(parsed) ||
    canonicalFrenchEntityJson(
      Object.keys(run.unitArtifactHashes).sort(compareText)
    ) !==
      canonicalFrenchEntityJson([...input.batch.unitIds].sort(compareText)) ||
    artifacts.some(
      (artifact) =>
        run.unitArtifactHashes[artifact.unitId] !== artifactHash(artifact)
    )
  ) {
    throw new Error(
      `french-entity-remediation-artifact-drift:${input.role}:${input.batch.batchId}`
    );
  }
  const receipts = readJsonl<
    FrenchCodexExecutionReceipt<FrenchEntityAgentRole>
  >(paths.receipts);
  if (receipts.length !== artifacts.length) {
    throw new Error(
      `french-entity-remediation-receipt-coverage:${input.role}:${input.batch.batchId}`
    );
  }
  const artifactByUnit = new Map(
    artifacts.map((artifact) => [artifact.unitId, artifact])
  );
  const unitById = new Map(
    input.batch.units.map((unit) => [unit.unitId, unit])
  );
  for (const receipt of receipts) {
    assertFrenchCodexExecutionReceipt(receipt, { expectedRole: input.role });
    const artifact = requiredMap(artifactByUnit, receipt.entryKey);
    requiredMap(unitById, receipt.entryKey);
    if (
      receipt.selectionHash !==
        canonicalReviewUnitHash(
          input.context.canonicalPlan,
          receipt.entryKey
        ) ||
      receipt.inputHash !==
        requiredMap(input.executionInput.unitInputHashes, receipt.entryKey) ||
      receipt.artifactHash !== artifactHash(artifact) ||
      receipt.manifestHash !== run.manifestHash ||
      receipt.runHash !== run.runHash ||
      receipt.threadId !== run.threadId ||
      receipt.agentId !== run.agentId ||
      receipt.taskName !== run.taskName ||
      receipt.model !== run.model ||
      receipt.reasoningEffort !== run.reasoningEffort ||
      receipt.namespace !==
        `${input.context.manifest.namespace}/remediation/round-${input.context.roundPlan.round}`
    ) {
      throw new Error(
        `french-entity-remediation-receipt-binding:${input.role}:${receipt.entryKey}`
      );
    }
  }
  assertFrenchEntityAgentResultDirectory({
    directory: input.directory,
    run,
    expectedUnitIds: input.batch.unitIds,
    role: input.role
  });
  return { run, artifacts, receipts };
}

export function assertFrenchEntityRemediationAgentRun(
  run: FrenchEntityRemediationAgentRun
): void {
  assertFrenchEntityAgentRun(run);
}

interface HistoricalExecutionContext {
  options: FrenchEntityRemediationRunCliOptions;
  manifest: FrenchEntityAgentBatchManifest;
  manifestText: string;
  canonicalPlan: FrenchEntityCanonicalizationPlan;
  canonicalPlanText: string;
  canonicalPlanPath: string;
  roundPlan: FrenchEntityRemediationRoundPlan;
  roundPlanText: string;
  executionManifest: FrenchEntityRemediationExecutionManifest;
  executionManifestText: string;
  batches: FrenchEntityRemediationExecutionBatch[];
}

function validateCompleteRoundExecution(input: {
  options: FrenchEntityRemediationRunCliOptions;
  manifest: FrenchEntityAgentBatchManifest;
  canonicalPlan: FrenchEntityCanonicalizationPlan;
  roundPlan: FrenchEntityRemediationRoundPlan;
  roundRoot: string;
}): Pick<
  FrenchEntityRemediationReplay,
  "artifacts" | "runs" | "receipts" | "batches"
> {
  const manifestText = readFileSync(input.options.manifest, "utf8");
  const canonicalPlanPath = resolveReference(
    dirname(input.options.manifest),
    input.manifest.plan.path
  );
  const canonicalPlanText = readFileSync(canonicalPlanPath, "utf8");
  const roundPlanText = `${canonicalFrenchEntityJson(input.roundPlan)}\n`;
  assertExactText(
    join(input.roundRoot, "round-plan.json"),
    roundPlanText,
    "round-plan"
  );
  const batches = buildFrenchEntityRemediationExecutionBatches(
    input.manifest,
    input.roundPlan
  );
  const expectedManifest = finalizeFrenchEntityRemediationExecutionManifest({
    releaseKey: input.options.releaseKey,
    releaseSnapshotFingerprint:
      input.canonicalPlan.sourceLineage.releaseSnapshotFingerprint,
    canonicalPlanHash: input.canonicalPlan.planHash,
    baseManifestHash: input.manifest.manifestHash,
    round: input.roundPlan.round,
    roundPlanHash: input.roundPlan.planHash,
    parentRoundHash: input.roundPlan.parentRoundHash,
    namespace: `${input.manifest.namespace}/remediation/round-${String(input.roundPlan.round).padStart(2, "0")}`,
    batches: batches.map(({ units: _units, ...batch }) => {
      void _units;
      return batch;
    })
  });
  const executionManifestText = `${canonicalFrenchEntityJson(expectedManifest)}\n`;
  assertExactText(
    join(input.roundRoot, "execution-manifest.json"),
    executionManifestText,
    "execution-manifest"
  );
  const context: HistoricalExecutionContext = {
    options: input.options,
    manifest: input.manifest,
    manifestText,
    canonicalPlan: input.canonicalPlan,
    canonicalPlanText,
    canonicalPlanPath,
    roundPlan: input.roundPlan,
    roundPlanText,
    executionManifest: expectedManifest,
    executionManifestText,
    batches
  };
  const state = emptyRoleState();
  for (const role of [
    "proposerA",
    "proposerB",
    "arbiter",
    "auditor"
  ] as const) {
    for (const batch of batches) {
      const executionInput = buildFrenchEntityRemediationRoleExecutionInput({
        manifest: input.manifest,
        canonicalPlan: input.canonicalPlan,
        roundPlan: input.roundPlan,
        batch,
        role,
        artifacts: state
      });
      const result = validateRemediationRoleResultFiles({
        context,
        batch,
        role,
        executionInput,
        directory: remediationRoleDirectory(
          input.roundRoot,
          role,
          batch.batchId
        ),
        expectedRun: readJson<FrenchEntityAgentRun>(
          join(
            remediationRoleDirectory(input.roundRoot, role, batch.batchId),
            "run.json"
          )
        )
      });
      addValidatedRoleResult(state, role, result);
    }
  }
  assertUniqueThreadIds(
    state.runs.map((run) => run.threadId),
    `round-${input.roundPlan.round}`
  );
  const artifacts = new Map<string, FrenchEntityAgentUnitArtifacts>();
  for (const unitId of input.roundPlan.unitIds) {
    artifacts.set(unitId, {
      proposalA: requiredMap(state.proposalA, unitId),
      proposalB: requiredMap(state.proposalB, unitId),
      arbitration: requiredMap(state.arbitration, unitId),
      audit: requiredMap(state.audit, unitId)
    });
  }
  return {
    artifacts,
    runs: state.runs,
    receipts: state.receipts,
    batches
  };
}

function finalizeAndReplayRound(
  context: LoadedExecutionContext,
  roundRoot: string,
  publish: boolean
): FrenchEntityRemediationReplay {
  const execution = validateCompleteRoundExecution({
    options: context.options,
    manifest: context.manifest,
    canonicalPlan: context.canonicalPlan,
    roundPlan: context.roundPlan,
    roundRoot
  });
  const result = finalizeFrenchEntityRemediationRound({
    plan: context.roundPlan,
    artifacts: execution.artifacts
  });
  const resultPath = join(roundRoot, "round-result.json");
  const resultText = `${canonicalFrenchEntityJson(result)}\n`;
  if (publish) ensureImmutableText(resultPath, resultText, "round-result");
  else assertExactText(resultPath, resultText, "round-result");
  return {
    roundRoot,
    plan: context.roundPlan,
    result,
    artifacts: execution.artifacts,
    runs: execution.runs,
    receipts: execution.receipts,
    batches: execution.batches
  };
}

function publishRemediationIndex(
  context: LoadedExecutionContext,
  current: FrenchEntityRemediationReplay
): string {
  const roundLocations = context.history.map((bundle) =>
    findStoredRoundByHash(
      context.options.resultsDir,
      bundle.plan.round,
      bundle.result.roundHash
    )
  );
  roundLocations.push({
    root: current.roundRoot,
    bundle: { plan: current.plan, result: current.result }
  });
  const rounds = roundLocations.map(({ root, bundle }) => {
    const planPath = join(root, "round-plan.json");
    const executionManifestPath = join(root, "execution-manifest.json");
    const resultPath = join(root, "round-result.json");
    const executionManifest =
      readJson<FrenchEntityRemediationExecutionManifest>(executionManifestPath);
    return finalizeFrenchEntityRemediationIndexRoundRef({
      round: bundle.plan.round,
      plan: {
        kind: "round-plan",
        path: resolve(planPath),
        fileSha256: sha256(readFileSync(planPath)),
        contentHash: bundle.plan.planHash
      },
      executionManifest: {
        kind: "execution-manifest",
        path: resolve(executionManifestPath),
        fileSha256: sha256(readFileSync(executionManifestPath)),
        contentHash: executionManifest.manifestHash
      },
      result: {
        kind: "round-result",
        path: resolve(resultPath),
        fileSha256: sha256(readFileSync(resultPath)),
        contentHash: bundle.result.roundHash
      },
      resultsDirectory: resolve(root)
    });
  });
  const index: FrenchEntityRemediationIndex =
    finalizeFrenchEntityRemediationIndex({
      releaseKey: context.options.releaseKey,
      releaseSnapshotFingerprint:
        context.canonicalPlan.sourceLineage.releaseSnapshotFingerprint,
      canonicalPlanHash: context.canonicalPlan.planHash,
      baseManifestHash: context.manifest.manifestHash,
      rounds
    });
  const path = resolve(
    context.options.resultsDir,
    "remediation",
    `index-round-${String(context.roundPlan.round).padStart(2, "0")}-${index.indexHash.slice(0, 16)}.json`
  );
  ensureImmutableText(path, `${canonicalFrenchEntityJson(index)}\n`, "index");
  return path;
}

function emptyRoleState(): RoleState {
  return {
    proposalA: new Map(),
    proposalB: new Map(),
    arbitration: new Map(),
    audit: new Map(),
    runs: [],
    receipts: []
  };
}

function addValidatedRoleResult(
  state: RoleState,
  role: FrenchEntityAgentRole,
  result: ValidatedRoleResult
): void {
  const target =
    role === "proposerA"
      ? state.proposalA
      : role === "proposerB"
        ? state.proposalB
        : role === "arbiter"
          ? state.arbitration
          : state.audit;
  for (const artifact of result.artifacts) {
    if (target.has(artifact.unitId)) {
      throw new Error(
        `french-entity-remediation-role-artifact-duplicate:${role}:${artifact.unitId}`
      );
    }
    target.set(artifact.unitId, artifact as never);
  }
  state.runs.push(result.run);
  state.receipts.push(...result.receipts);
}

export async function executeFrenchEntityRemediationCodex(
  input: FrenchEntityRemediationProcessInput,
  childSupervisor: FrenchEntityRemediationChildSupervisor
): Promise<FrenchEntityRemediationProcessExecution> {
  childSupervisor.assertRunning();
  const startedAt = new Date().toISOString();
  const snapshot = prepareFrenchCodexImmutableExecution(
    input.options.codexBinary
  );
  const args = frenchCodexProposerExecArgs({
    model: input.profile.model,
    reasoningEffort: input.profile.reasoningEffort,
    schemaPath: input.schemaPath,
    responsePath: input.responsePath,
    cwd: input.workingDirectory
  });
  let child;
  try {
    child = spawn(snapshot.executionPath, args, {
      cwd: input.workingDirectory,
      env: buildSealedFrenchCodexProposerEnvironment(input.options.codexHome),
      stdio: ["pipe", "pipe", "pipe"],
      detached: process.platform !== "win32"
    });
    childSupervisor.track(child);
  } catch (error) {
    snapshot.dispose();
    throw error;
  }
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => (stdout += chunk));
  child.stderr.on("data", (chunk: string) => (stderr += chunk));
  child.stdin.end(input.prompt);
  let timedOut = false;
  let exitCode = -1;
  let executionError: unknown = null;
  let snapshotError: unknown = null;
  try {
    exitCode = await new Promise<number>((resolveExit, reject) => {
      let killTimer: ReturnType<typeof setTimeout> | undefined;
      const timeout = setTimeout(() => {
        timedOut = true;
        signalChild(child.pid, "SIGTERM");
        killTimer = setTimeout(() => signalChild(child.pid, "SIGKILL"), 2_000);
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
  } catch (error) {
    executionError = error;
  } finally {
    try {
      snapshot.assertUnchanged();
    } catch (error) {
      snapshotError = error;
    } finally {
      snapshot.dispose();
    }
  }
  const completedAt = new Date().toISOString();
  childSupervisor.assertRunning();
  const responseText = existsSync(input.responsePath)
    ? readFileSync(input.responsePath, "utf8")
    : "";
  const evidence = {
    stdout,
    stderr,
    responseText,
    startedAt,
    completedAt
  };
  if (snapshotError !== null) {
    throw new FrenchEntityRemediationProcessError(
      errorMessage(snapshotError),
      evidence
    );
  }
  if (executionError !== null) {
    throw new FrenchEntityRemediationProcessError(
      `french-entity-remediation-process-error:${input.role}:${errorMessage(executionError)}`,
      evidence
    );
  }
  if (timedOut || exitCode !== 0 || !existsSync(input.responsePath)) {
    throw new FrenchEntityRemediationProcessError(
      timedOut
        ? `french-entity-remediation-timeout:${input.role}:${input.options.timeoutMs}`
        : `french-entity-remediation-process-failed:${input.role}:${exitCode}`,
      evidence
    );
  }
  let events: ReturnType<typeof parseFrenchCodexAgentEvents>;
  try {
    events = parseFrenchCodexAgentEvents(stdout, responseText);
  } catch (error) {
    throw new FrenchEntityRemediationProcessError(
      `french-entity-remediation-event-parse:${input.role}:${errorMessage(error)}`,
      evidence
    );
  }
  return {
    threadId: events.threadId,
    stdout,
    stderr,
    responseText,
    usage: events.usage,
    startedAt,
    completedAt
  };
}

function remediationAttemptPaths(directory: string): {
  sealedInput: string;
  prompt: string;
  outputSchema: string;
  structuredResponse: string;
  events: string;
  stderr: string;
  artifacts: string;
  runPointer: string;
  receipts: string;
  run: string;
} {
  return {
    sealedInput: join(directory, "sealed-input.json"),
    prompt: join(directory, "prompt.txt"),
    outputSchema: join(directory, "output-schema.json"),
    structuredResponse: join(directory, "structured-response.json"),
    events: join(directory, "agent-events.jsonl"),
    stderr: join(directory, "agent-stderr.log"),
    artifacts: join(directory, "artifacts.jsonl"),
    runPointer: join(directory, "run-pointer.json"),
    receipts: join(directory, "execution-receipts.jsonl"),
    run: join(directory, "run.json")
  };
}

function materializeFailedRemediationEvidence(
  paths: ReturnType<typeof remediationAttemptPaths>,
  error: unknown
): void {
  if (error instanceof FrenchEntityRemediationProcessError) {
    writeFileSync(paths.events, error.evidence.stdout, "utf8");
    writeFileSync(paths.stderr, error.evidence.stderr, "utf8");
    writeFileSync(
      paths.structuredResponse,
      error.evidence.responseText,
      "utf8"
    );
  }
  for (const path of [
    paths.sealedInput,
    paths.prompt,
    paths.outputSchema,
    paths.structuredResponse,
    paths.events,
    paths.stderr
  ]) {
    if (!existsSync(path)) writeFileSync(path, "", "utf8");
  }
}

function quarantineRemediationAttempt(input: {
  roundRoot: string;
  temporaryDirectory: string;
  role: FrenchEntityAgentRole;
  batch: FrenchEntityRemediationExecutionBatch;
  roundPlan: FrenchEntityRemediationRoundPlan;
  inputHash: string;
  promptHash: string;
  attempt: number;
  threadId: string | null;
  error: unknown;
}): string {
  const fileHashes = Object.fromEntries(
    Object.entries(remediationAttemptPaths(input.temporaryDirectory))
      .filter(([, path]) => existsSync(path))
      .map(([key, path]) => [key, sha256(readFileSync(path))])
  );
  const failureContent = {
    schemaVersion: FRENCH_ENTITY_REMEDIATION_QUARANTINE_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_REMEDIATION_RUNNER_POLICY_VERSION,
    status: "quarantined-non-reusable-non-attestable" as const,
    reusable: false as const,
    attestable: false as const,
    round: input.roundPlan.round,
    roundPlanHash: input.roundPlan.planHash,
    role: input.role,
    batchId: input.batch.batchId,
    selectionHash: input.batch.selectionHash,
    inputHash: input.inputHash,
    promptHash: input.promptHash,
    attempt: input.attempt,
    threadId: input.threadId,
    error: {
      name: input.error instanceof Error ? input.error.name : "NonErrorFailure",
      message: errorMessage(input.error),
      stack: input.error instanceof Error ? (input.error.stack ?? "") : ""
    },
    fileHashes,
    quarantinedAt: new Date().toISOString()
  };
  const record = {
    ...failureContent,
    quarantineHash: hashFrenchEntityJson(failureContent)
  };
  writeFileSync(
    join(input.temporaryDirectory, "quarantine.json"),
    `${canonicalFrenchEntityJson(record)}\n`,
    "utf8"
  );
  const quarantineRoot = join(
    input.roundRoot,
    "quarantine",
    input.role,
    input.batch.batchId
  );
  mkdirSync(quarantineRoot, { recursive: true });
  const destination = join(
    quarantineRoot,
    `${record.quarantineHash}-${randomBytes(8).toString("hex")}`
  );
  renameSync(input.temporaryDirectory, destination);
  return destination;
}

function quarantineInterruptedTemporaries(roundRoot: string): void {
  for (const role of [
    "proposerA",
    "proposerB",
    "arbiter",
    "auditor"
  ] as const) {
    const roleRoot = join(roundRoot, role);
    if (!existsSync(roleRoot)) continue;
    for (const entry of readdirSync(roleRoot)) {
      if (!entry.includes(".tmp-")) continue;
      const source = join(roleRoot, entry);
      if (!statSync(source).isDirectory()) continue;
      const interruptedRoot = join(
        roundRoot,
        "quarantine",
        "interrupted",
        role
      );
      mkdirSync(interruptedRoot, { recursive: true });
      const content = {
        schemaVersion: FRENCH_ENTITY_REMEDIATION_QUARANTINE_SCHEMA_VERSION,
        policyVersion: FRENCH_ENTITY_REMEDIATION_RUNNER_POLICY_VERSION,
        status: "quarantined-interrupted-non-reusable" as const,
        role,
        sourceName: entry,
        quarantinedAt: new Date().toISOString()
      };
      writeFileSync(
        join(source, "interrupted.json"),
        `${canonicalFrenchEntityJson({
          ...content,
          quarantineHash: hashFrenchEntityJson(content)
        })}\n`,
        "utf8"
      );
      renameSync(
        source,
        join(interruptedRoot, `${entry}-${randomBytes(6).toString("hex")}`)
      );
    }
  }
}

function scanCurrentRoundThreadIds(
  roundRoot: string,
  plan: FrenchEntityRemediationRoundPlan
): Set<string> {
  const threads = new Set<string>();
  for (const role of [
    "proposerA",
    "proposerB",
    "arbiter",
    "auditor"
  ] as const) {
    const roleRoot = join(roundRoot, role);
    if (!existsSync(roleRoot)) continue;
    for (const entry of readdirSync(roleRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.includes(".tmp-")) continue;
      const path = join(roleRoot, entry.name, "run.json");
      if (!existsSync(path)) continue;
      const run = readJson<FrenchEntityAgentRun>(path);
      assertFrenchEntityAgentRun(run);
      if (
        run.sourceHashes.roundPlan !==
          sha256(`${canonicalFrenchEntityJson(plan)}\n`) ||
        threads.has(run.threadId)
      ) {
        throw new Error(
          `french-entity-remediation-current-thread-or-plan:${run.threadId}`
        );
      }
      threads.add(run.threadId);
    }
  }
  return threads;
}

function isCompleteRoundDirectory(
  roundRoot: string,
  batches: readonly FrenchEntityRemediationExecutionBatch[]
): boolean {
  return batches.every((batch) =>
    (["proposerA", "proposerB", "arbiter", "auditor"] as const).every((role) =>
      existsSync(
        join(
          remediationRoleDirectory(roundRoot, role, batch.batchId),
          "run.json"
        )
      )
    )
  );
}

function remediationRoleDirectory(
  roundRoot: string,
  role: FrenchEntityAgentRole,
  batchId: string
): string {
  return resolve(roundRoot, role, batchId);
}

function canonicalReviewUnitHash(
  plan: FrenchEntityCanonicalizationPlan,
  unitId: string
): string {
  const unit = plan.reviewUnits.find(
    (candidate) => candidate.unitId === unitId
  );
  if (!unit) {
    throw new Error(`french-entity-remediation-canonical-unit:${unitId}`);
  }
  return unit.unitHash;
}

function assertFreshThreads(
  runs: readonly FrenchEntityAgentRun[],
  historicalThreads: ReadonlySet<string>
): void {
  assertUniqueThreadIds(
    runs.map((run) => run.threadId),
    "remediation"
  );
  for (const run of runs) {
    if (historicalThreads.has(run.threadId)) {
      throw new Error(
        `french-entity-remediation-inter-round-thread-reuse:${run.threadId}`
      );
    }
  }
}

function assertUniqueThreadIds(values: readonly string[], label: string): void {
  if (
    values.some((value) => !THREAD_ID_PATTERN.test(value)) ||
    new Set(values).size !== values.length
  ) {
    throw new Error(`french-entity-remediation-thread-coverage:${label}`);
  }
}

function ensureImmutableText(path: string, text: string, label: string): void {
  if (existsSync(path)) {
    assertExactText(path, text, label);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}-${randomBytes(8).toString("hex")}`;
  writeFileSync(temporary, text, { encoding: "utf8", flag: "wx" });
  try {
    try {
      linkSync(temporary, path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      assertExactText(path, text, label);
    }
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

function assertExactText(path: string, text: string, label: string): void {
  if (!existsSync(path) || readFileSync(path, "utf8") !== text) {
    throw new Error(`french-entity-remediation-${label}-drift:${path}`);
  }
}

function resolveReference(baseDirectory: string, path: string): string {
  return isAbsolute(path) ? resolve(path) : resolve(baseDirectory, path);
}

function requiredArtifactMap<T>(
  value: ReadonlyMap<string, T> | undefined,
  role: string
): ReadonlyMap<string, T> {
  if (!value) {
    throw new Error(`french-entity-remediation-artifact-map-missing:${role}`);
  }
  return value;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function readJsonl<T>(path: string): T[] {
  return readFileSync(path, "utf8")
    .split(/\r?\n/u)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as T);
}

function artifactHash(
  artifact:
    | FrenchEntityAgentProposal
    | FrenchEntityAgentArbitration
    | FrenchEntityAgentAudit
): string {
  if ("proposalHash" in artifact) return artifact.proposalHash;
  if ("arbitrationHash" in artifact) return artifact.arbitrationHash;
  return artifact.auditHash;
}

function stripHash<T extends object, K extends keyof T>(
  value: T,
  key: K
): Omit<T, K> {
  const copy = { ...value };
  delete copy[key];
  return copy;
}

function requiredMap<K, V>(map: ReadonlyMap<K, V>, key: K): V {
  const value = map.get(key);
  if (value === undefined) {
    throw new Error(`french-entity-remediation-map-missing:${String(key)}`);
  }
  return value;
}

export async function mapFrenchEntityRemediationConcurrent<T>(
  values: readonly T[],
  concurrency: number,
  worker: (value: T) => Promise<void>
): Promise<void> {
  let cursor = 0;
  const noFailure = Symbol("no-french-entity-remediation-worker-failure");
  let firstFailure: unknown = noFailure;
  const run = async (): Promise<void> => {
    while (true) {
      if (firstFailure !== noFailure) return;
      const index = cursor;
      cursor += 1;
      if (index >= values.length) return;
      try {
        await worker(values[index] as T);
      } catch (error) {
        if (firstFailure === noFailure) firstFailure = error;
        throw error;
      }
    }
  };
  await Promise.allSettled(
    Array.from({ length: Math.min(concurrency, values.length) }, () => run())
  );
  if (firstFailure !== noFailure) throw firstFailure;
}

const mapConcurrent = mapFrenchEntityRemediationConcurrent;

function signalChild(pid: number | undefined, signal: NodeJS.Signals): void {
  if (!pid) return;
  try {
    process.kill(process.platform === "win32" ? pid : -pid, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}

function positiveInteger(
  value: string | undefined,
  fallback: number,
  label: string
): number {
  const raw = value ?? String(fallback);
  if (!/^[1-9]\d*$/u.test(raw)) {
    throw new Error(`french-entity-remediation-invalid-${label}:${raw}`);
  }
  return Number(raw);
}

function boundedPositiveInteger(
  value: string | undefined,
  fallback: number,
  maximum: number,
  label: string
): number {
  const parsed = positiveInteger(value, fallback, label);
  if (parsed > maximum) {
    throw new Error(
      `french-entity-remediation-invalid-${label}:${parsed}:maximum-${maximum}`
    );
  }
  return parsed;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && SHA256_PATTERN.test(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isNonRetryableRemediationError(error: unknown): boolean {
  const message = errorMessage(error);
  return (
    message.startsWith("french-codex-") ||
    message.startsWith("french-entity-remediation-run-interrupted:") ||
    message.startsWith("immutable-executable-") ||
    message.includes("source-drift") ||
    message.includes("existing-") ||
    message.includes("thread-reuse")
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  runFrenchEntityRemediationRoundCli(
    parseFrenchEntityRemediationRunArgs(process.argv.slice(2))
  ).catch((error) => {
    process.stderr.write(`${errorMessage(error)}\n`);
    process.exitCode = 1;
  });
}
