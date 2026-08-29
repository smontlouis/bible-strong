import {
  FRENCH_ENTITY_AGENT_ARBITRATION_SCHEMA_VERSION,
  FRENCH_ENTITY_AGENT_AUDIT_SCHEMA_VERSION,
  FRENCH_ENTITY_AGENT_POLICY_VERSION,
  FRENCH_ENTITY_AGENT_PROPOSAL_SCHEMA_VERSION,
  FRENCH_ENTITY_AGENT_VIEW_SCHEMA_VERSION,
  frenchEntityAgentEvidenceConflictCodes,
  frenchEntityAgentUnboundAlternateNameEntryKeys,
  frenchEntityAgentUnboundNameEntryKeys,
  type FrenchEntityAgentAudit,
  type FrenchEntityAgentAuditChecks,
  type FrenchEntityAgentProposerAView,
  type FrenchEntityAgentProposerBView,
  type FrenchEntityAgentProposal,
  type FrenchEntityAgentUnitArtifacts,
  type FrenchEntityAgentView
} from "./frenchEntityAgentReview.js";
import {
  canonicalFrenchEntityPolicyForms,
  canonicalFrenchEntityJson,
  frenchEntityCanonicalSecondaryRelation,
  frenchEntityDirectNamedMatchEntityIds,
  frenchEntityPolicyContractForTreatment,
  hashFrenchEntityJson,
  isFrenchEntityBindingRelation,
  isFrenchEntityNameConstraint,
  isFrenchEntityNameTreatment
} from "./frenchEntityCanonicalization.js";
import { normalizeFrenchEvidence } from "./frenchEditorialPolicy.js";

export const FRENCH_ENTITY_REMEDIATION_POLICY_VERSION =
  "lexicon-v3-french-entity-remediation-policy@4" as const;
export const FRENCH_ENTITY_REMEDIATION_ROUND_PLAN_SCHEMA_VERSION =
  "lexicon-v3-french-entity-remediation-round-plan@4" as const;
export const FRENCH_ENTITY_REMEDIATION_ROUND_SCHEMA_VERSION =
  "lexicon-v3-french-entity-remediation-round@1" as const;
export const FRENCH_ENTITY_REMEDIATION_OVERLAY_SCHEMA_VERSION =
  "lexicon-v3-french-entity-remediation-overlay@1" as const;
export const FRENCH_ENTITY_REMEDIATION_MAX_ROUNDS = 3 as const;

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const AUDIT_CHECK_CODES = [
  "exactStepIdentity",
  "exactEnglishLineage",
  "canonicalPrimaryCoherence",
  "singularEditorialLemma",
  "explicitMemberRelations",
  "noCommonGlossForcedAsName",
  "frenchNaturalness",
  "historicalWitnessNotSoleAuthority"
] as const satisfies readonly (keyof FrenchEntityAgentAuditChecks)[];

export type FrenchEntityRemediationFailedCheckCode =
  (typeof AUDIT_CHECK_CODES)[number];

export interface FrenchEntityRemediationBaseViews {
  proposerA: FrenchEntityAgentProposerAView;
  proposerB: FrenchEntityAgentProposerBView;
}

/**
 * This is deliberately the whole A feedback contract. Runtime metadata and the
 * rebuilt blind view live outside it. In particular, this object cannot carry
 * an earlier proposal, a French form, an audit reason, or witness material.
 */
export interface FrenchEntityRemediationContextA {
  unitId: string;
  failedCheckCodes: FrenchEntityRemediationFailedCheckCode[];
  parentHashes: FrenchEntityRemediationParentHashes;
}

export interface FrenchEntityRemediationParentHashes {
  baseViewHash: string;
  previousQuartetHash: string;
  previousAuditHash: string;
  previousSemanticProposalHash: string;
  rejectedSemanticProposalHashes: string[];
  previousRoundHash: string | null;
}

/** B is the controlled, non-blind lane and therefore receives the full case. */
export interface FrenchEntityRemediationContextB {
  unitId: string;
  failedCheckCodes: FrenchEntityRemediationFailedCheckCode[];
  parentHashes: FrenchEntityRemediationParentHashes;
  previousQuartet: FrenchEntityAgentUnitArtifacts;
}

export interface FrenchEntityRemediationProposerAInput {
  role: "proposerA";
  round: number;
  view: FrenchEntityAgentProposerAView;
  context: FrenchEntityRemediationContextA;
  inputHash: string;
}

export interface FrenchEntityRemediationProposerBInput {
  role: "proposerB";
  round: number;
  view: FrenchEntityAgentProposerBView;
  context: FrenchEntityRemediationContextB;
  inputHash: string;
}

export interface FrenchEntityRemediationRoundPlanUnit {
  unitId: string;
  previousVerdict: "hold" | "block";
  previousQuartetHash: string;
  previousSemanticProposalHash: string;
  concordanceResolutionProofs: FrenchEntityRemediationConcordanceResolutionProof[];
  proposerA: FrenchEntityRemediationProposerAInput;
  proposerB: FrenchEntityRemediationProposerBInput;
  unitHash: string;
}

export const FRENCH_ENTITY_REMEDIATION_CONCORDANCE_PROOF_SCHEMA_VERSION =
  "lexicon-v3-french-entity-remediation-concordance-proof@2" as const;

export type FrenchEntityRemediationConcordanceProofClass =
  | "exact-controlled-concordance-spelling"
  | "exact-component-composition"
  | "exact-plural-s-to-singular"
  | "exact-autonomous-lxx-name-preservation";

export interface FrenchEntityRemediationConcordanceProofWitness {
  surface: string;
  normalized: string;
  count: number;
  strongCount: number;
  sources: string[];
  witnessFamilies: string[];
}

export interface FrenchEntityRemediationConcordanceResolutionProof {
  schemaVersion: typeof FRENCH_ENTITY_REMEDIATION_CONCORDANCE_PROOF_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_ENTITY_REMEDIATION_POLICY_VERSION;
  proofClass: FrenchEntityRemediationConcordanceProofClass;
  unitId: string;
  entryKey: string;
  conflictCode: string;
  sourceViewHash: string;
  selectedProposalHash: string;
  selectedFrench: string;
  selectedNormalized: string;
  witnesses: FrenchEntityRemediationConcordanceProofWitness[];
  proofHash: string;
}

export interface FrenchEntityRemediationRoundPlan {
  schemaVersion: typeof FRENCH_ENTITY_REMEDIATION_ROUND_PLAN_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_ENTITY_REMEDIATION_POLICY_VERSION;
  round: number;
  parentRoundHash: string | null;
  unitIds: string[];
  units: FrenchEntityRemediationRoundPlanUnit[];
  planHash: string;
}

export interface FrenchEntityRemediationRoundUnitResult {
  unitId: string;
  planUnitHash: string;
  quartet: FrenchEntityAgentUnitArtifacts;
  semanticProposalHash: string;
  resultHash: string;
}

export interface FrenchEntityRemediationRoundResult {
  schemaVersion: typeof FRENCH_ENTITY_REMEDIATION_ROUND_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_ENTITY_REMEDIATION_POLICY_VERSION;
  round: number;
  planHash: string;
  parentRoundHash: string | null;
  unitResults: FrenchEntityRemediationRoundUnitResult[];
  residualUnitIds: string[];
  roundHash: string;
}

export interface FrenchEntityRemediationRoundBundle {
  plan: FrenchEntityRemediationRoundPlan;
  result: FrenchEntityRemediationRoundResult;
}

export interface FrenchEntityRemediationOverlay {
  schemaVersion: typeof FRENCH_ENTITY_REMEDIATION_OVERLAY_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_ENTITY_REMEDIATION_POLICY_VERSION;
  artifacts: Map<string, FrenchEntityAgentUnitArtifacts>;
  remediatedUnitIds: string[];
  safeUnitIds: string[];
  quarantinedUnitIds: string[];
  terminalRoundByUnit: Map<string, number>;
  roundHashes: string[];
  overlayHash: string;
}

export interface BuildFrenchEntityRemediationRoundPlanInput {
  round: number;
  baseViews: ReadonlyMap<string, FrenchEntityRemediationBaseViews>;
  currentArtifacts: ReadonlyMap<string, FrenchEntityAgentUnitArtifacts>;
  previousRound?: FrenchEntityRemediationRoundBundle;
}

export interface FinalizeFrenchEntityRemediationRoundInput {
  plan: FrenchEntityRemediationRoundPlan;
  artifacts: ReadonlyMap<string, FrenchEntityAgentUnitArtifacts>;
}

export interface BuildFrenchEntityRemediationOverlayInput {
  baseArtifacts: ReadonlyMap<string, FrenchEntityAgentUnitArtifacts>;
  baseViews: ReadonlyMap<string, FrenchEntityRemediationBaseViews>;
  rounds: readonly FrenchEntityRemediationRoundBundle[];
}

/**
 * Hashes only the editorial meaning of a proposal. Execution bindings,
 * explanations, and evidence provenance intentionally cannot manufacture a
 * semantic change.
 */
export function semanticFrenchEntityProposalHash(
  proposal: FrenchEntityAgentProposal
): string {
  assertProposalShape(proposal);
  const canonicalEntities = proposal.canonicalEntities
    .map((entity) => ({
      entityId: entity.entityId,
      primaryFr: entity.primaryFr
    }))
    .sort((left, right) => left.entityId - right.entityId);
  const memberPolicies = proposal.memberPolicies
    .map((policy) => ({
      entryKey: policy.entryKey,
      treatment: policy.treatment,
      entityBindings: [...policy.entityBindings]
        .map((binding) => ({
          entityId: binding.entityId,
          relation: binding.relation
        }))
        .sort(
          (left, right) =>
            left.entityId - right.entityId ||
            compareText(left.relation, right.relation)
        ),
      constraint: policy.constraint,
      primaryFr: policy.primaryFr,
      derivedFr: policy.derivedFr,
      allowedFrenchForms: uniqueSorted(policy.allowedFrenchForms)
    }))
    .sort((left, right) => compareText(left.entryKey, right.entryKey));
  return hashFrenchEntityJson({ canonicalEntities, memberPolicies });
}

export function frenchEntityAgentQuartetHash(
  quartet: FrenchEntityAgentUnitArtifacts
): string {
  assertFrenchEntityAgentQuartet(quartet);
  return hashFrenchEntityJson({
    proposalAHash: quartet.proposalA.proposalHash,
    proposalBHash: quartet.proposalB.proposalHash,
    arbitrationHash: quartet.arbitration.arbitrationHash,
    auditHash: quartet.audit.auditHash
  });
}

/**
 * Builds the narrowly bounded deterministic concordance proofs available to
 * remediation. Exact controlled concordance is orthographic evidence only:
 * it is emitted only after the sealed English/entity view already proves the
 * attachment independently. The proof is deliberately remediation-only:
 * base audit inputs, prompts, hashes, and artifacts remain unchanged.
 */
export function buildFrenchEntityRemediationConcordanceResolutionProofs(input: {
  sourceView: FrenchEntityAgentProposerBView;
  selectedProposal: FrenchEntityAgentProposal;
  allowAutonomousLxxNamePreservation?: boolean;
}): FrenchEntityRemediationConcordanceResolutionProof[] {
  const conflicts = new Set(
    frenchEntityAgentEvidenceConflictCodesForRemediation(input)
  );
  const policies = new Map(
    input.selectedProposal.memberPolicies.map((policy) => [
      policy.entryKey,
      policy
    ])
  );
  const proofs: FrenchEntityRemediationConcordanceResolutionProof[] = [];
  for (const entryKey of [...policies.keys()].sort(compareText)) {
    const policy = requiredMap(policies, entryKey);
    const witnesses = input.sourceView.frenchWitnesses[entryKey];
    if (!witnesses) continue;
    const selectedFrench = policy.primaryFr ?? policy.derivedFr ?? "";
    const selectedNormalized = normalizeFrenchEvidence(selectedFrench);
    if (
      input.allowAutonomousLxxNamePreservation === true &&
      isExactAutonomousLxxNamePreservation({
        sourceView: input.sourceView,
        policy
      })
    ) {
      proofs.push(
        finalizeConcordanceResolutionProof({
          proofClass: "exact-autonomous-lxx-name-preservation",
          unitId: input.sourceView.unitId,
          entryKey,
          conflictCode: `${entryKey}:selected-french-form-without-concordance`,
          sourceViewHash: input.sourceView.viewHash,
          selectedProposalHash: input.selectedProposal.proposalHash,
          selectedFrench,
          selectedNormalized,
          witnesses: []
        })
      );
    }
    const exactSpelling = exactControlledConcordanceSpellingWitnesses({
      sourceView: input.sourceView,
      policy,
      selectedFrench
    });
    const hasEntryConflict = [...conflicts].some((code) =>
      code.startsWith(`${entryKey}:`)
    );
    if (exactSpelling.length > 0 && !hasEntryConflict) {
      proofs.push(
        finalizeConcordanceResolutionProof({
          proofClass: "exact-controlled-concordance-spelling",
          unitId: input.sourceView.unitId,
          entryKey,
          conflictCode: `${entryKey}:historical-witness-not-sole-authority`,
          sourceViewHash: input.sourceView.viewHash,
          selectedProposalHash: input.selectedProposal.proposalHash,
          selectedFrench,
          selectedNormalized,
          witnesses: exactSpelling
        })
      );
    }

    const conflictCode = `${entryKey}:selected-french-form-without-concordance`;
    if (!conflicts.has(conflictCode)) continue;
    if (!selectedNormalized) continue;
    const composition = exactComponentCompositionWitnesses(
      selectedNormalized,
      witnesses.concordanceForms
    );
    const singular =
      composition.length === 0 && policy.treatment === "gentilic"
        ? exactPluralSingularWitnesses(
            selectedFrench,
            selectedNormalized,
            witnesses.concordanceForms
          )
        : [];
    const proofClass: FrenchEntityRemediationConcordanceProofClass | null =
      composition.length > 0
        ? "exact-component-composition"
        : singular.length > 0
          ? "exact-plural-s-to-singular"
          : null;
    const selectedWitnesses = composition.length > 0 ? composition : singular;
    if (!proofClass || selectedWitnesses.length === 0) continue;
    proofs.push(
      finalizeConcordanceResolutionProof({
        proofClass,
        unitId: input.sourceView.unitId,
        entryKey,
        conflictCode,
        sourceViewHash: input.sourceView.viewHash,
        selectedProposalHash: input.selectedProposal.proposalHash,
        selectedFrench,
        selectedNormalized,
        witnesses: selectedWitnesses
      })
    );
  }
  return proofs;
}

/** Returns the conflicts still capable of blocking safe after proof replay. */
export function frenchEntityRemediationUnresolvedEvidenceConflictCodes(input: {
  sourceView: FrenchEntityAgentProposerBView;
  selectedProposal: FrenchEntityAgentProposal;
  proofs?: readonly FrenchEntityRemediationConcordanceResolutionProof[];
}): string[] {
  const allowAutonomousLxxNamePreservation = input.proofs?.some(
    (proof) =>
      proof.proofClass === "exact-autonomous-lxx-name-preservation"
  );
  const expected = buildFrenchEntityRemediationConcordanceResolutionProofs({
    sourceView: input.sourceView,
    selectedProposal: input.selectedProposal,
    allowAutonomousLxxNamePreservation
  });
  if (
    input.proofs &&
    canonicalFrenchEntityJson(input.proofs) !==
      canonicalFrenchEntityJson(expected)
  ) {
    throw new Error(
      `french-entity-remediation-concordance-proof-replay:${input.sourceView.unitId}`
    );
  }
  const resolved = new Set(expected.map((proof) => proof.conflictCode));
  return frenchEntityAgentEvidenceConflictCodesForRemediation({
    ...input,
    allowAutonomousLxxNamePreservation
  }).filter((code) => !resolved.has(code));
}

/** Returns every and only currently non-safe unit, in stable unit-id order. */
export function selectFrenchEntityRemediationUnits(
  artifacts: ReadonlyMap<string, FrenchEntityAgentUnitArtifacts>,
  baseViews: ReadonlyMap<string, FrenchEntityRemediationBaseViews>
): string[] {
  assertExactMapKeys(baseViews, [...artifacts.keys()], "selection-base-views");
  const selected: string[] = [];
  for (const [unitId, quartet] of artifacts) {
    assertFrenchEntityAgentQuartet(quartet, unitId);
    const views = requiredMap(baseViews, unitId);
    assertBaseViews(views, unitId);
    assertQuartetCoverageAgainstBaseViews(quartet, views, unitId);
    if (quartet.audit.verdict === "hold" || quartet.audit.verdict === "block") {
      selected.push(unitId);
    }
  }
  return selected.sort(compareText);
}

export function buildFrenchEntityRemediationRoundPlan(
  input: BuildFrenchEntityRemediationRoundPlanInput
): FrenchEntityRemediationRoundPlan {
  assertRoundNumber(input.round);
  const previousRoundHash = validatePreviousRoundForPlan(input);
  const unitIds = selectFrenchEntityRemediationUnits(
    input.currentArtifacts,
    input.baseViews
  );
  if (unitIds.length === 0) {
    throw new Error("french-entity-remediation-no-residual");
  }
  const units = unitIds.map((unitId) => {
    const previousQuartet = requiredMap(input.currentArtifacts, unitId);
    const views = requiredMap(input.baseViews, unitId);
    assertBaseViews(views, unitId);
    const previousQuartetHash = frenchEntityAgentQuartetHash(previousQuartet);
    const previousSemanticProposalHash = semanticFrenchEntityProposalHash(
      selectedProposal(previousQuartet)
    );
    const concordanceResolutionProofs =
      buildFrenchEntityRemediationConcordanceResolutionProofs({
        sourceView: views.proposerB,
        selectedProposal: selectedProposal(previousQuartet),
        allowAutonomousLxxNamePreservation: input.round === 3
      });
    const rejectedSemanticProposalHashes = rejectedSemanticHashesForUnit(
      input.previousRound,
      unitId,
      previousSemanticProposalHash
    );
    const failedCheckCodes = failedChecks(previousQuartet.audit);
    if (failedCheckCodes.length === 0) {
      throw new Error(
        `french-entity-remediation-non-safe-without-failure:${unitId}`
      );
    }
    const parentA: FrenchEntityRemediationParentHashes = {
      baseViewHash: views.proposerA.viewHash,
      previousQuartetHash,
      previousAuditHash: previousQuartet.audit.auditHash,
      previousSemanticProposalHash,
      rejectedSemanticProposalHashes,
      previousRoundHash
    };
    const parentB: FrenchEntityRemediationParentHashes = {
      ...parentA,
      baseViewHash: views.proposerB.viewHash
    };
    const contextA: FrenchEntityRemediationContextA = {
      unitId,
      failedCheckCodes,
      parentHashes: parentA
    };
    assertContextA(contextA);
    const contextB: FrenchEntityRemediationContextB = {
      unitId,
      failedCheckCodes,
      parentHashes: parentB,
      previousQuartet: cloneJson(previousQuartet)
    };
    const proposerA: FrenchEntityRemediationProposerAInput =
      finalizeProposerInput({
        role: "proposerA",
        round: input.round,
        view: cloneJson(views.proposerA),
        context: contextA
      });
    const proposerB: FrenchEntityRemediationProposerBInput =
      finalizeProposerInput({
        role: "proposerB",
        round: input.round,
        view: cloneJson(views.proposerB),
        context: contextB
      });
    const content = {
      unitId,
      previousVerdict: previousQuartet.audit.verdict as "hold" | "block",
      previousQuartetHash,
      previousSemanticProposalHash,
      concordanceResolutionProofs,
      proposerA,
      proposerB
    };
    return { ...content, unitHash: hashFrenchEntityJson(content) };
  });
  const content = {
    schemaVersion: FRENCH_ENTITY_REMEDIATION_ROUND_PLAN_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_REMEDIATION_POLICY_VERSION,
    round: input.round,
    parentRoundHash: previousRoundHash,
    unitIds,
    units
  };
  return { ...content, planHash: hashFrenchEntityJson(content) };
}

export function frenchEntityRemediationArbiterInputHash(
  unit: FrenchEntityRemediationRoundPlanUnit,
  proposalA: FrenchEntityAgentProposal,
  proposalB: FrenchEntityAgentProposal
): string {
  return hashFrenchEntityJson({
    policyVersion: FRENCH_ENTITY_REMEDIATION_POLICY_VERSION,
    round: unit.proposerA.round,
    unitId: unit.unitId,
    planUnitHash: unit.unitHash,
    sourceViewHash: unit.proposerB.view.viewHash,
    proposalAHash: proposalA.proposalHash,
    proposalBHash: proposalB.proposalHash
  });
}

export function frenchEntityRemediationAuditorInputHash(
  unit: FrenchEntityRemediationRoundPlanUnit,
  quartet: Pick<
    FrenchEntityAgentUnitArtifacts,
    "proposalA" | "proposalB" | "arbitration"
  >
): string {
  if (
    quartet.arbitration.selectedProposal !== "proposalA" &&
    quartet.arbitration.selectedProposal !== "proposalB"
  ) {
    throw new Error(
      `french-entity-remediation-auditor-selection:${unit.unitId}`
    );
  }
  const proposal =
    quartet.arbitration.selectedProposal === "proposalA"
      ? quartet.proposalA
      : quartet.proposalB;
  return hashFrenchEntityJson({
    policyVersion: FRENCH_ENTITY_REMEDIATION_POLICY_VERSION,
    round: unit.proposerA.round,
    unitId: unit.unitId,
    planUnitHash: unit.unitHash,
    sourceViewHash: unit.proposerB.view.viewHash,
    arbitrationHash: quartet.arbitration.arbitrationHash,
    selectedProposalHash: proposal.proposalHash
  });
}

export function finalizeFrenchEntityRemediationRound(
  input: FinalizeFrenchEntityRemediationRoundInput
): FrenchEntityRemediationRoundResult {
  assertRoundPlan(input.plan);
  assertExactMapKeys(
    input.artifacts,
    input.plan.unitIds,
    "round-artifact-coverage"
  );
  const residualUnitIds: string[] = [];
  const unitResults = input.plan.units.map((unit) => {
    const quartet = requiredMap(input.artifacts, unit.unitId);
    const semanticProposalHash = assertRoundUnitOutcome(unit, quartet);
    if (quartet.audit.verdict !== "safe") {
      residualUnitIds.push(unit.unitId);
    }
    const content = {
      unitId: unit.unitId,
      planUnitHash: unit.unitHash,
      quartet,
      semanticProposalHash
    };
    return { ...content, resultHash: hashFrenchEntityJson(content) };
  });
  residualUnitIds.sort(compareText);
  const content = {
    schemaVersion: FRENCH_ENTITY_REMEDIATION_ROUND_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_REMEDIATION_POLICY_VERSION,
    round: input.plan.round,
    planHash: input.plan.planHash,
    parentRoundHash: input.plan.parentRoundHash,
    unitResults,
    residualUnitIds
  };
  return { ...content, roundHash: hashFrenchEntityJson(content) };
}

export function buildFrenchEntityRemediationOverlay(
  input: BuildFrenchEntityRemediationOverlayInput
): FrenchEntityRemediationOverlay {
  if (input.rounds.length > FRENCH_ENTITY_REMEDIATION_MAX_ROUNDS) {
    throw new Error("french-entity-remediation-too-many-rounds");
  }
  assertExactMapKeys(
    input.baseViews,
    [...input.baseArtifacts.keys()],
    "base-view-coverage"
  );
  const current = new Map<string, FrenchEntityAgentUnitArtifacts>();
  for (const [unitId, quartet] of input.baseArtifacts) {
    assertFrenchEntityAgentQuartet(quartet, unitId);
    assertBaseViews(requiredMap(input.baseViews, unitId), unitId);
    current.set(unitId, quartet);
  }
  const initialResidual = selectFrenchEntityRemediationUnits(
    current,
    input.baseViews
  );
  if (initialResidual.length === 0 && input.rounds.length > 0) {
    throw new Error("french-entity-remediation-rounds-without-residual");
  }
  if (initialResidual.length > 0 && input.rounds.length === 0) {
    throw new Error(
      `french-entity-remediation-residual-forbidden:${initialResidual.join(",")}`
    );
  }
  const remediated = new Set<string>();
  const terminalRoundByUnit = new Map<string, number>();
  const roundHashes: string[] = [];
  let previousRound: FrenchEntityRemediationRoundBundle | undefined;
  for (let index = 0; index < input.rounds.length; index += 1) {
    const bundle = input.rounds[index];
    if (!bundle) throw new Error("french-entity-remediation-round-missing");
    const expectedRound = index + 1;
    if (bundle.plan.round !== expectedRound) {
      throw new Error(
        `french-entity-remediation-round-sequence:${bundle.plan.round}:${expectedRound}`
      );
    }
    const expectedPlan = buildFrenchEntityRemediationRoundPlan({
      round: expectedRound,
      baseViews: input.baseViews,
      currentArtifacts: current,
      ...(previousRound ? { previousRound } : {})
    });
    if (
      canonicalFrenchEntityJson(expectedPlan) !==
      canonicalFrenchEntityJson(bundle.plan)
    ) {
      throw new Error(
        `french-entity-remediation-round-plan-replay:${expectedRound}`
      );
    }
    assertRoundResult(bundle.plan, bundle.result);
    for (const unitResult of bundle.result.unitResults) {
      current.set(unitResult.unitId, unitResult.quartet);
      remediated.add(unitResult.unitId);
      terminalRoundByUnit.set(unitResult.unitId, expectedRound);
    }
    const actualResidual = selectFrenchEntityRemediationUnits(
      current,
      input.baseViews
    );
    if (
      canonicalFrenchEntityJson(actualResidual) !==
      canonicalFrenchEntityJson(bundle.result.residualUnitIds)
    ) {
      throw new Error(
        `french-entity-remediation-round-residual-replay:${expectedRound}`
      );
    }
    if (actualResidual.length === 0 && index + 1 < input.rounds.length) {
      throw new Error(
        `french-entity-remediation-superfluous-round:${expectedRound + 1}`
      );
    }
    roundHashes.push(bundle.result.roundHash);
    previousRound = bundle;
  }
  const residue = selectFrenchEntityRemediationUnits(current, input.baseViews);
  if (
    residue.length > 0 &&
    input.rounds.length !== FRENCH_ENTITY_REMEDIATION_MAX_ROUNDS
  ) {
    throw new Error(
      `french-entity-remediation-residual-forbidden:${residue.join(",")}`
    );
  }
  const remediatedUnitIds = [...remediated].sort(compareText);
  const quarantinedUnitIds = [...residue].sort(compareText);
  const quarantined = new Set(quarantinedUnitIds);
  const safeUnitIds = [...current.keys()]
    .filter((unitId) => !quarantined.has(unitId))
    .sort(compareText);
  for (const [unitId, original] of input.baseArtifacts) {
    if (original.audit.verdict === "safe" && current.get(unitId) !== original) {
      throw new Error(`french-entity-remediation-base-safe-mutated:${unitId}`);
    }
  }
  const terminalArtifacts = [...current]
    .sort(([left], [right]) => compareText(left, right))
    .map(([unitId, quartet]) => ({
      unitId,
      quartetHash: frenchEntityAgentQuartetHash(quartet),
      terminalRound: terminalRoundByUnit.get(unitId) ?? 0
    }));
  const overlayContent = {
    schemaVersion: FRENCH_ENTITY_REMEDIATION_OVERLAY_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_REMEDIATION_POLICY_VERSION,
    remediatedUnitIds,
    safeUnitIds,
    quarantinedUnitIds,
    roundHashes,
    terminalArtifacts
  };
  return {
    schemaVersion: FRENCH_ENTITY_REMEDIATION_OVERLAY_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_REMEDIATION_POLICY_VERSION,
    artifacts: current,
    remediatedUnitIds,
    safeUnitIds,
    quarantinedUnitIds,
    terminalRoundByUnit,
    roundHashes,
    overlayHash: hashFrenchEntityJson(overlayContent)
  };
}

export function assertFrenchEntityAgentQuartet(
  quartet: FrenchEntityAgentUnitArtifacts,
  expectedUnitId?: string
): void {
  assertExactRuntimeKeys(
    quartet,
    ["proposalA", "proposalB", "arbitration", "audit"],
    "quartet"
  );
  const unitId = expectedUnitId ?? quartet.audit.unitId;
  assertFrenchEntityAgentQuartetHashes(quartet);
  if (
    quartet.proposalA.unitId !== unitId ||
    quartet.proposalB.unitId !== unitId ||
    quartet.arbitration.unitId !== unitId ||
    quartet.audit.unitId !== unitId
  ) {
    throw new Error(`french-entity-remediation-quartet-unit:${unitId}`);
  }
  assertProposal(quartet.proposalA, "proposerA");
  assertProposal(quartet.proposalB, "proposerB");
  assertArbitration(quartet, unitId);
  assertAudit(quartet, unitId);
  const selected = selectedProposal(quartet);
  if (
    quartet.arbitration.selectedProposalHash !== selected.proposalHash ||
    quartet.audit.auditedProposalHash !== selected.proposalHash
  ) {
    throw new Error(`french-entity-remediation-quartet-selection:${unitId}`);
  }
}

function rejectedSemanticHashesForUnit(
  previousRound: FrenchEntityRemediationRoundBundle | undefined,
  unitId: string,
  previousSemanticProposalHash: string
): string[] {
  const inherited = previousRound
    ? requiredMap(
        new Map(
          previousRound.plan.units.map((unit) => [unit.unitId, unit] as const)
        ),
        unitId
      ).proposerA.context.parentHashes.rejectedSemanticProposalHashes
    : [];
  return uniqueSorted([...inherited, previousSemanticProposalHash]);
}

function validatePreviousRoundForPlan(
  input: BuildFrenchEntityRemediationRoundPlanInput
): string | null {
  if (input.round === 1) {
    if (input.previousRound) {
      throw new Error("french-entity-remediation-round-one-has-parent");
    }
    return null;
  }
  const previous = input.previousRound;
  if (!previous || previous.plan.round !== input.round - 1) {
    throw new Error(
      `french-entity-remediation-round-parent-missing:${input.round}`
    );
  }
  assertRoundResult(previous.plan, previous.result);
  const currentResidual = selectFrenchEntityRemediationUnits(
    input.currentArtifacts,
    input.baseViews
  );
  if (
    canonicalFrenchEntityJson(currentResidual) !==
    canonicalFrenchEntityJson(previous.result.residualUnitIds)
  ) {
    throw new Error(
      `french-entity-remediation-round-parent-residual:${input.round}`
    );
  }
  const previousByUnit = new Map(
    previous.result.unitResults.map((result) => [result.unitId, result])
  );
  for (const unitId of currentResidual) {
    const current = requiredMap(input.currentArtifacts, unitId);
    const prior = requiredMap(previousByUnit, unitId).quartet;
    if (
      frenchEntityAgentQuartetHash(current) !==
      frenchEntityAgentQuartetHash(prior)
    ) {
      throw new Error(
        `french-entity-remediation-round-parent-quartet:${unitId}`
      );
    }
  }
  return previous.result.roundHash;
}

function assertRoundPlan(plan: FrenchEntityRemediationRoundPlan): void {
  assertRoundNumber(plan.round);
  if (
    plan.schemaVersion !==
      FRENCH_ENTITY_REMEDIATION_ROUND_PLAN_SCHEMA_VERSION ||
    plan.policyVersion !== FRENCH_ENTITY_REMEDIATION_POLICY_VERSION ||
    (plan.round === 1
      ? plan.parentRoundHash !== null
      : !isSha256(plan.parentRoundHash)) ||
    canonicalFrenchEntityJson(plan.unitIds) !==
      canonicalFrenchEntityJson(uniqueSorted(plan.unitIds)) ||
    plan.units.length !== plan.unitIds.length
  ) {
    throw new Error("french-entity-remediation-round-plan-invalid");
  }
  for (let index = 0; index < plan.units.length; index += 1) {
    const unit = plan.units[index];
    if (!unit || unit.unitId !== plan.unitIds[index]) {
      throw new Error("french-entity-remediation-round-plan-unit-order");
    }
    assertPlanUnit(unit, plan);
  }
  const { planHash, ...content } = plan;
  if (hashFrenchEntityJson(content) !== planHash) {
    throw new Error("french-entity-remediation-round-plan-hash");
  }
}

function assertPlanUnit(
  unit: FrenchEntityRemediationRoundPlanUnit,
  plan: FrenchEntityRemediationRoundPlan
): void {
  assertSha256(unit.previousQuartetHash, "plan-previous-quartet");
  assertSha256(unit.previousSemanticProposalHash, "plan-previous-semantic");
  if (unit.previousVerdict !== "hold" && unit.previousVerdict !== "block") {
    throw new Error(`french-entity-remediation-plan-verdict:${unit.unitId}`);
  }
  assertProposerInput(unit.proposerA, "proposerA", unit.unitId, plan.round);
  assertProposerInput(unit.proposerB, "proposerB", unit.unitId, plan.round);
  const previousQuartet = unit.proposerB.context.previousQuartet;
  assertFrenchEntityAgentQuartet(previousQuartet, unit.unitId);
  assertQuartetCoverageAgainstBaseViews(
    previousQuartet,
    {
      proposerA: unit.proposerA.view,
      proposerB: unit.proposerB.view
    },
    unit.unitId
  );
  const previousFailedChecks = failedChecks(previousQuartet.audit);
  const expectedConcordanceResolutionProofs =
    buildFrenchEntityRemediationConcordanceResolutionProofs({
      sourceView: unit.proposerB.view,
      selectedProposal: selectedProposal(previousQuartet),
      allowAutonomousLxxNamePreservation: plan.round === 3
    });
  if (
    previousQuartet.audit.verdict !== unit.previousVerdict ||
    frenchEntityAgentQuartetHash(previousQuartet) !==
      unit.previousQuartetHash ||
    semanticFrenchEntityProposalHash(selectedProposal(previousQuartet)) !==
      unit.previousSemanticProposalHash ||
    canonicalFrenchEntityJson(unit.concordanceResolutionProofs) !==
      canonicalFrenchEntityJson(expectedConcordanceResolutionProofs) ||
    unit.proposerA.context.parentHashes.previousAuditHash !==
      previousQuartet.audit.auditHash ||
    unit.proposerB.context.parentHashes.previousAuditHash !==
      previousQuartet.audit.auditHash ||
    canonicalFrenchEntityJson(unit.proposerA.context.failedCheckCodes) !==
      canonicalFrenchEntityJson(previousFailedChecks) ||
    canonicalFrenchEntityJson(unit.proposerB.context.failedCheckCodes) !==
      canonicalFrenchEntityJson(previousFailedChecks) ||
    unit.proposerA.context.parentHashes.previousQuartetHash !==
      unit.previousQuartetHash ||
    unit.proposerB.context.parentHashes.previousQuartetHash !==
      unit.previousQuartetHash ||
    unit.proposerA.context.parentHashes.previousSemanticProposalHash !==
      unit.previousSemanticProposalHash ||
    unit.proposerB.context.parentHashes.previousSemanticProposalHash !==
      unit.previousSemanticProposalHash ||
    !unit.proposerA.context.parentHashes.rejectedSemanticProposalHashes.includes(
      unit.previousSemanticProposalHash
    ) ||
    canonicalFrenchEntityJson(
      unit.proposerA.context.parentHashes.rejectedSemanticProposalHashes
    ) !==
      canonicalFrenchEntityJson(
        unit.proposerB.context.parentHashes.rejectedSemanticProposalHashes
      ) ||
    unit.proposerA.context.parentHashes.previousRoundHash !==
      plan.parentRoundHash ||
    unit.proposerB.context.parentHashes.previousRoundHash !==
      plan.parentRoundHash
  ) {
    throw new Error(`french-entity-remediation-plan-parent:${unit.unitId}`);
  }
  const { unitHash, ...content } = unit;
  if (hashFrenchEntityJson(content) !== unitHash) {
    throw new Error(`french-entity-remediation-plan-unit-hash:${unit.unitId}`);
  }
}

function assertProposerInput(
  input:
    | FrenchEntityRemediationProposerAInput
    | FrenchEntityRemediationProposerBInput,
  role: "proposerA" | "proposerB",
  unitId: string,
  round: number
): void {
  if (
    input.role !== role ||
    input.round !== round ||
    input.view.role !== role ||
    input.view.unitId !== unitId ||
    input.context.unitId !== unitId
  ) {
    throw new Error(
      `french-entity-remediation-proposer-input:${unitId}:${role}`
    );
  }
  assertView(input.view, role, unitId);
  if (role === "proposerA") {
    assertContextA(input.context as FrenchEntityRemediationContextA);
  } else {
    assertContextB(input.context as FrenchEntityRemediationContextB);
  }
  assertParentHashes(input.context.parentHashes);
  if (input.context.parentHashes.baseViewHash !== input.view.viewHash) {
    throw new Error(
      `french-entity-remediation-proposer-base-view:${unitId}:${role}`
    );
  }
  const { inputHash, ...content } = input;
  if (hashFrenchEntityJson(content) !== inputHash) {
    throw new Error(
      `french-entity-remediation-proposer-input-hash:${unitId}:${role}`
    );
  }
}

function assertRoundUnitOutcome(
  unit: FrenchEntityRemediationRoundPlanUnit,
  quartet: FrenchEntityAgentUnitArtifacts
): string {
  assertFrenchEntityAgentQuartet(quartet, unit.unitId);
  assertQuartetCoverageAgainstBaseViews(
    quartet,
    {
      proposerA: unit.proposerA.view,
      proposerB: unit.proposerB.view
    },
    unit.unitId
  );
  if (
    quartet.proposalA.inputHash !== unit.proposerA.inputHash ||
    quartet.proposalB.inputHash !== unit.proposerB.inputHash
  ) {
    throw new Error(
      `french-entity-remediation-proposer-input-binding:${unit.unitId}`
    );
  }
  const expectedArbiterInputHash = frenchEntityRemediationArbiterInputHash(
    unit,
    quartet.proposalA,
    quartet.proposalB
  );
  if (quartet.arbitration.inputHash !== expectedArbiterInputHash) {
    throw new Error(
      `french-entity-remediation-arbiter-input-binding:${unit.unitId}`
    );
  }
  const expectedAuditorInputHash = frenchEntityRemediationAuditorInputHash(
    unit,
    quartet
  );
  if (quartet.audit.inputHash !== expectedAuditorInputHash) {
    throw new Error(
      `french-entity-remediation-auditor-input-binding:${unit.unitId}`
    );
  }
  const semanticProposalHash = semanticFrenchEntityProposalHash(
    selectedProposal(quartet)
  );
  const proofCanCloseUnchanged =
    semanticProposalHash === unit.previousSemanticProposalHash &&
    canConcordanceProofCloseUnchanged(unit, quartet);
  const currentAutonomousLxxProofCanCloseRejected =
    canCurrentAutonomousLxxProofCloseRejected(unit, quartet);
  if (
    quartet.audit.verdict === "safe" &&
    semanticProposalHash === unit.previousSemanticProposalHash &&
    !proofCanCloseUnchanged
  ) {
    throw new Error(
      `french-entity-remediation-unchanged-cannot-close:${unit.unitId}:${unit.previousVerdict}`
    );
  }
  if (
    quartet.audit.verdict === "safe" &&
    unit.proposerA.context.parentHashes.rejectedSemanticProposalHashes.includes(
      semanticProposalHash
    ) &&
    !proofCanCloseUnchanged &&
    !currentAutonomousLxxProofCanCloseRejected
  ) {
    throw new Error(
      `french-entity-remediation-rejected-semantic-cannot-close:${unit.unitId}`
    );
  }
  if (quartet.audit.verdict === "safe") {
    const currentProofs =
      buildFrenchEntityRemediationConcordanceResolutionProofs({
        sourceView: unit.proposerB.view,
        selectedProposal: selectedProposal(quartet),
        allowAutonomousLxxNamePreservation: unit.proposerA.round === 3
      });
    const unresolvedConflicts =
      frenchEntityRemediationUnresolvedEvidenceConflictCodes({
        sourceView: unit.proposerB.view,
        selectedProposal: selectedProposal(quartet),
        proofs: currentProofs
      });
    if (unresolvedConflicts.length > 0) {
      throw new Error(
        `french-entity-remediation-safe-evidence-conflict:${unit.unitId}:${unresolvedConflicts.join(",")}`
      );
    }
  }
  return semanticProposalHash;
}

/**
 * Replays one remediation unit against its sealed round context. Publication
 * uses this instead of the base-agent validator because a remediation round
 * may close an exact concordance conflict with a deterministic proof that did
 * not exist in the original base audit contract.
 */
export function assertFrenchEntityRemediationRoundUnitArtifacts(
  unit: FrenchEntityRemediationRoundPlanUnit,
  quartet: FrenchEntityAgentUnitArtifacts
): void {
  assertRoundUnitOutcome(unit, quartet);
}

function canCurrentAutonomousLxxProofCloseRejected(
  unit: FrenchEntityRemediationRoundPlanUnit,
  quartet: FrenchEntityAgentUnitArtifacts
): boolean {
  if (
    unit.proposerA.round !== 3 ||
    canonicalFrenchEntityJson(unit.proposerB.context.failedCheckCodes) !==
      canonicalFrenchEntityJson(["canonicalPrimaryCoherence"])
  ) {
    return false;
  }
  const currentSelected = selectedProposal(quartet);
  const proofs = buildFrenchEntityRemediationConcordanceResolutionProofs({
    sourceView: unit.proposerB.view,
    selectedProposal: currentSelected,
    allowAutonomousLxxNamePreservation: true
  });
  if (
    !proofs.some(
      (proof) =>
        proof.proofClass === "exact-autonomous-lxx-name-preservation"
    )
  ) {
    return false;
  }
  return (
    frenchEntityRemediationUnresolvedEvidenceConflictCodes({
      sourceView: unit.proposerB.view,
      selectedProposal: currentSelected,
      proofs
    }).length === 0
  );
}

function canConcordanceProofCloseUnchanged(
  unit: FrenchEntityRemediationRoundPlanUnit,
  quartet: FrenchEntityAgentUnitArtifacts
): boolean {
  if (unit.concordanceResolutionProofs.length === 0) return false;
  const previous = unit.proposerB.context.previousQuartet;
  const previousSelected = selectedProposal(previous);
  const currentSelected = selectedProposal(quartet);
  const failedChecks = unit.proposerB.context.failedCheckCodes;
  const allowAutonomousLxxNamePreservation =
    unit.concordanceResolutionProofs.some(
      (proof) =>
        proof.proofClass === "exact-autonomous-lxx-name-preservation"
    );
  const previousConflicts =
    frenchEntityAgentEvidenceConflictCodesForRemediation({
      sourceView: unit.proposerB.view,
      selectedProposal: previousSelected,
      allowAutonomousLxxNamePreservation
    });
  const unresolvedConflicts =
    frenchEntityRemediationUnresolvedEvidenceConflictCodes({
      sourceView: unit.proposerB.view,
      selectedProposal: previousSelected,
      proofs: unit.concordanceResolutionProofs
    });
  if (unresolvedConflicts.length > 0) return false;

  const proofClasses = new Set(
    unit.concordanceResolutionProofs.map((proof) => proof.proofClass)
  );
  const hasExactSpelling =
    proofClasses.has("exact-controlled-concordance-spelling") &&
    exactSpellingProofCoversSelectedNames(
      previousSelected,
      unit.concordanceResolutionProofs
    );
  const hasComponentComposition = proofClasses.has(
    "exact-component-composition"
  );
  const hasPluralSingular = proofClasses.has("exact-plural-s-to-singular");
  const hasAutonomousLxxNamePreservation = proofClasses.has(
    "exact-autonomous-lxx-name-preservation"
  );
  const hasDerivedConcordance =
    hasComponentComposition || hasPluralSingular;
  const onlyDerivableConflicts =
    previousConflicts.length > 0 &&
    previousConflicts.every((code) =>
      code.endsWith(":selected-french-form-without-concordance")
    );
  const explanationChanged =
    proposalExplanationJson(currentSelected) !==
    proposalExplanationJson(previousSelected);

  const everyPreviousFailureIsClosed = failedChecks.every((check) => {
    switch (check) {
      case "canonicalPrimaryCoherence":
        return (
          (onlyDerivableConflicts && hasDerivedConcordance) ||
          (previousConflicts.length === 0 &&
            hasAutonomousLxxNamePreservation) ||
          (previousConflicts.length === 0 &&
            hasExactSpelling &&
            explanationChanged)
        );
      case "singularEditorialLemma":
        return hasPluralSingular;
      case "historicalWitnessNotSoleAuthority":
        return hasExactSpelling || hasDerivedConcordance;
      case "frenchNaturalness":
        return (
          previousConflicts.length === 0 &&
          hasExactSpelling &&
          explanationChanged
        );
      default:
        return false;
    }
  });
  return (
    failedChecks.length > 0 &&
    everyPreviousFailureIsClosed &&
    semanticFrenchEntityProposalHash(currentSelected) ===
      semanticFrenchEntityProposalHash(previousSelected)
  );
}

function proposalExplanationJson(
  proposal: FrenchEntityAgentProposal
): string {
  return canonicalFrenchEntityJson({
    canonicalEntities: proposal.canonicalEntities.map((entity) => ({
      entityId: entity.entityId,
      reasons: entity.reasons
    })),
    memberPolicies: proposal.memberPolicies.map((policy) => ({
      entryKey: policy.entryKey,
      reasons: policy.reasons
    }))
  });
}

function assertRoundResult(
  plan: FrenchEntityRemediationRoundPlan,
  result: FrenchEntityRemediationRoundResult
): void {
  assertRoundPlan(plan);
  if (
    result.schemaVersion !== FRENCH_ENTITY_REMEDIATION_ROUND_SCHEMA_VERSION ||
    result.policyVersion !== FRENCH_ENTITY_REMEDIATION_POLICY_VERSION ||
    result.round !== plan.round ||
    result.planHash !== plan.planHash ||
    result.parentRoundHash !== plan.parentRoundHash ||
    result.unitResults.length !== plan.unitIds.length
  ) {
    throw new Error("french-entity-remediation-round-result-invalid");
  }
  const resultIds = result.unitResults.map((value) => value.unitId);
  if (
    canonicalFrenchEntityJson(resultIds) !==
    canonicalFrenchEntityJson(plan.unitIds)
  ) {
    throw new Error("french-entity-remediation-round-result-coverage");
  }
  const residual: string[] = [];
  for (const unitResult of result.unitResults) {
    const planUnit = requiredMap(
      new Map(plan.units.map((unit) => [unit.unitId, unit])),
      unitResult.unitId
    );
    const semanticProposalHash = assertRoundUnitOutcome(
      planUnit,
      unitResult.quartet
    );
    if (
      unitResult.planUnitHash !== planUnit.unitHash ||
      unitResult.semanticProposalHash !== semanticProposalHash
    ) {
      throw new Error(
        `french-entity-remediation-round-unit-result:${unitResult.unitId}`
      );
    }
    const { resultHash, ...content } = unitResult;
    if (hashFrenchEntityJson(content) !== resultHash) {
      throw new Error(
        `french-entity-remediation-round-unit-result-hash:${unitResult.unitId}`
      );
    }
    if (unitResult.quartet.audit.verdict !== "safe") {
      residual.push(unitResult.unitId);
    }
  }
  residual.sort(compareText);
  if (
    canonicalFrenchEntityJson(residual) !==
    canonicalFrenchEntityJson(result.residualUnitIds)
  ) {
    throw new Error("french-entity-remediation-round-result-residual");
  }
  const { roundHash, ...content } = result;
  if (hashFrenchEntityJson(content) !== roundHash) {
    throw new Error("french-entity-remediation-round-result-hash");
  }
}

function finalizeProposerInput<T extends object>(
  content: T
): T & { inputHash: string } {
  return { ...content, inputHash: hashFrenchEntityJson(content) };
}

function assertBaseViews(
  views: FrenchEntityRemediationBaseViews,
  unitId: string
): void {
  assertView(views.proposerA, "proposerA", unitId);
  assertView(views.proposerB, "proposerB", unitId);
  if (
    views.proposerA.planHash !== views.proposerB.planHash ||
    views.proposerA.releaseKey !== views.proposerB.releaseKey ||
    views.proposerA.releaseSnapshotFingerprint !==
      views.proposerB.releaseSnapshotFingerprint ||
    hashFrenchEntityJson(views.proposerA.reviewUnit) !==
      hashFrenchEntityJson(views.proposerB.reviewUnit)
  ) {
    throw new Error(`french-entity-remediation-base-view-pair:${unitId}`);
  }
}

function assertQuartetCoverageAgainstBaseViews(
  quartet: FrenchEntityAgentUnitArtifacts,
  views: FrenchEntityRemediationBaseViews,
  unitId: string
): void {
  assertProposalCoverageAgainstView(quartet.proposalA, views.proposerA, unitId);
  assertProposalCoverageAgainstView(quartet.proposalB, views.proposerB, unitId);
}

function assertProposalCoverageAgainstView(
  proposal: FrenchEntityAgentProposal,
  view: FrenchEntityAgentView,
  unitId: string
): void {
  const actualEntityIds = proposal.canonicalEntities
    .map((entity) => entity.entityId)
    .sort((left, right) => left - right);
  const expectedEntityIds = [...view.ownerEntityIds].sort(
    (left, right) => left - right
  );
  const actualEntryKeys = proposal.memberPolicies
    .map((member) => member.entryKey)
    .sort(compareText);
  const expectedEntryKeys = [...view.reviewUnit.reviewEntryKeys].sort(
    compareText
  );
  const viewMembers = new Map(
    view.members.map((member) => [member.entryKey, member] as const)
  );
  const unboundNameEntryKeys = new Set(
    frenchEntityAgentUnboundNameEntryKeys(view)
  );
  const unboundAlternateNameEntryKeys = new Set(
    frenchEntityAgentUnboundAlternateNameEntryKeys(view)
  );
  if (
    canonicalFrenchEntityJson(actualEntityIds) !==
      canonicalFrenchEntityJson(expectedEntityIds) ||
    canonicalFrenchEntityJson(actualEntryKeys) !==
      canonicalFrenchEntityJson(expectedEntryKeys) ||
    viewMembers.size !== view.members.length ||
    expectedEntryKeys.some((entryKey) => !viewMembers.has(entryKey))
  ) {
    throw new Error(`french-entity-remediation-proposal-coverage:${unitId}`);
  }
  for (const member of proposal.memberPolicies) {
    const viewMember = requiredMap(viewMembers, member.entryKey);
    const allowedEntityIds = new Set(viewMember.entityIds);
    const nameLike = member.treatment !== "etymological-or-common-gloss";
    const allowedUnboundTreatment =
      (unboundNameEntryKeys.has(member.entryKey) &&
        [
          "unregistered-proper-name",
          "gentilic",
          "title-or-epithet",
          "compound-name"
        ].includes(member.treatment)) ||
      (member.treatment === "alternate-name" &&
        unboundAlternateNameEntryKeys.has(member.entryKey));
    if (
      (viewMember.identity.morph === "G:N-PRI" && !allowedUnboundTreatment) ||
      (nameLike &&
        member.entityBindings.length === 0 &&
        !allowedUnboundTreatment) ||
      (member.treatment === "unregistered-proper-name" &&
        !unboundNameEntryKeys.has(member.entryKey)) ||
      member.entityBindings.some(
        (binding) => !allowedEntityIds.has(binding.entityId)
      )
    ) {
      throw new Error(
        `french-entity-remediation-proposal-binding-coverage:${unitId}:${member.entryKey}`
      );
    }
    const directNamedEntityIds = frenchEntityDirectNamedMatchEntityIds({
      englishGloss: viewMember.englishGloss,
      entityMatches: viewMember.englishEntityMatches
    });
    if (
      view.reviewUnit.kind === "multi-entity" &&
      viewMember.entityIds.length > 1 &&
      (directNamedEntityIds.length > 0 || view.ownerEntityIds.length > 0) &&
      member.treatment !== "canonical-name"
    ) {
      throw new Error(
        `french-entity-remediation-mixed-direct-primary-treatment:${unitId}:${member.entryKey}`
      );
    }
    if (member.treatment === "canonical-name") {
      const primary = member.entityBindings.filter(
        (binding) => binding.relation === "primary"
      );
      const secondary = member.entityBindings.filter(
        (binding) =>
          binding.relation === "alias" || binding.relation === "compound"
      );
      const allowedPrimaryEntityIds =
        directNamedEntityIds.length === 1
          ? directNamedEntityIds
          : view.ownerEntityIds;
      const exactMixed =
        view.reviewUnit.kind === "multi-entity" &&
        viewMember.entityIds.length > 1 &&
        member.entityBindings.length === viewMember.entityIds.length &&
        primary.length === 1 &&
        allowedPrimaryEntityIds.includes(primary[0]?.entityId ?? -1) &&
        secondary.length === viewMember.entityIds.length - 1 &&
        secondary.every(
          (binding) =>
            binding.relation ===
            frenchEntityCanonicalSecondaryRelation({
              entityId: binding.entityId,
              entityMatches: viewMember.englishEntityMatches
            })
        ) &&
        canonicalFrenchEntityJson(
          member.entityBindings
            .map((binding) => binding.entityId)
            .sort((left, right) => left - right)
        ) ===
          canonicalFrenchEntityJson(
            [...viewMember.entityIds].sort((left, right) => left - right)
          );
      if (member.entityBindings.length !== 1 && !exactMixed) {
        throw new Error(
          `french-entity-remediation-canonical-binding-shape:${unitId}:${member.entryKey}`
        );
      }
    }
    if (
      view.reviewUnit.kind === "multi-entity" &&
      viewMember.entityIds.length > 1 &&
      member.treatment !== "etymological-or-common-gloss" &&
      canonicalFrenchEntityJson(
        member.entityBindings
          .map((binding) => binding.entityId)
          .sort((left, right) => left - right)
      ) !==
        canonicalFrenchEntityJson(
          [...viewMember.entityIds].sort((left, right) => left - right)
        )
    ) {
      throw new Error(
        `french-entity-remediation-multi-binding-coverage:${unitId}:${member.entryKey}`
      );
    }
  }
}

function assertView(
  view: FrenchEntityAgentView,
  role: "proposerA" | "proposerB",
  unitId: string
): void {
  const { viewHash, ...content } = view;
  if (
    view.schemaVersion !== FRENCH_ENTITY_AGENT_VIEW_SCHEMA_VERSION ||
    view.policyVersion !== FRENCH_ENTITY_AGENT_POLICY_VERSION ||
    view.role !== role ||
    view.unitId !== unitId ||
    hashFrenchEntityJson(content) !== viewHash
  ) {
    throw new Error(`french-entity-remediation-base-view:${unitId}:${role}`);
  }
  if (role === "proposerA") assertProposerABlind(view);
}

function assertContextA(context: FrenchEntityRemediationContextA): void {
  const keys = Object.keys(context).sort(compareText);
  const expected = ["failedCheckCodes", "parentHashes", "unitId"].sort(
    compareText
  );
  if (canonicalFrenchEntityJson(keys) !== canonicalFrenchEntityJson(expected)) {
    throw new Error(
      `french-entity-remediation-context-a-leak:${context.unitId}`
    );
  }
  assertFailedCheckCodes(context.failedCheckCodes, context.unitId);
  assertParentHashes(context.parentHashes);
}

function assertContextB(context: FrenchEntityRemediationContextB): void {
  const keys = Object.keys(context).sort(compareText);
  const expected = [
    "failedCheckCodes",
    "parentHashes",
    "previousQuartet",
    "unitId"
  ].sort(compareText);
  if (canonicalFrenchEntityJson(keys) !== canonicalFrenchEntityJson(expected)) {
    throw new Error(
      `french-entity-remediation-context-b-invalid:${context.unitId}`
    );
  }
  assertFailedCheckCodes(context.failedCheckCodes, context.unitId);
  assertParentHashes(context.parentHashes);
  assertFrenchEntityAgentQuartet(context.previousQuartet, context.unitId);
}

function assertProposerABlind(view: FrenchEntityAgentView): void {
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
        throw new Error(`french-entity-remediation-proposer-a-leak:${key}`);
      }
      visit(child);
    }
  };
  visit(view);
}

function assertParentHashes(value: FrenchEntityRemediationParentHashes): void {
  const keys = Object.keys(value).sort(compareText);
  const expectedKeys = [
    "baseViewHash",
    "previousAuditHash",
    "previousQuartetHash",
    "previousRoundHash",
    "previousSemanticProposalHash",
    "rejectedSemanticProposalHashes"
  ].sort(compareText);
  if (
    canonicalFrenchEntityJson(keys) !== canonicalFrenchEntityJson(expectedKeys)
  ) {
    throw new Error("french-entity-remediation-parent-hashes-shape");
  }
  assertSha256(value.baseViewHash, "parent-base-view");
  assertSha256(value.previousQuartetHash, "parent-previous-quartet");
  assertSha256(value.previousAuditHash, "parent-previous-audit");
  assertSha256(value.previousSemanticProposalHash, "parent-previous-semantic");
  if (
    value.rejectedSemanticProposalHashes.length === 0 ||
    canonicalFrenchEntityJson(value.rejectedSemanticProposalHashes) !==
      canonicalFrenchEntityJson(
        uniqueSorted(value.rejectedSemanticProposalHashes)
      ) ||
    value.rejectedSemanticProposalHashes.some((hash) => !isSha256(hash)) ||
    !value.rejectedSemanticProposalHashes.includes(
      value.previousSemanticProposalHash
    )
  ) {
    throw new Error("french-entity-remediation-parent-rejected-semantics");
  }
  if (value.previousRoundHash !== null) {
    assertSha256(value.previousRoundHash, "parent-previous-round");
  }
}

function assertFrenchEntityAgentQuartetHashes(
  quartet: FrenchEntityAgentUnitArtifacts
): void {
  const { proposalHash: proposalAHash, ...proposalAContent } =
    quartet.proposalA;
  const { proposalHash: proposalBHash, ...proposalBContent } =
    quartet.proposalB;
  const { arbitrationHash, ...arbitrationContent } = quartet.arbitration;
  const { auditHash, ...auditContent } = quartet.audit;
  if (
    hashFrenchEntityJson(proposalAContent) !== proposalAHash ||
    hashFrenchEntityJson(proposalBContent) !== proposalBHash ||
    hashFrenchEntityJson(arbitrationContent) !== arbitrationHash ||
    hashFrenchEntityJson(auditContent) !== auditHash
  ) {
    throw new Error(
      `french-entity-remediation-quartet-hash:${quartet.audit.unitId}`
    );
  }
}

function assertProposal(
  proposal: FrenchEntityAgentProposal,
  role: "proposerA" | "proposerB"
): void {
  assertExactRuntimeKeys(
    proposal,
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
    `proposal:${role}`
  );
  assertProposalShape(proposal);
  if (
    proposal.schemaVersion !== FRENCH_ENTITY_AGENT_PROPOSAL_SCHEMA_VERSION ||
    proposal.policyVersion !== FRENCH_ENTITY_AGENT_POLICY_VERSION ||
    proposal.role !== role
  ) {
    throw new Error(
      `french-entity-remediation-proposal:${proposal.unitId}:${role}`
    );
  }
  assertSha256(proposal.inputHash, "proposal-input");
  assertSha256(proposal.proposalHash, "proposal-hash");
}

function assertProposalShape(proposal: FrenchEntityAgentProposal): void {
  if (
    !Array.isArray(proposal.canonicalEntities) ||
    !Array.isArray(proposal.memberPolicies)
  ) {
    throw new Error(
      `french-entity-remediation-proposal-shape:${proposal.unitId}`
    );
  }
  const entityIds = proposal.canonicalEntities.map((value) => value.entityId);
  const entryKeys = proposal.memberPolicies.map((value) => value.entryKey);
  if (
    proposal.memberPolicies.length === 0 ||
    new Set(entityIds).size !== entityIds.length ||
    new Set(entryKeys).size !== entryKeys.length ||
    proposal.canonicalEntities.some(
      (value) =>
        !Number.isInteger(value.entityId) ||
        value.entityId < 1 ||
        !value.primaryFr.trim()
    ) ||
    proposal.memberPolicies.some(
      (value) =>
        !value.entryKey ||
        new Set(
          value.entityBindings.map(
            (binding) => `${binding.entityId}:${binding.relation}`
          )
        ).size !== value.entityBindings.length
    )
  ) {
    throw new Error(
      `french-entity-remediation-proposal-shape:${proposal.unitId}`
    );
  }
  for (const entity of proposal.canonicalEntities) {
    assertExactRuntimeKeys(
      entity,
      ["entityId", "primaryFr", "evidenceHashes", "reasons"],
      `primary-proposal:${proposal.unitId}:${entity.entityId}`
    );
    if (
      entity.primaryFr !== entity.primaryFr.trim() ||
      !isStoredStringArray(entity.evidenceHashes, true, true) ||
      !isStoredStringArray(entity.reasons, true, false)
    ) {
      throw new Error(
        `french-entity-remediation-primary-proposal:${proposal.unitId}:${entity.entityId}`
      );
    }
  }
  for (const member of proposal.memberPolicies) {
    assertExactRuntimeKeys(
      member,
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
      `member-proposal:${proposal.unitId}:${member.entryKey}`
    );
    if (
      !isFrenchEntityNameTreatment(member.treatment) ||
      String(member.treatment) === "unresolved" ||
      !isFrenchEntityNameConstraint(member.constraint) ||
      String(member.constraint) === "blocked"
    ) {
      throw new Error(
        `french-entity-remediation-member-discriminant:${proposal.unitId}:${member.entryKey}`
      );
    }
    const contract = frenchEntityPolicyContractForTreatment(member.treatment);
    if (!contract || member.constraint !== contract.constraint) {
      throw new Error(
        `french-entity-remediation-member-constraint:${proposal.unitId}:${member.entryKey}`
      );
    }
    if (!Array.isArray(member.entityBindings)) {
      throw new Error(
        `french-entity-remediation-member-bindings:${proposal.unitId}:${member.entryKey}`
      );
    }
    for (const binding of member.entityBindings) {
      assertExactRuntimeKeys(
        binding,
        ["entityId", "relation"],
        `member-binding:${proposal.unitId}:${member.entryKey}`
      );
      const relationAllowed =
        member.treatment === "canonical-name"
          ? binding.relation === "primary" ||
            binding.relation === "alias" ||
            binding.relation === "compound"
          : binding.relation === contract.relation;
      if (
        !Number.isInteger(binding.entityId) ||
        binding.entityId < 1 ||
        !isFrenchEntityBindingRelation(binding.relation) ||
        !relationAllowed
      ) {
        throw new Error(
          `french-entity-remediation-member-binding:${proposal.unitId}:${member.entryKey}`
        );
      }
    }
    const selected =
      contract.constraint === "canonical" ? member.primaryFr : member.derivedFr;
    const unused =
      contract.constraint === "canonical" ? member.derivedFr : member.primaryFr;
    const nameLike = member.treatment !== "etymological-or-common-gloss";
    const unboundNameForm =
      member.entityBindings.length === 0 &&
      ((member.treatment === "unregistered-proper-name" &&
        member.constraint === "proper-name-without-entity") ||
        new Set([
          "alternate-name",
          "gentilic",
          "title-or-epithet",
          "compound-name"
        ]).has(member.treatment));
    const primaryBindingCount = member.entityBindings.filter(
      (binding) => binding.relation === "primary"
    ).length;
    if (
      typeof selected !== "string" ||
      !selected.trim() ||
      selected !== selected.trim() ||
      unused !== null ||
      (nameLike && member.entityBindings.length === 0 && !unboundNameForm) ||
      (member.treatment === "canonical-name" && primaryBindingCount !== 1) ||
      !isStoredStringArray(member.englishForms, nameLike, false) ||
      (!nameLike && member.englishForms.length !== 0) ||
      !isStoredStringArray(member.allowedFrenchForms, true, false) ||
      canonicalFrenchEntityJson(member.allowedFrenchForms) !==
        canonicalFrenchEntityJson(
          canonicalFrenchEntityPolicyForms(member.treatment, selected)
        ) ||
      !isStoredStringArray(member.evidenceHashes, true, true) ||
      !isStoredStringArray(member.reasons, true, false)
    ) {
      throw new Error(
        `french-entity-remediation-member-shape:${proposal.unitId}:${member.entryKey}`
      );
    }
  }
}

function assertArbitration(
  quartet: FrenchEntityAgentUnitArtifacts,
  unitId: string
): void {
  const arbitration = quartet.arbitration;
  assertExactRuntimeKeys(
    arbitration,
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
    `arbitration:${unitId}`
  );
  const selected =
    arbitration.selectedProposal === "proposalA"
      ? quartet.proposalA
      : arbitration.selectedProposal === "proposalB"
        ? quartet.proposalB
        : null;
  if (
    arbitration.schemaVersion !==
      FRENCH_ENTITY_AGENT_ARBITRATION_SCHEMA_VERSION ||
    arbitration.policyVersion !== FRENCH_ENTITY_AGENT_POLICY_VERSION ||
    arbitration.role !== "arbiter" ||
    !selected ||
    arbitration.selectedProposalHash !== selected.proposalHash ||
    !isNonEmptyStringArray(arbitration.reasons)
  ) {
    throw new Error(`french-entity-remediation-arbitration:${unitId}`);
  }
  assertSha256(arbitration.inputHash, "arbitration-input");
  assertSha256(arbitration.arbitrationHash, "arbitration-hash");
}

function assertAudit(
  quartet: FrenchEntityAgentUnitArtifacts,
  unitId: string
): void {
  const audit = quartet.audit;
  assertExactRuntimeKeys(
    audit,
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
    `audit:${unitId}`
  );
  assertExactRuntimeKeys(
    audit.checks,
    AUDIT_CHECK_CODES,
    `audit-checks:${unitId}`
  );
  const checkValues = AUDIT_CHECK_CODES.map((code) => audit.checks[code]);
  const selected = selectedProposal(quartet);
  const mechanicalChecks = new Set<keyof FrenchEntityAgentAuditChecks>([
    "exactStepIdentity",
    "exactEnglishLineage",
    "explicitMemberRelations"
  ]);
  const semanticFailure = AUDIT_CHECK_CODES.some(
    (code) => !mechanicalChecks.has(code) && audit.checks[code] === "fail"
  );
  if (
    audit.schemaVersion !== FRENCH_ENTITY_AGENT_AUDIT_SCHEMA_VERSION ||
    audit.policyVersion !== FRENCH_ENTITY_AGENT_POLICY_VERSION ||
    audit.role !== "auditor" ||
    (audit.verdict !== "safe" &&
      audit.verdict !== "hold" &&
      audit.verdict !== "block") ||
    audit.auditedProposalHash !== selected.proposalHash ||
    checkValues.some((value) => value !== "pass" && value !== "fail") ||
    [...mechanicalChecks].some((code) => audit.checks[code] !== "pass") ||
    !Array.isArray(audit.reasons) ||
    audit.reasons.some((reason) => typeof reason !== "string" || !reason.trim())
  ) {
    throw new Error(`french-entity-remediation-audit:${unitId}`);
  }
  assertSha256(audit.inputHash, "audit-input");
  assertSha256(audit.auditHash, "audit-hash");
  const failures = failedChecks(audit);
  if (
    (audit.verdict === "safe" &&
      (failures.length > 0 || audit.reasons.length > 0)) ||
    (audit.verdict !== "safe" &&
      (!semanticFailure || audit.reasons.length === 0))
  ) {
    throw new Error(`french-entity-remediation-audit-verdict:${unitId}`);
  }
}

function failedChecks(
  audit: FrenchEntityAgentAudit
): FrenchEntityRemediationFailedCheckCode[] {
  return AUDIT_CHECK_CODES.filter((code) => audit.checks[code] === "fail");
}

function frenchEntityAgentEvidenceConflictCodesForRemediation(input: {
  sourceView: FrenchEntityAgentProposerBView;
  selectedProposal: FrenchEntityAgentProposal;
  allowAutonomousLxxNamePreservation?: boolean;
}): string[] {
  const exactAutonomousLxxEntries = new Set(
    input.allowAutonomousLxxNamePreservation === true
      ? input.selectedProposal.memberPolicies
          .filter((policy) =>
            isExactAutonomousLxxNamePreservation({
              sourceView: input.sourceView,
              policy
            })
          )
          .map((policy) => policy.entryKey)
      : []
  );
  return frenchEntityAgentEvidenceConflictCodes(input).filter(
    (code) =>
      ![...exactAutonomousLxxEntries].some(
        (entryKey) =>
          code === `${entryKey}:selected-french-form-without-concordance`
      )
  );
}

function isExactAutonomousLxxNamePreservation(input: {
  sourceView: FrenchEntityAgentProposerBView;
  policy: FrenchEntityAgentProposal["memberPolicies"][number];
}): boolean {
  const member = input.sourceView.members.find(
    (candidate) => candidate.entryKey === input.policy.entryKey
  );
  if (!member) return false;
  const codeMatch = /^G(\d{5})$/u.exec(member.identity.eStrong);
  const code = codeMatch ? Number(codeMatch[1]) : -1;
  const isLxxTail =
    (code >= 21425 && code <= 21476 && code !== 21435) ||
    (code >= 21499 && code <= 21502);
  const selectedFrench =
    input.policy.primaryFr ?? input.policy.derivedFr ?? "";
  return (
    isLxxTail &&
    member.entryKey === `greek:${member.identity.eStrong}` &&
    member.identity.language === "greek" &&
    member.identity.morph === "G:N-PRI" &&
    member.identity.dStrong.trim() === `${member.identity.eStrong} =` &&
    member.identity.uStrong === member.identity.eStrong &&
    member.entityIds.length === 0 &&
    input.policy.treatment === "unregistered-proper-name" &&
    input.policy.constraint === "proper-name-without-entity" &&
    input.policy.entityBindings.length === 0 &&
    input.policy.primaryFr === null &&
    input.policy.derivedFr === member.englishGloss &&
    selectedFrench === member.englishGloss &&
    input.policy.englishForms.includes(member.englishGloss)
  );
}

type ConcordanceForm =
  FrenchEntityAgentProposerBView["frenchWitnesses"][string]["concordanceForms"][number];

function exactControlledConcordanceSpellingWitnesses(input: {
  sourceView: FrenchEntityAgentProposerBView;
  policy: FrenchEntityAgentProposal["memberPolicies"][number];
  selectedFrench: string;
}): FrenchEntityRemediationConcordanceProofWitness[] {
  if (input.policy.treatment !== "canonical-name") return [];
  const member = input.sourceView.members.find(
    (candidate) => candidate.entryKey === input.policy.entryKey
  );
  const primaryBindings = input.policy.entityBindings.filter(
    (binding) => binding.relation === "primary"
  );
  if (!member || primaryBindings.length !== 1) return [];
  const primaryEntityId = primaryBindings[0]!.entityId;
  const directNamedEntityIds = frenchEntityDirectNamedMatchEntityIds({
    englishGloss: member.englishGloss,
    entityMatches: member.englishEntityMatches
  });
  const canonicalEntity = input.sourceView.ownerEntityIds.includes(
    primaryEntityId
  )
    ? input.policy.primaryFr
    : null;
  if (
    directNamedEntityIds.length !== 1 ||
    directNamedEntityIds[0] !== primaryEntityId ||
    canonicalEntity !== input.selectedFrench ||
    !member.entityIds.includes(primaryEntityId)
  ) {
    return [];
  }
  const selectedSurface = input.selectedFrench.trim().normalize("NFC");
  if (!selectedSurface) return [];
  const witnesses =
    input.sourceView.frenchWitnesses[input.policy.entryKey]?.concordanceForms;
  if (!witnesses) return [];
  return witnesses
    .filter((form) => form.surface.trim().normalize("NFC") === selectedSurface)
    .sort(
      (left, right) =>
        compareText(left.surface, right.surface) ||
        compareText(left.sources.join("\u0000"), right.sources.join("\u0000"))
    )
    .map((form) =>
      sealedConcordanceWitness(form, normalizeFrenchEvidence(form.surface))
    );
}

function exactSpellingProofCoversSelectedNames(
  proposal: FrenchEntityAgentProposal,
  proofs: readonly FrenchEntityRemediationConcordanceResolutionProof[]
): boolean {
  const governedEntryKeys = proposal.memberPolicies
    .filter((policy) => policy.treatment !== "etymological-or-common-gloss")
    .map((policy) => policy.entryKey)
    .sort(compareText);
  if (governedEntryKeys.length === 0) return false;
  const provedEntryKeys = proofs
    .filter(
      (proof) => proof.proofClass === "exact-controlled-concordance-spelling"
    )
    .map((proof) => proof.entryKey)
    .sort(compareText);
  return (
    canonicalFrenchEntityJson(provedEntryKeys) ===
    canonicalFrenchEntityJson(governedEntryKeys)
  );
}

function finalizeConcordanceResolutionProof(
  content: Omit<
    FrenchEntityRemediationConcordanceResolutionProof,
    "schemaVersion" | "policyVersion" | "proofHash"
  >
): FrenchEntityRemediationConcordanceResolutionProof {
  const proofContent = {
    schemaVersion: FRENCH_ENTITY_REMEDIATION_CONCORDANCE_PROOF_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_REMEDIATION_POLICY_VERSION,
    ...content
  };
  return {
    ...proofContent,
    proofHash: hashFrenchEntityJson(proofContent)
  };
}

function exactComponentCompositionWitnesses(
  selectedNormalized: string,
  forms: readonly ConcordanceForm[]
): FrenchEntityRemediationConcordanceProofWitness[] {
  const selectedTokens = selectedNormalized.split(" ").filter(Boolean);
  if (selectedTokens.length < 2) return [];
  const byNormalized = new Map<string, ConcordanceForm>();
  for (const form of forms) {
    const normalized = normalizeFrenchEvidence(form.surface);
    if (!normalized || form.witnessFamilies.length < 2) continue;
    const current = byNormalized.get(normalized);
    if (
      !current ||
      form.witnessFamilies.length > current.witnessFamilies.length ||
      (form.witnessFamilies.length === current.witnessFamilies.length &&
        compareText(form.surface, current.surface) < 0)
    ) {
      byNormalized.set(normalized, form);
    }
  }
  const candidates = [...byNormalized.entries()]
    .map(([normalized, form]) => ({
      normalized,
      tokens: normalized.split(" "),
      form
    }))
    .sort((left, right) => compareText(left.normalized, right.normalized));
  const solutions: Array<typeof candidates> = [];
  const visit = (offset: number, path: typeof candidates): void => {
    if (solutions.length > 1) return;
    if (offset === selectedTokens.length) {
      if (path.length >= 2) solutions.push(path);
      return;
    }
    for (const candidate of candidates) {
      if (
        candidate.tokens.every(
          (token, index) => selectedTokens[offset + index] === token
        )
      ) {
        visit(offset + candidate.tokens.length, [...path, candidate]);
      }
    }
  };
  visit(0, []);
  if (solutions.length !== 1) return [];
  return solutions[0]!.map(({ normalized, form }) =>
    sealedConcordanceWitness(form, normalized)
  );
}

function exactPluralSingularWitnesses(
  selectedFrench: string,
  selectedNormalized: string,
  forms: readonly ConcordanceForm[]
): FrenchEntityRemediationConcordanceProofWitness[] {
  const selectedSurface = selectedFrench
    .normalize("NFC")
    .toLocaleLowerCase("fr");
  if (
    !/^\p{Lu}?[\p{L}\p{M}-]{3,}$/u.test(selectedFrench.normalize("NFC")) ||
    /[sxz]$/iu.test(selectedSurface)
  ) {
    return [];
  }
  const matches = forms
    .filter((form) => {
      const surface = form.surface.normalize("NFC").toLocaleLowerCase("fr");
      return (
        surface === `${selectedSurface}s` &&
        normalizeFrenchEvidence(form.surface) === `${selectedNormalized}s`
      );
    })
    .sort((left, right) => compareText(left.surface, right.surface));
  if (matches.length !== 1) return [];
  return [
    sealedConcordanceWitness(
      matches[0]!,
      normalizeFrenchEvidence(matches[0]!.surface)
    )
  ];
}

function sealedConcordanceWitness(
  form: ConcordanceForm,
  normalized: string
): FrenchEntityRemediationConcordanceProofWitness {
  return {
    surface: form.surface,
    normalized,
    count: form.count,
    strongCount: form.strongCount,
    sources: [...form.sources].sort(compareText),
    witnessFamilies: [...form.witnessFamilies].sort(compareText)
  };
}

function assertFailedCheckCodes(
  value: readonly FrenchEntityRemediationFailedCheckCode[],
  unitId: string
): void {
  if (
    value.length === 0 ||
    canonicalFrenchEntityJson(value) !==
      canonicalFrenchEntityJson(
        AUDIT_CHECK_CODES.filter((code) => value.includes(code))
      )
  ) {
    throw new Error(`french-entity-remediation-failed-check-codes:${unitId}`);
  }
}

function selectedProposal(
  quartet: FrenchEntityAgentUnitArtifacts
): FrenchEntityAgentProposal {
  if (quartet.arbitration.selectedProposal === "proposalA") {
    return quartet.proposalA;
  }
  if (quartet.arbitration.selectedProposal === "proposalB") {
    return quartet.proposalB;
  }
  throw new Error(
    `french-entity-remediation-arbitration-selection:${quartet.arbitration.unitId}`
  );
}

function assertExactRuntimeKeys(
  value: unknown,
  expected: readonly string[],
  label: string
): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`french-entity-remediation-${label}-object`);
  }
  const actual = Object.keys(value).sort(compareText);
  const wanted = [...expected].sort(compareText);
  if (canonicalFrenchEntityJson(actual) !== canonicalFrenchEntityJson(wanted)) {
    throw new Error(`french-entity-remediation-${label}-keys`);
  }
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === "string" && Boolean(item.trim()))
  );
}

function isStoredStringArray(
  value: unknown,
  requireNonEmpty: boolean,
  hashes: boolean
): value is string[] {
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string" || !item.trim()) ||
    (requireNonEmpty && value.length === 0)
  ) {
    return false;
  }
  const strings = value as string[];
  if (
    canonicalFrenchEntityJson(strings) !==
    canonicalFrenchEntityJson(uniqueSorted(strings.map((item) => item.trim())))
  ) {
    return false;
  }
  return !hashes || strings.every((item) => SHA256_PATTERN.test(item));
}

function assertExactMapKeys<T>(
  map: ReadonlyMap<string, T>,
  expected: readonly string[],
  label: string
): void {
  const actual = [...map.keys()].sort(compareText);
  const wanted = [...expected].sort(compareText);
  if (canonicalFrenchEntityJson(actual) !== canonicalFrenchEntityJson(wanted)) {
    throw new Error(`french-entity-remediation-${label}`);
  }
}

function assertRoundNumber(round: number): void {
  if (
    !Number.isInteger(round) ||
    round < 1 ||
    round > FRENCH_ENTITY_REMEDIATION_MAX_ROUNDS
  ) {
    throw new Error(`french-entity-remediation-round-invalid:${round}`);
  }
}

function assertSha256(value: string, label: string): void {
  if (!SHA256_PATTERN.test(value)) {
    throw new Error(`french-entity-remediation-sha256:${label}`);
  }
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && SHA256_PATTERN.test(value);
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function requiredMap<T>(map: ReadonlyMap<string, T>, key: string): T {
  const value = map.get(key);
  if (value === undefined) {
    throw new Error(`french-entity-remediation-map-missing:${key}`);
  }
  return value;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(canonicalFrenchEntityJson(value)) as T;
}
