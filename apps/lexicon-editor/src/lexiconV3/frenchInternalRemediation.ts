import { createHash } from "node:crypto";

import {
  assertFrenchInternalReviewRecord,
  canonicalFrenchInternalJson,
  evaluateFrenchInternalReview,
  hashFrenchInternalJson,
  rebuildFrenchInternalSiblingConsistency,
  type FrenchInternalAgentProof,
  type FrenchInternalAuditCheck,
  type FrenchInternalReviewRecord,
  type FrenchInternalReviewStatus,
  type FrenchInternalRole
} from "./frenchInternalReview.js";
import {
  type LexiconV3FrenchPacket,
  validateFrenchPacket
} from "./frenchPackets.js";
import type { FrenchValidationIssue } from "./frenchValidation.js";
import type { RequiredFrenchEntityMention } from "./frenchEntityMentions.js";

export const FRENCH_INTERNAL_REMEDIATION_POLICY_VERSION =
  "lexicon-v3-french-internal-remediation-policy@2" as const;
export const FRENCH_INTERNAL_REMEDIATION_PLAN_SCHEMA_VERSION =
  "lexicon-v3-french-internal-remediation-plan@1" as const;
export const FRENCH_INTERNAL_REMEDIATION_ITEM_SCHEMA_VERSION =
  "lexicon-v3-french-internal-remediation-item@2" as const;
export const FRENCH_INTERNAL_REMEDIATION_MERGE_SCHEMA_VERSION =
  "lexicon-v3-french-internal-remediation-merge@1" as const;
export const FRENCH_INTERNAL_REMEDIATION_VIEW_CONTEXT_SCHEMA_VERSION =
  "lexicon-v3-french-internal-remediation-view-context@2" as const;

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const ROLES: readonly FrenchInternalRole[] = [
  "proposerA",
  "proposerB",
  "arbiter",
  "auditor"
];
const STATUSES: readonly FrenchInternalReviewStatus[] = [
  "auto_validated",
  "review_needed",
  "blocked_source_issue",
  "failed"
];

export interface FrenchInternalRemediationSourceArtifact {
  path: string;
  sha256: string;
  records: number;
  logicalDigest: string;
}

export interface FrenchInternalRemediationPlanItem {
  schemaVersion: typeof FRENCH_INTERNAL_REMEDIATION_ITEM_SCHEMA_VERSION;
  round: number;
  entryKey: string;
  stepEntryId: number;
  packetHash: string;
  englishHash: string;
  englishReleaseKey: string;
  englishReleaseSnapshotFingerprint: string;
  glossParentContentHash: string;
  meaningParentContentHash: string;
  generationConfigHash: string;
  parentReviewArtifactHash: string;
  parentStatus: Exclude<FrenchInternalReviewStatus, "auto_validated">;
  /** Mechanical gate codes only. */
  parentGateIssues: string[];
  /**
   * Exact diagnostic feedback from the immediately preceding attempt. The
   * proposal bodies remain sealed; only validation findings and reviewer
   * feedback are exposed to the fresh remediation agents.
   */
  parentDiagnostics: FrenchInternalRemediationParentDiagnostics;
  parentEvaluationHash: string;
  parentHash: string;
  itemHash: string;
}

export interface FrenchInternalRemediationParentDiagnostics {
  recordIssues: string[];
  validation: {
    proposalA: FrenchValidationIssue[];
    proposalB: FrenchValidationIssue[];
    selected: FrenchValidationIssue[];
  };
  arbitration: {
    verdict: NonNullable<FrenchInternalReviewRecord["arbiter"]>["verdict"];
    reasons: string[];
  } | null;
  audit: {
    verdict: NonNullable<FrenchInternalReviewRecord["auditor"]>["verdict"];
    reasons: string[];
    confidence: number;
    failedChecks: FrenchInternalAuditCheck[];
  } | null;
  sibling: {
    verdict: NonNullable<
      FrenchInternalReviewRecord["siblingConsistency"]
    >["verdict"];
    issues: string[];
  } | null;
}

export interface FrenchInternalRemediationPlan {
  schemaVersion: typeof FRENCH_INTERNAL_REMEDIATION_PLAN_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_INTERNAL_REMEDIATION_POLICY_VERSION;
  round: number;
  maxRounds: number;
  generationConfigHash: string;
  executionContract: {
    runtime: "codex-internal-agent-runtime";
    cel: "forbidden";
    aiGateway: "forbidden";
    localTools: "disabled";
    networkDataTools: "disabled";
    shell: "disabled";
    proposers: ["proposerA", "proposerB"];
    proposerIndependenceRequired: true;
    arbiterAndAuditorRequired: true;
    exactSelectedCoverageRequired: true;
    replacementPolicy: "fresh-attempt-advances-auto-validated-only-publishes";
  };
  sources: {
    packets: FrenchInternalRemediationSourceArtifact;
    reviews: FrenchInternalRemediationSourceArtifact;
  };
  counts: {
    packets: number;
    reviews: number;
    selected: number;
    statuses: Record<FrenchInternalReviewStatus, number>;
  };
  /** Compatible with the existing custom Codex-batch selector. */
  keys: string[];
  /** The custom selector requires exactly hash({ keys }). */
  contentHash: string;
  items: FrenchInternalRemediationPlanItem[];
  planHash: string;
}

export interface BuildFrenchInternalRemediationPlanInput {
  round: number;
  maxRounds: number;
  packets: readonly LexiconV3FrenchPacket[];
  reviews: readonly FrenchInternalReviewRecord[];
  requiredEntityMentions?: readonly RequiredFrenchEntityMention[];
  sources: FrenchInternalRemediationPlan["sources"];
}

export interface FrenchInternalRemediationAttemptLink {
  entryKey: string;
  planItemHash: string;
  parentHash: string;
  parentReviewArtifactHash: string;
  attemptedReviewArtifactHash: string;
  attemptedStatus: FrenchInternalReviewStatus;
  attemptHash: string;
}

export interface FrenchInternalRemediationProposerInputLink {
  entryKey: string;
  planItemHash: string;
  parentHash: string;
  proposerAInputHash: string;
  proposerBInputHash: string;
  inputLinkHash: string;
}

export interface FrenchInternalRemediationReplacementLink extends FrenchInternalRemediationAttemptLink {
  attemptedStatus: "auto_validated";
  replacementHash: string;
}

export interface FrenchInternalRemediationResidual {
  entryKey: string;
  reviewArtifactHash: string;
  status: Exclude<FrenchInternalReviewStatus, "auto_validated">;
  residualHash: string;
}

export interface FrenchInternalRemediationMerge {
  schemaVersion: typeof FRENCH_INTERNAL_REMEDIATION_MERGE_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_INTERNAL_REMEDIATION_POLICY_VERSION;
  round: number;
  maxRounds: number;
  planHash: string;
  sources: FrenchInternalRemediationPlan["sources"] & {
    batchManifest: FrenchInternalRemediationSourceArtifact;
    attemptedReviews: FrenchInternalRemediationSourceArtifact;
  };
  counts: {
    outputRecords: number;
    attempted: number;
    replaced: number;
    retained: number;
    residual: number;
    statuses: Record<FrenchInternalReviewStatus, number>;
  };
  proposerInputs: FrenchInternalRemediationProposerInputLink[];
  attempts: FrenchInternalRemediationAttemptLink[];
  replacements: FrenchInternalRemediationReplacementLink[];
  residuals: FrenchInternalRemediationResidual[];
  outputLogicalDigest: string;
  outputDigest: string;
  mergeHash: string;
}

export interface BuildFrenchInternalRemediationMergeInput {
  plan: FrenchInternalRemediationPlan;
  packets: readonly LexiconV3FrenchPacket[];
  previousReviews: readonly FrenchInternalReviewRecord[];
  attemptedReviews: readonly FrenchInternalReviewRecord[];
  requiredEntityMentions?: readonly RequiredFrenchEntityMention[];
  proposerInputs: readonly FrenchInternalRemediationProposerInputLink[];
  batchManifestSource: FrenchInternalRemediationSourceArtifact;
  attemptedReviewsSource: FrenchInternalRemediationSourceArtifact;
}

export interface FrenchInternalRemediationMergeBuild {
  records: FrenchInternalReviewRecord[];
  merge: FrenchInternalRemediationMerge;
}

export function frenchInternalRemediationPacketLogicalDigest(
  packets: readonly LexiconV3FrenchPacket[]
): string {
  return hashFrenchInternalJson(
    packets.map((packet) => ({
      entryKey: packet.entryKey,
      stepEntryId: packet.identity.stepEntryId,
      packetHash: packet.packetHash,
      englishHash: packet.english.contentHash,
      englishReleaseKey: packet.englishRelease.releaseKey,
      englishReleaseSnapshotFingerprint:
        packet.englishRelease.releaseSnapshotFingerprint,
      glossParentContentHash: packet.englishRelease.parents.gloss.contentHash,
      meaningParentContentHash:
        packet.englishRelease.parents.meaning.contentHash
    }))
  );
}

export function frenchInternalRemediationReviewLogicalDigest(
  reviews: readonly FrenchInternalReviewRecord[]
): string {
  return hashFrenchInternalJson(
    reviews.map((review) => ({
      entryKey: review.entryKey,
      status: review.status,
      artifactHash: review.artifactHash
    }))
  );
}

export function renderFrenchInternalRemediationReviews(
  reviews: readonly FrenchInternalReviewRecord[]
): string {
  return reviews.length === 0
    ? ""
    : `${reviews.map((review) => JSON.stringify(review)).join("\n")}\n`;
}

export function buildFrenchInternalRemediationProposerInputLink(input: {
  item: FrenchInternalRemediationPlanItem;
  batchManifestSha256: string;
  proposerAInputHash: string;
  proposerBInputHash: string;
}): FrenchInternalRemediationProposerInputLink {
  if (
    !SHA256_PATTERN.test(input.batchManifestSha256) ||
    !SHA256_PATTERN.test(input.proposerAInputHash) ||
    !SHA256_PATTERN.test(input.proposerBInputHash)
  ) {
    throw new Error("french-remediation-proposer-input-hash-invalid");
  }
  const content = {
    entryKey: input.item.entryKey,
    planItemHash: input.item.itemHash,
    parentHash: input.item.parentHash,
    proposerAInputHash: input.proposerAInputHash,
    proposerBInputHash: input.proposerBInputHash
  };
  return {
    ...content,
    inputLinkHash: hashFrenchInternalJson({
      batchManifestSha256: input.batchManifestSha256,
      ...content
    })
  };
}

export function buildFrenchInternalRemediationParentDiagnostics(
  review: FrenchInternalReviewRecord
): FrenchInternalRemediationParentDiagnostics {
  const auditor = review.auditor;
  return {
    recordIssues: [...review.issues],
    validation: {
      proposalA: [...(review.validationA?.issues ?? [])],
      proposalB: [...(review.validationB?.issues ?? [])],
      selected: [...(review.arbiter?.validation.issues ?? [])]
    },
    arbitration: review.arbiter
      ? {
          verdict: review.arbiter.verdict,
          reasons: [...review.arbiter.reasons]
        }
      : null,
    audit: auditor
      ? {
          verdict: auditor.verdict,
          reasons: [...auditor.reasons],
          confidence: auditor.confidence,
          failedChecks: (
            Object.keys(auditor.checks) as FrenchInternalAuditCheck[]
          ).filter((check) => auditor.checks[check] === "fail")
        }
      : null,
    sibling: review.siblingConsistency
      ? {
          verdict: review.siblingConsistency.verdict,
          issues: [...review.siblingConsistency.issues]
        }
      : null
  };
}

export function buildFrenchInternalRemediationPlan(
  input: BuildFrenchInternalRemediationPlanInput
): FrenchInternalRemediationPlan {
  assertRound(input.round, input.maxRounds);
  assertSourceArtifact(input.sources.packets, "packets");
  assertSourceArtifact(input.sources.reviews, "reviews");
  const {
    packetByKey,
    reviewByKey,
    generationConfigHash,
    requiredEntityMentionsByEntry
  } = validateExactReviewCoverage(
    input.packets,
    input.reviews,
    input.requiredEntityMentions
  );
  assertSourceMatchesPackets(input.sources.packets, input.packets);
  assertSourceMatchesReviews(input.sources.reviews, input.reviews, "reviews");

  const statuses = statusCounts(input.reviews);
  const items = [...packetByKey.keys()]
    .sort(compareText)
    .flatMap((entryKey) => {
      const packet = packetByKey.get(entryKey)!;
      const review = reviewByKey.get(entryKey)!;
      if (review.status === "auto_validated") return [];
      const evaluation = evaluateFrenchInternalReview({
        packet,
        record: review,
        expectedGenerationConfigHash: generationConfigHash,
        requiredEntityMentions:
          requiredEntityMentionsByEntry.get(entryKey) ?? []
      });
      const parentDiagnostics =
        buildFrenchInternalRemediationParentDiagnostics(review);
      const itemContent = {
        schemaVersion: FRENCH_INTERNAL_REMEDIATION_ITEM_SCHEMA_VERSION,
        round: input.round,
        entryKey,
        stepEntryId: packet.identity.stepEntryId,
        packetHash: packet.packetHash,
        englishHash: packet.english.contentHash,
        englishReleaseKey: packet.englishRelease.releaseKey,
        englishReleaseSnapshotFingerprint:
          packet.englishRelease.releaseSnapshotFingerprint,
        glossParentContentHash: packet.englishRelease.parents.gloss.contentHash,
        meaningParentContentHash:
          packet.englishRelease.parents.meaning.contentHash,
        generationConfigHash,
        parentReviewArtifactHash: review.artifactHash,
        parentStatus: review.status,
        parentGateIssues: uniqueSorted([
          ...evaluation.structuralIssues,
          ...evaluation.autoEligibilityIssues
        ]),
        parentDiagnostics,
        parentEvaluationHash: hashFrenchInternalJson({
          structuralIssues: evaluation.structuralIssues,
          autoEligibilityIssues: evaluation.autoEligibilityIssues,
          diagnostics: parentDiagnostics
        }),
        parentHash: hashFrenchInternalJson({
          entryKey,
          packetHash: packet.packetHash,
          englishHash: packet.english.contentHash,
          englishReleaseKey: packet.englishRelease.releaseKey,
          englishReleaseSnapshotFingerprint:
            packet.englishRelease.releaseSnapshotFingerprint,
          glossParentContentHash:
            packet.englishRelease.parents.gloss.contentHash,
          meaningParentContentHash:
            packet.englishRelease.parents.meaning.contentHash,
          generationConfigHash,
          reviewArtifactHash: review.artifactHash
        })
      };
      return [
        {
          ...itemContent,
          itemHash: hashFrenchInternalJson(itemContent)
        } satisfies FrenchInternalRemediationPlanItem
      ];
    });
  const keys = items.map((item) => item.entryKey);
  const content = {
    schemaVersion: FRENCH_INTERNAL_REMEDIATION_PLAN_SCHEMA_VERSION,
    policyVersion: FRENCH_INTERNAL_REMEDIATION_POLICY_VERSION,
    round: input.round,
    maxRounds: input.maxRounds,
    generationConfigHash,
    executionContract: {
      runtime: "codex-internal-agent-runtime" as const,
      cel: "forbidden" as const,
      aiGateway: "forbidden" as const,
      localTools: "disabled" as const,
      networkDataTools: "disabled" as const,
      shell: "disabled" as const,
      proposers: ["proposerA", "proposerB"] as ["proposerA", "proposerB"],
      proposerIndependenceRequired: true as const,
      arbiterAndAuditorRequired: true as const,
      exactSelectedCoverageRequired: true as const,
      replacementPolicy:
        "fresh-attempt-advances-auto-validated-only-publishes" as const
    },
    sources: input.sources,
    counts: {
      packets: input.packets.length,
      reviews: input.reviews.length,
      selected: items.length,
      statuses
    },
    keys,
    contentHash: hashFrenchInternalJson({ keys }),
    items
  };
  return { ...content, planHash: hashFrenchInternalJson(content) };
}

export function assertFrenchInternalRemediationPlan(
  plan: FrenchInternalRemediationPlan,
  input: Omit<BuildFrenchInternalRemediationPlanInput, "round" | "maxRounds">
): void {
  if (
    plan.schemaVersion !== FRENCH_INTERNAL_REMEDIATION_PLAN_SCHEMA_VERSION ||
    plan.policyVersion !== FRENCH_INTERNAL_REMEDIATION_POLICY_VERSION ||
    !SHA256_PATTERN.test(plan.planHash)
  ) {
    throw new Error("invalid-french-remediation-plan-envelope");
  }
  const rebuilt = buildFrenchInternalRemediationPlan({
    ...input,
    round: plan.round,
    maxRounds: plan.maxRounds
  });
  if (
    canonicalFrenchInternalJson(rebuilt) !== canonicalFrenchInternalJson(plan)
  ) {
    throw new Error("invalid-french-remediation-plan-content");
  }
}

export function buildFrenchInternalRemediationMerge(
  input: BuildFrenchInternalRemediationMergeInput
): FrenchInternalRemediationMergeBuild {
  assertSourceArtifact(input.batchManifestSource, "batch-manifest");
  assertSourceArtifact(input.attemptedReviewsSource, "attempted-reviews");
  assertFrenchInternalRemediationPlan(input.plan, {
    packets: input.packets,
    reviews: input.previousReviews,
    requiredEntityMentions: input.requiredEntityMentions,
    sources: input.plan.sources
  });
  const {
    packetByKey,
    reviewByKey,
    generationConfigHash,
    requiredEntityMentionsByEntry
  } = validateExactReviewCoverage(
    input.packets,
    input.previousReviews,
    input.requiredEntityMentions
  );
  const attemptedByKey = uniqueMap(
    input.attemptedReviews,
    (review) => review.entryKey,
    "attempted-review"
  );
  assertExactKeySet(input.plan.keys, attemptedByKey, "attempted-review");
  if (
    input.attemptedReviews.some(
      (review, index) => review.entryKey !== input.plan.keys[index]
    )
  ) {
    throw new Error("french-remediation-attempted-review-order-mismatch");
  }
  const proposerInputByKey = uniqueMap(
    input.proposerInputs,
    (link) => link.entryKey,
    "proposer-input"
  );
  assertExactKeySet(input.plan.keys, proposerInputByKey, "proposer-input");
  if (
    input.proposerInputs.some(
      (link, index) => link.entryKey !== input.plan.keys[index]
    ) ||
    input.batchManifestSource.records !== input.plan.keys.length ||
    input.batchManifestSource.logicalDigest !==
      hashFrenchInternalJson({
        manifestSha256: input.batchManifestSource.sha256,
        proposerInputs: input.proposerInputs
      })
  ) {
    throw new Error("french-remediation-proposer-input-proof-mismatch");
  }
  assertSourceMatchesReviews(
    input.attemptedReviewsSource,
    input.attemptedReviews,
    "attempted-reviews"
  );

  const planItemByKey = uniqueMap(
    input.plan.items,
    (item) => item.entryKey,
    "plan-item"
  );
  const attempts: FrenchInternalRemediationAttemptLink[] = [];
  const replacements: FrenchInternalRemediationReplacementLink[] = [];
  const outputByKey = new Map(reviewByKey);
  for (const entryKey of input.plan.keys) {
    const packet = packetByKey.get(entryKey)!;
    const parent = reviewByKey.get(entryKey)!;
    const item = planItemByKey.get(entryKey)!;
    const attempted = attemptedByKey.get(entryKey)!;
    const proposerInputs = proposerInputByKey.get(entryKey)!;
    assertPlanParent(item, parent, packet, input.plan);
    assertProposerInputLink(
      proposerInputs,
      item,
      input.batchManifestSource.sha256
    );
    const evaluation = assertFrenchInternalReviewRecord({
      packet,
      record: attempted,
      expectedGenerationConfigHash: generationConfigHash,
      requiredEntityMentions:
        requiredEntityMentionsByEntry.get(entryKey) ?? []
    });
    assertCompleteFreshAttempt(parent, attempted, proposerInputs);
    const attemptContent = {
      entryKey,
      planItemHash: item.itemHash,
      parentHash: item.parentHash,
      parentReviewArtifactHash: parent.artifactHash,
      attemptedReviewArtifactHash: attempted.artifactHash,
      attemptedStatus: attempted.status
    };
    const attempt = {
      ...attemptContent,
      attemptHash: hashFrenchInternalJson({
        planHash: input.plan.planHash,
        ...attemptContent
      })
    } satisfies FrenchInternalRemediationAttemptLink;
    attempts.push(attempt);
    // A failed/held attempt is never publishable, but it must become the
    // diagnostic parent of the next bounded round. Otherwise each round sees
    // the same stale feedback and cannot learn from the immediately preceding
    // audit. Publication remains fail-closed because the run can complete only
    // when every output row is auto_validated.
    outputByKey.set(entryKey, attempted);
    if (attempted.status !== "auto_validated") continue;
    if (!evaluation.autoEligible) {
      throw new Error(
        `french-remediation-auto-result-not-eligible:${entryKey}`
      );
    }
    const replacementContent = {
      ...attempt,
      attemptedStatus: "auto_validated" as const
    };
    const replacement = {
      ...replacementContent,
      replacementHash: hashFrenchInternalJson({
        planHash: input.plan.planHash,
        replacement: replacementContent
      })
    } satisfies FrenchInternalRemediationReplacementLink;
    replacements.push(replacement);
  }

  const records = rebuildFrenchInternalSiblingConsistency({
    packets: input.packets,
    records: input.packets.map((packet) => outputByKey.get(packet.entryKey)!)
  });
  validateExactReviewCoverage(input.packets, records);
  assertUnselectedReviewsUnchanged(
    input.plan,
    input.previousReviews,
    outputByKey
  );
  const statuses = statusCounts(records);
  const residuals = records
    .filter(
      (
        review
      ): review is FrenchInternalReviewRecord & {
        status: Exclude<FrenchInternalReviewStatus, "auto_validated">;
      } => review.status !== "auto_validated"
    )
    .map((review) => {
      const content = {
        entryKey: review.entryKey,
        reviewArtifactHash: review.artifactHash,
        status: review.status
      };
      return { ...content, residualHash: hashFrenchInternalJson(content) };
    })
    .sort((left, right) => compareText(left.entryKey, right.entryKey));
  const outputText = renderFrenchInternalRemediationReviews(records);
  const outputLogicalDigest =
    frenchInternalRemediationReviewLogicalDigest(records);
  const content = {
    schemaVersion: FRENCH_INTERNAL_REMEDIATION_MERGE_SCHEMA_VERSION,
    policyVersion: FRENCH_INTERNAL_REMEDIATION_POLICY_VERSION,
    round: input.plan.round,
    maxRounds: input.plan.maxRounds,
    planHash: input.plan.planHash,
    sources: {
      ...input.plan.sources,
      batchManifest: input.batchManifestSource,
      attemptedReviews: input.attemptedReviewsSource
    },
    counts: {
      outputRecords: records.length,
      attempted: attempts.length,
      replaced: replacements.length,
      retained: attempts.length - replacements.length,
      residual: residuals.length,
      statuses
    },
    proposerInputs: [...input.proposerInputs],
    attempts,
    replacements,
    residuals,
    outputLogicalDigest,
    outputDigest: hashRawText(outputText)
  };
  return {
    records,
    merge: { ...content, mergeHash: hashFrenchInternalJson(content) }
  };
}

function validateExactReviewCoverage(
  packets: readonly LexiconV3FrenchPacket[],
  reviews: readonly FrenchInternalReviewRecord[],
  requiredEntityMentions: readonly RequiredFrenchEntityMention[] = []
): {
  packetByKey: Map<string, LexiconV3FrenchPacket>;
  reviewByKey: Map<string, FrenchInternalReviewRecord>;
  generationConfigHash: string;
  requiredEntityMentionsByEntry: Map<string, RequiredFrenchEntityMention[]>;
} {
  if (packets.length < 1) throw new Error("french-remediation-packets-empty");
  const packetByKey = uniqueMap(packets, (packet) => packet.entryKey, "packet");
  const reviewByKey = uniqueMap(reviews, (review) => review.entryKey, "review");
  assertExactKeySet([...packetByKey.keys()], reviewByKey, "review");
  const stepEntryIds = new Set<number>();
  const generationConfigHashes = new Set<string>();
  for (const packet of packets) {
    const issues = validateFrenchPacket(packet);
    if (issues.length > 0) {
      throw new Error(
        `french-remediation-packet-invalid:${packet.entryKey}:${issues.join(",")}`
      );
    }
    if (stepEntryIds.has(packet.identity.stepEntryId)) {
      throw new Error(
        `french-remediation-step-entry-duplicate:${packet.identity.stepEntryId}`
      );
    }
    stepEntryIds.add(packet.identity.stepEntryId);
    const review = reviewByKey.get(packet.entryKey)!;
    generationConfigHashes.add(review.generationConfigHash);
  }
  if (generationConfigHashes.size !== 1) {
    throw new Error("french-remediation-generation-config-not-uniform");
  }
  const generationConfigHash = [...generationConfigHashes][0]!;
  if (!SHA256_PATTERN.test(generationConfigHash)) {
    throw new Error("french-remediation-generation-config-invalid");
  }
  const requiredEntityMentionsByEntry = new Map<
    string,
    RequiredFrenchEntityMention[]
  >();
  for (const mention of requiredEntityMentions) {
    const values =
      requiredEntityMentionsByEntry.get(mention.sourceEntryKey) ?? [];
    values.push(mention);
    requiredEntityMentionsByEntry.set(mention.sourceEntryKey, values);
  }
  for (const values of requiredEntityMentionsByEntry.values()) {
    values.sort((left, right) => left.mentionId.localeCompare(right.mentionId));
  }
  for (const packet of packets) {
    assertFrenchInternalReviewRecord({
      packet,
      record: reviewByKey.get(packet.entryKey)!,
      expectedGenerationConfigHash: generationConfigHash,
      requiredEntityMentions:
        requiredEntityMentionsByEntry.get(packet.entryKey) ?? []
    });
  }
  return {
    packetByKey,
    reviewByKey,
    generationConfigHash,
    requiredEntityMentionsByEntry
  };
}

function assertCompleteFreshAttempt(
  parent: FrenchInternalReviewRecord,
  attempted: FrenchInternalReviewRecord,
  inputs: FrenchInternalRemediationProposerInputLink
): void {
  if (
    !attempted.proposalA ||
    !attempted.proposalB ||
    !attempted.arbiter ||
    !attempted.auditor ||
    !attempted.agentProofs ||
    ROLES.some((role) => !attempted.agentProofs?.[role])
  ) {
    throw new Error(
      `french-remediation-attempt-incomplete:${attempted.entryKey}`
    );
  }
  const proofs = attempted.agentProofs as Record<
    FrenchInternalRole,
    FrenchInternalAgentProof
  >;
  if (
    proofs.proposerA.inputHash !== inputs.proposerAInputHash ||
    proofs.proposerB.inputHash !== inputs.proposerBInputHash
  ) {
    throw new Error(
      `french-remediation-attempt-input-not-bound:${attempted.entryKey}`
    );
  }
  const newAgentIds = ROLES.map((role) => proofs[role].agentId);
  const newTasks = ROLES.map((role) => proofs[role].taskName);
  if (
    new Set(newAgentIds).size !== ROLES.length ||
    new Set(newTasks).size !== ROLES.length
  ) {
    throw new Error(
      `french-remediation-attempt-agents-not-independent:${attempted.entryKey}`
    );
  }
  const oldAgentIds = new Set(
    ROLES.flatMap((role) => {
      const proof = parent.agentProofs?.[role];
      return proof ? [proof.agentId] : [];
    })
  );
  const oldTasks = new Set(
    ROLES.flatMap((role) => {
      const proof = parent.agentProofs?.[role];
      return proof ? [proof.taskName] : [];
    })
  );
  if (
    newAgentIds.some((agentId) => oldAgentIds.has(agentId)) ||
    newTasks.some((taskName) => oldTasks.has(taskName))
  ) {
    throw new Error(
      `french-remediation-attempt-agent-not-fresh:${attempted.entryKey}`
    );
  }
}

function assertProposerInputLink(
  link: FrenchInternalRemediationProposerInputLink,
  item: FrenchInternalRemediationPlanItem,
  batchManifestSha256: string
): void {
  const { inputLinkHash, ...content } = link;
  if (
    link.entryKey !== item.entryKey ||
    link.planItemHash !== item.itemHash ||
    link.parentHash !== item.parentHash ||
    !SHA256_PATTERN.test(link.proposerAInputHash) ||
    !SHA256_PATTERN.test(link.proposerBInputHash) ||
    !SHA256_PATTERN.test(inputLinkHash) ||
    inputLinkHash !==
      hashFrenchInternalJson({ batchManifestSha256, ...content })
  ) {
    throw new Error(
      `french-remediation-proposer-input-link-invalid:${item.entryKey}`
    );
  }
}

function assertPlanParent(
  item: FrenchInternalRemediationPlanItem,
  parent: FrenchInternalReviewRecord,
  packet: LexiconV3FrenchPacket,
  plan: FrenchInternalRemediationPlan
): void {
  if (
    item.entryKey !== packet.entryKey ||
    item.packetHash !== packet.packetHash ||
    item.englishHash !== packet.english.contentHash ||
    item.englishReleaseKey !== packet.englishRelease.releaseKey ||
    item.englishReleaseSnapshotFingerprint !==
      packet.englishRelease.releaseSnapshotFingerprint ||
    item.glossParentContentHash !==
      packet.englishRelease.parents.gloss.contentHash ||
    item.meaningParentContentHash !==
      packet.englishRelease.parents.meaning.contentHash ||
    item.generationConfigHash !== plan.generationConfigHash ||
    item.parentReviewArtifactHash !== parent.artifactHash ||
    item.parentStatus !== parent.status ||
    !SHA256_PATTERN.test(item.parentHash) ||
    !SHA256_PATTERN.test(item.itemHash)
  ) {
    throw new Error(`french-remediation-parent-link-invalid:${item.entryKey}`);
  }
}

function assertUnselectedReviewsUnchanged(
  plan: FrenchInternalRemediationPlan,
  previous: readonly FrenchInternalReviewRecord[],
  output: Map<string, FrenchInternalReviewRecord>
): void {
  const selected = new Set(plan.keys);
  for (const review of previous) {
    if (
      !selected.has(review.entryKey) &&
      output.get(review.entryKey)?.artifactHash !== review.artifactHash
    ) {
      throw new Error(
        `french-remediation-unselected-review-changed:${review.entryKey}`
      );
    }
  }
}

function assertSourceMatchesPackets(
  source: FrenchInternalRemediationSourceArtifact,
  packets: readonly LexiconV3FrenchPacket[]
): void {
  if (
    source.records !== packets.length ||
    source.logicalDigest !==
      frenchInternalRemediationPacketLogicalDigest(packets)
  ) {
    throw new Error("french-remediation-packet-source-mismatch");
  }
}

function assertSourceMatchesReviews(
  source: FrenchInternalRemediationSourceArtifact,
  reviews: readonly FrenchInternalReviewRecord[],
  label: string
): void {
  if (
    source.records !== reviews.length ||
    source.logicalDigest !==
      frenchInternalRemediationReviewLogicalDigest(reviews)
  ) {
    throw new Error(`french-remediation-${label}-source-mismatch`);
  }
}

function assertSourceArtifact(
  source: FrenchInternalRemediationSourceArtifact,
  label: string
): void {
  if (
    !source.path.trim() ||
    !SHA256_PATTERN.test(source.sha256) ||
    !Number.isInteger(source.records) ||
    source.records < 0 ||
    !SHA256_PATTERN.test(source.logicalDigest)
  ) {
    throw new Error(`french-remediation-${label}-source-invalid`);
  }
}

function statusCounts(
  reviews: readonly FrenchInternalReviewRecord[]
): Record<FrenchInternalReviewStatus, number> {
  const result = Object.fromEntries(
    STATUSES.map((status) => [status, 0])
  ) as Record<FrenchInternalReviewStatus, number>;
  for (const review of reviews) result[review.status] += 1;
  return result;
}

function uniqueMap<T>(
  values: readonly T[],
  key: (value: T) => string,
  label: string
): Map<string, T> {
  const result = new Map<string, T>();
  for (const value of values) {
    const entryKey = key(value);
    if (!entryKey.trim() || result.has(entryKey)) {
      throw new Error(`french-remediation-${label}-duplicate:${entryKey}`);
    }
    result.set(entryKey, value);
  }
  return result;
}

function assertExactKeySet<T>(
  expectedKeys: readonly string[],
  actual: Map<string, T>,
  label: string
): void {
  const expected = new Set(expectedKeys);
  const missing = expectedKeys.filter((entryKey) => !actual.has(entryKey));
  const orphan = [...actual.keys()].filter(
    (entryKey) => !expected.has(entryKey)
  );
  if (
    missing.length > 0 ||
    orphan.length > 0 ||
    actual.size !== expectedKeys.length
  ) {
    throw new Error(
      `french-remediation-${label}-coverage:${missing.join("|")}:${orphan.join("|")}`
    );
  }
}

function assertRound(round: number, maxRounds: number): void {
  if (
    !Number.isInteger(round) ||
    round < 1 ||
    !Number.isInteger(maxRounds) ||
    maxRounds < 1 ||
    round > maxRounds
  ) {
    throw new Error(`french-remediation-round-invalid:${round}:${maxRounds}`);
  }
}

function hashRawText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right);
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}
