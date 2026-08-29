import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildFrenchInternalRemediationMerge,
  frenchInternalRemediationPacketLogicalDigest,
  frenchInternalRemediationReviewLogicalDigest,
  FRENCH_INTERNAL_REMEDIATION_MERGE_SCHEMA_VERSION,
  FRENCH_INTERNAL_REMEDIATION_PLAN_SCHEMA_VERSION,
  FRENCH_INTERNAL_REMEDIATION_POLICY_VERSION,
  type FrenchInternalRemediationMerge,
  type FrenchInternalRemediationPlan
} from "./frenchInternalRemediation.js";
import {
  FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE,
  assertFrenchInternalReviewRecord,
  canonicalFrenchInternalJson,
  hashFrenchInternalJson,
  type FrenchInternalExecutionAttestation,
  type FrenchInternalReviewRecord,
  type FrenchInternalRole
} from "./frenchInternalReview.js";
import {
  validateFrenchPacket,
  type LexiconV3FrenchPacket
} from "./frenchPackets.js";

export const FRENCH_INTERNAL_REMEDIATION_RUN_SCHEMA_VERSION =
  "lexicon-v3-french-internal-remediation-run@1" as const;

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const FULL_NAMESPACE = "/fr-internal/full" as const;
const REMEDIATION_NAMESPACE_PATTERN =
  /^\/fr-internal\/custom\/remediation-r(\d{3})$/u;
const ROLES: readonly FrenchInternalRole[] = [
  "proposerA",
  "proposerB",
  "arbiter",
  "auditor"
];

interface RemediationRunRound {
  round: number;
  namespace: string;
  planPath: string;
  planHash: string;
  selected: number;
  batchManifestPath: string;
  batchManifestHash: string;
  proposerSummaryPath: string;
  proposerSummaryHash: string;
  adjudicationSummaryPath: string;
  adjudicationSummarySha256: string;
  attemptedReviewPath: string;
  attemptedReviewSha256: string;
  mergedReviewPath: string;
  mergeSummaryPath: string;
  mergeHash: string;
  replaced: number;
  residual: number;
  roundHash: string;
}

interface RemediationRunSummary {
  schemaVersion: typeof FRENCH_INTERNAL_REMEDIATION_RUN_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_INTERNAL_REMEDIATION_POLICY_VERSION;
  status: "complete" | "failed_residual";
  maxRounds: number;
  executionContract: {
    runtime: "codex-internal-agent-runtime";
    cel: "forbidden";
    aiGateway: "forbidden";
    localTools: "disabled";
    networkDataTools: "disabled";
    shell: "disabled";
    boundedRounds: true;
    exactCoverage: true;
    mergePolicy: "fresh-attempt-advances-auto-validated-only-publishes";
  };
  initialReviews: ReviewSource;
  rounds: RemediationRunRound[];
  finalReviews: ReviewSource;
  residuals: Array<{
    entryKey: string;
    status: "review_needed" | "blocked_source_issue" | "failed";
    reviewArtifactHash: string;
  }>;
  runHash: string;
}

interface ReviewSource {
  path: string;
  sha256: string;
  records: number;
  logicalDigest: string;
}

interface MinimalBatchManifest {
  runKind: string;
  namespace: string;
  sourcePaths: { selection: string; packets: string };
  sourceDigests: { selection: string; packets: string };
  lineage: {
    releaseKey: string;
    releaseSnapshotFingerprint: string;
  };
  selection: {
    sourcePath: string;
    sourceFileHash: string;
    expectedEntries: number;
    keys: string[];
    keyOrderHash: string;
    contentHash: string;
  };
  counts: { entries: number };
  manifestHash: string;
}

interface MinimalProposerSummary {
  runKind: string;
  namespace: string;
  selectionHash: string;
  keyOrderHash: string;
  coverage: string;
  manifestHash: string;
  counts: { entries: number; proposerA: number; proposerB: number };
  summaryHash: string;
}

interface MinimalAdjudicationSummary {
  namespace: string;
  phase: string;
  expectedEntries: number;
  proposerProof: { summaryHash: string };
  outputs: {
    arbiter?: { summaryHash: string };
    auditor?: { summaryHash: string };
    executionReceipts?: {
      summaryHash: string;
      output: { logicalDigest: string; records: number };
    };
  };
  summaryHash: string;
}

interface ExecutionClosure {
  identity: string;
  namespace: string;
  descriptor: Omit<
    FrenchInternalExecutionAttestation,
    "roleReceipts" | "attestationHash"
  >;
  entryKeys: Set<string>;
}

export interface AssertFrenchInternalPublicationContractInput {
  finalReviewsPath: string;
  finalReviews: readonly FrenchInternalReviewRecord[];
  packetsPath: string;
  packets: readonly LexiconV3FrenchPacket[];
  remediationSummaryPath?: string;
}

export interface FrenchInternalPublicationContractProof {
  primaryNamespace: typeof FULL_NAMESPACE;
  cohorts: number;
  remediationRunHash: string | null;
  remediationRounds: number;
  finalReviewLogicalDigest: string;
}

/**
 * Fail-closed publication boundary for internally generated French reviews.
 *
 * A final file is either one complete `/full` execution closure, or the exact
 * output of a replayed remediation chain rooted in one `/full` closure. Custom
 * execution records are never accepted on their own.
 */
export function assertFrenchInternalPublicationContract(
  input: AssertFrenchInternalPublicationContractInput
): FrenchInternalPublicationContractProof {
  const finalPath = resolve(input.finalReviewsPath);
  const packetsPath = resolve(input.packetsPath);
  assertRegularFile(finalPath, "final-reviews");
  assertRegularFile(packetsPath, "packets");
  if (input.finalReviews.length < 1 || input.packets.length < 1) {
    throw new Error("french-publication-empty-input");
  }
  const packetByKey = validatePackets(input.packets);
  validateReviews(input.finalReviews, packetByKey, "final");
  assertGlobalLineage(input.finalReviews);

  if (!input.remediationSummaryPath) {
    const receiptHashes = new Set<string>();
    const closure = assertSingleExecutionClosure(
      input.finalReviews,
      FULL_NAMESPACE,
      receiptHashes,
      "final"
    );
    if (closure.entryKeys.size !== input.finalReviews.length) {
      throw new Error("french-publication-full-coverage-invalid");
    }
    return {
      primaryNamespace: FULL_NAMESPACE,
      cohorts: 1,
      remediationRunHash: null,
      remediationRounds: 0,
      finalReviewLogicalDigest: frenchInternalRemediationReviewLogicalDigest(
        input.finalReviews
      )
    };
  }

  const summaryPath = resolve(input.remediationSummaryPath);
  const summary = readJsonFile<RemediationRunSummary>(
    summaryPath,
    "remediation-summary"
  );
  assertRemediationEnvelope(summary);
  assertReviewSource(
    summary.finalReviews,
    finalPath,
    input.finalReviews,
    "final-reviews"
  );
  if (
    summary.finalReviews.logicalDigest !==
    frenchInternalRemediationReviewLogicalDigest(input.finalReviews)
  ) {
    throw new Error("french-publication-final-logical-digest-mismatch");
  }

  const initialReviews = readReviewSource(
    summary.initialReviews,
    "initial-reviews"
  );
  validateReviews(initialReviews, packetByKey, "initial");
  assertExactKeySet(
    input.packets.map((packet) => packet.entryKey),
    initialReviews.map((review) => review.entryKey),
    "initial-reviews"
  );
  assertExactKeySet(
    initialReviews.map((review) => review.entryKey),
    input.finalReviews.map((review) => review.entryKey),
    "final-reviews"
  );
  assertGlobalLineage([...initialReviews, ...input.finalReviews]);

  const receiptHashes = new Set<string>();
  const closures = new Map<string, ExecutionClosure>();
  const namespaces = new Set<string>();
  const primary = assertSingleExecutionClosure(
    initialReviews,
    FULL_NAMESPACE,
    receiptHashes,
    "initial"
  );
  addClosure(closures, namespaces, primary);

  let previousReviews = initialReviews;
  let previousPath = resolve(summary.initialReviews.path);
  for (const [index, round] of summary.rounds.entries()) {
    const expectedRound = index + 1;
    assertRemediationRoundEnvelope(round, expectedRound, summary.maxRounds);
    const expectedNamespace = `/fr-internal/custom/remediation-r${String(
      expectedRound
    ).padStart(3, "0")}`;
    if (round.namespace !== expectedNamespace) {
      throw new Error(
        `french-publication-remediation-namespace-mismatch:${expectedRound}`
      );
    }
    if (round.selected >= initialReviews.length) {
      throw new Error(
        `french-publication-remediation-cannot-replace-full-corpus:${expectedRound}`
      );
    }

    const plan = readSelfHashedJson<FrenchInternalRemediationPlan>(
      round.planPath,
      "planHash",
      round.planHash,
      `round-${expectedRound}-plan`
    );
    assertPlanLineage({
      plan,
      round,
      packetsPath,
      packets: input.packets,
      previousPath,
      previousReviews
    });

    const manifest = readSelfHashedJson<MinimalBatchManifest>(
      round.batchManifestPath,
      "manifestHash",
      round.batchManifestHash,
      `round-${expectedRound}-manifest`
    );
    assertManifestLineage({
      manifest,
      round,
      plan,
      packetsPath
    });

    const proposerSummary = readSelfHashedJson<MinimalProposerSummary>(
      round.proposerSummaryPath,
      "summaryHash",
      round.proposerSummaryHash,
      `round-${expectedRound}-proposer-summary`
    );
    assertProposerSummaryLineage(
      proposerSummary,
      manifest,
      round,
      expectedRound
    );

    if (
      resolve(round.adjudicationSummaryPath) !==
        round.adjudicationSummaryPath ||
      sha256File(round.adjudicationSummaryPath) !==
        round.adjudicationSummarySha256
    ) {
      throw new Error(
        `french-publication-remediation-adjudication-stale:${expectedRound}`
      );
    }
    const adjudication = readSelfHashedJson<MinimalAdjudicationSummary>(
      round.adjudicationSummaryPath,
      "summaryHash",
      undefined,
      `round-${expectedRound}-adjudication-summary`
    );
    assertAdjudicationLineage(
      adjudication,
      proposerSummary,
      round,
      expectedRound
    );

    if (
      resolve(round.attemptedReviewPath) !== round.attemptedReviewPath ||
      sha256File(round.attemptedReviewPath) !== round.attemptedReviewSha256
    ) {
      throw new Error(
        `french-publication-remediation-attempt-stale:${expectedRound}`
      );
    }
    const attempted = readJsonl<FrenchInternalReviewRecord>(
      round.attemptedReviewPath,
      `round-${expectedRound}-attempted`
    );
    validateReviews(attempted, packetByKey, `round-${expectedRound}-attempted`);
    assertExactOrderedKeys(
      plan.keys,
      attempted.map((review) => review.entryKey),
      `round-${expectedRound}-attempted`
    );
    const closure = assertSingleExecutionClosure(
      attempted,
      expectedNamespace,
      receiptHashes,
      `round-${expectedRound}`
    );
    assertClosureLineage({
      closure,
      manifest,
      proposerSummary,
      adjudication,
      round,
      expectedRound
    });
    addClosure(closures, namespaces, closure);

    const merge = readSelfHashedJson<FrenchInternalRemediationMerge>(
      round.mergeSummaryPath,
      "mergeHash",
      round.mergeHash,
      `round-${expectedRound}-merge`
    );
    assertMergeEnvelope(merge, round, expectedRound);
    assertSourceFile(
      merge.sources.batchManifest,
      round.batchManifestPath,
      {
        records: plan.keys.length
      },
      `round-${expectedRound}-batch-manifest`
    );
    assertSourceFile(
      merge.sources.attemptedReviews,
      round.attemptedReviewPath,
      {
        records: attempted.length,
        logicalDigest: frenchInternalRemediationReviewLogicalDigest(attempted)
      },
      `round-${expectedRound}-attempted-reviews`
    );
    const rebuilt = buildFrenchInternalRemediationMerge({
      plan,
      packets: input.packets,
      previousReviews,
      attemptedReviews: attempted,
      proposerInputs: merge.proposerInputs,
      batchManifestSource: merge.sources.batchManifest,
      attemptedReviewsSource: merge.sources.attemptedReviews
    });
    if (
      canonicalFrenchInternalJson(rebuilt.merge) !==
      canonicalFrenchInternalJson(merge)
    ) {
      throw new Error(
        `french-publication-remediation-merge-replay-mismatch:${expectedRound}`
      );
    }
    const merged = readJsonl<FrenchInternalReviewRecord>(
      round.mergedReviewPath,
      `round-${expectedRound}-merged`
    );
    if (
      resolve(round.mergedReviewPath) !== round.mergedReviewPath ||
      sha256File(round.mergedReviewPath) !== merge.outputDigest ||
      canonicalFrenchInternalJson(merged) !==
        canonicalFrenchInternalJson(rebuilt.records)
    ) {
      throw new Error(
        `french-publication-remediation-merged-output-mismatch:${expectedRound}`
      );
    }
    if (
      round.selected !== plan.keys.length ||
      round.replaced !== merge.counts.replaced ||
      round.residual !== merge.counts.residual
    ) {
      throw new Error(
        `french-publication-remediation-round-count-mismatch:${expectedRound}`
      );
    }
    previousReviews = merged;
    previousPath = resolve(round.mergedReviewPath);
  }

  if (
    canonicalFrenchInternalJson(previousReviews) !==
      canonicalFrenchInternalJson(input.finalReviews) ||
    (summary.rounds.length > 0 && summary.rounds.at(-1)?.residual !== 0)
  ) {
    throw new Error("french-publication-remediation-final-chain-mismatch");
  }

  const finalCohortIds = new Set<string>();
  let retainedPrimary = 0;
  for (const review of input.finalReviews) {
    const attestation = review.executionAttestation!;
    const identity = executionClosureIdentity(attestation);
    const closure = closures.get(identity);
    if (!closure || !closure.entryKeys.has(review.entryKey)) {
      throw new Error(
        `french-publication-final-execution-orphan:${review.entryKey}`
      );
    }
    finalCohortIds.add(identity);
    if (identity === primary.identity) retainedPrimary += 1;
  }
  if (retainedPrimary < 1) {
    throw new Error("french-publication-primary-full-cohort-not-retained");
  }
  if (
    [...finalCohortIds].filter(
      (identity) => closures.get(identity)?.namespace === FULL_NAMESPACE
    ).length !== 1
  ) {
    throw new Error("french-publication-primary-full-cohort-invalid");
  }

  return {
    primaryNamespace: FULL_NAMESPACE,
    cohorts: finalCohortIds.size,
    remediationRunHash: summary.runHash,
    remediationRounds: summary.rounds.length,
    finalReviewLogicalDigest: summary.finalReviews.logicalDigest
  };
}

function assertRemediationEnvelope(summary: RemediationRunSummary): void {
  const { runHash, ...content } = summary;
  if (
    summary.schemaVersion !== FRENCH_INTERNAL_REMEDIATION_RUN_SCHEMA_VERSION ||
    summary.policyVersion !== FRENCH_INTERNAL_REMEDIATION_POLICY_VERSION ||
    summary.status !== "complete" ||
    !Number.isInteger(summary.maxRounds) ||
    summary.maxRounds < 1 ||
    !Array.isArray(summary.rounds) ||
    summary.rounds.length > summary.maxRounds ||
    !Array.isArray(summary.residuals) ||
    summary.residuals.length !== 0 ||
    !SHA256_PATTERN.test(runHash) ||
    runHash !== hashFrenchInternalJson(content) ||
    canonicalFrenchInternalJson(summary.executionContract) !==
      canonicalFrenchInternalJson({
        runtime: "codex-internal-agent-runtime",
        cel: "forbidden",
        aiGateway: "forbidden",
        localTools: "disabled",
        networkDataTools: "disabled",
        shell: "disabled",
        boundedRounds: true,
        exactCoverage: true,
        mergePolicy: "fresh-attempt-advances-auto-validated-only-publishes"
      })
  ) {
    throw new Error("french-publication-remediation-summary-invalid");
  }
}

function assertRemediationRoundEnvelope(
  round: RemediationRunRound,
  expectedRound: number,
  maxRounds: number
): void {
  const { roundHash, ...content } = round;
  if (
    round.round !== expectedRound ||
    round.round > maxRounds ||
    !Number.isInteger(round.selected) ||
    round.selected < 1 ||
    !Number.isInteger(round.replaced) ||
    round.replaced < 0 ||
    round.replaced > round.selected ||
    !Number.isInteger(round.residual) ||
    round.residual < 0 ||
    !SHA256_PATTERN.test(roundHash) ||
    roundHash !== hashFrenchInternalJson(content)
  ) {
    throw new Error(
      `french-publication-remediation-round-invalid:${expectedRound}`
    );
  }
}

function assertPlanLineage(input: {
  plan: FrenchInternalRemediationPlan;
  round: RemediationRunRound;
  packetsPath: string;
  packets: readonly LexiconV3FrenchPacket[];
  previousPath: string;
  previousReviews: readonly FrenchInternalReviewRecord[];
}): void {
  const { plan, round } = input;
  if (
    plan.schemaVersion !== FRENCH_INTERNAL_REMEDIATION_PLAN_SCHEMA_VERSION ||
    plan.policyVersion !== FRENCH_INTERNAL_REMEDIATION_POLICY_VERSION ||
    plan.round !== round.round ||
    plan.maxRounds < round.round ||
    plan.counts.selected !== round.selected ||
    resolve(plan.sources.packets.path) !== input.packetsPath ||
    resolve(plan.sources.reviews.path) !== input.previousPath
  ) {
    throw new Error(
      `french-publication-remediation-plan-lineage:${round.round}`
    );
  }
  assertSourceFile(
    plan.sources.packets,
    input.packetsPath,
    {
      records: input.packets.length,
      logicalDigest: frenchInternalRemediationPacketLogicalDigest(input.packets)
    },
    `round-${round.round}-packets`
  );
  assertSourceFile(
    plan.sources.reviews,
    input.previousPath,
    {
      records: input.previousReviews.length,
      logicalDigest: frenchInternalRemediationReviewLogicalDigest(
        input.previousReviews
      )
    },
    `round-${round.round}-previous-reviews`
  );
}

function assertManifestLineage(input: {
  manifest: MinimalBatchManifest;
  round: RemediationRunRound;
  plan: FrenchInternalRemediationPlan;
  packetsPath: string;
}): void {
  const { manifest, round, plan } = input;
  const planSha256 = sha256File(round.planPath);
  if (
    manifest.runKind !== "custom" ||
    manifest.namespace !== round.namespace ||
    resolve(manifest.sourcePaths.selection) !== resolve(round.planPath) ||
    resolve(manifest.selection.sourcePath) !== resolve(round.planPath) ||
    manifest.sourceDigests.selection !== planSha256 ||
    manifest.selection.sourceFileHash !== planSha256 ||
    resolve(manifest.sourcePaths.packets) !== input.packetsPath ||
    manifest.selection.expectedEntries !== plan.keys.length ||
    manifest.counts.entries !== plan.keys.length ||
    manifest.selection.keyOrderHash !== hashFrenchInternalJson(plan.keys) ||
    canonicalFrenchInternalJson(manifest.selection.keys) !==
      canonicalFrenchInternalJson(plan.keys)
  ) {
    throw new Error(
      `french-publication-remediation-manifest-lineage:${round.round}`
    );
  }
}

function assertProposerSummaryLineage(
  summary: MinimalProposerSummary,
  manifest: MinimalBatchManifest,
  round: RemediationRunRound,
  expectedRound: number
): void {
  if (
    summary.runKind !== "custom" ||
    summary.namespace !== round.namespace ||
    summary.manifestHash !== manifest.manifestHash ||
    summary.selectionHash !== manifest.selection.contentHash ||
    summary.keyOrderHash !== manifest.selection.keyOrderHash ||
    summary.coverage !== "exact" ||
    summary.counts.entries !== round.selected ||
    summary.counts.proposerA !== round.selected ||
    summary.counts.proposerB !== round.selected
  ) {
    throw new Error(
      `french-publication-remediation-proposer-lineage:${expectedRound}`
    );
  }
}

function assertAdjudicationLineage(
  summary: MinimalAdjudicationSummary,
  proposer: MinimalProposerSummary,
  round: RemediationRunRound,
  expectedRound: number
): void {
  if (
    summary.namespace !== round.namespace ||
    summary.phase !== "all" ||
    summary.expectedEntries !== round.selected ||
    summary.proposerProof.summaryHash !== proposer.summaryHash ||
    !summary.outputs.arbiter ||
    !summary.outputs.auditor ||
    !summary.outputs.executionReceipts ||
    summary.outputs.executionReceipts.output.records !== round.selected * 4
  ) {
    throw new Error(
      `french-publication-remediation-adjudication-lineage:${expectedRound}`
    );
  }
}

function assertClosureLineage(input: {
  closure: ExecutionClosure;
  manifest: MinimalBatchManifest;
  proposerSummary: MinimalProposerSummary;
  adjudication: MinimalAdjudicationSummary;
  round: RemediationRunRound;
  expectedRound: number;
}): void {
  const { descriptor } = input.closure;
  if (
    descriptor.namespace !== input.round.namespace ||
    descriptor.releaseKey !== input.manifest.lineage.releaseKey ||
    descriptor.releaseSnapshotFingerprint !==
      input.manifest.lineage.releaseSnapshotFingerprint ||
    descriptor.selectionHash !== input.manifest.selection.contentHash ||
    descriptor.keyOrderHash !== input.manifest.selection.keyOrderHash ||
    descriptor.proposerManifestHash !== input.manifest.manifestHash ||
    descriptor.proposerSummaryHash !== input.proposerSummary.summaryHash ||
    descriptor.arbiterSummaryHash !==
      input.adjudication.outputs.arbiter!.summaryHash ||
    descriptor.auditorSummaryHash !==
      input.adjudication.outputs.auditor!.summaryHash ||
    descriptor.executionReceiptsDigest !==
      input.adjudication.outputs.executionReceipts!.output.logicalDigest ||
    descriptor.adjudicationSummaryHash !== input.adjudication.summaryHash
  ) {
    throw new Error(
      `french-publication-remediation-closure-lineage:${input.expectedRound}`
    );
  }
}

function assertMergeEnvelope(
  merge: FrenchInternalRemediationMerge,
  round: RemediationRunRound,
  expectedRound: number
): void {
  if (
    merge.schemaVersion !== FRENCH_INTERNAL_REMEDIATION_MERGE_SCHEMA_VERSION ||
    merge.policyVersion !== FRENCH_INTERNAL_REMEDIATION_POLICY_VERSION ||
    merge.round !== expectedRound ||
    merge.planHash !== round.planHash ||
    merge.counts.attempted !== round.selected ||
    merge.counts.replaced !== round.replaced ||
    merge.counts.residual !== round.residual
  ) {
    throw new Error(
      `french-publication-remediation-merge-invalid:${expectedRound}`
    );
  }
}

function assertSingleExecutionClosure(
  reviews: readonly FrenchInternalReviewRecord[],
  expectedNamespace: string,
  globalReceiptHashes: Set<string>,
  label: string
): ExecutionClosure {
  if (reviews.length < 1) {
    throw new Error(`french-publication-execution-cohort-empty:${label}`);
  }
  const first = reviews[0]!.executionAttestation;
  if (!first) {
    throw new Error(
      `french-publication-execution-attestation-missing:${label}`
    );
  }
  const descriptor = executionDescriptor(first);
  const identity = executionClosureIdentity(first);
  const entryKeys = new Set<string>();
  const ordered = [...reviews].sort((left, right) =>
    left.entryKey.localeCompare(right.entryKey)
  );
  const logicalReceipts: Array<{
    entryKey: string;
    role: FrenchInternalRole;
    receiptHash: string;
  }> = [];
  for (const review of ordered) {
    const attestation = review.executionAttestation;
    if (
      !attestation ||
      attestation.namespace !== expectedNamespace ||
      executionClosureIdentity(attestation) !== identity ||
      entryKeys.has(review.entryKey)
    ) {
      throw new Error(`french-publication-execution-cohort-drift:${label}`);
    }
    entryKeys.add(review.entryKey);
    for (const role of ROLES) {
      const receipt = attestation.roleReceipts[role];
      if (globalReceiptHashes.has(receipt.receiptHash)) {
        throw new Error(
          `french-publication-execution-receipt-collision:${receipt.receiptHash}`
        );
      }
      globalReceiptHashes.add(receipt.receiptHash);
      logicalReceipts.push({
        entryKey: review.entryKey,
        role,
        receiptHash: receipt.receiptHash
      });
    }
  }
  if (
    descriptor.executionReceiptsDigest !==
    hashFrenchInternalJson(logicalReceipts)
  ) {
    throw new Error(
      `french-publication-execution-receipts-digest-mismatch:${label}`
    );
  }
  return { identity, namespace: expectedNamespace, descriptor, entryKeys };
}

function executionDescriptor(
  attestation: FrenchInternalExecutionAttestation
): Omit<
  FrenchInternalExecutionAttestation,
  "roleReceipts" | "attestationHash"
> {
  const {
    roleReceipts: _roleReceipts,
    attestationHash: _attestationHash,
    ...descriptor
  } = attestation;
  void _roleReceipts;
  void _attestationHash;
  return descriptor;
}

function executionClosureIdentity(
  attestation: FrenchInternalExecutionAttestation
): string {
  return hashFrenchInternalJson(executionDescriptor(attestation));
}

function addClosure(
  closures: Map<string, ExecutionClosure>,
  namespaces: Set<string>,
  closure: ExecutionClosure
): void {
  if (
    closures.has(closure.identity) ||
    namespaces.has(closure.namespace) ||
    (closure.namespace !== FULL_NAMESPACE &&
      !REMEDIATION_NAMESPACE_PATTERN.test(closure.namespace))
  ) {
    throw new Error(
      `french-publication-execution-cohort-collision:${closure.namespace}`
    );
  }
  closures.set(closure.identity, closure);
  namespaces.add(closure.namespace);
}

function assertGlobalLineage(
  reviews: readonly FrenchInternalReviewRecord[]
): void {
  const releaseKeys = new Set<string>();
  const snapshots = new Set<string>();
  const configs = new Set<string>();
  const profiles = new Set<string>();
  for (const review of reviews) {
    const attestation = review.executionAttestation;
    if (!attestation) {
      throw new Error("french-publication-execution-attestation-missing");
    }
    releaseKeys.add(attestation.releaseKey);
    snapshots.add(attestation.releaseSnapshotFingerprint);
    configs.add(review.generationConfigHash);
    profiles.add(
      hashFrenchInternalJson(review.configuration.approvedExecutionProfile)
    );
  }
  if (
    releaseKeys.size !== 1 ||
    snapshots.size !== 1 ||
    configs.size !== 1 ||
    profiles.size !== 1 ||
    [...profiles][0] !==
      hashFrenchInternalJson(FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE)
  ) {
    throw new Error("french-publication-global-lineage-drift");
  }
}

function validatePackets(
  packets: readonly LexiconV3FrenchPacket[]
): Map<string, LexiconV3FrenchPacket> {
  const output = new Map<string, LexiconV3FrenchPacket>();
  for (const packet of packets) {
    const issues = validateFrenchPacket(packet);
    if (issues.length > 0) {
      throw new Error(
        `french-publication-packet-invalid:${packet.entryKey}:${issues.join("|")}`
      );
    }
    if (output.has(packet.entryKey)) {
      throw new Error(`french-publication-packet-duplicate:${packet.entryKey}`);
    }
    output.set(packet.entryKey, packet);
  }
  return output;
}

function validateReviews(
  reviews: readonly FrenchInternalReviewRecord[],
  packetByKey: ReadonlyMap<string, LexiconV3FrenchPacket>,
  label: string
): void {
  const seen = new Set<string>();
  for (const review of reviews) {
    if (seen.has(review.entryKey)) {
      throw new Error(
        `french-publication-review-duplicate:${label}:${review.entryKey}`
      );
    }
    seen.add(review.entryKey);
    const packet = packetByKey.get(review.entryKey);
    if (!packet) {
      throw new Error(
        `french-publication-review-orphan:${label}:${review.entryKey}`
      );
    }
    assertFrenchInternalReviewRecord({ record: review, packet });
  }
}

function assertReviewSource(
  source: ReviewSource,
  expectedPath: string,
  records: readonly FrenchInternalReviewRecord[],
  label: string
): void {
  assertSourceFile(
    source,
    expectedPath,
    {
      records: records.length,
      logicalDigest: frenchInternalRemediationReviewLogicalDigest(records)
    },
    label
  );
}

function readReviewSource(source: ReviewSource, label: string) {
  assertRegularFile(source.path, label);
  const records = readJsonl<FrenchInternalReviewRecord>(source.path, label);
  assertReviewSource(source, resolve(source.path), records, label);
  return records;
}

function assertSourceFile(
  source: ReviewSource,
  expectedPath: string,
  expected: { records: number; logicalDigest?: string },
  label: string
): void {
  if (
    resolve(source.path) !== source.path ||
    resolve(source.path) !== resolve(expectedPath) ||
    !SHA256_PATTERN.test(source.sha256) ||
    !SHA256_PATTERN.test(source.logicalDigest) ||
    source.records !== expected.records ||
    (expected.logicalDigest !== undefined &&
      source.logicalDigest !== expected.logicalDigest)
  ) {
    throw new Error(`french-publication-source-invalid:${label}`);
  }
  assertRegularFile(source.path, label);
  if (sha256File(source.path) !== source.sha256) {
    throw new Error(`french-publication-source-stale:${label}`);
  }
}

function assertExactKeySet(
  expected: readonly string[],
  actual: readonly string[],
  label: string
): void {
  if (
    expected.length !== actual.length ||
    new Set(expected).size !== expected.length ||
    new Set(actual).size !== actual.length ||
    canonicalFrenchInternalJson([...expected].sort()) !==
      canonicalFrenchInternalJson([...actual].sort())
  ) {
    throw new Error(`french-publication-key-coverage-mismatch:${label}`);
  }
}

function assertExactOrderedKeys(
  expected: readonly string[],
  actual: readonly string[],
  label: string
): void {
  if (
    canonicalFrenchInternalJson(expected) !==
    canonicalFrenchInternalJson(actual)
  ) {
    throw new Error(`french-publication-key-order-mismatch:${label}`);
  }
}

function readSelfHashedJson<T extends object>(
  path: string,
  hashKey: string,
  expectedHash: string | undefined,
  label: string
): T {
  const value = readJsonFile<T>(resolve(path), label);
  const record = value as Record<string, unknown>;
  const actualHash = record[hashKey];
  if (
    typeof actualHash !== "string" ||
    !SHA256_PATTERN.test(actualHash) ||
    (expectedHash !== undefined && actualHash !== expectedHash)
  ) {
    throw new Error(`french-publication-self-hash-invalid:${label}`);
  }
  const content = { ...record };
  delete content[hashKey];
  if (hashFrenchInternalJson(content) !== actualHash) {
    throw new Error(`french-publication-self-hash-mismatch:${label}`);
  }
  return value;
}

function readJsonFile<T>(path: string, label: string): T {
  assertRegularFile(path, label);
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    throw new Error(`french-publication-invalid-json:${label}`);
  }
}

function readJsonl<T>(path: string, label: string): T[] {
  assertRegularFile(path, label);
  const output: T[] = [];
  for (const [index, line] of readFileSync(path, "utf8")
    .split(/\r?\n/u)
    .entries()) {
    if (!line.trim()) continue;
    try {
      output.push(JSON.parse(line) as T);
    } catch {
      throw new Error(`french-publication-invalid-jsonl:${label}:${index + 1}`);
    }
  }
  if (output.length < 1) {
    throw new Error(`french-publication-empty-jsonl:${label}`);
  }
  return output;
}

function assertRegularFile(path: string, label: string): void {
  const absolute = resolve(path);
  if (!existsSync(absolute)) {
    throw new Error(`french-publication-source-missing:${label}`);
  }
  const stat = lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`french-publication-source-not-regular:${label}`);
  }
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
