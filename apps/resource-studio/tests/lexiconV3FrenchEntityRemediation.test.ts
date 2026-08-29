import assert from "node:assert/strict";
import test from "node:test";

import {
  FRENCH_ENTITY_AGENT_ARBITRATION_SCHEMA_VERSION,
  FRENCH_ENTITY_AGENT_AUDIT_SCHEMA_VERSION,
  FRENCH_ENTITY_AGENT_POLICY_VERSION,
  FRENCH_ENTITY_AGENT_PROPOSAL_SCHEMA_VERSION,
  FRENCH_ENTITY_AGENT_VIEW_SCHEMA_VERSION,
  type FrenchEntityAgentAuditChecks,
  type FrenchEntityAgentProposal,
  type FrenchEntityAgentProposerAView,
  type FrenchEntityAgentProposerBView,
  type FrenchEntityAgentUnitArtifacts
} from "../src/lexiconV3/frenchEntityAgentReview.js";
import {
  FRENCH_ENTITY_CANONICALIZATION_POLICY_VERSION,
  FRENCH_ENTITY_CANONICALIZATION_REVIEW_UNIT_SCHEMA_VERSION,
  canonicalFrenchEntityJson,
  hashFrenchEntityJson,
  type FrenchEntityCanonicalizationReviewUnit
} from "../src/lexiconV3/frenchEntityCanonicalization.js";
import {
  buildFrenchEntityRemediationOverlay,
  buildFrenchEntityRemediationConcordanceResolutionProofs,
  buildFrenchEntityRemediationRoundPlan,
  finalizeFrenchEntityRemediationRound,
  frenchEntityRemediationArbiterInputHash,
  frenchEntityRemediationAuditorInputHash,
  frenchEntityRemediationUnresolvedEvidenceConflictCodes,
  selectFrenchEntityRemediationUnits,
  semanticFrenchEntityProposalHash,
  type FrenchEntityRemediationBaseViews,
  type FrenchEntityRemediationRoundBundle,
  type FrenchEntityRemediationRoundPlanUnit
} from "../src/lexiconV3/frenchEntityRemediation.js";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);
const HASH_D = "d".repeat(64);
const HASH_E = "e".repeat(64);

test("selects exactly hold/block and gives A only codes plus parent hashes", () => {
  const base = fixtureBase();
  assert.deepEqual(
    selectFrenchEntityRemediationUnits(base.artifacts, base.views),
    ["unit:block", "unit:hold"]
  );

  const plan = buildFrenchEntityRemediationRoundPlan({
    round: 1,
    baseViews: base.views,
    currentArtifacts: base.artifacts
  });
  assert.deepEqual(plan.unitIds, ["unit:block", "unit:hold"]);
  assert.equal(
    plan.units.some((unit) => unit.unitId === "unit:safe"),
    false
  );

  for (const unit of plan.units) {
    assert.deepEqual(Object.keys(unit.proposerA.context).sort(), [
      "failedCheckCodes",
      "parentHashes",
      "unitId"
    ]);
    const contextA = JSON.stringify(unit.proposerA.context);
    assert.doesNotMatch(contextA, /Ancienne forme|Forme bloquée|raison/u);
    assert.equal("previousQuartet" in unit.proposerA.context, false);
    assert.equal("previousSelectedProposal" in unit.proposerA.context, false);
    assert.equal("reasons" in unit.proposerA.context, false);
    assert.equal("primaryFr" in unit.proposerA.context, false);
    assert.equal("derivedFr" in unit.proposerA.context, false);
    assert.deepEqual(Object.keys(unit.proposerA.context.parentHashes).sort(), [
      "baseViewHash",
      "previousAuditHash",
      "previousQuartetHash",
      "previousRoundHash",
      "previousSemanticProposalHash",
      "rejectedSemanticProposalHashes"
    ]);
    assert.match(JSON.stringify(unit.proposerB.context), /raison/u);
    assert.match(
      JSON.stringify(unit.proposerB.context),
      /Ancienne forme|Forme bloquée/u
    );
    const basePair = base.views.get(unit.unitId);
    assert.ok(basePair);
    assert.notEqual(unit.proposerA.view, basePair.proposerA);
    assert.notEqual(unit.proposerB.view, basePair.proposerB);
    assert.equal(
      canonicalFrenchEntityJson(unit.proposerA.view),
      canonicalFrenchEntityJson(basePair.proposerA)
    );
    assert.equal(
      canonicalFrenchEntityJson(unit.proposerB.view),
      canonicalFrenchEntityJson(basePair.proposerB)
    );
  }
});

test("rejects a rehashed safe quartet whose audit check contract is incomplete", () => {
  const forged = baseQuartet("unit:forged-safe", "safe", "Forme sûre", "");
  (forged.audit as unknown as { checks: Record<string, string> }).checks = {};
  const { auditHash: _auditHash, ...auditContent } = forged.audit;
  void _auditHash;
  forged.audit.auditHash = hashFrenchEntityJson(auditContent);

  assert.throws(
    () =>
      selectFrenchEntityRemediationUnits(
        new Map([["unit:forged-safe", forged]]),
        singletonViews("unit:forged-safe")
      ),
    /audit/u
  );
});

test("rejects rehashed unknown member-policy discriminants before remediation selection", () => {
  const forged = baseQuartet("unit:forged-policy", "safe", "Forme sûre", "");
  const member = forged.proposalA.memberPolicies[0];
  assert.ok(member);
  (member as unknown as { treatment: string }).treatment =
    "invented-runtime-treatment";
  const { proposalHash: _proposalHash, ...proposalContent } = forged.proposalA;
  void _proposalHash;
  forged.proposalA.proposalHash = hashFrenchEntityJson(proposalContent);
  forged.arbitration.selectedProposalHash = forged.proposalA.proposalHash;
  const { arbitrationHash: _arbitrationHash, ...arbitrationContent } =
    forged.arbitration;
  void _arbitrationHash;
  forged.arbitration.arbitrationHash = hashFrenchEntityJson(arbitrationContent);
  forged.audit.auditedProposalHash = forged.proposalA.proposalHash;
  const { auditHash: _auditHash, ...auditContent } = forged.audit;
  void _auditHash;
  forged.audit.auditHash = hashFrenchEntityJson(auditContent);

  assert.throws(
    () =>
      selectFrenchEntityRemediationUnits(
        new Map([["unit:forged-policy", forged]]),
        singletonViews("unit:forged-policy")
      ),
    /proposal|member|treatment/u
  );
});

test("rejects a rehashed safe quartet whose proposals have empty coverage", () => {
  const forged = baseQuartet("unit:empty-proposals", "safe", "Forme sûre", "");
  for (const proposal of [forged.proposalA, forged.proposalB]) {
    proposal.canonicalEntities = [];
    proposal.memberPolicies = [];
    const { proposalHash: _proposalHash, ...proposalContent } = proposal;
    void _proposalHash;
    proposal.proposalHash = hashFrenchEntityJson(proposalContent);
  }
  forged.arbitration.selectedProposalHash = forged.proposalA.proposalHash;
  const { arbitrationHash: _arbitrationHash, ...arbitrationContent } =
    forged.arbitration;
  void _arbitrationHash;
  forged.arbitration.arbitrationHash = hashFrenchEntityJson(arbitrationContent);
  forged.audit.auditedProposalHash = forged.proposalA.proposalHash;
  const { auditHash: _auditHash, ...auditContent } = forged.audit;
  void _auditHash;
  forged.audit.auditHash = hashFrenchEntityJson(auditContent);

  assert.throws(
    () =>
      selectFrenchEntityRemediationUnits(
        new Map([["unit:empty-proposals", forged]]),
        singletonViews("unit:empty-proposals")
      ),
    /proposal|coverage|member|entit/u
  );
});

test("rejects a rehashed safe proposal whose binding has no canonical entity", () => {
  const forged = baseQuartet("unit:orphan-binding", "safe", "Forme sûre", "");
  forged.proposalA.canonicalEntities = [];
  const { proposalHash: _proposalHash, ...proposalContent } = forged.proposalA;
  void _proposalHash;
  forged.proposalA.proposalHash = hashFrenchEntityJson(proposalContent);
  forged.arbitration.selectedProposalHash = forged.proposalA.proposalHash;
  const { arbitrationHash: _arbitrationHash, ...arbitrationContent } =
    forged.arbitration;
  void _arbitrationHash;
  forged.arbitration.arbitrationHash = hashFrenchEntityJson(arbitrationContent);
  forged.audit.auditedProposalHash = forged.proposalA.proposalHash;
  const { auditHash: _auditHash, ...auditContent } = forged.audit;
  void _auditHash;
  forged.audit.auditHash = hashFrenchEntityJson(auditContent);

  assert.throws(
    () =>
      selectFrenchEntityRemediationUnits(
        new Map([["unit:orphan-binding", forged]]),
        singletonViews("unit:orphan-binding")
      ),
    /proposal|coverage|binding|entit/u
  );
});

test("accepts an unbound alternate-name only when the base view proves an exact proper-name spelling", () => {
  const qualifying = unboundAlternateFixture("no-entity:hebrew:H7774H", true);
  assert.deepEqual(
    selectFrenchEntityRemediationUnits(
      new Map([[qualifying.unitId, qualifying.quartet]]),
      new Map([[qualifying.unitId, qualifying.views]])
    ),
    [qualifying.unitId]
  );

  const arbitrary = unboundAlternateFixture(
    "no-entity:hebrew:H7774H-arbitrary",
    false
  );
  assert.throws(
    () =>
      selectFrenchEntityRemediationUnits(
        new Map([[arbitrary.unitId, arbitrary.quartet]]),
        new Map([[arbitrary.unitId, arbitrary.views]])
      ),
    /french-entity-remediation-proposal-binding-coverage/u
  );
});

test("semantic hash ignores runtime/reasons/evidence but covers every French decision", () => {
  const first = proposal("unit:semantic", "proposerA", HASH_A, "Abiézer", {
    treatment: "alternate-name",
    relation: "alias",
    derivedFr: "Abiézerite",
    allowedFrenchForms: ["Abiézerite"],
    evidenceHashes: [HASH_A],
    reasons: ["première raison"],
    englishForms: ["Abiezer"]
  });
  const traceOnly = proposal("unit:semantic", "proposerB", HASH_B, "Abiézer", {
    treatment: "alternate-name",
    relation: "alias",
    derivedFr: "Abiézerite",
    allowedFrenchForms: ["Abiézerite"],
    evidenceHashes: [HASH_B, HASH_C],
    reasons: ["autre explication"],
    englishForms: ["un autre témoin anglais"]
  });
  assert.equal(
    semanticFrenchEntityProposalHash(first),
    semanticFrenchEntityProposalHash(traceOnly)
  );

  for (const changed of [
    proposal("unit:semantic", "proposerA", HASH_A, "Abiézé", {
      treatment: "alternate-name",
      relation: "alias",
      derivedFr: "Abiézerite",
      allowedFrenchForms: ["Abiézerite"]
    }),
    proposal("unit:semantic", "proposerA", HASH_A, "Abiézer", {
      treatment: "alternate-name",
      relation: "alias",
      derivedFr: "Abiézérite",
      allowedFrenchForms: ["Abiézérite"]
    }),
    proposal("unit:semantic", "proposerA", HASH_A, "Abiézer", {
      treatment: "canonical-name",
      relation: "primary",
      derivedFr: null,
      allowedFrenchForms: ["Abiézer"]
    })
  ]) {
    assert.notEqual(
      semanticFrenchEntityProposalHash(first),
      semanticFrenchEntityProposalHash(changed)
    );
  }
});

test("seals the four observed deterministic concordance derivations and rejects rehashed proof drift", () => {
  const cases = [
    {
      entryKey: "hebrew:H0045",
      selectedFrench: "Abi-Albon",
      proofClass: "exact-component-composition",
      surfaces: ["Abi", "Albon"],
      treatment: "canonical-name" as const
    },
    {
      entryKey: "hebrew:H0137",
      selectedFrench: "Adoni-Bézek",
      proofClass: "exact-component-composition",
      surfaces: ["Adoni", "Bézek"],
      treatment: "canonical-name" as const
    },
    {
      entryKey: "hebrew:H0139",
      selectedFrench: "Adoni-Tsédek",
      proofClass: "exact-component-composition",
      surfaces: ["Adoni", "Tsédek"],
      treatment: "canonical-name" as const
    },
    {
      entryKey: "hebrew:H0373",
      selectedFrench: "Jézerite",
      proofClass: "exact-plural-s-to-singular",
      surfaces: ["Jézerites"],
      treatment: "gentilic" as const
    }
  ];
  for (const value of cases) {
    const fixture = concordanceProofFixture(value);
    const proofs =
      buildFrenchEntityRemediationConcordanceResolutionProofs(fixture);
    assert.equal(proofs.length, 1, value.entryKey);
    assert.equal(proofs[0]?.proofClass, value.proofClass);
    assert.deepEqual(
      proofs[0]?.witnesses.map((witness) => witness.surface),
      value.surfaces
    );
    assert.deepEqual(
      frenchEntityRemediationUnresolvedEvidenceConflictCodes({
        ...fixture,
        proofs
      }),
      []
    );
  }

  const fixture = concordanceProofFixture(cases[1]!);
  const forged = structuredClone(
    buildFrenchEntityRemediationConcordanceResolutionProofs(fixture)
  );
  forged[0]!.witnesses[0]!.surface = "Forme forgée";
  const { proofHash: _proofHash, ...proofContent } = forged[0]!;
  void _proofHash;
  forged[0]!.proofHash = hashFrenchEntityJson(proofContent);
  assert.throws(
    () =>
      frenchEntityRemediationUnresolvedEvidenceConflictCodes({
        ...fixture,
        proofs: forged
      }),
    /concordance-proof-replay/u
  );
});

test("proofs never erase ambiguous STEP attachment or proper-name/lexical conflicts", () => {
  const ambiguous = concordanceProofFixture({
    entryKey: "hebrew:H0137",
    selectedFrench: "Adoni-Bézek",
    surfaces: ["Adoni", "Bézek"],
    treatment: "canonical-name"
  });
  ambiguous.sourceView.members[0]!.englishGloss = "lord of Bezek";
  const { viewHash: _viewHash, ...viewContent } = ambiguous.sourceView;
  void _viewHash;
  ambiguous.sourceView.viewHash = hashFrenchEntityJson(viewContent);
  const proofs =
    buildFrenchEntityRemediationConcordanceResolutionProofs(ambiguous);
  assert.deepEqual(
    frenchEntityRemediationUnresolvedEvidenceConflictCodes({
      ...ambiguous,
      proofs
    }),
    ["hebrew:H0137:ambiguous-step-entity-attachment"]
  );

  const lexical = concordanceProofFixture({
    entryKey: "hebrew:H0044I",
    selectedFrench: "Abiézer",
    surfaces: ["Abiézer", "aider"],
    treatment: "canonical-name"
  });
  assert.deepEqual(
    frenchEntityRemediationUnresolvedEvidenceConflictCodes(lexical),
    ["hebrew:H0044I:proper-name-vs-lexical-concordance-conflict"]
  );
});

test("treats an exact controlled name surface as orthographic evidence without normalizing near-matches", () => {
  const exact = concordanceProofFixture({
    entryKey: "hebrew:H4918H",
    selectedFrench: "Meschullam",
    surfaces: ["Meschullam", "Meshullam"],
    treatment: "canonical-name"
  });
  const proofs = buildFrenchEntityRemediationConcordanceResolutionProofs(exact);
  assert.equal(proofs.length, 1);
  assert.equal(proofs[0]?.proofClass, "exact-controlled-concordance-spelling");
  assert.deepEqual(
    proofs[0]?.witnesses.map((witness) => witness.surface),
    ["Meschullam"]
  );

  const accentDrift = concordanceProofFixture({
    entryKey: "hebrew:H3454",
    selectedFrench: "Jéshishaï",
    surfaces: ["Jeshishaï"],
    treatment: "canonical-name"
  });
  assert.deepEqual(
    buildFrenchEntityRemediationConcordanceResolutionProofs(accentDrift),
    []
  );

  const ambiguous = structuredClone(exact);
  ambiguous.sourceView.members[0]!.englishGloss = "a descendant of Meshullam";
  const { viewHash: _viewHash, ...viewContent } = ambiguous.sourceView;
  void _viewHash;
  ambiguous.sourceView.viewHash = hashFrenchEntityJson(viewContent);
  assert.deepEqual(
    buildFrenchEntityRemediationConcordanceResolutionProofs(ambiguous),
    []
  );
  assert.deepEqual(
    frenchEntityRemediationUnresolvedEvidenceConflictCodes(ambiguous),
    ["hebrew:H4918H:ambiguous-step-entity-attachment"]
  );
});

test("an exact spelling proof may close an unchanged historical-only block", () => {
  const unitId = "unit:H4918H";
  const { views, quartet } = exactSpellingClosureFixture(unitId);
  const plan = buildFrenchEntityRemediationRoundPlan({
    round: 1,
    baseViews: new Map([[unitId, views]]),
    currentArtifacts: new Map([[unitId, quartet]])
  });
  const unit = requiredUnit(plan.units, unitId);
  assert.deepEqual(unit.proposerB.context.failedCheckCodes, [
    "historicalWitnessNotSoleAuthority"
  ]);
  assert.equal(unit.concordanceResolutionProofs.length, 1);
  assert.equal(
    unit.concordanceResolutionProofs[0]?.proofClass,
    "exact-controlled-concordance-spelling"
  );
  const result = finalizeFrenchEntityRemediationRound({
    plan,
    artifacts: new Map([
      [unitId, remediationQuartet(unit, "safe", "Meschullam")]
    ])
  });
  assert.deepEqual(result.residualUnitIds, []);
});

test("accepts exact STEP preservation only for an autonomous five-digit LXX name", () => {
  const fixture = autonomousLxxNameFixture();

  assert.deepEqual(
    frenchEntityRemediationUnresolvedEvidenceConflictCodes(fixture),
    ["greek:G21458:selected-french-form-without-concordance"]
  );
  assert.deepEqual(
    buildFrenchEntityRemediationConcordanceResolutionProofs(fixture),
    []
  );
  const proofs = buildFrenchEntityRemediationConcordanceResolutionProofs({
    ...fixture,
    allowAutonomousLxxNamePreservation: true
  });
  assert.equal(proofs.length, 1);
  assert.equal(
    proofs[0]?.proofClass,
    "exact-autonomous-lxx-name-preservation"
  );
  assert.deepEqual(proofs[0]?.witnesses, []);
  assert.deepEqual(
    frenchEntityRemediationUnresolvedEvidenceConflictCodes({
      ...fixture,
      proofs
    }),
    []
  );

  const rewritten = structuredClone(fixture);
  rewritten.selectedProposal.memberPolicies[0]!.derivedFr = "Kinan";
  rewritten.selectedProposal.memberPolicies[0]!.allowedFrenchForms = ["Kinan"];
  const { proposalHash: _proposalHash, ...proposalContent } =
    rewritten.selectedProposal;
  void _proposalHash;
  rewritten.selectedProposal.proposalHash =
    hashFrenchEntityJson(proposalContent);
  assert.deepEqual(
    frenchEntityRemediationUnresolvedEvidenceConflictCodes(rewritten),
    ["greek:G21458:selected-french-form-without-concordance"]
  );
});

test("a sealed component proof may close the unchanged legitimate lemma, but plan proof tampering fails", () => {
  const unitId = "unit:H0137";
  const { views, quartet } = componentClosureFixture(unitId);
  const plan = buildFrenchEntityRemediationRoundPlan({
    round: 1,
    baseViews: new Map([[unitId, views]]),
    currentArtifacts: new Map([[unitId, quartet]])
  });
  const unit = requiredUnit(plan.units, unitId);
  assert.equal(unit.concordanceResolutionProofs.length, 1);
  const result = finalizeFrenchEntityRemediationRound({
    plan,
    artifacts: new Map([
      [unitId, remediationQuartet(unit, "safe", "Adoni-Bézek")]
    ])
  });
  assert.deepEqual(result.residualUnitIds, []);

  const forged = structuredClone(plan);
  forged.units[0]!.concordanceResolutionProofs[0]!.selectedFrench =
    "Adoni-Forgé";
  const proof = forged.units[0]!.concordanceResolutionProofs[0]!;
  const { proofHash: _proofHash, ...proofContent } = proof;
  void _proofHash;
  proof.proofHash = hashFrenchEntityJson(proofContent);
  const planUnit = forged.units[0]!;
  const { unitHash: _unitHash, ...unitContent } = planUnit;
  void _unitHash;
  planUnit.unitHash = hashFrenchEntityJson(unitContent);
  const { planHash: _planHash, ...planContent } = forged;
  void _planHash;
  forged.planHash = hashFrenchEntityJson(planContent);
  assert.throws(
    () =>
      finalizeFrenchEntityRemediationRound({
        plan: forged,
        artifacts: new Map([
          [unitId, remediationQuartet(forged.units[0]!, "safe", "Adoni-Bézek")]
        ])
      }),
    /plan-parent/u
  );
});

test("a sealed concordance derivation may close every previous failure it exactly resolves", () => {
  const unitId = "unit:H0137:block";
  const { views, quartet } = componentClosureFixture(unitId);
  quartet.audit.verdict = "block";
  quartet.audit.checks.historicalWitnessNotSoleAuthority = "fail";
  quartet.audit.reasons = [
    "composition exacte non encore prouvée",
    "aucun témoin composé indépendant"
  ];
  const { auditHash: _auditHash, ...auditContent } = quartet.audit;
  void _auditHash;
  quartet.audit.auditHash = hashFrenchEntityJson(auditContent);

  const plan = buildFrenchEntityRemediationRoundPlan({
    round: 1,
    baseViews: new Map([[unitId, views]]),
    currentArtifacts: new Map([[unitId, quartet]])
  });
  const unit = requiredUnit(plan.units, unitId);
  assert.deepEqual(unit.proposerB.context.failedCheckCodes, [
    "canonicalPrimaryCoherence",
    "historicalWitnessNotSoleAuthority"
  ]);
  assert.equal(
    unit.concordanceResolutionProofs[0]?.proofClass,
    "exact-component-composition"
  );
  const result = finalizeFrenchEntityRemediationRound({
    plan,
    artifacts: new Map([
      [unitId, remediationQuartet(unit, "safe", "Adoni-Bézek")]
    ])
  });
  assert.deepEqual(result.residualUnitIds, []);
});

test("neither unchanged hold nor unchanged block can close safe without a sealed resolving proof", () => {
  const holdBase = new Map([
    [
      "unit:hold",
      baseQuartet("unit:hold", "hold", "Ancienne forme", "raison hold")
    ]
  ]);
  const holdViews = new Map([["unit:hold", baseViews("unit:hold")]]);
  const holdPlan = buildFrenchEntityRemediationRoundPlan({
    round: 1,
    baseViews: holdViews,
    currentArtifacts: holdBase
  });
  const holdUnit = requiredUnit(holdPlan.units, "unit:hold");
  const unchangedSafe = remediationQuartet(holdUnit, "safe", "Ancienne forme");
  assert.throws(
    () =>
      finalizeFrenchEntityRemediationRound({
        plan: holdPlan,
        artifacts: new Map([["unit:hold", unchangedSafe]])
      }),
    /unchanged-cannot-close:unit:hold:hold/u
  );

  const changedHoldSafe = remediationQuartet(
    holdUnit,
    "safe",
    "Forme réellement corrigée"
  );
  assert.throws(
    () =>
      finalizeFrenchEntityRemediationRound({
        plan: holdPlan,
        artifacts: new Map([["unit:hold", changedHoldSafe]])
      }),
    /safe-evidence-conflict:unit:hold/u
  );

  const blockBase = new Map([
    [
      "unit:block",
      baseQuartet("unit:block", "block", "Forme bloquée", "raison block")
    ]
  ]);
  const blockPlan = buildFrenchEntityRemediationRoundPlan({
    round: 1,
    baseViews: new Map([["unit:block", baseViews("unit:block")]]),
    currentArtifacts: blockBase
  });
  const unchangedBlockSafe = remediationQuartet(
    requiredUnit(blockPlan.units, "unit:block"),
    "safe",
    "Forme bloquée"
  );
  assert.throws(
    () =>
      finalizeFrenchEntityRemediationRound({
        plan: blockPlan,
        artifacts: new Map([["unit:block", unchangedBlockSafe]])
      }),
    /unchanged-cannot-close:unit:block:block/u
  );
});

test("a later round cannot recycle an earlier rejected semantic proposal", () => {
  const unitId = "unit:cycle";
  const baseQuartetValue = baseQuartet(
    unitId,
    "hold",
    "Forme X",
    "raison initiale"
  );
  const views = new Map([[unitId, baseViews(unitId)]]);
  const round1Plan = buildFrenchEntityRemediationRoundPlan({
    round: 1,
    baseViews: views,
    currentArtifacts: new Map([[unitId, baseQuartetValue]])
  });
  const round1Result = finalizeFrenchEntityRemediationRound({
    plan: round1Plan,
    artifacts: new Map([
      [
        unitId,
        remediationQuartet(
          requiredUnit(round1Plan.units, unitId),
          "hold",
          "Forme Y"
        )
      ]
    ])
  });
  const round1 = { plan: round1Plan, result: round1Result };
  const round2Plan = buildFrenchEntityRemediationRoundPlan({
    round: 2,
    baseViews: views,
    currentArtifacts: new Map([[unitId, round1Result.unitResults[0]!.quartet]]),
    previousRound: round1
  });
  const rejected = requiredUnit(round2Plan.units, unitId).proposerA.context
    .parentHashes.rejectedSemanticProposalHashes;
  assert.equal(rejected.length, 2);
  assert.equal(
    rejected.includes(
      semanticFrenchEntityProposalHash(baseQuartetValue.proposalA)
    ),
    true
  );

  assert.throws(
    () =>
      finalizeFrenchEntityRemediationRound({
        plan: round2Plan,
        artifacts: new Map([
          [
            unitId,
            remediationQuartet(
              requiredUnit(round2Plan.units, unitId),
              "safe",
              "Forme X"
            )
          ]
        ])
      }),
    /rejected-semantic-cannot-close:unit:cycle/u
  );
});

test("hashed rounds shrink to residuals and terminal overlay preserves base-safe units", () => {
  const base = fixtureBase();
  addExactConcordanceForms(base.views, "unit:hold", [
    "Forme hold corrigée"
  ]);
  addExactConcordanceForms(base.views, "unit:block", [
    "Forme bloc v2",
    "Forme bloc v3"
  ]);
  const round1Plan = buildFrenchEntityRemediationRoundPlan({
    round: 1,
    baseViews: base.views,
    currentArtifacts: base.artifacts
  });
  const round1Artifacts = new Map<string, FrenchEntityAgentUnitArtifacts>([
    [
      "unit:block",
      remediationQuartet(
        requiredUnit(round1Plan.units, "unit:block"),
        "hold",
        "Forme bloc v2"
      )
    ],
    [
      "unit:hold",
      remediationQuartet(
        requiredUnit(round1Plan.units, "unit:hold"),
        "safe",
        "Forme hold corrigée"
      )
    ]
  ]);
  const round1Result = finalizeFrenchEntityRemediationRound({
    plan: round1Plan,
    artifacts: round1Artifacts
  });
  assert.deepEqual(round1Result.residualUnitIds, ["unit:block"]);
  const round1 = { plan: round1Plan, result: round1Result };

  const afterRound1 = new Map(base.artifacts);
  for (const result of round1Result.unitResults) {
    afterRound1.set(result.unitId, result.quartet);
  }
  const round2Plan = buildFrenchEntityRemediationRoundPlan({
    round: 2,
    baseViews: base.views,
    currentArtifacts: afterRound1,
    previousRound: round1
  });
  assert.deepEqual(round2Plan.unitIds, ["unit:block"]);
  assert.equal(round2Plan.parentRoundHash, round1Result.roundHash);
  const terminalBlock = remediationQuartet(
    requiredUnit(round2Plan.units, "unit:block"),
    "safe",
    "Forme bloc v3"
  );
  const round2Result = finalizeFrenchEntityRemediationRound({
    plan: round2Plan,
    artifacts: new Map([["unit:block", terminalBlock]])
  });
  const round2 = { plan: round2Plan, result: round2Result };

  const baseSafe = base.artifacts.get("unit:safe");
  const overlay = buildFrenchEntityRemediationOverlay({
    baseArtifacts: base.artifacts,
    baseViews: base.views,
    rounds: [round1, round2]
  });
  assert.equal(overlay.artifacts.get("unit:safe"), baseSafe);
  assert.equal(
    overlay.artifacts.get("unit:block"),
    round2Result.unitResults[0]!.quartet
  );
  assert.equal(overlay.terminalRoundByUnit.get("unit:hold"), 1);
  assert.equal(overlay.terminalRoundByUnit.get("unit:block"), 2);
  assert.deepEqual(overlay.remediatedUnitIds, ["unit:block", "unit:hold"]);
  assert.deepEqual(overlay.safeUnitIds, [
    "unit:block",
    "unit:hold",
    "unit:safe"
  ]);
  assert.deepEqual(overlay.quarantinedUnitIds, []);
  assert.match(overlay.overlayHash, /^[a-f0-9]{64}$/u);

  assert.throws(
    () =>
      buildFrenchEntityRemediationOverlay({
        baseArtifacts: base.artifacts,
        baseViews: base.views,
        rounds: [round1]
      }),
    /residual-forbidden/u
  );
});

test("third round seals remaining residue as quarantine and forged chain hashes fail closed", () => {
  const unitId = "unit:hold";
  const views = new Map([[unitId, baseViews(unitId)]]);
  const baseArtifacts = new Map([
    [unitId, baseQuartet(unitId, "hold", "v0", "raison")]
  ]);
  let current = new Map(baseArtifacts);
  let previous: FrenchEntityRemediationRoundBundle | undefined;
  const bundles: FrenchEntityRemediationRoundBundle[] = [];
  for (const round of [1, 2] as const) {
    const plan = buildFrenchEntityRemediationRoundPlan({
      round,
      baseViews: views,
      currentArtifacts: current,
      ...(previous ? { previousRound: previous } : {})
    });
    const result = finalizeFrenchEntityRemediationRound({
      plan,
      artifacts: new Map([
        [
          unitId,
          remediationQuartet(
            requiredUnit(plan.units, unitId),
            "hold",
            `v${round}`
          )
        ]
      ])
    });
    previous = { plan, result };
    bundles.push(previous);
    current = new Map([[unitId, result.unitResults[0]!.quartet]]);
  }
  const round3Plan = buildFrenchEntityRemediationRoundPlan({
    round: 3,
    baseViews: views,
    currentArtifacts: current,
    previousRound: previous
  });
  const round3Result = finalizeFrenchEntityRemediationRound({
    plan: round3Plan,
    artifacts: new Map([
      [
        unitId,
        remediationQuartet(
          requiredUnit(round3Plan.units, unitId),
          "hold",
          "v3"
        )
      ]
    ])
  });
  const terminal = buildFrenchEntityRemediationOverlay({
    baseArtifacts,
    baseViews: views,
    rounds: [...bundles, { plan: round3Plan, result: round3Result }]
  });
  assert.deepEqual(terminal.safeUnitIds, []);
  assert.deepEqual(terminal.quarantinedUnitIds, [unitId]);

  const forgedRound1 = structuredClone(bundles[0]!);
  forgedRound1.result.roundHash = HASH_E;
  assert.throws(
    () =>
      buildFrenchEntityRemediationOverlay({
        baseArtifacts,
        baseViews: views,
        rounds: [forgedRound1]
      }),
    /round-result-hash/u
  );
});

function fixtureBase(): {
  artifacts: Map<string, FrenchEntityAgentUnitArtifacts>;
  views: Map<string, FrenchEntityRemediationBaseViews>;
} {
  const artifacts = new Map<string, FrenchEntityAgentUnitArtifacts>([
    ["unit:safe", baseQuartet("unit:safe", "safe", "Forme sûre", "")],
    [
      "unit:hold",
      baseQuartet("unit:hold", "hold", "Ancienne forme", "raison hold")
    ],
    [
      "unit:block",
      baseQuartet("unit:block", "block", "Forme bloquée", "raison block")
    ]
  ]);
  return {
    artifacts,
    views: new Map(
      [...artifacts.keys()].map((unitId) => [unitId, baseViews(unitId)])
    )
  };
}

function addExactConcordanceForms(
  views: Map<string, FrenchEntityRemediationBaseViews>,
  unitId: string,
  surfaces: string[]
): void {
  const view = views.get(unitId)?.proposerB;
  assert.ok(view);
  const witnesses = view.frenchWitnesses["hebrew:H0033"];
  assert.ok(witnesses);
  witnesses.concordanceForms = surfaces.map((surface) => ({
    count: 1,
    normalized: surface.toLocaleLowerCase("fr"),
    sources: ["Darby", "Sg1910"],
    strongCount: 1,
    surface,
    witnessFamilies: ["Darby-family", "Sg1910"]
  }));
  const { viewHash: _viewHash, ...content } = view;
  void _viewHash;
  view.viewHash = hashFrenchEntityJson(content);
}

function unboundAlternateFixture(
  unitId: string,
  qualifying: boolean
): {
  unitId: string;
  views: FrenchEntityRemediationBaseViews;
  quartet: FrenchEntityAgentUnitArtifacts;
} {
  const views = structuredClone(baseViews(unitId));
  for (const view of [views.proposerA, views.proposerB]) {
    view.ownerEntityIds = [];
    view.reviewUnit.kind = "no-entity";
    view.reviewUnit.entityIds = [];
    view.reviewUnit.memberEntryKeys = ["hebrew:H7774H"];
    view.reviewUnit.anchorEntryKeys = [];
    view.reviewUnit.reviewEntryKeys = ["hebrew:H7774H"];
    const member = view.members[0];
    assert.ok(member);
    member.entryKey = "hebrew:H7774H";
    member.identity = {
      stepEntryId: 21485,
      language: "hebrew",
      eStrong: "H7774",
      dStrong: qualifying ? "H7774H = a Spelling of" : "H7774H =",
      primaryDStrong: "H7774H",
      uStrong: "H7770",
      original: "שׁוּעָא",
      transliteration: "shu.a",
      morph: "N:N-F-P"
    };
    member.englishGloss = "Shua";
    member.entityIds = [];
    member.englishEntityMatches = [];
    member.englishEntityForms = ["Shua"];
    member.initialTreatment = "unresolved";
    member.initialConstraint = "blocked";
    const { unitHash: _unitHash, ...reviewContent } = view.reviewUnit;
    void _unitHash;
    view.reviewUnit.unitHash = hashFrenchEntityJson(reviewContent);
    const { viewHash: _viewHash, ...viewContent } = view;
    void _viewHash;
    view.viewHash = hashFrenchEntityJson(viewContent);
  }
  views.proposerB.frenchWitnesses = {
    "hebrew:H7774H": {
      authority: "non-authoritative-review-witness-only",
      candidateFrenchForms: ["Shua"],
      concordanceForms: [],
      historicalFrenchGloss: null
    }
  };
  const { viewHash: _viewHash, ...viewContent } = views.proposerB;
  void _viewHash;
  views.proposerB.viewHash = hashFrenchEntityJson(viewContent);

  const proposalA = unboundAlternateProposal(unitId, "proposerA", HASH_A);
  const proposalB = unboundAlternateProposal(unitId, "proposerB", HASH_B);
  const arbitrationContent = {
    schemaVersion: FRENCH_ENTITY_AGENT_ARBITRATION_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_AGENT_POLICY_VERSION,
    role: "arbiter" as const,
    unitId,
    inputHash: HASH_C,
    selectedProposal: "proposalA" as const,
    selectedProposalHash: proposalA.proposalHash,
    reasons: ["sélection A"]
  };
  const arbitration = {
    ...arbitrationContent,
    arbitrationHash: hashFrenchEntityJson(arbitrationContent)
  };
  const auditContent = {
    schemaVersion: FRENCH_ENTITY_AGENT_AUDIT_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_AGENT_POLICY_VERSION,
    role: "auditor" as const,
    unitId,
    inputHash: HASH_D,
    auditedProposalHash: proposalA.proposalHash,
    verdict: "hold" as const,
    checks: auditChecks("hold"),
    reasons: ["forme à remédier"]
  };
  const audit = {
    ...auditContent,
    auditHash: hashFrenchEntityJson(auditContent)
  };
  return {
    unitId,
    views,
    quartet: { proposalA, proposalB, arbitration, audit }
  };
}

function unboundAlternateProposal(
  unitId: string,
  role: "proposerA" | "proposerB",
  inputHash: string
): FrenchEntityAgentProposal {
  const content = {
    schemaVersion: FRENCH_ENTITY_AGENT_PROPOSAL_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_AGENT_POLICY_VERSION,
    role,
    unitId,
    inputHash,
    canonicalEntities: [],
    memberPolicies: [
      {
        entryKey: "hebrew:H7774H",
        treatment: "alternate-name" as const,
        entityBindings: [],
        constraint: "derived" as const,
        primaryFr: null,
        derivedFr: "Shua",
        englishForms: ["Shua"],
        allowedFrenchForms: ["Shua"],
        evidenceHashes: [HASH_A],
        reasons: ["variante orthographique STEP exacte"]
      }
    ]
  };
  return { ...content, proposalHash: hashFrenchEntityJson(content) };
}

function concordanceProofFixture(value: {
  entryKey: string;
  selectedFrench: string;
  surfaces: string[];
  treatment: "canonical-name" | "gentilic";
}): {
  sourceView: FrenchEntityAgentProposerBView;
  selectedProposal: FrenchEntityAgentProposal;
} {
  const unitId = `proof:${value.entryKey}`;
  const sourceView = structuredClone(baseViews(unitId).proposerB);
  sourceView.reviewUnit.reviewEntryKeys = [value.entryKey];
  sourceView.reviewUnit.memberEntryKeys = [value.entryKey];
  const { unitHash: _unitHash, ...unitContent } = sourceView.reviewUnit;
  void _unitHash;
  sourceView.reviewUnit.unitHash = hashFrenchEntityJson(unitContent);
  const member = sourceView.members[0]!;
  member.entryKey = value.entryKey;
  member.englishGloss = value.selectedFrench;
  member.englishEntityForms = [value.selectedFrench];
  member.englishEntityMatches[0]!.aliasEn = value.selectedFrench;
  member.englishEntityMatches[0]!.entityEn = value.selectedFrench;
  member.identity.dStrong = `${value.entryKey.slice(-5)} =${
    value.treatment === "gentilic" ? " a group of" : ""
  }`;
  sourceView.frenchWitnesses = {
    [value.entryKey]: {
      authority: "non-authoritative-review-witness-only",
      candidateFrenchForms: [value.selectedFrench],
      concordanceForms: value.surfaces.map((surface) => ({
        count: 1,
        normalized: surface.toLocaleLowerCase("fr"),
        sources:
          value.treatment === "gentilic" ? ["Sg1910"] : ["Darby", "Sg1910"],
        strongCount: 1,
        surface,
        witnessFamilies:
          value.treatment === "gentilic"
            ? ["Sg1910"]
            : ["Darby-family", "Sg1910"]
      })),
      historicalFrenchGloss: null
    }
  };
  const { viewHash: _viewHash, ...viewContent } = sourceView;
  void _viewHash;
  sourceView.viewHash = hashFrenchEntityJson(viewContent);
  const selectedProposal = proposal(
    unitId,
    "proposerA",
    HASH_A,
    value.treatment === "gentilic" ? "Abiézer" : value.selectedFrench,
    {
      treatment: value.treatment,
      relation: value.treatment === "gentilic" ? "gentilic" : "primary",
      entryKey: value.entryKey,
      derivedFr: value.treatment === "gentilic" ? value.selectedFrench : null,
      allowedFrenchForms: [value.selectedFrench]
    }
  );
  return { sourceView, selectedProposal };
}

function autonomousLxxNameFixture(): {
  sourceView: FrenchEntityAgentProposerBView;
  selectedProposal: FrenchEntityAgentProposal;
} {
  const unitId = "no-entity:greek:G21458";
  const sourceView = structuredClone(baseViews(unitId).proposerB);
  sourceView.ownerEntityIds = [];
  sourceView.entityGroups = [];
  sourceView.anchoredEntities = [];
  sourceView.reviewUnit.kind = "no-entity";
  sourceView.reviewUnit.entityIds = [];
  sourceView.reviewUnit.memberEntryKeys = ["greek:G21458"];
  sourceView.reviewUnit.reviewEntryKeys = ["greek:G21458"];
  sourceView.reviewUnit.groupProofHashes = [];
  const { unitHash: _unitHash, ...unitContent } = sourceView.reviewUnit;
  void _unitHash;
  sourceView.reviewUnit.unitHash = hashFrenchEntityJson(unitContent);
  const member = sourceView.members[0]!;
  member.entryKey = "greek:G21458";
  member.stepEntryId = 10991;
  member.identity = {
    stepEntryId: 10991,
    language: "greek",
    eStrong: "G21458",
    dStrong: "G21458 =",
    primaryDStrong: "G21458",
    uStrong: "G21458",
    original: "Κιναν",
    transliteration: "",
    morph: "G:N-PRI"
  };
  member.englishGloss = "Cimath";
  member.entityIds = [];
  member.englishEntityMatches = [];
  member.englishEntityForms = [];
  member.initialTreatment = "unresolved";
  member.initialConstraint = "blocked";
  sourceView.frenchWitnesses = {
    "greek:G21458": {
      authority: "non-authoritative-review-witness-only",
      candidateFrenchForms: [],
      concordanceForms: [],
      historicalFrenchGloss: "Cimath"
    }
  };
  const { viewHash: _viewHash, ...viewContent } = sourceView;
  void _viewHash;
  sourceView.viewHash = hashFrenchEntityJson(viewContent);
  const proposalContent = {
    schemaVersion: FRENCH_ENTITY_AGENT_PROPOSAL_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_AGENT_POLICY_VERSION,
    role: "proposerA" as const,
    unitId,
    inputHash: HASH_A,
    canonicalEntities: [],
    memberPolicies: [
      {
        entryKey: "greek:G21458",
        treatment: "unregistered-proper-name" as const,
        entityBindings: [],
        constraint: "proper-name-without-entity" as const,
        primaryFr: null,
        derivedFr: "Cimath",
        englishForms: ["Cimath"],
        allowedFrenchForms: ["Cimath"],
        evidenceHashes: [HASH_A],
        reasons: ["conservation exacte du gloss STEP LXX"]
      }
    ]
  };
  const selectedProposal: FrenchEntityAgentProposal = {
    ...proposalContent,
    proposalHash: hashFrenchEntityJson(proposalContent)
  };
  return { sourceView, selectedProposal };
}

function componentClosureFixture(unitId: string): {
  views: FrenchEntityRemediationBaseViews;
  quartet: FrenchEntityAgentUnitArtifacts;
} {
  const fixture = concordanceProofFixture({
    entryKey: "hebrew:H0137",
    selectedFrench: "Adoni-Bézek",
    surfaces: ["Adoni", "Bézek"],
    treatment: "canonical-name"
  });
  fixture.sourceView.unitId = unitId;
  fixture.sourceView.reviewUnit.unitId = unitId;
  const { unitHash: _reviewHash, ...reviewContent } =
    fixture.sourceView.reviewUnit;
  void _reviewHash;
  fixture.sourceView.reviewUnit.unitHash = hashFrenchEntityJson(reviewContent);
  const { viewHash: _viewHash, ...viewContent } = fixture.sourceView;
  void _viewHash;
  fixture.sourceView.viewHash = hashFrenchEntityJson(viewContent);
  const proposerB = fixture.sourceView;
  const proposerAContent = {
    ...structuredClone(proposerB),
    role: "proposerA" as const
  } as Omit<FrenchEntityAgentProposerAView, "viewHash"> & {
    viewHash?: string;
    frenchWitnesses?: unknown;
  };
  delete proposerAContent.viewHash;
  delete proposerAContent.frenchWitnesses;
  const proposerA: FrenchEntityAgentProposerAView = {
    ...proposerAContent,
    viewHash: hashFrenchEntityJson(proposerAContent)
  };
  const views = { proposerA, proposerB };
  const proposalA = proposal(unitId, "proposerA", HASH_A, "Adoni-Bézek", {
    entryKey: "hebrew:H0137"
  });
  const proposalB = proposal(unitId, "proposerB", HASH_B, "Adoni-Bézek B", {
    entryKey: "hebrew:H0137"
  });
  const arbitrationContent = {
    schemaVersion: FRENCH_ENTITY_AGENT_ARBITRATION_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_AGENT_POLICY_VERSION,
    role: "arbiter" as const,
    unitId,
    inputHash: HASH_C,
    selectedProposal: "proposalA" as const,
    selectedProposalHash: proposalA.proposalHash,
    reasons: ["sélection A"]
  };
  const arbitration = {
    ...arbitrationContent,
    arbitrationHash: hashFrenchEntityJson(arbitrationContent)
  };
  const checks = auditChecks("safe");
  checks.canonicalPrimaryCoherence = "fail";
  const auditContent = {
    schemaVersion: FRENCH_ENTITY_AGENT_AUDIT_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_AGENT_POLICY_VERSION,
    role: "auditor" as const,
    unitId,
    inputHash: HASH_D,
    auditedProposalHash: proposalA.proposalHash,
    verdict: "hold" as const,
    checks,
    reasons: ["selected-french-form-without-concordance"]
  };
  const audit = {
    ...auditContent,
    auditHash: hashFrenchEntityJson(auditContent)
  };
  return {
    views,
    quartet: { proposalA, proposalB, arbitration, audit }
  };
}

function exactSpellingClosureFixture(unitId: string): {
  views: FrenchEntityRemediationBaseViews;
  quartet: FrenchEntityAgentUnitArtifacts;
} {
  const fixture = concordanceProofFixture({
    entryKey: "hebrew:H4918H",
    selectedFrench: "Meschullam",
    surfaces: ["Meschullam", "Meshullam"],
    treatment: "canonical-name"
  });
  fixture.sourceView.unitId = unitId;
  fixture.sourceView.reviewUnit.unitId = unitId;
  const { unitHash: _reviewHash, ...reviewContent } =
    fixture.sourceView.reviewUnit;
  void _reviewHash;
  fixture.sourceView.reviewUnit.unitHash = hashFrenchEntityJson(reviewContent);
  const { viewHash: _viewHash, ...viewContent } = fixture.sourceView;
  void _viewHash;
  fixture.sourceView.viewHash = hashFrenchEntityJson(viewContent);
  const proposerB = fixture.sourceView;
  const proposerAContent = {
    ...structuredClone(proposerB),
    role: "proposerA" as const
  } as Omit<FrenchEntityAgentProposerAView, "viewHash"> & {
    viewHash?: string;
    frenchWitnesses?: unknown;
  };
  delete proposerAContent.viewHash;
  delete proposerAContent.frenchWitnesses;
  const proposerA: FrenchEntityAgentProposerAView = {
    ...proposerAContent,
    viewHash: hashFrenchEntityJson(proposerAContent)
  };
  const views = { proposerA, proposerB };
  const proposalA = proposal(unitId, "proposerA", HASH_A, "Meschullam", {
    entryKey: "hebrew:H4918H"
  });
  const proposalB = proposal(unitId, "proposerB", HASH_B, "Meshullam", {
    entryKey: "hebrew:H4918H"
  });
  const arbitrationContent = {
    schemaVersion: FRENCH_ENTITY_AGENT_ARBITRATION_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_AGENT_POLICY_VERSION,
    role: "arbiter" as const,
    unitId,
    inputHash: HASH_C,
    selectedProposal: "proposalA" as const,
    selectedProposalHash: proposalA.proposalHash,
    reasons: ["sélection orthographique contrôlée"]
  };
  const arbitration = {
    ...arbitrationContent,
    arbitrationHash: hashFrenchEntityJson(arbitrationContent)
  };
  const checks = auditChecks("safe");
  checks.historicalWitnessNotSoleAuthority = "fail";
  const auditContent = {
    schemaVersion: FRENCH_ENTITY_AGENT_AUDIT_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_AGENT_POLICY_VERSION,
    role: "auditor" as const,
    unitId,
    inputHash: HASH_D,
    auditedProposalHash: proposalA.proposalHash,
    verdict: "block" as const,
    checks,
    reasons: ["aucun argument linguistique indépendant"]
  };
  const audit = {
    ...auditContent,
    auditHash: hashFrenchEntityJson(auditContent)
  };
  return {
    views,
    quartet: { proposalA, proposalB, arbitration, audit }
  };
}

function baseViews(unitId: string): FrenchEntityRemediationBaseViews {
  const reviewContent = {
    schemaVersion: FRENCH_ENTITY_CANONICALIZATION_REVIEW_UNIT_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_CANONICALIZATION_POLICY_VERSION,
    unitId,
    kind: "entity-group" as const,
    entityIds: [1],
    memberEntryKeys: ["hebrew:H0033"],
    anchorEntryKeys: [],
    reviewEntryKeys: ["hebrew:H0033"],
    crossLanguage: false,
    groupProofHashes: [HASH_A]
  };
  const reviewUnit: FrenchEntityCanonicalizationReviewUnit = {
    ...reviewContent,
    unitHash: hashFrenchEntityJson(reviewContent)
  };
  const member: FrenchEntityAgentProposerAView["members"][number] = {
    entryKey: "hebrew:H0033",
    stepEntryId: 33,
    identity: {
      stepEntryId: 33,
      language: "hebrew",
      eStrong: "H0033",
      dStrong: "H0033 =",
      primaryDStrong: "H0033",
      uStrong: "H0033",
      original: "אֶבְיָעֶזֶר",
      transliteration: "e.viy.e.zer",
      morph: "N:N-M-P"
    },
    englishParentHashes: {
      releaseKey: "lexicon-v3-en-fixture.4",
      releaseSnapshotFingerprint: HASH_B,
      gloss: {
        fieldVersionId: 65,
        contentHash: HASH_A,
        valueTextHash: HASH_B,
        valueHtmlHash: null
      },
      meaning: {
        fieldVersionId: 66,
        contentHash: HASH_C,
        valueTextHash: HASH_D,
        valueHtmlHash: HASH_E
      },
      lineageHash: HASH_A
    },
    englishGloss: "Abiezrite",
    editorialStatus: "yellow",
    entityIds: [1],
    englishEntityMatches: [
      {
        entityId: 1,
        significance: "Named",
        aliasEn: "Abiezrite",
        entityEn: "Abiezer",
        category: "person",
        type: "Male"
      }
    ],
    englishEntityForms: ["Abiezer", "Abiezrite"],
    initialTreatment: "unresolved",
    initialConstraint: "blocked",
    allowedEvidenceHashes: [HASH_A],
    hardConstraints: {
      mustRemainNonEntity: false,
      exactStepSuffixRequired: true,
      historicalFrenchIsAuthoritative: false
    }
  };
  const common = {
    schemaVersion: FRENCH_ENTITY_AGENT_VIEW_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_AGENT_POLICY_VERSION,
    unitId,
    planHash: HASH_A,
    releaseKey: "lexicon-v3-en-fixture.4",
    releaseSnapshotFingerprint: HASH_B,
    reviewUnit,
    ownerEntityIds: [1],
    entityGroups: [],
    anchoredEntities: [],
    members: [member]
  };
  const contentA = { ...common, role: "proposerA" as const };
  const proposerA: FrenchEntityAgentProposerAView = {
    ...contentA,
    viewHash: hashFrenchEntityJson(contentA)
  };
  const contentB = {
    ...common,
    role: "proposerB" as const,
    frenchWitnesses: {
      "hebrew:H0033": {
        authority: "non-authoritative-review-witness-only" as const,
        candidateFrenchForms: ["Abiézerite"],
        concordanceForms: [],
        historicalFrenchGloss: "HIST-FR"
      }
    }
  };
  const proposerB: FrenchEntityAgentProposerBView = {
    ...contentB,
    viewHash: hashFrenchEntityJson(contentB)
  };
  return { proposerA, proposerB };
}

function singletonViews(
  unitId: string
): Map<string, FrenchEntityRemediationBaseViews> {
  return new Map([[unitId, baseViews(unitId)]]);
}

function proposal(
  unitId: string,
  role: "proposerA" | "proposerB",
  inputHash: string,
  primaryFr: string,
  options: {
    treatment?: "canonical-name" | "alternate-name" | "gentilic";
    relation?: "primary" | "alias" | "gentilic";
    entryKey?: string;
    derivedFr?: string | null;
    allowedFrenchForms?: string[];
    evidenceHashes?: string[];
    reasons?: string[];
    englishForms?: string[];
  } = {}
): FrenchEntityAgentProposal {
  const treatment = options.treatment ?? "canonical-name";
  const selectedFrench =
    treatment === "canonical-name"
      ? primaryFr
      : (options.derivedFr ?? primaryFr);
  const content = {
    schemaVersion: FRENCH_ENTITY_AGENT_PROPOSAL_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_AGENT_POLICY_VERSION,
    role,
    unitId,
    inputHash,
    canonicalEntities: [
      {
        entityId: 1,
        primaryFr,
        evidenceHashes: options.evidenceHashes ?? [HASH_A],
        reasons: options.reasons ?? ["raison proposition"]
      }
    ],
    memberPolicies: [
      {
        entryKey: options.entryKey ?? "hebrew:H0033",
        treatment,
        entityBindings: [
          {
            entityId: 1,
            relation:
              options.relation ??
              (treatment === "canonical-name" ? "primary" : "alias")
          }
        ],
        constraint: (treatment === "canonical-name"
          ? "canonical"
          : "derived") as "canonical" | "derived",
        primaryFr: treatment === "canonical-name" ? primaryFr : null,
        derivedFr: treatment === "canonical-name" ? null : selectedFrench,
        englishForms: options.englishForms ?? ["Abiezrite"],
        allowedFrenchForms: options.allowedFrenchForms ?? [selectedFrench],
        evidenceHashes: options.evidenceHashes ?? [HASH_A],
        reasons: options.reasons ?? ["raison proposition"]
      }
    ]
  };
  return { ...content, proposalHash: hashFrenchEntityJson(content) };
}

function baseQuartet(
  unitId: string,
  verdict: "safe" | "hold" | "block",
  primaryFr: string,
  reason: string
): FrenchEntityAgentUnitArtifacts {
  const proposalA = proposal(unitId, "proposerA", HASH_A, primaryFr);
  const proposalB = proposal(unitId, "proposerB", HASH_B, `${primaryFr} B`);
  const arbitrationContent = {
    schemaVersion: FRENCH_ENTITY_AGENT_ARBITRATION_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_AGENT_POLICY_VERSION,
    role: "arbiter" as const,
    unitId,
    inputHash: HASH_C,
    selectedProposal: "proposalA" as const,
    selectedProposalHash: proposalA.proposalHash,
    reasons: ["sélection A"]
  };
  const arbitration = {
    ...arbitrationContent,
    arbitrationHash: hashFrenchEntityJson(arbitrationContent)
  };
  const checks = auditChecks(verdict);
  const auditContent = {
    schemaVersion: FRENCH_ENTITY_AGENT_AUDIT_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_AGENT_POLICY_VERSION,
    role: "auditor" as const,
    unitId,
    inputHash: HASH_D,
    auditedProposalHash: proposalA.proposalHash,
    verdict,
    checks,
    reasons: verdict === "safe" ? [] : [reason]
  };
  const audit = {
    ...auditContent,
    auditHash: hashFrenchEntityJson(auditContent)
  };
  return { proposalA, proposalB, arbitration, audit };
}

function remediationQuartet(
  unit: FrenchEntityRemediationRoundPlanUnit,
  verdict: "safe" | "hold" | "block",
  primaryFr: string
): FrenchEntityAgentUnitArtifacts {
  const entryKey = unit.proposerA.view.reviewUnit.reviewEntryKeys[0];
  assert.ok(entryKey);
  const proposalA = proposal(
    unit.unitId,
    "proposerA",
    unit.proposerA.inputHash,
    primaryFr,
    { entryKey }
  );
  const proposalB = proposal(
    unit.unitId,
    "proposerB",
    unit.proposerB.inputHash,
    `${primaryFr} B`,
    { entryKey }
  );
  const arbitrationContent = {
    schemaVersion: FRENCH_ENTITY_AGENT_ARBITRATION_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_AGENT_POLICY_VERSION,
    role: "arbiter" as const,
    unitId: unit.unitId,
    inputHash: frenchEntityRemediationArbiterInputHash(
      unit,
      proposalA,
      proposalB
    ),
    selectedProposal: "proposalA" as const,
    selectedProposalHash: proposalA.proposalHash,
    reasons: ["sélection A"]
  };
  const arbitration = {
    ...arbitrationContent,
    arbitrationHash: hashFrenchEntityJson(arbitrationContent)
  };
  const partial = { proposalA, proposalB, arbitration };
  const auditContent = {
    schemaVersion: FRENCH_ENTITY_AGENT_AUDIT_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_AGENT_POLICY_VERSION,
    role: "auditor" as const,
    unitId: unit.unitId,
    inputHash: frenchEntityRemediationAuditorInputHash(unit, partial),
    auditedProposalHash: proposalA.proposalHash,
    verdict,
    checks: auditChecks(verdict),
    reasons: verdict === "safe" ? [] : ["raison remédiation"]
  };
  const audit = {
    ...auditContent,
    auditHash: hashFrenchEntityJson(auditContent)
  };
  return { ...partial, audit };
}

function auditChecks(
  verdict: "safe" | "hold" | "block"
): FrenchEntityAgentAuditChecks {
  return {
    exactStepIdentity: "pass",
    exactEnglishLineage: "pass",
    canonicalPrimaryCoherence: "pass",
    singularEditorialLemma: "pass",
    explicitMemberRelations: "pass",
    noCommonGlossForcedAsName: "pass",
    frenchNaturalness: verdict === "safe" ? "pass" : "fail",
    historicalWitnessNotSoleAuthority: "pass"
  };
}

function requiredUnit(
  units: readonly FrenchEntityRemediationRoundPlanUnit[],
  unitId: string
): FrenchEntityRemediationRoundPlanUnit {
  const unit = units.find((candidate) => candidate.unitId === unitId);
  assert.ok(unit);
  return unit;
}
