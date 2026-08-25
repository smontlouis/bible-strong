import { createHash } from "node:crypto";

import {
  assertFrenchEntityCanonicalizationPlan,
  assertFrenchEntityCanonicalizationResolved,
  canonicalFrenchEntityPolicyForms,
  canonicalFrenchEntityJson,
  frenchEntityCanonicalSecondaryRelation,
  frenchEntityDirectNamedMatchEntityIds,
  finalizeFrenchCanonicalEntity,
  finalizeFrenchCanonicalEntryNamePolicy,
  finalizeFrenchEntityClassificationProof,
  hashFrenchEntityJson,
  isFrenchStandaloneProperNameCandidate,
  isFrenchUnboundAlternateNameCandidate,
  isFrenchUnboundNameCandidate,
  FRENCH_ENTITY_CANONICALIZATION_DEFAULT_EXPECTATIONS,
  type FrenchCanonicalEntryNamePolicy,
  type FrenchCanonicalEntityRecord,
  type FrenchEntityBinding,
  type FrenchEntityCanonicalizationCandidate,
  type FrenchEntityCanonicalizationCounts,
  type FrenchEntityCanonicalizationExpectations,
  type FrenchEntityCanonicalizationGateResult,
  type FrenchEntityCanonicalizationGroup,
  type FrenchEntityCanonicalizationPlan,
  type FrenchEntityCanonicalizationReviewUnit,
  type FrenchEntityEnglishParentHashes,
  type FrenchEntityNameConstraint,
  type FrenchEntityNameTreatment
} from "./frenchEntityCanonicalization.js";
import { normalizeFrenchEvidence } from "./frenchEditorialPolicy.js";

export const FRENCH_ENTITY_AGENT_POLICY_VERSION =
  "lexicon-v3-french-entity-agent-policy@4" as const;
export const FRENCH_ENTITY_AGENT_VIEW_SCHEMA_VERSION =
  "lexicon-v3-french-entity-agent-view@2" as const;
export const FRENCH_ENTITY_AGENT_INPUT_SCHEMA_VERSION =
  "lexicon-v3-french-entity-agent-input@2" as const;
export const FRENCH_ENTITY_AGENT_BATCH_MANIFEST_SCHEMA_VERSION =
  "lexicon-v3-french-entity-agent-batches@2" as const;
export const FRENCH_ENTITY_AGENT_PROPOSAL_SCHEMA_VERSION =
  "lexicon-v3-french-entity-agent-proposal@2" as const;
export const FRENCH_ENTITY_AGENT_ARBITRATION_SCHEMA_VERSION =
  "lexicon-v3-french-entity-agent-arbitration@1" as const;
export const FRENCH_ENTITY_AGENT_AUDIT_SCHEMA_VERSION =
  "lexicon-v3-french-entity-agent-audit@2" as const;
export const FRENCH_ENTITY_AGENT_MERGE_SCHEMA_VERSION =
  "lexicon-v3-french-entity-agent-merge@1" as const;
export const FRENCH_ENTITY_AGENT_TERMINAL_MERGE_SCHEMA_VERSION =
  "lexicon-v3-french-entity-agent-terminal-merge@1" as const;
export const FRENCH_ENTITY_AGENT_TERMINAL_GATE_SCHEMA_VERSION =
  "lexicon-v3-french-entity-agent-terminal-gate@1" as const;

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SPECIAL_NON_ENTITY_KEYS = new Set([
  "greek:G9048",
  "greek:G6160",
  "greek:G5514H",
  "greek:G2148",
  "greek:G2207"
]);

export type FrenchEntityAgentProposerRole = "proposerA" | "proposerB";
export type FrenchEntityAgentRole =
  | FrenchEntityAgentProposerRole
  | "arbiter"
  | "auditor";

export type FrenchEntityAgentUnitArtifactValidator = (input: {
  unitId: string;
  artifacts: FrenchEntityAgentUnitArtifacts;
  expectedInputHashes?: FrenchEntityAgentUnitInputHashes;
}) => void;

export interface FrenchEntityAgentEnglishMatch {
  entityId: number;
  significance: string;
  aliasEn: string;
  entityEn: string;
  category: string;
  type: string;
}

export interface FrenchEntityAgentCandidateView {
  entryKey: string;
  stepEntryId: number;
  identity: FrenchEntityCanonicalizationCandidate["identity"];
  englishParentHashes: FrenchEntityEnglishParentHashes;
  englishGloss: string;
  editorialStatus: FrenchEntityCanonicalizationCandidate["editorialStatus"];
  entityIds: number[];
  englishEntityMatches: FrenchEntityAgentEnglishMatch[];
  englishEntityForms: string[];
  initialTreatment: FrenchEntityNameTreatment;
  initialConstraint: FrenchEntityNameConstraint;
  allowedEvidenceHashes: string[];
  hardConstraints: {
    mustRemainNonEntity: boolean;
    exactStepSuffixRequired: true;
    historicalFrenchIsAuthoritative: false;
  };
}

export interface FrenchEntityAgentFrenchWitnesses {
  authority: "non-authoritative-review-witness-only";
  candidateFrenchForms: string[];
  concordanceForms: FrenchEntityCanonicalizationCandidate["sourceForms"]["concordanceForms"];
  historicalFrenchGloss: string | null;
}

export interface FrenchEntityAgentAnchoredEntity {
  entityId: number;
  primaryFr: string;
  anchorEntryKeys: string[];
  groupProofHash: string;
}

export interface FrenchEntityAgentViewBase {
  schemaVersion: typeof FRENCH_ENTITY_AGENT_VIEW_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_ENTITY_AGENT_POLICY_VERSION;
  role: FrenchEntityAgentProposerRole;
  unitId: string;
  planHash: string;
  releaseKey: string;
  releaseSnapshotFingerprint: string;
  reviewUnit: FrenchEntityCanonicalizationReviewUnit;
  ownerEntityIds: number[];
  entityGroups: FrenchEntityCanonicalizationGroup[];
  anchoredEntities: FrenchEntityAgentAnchoredEntity[];
  members: FrenchEntityAgentCandidateView[];
  viewHash: string;
}

export interface FrenchEntityAgentProposerAView extends FrenchEntityAgentViewBase {
  role: "proposerA";
}

export interface FrenchEntityAgentProposerBView extends FrenchEntityAgentViewBase {
  role: "proposerB";
  frenchWitnesses: Record<string, FrenchEntityAgentFrenchWitnesses>;
}

export type FrenchEntityAgentView =
  | FrenchEntityAgentProposerAView
  | FrenchEntityAgentProposerBView;

export function frenchEntityAgentUnboundNameEntryKeys(
  view: FrenchEntityAgentView
): string[] {
  if (
    view.reviewUnit.kind !== "no-entity" ||
    view.ownerEntityIds.length !== 0
  ) {
    return [];
  }
  return view.members
    .filter(
      (member) =>
        !member.hardConstraints.mustRemainNonEntity &&
        isFrenchUnboundNameCandidate({
          entryKey: member.entryKey,
          entityIds: member.entityIds,
          initialTreatment: member.initialTreatment,
          initialConstraint: member.initialConstraint,
          anchor: null
        })
    )
    .map((member) => member.entryKey)
    .sort(compareText);
}

export function isFrenchEntityAgentUnboundNameView(
  view: FrenchEntityAgentView
): boolean {
  return frenchEntityAgentUnboundNameEntryKeys(view).length > 0;
}

export function frenchEntityAgentUnboundAlternateNameEntryKeys(
  view: FrenchEntityAgentView
): string[] {
  return view.members
    .filter(
      (member) =>
        view.reviewUnit.kind === "no-entity" &&
        view.ownerEntityIds.length === 0 &&
        isFrenchUnboundAlternateNameCandidate({
          entryKey: member.entryKey,
          identity: member.identity,
          entityIds: member.entityIds,
          initialTreatment: member.initialTreatment,
          initialConstraint: member.initialConstraint,
          anchor: null
        })
    )
    .map((member) => member.entryKey)
    .sort(compareText);
}

export function isFrenchEntityAgentMixedCanonicalView(
  view: FrenchEntityAgentView
): boolean {
  return (
    view.reviewUnit.kind === "multi-entity" &&
    view.members.some((member) => member.entityIds.length > 1)
  );
}

export interface FrenchEntityAgentInputArtifact {
  schemaVersion: typeof FRENCH_ENTITY_AGENT_INPUT_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_ENTITY_AGENT_POLICY_VERSION;
  role: FrenchEntityAgentProposerRole;
  planHash: string;
  releaseKey: string;
  releaseSnapshotFingerprint: string;
  unitIds: string[];
  views: FrenchEntityAgentView[];
  inputHash: string;
}

export interface FrenchEntityAgentBatchInputProof {
  relativePath: string;
  sha256: string;
  bytes: number;
  logicalHash: string;
}

export interface FrenchEntityAgentBatchRecord {
  batchId: string;
  unitIds: string[];
  selectionHash: string;
  proposerA: FrenchEntityAgentBatchInputProof;
  proposerB: FrenchEntityAgentBatchInputProof;
  batchHash: string;
}

export interface FrenchEntityAgentOwner {
  entityId: number;
  resolution: "anchored" | "agent";
  unitId: string | null;
  anchorPrimaryFr: string | null;
  groupProofHash: string;
}

export interface FrenchEntityAgentBatchManifest {
  schemaVersion: typeof FRENCH_ENTITY_AGENT_BATCH_MANIFEST_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_ENTITY_AGENT_POLICY_VERSION;
  plan: {
    path: string;
    fileDigest: string;
    planHash: string;
    releaseKey: string;
    releaseSnapshotFingerprint: string;
    counts: FrenchEntityCanonicalizationCounts;
  };
  namespace: string;
  batching: { maxUnits: number; maxInputBytes: number };
  counts: { units: number; batches: number; agentOwnedEntities: number };
  owners: FrenchEntityAgentOwner[];
  batches: FrenchEntityAgentBatchRecord[];
  manifestHash: string;
}

export interface BuildFrenchEntityAgentBatchesInput {
  plan: FrenchEntityCanonicalizationPlan;
  planPath: string;
  planFileDigest: string;
  expectedReleaseKey: string;
  maxUnits?: number;
  maxInputBytes?: number;
  expectations?: FrenchEntityCanonicalizationExpectations;
}

export interface FrenchEntityAgentBatchBuild {
  manifest: FrenchEntityAgentBatchManifest;
  files: Map<string, string>;
}

export interface FrenchEntityAgentPrimaryProposal {
  entityId: number;
  primaryFr: string;
  evidenceHashes: string[];
  reasons: string[];
}

export interface FrenchEntityAgentMemberProposal {
  entryKey: string;
  treatment: Exclude<FrenchEntityNameTreatment, "unresolved">;
  entityBindings: FrenchEntityBinding[];
  constraint: Exclude<FrenchEntityNameConstraint, "blocked">;
  primaryFr: string | null;
  derivedFr: string | null;
  englishForms: string[];
  allowedFrenchForms: string[];
  evidenceHashes: string[];
  reasons: string[];
}

export interface FrenchEntityAgentProposal {
  schemaVersion: typeof FRENCH_ENTITY_AGENT_PROPOSAL_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_ENTITY_AGENT_POLICY_VERSION;
  role: FrenchEntityAgentProposerRole;
  unitId: string;
  inputHash: string;
  canonicalEntities: FrenchEntityAgentPrimaryProposal[];
  memberPolicies: FrenchEntityAgentMemberProposal[];
  proposalHash: string;
}

export interface FrenchEntityAgentArbitration {
  schemaVersion: typeof FRENCH_ENTITY_AGENT_ARBITRATION_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_ENTITY_AGENT_POLICY_VERSION;
  role: "arbiter";
  unitId: string;
  inputHash: string;
  selectedProposal: "proposalA" | "proposalB";
  selectedProposalHash: string;
  reasons: string[];
  arbitrationHash: string;
}

export interface FrenchEntityAgentAuditChecks {
  exactStepIdentity: "pass" | "fail";
  exactEnglishLineage: "pass" | "fail";
  canonicalPrimaryCoherence: "pass" | "fail";
  singularEditorialLemma: "pass" | "fail";
  explicitMemberRelations: "pass" | "fail";
  noCommonGlossForcedAsName: "pass" | "fail";
  frenchNaturalness: "pass" | "fail";
  historicalWitnessNotSoleAuthority: "pass" | "fail";
}

export interface FrenchEntityAgentAudit {
  schemaVersion: typeof FRENCH_ENTITY_AGENT_AUDIT_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_ENTITY_AGENT_POLICY_VERSION;
  role: "auditor";
  unitId: string;
  inputHash: string;
  auditedProposalHash: string;
  verdict: "safe" | "hold" | "block";
  checks: FrenchEntityAgentAuditChecks;
  reasons: string[];
  auditHash: string;
}

export interface FrenchEntityAgentUnitArtifacts {
  proposalA: FrenchEntityAgentProposal;
  proposalB: FrenchEntityAgentProposal;
  arbitration: FrenchEntityAgentArbitration;
  audit: FrenchEntityAgentAudit;
}

export type FrenchEntityAgentUnitInputHashes = Record<
  FrenchEntityAgentRole,
  string
>;

export interface FrenchEntityAgentMergeResult {
  schemaVersion: typeof FRENCH_ENTITY_AGENT_MERGE_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_ENTITY_AGENT_POLICY_VERSION;
  planHash: string;
  canonicalEntities: FrenchCanonicalEntityRecord[];
  entryPolicies: FrenchCanonicalEntryNamePolicy[];
  gate: FrenchEntityCanonicalizationGateResult;
  mergeHash: string;
}

export interface FrenchEntityAgentTerminalGateResult {
  schemaVersion: typeof FRENCH_ENTITY_AGENT_TERMINAL_GATE_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_ENTITY_AGENT_POLICY_VERSION;
  planHash: string;
  reviewUnitCount: number;
  safeUnitCount: number;
  quarantinedUnitCount: number;
  canonicalEntityCount: number;
  canonicalPolicyCount: number;
  exactDispositionCoverage: true;
  unsafePropagationCount: 0;
  gateHash: string;
}

export interface FrenchEntityAgentTerminalMergeResult {
  schemaVersion: typeof FRENCH_ENTITY_AGENT_TERMINAL_MERGE_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_ENTITY_AGENT_POLICY_VERSION;
  planHash: string;
  canonicalEntities: FrenchCanonicalEntityRecord[];
  entryPolicies: FrenchCanonicalEntryNamePolicy[];
  safeUnitIds: string[];
  quarantinedUnitIds: string[];
  unresolvedEntityIds: number[];
  gate: FrenchEntityAgentTerminalGateResult;
  mergeHash: string;
}

interface FrenchEntityEnglishMention {
  normalized: string;
  entityId: number;
}

/**
 * Finds canonical entities named inside another candidate's English
 * entity/alias evidence. Matches are token-bounded, longest first, and kept
 * only when the English form resolves to one unique entity id globally.
 */
export function frenchEntityAgentRequiredCanonicalComponentIds(input: {
  plan: FrenchEntityCanonicalizationPlan;
  candidate: FrenchEntityCanonicalizationCandidate;
}): number[] {
  return requiredCanonicalComponentIds(
    input.candidate,
    buildFrenchEntityEnglishMentionIndex(input.plan)
  );
}

export function frenchEntityAgentMissingCanonicalComponentIds(input: {
  plan: FrenchEntityCanonicalizationPlan;
  candidate: FrenchEntityCanonicalizationCandidate;
  selectedFrench: string;
  canonicalEntities: readonly Pick<
    FrenchCanonicalEntityRecord,
    "entityId" | "normalizedPrimaryFr"
  >[];
}): number[] {
  const canonicalById = new Map(
    input.canonicalEntities.map((entity) => [entity.entityId, entity])
  );
  return missingCanonicalComponentIds(
    input.candidate,
    input.selectedFrench,
    canonicalById,
    buildFrenchEntityEnglishMentionIndex(input.plan)
  );
}

export function buildFrenchEntityAgentBatches(
  input: BuildFrenchEntityAgentBatchesInput
): FrenchEntityAgentBatchBuild {
  const expectations =
    input.expectations ?? FRENCH_ENTITY_CANONICALIZATION_DEFAULT_EXPECTATIONS;
  assertFrenchEntityCanonicalizationPlan(input.plan, expectations);
  assertSha256(input.planFileDigest, "plan-file-digest");
  if (
    !input.expectedReleaseKey.trim() ||
    input.plan.sourceLineage.releaseKey !== input.expectedReleaseKey
  ) {
    throw new Error(
      `french-entity-agent-release-mismatch:${input.plan.sourceLineage.releaseKey}:${input.expectedReleaseKey}`
    );
  }
  const maxUnits = input.maxUnits ?? 12;
  const maxInputBytes = input.maxInputBytes ?? 96 * 1024;
  if (
    !Number.isInteger(maxUnits) ||
    maxUnits < 1 ||
    !Number.isInteger(maxInputBytes) ||
    maxInputBytes < 4_096
  ) {
    throw new Error("french-entity-agent-batch-budget-invalid");
  }
  const candidates = candidateMap(input.plan);
  assertSpecialNonEntities(candidates);
  const owners = buildOwners(input.plan, candidates);
  const ownerUnitByEntity = new Map(
    owners
      .filter((owner) => owner.resolution === "agent")
      .map((owner) => [owner.entityId, owner.unitId as string])
  );
  const anchorByEntity = new Map(
    owners
      .filter((owner) => owner.resolution === "anchored")
      .map((owner) => [
        owner.entityId,
        {
          entityId: owner.entityId,
          primaryFr: owner.anchorPrimaryFr as string,
          anchorEntryKeys:
            input.plan.entityGroups.find(
              (group) => group.entityId === owner.entityId
            )?.anchorEntryKeys ?? [],
          groupProofHash: owner.groupProofHash
        }
      ])
  );
  const groupsById = new Map(
    input.plan.entityGroups.map((group) => [group.entityId, group])
  );
  const viewsByRole = {
    proposerA: new Map<string, FrenchEntityAgentProposerAView>(),
    proposerB: new Map<string, FrenchEntityAgentProposerBView>()
  };
  for (const unit of input.plan.reviewUnits) {
    const ownerEntityIds = owners
      .filter((owner) => owner.unitId === unit.unitId)
      .map((owner) => owner.entityId)
      .sort((left, right) => left - right);
    const entityGroups = unit.entityIds.map((entityId) => {
      const group = groupsById.get(entityId);
      if (!group) {
        throw new Error(
          `french-entity-agent-unit-group-missing:${unit.unitId}:${entityId}`
        );
      }
      return group;
    });
    const relatedAnchors = unit.entityIds
      .map((entityId) => anchorByEntity.get(entityId))
      .filter(
        (anchor): anchor is FrenchEntityAgentAnchoredEntity =>
          anchor !== undefined
      );
    const members = unit.reviewEntryKeys.map((entryKey) => {
      const candidate = candidates.get(entryKey);
      if (!candidate) {
        throw new Error(
          `french-entity-agent-unit-member-missing:${unit.unitId}:${entryKey}`
        );
      }
      return candidateView(candidate, entityGroups);
    });
    const common = {
      schemaVersion: FRENCH_ENTITY_AGENT_VIEW_SCHEMA_VERSION,
      policyVersion: FRENCH_ENTITY_AGENT_POLICY_VERSION,
      unitId: unit.unitId,
      planHash: input.plan.planHash,
      releaseKey: input.plan.sourceLineage.releaseKey,
      releaseSnapshotFingerprint:
        input.plan.sourceLineage.releaseSnapshotFingerprint,
      reviewUnit: unit,
      ownerEntityIds,
      entityGroups,
      anchoredEntities: relatedAnchors,
      members
    };
    const viewA = finalizeView({ ...common, role: "proposerA" });
    assertProposerABlind(viewA);
    const frenchWitnesses = Object.fromEntries(
      unit.reviewEntryKeys.map((entryKey) => {
        const candidate = candidates.get(entryKey);
        if (!candidate) throw new Error("french-entity-agent-member-missing");
        return [
          entryKey,
          {
            authority: "non-authoritative-review-witness-only" as const,
            candidateFrenchForms: candidate.sourceForms.candidateFrenchForms,
            concordanceForms: candidate.sourceForms.concordanceForms,
            historicalFrenchGloss: candidate.sourceForms.historicalFrenchGloss
          }
        ];
      })
    );
    const viewB = finalizeView({
      ...common,
      role: "proposerB",
      frenchWitnesses
    });
    viewsByRole.proposerA.set(unit.unitId, viewA);
    viewsByRole.proposerB.set(unit.unitId, viewB);
    for (const entityId of ownerEntityIds) {
      if (ownerUnitByEntity.get(entityId) !== unit.unitId) {
        throw new Error("french-entity-agent-owner-replay");
      }
    }
  }

  const groups = batchUnitIds(
    input.plan.reviewUnits.map((unit) => unit.unitId),
    viewsByRole,
    maxUnits,
    maxInputBytes
  );
  const files = new Map<string, string>();
  const batches = groups.map((unitIds, index) => {
    const selectionHash = hashFrenchEntityJson(unitIds);
    const batchStem = `entities-${String(index + 1).padStart(4, "0")}-${selectionHash.slice(0, 10)}`;
    const a = finalizeInputArtifact(
      "proposerA",
      input.plan,
      unitIds.map((unitId) => requiredMap(viewsByRole.proposerA, unitId))
    );
    const b = finalizeInputArtifact(
      "proposerB",
      input.plan,
      unitIds.map((unitId) => requiredMap(viewsByRole.proposerB, unitId))
    );
    const aPath = `batches/${batchStem}/proposer-a-input.json`;
    const bPath = `batches/${batchStem}/proposer-b-input.json`;
    const aText = `${canonicalFrenchEntityJson(a)}\n`;
    const bText = `${canonicalFrenchEntityJson(b)}\n`;
    files.set(aPath, aText);
    files.set(bPath, bText);
    const proposerA = inputProof(aPath, aText, a.inputHash);
    const proposerB = inputProof(bPath, bText, b.inputHash);
    const withoutHash = {
      batchId: batchStem,
      unitIds,
      selectionHash,
      proposerA,
      proposerB
    };
    return {
      ...withoutHash,
      batchHash: hashFrenchEntityJson(withoutHash)
    };
  });
  const namespace = `/fr-entities/${safeNamespace(input.expectedReleaseKey)}`;
  const content = {
    schemaVersion: FRENCH_ENTITY_AGENT_BATCH_MANIFEST_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_AGENT_POLICY_VERSION,
    plan: {
      path: input.planPath,
      fileDigest: input.planFileDigest,
      planHash: input.plan.planHash,
      releaseKey: input.plan.sourceLineage.releaseKey,
      releaseSnapshotFingerprint:
        input.plan.sourceLineage.releaseSnapshotFingerprint,
      counts: input.plan.counts
    },
    namespace,
    batching: { maxUnits, maxInputBytes },
    counts: {
      units: input.plan.reviewUnits.length,
      batches: batches.length,
      agentOwnedEntities: owners.filter((owner) => owner.resolution === "agent")
        .length
    },
    owners,
    batches
  };
  const manifest = {
    ...content,
    manifestHash: hashFrenchEntityJson(content)
  };
  assertFrenchEntityAgentBatchManifest(manifest, input.plan, expectations);
  files.set("manifest.json", `${canonicalFrenchEntityJson(manifest)}\n`);
  return { manifest, files };
}

export function assertFrenchEntityAgentBatchManifest(
  manifest: FrenchEntityAgentBatchManifest,
  plan: FrenchEntityCanonicalizationPlan,
  expectations: FrenchEntityCanonicalizationExpectations = FRENCH_ENTITY_CANONICALIZATION_DEFAULT_EXPECTATIONS
): void {
  assertFrenchEntityCanonicalizationPlan(plan, expectations);
  const { manifestHash, ...content } = manifest;
  if (
    manifest.schemaVersion !==
      FRENCH_ENTITY_AGENT_BATCH_MANIFEST_SCHEMA_VERSION ||
    manifest.policyVersion !== FRENCH_ENTITY_AGENT_POLICY_VERSION ||
    hashFrenchEntityJson(content) !== manifestHash ||
    manifest.plan.planHash !== plan.planHash ||
    manifest.plan.releaseKey !== plan.sourceLineage.releaseKey ||
    manifest.plan.releaseSnapshotFingerprint !==
      plan.sourceLineage.releaseSnapshotFingerprint ||
    canonicalFrenchEntityJson(manifest.plan.counts) !==
      canonicalFrenchEntityJson(plan.counts) ||
    manifest.counts.units !== plan.reviewUnits.length ||
    manifest.counts.batches !== manifest.batches.length ||
    manifest.counts.agentOwnedEntities !==
      manifest.owners.filter((owner) => owner.resolution === "agent").length
  ) {
    throw new Error("french-entity-agent-manifest-invalid");
  }
  assertSha256(manifest.plan.fileDigest, "manifest-plan-file");
  const units = manifest.batches.flatMap((batch) => batch.unitIds);
  const expectedUnits = plan.reviewUnits.map((unit) => unit.unitId);
  if (
    new Set(units).size !== units.length ||
    canonicalFrenchEntityJson(units) !==
      canonicalFrenchEntityJson(expectedUnits)
  ) {
    throw new Error("french-entity-agent-manifest-coverage");
  }
  const batchIds = new Set<string>();
  for (const batch of manifest.batches) {
    const { batchHash, ...batchContent } = batch;
    if (
      batchIds.has(batch.batchId) ||
      hashFrenchEntityJson(batchContent) !== batchHash ||
      hashFrenchEntityJson(batch.unitIds) !== batch.selectionHash ||
      batch.unitIds.length > manifest.batching.maxUnits ||
      Math.max(batch.proposerA.bytes, batch.proposerB.bytes) >
        manifest.batching.maxInputBytes
    ) {
      throw new Error(
        `french-entity-agent-manifest-batch-invalid:${batch.batchId}`
      );
    }
    batchIds.add(batch.batchId);
    assertInputProof(batch.proposerA);
    assertInputProof(batch.proposerB);
  }
  const replayOwners = buildOwners(plan, candidateMap(plan));
  if (
    canonicalFrenchEntityJson(replayOwners) !==
    canonicalFrenchEntityJson(manifest.owners)
  ) {
    throw new Error("french-entity-agent-owner-drift");
  }
}

export function assertFrenchEntityAgentInputArtifact(
  input: FrenchEntityAgentInputArtifact,
  role: FrenchEntityAgentProposerRole,
  batch: FrenchEntityAgentBatchRecord,
  plan: FrenchEntityCanonicalizationPlan
): void {
  const { inputHash, ...content } = input;
  if (
    input.schemaVersion !== FRENCH_ENTITY_AGENT_INPUT_SCHEMA_VERSION ||
    input.policyVersion !== FRENCH_ENTITY_AGENT_POLICY_VERSION ||
    input.role !== role ||
    input.planHash !== plan.planHash ||
    input.releaseKey !== plan.sourceLineage.releaseKey ||
    input.releaseSnapshotFingerprint !==
      plan.sourceLineage.releaseSnapshotFingerprint ||
    hashFrenchEntityJson(content) !== inputHash ||
    canonicalFrenchEntityJson(input.unitIds) !==
      canonicalFrenchEntityJson(batch.unitIds) ||
    input.views.length !== input.unitIds.length
  ) {
    throw new Error("french-entity-agent-input-invalid");
  }
  for (let index = 0; index < input.views.length; index += 1) {
    const view = input.views[index];
    if (!view || view.unitId !== input.unitIds[index] || view.role !== role) {
      throw new Error("french-entity-agent-input-view-order");
    }
    assertViewHash(view);
    if (role === "proposerA") {
      assertProposerABlind(view as FrenchEntityAgentProposerAView);
    }
  }
}

export interface FrenchEntityAgentProposalOutputContract {
  role: FrenchEntityAgentProposerRole;
  unitId: string;
  inputHash: string;
  ownerEntityIds: number[];
  reviewEntryKeys: string[];
  unboundNameEntryKeys?: string[];
}

export interface FrenchEntityAgentArbitrationOutputContract {
  unitId: string;
  inputHash: string;
  proposalAHash: string;
  proposalBHash: string;
}

export interface FrenchEntityAgentAuditOutputContract {
  unitId: string;
  inputHash: string;
  auditedProposalHash: string;
  selectedProposalRole: FrenchEntityAgentProposerRole;
  evidenceConflictCodes: string[];
}

export function frenchEntityAgentProposalResponseSchema(
  role: FrenchEntityAgentProposerRole,
  outputContracts: readonly FrenchEntityAgentProposalOutputContract[]
): object {
  assertOutputContracts(outputContracts, "proposal");
  if (outputContracts.some((contract) => contract.role !== role)) {
    throw new Error("french-entity-agent-proposal-schema-role-mismatch");
  }
  for (const contract of outputContracts) {
    const ownerEntityIds = new Set(contract.ownerEntityIds);
    const reviewEntryKeys = new Set(contract.reviewEntryKeys);
    if (
      ownerEntityIds.size !== contract.ownerEntityIds.length ||
      contract.ownerEntityIds.some(
        (entityId) => !Number.isInteger(entityId) || entityId < 1
      ) ||
      reviewEntryKeys.size !== contract.reviewEntryKeys.length ||
      contract.reviewEntryKeys.length === 0 ||
      contract.reviewEntryKeys.some((entryKey) => !entryKey)
    ) {
      throw new Error("french-entity-agent-proposal-schema-coverage-invalid");
    }
  }
  return {
    type: "object",
    additionalProperties: false,
    required: ["proposals"],
    properties: {
      proposals: {
        type: "array",
        minItems: outputContracts.length,
        maxItems: outputContracts.length,
        items: {
          anyOf: outputContracts.map((contract) =>
            proposalOutputItemSchema(contract)
          )
        }
      }
    }
  };
}

export function frenchEntityAgentArbitrationResponseSchema(
  outputContracts: readonly FrenchEntityAgentArbitrationOutputContract[]
): object {
  assertOutputContracts(outputContracts, "arbitration");
  for (const contract of outputContracts) {
    assertSha256(contract.proposalAHash, "arbitration-schema-proposal-a");
    assertSha256(contract.proposalBHash, "arbitration-schema-proposal-b");
  }
  return {
    type: "object",
    additionalProperties: false,
    required: ["decisions"],
    properties: {
      decisions: {
        type: "array",
        minItems: outputContracts.length,
        maxItems: outputContracts.length,
        items: {
          anyOf: outputContracts.flatMap((contract) => [
            arbitrationOutputItemSchema(
              contract,
              "proposalA",
              contract.proposalAHash
            ),
            arbitrationOutputItemSchema(
              contract,
              "proposalB",
              contract.proposalBHash
            )
          ])
        }
      }
    }
  };
}

export function frenchEntityAgentAuditResponseSchema(
  outputContracts: readonly FrenchEntityAgentAuditOutputContract[]
): object {
  assertOutputContracts(outputContracts, "audit");
  for (const contract of outputContracts) {
    assertSha256(contract.auditedProposalHash, "audit-schema-proposal");
    if (
      contract.selectedProposalRole !== "proposerA" &&
      contract.selectedProposalRole !== "proposerB"
    ) {
      throw new Error("french-entity-agent-audit-schema-role-invalid");
    }
    if (
      !Array.isArray(contract.evidenceConflictCodes) ||
      contract.evidenceConflictCodes.some(
        (code) => typeof code !== "string" || !code.trim()
      ) ||
      new Set(contract.evidenceConflictCodes).size !==
        contract.evidenceConflictCodes.length
    ) {
      throw new Error("french-entity-agent-audit-schema-conflicts-invalid");
    }
  }
  return {
    type: "object",
    additionalProperties: false,
    required: ["audits"],
    properties: {
      audits: {
        type: "array",
        minItems: outputContracts.length,
        maxItems: outputContracts.length,
        items: {
          anyOf: outputContracts.map((contract) =>
            auditOutputItemSchema(contract)
          )
        }
      }
    }
  };
}

export function parseFrenchEntityAgentProposalResponse(input: {
  text: string;
  role: FrenchEntityAgentProposerRole;
  artifact: FrenchEntityAgentInputArtifact;
  plan: FrenchEntityCanonicalizationPlan;
  owners: readonly FrenchEntityAgentOwner[];
  /**
   * Additive remediation binds a proposal to the complete round input rather
   * than to the unchanged base view alone. Base executions omit this map and
   * retain the historical viewHash contract.
   */
  inputHashes?: ReadonlyMap<string, string>;
}): FrenchEntityAgentProposal[] {
  const root = parseObject(input.text, "proposal-response");
  assertExactKeys(root, ["proposals"], "proposal-response");
  if (!Array.isArray(root.proposals)) {
    throw new Error("french-entity-agent-proposals-not-array");
  }
  const rawByUnit = uniqueRawByUnit(root.proposals, "proposal");
  const candidates = candidateMap(input.plan);
  const viewByUnit = new Map(
    input.artifact.views.map((view) => [view.unitId, view])
  );
  if (
    input.inputHashes &&
    (canonicalFrenchEntityJson(
      [...input.inputHashes.keys()].sort(compareText)
    ) !==
      canonicalFrenchEntityJson(
        [...input.artifact.unitIds].sort(compareText)
      ) ||
      [...input.inputHashes.values()].some(
        (inputHash) => !SHA256_PATTERN.test(inputHash)
      ))
  ) {
    throw new Error("french-entity-agent-proposal-input-coverage");
  }
  return input.artifact.unitIds.map((unitId) => {
    const raw = rawByUnit.get(unitId);
    const view = viewByUnit.get(unitId);
    if (!raw || !view) {
      throw new Error(`french-entity-agent-proposal-missing:${unitId}`);
    }
    const expectedInputHash = input.inputHashes
      ? input.inputHashes.get(unitId)
      : view.viewHash;
    if (!expectedInputHash) {
      throw new Error(`french-entity-agent-proposal-input-missing:${unitId}`);
    }
    return finalizeAndValidateProposal(
      raw,
      input.role,
      view,
      input.owners,
      expectedInputHash,
      candidates
    );
  });
}

export function parseFrenchEntityAgentArbitrationResponse(input: {
  text: string;
  unitIds: readonly string[];
  inputHashes: ReadonlyMap<string, string>;
  proposalA: ReadonlyMap<string, FrenchEntityAgentProposal>;
  proposalB: ReadonlyMap<string, FrenchEntityAgentProposal>;
}): FrenchEntityAgentArbitration[] {
  const root = parseObject(input.text, "arbitration-response");
  assertExactKeys(root, ["decisions"], "arbitration-response");
  if (!Array.isArray(root.decisions)) {
    throw new Error("french-entity-agent-decisions-not-array");
  }
  const rawByUnit = uniqueRawByUnit(root.decisions, "arbitration");
  return input.unitIds.map((unitId) => {
    const raw = rawByUnit.get(unitId);
    if (!raw)
      throw new Error(`french-entity-agent-arbitration-missing:${unitId}`);
    assertExactKeys(
      raw,
      [
        "schemaVersion",
        "role",
        "unitId",
        "inputHash",
        "selectedProposal",
        "selectedProposalHash",
        "reasons"
      ],
      `arbitration:${unitId}`
    );
    const selected = raw.selectedProposal;
    const expectedProposal =
      selected === "proposalA"
        ? input.proposalA.get(unitId)
        : selected === "proposalB"
          ? input.proposalB.get(unitId)
          : null;
    const expectedInputHash = input.inputHashes.get(unitId);
    if (
      !expectedInputHash ||
      raw.schemaVersion !== FRENCH_ENTITY_AGENT_ARBITRATION_SCHEMA_VERSION ||
      raw.role !== "arbiter" ||
      raw.inputHash !== expectedInputHash ||
      !expectedProposal ||
      raw.selectedProposalHash !== expectedProposal.proposalHash
    ) {
      throw new Error(
        `french-entity-agent-arbitration-selection-invalid:${unitId}`
      );
    }
    const reasons = stringArray(
      raw.reasons,
      `arbitration-reasons:${unitId}`,
      true
    );
    const content = {
      schemaVersion: FRENCH_ENTITY_AGENT_ARBITRATION_SCHEMA_VERSION,
      policyVersion: FRENCH_ENTITY_AGENT_POLICY_VERSION,
      role: "arbiter" as const,
      unitId,
      inputHash: expectedInputHash,
      selectedProposal: selected as "proposalA" | "proposalB",
      selectedProposalHash: expectedProposal.proposalHash,
      reasons
    };
    return { ...content, arbitrationHash: hashFrenchEntityJson(content) };
  });
}

export function parseFrenchEntityAgentAuditResponse(input: {
  text: string;
  unitIds: readonly string[];
  inputHashes: ReadonlyMap<string, string>;
  arbitrations: ReadonlyMap<string, FrenchEntityAgentArbitration>;
  selectedProposalRoles: ReadonlyMap<string, FrenchEntityAgentProposerRole>;
  sourceViews: ReadonlyMap<string, FrenchEntityAgentProposerBView>;
  selectedProposals: ReadonlyMap<string, FrenchEntityAgentProposal>;
  /**
   * Remediation may supply a deterministically reduced conflict set after it
   * has sealed and replayed a proof. Base audit callers must omit this map and
   * therefore retain the ordinary fail-closed conflict calculation.
   */
  effectiveEvidenceConflictCodes?: ReadonlyMap<string, readonly string[]>;
}): FrenchEntityAgentAudit[] {
  const root = parseObject(input.text, "audit-response");
  assertExactKeys(root, ["audits"], "audit-response");
  if (!Array.isArray(root.audits)) {
    throw new Error("french-entity-agent-audits-not-array");
  }
  const rawByUnit = uniqueRawByUnit(root.audits, "audit");
  return input.unitIds.map((unitId) => {
    const raw = rawByUnit.get(unitId);
    const arbitration = input.arbitrations.get(unitId);
    if (!raw || !arbitration) {
      throw new Error(`french-entity-agent-audit-missing:${unitId}`);
    }
    assertExactKeys(
      raw,
      [
        "schemaVersion",
        "role",
        "unitId",
        "inputHash",
        "auditedProposalHash",
        "verdict",
        "checks",
        "reasons"
      ],
      `audit:${unitId}`
    );
    const expectedInputHash = input.inputHashes.get(unitId);
    const selectedProposalRole = input.selectedProposalRoles.get(unitId);
    const sourceView = input.sourceViews.get(unitId);
    const selectedProposal = input.selectedProposals.get(unitId);
    const checks = parseAuditChecks(raw.checks, unitId);
    const reasons = stringArray(raw.reasons, `audit-reasons:${unitId}`, false);
    const evidenceConflictCodes = (() => {
      const remediated = input.effectiveEvidenceConflictCodes?.get(unitId);
      if (remediated) {
        if (
          canonicalFrenchEntityJson(remediated) !==
            canonicalFrenchEntityJson(
              [...new Set(remediated)].sort(compareText)
            ) ||
          remediated.some((code) => typeof code !== "string" || !code.trim())
        ) {
          throw new Error(
            `french-entity-agent-audit-effective-conflicts-invalid:${unitId}`
          );
        }
        return [...remediated];
      }
      return sourceView && selectedProposal
        ? frenchEntityAgentEvidenceConflictCodes({
            sourceView,
            selectedProposal
          })
        : [];
    })();
    const mechanicallyProvenChecks = [
      "exactStepIdentity",
      "exactEnglishLineage",
      "explicitMemberRelations"
    ] as const;
    const mechanicalFailure = mechanicallyProvenChecks.some(
      (key) => checks[key] !== "pass"
    );
    const semanticFailure = auditCheckKeys().some(
      (key) =>
        !mechanicallyProvenChecks.includes(
          key as (typeof mechanicallyProvenChecks)[number]
        ) && checks[key] === "fail"
    );
    if (
      !expectedInputHash ||
      !selectedProposalRole ||
      !sourceView ||
      !selectedProposal ||
      selectedProposal.role !== selectedProposalRole ||
      selectedProposal.proposalHash !== arbitration.selectedProposalHash ||
      raw.schemaVersion !== FRENCH_ENTITY_AGENT_AUDIT_SCHEMA_VERSION ||
      raw.role !== "auditor" ||
      raw.inputHash !== expectedInputHash ||
      raw.auditedProposalHash !== arbitration.selectedProposalHash ||
      mechanicalFailure ||
      (evidenceConflictCodes.length > 0 &&
        (raw.verdict === "safe" ||
          checks.canonicalPrimaryCoherence !== "fail")) ||
      (raw.verdict !== "safe" &&
        raw.verdict !== "hold" &&
        raw.verdict !== "block") ||
      (raw.verdict === "safe" &&
        (Object.values(checks).some((value) => value !== "pass") ||
          reasons.length !== 0)) ||
      (raw.verdict !== "safe" && (reasons.length === 0 || !semanticFailure))
    ) {
      throw new Error(`french-entity-agent-audit-invalid:${unitId}`);
    }
    const content = {
      schemaVersion: FRENCH_ENTITY_AGENT_AUDIT_SCHEMA_VERSION,
      policyVersion: FRENCH_ENTITY_AGENT_POLICY_VERSION,
      role: "auditor" as const,
      unitId,
      inputHash: expectedInputHash,
      auditedProposalHash: arbitration.selectedProposalHash,
      verdict: raw.verdict,
      checks,
      reasons
    } as const;
    return { ...content, auditHash: hashFrenchEntityJson(content) };
  });
}

export function mergeFrenchEntityAgentArtifacts(input: {
  plan: FrenchEntityCanonicalizationPlan;
  manifest: FrenchEntityAgentBatchManifest;
  artifacts: ReadonlyMap<string, FrenchEntityAgentUnitArtifacts>;
  expectedInputHashesByUnit?: ReadonlyMap<
    string,
    FrenchEntityAgentUnitInputHashes
  >;
  validateUnitArtifacts?: FrenchEntityAgentUnitArtifactValidator;
  expectations?: FrenchEntityCanonicalizationExpectations;
}): FrenchEntityAgentMergeResult {
  const expectations =
    input.expectations ?? FRENCH_ENTITY_CANONICALIZATION_DEFAULT_EXPECTATIONS;
  assertFrenchEntityAgentBatchManifest(
    input.manifest,
    input.plan,
    expectations
  );
  if (input.artifacts.size !== input.plan.reviewUnits.length) {
    throw new Error(
      `french-entity-agent-merge-unit-coverage:${input.artifacts.size}:${input.plan.reviewUnits.length}`
    );
  }
  if (
    input.expectedInputHashesByUnit &&
    input.expectedInputHashesByUnit.size !== input.plan.reviewUnits.length
  ) {
    throw new Error(
      `french-entity-agent-merge-input-coverage:${input.expectedInputHashesByUnit.size}:${input.plan.reviewUnits.length}`
    );
  }
  const candidates = candidateMap(input.plan);
  const selectedByUnit = new Map<string, FrenchEntityAgentProposal>();
  for (const unit of input.plan.reviewUnits) {
    const artifacts = input.artifacts.get(unit.unitId);
    if (!artifacts) {
      throw new Error(`french-entity-agent-merge-unit-missing:${unit.unitId}`);
    }
    const expectedInputHashes = input.expectedInputHashesByUnit
      ? requiredMap(input.expectedInputHashesByUnit, unit.unitId)
      : undefined;
    if (input.validateUnitArtifacts) {
      input.validateUnitArtifacts({
        unitId: unit.unitId,
        artifacts,
        ...(expectedInputHashes ? { expectedInputHashes } : {})
      });
    } else {
      assertFrenchEntityAgentUnitArtifacts({
        plan: input.plan,
        manifest: input.manifest,
        unitId: unit.unitId,
        artifacts,
        ...(expectedInputHashes ? { expectedInputHashes } : {})
      });
    }
    const selected = selectedProposalFor(artifacts);
    if (
      artifacts.arbitration.selectedProposalHash !== selected.proposalHash ||
      artifacts.audit.auditedProposalHash !== selected.proposalHash ||
      artifacts.audit.verdict !== "safe" ||
      Object.values(artifacts.audit.checks).some((value) => value !== "pass")
    ) {
      throw new Error(`french-entity-agent-merge-not-safe:${unit.unitId}`);
    }
    selectedByUnit.set(unit.unitId, selected);
  }

  const canonicalEntities = input.manifest.owners.map((owner) => {
    const group = input.plan.entityGroups.find(
      (value) => value.entityId === owner.entityId
    );
    if (!group) throw new Error("french-entity-agent-merge-group-missing");
    let primaryFr: string;
    if (owner.resolution === "anchored") {
      primaryFr = owner.anchorPrimaryFr ?? "";
    } else {
      const proposal = selectedByUnit.get(owner.unitId ?? "");
      const entity = proposal?.canonicalEntities.find(
        (value) => value.entityId === owner.entityId
      );
      if (!entity) {
        throw new Error(
          `french-entity-agent-merge-primary-missing:${owner.entityId}`
        );
      }
      primaryFr = entity.primaryFr;
    }
    return finalizeFrenchCanonicalEntity({
      entityId: group.entityId,
      primaryFr,
      category: group.category,
      type: group.type,
      memberEntryKeys: group.memberEntryKeys,
      sourceEntityHash: group.sourceEntityHash,
      groupProofHash: group.groupProofHash
    });
  });
  const canonicalById = new Map(
    canonicalEntities.map((entity) => [entity.entityId, entity])
  );
  const englishMentionIndex = buildFrenchEntityEnglishMentionIndex(input.plan);

  const entryPolicies: FrenchCanonicalEntryNamePolicy[] = [];
  for (const candidate of input.plan.anchors) {
    const anchor = candidate.anchor;
    if (!anchor) throw new Error("french-entity-agent-anchor-missing");
    const canonical = canonicalById.get(anchor.entityId);
    if (!canonical)
      throw new Error("french-entity-agent-anchor-entity-missing");
    const proof = finalizeFrenchEntityClassificationProof({
      sourceCandidateHash: candidate.candidateHash,
      sourceReviewUnitHash: null,
      decisionMethod: "deterministic-green-anchor",
      agentArtifacts: null,
      evidenceHashes: [candidate.sourceHashes.referenceEvidenceHash],
      reasons: ["deterministic-green-anchor-replayed"]
    });
    entryPolicies.push(
      finalizeFrenchCanonicalEntryNamePolicy({
        entryKey: candidate.entryKey,
        stepEntryId: candidate.stepEntryId,
        identity: candidate.identity,
        englishParentHashes: candidate.englishParentHashes,
        treatment: "canonical-name",
        entityBindings: [{ entityId: anchor.entityId, relation: "primary" }],
        constraint: "canonical",
        primaryFr: canonical.primaryFr,
        derivedFr: null,
        englishForms: [candidate.englishGloss],
        allowedFrenchForms: [canonical.primaryFr],
        classificationProof: proof
      })
    );
  }
  for (const unit of input.plan.reviewUnits) {
    const artifacts = input.artifacts.get(unit.unitId);
    const selected = selectedByUnit.get(unit.unitId);
    if (!artifacts || !selected)
      throw new Error("french-entity-agent-selected-missing");
    const memberByKey = new Map(
      selected.memberPolicies.map((member) => [member.entryKey, member])
    );
    for (const entryKey of unit.reviewEntryKeys) {
      const candidate = candidates.get(entryKey);
      const member = memberByKey.get(entryKey);
      if (!candidate || !member) {
        throw new Error(`french-entity-agent-member-merge-missing:${entryKey}`);
      }
      if (
        member.treatment === "title-or-epithet" ||
        member.treatment === "compound-name"
      ) {
        const selectedFrench = member.primaryFr ?? member.derivedFr ?? "";
        for (const componentEntityId of missingCanonicalComponentIds(
          candidate,
          selectedFrench,
          canonicalById,
          englishMentionIndex
        )) {
          throw new Error(
            `french-entity-agent-merge-component-drift:${entryKey}:${componentEntityId}`
          );
        }
      }
      const proof = finalizeFrenchEntityClassificationProof({
        sourceCandidateHash: candidate.candidateHash,
        sourceReviewUnitHash: unit.unitHash,
        decisionMethod: "internal-agent-adjudication",
        agentArtifacts: {
          proposerAHash: artifacts.proposalA.proposalHash,
          proposerBHash: artifacts.proposalB.proposalHash,
          arbiterHash: artifacts.arbitration.arbitrationHash,
          auditorHash: artifacts.audit.auditHash
        },
        evidenceHashes: member.evidenceHashes,
        reasons: member.reasons
      });
      entryPolicies.push(
        finalizeFrenchCanonicalEntryNamePolicy({
          entryKey,
          stepEntryId: candidate.stepEntryId,
          identity: candidate.identity,
          englishParentHashes: candidate.englishParentHashes,
          treatment: member.treatment,
          entityBindings: member.entityBindings,
          constraint: member.constraint,
          primaryFr:
            member.treatment === "canonical-name"
              ? (canonicalById.get(
                  member.entityBindings.find(
                    (binding) => binding.relation === "primary"
                  )?.entityId ?? -1
                )?.primaryFr ?? member.primaryFr)
              : member.primaryFr,
          derivedFr: member.derivedFr,
          englishForms: member.englishForms,
          allowedFrenchForms: member.allowedFrenchForms,
          classificationProof: proof
        })
      );
    }
  }
  canonicalEntities.sort((left, right) => left.entityId - right.entityId);
  entryPolicies.sort((left, right) =>
    compareText(left.entryKey, right.entryKey)
  );
  const gate = assertFrenchEntityCanonicalizationResolved({
    plan: input.plan,
    canonicalEntities,
    entryPolicies,
    expectations
  });
  const mergeContent = {
    schemaVersion: FRENCH_ENTITY_AGENT_MERGE_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_AGENT_POLICY_VERSION,
    planHash: input.plan.planHash,
    canonicalEntities,
    entryPolicies,
    gate
  };
  return {
    ...mergeContent,
    mergeHash: hashFrenchEntityJson(mergeContent)
  };
}

/**
 * Produces the publishable canonical subset after the bounded remediation
 * budget is exhausted. Unsafe units remain covered by the returned quarantine
 * partition, but none of their proposed French forms can enter these outputs.
 */
export function mergeFrenchEntityAgentArtifactsTerminal(input: {
  plan: FrenchEntityCanonicalizationPlan;
  manifest: FrenchEntityAgentBatchManifest;
  artifacts: ReadonlyMap<string, FrenchEntityAgentUnitArtifacts>;
  expectedInputHashesByUnit?: ReadonlyMap<
    string,
    FrenchEntityAgentUnitInputHashes
  >;
  validateUnitArtifacts?: FrenchEntityAgentUnitArtifactValidator;
  expectations?: FrenchEntityCanonicalizationExpectations;
}): FrenchEntityAgentTerminalMergeResult {
  const expectations =
    input.expectations ?? FRENCH_ENTITY_CANONICALIZATION_DEFAULT_EXPECTATIONS;
  assertFrenchEntityAgentBatchManifest(
    input.manifest,
    input.plan,
    expectations
  );
  if (input.artifacts.size !== input.plan.reviewUnits.length) {
    throw new Error(
      `french-entity-agent-terminal-unit-coverage:${input.artifacts.size}:${input.plan.reviewUnits.length}`
    );
  }
  if (
    input.expectedInputHashesByUnit &&
    input.expectedInputHashesByUnit.size !== input.plan.reviewUnits.length
  ) {
    throw new Error("french-entity-agent-terminal-input-coverage");
  }

  const unitById = new Map(
    input.plan.reviewUnits.map((unit) => [unit.unitId, unit] as const)
  );
  const selectedByUnit = new Map<string, FrenchEntityAgentProposal>();
  const quarantined = new Set<string>();
  for (const unit of input.plan.reviewUnits) {
    const artifacts = requiredMap(input.artifacts, unit.unitId);
    const expectedInputHashes = input.expectedInputHashesByUnit
      ? requiredMap(input.expectedInputHashesByUnit, unit.unitId)
      : undefined;
    if (input.validateUnitArtifacts) {
      input.validateUnitArtifacts({
        unitId: unit.unitId,
        artifacts,
        ...(expectedInputHashes ? { expectedInputHashes } : {})
      });
    } else {
      assertFrenchEntityAgentUnitArtifacts({
        plan: input.plan,
        manifest: input.manifest,
        unitId: unit.unitId,
        artifacts,
        ...(expectedInputHashes ? { expectedInputHashes } : {})
      });
    }
    if (
      artifacts.audit.verdict !== "safe" ||
      Object.values(artifacts.audit.checks).some((value) => value !== "pass")
    ) {
      quarantined.add(unit.unitId);
      continue;
    }
    selectedByUnit.set(unit.unitId, selectedProposalFor(artifacts));
  }

  const candidates = candidateMap(input.plan);
  const englishMentionIndex = buildFrenchEntityEnglishMentionIndex(input.plan);
  const componentEntryKeys = new Set(
    [...selectedByUnit.values()].flatMap((proposal) =>
      proposal.memberPolicies
        .filter(
          (policy) =>
            policy.treatment === "title-or-epithet" ||
            policy.treatment === "compound-name"
        )
        .map((policy) => policy.entryKey)
    )
  );
  const requiredComponentIdsByEntry = new Map(
    [...componentEntryKeys].map((entryKey) => [
      entryKey,
      requiredCanonicalComponentIds(
        requiredMap(candidates, entryKey),
        englishMentionIndex
      )
    ])
  );
  const canonicalComponents = new Map<
    number,
    { entityId: number; normalizedPrimaryFr: string }
  >();
  const ownedEntityIdsByUnit = new Map<string, number[]>();
  for (const owner of input.manifest.owners) {
    if (owner.resolution === "agent" && owner.unitId) {
      const owned = ownedEntityIdsByUnit.get(owner.unitId) ?? [];
      owned.push(owner.entityId);
      ownedEntityIdsByUnit.set(owner.unitId, owned);
    }
    const primaryFr =
      owner.resolution === "anchored"
        ? owner.anchorPrimaryFr
        : selectedByUnit
            .get(owner.unitId ?? "")
            ?.canonicalEntities.find(
              (entity) => entity.entityId === owner.entityId
            )?.primaryFr;
    if (primaryFr) {
      canonicalComponents.set(owner.entityId, {
        entityId: owner.entityId,
        normalizedPrimaryFr: normalizeFrenchEvidence(primaryFr)
      });
    }
  }

  const dependentsByEntityId = new Map<number, Set<string>>();
  for (const unit of input.plan.reviewUnits) {
    const selected = selectedByUnit.get(unit.unitId);
    if (!selected) continue;
    const dependencyIds = new Set([
      ...unit.entityIds,
      ...selected.canonicalEntities.map((entity) => entity.entityId),
      ...selected.memberPolicies.flatMap((policy) =>
        policy.entityBindings.map((binding) => binding.entityId)
      ),
      ...selected.memberPolicies.flatMap((policy) =>
        policy.treatment === "title-or-epithet" ||
        policy.treatment === "compound-name"
          ? requiredMap(requiredComponentIdsByEntry, policy.entryKey)
          : []
      )
    ]);
    for (const entityId of dependencyIds) {
      const dependents = dependentsByEntityId.get(entityId) ?? new Set();
      dependents.add(unit.unitId);
      dependentsByEntityId.set(entityId, dependents);
    }
    const componentDrift = selected.memberPolicies.some((policy) => {
      if (
        policy.treatment !== "title-or-epithet" &&
        policy.treatment !== "compound-name"
      ) {
        return false;
      }
      const boundedFrench = ` ${normalizeFrenchEvidence(
        policy.primaryFr ?? policy.derivedFr ?? ""
      )} `;
      return requiredMap(requiredComponentIdsByEntry, policy.entryKey).some(
        (entityId) => {
          const canonical = canonicalComponents.get(entityId);
          return (
            !canonical ||
            !boundedFrench.includes(` ${canonical.normalizedPrimaryFr} `)
          );
        }
      );
    });
    if (componentDrift) quarantined.add(unit.unitId);
  }

  const unresolvedEntityIds = new Set<number>();
  const unresolvedQueue: number[] = [];
  const enqueueOwnedEntities = (unitId: string): void => {
    for (const entityId of ownedEntityIdsByUnit.get(unitId) ?? []) {
      if (unresolvedEntityIds.has(entityId)) continue;
      unresolvedEntityIds.add(entityId);
      unresolvedQueue.push(entityId);
    }
  };
  for (const unitId of quarantined) enqueueOwnedEntities(unitId);
  for (let offset = 0; offset < unresolvedQueue.length; offset += 1) {
    const entityId = unresolvedQueue[offset];
    if (entityId === undefined) continue;
    for (const unitId of dependentsByEntityId.get(entityId) ?? []) {
      if (quarantined.has(unitId)) continue;
      quarantined.add(unitId);
      enqueueOwnedEntities(unitId);
    }
  }

  const safeUnitIds = [...unitById.keys()]
    .filter((unitId) => !quarantined.has(unitId))
    .sort(compareText);
  const quarantinedUnitIds = [...quarantined].sort(compareText);
  if (
    safeUnitIds.length + quarantinedUnitIds.length !==
      input.plan.reviewUnits.length ||
    safeUnitIds.some((unitId) => quarantined.has(unitId))
  ) {
    throw new Error("french-entity-agent-terminal-partition");
  }

  const canonicalEntities = input.manifest.owners.flatMap((owner) => {
    const group = input.plan.entityGroups.find(
      (value) => value.entityId === owner.entityId
    );
    if (!group) throw new Error("french-entity-agent-terminal-group-missing");
    if (unresolvedEntityIds.has(owner.entityId)) return [];
    let primaryFr: string;
    if (owner.resolution === "anchored") {
      primaryFr = owner.anchorPrimaryFr ?? "";
    } else {
      const proposal = selectedByUnit.get(owner.unitId ?? "");
      const entity = proposal?.canonicalEntities.find(
        (value) => value.entityId === owner.entityId
      );
      if (!entity || !owner.unitId || quarantined.has(owner.unitId)) {
        throw new Error(
          `french-entity-agent-terminal-primary-missing:${owner.entityId}`
        );
      }
      primaryFr = entity.primaryFr;
    }
    return [
      finalizeFrenchCanonicalEntity({
        entityId: group.entityId,
        primaryFr,
        category: group.category,
        type: group.type,
        memberEntryKeys: group.memberEntryKeys,
        sourceEntityHash: group.sourceEntityHash,
        groupProofHash: group.groupProofHash
      })
    ];
  });
  const canonicalById = new Map(
    canonicalEntities.map((entity) => [entity.entityId, entity])
  );
  const entryPolicies: FrenchCanonicalEntryNamePolicy[] = [];

  for (const candidate of input.plan.anchors) {
    const anchor = candidate.anchor;
    if (!anchor) throw new Error("french-entity-agent-terminal-anchor-missing");
    const canonical = canonicalById.get(anchor.entityId);
    if (!canonical) {
      throw new Error(
        `french-entity-agent-terminal-anchor-entity-missing:${anchor.entityId}`
      );
    }
    const proof = finalizeFrenchEntityClassificationProof({
      sourceCandidateHash: candidate.candidateHash,
      sourceReviewUnitHash: null,
      decisionMethod: "deterministic-green-anchor",
      agentArtifacts: null,
      evidenceHashes: [candidate.sourceHashes.referenceEvidenceHash],
      reasons: ["deterministic-green-anchor-replayed"]
    });
    entryPolicies.push(
      finalizeFrenchCanonicalEntryNamePolicy({
        entryKey: candidate.entryKey,
        stepEntryId: candidate.stepEntryId,
        identity: candidate.identity,
        englishParentHashes: candidate.englishParentHashes,
        treatment: "canonical-name",
        entityBindings: [{ entityId: anchor.entityId, relation: "primary" }],
        constraint: "canonical",
        primaryFr: canonical.primaryFr,
        derivedFr: null,
        englishForms: [candidate.englishGloss],
        allowedFrenchForms: [canonical.primaryFr],
        classificationProof: proof
      })
    );
  }

  for (const unitId of safeUnitIds) {
    const unit = requiredMap(unitById, unitId);
    const artifacts = requiredMap(input.artifacts, unitId);
    const selected = requiredMap(selectedByUnit, unitId);
    const memberByKey = new Map(
      selected.memberPolicies.map((member) => [member.entryKey, member])
    );
    for (const entryKey of unit.reviewEntryKeys) {
      const candidate = requiredMap(candidates, entryKey);
      const member = requiredMap(memberByKey, entryKey);
      if (
        member.entityBindings.some(
          (binding) => !canonicalById.has(binding.entityId)
        )
      ) {
        throw new Error(
          `french-entity-agent-terminal-unsafe-binding:${entryKey}`
        );
      }
      if (
        member.treatment === "title-or-epithet" ||
        member.treatment === "compound-name"
      ) {
        const selectedFrench = member.primaryFr ?? member.derivedFr ?? "";
        for (const componentEntityId of missingCanonicalComponentIds(
          candidate,
          selectedFrench,
          canonicalById,
          englishMentionIndex
        )) {
          throw new Error(
            `french-entity-agent-terminal-component-drift:${entryKey}:${componentEntityId}`
          );
        }
      }
      const proof = finalizeFrenchEntityClassificationProof({
        sourceCandidateHash: candidate.candidateHash,
        sourceReviewUnitHash: unit.unitHash,
        decisionMethod: "internal-agent-adjudication",
        agentArtifacts: {
          proposerAHash: artifacts.proposalA.proposalHash,
          proposerBHash: artifacts.proposalB.proposalHash,
          arbiterHash: artifacts.arbitration.arbitrationHash,
          auditorHash: artifacts.audit.auditHash
        },
        evidenceHashes: member.evidenceHashes,
        reasons: member.reasons
      });
      entryPolicies.push(
        finalizeFrenchCanonicalEntryNamePolicy({
          entryKey,
          stepEntryId: candidate.stepEntryId,
          identity: candidate.identity,
          englishParentHashes: candidate.englishParentHashes,
          treatment: member.treatment,
          entityBindings: member.entityBindings,
          constraint: member.constraint,
          primaryFr:
            member.treatment === "canonical-name"
              ? (canonicalById.get(
                  member.entityBindings.find(
                    (binding) => binding.relation === "primary"
                  )?.entityId ?? -1
                )?.primaryFr ?? member.primaryFr)
              : member.primaryFr,
          derivedFr: member.derivedFr,
          englishForms: member.englishForms,
          allowedFrenchForms: member.allowedFrenchForms,
          classificationProof: proof
        })
      );
    }
  }

  canonicalEntities.sort((left, right) => left.entityId - right.entityId);
  entryPolicies.sort((left, right) =>
    compareText(left.entryKey, right.entryKey)
  );
  const quarantinedEntryKeys = new Set(
    quarantinedUnitIds.flatMap(
      (unitId) => requiredMap(unitById, unitId).reviewEntryKeys
    )
  );
  if (
    entryPolicies.some((policy) => quarantinedEntryKeys.has(policy.entryKey)) ||
    canonicalEntities.some((entity) => unresolvedEntityIds.has(entity.entityId))
  ) {
    throw new Error("french-entity-agent-terminal-unsafe-propagation");
  }
  const gateContent = {
    schemaVersion: FRENCH_ENTITY_AGENT_TERMINAL_GATE_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_AGENT_POLICY_VERSION,
    planHash: input.plan.planHash,
    reviewUnitCount: input.plan.reviewUnits.length,
    safeUnitCount: safeUnitIds.length,
    quarantinedUnitCount: quarantinedUnitIds.length,
    canonicalEntityCount: canonicalEntities.length,
    canonicalPolicyCount: entryPolicies.length,
    exactDispositionCoverage: true as const,
    unsafePropagationCount: 0 as const
  };
  const gate: FrenchEntityAgentTerminalGateResult = {
    ...gateContent,
    gateHash: hashFrenchEntityJson(gateContent)
  };
  const mergeContent = {
    schemaVersion: FRENCH_ENTITY_AGENT_TERMINAL_MERGE_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_AGENT_POLICY_VERSION,
    planHash: input.plan.planHash,
    canonicalEntities,
    entryPolicies,
    safeUnitIds,
    quarantinedUnitIds,
    unresolvedEntityIds: [...unresolvedEntityIds].sort(
      (left, right) => left - right
    ),
    gate
  };
  return {
    ...mergeContent,
    mergeHash: hashFrenchEntityJson(mergeContent)
  };
}

export function selectedProposalFor(
  artifacts: FrenchEntityAgentUnitArtifacts
): FrenchEntityAgentProposal {
  if (artifacts.arbitration.selectedProposal === "proposalA") {
    return artifacts.proposalA;
  }
  if (artifacts.arbitration.selectedProposal === "proposalB") {
    return artifacts.proposalB;
  }
  throw new Error(
    `french-entity-agent-arbitration-selection-enum:${artifacts.arbitration.unitId}`
  );
}

/** Exact per-unit input sealed by the base arbiter runtime. */
export function frenchEntityAgentArbiterUnitInputHash(input: {
  unitId: string;
  sourceView: FrenchEntityAgentProposerBView;
  proposalA: FrenchEntityAgentProposal;
  proposalB: FrenchEntityAgentProposal;
}): string {
  return hashFrenchEntityJson(input);
}

/** Exact per-unit input sealed by the base auditor runtime. */
export function frenchEntityAgentAuditorUnitInputHash(input: {
  unitId: string;
  sourceView: FrenchEntityAgentProposerBView;
  arbitration: FrenchEntityAgentArbitration;
  selectedProposal: FrenchEntityAgentProposal;
}): string {
  return hashFrenchEntityJson(input);
}

/**
 * Returns source/proposal conflicts that cannot honestly be closed as safe by
 * an auditor. Concordance forms are classical-Strong witnesses: they can
 * support a French spelling, but they do not by themselves prove that an
 * ambiguous STEP sub-entry is the named entity selected by the proposal.
 */
export function frenchEntityAgentEvidenceConflictCodes(input: {
  sourceView: FrenchEntityAgentProposerBView;
  selectedProposal: FrenchEntityAgentProposal;
}): string[] {
  const members = new Map(
    input.sourceView.members.map((member) => [member.entryKey, member])
  );
  const conflicts = new Set<string>();
  for (const policy of input.selectedProposal.memberPolicies) {
    if (policy.treatment === "etymological-or-common-gloss") {
      continue;
    }
    const member = members.get(policy.entryKey);
    const witnesses = input.sourceView.frenchWitnesses[policy.entryKey];
    if (!member || !witnesses) {
      conflicts.add(`${policy.entryKey}:missing-controlled-evidence`);
      continue;
    }
    const selectedFrench = policy.primaryFr ?? policy.derivedFr ?? "";
    const normalizedSelected = normalizeFrenchEvidence(selectedFrench);
    const exactConcordance = witnesses.concordanceForms.filter(
      (form) => normalizeFrenchEvidence(form.surface) === normalizedSelected
    );
    if (exactConcordance.length === 0) {
      conflicts.add(
        `${policy.entryKey}:selected-french-form-without-concordance`
      );
    }

    if (policy.treatment === "canonical-name") {
      const normalizedGloss = normalizeFrenchEvidence(member.englishGloss);
      const namedEnglishForms = new Set(
        member.englishEntityMatches.flatMap((match) => [
          normalizeFrenchEvidence(match.entityEn),
          normalizeFrenchEvidence(match.aliasEn)
        ])
      );
      const stepDeclaresName = /\ba (?:Name|Spelling) of\b/u.test(
        member.identity.dStrong
      );
      if (
        !stepDeclaresName &&
        normalizedGloss &&
        !namedEnglishForms.has(normalizedGloss)
      ) {
        conflicts.add(`${policy.entryKey}:ambiguous-step-entity-attachment`);
      }
    }

    if (
      exactConcordance.length > 0 &&
      witnesses.concordanceForms.some(
        (form) =>
          normalizeFrenchEvidence(form.surface) !== normalizedSelected &&
          /^\p{Ll}/u.test(form.surface.normalize("NFC"))
      )
    ) {
      conflicts.add(
        `${policy.entryKey}:proper-name-vs-lexical-concordance-conflict`
      );
    }
  }
  return [...conflicts].sort(compareText);
}

/**
 * Replays the complete runtime contract of a stored quartet. Hashes alone are
 * not a schema: an attacker (or a buggy writer) can alter a field and simply
 * recompute the enclosing digest. Publication therefore reparses every
 * proposal against the sealed plan view and validates the two decisions as
 * closed, exact objects before it trusts their hashes.
 */
export function assertFrenchEntityAgentUnitArtifacts(input: {
  plan: FrenchEntityCanonicalizationPlan;
  manifest: FrenchEntityAgentBatchManifest;
  unitId: string;
  artifacts: FrenchEntityAgentUnitArtifacts;
  expectedInputHashes?: FrenchEntityAgentUnitInputHashes;
}): void {
  if (input.expectedInputHashes) {
    const expected = objectValue(
      input.expectedInputHashes,
      "expected-unit-input-hashes"
    );
    assertExactKeys(
      expected,
      ["proposerA", "proposerB", "arbiter", "auditor"],
      `expected-unit-input-hashes:${input.unitId}`
    );
    for (const hash of Object.values(expected)) {
      if (typeof hash !== "string" || !SHA256_PATTERN.test(hash)) {
        throw new Error(
          `french-entity-agent-expected-input-hash-invalid:${input.unitId}`
        );
      }
    }
  }
  const rawArtifacts = objectValue(input.artifacts, "unit-artifacts");
  assertExactKeys(
    rawArtifacts,
    ["proposalA", "proposalB", "arbitration", "audit"],
    `unit-artifacts:${input.unitId}`
  );
  const unit = input.plan.reviewUnits.find(
    (candidate) => candidate.unitId === input.unitId
  );
  if (!unit) {
    throw new Error(
      `french-entity-agent-artifact-unit-unknown:${input.unitId}`
    );
  }
  const views = strictReplayViews(input.plan, input.manifest.owners, unit);
  const candidates = candidateMap(input.plan);
  assertStoredProposal(
    input.artifacts.proposalA,
    "proposerA",
    views.proposerA,
    input.manifest.owners,
    input.unitId,
    input.expectedInputHashes?.proposerA ?? views.proposerA.viewHash,
    candidates
  );
  assertStoredProposal(
    input.artifacts.proposalB,
    "proposerB",
    views.proposerB,
    input.manifest.owners,
    input.unitId,
    input.expectedInputHashes?.proposerB ?? views.proposerB.viewHash,
    candidates
  );

  const arbitration = input.artifacts.arbitration;
  const rawArbitration = objectValue(arbitration, "stored-arbitration");
  assertExactKeys(
    rawArbitration,
    [
      "schemaVersion",
      "policyVersion",
      "role",
      "unitId",
      "inputHash",
      "selectedProposal",
      "selectedProposalHash",
      "reasons",
      "arbitrationHash"
    ],
    `stored-arbitration:${input.unitId}`
  );
  const selected =
    arbitration.selectedProposal === "proposalA"
      ? input.artifacts.proposalA
      : arbitration.selectedProposal === "proposalB"
        ? input.artifacts.proposalB
        : null;
  const arbitrationReasons = stringArray(
    arbitration.reasons,
    `stored-arbitration-reasons:${input.unitId}`,
    true
  );
  const expectedArbitrationInputHash =
    input.expectedInputHashes?.arbiter ??
    frenchEntityAgentArbiterUnitInputHash({
      unitId: input.unitId,
      sourceView: views.proposerB,
      proposalA: input.artifacts.proposalA,
      proposalB: input.artifacts.proposalB
    });
  if (
    arbitration.schemaVersion !==
      FRENCH_ENTITY_AGENT_ARBITRATION_SCHEMA_VERSION ||
    arbitration.policyVersion !== FRENCH_ENTITY_AGENT_POLICY_VERSION ||
    arbitration.role !== "arbiter" ||
    arbitration.unitId !== input.unitId ||
    !SHA256_PATTERN.test(arbitration.inputHash) ||
    arbitration.inputHash !== expectedArbitrationInputHash ||
    !selected ||
    arbitration.selectedProposalHash !== selected.proposalHash
  ) {
    throw new Error(
      `french-entity-agent-stored-arbitration-invalid:${input.unitId}`
    );
  }
  const arbitrationContent = {
    schemaVersion: FRENCH_ENTITY_AGENT_ARBITRATION_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_AGENT_POLICY_VERSION,
    role: "arbiter" as const,
    unitId: input.unitId,
    inputHash: arbitration.inputHash,
    selectedProposal: arbitration.selectedProposal,
    selectedProposalHash: selected.proposalHash,
    reasons: arbitrationReasons
  };
  const rebuiltArbitration = {
    ...arbitrationContent,
    arbitrationHash: hashFrenchEntityJson(arbitrationContent)
  };
  if (
    canonicalFrenchEntityJson(rebuiltArbitration) !==
    canonicalFrenchEntityJson(arbitration)
  ) {
    throw new Error(
      `french-entity-agent-stored-arbitration-replay:${input.unitId}`
    );
  }

  const audit = input.artifacts.audit;
  const rawAudit = objectValue(audit, "stored-audit");
  assertExactKeys(
    rawAudit,
    [
      "schemaVersion",
      "policyVersion",
      "role",
      "unitId",
      "inputHash",
      "auditedProposalHash",
      "verdict",
      "checks",
      "reasons",
      "auditHash"
    ],
    `stored-audit:${input.unitId}`
  );
  const checks = parseAuditChecks(audit.checks, input.unitId);
  const auditReasons = stringArray(
    audit.reasons,
    `stored-audit-reasons:${input.unitId}`,
    false
  );
  const mechanicallyProvenChecks = [
    "exactStepIdentity",
    "exactEnglishLineage",
    "explicitMemberRelations"
  ] as const;
  const mechanicalFailure = mechanicallyProvenChecks.some(
    (key) => checks[key] !== "pass"
  );
  const semanticFailure = auditCheckKeys().some(
    (key) =>
      !mechanicallyProvenChecks.includes(
        key as (typeof mechanicallyProvenChecks)[number]
      ) && checks[key] === "fail"
  );
  const evidenceConflictCodes = frenchEntityAgentEvidenceConflictCodes({
    sourceView: views.proposerB,
    selectedProposal: selected
  });
  const expectedAuditInputHash =
    input.expectedInputHashes?.auditor ??
    frenchEntityAgentAuditorUnitInputHash({
      unitId: input.unitId,
      sourceView: views.proposerB,
      arbitration,
      selectedProposal: selected
    });
  if (
    audit.schemaVersion !== FRENCH_ENTITY_AGENT_AUDIT_SCHEMA_VERSION ||
    audit.policyVersion !== FRENCH_ENTITY_AGENT_POLICY_VERSION ||
    audit.role !== "auditor" ||
    audit.unitId !== input.unitId ||
    !SHA256_PATTERN.test(audit.inputHash) ||
    audit.inputHash !== expectedAuditInputHash ||
    audit.auditedProposalHash !== selected.proposalHash ||
    mechanicalFailure ||
    (evidenceConflictCodes.length > 0 &&
      (audit.verdict === "safe" ||
        checks.canonicalPrimaryCoherence !== "fail")) ||
    (audit.verdict !== "safe" &&
      audit.verdict !== "hold" &&
      audit.verdict !== "block") ||
    (audit.verdict === "safe" &&
      (Object.values(checks).some((value) => value !== "pass") ||
        auditReasons.length !== 0)) ||
    (audit.verdict !== "safe" &&
      (auditReasons.length === 0 || !semanticFailure))
  ) {
    throw new Error(`french-entity-agent-stored-audit-invalid:${input.unitId}`);
  }
  const auditContent = {
    schemaVersion: FRENCH_ENTITY_AGENT_AUDIT_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_AGENT_POLICY_VERSION,
    role: "auditor" as const,
    unitId: input.unitId,
    inputHash: audit.inputHash,
    auditedProposalHash: selected.proposalHash,
    verdict: audit.verdict,
    checks,
    reasons: auditReasons
  };
  const rebuiltAudit = {
    ...auditContent,
    auditHash: hashFrenchEntityJson(auditContent)
  };
  if (
    canonicalFrenchEntityJson(rebuiltAudit) !== canonicalFrenchEntityJson(audit)
  ) {
    throw new Error(`french-entity-agent-stored-audit-replay:${input.unitId}`);
  }
}

function assertStoredProposal(
  proposal: FrenchEntityAgentProposal,
  role: FrenchEntityAgentProposerRole,
  view: FrenchEntityAgentView,
  owners: readonly FrenchEntityAgentOwner[],
  unitId: string,
  expectedInputHash: string,
  candidates: ReadonlyMap<string, FrenchEntityCanonicalizationCandidate>
): void {
  const raw = objectValue(proposal, "stored-proposal");
  assertExactKeys(
    raw,
    [
      "schemaVersion",
      "policyVersion",
      "role",
      "unitId",
      "inputHash",
      "canonicalEntities",
      "memberPolicies",
      "proposalHash"
    ],
    `stored-proposal:${unitId}:${role}`
  );
  if (
    proposal.schemaVersion !== FRENCH_ENTITY_AGENT_PROPOSAL_SCHEMA_VERSION ||
    proposal.policyVersion !== FRENCH_ENTITY_AGENT_POLICY_VERSION ||
    proposal.role !== role ||
    proposal.unitId !== unitId ||
    !SHA256_PATTERN.test(proposal.inputHash) ||
    !Array.isArray(proposal.canonicalEntities) ||
    !Array.isArray(proposal.memberPolicies)
  ) {
    throw new Error(
      `french-entity-agent-stored-proposal-invalid:${unitId}:${role}`
    );
  }
  if (proposal.inputHash !== expectedInputHash) {
    throw new Error(
      `french-entity-agent-stored-proposal-input:${unitId}:${role}`
    );
  }
  const replayRaw = {
    schemaVersion: proposal.schemaVersion,
    role: proposal.role,
    unitId: proposal.unitId,
    inputHash: proposal.inputHash,
    canonicalEntities: proposal.canonicalEntities,
    memberPolicies: proposal.memberPolicies.map((member) => ({
      ...member,
      allowedFrenchForms: [member.primaryFr ?? member.derivedFr ?? ""]
    }))
  };
  const replayed = finalizeAndValidateProposal(
    replayRaw,
    role,
    view,
    owners,
    proposal.inputHash,
    candidates
  );
  if (
    canonicalFrenchEntityJson(replayed) !== canonicalFrenchEntityJson(proposal)
  ) {
    throw new Error(
      `french-entity-agent-stored-proposal-replay:${unitId}:${role}`
    );
  }
}

function strictReplayViews(
  plan: FrenchEntityCanonicalizationPlan,
  owners: readonly FrenchEntityAgentOwner[],
  unit: FrenchEntityCanonicalizationReviewUnit
): {
  proposerA: FrenchEntityAgentProposerAView;
  proposerB: FrenchEntityAgentProposerBView;
} {
  const candidates = candidateMap(plan);
  const groupsById = new Map(
    plan.entityGroups.map((group) => [group.entityId, group])
  );
  const entityGroups = unit.entityIds.map((entityId) => {
    const group = groupsById.get(entityId);
    if (!group) {
      throw new Error(
        `french-entity-agent-strict-view-group:${unit.unitId}:${entityId}`
      );
    }
    return group;
  });
  const anchoredEntities = unit.entityIds.flatMap((entityId) => {
    const owner = owners.find(
      (candidate) =>
        candidate.entityId === entityId && candidate.resolution === "anchored"
    );
    if (!owner) return [];
    const group = groupsById.get(entityId);
    if (!group || !owner.anchorPrimaryFr) {
      throw new Error(
        `french-entity-agent-strict-view-anchor:${unit.unitId}:${entityId}`
      );
    }
    return [
      {
        entityId,
        primaryFr: owner.anchorPrimaryFr,
        anchorEntryKeys: group.anchorEntryKeys,
        groupProofHash: owner.groupProofHash
      }
    ];
  });
  const members = unit.reviewEntryKeys.map((entryKey) => {
    const candidate = candidates.get(entryKey);
    if (!candidate) {
      throw new Error(
        `french-entity-agent-strict-view-member:${unit.unitId}:${entryKey}`
      );
    }
    return candidateView(candidate, entityGroups);
  });
  const common = {
    schemaVersion: FRENCH_ENTITY_AGENT_VIEW_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_AGENT_POLICY_VERSION,
    unitId: unit.unitId,
    planHash: plan.planHash,
    releaseKey: plan.sourceLineage.releaseKey,
    releaseSnapshotFingerprint: plan.sourceLineage.releaseSnapshotFingerprint,
    reviewUnit: unit,
    ownerEntityIds: owners
      .filter((owner) => owner.unitId === unit.unitId)
      .map((owner) => owner.entityId)
      .sort((left, right) => left - right),
    entityGroups,
    anchoredEntities,
    members
  };
  const proposerA = finalizeView({ ...common, role: "proposerA" });
  const frenchWitnesses = Object.fromEntries(
    unit.reviewEntryKeys.map((entryKey) => {
      const candidate = candidates.get(entryKey);
      if (!candidate) {
        throw new Error(`french-entity-agent-strict-view-witness:${entryKey}`);
      }
      return [
        entryKey,
        {
          authority: "non-authoritative-review-witness-only" as const,
          candidateFrenchForms: candidate.sourceForms.candidateFrenchForms,
          concordanceForms: candidate.sourceForms.concordanceForms,
          historicalFrenchGloss: candidate.sourceForms.historicalFrenchGloss
        }
      ];
    })
  );
  const proposerB = finalizeView({
    ...common,
    role: "proposerB",
    frenchWitnesses
  });
  return { proposerA, proposerB };
}

function candidateView(
  candidate: FrenchEntityCanonicalizationCandidate,
  groups: readonly FrenchEntityCanonicalizationGroup[]
): FrenchEntityAgentCandidateView {
  const allowedEvidenceHashes = [candidate.englishParentHashes.lineageHash];
  if (candidate.sourceHashes.referenceEvidenceCount > 0) {
    allowedEvidenceHashes.push(candidate.sourceHashes.referenceEvidenceHash);
  }
  if (candidate.sourceHashes.concordanceEvidenceCount > 0) {
    allowedEvidenceHashes.push(candidate.sourceHashes.concordanceEvidenceHash);
  }
  allowedEvidenceHashes.push(...groups.map((group) => group.groupProofHash));
  return {
    entryKey: candidate.entryKey,
    stepEntryId: candidate.stepEntryId,
    identity: candidate.identity,
    englishParentHashes: candidate.englishParentHashes,
    englishGloss: candidate.englishGloss,
    editorialStatus: candidate.editorialStatus,
    entityIds: candidate.entityIds,
    englishEntityMatches: candidate.entityMatches.map((match) => ({
      entityId: match.entityId,
      significance: match.significance,
      aliasEn: match.aliasEn,
      entityEn: match.entityEn,
      category: match.category,
      type: match.type
    })),
    englishEntityForms: candidate.sourceForms.englishEntityForms,
    initialTreatment: candidate.initialTreatment,
    initialConstraint: candidate.initialConstraint,
    allowedEvidenceHashes: uniqueSorted(allowedEvidenceHashes),
    hardConstraints: {
      mustRemainNonEntity: SPECIAL_NON_ENTITY_KEYS.has(candidate.entryKey),
      exactStepSuffixRequired: true,
      historicalFrenchIsAuthoritative: false
    }
  };
}

function finalizeView<T extends Omit<FrenchEntityAgentView, "viewHash">>(
  input: T
): T & { viewHash: string } {
  return { ...input, viewHash: hashFrenchEntityJson(input) };
}

function finalizeInputArtifact(
  role: FrenchEntityAgentProposerRole,
  plan: FrenchEntityCanonicalizationPlan,
  views: FrenchEntityAgentView[]
): FrenchEntityAgentInputArtifact {
  const content = {
    schemaVersion: FRENCH_ENTITY_AGENT_INPUT_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_AGENT_POLICY_VERSION,
    role,
    planHash: plan.planHash,
    releaseKey: plan.sourceLineage.releaseKey,
    releaseSnapshotFingerprint: plan.sourceLineage.releaseSnapshotFingerprint,
    unitIds: views.map((view) => view.unitId),
    views
  };
  return { ...content, inputHash: hashFrenchEntityJson(content) };
}

function inputProof(
  relativePath: string,
  text: string,
  logicalHash: string
): FrenchEntityAgentBatchInputProof {
  return {
    relativePath,
    sha256: hashText(text),
    bytes: Buffer.byteLength(text),
    logicalHash
  };
}

function buildOwners(
  plan: FrenchEntityCanonicalizationPlan,
  candidates: ReadonlyMap<string, FrenchEntityCanonicalizationCandidate>
): FrenchEntityAgentOwner[] {
  const entityUnit = new Map<number, string>();
  const multiUnits = new Map<number, string[]>();
  for (const unit of plan.reviewUnits) {
    if (unit.kind === "entity-group") {
      const entityId = unit.entityIds[0];
      if (!entityId || entityUnit.has(entityId)) {
        throw new Error("french-entity-agent-entity-owner-duplicate");
      }
      entityUnit.set(entityId, unit.unitId);
    } else if (unit.kind === "multi-entity") {
      for (const entityId of unit.entityIds) {
        const values = multiUnits.get(entityId) ?? [];
        values.push(unit.unitId);
        multiUnits.set(entityId, values);
      }
    }
  }
  return plan.entityGroups.map((group) => {
    const anchorNames = uniqueSorted(
      group.anchorEntryKeys.map((entryKey) => {
        const primary = candidates.get(entryKey)?.anchor?.primaryFr;
        if (!primary) {
          throw new Error(
            `french-entity-agent-owner-anchor-missing:${group.entityId}:${entryKey}`
          );
        }
        return primary;
      })
    );
    if (anchorNames.length > 0) {
      if (anchorNames.length !== 1) {
        throw new Error(
          `french-entity-agent-anchor-primary-conflict:${group.entityId}`
        );
      }
      return {
        entityId: group.entityId,
        resolution: "anchored" as const,
        unitId: null,
        anchorPrimaryFr: anchorNames[0] ?? null,
        groupProofHash: group.groupProofHash
      };
    }
    const unitId =
      entityUnit.get(group.entityId) ??
      [...(multiUnits.get(group.entityId) ?? [])].sort(compareText)[0];
    if (!unitId) {
      throw new Error(
        `french-entity-agent-owner-unit-missing:${group.entityId}`
      );
    }
    return {
      entityId: group.entityId,
      resolution: "agent" as const,
      unitId,
      anchorPrimaryFr: null,
      groupProofHash: group.groupProofHash
    };
  });
}

function batchUnitIds(
  unitIds: readonly string[],
  views: {
    proposerA: ReadonlyMap<string, FrenchEntityAgentProposerAView>;
    proposerB: ReadonlyMap<string, FrenchEntityAgentProposerBView>;
  },
  maxUnits: number,
  maxInputBytes: number
): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];
  for (const unitId of unitIds) {
    const candidate = [...current, unitId];
    const bytes = Math.max(
      approximateInputBytes(candidate, views.proposerA),
      approximateInputBytes(candidate, views.proposerB)
    );
    if (candidate.length > maxUnits || bytes > maxInputBytes) {
      if (current.length === 0) {
        throw new Error(
          `french-entity-agent-unit-over-budget:${unitId}:${bytes}`
        );
      }
      batches.push(current);
      current = [unitId];
      const singleBytes = Math.max(
        approximateInputBytes(current, views.proposerA),
        approximateInputBytes(current, views.proposerB)
      );
      if (singleBytes > maxInputBytes) {
        throw new Error(
          `french-entity-agent-unit-over-budget:${unitId}:${singleBytes}`
        );
      }
    } else {
      current = candidate;
    }
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

function approximateInputBytes(
  unitIds: readonly string[],
  views: ReadonlyMap<string, FrenchEntityAgentView>
): number {
  return Buffer.byteLength(
    canonicalFrenchEntityJson(
      unitIds.map((unitId) => requiredMap(views, unitId))
    )
  );
}

function finalizeAndValidateProposal(
  raw: Record<string, unknown>,
  role: FrenchEntityAgentProposerRole,
  view: FrenchEntityAgentView,
  owners: readonly FrenchEntityAgentOwner[],
  expectedInputHash: string,
  candidates: ReadonlyMap<string, FrenchEntityCanonicalizationCandidate>
): FrenchEntityAgentProposal {
  assertExactKeys(
    raw,
    [
      "schemaVersion",
      "role",
      "unitId",
      "inputHash",
      "canonicalEntities",
      "memberPolicies"
    ],
    `proposal:${view.unitId}`
  );
  if (raw.schemaVersion !== FRENCH_ENTITY_AGENT_PROPOSAL_SCHEMA_VERSION) {
    throw new Error(`french-entity-agent-proposal-schema:${view.unitId}`);
  }
  if (raw.role !== role) {
    throw new Error(`french-entity-agent-proposal-role:${view.unitId}`);
  }
  if (raw.unitId !== view.unitId) {
    throw new Error(`french-entity-agent-proposal-unit:${view.unitId}`);
  }
  if (raw.inputHash !== expectedInputHash) {
    throw new Error(`french-entity-agent-proposal-input-hash:${view.unitId}`);
  }
  if (
    !Array.isArray(raw.canonicalEntities) ||
    !Array.isArray(raw.memberPolicies)
  ) {
    throw new Error(`french-entity-agent-proposal-arrays:${view.unitId}`);
  }
  const allowedOwnerIds = owners
    .filter((owner) => owner.unitId === view.unitId)
    .map((owner) => owner.entityId)
    .sort((left, right) => left - right);
  const canonicalEntities = raw.canonicalEntities
    .map((value) => parsePrimaryProposal(value, view))
    .sort((left, right) => left.entityId - right.entityId);
  if (
    canonicalFrenchEntityJson(
      canonicalEntities.map((value) => value.entityId)
    ) !== canonicalFrenchEntityJson(allowedOwnerIds)
  ) {
    throw new Error(
      `french-entity-agent-proposal-owner-coverage:${view.unitId}`
    );
  }
  const memberRawByKey = uniqueRawByEntry(raw.memberPolicies, view.unitId);
  const memberPolicies = view.reviewUnit.reviewEntryKeys.map((entryKey) => {
    const memberView = view.members.find(
      (member) => member.entryKey === entryKey
    );
    const memberRaw = memberRawByKey.get(entryKey);
    if (!memberView || !memberRaw) {
      throw new Error(
        `french-entity-agent-member-proposal-missing:${entryKey}`
      );
    }
    const candidate = candidates.get(entryKey);
    if (!candidate) {
      throw new Error(
        `french-entity-agent-member-candidate-missing:${entryKey}`
      );
    }
    return parseMemberProposal(
      memberRaw,
      memberView,
      view,
      canonicalEntities,
      candidate
    );
  });
  const content = {
    schemaVersion: FRENCH_ENTITY_AGENT_PROPOSAL_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_AGENT_POLICY_VERSION,
    role,
    unitId: view.unitId,
    inputHash: expectedInputHash,
    canonicalEntities,
    memberPolicies
  };
  return { ...content, proposalHash: hashFrenchEntityJson(content) };
}

function parsePrimaryProposal(
  value: unknown,
  view: FrenchEntityAgentView
): FrenchEntityAgentPrimaryProposal {
  const raw = objectValue(value, "primary-proposal");
  assertExactKeys(
    raw,
    ["entityId", "primaryFr", "evidenceHashes", "reasons"],
    "primary-proposal"
  );
  if (
    !Number.isInteger(raw.entityId) ||
    (raw.entityId as number) < 1 ||
    typeof raw.primaryFr !== "string" ||
    !raw.primaryFr.trim()
  ) {
    throw new Error(`french-entity-agent-primary-invalid:${view.unitId}`);
  }
  const group = view.entityGroups.find(
    (candidate) => candidate.entityId === raw.entityId
  );
  if (!group) {
    throw new Error(`french-entity-agent-primary-unbound:${view.unitId}`);
  }
  const evidenceHashes = hashArray(raw.evidenceHashes, "primary-evidence");
  if (!evidenceHashes.includes(group.groupProofHash)) {
    throw new Error(`french-entity-agent-primary-evidence:${raw.entityId}`);
  }
  return {
    entityId: raw.entityId as number,
    primaryFr: raw.primaryFr.trim(),
    evidenceHashes,
    reasons: stringArray(raw.reasons, "primary-reasons", true)
  };
}

function parseMemberProposal(
  raw: Record<string, unknown>,
  member: FrenchEntityAgentCandidateView,
  view: FrenchEntityAgentView,
  proposedEntities: readonly FrenchEntityAgentPrimaryProposal[],
  candidate: FrenchEntityCanonicalizationCandidate
): FrenchEntityAgentMemberProposal {
  assertExactKeys(
    raw,
    [
      "entryKey",
      "treatment",
      "entityBindings",
      "constraint",
      "primaryFr",
      "derivedFr",
      "englishForms",
      "allowedFrenchForms",
      "evidenceHashes",
      "reasons"
    ],
    `member-proposal:${member.entryKey}`
  );
  if (raw.entryKey !== member.entryKey) {
    throw new Error(`french-entity-agent-member-key:${member.entryKey}`);
  }
  const treatment = raw.treatment as FrenchEntityNameTreatment;
  const constraint = raw.constraint as FrenchEntityNameConstraint;
  if (
    treatment === "unresolved" ||
    ![
      "canonical-name",
      "alternate-name",
      "unregistered-proper-name",
      "gentilic",
      "title-or-epithet",
      "compound-name",
      "etymological-or-common-gloss"
    ].includes(treatment) ||
    constraint === "blocked" ||
    ![
      "canonical",
      "derived",
      "proper-name-without-entity",
      "lexical-translation"
    ].includes(constraint)
  ) {
    throw new Error(`french-entity-agent-member-unresolved:${member.entryKey}`);
  }
  const bindings = parseBindings(raw.entityBindings, member);
  const primaryFr = nullableTrimmedString(raw.primaryFr, "primaryFr");
  const derivedFr = nullableTrimmedString(raw.derivedFr, "derivedFr");
  const englishForms = stringArray(raw.englishForms, "englishForms", false);
  if (
    !Array.isArray(raw.allowedFrenchForms) ||
    raw.allowedFrenchForms.length !== 1
  ) {
    throw new Error(
      `french-entity-agent-noncanonical-allowed-form:${member.entryKey}`
    );
  }
  const allowedFrenchForms = stringArray(
    raw.allowedFrenchForms,
    "allowedFrenchForms",
    false
  );
  const evidenceHashes = hashArray(raw.evidenceHashes, "member-evidence");
  if (
    !evidenceHashes.some((hash) => member.allowedEvidenceHashes.includes(hash))
  ) {
    throw new Error(`french-entity-agent-member-evidence:${member.entryKey}`);
  }
  const allowedEnglish = new Set([
    member.englishGloss,
    ...member.englishEntityForms
  ]);
  if (englishForms.some((form) => !allowedEnglish.has(form))) {
    throw new Error(
      `french-entity-agent-member-english-form:${member.entryKey}`
    );
  }
  const normalized = normalizeMechanicalMemberShape({
    entryKey: member.entryKey,
    treatment,
    bindings,
    primaryFr,
    derivedFr,
    englishForms,
    allowedFrenchForms
  });
  assertMemberShape({
    entryKey: member.entryKey,
    treatment,
    ...normalized,
    member,
    view,
    proposedEntities,
    candidate
  });
  return {
    entryKey: member.entryKey,
    treatment: treatment as Exclude<FrenchEntityNameTreatment, "unresolved">,
    entityBindings: normalized.bindings,
    constraint: normalized.constraint,
    primaryFr: normalized.primaryFr,
    derivedFr: normalized.derivedFr,
    englishForms: normalized.englishForms,
    allowedFrenchForms: normalized.allowedFrenchForms,
    evidenceHashes,
    reasons: stringArray(raw.reasons, "member-reasons", true)
  };
}

function normalizeMechanicalMemberShape(input: {
  entryKey: string;
  treatment: Exclude<FrenchEntityNameTreatment, "unresolved">;
  bindings: FrenchEntityBinding[];
  primaryFr: string | null;
  derivedFr: string | null;
  englishForms: string[];
  allowedFrenchForms: string[];
}): {
  constraint: Exclude<FrenchEntityNameConstraint, "blocked">;
  bindings: FrenchEntityBinding[];
  primaryFr: string | null;
  derivedFr: string | null;
  englishForms: string[];
  allowedFrenchForms: string[];
} {
  const values = [input.primaryFr, input.derivedFr].filter(
    (value): value is string => value !== null
  );
  if (new Set(values).size > 1) {
    throw new Error(
      `french-entity-agent-member-form-ambiguous:${input.entryKey}`
    );
  }
  const selectedFrench = values[0] ?? null;
  const relationByTreatment: Record<
    Exclude<FrenchEntityNameTreatment, "unresolved">,
    FrenchEntityBinding["relation"]
  > = {
    "canonical-name": "primary",
    "alternate-name": "alias",
    "unregistered-proper-name": "alias",
    gentilic: "gentilic",
    "title-or-epithet": "title",
    "compound-name": "compound",
    "etymological-or-common-gloss": "etymological"
  };
  const entityIds = input.bindings.map((binding) => binding.entityId);
  if (new Set(entityIds).size !== entityIds.length) {
    throw new Error(
      `french-entity-agent-binding-entity-duplicate:${input.entryKey}`
    );
  }
  const bindings = entityIds
    .map((entityId) => {
      const proposed = input.bindings.find(
        (binding) => binding.entityId === entityId
      );
      return {
        entityId,
        relation:
          input.treatment === "canonical-name" && input.bindings.length > 1
            ? (proposed?.relation ?? "primary")
            : relationByTreatment[input.treatment]
      };
    })
    .sort((left, right) => left.entityId - right.entityId);
  if (input.treatment === "etymological-or-common-gloss") {
    if (!selectedFrench) {
      throw new Error(`french-entity-agent-common-shape:${input.entryKey}`);
    }
    const allowedFrenchForms = normalizeNormativeNameForms(
      input.entryKey,
      input.treatment,
      selectedFrench,
      input.allowedFrenchForms
    );
    return {
      constraint: "lexical-translation",
      bindings,
      primaryFr: null,
      derivedFr: selectedFrench,
      englishForms: [],
      allowedFrenchForms
    };
  }
  if (input.treatment === "unregistered-proper-name") {
    if (!selectedFrench || bindings.length !== 0) {
      throw new Error(
        `french-entity-agent-standalone-proper-name-shape:${input.entryKey}`
      );
    }
    const allowedFrenchForms = normalizeNormativeNameForms(
      input.entryKey,
      input.treatment,
      selectedFrench,
      input.allowedFrenchForms
    );
    return {
      constraint: "proper-name-without-entity",
      bindings: [],
      primaryFr: null,
      derivedFr: selectedFrench,
      englishForms: input.englishForms,
      allowedFrenchForms
    };
  }
  if (!selectedFrench) {
    throw new Error(`french-entity-agent-name-shape:${input.entryKey}`);
  }
  if (input.treatment === "canonical-name") {
    const allowedFrenchForms = normalizeNormativeNameForms(
      input.entryKey,
      input.treatment,
      selectedFrench,
      input.allowedFrenchForms
    );
    return {
      constraint: "canonical",
      bindings,
      primaryFr: selectedFrench,
      derivedFr: null,
      englishForms: input.englishForms,
      allowedFrenchForms
    };
  }
  const allowedFrenchForms = normalizeNormativeNameForms(
    input.entryKey,
    input.treatment,
    selectedFrench,
    input.allowedFrenchForms
  );
  return {
    constraint: "derived",
    bindings,
    primaryFr: null,
    derivedFr: selectedFrench,
    englishForms: input.englishForms,
    allowedFrenchForms
  };
}

function normalizeNormativeNameForms(
  entryKey: string,
  treatment: Exclude<FrenchEntityNameTreatment, "unresolved">,
  selectedFrench: string,
  proposedForms: readonly string[]
): string[] {
  if (proposedForms.length !== 1 || proposedForms[0] !== selectedFrench) {
    throw new Error(
      `french-entity-agent-noncanonical-allowed-form:${entryKey}`
    );
  }
  return canonicalFrenchEntityPolicyForms(treatment, selectedFrench);
}

function assertMemberShape(input: {
  entryKey: string;
  treatment: FrenchEntityNameTreatment;
  constraint: FrenchEntityNameConstraint;
  bindings: FrenchEntityBinding[];
  primaryFr: string | null;
  derivedFr: string | null;
  englishForms: string[];
  allowedFrenchForms: string[];
  member: FrenchEntityAgentCandidateView;
  view: FrenchEntityAgentView;
  proposedEntities: readonly FrenchEntityAgentPrimaryProposal[];
  candidate: FrenchEntityCanonicalizationCandidate;
}): void {
  const special = input.member.hardConstraints.mustRemainNonEntity;
  const standaloneProperName =
    input.view.reviewUnit.kind === "no-entity" &&
    input.view.ownerEntityIds.length === 0 &&
    !special &&
    isFrenchStandaloneProperNameCandidate({
      identity: input.member.identity,
      entityIds: input.member.entityIds,
      initialTreatment: input.member.initialTreatment,
      initialConstraint: input.member.initialConstraint,
      anchor: null
    }) &&
    input.candidate.reasons.includes(
      "reconstructed-lxx-name-without-tipnr-entity"
    );
  const unboundNameCandidate =
    input.view.reviewUnit.kind === "no-entity" &&
    input.view.ownerEntityIds.length === 0 &&
    !special &&
    isFrenchUnboundNameCandidate({
      entryKey: input.member.entryKey,
      entityIds: input.member.entityIds,
      initialTreatment: input.member.initialTreatment,
      initialConstraint: input.member.initialConstraint,
      anchor: null
    });
  const unboundAlternateName = isFrenchUnboundAlternateNameCandidate({
    entryKey: input.member.entryKey,
    identity: input.member.identity,
    entityIds: input.member.entityIds,
    initialTreatment: input.member.initialTreatment,
    initialConstraint: input.member.initialConstraint,
    anchor: null
  });
  const unboundTreatment =
    [
      "unregistered-proper-name",
      "gentilic",
      "title-or-epithet",
      "compound-name"
    ].includes(input.treatment) ||
    (input.treatment === "alternate-name" && unboundAlternateName);
  const directNamedEntityIds = frenchEntityDirectNamedMatchEntityIds({
    englishGloss: input.member.englishGloss,
    entityMatches: input.member.englishEntityMatches
  });
  const mustRemainMixedCanonical =
    input.view.reviewUnit.kind === "multi-entity" &&
    input.candidate.reasons.includes("multiple-exact-dstrong-entities") &&
    input.member.entityIds.length > 1 &&
    (directNamedEntityIds.length > 0 || input.view.ownerEntityIds.length > 0);
  if (special && input.treatment !== "etymological-or-common-gloss") {
    throw new Error(`french-entity-agent-canary-forced-name:${input.entryKey}`);
  }
  if (mustRemainMixedCanonical && input.treatment !== "canonical-name") {
    throw new Error(
      `french-entity-agent-mixed-direct-primary-treatment:${input.entryKey}`
    );
  }
  if (
    (standaloneProperName && !unboundTreatment) ||
    (input.treatment === "unregistered-proper-name" && !unboundNameCandidate)
  ) {
    throw new Error(
      `french-entity-agent-standalone-proper-name-treatment:${input.entryKey}`
    );
  }
  if (input.treatment === "etymological-or-common-gloss") {
    if (standaloneProperName) {
      throw new Error(
        `french-entity-agent-proper-name-as-common-gloss:${input.entryKey}`
      );
    }
    if (
      input.constraint !== "lexical-translation" ||
      input.primaryFr !== null ||
      !input.derivedFr ||
      input.englishForms.length !== 0 ||
      input.bindings.some((binding) => binding.relation !== "etymological") ||
      !input.allowedFrenchForms.includes(input.derivedFr)
    ) {
      throw new Error(`french-entity-agent-common-shape:${input.entryKey}`);
    }
    return;
  }
  if (
    (input.bindings.length === 0 &&
      !(unboundNameCandidate && unboundTreatment)) ||
    input.englishForms.length === 0
  ) {
    throw new Error(`french-entity-agent-name-unbound:${input.entryKey}`);
  }
  if (
    input.view.reviewUnit.kind === "multi-entity" &&
    input.member.entityIds.length > 1 &&
    canonicalFrenchEntityJson(
      input.bindings.map((binding) => binding.entityId).sort((a, b) => a - b)
    ) !==
      canonicalFrenchEntityJson(
        [...input.member.entityIds].sort((a, b) => a - b)
      )
  ) {
    throw new Error(
      `french-entity-agent-multi-binding-coverage:${input.entryKey}`
    );
  }
  const mapping: Record<
    Exclude<
      FrenchEntityNameTreatment,
      "unresolved" | "etymological-or-common-gloss" | "unregistered-proper-name"
    >,
    { constraint: "canonical" | "derived"; relation: string }
  > = {
    "canonical-name": { constraint: "canonical", relation: "primary" },
    "alternate-name": { constraint: "derived", relation: "alias" },
    gentilic: { constraint: "derived", relation: "gentilic" },
    "title-or-epithet": { constraint: "derived", relation: "title" },
    "compound-name": { constraint: "derived", relation: "compound" }
  };
  const expected = mapping[input.treatment as keyof typeof mapping];
  if (input.treatment === "unregistered-proper-name") {
    if (
      input.constraint !== "proper-name-without-entity" ||
      input.bindings.length !== 0 ||
      input.primaryFr !== null ||
      !input.derivedFr ||
      input.englishForms.length !== 1 ||
      input.englishForms[0] !== input.member.englishGloss ||
      !input.allowedFrenchForms.includes(input.derivedFr)
    ) {
      throw new Error(
        `french-entity-agent-standalone-proper-name-shape:${input.entryKey}`
      );
    }
    return;
  }
  if (
    !expected ||
    input.constraint !== expected.constraint ||
    (input.treatment !== "canonical-name" &&
      input.bindings.some((binding) => binding.relation !== expected.relation))
  ) {
    throw new Error(`french-entity-agent-name-shape:${input.entryKey}`);
  }
  if (input.treatment === "canonical-name") {
    const primaryBindings = input.bindings.filter(
      (binding) => binding.relation === "primary"
    );
    const secondaryBindings = input.bindings.filter(
      (binding) =>
        binding.relation === "alias" || binding.relation === "compound"
    );
    const directNamedEntityIds = frenchEntityDirectNamedMatchEntityIds({
      englishGloss: input.member.englishGloss,
      entityMatches: input.member.englishEntityMatches
    });
    const allowedPrimaryEntityIds =
      directNamedEntityIds.length === 1
        ? directNamedEntityIds
        : input.view.ownerEntityIds;
    const primaryEntityId = primaryBindings[0]?.entityId ?? -1;
    const exactMixed =
      input.view.reviewUnit.kind === "multi-entity" &&
      input.candidate.reasons.includes("multiple-exact-dstrong-entities") &&
      input.member.entityIds.length > 1 &&
      input.bindings.length === input.member.entityIds.length &&
      primaryBindings.length === 1 &&
      allowedPrimaryEntityIds.includes(primaryEntityId) &&
      secondaryBindings.length === input.member.entityIds.length - 1 &&
      secondaryBindings.every(
        (binding) =>
          binding.relation ===
          frenchEntityCanonicalSecondaryRelation({
            entityId: binding.entityId,
            entityMatches: input.member.englishEntityMatches
          })
      ) &&
      canonicalFrenchEntityJson(
        input.bindings.map((binding) => binding.entityId).sort((a, b) => a - b)
      ) ===
        canonicalFrenchEntityJson(
          [...input.member.entityIds].sort((a, b) => a - b)
        );
    if (
      (input.bindings.length !== 1 && !exactMixed) ||
      primaryBindings.length !== 1 ||
      !input.primaryFr ||
      input.derivedFr !== null ||
      !input.allowedFrenchForms.includes(input.primaryFr)
    ) {
      throw new Error(`french-entity-agent-canonical-shape:${input.entryKey}`);
    }
    const entityId = primaryBindings[0]?.entityId;
    const expectedPrimary =
      input.view.anchoredEntities.find((entity) => entity.entityId === entityId)
        ?.primaryFr ??
      input.proposedEntities.find((entity) => entity.entityId === entityId)
        ?.primaryFr;
    if (expectedPrimary && input.primaryFr !== expectedPrimary) {
      throw new Error(
        `french-entity-agent-canonical-primary:${input.entryKey}`
      );
    }
    if (!expectedPrimary && !exactMixed) {
      throw new Error(
        `french-entity-agent-canonical-primary:${input.entryKey}`
      );
    }
  } else if (
    input.primaryFr !== null ||
    !input.derivedFr ||
    !input.allowedFrenchForms.includes(input.derivedFr)
  ) {
    throw new Error(`french-entity-agent-derived-shape:${input.entryKey}`);
  }
}

function parseBindings(
  value: unknown,
  member: FrenchEntityAgentCandidateView
): FrenchEntityBinding[] {
  if (!Array.isArray(value)) {
    throw new Error(`french-entity-agent-bindings-array:${member.entryKey}`);
  }
  const allowedIds = new Set(member.entityIds);
  const allowedRelations = new Set([
    "primary",
    "alias",
    "gentilic",
    "title",
    "compound",
    "etymological"
  ]);
  const bindings = value.map((item) => {
    const raw = objectValue(item, "binding");
    assertExactKeys(raw, ["entityId", "relation"], "binding");
    if (
      !Number.isInteger(raw.entityId) ||
      !allowedIds.has(raw.entityId as number) ||
      typeof raw.relation !== "string" ||
      !allowedRelations.has(raw.relation)
    ) {
      throw new Error(`french-entity-agent-binding-invalid:${member.entryKey}`);
    }
    return {
      entityId: raw.entityId as number,
      relation: raw.relation as FrenchEntityBinding["relation"]
    };
  });
  bindings.sort((left, right) =>
    left.entityId !== right.entityId
      ? left.entityId - right.entityId
      : compareText(left.relation, right.relation)
  );
  if (
    new Set(
      bindings.map((binding) => `${binding.entityId}:${binding.relation}`)
    ).size !== bindings.length
  ) {
    throw new Error(`french-entity-agent-binding-duplicate:${member.entryKey}`);
  }
  return bindings;
}

function assertSpecialNonEntities(
  candidates: ReadonlyMap<string, FrenchEntityCanonicalizationCandidate>
): void {
  for (const entryKey of SPECIAL_NON_ENTITY_KEYS) {
    const candidate = candidates.get(entryKey);
    if (
      !candidate ||
      candidate.entityIds.length !== 0 ||
      candidate.initialTreatment !== "etymological-or-common-gloss" ||
      candidate.initialConstraint !== "lexical-translation" ||
      !exactSuffixIdentity(candidate)
    ) {
      throw new Error(`french-entity-agent-canary-invalid:${entryKey}`);
    }
  }
}

function exactSuffixIdentity(
  candidate: FrenchEntityCanonicalizationCandidate
): boolean {
  return (
    candidate.entryKey ===
      `${candidate.identity.language}:${candidate.identity.primaryDStrong}` &&
    candidate.identity.dStrong.startsWith(candidate.identity.primaryDStrong)
  );
}

function candidateMap(
  plan: FrenchEntityCanonicalizationPlan
): Map<string, FrenchEntityCanonicalizationCandidate> {
  return new Map(
    [...plan.anchors, ...plan.reviewCandidates].map((candidate) => [
      candidate.entryKey,
      candidate
    ])
  );
}

function assertProposerABlind(view: FrenchEntityAgentProposerAView): void {
  const forbiddenKeys = new Set([
    "candidateFrenchForms",
    "concordanceForms",
    "historicalFrenchGloss",
    "frenchWitnesses",
    "historicalCandidate",
    "candidateFr"
  ]);
  const visit = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (forbiddenKeys.has(key)) {
        throw new Error(`french-entity-agent-proposer-a-leak:${key}`);
      }
      visit(child);
    }
  };
  visit(view);
}

function assertViewHash(view: FrenchEntityAgentView): void {
  const { viewHash, ...content } = view;
  if (hashFrenchEntityJson(content) !== viewHash) {
    throw new Error(`french-entity-agent-view-hash:${view.unitId}`);
  }
}

function assertInputProof(proof: FrenchEntityAgentBatchInputProof): void {
  if (
    !proof.relativePath.startsWith("batches/") ||
    !proof.relativePath.endsWith("-input.json") ||
    !Number.isInteger(proof.bytes) ||
    proof.bytes < 1
  ) {
    throw new Error("french-entity-agent-input-proof-invalid");
  }
  assertSha256(proof.sha256, "input-proof-file");
  assertSha256(proof.logicalHash, "input-proof-logical");
}

function assertOutputContracts(
  contracts: readonly { unitId: string; inputHash: string }[],
  label: string
): void {
  if (contracts.length === 0) {
    throw new Error(`french-entity-agent-${label}-schema-empty`);
  }
  const unitIds = new Set<string>();
  for (const contract of contracts) {
    if (!contract.unitId || unitIds.has(contract.unitId)) {
      throw new Error(`french-entity-agent-${label}-schema-unit-invalid`);
    }
    unitIds.add(contract.unitId);
    assertSha256(contract.inputHash, `${label}-schema-input`);
  }
}

function proposalOutputItemSchema(
  contract: FrenchEntityAgentProposalOutputContract
): object {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "schemaVersion",
      "role",
      "unitId",
      "inputHash",
      "canonicalEntities",
      "memberPolicies"
    ],
    properties: {
      schemaVersion: {
        type: "string",
        enum: [FRENCH_ENTITY_AGENT_PROPOSAL_SCHEMA_VERSION]
      },
      role: { type: "string", enum: [contract.role] },
      unitId: { type: "string", enum: [contract.unitId] },
      inputHash: { type: "string", enum: [contract.inputHash] },
      canonicalEntities: {
        type: "array",
        minItems: contract.ownerEntityIds.length,
        maxItems: contract.ownerEntityIds.length,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["entityId", "primaryFr", "evidenceHashes", "reasons"],
          properties: {
            entityId:
              contract.ownerEntityIds.length > 0
                ? { type: "integer", enum: contract.ownerEntityIds }
                : { type: "integer", minimum: 1 },
            primaryFr: { type: "string", minLength: 1 },
            evidenceHashes: hashArraySchema(),
            reasons: nonEmptyStringArraySchema()
          }
        }
      },
      memberPolicies: {
        type: "array",
        minItems: contract.reviewEntryKeys.length,
        maxItems: contract.reviewEntryKeys.length,
        items: memberProposalSchema(
          contract.reviewEntryKeys,
          contract.unboundNameEntryKeys
        )
      }
    }
  };
}

function arbitrationOutputItemSchema(
  contract: FrenchEntityAgentArbitrationOutputContract,
  selectedProposal: "proposalA" | "proposalB",
  selectedProposalHash: string
): object {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "schemaVersion",
      "role",
      "unitId",
      "inputHash",
      "selectedProposal",
      "selectedProposalHash",
      "reasons"
    ],
    properties: {
      schemaVersion: {
        type: "string",
        enum: [FRENCH_ENTITY_AGENT_ARBITRATION_SCHEMA_VERSION]
      },
      role: { type: "string", enum: ["arbiter"] },
      unitId: { type: "string", enum: [contract.unitId] },
      inputHash: { type: "string", enum: [contract.inputHash] },
      selectedProposal: { type: "string", enum: [selectedProposal] },
      selectedProposalHash: {
        type: "string",
        enum: [selectedProposalHash]
      },
      reasons: nonEmptyStringArraySchema()
    }
  };
}

function auditOutputItemSchema(
  contract: FrenchEntityAgentAuditOutputContract
): object {
  const evidenceConflictRequiresHold =
    contract.evidenceConflictCodes.length > 0;
  const mechanicallyProvenChecks = new Set([
    "exactStepIdentity",
    "exactEnglishLineage",
    "explicitMemberRelations"
  ]);
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "schemaVersion",
      "role",
      "unitId",
      "inputHash",
      "auditedProposalHash",
      "verdict",
      "checks",
      "reasons"
    ],
    properties: {
      schemaVersion: {
        type: "string",
        enum: [FRENCH_ENTITY_AGENT_AUDIT_SCHEMA_VERSION]
      },
      role: { type: "string", enum: ["auditor"] },
      unitId: { type: "string", enum: [contract.unitId] },
      inputHash: { type: "string", enum: [contract.inputHash] },
      auditedProposalHash: {
        type: "string",
        enum: [contract.auditedProposalHash]
      },
      verdict: {
        type: "string",
        enum: evidenceConflictRequiresHold
          ? ["hold", "block"]
          : ["safe", "hold", "block"]
      },
      checks: {
        type: "object",
        additionalProperties: false,
        required: auditCheckKeys(),
        properties: Object.fromEntries(
          auditCheckKeys().map((key) => [
            key,
            {
              type: "string",
              enum:
                evidenceConflictRequiresHold &&
                key === "canonicalPrimaryCoherence"
                  ? ["fail"]
                  : mechanicallyProvenChecks.has(key)
                    ? ["pass"]
                    : ["pass", "fail"]
            }
          ])
        )
      },
      reasons: {
        type: "array",
        ...(evidenceConflictRequiresHold ? { minItems: 1 } : {}),
        items: { type: "string", minLength: 1 }
      }
    }
  };
}

function memberProposalSchema(
  reviewEntryKeys: readonly string[],
  unboundNameEntryKeys: readonly string[] = []
): object {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "entryKey",
      "treatment",
      "entityBindings",
      "constraint",
      "primaryFr",
      "derivedFr",
      "englishForms",
      "allowedFrenchForms",
      "evidenceHashes",
      "reasons"
    ],
    properties: {
      entryKey: { type: "string", enum: reviewEntryKeys },
      treatment: {
        type: "string",
        enum: [
          "canonical-name",
          "alternate-name",
          ...(unboundNameEntryKeys.length > 0
            ? ["unregistered-proper-name"]
            : []),
          "gentilic",
          "title-or-epithet",
          "compound-name",
          "etymological-or-common-gloss"
        ]
      },
      entityBindings: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["entityId", "relation"],
          properties: {
            entityId: { type: "integer", minimum: 1 },
            relation: {
              type: "string",
              enum: [
                "primary",
                "alias",
                "gentilic",
                "title",
                "compound",
                "etymological"
              ]
            }
          }
        }
      },
      constraint: {
        type: "string",
        enum: [
          "canonical",
          "derived",
          ...(unboundNameEntryKeys.length > 0
            ? ["proper-name-without-entity"]
            : []),
          "lexical-translation"
        ]
      },
      primaryFr: { type: ["string", "null"] },
      derivedFr: { type: ["string", "null"] },
      englishForms: { type: "array", items: { type: "string", minLength: 1 } },
      allowedFrenchForms: {
        type: "array",
        minItems: 1,
        maxItems: 1,
        items: { type: "string", minLength: 1 }
      },
      evidenceHashes: hashArraySchema(),
      reasons: nonEmptyStringArraySchema()
    }
  };
}

function hashArraySchema(): object {
  return {
    type: "array",
    minItems: 1,
    items: { type: "string", pattern: "^[a-f0-9]{64}$" }
  };
}

function nonEmptyStringArraySchema(): object {
  return {
    type: "array",
    minItems: 1,
    items: { type: "string", minLength: 1 }
  };
}

function auditCheckKeys(): Array<keyof FrenchEntityAgentAuditChecks> {
  return [
    "exactStepIdentity",
    "exactEnglishLineage",
    "canonicalPrimaryCoherence",
    "singularEditorialLemma",
    "explicitMemberRelations",
    "noCommonGlossForcedAsName",
    "frenchNaturalness",
    "historicalWitnessNotSoleAuthority"
  ];
}

function parseAuditChecks(
  value: unknown,
  unitId: string
): FrenchEntityAgentAuditChecks {
  const raw = objectValue(value, "audit-checks");
  assertExactKeys(raw, auditCheckKeys(), `audit-checks:${unitId}`);
  const result = {} as FrenchEntityAgentAuditChecks;
  for (const key of auditCheckKeys()) {
    const check = raw[key];
    if (check !== "pass" && check !== "fail") {
      throw new Error(`french-entity-agent-audit-check:${unitId}:${key}`);
    }
    result[key] = check;
  }
  return result;
}

function buildFrenchEntityEnglishMentionIndex(
  plan: FrenchEntityCanonicalizationPlan
): FrenchEntityEnglishMention[] {
  const entityIdsByForm = new Map<string, Set<number>>();
  for (const candidate of [...plan.anchors, ...plan.reviewCandidates]) {
    for (const match of candidate.entityMatches) {
      for (const form of [match.entityEn, match.aliasEn]) {
        const normalized = normalizeFrenchEvidence(form);
        if (!normalized) continue;
        const ids = entityIdsByForm.get(normalized) ?? new Set<number>();
        ids.add(match.entityId);
        entityIdsByForm.set(normalized, ids);
      }
    }
  }
  return [...entityIdsByForm.entries()]
    .filter(([, entityIds]) => entityIds.size === 1)
    .map(([normalized, entityIds]) => ({
      normalized,
      entityId: [...entityIds][0] as number
    }))
    .sort(
      (left, right) =>
        right.normalized.length - left.normalized.length ||
        compareText(left.normalized, right.normalized) ||
        left.entityId - right.entityId
    );
}

function requiredCanonicalComponentIds(
  candidate: FrenchEntityCanonicalizationCandidate,
  mentions: readonly FrenchEntityEnglishMention[]
): number[] {
  if (
    !candidate.entityMatches.some(
      (match) => match.significance === "NameCombined"
    )
  ) {
    return [];
  }
  const source = normalizeFrenchEvidence(
    [candidate.englishGloss, ...candidate.sourceForms.englishEntityForms].join(
      " "
    )
  );
  const boundedSource = ` ${source} `;
  const directEntityIds = new Set(candidate.entityIds);
  const required = new Set<number>();
  for (const mention of mentions) {
    if (
      !directEntityIds.has(mention.entityId) &&
      boundedSource.includes(` ${mention.normalized} `)
    ) {
      required.add(mention.entityId);
    }
  }
  return [...required].sort((left, right) => left - right);
}

function missingCanonicalComponentIds(
  candidate: FrenchEntityCanonicalizationCandidate,
  selectedFrench: string,
  canonicalById: ReadonlyMap<
    number,
    Pick<FrenchCanonicalEntityRecord, "entityId" | "normalizedPrimaryFr">
  >,
  mentions: readonly FrenchEntityEnglishMention[]
): number[] {
  const boundedFrench = ` ${normalizeFrenchEvidence(selectedFrench)} `;
  return requiredCanonicalComponentIds(candidate, mentions).filter(
    (entityId) => {
      const canonical = canonicalById.get(entityId);
      return (
        !canonical ||
        !boundedFrench.includes(` ${canonical.normalizedPrimaryFr} `)
      );
    }
  );
}

function uniqueRawByUnit(
  values: readonly unknown[],
  label: string
): Map<string, Record<string, unknown>> {
  const result = new Map<string, Record<string, unknown>>();
  for (const value of values) {
    const raw = objectValue(value, label);
    if (typeof raw.unitId !== "string" || result.has(raw.unitId)) {
      throw new Error(`french-entity-agent-${label}-unit-duplicate`);
    }
    result.set(raw.unitId, raw);
  }
  return result;
}

function uniqueRawByEntry(
  values: readonly unknown[],
  unitId: string
): Map<string, Record<string, unknown>> {
  const result = new Map<string, Record<string, unknown>>();
  for (const value of values) {
    const raw = objectValue(value, "member-proposal");
    if (typeof raw.entryKey !== "string" || result.has(raw.entryKey)) {
      throw new Error(`french-entity-agent-member-duplicate:${unitId}`);
    }
    result.set(raw.entryKey, raw);
  }
  return result;
}

function parseObject(text: string, label: string): Record<string, unknown> {
  try {
    return objectValue(JSON.parse(text) as unknown, label);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`french-entity-agent-${label}-invalid-json`);
    }
    throw error;
  }
}

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`french-entity-agent-${label}-not-object`);
  }
  return value as Record<string, unknown>;
}

function assertExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string
): void {
  const actual = Object.keys(value).sort(compareText);
  const wanted = [...expected].sort(compareText);
  if (canonicalFrenchEntityJson(actual) !== canonicalFrenchEntityJson(wanted)) {
    throw new Error(`french-entity-agent-${label}-keys`);
  }
}

function nullableTrimmedString(value: unknown, label: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`french-entity-agent-${label}-invalid`);
  }
  return value.trim();
}

function stringArray(
  value: unknown,
  label: string,
  requireNonEmpty: boolean
): string[] {
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string" || !item.trim())
  ) {
    throw new Error(`french-entity-agent-${label}-invalid`);
  }
  const result = uniqueSorted((value as string[]).map((item) => item.trim()));
  if (requireNonEmpty && result.length === 0) {
    throw new Error(`french-entity-agent-${label}-empty`);
  }
  return result;
}

function hashArray(value: unknown, label: string): string[] {
  const result = stringArray(value, label, true);
  for (const hash of result) assertSha256(hash, label);
  return result;
}

function assertSha256(value: string, label: string): void {
  if (!SHA256_PATTERN.test(value)) {
    throw new Error(`french-entity-agent-sha256:${label}`);
  }
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

function requiredMap<K, V>(map: ReadonlyMap<K, V>, key: K): V {
  const value = map.get(key);
  if (value === undefined) {
    throw new Error(`french-entity-agent-map-missing:${String(key)}`);
  }
  return value;
}

function safeNamespace(value: string): string {
  const safe = value.toLowerCase().replace(/[^a-z0-9._-]+/gu, "-");
  if (!safe || !/^[a-z0-9][a-z0-9._-]*$/u.test(safe)) {
    throw new Error("french-entity-agent-namespace-invalid");
  }
  return safe;
}

function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
