import { createHash } from "node:crypto";

import {
  classifyFrenchEditorialPos,
  FRENCH_EDITORIAL_POLICY_VERSION,
  FRENCH_ENTITY_REGISTRY_SCHEMA_VERSION,
  normalizeFrenchEvidence,
  type FrenchEditorialStatus
} from "./frenchEditorialPolicy.js";
import {
  FRENCH_PACKET_SCHEMA_VERSION,
  validateFrenchPacket,
  type LexiconV3FrenchPacket
} from "./frenchPackets.js";

export const FRENCH_ENTITY_CANONICALIZATION_POLICY_VERSION =
  "lexicon-v3-french-entity-canonicalization-policy@3" as const;
export const FRENCH_ENTITY_CANONICALIZATION_CANDIDATE_SCHEMA_VERSION =
  "lexicon-v3-french-entity-canonicalization-candidate@3" as const;
export const FRENCH_ENTITY_CANONICALIZATION_GROUP_SCHEMA_VERSION =
  "lexicon-v3-french-entity-canonicalization-group@1" as const;
export const FRENCH_ENTITY_CANONICALIZATION_REVIEW_UNIT_SCHEMA_VERSION =
  "lexicon-v3-french-entity-canonicalization-review-unit@1" as const;
export const FRENCH_ENTITY_CANONICALIZATION_PLAN_SCHEMA_VERSION =
  "lexicon-v3-french-entity-canonicalization-plan@3" as const;
export const FRENCH_CANONICAL_ENTITY_SCHEMA_VERSION =
  "lexicon-v3-french-canonical-entity@1" as const;
export const FRENCH_CANONICAL_ENTRY_NAME_POLICY_SCHEMA_VERSION =
  "lexicon-v3-french-canonical-entry-name-policy@2" as const;
export const FRENCH_ENTITY_CLASSIFICATION_PROOF_SCHEMA_VERSION =
  "lexicon-v3-french-entity-classification-proof@1" as const;
export const FRENCH_ENTITY_CANONICALIZATION_GATE_SCHEMA_VERSION =
  "lexicon-v3-french-entity-canonicalization-gate@1" as const;

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const COMMON_OR_ETYMOLOGICAL_ENTRY_KEYS = new Set([
  "greek:G9048",
  "greek:G6160",
  "greek:G5514H",
  "greek:G2148",
  "greek:G2207"
]);

export type FrenchEntityNameTreatment =
  | "canonical-name"
  | "alternate-name"
  | "unregistered-proper-name"
  | "gentilic"
  | "title-or-epithet"
  | "compound-name"
  | "etymological-or-common-gloss"
  | "unresolved";

export type FrenchEntityNameConstraint =
  | "canonical"
  | "derived"
  | "proper-name-without-entity"
  | "lexical-translation"
  | "blocked";

export type FrenchEntityBindingRelation =
  | "primary"
  | "alias"
  | "gentilic"
  | "title"
  | "compound"
  | "etymological";

export interface FrenchEntityPolicyTreatmentContract {
  constraint: FrenchEntityNameConstraint;
  relation: FrenchEntityBindingRelation;
}

const FRENCH_ENTITY_NAME_TREATMENTS = [
  "canonical-name",
  "alternate-name",
  "unregistered-proper-name",
  "gentilic",
  "title-or-epithet",
  "compound-name",
  "etymological-or-common-gloss",
  "unresolved"
] as const satisfies readonly FrenchEntityNameTreatment[];

const FRENCH_ENTITY_NAME_CONSTRAINTS = [
  "canonical",
  "derived",
  "proper-name-without-entity",
  "lexical-translation",
  "blocked"
] as const satisfies readonly FrenchEntityNameConstraint[];

const FRENCH_ENTITY_BINDING_RELATIONS = [
  "primary",
  "alias",
  "gentilic",
  "title",
  "compound",
  "etymological"
] as const satisfies readonly FrenchEntityBindingRelation[];

const FRENCH_ENTITY_POLICY_CONTRACT_BY_TREATMENT: Readonly<
  Record<FrenchEntityNameTreatment, FrenchEntityPolicyTreatmentContract>
> = {
  "canonical-name": { constraint: "canonical", relation: "primary" },
  "alternate-name": { constraint: "derived", relation: "alias" },
  "unregistered-proper-name": {
    constraint: "proper-name-without-entity",
    relation: "alias"
  },
  gentilic: { constraint: "derived", relation: "gentilic" },
  "title-or-epithet": { constraint: "derived", relation: "title" },
  "compound-name": { constraint: "derived", relation: "compound" },
  "etymological-or-common-gloss": {
    constraint: "lexical-translation",
    relation: "etymological"
  },
  unresolved: { constraint: "blocked", relation: "etymological" }
};

export function isFrenchEntityNameTreatment(
  value: unknown
): value is FrenchEntityNameTreatment {
  return (
    typeof value === "string" &&
    (FRENCH_ENTITY_NAME_TREATMENTS as readonly string[]).includes(value)
  );
}

export function isFrenchEntityNameConstraint(
  value: unknown
): value is FrenchEntityNameConstraint {
  return (
    typeof value === "string" &&
    (FRENCH_ENTITY_NAME_CONSTRAINTS as readonly string[]).includes(value)
  );
}

export function isFrenchEntityBindingRelation(
  value: unknown
): value is FrenchEntityBindingRelation {
  return (
    typeof value === "string" &&
    (FRENCH_ENTITY_BINDING_RELATIONS as readonly string[]).includes(value)
  );
}

export function frenchEntityPolicyContractForTreatment(
  value: unknown
): FrenchEntityPolicyTreatmentContract | null {
  return isFrenchEntityNameTreatment(value)
    ? FRENCH_ENTITY_POLICY_CONTRACT_BY_TREATMENT[value]
    : null;
}

export interface FrenchEntityBinding {
  entityId: number;
  relation: FrenchEntityBindingRelation;
}

export interface FrenchEntityCanonicalizationIdentity {
  stepEntryId: number;
  language: "greek" | "hebrew";
  primaryDStrong: string;
  eStrong: string;
  dStrong: string;
  uStrong: string;
  original: string;
  transliteration: string;
  morph: string;
}

export interface FrenchEntityEnglishParentHash {
  fieldVersionId: number;
  contentHash: string;
  valueTextHash: string;
  valueHtmlHash: string | null;
}

export interface FrenchEntityEnglishParentHashes {
  releaseKey: string;
  releaseSnapshotFingerprint: string;
  gloss: FrenchEntityEnglishParentHash;
  meaning: FrenchEntityEnglishParentHash;
  lineageHash: string;
}

export interface FrenchEntityRegistrySourceMatch {
  entityId: number;
  significance: string;
  aliasEn: string;
  entityEn: string;
  candidateFr: string;
  category: string;
  type: string;
}

type FrenchEntityEnglishMatchShape = Pick<
  FrenchEntityRegistrySourceMatch,
  "entityId" | "significance" | "aliasEn" | "entityEn"
>;

/**
 * A multi-entity STEP entry can have its canonical entity owned by another
 * review unit. In that case ownerEntityIds is intentionally empty, but the
 * direct TIPNR match remains unambiguous: significance=Named and the English
 * entity/alias is the exact validated STEP gloss.
 */
export function frenchEntityDirectNamedMatchEntityIds(input: {
  englishGloss: string;
  entityMatches: readonly FrenchEntityEnglishMatchShape[];
}): number[] {
  const gloss = input.englishGloss.trim().normalize("NFC");
  return [
    ...new Set(
      input.entityMatches
        .filter(
          (match) =>
            match.significance === "Named" &&
            [match.entityEn, match.aliasEn].some(
              (form) => form.trim().normalize("NFC") === gloss
            )
        )
        .map((match) => match.entityId)
    )
  ].sort((left, right) => left - right);
}

export function frenchEntityCanonicalSecondaryRelation(input: {
  entityId: number;
  entityMatches: readonly FrenchEntityEnglishMatchShape[];
}): "alias" | "compound" {
  return input.entityMatches.some(
    (match) =>
      match.entityId === input.entityId && match.significance === "NameCombined"
  )
    ? "compound"
    : "alias";
}

export interface FrenchEntityRegistrySourceRecord {
  schemaVersion: typeof FRENCH_ENTITY_REGISTRY_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_EDITORIAL_POLICY_VERSION;
  entryKey: string;
  stepEntryId: number;
  identity: {
    language: "greek" | "hebrew";
    primaryDStrong: string;
    eStrong: string;
    dStrong: string;
    uStrong: string;
    morph: string;
  };
  englishGloss: string;
  status: FrenchEditorialStatus;
  canonicalFr: string | null;
  reasons: string[];
  matches: FrenchEntityRegistrySourceMatch[];
  referenceEvidence: Array<Record<string, unknown>>;
  historicalCandidate: {
    gloss: string;
    trust: "untrusted-candidate";
    sourceHash: string;
  } | null;
  inputHash: string;
  contentHash: string;
}

export interface FrenchEntityCanonicalizationCandidate {
  schemaVersion: typeof FRENCH_ENTITY_CANONICALIZATION_CANDIDATE_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_ENTITY_CANONICALIZATION_POLICY_VERSION;
  entryKey: string;
  stepEntryId: number;
  identity: FrenchEntityCanonicalizationIdentity;
  englishParentHashes: FrenchEntityEnglishParentHashes;
  englishGloss: string;
  editorialStatus: FrenchEditorialStatus;
  entityIds: number[];
  entityMatches: FrenchEntityRegistrySourceMatch[];
  sourceForms: {
    englishGloss: string;
    englishEntityForms: string[];
    candidateFrenchForms: string[];
    concordanceForms: LexiconV3FrenchPacket["evidence"]["concordanceForms"];
    historicalFrenchGloss: string | null;
  };
  sourceHashes: {
    entityRegistryRecordHash: string;
    packetHash: string;
    referenceEvidenceHash: string;
    referenceEvidenceCount: number;
    concordanceEvidenceHash: string;
    concordanceEvidenceCount: number;
    historicalCandidateHash: string | null;
  };
  anchor: {
    entityId: number;
    primaryFr: string;
    proofHash: string;
  } | null;
  initialTreatment: FrenchEntityNameTreatment;
  initialConstraint: FrenchEntityNameConstraint;
  reasons: string[];
  candidateHash: string;
}

/**
 * STEP contains a small reconstructed LXX-only proper-name tail for which the
 * TIPNR entity registry has no row.  Those entries are still names: absence of
 * an external entity id must never coerce them into a common/etymological
 * gloss.  Keep the predicate deliberately narrow so an ordinary unbound word
 * cannot use the exception.
 */
export function isFrenchStandaloneProperNameCandidate(
  candidate: Pick<
    FrenchEntityCanonicalizationCandidate,
    | "identity"
    | "entityIds"
    | "initialTreatment"
    | "initialConstraint"
    | "anchor"
  >
): boolean {
  return (
    candidate.identity.language === "greek" &&
    candidate.identity.morph === "G:N-PRI" &&
    classifyFrenchEditorialPos(candidate.identity.morph) === "proper-name" &&
    candidate.entityIds.length === 0 &&
    candidate.initialTreatment === "unresolved" &&
    candidate.initialConstraint === "blocked" &&
    candidate.anchor === null
  );
}

export function isFrenchUnboundNameCandidate(
  candidate: Pick<
    FrenchEntityCanonicalizationCandidate,
    | "entryKey"
    | "entityIds"
    | "initialTreatment"
    | "initialConstraint"
    | "anchor"
  >
): boolean {
  return (
    candidate.entityIds.length === 0 &&
    candidate.initialTreatment === "unresolved" &&
    candidate.initialConstraint === "blocked" &&
    candidate.anchor === null &&
    !COMMON_OR_ETYMOLOGICAL_ENTRY_KEYS.has(candidate.entryKey)
  );
}

export function isFrenchUnboundAlternateNameCandidate(
  candidate: Pick<
    FrenchEntityCanonicalizationCandidate,
    | "entryKey"
    | "identity"
    | "entityIds"
    | "initialTreatment"
    | "initialConstraint"
    | "anchor"
  >
): boolean {
  return (
    isFrenchUnboundNameCandidate(candidate) &&
    classifyFrenchEditorialPos(candidate.identity.morph) === "proper-name" &&
    !candidate.identity.morph.endsWith("G") &&
    candidate.identity.dStrong.includes("a Spelling of")
  );
}

export interface FrenchEntityCanonicalizationGroup {
  schemaVersion: typeof FRENCH_ENTITY_CANONICALIZATION_GROUP_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_ENTITY_CANONICALIZATION_POLICY_VERSION;
  entityId: number;
  category: string;
  type: string;
  memberEntryKeys: string[];
  anchorEntryKeys: string[];
  reviewEntryKeys: string[];
  languages: Array<"greek" | "hebrew">;
  crossLanguage: boolean;
  sourceEntityHash: string;
  groupProofHash: string;
  contentHash: string;
}

export type FrenchEntityCanonicalizationReviewUnitKind =
  | "entity-group"
  | "no-entity"
  | "multi-entity";

export interface FrenchEntityCanonicalizationReviewUnit {
  schemaVersion: typeof FRENCH_ENTITY_CANONICALIZATION_REVIEW_UNIT_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_ENTITY_CANONICALIZATION_POLICY_VERSION;
  unitId: string;
  kind: FrenchEntityCanonicalizationReviewUnitKind;
  entityIds: number[];
  memberEntryKeys: string[];
  anchorEntryKeys: string[];
  reviewEntryKeys: string[];
  crossLanguage: boolean;
  groupProofHashes: string[];
  unitHash: string;
}

export interface FrenchEntityCanonicalizationCounts {
  packets: number;
  entries: number;
  anchors: number;
  reviews: number;
  singleEntityEntries: number;
  noEntityEntries: number;
  multiEntityEntries: number;
  entityIds: number;
  sharedEntityGroups: number;
  sharedEntityEntries: number;
  crossLanguageEntityGroups: number;
  reviewUnits: number;
  entityReviewUnits: number;
  noEntityReviewUnits: number;
  multiEntityReviewUnits: number;
}

export type FrenchEntityCanonicalizationExpectations =
  FrenchEntityCanonicalizationCounts;

export const FRENCH_ENTITY_CANONICALIZATION_DEFAULT_EXPECTATIONS = {
  packets: 22_717,
  entries: 5_311,
  anchors: 2_064,
  reviews: 3_247,
  singleEntityEntries: 5_085,
  noEntityEntries: 221,
  multiEntityEntries: 5,
  entityIds: 4_091,
  sharedEntityGroups: 667,
  sharedEntityEntries: 1_669,
  crossLanguageEntityGroups: 172,
  reviewUnits: 2_629,
  entityReviewUnits: 2_403,
  noEntityReviewUnits: 221,
  multiEntityReviewUnits: 5
} as const satisfies FrenchEntityCanonicalizationExpectations;

export interface FrenchEntityCanonicalizationPlan {
  schemaVersion: typeof FRENCH_ENTITY_CANONICALIZATION_PLAN_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_ENTITY_CANONICALIZATION_POLICY_VERSION;
  generatedAt: string;
  sourceLineage: {
    entityRegistryDigest: string;
    packetDigest: string;
    entityRegistryLogicalDigest: string;
    packetLogicalDigest: string;
    releaseKey: string;
    releaseSnapshotFingerprint: string;
  };
  counts: FrenchEntityCanonicalizationCounts;
  entityGroups: FrenchEntityCanonicalizationGroup[];
  anchors: FrenchEntityCanonicalizationCandidate[];
  reviewCandidates: FrenchEntityCanonicalizationCandidate[];
  reviewUnits: FrenchEntityCanonicalizationReviewUnit[];
  planHash: string;
}

export interface BuildFrenchEntityCanonicalizationPlanInput {
  entityRegistry: readonly FrenchEntityRegistrySourceRecord[];
  packets: readonly LexiconV3FrenchPacket[];
  sourceDigests: {
    entityRegistry: string;
    packets: string;
  };
  generatedAt?: string;
  expectations?: FrenchEntityCanonicalizationExpectations;
}

export interface FrenchCanonicalEntityRecord {
  schemaVersion: typeof FRENCH_CANONICAL_ENTITY_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_ENTITY_CANONICALIZATION_POLICY_VERSION;
  entityId: number;
  primaryFr: string;
  normalizedPrimaryFr: string;
  category: string;
  type: string;
  memberEntryKeys: string[];
  sourceEntityHash: string;
  groupProofHash: string;
  contentHash: string;
}

export interface FrenchEntityAgentReviewHashes {
  proposerAHash: string;
  proposerBHash: string;
  arbiterHash: string;
  auditorHash: string;
}

export interface FrenchEntityClassificationProof {
  schemaVersion: typeof FRENCH_ENTITY_CLASSIFICATION_PROOF_SCHEMA_VERSION;
  sourceCandidateHash: string;
  sourceReviewUnitHash: string | null;
  decisionMethod: "deterministic-green-anchor" | "internal-agent-adjudication";
  agentArtifacts: FrenchEntityAgentReviewHashes | null;
  evidenceHashes: string[];
  reasons: string[];
  proofHash: string;
}

export interface FrenchCanonicalEntryNamePolicy {
  schemaVersion: typeof FRENCH_CANONICAL_ENTRY_NAME_POLICY_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_ENTITY_CANONICALIZATION_POLICY_VERSION;
  entryKey: string;
  stepEntryId: number;
  identity: FrenchEntityCanonicalizationIdentity;
  englishParentHashes: FrenchEntityEnglishParentHashes;
  treatment: FrenchEntityNameTreatment;
  entityBindings: FrenchEntityBinding[];
  constraint: FrenchEntityNameConstraint;
  primaryFr: string | null;
  derivedFr: string | null;
  /** Exact reviewed English forms that may participate in name matching. */
  englishForms: string[];
  /** Selected French lemma plus only its locally derived grammatical forms. */
  allowedFrenchForms: string[];
  classificationProof: FrenchEntityClassificationProof;
  contentHash: string;
}

export interface FrenchEntityCanonicalizationGateResult {
  schemaVersion: typeof FRENCH_ENTITY_CANONICALIZATION_GATE_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_ENTITY_CANONICALIZATION_POLICY_VERSION;
  planHash: string;
  entityCount: number;
  policyCount: number;
  unresolvedCount: 0;
  blockedCount: 0;
  exactCoverage: true;
  exactEnglishLineage: true;
  exactStepIdentity: true;
  onePrimaryFrenchPerEntity: true;
  explicitRelations: true;
  historicalEvidenceOnlyCount: 0;
  gateHash: string;
}

export function canonicalFrenchEntityJson(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("french-entity-canonicalization-non-finite-number");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalFrenchEntityJson).join(",")}]`;
  }
  if (typeof value !== "object") {
    throw new Error("french-entity-canonicalization-unsupported-json-value");
  }
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .filter((key) => object[key] !== undefined)
    .sort(compareText)
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalFrenchEntityJson(object[key])}`
    )
    .join(",")}}`;
}

export function hashFrenchEntityJson(value: unknown): string {
  return createHash("sha256")
    .update(canonicalFrenchEntityJson(value))
    .digest("hex");
}

export function buildFrenchEntityCanonicalizationPlan(
  input: BuildFrenchEntityCanonicalizationPlanInput
): FrenchEntityCanonicalizationPlan {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(generatedAt))) {
    throw new Error(
      `french-entity-canonicalization-invalid-generated-at:${generatedAt}`
    );
  }
  assertSha256(input.sourceDigests.entityRegistry, "entity-registry-digest");
  assertSha256(input.sourceDigests.packets, "packet-digest");
  const expectations =
    input.expectations ?? FRENCH_ENTITY_CANONICALIZATION_DEFAULT_EXPECTATIONS;
  assertExpectations(expectations);
  if (input.packets.length !== expectations.packets) {
    throw new Error(
      `french-entity-canonicalization-packet-count:${input.packets.length}:${expectations.packets}`
    );
  }
  if (input.entityRegistry.length !== expectations.entries) {
    throw new Error(
      `french-entity-canonicalization-entry-count:${input.entityRegistry.length}:${expectations.entries}`
    );
  }

  const packetByKey = new Map<string, LexiconV3FrenchPacket>();
  for (const packet of input.packets) {
    const issues = validateFrenchPacket(packet);
    /*
     * Protected-content extraction is not an input to entity naming. A packet
     * generated before a stricter reference extractor may therefore replay
     * here if (and only if) its own packet hash and exact English lineage are
     * still valid. Every other packet issue remains blocking.
     */
    const blockingIssues = issues.filter(
      (issue) => issue !== "protected-content-mismatch"
    );
    if (blockingIssues.length > 0) {
      throw new Error(
        `french-entity-canonicalization-invalid-packet:${packet.entryKey}:${blockingIssues.join(",")}`
      );
    }
    if (packetByKey.has(packet.entryKey)) {
      throw new Error(
        `french-entity-canonicalization-duplicate-packet:${packet.entryKey}`
      );
    }
    packetByKey.set(packet.entryKey, packet);
  }

  const registryByKey = new Map<string, FrenchEntityRegistrySourceRecord>();
  for (const record of input.entityRegistry) {
    assertEntityRegistrySourceRecord(record);
    if (registryByKey.has(record.entryKey)) {
      throw new Error(
        `french-entity-canonicalization-duplicate-registry-entry:${record.entryKey}`
      );
    }
    registryByKey.set(record.entryKey, record);
  }

  const candidates = [...registryByKey.values()]
    .sort((left, right) => compareText(left.entryKey, right.entryKey))
    .map((record) => {
      const packet = packetByKey.get(record.entryKey);
      if (!packet) {
        throw new Error(
          `french-entity-canonicalization-missing-packet:${record.entryKey}`
        );
      }
      return buildCandidate(record, packet);
    });
  const releaseKeys = uniqueSorted(
    candidates.map((candidate) => candidate.englishParentHashes.releaseKey)
  );
  const releaseSnapshots = uniqueSorted(
    candidates.map(
      (candidate) => candidate.englishParentHashes.releaseSnapshotFingerprint
    )
  );
  if (releaseKeys.length !== 1 || releaseSnapshots.length !== 1) {
    throw new Error("french-entity-canonicalization-mixed-english-lineage");
  }

  const entityGroups = buildEntityGroups(candidates);
  const reviewUnits = buildReviewUnits(candidates, entityGroups);
  const anchors = candidates.filter((candidate) => candidate.anchor !== null);
  const reviewCandidates = candidates.filter(
    (candidate) => candidate.anchor === null
  );
  const counts = buildCounts(
    input.packets.length,
    candidates,
    entityGroups,
    reviewUnits
  );
  assertExpectedCounts(counts, expectations);

  const sourceLineage = {
    entityRegistryDigest: input.sourceDigests.entityRegistry,
    packetDigest: input.sourceDigests.packets,
    entityRegistryLogicalDigest: hashFrenchEntityJson(
      candidates.map((candidate) => ({
        entryKey: candidate.entryKey,
        hash: candidate.sourceHashes.entityRegistryRecordHash
      }))
    ),
    packetLogicalDigest: hashFrenchEntityJson(
      candidates.map((candidate) => ({
        entryKey: candidate.entryKey,
        hash: candidate.sourceHashes.packetHash
      }))
    ),
    releaseKey: requiredOnly(releaseKeys, "release-key"),
    releaseSnapshotFingerprint: requiredOnly(
      releaseSnapshots,
      "release-snapshot"
    )
  };
  const deterministicContent = {
    schemaVersion: FRENCH_ENTITY_CANONICALIZATION_PLAN_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_CANONICALIZATION_POLICY_VERSION,
    sourceLineage,
    counts,
    entityGroups,
    anchors,
    reviewCandidates,
    reviewUnits
  };
  const plan: FrenchEntityCanonicalizationPlan = {
    ...deterministicContent,
    generatedAt,
    planHash: hashFrenchEntityJson(deterministicContent)
  };
  assertFrenchEntityCanonicalizationPlan(plan, expectations);
  return plan;
}

export function assertFrenchEntityCanonicalizationPlan(
  plan: FrenchEntityCanonicalizationPlan,
  expectations: FrenchEntityCanonicalizationExpectations = FRENCH_ENTITY_CANONICALIZATION_DEFAULT_EXPECTATIONS
): void {
  if (
    plan.schemaVersion !== FRENCH_ENTITY_CANONICALIZATION_PLAN_SCHEMA_VERSION ||
    plan.policyVersion !== FRENCH_ENTITY_CANONICALIZATION_POLICY_VERSION
  ) {
    throw new Error("french-entity-canonicalization-plan-version");
  }
  if (!Number.isFinite(Date.parse(plan.generatedAt))) {
    throw new Error("french-entity-canonicalization-plan-generated-at");
  }
  for (const [key, value] of Object.entries(plan.sourceLineage)) {
    if (key === "releaseKey") {
      if (!value.trim()) {
        throw new Error("french-entity-canonicalization-plan-release-key");
      }
    } else {
      assertSha256(value, `plan-lineage-${key}`);
    }
  }
  assertExpectedCounts(plan.counts, expectations);
  assertSortedUnique(
    plan.entityGroups.map((group) => String(group.entityId).padStart(12, "0")),
    "entity-groups"
  );
  assertSortedUnique(
    plan.anchors.map((candidate) => candidate.entryKey),
    "anchor-candidates"
  );
  assertSortedUnique(
    plan.reviewCandidates.map((candidate) => candidate.entryKey),
    "review-candidates"
  );
  assertSortedUnique(
    plan.reviewUnits.map((unit) => unit.unitId),
    "review-units"
  );
  const candidates = [...plan.anchors, ...plan.reviewCandidates].sort(
    (left, right) => compareText(left.entryKey, right.entryKey)
  );
  assertSortedUnique(
    candidates.map((candidate) => candidate.entryKey),
    "all-candidates"
  );
  for (const candidate of candidates) {
    assertCandidate(candidate);
  }
  const rebuiltGroups = buildEntityGroups(candidates);
  if (
    canonicalFrenchEntityJson(rebuiltGroups) !==
    canonicalFrenchEntityJson(plan.entityGroups)
  ) {
    throw new Error("french-entity-canonicalization-group-replay-mismatch");
  }
  const rebuiltUnits = buildReviewUnits(candidates, rebuiltGroups);
  if (
    canonicalFrenchEntityJson(rebuiltUnits) !==
    canonicalFrenchEntityJson(plan.reviewUnits)
  ) {
    throw new Error("french-entity-canonicalization-unit-replay-mismatch");
  }
  const rebuiltCounts = buildCounts(
    plan.counts.packets,
    candidates,
    rebuiltGroups,
    rebuiltUnits
  );
  if (
    canonicalFrenchEntityJson(rebuiltCounts) !==
    canonicalFrenchEntityJson(plan.counts)
  ) {
    throw new Error("french-entity-canonicalization-count-replay-mismatch");
  }
  const registryLogicalDigest = hashFrenchEntityJson(
    candidates.map((candidate) => ({
      entryKey: candidate.entryKey,
      hash: candidate.sourceHashes.entityRegistryRecordHash
    }))
  );
  const packetLogicalDigest = hashFrenchEntityJson(
    candidates.map((candidate) => ({
      entryKey: candidate.entryKey,
      hash: candidate.sourceHashes.packetHash
    }))
  );
  if (
    plan.sourceLineage.entityRegistryLogicalDigest !== registryLogicalDigest ||
    plan.sourceLineage.packetLogicalDigest !== packetLogicalDigest
  ) {
    throw new Error("french-entity-canonicalization-logical-digest-mismatch");
  }
  const { generatedAt: _generatedAt, planHash: _planHash, ...content } = plan;
  void _generatedAt;
  void _planHash;
  if (hashFrenchEntityJson(content) !== plan.planHash) {
    throw new Error("french-entity-canonicalization-plan-hash-mismatch");
  }
}

export function finalizeFrenchCanonicalEntity(
  input: Omit<
    FrenchCanonicalEntityRecord,
    "schemaVersion" | "policyVersion" | "normalizedPrimaryFr" | "contentHash"
  >
): FrenchCanonicalEntityRecord {
  const primaryFr = input.primaryFr.trim();
  const withoutHash = {
    schemaVersion: FRENCH_CANONICAL_ENTITY_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_CANONICALIZATION_POLICY_VERSION,
    ...input,
    primaryFr,
    normalizedPrimaryFr: normalizeFrenchEvidence(primaryFr),
    memberEntryKeys: uniqueSorted(input.memberEntryKeys)
  };
  return {
    ...withoutHash,
    contentHash: hashFrenchEntityJson(withoutHash)
  };
}

export function finalizeFrenchEntityClassificationProof(
  input: Omit<FrenchEntityClassificationProof, "schemaVersion" | "proofHash">
): FrenchEntityClassificationProof {
  if (input.agentArtifacts !== null) {
    assertFrenchEntityAgentReviewHashes(
      input.agentArtifacts,
      "classification-proof-finalizer"
    );
  }
  const withoutHash = {
    schemaVersion: FRENCH_ENTITY_CLASSIFICATION_PROOF_SCHEMA_VERSION,
    ...input,
    evidenceHashes: uniqueSorted(input.evidenceHashes),
    reasons: uniqueSorted(input.reasons)
  };
  return {
    ...withoutHash,
    proofHash: hashFrenchEntityJson(withoutHash)
  };
}

export function selectedFrenchEntityPolicyForm(
  policy: Pick<
    FrenchCanonicalEntryNamePolicy,
    "constraint" | "primaryFr" | "derivedFr"
  >
): string | null {
  if (!isFrenchEntityNameConstraint(policy.constraint)) {
    throw new Error("french-entity-canonicalization-invalid-policy-constraint");
  }
  if (policy.constraint === "canonical") {
    return trimNullable(policy.primaryFr);
  }
  if (
    policy.constraint === "derived" ||
    policy.constraint === "proper-name-without-entity" ||
    policy.constraint === "lexical-translation"
  ) {
    return trimNullable(policy.derivedFr);
  }
  return null;
}

/**
 * Produces the complete normative surface set from one reviewed French lemma.
 * Witness spellings never enter this set. Only a single-token gentilic may gain
 * a deterministic plural; irregular or compound forms remain singular until a
 * future policy version can model them explicitly.
 */
export function canonicalFrenchEntityPolicyForms(
  treatment: Exclude<FrenchEntityNameTreatment, "unresolved">,
  selectedForm: string
): string[] {
  if (
    !isFrenchEntityNameTreatment(treatment) ||
    String(treatment) === "unresolved"
  ) {
    throw new Error("french-entity-canonicalization-invalid-policy-treatment");
  }
  const singular = selectedForm.trim();
  if (!singular) {
    throw new Error("french-entity-canonicalization-empty-selected-form");
  }
  if (treatment !== "gentilic" || /[\s'’\-‐‑‒–—―]/u.test(singular)) {
    return [singular];
  }
  let plural: string;
  if (/[sxz]$/iu.test(singular)) {
    plural = singular;
  } else if (/al$/iu.test(singular)) {
    plural = `${singular.slice(0, -2)}aux`;
  } else if (/(?:eau|au|eu)$/iu.test(singular)) {
    plural = `${singular}x`;
  } else {
    plural = `${singular}s`;
  }
  return uniqueSortedTrimmed([singular, plural]);
}

export function finalizeFrenchCanonicalEntryNamePolicy(
  input: Omit<
    FrenchCanonicalEntryNamePolicy,
    "schemaVersion" | "policyVersion" | "contentHash"
  >
): FrenchCanonicalEntryNamePolicy {
  assertFrenchEntityPolicyDiscriminants(input, input.entryKey);
  const primaryFr = trimNullable(input.primaryFr);
  const derivedFr = trimNullable(input.derivedFr);
  const selectedForm = selectedFrenchEntityPolicyForm({
    constraint: input.constraint,
    primaryFr,
    derivedFr
  });
  const proposedFrenchForms = uniqueSortedTrimmed(input.allowedFrenchForms);
  const normativeFrenchForms =
    selectedForm && input.treatment !== "unresolved"
      ? canonicalFrenchEntityPolicyForms(input.treatment, selectedForm)
      : [];
  const selectedOnly = selectedForm ? [selectedForm] : [];
  if (
    canonicalFrenchEntityJson(proposedFrenchForms) !==
      canonicalFrenchEntityJson(normativeFrenchForms) &&
    canonicalFrenchEntityJson(proposedFrenchForms) !==
      canonicalFrenchEntityJson(selectedOnly)
  ) {
    throw new Error(
      `french-entity-canonicalization-finalizer-noncanonical-forms:${input.entryKey}`
    );
  }
  const withoutHash = {
    schemaVersion: FRENCH_CANONICAL_ENTRY_NAME_POLICY_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_CANONICALIZATION_POLICY_VERSION,
    ...input,
    entityBindings: sortBindings(input.entityBindings),
    primaryFr,
    derivedFr,
    englishForms: uniqueSortedTrimmed(input.englishForms),
    allowedFrenchForms: normativeFrenchForms
  };
  return {
    ...withoutHash,
    contentHash: hashFrenchEntityJson(withoutHash)
  };
}

export function assertFrenchEntityCanonicalizationResolved(input: {
  plan: FrenchEntityCanonicalizationPlan;
  canonicalEntities: readonly FrenchCanonicalEntityRecord[];
  entryPolicies: readonly FrenchCanonicalEntryNamePolicy[];
  expectations?: FrenchEntityCanonicalizationExpectations;
}): FrenchEntityCanonicalizationGateResult {
  assertFrenchEntityCanonicalizationPlan(
    input.plan,
    input.expectations ?? FRENCH_ENTITY_CANONICALIZATION_DEFAULT_EXPECTATIONS
  );
  const allCandidates = [
    ...input.plan.anchors,
    ...input.plan.reviewCandidates
  ].sort((left, right) => compareText(left.entryKey, right.entryKey));
  const candidateByKey = uniqueMap(
    allCandidates,
    (candidate) => candidate.entryKey,
    "gate-candidate"
  );
  const groupById = uniqueMap(
    input.plan.entityGroups,
    (group) => group.entityId,
    "gate-group"
  );
  const reviewUnitByEntryKey = new Map<
    string,
    FrenchEntityCanonicalizationReviewUnit
  >();
  for (const unit of input.plan.reviewUnits) {
    for (const entryKey of unit.reviewEntryKeys) {
      if (reviewUnitByEntryKey.has(entryKey)) {
        throw new Error(
          `french-entity-canonicalization-review-entry-in-multiple-units:${entryKey}`
        );
      }
      reviewUnitByEntryKey.set(entryKey, unit);
    }
  }

  const entityById = uniqueMap(
    input.canonicalEntities,
    (entity) => entity.entityId,
    "canonical-entity"
  );
  if (entityById.size !== groupById.size) {
    throw new Error(
      `french-entity-canonicalization-entity-coverage:${entityById.size}:${groupById.size}`
    );
  }
  for (const [entityId, group] of groupById) {
    const entity = entityById.get(entityId);
    if (!entity) {
      throw new Error(
        `french-entity-canonicalization-missing-canonical-entity:${entityId}`
      );
    }
    assertCanonicalEntity(entity, group);
  }

  const policyByKey = uniqueMap(
    input.entryPolicies,
    (policy) => policy.entryKey,
    "entry-name-policy"
  );
  if (policyByKey.size !== candidateByKey.size) {
    throw new Error(
      `french-entity-canonicalization-policy-coverage:${policyByKey.size}:${candidateByKey.size}`
    );
  }
  for (const [entryKey, candidate] of candidateByKey) {
    const policy = policyByKey.get(entryKey);
    if (!policy) {
      throw new Error(
        `french-entity-canonicalization-missing-entry-policy:${entryKey}`
      );
    }
    assertCanonicalEntryPolicy(
      policy,
      candidate,
      reviewUnitByEntryKey.get(entryKey) ?? null,
      entityById,
      groupById
    );
  }

  const resultWithoutHash = {
    schemaVersion: FRENCH_ENTITY_CANONICALIZATION_GATE_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_CANONICALIZATION_POLICY_VERSION,
    planHash: input.plan.planHash,
    entityCount: entityById.size,
    policyCount: policyByKey.size,
    unresolvedCount: 0 as const,
    blockedCount: 0 as const,
    exactCoverage: true as const,
    exactEnglishLineage: true as const,
    exactStepIdentity: true as const,
    onePrimaryFrenchPerEntity: true as const,
    explicitRelations: true as const,
    historicalEvidenceOnlyCount: 0 as const
  };
  return {
    ...resultWithoutHash,
    gateHash: hashFrenchEntityJson(resultWithoutHash)
  };
}

function buildCandidate(
  record: FrenchEntityRegistrySourceRecord,
  packet: LexiconV3FrenchPacket
): FrenchEntityCanonicalizationCandidate {
  assertExactRegistryPacketJoin(record, packet);
  const matches = sortMatches(record.matches);
  const entityIds = uniqueSortedNumbers(matches.map((match) => match.entityId));
  const englishParentHashes = buildEnglishParentHashes(packet);
  let initialTreatment: FrenchEntityNameTreatment = "unresolved";
  let initialConstraint: FrenchEntityNameConstraint = "blocked";
  let anchor: FrenchEntityCanonicalizationCandidate["anchor"] = null;
  if (record.status === "green") {
    if (
      entityIds.length !== 1 ||
      !record.canonicalFr?.trim() ||
      record.reasons.length === 0
    ) {
      throw new Error(
        `french-entity-canonicalization-invalid-green-anchor:${record.entryKey}`
      );
    }
    initialTreatment = "canonical-name";
    initialConstraint = "canonical";
    const entityId = requiredOnly(entityIds, "green-anchor-entity");
    const primaryFr = record.canonicalFr.trim();
    anchor = {
      entityId,
      primaryFr,
      proofHash: hashFrenchEntityJson({
        entityId,
        primaryFr,
        recordHash: record.contentHash,
        packetHash: packet.packetHash,
        referenceEvidenceHash: hashFrenchEntityJson(record.referenceEvidence)
      })
    };
  } else if (COMMON_OR_ETYMOLOGICAL_ENTRY_KEYS.has(record.entryKey)) {
    initialTreatment = "etymological-or-common-gloss";
    initialConstraint = "lexical-translation";
  } else if (entityIds.length === 1) {
    initialConstraint = "derived";
  }
  const historicalFrenchGloss =
    record.historicalCandidate?.gloss.trim() || null;
  const historicalCandidateHash = record.historicalCandidate
    ? hashFrenchEntityJson(record.historicalCandidate)
    : null;
  const withoutHash = {
    schemaVersion: FRENCH_ENTITY_CANONICALIZATION_CANDIDATE_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_CANONICALIZATION_POLICY_VERSION,
    entryKey: record.entryKey,
    stepEntryId: record.stepEntryId,
    identity: {
      stepEntryId: packet.identity.stepEntryId,
      language: packet.identity.language,
      primaryDStrong: record.identity.primaryDStrong,
      eStrong: packet.identity.eStrong,
      dStrong: packet.identity.dStrong,
      uStrong: packet.identity.uStrong,
      original: packet.identity.original,
      transliteration: packet.identity.transliteration,
      morph: packet.identity.morph
    },
    englishParentHashes,
    englishGloss: packet.english.gloss,
    editorialStatus: record.status,
    entityIds,
    entityMatches: matches,
    sourceForms: {
      englishGloss: packet.english.gloss,
      englishEntityForms: uniqueSortedTrimmed(
        matches.flatMap((match) => [match.aliasEn, match.entityEn])
      ),
      candidateFrenchForms: uniqueSortedTrimmed(
        matches.map((match) => match.candidateFr)
      ),
      concordanceForms: packet.evidence.concordanceForms.map((form) => ({
        surface: form.surface,
        normalized: form.normalized,
        count: form.count,
        strongCount: form.strongCount,
        witnessFamilies: [...form.witnessFamilies],
        sources: [...form.sources]
      })),
      historicalFrenchGloss
    },
    sourceHashes: {
      entityRegistryRecordHash: record.contentHash,
      packetHash: packet.packetHash,
      referenceEvidenceHash: hashFrenchEntityJson(record.referenceEvidence),
      referenceEvidenceCount: record.referenceEvidence.length,
      concordanceEvidenceHash: hashFrenchEntityJson(
        packet.evidence.concordanceForms
      ),
      concordanceEvidenceCount: packet.evidence.concordanceForms.length,
      historicalCandidateHash
    },
    anchor,
    initialTreatment,
    initialConstraint,
    reasons: uniqueSorted(record.reasons)
  };
  return {
    ...withoutHash,
    candidateHash: hashFrenchEntityJson(withoutHash)
  };
}

function buildEnglishParentHashes(
  packet: LexiconV3FrenchPacket
): FrenchEntityEnglishParentHashes {
  const parent = (
    source: LexiconV3FrenchPacket["englishRelease"]["parents"]["gloss"]
  ): FrenchEntityEnglishParentHash => ({
    fieldVersionId: source.fieldVersionId,
    contentHash: source.contentHash,
    valueTextHash: source.valueTextHash,
    valueHtmlHash: source.valueHtmlHash
  });
  const withoutHash = {
    releaseKey: packet.englishRelease.releaseKey,
    releaseSnapshotFingerprint:
      packet.englishRelease.releaseSnapshotFingerprint,
    gloss: parent(packet.englishRelease.parents.gloss),
    meaning: parent(packet.englishRelease.parents.meaning)
  };
  return {
    ...withoutHash,
    lineageHash: hashFrenchEntityJson(withoutHash)
  };
}

function buildEntityGroups(
  candidates: readonly FrenchEntityCanonicalizationCandidate[]
): FrenchEntityCanonicalizationGroup[] {
  const matchesByEntity = new Map<
    number,
    Array<{
      candidate: FrenchEntityCanonicalizationCandidate;
      match: FrenchEntityRegistrySourceMatch;
    }>
  >();
  for (const candidate of candidates) {
    for (const match of candidate.entityMatches) {
      const values = matchesByEntity.get(match.entityId) ?? [];
      values.push({ candidate, match });
      matchesByEntity.set(match.entityId, values);
    }
  }
  return [...matchesByEntity.entries()]
    .sort(([left], [right]) => left - right)
    .map(([entityId, values]) => {
      const category = requiredOnly(
        uniqueSorted(values.map(({ match }) => match.category)),
        `entity-category:${entityId}`
      );
      const type = requiredOnly(
        uniqueSorted(values.map(({ match }) => match.type)),
        `entity-type:${entityId}`
      );
      const memberEntryKeys = uniqueSorted(
        values.map(({ candidate }) => candidate.entryKey)
      );
      const anchorEntryKeys = uniqueSorted(
        values
          .filter(({ candidate }) => candidate.anchor !== null)
          .map(({ candidate }) => candidate.entryKey)
      );
      const reviewEntryKeys = uniqueSorted(
        values
          .filter(({ candidate }) => candidate.anchor === null)
          .map(({ candidate }) => candidate.entryKey)
      );
      const languages = uniqueSorted(
        values.map(({ candidate }) => candidate.identity.language)
      ) as Array<"greek" | "hebrew">;
      const sourceRows = uniqueByCanonicalJson(
        values.map(({ match }) => ({
          significance: match.significance,
          aliasEn: match.aliasEn,
          entityEn: match.entityEn,
          candidateFr: match.candidateFr,
          category: match.category,
          type: match.type
        }))
      );
      const sourceEntityHash = hashFrenchEntityJson({
        entityId,
        category,
        type,
        sourceRows
      });
      const memberCandidateHashes = memberEntryKeys.map((entryKey) => {
        const candidate = values.find(
          (value) => value.candidate.entryKey === entryKey
        )?.candidate;
        if (!candidate) {
          throw new Error(
            `french-entity-canonicalization-missing-group-candidate:${entityId}:${entryKey}`
          );
        }
        return { entryKey, candidateHash: candidate.candidateHash };
      });
      const groupProofHash = hashFrenchEntityJson({
        entityId,
        memberEntryKeys,
        anchorEntryKeys,
        reviewEntryKeys,
        sourceEntityHash,
        memberCandidateHashes
      });
      const withoutHash = {
        schemaVersion: FRENCH_ENTITY_CANONICALIZATION_GROUP_SCHEMA_VERSION,
        policyVersion: FRENCH_ENTITY_CANONICALIZATION_POLICY_VERSION,
        entityId,
        category,
        type,
        memberEntryKeys,
        anchorEntryKeys,
        reviewEntryKeys,
        languages,
        crossLanguage: languages.length > 1,
        sourceEntityHash,
        groupProofHash
      };
      return {
        ...withoutHash,
        contentHash: hashFrenchEntityJson(withoutHash)
      };
    });
}

function buildReviewUnits(
  candidates: readonly FrenchEntityCanonicalizationCandidate[],
  groups: readonly FrenchEntityCanonicalizationGroup[]
): FrenchEntityCanonicalizationReviewUnit[] {
  const groupById = new Map(groups.map((group) => [group.entityId, group]));
  const reviews = candidates.filter((candidate) => candidate.anchor === null);
  const singleByEntity = new Map<
    number,
    FrenchEntityCanonicalizationCandidate[]
  >();
  const units: FrenchEntityCanonicalizationReviewUnit[] = [];
  for (const candidate of reviews) {
    if (candidate.entityIds.length === 1) {
      const entityId = requiredOnly(
        candidate.entityIds,
        "single-review-entity"
      );
      const values = singleByEntity.get(entityId) ?? [];
      values.push(candidate);
      singleByEntity.set(entityId, values);
      continue;
    }
    const kind =
      candidate.entityIds.length === 0 ? "no-entity" : "multi-entity";
    units.push(
      finalizeReviewUnit({
        unitId: `${kind}:${candidate.entryKey}`,
        kind,
        entityIds: candidate.entityIds,
        memberEntryKeys: [candidate.entryKey],
        anchorEntryKeys: [],
        reviewEntryKeys: [candidate.entryKey],
        crossLanguage: false,
        groupProofHashes: candidate.entityIds.map((entityId) => {
          const group = groupById.get(entityId);
          if (!group) {
            throw new Error(
              `french-entity-canonicalization-missing-multi-group:${candidate.entryKey}:${entityId}`
            );
          }
          return group.groupProofHash;
        })
      })
    );
  }
  for (const [entityId, reviewCandidates] of singleByEntity) {
    const group = groupById.get(entityId);
    if (!group) {
      throw new Error(
        `french-entity-canonicalization-missing-single-group:${entityId}`
      );
    }
    units.push(
      finalizeReviewUnit({
        unitId: `entity:${String(entityId).padStart(8, "0")}`,
        kind: "entity-group",
        entityIds: [entityId],
        memberEntryKeys: group.memberEntryKeys,
        anchorEntryKeys: group.anchorEntryKeys,
        reviewEntryKeys: uniqueSorted(
          reviewCandidates.map((candidate) => candidate.entryKey)
        ),
        crossLanguage: group.crossLanguage,
        groupProofHashes: [group.groupProofHash]
      })
    );
  }
  return units.sort((left, right) => compareText(left.unitId, right.unitId));
}

function finalizeReviewUnit(
  input: Omit<
    FrenchEntityCanonicalizationReviewUnit,
    "schemaVersion" | "policyVersion" | "unitHash"
  >
): FrenchEntityCanonicalizationReviewUnit {
  const withoutHash = {
    schemaVersion: FRENCH_ENTITY_CANONICALIZATION_REVIEW_UNIT_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_CANONICALIZATION_POLICY_VERSION,
    ...input,
    entityIds: uniqueSortedNumbers(input.entityIds),
    memberEntryKeys: uniqueSorted(input.memberEntryKeys),
    anchorEntryKeys: uniqueSorted(input.anchorEntryKeys),
    reviewEntryKeys: uniqueSorted(input.reviewEntryKeys),
    groupProofHashes: uniqueSorted(input.groupProofHashes)
  };
  return {
    ...withoutHash,
    unitHash: hashFrenchEntityJson(withoutHash)
  };
}

function buildCounts(
  packetCount: number,
  candidates: readonly FrenchEntityCanonicalizationCandidate[],
  groups: readonly FrenchEntityCanonicalizationGroup[],
  reviewUnits: readonly FrenchEntityCanonicalizationReviewUnit[]
): FrenchEntityCanonicalizationCounts {
  const sharedGroups = groups.filter(
    (group) => group.memberEntryKeys.length > 1
  );
  return {
    packets: packetCount,
    entries: candidates.length,
    anchors: candidates.filter((candidate) => candidate.anchor !== null).length,
    reviews: candidates.filter((candidate) => candidate.anchor === null).length,
    singleEntityEntries: candidates.filter(
      (candidate) => candidate.entityIds.length === 1
    ).length,
    noEntityEntries: candidates.filter(
      (candidate) => candidate.entityIds.length === 0
    ).length,
    multiEntityEntries: candidates.filter(
      (candidate) => candidate.entityIds.length > 1
    ).length,
    entityIds: groups.length,
    sharedEntityGroups: sharedGroups.length,
    sharedEntityEntries: new Set(
      sharedGroups.flatMap((group) => group.memberEntryKeys)
    ).size,
    crossLanguageEntityGroups: groups.filter((group) => group.crossLanguage)
      .length,
    reviewUnits: reviewUnits.length,
    entityReviewUnits: reviewUnits.filter(
      (unit) => unit.kind === "entity-group"
    ).length,
    noEntityReviewUnits: reviewUnits.filter((unit) => unit.kind === "no-entity")
      .length,
    multiEntityReviewUnits: reviewUnits.filter(
      (unit) => unit.kind === "multi-entity"
    ).length
  };
}

function assertEntityRegistrySourceRecord(
  record: FrenchEntityRegistrySourceRecord
): void {
  if (
    record.schemaVersion !== FRENCH_ENTITY_REGISTRY_SCHEMA_VERSION ||
    record.policyVersion !== FRENCH_EDITORIAL_POLICY_VERSION
  ) {
    throw new Error(
      `french-entity-canonicalization-registry-version:${record.entryKey}`
    );
  }
  const { contentHash, ...content } = record;
  assertSha256(contentHash, `registry-content-hash:${record.entryKey}`);
  if (hashFrenchEntityJson(content) !== contentHash) {
    throw new Error(
      `french-entity-canonicalization-registry-hash:${record.entryKey}`
    );
  }
  if (
    !record.entryKey ||
    !Number.isInteger(record.stepEntryId) ||
    record.stepEntryId < 1 ||
    !["green", "yellow", "red"].includes(record.status)
  ) {
    throw new Error(
      `french-entity-canonicalization-registry-identity:${record.entryKey}`
    );
  }
  for (const match of record.matches) {
    if (!Number.isInteger(match.entityId) || match.entityId < 1) {
      throw new Error(
        `french-entity-canonicalization-invalid-entity-id:${record.entryKey}`
      );
    }
  }
}

function assertExactRegistryPacketJoin(
  record: FrenchEntityRegistrySourceRecord,
  packet: LexiconV3FrenchPacket
): void {
  const expectedEntryKey = `${packet.identity.language}:${record.identity.primaryDStrong}`;
  if (
    packet.schemaVersion !== FRENCH_PACKET_SCHEMA_VERSION ||
    record.entryKey !== packet.entryKey ||
    record.entryKey !== expectedEntryKey ||
    record.stepEntryId !== packet.identity.stepEntryId ||
    record.identity.language !== packet.identity.language ||
    record.identity.eStrong !== packet.identity.eStrong ||
    record.identity.dStrong !== packet.identity.dStrong ||
    record.identity.uStrong !== packet.identity.uStrong ||
    record.identity.morph !== packet.identity.morph ||
    record.englishGloss !== packet.english.gloss
  ) {
    throw new Error(
      `french-entity-canonicalization-exact-join:${record.entryKey}`
    );
  }
}

function assertCandidate(
  candidate: FrenchEntityCanonicalizationCandidate
): void {
  if (
    candidate.schemaVersion !==
      FRENCH_ENTITY_CANONICALIZATION_CANDIDATE_SCHEMA_VERSION ||
    candidate.policyVersion !== FRENCH_ENTITY_CANONICALIZATION_POLICY_VERSION
  ) {
    throw new Error(
      `french-entity-canonicalization-candidate-version:${candidate.entryKey}`
    );
  }
  const { candidateHash, ...content } = candidate;
  if (hashFrenchEntityJson(content) !== candidateHash) {
    throw new Error(
      `french-entity-canonicalization-candidate-hash:${candidate.entryKey}`
    );
  }
  for (const hash of [
    candidate.englishParentHashes.lineageHash,
    candidate.sourceHashes.entityRegistryRecordHash,
    candidate.sourceHashes.packetHash,
    candidate.sourceHashes.referenceEvidenceHash,
    candidate.sourceHashes.concordanceEvidenceHash,
    ...(candidate.sourceHashes.historicalCandidateHash
      ? [candidate.sourceHashes.historicalCandidateHash]
      : [])
  ]) {
    assertSha256(hash, `candidate-source-hash:${candidate.entryKey}`);
  }
  if (
    !Number.isInteger(candidate.sourceHashes.referenceEvidenceCount) ||
    candidate.sourceHashes.referenceEvidenceCount < 0 ||
    !Number.isInteger(candidate.sourceHashes.concordanceEvidenceCount) ||
    candidate.sourceHashes.concordanceEvidenceCount < 0 ||
    candidate.sourceHashes.concordanceEvidenceCount !==
      candidate.sourceForms.concordanceForms.length ||
    candidate.sourceHashes.concordanceEvidenceHash !==
      hashFrenchEntityJson(candidate.sourceForms.concordanceForms)
  ) {
    throw new Error(
      `french-entity-canonicalization-reference-evidence-count:${candidate.entryKey}`
    );
  }
  const { lineageHash, ...lineage } = candidate.englishParentHashes;
  if (hashFrenchEntityJson(lineage) !== lineageHash) {
    throw new Error(
      `french-entity-canonicalization-parent-lineage-hash:${candidate.entryKey}`
    );
  }
  if (
    candidate.entryKey !==
      `${candidate.identity.language}:${candidate.identity.primaryDStrong}` ||
    candidate.stepEntryId !== candidate.identity.stepEntryId
  ) {
    throw new Error(
      `french-entity-canonicalization-candidate-identity:${candidate.entryKey}`
    );
  }
  assertSortedUnique(
    candidate.entityIds.map((entityId) => String(entityId).padStart(12, "0")),
    "candidate-entity-ids"
  );
  if (candidate.anchor) {
    if (
      candidate.editorialStatus !== "green" ||
      candidate.initialTreatment !== "canonical-name" ||
      candidate.initialConstraint !== "canonical" ||
      candidate.entityIds.length !== 1 ||
      candidate.entityIds[0] !== candidate.anchor.entityId ||
      !candidate.anchor.primaryFr.trim()
    ) {
      throw new Error(
        `french-entity-canonicalization-anchor-contract:${candidate.entryKey}`
      );
    }
  } else if (candidate.editorialStatus === "green") {
    throw new Error(
      `french-entity-canonicalization-missing-green-anchor:${candidate.entryKey}`
    );
  }
  if (COMMON_OR_ETYMOLOGICAL_ENTRY_KEYS.has(candidate.entryKey)) {
    if (
      candidate.initialTreatment !== "etymological-or-common-gloss" ||
      candidate.initialConstraint !== "lexical-translation"
    ) {
      throw new Error(
        `french-entity-canonicalization-common-gloss-constrained:${candidate.entryKey}`
      );
    }
  }
}

function assertCanonicalEntity(
  entity: FrenchCanonicalEntityRecord,
  group: FrenchEntityCanonicalizationGroup
): void {
  if (
    entity.schemaVersion !== FRENCH_CANONICAL_ENTITY_SCHEMA_VERSION ||
    entity.policyVersion !== FRENCH_ENTITY_CANONICALIZATION_POLICY_VERSION
  ) {
    throw new Error(
      `french-entity-canonicalization-canonical-entity-version:${entity.entityId}`
    );
  }
  const { contentHash, ...content } = entity;
  if (hashFrenchEntityJson(content) !== contentHash) {
    throw new Error(
      `french-entity-canonicalization-canonical-entity-hash:${entity.entityId}`
    );
  }
  if (
    entity.entityId !== group.entityId ||
    !entity.primaryFr.trim() ||
    entity.normalizedPrimaryFr !== normalizeFrenchEvidence(entity.primaryFr) ||
    !entity.normalizedPrimaryFr ||
    entity.category !== group.category ||
    entity.type !== group.type ||
    entity.sourceEntityHash !== group.sourceEntityHash ||
    entity.groupProofHash !== group.groupProofHash ||
    canonicalFrenchEntityJson(entity.memberEntryKeys) !==
      canonicalFrenchEntityJson(group.memberEntryKeys)
  ) {
    throw new Error(
      `french-entity-canonicalization-canonical-entity-drift:${entity.entityId}`
    );
  }
}

function assertCanonicalEntryPolicy(
  policy: FrenchCanonicalEntryNamePolicy,
  candidate: FrenchEntityCanonicalizationCandidate,
  reviewUnit: FrenchEntityCanonicalizationReviewUnit | null,
  entityById: ReadonlyMap<number, FrenchCanonicalEntityRecord>,
  groupById: ReadonlyMap<number, FrenchEntityCanonicalizationGroup>
): void {
  if (
    policy.schemaVersion !==
      FRENCH_CANONICAL_ENTRY_NAME_POLICY_SCHEMA_VERSION ||
    policy.policyVersion !== FRENCH_ENTITY_CANONICALIZATION_POLICY_VERSION
  ) {
    throw new Error(
      `french-entity-canonicalization-entry-policy-version:${policy.entryKey}`
    );
  }
  const { contentHash, ...content } = policy;
  if (hashFrenchEntityJson(content) !== contentHash) {
    throw new Error(
      `french-entity-canonicalization-entry-policy-hash:${policy.entryKey}`
    );
  }
  if (
    policy.entryKey !== candidate.entryKey ||
    policy.stepEntryId !== candidate.stepEntryId ||
    canonicalFrenchEntityJson(policy.identity) !==
      canonicalFrenchEntityJson(candidate.identity) ||
    canonicalFrenchEntityJson(policy.englishParentHashes) !==
      canonicalFrenchEntityJson(candidate.englishParentHashes)
  ) {
    throw new Error(
      `french-entity-canonicalization-entry-policy-lineage:${policy.entryKey}`
    );
  }
  assertFrenchEntityPolicyDiscriminants(policy, policy.entryKey);
  assertClassificationProof(policy.classificationProof, candidate, reviewUnit);
  assertSortedUnique(policy.englishForms, "policy-english-forms");
  assertSortedUnique(policy.allowedFrenchForms, "policy-french-forms");
  if (
    policy.englishForms.some((form) => form !== form.trim() || !form) ||
    policy.allowedFrenchForms.some((form) => form !== form.trim() || !form)
  ) {
    throw new Error(
      `french-entity-canonicalization-entry-policy-empty-form:${policy.entryKey}`
    );
  }
  const selectedFrenchForm = selectedFrenchEntityPolicyForm(policy);
  const normativeFrenchForms =
    selectedFrenchForm && policy.treatment !== "unresolved"
      ? canonicalFrenchEntityPolicyForms(policy.treatment, selectedFrenchForm)
      : [];
  if (
    canonicalFrenchEntityJson(policy.allowedFrenchForms) !==
    canonicalFrenchEntityJson(normativeFrenchForms)
  ) {
    throw new Error(
      `french-entity-canonicalization-noncanonical-french-forms:${policy.entryKey}`
    );
  }
  const allowedEnglishSourceForms = new Set([
    candidate.sourceForms.englishGloss,
    ...candidate.sourceForms.englishEntityForms
  ]);
  if (
    policy.englishForms.some((form) => !allowedEnglishSourceForms.has(form))
  ) {
    throw new Error(
      `french-entity-canonicalization-unsealed-english-form:${policy.entryKey}`
    );
  }
  const candidateEntityIds = new Set(candidate.entityIds);
  const bindingKeys = new Set<string>();
  const boundEntityIds = new Set<number>();
  for (const binding of policy.entityBindings) {
    const key = `${binding.entityId}:${binding.relation}`;
    if (
      bindingKeys.has(key) ||
      boundEntityIds.has(binding.entityId) ||
      !candidateEntityIds.has(binding.entityId) ||
      !entityById.has(binding.entityId) ||
      !groupById.has(binding.entityId)
    ) {
      throw new Error(
        `french-entity-canonicalization-invalid-binding:${policy.entryKey}:${key}`
      );
    }
    bindingKeys.add(key);
    boundEntityIds.add(binding.entityId);
  }
  if (policy.treatment === "unresolved" || policy.constraint === "blocked") {
    throw new Error(
      `french-entity-canonicalization-unresolved-policy:${policy.entryKey}`
    );
  }
  const standaloneProperName =
    isFrenchStandaloneProperNameCandidate(candidate) &&
    candidate.reasons.includes("reconstructed-lxx-name-without-tipnr-entity");
  const unboundNameCandidate = isFrenchUnboundNameCandidate(candidate);
  const unboundNameTreatment =
    new Set<FrenchEntityNameTreatment>([
      "unregistered-proper-name",
      "gentilic",
      "title-or-epithet",
      "compound-name"
    ]).has(policy.treatment) ||
    (policy.treatment === "alternate-name" &&
      isFrenchUnboundAlternateNameCandidate(candidate));
  if (
    (standaloneProperName && !unboundNameTreatment) ||
    (policy.treatment === "unregistered-proper-name" && !unboundNameCandidate)
  ) {
    throw new Error(
      `french-entity-canonicalization-standalone-proper-name-treatment:${policy.entryKey}`
    );
  }
  const nameLikeTreatment = new Set<FrenchEntityNameTreatment>([
    "canonical-name",
    "alternate-name",
    "gentilic",
    "title-or-epithet",
    "compound-name",
    "unregistered-proper-name"
  ]).has(policy.treatment);
  if (
    nameLikeTreatment &&
    reviewUnit?.kind === "multi-entity" &&
    candidate.entityIds.length > 1 &&
    canonicalFrenchEntityJson(
      policy.entityBindings
        .map((binding) => binding.entityId)
        .sort((left, right) => left - right)
    ) !==
      canonicalFrenchEntityJson(
        [...candidate.entityIds].sort((left, right) => left - right)
      )
  ) {
    throw new Error(
      `french-entity-canonicalization-multi-binding-coverage:${policy.entryKey}`
    );
  }
  const directNamedEntityIds = frenchEntityDirectNamedMatchEntityIds({
    englishGloss: candidate.englishGloss,
    entityMatches: candidate.entityMatches
  });
  if (
    reviewUnit?.kind === "multi-entity" &&
    candidate.reasons.includes("multiple-exact-dstrong-entities") &&
    directNamedEntityIds.length > 0 &&
    policy.treatment !== "canonical-name"
  ) {
    throw new Error(
      `french-entity-canonicalization-mixed-direct-primary-treatment:${policy.entryKey}`
    );
  }
  if (policy.treatment === "canonical-name") {
    assertCanonicalPolicyShape(policy, candidate, reviewUnit);
    const binding = requiredOnly(
      policy.entityBindings.filter((value) => value.relation === "primary"),
      `canonical-primary-binding:${policy.entryKey}`
    );
    const canonical = entityById.get(binding.entityId);
    if (!canonical || policy.primaryFr !== canonical.primaryFr) {
      throw new Error(
        `french-entity-canonicalization-primary-name-drift:${policy.entryKey}`
      );
    }
  } else if (policy.treatment === "alternate-name") {
    assertPolicyShape(
      policy,
      "derived",
      "alias",
      true,
      isFrenchUnboundAlternateNameCandidate(candidate)
    );
  } else if (policy.treatment === "unregistered-proper-name") {
    assertStandaloneProperNamePolicy(policy, reviewUnit);
  } else if (policy.treatment === "gentilic") {
    assertPolicyShape(
      policy,
      "derived",
      "gentilic",
      true,
      unboundNameCandidate
    );
  } else if (policy.treatment === "title-or-epithet") {
    assertPolicyShape(policy, "derived", "title", true, unboundNameCandidate);
  } else if (policy.treatment === "compound-name") {
    assertPolicyShape(
      policy,
      "derived",
      "compound",
      true,
      unboundNameCandidate
    );
  } else if (policy.treatment === "etymological-or-common-gloss") {
    if (
      policy.constraint !== "lexical-translation" ||
      policy.primaryFr !== null ||
      !policy.derivedFr?.trim() ||
      policy.englishForms.length !== 0 ||
      policy.entityBindings.some(
        (binding) => binding.relation !== "etymological"
      ) ||
      !policy.allowedFrenchForms.includes(policy.derivedFr)
    ) {
      throw new Error(
        `french-entity-canonicalization-common-gloss-policy:${policy.entryKey}`
      );
    }
  } else {
    throw new Error(
      `french-entity-canonicalization-invalid-policy-treatment:${policy.entryKey}`
    );
  }
}

function assertFrenchEntityPolicyDiscriminants(
  policy: Pick<
    FrenchCanonicalEntryNamePolicy,
    "treatment" | "constraint" | "entityBindings"
  >,
  label: string
): FrenchEntityPolicyTreatmentContract {
  const contract = frenchEntityPolicyContractForTreatment(policy.treatment);
  if (!contract) {
    throw new Error(
      `french-entity-canonicalization-invalid-policy-treatment:${label}`
    );
  }
  if (
    !isFrenchEntityNameConstraint(policy.constraint) ||
    policy.constraint !== contract.constraint
  ) {
    throw new Error(
      `french-entity-canonicalization-invalid-policy-constraint:${label}:${String(policy.constraint)}`
    );
  }
  for (const binding of policy.entityBindings) {
    const relationAllowed =
      policy.treatment === "canonical-name"
        ? binding.relation === "primary" ||
          binding.relation === "alias" ||
          binding.relation === "compound"
        : binding.relation === contract.relation;
    if (!isFrenchEntityBindingRelation(binding.relation) || !relationAllowed) {
      throw new Error(
        `french-entity-canonicalization-invalid-policy-relation:${label}:${String(binding.relation)}`
      );
    }
  }
  return contract;
}

function assertCanonicalPolicyShape(
  policy: FrenchCanonicalEntryNamePolicy,
  candidate: FrenchEntityCanonicalizationCandidate,
  reviewUnit: FrenchEntityCanonicalizationReviewUnit | null
): void {
  const primaryBindings = policy.entityBindings.filter(
    (binding) => binding.relation === "primary"
  );
  const aliasBindings = policy.entityBindings.filter(
    (binding) => binding.relation === "alias"
  );
  const secondaryBindings = policy.entityBindings.filter(
    (binding) => binding.relation === "alias" || binding.relation === "compound"
  );
  const bindingEntityIds = policy.entityBindings
    .map((binding) => binding.entityId)
    .sort((left, right) => left - right);
  const candidateEntityIds = [...candidate.entityIds].sort(
    (left, right) => left - right
  );
  const single =
    policy.entityBindings.length === 1 && aliasBindings.length === 0;
  const exactMixed =
    reviewUnit?.kind === "multi-entity" &&
    candidate.reasons.includes("multiple-exact-dstrong-entities") &&
    candidate.entityIds.length > 1 &&
    policy.entityBindings.length === candidate.entityIds.length &&
    secondaryBindings.length === candidate.entityIds.length - 1 &&
    canonicalFrenchEntityJson(bindingEntityIds) ===
      canonicalFrenchEntityJson(candidateEntityIds);
  const directNamedEntityIds = frenchEntityDirectNamedMatchEntityIds({
    englishGloss: candidate.englishGloss,
    entityMatches: candidate.entityMatches
  });
  const primaryEntityId = primaryBindings[0]?.entityId ?? -1;
  const exactDirectPrimary =
    directNamedEntityIds.length !== 1 ||
    primaryEntityId === directNamedEntityIds[0];
  const exactSecondaryRelations = policy.entityBindings
    .filter((binding) => binding.relation !== "primary")
    .every(
      (binding) =>
        binding.relation ===
        frenchEntityCanonicalSecondaryRelation({
          entityId: binding.entityId,
          entityMatches: candidate.entityMatches
        })
    );
  if (
    policy.constraint !== "canonical" ||
    !policy.primaryFr?.trim() ||
    policy.derivedFr !== null ||
    primaryBindings.length !== 1 ||
    (!single && !exactMixed) ||
    (exactMixed && (!exactDirectPrimary || !exactSecondaryRelations)) ||
    !policy.allowedFrenchForms.includes(policy.primaryFr) ||
    policy.englishForms.length === 0
  ) {
    throw new Error(
      `french-entity-canonicalization-policy-shape:${policy.entryKey}:${policy.treatment}`
    );
  }
}

function assertStandaloneProperNamePolicy(
  policy: FrenchCanonicalEntryNamePolicy,
  reviewUnit: FrenchEntityCanonicalizationReviewUnit | null
): void {
  if (
    reviewUnit?.kind !== "no-entity" ||
    policy.constraint !== "proper-name-without-entity" ||
    policy.entityBindings.length !== 0 ||
    policy.primaryFr !== null ||
    !policy.derivedFr?.trim() ||
    policy.englishForms.length === 0 ||
    !policy.allowedFrenchForms.includes(policy.derivedFr)
  ) {
    throw new Error(
      `french-entity-canonicalization-standalone-proper-name-shape:${policy.entryKey}`
    );
  }
}

function assertPolicyShape(
  policy: FrenchCanonicalEntryNamePolicy,
  constraint: "canonical" | "derived",
  relation: FrenchEntityBindingRelation,
  nameLike: boolean,
  allowUnbound = false
): void {
  const selectedForm =
    constraint === "canonical" ? policy.primaryFr : policy.derivedFr;
  if (
    policy.constraint !== constraint ||
    !selectedForm?.trim() ||
    (constraint === "canonical"
      ? policy.derivedFr !== null
      : policy.primaryFr !== null) ||
    (policy.entityBindings.length === 0 && !allowUnbound) ||
    policy.entityBindings.some((binding) => binding.relation !== relation) ||
    !policy.allowedFrenchForms.includes(selectedForm) ||
    (nameLike && policy.englishForms.length === 0)
  ) {
    throw new Error(
      `french-entity-canonicalization-policy-shape:${policy.entryKey}:${policy.treatment}`
    );
  }
}

function assertClassificationProof(
  proof: FrenchEntityClassificationProof,
  candidate: FrenchEntityCanonicalizationCandidate,
  reviewUnit: FrenchEntityCanonicalizationReviewUnit | null
): void {
  if (
    proof.schemaVersion !== FRENCH_ENTITY_CLASSIFICATION_PROOF_SCHEMA_VERSION
  ) {
    throw new Error(
      `french-entity-canonicalization-proof-version:${candidate.entryKey}`
    );
  }
  const { proofHash, ...content } = proof;
  if (hashFrenchEntityJson(content) !== proofHash) {
    throw new Error(
      `french-entity-canonicalization-proof-hash:${candidate.entryKey}`
    );
  }
  if (
    proof.sourceCandidateHash !== candidate.candidateHash ||
    proof.reasons.length === 0
  ) {
    throw new Error(
      `french-entity-canonicalization-proof-source:${candidate.entryKey}`
    );
  }
  const authoritativeHashes = new Set([
    candidate.englishParentHashes.lineageHash,
    ...(candidate.sourceHashes.referenceEvidenceCount > 0
      ? [candidate.sourceHashes.referenceEvidenceHash]
      : []),
    ...(candidate.sourceHashes.concordanceEvidenceCount > 0
      ? [candidate.sourceHashes.concordanceEvidenceHash]
      : []),
    ...candidate.entityIds.flatMap((entityId) =>
      reviewUnit?.entityIds.includes(entityId)
        ? reviewUnit.groupProofHashes
        : []
    )
  ]);
  if (
    proof.evidenceHashes.length === 0 ||
    !proof.evidenceHashes.some((hash) => authoritativeHashes.has(hash))
  ) {
    throw new Error(
      `french-entity-canonicalization-historical-only-proof:${candidate.entryKey}`
    );
  }
  for (const hash of proof.evidenceHashes) {
    assertSha256(hash, `classification-evidence:${candidate.entryKey}`);
  }
  if (candidate.anchor) {
    if (
      reviewUnit !== null ||
      proof.sourceReviewUnitHash !== null ||
      proof.decisionMethod !== "deterministic-green-anchor" ||
      proof.agentArtifacts !== null
    ) {
      throw new Error(
        `french-entity-canonicalization-anchor-proof:${candidate.entryKey}`
      );
    }
  } else {
    if (
      !reviewUnit ||
      proof.sourceReviewUnitHash !== reviewUnit.unitHash ||
      proof.decisionMethod !== "internal-agent-adjudication" ||
      !proof.agentArtifacts
    ) {
      throw new Error(
        `french-entity-canonicalization-review-proof:${candidate.entryKey}`
      );
    }
    assertFrenchEntityAgentReviewHashes(
      proof.agentArtifacts,
      candidate.entryKey
    );
  }
}

function assertFrenchEntityAgentReviewHashes(
  value: FrenchEntityAgentReviewHashes,
  label: string
): void {
  const record = value as unknown as Record<string, unknown>;
  const actualKeys = Object.keys(record).sort(compareText);
  const expectedKeys = [
    "proposerAHash",
    "proposerBHash",
    "arbiterHash",
    "auditorHash"
  ].sort(compareText);
  if (
    canonicalFrenchEntityJson(actualKeys) !==
    canonicalFrenchEntityJson(expectedKeys)
  ) {
    throw new Error(
      `french-entity-canonicalization-proof-agent-artifacts:${label}`
    );
  }
  for (const key of expectedKeys) {
    const hash = record[key];
    if (typeof hash !== "string") {
      throw new Error(
        `french-entity-canonicalization-proof-agent-artifacts:${label}:${key}`
      );
    }
    assertSha256(hash, `classification-agent-${key}:${label}`);
  }
}

function assertExpectations(
  expectations: FrenchEntityCanonicalizationExpectations
): void {
  for (const [key, value] of Object.entries(expectations)) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(
        `french-entity-canonicalization-invalid-expectation:${key}:${value}`
      );
    }
  }
}

function assertExpectedCounts(
  counts: FrenchEntityCanonicalizationCounts,
  expectations: FrenchEntityCanonicalizationExpectations
): void {
  assertExpectations(expectations);
  for (const key of Object.keys(expectations) as Array<
    keyof FrenchEntityCanonicalizationExpectations
  >) {
    if (counts[key] !== expectations[key]) {
      throw new Error(
        `french-entity-canonicalization-count:${key}:${counts[key]}:${expectations[key]}`
      );
    }
  }
}

function assertSha256(value: string, label: string): void {
  if (!SHA256_PATTERN.test(value)) {
    throw new Error(`french-entity-canonicalization-invalid-sha256:${label}`);
  }
}

function assertSortedUnique(values: readonly string[], label: string): void {
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (
      value === undefined ||
      (index > 0 && compareText(values[index - 1] ?? "", value) >= 0)
    ) {
      throw new Error(
        `french-entity-canonicalization-not-sorted-unique:${label}`
      );
    }
  }
}

function sortMatches(
  matches: readonly FrenchEntityRegistrySourceMatch[]
): FrenchEntityRegistrySourceMatch[] {
  return [...matches].sort((left, right) => {
    const id = left.entityId - right.entityId;
    return id !== 0
      ? id
      : compareText(
          canonicalFrenchEntityJson(left),
          canonicalFrenchEntityJson(right)
        );
  });
}

function sortBindings(
  bindings: readonly FrenchEntityBinding[]
): FrenchEntityBinding[] {
  const sorted = [...bindings].sort((left, right) => {
    const id = left.entityId - right.entityId;
    return id !== 0 ? id : compareText(left.relation, right.relation);
  });
  const keys = sorted.map(
    (binding) => `${binding.entityId}:${binding.relation}`
  );
  if (new Set(keys).size !== keys.length) {
    throw new Error("french-entity-canonicalization-duplicate-binding");
  }
  return sorted;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

function uniqueSortedTrimmed(values: readonly string[]): string[] {
  return uniqueSorted(values.map((value) => value.trim()).filter(Boolean));
}

function uniqueSortedNumbers(values: readonly number[]): number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}

function uniqueByCanonicalJson<T>(values: readonly T[]): T[] {
  const byJson = new Map<string, T>();
  for (const value of values) {
    byJson.set(canonicalFrenchEntityJson(value), value);
  }
  return [...byJson.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([, value]) => value);
}

function requiredOnly<T>(values: readonly T[], label: string): T {
  if (values.length !== 1 || values[0] === undefined) {
    throw new Error(
      `french-entity-canonicalization-required-only:${label}:${values.length}`
    );
  }
  return values[0];
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
        `french-entity-canonicalization-duplicate-${label}:${String(key)}`
      );
    }
    result.set(key, value);
  }
  return result;
}

function trimNullable(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
