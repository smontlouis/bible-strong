import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test, { type TestContext } from "node:test";

import {
  assertFrenchPilotExecutionArtifactLinkBinding,
  assertFrenchPilotRawDraftPublication,
  assertFrenchPilotRawExecutionEnvelope
} from "../scripts/buildLexiconV3FrenchPilotQualityGate.js";
import {
  FRENCH_INTERNAL_PROPOSER_ARTIFACT_SCHEMA_VERSION,
  type FrenchInternalProposerArtifact
} from "../scripts/assembleLexiconV3FrenchInternalReview.js";
import {
  FRENCH_CODEX_EXECUTOR_POLICY_VERSION,
  FRENCH_CODEX_PROPOSER_RUN_SCHEMA_VERSION
} from "../scripts/runLexiconV3FrenchCodexProposerBatch.js";
import {
  FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE,
  FRENCH_INTERNAL_EXECUTION_RECEIPT_SCHEMA_VERSION,
  finalizeFrenchInternalExecutionReceipt,
  hashFrenchInternalJson,
  type FrenchInternalExecutionReceipt
} from "../src/lexiconV3/frenchInternalReview.js";

const THREAD = "019f5ca1-7b88-7c51-9c6e-cdc8bc971a2b";
const RESPONSE = '{"drafts":[]}\n';
const TASK = "/fr-internal/pilot/proposerA/batch-001";
const AGENT = `codex-agent:${THREAD}`;

interface RawFixtureOptions {
  injectedEvent?: object;
  agentMessage?: string;
  runModel?: string;
  runTaskName?: string;
  runThreadId?: string;
  executorPolicyVersion?: string;
  invalidRunHash?: boolean;
}

test("replays a raw run envelope and rejects post-run file tampering", (t) => {
  const fixture = rawFixture(t);
  assert.doesNotThrow(() =>
    assertFrenchPilotRawExecutionEnvelope(fixture.receipt)
  );

  writeFileSync(fixture.responsePath, '{"drafts":["forged"]}\n', "utf8");
  assert.throws(
    () => assertFrenchPilotRawExecutionEnvelope(fixture.receipt),
    /raw-path-stale/u
  );
});

test("rejects a self-consistent run containing a tool event", (t) => {
  const fixture = rawFixture(t, {
    injectedEvent: {
      type: "item.completed",
      item: { type: "command_execution", command: "pwd" }
    }
  });
  assert.throws(
    () => assertFrenchPilotRawExecutionEnvelope(fixture.receipt),
    /event-forbidden/u
  );
});

test("rejects a self-consistent run whose final message differs from its response", (t) => {
  const fixture = rawFixture(t, { agentMessage: '{"drafts":[1]}' });
  assert.throws(
    () => assertFrenchPilotRawExecutionEnvelope(fixture.receipt),
    /response-message-mismatch/u
  );
});

test("rejects a published drafts file that differs from the parsed structured response", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "fr-raw-drafts-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = resolve(directory, "drafts.jsonl");
  const parsedDrafts = [
    { entryKey: "entry-001", glossFr: "parole", confidence: 0.99 }
  ];
  writeFileSync(path, `${JSON.stringify(parsedDrafts[0])}\n`, "utf8");
  assert.doesNotThrow(() =>
    assertFrenchPilotRawDraftPublication(parsedDrafts, path)
  );

  writeFileSync(
    path,
    `${JSON.stringify({ ...parsedDrafts[0], glossFr: "texte forgé" })}\n`,
    "utf8"
  );
  assert.throws(
    () => assertFrenchPilotRawDraftPublication(parsedDrafts, path),
    /raw-drafts/u
  );
});

test("rejects self-consistent forged run pointers for hash, profile, task, and thread", (t) => {
  const cases: Array<[string, RawFixtureOptions]> = [
    ["self hash", { invalidRunHash: true }],
    ["model", { runModel: "forged-model" }],
    [
      "pre-snapshot executor policy",
      {
        executorPolicyVersion: "lexicon-v3-french-codex-executor-policy@2"
      }
    ],
    ["task", { runTaskName: "/fr-internal/pilot/forged" }],
    ["thread", { runThreadId: "029f5ca1-7b88-7c51-9c6e-cdc8bc971a2b" }]
  ];
  for (const [label, options] of cases) {
    const fixture = rawFixture(t, options);
    assert.throws(
      () => assertFrenchPilotRawExecutionEnvelope(fixture.receipt),
      /raw-envelope-run/u,
      label
    );
  }
});

test("rejects aggregate artifacts and attestation links that diverge from the receipt", (t) => {
  const { receipt } = rawFixture(t);
  const artifact: FrenchInternalProposerArtifact = {
    schemaVersion: FRENCH_INTERNAL_PROPOSER_ARTIFACT_SCHEMA_VERSION,
    role: "proposerA",
    entryKey: receipt.entryKey,
    packetHash: "a".repeat(64),
    englishHash: "b".repeat(64),
    generationConfigHash: "c".repeat(64),
    inputHash: receipt.inputHash,
    agentId: receipt.agentId,
    taskName: receipt.taskName,
    completedAt: receipt.completedAt,
    glossFr: "parole",
    meaningSegmentsFr: [],
    requiredEntityMentions: [],
    entityMentionsFr: [],
    notesFr: "",
    carrierTermsFr: [],
    confidence: 0.99,
    artifactHash: receipt.artifactHash
  };
  const link = {
    entryKey: receipt.entryKey,
    role: receipt.role,
    batchId: receipt.batchId,
    inputHash: receipt.inputHash,
    artifactHash: receipt.artifactHash,
    agentId: receipt.agentId,
    taskName: receipt.taskName,
    completedAt: receipt.completedAt,
    threadId: receipt.threadId,
    runHash: receipt.runHash
  };
  assert.doesNotThrow(() =>
    assertFrenchPilotExecutionArtifactLinkBinding({
      receipt,
      artifact,
      link
    })
  );

  assert.throws(
    () =>
      assertFrenchPilotExecutionArtifactLinkBinding({
        receipt,
        artifact: { ...artifact, artifactHash: "d".repeat(64) },
        link
      }),
    /raw-artifact-link/u
  );
  assert.throws(
    () =>
      assertFrenchPilotExecutionArtifactLinkBinding({
        receipt,
        artifact,
        link: { ...link, threadId: "039f5ca1-7b88-7c51-9c6e-cdc8bc971a2b" }
      }),
    /raw-artifact-link/u
  );
});

function rawFixture(
  t: TestContext,
  options: RawFixtureOptions = {}
): {
  receipt: FrenchInternalExecutionReceipt;
  responsePath: string;
} {
  const directory = mkdtempSync(join(tmpdir(), "fr-raw-gate-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const paths = Object.fromEntries(
    [
      "manifest",
      "input",
      "schema",
      "packets",
      "configuration",
      "agentEvents",
      "agentStderr",
      "structuredResponse",
      "drafts",
      "artifacts",
      "artifactSummary",
      "runPointer"
    ].map((label) => [label, resolve(directory, `${label}.jsonl`)])
  ) as Record<string, string>;
  for (const label of [
    "manifest",
    "input",
    "schema",
    "packets",
    "configuration",
    "drafts",
    "artifacts",
    "artifactSummary"
  ]) {
    writeFileSync(paths[label]!, `${label}\n`, "utf8");
  }
  writeFileSync(paths.agentStderr!, "", "utf8");
  writeFileSync(paths.structuredResponse!, RESPONSE, "utf8");
  const events = [
    { type: "thread.started", thread_id: THREAD },
    { type: "turn.started" },
    ...(options.injectedEvent ? [options.injectedEvent] : []),
    {
      type: "item.completed",
      item: {
        type: "agent_message",
        text: options.agentMessage ?? RESPONSE.trim()
      }
    },
    { type: "turn.completed" }
  ];
  writeFileSync(
    paths.agentEvents!,
    `${events.map((event) => JSON.stringify(event)).join("\n")}\n`,
    "utf8"
  );
  const sourcePaths = {
    manifest: paths.manifest!,
    input: paths.input!,
    schema: paths.schema!,
    packets: paths.packets!,
    configuration: paths.configuration!,
    runPointer: paths.runPointer!
  };
  const resultPaths = {
    agentEvents: paths.agentEvents!,
    agentStderr: paths.agentStderr!,
    structuredResponse: paths.structuredResponse!,
    drafts: paths.drafts!,
    artifacts: paths.artifacts!,
    artifactSummary: paths.artifactSummary!
  };
  const runSourceHashes = {
    manifest: sha256File(sourcePaths.manifest),
    batch: "1".repeat(64),
    input: sha256File(sourcePaths.input),
    schema: sha256File(sourcePaths.schema),
    packets: sha256File(sourcePaths.packets),
    configuration: sha256File(sourcePaths.configuration)
  };
  const resultHashes = Object.fromEntries(
    Object.entries(resultPaths).map(([label, path]) => [
      label,
      sha256File(path)
    ])
  );
  const runContent = {
    schemaVersion: FRENCH_CODEX_PROPOSER_RUN_SCHEMA_VERSION,
    executorPolicyVersion:
      options.executorPolicyVersion ?? FRENCH_CODEX_EXECUTOR_POLICY_VERSION,
    batchId: "batch-001",
    role: "proposerA" as const,
    taskName: options.runTaskName ?? TASK,
    agentId: AGENT,
    threadId: options.runThreadId ?? THREAD,
    model:
      options.runModel ??
      FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.proposerA.model,
    reasoningEffort:
      FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.proposerA.reasoningEffort,
    executor: {
      path: "/usr/bin/true",
      version: FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.codexVersion,
      sha256: FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.codexSha256
    },
    sandbox: "read-only" as const,
    capabilities: {
      localTools: "disabled" as const,
      networkDataTools: "disabled" as const,
      shell: "disabled" as const,
      eventPolicy: "agent-message-only" as const,
      sealedWorkingDirectory: directory,
      disabledFeaturesHash: "2".repeat(64),
      environmentPolicyHash: "3".repeat(64)
    },
    startedAt: "2026-07-13T20:00:00.000Z",
    completedAt: "2026-07-13T20:01:00.000Z",
    promptHash: "4".repeat(64),
    rolePromptHash: "5".repeat(64),
    sourceHashes: runSourceHashes,
    resultHashes,
    counts: {
      expected: 1,
      drafts: 1,
      artifacts: 1,
      validatorClean: 1,
      validatorReview: 0
    },
    usage: null
  };
  const run = {
    ...runContent,
    runHash: options.invalidRunHash
      ? "f".repeat(64)
      : hashFrenchInternalJson(runContent)
  };
  writeFileSync(paths.runPointer!, `${JSON.stringify(run, null, 2)}\n`, "utf8");
  const receipt = finalizeFrenchInternalExecutionReceipt({
    schemaVersion: FRENCH_INTERNAL_EXECUTION_RECEIPT_SCHEMA_VERSION,
    role: "proposerA",
    entryKey: "entry-001",
    batchId: run.batchId,
    namespace: "/fr-internal/pilot",
    manifestHash: "6".repeat(64),
    selectionHash: "7".repeat(64),
    inputHash: "8".repeat(64),
    artifactHash: "9".repeat(64),
    agentId: AGENT,
    taskName: TASK,
    threadId: THREAD,
    model: FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.proposerA.model,
    reasoningEffort:
      FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.proposerA.reasoningEffort,
    executorPolicyVersion: run.executorPolicyVersion,
    executor: run.executor,
    capabilities: run.capabilities,
    sourcePaths,
    sourceHashes: {
      ...runSourceHashes,
      runPointer: sha256File(paths.runPointer!)
    },
    resultPaths,
    resultHashes,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    runHash: run.runHash
  });
  return { receipt, responsePath: paths.structuredResponse! };
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
