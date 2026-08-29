import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  assertFrenchEntityAgentBatchManifest,
  buildFrenchEntityAgentBatches,
  frenchEntityAgentArbiterUnitInputHash,
  frenchEntityAgentArbitrationResponseSchema,
  frenchEntityAgentAuditorUnitInputHash,
  frenchEntityAgentAuditResponseSchema,
  frenchEntityAgentEvidenceConflictCodes,
  frenchEntityAgentMissingCanonicalComponentIds,
  frenchEntityAgentProposalResponseSchema,
  FRENCH_ENTITY_AGENT_PROPOSAL_SCHEMA_VERSION,
  mergeFrenchEntityAgentArtifacts,
  mergeFrenchEntityAgentArtifactsTerminal,
  parseFrenchEntityAgentArbitrationResponse,
  parseFrenchEntityAgentAuditResponse,
  parseFrenchEntityAgentProposalResponse,
  type FrenchEntityAgentAuditChecks,
  type FrenchEntityAgentBatchBuild,
  type FrenchEntityAgentInputArtifact,
  type FrenchEntityAgentProposal,
  type FrenchEntityAgentProposerBView,
  type FrenchEntityAgentUnitArtifacts,
  type FrenchEntityAgentView
} from "../src/lexiconV3/frenchEntityAgentReview.js";
import {
  buildFrenchEntityCanonicalizationPlan,
  hashFrenchEntityJson,
  type FrenchEntityCanonicalizationExpectations,
  type FrenchEntityCanonicalizationPlan,
  type FrenchEntityRegistrySourceMatch,
  type FrenchEntityRegistrySourceRecord
} from "../src/lexiconV3/frenchEntityCanonicalization.js";
import {
  FRENCH_EDITORIAL_POLICY_VERSION,
  FRENCH_ENTITY_REGISTRY_SCHEMA_VERSION
} from "../src/lexiconV3/frenchEditorialPolicy.js";
import {
  buildFrenchPacket,
  type LexiconV3FrenchPacket
} from "../src/lexiconV3/frenchPackets.js";
import {
  FrenchEntityAgentRetryableAttemptError,
  parseFrenchEntityAgentRunArgs,
  quarantineFrenchEntityAgentAttemptFailure,
  runFrenchEntityAgentAttempts,
  selectFrenchEntityAgentReviewSourceArtifact
} from "../scripts/runLexiconV3FrenchEntityAgents.js";
import { frenchPacketFixtureEnglishRelease } from "./lexiconV3FrenchPacketFixture.js";

const RELEASE = "lexicon-v3-en-fixture.4";
const SNAPSHOT = "d".repeat(64);
const EXPECTATIONS = {
  packets: 8,
  entries: 8,
  anchors: 1,
  reviews: 7,
  singleEntityEntries: 3,
  noEntityEntries: 5,
  multiEntityEntries: 0,
  entityIds: 2,
  sharedEntityGroups: 1,
  sharedEntityEntries: 2,
  crossLanguageEntityGroups: 1,
  reviewUnits: 7,
  entityReviewUnits: 2,
  noEntityReviewUnits: 5,
  multiEntityReviewUnits: 0
} satisfies FrenchEntityCanonicalizationExpectations;

test("builds content-addressed blind A and explicitly non-authoritative B batches", () => {
  const { plan, batches } = buildFixturePlanAndBatches();
  assert.equal(batches.manifest.counts.units, 7);
  assert.equal(batches.manifest.counts.batches, 1);
  assert.equal(batches.manifest.counts.agentOwnedEntities, 1);
  assert.equal(batches.files.size, 3);
  const forgedCount = structuredClone(batches.manifest);
  forgedCount.counts.agentOwnedEntities = 0;
  const { manifestHash: _manifestHash, ...forgedContent } = forgedCount;
  void _manifestHash;
  forgedCount.manifestHash = hashFrenchEntityJson(forgedContent);
  assert.throws(
    () => assertFrenchEntityAgentBatchManifest(forgedCount, plan, EXPECTATIONS),
    /french-entity-agent-manifest-invalid/u
  );

  const batch = batches.manifest.batches[0];
  assert.ok(batch);
  const inputA = parseInput(batches, batch.proposerA.relativePath);
  const inputB = parseInput(batches, batch.proposerB.relativePath);
  assert.equal(inputA.releaseKey, RELEASE);
  assert.equal(inputA.releaseSnapshotFingerprint, SNAPSHOT);
  assert.equal(inputA.planHash, plan.planHash);
  assert.doesNotMatch(JSON.stringify(inputA), /HIST-FR/u);
  assert.doesNotMatch(
    JSON.stringify(inputA),
    /candidateFrenchForms|concordanceForms|historicalFrenchGloss|frenchWitnesses/u
  );
  assert.match(JSON.stringify(inputB), /HIST-FR/u);
  assert.match(
    JSON.stringify(inputB),
    /non-authoritative-review-witness-only/u
  );
  assert.match(JSON.stringify(inputB), /Aharon/u);
  assert.equal(
    selectFrenchEntityAgentReviewSourceArtifact(inputA, inputB),
    inputB
  );

  for (const view of inputA.views) {
    for (const member of view.members) {
      assert.equal(
        member.identity.stepEntryId,
        member.stepEntryId,
        member.entryKey
      );
      assert.equal(member.englishParentHashes.releaseKey, RELEASE);
      assert.match(member.englishParentHashes.lineageHash, /^[a-f0-9]{64}$/u);
    }
  }
  for (const key of ["G9048", "G6160", "G5514H", "G2148", "G2207"]) {
    const member = inputA.views
      .flatMap((view) => view.members)
      .find((value) => value.entryKey === `greek:${key}`);
    assert.equal(member?.hardConstraints.mustRemainNonEntity, true, key);
    assert.equal(member?.initialTreatment, "etymological-or-common-gloss", key);
  }
});

test("pins every runtime output contract to the exact role, unit and view hash", () => {
  const { plan, batches } = buildFixturePlanAndBatches();
  const batch = batches.manifest.batches[0];
  assert.ok(batch);
  const inputA = parseInput(batches, batch.proposerA.relativePath);
  const proposalContracts = inputA.views.map((view) => ({
    role: "proposerA" as const,
    unitId: view.unitId,
    inputHash: view.viewHash,
    ownerEntityIds: [...view.ownerEntityIds],
    reviewEntryKeys: [...view.reviewUnit.reviewEntryKeys]
  }));
  const proposalSchemaObject = frenchEntityAgentProposalResponseSchema(
    "proposerA",
    proposalContracts
  );
  const proposalSchema = JSON.stringify(proposalSchemaObject);
  assert.doesNotMatch(proposalSchema, /proposerB/u);
  assert.equal(proposalSchema.includes(inputA.inputHash), false);
  for (const contract of proposalContracts) {
    assert.ok(proposalSchema.includes(contract.unitId));
    assert.ok(proposalSchema.includes(contract.inputHash));
  }
  const proposalBranches = (
    proposalSchemaObject as {
      properties: { proposals: { items: { anyOf: object[] } } };
    }
  ).properties.proposals.items.anyOf as Array<{
    properties: {
      unitId: { enum: string[] };
      canonicalEntities: {
        minItems: number;
        maxItems: number;
        items: { properties: { entityId: { enum?: number[] } } };
      };
      memberPolicies: {
        minItems: number;
        maxItems: number;
        items: {
          properties: {
            entryKey: { enum: string[] };
            allowedFrenchForms: {
              minItems: number;
              maxItems: number;
            };
          };
        };
      };
    };
  }>;
  for (const contract of proposalContracts) {
    const branch = proposalBranches.find(
      (candidate) => candidate.properties.unitId.enum[0] === contract.unitId
    );
    assert.ok(branch);
    assert.equal(
      branch.properties.canonicalEntities.minItems,
      contract.ownerEntityIds.length
    );
    assert.equal(
      branch.properties.canonicalEntities.maxItems,
      contract.ownerEntityIds.length
    );
    assert.equal(
      branch.properties.memberPolicies.minItems,
      contract.reviewEntryKeys.length
    );
    assert.equal(
      branch.properties.memberPolicies.maxItems,
      contract.reviewEntryKeys.length
    );
    assert.deepEqual(
      branch.properties.memberPolicies.items.properties.entryKey.enum,
      contract.reviewEntryKeys
    );
    const allowedFrenchForms =
      branch.properties.memberPolicies.items.properties.allowedFrenchForms;
    assert.equal(allowedFrenchForms.minItems, 1);
    assert.equal(allowedFrenchForms.maxItems, 1);
    assert.equal("uniqueItems" in allowedFrenchForms, false);
    if (contract.ownerEntityIds.length > 0) {
      assert.deepEqual(
        branch.properties.canonicalEntities.items.properties.entityId.enum,
        contract.ownerEntityIds
      );
    }
  }

  const arbitrationSchema = JSON.stringify(
    frenchEntityAgentArbitrationResponseSchema([
      {
        unitId: batch.unitIds[0] ?? "",
        inputHash: "1".repeat(64),
        proposalAHash: "2".repeat(64),
        proposalBHash: "3".repeat(64)
      }
    ])
  );
  assert.match(arbitrationSchema, new RegExp("2".repeat(64), "u"));
  assert.match(arbitrationSchema, new RegExp("3".repeat(64), "u"));
  const auditSchema = JSON.stringify(
    frenchEntityAgentAuditResponseSchema([
      {
        unitId: batch.unitIds[0] ?? "",
        inputHash: "4".repeat(64),
        auditedProposalHash: "5".repeat(64),
        selectedProposalRole: "proposerA",
        evidenceConflictCodes: []
      }
    ])
  );
  assert.match(auditSchema, new RegExp("5".repeat(64), "u"));
  const auditSchemaObject = JSON.parse(auditSchema) as {
    properties: {
      audits: {
        items: {
          anyOf: Array<{
            properties: {
              checks: {
                properties: Record<string, { enum: string[] }>;
              };
            };
          }>;
        };
      };
    };
  };
  const auditChecks =
    auditSchemaObject.properties.audits.items.anyOf[0]?.properties.checks
      .properties;
  assert.deepEqual(auditChecks?.exactStepIdentity.enum, ["pass"]);
  assert.deepEqual(auditChecks?.exactEnglishLineage.enum, ["pass"]);
  assert.deepEqual(auditChecks?.explicitMemberRelations.enum, ["pass"]);
  assert.deepEqual(auditChecks?.singularEditorialLemma.enum, ["pass", "fail"]);
  assert.deepEqual(auditChecks?.historicalWitnessNotSoleAuthority.enum, [
    "pass",
    "fail"
  ]);
  assert.deepEqual(auditChecks?.frenchNaturalness.enum, ["pass", "fail"]);

  const wrongBatchHash = structuredClone(proposalResponse(inputA));
  assert.ok(wrongBatchHash.proposals[0]);
  wrongBatchHash.proposals[0].inputHash = inputA.inputHash;
  assert.throws(
    () =>
      parseFrenchEntityAgentProposalResponse({
        text: JSON.stringify(wrongBatchHash),
        role: "proposerA",
        artifact: inputA,
        plan,
        owners: batches.manifest.owners
      }),
    /proposal-input-hash/u
  );

  assert.throws(
    () =>
      parseFrenchEntityAgentProposalResponse({
        text: JSON.stringify(proposalResponse(inputA)),
        role: "proposerA",
        artifact: inputA,
        plan,
        owners: batches.manifest.owners,
        inputHashes: new Map([
          [inputA.unitIds[0] ?? "", inputA.views[0]?.viewHash ?? ""]
        ])
      }),
    /proposal-input-coverage/u
  );

  const wrongRole = structuredClone(proposalResponse(inputA));
  assert.ok(wrongRole.proposals[0]);
  wrongRole.proposals[0].role = "proposerB";
  assert.throws(
    () =>
      parseFrenchEntityAgentProposalResponse({
        text: JSON.stringify(wrongRole),
        role: "proposerA",
        artifact: inputA,
        plan,
        owners: batches.manifest.owners
      }),
    /proposal-role/u
  );
});

test("forces unsupported or conflicting name evidence to hold and reconciles nested canonical names", () => {
  const { plan, batches } = buildFixturePlanAndBatches();
  const batch = batches.manifest.batches[0];
  assert.ok(batch);
  const inputB = parseInput(batches, batch.proposerB.relativePath);
  const proposals = parseFrenchEntityAgentProposalResponse({
    text: JSON.stringify(proposalResponse(inputB)),
    role: "proposerB",
    artifact: inputB,
    plan,
    owners: batches.manifest.owners
  });
  const sourceView = structuredClone(
    inputB.views.find((view) => view.unitId === "entity:00000002")
  ) as FrenchEntityAgentProposerBView | undefined;
  const selectedProposal = structuredClone(
    proposals.find((proposal) => proposal.unitId === "entity:00000002")
  );
  assert.ok(sourceView);
  assert.ok(selectedProposal);
  const sourceMember = sourceView.members[0];
  const selectedMember = selectedProposal.memberPolicies[0];
  assert.ok(sourceMember);
  assert.ok(selectedMember);
  sourceMember.englishGloss = "`wielded`";
  sourceMember.englishEntityMatches = [
    {
      entityId: 2,
      significance: "Named",
      aliasEn: "wielded (KJV= Adino; NIV= raised)",
      entityEn: "Adino",
      category: "person",
      type: "Male"
    }
  ];
  selectedMember.primaryFr = "Adino";
  selectedMember.allowedFrenchForms = ["Adino"];
  selectedProposal.canonicalEntities[0]!.primaryFr = "Adino";
  sourceView.frenchWitnesses[selectedMember.entryKey]!.concordanceForms = [
    {
      surface: "Adino",
      normalized: "adino",
      count: 1,
      strongCount: 1,
      witnessFamilies: ["Darby-family"],
      sources: ["Darby", "DarbyR"]
    },
    {
      surface: "brandit",
      normalized: "brandit",
      count: 1,
      strongCount: 2,
      witnessFamilies: ["Sg1910"],
      sources: ["Sg1910"]
    }
  ];
  assert.deepEqual(
    frenchEntityAgentEvidenceConflictCodes({
      sourceView,
      selectedProposal
    }),
    [
      "greek:G1002:ambiguous-step-entity-attachment",
      "greek:G1002:proper-name-vs-lexical-concordance-conflict"
    ]
  );
  sourceView.frenchWitnesses[selectedMember.entryKey]!.concordanceForms = [];
  assert.match(
    frenchEntityAgentEvidenceConflictCodes({
      sourceView,
      selectedProposal
    }).join("\n"),
    /selected-french-form-without-concordance/u
  );

  const nestedCandidate = structuredClone(
    plan.reviewCandidates.find(
      (candidate) => candidate.entryKey === "hebrew:H1001"
    )
  );
  assert.ok(nestedCandidate);
  nestedCandidate.entityMatches[0]!.significance = "NameCombined";
  nestedCandidate.sourceForms.englishEntityForms.push("guardian of Judah");
  assert.deepEqual(
    frenchEntityAgentMissingCanonicalComponentIds({
      plan,
      candidate: nestedCandidate,
      selectedFrench: "gardien de Judée",
      canonicalEntities: [{ entityId: 2, normalizedPrimaryFr: "juda" }]
    }),
    [2]
  );
  assert.deepEqual(
    frenchEntityAgentMissingCanonicalComponentIds({
      plan,
      candidate: nestedCandidate,
      selectedFrench: "gardien de Juda",
      canonicalEntities: [{ entityId: 2, normalizedPrimaryFr: "juda" }]
    }),
    []
  );
});

test("parses two independent proposals, enforces octet selection and passes a safe merge gate", () => {
  const { plan, batches } = buildFixturePlanAndBatches();
  const batch = batches.manifest.batches[0];
  assert.ok(batch);
  const inputA = parseInput(batches, batch.proposerA.relativePath);
  const inputB = parseInput(batches, batch.proposerB.relativePath);
  const proposalA = parseFrenchEntityAgentProposalResponse({
    text: JSON.stringify(proposalResponse(inputA)),
    role: "proposerA",
    artifact: inputA,
    plan,
    owners: batches.manifest.owners
  });
  const proposalB = parseFrenchEntityAgentProposalResponse({
    text: JSON.stringify(proposalResponse(inputB)),
    role: "proposerB",
    artifact: inputB,
    plan,
    owners: batches.manifest.owners
  });
  const proposalAByUnit = new Map(
    proposalA.map((value) => [value.unitId, value])
  );
  const proposalBByUnit = new Map(
    proposalB.map((value) => [value.unitId, value])
  );
  const reviewSource = selectFrenchEntityAgentReviewSourceArtifact(
    inputA,
    inputB
  );
  const sourceViewByUnit = new Map(
    reviewSource.views.map((view) => [view.unitId, view])
  );
  const arbiterInputs = new Map(
    batch.unitIds.map((unitId) => [
      unitId,
      frenchEntityAgentArbiterUnitInputHash({
        unitId,
        sourceView: required(sourceViewByUnit, unitId),
        proposalA: required(proposalAByUnit, unitId),
        proposalB: required(proposalBByUnit, unitId)
      })
    ])
  );
  const arbitrations = parseFrenchEntityAgentArbitrationResponse({
    text: JSON.stringify({
      decisions: batch.unitIds.map((unitId) => ({
        schemaVersion: "lexicon-v3-french-entity-agent-arbitration@1",
        role: "arbiter",
        unitId,
        inputHash: arbiterInputs.get(unitId),
        selectedProposal: "proposalA",
        selectedProposalHash: proposalAByUnit.get(unitId)?.proposalHash,
        reasons: ["A est plus cohérent avec les preuves scellées."]
      }))
    }),
    unitIds: batch.unitIds,
    inputHashes: arbiterInputs,
    proposalA: proposalAByUnit,
    proposalB: proposalBByUnit
  });
  const arbitrationByUnit = new Map(
    arbitrations.map((value) => [value.unitId, value])
  );
  const auditInputs = new Map(
    batch.unitIds.map((unitId) => [
      unitId,
      frenchEntityAgentAuditorUnitInputHash({
        unitId,
        sourceView: required(sourceViewByUnit, unitId),
        arbitration: required(arbitrationByUnit, unitId),
        selectedProposal: required(proposalAByUnit, unitId)
      })
    ])
  );
  const audits = parseFrenchEntityAgentAuditResponse({
    text: JSON.stringify({
      audits: batch.unitIds.map((unitId) => ({
        schemaVersion: "lexicon-v3-french-entity-agent-audit@2",
        role: "auditor",
        unitId,
        inputHash: auditInputs.get(unitId),
        auditedProposalHash:
          arbitrationByUnit.get(unitId)?.selectedProposalHash,
        verdict: "safe",
        checks: passingChecks(),
        reasons: []
      }))
    }),
    unitIds: batch.unitIds,
    inputHashes: auditInputs,
    arbitrations: arbitrationByUnit,
    selectedProposalRoles: new Map(
      batch.unitIds.map((unitId) => [unitId, "proposerA" as const])
    ),
    sourceViews: sourceViewByUnit,
    selectedProposals: proposalAByUnit
  });
  const unsupportedUnitId = batch.unitIds[0] ?? "";
  const unsupportedView = structuredClone(
    required(sourceViewByUnit, unsupportedUnitId)
  );
  const unsupportedEntryKey = unsupportedView.members[0]?.entryKey ?? "";
  const unsupportedWitnesses =
    unsupportedView.frenchWitnesses[unsupportedEntryKey];
  assert.ok(unsupportedWitnesses);
  unsupportedWitnesses.concordanceForms = [];
  const unsupportedViews = new Map(sourceViewByUnit);
  unsupportedViews.set(unsupportedUnitId, unsupportedView);
  assert.throws(
    () =>
      parseFrenchEntityAgentAuditResponse({
        text: JSON.stringify({
          audits: batch.unitIds.map((unitId) => ({
            schemaVersion: "lexicon-v3-french-entity-agent-audit@2",
            role: "auditor",
            unitId,
            inputHash: auditInputs.get(unitId),
            auditedProposalHash:
              arbitrationByUnit.get(unitId)?.selectedProposalHash,
            verdict: "safe",
            checks: passingChecks(),
            reasons: []
          }))
        }),
        unitIds: batch.unitIds,
        inputHashes: auditInputs,
        arbitrations: arbitrationByUnit,
        selectedProposalRoles: new Map(
          batch.unitIds.map((unitId) => [unitId, "proposerA" as const])
        ),
        sourceViews: unsupportedViews,
        selectedProposals: proposalAByUnit
      }),
    /french-entity-agent-audit-invalid/u
  );
  const falseMechanicalBlock = {
    audits: batch.unitIds.map((unitId, index) => ({
      schemaVersion: "lexicon-v3-french-entity-agent-audit@2",
      role: "auditor",
      unitId,
      inputHash: auditInputs.get(unitId),
      auditedProposalHash: arbitrationByUnit.get(unitId)?.selectedProposalHash,
      verdict: index === 0 ? "block" : "safe",
      checks: {
        ...passingChecks(),
        exactStepIdentity: index === 0 ? "fail" : "pass"
      },
      reasons:
        index === 0
          ? ["Un membre de contexte serait absent des reviewEntryKeys."]
          : []
    }))
  };
  assert.throws(
    () =>
      parseFrenchEntityAgentAuditResponse({
        text: JSON.stringify(falseMechanicalBlock),
        unitIds: batch.unitIds,
        inputHashes: auditInputs,
        arbitrations: arbitrationByUnit,
        selectedProposalRoles: new Map(
          batch.unitIds.map((unitId) => [unitId, "proposerA" as const])
        ),
        sourceViews: sourceViewByUnit,
        selectedProposals: proposalAByUnit
      }),
    /french-entity-agent-audit-invalid/u
  );
  const historicalHolds = parseFrenchEntityAgentAuditResponse({
    text: JSON.stringify({
      audits: batch.unitIds.map((unitId, index) => ({
        schemaVersion: "lexicon-v3-french-entity-agent-audit@2",
        role: "auditor",
        unitId,
        inputHash: auditInputs.get(unitId),
        auditedProposalHash:
          arbitrationByUnit.get(unitId)?.selectedProposalHash,
        verdict: index === 0 ? "hold" : "safe",
        checks: {
          ...passingChecks(),
          historicalWitnessNotSoleAuthority: index === 0 ? "fail" : "pass"
        },
        reasons:
          index === 0
            ? [
                "Le choix de l'arbitre suit le témoin historique sans preuve indépendante."
              ]
            : []
      }))
    }),
    unitIds: batch.unitIds,
    inputHashes: auditInputs,
    arbitrations: arbitrationByUnit,
    selectedProposalRoles: new Map(
      batch.unitIds.map((unitId) => [unitId, "proposerA" as const])
    ),
    sourceViews: sourceViewByUnit,
    selectedProposals: proposalAByUnit
  });
  assert.equal(historicalHolds[0]?.verdict, "hold");
  const pluralLemmaDeclaredSafe = {
    audits: batch.unitIds.map((unitId, index) => ({
      schemaVersion: "lexicon-v3-french-entity-agent-audit@2",
      role: "auditor",
      unitId,
      inputHash: auditInputs.get(unitId),
      auditedProposalHash: arbitrationByUnit.get(unitId)?.selectedProposalHash,
      verdict: "safe",
      checks: {
        ...passingChecks(),
        singularEditorialLemma: index === 0 ? "fail" : "pass"
      },
      reasons: []
    }))
  };
  assert.throws(
    () =>
      parseFrenchEntityAgentAuditResponse({
        text: JSON.stringify(pluralLemmaDeclaredSafe),
        unitIds: batch.unitIds,
        inputHashes: auditInputs,
        arbitrations: arbitrationByUnit,
        selectedProposalRoles: new Map(
          batch.unitIds.map((unitId) => [unitId, "proposerA" as const])
        ),
        sourceViews: sourceViewByUnit,
        selectedProposals: proposalAByUnit
      }),
    /french-entity-agent-audit-invalid/u
  );
  const auditByUnit = new Map(audits.map((value) => [value.unitId, value]));
  const artifacts = new Map<string, FrenchEntityAgentUnitArtifacts>(
    batch.unitIds.map((unitId) => [
      unitId,
      {
        proposalA: required(proposalAByUnit, unitId),
        proposalB: required(proposalBByUnit, unitId),
        arbitration: required(arbitrationByUnit, unitId),
        audit: required(auditByUnit, unitId)
      }
    ])
  );
  const firstUnitId = batch.unitIds[0];
  assert.ok(firstUnitId);
  const expectRehashedQuartetRejected = (
    forged: FrenchEntityAgentUnitArtifacts,
    pattern: RegExp
  ): void => {
    const forgedArtifacts = new Map(artifacts);
    forgedArtifacts.set(firstUnitId, forged);
    assert.throws(
      () =>
        mergeFrenchEntityAgentArtifacts({
          plan,
          manifest: batches.manifest,
          artifacts: forgedArtifacts,
          expectations: EXPECTATIONS
        }),
      pattern
    );
  };

  const wrongSelection = structuredClone(required(artifacts, firstUnitId));
  (
    wrongSelection.arbitration as unknown as { selectedProposal: string }
  ).selectedProposal = "proposalC";
  rehashStoredArtifact(wrongSelection.arbitration, "arbitrationHash");
  expectRehashedQuartetRejected(wrongSelection, /stored-arbitration-invalid/u);

  const emptyChecks = structuredClone(required(artifacts, firstUnitId));
  (emptyChecks.audit as unknown as { checks: Record<string, string> }).checks =
    {};
  rehashStoredArtifact(emptyChecks.audit, "auditHash");
  expectRehashedQuartetRejected(emptyChecks, /audit-checks/u);

  const emptyArbitrationReasons = structuredClone(
    required(artifacts, firstUnitId)
  );
  emptyArbitrationReasons.arbitration.reasons = [];
  rehashStoredArtifact(emptyArbitrationReasons.arbitration, "arbitrationHash");
  expectRehashedQuartetRejected(
    emptyArbitrationReasons,
    /stored-arbitration-reasons/u
  );

  const wrongProposalRole = structuredClone(required(artifacts, firstUnitId));
  (wrongProposalRole.proposalA as unknown as { role: string }).role =
    "proposerB";
  rehashStoredArtifact(wrongProposalRole.proposalA, "proposalHash");
  expectRehashedQuartetRejected(wrongProposalRole, /stored-proposal-invalid/u);

  const wrongProposalSchema = structuredClone(required(artifacts, firstUnitId));
  (
    wrongProposalSchema.proposalA as unknown as { schemaVersion: string }
  ).schemaVersion = "lexicon-v3-french-entity-agent-proposal@999";
  rehashStoredArtifact(wrongProposalSchema.proposalA, "proposalHash");
  expectRehashedQuartetRejected(
    wrongProposalSchema,
    /stored-proposal-invalid/u
  );

  const wrongProposalUnit = structuredClone(required(artifacts, firstUnitId));
  (wrongProposalUnit.proposalA as unknown as { unitId: string }).unitId =
    "unit:foreign";
  rehashStoredArtifact(wrongProposalUnit.proposalA, "proposalHash");
  expectRehashedQuartetRejected(wrongProposalUnit, /stored-proposal-invalid/u);

  const wrongProposalInput = structuredClone(required(artifacts, firstUnitId));
  (wrongProposalInput.proposalA as unknown as { inputHash: string }).inputHash =
    "not-a-sha";
  rehashStoredArtifact(wrongProposalInput.proposalA, "proposalHash");
  expectRehashedQuartetRejected(wrongProposalInput, /stored-proposal-invalid/u);

  const foreignButValidProposalInput = structuredClone(
    required(artifacts, firstUnitId)
  );
  foreignButValidProposalInput.proposalA.inputHash = "e".repeat(64);
  rehashStoredArtifact(foreignButValidProposalInput.proposalA, "proposalHash");
  foreignButValidProposalInput.arbitration.selectedProposalHash =
    foreignButValidProposalInput.proposalA.proposalHash;
  rehashStoredArtifact(
    foreignButValidProposalInput.arbitration,
    "arbitrationHash"
  );
  foreignButValidProposalInput.audit.auditedProposalHash =
    foreignButValidProposalInput.proposalA.proposalHash;
  rehashStoredArtifact(foreignButValidProposalInput.audit, "auditHash");
  expectRehashedQuartetRejected(foreignButValidProposalInput, /input/u);

  const gentilicUnitId = batch.unitIds.find((unitId) =>
    required(artifacts, unitId).proposalA.memberPolicies.some(
      (member) => member.entryKey === "hebrew:H1001"
    )
  );
  assert.ok(gentilicUnitId);
  const gentilicQuartet = structuredClone(required(artifacts, gentilicUnitId));
  const gentilicMember = gentilicQuartet.proposalA.memberPolicies.find(
    (member) => member.entryKey === "hebrew:H1001"
  );
  assert.ok(gentilicMember);
  gentilicMember.treatment = "gentilic";
  gentilicMember.constraint = "derived";
  gentilicMember.entityBindings = gentilicMember.entityBindings.map(
    (binding) => ({ ...binding, relation: "gentilic" as const })
  );
  gentilicMember.primaryFr = null;
  gentilicMember.derivedFr = "Aharonite";
  gentilicMember.allowedFrenchForms = ["Aharonite", "Aharonites"];
  rehashStoredArtifact(gentilicQuartet.proposalA, "proposalHash");
  gentilicQuartet.arbitration.inputHash = frenchEntityAgentArbiterUnitInputHash(
    {
      unitId: gentilicUnitId,
      sourceView: required(sourceViewByUnit, gentilicUnitId),
      proposalA: gentilicQuartet.proposalA,
      proposalB: gentilicQuartet.proposalB
    }
  );
  gentilicQuartet.arbitration.selectedProposalHash =
    gentilicQuartet.proposalA.proposalHash;
  rehashStoredArtifact(gentilicQuartet.arbitration, "arbitrationHash");
  gentilicQuartet.audit.inputHash = frenchEntityAgentAuditorUnitInputHash({
    unitId: gentilicUnitId,
    sourceView: required(sourceViewByUnit, gentilicUnitId),
    arbitration: gentilicQuartet.arbitration,
    selectedProposal: gentilicQuartet.proposalA
  });
  gentilicQuartet.audit.auditedProposalHash =
    gentilicQuartet.proposalA.proposalHash;
  rehashStoredArtifact(gentilicQuartet.audit, "auditHash");
  const flexionArtifacts = new Map(artifacts);
  flexionArtifacts.set(gentilicUnitId, gentilicQuartet);
  assert.throws(
    () =>
      mergeFrenchEntityAgentArtifacts({
        plan,
        manifest: batches.manifest,
        artifacts: flexionArtifacts,
        expectations: EXPECTATIONS
      }),
    /french-entity-agent-stored-audit-invalid/u
  );

  const unknownTreatment = structuredClone(required(artifacts, firstUnitId));
  const firstMember = unknownTreatment.proposalA.memberPolicies[0];
  assert.ok(firstMember);
  (firstMember as unknown as { treatment: string }).treatment = "mystery";
  rehashStoredArtifact(unknownTreatment.proposalA, "proposalHash");
  expectRehashedQuartetRejected(unknownTreatment, /member-unresolved/u);

  const heldArtifacts = new Map(artifacts);
  heldArtifacts.set(firstUnitId, {
    ...required(artifacts, firstUnitId),
    audit: required(
      new Map(historicalHolds.map((value) => [value.unitId, value])),
      firstUnitId
    )
  });
  assert.throws(
    () =>
      mergeFrenchEntityAgentArtifacts({
        plan,
        manifest: batches.manifest,
        artifacts: heldArtifacts,
        expectations: EXPECTATIONS
      }),
    /french-entity-agent-merge-not-safe/u
  );
  const terminal = mergeFrenchEntityAgentArtifactsTerminal({
    plan,
    manifest: batches.manifest,
    artifacts: heldArtifacts,
    expectations: EXPECTATIONS
  });
  assert.ok(terminal.quarantinedUnitIds.includes(firstUnitId));
  assert.equal(
    terminal.safeUnitIds.length + terminal.quarantinedUnitIds.length,
    plan.reviewUnits.length
  );
  const quarantinedEntryKeys = new Set(
    plan.reviewUnits
      .filter((unit) => terminal.quarantinedUnitIds.includes(unit.unitId))
      .flatMap((unit) => unit.reviewEntryKeys)
  );
  assert.ok(
    terminal.entryPolicies.every(
      (policy) => !quarantinedEntryKeys.has(policy.entryKey)
    )
  );
  assert.equal(terminal.gate.unsafePropagationCount, 0);
  const merged = mergeFrenchEntityAgentArtifacts({
    plan,
    manifest: batches.manifest,
    artifacts,
    expectations: EXPECTATIONS
  });
  assert.equal(merged.canonicalEntities.length, 2);
  assert.equal(merged.entryPolicies.length, 8);
  assert.equal(merged.gate.unresolvedCount, 0);
  assert.equal(merged.gate.blockedCount, 0);
  assert.equal(merged.gate.onePrimaryFrenchPerEntity, true);
  assert.ok(
    merged.entryPolicies
      .filter((policy) =>
        policy.entryKey.match(/G(?:9048|6160|5514H|2148|2207)$/u)
      )
      .every(
        (policy) =>
          policy.treatment === "etymological-or-common-gloss" &&
          policy.constraint === "lexical-translation" &&
          policy.englishForms.length === 0
      )
  );
  assert.ok(
    merged.entryPolicies
      .filter((policy) => policy.classificationProof.agentArtifacts !== null)
      .every((policy) =>
        Object.values(policy.classificationProof.agentArtifacts ?? {}).every(
          (hash) => /^[a-f0-9]{64}$/u.test(hash)
        )
      )
  );

  const tampered = JSON.parse(
    JSON.stringify({
      decisions: batch.unitIds.map((unitId) => ({
        schemaVersion: "lexicon-v3-french-entity-agent-arbitration@1",
        role: "arbiter",
        unitId,
        inputHash: arbiterInputs.get(unitId),
        selectedProposal: "proposalA",
        selectedProposalHash: "f".repeat(64),
        reasons: ["tentative de synthèse"]
      }))
    })
  );
  assert.throws(
    () =>
      parseFrenchEntityAgentArbitrationResponse({
        text: JSON.stringify(tampered),
        unitIds: batch.unitIds,
        inputHashes: arbiterInputs,
        proposalA: proposalAByUnit,
        proposalB: proposalBByUnit
      }),
    /selection-invalid/u
  );
});

test("rejects a canary name proposal and a release-mismatched batch plan", () => {
  const { plan, batches } = buildFixturePlanAndBatches();
  const batch = batches.manifest.batches[0];
  assert.ok(batch);
  const inputA = parseInput(batches, batch.proposerA.relativePath);
  const response = proposalResponse(inputA);
  const unit = response.proposals.find((proposal) =>
    proposal.memberPolicies.some((member) => member.entryKey === "greek:G9048")
  );
  const member = unit?.memberPolicies.find(
    (value) => value.entryKey === "greek:G9048"
  );
  assert.ok(member);
  member.treatment = "alternate-name";
  member.constraint = "derived";
  member.derivedFr = "Sademoth";
  member.englishForms = ["a plain"];
  member.allowedFrenchForms = ["Sademoth"];
  assert.throws(
    () =>
      parseFrenchEntityAgentProposalResponse({
        text: JSON.stringify(response),
        role: "proposerA",
        artifact: inputA,
        plan,
        owners: batches.manifest.owners
      }),
    /canary-forced-name/u
  );
  assert.throws(
    () =>
      buildFrenchEntityAgentBatches({
        plan,
        planPath: "/tmp/fixture-plan.json",
        planFileDigest: "a".repeat(64),
        expectedReleaseKey: "lexicon-v3-en-fixture.5",
        expectations: EXPECTATIONS
      }),
    /release-mismatch/u
  );
});

test("normalizes only redundant member shape fields and rejects conflicting French forms", () => {
  const { plan, batches } = buildFixturePlanAndBatches();
  const batch = batches.manifest.batches[0];
  assert.ok(batch);
  const inputA = parseInput(batches, batch.proposerA.relativePath);
  const response = proposalResponse(inputA);
  const common = response.proposals
    .flatMap((proposal) => proposal.memberPolicies)
    .find((member) => member.entryKey === "greek:G9048");
  assert.ok(common);
  common.primaryFr = common.derivedFr;
  const derived = response.proposals
    .flatMap((proposal) => proposal.memberPolicies)
    .find((member) => member.entryKey === "hebrew:H1001");
  assert.ok(derived);
  derived.primaryFr = derived.derivedFr;
  derived.allowedFrenchForms = ["Aharon"];
  derived.entityBindings[0]!.relation = "title";
  const parsed = parseFrenchEntityAgentProposalResponse({
    text: JSON.stringify(response),
    role: "proposerA",
    artifact: inputA,
    plan,
    owners: batches.manifest.owners
  });
  const parsedCommon = parsed
    .flatMap((proposal) => proposal.memberPolicies)
    .find((member) => member.entryKey === "greek:G9048");
  assert.equal(parsedCommon?.primaryFr, null);
  assert.ok(
    parsedCommon?.derivedFr &&
      parsedCommon.allowedFrenchForms.includes(parsedCommon.derivedFr)
  );
  assert.deepEqual(parsedCommon?.englishForms, []);
  const parsedDerived = parsed
    .flatMap((proposal) => proposal.memberPolicies)
    .find((member) => member.entryKey === "hebrew:H1001");
  assert.equal(parsedDerived?.primaryFr, null);
  assert.equal(parsedDerived?.entityBindings[0]?.relation, "alias");
  assert.ok(
    parsedDerived?.derivedFr &&
      parsedDerived.allowedFrenchForms.includes(parsedDerived.derivedFr)
  );

  const conflicting = structuredClone(response);
  const conflictingDerived = conflicting.proposals
    .flatMap((proposal) => proposal.memberPolicies)
    .find((member) => member.entryKey === "hebrew:H1001");
  assert.ok(conflictingDerived);
  conflictingDerived.primaryFr = "Forme contradictoire";
  assert.throws(
    () =>
      parseFrenchEntityAgentProposalResponse({
        text: JSON.stringify(conflicting),
        role: "proposerA",
        artifact: inputA,
        plan,
        owners: batches.manifest.owners
      }),
    /member-form-ambiguous/u
  );

  const competingVariant = structuredClone(response);
  const competingVariantMember = competingVariant.proposals
    .flatMap((proposal) => proposal.memberPolicies)
    .find((member) => member.entryKey === "hebrew:H1001");
  assert.ok(competingVariantMember);
  competingVariantMember.allowedFrenchForms = ["Aharon", "Aaron"];
  assert.throws(
    () =>
      parseFrenchEntityAgentProposalResponse({
        text: JSON.stringify(competingVariant),
        role: "proposerA",
        artifact: inputA,
        plan,
        owners: batches.manifest.owners
      }),
    /noncanonical-allowed-form/u
  );

  const gentilic = structuredClone(response);
  const gentilicMember = gentilic.proposals
    .flatMap((proposal) => proposal.memberPolicies)
    .find((member) => member.entryKey === "hebrew:H1001");
  assert.ok(gentilicMember);
  gentilicMember.treatment = "gentilic";
  gentilicMember.primaryFr = null;
  gentilicMember.derivedFr = "Aharonite";
  gentilicMember.allowedFrenchForms = ["Aharonite"];
  const parsedGentilic = parseFrenchEntityAgentProposalResponse({
    text: JSON.stringify(gentilic),
    role: "proposerA",
    artifact: inputA,
    plan,
    owners: batches.manifest.owners
  });
  assert.deepEqual(
    parsedGentilic
      .flatMap((proposal) => proposal.memberPolicies)
      .find((member) => member.entryKey === "hebrew:H1001")?.allowedFrenchForms,
    ["Aharonite", "Aharonites"]
  );
});

test("preserves LXX proper names without inventing a TIPNR entity or a common gloss", () => {
  const value = spec(
    "greek:G21437",
    1,
    "greek",
    "G21437 =",
    "Galen",
    "G:N-PRI",
    "red",
    []
  );
  const packet = makePacket(value);
  const initialRegistry = makeRegistry(packet, value);
  const { contentHash: _contentHash, ...registryContent } = initialRegistry;
  void _contentHash;
  const registry = {
    ...registryContent,
    reasons: [
      "no-exact-dstrong-entity",
      "reconstructed-lxx-name-without-tipnr-entity"
    ]
  };
  const sealedRegistry = {
    ...registry,
    contentHash: hashFrenchEntityJson(registry)
  };
  const base = buildFixture();
  const expectations = {
    packets: 9,
    entries: 9,
    anchors: 1,
    reviews: 8,
    singleEntityEntries: 3,
    noEntityEntries: 6,
    multiEntityEntries: 0,
    entityIds: 2,
    sharedEntityGroups: 1,
    sharedEntityEntries: 2,
    crossLanguageEntityGroups: 1,
    reviewUnits: 8,
    entityReviewUnits: 2,
    noEntityReviewUnits: 6,
    multiEntityReviewUnits: 0
  } satisfies FrenchEntityCanonicalizationExpectations;
  const plan = buildFrenchEntityCanonicalizationPlan({
    entityRegistry: [...base.registry, sealedRegistry],
    packets: [...base.packets, packet],
    sourceDigests: {
      entityRegistry: "1".repeat(64),
      packets: "2".repeat(64)
    },
    generatedAt: "2026-07-14T12:00:00.000Z",
    expectations
  });
  const batches = buildFrenchEntityAgentBatches({
    plan,
    planPath: "/tmp/lxx-name-plan.json",
    planFileDigest: "3".repeat(64),
    expectedReleaseKey: RELEASE,
    maxUnits: 1,
    expectations
  });
  const targetUnit = plan.reviewUnits.find((unit) =>
    unit.reviewEntryKeys.includes("greek:G21437")
  );
  const batch = batches.manifest.batches.find((candidate) =>
    candidate.unitIds.includes(targetUnit?.unitId ?? "")
  );
  assert.ok(batch);
  const artifact = parseInput(batches, batch.proposerA.relativePath);
  const view = artifact.views.find((candidate) =>
    candidate.reviewUnit.reviewEntryKeys.includes("greek:G21437")
  );
  const member = view?.members.find(
    (candidate) => candidate.entryKey === "greek:G21437"
  );
  assert.ok(view && member);
  const response = {
    proposals: [
      {
        schemaVersion: FRENCH_ENTITY_AGENT_PROPOSAL_SCHEMA_VERSION,
        role: "proposerA",
        unitId: view.unitId,
        inputHash: view.viewHash,
        canonicalEntities: [],
        memberPolicies: [
          {
            entryKey: member.entryKey,
            treatment: "unregistered-proper-name",
            entityBindings: [],
            constraint: "proper-name-without-entity",
            primaryFr: null,
            derivedFr: "Galem",
            englishForms: [member.englishGloss],
            allowedFrenchForms: ["Galem"],
            evidenceHashes: [member.allowedEvidenceHashes[0]],
            reasons: ["Nom propre LXX sans entité TIPNR."]
          }
        ]
      }
    ]
  };
  const parsed = parseFrenchEntityAgentProposalResponse({
    text: JSON.stringify(response),
    role: "proposerA",
    artifact,
    plan,
    owners: batches.manifest.owners
  });
  assert.equal(
    parsed[0]?.memberPolicies[0]?.treatment,
    "unregistered-proper-name"
  );
  assert.deepEqual(parsed[0]?.memberPolicies[0]?.entityBindings, []);

  const disguisedAsCommon = structuredClone(response);
  const forged = disguisedAsCommon.proposals[0]!.memberPolicies[0]!;
  forged.treatment = "etymological-or-common-gloss";
  forged.constraint = "lexical-translation";
  forged.englishForms = [];
  assert.throws(
    () =>
      parseFrenchEntityAgentProposalResponse({
        text: JSON.stringify(disguisedAsCommon),
        role: "proposerA",
        artifact,
        plan,
        owners: batches.manifest.owners
      }),
    /standalone-proper-name-treatment/u
  );
});

test("preserves one primary plus every alias in an exact multi-entity name", () => {
  const base = buildFixture();
  const mixedSpec = spec(
    "greek:G0963",
    9,
    "greek",
    "G0963 =",
    "Bethany",
    "N:N-F-L",
    "yellow",
    [
      match(3, "Bethany", "Bethany", "Béthanie", "place", "Town"),
      match(1, "Bethany", "Aaron", "Aaron", "person", "Male")
    ]
  );
  const mixedPacket = makePacket(mixedSpec);
  const initialMixedRegistry = makeRegistry(mixedPacket, mixedSpec);
  const { contentHash: _contentHash, ...mixedContent } = initialMixedRegistry;
  void _contentHash;
  const repairedMixed = {
    ...mixedContent,
    reasons: ["multiple-exact-dstrong-entities"]
  };
  const packets = [...base.packets, mixedPacket];
  const registries = [
    ...base.registry,
    {
      ...repairedMixed,
      contentHash: hashFrenchEntityJson(repairedMixed)
    }
  ];
  const expectations = {
    packets: 9,
    entries: 9,
    anchors: 1,
    reviews: 8,
    singleEntityEntries: 3,
    noEntityEntries: 5,
    multiEntityEntries: 1,
    entityIds: 3,
    sharedEntityGroups: 1,
    sharedEntityEntries: 3,
    crossLanguageEntityGroups: 1,
    reviewUnits: 8,
    entityReviewUnits: 2,
    noEntityReviewUnits: 5,
    multiEntityReviewUnits: 1
  } satisfies FrenchEntityCanonicalizationExpectations;
  const plan = buildFrenchEntityCanonicalizationPlan({
    entityRegistry: registries,
    packets,
    sourceDigests: {
      entityRegistry: "4".repeat(64),
      packets: "5".repeat(64)
    },
    generatedAt: "2026-07-14T12:00:00.000Z",
    expectations
  });
  const batches = buildFrenchEntityAgentBatches({
    plan,
    planPath: "/tmp/mixed-name-plan.json",
    planFileDigest: "6".repeat(64),
    expectedReleaseKey: RELEASE,
    maxUnits: 1,
    expectations
  });
  const targetUnit = plan.reviewUnits.find((unit) =>
    unit.reviewEntryKeys.includes("greek:G0963")
  );
  const batch = batches.manifest.batches.find((candidate) =>
    candidate.unitIds.includes(targetUnit?.unitId ?? "")
  );
  assert.ok(batch);
  const artifact = parseInput(batches, batch.proposerA.relativePath);
  const view = artifact.views.find((candidate) =>
    candidate.reviewUnit.reviewEntryKeys.includes("greek:G0963")
  );
  const member = view?.members.find(
    (candidate) => candidate.entryKey === "greek:G0963"
  );
  assert.ok(view && member);
  assert.deepEqual(view.ownerEntityIds, [3]);
  const response = {
    proposals: [
      {
        schemaVersion: FRENCH_ENTITY_AGENT_PROPOSAL_SCHEMA_VERSION,
        role: "proposerA",
        unitId: view.unitId,
        inputHash: view.viewHash,
        canonicalEntities: [
          {
            entityId: 3,
            primaryFr: "Béthanie",
            evidenceHashes: [
              view.entityGroups.find((group) => group.entityId === 3)!
                .groupProofHash
            ],
            reasons: ["Nom canonique français."]
          }
        ],
        memberPolicies: [
          {
            entryKey: member.entryKey,
            treatment: "canonical-name",
            entityBindings: [
              { entityId: 1, relation: "alias" },
              { entityId: 3, relation: "primary" }
            ],
            constraint: "canonical",
            primaryFr: "Béthanie",
            derivedFr: null,
            englishForms: [member.englishGloss],
            allowedFrenchForms: ["Béthanie"],
            evidenceHashes: [member.allowedEvidenceHashes[0]],
            reasons: [
              "Le propriétaire porte le canon; l'autre relation reste alias."
            ]
          }
        ]
      }
    ]
  };
  const parsed = parseFrenchEntityAgentProposalResponse({
    text: JSON.stringify(response),
    role: "proposerA",
    artifact,
    plan,
    owners: batches.manifest.owners
  });
  assert.deepEqual(parsed[0]?.memberPolicies[0]?.entityBindings, [
    { entityId: 1, relation: "alias" },
    { entityId: 3, relation: "primary" }
  ]);

  const flattened = structuredClone(response);
  flattened.proposals[0]!.memberPolicies[0]!.entityBindings[0]!.relation =
    "primary";
  assert.throws(
    () =>
      parseFrenchEntityAgentProposalResponse({
        text: JSON.stringify(flattened),
        role: "proposerA",
        artifact,
        plan,
        owners: batches.manifest.owners
      }),
    /canonical-shape/u
  );

  const missingAlias = structuredClone(response);
  missingAlias.proposals[0]!.memberPolicies[0]!.entityBindings = [
    { entityId: 3, relation: "primary" }
  ];
  assert.throws(
    () =>
      parseFrenchEntityAgentProposalResponse({
        text: JSON.stringify(missingAlias),
        role: "proposerA",
        artifact,
        plan,
        owners: batches.manifest.owners
      }),
    /multi-binding-coverage/u
  );
});

test("preserves parse-invalid agent evidence in collision-safe non-attestable quarantine", () => {
  const resultsDir = mkdtempSync(join(tmpdir(), "entity-agent-quarantine-"));
  try {
    const error = new Error("french-entity-agent-proposal-invalid:fixture");
    const quarantine = (attemptDirectory: string): string =>
      quarantineFrenchEntityAgentAttemptFailure({
        resultsDir,
        temporaryDirectory: attemptDirectory,
        role: "proposerA",
        batchId: "entities-fixture",
        attempt: 1,
        manifestHash: "1".repeat(64),
        planHash: "2".repeat(64),
        batchHash: "3".repeat(64),
        inputHash: "4".repeat(64),
        promptHash: "5".repeat(64),
        threadId: "11111111-1111-4111-8111-111111111111",
        error
      });
    const firstAttempt = join(resultsDir, "attempt-first");
    writeAttemptEvidence(firstAttempt);
    const first = quarantine(firstAttempt);
    assert.equal(existsSync(firstAttempt), false);
    assert.match(first, /quarantine\/proposerA\/entities-fixture/u);
    const firstRecord = JSON.parse(
      readFileSync(join(first, "quarantine.json"), "utf8")
    ) as {
      status: string;
      reusable: boolean;
      attestable: boolean;
      failureHash: string;
      quarantineHash: string;
      error: { message: string; errorHash: string };
      fileHashes: Record<string, string>;
    };
    assert.equal(firstRecord.status, "quarantined-non-reusable-non-attestable");
    assert.equal(firstRecord.reusable, false);
    assert.equal(firstRecord.attestable, false);
    assert.equal(firstRecord.error.message, error.message);
    assert.match(firstRecord.error.errorHash, /^[a-f0-9]{64}$/u);
    assert.match(firstRecord.quarantineHash, /^[a-f0-9]{64}$/u);
    assert.deepEqual(Object.keys(firstRecord.fileHashes).sort(), [
      "agentEvents",
      "agentStderr",
      "outputSchema",
      "prompt",
      "sealedInput",
      "structuredResponse"
    ]);
    assert.equal(
      readFileSync(join(first, "structured-response.json"), "utf8"),
      '{"proposals":[]}\n'
    );
    assert.equal(
      readFileSync(join(first, "sealed-input.json"), "utf8"),
      '{"sealed":true}\n'
    );

    const secondAttempt = join(resultsDir, "attempt-second");
    writeAttemptEvidence(secondAttempt);
    const second = quarantine(secondAttempt);
    const secondRecord = JSON.parse(
      readFileSync(join(second, "quarantine.json"), "utf8")
    ) as { failureHash: string };
    assert.notEqual(second, first);
    assert.equal(secondRecord.failureHash, firstRecord.failureHash);
    assert.equal(existsSync(first), true);
    assert.equal(existsSync(second), true);
  } finally {
    rmSync(resultsDir, { recursive: true, force: true });
  }
});

test("retries only marked Codex-stage failures, then succeeds or exhausts fail-closed", async () => {
  let successCalls = 0;
  const result = await runFrenchEntityAgentAttempts({
    maxAttempts: 3,
    label: "proposerA:fixture",
    execute: async (attempt) => {
      successCalls += 1;
      if (attempt < 3) {
        throw new FrenchEntityAgentRetryableAttemptError(
          new Error(`invalid-${attempt}`),
          `/quarantine/${attempt}`
        );
      }
      return "ok";
    }
  });
  assert.equal(result, "ok");
  assert.equal(successCalls, 3);

  let exhaustedCalls = 0;
  await assert.rejects(
    runFrenchEntityAgentAttempts({
      maxAttempts: 3,
      label: "auditor:fixture",
      execute: async (attempt) => {
        exhaustedCalls += 1;
        throw new FrenchEntityAgentRetryableAttemptError(
          new Error(`still-invalid-${attempt}`),
          `/quarantine/exhausted-${attempt}`
        );
      }
    }),
    /french-entity-run-attempts-exhausted:auditor:fixture:3:still-invalid-3/u
  );
  assert.equal(exhaustedCalls, 3);

  let fatalCalls = 0;
  await assert.rejects(
    runFrenchEntityAgentAttempts({
      maxAttempts: 3,
      label: "preflight:fixture",
      execute: async () => {
        fatalCalls += 1;
        throw new Error("source-drift-before-codex");
      }
    }),
    /source-drift-before-codex/u
  );
  assert.equal(fatalCalls, 1);
});

test("parses resumable bounded runner selections without enabling force reuse", () => {
  const parsed = parseFrenchEntityAgentRunArgs([
    "--release-key",
    RELEASE,
    "--stage",
    "proposers",
    "--concurrency",
    "3",
    "--batch",
    "entities-0001-a,entities-0002-b",
    "--offset-batches",
    "1",
    "--limit-batches",
    "2",
    "--existing-only"
  ]);
  assert.equal(parsed.stage, "proposers");
  assert.equal(parsed.concurrency, 3);
  assert.deepEqual(parsed.batchIds, ["entities-0001-a", "entities-0002-b"]);
  assert.equal(parsed.existingOnly, true);
  assert.equal(parsed.maxAttempts, 3);
  assert.equal(
    parseFrenchEntityAgentRunArgs([
      "--release-key",
      RELEASE,
      "--max-attempts",
      "5"
    ]).maxAttempts,
    5
  );
  for (const invalid of ["0", "6"]) {
    assert.throws(
      () =>
        parseFrenchEntityAgentRunArgs([
          "--release-key",
          RELEASE,
          "--max-attempts",
          invalid
        ]),
      /invalid-max-attempts/u
    );
  }
  assert.throws(
    () => parseFrenchEntityAgentRunArgs(["--release-key", RELEASE, "--force"]),
    /unknown-option:force/u
  );
});

function buildFixturePlanAndBatches(): {
  plan: FrenchEntityCanonicalizationPlan;
  batches: FrenchEntityAgentBatchBuild;
} {
  const fixture = buildFixture();
  const plan = buildFrenchEntityCanonicalizationPlan({
    entityRegistry: fixture.registry,
    packets: fixture.packets,
    sourceDigests: {
      entityRegistry: "a".repeat(64),
      packets: "b".repeat(64)
    },
    generatedAt: "2026-07-14T12:00:00.000Z",
    expectations: EXPECTATIONS
  });
  const batches = buildFrenchEntityAgentBatches({
    plan,
    planPath: "/tmp/fixture-plan.json",
    planFileDigest: createHash("sha256").update("fixture-plan").digest("hex"),
    expectedReleaseKey: RELEASE,
    maxUnits: 12,
    maxInputBytes: 512 * 1024,
    expectations: EXPECTATIONS
  });
  return { plan, batches };
}

function proposalResponse(input: FrenchEntityAgentInputArtifact): {
  proposals: Array<{
    schemaVersion: string;
    role: string;
    unitId: string;
    inputHash: string;
    canonicalEntities: Array<{
      entityId: number;
      primaryFr: string;
      evidenceHashes: string[];
      reasons: string[];
    }>;
    memberPolicies: Array<{
      entryKey: string;
      treatment: string;
      entityBindings: Array<{ entityId: number; relation: string }>;
      constraint: string;
      primaryFr: string | null;
      derivedFr: string | null;
      englishForms: string[];
      allowedFrenchForms: string[];
      evidenceHashes: string[];
      reasons: string[];
    }>;
  }>;
} {
  return {
    proposals: input.views.map((view) => {
      const canonicalEntities = view.ownerEntityIds.map((entityId) => ({
        entityId,
        primaryFr: "Juda",
        evidenceHashes: [
          view.entityGroups.find((group) => group.entityId === entityId)
            ?.groupProofHash ?? ""
        ],
        reasons: ["Forme biblique française stable."]
      }));
      return {
        schemaVersion: FRENCH_ENTITY_AGENT_PROPOSAL_SCHEMA_VERSION,
        role: input.role,
        unitId: view.unitId,
        inputHash: view.viewHash,
        canonicalEntities,
        memberPolicies: view.members.map((member) => {
          const evidenceHashes = [member.allowedEvidenceHashes[0] ?? ""];
          if (member.hardConstraints.mustRemainNonEntity) {
            return {
              entryKey: member.entryKey,
              treatment: "etymological-or-common-gloss",
              entityBindings: [],
              constraint: "lexical-translation",
              primaryFr: null,
              derivedFr: commonFrench(member.entryKey),
              englishForms: [],
              allowedFrenchForms: [commonFrench(member.entryKey)],
              evidenceHashes,
              reasons: ["Gloss lexical, non nom propre."]
            };
          }
          if (member.entryKey === "hebrew:H1001") {
            return {
              entryKey: member.entryKey,
              treatment: "alternate-name",
              entityBindings: [{ entityId: 1, relation: "alias" }],
              constraint: "derived",
              primaryFr: null,
              derivedFr: "Aharon",
              englishForms: [member.englishGloss],
              allowedFrenchForms: ["Aharon"],
              evidenceHashes,
              reasons: ["Variante explicite d’Aaron."]
            };
          }
          return {
            entryKey: member.entryKey,
            treatment: "canonical-name",
            entityBindings: [{ entityId: 2, relation: "primary" }],
            constraint: "canonical",
            primaryFr: "Juda",
            derivedFr: null,
            englishForms: [member.englishGloss],
            allowedFrenchForms: ["Juda"],
            evidenceHashes,
            reasons: ["Nom canonique français."]
          };
        })
      };
    })
  };
}

function buildFixture(): {
  packets: LexiconV3FrenchPacket[];
  registry: FrenchEntityRegistrySourceRecord[];
} {
  const specs = [
    spec("greek:G0002", 1, "greek", "G0002 =", "Aaron", "N:N-M-P", "green", [
      match(1, "Aaron", "Aaron", "Aaron", "person", "Male")
    ]),
    spec(
      "hebrew:H1001",
      2,
      "hebrew",
      "H1001 =",
      "Aharon",
      "N:N-M-P",
      "yellow",
      [match(1, "Aharon", "Aaron", "Aaron", "person", "Male")]
    ),
    spec("greek:G1002", 3, "greek", "G1002 =", "Judah", "N:N--L", "yellow", [
      match(2, "Judah", "Judah", "Juda", "place", "Region")
    ]),
    spec("greek:G9048", 4, "greek", "G9048 =", "a plain", "N:N", "red", []),
    spec("greek:G6160", 5, "greek", "G6160 =", "a portal", "N:N", "red", []),
    spec(
      "greek:G5514H",
      6,
      "greek",
      "G5514H =",
      "tender shoot",
      "N:A-F",
      "red",
      []
    ),
    spec(
      "greek:G2148",
      7,
      "greek",
      "G2148 =",
      "a north wind",
      "N:N--T",
      "red",
      []
    ),
    spec("greek:G2207", 8, "greek", "G2207 =", "zealot", "N:N-M-T", "red", [])
  ];
  const packets = specs.map(makePacket);
  return {
    packets,
    registry: specs.map((value, index) =>
      makeRegistry(packets[index] as LexiconV3FrenchPacket, value)
    )
  };
}

function spec(
  entryKey: string,
  stepEntryId: number,
  language: "greek" | "hebrew",
  dStrong: string,
  gloss: string,
  morph: string,
  status: "green" | "yellow" | "red",
  matches: FrenchEntityRegistrySourceMatch[]
) {
  return {
    entryKey,
    stepEntryId,
    language,
    dStrong,
    gloss,
    morph,
    status,
    matches
  };
}

function makePacket(value: ReturnType<typeof spec>): LexiconV3FrenchPacket {
  const primary = value.entryKey.split(":")[1] ?? "";
  const eStrong = primary.replace(/[A-Z]$/u, "");
  const meaning = `${value.gloss} definition`;
  const meaningHtml = `<p>${meaning}</p>`;
  const concordanceSurface =
    value.entryKey === "hebrew:H1001"
      ? "Aharon"
      : value.entryKey === "greek:G1002"
        ? "Juda"
        : `FORME-FR-${value.stepEntryId}`;
  return buildFrenchPacket(
    {
      entryKey: value.entryKey,
      identity: {
        stepEntryId: value.stepEntryId,
        language: value.language,
        eStrong,
        dStrong: value.dStrong,
        uStrong: primary,
        original: `original-${value.stepEntryId}`,
        transliteration: `transliteration-${value.stepEntryId}`,
        morph: value.morph
      },
      englishRelease: frenchPacketFixtureEnglishRelease({
        entryKey: value.entryKey,
        gloss: value.gloss,
        meaning,
        meaningHtml,
        releaseKey: RELEASE,
        releaseSnapshotFingerprint: SNAPSHOT,
        glossFieldVersionId: value.stepEntryId * 2 - 1,
        meaningFieldVersionId: value.stepEntryId * 2
      }),
      english: {
        contentHash: "",
        status: "validated",
        gloss: value.gloss,
        meaning,
        meaningHtml,
        sources: ["fixture"],
        issues: []
      },
      evidence: {
        occurrenceGlosses: [],
        concordanceForms: [
          {
            surface: concordanceSurface,
            normalized: concordanceSurface.toLocaleLowerCase("fr"),
            count: 2,
            strongCount: 1,
            witnessFamilies: ["Darby-family", "Sg1910"],
            sources: ["DarbyR", "Sg1910"]
          }
        ],
        legacy: null,
        existingFrench: null,
        resourceFrench: []
      }
    },
    "2026-07-14T12:00:00.000Z"
  );
}

function makeRegistry(
  packet: LexiconV3FrenchPacket,
  value: ReturnType<typeof spec>
): FrenchEntityRegistrySourceRecord {
  const green = value.status === "green";
  const content = {
    schemaVersion: FRENCH_ENTITY_REGISTRY_SCHEMA_VERSION,
    policyVersion: FRENCH_EDITORIAL_POLICY_VERSION,
    entryKey: packet.entryKey,
    stepEntryId: packet.identity.stepEntryId,
    identity: {
      language: packet.identity.language,
      primaryDStrong: packet.entryKey.split(":")[1] ?? "",
      eStrong: packet.identity.eStrong,
      dStrong: packet.identity.dStrong,
      uStrong: packet.identity.uStrong,
      morph: packet.identity.morph
    },
    englishGloss: packet.english.gloss,
    status: value.status,
    canonicalFr: green ? "Aaron" : null,
    reasons: [
      green
        ? "exact-entity-alias-and-two-family-french-attestation"
        : "requires-editorial-adjudication"
    ],
    matches: value.matches,
    referenceEvidence: green
      ? [{ surface: "Aaron", witnessFamilies: ["Darby-family", "Sg1910"] }]
      : [],
    historicalCandidate: {
      gloss: `HIST-FR-${packet.entryKey}`,
      trust: "untrusted-candidate" as const,
      sourceHash: hashFrenchEntityJson({ historical: packet.entryKey })
    },
    inputHash: hashFrenchEntityJson({ packet: packet.packetHash })
  };
  return { ...content, contentHash: hashFrenchEntityJson(content) };
}

function match(
  entityId: number,
  aliasEn: string,
  entityEn: string,
  candidateFr: string,
  category: string,
  type: string
): FrenchEntityRegistrySourceMatch {
  return {
    entityId,
    significance: "fixture",
    aliasEn,
    entityEn,
    candidateFr,
    category,
    type
  };
}

function parseInput(
  build: FrenchEntityAgentBatchBuild,
  path: string
): FrenchEntityAgentInputArtifact {
  const text = build.files.get(path);
  if (!text) throw new Error(`fixture-input-missing:${path}`);
  return JSON.parse(text) as FrenchEntityAgentInputArtifact;
}

function writeAttemptEvidence(directory: string): void {
  mkdirSync(directory, { recursive: false });
  writeFileSync(join(directory, "sealed-input.json"), '{"sealed":true}\n');
  writeFileSync(join(directory, "prompt.txt"), "sealed prompt");
  writeFileSync(join(directory, "output-schema.json"), '{"type":"object"}\n');
  writeFileSync(
    join(directory, "structured-response.json"),
    '{"proposals":[]}\n'
  );
  writeFileSync(join(directory, "agent-events.jsonl"), '{"event":"done"}\n');
  writeFileSync(join(directory, "agent-stderr.log"), "fixture stderr\n");
}

function passingChecks(): FrenchEntityAgentAuditChecks {
  return {
    exactStepIdentity: "pass",
    exactEnglishLineage: "pass",
    canonicalPrimaryCoherence: "pass",
    singularEditorialLemma: "pass",
    explicitMemberRelations: "pass",
    noCommonGlossForcedAsName: "pass",
    frenchNaturalness: "pass",
    historicalWitnessNotSoleAuthority: "pass"
  };
}

function rehashStoredArtifact(
  value: object,
  hashKey: "proposalHash" | "arbitrationHash" | "auditHash"
): void {
  const record = value as Record<string, unknown>;
  const content = Object.fromEntries(
    Object.entries(record).filter(([key]) => key !== hashKey)
  );
  record[hashKey] = hashFrenchEntityJson(content);
}

function commonFrench(entryKey: string): string {
  return `traduction lexicale ${entryKey.split(":")[1] ?? ""}`;
}

function required<K, V>(map: ReadonlyMap<K, V>, key: K): V {
  const value = map.get(key);
  if (value === undefined)
    throw new Error(`fixture-map-missing:${String(key)}`);
  return value;
}

void (null as unknown as FrenchEntityAgentProposal);
void (null as unknown as FrenchEntityAgentView);
