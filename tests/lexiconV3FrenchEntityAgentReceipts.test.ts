import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  FRENCH_ENTITY_AGENT_POLICY_VERSION,
  type FrenchEntityAgentProposal
} from "../src/lexiconV3/frenchEntityAgentReview.js";
import {
  canonicalFrenchEntityJson,
  hashFrenchEntityJson
} from "../src/lexiconV3/frenchEntityCanonicalization.js";
import {
  finalizeFrenchCodexExecutionReceipt,
  FRENCH_INTERNAL_EXECUTION_RECEIPT_SCHEMA_VERSION
} from "../src/lexiconV3/frenchCodexExecutionReceipt.js";
import { FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE } from "../src/lexiconV3/frenchInternalReview.js";
import {
  assertFrenchEntityAgentResultDirectory,
  FRENCH_ENTITY_AGENT_RUNNER_POLICY_VERSION,
  FRENCH_ENTITY_AGENT_RUN_SCHEMA_VERSION,
  type FrenchEntityAgentRun
} from "../scripts/runLexiconV3FrenchEntityAgents.js";
import {
  FRENCH_CODEX_EXECUTOR_POLICY_VERSION,
  frenchCodexDisabledFeaturesHash,
  frenchCodexEnvironmentPolicyHash
} from "../scripts/runLexiconV3FrenchCodexProposerBatch.js";

test("replays every physical file bound by an entity-agent receipt and detects drift", () => {
  const directory = mkdtempSync(join(tmpdir(), "lexicon-v3-entity-receipt-"));
  try {
    const paths = {
      manifest: join(directory, "manifest.json"),
      plan: join(directory, "plan.json"),
      "sealed-input": join(directory, "sealed-input.json"),
      "output-schema": join(directory, "output-schema.json"),
      "run-pointer": join(directory, "run-pointer.json"),
      "agent-events": join(directory, "agent-events.jsonl"),
      "agent-stderr": join(directory, "agent-stderr.log"),
      "structured-response": join(directory, "structured-response.json"),
      artifacts: join(directory, "artifacts.jsonl"),
      "execution-receipts": join(directory, "execution-receipts.jsonl"),
      run: join(directory, "run.json")
    };
    writeFileSync(paths.manifest, "fixture-manifest\n", "utf8");
    writeFileSync(paths.plan, "fixture-plan\n", "utf8");
    writeFileSync(paths["sealed-input"], "fixture-input\n", "utf8");
    writeFileSync(paths["output-schema"], "{}\n", "utf8");
    writeFileSync(paths["agent-events"], "fixture-event\n", "utf8");
    writeFileSync(paths["agent-stderr"], "", "utf8");
    writeFileSync(paths["structured-response"], "{}\n", "utf8");

    const unitId = "fixture-unit";
    const proposal = {
      unitId,
      proposalHash: hashFrenchEntityJson({ fixture: "proposal" })
    } as FrenchEntityAgentProposal;
    writeFileSync(
      paths.artifacts,
      `${canonicalFrenchEntityJson(proposal)}\n`,
      "utf8"
    );

    const profile = FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.proposerA;
    const executor = {
      path: "/immutable/codex",
      version: FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.codexVersion,
      sha256: FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.codexSha256
    };
    const capabilities = {
      localTools: "disabled" as const,
      networkDataTools: "disabled" as const,
      shell: "disabled" as const,
      eventPolicy: "agent-message-only" as const,
      sealedWorkingDirectory: directory,
      disabledFeaturesHash: frenchCodexDisabledFeaturesHash(),
      environmentPolicyHash: frenchCodexEnvironmentPolicyHash()
    };
    const sourceHashes = {
      manifest: fileHash(paths.manifest),
      plan: fileHash(paths.plan),
      sealedInput: fileHash(paths["sealed-input"]),
      outputSchema: fileHash(paths["output-schema"])
    };
    const resultHashes = {
      agentEvents: fileHash(paths["agent-events"]),
      agentStderr: fileHash(paths["agent-stderr"]),
      structuredResponse: fileHash(paths["structured-response"]),
      artifacts: fileHash(paths.artifacts)
    };
    const runContent = {
      schemaVersion: FRENCH_ENTITY_AGENT_RUN_SCHEMA_VERSION,
      policyVersion: FRENCH_ENTITY_AGENT_RUNNER_POLICY_VERSION,
      entityPolicyVersion: FRENCH_ENTITY_AGENT_POLICY_VERSION,
      executorPolicyVersion: FRENCH_CODEX_EXECUTOR_POLICY_VERSION,
      role: "proposerA" as const,
      batchId: "fixture-batch",
      taskName: "/fr-entities/fixture/proposerA/fixture-batch",
      agentId: "codex-agent:11111111-1111-4111-8111-111111111111",
      threadId: "11111111-1111-4111-8111-111111111111",
      model: profile.model,
      reasoningEffort: profile.reasoningEffort,
      executor,
      capabilities,
      manifestHash: "1".repeat(64),
      planHash: "2".repeat(64),
      releaseKey: "lexicon-v3-en-fixture.4",
      releaseSnapshotFingerprint: "3".repeat(64),
      batchHash: "4".repeat(64),
      inputHash: "5".repeat(64),
      promptHash: "6".repeat(64),
      outputSchemaHash: "7".repeat(64),
      sourceHashes,
      resultHashes,
      unitArtifactHashes: { [unitId]: proposal.proposalHash },
      startedAt: "2026-07-14T10:00:00.000Z",
      completedAt: "2026-07-14T10:00:01.000Z",
      usage: null
    };
    const run: FrenchEntityAgentRun = {
      ...runContent,
      runHash: hashFrenchEntityJson(runContent)
    };
    writeFileSync(
      paths["run-pointer"],
      `${canonicalFrenchEntityJson({ runHash: run.runHash })}\n`,
      "utf8"
    );
    const receipt = finalizeFrenchCodexExecutionReceipt({
      schemaVersion: FRENCH_INTERNAL_EXECUTION_RECEIPT_SCHEMA_VERSION,
      role: "proposerA" as const,
      entryKey: unitId,
      batchId: run.batchId,
      namespace: "/fr-entities/fixture",
      manifestHash: run.manifestHash,
      selectionHash: "8".repeat(64),
      inputHash: run.inputHash,
      artifactHash: proposal.proposalHash,
      agentId: run.agentId,
      taskName: run.taskName,
      threadId: run.threadId,
      model: run.model,
      reasoningEffort: run.reasoningEffort,
      executorPolicyVersion: run.executorPolicyVersion,
      executor,
      capabilities,
      sourcePaths: {
        manifest: paths.manifest,
        plan: paths.plan,
        sealedInput: paths["sealed-input"],
        outputSchema: paths["output-schema"],
        runPointer: paths["run-pointer"]
      },
      sourceHashes: {
        ...sourceHashes,
        runPointer: fileHash(paths["run-pointer"])
      },
      resultPaths: {
        agentEvents: paths["agent-events"],
        agentStderr: paths["agent-stderr"],
        structuredResponse: paths["structured-response"],
        artifacts: paths.artifacts
      },
      resultHashes,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      runHash: run.runHash
    });
    writeFileSync(
      paths["execution-receipts"],
      `${canonicalFrenchEntityJson(receipt)}\n`,
      "utf8"
    );
    writeFileSync(paths.run, `${canonicalFrenchEntityJson(run)}\n`, "utf8");

    assert.doesNotThrow(() =>
      assertFrenchEntityAgentResultDirectory({
        directory,
        run,
        expectedUnitIds: [unitId],
        role: "proposerA"
      })
    );
    writeFileSync(paths.artifacts, "tampered\n", "utf8");
    assert.throws(
      () =>
        assertFrenchEntityAgentResultDirectory({
          directory,
          run,
          expectedUnitIds: [unitId],
          role: "proposerA"
        }),
      /french-entity-run-result-drift/u
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

function fileHash(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
