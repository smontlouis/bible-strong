import {
  assertFrenchEntityCanonicalizationResolved,
  hashFrenchEntityJson,
  FRENCH_ENTITY_CANONICALIZATION_GATE_SCHEMA_VERSION,
  FRENCH_ENTITY_CANONICALIZATION_POLICY_VERSION,
  type FrenchCanonicalEntityRecord,
  type FrenchCanonicalEntryNamePolicy,
  type FrenchEntityCanonicalizationExpectations,
  type FrenchEntityCanonicalizationGateResult,
  type FrenchEntityCanonicalizationPlan
} from "./frenchEntityCanonicalization.js";
import {
  FRENCH_ENTITY_AGENT_POLICY_VERSION,
  FRENCH_ENTITY_AGENT_TERMINAL_GATE_SCHEMA_VERSION,
  type FrenchEntityAgentMergeResult,
  type FrenchEntityAgentTerminalMergeResult,
  type FrenchEntityAgentTerminalGateResult
} from "./frenchEntityAgentReview.js";
import {
  assertFrenchEntityMentionsArtifact,
  assertFrenchEntityMentionsPublishable,
  buildFrenchEntityMentions,
  type BuildFrenchEntityMentionsInput,
  type FrenchEntityMentionsArtifact
} from "./frenchEntityMentions.js";
import {
  assertFrenchEntityMentionResolutionAttestation,
  buildFrenchEntityMentionResolutionPlan,
  type FrenchEntityMentionResolutionAttestation
} from "./frenchEntityMentionResolution.js";
import {
  canonicalFrenchInternalJson,
  hashFrenchInternalJson
} from "./frenchCodexExecutionReceipt.js";
import { buildLexiconEntryKey, extractPrimaryDStrong } from "./identity.js";
import {
  validateFrenchPacket,
  type LexiconV3FrenchPacket
} from "./frenchPackets.js";

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

export const FRENCH_ENTITY_PIPELINE_SUMMARY_SCHEMA_VERSION =
  "lexicon-v3-french-entity-pipeline-summary@3" as const;

/**
 * Reconstructs the exact entry quarantine sealed by a terminal entity merge.
 * Downstream stages must pass this list when replaying mention extraction;
 * otherwise a valid terminal gate with quarantined units is rejected or, more
 * importantly, replayed against a different mention input.
 */
export function frenchEntityQuarantinedEntryKeysFromMerge(input: {
  plan: FrenchEntityCanonicalizationPlan;
  merged: FrenchEntityAgentMergeResult | FrenchEntityAgentTerminalMergeResult;
}): string[] {
  if (!("quarantinedUnitIds" in input.merged)) return [];
  const unitById = new Map(
    input.plan.reviewUnits.map((unit) => [unit.unitId, unit] as const)
  );
  return [
    ...new Set(
      input.merged.quarantinedUnitIds.flatMap((unitId) => {
        const unit = unitById.get(unitId);
        if (!unit) {
          throw new Error(
            `french-entity-pipeline-quarantine-unit-missing:${unitId}`
          );
        }
        return unit.reviewEntryKeys;
      })
    )
  ].sort((left, right) => left.localeCompare(right));
}

export interface FrenchEntityPipelineSummary {
  schemaVersion: typeof FRENCH_ENTITY_PIPELINE_SUMMARY_SCHEMA_VERSION;
  generatedAt: string;
  sourcePaths: {
    plan: string;
    entityMergeAttestation: string;
    canonicalEntities: string;
    canonicalEntryPolicies: string;
    packets: string;
    mentionResolutionArtifact: string | null;
    mentionResolutionAttestation: string | null;
  };
  sourceHashes: {
    plan: string;
    entityMergeAttestation: string;
    canonicalEntities: string;
    canonicalEntryPolicies: string;
    packets: string;
    mentionResolutionArtifact: string | null;
    mentionResolutionAttestation: string | null;
  };
  outputPaths: {
    entityGate: string;
    entityMentions: string;
    summary: string;
  };
  outputHashes: {
    entityGate: string;
    entityMentions: string;
  };
  lineage: {
    planHash: string;
    releaseKey: string;
    releaseSnapshotFingerprint: string;
    entityMergeAttestationHash: string;
    entityGateHash: string;
    entityMentionsHash: string;
    mentionResolutionAttestationHash: string | null;
  };
  counts: {
    packets: number;
    canonicalEntities: number;
    canonicalEntryPolicies: number;
    requiredEntityMentions: number;
    exactEntityMentions: number;
    contextualEntityMentions: number;
    nonEntityMentions: number;
    quarantinedEntityMentions: number;
    blockingEntityMentions: 0;
  };
  summaryHash: string;
}

/**
 * Projects the promoted English packets into the exact input contract used by
 * the entity-mention extractor. This deliberately derives primaryDStrong from
 * dStrong and never falls back to a classical Strong or sibling STEP entry.
 */
export function buildFrenchEntityMentionsInputFromPackets(input: {
  packets: readonly LexiconV3FrenchPacket[];
  canonicalEntities: readonly FrenchCanonicalEntityRecord[];
  canonicalEntryPolicies: readonly FrenchCanonicalEntryNamePolicy[];
  quarantinedEntryKeys?: readonly string[];
}): BuildFrenchEntityMentionsInput {
  const packets = [...input.packets].sort((left, right) =>
    compareText(left.entryKey, right.entryKey)
  );
  const seenKeys = new Set<string>();
  const seenStepIds = new Set<number>();
  const stepEntries = packets.map((packet) => {
    const issues = validateFrenchPacket(packet);
    if (issues.length > 0) {
      throw new Error(
        `french-entity-pipeline-invalid-packet:${packet.entryKey}:${issues.join(",")}`
      );
    }
    const primaryDStrong = extractPrimaryDStrong(packet.identity.dStrong);
    if (
      !primaryDStrong ||
      buildLexiconEntryKey(
        packet.identity.language,
        packet.identity.dStrong
      ) !== packet.entryKey ||
      seenKeys.has(packet.entryKey) ||
      seenStepIds.has(packet.identity.stepEntryId)
    ) {
      throw new Error(
        `french-entity-pipeline-packet-identity:${packet.entryKey}`
      );
    }
    seenKeys.add(packet.entryKey);
    seenStepIds.add(packet.identity.stepEntryId);
    const englishParentHashesWithoutHash = {
      releaseKey: packet.englishRelease.releaseKey,
      releaseSnapshotFingerprint:
        packet.englishRelease.releaseSnapshotFingerprint,
      gloss: projectEnglishParent(packet.englishRelease.parents.gloss),
      meaning: projectEnglishParent(packet.englishRelease.parents.meaning)
    };
    return {
      entryKey: packet.entryKey,
      stepEntryId: packet.identity.stepEntryId,
      identity: {
        stepEntryId: packet.identity.stepEntryId,
        language: packet.identity.language,
        primaryDStrong,
        eStrong: packet.identity.eStrong,
        dStrong: packet.identity.dStrong,
        uStrong: packet.identity.uStrong,
        original: packet.identity.original,
        transliteration: packet.identity.transliteration,
        morph: packet.identity.morph
      },
      englishParentHashes: {
        ...englishParentHashesWithoutHash,
        lineageHash: hashFrenchInternalJson(englishParentHashesWithoutHash)
      }
    };
  });
  const englishMeanings = packets.map((packet) => ({
    sourceEntryKey: packet.entryKey,
    meaning: packet.english.meaning,
    meaningHtml: packet.english.meaningHtml,
    meaningParentContentHash: packet.englishRelease.parents.meaning.contentHash,
    meaningValueTextHash: packet.englishRelease.parents.meaning.valueTextHash,
    meaningValueHtmlHash: packet.englishRelease.parents.meaning.valueHtmlHash
  }));
  return {
    stepEntries,
    canonicalEntities: [...input.canonicalEntities],
    canonicalPolicies: [...input.canonicalEntryPolicies],
    englishMeanings,
    quarantinedEntryKeys: [...(input.quarantinedEntryKeys ?? [])]
  };
}

/** Replays the canonical gate and the complete mention extraction fail-closed. */
export function replayFrenchEntityPipeline(input: {
  plan: FrenchEntityCanonicalizationPlan;
  canonicalEntities: readonly FrenchCanonicalEntityRecord[];
  canonicalEntryPolicies: readonly FrenchCanonicalEntryNamePolicy[];
  packets: readonly LexiconV3FrenchPacket[];
  terminalGate?: FrenchEntityAgentTerminalGateResult;
  quarantinedEntryKeys?: readonly string[];
  expectations?: FrenchEntityCanonicalizationExpectations;
  allowBlockingMentions?: boolean;
}): {
  entityGate:
    | FrenchEntityCanonicalizationGateResult
    | FrenchEntityAgentTerminalGateResult;
  entityMentions: FrenchEntityMentionsArtifact;
} {
  const entityGate = input.terminalGate
    ? assertFrenchEntityTerminalGateShape({
        gate: input.terminalGate,
        plan: input.plan,
        expectedEntities: input.canonicalEntities.length,
        expectedPolicies: input.canonicalEntryPolicies.length,
        quarantinedEntryKeys: input.quarantinedEntryKeys ?? []
      })
    : assertFrenchEntityCanonicalizationResolved({
        plan: input.plan,
        canonicalEntities: input.canonicalEntities,
        entryPolicies: input.canonicalEntryPolicies,
        ...(input.expectations ? { expectations: input.expectations } : {})
      });
  const mentionInput = buildFrenchEntityMentionsInputFromPackets({
    packets: input.packets,
    canonicalEntities: input.canonicalEntities,
    canonicalEntryPolicies: input.canonicalEntryPolicies,
    quarantinedEntryKeys: input.quarantinedEntryKeys
  });
  const entityMentions = buildFrenchEntityMentions(mentionInput);
  if (!input.allowBlockingMentions) {
    assertFrenchEntityMentionsPublishable(entityMentions);
  }
  return { entityGate, entityMentions };
}

/**
 * Replays an already materialized mention artifact against packets and sealed
 * canonical inputs. Used by every downstream stage before presenting work to
 * an agent.
 */
export function assertFrenchEntityPipelineArtifacts(input: {
  entityGate:
    | FrenchEntityCanonicalizationGateResult
    | FrenchEntityAgentTerminalGateResult;
  entityMentions: FrenchEntityMentionsArtifact;
  canonicalEntities: readonly FrenchCanonicalEntityRecord[];
  canonicalEntryPolicies: readonly FrenchCanonicalEntryNamePolicy[];
  packets: readonly LexiconV3FrenchPacket[];
  quarantinedEntryKeys?: readonly string[];
  mentionResolutionAttestation?: FrenchEntityMentionResolutionAttestation;
  allowConfigurationPinnedResolution?: boolean;
}): void {
  if (
    input.entityGate.schemaVersion ===
    FRENCH_ENTITY_AGENT_TERMINAL_GATE_SCHEMA_VERSION
  ) {
    assertFrenchEntityTerminalGateShape({
      gate: input.entityGate,
      expectedEntities: input.canonicalEntities.length,
      expectedPolicies: input.canonicalEntryPolicies.length,
      quarantinedEntryKeys: input.quarantinedEntryKeys ?? []
    });
  } else {
    assertFrenchEntityGateShape(
      input.entityGate,
      input.canonicalEntities.length,
      input.canonicalEntryPolicies.length
    );
  }
  const mentionInput = buildFrenchEntityMentionsInputFromPackets({
    packets: input.packets,
    canonicalEntities: input.canonicalEntities,
    canonicalEntryPolicies: input.canonicalEntryPolicies,
    quarantinedEntryKeys: input.quarantinedEntryKeys
  });
  assertFrenchEntityMentionsArtifact(input.entityMentions);
  const rawMentions = buildFrenchEntityMentions(mentionInput);
  if (rawMentions.contentHash !== input.entityMentions.contentHash) {
    const attestation = input.mentionResolutionAttestation;
    if (!attestation && !input.allowConfigurationPinnedResolution) {
      throw new Error("french-entity-pipeline-resolution-attestation-missing");
    }
    if (attestation) {
      assertFrenchEntityMentionResolutionAttestation(attestation);
      if (
        attestation.sourceMentionsHash !== rawMentions.contentHash ||
        attestation.finalMentionsHash !== input.entityMentions.contentHash ||
        canonicalFrenchInternalJson(rawMentions.inputHashes) !==
          canonicalFrenchInternalJson(input.entityMentions.inputHashes)
      ) {
        throw new Error("french-entity-pipeline-resolution-lineage-mismatch");
      }
    } else {
      assertConfigurationPinnedResolutionProjection({
        raw: rawMentions,
        resolved: input.entityMentions,
        packets: input.packets,
        canonicalPolicies: input.canonicalEntryPolicies
      });
    }
  } else if (input.mentionResolutionAttestation) {
    throw new Error("french-entity-pipeline-unexpected-resolution-attestation");
  }
  assertFrenchEntityMentionsPublishable(input.entityMentions);
}

function assertConfigurationPinnedResolutionProjection(input: {
  raw: FrenchEntityMentionsArtifact;
  resolved: FrenchEntityMentionsArtifact;
  packets: readonly LexiconV3FrenchPacket[];
  canonicalPolicies: readonly FrenchCanonicalEntryNamePolicy[];
}): void {
  const plan = buildFrenchEntityMentionResolutionPlan({
    mentions: input.raw,
    packets: input.packets,
    canonicalPolicies: input.canonicalPolicies
  });
  const unitByMention = new Map(
    plan.units.map((unit) => [unit.mentionId, unit] as const)
  );
  const resolvedById = new Map(
    input.resolved.requiredEntityMentions.map(
      (mention) => [mention.mentionId, mention] as const
    )
  );
  if (
    resolvedById.size !== input.raw.requiredEntityMentions.length ||
    input.resolved.requiredEntityMentions.length !==
      input.raw.requiredEntityMentions.length
  ) {
    throw new Error("french-entity-pipeline-resolution-projection-coverage");
  }
  for (const source of input.raw.requiredEntityMentions) {
    const resolved = resolvedById.get(source.mentionId);
    if (!resolved) {
      throw new Error(
        `french-entity-pipeline-resolution-projection-missing:${source.mentionId}`
      );
    }
    if (source.resolution !== "contextual") {
      if (
        canonicalFrenchInternalJson(source) !==
        canonicalFrenchInternalJson(resolved)
      ) {
        throw new Error(
          `french-entity-pipeline-resolution-projection-drift:${source.mentionId}`
        );
      }
      continue;
    }
    if (
      resolved.sourceEntryKey !== source.sourceEntryKey ||
      resolved.segmentId !== source.segmentId ||
      resolved.sourceSurface !== source.sourceSurface ||
      resolved.citedStrong !== source.citedStrong
    ) {
      throw new Error(
        `french-entity-pipeline-resolution-projection-source:${source.mentionId}`
      );
    }
    if (resolved.resolution === "exact") {
      const unit = unitByMention.get(source.mentionId);
      const candidate = unit?.candidates.find(
        (item) => item.entryKey === resolved.targetEntryKey
      );
      if (
        !candidate ||
        canonicalFrenchInternalJson(candidate.targetEntityIds) !==
          canonicalFrenchInternalJson(resolved.targetEntityIds) ||
        canonicalFrenchInternalJson(candidate.allowedFrenchForms) !==
          canonicalFrenchInternalJson(resolved.allowedFrenchForms)
      ) {
        throw new Error(
          `french-entity-pipeline-resolution-projection-selection:${source.mentionId}`
        );
      }
    } else if (!["non-entity", "quarantined"].includes(resolved.resolution)) {
      throw new Error(
        `french-entity-pipeline-resolution-projection-disposition:${source.mentionId}`
      );
    }
  }
}

export function assertFrenchEntityGateShape(
  gate: FrenchEntityCanonicalizationGateResult,
  expectedEntities: number,
  expectedPolicies: number
): void {
  if (
    gate.schemaVersion !== FRENCH_ENTITY_CANONICALIZATION_GATE_SCHEMA_VERSION ||
    gate.policyVersion !== FRENCH_ENTITY_CANONICALIZATION_POLICY_VERSION ||
    !SHA256_PATTERN.test(gate.planHash) ||
    gate.entityCount !== expectedEntities ||
    gate.policyCount !== expectedPolicies ||
    gate.unresolvedCount !== 0 ||
    gate.blockedCount !== 0 ||
    gate.exactCoverage !== true ||
    gate.exactEnglishLineage !== true ||
    gate.exactStepIdentity !== true ||
    gate.onePrimaryFrenchPerEntity !== true ||
    gate.explicitRelations !== true ||
    gate.historicalEvidenceOnlyCount !== 0 ||
    !SHA256_PATTERN.test(gate.gateHash)
  ) {
    throw new Error("french-entity-pipeline-gate-invalid");
  }
  const { gateHash: _gateHash, ...content } = gate;
  void _gateHash;
  if (hashFrenchEntityJson(content) !== gate.gateHash) {
    throw new Error("french-entity-pipeline-gate-hash-mismatch");
  }
}

export function assertFrenchEntityTerminalGateShape(input: {
  gate: FrenchEntityAgentTerminalGateResult;
  plan?: FrenchEntityCanonicalizationPlan;
  expectedEntities: number;
  expectedPolicies: number;
  quarantinedEntryKeys: readonly string[];
}): FrenchEntityAgentTerminalGateResult {
  const { gateHash, ...content } = input.gate;
  if (
    input.gate.schemaVersion !==
      FRENCH_ENTITY_AGENT_TERMINAL_GATE_SCHEMA_VERSION ||
    input.gate.policyVersion !== FRENCH_ENTITY_AGENT_POLICY_VERSION ||
    !SHA256_PATTERN.test(input.gate.planHash) ||
    (input.plan !== undefined &&
      (input.gate.planHash !== input.plan.planHash ||
        input.gate.reviewUnitCount !== input.plan.reviewUnits.length)) ||
    input.gate.safeUnitCount + input.gate.quarantinedUnitCount !==
      input.gate.reviewUnitCount ||
    input.gate.canonicalEntityCount !== input.expectedEntities ||
    input.gate.canonicalPolicyCount !== input.expectedPolicies ||
    input.gate.exactDispositionCoverage !== true ||
    input.gate.unsafePropagationCount !== 0 ||
    (input.gate.quarantinedUnitCount > 0 &&
      input.quarantinedEntryKeys.length === 0) ||
    hashFrenchEntityJson(content) !== gateHash
  ) {
    throw new Error("french-entity-pipeline-terminal-gate-invalid");
  }
  return input.gate;
}

export function finalizeFrenchEntityPipelineSummary(
  input: Omit<FrenchEntityPipelineSummary, "schemaVersion" | "summaryHash">
): FrenchEntityPipelineSummary {
  for (const hash of [
    ...Object.values(input.sourceHashes).filter(
      (value): value is string => value !== null
    ),
    ...Object.values(input.outputHashes),
    input.lineage.planHash,
    input.lineage.releaseSnapshotFingerprint,
    input.lineage.entityMergeAttestationHash,
    input.lineage.entityGateHash,
    input.lineage.entityMentionsHash,
    ...(input.lineage.mentionResolutionAttestationHash
      ? [input.lineage.mentionResolutionAttestationHash]
      : [])
  ]) {
    if (!SHA256_PATTERN.test(hash)) {
      throw new Error("french-entity-pipeline-summary-invalid-hash");
    }
  }
  if (
    !input.lineage.releaseKey.trim() ||
    !Number.isFinite(Date.parse(input.generatedAt)) ||
    input.counts.blockingEntityMentions !== 0 ||
    Object.values(input.counts).some(
      (count) => !Number.isSafeInteger(count) || count < 0
    ) ||
    input.counts.exactEntityMentions +
      input.counts.contextualEntityMentions +
      input.counts.nonEntityMentions +
      input.counts.quarantinedEntityMentions !==
      input.counts.requiredEntityMentions
  ) {
    throw new Error("french-entity-pipeline-summary-invalid");
  }
  const withoutHash = {
    schemaVersion: FRENCH_ENTITY_PIPELINE_SUMMARY_SCHEMA_VERSION,
    ...input
  };
  return {
    ...withoutHash,
    summaryHash: hashFrenchInternalJson(withoutHash)
  };
}

export function assertFrenchEntityPipelineSummary(
  summary: FrenchEntityPipelineSummary
): void {
  const { summaryHash, schemaVersion, ...input } = summary;
  if (
    schemaVersion !== FRENCH_ENTITY_PIPELINE_SUMMARY_SCHEMA_VERSION ||
    !SHA256_PATTERN.test(summaryHash)
  ) {
    throw new Error("french-entity-pipeline-summary-schema");
  }
  const rebuilt = finalizeFrenchEntityPipelineSummary(input);
  if (
    canonicalFrenchInternalJson(rebuilt) !==
    canonicalFrenchInternalJson(summary)
  ) {
    throw new Error("french-entity-pipeline-summary-replay-mismatch");
  }
}

function projectEnglishParent(parent: {
  fieldVersionId: number;
  contentHash: string;
  valueTextHash: string;
  valueHtmlHash: string | null;
}): {
  fieldVersionId: number;
  contentHash: string;
  valueTextHash: string;
  valueHtmlHash: string | null;
} {
  return {
    fieldVersionId: parent.fieldVersionId,
    contentHash: parent.contentHash,
    valueTextHash: parent.valueTextHash,
    valueHtmlHash: parent.valueHtmlHash
  };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
