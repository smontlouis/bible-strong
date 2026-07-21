import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import {
  assertFrenchCodexExecutionReceipt,
  type FrenchCodexExecutionReceipt
} from "./frenchCodexExecutionReceipt.js";
import {
  assertFrenchEntityAgentBatchManifest,
  assertFrenchEntityAgentInputArtifact,
  assertFrenchEntityAgentUnitArtifacts,
  frenchEntityAgentArbiterUnitInputHash,
  frenchEntityAgentAuditorUnitInputHash,
  mergeFrenchEntityAgentArtifacts,
  mergeFrenchEntityAgentArtifactsTerminal,
  type FrenchEntityAgentArbitration,
  type FrenchEntityAgentAudit,
  type FrenchEntityAgentBatchManifest,
  type FrenchEntityAgentInputArtifact,
  type FrenchEntityAgentMergeResult,
  type FrenchEntityAgentTerminalMergeResult,
  type FrenchEntityAgentProposal,
  type FrenchEntityAgentProposerAView,
  type FrenchEntityAgentProposerBView,
  type FrenchEntityAgentRole,
  type FrenchEntityAgentUnitInputHashes,
  type FrenchEntityAgentUnitArtifacts,
  type FrenchEntityAgentUnitArtifactValidator
} from "./frenchEntityAgentReview.js";
import {
  canonicalFrenchEntityJson,
  FRENCH_ENTITY_CANONICALIZATION_DEFAULT_EXPECTATIONS,
  hashFrenchEntityJson,
  type FrenchEntityCanonicalizationExpectations,
  type FrenchEntityCanonicalizationPlan
} from "./frenchEntityCanonicalization.js";
import {
  buildFrenchEntityRemediationOverlay,
  assertFrenchEntityRemediationRoundUnitArtifacts,
  finalizeFrenchEntityRemediationRound,
  frenchEntityAgentQuartetHash,
  frenchEntityRemediationArbiterInputHash,
  frenchEntityRemediationAuditorInputHash,
  semanticFrenchEntityProposalHash,
  type FrenchEntityRemediationBaseViews,
  type FrenchEntityRemediationRoundBundle,
  type FrenchEntityRemediationRoundPlan,
  type FrenchEntityRemediationRoundPlanUnit,
  type FrenchEntityRemediationRoundResult
} from "./frenchEntityRemediation.js";
import {
  assertFrenchEntityAgentResultDirectory,
  assertFrenchEntityAgentRun,
  type FrenchEntityAgentRun
} from "../../scripts/runLexiconV3FrenchEntityAgents.js";

export const FRENCH_ENTITY_MERGE_ATTESTATION_V2_SCHEMA_VERSION =
  "lexicon-v3-french-entity-merge-attestation@2" as const;
export const FRENCH_ENTITY_MERGE_ATTESTATION_V2_POLICY_VERSION =
  "lexicon-v3-french-entity-merge-attestation-policy@2" as const;
export const FRENCH_ENTITY_REMEDIATION_EXECUTION_MANIFEST_SCHEMA_VERSION =
  "lexicon-v3-french-entity-remediation-execution-manifest@1" as const;
export const FRENCH_ENTITY_REMEDIATION_EXECUTION_SUMMARY_SCHEMA_VERSION =
  "lexicon-v3-french-entity-remediation-execution-summary@1" as const;
export const FRENCH_ENTITY_REMEDIATION_INDEX_SCHEMA_VERSION =
  "lexicon-v3-french-entity-remediation-index@1" as const;
export const FRENCH_ENTITY_FINAL_OVERLAY_SCHEMA_VERSION =
  "lexicon-v3-french-entity-final-overlay@1" as const;
export const FRENCH_ENTITY_PRODUCTION_BASE_EXECUTION_COUNTS = {
  batches: 220,
  runs: 880,
  receipts: 10_516,
  reviewUnits: 2_629,
  uniqueThreads: 880
} as const;

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const ROLES = ["proposerA", "proposerB", "arbiter", "auditor"] as const;

export interface FrenchEntityMergeRunAttestationV2 {
  role: FrenchEntityAgentRole;
  batchId: string;
  threadId: string;
  runHash: string;
  relativeDirectory: string;
  fileHashes: { run: string; artifacts: string; receipts: string };
  unitCount: number;
  receiptCount: number;
  unitBindingsDigest: string;
  runAttestationHash: string;
}

export interface FrenchEntityUnitExecutionBindingV2 {
  role: FrenchEntityAgentRole;
  batchId: string;
  runHash: string;
  receiptHash: string;
  artifactHash: string;
  threadId: string;
}

export interface FrenchEntityRemediationExecutionBatch {
  batchId: string;
  sourceBatchHash: string;
  unitIds: string[];
  unitPlanHashes: { unitId: string; planUnitHash: string }[];
  selectionHash: string;
  batchHash: string;
}

export interface FrenchEntityRemediationExecutionManifest {
  schemaVersion: typeof FRENCH_ENTITY_REMEDIATION_EXECUTION_MANIFEST_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_ENTITY_MERGE_ATTESTATION_V2_POLICY_VERSION;
  releaseKey: string;
  releaseSnapshotFingerprint: string;
  canonicalPlanHash: string;
  baseManifestHash: string;
  round: number;
  roundPlanHash: string;
  parentRoundHash: string | null;
  namespace: string;
  counts: { units: number; batches: number };
  batches: FrenchEntityRemediationExecutionBatch[];
  manifestHash: string;
}

export interface FrenchEntityRemediationExecutionSummaryCounts {
  units: number;
  batches: number;
  runs: number;
  receipts: number;
  uniqueThreads: number;
  safe: number;
  hold: number;
  block: number;
  semanticChanged: number;
  semanticUnchanged: number;
}

export interface FrenchEntityRemediationExecutionSummary {
  schemaVersion: typeof FRENCH_ENTITY_REMEDIATION_EXECUTION_SUMMARY_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_ENTITY_MERGE_ATTESTATION_V2_POLICY_VERSION;
  releaseKey: string;
  round: number;
  roundPlanHash: string;
  executionManifestHash: string;
  roundHash: string;
  parentRoundHash: string | null;
  parentEffectiveDigest: string;
  resultingEffectiveDigest: string;
  counts: FrenchEntityRemediationExecutionSummaryCounts;
  runs: FrenchEntityMergeRunAttestationV2[];
  runsDigest: string;
  unitResultsDigest: string;
  summaryHash: string;
}

interface HashedPathRef<TName extends string> {
  path: string;
  fileSha256: string;
  contentHash: string;
  kind: TName;
}

export interface FrenchEntityRemediationIndexRoundRef {
  round: number;
  plan: HashedPathRef<"round-plan">;
  executionManifest: HashedPathRef<"execution-manifest">;
  result: HashedPathRef<"round-result">;
  resultsDirectory: string;
  roundRefHash: string;
}

export interface FrenchEntityRemediationIndex {
  schemaVersion: typeof FRENCH_ENTITY_REMEDIATION_INDEX_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_ENTITY_MERGE_ATTESTATION_V2_POLICY_VERSION;
  releaseKey: string;
  releaseSnapshotFingerprint: string;
  canonicalPlanHash: string;
  baseManifestHash: string;
  rounds: FrenchEntityRemediationIndexRoundRef[];
  indexHash: string;
}

export interface FrenchEntityEffectiveUnitV2 {
  unitId: string;
  sourceUnitHash: string;
  sourceRound: number;
  quartetHash: string;
  proposalAHash: string;
  proposalBHash: string;
  arbitrationHash: string;
  auditHash: string;
  selectedProposalHash: string;
  semanticProposalHash: string;
  verdict: "safe" | "hold" | "block";
  auditorRunHash: string;
  auditorReceiptHash: string;
  parentEffectiveUnitHash: string | null;
  resultHash: string | null;
  chainHash: string;
  effectiveUnitHash: string;
}

export interface FrenchEntityTerminalQuarantineRecord {
  schemaVersion: "lexicon-v3-french-entity-terminal-quarantine@1";
  policyVersion: typeof FRENCH_ENTITY_MERGE_ATTESTATION_V2_POLICY_VERSION;
  unitId: string;
  reviewEntryKeys: string[];
  entityIds: number[];
  verdict: "safe" | "hold" | "block";
  quarantineReason:
    | "terminal-audit-non-safe"
    | "depends-on-unresolved-entity";
  failedCheckCodes: string[];
  sourceRound: number;
  quartetHash: string;
  auditHash: string;
  semanticProposalHash: string;
  chainHash: string;
  contentHash: string;
}

export interface FrenchEntityFinalOverlayV2 {
  schemaVersion: typeof FRENCH_ENTITY_FINAL_OVERLAY_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_ENTITY_MERGE_ATTESTATION_V2_POLICY_VERSION;
  releaseKey: string;
  canonicalPlanHash: string;
  baseManifestHash: string;
  roundHashes: string[];
  entries: FrenchEntityEffectiveUnitV2[];
  counts: {
    reviewUnits: number;
    fromBase: number;
    fromRemediation: number;
    safe: number;
    hold: number;
    block: number;
    quarantined: number;
  };
  overlayHash: string;
}

export interface FrenchEntityMergeAttestationV2Counts {
  base: {
    batches: number;
    runs: number;
    receipts: number;
    reviewUnits: number;
    uniqueThreads: number;
  };
  remediation: {
    rounds: number;
    batches: number;
    unitAttempts: number;
    distinctUnits: number;
    runs: number;
    receipts: number;
    uniqueThreads: number;
  };
  total: { runs: number; receipts: number; uniqueThreads: number };
  final: {
    reviewUnits: number;
    fromBase: number;
    fromRemediation: number;
    safe: number;
    hold: number;
    block: number;
  };
}

export interface FrenchEntityMergeAttestationV2 {
  schemaVersion: typeof FRENCH_ENTITY_MERGE_ATTESTATION_V2_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_ENTITY_MERGE_ATTESTATION_V2_POLICY_VERSION;
  releaseKey: string;
  releaseSnapshotFingerprint: string;
  plan: { path: string; fileSha256: string; planHash: string };
  batchManifest: { path: string; fileSha256: string; manifestHash: string };
  manifestHash: string;
  base: {
    resultsDirectory: string;
    counts: FrenchEntityMergeAttestationV2Counts["base"];
    runs: FrenchEntityMergeRunAttestationV2[];
    runsDigest: string;
    viewsDigest: string;
    effectiveDigest: string;
  };
  remediation: {
    index: { path: string; fileSha256: string; indexHash: string } | null;
    rounds: FrenchEntityRemediationExecutionSummary[];
    roundsDigest: string;
  };
  finalOverlay: {
    path: string;
    sha256: string;
    records: number;
    overlayHash: string;
    effectiveDigest: string;
  };
  counts: FrenchEntityMergeAttestationV2Counts;
  outputs: {
    canonicalEntities: { path: string; sha256: string; records: number };
    canonicalEntryPolicies: { path: string; sha256: string; records: number };
    quarantine: { path: string; sha256: string; records: number };
  };
  mergeHash: string;
  gateHash: string;
  attestationHash: string;
}

export interface FrenchEntityMergeAttestationV2Replay {
  attestation: FrenchEntityMergeAttestationV2;
  plan: FrenchEntityCanonicalizationPlan;
  manifest: FrenchEntityAgentBatchManifest;
  merged: FrenchEntityAgentMergeResult | FrenchEntityAgentTerminalMergeResult;
  overlay: FrenchEntityFinalOverlayV2;
}

interface ExecutionReplay {
  artifacts: Map<string, FrenchEntityAgentUnitArtifacts>;
  inputHashesByUnit: Map<string, FrenchEntityAgentUnitInputHashes>;
  bindings: Map<
    string,
    Map<FrenchEntityAgentRole, FrenchEntityUnitExecutionBindingV2>
  >;
  runs: FrenchEntityMergeRunAttestationV2[];
  receiptCount: number;
  threads: Set<string>;
}

interface PreparedMergeV2 {
  plan: FrenchEntityCanonicalizationPlan;
  manifest: FrenchEntityAgentBatchManifest;
  merged: FrenchEntityAgentMergeResult | FrenchEntityAgentTerminalMergeResult;
  overlay: FrenchEntityFinalOverlayV2;
  overlayText: string;
  canonicalEntitiesText: string;
  canonicalEntryPoliciesText: string;
  quarantineText: string;
  attestation: FrenchEntityMergeAttestationV2;
}

export function frenchEntityRemediationRoleBatchInputHash(input: {
  round: number;
  roundPlanHash: string;
  batchId: string;
  sourceBatchHash: string;
  selectionHash: string;
  role: FrenchEntityAgentRole;
  unitInputHashes: readonly { unitId: string; inputHash: string }[];
}): string {
  return hashFrenchEntityJson({
    schemaVersion: "lexicon-v3-french-entity-remediation-role-batch-input@1",
    policyVersion: FRENCH_ENTITY_MERGE_ATTESTATION_V2_POLICY_VERSION,
    ...input
  });
}

export function finalizeFrenchEntityRemediationExecutionBatch(input: {
  round: number;
  roundPlanHash: string;
  batchId: string;
  sourceBatchHash: string;
  units: { unitId: string; planUnitHash: string }[];
}): FrenchEntityRemediationExecutionBatch {
  if (
    !Number.isInteger(input.round) ||
    input.round < 1 ||
    !input.batchId.trim() ||
    !isSha256(input.roundPlanHash) ||
    !isSha256(input.sourceBatchHash) ||
    input.units.length === 0 ||
    input.units.some(
      (unit) => !unit.unitId.trim() || !isSha256(unit.planUnitHash)
    )
  ) {
    throw new Error("french-entity-attestation-v2-execution-batch-input");
  }
  const unitPlanHashes = input.units.map((unit) => ({ ...unit }));
  const unitIds = unitPlanHashes.map((unit) => unit.unitId);
  const selectionHash = hashFrenchEntityJson({
    policyVersion: FRENCH_ENTITY_MERGE_ATTESTATION_V2_POLICY_VERSION,
    round: input.round,
    roundPlanHash: input.roundPlanHash,
    sourceBatchHash: input.sourceBatchHash,
    unitPlanHashes
  });
  const content = {
    batchId: input.batchId,
    sourceBatchHash: input.sourceBatchHash,
    unitIds,
    unitPlanHashes,
    selectionHash
  };
  return { ...content, batchHash: hashFrenchEntityJson(content) };
}

export function finalizeFrenchEntityRemediationExecutionManifest(
  input: Omit<
    FrenchEntityRemediationExecutionManifest,
    "schemaVersion" | "policyVersion" | "counts" | "manifestHash"
  >
): FrenchEntityRemediationExecutionManifest {
  const content = {
    schemaVersion: FRENCH_ENTITY_REMEDIATION_EXECUTION_MANIFEST_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_MERGE_ATTESTATION_V2_POLICY_VERSION,
    ...input,
    counts: {
      units: input.batches.reduce(
        (sum, batch) => sum + batch.unitIds.length,
        0
      ),
      batches: input.batches.length
    }
  };
  return { ...content, manifestHash: hashFrenchEntityJson(content) };
}

export function finalizeFrenchEntityRemediationExecutionSummary(
  input: Omit<
    FrenchEntityRemediationExecutionSummary,
    "schemaVersion" | "policyVersion" | "summaryHash"
  >
): FrenchEntityRemediationExecutionSummary {
  assertRoundCounts(input.counts);
  const content = {
    schemaVersion: FRENCH_ENTITY_REMEDIATION_EXECUTION_SUMMARY_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_MERGE_ATTESTATION_V2_POLICY_VERSION,
    ...input
  };
  return { ...content, summaryHash: hashFrenchEntityJson(content) };
}

export function finalizeFrenchEntityRemediationIndexRoundRef(
  input: Omit<FrenchEntityRemediationIndexRoundRef, "roundRefHash">
): FrenchEntityRemediationIndexRoundRef {
  const content = {
    ...input,
    resultsDirectory: resolve(input.resultsDirectory)
  };
  return { ...content, roundRefHash: hashFrenchEntityJson(content) };
}

export function finalizeFrenchEntityRemediationIndex(
  input: Omit<
    FrenchEntityRemediationIndex,
    "schemaVersion" | "policyVersion" | "indexHash"
  >
): FrenchEntityRemediationIndex {
  const content = {
    schemaVersion: FRENCH_ENTITY_REMEDIATION_INDEX_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_MERGE_ATTESTATION_V2_POLICY_VERSION,
    ...input
  };
  return { ...content, indexHash: hashFrenchEntityJson(content) };
}

export function prepareFrenchEntityMergeAttestationV2(input: {
  manifestPath: string;
  baseResultsDirectory: string;
  remediationIndexPath?: string | null;
  canonicalEntitiesPath: string;
  canonicalEntryPoliciesPath: string;
  quarantinePath?: string;
  finalOverlayPath: string;
  expectedReleaseKey: string;
  expectations?: FrenchEntityCanonicalizationExpectations;
}): PreparedMergeV2 {
  const expectations =
    input.expectations ?? FRENCH_ENTITY_CANONICALIZATION_DEFAULT_EXPECTATIONS;
  const manifestPath = resolve(input.manifestPath);
  const manifestText = readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(manifestText) as FrenchEntityAgentBatchManifest;
  const planPath = resolve(manifest.plan.path);
  const planText = readFileSync(planPath, "utf8");
  const plan = JSON.parse(planText) as FrenchEntityCanonicalizationPlan;
  assertFrenchEntityAgentBatchManifest(manifest, plan, expectations);
  if (
    input.expectedReleaseKey !== plan.sourceLineage.releaseKey ||
    sha256(planText) !== manifest.plan.fileDigest
  ) {
    throw new Error("french-entity-attestation-v2-base-lineage");
  }
  const baseViews = loadBaseViews({ manifestPath, manifest, plan });
  const globalThreads = new Set<string>();
  const baseReplay = replayBaseExecutions({
    manifest,
    plan,
    views: baseViews,
    resultsDirectory: input.baseResultsDirectory,
    globalThreads
  });
  const unitById = new Map(plan.reviewUnits.map((unit) => [unit.unitId, unit]));
  const effective = buildBaseEffectiveState(plan, baseReplay);
  const effectiveInputHashes = new Map(baseReplay.inputHashesByUnit);
  const effectiveRoundUnits = new Map<
    string,
    FrenchEntityRemediationRoundPlanUnit
  >();
  const baseEffectiveDigest = effectiveDigest(plan, effective);
  const baseCounts = {
    batches: manifest.batches.length,
    runs: baseReplay.runs.length,
    receipts: baseReplay.receiptCount,
    reviewUnits: plan.reviewUnits.length,
    uniqueThreads: baseReplay.threads.size
  };
  assertBaseCounts(baseCounts);
  if (
    plan.reviewUnits.length ===
      FRENCH_ENTITY_PRODUCTION_BASE_EXECUTION_COUNTS.reviewUnits &&
    canonicalFrenchEntityJson(baseCounts) !==
      canonicalFrenchEntityJson(FRENCH_ENTITY_PRODUCTION_BASE_EXECUTION_COUNTS)
  ) {
    throw new Error("french-entity-attestation-v2-production-base-counts");
  }

  const roundBundles: FrenchEntityRemediationRoundBundle[] = [];
  const roundSummaries: FrenchEntityRemediationExecutionSummary[] = [];
  const remediatedUnits = new Set<string>();
  let index: FrenchEntityRemediationIndex | null = null;
  let indexPath: string | null = null;
  let indexText: string | null = null;
  if (input.remediationIndexPath) {
    indexPath = resolve(input.remediationIndexPath);
    indexText = readFileSync(indexPath, "utf8");
    index = JSON.parse(indexText) as FrenchEntityRemediationIndex;
    assertRemediationIndex(index, {
      releaseKey: plan.sourceLineage.releaseKey,
      releaseSnapshotFingerprint: plan.sourceLineage.releaseSnapshotFingerprint,
      canonicalPlanHash: plan.planHash,
      baseManifestHash: manifest.manifestHash
    });
  }
  const roundRefs = index?.rounds ?? [];
  let parentEffectiveDigest = baseEffectiveDigest;
  let previousRoundHash: string | null = null;
  for (let offset = 0; offset < roundRefs.length; offset += 1) {
    const ref = roundRefs[offset];
    const round = offset + 1;
    if (!ref || ref.round !== round) {
      throw new Error(`french-entity-attestation-v2-round-order:${round}`);
    }
    const roundPlanText = readRef(ref.plan);
    const roundPlan = JSON.parse(
      roundPlanText
    ) as FrenchEntityRemediationRoundPlan;
    const executionManifestText = readRef(ref.executionManifest);
    const executionManifest = JSON.parse(
      executionManifestText
    ) as FrenchEntityRemediationExecutionManifest;
    const storedResultText = readRef(ref.result);
    const storedResult = JSON.parse(
      storedResultText
    ) as FrenchEntityRemediationRoundResult;
    if (
      roundPlan.planHash !== ref.plan.contentHash ||
      executionManifest.manifestHash !== ref.executionManifest.contentHash ||
      storedResult.roundHash !== ref.result.contentHash ||
      roundPlan.parentRoundHash !== previousRoundHash
    ) {
      throw new Error(`french-entity-attestation-v2-round-ref:${round}`);
    }
    assertExecutionManifest(executionManifest, {
      plan,
      baseManifest: manifest,
      roundPlan
    });
    const replay = replayRoundExecutions({
      canonicalPlan: plan,
      canonicalPlanText: planText,
      baseManifest: manifest,
      baseManifestText: manifestText,
      executionManifest,
      executionManifestText,
      roundPlan,
      roundPlanText,
      resultsDirectory: ref.resultsDirectory,
      globalThreads
    });
    const rebuiltResult = finalizeFrenchEntityRemediationRound({
      plan: roundPlan,
      artifacts: replay.artifacts
    });
    if (
      canonicalFrenchEntityJson(rebuiltResult) !==
      canonicalFrenchEntityJson(storedResult)
    ) {
      throw new Error(`french-entity-attestation-v2-round-result:${round}`);
    }
    const roundUnitById = new Map(
      roundPlan.units.map((roundUnit) => [roundUnit.unitId, roundUnit] as const)
    );
    for (const result of rebuiltResult.unitResults) {
      const prior = requiredMap(effective, result.unitId);
      const unit = requiredMap(unitById, result.unitId);
      const bindings = requiredMap(replay.bindings, result.unitId);
      effective.set(
        result.unitId,
        buildEffectiveUnit({
          unitId: result.unitId,
          sourceUnitHash: unit.unitHash,
          sourceRound: round,
          quartet: result.quartet,
          auditorBinding: requiredMap(bindings, "auditor"),
          parent: prior,
          resultHash: result.resultHash
        })
      );
      effectiveInputHashes.set(
        result.unitId,
        requiredMap(replay.inputHashesByUnit, result.unitId)
      );
      effectiveRoundUnits.set(
        result.unitId,
        requiredMap(roundUnitById, result.unitId)
      );
      remediatedUnits.add(result.unitId);
    }
    const resultingEffectiveDigest = effectiveDigest(plan, effective);
    const summary = finalizeRoundSummary({
      releaseKey: plan.sourceLineage.releaseKey,
      roundPlan,
      executionManifest,
      result: rebuiltResult,
      replay,
      parentEffectiveDigest,
      resultingEffectiveDigest
    });
    roundBundles.push({ plan: roundPlan, result: rebuiltResult });
    roundSummaries.push(summary);
    parentEffectiveDigest = resultingEffectiveDigest;
    previousRoundHash = rebuiltResult.roundHash;
  }

  const remediationOverlay = buildFrenchEntityRemediationOverlay({
    baseArtifacts: baseReplay.artifacts,
    baseViews,
    rounds: roundBundles
  });
  for (const [unitId, quartet] of remediationOverlay.artifacts) {
    if (
      frenchEntityAgentQuartetHash(quartet) !==
      requiredMap(effective, unitId).quartetHash
    ) {
      throw new Error(
        `french-entity-attestation-v2-overlay-artifact:${unitId}`
      );
    }
  }
  const overlay = finalizeFinalOverlay({
    plan,
    manifest,
    roundHashes: remediationOverlay.roundHashes,
    effective
  });
  const overlayText = `${canonicalFrenchEntityJson(overlay)}\n`;
  const validateEffectiveUnitArtifacts: FrenchEntityAgentUnitArtifactValidator =
    ({ unitId, artifacts, expectedInputHashes }) => {
      const roundUnit = effectiveRoundUnits.get(unitId);
      if (roundUnit) {
        assertFrenchEntityRemediationRoundUnitArtifacts(roundUnit, artifacts);
        return;
      }
      assertFrenchEntityAgentUnitArtifacts({
        plan,
        manifest,
        unitId,
        artifacts,
        ...(expectedInputHashes ? { expectedInputHashes } : {})
      });
    };
  const terminalMerged = mergeFrenchEntityAgentArtifactsTerminal({
    plan,
    manifest,
    artifacts: remediationOverlay.artifacts,
    expectedInputHashesByUnit: effectiveInputHashes,
    validateUnitArtifacts: validateEffectiveUnitArtifacts,
    expectations
  });
  const merged =
    terminalMerged.quarantinedUnitIds.length === 0
      ? mergeFrenchEntityAgentArtifacts({
          plan,
          manifest,
          artifacts: remediationOverlay.artifacts,
          expectedInputHashesByUnit: effectiveInputHashes,
          validateUnitArtifacts: validateEffectiveUnitArtifacts,
          expectations
        })
      : terminalMerged;
  const canonicalEntitiesText = `${merged.canonicalEntities
    .map((record) => canonicalFrenchEntityJson(record))
    .join("\n")}\n`;
  const canonicalEntryPoliciesText = `${merged.entryPolicies
    .map((record) => canonicalFrenchEntityJson(record))
    .join("\n")}\n`;
  const quarantineRecords = finalizeTerminalQuarantineRecords({
    plan,
    effective,
    artifacts: remediationOverlay.artifacts,
    quarantinedUnitIds: terminalMerged.quarantinedUnitIds
  });
  const quarantineText = quarantineRecords.length
    ? `${quarantineRecords
        .map((record) => canonicalFrenchEntityJson(record))
        .join("\n")}\n`
    : "";
  const remediationCounts = {
    rounds: roundSummaries.length,
    batches: roundSummaries.reduce(
      (sum, summary) => sum + summary.counts.batches,
      0
    ),
    unitAttempts: roundSummaries.reduce(
      (sum, summary) => sum + summary.counts.units,
      0
    ),
    distinctUnits: remediatedUnits.size,
    runs: roundSummaries.reduce((sum, summary) => sum + summary.counts.runs, 0),
    receipts: roundSummaries.reduce(
      (sum, summary) => sum + summary.counts.receipts,
      0
    ),
    uniqueThreads: roundSummaries.reduce(
      (sum, summary) => sum + summary.counts.uniqueThreads,
      0
    )
  };
  const finalVerdicts = countVerdicts([...effective.values()]);
  const counts: FrenchEntityMergeAttestationV2Counts = {
    base: baseCounts,
    remediation: remediationCounts,
    total: {
      runs: baseCounts.runs + remediationCounts.runs,
      receipts: baseCounts.receipts + remediationCounts.receipts,
      uniqueThreads: globalThreads.size
    },
    final: {
      reviewUnits: effective.size,
      fromBase: overlay.counts.fromBase,
      fromRemediation: overlay.counts.fromRemediation,
      safe: finalVerdicts.safe,
      hold: finalVerdicts.hold,
      block: finalVerdicts.block
    }
  };
  assertAdditiveCounts(counts);
  const canonicalEntitiesPath = resolve(input.canonicalEntitiesPath);
  const canonicalEntryPoliciesPath = resolve(input.canonicalEntryPoliciesPath);
  const quarantinePath = resolve(
    input.quarantinePath ??
      join(dirname(canonicalEntryPoliciesPath), "entity-quarantine.jsonl")
  );
  const finalOverlayPath = resolve(input.finalOverlayPath);
  const withoutHash = {
    schemaVersion: FRENCH_ENTITY_MERGE_ATTESTATION_V2_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_MERGE_ATTESTATION_V2_POLICY_VERSION,
    releaseKey: plan.sourceLineage.releaseKey,
    releaseSnapshotFingerprint: plan.sourceLineage.releaseSnapshotFingerprint,
    plan: {
      path: planPath,
      fileSha256: sha256(planText),
      planHash: plan.planHash
    },
    batchManifest: {
      path: manifestPath,
      fileSha256: sha256(manifestText),
      manifestHash: manifest.manifestHash
    },
    manifestHash: manifest.manifestHash,
    base: {
      resultsDirectory: resolve(input.baseResultsDirectory),
      counts: baseCounts,
      runs: baseReplay.runs,
      runsDigest: hashFrenchEntityJson(baseReplay.runs),
      viewsDigest: baseViewsDigest(plan, baseViews),
      effectiveDigest: baseEffectiveDigest
    },
    remediation: {
      index:
        index && indexPath && indexText
          ? {
              path: indexPath,
              fileSha256: sha256(indexText),
              indexHash: index.indexHash
            }
          : null,
      rounds: roundSummaries,
      roundsDigest: hashFrenchEntityJson(roundSummaries)
    },
    finalOverlay: {
      path: finalOverlayPath,
      sha256: sha256(overlayText),
      records: overlay.entries.length,
      overlayHash: overlay.overlayHash,
      effectiveDigest: parentEffectiveDigest
    },
    counts,
    outputs: {
      canonicalEntities: {
        path: canonicalEntitiesPath,
        sha256: sha256(canonicalEntitiesText),
        records: merged.canonicalEntities.length
      },
      canonicalEntryPolicies: {
        path: canonicalEntryPoliciesPath,
        sha256: sha256(canonicalEntryPoliciesText),
        records: merged.entryPolicies.length
      },
      quarantine: {
        path: quarantinePath,
        sha256: sha256(quarantineText),
        records: quarantineRecords.length
      }
    },
    mergeHash: merged.mergeHash,
    gateHash: merged.gate.gateHash
  };
  const attestation: FrenchEntityMergeAttestationV2 = {
    ...withoutHash,
    attestationHash: hashFrenchEntityJson(withoutHash)
  };
  assertFrenchEntityMergeAttestationV2Shape(attestation);
  return {
    plan,
    manifest,
    merged,
    overlay,
    overlayText,
    canonicalEntitiesText,
    canonicalEntryPoliciesText,
    quarantineText,
    attestation
  };
}

export function assertFrenchEntityMergeAttestationV2FromFiles(input: {
  attestationPath: string;
  manifestPath: string;
  baseResultsDirectory: string;
  canonicalEntitiesPath: string;
  canonicalEntryPoliciesPath: string;
  quarantinePath?: string;
  finalOverlayPath?: string;
  expectedReleaseKey?: string;
  expectations?: FrenchEntityCanonicalizationExpectations;
}): FrenchEntityMergeAttestationV2Replay {
  const attestationPath = resolve(input.attestationPath);
  const attestation = JSON.parse(
    readFileSync(attestationPath, "utf8")
  ) as FrenchEntityMergeAttestationV2;
  assertFrenchEntityMergeAttestationV2Shape(attestation);
  const prepared = prepareFrenchEntityMergeAttestationV2({
    manifestPath: input.manifestPath,
    baseResultsDirectory: input.baseResultsDirectory,
    remediationIndexPath: attestation.remediation.index?.path ?? null,
    canonicalEntitiesPath: input.canonicalEntitiesPath,
    canonicalEntryPoliciesPath: input.canonicalEntryPoliciesPath,
    quarantinePath:
      input.quarantinePath ?? attestation.outputs.quarantine.path,
    finalOverlayPath: input.finalOverlayPath ?? attestation.finalOverlay.path,
    expectedReleaseKey: input.expectedReleaseKey ?? attestation.releaseKey,
    ...(input.expectations ? { expectations: input.expectations } : {})
  });
  if (
    canonicalFrenchEntityJson(prepared.attestation) !==
    canonicalFrenchEntityJson(attestation)
  ) {
    throw new Error("french-entity-attestation-v2-replay-mismatch");
  }
  assertExactFile(input.canonicalEntitiesPath, prepared.canonicalEntitiesText);
  assertExactFile(
    input.canonicalEntryPoliciesPath,
    prepared.canonicalEntryPoliciesText
  );
  assertExactFile(
    input.quarantinePath ?? attestation.outputs.quarantine.path,
    prepared.quarantineText
  );
  assertExactFile(
    input.finalOverlayPath ?? attestation.finalOverlay.path,
    prepared.overlayText
  );
  return {
    attestation,
    plan: prepared.plan,
    manifest: prepared.manifest,
    merged: prepared.merged,
    overlay: prepared.overlay
  };
}

export function assertFrenchEntityMergeAttestationV2Shape(
  attestation: FrenchEntityMergeAttestationV2
): void {
  const { attestationHash, ...content } = attestation;
  if (
    attestation.schemaVersion !==
      FRENCH_ENTITY_MERGE_ATTESTATION_V2_SCHEMA_VERSION ||
    attestation.policyVersion !==
      FRENCH_ENTITY_MERGE_ATTESTATION_V2_POLICY_VERSION ||
    attestation.manifestHash !== attestation.batchManifest.manifestHash ||
    attestation.base.runsDigest !==
      hashFrenchEntityJson(attestation.base.runs) ||
    attestation.remediation.roundsDigest !==
      hashFrenchEntityJson(attestation.remediation.rounds) ||
    hashFrenchEntityJson(content) !== attestationHash
  ) {
    throw new Error("french-entity-attestation-v2-invalid");
  }
  assertBaseCounts(attestation.counts.base);
  if (
    attestation.counts.base.reviewUnits ===
      FRENCH_ENTITY_PRODUCTION_BASE_EXECUTION_COUNTS.reviewUnits &&
    canonicalFrenchEntityJson(attestation.counts.base) !==
      canonicalFrenchEntityJson(FRENCH_ENTITY_PRODUCTION_BASE_EXECUTION_COUNTS)
  ) {
    throw new Error("french-entity-attestation-v2-production-base-counts");
  }
  assertAdditiveCounts(attestation.counts);
  if (
    canonicalFrenchEntityJson(attestation.base.counts) !==
      canonicalFrenchEntityJson(attestation.counts.base) ||
    attestation.finalOverlay.records !== attestation.counts.final.reviewUnits ||
    attestation.counts.final.safe +
        attestation.counts.final.hold +
        attestation.counts.final.block !==
      attestation.counts.final.reviewUnits ||
    attestation.outputs.quarantine.records <
      attestation.counts.final.hold + attestation.counts.final.block ||
    ((attestation.counts.final.hold > 0 ||
      attestation.counts.final.block > 0) &&
      attestation.remediation.rounds.length !== 3) ||
    attestation.remediation.rounds.length !==
      attestation.counts.remediation.rounds
  ) {
    throw new Error("french-entity-attestation-v2-counts");
  }
  assertRunLedgerCounts(
    attestation.base.runs,
    attestation.counts.base.batches,
    attestation.counts.base.runs,
    attestation.counts.base.receipts,
    attestation.counts.base.uniqueThreads,
    "base"
  );
  let previousRoundHash: string | null = null;
  let previousEffectiveDigest = attestation.base.effectiveDigest;
  for (
    let offset = 0;
    offset < attestation.remediation.rounds.length;
    offset += 1
  ) {
    const summary = attestation.remediation.rounds[offset];
    if (!summary || summary.round !== offset + 1) {
      throw new Error("french-entity-attestation-v2-round-order");
    }
    const { summaryHash, ...summaryContent } = summary;
    assertRoundCounts(summary.counts);
    assertRunLedgerCounts(
      summary.runs,
      summary.counts.batches,
      summary.counts.runs,
      summary.counts.receipts,
      summary.counts.uniqueThreads,
      `round-${summary.round}`
    );
    if (
      summary.runsDigest !== hashFrenchEntityJson(summary.runs) ||
      hashFrenchEntityJson(summaryContent) !== summaryHash ||
      summary.parentRoundHash !== previousRoundHash ||
      summary.parentEffectiveDigest !== previousEffectiveDigest
    ) {
      throw new Error(
        `french-entity-attestation-v2-round-summary:${summary.round}`
      );
    }
    previousRoundHash = summary.roundHash;
    previousEffectiveDigest = summary.resultingEffectiveDigest;
  }
  const derivedRemediation = {
    rounds: attestation.remediation.rounds.length,
    batches: attestation.remediation.rounds.reduce(
      (sum, summary) => sum + summary.counts.batches,
      0
    ),
    unitAttempts: attestation.remediation.rounds.reduce(
      (sum, summary) => sum + summary.counts.units,
      0
    ),
    runs: attestation.remediation.rounds.reduce(
      (sum, summary) => sum + summary.counts.runs,
      0
    ),
    receipts: attestation.remediation.rounds.reduce(
      (sum, summary) => sum + summary.counts.receipts,
      0
    ),
    uniqueThreads: attestation.remediation.rounds.reduce(
      (sum, summary) => sum + summary.counts.uniqueThreads,
      0
    )
  };
  if (
    attestation.finalOverlay.effectiveDigest !== previousEffectiveDigest ||
    attestation.counts.remediation.rounds !== derivedRemediation.rounds ||
    attestation.counts.remediation.batches !== derivedRemediation.batches ||
    attestation.counts.remediation.unitAttempts !==
      derivedRemediation.unitAttempts ||
    attestation.counts.remediation.runs !== derivedRemediation.runs ||
    attestation.counts.remediation.receipts !== derivedRemediation.receipts ||
    attestation.counts.remediation.uniqueThreads !==
      derivedRemediation.uniqueThreads
  ) {
    throw new Error("french-entity-attestation-v2-effective-chain");
  }
  const hashes = [
    attestation.releaseSnapshotFingerprint,
    attestation.plan.fileSha256,
    attestation.plan.planHash,
    attestation.batchManifest.fileSha256,
    attestation.batchManifest.manifestHash,
    attestation.base.runsDigest,
    attestation.base.viewsDigest,
    attestation.base.effectiveDigest,
    attestation.remediation.roundsDigest,
    attestation.finalOverlay.sha256,
    attestation.finalOverlay.overlayHash,
    attestation.finalOverlay.effectiveDigest,
    attestation.outputs.canonicalEntities.sha256,
    attestation.outputs.canonicalEntryPolicies.sha256,
    attestation.outputs.quarantine.sha256,
    attestation.mergeHash,
    attestation.gateHash,
    attestation.attestationHash,
    ...(attestation.remediation.index
      ? [
          attestation.remediation.index.fileSha256,
          attestation.remediation.index.indexHash
        ]
      : []),
    ...attestation.base.runs.flatMap(runHashes),
    ...attestation.remediation.rounds.flatMap((summary) => [
      summary.roundPlanHash,
      summary.executionManifestHash,
      summary.roundHash,
      summary.parentEffectiveDigest,
      summary.resultingEffectiveDigest,
      summary.runsDigest,
      summary.unitResultsDigest,
      summary.summaryHash,
      ...summary.runs.flatMap(runHashes)
    ])
  ];
  if (!hashes.every(isSha256)) {
    throw new Error("french-entity-attestation-v2-hash");
  }
  const threads = [
    ...attestation.base.runs,
    ...attestation.remediation.rounds.flatMap((summary) => summary.runs)
  ].map((run) => run.threadId);
  if (
    new Set(threads).size !== threads.length ||
    threads.length !== attestation.counts.total.uniqueThreads
  ) {
    throw new Error("french-entity-attestation-v2-thread-coverage");
  }
  for (const run of [
    ...attestation.base.runs,
    ...attestation.remediation.rounds.flatMap((summary) => summary.runs)
  ]) {
    assertRunAttestationShape(run);
  }
}

function assertRunLedgerCounts(
  runs: readonly FrenchEntityMergeRunAttestationV2[],
  expectedBatches: number,
  expectedRuns: number,
  expectedReceipts: number,
  expectedThreads: number,
  label: string
): void {
  const rolesByBatch = new Map<string, Set<FrenchEntityAgentRole>>();
  for (const run of runs) {
    const roles = rolesByBatch.get(run.batchId) ?? new Set();
    if (roles.has(run.role)) {
      throw new Error(`french-entity-attestation-v2-run-duplicate:${label}`);
    }
    roles.add(run.role);
    rolesByBatch.set(run.batchId, roles);
  }
  if (
    runs.length !== expectedRuns ||
    runs.reduce((sum, run) => sum + run.receiptCount, 0) !== expectedReceipts ||
    new Set(runs.map((run) => run.threadId)).size !== expectedThreads ||
    rolesByBatch.size !== expectedBatches ||
    [...rolesByBatch.values()].some((roles) => roles.size !== ROLES.length)
  ) {
    throw new Error(`french-entity-attestation-v2-run-counts:${label}`);
  }
}

function loadBaseViews(input: {
  manifestPath: string;
  manifest: FrenchEntityAgentBatchManifest;
  plan: FrenchEntityCanonicalizationPlan;
}): Map<string, FrenchEntityRemediationBaseViews> {
  const result = new Map<string, Partial<FrenchEntityRemediationBaseViews>>();
  for (const batch of input.manifest.batches) {
    for (const role of ["proposerA", "proposerB"] as const) {
      const proof = role === "proposerA" ? batch.proposerA : batch.proposerB;
      const path = resolve(dirname(input.manifestPath), proof.relativePath);
      const text = readFileSync(path, "utf8");
      if (
        sha256(text) !== proof.sha256 ||
        Buffer.byteLength(text) !== proof.bytes
      ) {
        throw new Error(`french-entity-attestation-v2-base-view-file:${role}`);
      }
      const artifact = JSON.parse(text) as FrenchEntityAgentInputArtifact;
      assertFrenchEntityAgentInputArtifact(artifact, role, batch, input.plan);
      if (artifact.inputHash !== proof.logicalHash) {
        throw new Error(`french-entity-attestation-v2-base-view-hash:${role}`);
      }
      for (const view of artifact.views) {
        const current = result.get(view.unitId) ?? {};
        if (role === "proposerA") {
          current.proposerA = view as FrenchEntityAgentProposerAView;
        } else {
          current.proposerB = view as FrenchEntityAgentProposerBView;
        }
        result.set(view.unitId, current);
      }
    }
  }
  const complete = new Map<string, FrenchEntityRemediationBaseViews>();
  for (const unit of input.plan.reviewUnits) {
    const views = result.get(unit.unitId);
    if (!views?.proposerA || !views.proposerB) {
      throw new Error(`french-entity-attestation-v2-base-view:${unit.unitId}`);
    }
    complete.set(unit.unitId, views as FrenchEntityRemediationBaseViews);
  }
  if (complete.size !== result.size) {
    throw new Error("french-entity-attestation-v2-base-view-orphan");
  }
  return complete;
}

function replayBaseExecutions(input: {
  manifest: FrenchEntityAgentBatchManifest;
  plan: FrenchEntityCanonicalizationPlan;
  views: ReadonlyMap<string, FrenchEntityRemediationBaseViews>;
  resultsDirectory: string;
  globalThreads: Set<string>;
}): ExecutionReplay {
  return replayExecutions({
    batches: input.manifest.batches,
    plan: input.plan,
    manifest: input.manifest,
    resultsDirectory: input.resultsDirectory,
    globalThreads: input.globalThreads,
    expectedManifestHash: input.manifest.manifestHash,
    expectedReleaseKey: input.plan.sourceLineage.releaseKey,
    expectedReleaseSnapshotFingerprint:
      input.plan.sourceLineage.releaseSnapshotFingerprint,
    validateRun: (run, batch) =>
      run.batchHash === batch.batchHash && run.planHash === input.plan.planHash,
    expectedUnitInputHash: (unitId, role, artifactsByUnit) =>
      expectedBaseUnitInputHash(
        requiredMap(input.views, unitId),
        unitId,
        role,
        artifactsByUnit.get(unitId)
      ),
    validateReceipt: () => true
  });
}

function replayRoundExecutions(input: {
  canonicalPlan: FrenchEntityCanonicalizationPlan;
  canonicalPlanText: string;
  baseManifest: FrenchEntityAgentBatchManifest;
  baseManifestText: string;
  executionManifest: FrenchEntityRemediationExecutionManifest;
  executionManifestText: string;
  roundPlan: FrenchEntityRemediationRoundPlan;
  roundPlanText: string;
  resultsDirectory: string;
  globalThreads: Set<string>;
}): ExecutionReplay {
  const unitById = new Map(
    input.roundPlan.units.map((unit) => [unit.unitId, unit])
  );
  const replay = replayExecutions({
    batches: input.executionManifest.batches,
    plan: input.canonicalPlan,
    manifest: input.baseManifest,
    resultsDirectory: input.resultsDirectory,
    globalThreads: input.globalThreads,
    expectedManifestHash: input.executionManifest.manifestHash,
    expectedReleaseKey: input.executionManifest.releaseKey,
    expectedReleaseSnapshotFingerprint:
      input.executionManifest.releaseSnapshotFingerprint,
    validateRun: (run, batch, role, artifactsByUnit) => {
      if (!batch.sourceBatchHash || !batch.selectionHash) return false;
      const unitInputHashes = batch.unitIds.map((unitId) => ({
        unitId,
        inputHash: expectedRoundUnitInputHash(
          requiredMap(unitById, unitId),
          role,
          artifactsByUnit.get(unitId)
        )
      }));
      return (
        run.batchHash === batch.batchHash &&
        run.planHash === input.canonicalPlan.planHash &&
        run.inputHash ===
          frenchEntityRemediationRoleBatchInputHash({
            round: input.roundPlan.round,
            roundPlanHash: input.roundPlan.planHash,
            batchId: batch.batchId,
            sourceBatchHash: batch.sourceBatchHash,
            selectionHash: batch.selectionHash,
            role,
            unitInputHashes
          }) &&
        run.sourceHashes.manifest === sha256(input.executionManifestText) &&
        run.sourceHashes.plan === sha256(input.canonicalPlanText) &&
        run.sourceHashes.roundPlan === sha256(input.roundPlanText) &&
        run.sourceHashes.baseManifest === sha256(input.baseManifestText)
      );
    },
    expectedUnitInputHash: (unitId, role, artifactsByUnit) =>
      expectedRoundUnitInputHash(
        requiredMap(unitById, unitId),
        role,
        artifactsByUnit.get(unitId)
      ),
    validateReceipt: (receipt, run) =>
      ["manifest", "plan", "roundPlan", "baseManifest"].every(
        (key) =>
          typeof receipt.sourcePaths[key] === "string" &&
          receipt.sourceHashes[key] === run.sourceHashes[key]
      ),
    validateUnitArtifacts: ({ unitId, artifacts }) =>
      assertFrenchEntityRemediationRoundUnitArtifacts(
        requiredMap(unitById, unitId),
        artifacts
      )
  });
  return replay;
}

function replayExecutions(input: {
  batches: readonly {
    batchId: string;
    unitIds: string[];
    batchHash: string;
    sourceBatchHash?: string;
    selectionHash?: string;
  }[];
  plan: FrenchEntityCanonicalizationPlan;
  manifest: FrenchEntityAgentBatchManifest;
  resultsDirectory: string;
  globalThreads: Set<string>;
  expectedManifestHash: string;
  expectedReleaseKey: string;
  expectedReleaseSnapshotFingerprint: string;
  validateRun(
    run: FrenchEntityAgentRun,
    batch: {
      batchId: string;
      unitIds: string[];
      batchHash: string;
      sourceBatchHash?: string;
      selectionHash?: string;
    },
    role: FrenchEntityAgentRole,
    artifactsByUnit: ReadonlyMap<
      string,
      Partial<FrenchEntityAgentUnitArtifacts>
    >
  ): boolean;
  expectedUnitInputHash(
    unitId: string,
    role: FrenchEntityAgentRole,
    artifactsByUnit: ReadonlyMap<
      string,
      Partial<FrenchEntityAgentUnitArtifacts>
    >
  ): string;
  validateReceipt(
    receipt: FrenchCodexExecutionReceipt<FrenchEntityAgentRole>,
    run: FrenchEntityAgentRun
  ): boolean;
  validateUnitArtifacts?: FrenchEntityAgentUnitArtifactValidator;
}): ExecutionReplay {
  const resultsDirectory = resolve(input.resultsDirectory);
  const artifactsByUnit = new Map<
    string,
    Partial<FrenchEntityAgentUnitArtifacts>
  >();
  const bindings = new Map<
    string,
    Map<FrenchEntityAgentRole, FrenchEntityUnitExecutionBindingV2>
  >();
  const runs: FrenchEntityMergeRunAttestationV2[] = [];
  let receiptCount = 0;
  const localThreads = new Set<string>();
  const unitById = new Map(
    input.plan.reviewUnits.map((unit) => [unit.unitId, unit])
  );
  for (const batch of input.batches) {
    for (const role of ROLES) {
      const directory = resolve(resultsDirectory, role, batch.batchId);
      const runPath = join(directory, "run.json");
      const artifactsPath = join(directory, "artifacts.jsonl");
      const receiptsPath = join(directory, "execution-receipts.jsonl");
      for (const path of [runPath, artifactsPath, receiptsPath]) {
        if (!existsSync(path)) {
          throw new Error(
            `french-entity-attestation-v2-missing-result:${path}`
          );
        }
      }
      const run = JSON.parse(
        readFileSync(runPath, "utf8")
      ) as FrenchEntityAgentRun;
      assertFrenchEntityAgentRun(run);
      if (
        run.role !== role ||
        run.batchId !== batch.batchId ||
        run.manifestHash !== input.expectedManifestHash ||
        run.releaseKey !== input.expectedReleaseKey ||
        run.releaseSnapshotFingerprint !==
          input.expectedReleaseSnapshotFingerprint ||
        input.globalThreads.has(run.threadId) ||
        !input.validateRun(run, batch, role, artifactsByUnit)
      ) {
        throw new Error(
          `french-entity-attestation-v2-run-lineage:${role}:${batch.batchId}`
        );
      }
      input.globalThreads.add(run.threadId);
      localThreads.add(run.threadId);
      assertFrenchEntityAgentResultDirectory({
        directory,
        run,
        expectedUnitIds: batch.unitIds,
        role
      });
      const artifacts = readJsonl<
        | FrenchEntityAgentProposal
        | FrenchEntityAgentArbitration
        | FrenchEntityAgentAudit
      >(artifactsPath);
      const receipts =
        readJsonl<FrenchCodexExecutionReceipt<FrenchEntityAgentRole>>(
          receiptsPath
        );
      if (
        artifacts.length !== batch.unitIds.length ||
        receipts.length !== batch.unitIds.length
      ) {
        throw new Error(
          `french-entity-attestation-v2-result-coverage:${role}:${batch.batchId}`
        );
      }
      const artifactByUnit = uniqueMap(artifacts, (value) => value.unitId);
      const receiptByUnit = uniqueMap(receipts, (value) => value.entryKey);
      const unitBindings = batch.unitIds.map((unitId) => {
        const artifact = requiredMap(artifactByUnit, unitId);
        const receipt = requiredMap(receiptByUnit, unitId);
        const unit = requiredMap(unitById, unitId);
        assertFrenchCodexExecutionReceipt(receipt, { expectedRole: role });
        const hash = artifactHash(artifact);
        const expectedInputHash = input.expectedUnitInputHash(
          unitId,
          role,
          artifactsByUnit
        );
        if (
          receipt.artifactHash !== hash ||
          receipt.selectionHash !== unit.unitHash ||
          receipt.runHash !== run.runHash ||
          receipt.threadId !== run.threadId ||
          receipt.manifestHash !== input.expectedManifestHash ||
          run.unitArtifactHashes[unitId] !== hash ||
          receipt.inputHash !== expectedInputHash ||
          !input.validateReceipt(receipt, run)
        ) {
          throw new Error(
            `french-entity-attestation-v2-binding:${role}:${unitId}`
          );
        }
        const current = artifactsByUnit.get(unitId) ?? {};
        if (role === "proposerA")
          current.proposalA = artifact as FrenchEntityAgentProposal;
        else if (role === "proposerB")
          current.proposalB = artifact as FrenchEntityAgentProposal;
        else if (role === "arbiter")
          current.arbitration = artifact as FrenchEntityAgentArbitration;
        else current.audit = artifact as FrenchEntityAgentAudit;
        artifactsByUnit.set(unitId, current);
        const roleBindings = bindings.get(unitId) ?? new Map();
        roleBindings.set(role, {
          role,
          batchId: batch.batchId,
          runHash: run.runHash,
          receiptHash: receipt.receiptHash,
          artifactHash: hash,
          threadId: run.threadId
        });
        bindings.set(unitId, roleBindings);
        return {
          unitId,
          artifactHash: hash,
          receiptHash: receipt.receiptHash,
          receiptInputHash: receipt.inputHash,
          receiptSelectionHash: receipt.selectionHash,
          receiptRunHash: receipt.runHash
        };
      });
      receiptCount += receipts.length;
      const withoutHash = {
        role,
        batchId: batch.batchId,
        threadId: run.threadId,
        runHash: run.runHash,
        relativeDirectory: normalizeRelativePath(
          relative(resultsDirectory, directory)
        ),
        fileHashes: {
          run: sha256File(runPath),
          artifacts: sha256File(artifactsPath),
          receipts: sha256File(receiptsPath)
        },
        unitCount: artifacts.length,
        receiptCount: receipts.length,
        unitBindingsDigest: hashFrenchEntityJson(unitBindings)
      };
      runs.push({
        ...withoutHash,
        runAttestationHash: hashFrenchEntityJson(withoutHash)
      });
    }
  }
  const artifacts = new Map<string, FrenchEntityAgentUnitArtifacts>();
  const inputHashesByUnit = new Map<string, FrenchEntityAgentUnitInputHashes>();
  for (const batch of input.batches) {
    for (const unitId of batch.unitIds) {
      const value = artifactsByUnit.get(unitId);
      if (
        !value?.proposalA ||
        !value.proposalB ||
        !value.arbitration ||
        !value.audit
      ) {
        throw new Error(
          `french-entity-attestation-v2-unit-incomplete:${unitId}`
        );
      }
      const quartet = value as FrenchEntityAgentUnitArtifacts;
      const expectedInputHashes = Object.fromEntries(
        ROLES.map((role) => [
          role,
          input.expectedUnitInputHash(unitId, role, artifactsByUnit)
        ])
      ) as unknown as FrenchEntityAgentUnitInputHashes;
      if (input.validateUnitArtifacts) {
        input.validateUnitArtifacts({
          unitId,
          artifacts: quartet,
          expectedInputHashes
        });
      } else {
        assertFrenchEntityAgentUnitArtifacts({
          plan: input.plan,
          manifest: input.manifest,
          unitId,
          artifacts: quartet,
          expectedInputHashes
        });
      }
      artifacts.set(unitId, quartet);
      inputHashesByUnit.set(unitId, expectedInputHashes);
    }
  }
  return {
    artifacts,
    inputHashesByUnit,
    bindings,
    runs,
    receiptCount,
    threads: localThreads
  };
}

function expectedBaseUnitInputHash(
  views: FrenchEntityRemediationBaseViews,
  unitId: string,
  role: FrenchEntityAgentRole,
  artifacts: Partial<FrenchEntityAgentUnitArtifacts> | undefined
): string {
  if (role === "proposerA") return views.proposerA.viewHash;
  if (role === "proposerB") return views.proposerB.viewHash;
  if (!artifacts?.proposalA || !artifacts.proposalB) {
    throw new Error(
      `french-entity-attestation-v2-base-parent:${role}:${unitId}`
    );
  }
  if (role === "arbiter") {
    return frenchEntityAgentArbiterUnitInputHash({
      unitId,
      sourceView: views.proposerB,
      proposalA: artifacts.proposalA,
      proposalB: artifacts.proposalB
    });
  }
  if (!artifacts.arbitration) {
    throw new Error(
      `french-entity-attestation-v2-base-parent:auditor:${unitId}`
    );
  }
  const selectedProposal =
    artifacts.arbitration.selectedProposal === "proposalA"
      ? artifacts.proposalA
      : artifacts.arbitration.selectedProposal === "proposalB"
        ? artifacts.proposalB
        : null;
  if (!selectedProposal) {
    throw new Error(
      `french-entity-attestation-v2-base-selection:auditor:${unitId}`
    );
  }
  return frenchEntityAgentAuditorUnitInputHash({
    unitId,
    sourceView: views.proposerB,
    arbitration: artifacts.arbitration,
    selectedProposal
  });
}

function expectedRoundUnitInputHash(
  unit: FrenchEntityRemediationRoundPlanUnit,
  role: FrenchEntityAgentRole,
  artifacts: Partial<FrenchEntityAgentUnitArtifacts> | undefined
): string {
  if (role === "proposerA") return unit.proposerA.inputHash;
  if (role === "proposerB") return unit.proposerB.inputHash;
  if (!artifacts?.proposalA || !artifacts.proposalB) {
    throw new Error(
      `french-entity-attestation-v2-round-parent:${role}:${unit.unitId}`
    );
  }
  if (role === "arbiter") {
    return frenchEntityRemediationArbiterInputHash(
      unit,
      artifacts.proposalA,
      artifacts.proposalB
    );
  }
  if (!artifacts.arbitration) {
    throw new Error(
      `french-entity-attestation-v2-round-parent:auditor:${unit.unitId}`
    );
  }
  return frenchEntityRemediationAuditorInputHash(unit, {
    proposalA: artifacts.proposalA,
    proposalB: artifacts.proposalB,
    arbitration: artifacts.arbitration
  });
}

function buildBaseEffectiveState(
  plan: FrenchEntityCanonicalizationPlan,
  replay: ExecutionReplay
): Map<string, FrenchEntityEffectiveUnitV2> {
  const result = new Map<string, FrenchEntityEffectiveUnitV2>();
  for (const unit of plan.reviewUnits) {
    const quartet = requiredMap(replay.artifacts, unit.unitId);
    const roleBindings = requiredMap(replay.bindings, unit.unitId);
    result.set(
      unit.unitId,
      buildEffectiveUnit({
        unitId: unit.unitId,
        sourceUnitHash: unit.unitHash,
        sourceRound: 0,
        quartet,
        auditorBinding: requiredMap(roleBindings, "auditor"),
        parent: null,
        resultHash: null
      })
    );
  }
  return result;
}

function buildEffectiveUnit(input: {
  unitId: string;
  sourceUnitHash: string;
  sourceRound: number;
  quartet: FrenchEntityAgentUnitArtifacts;
  auditorBinding: FrenchEntityUnitExecutionBindingV2;
  parent: FrenchEntityEffectiveUnitV2 | null;
  resultHash: string | null;
}): FrenchEntityEffectiveUnitV2 {
  if (
    input.quartet.arbitration.selectedProposal !== "proposalA" &&
    input.quartet.arbitration.selectedProposal !== "proposalB"
  ) {
    throw new Error(
      `french-entity-attestation-v2-effective-selection:${input.unitId}`
    );
  }
  const selected =
    input.quartet.arbitration.selectedProposal === "proposalA"
      ? input.quartet.proposalA
      : input.quartet.proposalB;
  const semanticProposalHash = semanticFrenchEntityProposalHash(selected);
  const core = {
    unitId: input.unitId,
    sourceUnitHash: input.sourceUnitHash,
    sourceRound: input.sourceRound,
    quartetHash: frenchEntityAgentQuartetHash(input.quartet),
    proposalAHash: input.quartet.proposalA.proposalHash,
    proposalBHash: input.quartet.proposalB.proposalHash,
    arbitrationHash: input.quartet.arbitration.arbitrationHash,
    auditHash: input.quartet.audit.auditHash,
    selectedProposalHash: selected.proposalHash,
    semanticProposalHash,
    verdict: input.quartet.audit.verdict,
    auditorRunHash: input.auditorBinding.runHash,
    auditorReceiptHash: input.auditorBinding.receiptHash,
    parentEffectiveUnitHash: input.parent?.effectiveUnitHash ?? null,
    resultHash: input.resultHash
  };
  const chainHash = hashFrenchEntityJson({
    parentChainHash: input.parent?.chainHash ?? null,
    core
  });
  const content = { ...core, chainHash };
  return { ...content, effectiveUnitHash: hashFrenchEntityJson(content) };
}

function finalizeFinalOverlay(input: {
  plan: FrenchEntityCanonicalizationPlan;
  manifest: FrenchEntityAgentBatchManifest;
  roundHashes: string[];
  effective: ReadonlyMap<string, FrenchEntityEffectiveUnitV2>;
}): FrenchEntityFinalOverlayV2 {
  const entries = input.plan.reviewUnits.map((unit) =>
    requiredMap(input.effective, unit.unitId)
  );
  const verdicts = countVerdicts(entries);
  const counts = {
    reviewUnits: entries.length,
    fromBase: entries.filter((entry) => entry.sourceRound === 0).length,
    fromRemediation: entries.filter((entry) => entry.sourceRound > 0).length,
    safe: verdicts.safe,
    hold: verdicts.hold,
    block: verdicts.block,
    quarantined: verdicts.hold + verdicts.block
  };
  const content = {
    schemaVersion: FRENCH_ENTITY_FINAL_OVERLAY_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_MERGE_ATTESTATION_V2_POLICY_VERSION,
    releaseKey: input.plan.sourceLineage.releaseKey,
    canonicalPlanHash: input.plan.planHash,
    baseManifestHash: input.manifest.manifestHash,
    roundHashes: input.roundHashes,
    entries,
    counts
  };
  return { ...content, overlayHash: hashFrenchEntityJson(content) };
}

function finalizeTerminalQuarantineRecords(input: {
  plan: FrenchEntityCanonicalizationPlan;
  effective: ReadonlyMap<string, FrenchEntityEffectiveUnitV2>;
  artifacts: ReadonlyMap<string, FrenchEntityAgentUnitArtifacts>;
  quarantinedUnitIds: readonly string[];
}): FrenchEntityTerminalQuarantineRecord[] {
  const unitById = new Map(
    input.plan.reviewUnits.map((unit) => [unit.unitId, unit] as const)
  );
  const records = [...input.quarantinedUnitIds]
    .sort(compareText)
    .map((unitId) => {
      const unit = requiredMap(unitById, unitId);
      const effective = requiredMap(input.effective, unitId);
      const audit = requiredMap(input.artifacts, unitId).audit;
      if (audit.auditHash !== effective.auditHash) {
        throw new Error(`french-entity-terminal-audit-drift:${unitId}`);
      }
      const failedCheckCodes = Object.entries(audit.checks)
        .filter(([, value]) => value === "fail")
        .map(([code]) => code)
        .sort(compareText);
      const content = {
        schemaVersion:
          "lexicon-v3-french-entity-terminal-quarantine@1" as const,
        policyVersion: FRENCH_ENTITY_MERGE_ATTESTATION_V2_POLICY_VERSION,
        unitId,
        reviewEntryKeys: [...unit.reviewEntryKeys].sort(compareText),
        entityIds: [...unit.entityIds].sort((left, right) => left - right),
        verdict: effective.verdict,
        quarantineReason:
          effective.verdict === "safe"
            ? ("depends-on-unresolved-entity" as const)
            : ("terminal-audit-non-safe" as const),
        failedCheckCodes,
        sourceRound: effective.sourceRound,
        quartetHash: effective.quartetHash,
        auditHash: effective.auditHash,
        semanticProposalHash: effective.semanticProposalHash,
        chainHash: effective.chainHash
      };
      return {
        ...content,
        contentHash: hashFrenchEntityJson(content)
      };
    });
  if (
    records.some(
      (record) =>
        record.quarantineReason === "terminal-audit-non-safe" &&
        record.failedCheckCodes.length === 0
    )
  ) {
    throw new Error("french-entity-terminal-quarantine-missing-failure");
  }
  return records;
}

function finalizeRoundSummary(input: {
  releaseKey: string;
  roundPlan: FrenchEntityRemediationRoundPlan;
  executionManifest: FrenchEntityRemediationExecutionManifest;
  result: FrenchEntityRemediationRoundResult;
  replay: ExecutionReplay;
  parentEffectiveDigest: string;
  resultingEffectiveDigest: string;
}): FrenchEntityRemediationExecutionSummary {
  const verdicts = countVerdicts(
    input.result.unitResults.map((result) => ({
      verdict: result.quartet.audit.verdict
    }))
  );
  const semanticChanged = input.result.unitResults.filter((result) => {
    const unit = input.roundPlan.units.find(
      (value) => value.unitId === result.unitId
    );
    return (
      unit && unit.previousSemanticProposalHash !== result.semanticProposalHash
    );
  }).length;
  const counts = {
    units: input.roundPlan.unitIds.length,
    batches: input.executionManifest.batches.length,
    runs: input.replay.runs.length,
    receipts: input.replay.receiptCount,
    uniqueThreads: input.replay.threads.size,
    safe: verdicts.safe,
    hold: verdicts.hold,
    block: verdicts.block,
    semanticChanged,
    semanticUnchanged: input.roundPlan.unitIds.length - semanticChanged
  };
  assertRoundCounts(counts);
  return finalizeFrenchEntityRemediationExecutionSummary({
    releaseKey: input.releaseKey,
    round: input.roundPlan.round,
    roundPlanHash: input.roundPlan.planHash,
    executionManifestHash: input.executionManifest.manifestHash,
    roundHash: input.result.roundHash,
    parentRoundHash: input.roundPlan.parentRoundHash,
    parentEffectiveDigest: input.parentEffectiveDigest,
    resultingEffectiveDigest: input.resultingEffectiveDigest,
    counts,
    runs: input.replay.runs,
    runsDigest: hashFrenchEntityJson(input.replay.runs),
    unitResultsDigest: hashFrenchEntityJson(
      input.result.unitResults.map((result) => ({
        unitId: result.unitId,
        resultHash: result.resultHash,
        semanticProposalHash: result.semanticProposalHash
      }))
    )
  });
}

function assertExecutionManifest(
  manifest: FrenchEntityRemediationExecutionManifest,
  expected: {
    plan: FrenchEntityCanonicalizationPlan;
    baseManifest: FrenchEntityAgentBatchManifest;
    roundPlan: FrenchEntityRemediationRoundPlan;
  }
): void {
  const { manifestHash, ...content } = manifest;
  const units = manifest.batches.flatMap((batch) => batch.unitIds);
  if (
    manifest.schemaVersion !==
      FRENCH_ENTITY_REMEDIATION_EXECUTION_MANIFEST_SCHEMA_VERSION ||
    manifest.policyVersion !==
      FRENCH_ENTITY_MERGE_ATTESTATION_V2_POLICY_VERSION ||
    manifest.releaseKey !== expected.plan.sourceLineage.releaseKey ||
    manifest.releaseSnapshotFingerprint !==
      expected.plan.sourceLineage.releaseSnapshotFingerprint ||
    manifest.canonicalPlanHash !== expected.plan.planHash ||
    manifest.baseManifestHash !== expected.baseManifest.manifestHash ||
    manifest.round !== expected.roundPlan.round ||
    manifest.roundPlanHash !== expected.roundPlan.planHash ||
    manifest.parentRoundHash !== expected.roundPlan.parentRoundHash ||
    manifest.counts.units !== expected.roundPlan.unitIds.length ||
    manifest.counts.batches !== manifest.batches.length ||
    canonicalFrenchEntityJson(units) !==
      canonicalFrenchEntityJson(expected.roundPlan.unitIds) ||
    new Set(units).size !== units.length ||
    hashFrenchEntityJson(content) !== manifestHash
  ) {
    throw new Error("french-entity-attestation-v2-execution-manifest");
  }
  const batchIds = new Set<string>();
  const sourceBatchById = new Map(
    expected.baseManifest.batches.map((batch) => [batch.batchId, batch])
  );
  const roundUnitById = new Map(
    expected.roundPlan.units.map((unit) => [unit.unitId, unit])
  );
  for (const batch of manifest.batches) {
    const sourceBatch = sourceBatchById.get(batch.batchId);
    const expectedBatch = finalizeFrenchEntityRemediationExecutionBatch({
      round: expected.roundPlan.round,
      roundPlanHash: expected.roundPlan.planHash,
      batchId: batch.batchId,
      sourceBatchHash: batch.sourceBatchHash,
      units: batch.unitIds.map((unitId) => {
        const unit = requiredMap(roundUnitById, unitId);
        return { unitId, planUnitHash: unit.unitHash };
      })
    });
    if (
      !batch.batchId ||
      batchIds.has(batch.batchId) ||
      batch.unitIds.length === 0 ||
      !sourceBatch ||
      batch.sourceBatchHash !== sourceBatch.batchHash ||
      canonicalFrenchEntityJson(batch) !==
        canonicalFrenchEntityJson(expectedBatch)
    ) {
      throw new Error(
        `french-entity-attestation-v2-execution-batch:${batch.batchId}`
      );
    }
    batchIds.add(batch.batchId);
  }
}

function assertRemediationIndex(
  index: FrenchEntityRemediationIndex,
  expected: Omit<
    FrenchEntityRemediationIndex,
    "schemaVersion" | "policyVersion" | "rounds" | "indexHash"
  >
): void {
  const { indexHash, ...content } = index;
  if (
    index.schemaVersion !== FRENCH_ENTITY_REMEDIATION_INDEX_SCHEMA_VERSION ||
    index.policyVersion !== FRENCH_ENTITY_MERGE_ATTESTATION_V2_POLICY_VERSION ||
    index.releaseKey !== expected.releaseKey ||
    index.releaseSnapshotFingerprint !== expected.releaseSnapshotFingerprint ||
    index.canonicalPlanHash !== expected.canonicalPlanHash ||
    index.baseManifestHash !== expected.baseManifestHash ||
    hashFrenchEntityJson(content) !== indexHash
  ) {
    throw new Error("french-entity-attestation-v2-index");
  }
  for (let offset = 0; offset < index.rounds.length; offset += 1) {
    const ref = index.rounds[offset];
    if (!ref || ref.round !== offset + 1) {
      throw new Error("french-entity-attestation-v2-index-order");
    }
    const { roundRefHash, ...refContent } = ref;
    if (
      hashFrenchEntityJson(refContent) !== roundRefHash ||
      !ref.resultsDirectory ||
      ![ref.plan, ref.executionManifest, ref.result].every(
        (value) =>
          value.path &&
          isSha256(value.fileSha256) &&
          isSha256(value.contentHash)
      )
    ) {
      throw new Error(`french-entity-attestation-v2-index-ref:${ref.round}`);
    }
  }
}

function assertBaseCounts(
  counts: FrenchEntityMergeAttestationV2Counts["base"]
): void {
  if (
    counts.batches < 1 ||
    counts.reviewUnits < 1 ||
    counts.runs !== counts.batches * ROLES.length ||
    counts.receipts !== counts.reviewUnits * ROLES.length ||
    counts.uniqueThreads !== counts.runs
  ) {
    throw new Error("french-entity-attestation-v2-base-counts");
  }
}

function assertRoundCounts(
  counts: FrenchEntityRemediationExecutionSummaryCounts
): void {
  if (
    counts.units < 1 ||
    counts.batches < 1 ||
    counts.runs !== counts.batches * ROLES.length ||
    counts.receipts !== counts.units * ROLES.length ||
    counts.uniqueThreads !== counts.runs ||
    counts.safe + counts.hold + counts.block !== counts.units ||
    counts.semanticChanged + counts.semanticUnchanged !== counts.units
  ) {
    throw new Error("french-entity-attestation-v2-round-counts");
  }
}

function assertAdditiveCounts(
  counts: FrenchEntityMergeAttestationV2Counts
): void {
  if (
    counts.total.runs !== counts.base.runs + counts.remediation.runs ||
    counts.total.receipts !==
      counts.base.receipts + counts.remediation.receipts ||
    counts.total.uniqueThreads !==
      counts.base.uniqueThreads + counts.remediation.uniqueThreads ||
    counts.remediation.runs !== counts.remediation.batches * ROLES.length ||
    counts.remediation.receipts !==
      counts.remediation.unitAttempts * ROLES.length ||
    counts.final.reviewUnits !== counts.base.reviewUnits ||
    counts.final.fromBase + counts.final.fromRemediation !==
      counts.final.reviewUnits
  ) {
    throw new Error("french-entity-attestation-v2-additive-counts");
  }
}

function effectiveDigest(
  plan: FrenchEntityCanonicalizationPlan,
  effective: ReadonlyMap<string, FrenchEntityEffectiveUnitV2>
): string {
  return hashFrenchEntityJson(
    plan.reviewUnits.map((unit) => {
      const value = requiredMap(effective, unit.unitId);
      return {
        unitId: unit.unitId,
        effectiveUnitHash: value.effectiveUnitHash
      };
    })
  );
}

function baseViewsDigest(
  plan: FrenchEntityCanonicalizationPlan,
  views: ReadonlyMap<string, FrenchEntityRemediationBaseViews>
): string {
  return hashFrenchEntityJson(
    plan.reviewUnits.map((unit) => {
      const value = requiredMap(views, unit.unitId);
      return {
        unitId: unit.unitId,
        proposerAViewHash: value.proposerA.viewHash,
        proposerBViewHash: value.proposerB.viewHash
      };
    })
  );
}

function countVerdicts(
  values: readonly { verdict: "safe" | "hold" | "block" }[]
): { safe: number; hold: number; block: number } {
  return {
    safe: values.filter((value) => value.verdict === "safe").length,
    hold: values.filter((value) => value.verdict === "hold").length,
    block: values.filter((value) => value.verdict === "block").length
  };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function readRef(ref: HashedPathRef<string>): string {
  const text = readFileSync(resolve(ref.path), "utf8");
  if (sha256(text) !== ref.fileSha256) {
    throw new Error(`french-entity-attestation-v2-ref-file:${ref.kind}`);
  }
  return text;
}

function assertExactFile(path: string, expected: string): void {
  if (readFileSync(resolve(path), "utf8") !== expected) {
    throw new Error(`french-entity-attestation-v2-output:${resolve(path)}`);
  }
}

function assertRunAttestationShape(
  run: FrenchEntityMergeRunAttestationV2
): void {
  const { runAttestationHash, ...content } = run;
  if (
    !ROLES.includes(run.role) ||
    !run.batchId ||
    !run.threadId ||
    !run.relativeDirectory ||
    run.unitCount < 1 ||
    run.receiptCount !== run.unitCount ||
    hashFrenchEntityJson(content) !== runAttestationHash
  ) {
    throw new Error("french-entity-attestation-v2-run");
  }
}

function runHashes(run: FrenchEntityMergeRunAttestationV2): string[] {
  return [
    run.runHash,
    run.fileHashes.run,
    run.fileHashes.artifacts,
    run.fileHashes.receipts,
    run.unitBindingsDigest,
    run.runAttestationHash
  ];
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

function readJsonl<T>(path: string): T[] {
  return readFileSync(path, "utf8")
    .split(/\r?\n/u)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as T);
}

function uniqueMap<T, K>(
  values: readonly T[],
  keyOf: (value: T) => K
): Map<K, T> {
  const result = new Map<K, T>();
  for (const value of values) {
    const key = keyOf(value);
    if (result.has(key))
      throw new Error(`french-entity-attestation-v2-duplicate:${String(key)}`);
    result.set(key, value);
  }
  return result;
}

function requiredMap<K, V>(map: ReadonlyMap<K, V>, key: K): V {
  const value = map.get(key);
  if (value === undefined) {
    throw new Error(`french-entity-attestation-v2-missing:${String(key)}`);
  }
  return value;
}

function normalizeRelativePath(value: string): string {
  return value.split("\\").join("/");
}

function sha256File(path: string): string {
  return sha256(readFileSync(path));
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && SHA256_PATTERN.test(value);
}
