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
import { dirname, join } from "node:path";
import test from "node:test";

import {
  buildFrenchEntityAgentBatches,
  frenchEntityAgentArbiterUnitInputHash,
  frenchEntityAgentAuditorUnitInputHash,
  parseFrenchEntityAgentProposalResponse,
  FRENCH_ENTITY_AGENT_ARBITRATION_SCHEMA_VERSION,
  FRENCH_ENTITY_AGENT_AUDIT_SCHEMA_VERSION,
  FRENCH_ENTITY_AGENT_POLICY_VERSION,
  FRENCH_ENTITY_AGENT_PROPOSAL_SCHEMA_VERSION,
  type FrenchEntityAgentArbitration,
  type FrenchEntityAgentAudit,
  type FrenchEntityAgentAuditChecks,
  type FrenchEntityAgentBatchBuild,
  type FrenchEntityAgentBatchManifest,
  type FrenchEntityAgentInputArtifact,
  type FrenchEntityAgentProposal,
  type FrenchEntityAgentProposerBView,
  type FrenchEntityAgentTerminalMergeResult,
  type FrenchEntityAgentUnitArtifacts,
  type FrenchEntityAgentView
} from "../src/lexiconV3/frenchEntityAgentReview.js";
import {
  buildFrenchEntityCanonicalizationPlan,
  canonicalFrenchEntityJson,
  hashFrenchEntityJson,
  type FrenchEntityCanonicalizationExpectations,
  type FrenchEntityCanonicalizationPlan,
  type FrenchEntityRegistrySourceMatch,
  type FrenchEntityRegistrySourceRecord
} from "../src/lexiconV3/frenchEntityCanonicalization.js";
import {
  contentHash as frenchEditorialContentHash,
  FRENCH_EDITORIAL_BUILD_SCHEMA_VERSION,
  FRENCH_EDITORIAL_POLICY_VERSION,
  FRENCH_ENTITY_REGISTRY_SCHEMA_VERSION,
  FRENCH_MORPHOLOGY_SCHEMA_VERSION,
  FRENCH_TERMBASE_CANDIDATE_SCHEMA_VERSION
} from "../src/lexiconV3/frenchEditorialPolicy.js";
import {
  finalizeFrenchCodexExecutionReceipt,
  FRENCH_INTERNAL_EXECUTION_RECEIPT_SCHEMA_VERSION,
  type FrenchCodexExecutionReceipt
} from "../src/lexiconV3/frenchCodexExecutionReceipt.js";
import { FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE } from "../src/lexiconV3/frenchInternalReview.js";
import {
  FRENCH_ENTITY_MERGE_ATTESTATION_V2_SCHEMA_VERSION,
  prepareFrenchEntityMergeAttestationV2,
  type FrenchEntityRemediationIndex
} from "../src/lexiconV3/frenchEntityMergeAttestationV2.js";
import { assertFrenchEntityMergeAttestationAtPath } from "../src/lexiconV3/frenchEntityMergeAttestation.js";
import {
  frenchEntityQuarantinedEntryKeysFromMerge,
  replayFrenchEntityPipeline
} from "../src/lexiconV3/frenchEntityPipeline.js";
import {
  buildFrenchEntityRemediationRoundPlan,
  type FrenchEntityRemediationBaseViews
} from "../src/lexiconV3/frenchEntityRemediation.js";
import {
  loadFrenchInternalWorkSources,
  type FrenchEditorialBuildSummaryInput,
  type FrenchEditorialMorphologyRecord,
  type FrenchEditorialTermbaseRecord,
  type FrenchInternalPacketBuildSummary,
  type FrenchInternalSourcePaths
} from "../src/lexiconV3/frenchInternalWork.js";
import {
  buildFrenchPacket,
  type LexiconV3FrenchPacket
} from "../src/lexiconV3/frenchPackets.js";
import {
  canonicalFrenchReuseJson,
  FRENCH_REUSE_MANIFEST_SCHEMA_VERSION,
  FRENCH_REUSE_POLICY_VERSION,
  FRENCH_REUSE_RECORD_SCHEMA_VERSION,
  renderFrenchReuseRecords,
  type FrenchReuseManifestSummary,
  type FrenchReuseRecord
} from "../src/lexiconV3/frenchReuseManifest.js";
import { HEBREW_IDENTITY_CORRECTIONS_REGISTRY_DIGEST } from "../src/lexiconV3/hebrewIdentityCorrections.js";
import {
  parseFrenchEntityRemediationPlanArgs,
  runFrenchEntityRemediationPlanCli
} from "../scripts/buildLexiconV3FrenchEntityRemediationRoundPlan.js";
import {
  adaptFrenchEntityRemediationKeyedResponse,
  buildFrenchEntityRemediationExecutionBatches,
  buildFrenchEntityRemediationRoleExecutionInput,
  frenchEntityRemediationArbitrationResponseSchema,
  frenchEntityRemediationAuditResponseSchema,
  frenchEntityRemediationProposalResponseSchema,
  frenchEntityRemediationRoundRoot,
  FRENCH_ENTITY_REMEDIATION_RUNNER_POLICY_VERSION,
  parseFrenchEntityRemediationRunArgs,
  runFrenchEntityRemediationRoundCli,
  type FrenchEntityRemediationProcessExecution,
  type FrenchEntityRemediationProcessInput,
  type FrenchEntityRemediationRunCliOptions
} from "../scripts/runLexiconV3FrenchEntityRemediationRound.js";
import {
  buildFrenchEntityAgentRoleExecutionInput,
  FRENCH_ENTITY_AGENT_RUNNER_POLICY_VERSION,
  FRENCH_ENTITY_AGENT_RUN_SCHEMA_VERSION,
  type FrenchEntityAgentRun,
  type FrenchEntityAgentRunCliOptions,
  type FrenchEntityAgentRoleExecutionInput
} from "../scripts/runLexiconV3FrenchEntityAgents.js";
import {
  FRENCH_CODEX_EXECUTOR_POLICY_VERSION,
  frenchCodexDisabledFeaturesHash,
  frenchCodexEnvironmentPolicyHash
} from "../scripts/runLexiconV3FrenchCodexProposerBatch.js";
import { frenchPacketFixtureEnglishRelease } from "./lexiconV3FrenchPacketFixture.js";

const RELEASE = "lexicon-v3-en-remediation-runner-fixture.1";
const SNAPSHOT = "d".repeat(64);
const OLD_SECRET = "ANCIEN-FR-SECRET";
const NEW_PRIMARY = "Judée";
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

const UNBOUND_EXPECTATIONS = {
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

test("terminal entity quarantine is reconstructed once for every downstream replay", () => {
  const plan = {
    reviewUnits: [
      { unitId: "unit-b", reviewEntryKeys: ["hebrew:H0002", "hebrew:H0001"] },
      { unitId: "unit-a", reviewEntryKeys: ["hebrew:H0001"] }
    ]
  } as unknown as FrenchEntityCanonicalizationPlan;
  const merged = {
    quarantinedUnitIds: ["unit-b", "unit-a"]
  } as unknown as FrenchEntityAgentTerminalMergeResult;

  assert.deepEqual(
    frenchEntityQuarantinedEntryKeysFromMerge({ plan, merged }),
    ["hebrew:H0001", "hebrew:H0002"]
  );
  assert.throws(
    () =>
      frenchEntityQuarantinedEntryKeysFromMerge({
        plan,
        merged: {
          quarantinedUnitIds: ["unit-missing"]
        } as unknown as FrenchEntityAgentTerminalMergeResult
      }),
    /french-entity-pipeline-quarantine-unit-missing:unit-missing/u
  );
});

test("remediation structured output keys every unit exactly", () => {
  const unitIds = ["unit-000328", "unit-000329"];
  const hashes = ["1".repeat(64), "2".repeat(64)];
  const proposalSchema = frenchEntityRemediationProposalResponseSchema(
    "proposerA",
    unitIds.map((unitId, index) => ({
      role: "proposerA",
      unitId,
      inputHash: required(hashes, index),
      ownerEntityIds: [index + 1],
      reviewEntryKeys: [`hebrew:H${index + 1}`]
    }))
  ) as {
    properties: {
      units: {
        required: string[];
        additionalProperties: boolean;
        properties: Record<string, unknown>;
      };
    };
  };
  assert.deepEqual(proposalSchema.properties.units.required, unitIds);
  assert.equal(proposalSchema.properties.units.additionalProperties, false);
  assert.deepEqual(
    Object.keys(proposalSchema.properties.units.properties),
    unitIds
  );
  assert.equal(
    FRENCH_ENTITY_REMEDIATION_RUNNER_POLICY_VERSION.endsWith("@3"),
    true
  );

  const arbitrationSchema = frenchEntityRemediationArbitrationResponseSchema(
    unitIds.map((unitId, index) => ({
      unitId,
      inputHash: required(hashes, index),
      proposalAHash: "a".repeat(64),
      proposalBHash: "b".repeat(64)
    }))
  ) as typeof proposalSchema;
  const auditSchema = frenchEntityRemediationAuditResponseSchema(
    unitIds.map((unitId, index) => ({
      unitId,
      inputHash: required(hashes, index),
      auditedProposalHash: "c".repeat(64),
      selectedProposalRole: "proposerA",
      evidenceConflictCodes: []
    }))
  ) as typeof proposalSchema;
  assert.deepEqual(arbitrationSchema.properties.units.required, unitIds);
  assert.deepEqual(auditSchema.properties.units.required, unitIds);
});

test("remediation keyed adapter preserves order and rejects coverage or binding tamper", () => {
  const unitIds = ["unit-000328", "unit-000329"];
  const left = { unitId: unitIds[0], marker: "left" };
  const right = { unitId: unitIds[1], marker: "right" };
  const adapted = JSON.parse(
    adaptFrenchEntityRemediationKeyedResponse({
      text: JSON.stringify({
        units: { [unitIds[1]]: right, [unitIds[0]]: left }
      }),
      unitIds,
      collection: "proposals"
    })
  ) as { proposals: Array<{ unitId: string; marker: string }> };
  assert.deepEqual(adapted.proposals, [left, right]);

  assert.throws(
    () =>
      adaptFrenchEntityRemediationKeyedResponse({
        text: JSON.stringify({ units: { [unitIds[0]]: left } }),
        unitIds,
        collection: "proposals"
      }),
    /units-coverage/u
  );
  assert.throws(
    () =>
      adaptFrenchEntityRemediationKeyedResponse({
        text: JSON.stringify({
          units: {
            [unitIds[0]]: left,
            [unitIds[1]]: right,
            "unit-forged": { unitId: "unit-forged" }
          }
        }),
        unitIds,
        collection: "decisions"
      }),
    /units-coverage/u
  );
  assert.throws(
    () =>
      adaptFrenchEntityRemediationKeyedResponse({
        text: JSON.stringify({
          units: {
            [unitIds[0]]: left,
            [unitIds[1]]: { ...right, unitId: unitIds[0] }
          }
        }),
        unitIds,
        collection: "audits"
      }),
    /unit-binding:unit-000329/u
  );
  assert.throws(
    () =>
      adaptFrenchEntityRemediationKeyedResponse({
        text: JSON.stringify({ units: { [unitIds[0]]: left } }),
        unitIds: [unitIds[0], unitIds[0]],
        collection: "proposals"
      }),
    /unit-ids-invalid/u
  );
});

test("remediation conditionally exposes and parses exact unbound-name treatments", () => {
  const properName = buildUnboundRemediationExecutionFixture({
    entryKey: "greek:G8397",
    language: "greek",
    dStrong: "G8397 =",
    gloss: "Nisan",
    morph: "N:N",
    treatment: "unregistered-proper-name",
    constraint: "proper-name-without-entity",
    derivedFr: "Nisan"
  });
  assert.match(properName.execution.prompt, /unboundNameEntryKeys/u);
  assert.match(
    canonicalFrenchEntityJson(properName.execution.schema),
    /unregistered-proper-name/u
  );
  const parsedProperName = properName.execution.parse(
    keyedUnboundProposalResponse(properName)
  ) as FrenchEntityAgentProposal[];
  assert.equal(
    parsedProperName[0]?.memberPolicies[0]?.treatment,
    "unregistered-proper-name"
  );
  assert.deepEqual(parsedProperName[0]?.memberPolicies[0]?.entityBindings, []);

  const standaloneLxx = buildUnboundRemediationExecutionFixture({
    entryKey: "greek:G21449",
    language: "greek",
    dStrong: "G21449 =",
    gloss: "Theco",
    morph: "G:N-PRI",
    treatment: "unregistered-proper-name",
    constraint: "proper-name-without-entity",
    derivedFr: "Théco"
  });
  assert.match(standaloneLxx.execution.prompt, /Les entrées LXX G:N-PRI/u);
  const parsedStandaloneLxx = standaloneLxx.execution.parse(
    keyedUnboundProposalResponse(standaloneLxx)
  ) as FrenchEntityAgentProposal[];
  assert.equal(
    parsedStandaloneLxx[0]?.memberPolicies[0]?.treatment,
    "unregistered-proper-name"
  );
  assert.deepEqual(
    parsedStandaloneLxx[0]?.memberPolicies[0]?.entityBindings,
    []
  );

  const alternate = buildUnboundRemediationExecutionFixture({
    entryKey: "hebrew:H7774H",
    language: "hebrew",
    dStrong: "H7774H = a Spelling of",
    gloss: "Shua",
    morph: "N:N-F-P",
    treatment: "alternate-name",
    constraint: "derived",
    derivedFr: "Shua"
  });
  assert.match(alternate.execution.prompt, /a Spelling of/u);
  const parsedAlternate = alternate.execution.parse(
    keyedUnboundProposalResponse(alternate)
  ) as FrenchEntityAgentProposal[];
  assert.equal(
    parsedAlternate[0]?.memberPolicies[0]?.treatment,
    "alternate-name"
  );
  assert.deepEqual(parsedAlternate[0]?.memberPolicies[0]?.entityBindings, []);
});

test("remediation leaves unrelated proposer prompt and schema hashes stable", () => {
  const root = mkdtempSync(join(tmpdir(), "lexicon-v3-remediation-hash-"));
  try {
    const fixture = materializeFixture(root);
    const batch = required(
      buildFrenchEntityRemediationExecutionBatches(
        fixture.manifest,
        fixture.roundPlan
      ),
      0
    );
    const execution = buildFrenchEntityRemediationRoleExecutionInput({
      manifest: fixture.manifest,
      canonicalPlan: fixture.plan,
      roundPlan: fixture.roundPlan,
      batch,
      role: "proposerA"
    });
    assert.doesNotMatch(
      execution.prompt,
      /unboundNameEntryKeys|a Spelling of/u
    );
    assert.equal(
      hashFrenchEntityJson(execution.prompt),
      "89e058829e1cb6a1b4f610151bfc86949d97078a52661da1becc967b32e2a2f3"
    );
    assert.equal(
      hashFrenchEntityJson(execution.schema),
      "48e1e90d4ccd433e563e1cdeecc5cad0258cc24f8af59f31e3d42a18280c43f6"
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("remediation CLI has no force/partial subset escape hatch", () => {
  assert.throws(
    () =>
      parseFrenchEntityRemediationRunArgs([
        "--round-plan",
        "/tmp/round.json",
        "--release-key",
        RELEASE,
        "--force"
      ]),
    /unknown-option:force/u
  );
  assert.throws(
    () =>
      parseFrenchEntityRemediationRunArgs([
        "--round-plan",
        "/tmp/round.json",
        "--release-key",
        RELEASE,
        "--batch",
        "one"
      ]),
    /unknown-option:batch/u
  );
});

test("remediation plan CLI rejects typos, duplicate values and output-mode collisions", () => {
  assert.throws(
    () =>
      parseFrenchEntityRemediationPlanArgs([
        "--release-key",
        RELEASE,
        "--histroy",
        "/tmp/round.json"
      ]),
    /unknown-option:histroy/u
  );
  assert.throws(
    () =>
      parseFrenchEntityRemediationPlanArgs([
        "--release-key",
        RELEASE,
        "--release-key",
        RELEASE
      ]),
    /duplicate-option:release-key/u
  );
  assert.throws(
    () =>
      parseFrenchEntityRemediationPlanArgs([
        "--release-key",
        RELEASE,
        "--output",
        "/tmp/plan.json",
        "--output-dir",
        "/tmp/plans"
      ]),
    /output-mode-collision/u
  );
  assert.throws(
    () =>
      parseFrenchEntityRemediationPlanArgs([
        "--release-key",
        RELEASE,
        "--round",
        "4"
      ]),
    /unknown-option:round/u
  );
});

test("materializes one physical content-addressed plan atomically and refuses collisions", () => {
  const root = mkdtempSync(join(tmpdir(), "lexicon-v3-remediation-plan-cli-"));
  try {
    const fixture = materializeFixture(root);
    const outputDir = join(root, "published-plans");
    const options = {
      manifest: fixture.manifestPath,
      resultsDir: fixture.resultsDir,
      releaseKey: RELEASE,
      previousRoundPlan: null,
      output: null,
      outputDir
    };
    const summary = runFrenchEntityRemediationPlanCli(options, {
      expectations: EXPECTATIONS
    });
    assert.equal(summary.round, 1);
    assert.equal(summary.units, 1);
    assert.equal(summary.planHash, fixture.roundPlan.planHash);
    assert.equal(summary.baseRunsReplayed, 4);
    assert.equal(summary.historicalRoundsReplayed, 0);
    assert.equal(summary.historicalRunsReplayed, 0);
    assert.equal(
      summary.planPath,
      join(outputDir, `round-01-${fixture.roundPlan.planHash}.json`)
    );
    assert.equal(
      readFileSync(summary.planPath, "utf8"),
      `${canonicalFrenchEntityJson(fixture.roundPlan)}\n`
    );
    const explicitPath = join(root, "explicit-round-plan.json");
    const explicitSummary = runFrenchEntityRemediationPlanCli(
      { ...options, output: explicitPath, outputDir: null },
      { expectations: EXPECTATIONS }
    );
    assert.equal(explicitSummary.planPath, explicitPath);
    assert.equal(
      readFileSync(explicitPath, "utf8"),
      `${canonicalFrenchEntityJson(fixture.roundPlan)}\n`
    );
    assert.throws(
      () =>
        runFrenchEntityRemediationPlanCli(options, {
          expectations: EXPECTATIONS
        }),
      /output-collision/u
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("replays a complete residual history and materializes the exact next round", async () => {
  const root = mkdtempSync(join(tmpdir(), "lexicon-v3-remediation-next-plan-"));
  try {
    const fixture = materializeFixture(root);
    let threadCounter = 300;
    const firstRound = await runFrenchEntityRemediationRoundCli(
      {
        manifest: fixture.manifestPath,
        roundPlan: fixture.roundPlanPath,
        resultsDir: fixture.resultsDir,
        releaseKey: RELEASE,
        stage: "all",
        concurrency: 1,
        codexBinary: "/fixture/unused-codex",
        codexHome: join(root, "codex-home"),
        timeoutMs: 10_000,
        maxAttempts: 1,
        existingOnly: false
      },
      {
        executeAgent: async (input) => {
          const sealed = JSON.parse(
            readFileSync(
              join(input.workingDirectory, "sealed-input.json"),
              "utf8"
            )
          ) as { records: Array<Record<string, unknown>> };
          threadCounter += 1;
          return {
            threadId: threadId(threadCounter),
            stdout: `${canonicalFrenchEntityJson({ event: "agent_message" })}\n`,
            stderr: "",
            responseText: fakeResponse(input.role, sealed.records, "hold"),
            usage: null,
            startedAt: "2026-07-14T12:00:00.000Z",
            completedAt: "2026-07-14T12:00:01.000Z"
          };
        },
        executorMetadata: fixtureExecutor(),
        expectations: EXPECTATIONS
      }
    );
    assert.deepEqual(firstRound.residualUnitIds, [fixture.targetUnitId]);
    assert.ok(firstRound.roundResultPath);
    const previousRoundPlan = join(
      dirname(firstRound.roundResultPath),
      "round-plan.json"
    );
    const next = runFrenchEntityRemediationPlanCli(
      {
        manifest: fixture.manifestPath,
        resultsDir: fixture.resultsDir,
        releaseKey: RELEASE,
        previousRoundPlan,
        output: null,
        outputDir: join(root, "next-plans")
      },
      { expectations: EXPECTATIONS }
    );
    assert.equal(next.round, 2);
    assert.equal(next.units, 1);
    assert.equal(next.historicalRoundsReplayed, 1);
    assert.equal(next.historicalRunsReplayed, 4);
    const plan = JSON.parse(readFileSync(next.planPath, "utf8")) as {
      round: number;
      parentRoundHash: string | null;
      unitIds: string[];
      units: Array<{
        proposerA: {
          context: {
            parentHashes: { rejectedSemanticProposalHashes: string[] };
          };
        };
      }>;
    };
    const roundResult = JSON.parse(
      readFileSync(firstRound.roundResultPath, "utf8")
    ) as { roundHash: string };
    assert.equal(plan.round, 2);
    assert.equal(plan.parentRoundHash, roundResult.roundHash);
    assert.deepEqual(plan.unitIds, [fixture.targetUnitId]);
    assert.equal(
      required(plan.units, 0).proposerA.context.parentHashes
        .rejectedSemanticProposalHashes.length,
      2
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("remediation plan CLI refuses a structurally valid request beyond round three", () => {
  const root = mkdtempSync(join(tmpdir(), "lexicon-v3-remediation-plan-max-"));
  try {
    const fixture = materializeFixture(root);
    const units = fixture.roundPlan.units.map((unit) => {
      const { unitHash: _unitHash, ...unitContent } = unit;
      void _unitHash;
      return {
        ...unitContent,
        unitHash: hashFrenchEntityJson(unitContent)
      };
    });
    const planContent = {
      schemaVersion: fixture.roundPlan.schemaVersion,
      policyVersion: fixture.roundPlan.policyVersion,
      round: 3,
      parentRoundHash: "f".repeat(64),
      unitIds: fixture.roundPlan.unitIds,
      units
    };
    const roundThree = {
      ...planContent,
      planHash: hashFrenchEntityJson(planContent)
    };
    const roundRoot = frenchEntityRemediationRoundRoot(
      fixture.resultsDir,
      roundThree
    );
    mkdirSync(roundRoot, { recursive: true });
    const previousRoundPlan = join(roundRoot, "round-plan.json");
    writeFileSync(
      previousRoundPlan,
      `${canonicalFrenchEntityJson(roundThree)}\n`,
      "utf8"
    );
    assert.throws(
      () =>
        runFrenchEntityRemediationPlanCli(
          {
            manifest: fixture.manifestPath,
            resultsDir: fixture.resultsDir,
            releaseKey: RELEASE,
            previousRoundPlan,
            output: join(root, "must-not-exist.json"),
            outputDir: null
          },
          { expectations: EXPECTATIONS }
        ),
      /round-exceeds-max:4/u
    );
    assert.equal(existsSync(join(root, "must-not-exist.json")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects fully rehashed invalid base evidence before scheduling a round", async (t) => {
  for (const mutation of [
    "empty-checks",
    "forged-input-hash",
    "forged-receipt-input-hash",
    "forged-run-input-hash"
  ] as const) {
    await t.test(mutation, async () => {
      const root = mkdtempSync(
        join(tmpdir(), `lexicon-v3-remediation-base-${mutation}-`)
      );
      try {
        const fixture = materializeFixture(root);
        if (mutation === "forged-receipt-input-hash") {
          rewriteBaseAuditorReceiptInputHash(fixture);
        } else if (mutation === "forged-run-input-hash") {
          rewriteBaseRunInputHash(fixture);
        } else {
          rewriteBaseAuditorEvidence(fixture, mutation);
        }
        assert.throws(
          () =>
            runFrenchEntityRemediationPlanCli(
              {
                manifest: fixture.manifestPath,
                resultsDir: fixture.resultsDir,
                releaseKey: RELEASE,
                previousRoundPlan: null,
                output: join(root, "must-not-exist.json"),
                outputDir: null
              },
              { expectations: EXPECTATIONS }
            ),
          mutation === "empty-checks"
            ? /audit-checks/u
            : mutation === "forged-input-hash"
              ? /stored-audit-invalid/u
              : mutation === "forged-run-input-hash"
                ? /existing-release-or-plan-mismatch/u
                : /base-receipt-input-hash/u
        );
        assert.equal(existsSync(join(root, "must-not-exist.json")), false);
        let executions = 0;
        await assert.rejects(
          () =>
            runFrenchEntityRemediationRoundCli(
              {
                manifest: fixture.manifestPath,
                roundPlan: fixture.roundPlanPath,
                resultsDir: fixture.resultsDir,
                releaseKey: RELEASE,
                stage: "all",
                concurrency: 1,
                codexBinary: "/fixture/unused-codex",
                codexHome: join(root, "codex-home"),
                timeoutMs: 10_000,
                maxAttempts: 1,
                existingOnly: false
              },
              {
                executeAgent: async () => {
                  executions += 1;
                  throw new Error("fixture-executor-must-not-run");
                },
                executorMetadata: fixtureExecutor(),
                expectations: EXPECTATIONS
              }
            ),
          mutation === "empty-checks"
            ? /audit-checks/u
            : mutation === "forged-input-hash"
              ? /stored-audit-invalid/u
              : mutation === "forged-run-input-hash"
                ? /existing-release-or-plan-mismatch/u
                : /base-receipt-input-hash/u
        );
        assert.equal(executions, 0);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  }
});

test("runs one additive physical round, keeps A blind and replays through attestation v2", async () => {
  const root = mkdtempSync(join(tmpdir(), "lexicon-v3-remediation-runner-"));
  try {
    const fixture = materializeFixture(root);
    const batches = buildFrenchEntityRemediationExecutionBatches(
      fixture.manifest,
      fixture.roundPlan
    );
    assert.equal(batches.length, 1);
    assert.deepEqual(batches[0]?.unitIds, [fixture.targetUnitId]);
    const proposerAInput = buildFrenchEntityRemediationRoleExecutionInput({
      manifest: fixture.manifest,
      canonicalPlan: fixture.plan,
      roundPlan: fixture.roundPlan,
      batch: required(batches, 0),
      role: "proposerA"
    });
    const proposerBInput = buildFrenchEntityRemediationRoleExecutionInput({
      manifest: fixture.manifest,
      canonicalPlan: fixture.plan,
      roundPlan: fixture.roundPlan,
      batch: required(batches, 0),
      role: "proposerB"
    });
    assert.doesNotMatch(proposerAInput.prompt, new RegExp(OLD_SECRET, "u"));
    assert.match(proposerBInput.prompt, new RegExp(OLD_SECRET, "u"));
    assert.match(proposerAInput.prompt, /lemme éditorial singulier/u);
    assert.match(proposerBInput.prompt, /lemme éditorial singulier/u);
    assert.equal(
      JSON.parse(proposerAInput.text).records[0].context.parentHashes
        .rejectedSemanticProposalHashes.length,
      1
    );

    let threadCounter = 100;
    const executeAgent = async (
      input: FrenchEntityRemediationProcessInput
    ): Promise<FrenchEntityRemediationProcessExecution> => {
      if (input.role === "auditor") {
        assert.match(input.prompt, /singularEditorialLemma=pass/u);
        assert.match(input.prompt, /huit checks=pass/u);
        assert.match(input.prompt, /couvrent seulement trois cas bornés/u);
        assert.doesNotMatch(
          input.prompt,
          /nom propre LXX autonome à cinq chiffres/u
        );
      }
      const sealed = JSON.parse(
        readFileSync(join(input.workingDirectory, "sealed-input.json"), "utf8")
      ) as { records: Array<Record<string, unknown>> };
      const responseText = fakeResponse(input.role, sealed.records);
      threadCounter += 1;
      return {
        threadId: threadId(threadCounter),
        stdout: `${canonicalFrenchEntityJson({ event: "agent_message" })}\n`,
        stderr: "",
        responseText,
        usage: null,
        startedAt: "2026-07-14T12:00:00.000Z",
        completedAt: "2026-07-14T12:00:01.000Z"
      };
    };
    const options: FrenchEntityRemediationRunCliOptions = {
      manifest: fixture.manifestPath,
      roundPlan: fixture.roundPlanPath,
      resultsDir: fixture.resultsDir,
      releaseKey: RELEASE,
      stage: "all",
      concurrency: 2,
      codexBinary: "/fixture/unused-codex",
      codexHome: join(root, "codex-home"),
      timeoutMs: 10_000,
      maxAttempts: 1,
      existingOnly: false
    };
    const summary = await runFrenchEntityRemediationRoundCli(options, {
      executeAgent,
      executorMetadata: fixtureExecutor(),
      expectations: EXPECTATIONS
    });
    assert.equal(summary.executed, 4);
    assert.equal(summary.reused, 0);
    assert.equal(summary.distinctThreads, 4);
    assert.deepEqual(summary.residualUnitIds, []);
    assert.ok(summary.roundResultPath);
    assert.ok(summary.remediationIndexPath);
    const previousRoundPlan = join(
      dirname(summary.roundResultPath),
      "round-plan.json"
    );
    assert.throws(
      () =>
        runFrenchEntityRemediationPlanCli(
          {
            manifest: fixture.manifestPath,
            resultsDir: fixture.resultsDir,
            releaseKey: RELEASE,
            previousRoundPlan,
            output: join(root, "round-two-must-not-exist.json"),
            outputDir: null
          },
          { expectations: EXPECTATIONS }
        ),
      /no-residual/u
    );

    const collisionRoot = join(
      fixture.resultsDir,
      "remediation",
      "round-01-ffffffffffffffff"
    );
    mkdirSync(collisionRoot, { recursive: true });
    writeFileSync(
      join(collisionRoot, "round-plan.json"),
      readFileSync(previousRoundPlan),
      "utf8"
    );
    writeFileSync(
      join(collisionRoot, "round-result.json"),
      readFileSync(summary.roundResultPath),
      "utf8"
    );
    assert.throws(
      () =>
        runFrenchEntityRemediationPlanCli(
          {
            manifest: fixture.manifestPath,
            resultsDir: fixture.resultsDir,
            releaseKey: RELEASE,
            previousRoundPlan,
            output: join(root, "collision-must-not-exist.json"),
            outputDir: null
          },
          { expectations: EXPECTATIONS }
        ),
      /history-content-address|history-collision/u
    );
    rmSync(collisionRoot, { recursive: true, force: true });

    const index = JSON.parse(
      readFileSync(summary.remediationIndexPath, "utf8")
    ) as FrenchEntityRemediationIndex;
    assert.equal(index.rounds.length, 1);
    const canonicalEntitiesPath = join(root, "canonical-entities.jsonl");
    const canonicalEntryPoliciesPath = join(root, "entry-policies.jsonl");
    const quarantinePath = join(root, "entity-quarantine.jsonl");
    const finalOverlayPath = join(root, "final-overlay.json");
    const attestationPath = join(root, "entity-merge-attestation.json");
    const prepared = prepareFrenchEntityMergeAttestationV2({
      manifestPath: fixture.manifestPath,
      baseResultsDirectory: fixture.resultsDir,
      remediationIndexPath: summary.remediationIndexPath,
      canonicalEntitiesPath,
      canonicalEntryPoliciesPath,
      quarantinePath,
      finalOverlayPath,
      expectedReleaseKey: RELEASE,
      expectations: EXPECTATIONS
    });
    assert.equal(prepared.attestation.remediation.rounds.length, 1);
    assert.equal(prepared.attestation.counts.remediation.unitAttempts, 1);
    assert.equal(prepared.attestation.counts.remediation.runs, 4);
    assert.equal(prepared.attestation.counts.final.safe, 7);
    assert.equal(prepared.attestation.counts.final.hold, 0);
    assert.equal(prepared.overlay.entries.length, 7);

    writeFileSync(
      canonicalEntitiesPath,
      prepared.canonicalEntitiesText,
      "utf8"
    );
    writeFileSync(
      canonicalEntryPoliciesPath,
      prepared.canonicalEntryPoliciesText,
      "utf8"
    );
    writeFileSync(quarantinePath, prepared.quarantineText, "utf8");
    writeFileSync(finalOverlayPath, prepared.overlayText, "utf8");
    writeFileSync(
      attestationPath,
      `${canonicalFrenchEntityJson(prepared.attestation)}\n`,
      "utf8"
    );
    const replay = assertFrenchEntityMergeAttestationAtPath({
      attestationPath,
      canonicalEntitiesPath,
      canonicalEntryPoliciesPath,
      expectedReleaseKey: RELEASE,
      expectations: EXPECTATIONS
    });
    assert.equal(
      replay.attestation.attestationHash,
      prepared.attestation.attestationHash
    );
    assert.equal(replay.merged.mergeHash, prepared.merged.mergeHash);

    const entityPipeline = replayFrenchEntityPipeline({
      plan: fixture.plan,
      canonicalEntities: prepared.merged.canonicalEntities,
      canonicalEntryPolicies: prepared.merged.entryPolicies,
      packets: fixture.packets,
      expectations: EXPECTATIONS
    });
    const internalSourcePaths = materializeFrenchInternalSourceFixture({
      root,
      packets: fixture.packets,
      registry: fixture.registry,
      canonicalEntitiesPath,
      canonicalEntryPoliciesPath,
      entityMergeAttestationPath: attestationPath,
      entityGate: entityPipeline.entityGate,
      entityMentions: entityPipeline.entityMentions
    });
    assert.throws(
      () =>
        loadFrenchInternalWorkSources({
          sourcePaths: internalSourcePaths,
          expectations: {
            expectedEntryCount: 8,
            expectedPilotSize: 1,
            releaseKey: RELEASE,
            releaseSnapshotFingerprint: SNAPSHOT
          }
        }),
      /french-entity/u
    );
    const internalSources = loadFrenchInternalWorkSources({
      sourcePaths: internalSourcePaths,
      entityExpectations: EXPECTATIONS,
      expectations: {
        expectedEntryCount: 8,
        expectedPilotSize: 1,
        releaseKey: RELEASE,
        releaseSnapshotFingerprint: SNAPSHOT
      }
    });
    assert.equal(
      internalSources.entityMergeAttestation.schemaVersion,
      FRENCH_ENTITY_MERGE_ATTESTATION_V2_SCHEMA_VERSION
    );
    assert.equal(internalSources.packets.length, 8);
    assert.equal(
      internalSources.canonicalEntryPolicies.length,
      prepared.merged.entryPolicies.length
    );

    const second = await runFrenchEntityRemediationRoundCli(
      { ...options, existingOnly: true },
      { expectations: EXPECTATIONS }
    );
    assert.equal(second.executed, 0);
    assert.equal(second.reused, 4);
    assert.equal(second.remediationIndexPath, summary.remediationIndexPath);

    writeFileSync(
      join(
        required(index.rounds, 0).resultsDirectory,
        "proposerA",
        required(batches, 0).batchId,
        "prompt.txt"
      ),
      "tampered",
      "utf8"
    );
    assert.throws(
      () =>
        runFrenchEntityRemediationPlanCli(
          {
            manifest: fixture.manifestPath,
            resultsDir: fixture.resultsDir,
            releaseKey: RELEASE,
            previousRoundPlan,
            output: join(root, "tamper-must-not-exist.json"),
            outputDir: null
          },
          { expectations: EXPECTATIONS }
        ),
      /prompt-drift|source-drift|hash-drift/u
    );
    await assert.rejects(
      () =>
        runFrenchEntityRemediationRoundCli(
          { ...options, existingOnly: true },
          { expectations: EXPECTATIONS }
        ),
      /prompt-drift|source-drift|hash-drift/u
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function materializeFixture(root: string): {
  plan: FrenchEntityCanonicalizationPlan;
  manifest: FrenchEntityAgentBatchManifest;
  manifestPath: string;
  roundPlan: ReturnType<typeof buildFrenchEntityRemediationRoundPlan>;
  roundPlanPath: string;
  resultsDir: string;
  targetUnitId: string;
  packets: LexiconV3FrenchPacket[];
  registry: FrenchEntityRegistrySourceRecord[];
} {
  const source = fixtureSource();
  const plan = buildFrenchEntityCanonicalizationPlan({
    entityRegistry: source.registry,
    packets: source.packets,
    sourceDigests: {
      entityRegistry: "a".repeat(64),
      packets: "b".repeat(64)
    },
    generatedAt: "2026-07-14T12:00:00.000Z",
    expectations: EXPECTATIONS
  });
  const planPath = join(root, "plan.json");
  const planText = `${canonicalFrenchEntityJson(plan)}\n`;
  writeFileSync(planPath, planText, "utf8");
  const build = buildFrenchEntityAgentBatches({
    plan,
    planPath,
    planFileDigest: sha256(planText),
    expectedReleaseKey: RELEASE,
    maxUnits: 12,
    maxInputBytes: 512 * 1024,
    expectations: EXPECTATIONS
  });
  const batchRoot = join(root, "agent-batches");
  for (const [relativePath, text] of build.files) {
    const path = join(batchRoot, relativePath);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text, "utf8");
  }
  const manifestPath = join(batchRoot, "manifest.json");
  const manifest = build.manifest;
  const batch = required(manifest.batches, 0);
  const inputA = inputArtifact(build, batch.proposerA.relativePath);
  const inputB = inputArtifact(build, batch.proposerB.relativePath);
  const proposalA = parseFrenchEntityAgentProposalResponse({
    text: JSON.stringify({
      proposals: inputA.views.map((view) =>
        rawProposal(view, view.viewHash, OLD_SECRET)
      )
    }),
    role: "proposerA",
    artifact: inputA,
    plan,
    owners: manifest.owners
  });
  const proposalB = parseFrenchEntityAgentProposalResponse({
    text: JSON.stringify({
      proposals: inputB.views.map((view) =>
        rawProposal(view, view.viewHash, OLD_SECRET)
      )
    }),
    role: "proposerB",
    artifact: inputB,
    plan,
    owners: manifest.owners
  });
  const targetUnitId = required(
    plan.reviewUnits.find((unit) =>
      unit.reviewEntryKeys.includes("greek:G1002")
    ),
    "target-unit"
  ).unitId;
  const artifacts = new Map<string, FrenchEntityAgentUnitArtifacts>();
  for (const unitId of batch.unitIds) {
    const left = required(
      proposalA.find((proposal) => proposal.unitId === unitId),
      unitId
    );
    const right = required(
      proposalB.find((proposal) => proposal.unitId === unitId),
      unitId
    );
    const sourceView = required(
      inputB.views.find((view) => view.unitId === unitId),
      unitId
    ) as FrenchEntityAgentProposerBView;
    const arbitration = baseArbitration(unitId, sourceView, left, right);
    artifacts.set(unitId, {
      proposalA: left,
      proposalB: right,
      arbitration,
      audit: baseAudit(
        unitId,
        sourceView,
        left,
        right,
        arbitration,
        unitId === targetUnitId
      )
    });
  }
  const resultsDir = join(root, "agent-results");
  materializeBaseResults({
    resultsDir,
    manifest,
    manifestPath,
    plan,
    planPath,
    artifacts
  });
  const views = new Map<string, FrenchEntityRemediationBaseViews>();
  for (const unitId of batch.unitIds) {
    views.set(unitId, {
      proposerA: required(
        inputA.views.find((view) => view.unitId === unitId),
        unitId
      ) as FrenchEntityRemediationBaseViews["proposerA"],
      proposerB: required(
        inputB.views.find((view) => view.unitId === unitId),
        unitId
      ) as FrenchEntityRemediationBaseViews["proposerB"]
    });
  }
  const roundPlan = buildFrenchEntityRemediationRoundPlan({
    round: 1,
    baseViews: views,
    currentArtifacts: artifacts
  });
  assert.deepEqual(roundPlan.unitIds, [targetUnitId]);
  const roundPlanPath = join(root, "round-plan.json");
  writeFileSync(
    roundPlanPath,
    `${canonicalFrenchEntityJson(roundPlan)}\n`,
    "utf8"
  );
  return {
    plan,
    manifest,
    manifestPath,
    roundPlan,
    roundPlanPath,
    resultsDir,
    targetUnitId,
    packets: source.packets,
    registry: source.registry
  };
}

interface UnboundRemediationFixtureSpec {
  entryKey: string;
  language: "greek" | "hebrew";
  dStrong: string;
  gloss: string;
  morph: string;
  treatment: "unregistered-proper-name" | "alternate-name";
  constraint: "proper-name-without-entity" | "derived";
  derivedFr: string;
}

function buildUnboundRemediationExecutionFixture(
  input: UnboundRemediationFixtureSpec
): {
  execution: ReturnType<typeof buildFrenchEntityRemediationRoleExecutionInput>;
  view: FrenchEntityAgentView;
  inputHash: string;
  spec: UnboundRemediationFixtureSpec;
} {
  const sourceSpec = spec(
    input.entryKey,
    1,
    input.language,
    input.dStrong,
    input.gloss,
    input.morph,
    "red",
    []
  );
  const source = fixtureSource();
  const packet = makePacket(sourceSpec);
  source.packets.push(packet);
  source.registry.push(makeRegistry(packet, sourceSpec));
  const plan = buildFrenchEntityCanonicalizationPlan({
    entityRegistry: source.registry,
    packets: source.packets,
    sourceDigests: {
      entityRegistry: "a".repeat(64),
      packets: "b".repeat(64)
    },
    generatedAt: "2026-07-14T12:00:00.000Z",
    expectations: UNBOUND_EXPECTATIONS
  });
  const planText = `${canonicalFrenchEntityJson(plan)}\n`;
  const build = buildFrenchEntityAgentBatches({
    plan,
    planPath: "/fixture/unbound-plan.json",
    planFileDigest: sha256(planText),
    expectedReleaseKey: RELEASE,
    maxUnits: 12,
    maxInputBytes: 512 * 1024,
    expectations: UNBOUND_EXPECTATIONS
  });
  const manifest = build.manifest;
  const baseBatch = required(manifest.batches, 0);
  const inputA = inputArtifact(build, baseBatch.proposerA.relativePath);
  const inputB = inputArtifact(build, baseBatch.proposerB.relativePath);
  const unitId = required(
    plan.reviewUnits.find((unit) =>
      unit.reviewEntryKeys.includes(input.entryKey)
    ),
    input.entryKey
  ).unitId;
  const proposalsA = parseFrenchEntityAgentProposalResponse({
    text: JSON.stringify({
      proposals: inputA.views.map((view) =>
        view.unitId === unitId
          ? rawUnboundProposal(view, view.viewHash, input)
          : rawProposal(view, view.viewHash, OLD_SECRET)
      )
    }),
    role: "proposerA",
    artifact: inputA,
    plan,
    owners: manifest.owners
  });
  const proposalsB = parseFrenchEntityAgentProposalResponse({
    text: JSON.stringify({
      proposals: inputB.views.map((view) =>
        view.unitId === unitId
          ? rawUnboundProposal(view, view.viewHash, input)
          : rawProposal(view, view.viewHash, OLD_SECRET)
      )
    }),
    role: "proposerB",
    artifact: inputB,
    plan,
    owners: manifest.owners
  });
  const artifacts = new Map<string, FrenchEntityAgentUnitArtifacts>();
  const views = new Map<string, FrenchEntityRemediationBaseViews>();
  for (const currentUnitId of baseBatch.unitIds) {
    const proposalA = required(
      proposalsA.find((proposal) => proposal.unitId === currentUnitId),
      currentUnitId
    );
    const proposalB = required(
      proposalsB.find((proposal) => proposal.unitId === currentUnitId),
      currentUnitId
    );
    const viewA = required(
      inputA.views.find((view) => view.unitId === currentUnitId),
      currentUnitId
    );
    const viewB = required(
      inputB.views.find((view) => view.unitId === currentUnitId),
      currentUnitId
    ) as FrenchEntityAgentProposerBView;
    const arbitration = baseArbitration(
      currentUnitId,
      viewB,
      proposalA,
      proposalB
    );
    artifacts.set(currentUnitId, {
      proposalA,
      proposalB,
      arbitration,
      audit: baseAudit(
        currentUnitId,
        viewB,
        proposalA,
        proposalB,
        arbitration,
        currentUnitId === unitId
      )
    });
    views.set(currentUnitId, {
      proposerA: viewA as FrenchEntityRemediationBaseViews["proposerA"],
      proposerB: viewB
    });
  }
  const roundPlan = buildFrenchEntityRemediationRoundPlan({
    round: 1,
    baseViews: views,
    currentArtifacts: artifacts
  });
  const batch = required(
    buildFrenchEntityRemediationExecutionBatches(manifest, roundPlan),
    0
  );
  const execution = buildFrenchEntityRemediationRoleExecutionInput({
    manifest,
    canonicalPlan: plan,
    roundPlan,
    batch,
    role: "proposerA"
  });
  const record = required(
    (
      JSON.parse(execution.text) as {
        records: Array<{ inputHash: string; view: FrenchEntityAgentView }>;
      }
    ).records,
    0
  );
  return {
    execution,
    view: record.view,
    inputHash: record.inputHash,
    spec: input
  };
}

function keyedUnboundProposalResponse(input: {
  view: FrenchEntityAgentView;
  inputHash: string;
  spec: UnboundRemediationFixtureSpec;
}): string {
  const proposal = rawUnboundProposal(input.view, input.inputHash, input.spec);
  return JSON.stringify({ units: { [input.view.unitId]: proposal } });
}

function rawUnboundProposal(
  view: FrenchEntityAgentView,
  inputHash: string,
  input: UnboundRemediationFixtureSpec
): Record<string, unknown> {
  const member = required(view.members, 0);
  return {
    schemaVersion: FRENCH_ENTITY_AGENT_PROPOSAL_SCHEMA_VERSION,
    role: view.role,
    unitId: view.unitId,
    inputHash,
    canonicalEntities: [],
    memberPolicies: [
      {
        entryKey: member.entryKey,
        treatment: input.treatment,
        entityBindings: [],
        constraint: input.constraint,
        primaryFr: null,
        derivedFr: input.derivedFr,
        englishForms: [member.englishGloss],
        allowedFrenchForms: [input.derivedFr],
        evidenceHashes: [required(member.allowedEvidenceHashes, 0)],
        reasons: ["Nom propre sans identifiant TIPNR."]
      }
    ]
  };
}

function materializeFrenchInternalSourceFixture(input: {
  root: string;
  packets: readonly LexiconV3FrenchPacket[];
  registry: readonly FrenchEntityRegistrySourceRecord[];
  canonicalEntitiesPath: string;
  canonicalEntryPoliciesPath: string;
  entityMergeAttestationPath: string;
  entityGate: ReturnType<typeof replayFrenchEntityPipeline>["entityGate"];
  entityMentions: ReturnType<
    typeof replayFrenchEntityPipeline
  >["entityMentions"];
}): FrenchInternalSourcePaths {
  const directory = join(input.root, "french-internal-sources");
  mkdirSync(directory, { recursive: true });
  const sourcePaths: FrenchInternalSourcePaths = {
    packets: join(directory, "french-packets.jsonl"),
    packetSummary: join(directory, "french-packets.summary.json"),
    reuseRecords: join(directory, "reuse-records.jsonl"),
    reuseSummary: join(directory, "reuse-summary.json"),
    entityRegistry: join(directory, "entity-registry.jsonl"),
    canonicalEntities: input.canonicalEntitiesPath,
    canonicalEntryPolicies: input.canonicalEntryPoliciesPath,
    entityMergeAttestation: input.entityMergeAttestationPath,
    entityGate: join(directory, "entity-gate.json"),
    entityMentions: join(directory, "entity-mentions.json"),
    termbase: join(directory, "termbase.jsonl"),
    morphology: join(directory, "morphology.jsonl"),
    editorialSummary: join(directory, "editorial-summary.json"),
    guide: join(directory, "editorial-guide.json")
  };
  const bookRegistryPath = join(directory, "book-registry.json");
  const packets = [...input.packets].sort((left, right) =>
    left.entryKey.localeCompare(right.entryKey)
  );
  const registry = [...input.registry].sort((left, right) =>
    left.entryKey.localeCompare(right.entryKey)
  );
  const packetText = renderCanonicalJsonl(packets);
  const registryText = renderCanonicalJsonl(registry);
  writeFileSync(sourcePaths.packets, packetText, "utf8");
  writeFileSync(sourcePaths.entityRegistry, registryText, "utf8");
  writeFileSync(
    sourcePaths.entityGate,
    `${canonicalFrenchEntityJson(input.entityGate)}\n`,
    "utf8"
  );
  writeFileSync(
    sourcePaths.entityMentions,
    `${canonicalFrenchEntityJson(input.entityMentions)}\n`,
    "utf8"
  );

  const reuseRecords = packets.map(buildFixtureReuseRecord);
  const reuseText = renderFrenchReuseRecords(reuseRecords);
  writeFileSync(sourcePaths.reuseRecords, reuseText, "utf8");
  const authoringDigest = "1".repeat(64);
  const legacyDigest = "2".repeat(64);
  const englishRelease = {
    releaseKey: RELEASE,
    releaseId: 1,
    state: "promoted" as const,
    snapshotFingerprint: SNAPSHOT,
    sourceFingerprint: "3".repeat(64),
    sourceLogicalFingerprint: "4".repeat(64),
    codeFingerprint: "5".repeat(64),
    policyVersion: "fixture-english-release-policy@1"
  };
  const packetSummary: FrenchInternalPacketBuildSummary = {
    schemaVersion: "lexicon-v3-french-packet-build@3",
    generatedAt: "2026-07-14T12:00:00.000Z",
    inputRecords: packets.length,
    outputPackets: packets.length,
    englishStatusCounts: {
      validated: packets.length,
      human_validated: 0,
      review_needed: 0,
      source_issue: 0
    },
    sourceDigests: {
      englishEvidence: "6".repeat(64),
      fullDatabase: legacyDigest,
      legacyDatabase: legacyDigest,
      Sg1910: "7".repeat(64),
      Darby: "8".repeat(64),
      DarbyR: "9".repeat(64),
      englishAuthoring: authoringDigest
    },
    englishAuthoring: {
      path: join(directory, "fixture-authoring.sqlite"),
      digest: authoringDigest
    },
    englishRelease: {
      ...englishRelease,
      expectedEntryCount: packets.length,
      fieldCount: packets.length * 2
    },
    outputDigest: sha256(packetText)
  };
  writeCanonicalJson(sourcePaths.packetSummary, packetSummary);
  const reuseSummary = buildFixtureReuseSummary({
    recordsPath: sourcePaths.reuseRecords,
    records: reuseRecords,
    recordsText: reuseText,
    authoringDigest,
    legacyDigest,
    englishRelease
  });
  writeCanonicalJson(sourcePaths.reuseSummary, reuseSummary);

  const termbase = packets.map(buildFixtureTermbaseRecord);
  const termbaseText = renderCanonicalJsonl(termbase);
  writeFileSync(sourcePaths.termbase, termbaseText, "utf8");
  const morphology = [buildFixtureMorphologyRecord()];
  const morphologyText = renderCanonicalJsonl(morphology);
  writeFileSync(sourcePaths.morphology, morphologyText, "utf8");
  const guide = {
    schemaVersion: "lexicon-v3-french-editorial-guide@1" as const,
    locale: "fr" as const,
    releaseRule: "Toute divergence bloque la publication.",
    style: { register: "français lexicographique" }
  };
  const guideText = `${canonicalFrenchEntityJson(guide)}\n`;
  writeFileSync(sourcePaths.guide, guideText, "utf8");
  const bookRegistryText = "[]\n";
  writeFileSync(bookRegistryPath, bookRegistryText, "utf8");

  const entityStatus = countStatuses(registry.map((record) => record.status));
  const termbaseStatus = countStatuses(termbase.map((record) => record.status));
  const summaryContent: Omit<
    FrenchEditorialBuildSummaryInput,
    "summaryContentHash"
  > = {
    schemaVersion: FRENCH_EDITORIAL_BUILD_SCHEMA_VERSION,
    policyVersion: FRENCH_EDITORIAL_POLICY_VERSION,
    generatedAt: "2026-07-14T12:00:00.000Z",
    releaseKey: RELEASE,
    counts: {
      books: 0,
      entries: packets.length,
      entityRegistry: registry.length,
      entityStatus,
      termbaseCandidates: termbase.length,
      termbaseStatus,
      morphologyTranslations: morphology.length,
      morphologyScopes: { fixture: morphology.length },
      historicalFrenchCandidates: termbase.filter(
        (record) => record.historicalFrench !== null
      ).length,
      legacyCandidates: 0,
      concordanceFormsAttached: termbase.reduce(
        (total, record) => total + record.concordanceForms.length,
        0
      )
    },
    sourceDigests: {
      editorialGuide: sha256(guideText),
      packets: sha256(packetText)
    },
    artifacts: {
      bookRegistry: artifactDescriptor(bookRegistryPath, bookRegistryText, 0),
      entityRegistry: artifactDescriptor(
        sourcePaths.entityRegistry,
        registryText,
        registry.length
      ),
      termbaseCandidates: artifactDescriptor(
        sourcePaths.termbase,
        termbaseText,
        termbase.length
      ),
      morphology: artifactDescriptor(
        sourcePaths.morphology,
        morphologyText,
        morphology.length
      )
    }
  };
  const editorialSummary: FrenchEditorialBuildSummaryInput = {
    ...summaryContent,
    summaryContentHash: frenchEditorialContentHash(summaryContent)
  };
  writeCanonicalJson(sourcePaths.editorialSummary, editorialSummary);
  return sourcePaths;
}

function buildFixtureReuseRecord(
  packet: LexiconV3FrenchPacket
): FrenchReuseRecord {
  const existingFrench = packet.evidence.existingFrench;
  if (existingFrench === null) {
    throw new Error(`fixture-missing-existing-french:${packet.entryKey}`);
  }
  const identity = {
    language: packet.identity.language,
    eStrong: packet.identity.eStrong,
    primaryDStrong: packet.entryKey.split(":")[1] ?? "",
    dStrong: packet.identity.dStrong,
    uStrong: packet.identity.uStrong,
    original: packet.identity.original,
    transliteration: packet.identity.transliteration,
    morph: packet.identity.morph
  };
  const content: Omit<FrenchReuseRecord, "recordDigest"> = {
    schemaVersion: FRENCH_REUSE_RECORD_SCHEMA_VERSION,
    entryKey: packet.entryKey,
    stepEntryId: packet.identity.stepEntryId,
    identity,
    identityHash: sha256(canonicalFrenchReuseJson(identity)),
    parents: {
      gloss: {
        releaseKey: packet.englishRelease.releaseKey,
        releaseSnapshotFingerprint:
          packet.englishRelease.releaseSnapshotFingerprint,
        ...packet.englishRelease.parents.gloss
      },
      meaning: {
        releaseKey: packet.englishRelease.releaseKey,
        releaseSnapshotFingerprint:
          packet.englishRelease.releaseSnapshotFingerprint,
        ...packet.englishRelease.parents.meaning
      }
    },
    priorEnglish: {
      glossHash: sha256(packet.english.gloss),
      meaningHtmlHash: sha256(packet.english.meaningHtml)
    },
    priorFrench: {
      glossHash: sha256(existingFrench.gloss),
      meaningTextHash: sha256(existingFrench.meaning),
      meaningHtmlHash: sha256(existingFrench.meaningHtml),
      specificTextHash: null,
      specificHtmlHash: null,
      specificVisibleTextHtmlMatch: null
    },
    meaningCohort: "unchanged",
    cohortProof: {
      kind: "byte_identity",
      currentHtmlDigest: sha256(packet.english.meaningHtml),
      previousHtmlDigest: sha256(packet.english.meaningHtml)
    },
    publicationAction: null,
    glossReviewSeed: false,
    meaningReviewSeed: false,
    glossRiskFlags: [],
    highRiskFlags: []
  };
  return {
    ...content,
    recordDigest: sha256(canonicalFrenchReuseJson(content))
  };
}

function buildFixtureReuseSummary(input: {
  recordsPath: string;
  records: readonly FrenchReuseRecord[];
  recordsText: string;
  authoringDigest: string;
  legacyDigest: string;
  englishRelease: {
    releaseKey: string;
    releaseId: number;
    state: "promoted";
    snapshotFingerprint: string;
    sourceFingerprint: string;
    sourceLogicalFingerprint: string;
    codeFingerprint: string;
    policyVersion: string;
  };
}): FrenchReuseManifestSummary {
  const counts: FrenchReuseManifestSummary["counts"] = {
    entries: input.records.length,
    englishFields: input.records.length * 2,
    meaningCohorts: {
      unchanged: input.records.length,
      step_specific_only: 0,
      other_changed: 0
    },
    glossReviewSeed: 0,
    meaningReviewSeed: 0,
    highRiskEntries: 0,
    stepSpecificFrenchPrefixDivergence: 0,
    stepSpecificFrenchTextUnavailable: 0,
    residualMeaningCohorts: {
      unchanged: 0,
      step_specific_only: 0,
      other_changed: 0
    },
    otherChangedSelections: {},
    glossRiskFlags: {},
    highRiskFlags: {}
  };
  const withoutDigest: Omit<FrenchReuseManifestSummary, "manifestDigest"> = {
    schemaVersion: FRENCH_REUSE_MANIFEST_SCHEMA_VERSION,
    policyVersion: FRENCH_REUSE_POLICY_VERSION,
    generatedAt: "2026-07-14T12:00:00.000Z",
    sourcePaths: {
      authoring: "/fixture/authoring.sqlite",
      legacyFull: "/fixture/legacy.sqlite",
      records: input.recordsPath
    },
    sourceDigests: {
      authoring: input.authoringDigest,
      legacyFull: input.legacyDigest
    },
    englishRelease: input.englishRelease,
    counts,
    registryDigests: {
      hebrewGlossResidual: "a".repeat(64),
      hebrewMeaningResidual: "b".repeat(64),
      hebrewIdentityCorrections: HEBREW_IDENTITY_CORRECTIONS_REGISTRY_DIGEST
    },
    recordsLogicalDigest: sha256(
      canonicalFrenchReuseJson(
        input.records.map((record) => ({
          entryKey: record.entryKey,
          recordDigest: record.recordDigest
        }))
      )
    ),
    recordsOutputDigest: sha256(input.recordsText)
  };
  const projection = {
    schemaVersion: withoutDigest.schemaVersion,
    policyVersion: withoutDigest.policyVersion,
    sourceDigests: withoutDigest.sourceDigests,
    englishRelease: withoutDigest.englishRelease,
    counts: withoutDigest.counts,
    registryDigests: withoutDigest.registryDigests,
    recordsLogicalDigest: withoutDigest.recordsLogicalDigest,
    recordsOutputDigest: withoutDigest.recordsOutputDigest
  };
  return {
    ...withoutDigest,
    manifestDigest: sha256(canonicalFrenchReuseJson(projection))
  };
}

function buildFixtureTermbaseRecord(
  packet: LexiconV3FrenchPacket
): FrenchEditorialTermbaseRecord {
  const existingFrench = packet.evidence.existingFrench;
  if (existingFrench === null) {
    throw new Error(`fixture-missing-existing-french:${packet.entryKey}`);
  }
  const content: Omit<FrenchEditorialTermbaseRecord, "contentHash"> = {
    schemaVersion: FRENCH_TERMBASE_CANDIDATE_SCHEMA_VERSION,
    policyVersion: FRENCH_EDITORIAL_POLICY_VERSION,
    entryKey: packet.entryKey,
    stepEntryId: packet.identity.stepEntryId,
    identity: {
      language: packet.identity.language,
      primaryDStrong: packet.entryKey.split(":")[1] ?? "",
      classicalStrong: packet.identity.eStrong,
      eStrong: packet.identity.eStrong,
      dStrong: packet.identity.dStrong,
      uStrong: packet.identity.uStrong,
      original: packet.identity.original,
      transliteration: packet.identity.transliteration,
      morph: packet.identity.morph
    },
    english: {
      gloss: packet.english.gloss,
      meaning: packet.english.meaningHtml,
      glossStatusHash: packet.englishRelease.parents.gloss.contentHash,
      meaningStatusHash: packet.englishRelease.parents.meaning.contentHash
    },
    pos: "proper-name",
    status: "red",
    canonicalFr: null,
    reasons: ["fixture-internal-agent-required"],
    historicalFrench: {
      gloss: existingFrench.gloss,
      meaning: existingFrench.meaning,
      meaningHtml: existingFrench.meaningHtml,
      trust: "untrusted-candidate",
      sourceHash: existingFrench.sourceHash
    },
    legacyFrench: null,
    concordanceForms: packet.evidence.concordanceForms.map((form) => ({
      ...form
    })),
    deterministicRepairCandidate: null,
    inputHash: frenchEditorialContentHash({ packetHash: packet.packetHash })
  };
  return {
    ...content,
    contentHash: frenchEditorialContentHash(content)
  };
}

function buildFixtureMorphologyRecord(): FrenchEditorialMorphologyRecord {
  const content: Omit<FrenchEditorialMorphologyRecord, "contentHash"> = {
    schemaVersion: FRENCH_MORPHOLOGY_SCHEMA_VERSION,
    policyVersion: FRENCH_EDITORIAL_POLICY_VERSION,
    inputHash: frenchEditorialContentHash({ morphologyCodeId: 1 }),
    morphologyCodeId: 1,
    code: "N:N-M-P",
    normalizedCode: "N:N-M-P",
    source: "fixture",
    scope: "fixture",
    sourceLanguage: "grc",
    language: "fr",
    meaning: "nom propre masculin",
    description: "Forme nominale de fixture.",
    example: "Aaron",
    structuredPairs: []
  };
  return {
    ...content,
    contentHash: frenchEditorialContentHash(content)
  };
}

function artifactDescriptor(path: string, text: string, records: number) {
  return {
    path,
    sha256: sha256(text),
    bytes: Buffer.byteLength(text),
    records
  };
}

function countStatuses(statuses: readonly ("green" | "yellow" | "red")[]) {
  return {
    green: statuses.filter((status) => status === "green").length,
    yellow: statuses.filter((status) => status === "yellow").length,
    red: statuses.filter((status) => status === "red").length
  };
}

function renderCanonicalJsonl(values: readonly unknown[]): string {
  return `${values.map((value) => canonicalFrenchEntityJson(value)).join("\n")}\n`;
}

function writeCanonicalJson(path: string, value: unknown): void {
  writeFileSync(path, `${canonicalFrenchEntityJson(value)}\n`, "utf8");
}

function fakeResponse(
  role: FrenchEntityRemediationProcessInput["role"],
  records: Array<Record<string, unknown>>,
  auditVerdict: "safe" | "hold" = "safe"
): string {
  if (role === "proposerA" || role === "proposerB") {
    const proposals = records.map((record) =>
      rawProposal(
        record.view as FrenchEntityAgentView,
        record.inputHash as string,
        NEW_PRIMARY
      )
    );
    return `${JSON.stringify({
      units: Object.fromEntries(
        proposals.map((proposal) => [proposal.unitId, proposal])
      )
    })}\n`;
  }
  if (role === "arbiter") {
    const decisions = records.map((record) => {
      const proposal = record.proposalA as FrenchEntityAgentProposal;
      return {
        schemaVersion: FRENCH_ENTITY_AGENT_ARBITRATION_SCHEMA_VERSION,
        role: "arbiter",
        unitId: record.unitId,
        inputHash: record.inputHash,
        selectedProposal: "proposalA",
        selectedProposalHash: proposal.proposalHash,
        reasons: ["La proposition A corrige la forme rejetée."]
      };
    });
    return `${JSON.stringify({
      units: Object.fromEntries(
        decisions.map((decision) => [decision.unitId, decision])
      )
    })}\n`;
  }
  const audits = records.map((record) => ({
    schemaVersion: FRENCH_ENTITY_AGENT_AUDIT_SCHEMA_VERSION,
    role: "auditor",
    unitId: record.unitId,
    inputHash: record.inputHash,
    auditedProposalHash: (record.selectedProposal as FrenchEntityAgentProposal)
      .proposalHash,
    verdict: auditVerdict,
    checks:
      auditVerdict === "safe"
        ? passingChecks()
        : { ...passingChecks(), frenchNaturalness: "fail" },
    reasons:
      auditVerdict === "safe"
        ? []
        : ["La naturalité française reste à corriger."]
  }));
  return `${JSON.stringify({
    units: Object.fromEntries(audits.map((audit) => [audit.unitId, audit]))
  })}\n`;
}

function rawProposal(
  view: FrenchEntityAgentView,
  inputHash: string,
  targetPrimary: string
): Record<string, unknown> {
  return {
    schemaVersion: FRENCH_ENTITY_AGENT_PROPOSAL_SCHEMA_VERSION,
    role: view.role,
    unitId: view.unitId,
    inputHash,
    canonicalEntities: view.ownerEntityIds.map((entityId) => ({
      entityId,
      primaryFr: targetPrimary,
      evidenceHashes: [
        required(
          view.entityGroups.find((group) => group.entityId === entityId),
          entityId
        ).groupProofHash
      ],
      reasons: ["Forme biblique française stable."]
    })),
    memberPolicies: view.members.map((member) => {
      const evidenceHashes = [required(member.allowedEvidenceHashes, 0)];
      if (member.hardConstraints.mustRemainNonEntity) {
        const selected = commonFrench(member.entryKey);
        return {
          entryKey: member.entryKey,
          treatment: "etymological-or-common-gloss",
          entityBindings: [],
          constraint: "lexical-translation",
          primaryFr: null,
          derivedFr: selected,
          englishForms: [],
          allowedFrenchForms: [selected],
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
        primaryFr: targetPrimary,
        derivedFr: null,
        englishForms: [member.englishGloss],
        allowedFrenchForms: [targetPrimary],
        evidenceHashes,
        reasons: ["Nom canonique français."]
      };
    })
  };
}

function baseArbitration(
  unitId: string,
  sourceView: FrenchEntityAgentProposerBView,
  proposalA: FrenchEntityAgentProposal,
  proposalB: FrenchEntityAgentProposal
): FrenchEntityAgentArbitration {
  const content = {
    schemaVersion: FRENCH_ENTITY_AGENT_ARBITRATION_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_AGENT_POLICY_VERSION,
    role: "arbiter" as const,
    unitId,
    inputHash: frenchEntityAgentArbiterUnitInputHash({
      unitId,
      sourceView,
      proposalA,
      proposalB
    }),
    selectedProposal: "proposalA" as const,
    selectedProposalHash: proposalA.proposalHash,
    reasons: ["Fixture base."]
  };
  return { ...content, arbitrationHash: hashFrenchEntityJson(content) };
}

function baseAudit(
  unitId: string,
  sourceView: FrenchEntityAgentProposerBView,
  proposalA: FrenchEntityAgentProposal,
  proposalB: FrenchEntityAgentProposal,
  arbitration: FrenchEntityAgentArbitration,
  hold: boolean
): FrenchEntityAgentAudit {
  const proposal =
    arbitration.selectedProposal === "proposalA" ? proposalA : proposalB;
  const checks = passingChecks();
  if (hold) checks.canonicalPrimaryCoherence = "fail";
  const content = {
    schemaVersion: FRENCH_ENTITY_AGENT_AUDIT_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_AGENT_POLICY_VERSION,
    role: "auditor" as const,
    unitId,
    inputHash: frenchEntityAgentAuditorUnitInputHash({
      unitId,
      sourceView,
      arbitration,
      selectedProposal: proposal
    }),
    auditedProposalHash: proposal.proposalHash,
    verdict: hold ? ("hold" as const) : ("safe" as const),
    checks,
    reasons: hold ? ["Forme française volontairement rejetée."] : []
  };
  return { ...content, auditHash: hashFrenchEntityJson(content) };
}

function materializeBaseResults(input: {
  resultsDir: string;
  manifest: FrenchEntityAgentBatchManifest;
  manifestPath: string;
  plan: FrenchEntityCanonicalizationPlan;
  planPath: string;
  artifacts: ReadonlyMap<string, FrenchEntityAgentUnitArtifacts>;
}): void {
  const options: FrenchEntityAgentRunCliOptions = {
    manifest: input.manifestPath,
    resultsDir: input.resultsDir,
    releaseKey: RELEASE,
    stage: "all",
    concurrency: 1,
    batchIds: [],
    offsetBatches: 0,
    limitBatches: null,
    codexBinary: "/fixture/unused-codex",
    codexHome: "/fixture/unused-codex-home",
    timeoutMs: 10_000,
    maxAttempts: 1,
    existingOnly: true
  };
  const manifestText = readFileSync(input.manifestPath, "utf8");
  const planText = readFileSync(input.planPath, "utf8");
  let counter = 0;
  for (const batch of input.manifest.batches) {
    for (const role of [
      "proposerA",
      "proposerB",
      "arbiter",
      "auditor"
    ] as const) {
      counter += 1;
      const artifacts = batch.unitIds.map((unitId) => {
        const quartet = required(input.artifacts.get(unitId), unitId);
        return role === "proposerA"
          ? quartet.proposalA
          : role === "proposerB"
            ? quartet.proposalB
            : role === "arbiter"
              ? quartet.arbitration
              : quartet.audit;
      });
      const executionInput = buildFrenchEntityAgentRoleExecutionInput({
        options,
        manifest: input.manifest,
        manifestText,
        plan: input.plan,
        planText,
        batch,
        role
      });
      materializeBaseRole({
        ...input,
        batchId: batch.batchId,
        batchHash: batch.batchHash,
        unitIds: batch.unitIds,
        role,
        artifacts,
        executionInput,
        threadId: threadId(counter)
      });
    }
  }
}

function materializeBaseRole(input: {
  resultsDir: string;
  manifest: FrenchEntityAgentBatchManifest;
  manifestPath: string;
  plan: FrenchEntityCanonicalizationPlan;
  planPath: string;
  batchId: string;
  batchHash: string;
  unitIds: string[];
  role: "proposerA" | "proposerB" | "arbiter" | "auditor";
  artifacts: Array<
    | FrenchEntityAgentProposal
    | FrenchEntityAgentArbitration
    | FrenchEntityAgentAudit
  >;
  executionInput: FrenchEntityAgentRoleExecutionInput;
  threadId: string;
}): void {
  const directory = join(input.resultsDir, input.role, input.batchId);
  mkdirSync(directory, { recursive: true });
  const paths = {
    sealedInput: join(directory, "sealed-input.json"),
    prompt: join(directory, "prompt.txt"),
    outputSchema: join(directory, "output-schema.json"),
    structuredResponse: join(directory, "structured-response.json"),
    events: join(directory, "agent-events.jsonl"),
    stderr: join(directory, "agent-stderr.log"),
    artifacts: join(directory, "artifacts.jsonl"),
    runPointer: join(directory, "run-pointer.json"),
    receipts: join(directory, "execution-receipts.jsonl"),
    run: join(directory, "run.json")
  };
  writeFileSync(
    paths.sealedInput,
    `${input.executionInput.text.trim()}\n`,
    "utf8"
  );
  writeFileSync(paths.prompt, input.executionInput.prompt, "utf8");
  writeFileSync(
    paths.outputSchema,
    `${canonicalFrenchEntityJson(input.executionInput.schema)}\n`,
    "utf8"
  );
  writeFileSync(paths.structuredResponse, "{}\n", "utf8");
  writeFileSync(paths.events, '{"fixture":true}\n', "utf8");
  writeFileSync(paths.stderr, "", "utf8");
  writeFileSync(
    paths.artifacts,
    `${input.artifacts.map((value) => canonicalFrenchEntityJson(value)).join("\n")}\n`,
    "utf8"
  );
  const profile = FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE[input.role];
  const executor = fixtureExecutor();
  const capabilities = {
    localTools: "disabled" as const,
    networkDataTools: "disabled" as const,
    shell: "disabled" as const,
    eventPolicy: "agent-message-only" as const,
    sealedWorkingDirectory: directory,
    disabledFeaturesHash: frenchCodexDisabledFeaturesHash(),
    environmentPolicyHash: frenchCodexEnvironmentPolicyHash()
  };
  const sourcePaths = {
    manifest: input.manifestPath,
    plan: input.planPath,
    sealedInput: paths.sealedInput,
    prompt: paths.prompt,
    outputSchema: paths.outputSchema
  };
  const sourceHashes = Object.fromEntries(
    Object.entries(sourcePaths).map(([key, path]) => [key, fileHash(path)])
  );
  const resultPaths = {
    agentEvents: paths.events,
    agentStderr: paths.stderr,
    structuredResponse: paths.structuredResponse,
    artifacts: paths.artifacts
  };
  const resultHashes = Object.fromEntries(
    Object.entries(resultPaths).map(([key, path]) => [key, fileHash(path)])
  );
  const runContent = {
    schemaVersion: FRENCH_ENTITY_AGENT_RUN_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_AGENT_RUNNER_POLICY_VERSION,
    entityPolicyVersion: FRENCH_ENTITY_AGENT_POLICY_VERSION,
    executorPolicyVersion: FRENCH_CODEX_EXECUTOR_POLICY_VERSION,
    role: input.role,
    batchId: input.batchId,
    taskName: `${input.manifest.namespace}/${input.role}/${input.batchId}`,
    agentId: `codex-agent:${input.threadId}`,
    threadId: input.threadId,
    model: profile.model,
    reasoningEffort: profile.reasoningEffort,
    executor,
    capabilities,
    manifestHash: input.manifest.manifestHash,
    planHash: input.plan.planHash,
    releaseKey: RELEASE,
    releaseSnapshotFingerprint: SNAPSHOT,
    batchHash: input.batchHash,
    inputHash: input.executionInput.logicalHash,
    promptHash: hashFrenchEntityJson(input.executionInput.prompt),
    outputSchemaHash: hashFrenchEntityJson(input.executionInput.schema),
    sourceHashes,
    resultHashes,
    unitArtifactHashes: Object.fromEntries(
      input.artifacts.map((artifact) => [
        artifact.unitId,
        artifactHash(artifact)
      ])
    ),
    startedAt: "2026-07-14T10:00:00.000Z",
    completedAt: "2026-07-14T10:00:01.000Z",
    usage: null
  };
  const run: FrenchEntityAgentRun = {
    ...runContent,
    runHash: hashFrenchEntityJson(runContent)
  };
  writeFileSync(
    paths.runPointer,
    `${canonicalFrenchEntityJson({ runHash: run.runHash })}\n`,
    "utf8"
  );
  const unitById = new Map(
    input.plan.reviewUnits.map((unit) => [unit.unitId, unit])
  );
  const receipts = input.artifacts.map((artifact) =>
    finalizeFrenchCodexExecutionReceipt({
      schemaVersion: FRENCH_INTERNAL_EXECUTION_RECEIPT_SCHEMA_VERSION,
      role: input.role,
      entryKey: artifact.unitId,
      batchId: input.batchId,
      namespace: input.manifest.namespace,
      manifestHash: run.manifestHash,
      selectionHash: required(unitById.get(artifact.unitId), artifact.unitId)
        .unitHash,
      inputHash: artifact.inputHash,
      artifactHash: artifactHash(artifact),
      agentId: run.agentId,
      taskName: run.taskName,
      threadId: run.threadId,
      model: run.model,
      reasoningEffort: run.reasoningEffort,
      executorPolicyVersion: run.executorPolicyVersion,
      executor,
      capabilities,
      sourcePaths: { ...sourcePaths, runPointer: paths.runPointer },
      sourceHashes: { ...sourceHashes, runPointer: fileHash(paths.runPointer) },
      resultPaths,
      resultHashes,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      runHash: run.runHash
    })
  );
  writeFileSync(
    paths.receipts,
    `${receipts.map((receipt) => canonicalFrenchEntityJson(receipt)).join("\n")}\n`,
    "utf8"
  );
  writeFileSync(paths.run, `${canonicalFrenchEntityJson(run)}\n`, "utf8");
}

function rewriteBaseAuditorEvidence(
  fixture: ReturnType<typeof materializeFixture>,
  mutation: "empty-checks" | "forged-input-hash"
): void {
  const batch = required(
    fixture.manifest.batches.find((candidate) =>
      candidate.unitIds.includes(fixture.targetUnitId)
    ),
    fixture.targetUnitId
  );
  const directory = join(fixture.resultsDir, "auditor", batch.batchId);
  const artifactsPath = join(directory, "artifacts.jsonl");
  const artifacts = readFixtureJsonl<FrenchEntityAgentAudit>(artifactsPath);
  const artifactIndex = artifacts.findIndex(
    (artifact) => artifact.unitId === fixture.targetUnitId
  );
  const previousArtifact = required(artifacts, artifactIndex);
  const { auditHash: _previousAuditHash, ...unhashedArtifact } =
    structuredClone(previousArtifact);
  void _previousAuditHash;
  const mutableArtifact = unhashedArtifact as unknown as Record<
    string,
    unknown
  >;
  if (mutation === "empty-checks") {
    mutableArtifact.checks = {};
  } else {
    mutableArtifact.inputHash = "f".repeat(64);
  }
  const updatedArtifact = {
    ...mutableArtifact,
    auditHash: hashFrenchEntityJson(mutableArtifact)
  } as unknown as FrenchEntityAgentAudit;
  artifacts[artifactIndex] = updatedArtifact;
  writeFileSync(artifactsPath, renderCanonicalJsonl(artifacts), "utf8");
  const artifactsFileHash = fileHash(artifactsPath);

  const runPath = join(directory, "run.json");
  const storedRun = JSON.parse(
    readFileSync(runPath, "utf8")
  ) as FrenchEntityAgentRun;
  const { runHash: _storedRunHash, ...storedRunContent } = storedRun;
  void _storedRunHash;
  const updatedRunContent = {
    ...storedRunContent,
    resultHashes: {
      ...storedRunContent.resultHashes,
      artifacts: artifactsFileHash
    },
    unitArtifactHashes: {
      ...storedRunContent.unitArtifactHashes,
      [fixture.targetUnitId]: updatedArtifact.auditHash
    }
  };
  const updatedRun: FrenchEntityAgentRun = {
    ...updatedRunContent,
    runHash: hashFrenchEntityJson(updatedRunContent)
  };
  writeFileSync(runPath, `${canonicalFrenchEntityJson(updatedRun)}\n`, "utf8");

  const runPointerPath = join(directory, "run-pointer.json");
  writeFileSync(
    runPointerPath,
    `${canonicalFrenchEntityJson({ runHash: updatedRun.runHash })}\n`,
    "utf8"
  );
  const runPointerHash = fileHash(runPointerPath);
  const receiptsPath = join(directory, "execution-receipts.jsonl");
  const receipts = readFixtureJsonl<FrenchCodexExecutionReceipt<"auditor">>(
    receiptsPath
  ).map((receipt) => {
    const { receiptHash: _receiptHash, ...receiptContent } = receipt;
    void _receiptHash;
    return finalizeFrenchCodexExecutionReceipt({
      ...receiptContent,
      runHash: updatedRun.runHash,
      inputHash:
        receipt.entryKey === fixture.targetUnitId
          ? updatedArtifact.inputHash
          : receiptContent.inputHash,
      artifactHash:
        receipt.entryKey === fixture.targetUnitId
          ? updatedArtifact.auditHash
          : receiptContent.artifactHash,
      sourceHashes: {
        ...receiptContent.sourceHashes,
        runPointer: runPointerHash
      },
      resultHashes: {
        ...receiptContent.resultHashes,
        artifacts: artifactsFileHash
      }
    });
  });
  writeFileSync(receiptsPath, renderCanonicalJsonl(receipts), "utf8");
}

function rewriteBaseAuditorReceiptInputHash(
  fixture: ReturnType<typeof materializeFixture>
): void {
  const batch = required(
    fixture.manifest.batches.find((candidate) =>
      candidate.unitIds.includes(fixture.targetUnitId)
    ),
    fixture.targetUnitId
  );
  const receiptsPath = join(
    fixture.resultsDir,
    "auditor",
    batch.batchId,
    "execution-receipts.jsonl"
  );
  const receipts = readFixtureJsonl<FrenchCodexExecutionReceipt<"auditor">>(
    receiptsPath
  ).map((receipt) => {
    if (receipt.entryKey !== fixture.targetUnitId) return receipt;
    const { receiptHash: _receiptHash, ...content } = receipt;
    void _receiptHash;
    return finalizeFrenchCodexExecutionReceipt({
      ...content,
      inputHash: "e".repeat(64)
    });
  });
  writeFileSync(receiptsPath, renderCanonicalJsonl(receipts), "utf8");
}

function rewriteBaseRunInputHash(
  fixture: ReturnType<typeof materializeFixture>
): void {
  const batch = required(
    fixture.manifest.batches.find((candidate) =>
      candidate.unitIds.includes(fixture.targetUnitId)
    ),
    fixture.targetUnitId
  );
  const directory = join(fixture.resultsDir, "proposerA", batch.batchId);
  const runPath = join(directory, "run.json");
  const storedRun = JSON.parse(
    readFileSync(runPath, "utf8")
  ) as FrenchEntityAgentRun;
  const { runHash: _runHash, ...runContent } = storedRun;
  void _runHash;
  const updatedRunContent = {
    ...runContent,
    inputHash: "f".repeat(64)
  };
  const updatedRun: FrenchEntityAgentRun = {
    ...updatedRunContent,
    runHash: hashFrenchEntityJson(updatedRunContent)
  };
  writeFileSync(runPath, `${canonicalFrenchEntityJson(updatedRun)}\n`, "utf8");

  const runPointerPath = join(directory, "run-pointer.json");
  writeFileSync(
    runPointerPath,
    `${canonicalFrenchEntityJson({ runHash: updatedRun.runHash })}\n`,
    "utf8"
  );
  const runPointerHash = fileHash(runPointerPath);
  const receiptsPath = join(directory, "execution-receipts.jsonl");
  const receipts = readFixtureJsonl<FrenchCodexExecutionReceipt<"proposerA">>(
    receiptsPath
  ).map((receipt) => {
    const { receiptHash: _receiptHash, ...content } = receipt;
    void _receiptHash;
    return finalizeFrenchCodexExecutionReceipt({
      ...content,
      runHash: updatedRun.runHash,
      sourceHashes: {
        ...content.sourceHashes,
        runPointer: runPointerHash
      }
    });
  });
  writeFileSync(receiptsPath, renderCanonicalJsonl(receipts), "utf8");
}

function fixtureSource(): {
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
      makeRegistry(required(packets, index), value)
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
  const meaning =
    value.matches.length > 0
      ? `${value.gloss} (${primary}) definition`
      : `${value.gloss} definition`;
  const historicalMeaning = `sens français historique ${value.stepEntryId}`;
  const concordanceSurface =
    value.entryKey === "hebrew:H1001"
      ? "Aharon"
      : value.entryKey === "greek:G1002"
        ? NEW_PRIMARY
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
        meaningHtml: `<p>${meaning}</p>`,
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
        meaningHtml: `<p>${meaning}</p>`,
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
        existingFrench: {
          gloss: `FR-HIST-${value.stepEntryId}`,
          meaning: historicalMeaning,
          meaningHtml: `<p>${historicalMeaning}</p>`,
          source: "fixture:LexiconTranslations:fr",
          sourceHash: hashFrenchEntityJson({
            entryKey: value.entryKey,
            historicalMeaning
          }),
          trust: "untrusted-candidate"
        },
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

function inputArtifact(
  build: FrenchEntityAgentBatchBuild,
  relativePath: string
): FrenchEntityAgentInputArtifact {
  return JSON.parse(
    required(build.files.get(relativePath), relativePath)
  ) as FrenchEntityAgentInputArtifact;
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

function commonFrench(entryKey: string): string {
  return `traduction lexicale ${entryKey.split(":")[1] ?? ""}`;
}

function fixtureExecutor() {
  return {
    path: "/fixture/immutable-codex",
    version: FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.codexVersion,
    sha256: FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.codexSha256
  };
}

function artifactHash(
  artifact:
    | FrenchEntityAgentProposal
    | FrenchEntityAgentArbitration
    | FrenchEntityAgentAudit
): string {
  if ("proposalHash" in artifact) return artifact.proposalHash;
  if ("arbitrationHash" in artifact) return artifact.arbitrationHash;
  return artifact.auditHash;
}

function threadId(counter: number): string {
  return `10000000-0000-4000-8000-${String(counter).padStart(12, "0")}`;
}

function fileHash(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function readFixtureJsonl<T>(path: string): T[] {
  return readFileSync(path, "utf8")
    .split(/\r?\n/u)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as T);
}

function required<T>(value: readonly T[], index: number): T;
function required<T>(value: T | undefined, label: string | number): T;
function required<T>(
  value: T | readonly T[] | undefined,
  label: string | number
): T {
  if (Array.isArray(value)) {
    const found = value[label as number];
    if (found === undefined) throw new Error(`fixture-missing:${label}`);
    return found;
  }
  if (value === undefined) throw new Error(`fixture-missing:${label}`);
  return value as T;
}
