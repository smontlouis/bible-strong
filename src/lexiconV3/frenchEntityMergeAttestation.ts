import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import {
  assertFrenchCodexExecutionReceipt,
  type FrenchCodexExecutionReceipt
} from "./frenchCodexExecutionReceipt.js";
import {
  assertFrenchEntityAgentBatchManifest,
  mergeFrenchEntityAgentArtifacts,
  type FrenchEntityAgentArbitration,
  type FrenchEntityAgentAudit,
  type FrenchEntityAgentBatchManifest,
  type FrenchEntityAgentMergeResult,
  type FrenchEntityAgentTerminalMergeResult,
  type FrenchEntityAgentProposal,
  type FrenchEntityAgentRole,
  type FrenchEntityAgentUnitArtifacts
} from "./frenchEntityAgentReview.js";
import {
  canonicalFrenchEntityJson,
  FRENCH_ENTITY_CANONICALIZATION_DEFAULT_EXPECTATIONS,
  hashFrenchEntityJson,
  type FrenchEntityCanonicalizationExpectations,
  type FrenchEntityCanonicalizationPlan
} from "./frenchEntityCanonicalization.js";
import {
  assertFrenchEntityAgentResultDirectory,
  assertFrenchEntityAgentRun,
  type FrenchEntityAgentRun
} from "../../scripts/runLexiconV3FrenchEntityAgents.js";
import {
  assertFrenchEntityMergeAttestationV2FromFiles,
  assertFrenchEntityMergeAttestationV2Shape,
  FRENCH_ENTITY_MERGE_ATTESTATION_V2_SCHEMA_VERSION,
  type FrenchEntityMergeAttestationV2
} from "./frenchEntityMergeAttestationV2.js";

export const FRENCH_ENTITY_MERGE_ATTESTATION_SCHEMA_VERSION =
  "lexicon-v3-french-entity-merge-attestation@1" as const;
export const FRENCH_ENTITY_MERGE_ATTESTATION_POLICY_VERSION =
  "lexicon-v3-french-entity-merge-attestation-policy@1" as const;

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const ROLES = ["proposerA", "proposerB", "arbiter", "auditor"] as const;

export interface FrenchEntityMergeRunAttestation {
  role: FrenchEntityAgentRole;
  batchId: string;
  threadId: string;
  runHash: string;
  relativeDirectory: string;
  fileHashes: {
    run: string;
    artifacts: string;
    receipts: string;
  };
  unitCount: number;
  receiptCount: number;
  unitBindingsDigest: string;
  runAttestationHash: string;
}

export interface FrenchEntityMergeAttestation {
  schemaVersion: typeof FRENCH_ENTITY_MERGE_ATTESTATION_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_ENTITY_MERGE_ATTESTATION_POLICY_VERSION;
  releaseKey: string;
  releaseSnapshotFingerprint: string;
  plan: {
    path: string;
    fileSha256: string;
    planHash: string;
  };
  batchManifest: {
    path: string;
    fileSha256: string;
    manifestHash: string;
  };
  manifestHash: string;
  resultsDirectory: string;
  counts: {
    batches: number;
    runs: number;
    receipts: number;
    reviewUnits: number;
    uniqueThreads: number;
  };
  runs: FrenchEntityMergeRunAttestation[];
  runsDigest: string;
  outputs: {
    canonicalEntities: {
      path: string;
      sha256: string;
      records: number;
    };
    canonicalEntryPolicies: {
      path: string;
      sha256: string;
      records: number;
    };
  };
  mergeHash: string;
  gateHash: string;
  attestationHash: string;
}

export type FrenchEntityMergeAttestationArtifact =
  | FrenchEntityMergeAttestation
  | FrenchEntityMergeAttestationV2;

export interface FrenchEntityAgentResultsReplay {
  artifacts: Map<string, FrenchEntityAgentUnitArtifacts>;
  runs: FrenchEntityMergeRunAttestation[];
  counts: FrenchEntityMergeAttestation["counts"];
  runsDigest: string;
}

export interface FrenchEntityMergeAttestationReplay {
  attestation: FrenchEntityMergeAttestationArtifact;
  plan: FrenchEntityCanonicalizationPlan;
  manifest: FrenchEntityAgentBatchManifest;
  merged: FrenchEntityAgentMergeResult | FrenchEntityAgentTerminalMergeResult;
}

export function assertFrenchEntityMergeAttestationArtifactShape(
  attestation: FrenchEntityMergeAttestationArtifact
): void {
  if (
    attestation.schemaVersion ===
    FRENCH_ENTITY_MERGE_ATTESTATION_V2_SCHEMA_VERSION
  ) {
    assertFrenchEntityMergeAttestationV2Shape(attestation);
    return;
  }
  assertFrenchEntityMergeAttestationShape(attestation);
}

/**
 * Replays an attestation using the immutable manifest/results locations that it
 * seals. Downstream stages only need to pin the attestation file plus the two
 * resolved JSONL files; they cannot substitute a different result directory.
 */
export function assertFrenchEntityMergeAttestationAtPath(input: {
  attestationPath: string;
  canonicalEntitiesPath: string;
  canonicalEntryPoliciesPath: string;
  expectedReleaseKey?: string;
  expectations?: FrenchEntityCanonicalizationExpectations;
}): FrenchEntityMergeAttestationReplay {
  const attestationPath = resolve(input.attestationPath);
  const attestation = JSON.parse(readFileSync(attestationPath, "utf8")) as
    | FrenchEntityMergeAttestation
    | FrenchEntityMergeAttestationV2;
  if (
    attestation.schemaVersion ===
    FRENCH_ENTITY_MERGE_ATTESTATION_V2_SCHEMA_VERSION
  ) {
    return assertFrenchEntityMergeAttestationV2FromFiles({
      attestationPath,
      manifestPath: attestation.batchManifest.path,
      baseResultsDirectory: attestation.base.resultsDirectory,
      canonicalEntitiesPath: input.canonicalEntitiesPath,
      canonicalEntryPoliciesPath: input.canonicalEntryPoliciesPath,
      finalOverlayPath: attestation.finalOverlay.path,
      ...(input.expectedReleaseKey === undefined
        ? {}
        : { expectedReleaseKey: input.expectedReleaseKey }),
      ...(input.expectations === undefined
        ? {}
        : { expectations: input.expectations })
    });
  }
  assertFrenchEntityMergeAttestationShape(attestation);
  return assertFrenchEntityMergeAttestationFromFiles({
    attestationPath,
    manifestPath: attestation.batchManifest.path,
    resultsDirectory: attestation.resultsDirectory,
    canonicalEntitiesPath: input.canonicalEntitiesPath,
    canonicalEntryPoliciesPath: input.canonicalEntryPoliciesPath,
    ...(input.expectedReleaseKey === undefined
      ? {}
      : { expectedReleaseKey: input.expectedReleaseKey }),
    ...(input.expectations === undefined
      ? {}
      : { expectations: input.expectations })
  });
}

/**
 * Replays every physical role result and receipt. This is deliberately the
 * sole producer of the run ledger embedded in the merge attestation.
 */
export function replayFrenchEntityAgentResults(input: {
  manifest: FrenchEntityAgentBatchManifest;
  plan: FrenchEntityCanonicalizationPlan;
  resultsDirectory: string;
  expectations?: FrenchEntityCanonicalizationExpectations;
}): FrenchEntityAgentResultsReplay {
  const expectations =
    input.expectations ?? FRENCH_ENTITY_CANONICALIZATION_DEFAULT_EXPECTATIONS;
  assertFrenchEntityAgentBatchManifest(
    input.manifest,
    input.plan,
    expectations
  );
  const resultsDirectory = resolve(input.resultsDirectory);
  const artifactsByUnit = new Map<
    string,
    Partial<FrenchEntityAgentUnitArtifacts>
  >();
  const unitById = new Map(
    input.plan.reviewUnits.map((unit) => [unit.unitId, unit])
  );
  const seenThreads = new Set<string>();
  const runs: FrenchEntityMergeRunAttestation[] = [];
  let receiptCount = 0;

  for (const batch of input.manifest.batches) {
    for (const role of ROLES) {
      const directory = resolve(resultsDirectory, role, batch.batchId);
      const runPath = join(directory, "run.json");
      const artifactsPath = join(directory, "artifacts.jsonl");
      const receiptsPath = join(directory, "execution-receipts.jsonl");
      for (const path of [runPath, artifactsPath, receiptsPath]) {
        if (!existsSync(path)) {
          throw new Error(`french-entity-attestation-missing-result:${path}`);
        }
      }
      const run = JSON.parse(
        readFileSync(runPath, "utf8")
      ) as FrenchEntityAgentRun;
      assertFrenchEntityAgentRun(run);
      if (
        run.role !== role ||
        run.batchId !== batch.batchId ||
        run.batchHash !== batch.batchHash ||
        run.manifestHash !== input.manifest.manifestHash ||
        run.planHash !== input.plan.planHash ||
        run.releaseKey !== input.plan.sourceLineage.releaseKey ||
        run.releaseSnapshotFingerprint !==
          input.plan.sourceLineage.releaseSnapshotFingerprint ||
        seenThreads.has(run.threadId)
      ) {
        throw new Error(
          `french-entity-attestation-run-lineage-or-thread:${role}:${batch.batchId}`
        );
      }
      seenThreads.add(run.threadId);
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
          `french-entity-attestation-result-coverage:${role}:${batch.batchId}`
        );
      }
      const artifactByUnit = uniqueMap(
        artifacts,
        (artifact) => artifact.unitId,
        `artifact:${role}:${batch.batchId}`
      );
      const receiptByUnit = uniqueMap(
        receipts,
        (receipt) => receipt.entryKey,
        `receipt:${role}:${batch.batchId}`
      );
      const bindings = batch.unitIds.map((unitId) => {
        const artifact = requiredMap(artifactByUnit, unitId);
        const receipt = requiredMap(receiptByUnit, unitId);
        const unit = requiredMap(unitById, unitId);
        assertFrenchCodexExecutionReceipt(receipt, { expectedRole: role });
        const hash = artifactHash(artifact);
        if (
          receipt.artifactHash !== hash ||
          receipt.selectionHash !== unit.unitHash ||
          receipt.runHash !== run.runHash ||
          receipt.threadId !== run.threadId ||
          run.unitArtifactHashes[unitId] !== hash
        ) {
          throw new Error(
            `french-entity-attestation-binding:${role}:${unitId}`
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
        return {
          unitId,
          artifactHash: hash,
          receiptHash: receipt.receiptHash,
          receiptArtifactHash: receipt.artifactHash,
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
        unitBindingsDigest: hashFrenchEntityJson(bindings)
      };
      runs.push({
        ...withoutHash,
        runAttestationHash: hashFrenchEntityJson(withoutHash)
      });
    }
  }

  const artifacts = new Map<string, FrenchEntityAgentUnitArtifacts>();
  for (const unit of input.plan.reviewUnits) {
    const value = artifactsByUnit.get(unit.unitId);
    if (
      !value?.proposalA ||
      !value.proposalB ||
      !value.arbitration ||
      !value.audit
    ) {
      throw new Error(
        `french-entity-attestation-unit-incomplete:${unit.unitId}`
      );
    }
    artifacts.set(unit.unitId, value as FrenchEntityAgentUnitArtifacts);
  }
  if (artifactsByUnit.size !== input.plan.reviewUnits.length) {
    throw new Error("french-entity-attestation-orphan-unit");
  }
  const expectedRuns = input.manifest.batches.length * ROLES.length;
  if (runs.length !== expectedRuns || seenThreads.size !== expectedRuns) {
    throw new Error("french-entity-attestation-run-or-thread-coverage");
  }
  const counts = {
    batches: input.manifest.batches.length,
    runs: runs.length,
    receipts: receiptCount,
    reviewUnits: input.plan.reviewUnits.length,
    uniqueThreads: seenThreads.size
  };
  return {
    artifacts,
    runs,
    counts,
    runsDigest: hashFrenchEntityJson(runs)
  };
}

export function finalizeFrenchEntityMergeAttestation(input: {
  releaseKey: string;
  releaseSnapshotFingerprint: string;
  plan: FrenchEntityMergeAttestation["plan"];
  batchManifest: FrenchEntityMergeAttestation["batchManifest"];
  resultsDirectory: string;
  counts: FrenchEntityMergeAttestation["counts"];
  runs: FrenchEntityMergeRunAttestation[];
  outputs: FrenchEntityMergeAttestation["outputs"];
  mergeHash: string;
  gateHash: string;
}): FrenchEntityMergeAttestation {
  const runsDigest = hashFrenchEntityJson(input.runs);
  const withoutHash = {
    schemaVersion: FRENCH_ENTITY_MERGE_ATTESTATION_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_MERGE_ATTESTATION_POLICY_VERSION,
    releaseKey: input.releaseKey,
    releaseSnapshotFingerprint: input.releaseSnapshotFingerprint,
    plan: input.plan,
    batchManifest: input.batchManifest,
    manifestHash: input.batchManifest.manifestHash,
    resultsDirectory: resolve(input.resultsDirectory),
    counts: input.counts,
    runs: input.runs,
    runsDigest,
    outputs: input.outputs,
    mergeHash: input.mergeHash,
    gateHash: input.gateHash
  };
  const attestation = {
    ...withoutHash,
    attestationHash: hashFrenchEntityJson(withoutHash)
  };
  assertFrenchEntityMergeAttestationShape(attestation);
  return attestation;
}

/** Replays plan, manifest, 880 runs, 10,516 receipts, merge and output bytes. */
export function assertFrenchEntityMergeAttestationFromFiles(input: {
  attestationPath: string;
  manifestPath: string;
  resultsDirectory: string;
  canonicalEntitiesPath: string;
  canonicalEntryPoliciesPath: string;
  finalOverlayPath?: string;
  expectedReleaseKey?: string;
  expectations?: FrenchEntityCanonicalizationExpectations;
}): FrenchEntityMergeAttestationReplay {
  const expectations =
    input.expectations ?? FRENCH_ENTITY_CANONICALIZATION_DEFAULT_EXPECTATIONS;
  const attestationPath = resolve(input.attestationPath);
  const manifestPath = resolve(input.manifestPath);
  const resultsDirectory = resolve(input.resultsDirectory);
  const canonicalEntitiesPath = resolve(input.canonicalEntitiesPath);
  const canonicalEntryPoliciesPath = resolve(input.canonicalEntryPoliciesPath);
  const attestation = JSON.parse(readFileSync(attestationPath, "utf8")) as
    | FrenchEntityMergeAttestation
    | FrenchEntityMergeAttestationV2;
  if (
    attestation.schemaVersion ===
    FRENCH_ENTITY_MERGE_ATTESTATION_V2_SCHEMA_VERSION
  ) {
    return assertFrenchEntityMergeAttestationV2FromFiles({
      attestationPath,
      manifestPath,
      baseResultsDirectory: resultsDirectory,
      canonicalEntitiesPath,
      canonicalEntryPoliciesPath,
      finalOverlayPath: input.finalOverlayPath ?? attestation.finalOverlay.path,
      ...(input.expectedReleaseKey === undefined
        ? {}
        : { expectedReleaseKey: input.expectedReleaseKey }),
      ...(input.expectations === undefined
        ? {}
        : { expectations: input.expectations })
    });
  }
  assertFrenchEntityMergeAttestationShape(attestation);
  const manifestText = readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(manifestText) as FrenchEntityAgentBatchManifest;
  const planPath = resolve(manifest.plan.path);
  const planText = readFileSync(planPath, "utf8");
  const plan = JSON.parse(planText) as FrenchEntityCanonicalizationPlan;
  assertFrenchEntityAgentBatchManifest(manifest, plan, expectations);
  if (
    (input.expectedReleaseKey !== undefined &&
      attestation.releaseKey !== input.expectedReleaseKey) ||
    attestation.releaseKey !== plan.sourceLineage.releaseKey ||
    attestation.releaseSnapshotFingerprint !==
      plan.sourceLineage.releaseSnapshotFingerprint ||
    resolve(attestation.plan.path) !== planPath ||
    attestation.plan.fileSha256 !== sha256(planText) ||
    attestation.plan.planHash !== plan.planHash ||
    resolve(attestation.batchManifest.path) !== manifestPath ||
    attestation.batchManifest.fileSha256 !== sha256(manifestText) ||
    attestation.batchManifest.manifestHash !== manifest.manifestHash ||
    attestation.manifestHash !== manifest.manifestHash ||
    resolve(attestation.resultsDirectory) !== resultsDirectory ||
    resolve(attestation.outputs.canonicalEntities.path) !==
      canonicalEntitiesPath ||
    resolve(attestation.outputs.canonicalEntryPolicies.path) !==
      canonicalEntryPoliciesPath
  ) {
    throw new Error("french-entity-attestation-lineage-or-path-mismatch");
  }
  const replay = replayFrenchEntityAgentResults({
    manifest,
    plan,
    resultsDirectory,
    expectations
  });
  if (
    canonicalFrenchEntityJson(replay.runs) !==
      canonicalFrenchEntityJson(attestation.runs) ||
    canonicalFrenchEntityJson(replay.counts) !==
      canonicalFrenchEntityJson(attestation.counts) ||
    replay.runsDigest !== attestation.runsDigest
  ) {
    throw new Error("french-entity-attestation-run-replay-mismatch");
  }
  const merged = mergeFrenchEntityAgentArtifacts({
    plan,
    manifest,
    artifacts: replay.artifacts,
    expectations
  });
  const canonicalEntitiesText = readFileSync(canonicalEntitiesPath, "utf8");
  const canonicalEntryPoliciesText = readFileSync(
    canonicalEntryPoliciesPath,
    "utf8"
  );
  const expectedEntitiesText = `${merged.canonicalEntities
    .map((record) => canonicalFrenchEntityJson(record))
    .join("\n")}\n`;
  const expectedPoliciesText = `${merged.entryPolicies
    .map((record) => canonicalFrenchEntityJson(record))
    .join("\n")}\n`;
  if (
    canonicalEntitiesText !== expectedEntitiesText ||
    canonicalEntryPoliciesText !== expectedPoliciesText ||
    attestation.outputs.canonicalEntities.sha256 !==
      sha256(canonicalEntitiesText) ||
    attestation.outputs.canonicalEntryPolicies.sha256 !==
      sha256(canonicalEntryPoliciesText) ||
    attestation.outputs.canonicalEntities.records !==
      merged.canonicalEntities.length ||
    attestation.outputs.canonicalEntryPolicies.records !==
      merged.entryPolicies.length ||
    attestation.mergeHash !== merged.mergeHash ||
    attestation.gateHash !== merged.gate.gateHash
  ) {
    throw new Error("french-entity-attestation-output-or-merge-mismatch");
  }
  return { attestation, plan, manifest, merged };
}

export function assertFrenchEntityMergeAttestationShape(
  attestation: FrenchEntityMergeAttestation
): void {
  const { attestationHash, ...content } = attestation;
  if (
    attestation.schemaVersion !==
      FRENCH_ENTITY_MERGE_ATTESTATION_SCHEMA_VERSION ||
    attestation.policyVersion !==
      FRENCH_ENTITY_MERGE_ATTESTATION_POLICY_VERSION ||
    !attestation.releaseKey?.trim() ||
    !Array.isArray(attestation.runs) ||
    attestation.runsDigest !== hashFrenchEntityJson(attestation.runs) ||
    attestation.manifestHash !== attestation.batchManifest.manifestHash ||
    hashFrenchEntityJson(content) !== attestationHash
  ) {
    throw new Error("french-entity-attestation-invalid");
  }
  const hashes = [
    attestation.releaseSnapshotFingerprint,
    attestation.plan.fileSha256,
    attestation.plan.planHash,
    attestation.batchManifest.fileSha256,
    attestation.batchManifest.manifestHash,
    attestation.manifestHash,
    attestation.runsDigest,
    attestation.outputs.canonicalEntities.sha256,
    attestation.outputs.canonicalEntryPolicies.sha256,
    attestation.mergeHash,
    attestation.gateHash,
    attestation.attestationHash,
    ...attestation.runs.flatMap((run) => [
      run.runHash,
      run.fileHashes.run,
      run.fileHashes.artifacts,
      run.fileHashes.receipts,
      run.unitBindingsDigest,
      run.runAttestationHash
    ])
  ];
  if (!hashes.every((hash) => SHA256_PATTERN.test(hash))) {
    throw new Error("french-entity-attestation-invalid-hash");
  }
  for (const run of attestation.runs) {
    const { runAttestationHash, ...runContent } = run;
    if (
      !ROLES.includes(run.role) ||
      !run.batchId?.trim() ||
      !run.threadId?.trim() ||
      !run.relativeDirectory?.trim() ||
      !Number.isSafeInteger(run.unitCount) ||
      run.unitCount < 1 ||
      run.receiptCount !== run.unitCount ||
      hashFrenchEntityJson(runContent) !== runAttestationHash
    ) {
      throw new Error("french-entity-attestation-invalid-run");
    }
  }
  const rolesByBatch = new Map<string, Set<FrenchEntityAgentRole>>();
  for (const run of attestation.runs) {
    const roles = rolesByBatch.get(run.batchId) ?? new Set();
    roles.add(run.role);
    rolesByBatch.set(run.batchId, roles);
  }
  if (
    !Number.isSafeInteger(attestation.counts.batches) ||
    attestation.counts.batches < 1 ||
    !Number.isSafeInteger(attestation.counts.reviewUnits) ||
    attestation.counts.reviewUnits < 1 ||
    attestation.counts.runs !== attestation.runs.length ||
    attestation.counts.runs !== attestation.counts.batches * ROLES.length ||
    attestation.counts.uniqueThreads !==
      new Set(attestation.runs.map((run) => run.threadId)).size ||
    attestation.counts.uniqueThreads !== attestation.counts.runs ||
    attestation.counts.receipts !==
      attestation.runs.reduce((sum, run) => sum + run.receiptCount, 0) ||
    attestation.counts.receipts !==
      attestation.counts.reviewUnits * ROLES.length ||
    new Set(attestation.runs.map((run) => `${run.role}:${run.batchId}`))
      .size !== attestation.runs.length ||
    rolesByBatch.size !== attestation.counts.batches ||
    [...rolesByBatch.values()].some((roles) => roles.size !== ROLES.length) ||
    attestation.outputs.canonicalEntities.records < 1 ||
    attestation.outputs.canonicalEntryPolicies.records < 1 ||
    !attestation.plan.path?.trim() ||
    !attestation.batchManifest.path?.trim() ||
    !attestation.resultsDirectory?.trim() ||
    !attestation.outputs.canonicalEntities.path?.trim() ||
    !attestation.outputs.canonicalEntryPolicies.path?.trim()
  ) {
    throw new Error("french-entity-attestation-invalid-counts");
  }
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
  keyOf: (value: T) => K,
  label: string
): Map<K, T> {
  const result = new Map<K, T>();
  for (const value of values) {
    const key = keyOf(value);
    if (result.has(key)) {
      throw new Error(
        `french-entity-attestation-duplicate:${label}:${String(key)}`
      );
    }
    result.set(key, value);
  }
  return result;
}

function requiredMap<K, V>(map: ReadonlyMap<K, V>, key: K): V {
  const value = map.get(key);
  if (value === undefined) {
    throw new Error(`french-entity-attestation-missing:${String(key)}`);
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
