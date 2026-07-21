import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  assertFrenchCodexPilotBatchManifest,
  FRENCH_CODEX_PILOT_BATCH_MANIFEST_SCHEMA_VERSION,
  type FrenchCodexPilotBatchManifest,
  type FrenchCodexPilotBatchRecord
} from "../scripts/buildLexiconV3FrenchCodexPilotBatches.js";
import {
  FRENCH_CODEX_EXECUTOR_POLICY_VERSION,
  acquireExclusiveRoleLock,
  buildFrenchCodexExactEntityMentionChecklist,
  buildSealedFrenchCodexProposerEnvironment,
  frenchCodexProposerExecArgs,
  frenchCodexProposerTaskName,
  normalizeFrenchCodexEntityMentionIds,
  parseFrenchCodexAgentEvents
} from "../scripts/runLexiconV3FrenchCodexProposerBatch.js";
import {
  assertFrenchCodexBatchManifest,
  FRENCH_CODEX_BATCH_MANIFEST_SCHEMA_VERSION,
  FRENCH_CODEX_SELECTION_PROOF_SCHEMA_VERSION,
  type FrenchCodexBatchManifest
} from "../scripts/buildLexiconV3FrenchCodexBatches.js";
import {
  FRENCH_CODEX_PILOT_PROPOSER_SUMMARY_SCHEMA_VERSION,
  parseFrenchCodexProposersArgs,
  resolveFrenchCodexProposerSummaryForAggregation,
  selectFrenchCodexBatches
} from "../scripts/runLexiconV3FrenchCodexPilotProposers.js";
import {
  FRENCH_CODEX_ADJUDICATION_EXECUTOR_POLICY_VERSION,
  parseFrenchCodexAdjudicationArgs
} from "../scripts/runLexiconV3FrenchCodexPilotAdjudication.js";
import {
  FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE,
  FRENCH_INTERNAL_PROMPT_VERSION,
  hashFrenchInternalJson
} from "../src/lexiconV3/frenchInternalReview.js";
import { FRENCH_INTERNAL_WORK_POLICY_VERSION } from "../src/lexiconV3/frenchInternalWork.js";

const THREAD = "019f5ca1-7b88-7c51-9c6e-cdc8bc971a2b";
const RESPONSE = '{"drafts":[]}';

test("private executable snapshots invalidate pre-snapshot execution receipts", () => {
  assert.equal(
    FRENCH_CODEX_EXECUTOR_POLICY_VERSION,
    "lexicon-v3-french-codex-executor-policy@3"
  );
  assert.equal(
    FRENCH_CODEX_ADJUDICATION_EXECUTOR_POLICY_VERSION,
    FRENCH_CODEX_EXECUTOR_POLICY_VERSION
  );
  assert.equal(
    FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.executorPolicyVersion,
    FRENCH_CODEX_EXECUTOR_POLICY_VERSION
  );
});

test("accepts only a complete tool-free Codex event sequence", () => {
  const parsed = parseFrenchCodexAgentEvents(
    events([
      { type: "thread.started", thread_id: THREAD },
      { type: "turn.started" },
      {
        type: "item.completed",
        item: { id: "item_0", type: "agent_message", text: "préambule" }
      },
      {
        type: "item.completed",
        item: { id: "item_1", type: "agent_message", text: RESPONSE }
      },
      {
        type: "turn.completed",
        usage: { input_tokens: 10, output_tokens: 4 }
      }
    ]),
    `${RESPONSE}\n`
  );

  assert.equal(parsed.threadId, THREAD);
  assert.equal(parsed.usage?.input_tokens, 10);
});

test("rejects shell, tool, malformed, and unexpected events fail-closed", () => {
  for (const forbidden of [
    {
      type: "item.completed",
      item: { id: "item_0", type: "command_execution", command: "pwd" }
    },
    { type: "item.started", item: { type: "agent_message" } },
    { type: "web_search", query: "Strong" },
    { type: "turn.failed", error: "failure" }
  ]) {
    assert.throws(
      () =>
        parseFrenchCodexAgentEvents(
          events([
            { type: "thread.started", thread_id: THREAD },
            { type: "turn.started" },
            forbidden,
            {
              type: "item.completed",
              item: { type: "agent_message", text: RESPONSE }
            },
            { type: "turn.completed" }
          ]),
          RESPONSE
        ),
      /french-codex-agent/u
    );
  }
  assert.throws(
    () => parseFrenchCodexAgentEvents("not-json\n", RESPONSE),
    /event-invalid-json/u
  );
});

test("rejects a fake thread id and a response differing from the last agent message", () => {
  assert.throws(
    () =>
      parseFrenchCodexAgentEvents(
        events([
          { type: "thread.started", thread_id: "invented-thread" },
          { type: "turn.started" },
          {
            type: "item.completed",
            item: { type: "agent_message", text: RESPONSE }
          },
          { type: "turn.completed" }
        ]),
        RESPONSE
      ),
    /thread-event-invalid/u
  );

  assert.throws(
    () =>
      parseFrenchCodexAgentEvents(
        events([
          { type: "thread.started", thread_id: THREAD },
          { type: "turn.started" },
          {
            type: "item.completed",
            item: { type: "agent_message", text: RESPONSE }
          },
          { type: "turn.completed" }
        ]),
        '{"drafts":[{"forged":true}]}'
      ),
    /response-message-mismatch/u
  );
});

test("serializes concurrent execution for the same batch and role", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "lexicon-v3-codex-lock-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, "proposer-a-agent-run.lock");
  const release = acquireExclusiveRoleLock(path);
  assert.throws(
    () => acquireExclusiveRoleLock(path),
    /french-codex-role-locked/u
  );
  release();
  const releaseAgain = acquireExclusiveRoleLock(path);
  releaseAgain();
});

test("rejects a self-rehashed manifest with duplicated pilot coverage", () => {
  const first = batch("pilot-short-001", "greek:G0001", "a".repeat(64));
  const second = batch("pilot-short-002", "greek:G0001", "b".repeat(64));
  const manifest = finalizeManifest([first, second]);
  assert.throws(
    () => assertFrenchCodexPilotBatchManifest(manifest),
    /french-codex-pilot-key-duplicate/u
  );
});

test("requires the sealed selected-packets aggregate and rejects legacy manifests", () => {
  const current = finalizeManifest([
    batch("pilot-short-001", "greek:G0001", "a".repeat(64))
  ]);
  const tampered = {
    ...current,
    selectedPackets: { ...current.selectedPackets, records: 2 }
  };
  const { manifestHash: _tamperedHash, ...tamperedContent } = tampered;
  void _tamperedHash;
  tampered.manifestHash = hashFrenchInternalJson(tamperedContent);
  assert.throws(
    () => assertFrenchCodexPilotBatchManifest(tampered),
    /selected-packets-metadata-invalid/u
  );

  const legacy = {
    ...current,
    schemaVersion: "lexicon-v3-french-codex-pilot-batches@1"
  } as unknown as FrenchCodexPilotBatchManifest;
  assert.throws(
    () => assertFrenchCodexPilotBatchManifest(legacy),
    /migration-required/u
  );
});

test("validates an exact full selection and keeps pilot/full task namespaces distinct", () => {
  const batches = [
    batch("full-short-0001-p001", "greek:G0001", "a".repeat(64)),
    batch("full-short-0002-p001", "hebrew:H0001", "b".repeat(64))
  ];
  const manifest = finalizeGenericManifest(batches, [
    "greek:G0001",
    "hebrew:H0001"
  ]);
  assert.doesNotThrow(() =>
    assertFrenchCodexBatchManifest(manifest, { expectedEntries: 2 })
  );
  assert.throws(
    () => assertFrenchCodexBatchManifest(manifest, { expectedEntries: 3 }),
    /manifest-invalid/u
  );
  assert.equal(
    frenchCodexProposerTaskName(
      { namespace: "/fr-internal/full" },
      "proposerA",
      "full-short-0001-p001"
    ),
    "/fr-internal/full/proposerA/full-short-0001-p001"
  );
  assert.notEqual(
    frenchCodexProposerTaskName(
      { namespace: "/fr-internal/pilot" },
      "proposerA",
      "pilot-short-001"
    ),
    "/fr-internal/full/proposerA/full-short-0001-p001"
  );
});

test("requires a structurally sealed pilot quality gate on every full manifest", () => {
  const manifest = finalizeGenericManifest(
    [batch("full-short-0001-p001", "greek:G0001", "a".repeat(64))],
    ["greek:G0001"]
  );
  const missingContent = { ...manifest, pilotQualityGate: null };
  const { manifestHash: _missingHash, ...missing } = missingContent;
  void _missingHash;
  assert.throws(
    () =>
      assertFrenchCodexBatchManifest({
        ...missing,
        manifestHash: hashFrenchInternalJson(missing)
      }),
    /manifest-invalid/u
  );

  const tamperedContent = {
    ...manifest,
    pilotQualityGate: {
      ...manifest.pilotQualityGate!,
      generationConfigHash: "not-a-sha"
    }
  };
  const { manifestHash: _tamperedHash, ...tampered } = tamperedContent;
  void _tamperedHash;
  assert.throws(
    () =>
      assertFrenchCodexBatchManifest({
        ...tampered,
        manifestHash: hashFrenchInternalJson(tampered)
      }),
    /pilot-quality-gate-invalid/u
  );
});

test("rejects a self-rehashed selected manifest mixing .1 and .2 release lineages", () => {
  const manifest = finalizeGenericManifest(
    [batch("full-short-0001-p001", "greek:G0001", "a".repeat(64))],
    ["greek:G0001"]
  );
  const originalBatch = manifest.batches[0]!;
  const mixedBatchContent = {
    ...originalBatch,
    lineage: {
      ...originalBatch.lineage,
      releaseKey: "lexicon-v3-en-fixture.2"
    }
  };
  const { batchHash: _batchHash, ...batchContent } = mixedBatchContent;
  void _batchHash;
  const mixed = {
    ...manifest,
    batches: [
      {
        ...batchContent,
        batchHash: hashFrenchInternalJson(batchContent)
      }
    ]
  };
  const { manifestHash: _manifestHash, ...manifestContent } = mixed;
  void _manifestHash;

  assert.throws(
    () =>
      assertFrenchCodexBatchManifest({
        ...manifestContent,
        manifestHash: hashFrenchInternalJson(manifestContent)
      }),
    /batch-invalid/u
  );
});

test("rejects full selection overlap, gap, order drift, and self-rehashed count drift", () => {
  const first = batch("full-short-0001-p001", "greek:G0001", "a".repeat(64));
  const duplicate = batch(
    "full-short-0002-p001",
    "greek:G0001",
    "b".repeat(64)
  );
  assert.throws(
    () =>
      assertFrenchCodexBatchManifest(
        finalizeGenericManifest(
          [first, duplicate],
          ["greek:G0001", "hebrew:H0001"]
        )
      ),
    /coverage-invalid/u
  );
  assert.throws(
    () =>
      assertFrenchCodexBatchManifest(
        finalizeGenericManifest([first], ["greek:G0001", "hebrew:H0001"])
      ),
    /coverage-invalid/u
  );
  const second = batch("full-short-0002-p001", "hebrew:H0001", "b".repeat(64));
  assert.throws(
    () =>
      assertFrenchCodexBatchManifest(
        finalizeGenericManifest(
          [first, second],
          ["hebrew:H0001", "greek:G0001"]
        )
      ),
    /coverage-invalid/u
  );
  const drift = finalizeGenericManifest(
    [first, second],
    ["greek:G0001", "hebrew:H0001"]
  );
  drift.counts.entries = 1;
  const { manifestHash: _old, ...content } = drift;
  void _old;
  drift.manifestHash = hashFrenchInternalJson(content);
  assert.throws(
    () => assertFrenchCodexBatchManifest(drift),
    /manifest-invalid/u
  );
  assert.throws(
    () =>
      assertFrenchCodexBatchManifest(
        finalizeGenericManifest(
          [batch("full-short-0001-p001", "greek:G0001", "a".repeat(64))],
          ["greek:G0001"]
        ),
        { verifyFiles: true }
      ),
    /artifact-stale|pilot-quality-gate-missing/u
  );
});

test("selects resumable batch ranges without overlap and reserves aggregate-only for exact coverage", () => {
  const batches = [
    batch("full-short-0001-p001", "greek:G0001", "a".repeat(64)),
    batch("full-short-0002-p001", "greek:G0002", "b".repeat(64)),
    batch("full-short-0003-p001", "greek:G0003", "c".repeat(64))
  ];
  assert.deepEqual(
    selectFrenchCodexBatches(batches, {
      batchRange: { start: 1, end: 3 },
      aggregateOnly: false
    }).map((value) => value.batchId),
    ["full-short-0002-p001", "full-short-0003-p001"]
  );
  assert.deepEqual(
    selectFrenchCodexBatches(batches, {
      shardIds: ["short-0002"],
      aggregateOnly: false
    }).map((value) => value.batchId),
    ["full-short-0002-p001"]
  );
  assert.throws(
    () =>
      selectFrenchCodexBatches(batches, {
        batchIds: ["full-short-0002-p001", "full-short-0001-p001"],
        aggregateOnly: false
      }),
    /order-invalid/u
  );
  assert.throws(
    () =>
      selectFrenchCodexBatches(batches, {
        batchRange: { start: 0, end: 2 },
        aggregateOnly: true
      }),
    /aggregate-only-requires-full-coverage/u
  );
  assert.equal(
    selectFrenchCodexBatches(batches, { aggregateOnly: true }).length,
    3
  );
});

test("reaggregation preserves a sealed proposer summary and downstream source digest", () => {
  const initial = proposerSummary("2026-07-14T08:12:00.000Z");
  const deterministicCandidate = proposerSummary("2026-07-14T08:10:00.000Z");
  const initialText = `${JSON.stringify(initial, null, 2)}\n`;
  const adjudicationSourceDigest = sha256(initialText);

  const resumed = resolveFrenchCodexProposerSummaryForAggregation(
    deterministicCandidate,
    initialText
  );
  const resumedText = resumed.reused
    ? initialText
    : `${JSON.stringify(resumed.summary, null, 2)}\n`;

  assert.equal(resumed.reused, true);
  assert.deepEqual(resumed.summary, initial);
  assert.equal(sha256(resumedText), adjudicationSourceDigest);
  assert.notEqual(initial.summaryHash, deterministicCandidate.summaryHash);

  const { summaryHash: _summaryHash, ...tamperedContent } = initial;
  void _summaryHash;
  const tampered = {
    ...tamperedContent,
    counts: { ...tamperedContent.counts, entries: 2 }
  };
  assert.throws(
    () =>
      resolveFrenchCodexProposerSummaryForAggregation(
        deterministicCandidate,
        `${JSON.stringify({
          ...tampered,
          summaryHash: hashFrenchInternalJson(tampered)
        })}\n`
      ),
    /french-codex-proposer-existing-aggregate-stale/u
  );
});

test("proposer execution remains read-only, tool-less, offline, and environment-sealed", () => {
  const args = frenchCodexProposerExecArgs({
    model: "gpt-5.6-luna",
    reasoningEffort: "medium",
    schemaPath: "/tmp/schema.json",
    responsePath: "/tmp/response.json",
    cwd: "/tmp/sealed"
  });
  assert.ok(args.includes("read-only"));
  assert.ok(args.includes("--ignore-user-config"));
  assert.ok(args.includes("--ignore-rules"));
  for (const feature of [
    "plugins",
    "apps",
    "browser_use",
    "browser_use_external",
    "standalone_web_search",
    "code_mode",
    "shell_tool",
    "unified_exec",
    "workspace_dependencies",
    "multi_agent"
  ]) {
    const index = args.indexOf(feature);
    assert.ok(index > 0, `missing disabled feature ${feature}`);
    assert.equal(args[index - 1], "--disable");
  }
  const environment = buildSealedFrenchCodexProposerEnvironment(
    "/tmp/codex-home-test"
  );
  assert.equal(environment.CODEX_HOME, "/tmp/codex-home-test");
  assert.equal(environment.AI_GATEWAY_URL, undefined);
  assert.equal(environment.OPENAI_API_KEY, undefined);
  const parsed = parseFrenchCodexProposersArgs(["--expected-entries", "22717"]);
  assert.equal(parsed.expectedEntries, 22_717);
  assert.equal(parsed.expectedCodexVersion, "codex-cli 0.144.0-alpha.4");
  assert.equal(
    parsed.expectedCodexSha256,
    "e48ce8a0455b97ba25aa6b373f694ad7788f960c4bfc311f68b6d5bf7121f2f4"
  );
});

test("the proposer positive list excludes quarantined and non-entity mentions", () => {
  const checklist = buildFrenchCodexExactEntityMentionChecklist([
    {
      entryKey: "hebrew:H3484",
      entityConstraints: {
        requiredMentions: [
          {
            mentionId: "entity-mention:isaac",
            segmentId: "t1",
            resolution: "exact",
            allowedFrenchForms: ["Isaac"]
          },
          {
            mentionId: "entity-mention:jacob",
            segmentId: "t3",
            resolution: "quarantined",
            allowedFrenchForms: []
          },
          {
            mentionId: "entity-mention:strong-code",
            segmentId: "t3",
            resolution: "non-entity",
            allowedFrenchForms: []
          }
        ]
      }
    }
  ]);

  assert.deepEqual(JSON.parse(checklist.trim()), {
    entryKey: "hebrew:H3484",
    exactMentions: [
      {
        mentionId: "entity-mention:isaac",
        segmentId: "t1",
        allowedFrenchForms: ["Isaac"]
      }
    ]
  });
});

test("normalizes only a uniquely identified opaque mention id", () => {
  const required = [
    {
      mentionId: "entity-mention:correct-dinah",
      segmentId: "t1",
      resolution: "exact",
      allowedFrenchForms: ["Dina"]
    },
    {
      mentionId: "entity-mention:correct-rachel",
      segmentId: "t1",
      resolution: "exact",
      allowedFrenchForms: ["Rachel"]
    }
  ];
  assert.deepEqual(
    normalizeFrenchCodexEntityMentionIds(
      {
        entryKey: "hebrew:H3227B",
        entityMentionsFr: [
          {
            mentionId: "entity-mention:correct-dina",
            segmentId: "t1",
            chosenFrenchForm: "Dina"
          }
        ]
      },
      required
    ),
    {
      entryKey: "hebrew:H3227B",
      entityMentionsFr: [
        {
          mentionId: "entity-mention:correct-dinah",
          segmentId: "t1",
          chosenFrenchForm: "Dina"
        }
      ]
    }
  );

  const ambiguous = required.map((mention) => ({
    ...mention,
    allowedFrenchForms: ["Nom"]
  }));
  const unresolved = {
    entityMentionsFr: [
      {
        mentionId: "entity-mention:opaque-typo",
        segmentId: "t1",
        chosenFrenchForm: "Nom"
      }
    ]
  };
  assert.equal(
    normalizeFrenchCodexEntityMentionIds(unresolved, ambiguous),
    unresolved
  );
});

test("derives adjudication packets from the sealed aggregate in the manifest", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "lexicon-v3-codex-manifest-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const manifest = finalizeGenericManifest(
    [batch("full-short-0001-p001", "greek:G0001", "a".repeat(64))],
    ["greek:G0001"]
  );
  const path = join(directory, "manifest.json");
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const options = parseFrenchCodexAdjudicationArgs([
    "--output-dir",
    join(directory, "full"),
    "--proposer-batch-manifest",
    path
  ]);
  assert.equal(options.packetsPath, "/sealed/selected-packets.jsonl");
});

function events(values: unknown[]): string {
  return `${values.map((value) => JSON.stringify(value)).join("\n")}\n`;
}

function proposerSummary(generatedAt: string) {
  const aggregate = (role: string) => ({
    path: `/sealed/${role}.jsonl`,
    sha256: "1".repeat(64),
    bytes: 1,
    records: role === "runs" ? 2 : 1,
    logicalDigest: "2".repeat(64)
  });
  const content = {
    schemaVersion: FRENCH_CODEX_PILOT_PROPOSER_SUMMARY_SCHEMA_VERSION,
    runKind: "custom" as const,
    namespace: "/fr-internal/custom/remediation-r001",
    selectionHash: "3".repeat(64),
    keyOrderHash: "4".repeat(64),
    coverage: "exact" as const,
    selectedBatchIds: ["custom-short-0001-p001"],
    selectedBatchIdsHash: "5".repeat(64),
    manifestHash: "6".repeat(64),
    sourceManifestDigest: "7".repeat(64),
    generatedAt,
    profiles: {
      proposerA: { model: "gpt-5.6-luna", reasoningEffort: "medium" },
      proposerB: { model: "gpt-5.6-sol", reasoningEffort: "low" }
    },
    counts: {
      entries: 1,
      batches: 1,
      jobs: 2,
      proposerA: 1,
      proposerB: 1,
      distinctAgentThreads: 2,
      validatorClean: 2,
      validatorReview: 0
    },
    usage: {
      inputTokens: 10,
      cachedInputTokens: 0,
      outputTokens: 4,
      reasoningOutputTokens: 2
    },
    outputs: {
      proposerA: aggregate("proposer-a"),
      proposerB: aggregate("proposer-b"),
      runs: aggregate("runs")
    },
    runHashesDigest: "8".repeat(64)
  };
  return { ...content, summaryHash: hashFrenchInternalJson(content) };
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

const RELEASE_LINEAGE = {
  releaseKey: "lexicon-v3-en-fixture.1",
  releaseSnapshotFingerprint: "9".repeat(64),
  sourceLogicalDigest: "3".repeat(64)
};

function batch(
  batchId: string,
  entryKey: string,
  digest: string
): FrenchCodexPilotBatchRecord {
  const directory = `/sealed/${batchId}`;
  const artifact = (name: string) => ({
    path: `${directory}/${name}`,
    sha256: digest,
    bytes: 1
  });
  const content = {
    batchId,
    meaningSize: "short" as const,
    keys: [entryKey],
    proposerAViewHashes: [digest],
    proposerBViewHashes: [digest],
    lineage: RELEASE_LINEAGE,
    inputs: {
      proposerA: artifact("proposer-a-input.jsonl"),
      proposerB: artifact("proposer-b-input.jsonl"),
      packets: artifact("packets.jsonl")
    },
    schemas: {
      proposerA: artifact("proposer-a-output.schema.json"),
      proposerB: artifact("proposer-b-output.schema.json")
    },
    expectedDraftPaths: {
      proposerA: `${directory}/proposer-a-drafts.jsonl`,
      proposerB: `${directory}/proposer-b-drafts.jsonl`
    }
  };
  return { ...content, batchHash: hashFrenchInternalJson(content) };
}

function finalizeManifest(
  batches: FrenchCodexPilotBatchRecord[]
): FrenchCodexPilotBatchManifest {
  const content = {
    schemaVersion: FRENCH_CODEX_PILOT_BATCH_MANIFEST_SCHEMA_VERSION,
    policyVersion: FRENCH_INTERNAL_WORK_POLICY_VERSION,
    promptVersion: FRENCH_INTERNAL_PROMPT_VERSION,
    lineage: RELEASE_LINEAGE,
    sourcePaths: {
      pilot: "/sealed/pilot.json",
      proposerA: "/sealed/a.jsonl",
      proposerB: "/sealed/b.jsonl",
      packets: "/sealed/packets.jsonl"
    },
    sourceDigests: {
      pilot: "c".repeat(64),
      proposerA: "d".repeat(64),
      proposerB: "e".repeat(64),
      packets: "f".repeat(64),
      pilotContentHash: "1".repeat(64)
    },
    selectedPackets: {
      path: "/sealed/selected-packets.jsonl",
      sha256: "2".repeat(64),
      bytes: batches.length,
      records: batches.length,
      logicalDigest: "3".repeat(64),
      ...RELEASE_LINEAGE
    },
    batching: {
      maxCombinedBytes: 300_000,
      maxItems: { short: 20, medium: 8, long: 3, very_long: 1 }
    },
    counts: {
      entries: batches.length,
      batches: batches.length,
      byMeaningSize: {
        short: batches.length,
        medium: 0,
        long: 0,
        very_long: 0
      }
    },
    batches
  };
  return { ...content, manifestHash: hashFrenchInternalJson(content) };
}

function finalizeGenericManifest(
  batches: FrenchCodexPilotBatchRecord[],
  keys: string[]
): FrenchCodexBatchManifest {
  const selectionContent = {
    schemaVersion: FRENCH_CODEX_SELECTION_PROOF_SCHEMA_VERSION,
    runKind: "full" as const,
    namespace: "/fr-internal/full",
    sourceKind: "shards" as const,
    sourcePath: "/sealed/shards.json",
    sourceFileHash: "1".repeat(64),
    sourceContentHash: "2".repeat(64),
    sourceLogicalDigest: "3".repeat(64),
    releaseKey: RELEASE_LINEAGE.releaseKey,
    releaseSnapshotFingerprint: RELEASE_LINEAGE.releaseSnapshotFingerprint,
    expectedEntries: keys.length,
    fullPlanEntries: keys.length,
    exactFullCoverage: true,
    shardIds: [
      ...new Set(
        batches.map((value) =>
          value.batchId.slice("full-".length).replace(/-p\d{3}$/u, "")
        )
      )
    ],
    keys,
    keyOrderHash: hashFrenchInternalJson(keys)
  };
  const selection = {
    ...selectionContent,
    contentHash: hashFrenchInternalJson(selectionContent)
  };
  const content = {
    schemaVersion: FRENCH_CODEX_BATCH_MANIFEST_SCHEMA_VERSION,
    policyVersion: FRENCH_INTERNAL_WORK_POLICY_VERSION,
    promptVersion: FRENCH_INTERNAL_PROMPT_VERSION,
    lineage: RELEASE_LINEAGE,
    runKind: "full" as const,
    namespace: "/fr-internal/full",
    outputRoot: "/sealed",
    selection,
    sourcePaths: {
      selection: "/sealed/shards.json",
      proposerA: "/sealed/a.jsonl",
      proposerB: "/sealed/b.jsonl",
      packets: "/sealed/packets.jsonl"
    },
    sourceDigests: {
      selection: "1".repeat(64),
      proposerA: "4".repeat(64),
      proposerB: "5".repeat(64),
      packets: "6".repeat(64),
      selectionContentHash: selection.contentHash
    },
    selectedPackets: {
      path: "/sealed/selected-packets.jsonl",
      sha256: "7".repeat(64),
      bytes: keys.length,
      records: keys.length,
      logicalDigest: "8".repeat(64),
      ...RELEASE_LINEAGE
    },
    pilotQualityGate: {
      path: `/sealed/pilot-quality-gate-${"9".repeat(64)}.json`,
      sha256: "a".repeat(64),
      bytes: 1,
      gateHash: "9".repeat(64),
      generationConfigHash: "b".repeat(64)
    },
    batching: {
      maxCombinedBytes: 300_000,
      maxItems: { short: 40, medium: 30, long: 16, very_long: 8 }
    },
    counts: {
      entries: keys.length,
      batches: batches.length,
      byMeaningSize: {
        short: keys.length,
        medium: 0,
        long: 0,
        very_long: 0
      }
    },
    batches
  };
  return { ...content, manifestHash: hashFrenchInternalJson(content) };
}
