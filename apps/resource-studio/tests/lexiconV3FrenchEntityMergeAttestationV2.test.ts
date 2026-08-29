import assert from "node:assert/strict";
import test from "node:test";

import { hashFrenchEntityJson } from "../src/lexiconV3/frenchEntityCanonicalization.js";
import {
  assertFrenchEntityMergeAttestationV2Shape,
  finalizeFrenchEntityRemediationExecutionBatch,
  finalizeFrenchEntityRemediationExecutionManifest,
  finalizeFrenchEntityRemediationIndex,
  finalizeFrenchEntityRemediationIndexRoundRef,
  frenchEntityRemediationRoleBatchInputHash,
  FRENCH_ENTITY_MERGE_ATTESTATION_V2_POLICY_VERSION,
  FRENCH_ENTITY_MERGE_ATTESTATION_V2_SCHEMA_VERSION,
  type FrenchEntityMergeAttestationV2,
  type FrenchEntityMergeRunAttestationV2
} from "../src/lexiconV3/frenchEntityMergeAttestationV2.js";

const H = (character: string) => character.repeat(64);

test("builds deterministic remediation execution and index lineage", () => {
  const batch = finalizeFrenchEntityRemediationExecutionBatch({
    round: 1,
    roundPlanHash: H("d"),
    batchId: "round-0001-batch-0001",
    sourceBatchHash: H("9"),
    units: [{ unitId: "entity:00000022", planUnitHash: H("8") }]
  });
  assert.notEqual(batch.selectionHash, hashFrenchEntityJson(batch.unitIds));
  const manifest = finalizeFrenchEntityRemediationExecutionManifest({
    releaseKey: "release",
    releaseSnapshotFingerprint: H("a"),
    canonicalPlanHash: H("b"),
    baseManifestHash: H("c"),
    round: 1,
    roundPlanHash: H("d"),
    parentRoundHash: null,
    namespace: "/fr-entities/release/remediation/round-0001",
    batches: [batch]
  });
  assert.deepEqual(manifest.counts, { units: 1, batches: 1 });

  const ref = finalizeFrenchEntityRemediationIndexRoundRef({
    round: 1,
    plan: {
      kind: "round-plan",
      path: "/tmp/round-plan.json",
      fileSha256: H("e"),
      contentHash: H("f")
    },
    executionManifest: {
      kind: "execution-manifest",
      path: "/tmp/execution-manifest.json",
      fileSha256: H("1"),
      contentHash: manifest.manifestHash
    },
    result: {
      kind: "round-result",
      path: "/tmp/round-result.json",
      fileSha256: H("2"),
      contentHash: H("3")
    },
    resultsDirectory: "/tmp/results"
  });
  const index = finalizeFrenchEntityRemediationIndex({
    releaseKey: "release",
    releaseSnapshotFingerprint: H("a"),
    canonicalPlanHash: H("b"),
    baseManifestHash: H("c"),
    rounds: [ref]
  });
  assert.match(index.indexHash, /^[a-f0-9]{64}$/u);

  const left = frenchEntityRemediationRoleBatchInputHash({
    round: 1,
    roundPlanHash: H("d"),
    batchId: batch.batchId,
    sourceBatchHash: batch.sourceBatchHash,
    selectionHash: batch.selectionHash,
    role: "proposerA",
    unitInputHashes: [{ unitId: "entity:00000022", inputHash: H("6") }]
  });
  const right = frenchEntityRemediationRoleBatchInputHash({
    round: 1,
    roundPlanHash: H("d"),
    batchId: batch.batchId,
    sourceBatchHash: batch.sourceBatchHash,
    selectionHash: batch.selectionHash,
    role: "proposerB",
    unitInputHashes: [{ unitId: "entity:00000022", inputHash: H("6") }]
  });
  assert.notEqual(left, right);
});

test("v2 shape enforces additive counts and globally unique threads", () => {
  const attestation = fixtureAttestation();
  assert.doesNotThrow(() =>
    assertFrenchEntityMergeAttestationV2Shape(attestation)
  );

  const badCounts = structuredClone(attestation);
  badCounts.counts.total.receipts += 1;
  reseal(badCounts);
  assert.throws(
    () => assertFrenchEntityMergeAttestationV2Shape(badCounts),
    /additive-counts/u
  );

  const badThreads = structuredClone(attestation);
  badThreads.base.runs[1]!.threadId = badThreads.base.runs[0]!.threadId;
  resealRun(badThreads.base.runs[1]!);
  badThreads.base.runsDigest = hashFrenchEntityJson(badThreads.base.runs);
  reseal(badThreads);
  assert.throws(
    () => assertFrenchEntityMergeAttestationV2Shape(badThreads),
    /run-counts:base|thread-coverage/u
  );
});

function fixtureAttestation(): FrenchEntityMergeAttestationV2 {
  const runs = (["proposerA", "proposerB", "arbiter", "auditor"] as const).map(
    (role, index) => run(role, index)
  );
  const baseCounts = {
    batches: 1,
    runs: 4,
    receipts: 4,
    reviewUnits: 1,
    uniqueThreads: 4
  };
  const withoutHash = {
    schemaVersion: FRENCH_ENTITY_MERGE_ATTESTATION_V2_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_MERGE_ATTESTATION_V2_POLICY_VERSION,
    releaseKey: "release",
    releaseSnapshotFingerprint: H("a"),
    plan: { path: "/tmp/plan.json", fileSha256: H("b"), planHash: H("c") },
    batchManifest: {
      path: "/tmp/manifest.json",
      fileSha256: H("d"),
      manifestHash: H("e")
    },
    manifestHash: H("e"),
    base: {
      resultsDirectory: "/tmp/results",
      counts: baseCounts,
      runs,
      runsDigest: hashFrenchEntityJson(runs),
      viewsDigest: H("f"),
      effectiveDigest: H("1")
    },
    remediation: {
      index: null,
      rounds: [],
      roundsDigest: hashFrenchEntityJson([])
    },
    finalOverlay: {
      path: "/tmp/entity-final-overlay.json",
      sha256: H("2"),
      records: 1,
      overlayHash: H("3"),
      effectiveDigest: H("1")
    },
    counts: {
      base: baseCounts,
      remediation: {
        rounds: 0,
        batches: 0,
        unitAttempts: 0,
        distinctUnits: 0,
        runs: 0,
        receipts: 0,
        uniqueThreads: 0
      },
      total: { runs: 4, receipts: 4, uniqueThreads: 4 },
      final: {
        reviewUnits: 1,
        fromBase: 1,
        fromRemediation: 0,
        safe: 1,
        hold: 0,
        block: 0
      }
    },
    outputs: {
      canonicalEntities: {
        path: "/tmp/entities.jsonl",
        sha256: H("4"),
        records: 1
      },
      canonicalEntryPolicies: {
        path: "/tmp/policies.jsonl",
        sha256: H("5"),
        records: 1
      },
      quarantine: {
        path: "/tmp/entity-quarantine.jsonl",
        sha256: H("8"),
        records: 0
      }
    },
    mergeHash: H("6"),
    gateHash: H("7")
  };
  return {
    ...withoutHash,
    attestationHash: hashFrenchEntityJson(withoutHash)
  };
}

function run(
  role: FrenchEntityMergeRunAttestationV2["role"],
  index: number
): FrenchEntityMergeRunAttestationV2 {
  const character = String((index + 1) % 10);
  const content = {
    role,
    batchId: "batch-0001",
    threadId: `thread-${index}`,
    runHash: H(character),
    relativeDirectory: `${role}/batch-0001`,
    fileHashes: {
      run: H(character),
      artifacts: H(character),
      receipts: H(character)
    },
    unitCount: 1,
    receiptCount: 1,
    unitBindingsDigest: H(character)
  };
  return { ...content, runAttestationHash: hashFrenchEntityJson(content) };
}

function resealRun(run: FrenchEntityMergeRunAttestationV2): void {
  const { runAttestationHash: _ignored, ...content } = run;
  void _ignored;
  run.runAttestationHash = hashFrenchEntityJson(content);
}

function reseal(attestation: FrenchEntityMergeAttestationV2): void {
  const { attestationHash: _ignored, ...content } = attestation;
  void _ignored;
  attestation.attestationHash = hashFrenchEntityJson(content);
}
