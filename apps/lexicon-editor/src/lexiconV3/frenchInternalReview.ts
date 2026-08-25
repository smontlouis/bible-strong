import { isGenericFrenchCarrier } from "../frenchLexicalSafety.js";
import {
  canonicalFrenchInternalJson,
  assertFrenchCodexExecutionReceipt,
  finalizeFrenchCodexExecutionReceipt,
  frenchCodexExecutionReceiptHash,
  hashFrenchInternalJson,
  FRENCH_INTERNAL_EXECUTION_RECEIPT_SCHEMA_VERSION,
  FRENCH_INTERNAL_PINNED_CODEX_SHA256,
  FRENCH_INTERNAL_PINNED_CODEX_VERSION,
  type FrenchCodexExecutionReceipt
} from "./frenchCodexExecutionReceipt.js";
export {
  canonicalFrenchInternalJson,
  hashFrenchInternalJson,
  FRENCH_INTERNAL_EXECUTION_RECEIPT_SCHEMA_VERSION,
  FRENCH_INTERNAL_PINNED_CODEX_SHA256,
  FRENCH_INTERNAL_PINNED_CODEX_VERSION
} from "./frenchCodexExecutionReceipt.js";
import {
  type FrenchCarrierDecision,
  type FrenchLexiconProposal,
  normalizeFrenchCarrierTerm,
  type FrenchValidationContext,
  type FrenchValidationResult,
  validateFrenchProposal
} from "./frenchValidation.js";
import {
  type LexiconV3FrenchPacket,
  validateFrenchPacket
} from "./frenchPackets.js";
import {
  frenchRenderedHtmlSkeleton,
  frenchSourceHtmlSkeleton
} from "./frenchHtmlRenderer.js";
import type { RequiredFrenchEntityMention } from "./frenchEntityMentions.js";

export const FRENCH_INTERNAL_REVIEW_SCHEMA_VERSION =
  "lexicon-v3-french-review@4" as const;
export const FRENCH_INTERNAL_REVIEW_POLICY_VERSION =
  "lexicon-v3-french-internal-review-policy@1" as const;
export const FRENCH_INTERNAL_AGENT_PROOF_SCHEMA_VERSION =
  "lexicon-v3-french-agent-proof@3" as const;
export const FRENCH_INTERNAL_EXECUTION_ATTESTATION_SCHEMA_VERSION =
  "lexicon-v3-french-codex-execution-attestation@1" as const;
export const FRENCH_INTERNAL_SIBLING_PROOF_SCHEMA_VERSION =
  "lexicon-v3-french-sibling-consistency-proof@1" as const;
export const FRENCH_INTERNAL_PROMPT_VERSION =
  "lexicon-v3-french-internal-prompts@5" as const;

export type FrenchInternalRole =
  | "proposerA"
  | "proposerB"
  | "arbiter"
  | "auditor";

export type FrenchInternalReviewStatus =
  | "auto_validated"
  | "review_needed"
  | "blocked_source_issue"
  | "failed";

export type FrenchInternalAuditCheck =
  | "identityExact"
  | "semanticCoverage"
  | "noSemanticAddition"
  | "noSemanticOmission"
  | "polarityModalityUncertaintyPreserved"
  | "glossMorphologyConform"
  | "properNamesAndTermsConform"
  | "entityMentionsConform"
  | "protectedContentPreserved"
  | "htmlStructurePreserved"
  | "naturalFrench"
  | "siblingStepConsistency";

export type FrenchInternalAuditChecks = Record<
  FrenchInternalAuditCheck,
  "pass" | "fail"
>;

export interface FrenchInternalReviewConfiguration {
  promptVersion: typeof FRENCH_INTERNAL_PROMPT_VERSION;
  proposerAPromptHash: string;
  proposerBPromptHash: string;
  arbiterPromptHash: string;
  auditorPromptHash: string;
  styleGuideHash: string;
  termbaseHash: string;
  canonicalNamesHash: string;
  entityMergeAttestationHash: string;
  canonicalEntitiesHash: string;
  canonicalEntryPoliciesHash: string;
  entityGateHash: string;
  entityMentionsHash: string;
  htmlRendererVersion: string;
  approvedExecutionProfile: FrenchInternalApprovedExecutionProfile;
}

export interface FrenchInternalApprovedExecutionProfile {
  proposerA: { model: "gpt-5.6-luna"; reasoningEffort: "medium" };
  proposerB: { model: "gpt-5.6-sol"; reasoningEffort: "low" };
  arbiter: { model: "gpt-5.6-terra"; reasoningEffort: "medium" };
  auditor: { model: "gpt-5.6-sol"; reasoningEffort: "medium" };
  executorPolicyVersion: "lexicon-v3-french-codex-executor-policy@3";
  codexVersion: typeof FRENCH_INTERNAL_PINNED_CODEX_VERSION;
  codexSha256: typeof FRENCH_INTERNAL_PINNED_CODEX_SHA256;
}

export const FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE: FrenchInternalApprovedExecutionProfile =
  {
    proposerA: { model: "gpt-5.6-luna", reasoningEffort: "medium" },
    proposerB: { model: "gpt-5.6-sol", reasoningEffort: "low" },
    arbiter: { model: "gpt-5.6-terra", reasoningEffort: "medium" },
    auditor: { model: "gpt-5.6-sol", reasoningEffort: "medium" },
    executorPolicyVersion: "lexicon-v3-french-codex-executor-policy@3",
    codexVersion: FRENCH_INTERNAL_PINNED_CODEX_VERSION,
    codexSha256: FRENCH_INTERNAL_PINNED_CODEX_SHA256
  };

export interface FrenchInternalArbitration {
  verdict: "accept" | "review_needed";
  selectedProposal: "proposalA" | "proposalB";
  reasons: string[];
  /** Must be a byte-for-byte canonical copy of the selected proposal. */
  proposal: FrenchLexiconProposal;
  /** Locally computed; never trusted without recomputation. */
  validation: FrenchValidationResult;
}

export interface FrenchInternalAudit {
  verdict: "safe" | "hold" | "block";
  reasons: string[];
  confidence: number;
  checks: FrenchInternalAuditChecks;
}

export interface FrenchInternalAgentProof {
  schemaVersion: typeof FRENCH_INTERNAL_AGENT_PROOF_SCHEMA_VERSION;
  executor: "codex-agent";
  role: FrenchInternalRole;
  agentId: string;
  taskName: string;
  entryKey: string;
  packetHash: string;
  englishHash: string;
  generationConfigHash: string;
  /** Hash of the exact role-specific input view presented to this agent. */
  inputHash: string;
  requestHash: string;
  responseHash: string;
  /** Hash of the replayed Codex execution receipt for this exact role/entry. */
  executionReceiptHash: string;
  completedAt: string;
  proofHash: string;
}

export type FrenchInternalExecutionReceipt =
  FrenchCodexExecutionReceipt<FrenchInternalRole>;

export interface FrenchInternalExecutionAttestation {
  schemaVersion: typeof FRENCH_INTERNAL_EXECUTION_ATTESTATION_SCHEMA_VERSION;
  namespace: string;
  releaseKey: string;
  releaseSnapshotFingerprint: string;
  selectionHash: string;
  keyOrderHash: string;
  proposerManifestHash: string;
  proposerSummaryHash: string;
  arbiterManifestHash: string;
  arbiterSummaryHash: string;
  auditorManifestHash: string;
  auditorSummaryHash: string;
  executionReceiptsDigest: string;
  adjudicationSummaryHash: string;
  roleReceipts: Record<FrenchInternalRole, FrenchInternalExecutionReceipt>;
  attestationHash: string;
}

export interface FrenchInternalSiblingConsistencyProof {
  schemaVersion: typeof FRENCH_INTERNAL_SIBLING_PROOF_SCHEMA_VERSION;
  familyKey: string;
  entryKey: string;
  memberEntryKeys: string[];
  familyInputDigest: string;
  verdict: "consistent" | "divergent";
  issues: string[];
  proofHash: string;
}

export interface FrenchInternalReviewRecord {
  schemaVersion: typeof FRENCH_INTERNAL_REVIEW_SCHEMA_VERSION;
  reviewMode: "internal_agents";
  policyVersion: typeof FRENCH_INTERNAL_REVIEW_POLICY_VERSION;
  entryKey: string;
  packetHash: string;
  englishHash: string;
  generationConfigHash: string;
  configuration: FrenchInternalReviewConfiguration;
  status: FrenchInternalReviewStatus;
  proposalA?: FrenchLexiconProposal;
  proposalB?: FrenchLexiconProposal;
  validationA?: FrenchValidationResult;
  validationB?: FrenchValidationResult;
  arbiter?: FrenchInternalArbitration;
  auditor?: FrenchInternalAudit;
  agentProofs?: Partial<Record<FrenchInternalRole, FrenchInternalAgentProof>>;
  executionAttestation?: FrenchInternalExecutionAttestation;
  siblingConsistency?: FrenchInternalSiblingConsistencyProof;
  carrierTerms: FrenchCarrierDecision[];
  issues: string[];
  generatedAt: string;
  artifactHash: string;
}

export interface FrenchInternalAgentRequestInput {
  role: FrenchInternalRole;
  entryKey: string;
  packetHash: string;
  englishHash: string;
  generationConfigHash: string;
  inputHash: string;
  dependencies?: Record<string, string>;
}

export interface BuildFrenchInternalAgentProofInput<
  T
> extends FrenchInternalAgentRequestInput {
  agentId: string;
  taskName: string;
  response: T;
  executionReceiptHash: string;
  completedAt?: string;
}

export interface VerifyFrenchInternalAgentProofInput<T> {
  proof: FrenchInternalAgentProof;
  request: FrenchInternalAgentRequestInput;
  response: T;
}

export interface FrenchInternalReviewEvaluation {
  structurallyValid: boolean;
  autoEligible: boolean;
  structuralIssues: string[];
  autoEligibilityIssues: string[];
  validationA: FrenchValidationResult | null;
  validationB: FrenchValidationResult | null;
  finalValidation: FrenchValidationResult | null;
  carrierTerms: FrenchCarrierDecision[];
}

export interface EvaluateFrenchInternalReviewInput {
  record: FrenchInternalReviewRecord;
  packet: LexiconV3FrenchPacket;
  /** Pin this in authoring/release so a self-consistent stale termbase cannot pass. */
  expectedGenerationConfigHash?: string;
  requiredEntityMentions?: readonly RequiredFrenchEntityMention[];
}

const FRENCH_INTERNAL_ROLES: readonly FrenchInternalRole[] = [
  "proposerA",
  "proposerB",
  "arbiter",
  "auditor"
];

const FRENCH_INTERNAL_AUDIT_CHECKS: readonly FrenchInternalAuditCheck[] = [
  "identityExact",
  "semanticCoverage",
  "noSemanticAddition",
  "noSemanticOmission",
  "polarityModalityUncertaintyPreserved",
  "glossMorphologyConform",
  "properNamesAndTermsConform",
  "entityMentionsConform",
  "protectedContentPreserved",
  "htmlStructurePreserved",
  "naturalFrench",
  "siblingStepConsistency"
];

const FRENCH_INTERNAL_REVIEW_STATUSES: readonly FrenchInternalReviewStatus[] = [
  "auto_validated",
  "review_needed",
  "blocked_source_issue",
  "failed"
];

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const THREAD_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export function frenchInternalSiblingFamilyKey(
  packet: LexiconV3FrenchPacket
): string {
  const candidate = packet.identity.eStrong.trim();
  const match = /^([GH])(\d+)/u.exec(candidate);
  if (!match) return `${packet.identity.language}:${candidate}`;
  return `${packet.identity.language}:${match[1]}${Number(match[2])}`;
}

export function frenchInternalGenerationConfigHash(
  configuration: FrenchInternalReviewConfiguration
): string {
  return hashFrenchInternalJson({
    schemaVersion: "lexicon-v3-french-internal-config@2",
    ...configuration
  });
}

export function frenchInternalAgentRequestHash(
  input: FrenchInternalAgentRequestInput
): string {
  return hashFrenchInternalJson({
    schemaVersion: "lexicon-v3-french-agent-request@2",
    role: input.role,
    entryKey: input.entryKey,
    packetHash: input.packetHash,
    englishHash: input.englishHash,
    generationConfigHash: input.generationConfigHash,
    inputHash: input.inputHash,
    dependencies: input.dependencies ?? {}
  });
}

export function frenchInternalAgentResponseHash(value: unknown): string {
  return hashFrenchInternalJson({
    schemaVersion: "lexicon-v3-french-agent-response@1",
    payload: value
  });
}

export function frenchInternalAgentProofHash(
  proof: Omit<FrenchInternalAgentProof, "proofHash"> | FrenchInternalAgentProof
): string {
  const { proofHash: _proofHash, ...content } =
    proof as FrenchInternalAgentProof;
  void _proofHash;
  return hashFrenchInternalJson(content);
}

export function buildFrenchInternalAgentProof<T>(
  input: BuildFrenchInternalAgentProofInput<T>
): FrenchInternalAgentProof {
  if (!SHA256_PATTERN.test(input.executionReceiptHash)) {
    throw new Error("invalid-french-internal-execution-receipt-hash");
  }
  const content: Omit<FrenchInternalAgentProof, "proofHash"> = {
    schemaVersion: FRENCH_INTERNAL_AGENT_PROOF_SCHEMA_VERSION,
    executor: "codex-agent",
    role: input.role,
    agentId: input.agentId,
    taskName: input.taskName,
    entryKey: input.entryKey,
    packetHash: input.packetHash,
    englishHash: input.englishHash,
    generationConfigHash: input.generationConfigHash,
    inputHash: input.inputHash,
    requestHash: frenchInternalAgentRequestHash(input),
    responseHash: frenchInternalAgentResponseHash(input.response),
    executionReceiptHash: input.executionReceiptHash,
    completedAt: input.completedAt ?? new Date().toISOString()
  };
  return { ...content, proofHash: frenchInternalAgentProofHash(content) };
}

export function frenchInternalExecutionReceiptHash(
  receipt:
    | Omit<FrenchInternalExecutionReceipt, "receiptHash">
    | FrenchInternalExecutionReceipt
): string {
  return frenchCodexExecutionReceiptHash(receipt);
}

export function finalizeFrenchInternalExecutionReceipt(
  receipt: Omit<FrenchInternalExecutionReceipt, "receiptHash">
): FrenchInternalExecutionReceipt {
  return finalizeFrenchCodexExecutionReceipt(receipt);
}

export function frenchInternalExecutionAttestationHash(
  attestation:
    | Omit<FrenchInternalExecutionAttestation, "attestationHash">
    | FrenchInternalExecutionAttestation
): string {
  const { attestationHash: _attestationHash, ...content } =
    attestation as FrenchInternalExecutionAttestation;
  void _attestationHash;
  return hashFrenchInternalJson(content);
}

export function finalizeFrenchInternalExecutionAttestation(
  attestation: Omit<FrenchInternalExecutionAttestation, "attestationHash">
): FrenchInternalExecutionAttestation {
  return {
    ...attestation,
    attestationHash: frenchInternalExecutionAttestationHash(attestation)
  };
}

export function frenchInternalSiblingConsistencyProofHash(
  proof:
    | Omit<FrenchInternalSiblingConsistencyProof, "proofHash">
    | FrenchInternalSiblingConsistencyProof
): string {
  const { proofHash: _proofHash, ...content } =
    proof as FrenchInternalSiblingConsistencyProof;
  void _proofHash;
  return hashFrenchInternalJson(content);
}

export function finalizeFrenchInternalSiblingConsistencyProof(
  proof: Omit<FrenchInternalSiblingConsistencyProof, "proofHash">
): FrenchInternalSiblingConsistencyProof {
  return {
    ...proof,
    proofHash: frenchInternalSiblingConsistencyProofHash(proof)
  };
}

/**
 * Recomputes sibling proofs and publication status over the complete packet
 * universe. Remediation must call this after merging a selected subset; proofs
 * produced inside the subset are not globally meaningful.
 */
export function rebuildFrenchInternalSiblingConsistency(input: {
  packets: readonly LexiconV3FrenchPacket[];
  records: readonly FrenchInternalReviewRecord[];
}): FrenchInternalReviewRecord[] {
  const packetsByKey = uniqueMapByEntry(input.packets, "sibling-packet");
  const recordsByKey = uniqueMapByEntry(input.records, "sibling-review");
  if (
    packetsByKey.size !== recordsByKey.size ||
    [...packetsByKey.keys()].some((entryKey) => !recordsByKey.has(entryKey))
  ) {
    throw new Error("french-internal-sibling-global-coverage-mismatch");
  }
  const families = new Map<string, LexiconV3FrenchPacket[]>();
  for (const packet of input.packets) {
    const familyKey = frenchInternalSiblingFamilyKey(packet);
    const members = families.get(familyKey) ?? [];
    members.push(packet);
    families.set(familyKey, members);
  }
  const proofs = new Map<string, FrenchInternalSiblingConsistencyProof>();
  for (const [familyKey, unsortedMembers] of families) {
    const members = [...unsortedMembers].sort((left, right) =>
      left.entryKey.localeCompare(right.entryKey)
    );
    const translations = members.map((packet) => {
      const record = recordsByKey.get(packet.entryKey)!;
      const proposal = record.arbiter?.proposal;
      const selectedRole =
        record.arbiter?.selectedProposal === "proposalA"
          ? "proposerA"
          : "proposerB";
      const selectedArtifactHash =
        record.executionAttestation?.roleReceipts[selectedRole]?.artifactHash;
      if (!proposal || !selectedArtifactHash) {
        throw new Error(
          `french-internal-sibling-selected-proposal-missing:${packet.entryKey}`
        );
      }
      return { packet, proposal, selectedArtifactHash };
    });
    const familyInputDigest = hashFrenchInternalJson(
      translations.map(({ packet, proposal, selectedArtifactHash }) => ({
        entryKey: packet.entryKey,
        eStrong: packet.identity.eStrong,
        dStrong: packet.identity.dStrong,
        englishGloss: packet.english.gloss,
        englishMeaning: packet.english.meaning,
        selectedArtifactHash,
        glossFr: proposal.glossFr,
        meaningFr: proposal.meaningFr
      }))
    );
    const issuesByEntry = new Map(
      members.map((packet) => [packet.entryKey, [] as string[]])
    );
    for (let leftIndex = 0; leftIndex < translations.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < translations.length;
        rightIndex += 1
      ) {
        const left = translations[leftIndex]!;
        const right = translations[rightIndex]!;
        const pair = `${left.packet.entryKey}:${right.packet.entryKey}`;
        if (
          normalizeFrenchSiblingText(left.packet.english.gloss) ===
            normalizeFrenchSiblingText(right.packet.english.gloss) &&
          normalizeFrenchSiblingText(left.proposal.glossFr) !==
            normalizeFrenchSiblingText(right.proposal.glossFr)
        ) {
          issuesByEntry
            .get(left.packet.entryKey)!
            .push(`sibling-gloss-divergence:${pair}`);
          issuesByEntry
            .get(right.packet.entryKey)!
            .push(`sibling-gloss-divergence:${pair}`);
        }
        if (
          normalizeFrenchSiblingText(left.packet.english.meaning) ===
            normalizeFrenchSiblingText(right.packet.english.meaning) &&
          normalizeFrenchSiblingText(left.proposal.meaningFr) !==
            normalizeFrenchSiblingText(right.proposal.meaningFr)
        ) {
          issuesByEntry
            .get(left.packet.entryKey)!
            .push(`sibling-meaning-divergence:${pair}`);
          issuesByEntry
            .get(right.packet.entryKey)!
            .push(`sibling-meaning-divergence:${pair}`);
        }
      }
    }
    const memberEntryKeys = members.map((packet) => packet.entryKey);
    for (const packet of members) {
      const issues = uniqueSorted(issuesByEntry.get(packet.entryKey)!);
      proofs.set(
        packet.entryKey,
        finalizeFrenchInternalSiblingConsistencyProof({
          schemaVersion: FRENCH_INTERNAL_SIBLING_PROOF_SCHEMA_VERSION,
          familyKey,
          entryKey: packet.entryKey,
          memberEntryKeys,
          familyInputDigest,
          verdict: issues.length === 0 ? "consistent" : "divergent",
          issues
        })
      );
    }
  }

  return input.packets.map((packet) => {
    const record = recordsByKey.get(packet.entryKey)!;
    const siblingConsistency = proofs.get(packet.entryKey)!;
    const { artifactHash: _artifactHash, ...recordContent } = record;
    void _artifactHash;
    const provisional = finalizeFrenchInternalReviewRecord({
      ...recordContent,
      status: "review_needed",
      siblingConsistency,
      issues: [...siblingConsistency.issues]
    });
    const evaluation = evaluateFrenchInternalReview({
      record: provisional,
      packet,
      expectedGenerationConfigHash: record.generationConfigHash
    });
    if (!evaluation.structurallyValid) {
      throw new Error(
        `french-internal-sibling-global-review-invalid:${packet.entryKey}:${evaluation.structuralIssues.join(",")}`
      );
    }
    const status: FrenchInternalReviewStatus = evaluation.autoEligible
      ? "auto_validated"
      : packet.english.status === "source_issue"
        ? "blocked_source_issue"
        : "review_needed";
    const { artifactHash: _provisionalHash, ...provisionalContent } =
      provisional;
    void _provisionalHash;
    return finalizeFrenchInternalReviewRecord({
      ...provisionalContent,
      status,
      issues: evaluation.autoEligible
        ? []
        : uniqueSorted([
            ...siblingConsistency.issues,
            ...evaluation.autoEligibilityIssues
          ])
    });
  });
}

function uniqueMapByEntry<T extends { entryKey: string }>(
  values: readonly T[],
  label: string
): Map<string, T> {
  const result = new Map<string, T>();
  for (const value of values) {
    if (result.has(value.entryKey)) {
      throw new Error(`french-internal-${label}-duplicate:${value.entryKey}`);
    }
    result.set(value.entryKey, value);
  }
  return result;
}

function normalizeFrenchSiblingText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("fr")
    .replace(/\s+/gu, " ")
    .trim();
}

export function frenchInternalArbiterResponsePayload(
  arbitration: FrenchInternalArbitration
): Pick<FrenchInternalArbitration, "verdict" | "selectedProposal" | "reasons"> {
  return {
    verdict: arbitration.verdict,
    selectedProposal: arbitration.selectedProposal,
    reasons: arbitration.reasons
  };
}

export function frenchInternalArbiterDependencies(
  proposerA: FrenchInternalAgentProof,
  proposerB: FrenchInternalAgentProof
): Record<string, string> {
  return {
    proposerA: proposerA.responseHash,
    proposerB: proposerB.responseHash
  };
}

export function frenchInternalAuditorDependencies(input: {
  proposerA: FrenchInternalAgentProof;
  proposerB: FrenchInternalAgentProof;
  arbiter: FrenchInternalAgentProof;
  arbitration: FrenchInternalArbitration;
}): Record<string, string> {
  return {
    proposerA: input.proposerA.responseHash,
    proposerB: input.proposerB.responseHash,
    arbiter: input.arbiter.responseHash,
    finalProposal: hashFrenchInternalJson(input.arbitration.proposal),
    finalValidation: hashFrenchInternalJson(input.arbitration.validation)
  };
}

export function verifyFrenchInternalAgentProof<T>(
  input: VerifyFrenchInternalAgentProofInput<T>
): string[] {
  const issues: string[] = [];
  const { proof, request } = input;
  if (proof.schemaVersion !== FRENCH_INTERNAL_AGENT_PROOF_SCHEMA_VERSION) {
    issues.push("invalid-proof-schema");
  }
  if (proof.executor !== "codex-agent") issues.push("invalid-executor");
  if (proof.role !== request.role) issues.push("proof-role-mismatch");
  if (!proof.agentId.trim()) issues.push("missing-agent-id");
  if (!proof.taskName.trim()) issues.push("missing-task-name");
  if (proof.entryKey !== request.entryKey) issues.push("proof-entry-mismatch");
  if (proof.packetHash !== request.packetHash) {
    issues.push("proof-packet-hash-mismatch");
  }
  if (proof.englishHash !== request.englishHash) {
    issues.push("proof-english-hash-mismatch");
  }
  if (proof.generationConfigHash !== request.generationConfigHash) {
    issues.push("proof-generation-config-mismatch");
  }
  if (
    !SHA256_PATTERN.test(proof.inputHash) ||
    proof.inputHash !== request.inputHash
  ) {
    issues.push("proof-input-hash-mismatch");
  }
  if (!Number.isFinite(Date.parse(proof.completedAt))) {
    issues.push("invalid-proof-completed-at");
  }
  if (
    !SHA256_PATTERN.test(proof.requestHash) ||
    proof.requestHash !== frenchInternalAgentRequestHash(request)
  ) {
    issues.push("proof-request-hash-mismatch");
  }
  if (
    !SHA256_PATTERN.test(proof.responseHash) ||
    proof.responseHash !== frenchInternalAgentResponseHash(input.response)
  ) {
    issues.push("proof-response-hash-mismatch");
  }
  if (!SHA256_PATTERN.test(proof.executionReceiptHash)) {
    issues.push("invalid-execution-receipt-hash");
  }
  if (
    !SHA256_PATTERN.test(proof.proofHash) ||
    proof.proofHash !== frenchInternalAgentProofHash(proof)
  ) {
    issues.push("proof-artifact-hash-mismatch");
  }
  return uniqueSorted(issues);
}

export function frenchInternalReviewArtifactHash(
  record:
    | Omit<FrenchInternalReviewRecord, "artifactHash">
    | FrenchInternalReviewRecord
): string {
  const { artifactHash: _artifactHash, ...content } =
    record as FrenchInternalReviewRecord;
  void _artifactHash;
  return hashFrenchInternalJson(content);
}

export function finalizeFrenchInternalReviewRecord(
  record: Omit<FrenchInternalReviewRecord, "artifactHash">
): FrenchInternalReviewRecord {
  return {
    ...record,
    artifactHash: frenchInternalReviewArtifactHash(record)
  };
}

/**
 * Deterministic carrier policy for internal reviews. Agent agreement is never
 * sufficient by itself: auto-safe still requires two independent exact
 * concordance witness families and corpus-unambiguous evidence.
 */
export function buildFrenchInternalCarrierTerms(
  proposalA: FrenchLexiconProposal,
  proposalB: FrenchLexiconProposal,
  finalProposal: FrenchLexiconProposal,
  context: FrenchValidationContext
): FrenchCarrierDecision[] {
  if (
    [proposalA, proposalB, finalProposal].some(
      (proposal) =>
        proposal.entryKey !== context.entryKey ||
        proposal.derivedFromEnglishHash !== context.englishHash
    )
  ) {
    return [];
  }

  const leftTerms = normalizedTermMap(proposalA.carrierTermsFr);
  const rightTerms = normalizedTermMap(proposalB.carrierTermsFr);
  const finalTerms = normalizedTermMap(finalProposal.carrierTermsFr);
  const decisions: FrenchCarrierDecision[] = [];
  for (const [normalized, surface] of leftTerms) {
    if (!rightTerms.has(normalized) || !finalTerms.has(normalized)) continue;
    const evidence = context.concordanceForms.filter(
      (form) => form.normalized === normalized
    );
    const witnessFamilies = uniqueSorted(
      evidence.flatMap((form) => form.witnessFamilies)
    );
    const sources = uniqueSorted(evidence.flatMap((form) => form.sources));
    const englishReady = ["validated", "human_validated"].includes(
      context.englishStatus
    );
    const generic = isGenericFrenchCarrier(normalized);
    if (!englishReady || generic || evidence.length === 0) {
      decisions.push({
        surface,
        normalized,
        state: "blocked",
        policy: "blocked",
        confidence: Math.min(
          proposalA.confidence,
          proposalB.confidence,
          finalProposal.confidence,
          0.5
        ),
        witnessFamilies,
        sources,
        reason: !englishReady
          ? "english-not-validated"
          : generic
            ? "generic-french-carrier"
            : "no-exact-french-witness"
      });
      continue;
    }

    const independent = witnessFamilies.length >= 2;
    const globallyUnambiguous = evidence.every(
      (form) => form.strongCount === 1
    );
    const autoSafe = independent && globallyUnambiguous;
    decisions.push({
      surface,
      normalized,
      state: autoSafe ? "auto_validated" : "candidate",
      policy: autoSafe ? "auto_safe" : "review_only",
      confidence: Math.min(
        proposalA.confidence,
        proposalB.confidence,
        finalProposal.confidence,
        autoSafe ? 0.92 : 0.74
      ),
      witnessFamilies,
      sources,
      reason: autoSafe
        ? "two-agent-agreement-final-selection-and-two-witness-families"
        : independent && !globallyUnambiguous
          ? `ambiguous-across-${Math.max(...evidence.map((form) => form.strongCount))}-strongs`
          : "internal-consensus-with-single-witness-family"
    });
  }
  return decisions.sort((left, right) =>
    left.normalized.localeCompare(right.normalized)
  );
}

export function frenchLexiconHtmlSkeleton(value: string): string[] {
  return frenchRenderedHtmlSkeleton(value);
}

export function evaluateFrenchInternalReview(
  input: EvaluateFrenchInternalReviewInput
): FrenchInternalReviewEvaluation {
  const { packet, record } = input;
  const structuralIssues: string[] = [];
  const autoEligibilityIssues: string[] = [];

  if (record.schemaVersion !== FRENCH_INTERNAL_REVIEW_SCHEMA_VERSION) {
    structuralIssues.push("invalid-review-schema");
  }
  if (record.reviewMode !== "internal_agents") {
    structuralIssues.push("invalid-review-mode");
  }
  if (record.policyVersion !== FRENCH_INTERNAL_REVIEW_POLICY_VERSION) {
    structuralIssues.push("invalid-review-policy");
  }
  if (!FRENCH_INTERNAL_REVIEW_STATUSES.includes(record.status)) {
    structuralIssues.push("invalid-review-status");
  }
  if (!Number.isFinite(Date.parse(record.generatedAt))) {
    structuralIssues.push("invalid-review-generated-at");
  }

  const packetIssues = safePacketIssues(packet);
  structuralIssues.push(...packetIssues.map((issue) => `packet:${issue}`));
  if (record.entryKey !== packet.entryKey) {
    structuralIssues.push("review-entry-mismatch");
  }
  if (record.packetHash !== packet.packetHash) {
    structuralIssues.push("review-packet-hash-mismatch");
  }
  if (record.englishHash !== packet.english.contentHash) {
    structuralIssues.push("review-english-hash-mismatch");
  }

  const configurationIssues = validateConfiguration(record.configuration);
  structuralIssues.push(...configurationIssues);
  if (
    configurationIssues.length === 0 &&
    record.generationConfigHash !==
      frenchInternalGenerationConfigHash(record.configuration)
  ) {
    structuralIssues.push("generation-config-hash-mismatch");
  }
  if (
    input.expectedGenerationConfigHash !== undefined &&
    record.generationConfigHash !== input.expectedGenerationConfigHash
  ) {
    structuralIssues.push("unexpected-generation-config-hash");
  }
  if (!SHA256_PATTERN.test(record.generationConfigHash)) {
    structuralIssues.push("invalid-generation-config-hash");
  }
  if (
    !SHA256_PATTERN.test(record.artifactHash) ||
    record.artifactHash !== frenchInternalReviewArtifactHash(record)
  ) {
    structuralIssues.push("review-artifact-hash-mismatch");
  }

  const context = frenchValidationContext(
    packet,
    input.requiredEntityMentions ?? []
  );
  const validationA = record.proposalA
    ? validateFrenchProposal(record.proposalA, context)
    : null;
  const validationB = record.proposalB
    ? validateFrenchProposal(record.proposalB, context)
    : null;
  const finalValidation = record.arbiter?.proposal
    ? validateFrenchProposal(record.arbiter.proposal, context)
    : null;

  assertStoredValidation(
    "proposal-a",
    record.validationA,
    validationA,
    structuralIssues
  );
  assertStoredValidation(
    "proposal-b",
    record.validationB,
    validationB,
    structuralIssues
  );
  assertStoredValidation(
    "final",
    record.arbiter?.validation,
    finalValidation,
    structuralIssues
  );

  const selectedProposal =
    record.arbiter?.selectedProposal === "proposalA"
      ? record.proposalA
      : record.arbiter?.selectedProposal === "proposalB"
        ? record.proposalB
        : undefined;
  if (record.arbiter && !selectedProposal) {
    structuralIssues.push("arbiter-selected-missing-proposal");
  } else if (
    record.arbiter &&
    selectedProposal &&
    !canonicalEquals(record.arbiter.proposal, selectedProposal)
  ) {
    structuralIssues.push("arbiter-invented-third-proposal");
  }

  const carrierTerms =
    record.proposalA && record.proposalB && record.arbiter?.proposal
      ? buildFrenchInternalCarrierTerms(
          record.proposalA,
          record.proposalB,
          record.arbiter.proposal,
          context
        )
      : [];
  if (!canonicalEquals(record.carrierTerms, carrierTerms)) {
    structuralIssues.push("internal-carrier-terms-mismatch");
  }

  validateAgentProofDag(record, structuralIssues);
  validateExecutionAttestation(record, packet, structuralIssues);
  validateSiblingConsistencyProof(record, packet, structuralIssues);
  validateAuditShape(record.auditor, structuralIssues);

  if (!["validated", "human_validated"].includes(packet.english.status)) {
    autoEligibilityIssues.push("english-not-validated");
  }
  if (!record.proposalA || !record.proposalB) {
    autoEligibilityIssues.push("missing-proposer-artifact");
  }
  if (!record.arbiter) autoEligibilityIssues.push("missing-arbiter-artifact");
  if (!record.auditor) autoEligibilityIssues.push("missing-auditor-artifact");
  if (!hasCompleteAgentProofs(record.agentProofs)) {
    autoEligibilityIssues.push("missing-agent-proof");
  }
  if (!record.executionAttestation) {
    autoEligibilityIssues.push("missing-execution-attestation");
  }
  if (record.siblingConsistency?.verdict !== "consistent") {
    autoEligibilityIssues.push("sibling-step-divergence");
  }
  for (const [label, validation] of [
    ["proposal-a", validationA],
    ["proposal-b", validationB],
    ["final", finalValidation]
  ] as const) {
    if (
      !validation ||
      !validation.canPublishDisplay ||
      validation.requiresHumanReview ||
      validation.issues.length > 0
    ) {
      autoEligibilityIssues.push(`${label}-validator-not-clean`);
    }
  }
  if (record.arbiter?.verdict !== "accept") {
    autoEligibilityIssues.push("arbiter-not-accepted");
  }
  if ((record.arbiter?.reasons.length ?? 0) > 0) {
    autoEligibilityIssues.push("arbiter-has-reservations");
  }
  if ((record.arbiter?.proposal.confidence ?? 0) < 0.9) {
    autoEligibilityIssues.push("final-confidence-below-threshold");
  }
  if (record.auditor?.verdict !== "safe") {
    autoEligibilityIssues.push("auditor-not-safe");
  }
  if ((record.auditor?.reasons.length ?? 0) > 0) {
    autoEligibilityIssues.push("auditor-has-reservations");
  }
  if ((record.auditor?.confidence ?? 0) < 0.9) {
    autoEligibilityIssues.push("auditor-confidence-below-threshold");
  }
  if (
    !record.auditor ||
    FRENCH_INTERNAL_AUDIT_CHECKS.some(
      (check) => record.auditor?.checks[check] !== "pass"
    )
  ) {
    autoEligibilityIssues.push("auditor-check-not-passed");
  }
  if (record.issues.length > 0) {
    autoEligibilityIssues.push("review-has-issues");
  }
  if (
    record.arbiter?.proposal &&
    !sourceAndRenderedHtmlSkeletonsMatch(
      packet.english.meaningHtml,
      record.arbiter.proposal.meaningHtmlFr
    )
  ) {
    autoEligibilityIssues.push("html-skeleton-mismatch");
  }
  if (
    record.arbiter?.proposal &&
    packet.protectedContent.originalTokens.some(
      (token) =>
        !`${record.arbiter?.proposal.meaningFr ?? ""} ${record.arbiter?.proposal.meaningHtmlFr ?? ""}`.includes(
          token
        )
    )
  ) {
    autoEligibilityIssues.push("missing-protected-original-token");
  }

  const structural = uniqueSorted(structuralIssues);
  const automatic = uniqueSorted(autoEligibilityIssues);
  const autoEligible = structural.length === 0 && automatic.length === 0;
  if (record.status === "auto_validated" && !autoEligible) {
    structural.push("unsafe-auto-validated-status");
  }

  return {
    structurallyValid: structural.length === 0,
    autoEligible: structural.length === 0 && automatic.length === 0,
    structuralIssues: uniqueSorted(structural),
    autoEligibilityIssues: automatic,
    validationA,
    validationB,
    finalValidation,
    carrierTerms
  };
}

function sourceAndRenderedHtmlSkeletonsMatch(
  sourceHtml: string,
  renderedHtml: string
): boolean {
  try {
    return canonicalEquals(
      frenchSourceHtmlSkeleton(sourceHtml),
      frenchLexiconHtmlSkeleton(renderedHtml)
    );
  } catch {
    return false;
  }
}

/** Throws only for structurally invalid/tampered records, including unsafe auto status. */
export function assertFrenchInternalReviewRecord(
  input: EvaluateFrenchInternalReviewInput
): FrenchInternalReviewEvaluation {
  const evaluation = evaluateFrenchInternalReview(input);
  if (!evaluation.structurallyValid) {
    throw new Error(
      `invalid-french-internal-review:${input.record.entryKey}:${evaluation.structuralIssues.join(",")}`
    );
  }
  return evaluation;
}

function frenchValidationContext(
  packet: LexiconV3FrenchPacket,
  requiredEntityMentions: readonly RequiredFrenchEntityMention[] = []
): FrenchValidationContext {
  return {
    entryKey: packet.entryKey,
    englishHash: packet.english.contentHash,
    englishStatus: packet.english.status,
    englishGloss: packet.english.gloss,
    englishMeaning: packet.english.meaning,
    original: packet.identity.original,
    morph: packet.identity.morph,
    sourceStrongCodes: packet.protectedContent.strongCodes,
    sourceReferences: packet.protectedContent.references,
    legacyGloss: packet.evidence.legacy?.gloss,
    legacyMeaning: packet.evidence.legacy?.meaning,
    concordanceForms: packet.evidence.concordanceForms,
    requiredEntityMentions: [...requiredEntityMentions]
  };
}

function validateAgentProofDag(
  record: FrenchInternalReviewRecord,
  issues: string[]
): void {
  const proofs = record.agentProofs;
  if (!proofs) return;
  const proofA = proofs.proposerA;
  const proofB = proofs.proposerB;
  const proofArbiter = proofs.arbiter;
  const proofAuditor = proofs.auditor;

  const common = {
    entryKey: record.entryKey,
    packetHash: record.packetHash,
    englishHash: record.englishHash,
    generationConfigHash: record.generationConfigHash
  };
  if (proofA && record.proposalA) {
    appendProofIssues(
      "proposerA",
      verifyFrenchInternalAgentProof({
        proof: proofA,
        request: {
          role: "proposerA",
          ...common,
          inputHash: proofA.inputHash
        },
        response: record.proposalA
      }),
      issues
    );
  } else if (proofA || record.proposalA) {
    issues.push("proposerA-proof-payload-pair-mismatch");
  }
  if (proofB && record.proposalB) {
    appendProofIssues(
      "proposerB",
      verifyFrenchInternalAgentProof({
        proof: proofB,
        request: {
          role: "proposerB",
          ...common,
          inputHash: proofB.inputHash
        },
        response: record.proposalB
      }),
      issues
    );
  } else if (proofB || record.proposalB) {
    issues.push("proposerB-proof-payload-pair-mismatch");
  }
  if (proofArbiter && record.arbiter && proofA && proofB) {
    appendProofIssues(
      "arbiter",
      verifyFrenchInternalAgentProof({
        proof: proofArbiter,
        request: {
          role: "arbiter",
          ...common,
          inputHash: proofArbiter.inputHash,
          dependencies: frenchInternalArbiterDependencies(proofA, proofB)
        },
        response: frenchInternalArbiterResponsePayload(record.arbiter)
      }),
      issues
    );
  } else if (proofArbiter || record.arbiter) {
    issues.push("arbiter-proof-payload-dependency-mismatch");
  }
  if (
    proofAuditor &&
    record.auditor &&
    proofA &&
    proofB &&
    proofArbiter &&
    record.arbiter
  ) {
    appendProofIssues(
      "auditor",
      verifyFrenchInternalAgentProof({
        proof: proofAuditor,
        request: {
          role: "auditor",
          ...common,
          inputHash: proofAuditor.inputHash,
          dependencies: frenchInternalAuditorDependencies({
            proposerA: proofA,
            proposerB: proofB,
            arbiter: proofArbiter,
            arbitration: record.arbiter
          })
        },
        response: record.auditor
      }),
      issues
    );
  } else if (proofAuditor || record.auditor) {
    issues.push("auditor-proof-payload-dependency-mismatch");
  }

  if (hasCompleteAgentProofs(proofs)) {
    const inputHashes = FRENCH_INTERNAL_ROLES.map(
      (role) => proofs[role]!.inputHash
    );
    if (new Set(inputHashes).size !== FRENCH_INTERNAL_ROLES.length) {
      issues.push("agent-input-views-not-distinct");
    }
    const agentIds = FRENCH_INTERNAL_ROLES.map((role) =>
      proofs[role]!.agentId.trim()
    );
    const taskNames = FRENCH_INTERNAL_ROLES.map((role) =>
      proofs[role]!.taskName.trim()
    );
    if (new Set(agentIds).size !== FRENCH_INTERNAL_ROLES.length) {
      issues.push("agent-identities-not-distinct");
    }
    if (new Set(taskNames).size !== FRENCH_INTERNAL_ROLES.length) {
      issues.push("agent-tasks-not-distinct");
    }
  }
}

function appendProofIssues(
  role: FrenchInternalRole,
  proofIssues: string[],
  issues: string[]
): void {
  issues.push(...proofIssues.map((issue) => `${role}:${issue}`));
}

function validateExecutionAttestation(
  record: FrenchInternalReviewRecord,
  packet: LexiconV3FrenchPacket,
  issues: string[]
): void {
  const attestation = record.executionAttestation;
  if (!attestation) {
    issues.push("missing-execution-attestation");
    return;
  }
  if (
    attestation.schemaVersion !==
      FRENCH_INTERNAL_EXECUTION_ATTESTATION_SCHEMA_VERSION ||
    !SHA256_PATTERN.test(attestation.attestationHash) ||
    attestation.attestationHash !==
      frenchInternalExecutionAttestationHash(attestation)
  ) {
    issues.push("invalid-execution-attestation-hash");
  }
  if (
    attestation.releaseKey !== packet.englishRelease.releaseKey ||
    attestation.releaseSnapshotFingerprint !==
      packet.englishRelease.releaseSnapshotFingerprint
  ) {
    issues.push("execution-attestation-release-lineage-mismatch");
  }
  if (
    !/^\/fr-internal\/(?:pilot|full|custom\/[a-z0-9][a-z0-9._-]*)$/u.test(
      attestation.namespace
    )
  ) {
    issues.push("invalid-execution-attestation-namespace");
  }
  for (const hash of [
    attestation.selectionHash,
    attestation.keyOrderHash,
    attestation.proposerManifestHash,
    attestation.proposerSummaryHash,
    attestation.arbiterManifestHash,
    attestation.arbiterSummaryHash,
    attestation.auditorManifestHash,
    attestation.auditorSummaryHash,
    attestation.executionReceiptsDigest,
    attestation.adjudicationSummaryHash
  ]) {
    if (!SHA256_PATTERN.test(hash)) {
      issues.push("invalid-execution-attestation-source-hash");
      break;
    }
  }
  const proofs = record.agentProofs;
  const receipts = attestation.roleReceipts;
  if (!receipts || typeof receipts !== "object") {
    issues.push("missing-execution-role-receipts");
    return;
  }
  const threadIds: string[] = [];
  const agentIds: string[] = [];
  const taskNames: string[] = [];
  for (const role of FRENCH_INTERNAL_ROLES) {
    const receipt = receipts[role];
    const proof = proofs?.[role];
    if (!receipt) {
      issues.push(`missing-execution-receipt:${role}`);
      continue;
    }
    try {
      assertFrenchCodexExecutionReceipt(receipt, { expectedRole: role });
    } catch {
      issues.push(`invalid-execution-receipt-shape:${role}`);
    }
    if (
      receipt.schemaVersion !==
        FRENCH_INTERNAL_EXECUTION_RECEIPT_SCHEMA_VERSION ||
      receipt.role !== role ||
      receipt.entryKey !== record.entryKey ||
      receipt.namespace !== attestation.namespace ||
      receipt.selectionHash !== attestation.selectionHash ||
      receipt.manifestHash !==
        (role === "proposerA" || role === "proposerB"
          ? attestation.proposerManifestHash
          : role === "arbiter"
            ? attestation.arbiterManifestHash
            : attestation.auditorManifestHash) ||
      !SHA256_PATTERN.test(receipt.receiptHash) ||
      receipt.receiptHash !== frenchInternalExecutionReceiptHash(receipt)
    ) {
      issues.push(`invalid-execution-receipt:${role}`);
    }
    const expectedProfile = FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE[role];
    if (
      receipt.model !== expectedProfile.model ||
      receipt.reasoningEffort !== expectedProfile.reasoningEffort ||
      receipt.executorPolicyVersion !==
        FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.executorPolicyVersion
    ) {
      issues.push(`execution-profile-mismatch:${role}`);
    }
    if (
      receipt.executor.version !== FRENCH_INTERNAL_PINNED_CODEX_VERSION ||
      receipt.executor.sha256 !== FRENCH_INTERNAL_PINNED_CODEX_SHA256 ||
      !receipt.executor.path.trim()
    ) {
      issues.push(`execution-binary-identity-mismatch:${role}`);
    }
    if (
      receipt.capabilities.localTools !== "disabled" ||
      receipt.capabilities.networkDataTools !== "disabled" ||
      receipt.capabilities.shell !== "disabled" ||
      receipt.capabilities.eventPolicy !== "agent-message-only" ||
      !receipt.capabilities.sealedWorkingDirectory.trim() ||
      !SHA256_PATTERN.test(receipt.capabilities.disabledFeaturesHash) ||
      !SHA256_PATTERN.test(receipt.capabilities.environmentPolicyHash)
    ) {
      issues.push(`execution-capability-policy-mismatch:${role}`);
    }
    if (
      !THREAD_ID_PATTERN.test(receipt.threadId) ||
      receipt.agentId !== `codex-agent:${receipt.threadId}` ||
      !receipt.batchId.trim() ||
      !receipt.taskName.trim() ||
      !SHA256_PATTERN.test(receipt.inputHash) ||
      !SHA256_PATTERN.test(receipt.artifactHash) ||
      !SHA256_PATTERN.test(receipt.runHash) ||
      !allSha256Values(receipt.sourceHashes) ||
      !allSha256Values(receipt.resultHashes) ||
      !Number.isFinite(Date.parse(receipt.startedAt)) ||
      !Number.isFinite(Date.parse(receipt.completedAt)) ||
      Date.parse(receipt.startedAt) > Date.parse(receipt.completedAt)
    ) {
      issues.push(`invalid-execution-receipt-content:${role}`);
    }
    if (
      !proof ||
      proof.executionReceiptHash !== receipt.receiptHash ||
      proof.inputHash !== receipt.inputHash ||
      proof.agentId !== receipt.agentId ||
      proof.taskName !== receipt.taskName ||
      proof.completedAt !== receipt.completedAt
    ) {
      issues.push(`execution-receipt-proof-mismatch:${role}`);
    }
    threadIds.push(receipt.threadId);
    agentIds.push(receipt.agentId);
    taskNames.push(receipt.taskName);
  }
  if (new Set(threadIds).size !== FRENCH_INTERNAL_ROLES.length) {
    issues.push("execution-threads-not-distinct");
  }
  if (new Set(agentIds).size !== FRENCH_INTERNAL_ROLES.length) {
    issues.push("execution-agents-not-distinct");
  }
  if (new Set(taskNames).size !== FRENCH_INTERNAL_ROLES.length) {
    issues.push("execution-tasks-not-distinct");
  }
}

function validateSiblingConsistencyProof(
  record: FrenchInternalReviewRecord,
  packet: LexiconV3FrenchPacket,
  issues: string[]
): void {
  const proof = record.siblingConsistency;
  if (!proof) {
    issues.push("missing-sibling-consistency-proof");
    return;
  }
  if (
    proof.schemaVersion !== FRENCH_INTERNAL_SIBLING_PROOF_SCHEMA_VERSION ||
    proof.entryKey !== record.entryKey ||
    proof.familyKey !== frenchInternalSiblingFamilyKey(packet) ||
    !proof.memberEntryKeys.includes(record.entryKey) ||
    new Set(proof.memberEntryKeys).size !== proof.memberEntryKeys.length ||
    !SHA256_PATTERN.test(proof.familyInputDigest) ||
    !SHA256_PATTERN.test(proof.proofHash) ||
    proof.proofHash !== frenchInternalSiblingConsistencyProofHash(proof) ||
    (proof.verdict === "consistent" && proof.issues.length > 0) ||
    (proof.verdict === "divergent" && proof.issues.length === 0)
  ) {
    issues.push("invalid-sibling-consistency-proof");
  }
}

function allSha256Values(value: Record<string, string>): boolean {
  const entries = Object.entries(value);
  return (
    entries.length > 0 &&
    entries.every(
      ([key, hash]) => key.trim().length > 0 && SHA256_PATTERN.test(hash)
    )
  );
}

function validateConfiguration(
  configuration: FrenchInternalReviewConfiguration | undefined
): string[] {
  if (!configuration) return ["missing-review-configuration"];
  const issues: string[] = [];
  const expectedKeys = [
    "promptVersion",
    "proposerAPromptHash",
    "proposerBPromptHash",
    "arbiterPromptHash",
    "auditorPromptHash",
    "styleGuideHash",
    "termbaseHash",
    "canonicalNamesHash",
    "entityMergeAttestationHash",
    "canonicalEntitiesHash",
    "canonicalEntryPoliciesHash",
    "entityGateHash",
    "entityMentionsHash",
    "htmlRendererVersion",
    "approvedExecutionProfile"
  ].sort();
  const actualKeys = Object.keys(configuration).sort();
  if (!canonicalEquals(actualKeys, expectedKeys)) {
    issues.push("invalid-review-configuration-keys");
  }
  if (configuration.promptVersion !== FRENCH_INTERNAL_PROMPT_VERSION) {
    issues.push("invalid-internal-prompt-version");
  }
  for (const [name, value] of Object.entries(configuration)) {
    if (
      name === "promptVersion" ||
      name === "htmlRendererVersion" ||
      name === "approvedExecutionProfile"
    ) {
      continue;
    }
    if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
      issues.push(`invalid-config-hash:${name}`);
    }
  }
  if (
    typeof configuration.htmlRendererVersion !== "string" ||
    !configuration.htmlRendererVersion.trim()
  ) {
    issues.push("missing-html-renderer-version");
  }
  if (
    !canonicalEquals(
      configuration.approvedExecutionProfile,
      FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE
    )
  ) {
    issues.push("unapproved-execution-profile");
  }
  return issues;
}

function validateAuditShape(
  audit: FrenchInternalAudit | undefined,
  issues: string[]
): void {
  if (!audit) return;
  if (
    !Number.isFinite(audit.confidence) ||
    audit.confidence < 0 ||
    audit.confidence > 1
  ) {
    issues.push("invalid-auditor-confidence");
  }
  const actualChecks = Object.keys(audit.checks).sort();
  const expectedChecks = [...FRENCH_INTERNAL_AUDIT_CHECKS].sort();
  if (!canonicalEquals(actualChecks, expectedChecks)) {
    issues.push("invalid-auditor-check-set");
  }
  for (const check of FRENCH_INTERNAL_AUDIT_CHECKS) {
    if (!["pass", "fail"].includes(audit.checks[check])) {
      issues.push(`invalid-auditor-check:${check}`);
    }
  }
}

function assertStoredValidation(
  label: string,
  stored: FrenchValidationResult | undefined,
  recomputed: FrenchValidationResult | null,
  issues: string[]
): void {
  if (Boolean(stored) !== Boolean(recomputed)) {
    issues.push(`${label}-validation-pair-mismatch`);
    return;
  }
  if (stored && recomputed && !canonicalEquals(stored, recomputed)) {
    issues.push(`${label}-validation-mismatch`);
  }
}

function safePacketIssues(packet: LexiconV3FrenchPacket): string[] {
  try {
    return validateFrenchPacket(packet);
  } catch {
    return ["invalid-packet-structure"];
  }
}

function hasCompleteAgentProofs(
  proofs:
    | Partial<Record<FrenchInternalRole, FrenchInternalAgentProof>>
    | undefined
): proofs is Record<FrenchInternalRole, FrenchInternalAgentProof> {
  return Boolean(proofs && FRENCH_INTERNAL_ROLES.every((role) => proofs[role]));
}

function normalizedTermMap(values: string[]): Map<string, string> {
  const terms = new Map<string, string>();
  for (const value of values) {
    const normalized = normalizeFrenchCarrierTerm(value);
    if (normalized && !terms.has(normalized))
      terms.set(normalized, value.trim());
  }
  return terms;
}

function canonicalEquals(left: unknown, right: unknown): boolean {
  return (
    canonicalFrenchInternalJson(left) === canonicalFrenchInternalJson(right)
  );
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
