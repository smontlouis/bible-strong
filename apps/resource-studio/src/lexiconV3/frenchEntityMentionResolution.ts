import {
  assertFrenchEntityMentionsArtifact,
  assertFrenchEntityMentionsPublishable,
  finalizeFrenchEntityMentionsArtifact,
  type FrenchEntityMentionCanonicalPolicy,
  type FrenchEntityMentionsArtifact,
  type RequiredFrenchEntityMention
} from "./frenchEntityMentions.js";
import {
  hashFrenchInternalJson,
  canonicalFrenchInternalJson
} from "./frenchCodexExecutionReceipt.js";
import type { LexiconV3FrenchPacket } from "./frenchPackets.js";

export const FRENCH_ENTITY_MENTION_RESOLUTION_PLAN_SCHEMA_VERSION =
  "lexicon-v3-french-entity-mention-resolution-plan@2" as const;
export const FRENCH_ENTITY_MENTION_RESOLUTION_POLICY_VERSION =
  "lexicon-v3-french-entity-mention-resolution-policy@2" as const;
export const FRENCH_ENTITY_MENTION_DECISION_SCHEMA_VERSION =
  "lexicon-v3-french-entity-mention-decision@1" as const;
export const FRENCH_ENTITY_MENTION_AUDIT_SCHEMA_VERSION =
  "lexicon-v3-french-entity-mention-audit@1" as const;
export const FRENCH_ENTITY_MENTION_RESOLUTION_ATTESTATION_SCHEMA_VERSION =
  "lexicon-v3-french-entity-mention-resolution-attestation@2" as const;

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const STRONG_CODE_SURFACE_PATTERN = /^[GH]\d{1,5}[A-Za-z]?(?:_[A-Za-z])?$/u;

export type FrenchEntityMentionDisposition =
  | "select"
  | "non-entity"
  | "policy-repair"
  | "quarantine";

export interface FrenchEntityMentionResolutionCandidate {
  entryKey: string;
  targetEntityIds: number[];
  allowedFrenchForms: string[];
  treatment: FrenchEntityMentionCanonicalPolicy["treatment"];
  constraint: FrenchEntityMentionCanonicalPolicy["constraint"];
  primaryFr: string | null;
  derivedFr: string | null;
  policyContentHash: string;
}

export interface FrenchEntityMentionResolutionUnit {
  unitId: string;
  mentionId: string;
  mentionContentHash: string;
  sourceEntryKey: string;
  segmentId: string;
  sourceSurface: string;
  sourceIdentity: LexiconV3FrenchPacket["identity"];
  englishGloss: string;
  englishMeaning: string;
  englishMeaningHtml: string;
  candidates: FrenchEntityMentionResolutionCandidate[];
  inputHash: string;
}

export interface FrenchEntityMentionResolutionPlan {
  schemaVersion: typeof FRENCH_ENTITY_MENTION_RESOLUTION_PLAN_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_ENTITY_MENTION_RESOLUTION_POLICY_VERSION;
  releaseKey: string;
  releaseSnapshotFingerprint: string;
  sourceHashes: {
    mentions: string;
    packets: string;
    canonicalPolicies: string;
  };
  counts: {
    contextualMentions: number;
    sourceEntries: number;
  };
  units: FrenchEntityMentionResolutionUnit[];
  planHash: string;
}

export interface FrenchEntityMentionDecision {
  schemaVersion: typeof FRENCH_ENTITY_MENTION_DECISION_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_ENTITY_MENTION_RESOLUTION_POLICY_VERSION;
  role: "proposerA" | "proposerB" | "arbiter";
  unitId: string;
  inputHash: string;
  disposition: FrenchEntityMentionDisposition;
  selectedEntryKey: string | null;
  reasonCodes: string[];
  rationale: string;
  confidence: number;
  artifactHash: string;
}

export interface FrenchEntityMentionAudit {
  schemaVersion: typeof FRENCH_ENTITY_MENTION_AUDIT_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_ENTITY_MENTION_RESOLUTION_POLICY_VERSION;
  unitId: string;
  inputHash: string;
  arbiterArtifactHash: string;
  verdict: "safe" | "hold" | "block";
  checks: {
    sourceContextExact: boolean;
    selectedPolicyAuthorized: boolean;
    nonEntityJustified: boolean;
    noInventedFrenchForm: boolean;
  };
  reasons: string[];
  confidence: number;
  artifactHash: string;
}

export interface FrenchEntityMentionResolutionAttestation {
  schemaVersion: typeof FRENCH_ENTITY_MENTION_RESOLUTION_ATTESTATION_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_ENTITY_MENTION_RESOLUTION_POLICY_VERSION;
  planHash: string;
  sourceMentionsHash: string;
  finalMentionsHash: string;
  proposerDecisionHashes: string[];
  arbiterDecisionHashes: string[];
  auditHashes: string[];
  executionRunHashes: string[];
  counts: {
    selected: number;
    nonEntity: number;
    policyRepair: number;
    quarantined: number;
    unsafeAuditsQuarantined: number;
  };
  attestationHash: string;
}

export function buildFrenchEntityMentionResolutionPlan(input: {
  mentions: FrenchEntityMentionsArtifact;
  packets: readonly LexiconV3FrenchPacket[];
  canonicalPolicies: readonly FrenchEntityMentionCanonicalPolicy[];
}): FrenchEntityMentionResolutionPlan {
  assertFrenchEntityMentionsArtifact(input.mentions);
  for (const mention of input.mentions.requiredEntityMentions) {
    if (mention.resolution !== "exact") continue;
    if (mention.citedStrong === null) {
      throw new Error(
        `french-entity-mention-resolution-unreviewed-uncited-exact:${mention.mentionId}`
      );
    }
    if (STRONG_CODE_SURFACE_PATTERN.test(mention.sourceSurface)) {
      throw new Error(
        `french-entity-mention-resolution-code-surface-exact:${mention.mentionId}`
      );
    }
  }
  const packetByKey = uniqueMap(input.packets, (packet) => packet.entryKey);
  const policies = [...input.canonicalPolicies].sort((left, right) =>
    compareText(left.entryKey, right.entryKey)
  );
  const contextual = input.mentions.requiredEntityMentions.filter(
    (mention) => mention.resolution === "contextual"
  );
  const units = contextual.map((mention) => {
    const packet = packetByKey.get(mention.sourceEntryKey);
    if (!packet) {
      throw new Error(
        `french-entity-mention-resolution-packet-missing:${mention.sourceEntryKey}`
      );
    }
    const candidates = policies
      .filter((policy) => policyMatchesMention(policy, mention))
      .map(projectCandidate);
    if (candidates.length < 1) {
      throw new Error(
        `french-entity-mention-resolution-candidates-missing:${mention.mentionId}`
      );
    }
    const content = {
      unitId: `mention-resolution:${mention.mentionId.slice("entity-mention:".length)}`,
      mentionId: mention.mentionId,
      mentionContentHash: mention.contentHash,
      sourceEntryKey: mention.sourceEntryKey,
      segmentId: mention.segmentId,
      sourceSurface: mention.sourceSurface,
      sourceIdentity: packet.identity,
      englishGloss: packet.english.gloss,
      englishMeaning: packet.english.meaning,
      englishMeaningHtml: packet.english.meaningHtml,
      candidates
    };
    return {
      ...content,
      inputHash: hashFrenchInternalJson(content)
    } satisfies FrenchEntityMentionResolutionUnit;
  });
  const releaseKeys = new Set(
    input.packets.map((p) => p.englishRelease.releaseKey)
  );
  const snapshots = new Set(
    input.packets.map((p) => p.englishRelease.releaseSnapshotFingerprint)
  );
  if (releaseKeys.size !== 1 || snapshots.size !== 1) {
    throw new Error("french-entity-mention-resolution-mixed-release");
  }
  const withoutHash = {
    schemaVersion: FRENCH_ENTITY_MENTION_RESOLUTION_PLAN_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_MENTION_RESOLUTION_POLICY_VERSION,
    releaseKey: [...releaseKeys][0]!,
    releaseSnapshotFingerprint: [...snapshots][0]!,
    sourceHashes: {
      mentions: input.mentions.contentHash,
      packets: hashFrenchInternalJson(
        [...input.packets].sort((a, b) => compareText(a.entryKey, b.entryKey))
      ),
      canonicalPolicies: hashFrenchInternalJson(policies)
    },
    counts: {
      contextualMentions: units.length,
      sourceEntries: new Set(units.map((unit) => unit.sourceEntryKey)).size
    },
    units
  };
  const plan = {
    ...withoutHash,
    planHash: hashFrenchInternalJson(withoutHash)
  };
  assertFrenchEntityMentionResolutionPlan(plan);
  return plan;
}

export function finalizeFrenchEntityMentionDecision(
  input: Omit<
    FrenchEntityMentionDecision,
    "schemaVersion" | "policyVersion" | "artifactHash"
  >
): FrenchEntityMentionDecision {
  const withoutHash = {
    schemaVersion: FRENCH_ENTITY_MENTION_DECISION_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_MENTION_RESOLUTION_POLICY_VERSION,
    ...input,
    reasonCodes: uniqueSortedStrings(input.reasonCodes)
  };
  const decision = {
    ...withoutHash,
    artifactHash: hashFrenchInternalJson(withoutHash)
  };
  assertFrenchEntityMentionDecision(decision);
  return decision;
}

export function finalizeFrenchEntityMentionAudit(
  input: Omit<
    FrenchEntityMentionAudit,
    "schemaVersion" | "policyVersion" | "artifactHash"
  >
): FrenchEntityMentionAudit {
  const withoutHash = {
    schemaVersion: FRENCH_ENTITY_MENTION_AUDIT_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_MENTION_RESOLUTION_POLICY_VERSION,
    ...input
  };
  const audit = {
    ...withoutHash,
    artifactHash: hashFrenchInternalJson(withoutHash)
  };
  assertFrenchEntityMentionAudit(audit);
  return audit;
}

export function applyFrenchEntityMentionResolution(input: {
  source: FrenchEntityMentionsArtifact;
  plan: FrenchEntityMentionResolutionPlan;
  proposerADecisions: readonly FrenchEntityMentionDecision[];
  proposerBDecisions: readonly FrenchEntityMentionDecision[];
  arbiterDecisions: readonly FrenchEntityMentionDecision[];
  audits: readonly FrenchEntityMentionAudit[];
  executionRunHashes: readonly string[];
}): {
  mentions: FrenchEntityMentionsArtifact;
  attestation: FrenchEntityMentionResolutionAttestation;
} {
  assertFrenchEntityMentionsArtifact(input.source);
  assertFrenchEntityMentionResolutionPlan(input.plan);
  if (input.plan.sourceHashes.mentions !== input.source.contentHash) {
    throw new Error("french-entity-mention-resolution-source-drift");
  }
  const unitByMention = new Map(
    input.plan.units.map((unit) => [unit.mentionId, unit] as const)
  );
  const decisions = uniqueMap(input.arbiterDecisions, (decision) => {
    assertFrenchEntityMentionDecision(decision);
    if (decision.role !== "arbiter") {
      throw new Error("french-entity-mention-resolution-non-arbiter-decision");
    }
    return decision.unitId;
  });
  const proposerA = decisionMap(input.proposerADecisions, "proposerA");
  const proposerB = decisionMap(input.proposerBDecisions, "proposerB");
  const audits = uniqueMap(input.audits, (audit) => {
    assertFrenchEntityMentionAudit(audit);
    return audit.unitId;
  });
  if (
    proposerA.size !== input.plan.units.length ||
    proposerB.size !== input.plan.units.length ||
    decisions.size !== input.plan.units.length ||
    audits.size !== input.plan.units.length
  ) {
    throw new Error("french-entity-mention-resolution-coverage");
  }
  if (
    input.executionRunHashes.length === 0 ||
    input.executionRunHashes.some((hash) => !SHA256_PATTERN.test(hash)) ||
    new Set(input.executionRunHashes).size !== input.executionRunHashes.length
  ) {
    throw new Error("french-entity-mention-resolution-execution-runs");
  }
  for (const unit of input.plan.units) {
    for (const decision of [
      proposerA.get(unit.unitId),
      proposerB.get(unit.unitId),
      decisions.get(unit.unitId)
    ]) {
      if (!decision || decision.inputHash !== unit.inputHash) {
        throw new Error(
          `french-entity-mention-resolution-decision-lineage:${unit.unitId}`
        );
      }
      if (
        decision.disposition === "select" &&
        !unit.candidates.some(
          (candidate) => candidate.entryKey === decision.selectedEntryKey
        )
      ) {
        throw new Error(
          `french-entity-mention-resolution-decision-selection:${unit.unitId}`
        );
      }
    }
  }
  const counters = {
    selected: 0,
    nonEntity: 0,
    policyRepair: 0,
    quarantined: 0,
    unsafeAuditsQuarantined: 0
  };
  const resolved = input.source.requiredEntityMentions.map((mention) => {
    // Bare Strong-code surfaces are deliberately classified as non-entities:
    // the code itself is protected content, not a French name constraint.
    // The extraction artifact may retain the cited target for review lineage,
    // but the publishable projection must not expose that target as a policy
    // dependency.
    if (mention.resolution === "non-entity") {
      return resolvedMention(mention, {
        targetEntryKey: null,
        targetEntityIds: [],
        allowedFrenchForms: [],
        resolution: "non-entity"
      });
    }
    if (mention.resolution !== "contextual") return mention;
    const unit = unitByMention.get(mention.mentionId);
    if (!unit) {
      throw new Error(
        `french-entity-mention-resolution-unit-missing:${mention.mentionId}`
      );
    }
    const decision = decisions.get(unit.unitId);
    const audit = audits.get(unit.unitId);
    if (
      !decision ||
      !audit ||
      decision.inputHash !== unit.inputHash ||
      audit.inputHash !== unit.inputHash
    ) {
      throw new Error(
        `french-entity-mention-resolution-lineage:${mention.mentionId}`
      );
    }
    if (audit.arbiterArtifactHash !== decision.artifactHash) {
      throw new Error(
        `french-entity-mention-resolution-audit-parent:${mention.mentionId}`
      );
    }
    if (audit.verdict !== "safe") {
      counters.unsafeAuditsQuarantined += 1;
      counters.quarantined += 1;
      return resolvedMention(mention, {
        targetEntryKey: null,
        targetEntityIds: [],
        allowedFrenchForms: [],
        resolution: "quarantined"
      });
    }
    if (decision.disposition === "select") {
      const candidate = unit.candidates.find(
        (item) => item.entryKey === decision.selectedEntryKey
      );
      if (!candidate) {
        throw new Error(
          `french-entity-mention-resolution-selection-unauthorized:${mention.mentionId}`
        );
      }
      counters.selected += 1;
      return resolvedMention(mention, {
        targetEntryKey: candidate.entryKey,
        targetEntityIds: candidate.targetEntityIds,
        allowedFrenchForms: candidate.allowedFrenchForms,
        resolution: "exact"
      });
    }
    if (decision.selectedEntryKey !== null) {
      throw new Error(
        `french-entity-mention-resolution-unexpected-selection:${mention.mentionId}`
      );
    }
    if (decision.disposition === "non-entity") {
      counters.nonEntity += 1;
      return resolvedMention(mention, {
        targetEntryKey: null,
        targetEntityIds: [],
        allowedFrenchForms: [],
        resolution: "non-entity"
      });
    }
    if (decision.disposition === "policy-repair") counters.policyRepair += 1;
    counters.quarantined += 1;
    return resolvedMention(mention, {
      targetEntryKey: null,
      targetEntityIds: [],
      allowedFrenchForms: [],
      resolution: "quarantined"
    });
  });
  const mentions = finalizeFrenchEntityMentionsArtifact({
    inputHashes: input.source.inputHashes,
    requiredEntityMentions: resolved
  });
  assertFrenchEntityMentionsPublishable(mentions);
  const attestationWithoutHash = {
    schemaVersion: FRENCH_ENTITY_MENTION_RESOLUTION_ATTESTATION_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_MENTION_RESOLUTION_POLICY_VERSION,
    planHash: input.plan.planHash,
    sourceMentionsHash: input.source.contentHash,
    finalMentionsHash: mentions.contentHash,
    proposerDecisionHashes: [...proposerA.values(), ...proposerB.values()]
      .map((decision) => decision.artifactHash)
      .sort(compareText),
    arbiterDecisionHashes: [...decisions.values()]
      .map((decision) => decision.artifactHash)
      .sort(compareText),
    auditHashes: [...audits.values()]
      .map((audit) => audit.artifactHash)
      .sort(compareText),
    executionRunHashes: [...input.executionRunHashes].sort(compareText),
    counts: counters
  };
  return {
    mentions,
    attestation: {
      ...attestationWithoutHash,
      attestationHash: hashFrenchInternalJson(attestationWithoutHash)
    }
  };
}

export function assertFrenchEntityMentionResolutionAttestation(
  value: FrenchEntityMentionResolutionAttestation
): void {
  const { attestationHash, ...content } = value;
  if (
    value.schemaVersion !==
      FRENCH_ENTITY_MENTION_RESOLUTION_ATTESTATION_SCHEMA_VERSION ||
    value.policyVersion !== FRENCH_ENTITY_MENTION_RESOLUTION_POLICY_VERSION ||
    !SHA256_PATTERN.test(value.planHash) ||
    !SHA256_PATTERN.test(value.sourceMentionsHash) ||
    !SHA256_PATTERN.test(value.finalMentionsHash) ||
    !isSortedUniqueHashes(value.proposerDecisionHashes) ||
    !isSortedUniqueHashes(value.arbiterDecisionHashes) ||
    !isSortedUniqueHashes(value.auditHashes) ||
    !isSortedUniqueHashes(value.executionRunHashes) ||
    Object.values(value.counts).some(
      (count) => !Number.isSafeInteger(count) || count < 0
    ) ||
    hashFrenchInternalJson(content) !== attestationHash
  ) {
    throw new Error("french-entity-mention-resolution-attestation-invalid");
  }
}

export function assertFrenchEntityMentionResolutionPlan(
  value: FrenchEntityMentionResolutionPlan
): void {
  const { planHash, ...content } = value;
  if (
    value.schemaVersion !==
      FRENCH_ENTITY_MENTION_RESOLUTION_PLAN_SCHEMA_VERSION ||
    value.policyVersion !== FRENCH_ENTITY_MENTION_RESOLUTION_POLICY_VERSION ||
    !value.releaseKey.trim() ||
    !SHA256_PATTERN.test(value.releaseSnapshotFingerprint) ||
    !Object.values(value.sourceHashes).every((hash) =>
      SHA256_PATTERN.test(hash)
    ) ||
    !Array.isArray(value.units) ||
    value.units.length !== value.counts.contextualMentions ||
    hashFrenchInternalJson(content) !== planHash
  ) {
    throw new Error("french-entity-mention-resolution-plan-invalid");
  }
  const unitIds = new Set<string>();
  for (const unit of value.units) {
    const { inputHash, ...unitContent } = unit;
    if (
      unitIds.has(unit.unitId) ||
      unit.candidates.length < 1 ||
      !SHA256_PATTERN.test(inputHash) ||
      hashFrenchInternalJson(unitContent) !== inputHash
    ) {
      throw new Error(
        `french-entity-mention-resolution-unit-invalid:${unit.unitId}`
      );
    }
    unitIds.add(unit.unitId);
  }
}

export function assertFrenchEntityMentionDecision(
  value: FrenchEntityMentionDecision
): void {
  const { artifactHash, ...content } = value;
  if (
    value.schemaVersion !== FRENCH_ENTITY_MENTION_DECISION_SCHEMA_VERSION ||
    value.policyVersion !== FRENCH_ENTITY_MENTION_RESOLUTION_POLICY_VERSION ||
    !["proposerA", "proposerB", "arbiter"].includes(value.role) ||
    !value.unitId.trim() ||
    !SHA256_PATTERN.test(value.inputHash) ||
    !["select", "non-entity", "policy-repair", "quarantine"].includes(
      value.disposition
    ) ||
    (value.disposition === "select") !== (value.selectedEntryKey !== null) ||
    !isSortedUniqueStrings(value.reasonCodes) ||
    typeof value.rationale !== "string" ||
    !Number.isFinite(value.confidence) ||
    value.confidence < 0 ||
    value.confidence > 1 ||
    hashFrenchInternalJson(content) !== artifactHash
  ) {
    throw new Error(
      `french-entity-mention-decision-invalid:${String(value.unitId)}`
    );
  }
}

export function assertFrenchEntityMentionAudit(
  value: FrenchEntityMentionAudit
): void {
  const { artifactHash, ...content } = value;
  if (
    value.schemaVersion !== FRENCH_ENTITY_MENTION_AUDIT_SCHEMA_VERSION ||
    value.policyVersion !== FRENCH_ENTITY_MENTION_RESOLUTION_POLICY_VERSION ||
    !value.unitId.trim() ||
    !SHA256_PATTERN.test(value.inputHash) ||
    !SHA256_PATTERN.test(value.arbiterArtifactHash) ||
    !["safe", "hold", "block"].includes(value.verdict) ||
    Object.values(value.checks).some((check) => typeof check !== "boolean") ||
    (value.verdict === "safe" &&
      Object.values(value.checks).some((check) => !check)) ||
    !Array.isArray(value.reasons) ||
    value.reasons.some((reason) => typeof reason !== "string") ||
    !Number.isFinite(value.confidence) ||
    value.confidence < 0 ||
    value.confidence > 1 ||
    hashFrenchInternalJson(content) !== artifactHash
  ) {
    throw new Error(
      `french-entity-mention-audit-invalid:${String(value.unitId)}`
    );
  }
}

function projectCandidate(
  policy: FrenchEntityMentionCanonicalPolicy
): FrenchEntityMentionResolutionCandidate {
  return {
    entryKey: policy.entryKey,
    targetEntityIds: uniqueSortedNumbers(
      policy.entityBindings.map((binding) => binding.entityId)
    ),
    allowedFrenchForms: uniqueSortedStrings(policy.allowedFrenchForms),
    treatment: policy.treatment,
    constraint: policy.constraint,
    primaryFr: policy.primaryFr,
    derivedFr: policy.derivedFr,
    policyContentHash: policy.contentHash
  };
}

function policyMatchesMention(
  policy: FrenchEntityMentionCanonicalPolicy,
  mention: RequiredFrenchEntityMention
): boolean {
  const surface = normalizeEnglishSurface(mention.sourceSurface);
  if (
    !surface ||
    !policy.englishForms.some(
      (form) => normalizeEnglishSurface(form) === surface
    ) ||
    !policy.allowedFrenchForms.some((form) =>
      mention.allowedFrenchForms.includes(form)
    )
  ) {
    return false;
  }
  const allowedIds = new Set(mention.targetEntityIds);
  return policy.entityBindings.every((binding) =>
    allowedIds.has(binding.entityId)
  );
}

function resolvedMention(
  mention: RequiredFrenchEntityMention,
  resolution: Pick<
    RequiredFrenchEntityMention,
    "targetEntryKey" | "targetEntityIds" | "allowedFrenchForms" | "resolution"
  >
): RequiredFrenchEntityMention {
  const withoutHash = {
    mentionId: mention.mentionId,
    sourceEntryKey: mention.sourceEntryKey,
    segmentId: mention.segmentId,
    sourceSurface: mention.sourceSurface,
    citedStrong: mention.citedStrong,
    ...resolution,
    targetEntityIds: uniqueSortedNumbers(resolution.targetEntityIds),
    allowedFrenchForms: uniqueSortedStrings(resolution.allowedFrenchForms)
  };
  return {
    ...withoutHash,
    contentHash: hashFrenchInternalJson(withoutHash)
  };
}

function normalizeEnglishSurface(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[’']/gu, "'")
    .replace(/[-‐‑‒–—]/gu, "-")
    .replace(/\s+/gu, " ")
    .trim();
}

function uniqueMap<T>(
  values: readonly T[],
  keyOf: (value: T) => string
): Map<string, T> {
  const result = new Map<string, T>();
  for (const value of values) {
    const key = keyOf(value);
    if (result.has(key)) {
      throw new Error(`french-entity-mention-resolution-duplicate:${key}`);
    }
    result.set(key, value);
  }
  return result;
}

function decisionMap(
  values: readonly FrenchEntityMentionDecision[],
  role: "proposerA" | "proposerB"
): Map<string, FrenchEntityMentionDecision> {
  return uniqueMap(values, (decision) => {
    assertFrenchEntityMentionDecision(decision);
    if (decision.role !== role) {
      throw new Error(
        `french-entity-mention-resolution-decision-role:${decision.role}:${role}`
      );
    }
    return decision.unitId;
  });
}

function uniqueSortedStrings(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

function uniqueSortedNumbers(values: readonly number[]): number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}

function isSortedUniqueStrings(values: readonly string[]): boolean {
  return (
    canonicalFrenchInternalJson(values) ===
    canonicalFrenchInternalJson(uniqueSortedStrings(values))
  );
}

function isSortedUniqueHashes(values: readonly string[]): boolean {
  return (
    values.length > 0 &&
    values.every((value) => SHA256_PATTERN.test(value)) &&
    isSortedUniqueStrings(values)
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
