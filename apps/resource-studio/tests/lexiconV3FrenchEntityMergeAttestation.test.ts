import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { runFrenchEntityGateCli } from "../scripts/gateLexiconV3FrenchEntities.js";
import {
  FRENCH_ENTITY_MERGE_ATTESTATION_POLICY_VERSION,
  FRENCH_ENTITY_MERGE_ATTESTATION_SCHEMA_VERSION
} from "../src/lexiconV3/frenchEntityMergeAttestation.js";
import { hashFrenchEntityJson } from "../src/lexiconV3/frenchEntityCanonicalization.js";

test("rejects forged resolved JSONLs and a self-hashed attestation with no agent runs", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "lexicon-v3-fr-entity-forged-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const plan = join(directory, "plan.json");
  const manifest = join(directory, "manifest.json");
  const resultsDir = join(directory, "agent-results");
  const attestation = join(directory, "entity-merge-attestation.json");
  const canonicalEntities = join(directory, "canonical-entities.jsonl");
  const entryPolicies = join(directory, "canonical-entry-name-policies.jsonl");
  mkdirSync(resultsDir);
  writeFileSync(plan, "{}\n", "utf8");
  writeFileSync(manifest, "{}\n", "utf8");
  writeFileSync(
    canonicalEntities,
    `${Array.from({ length: 4_091 }, (_, index) =>
      JSON.stringify({ entityId: `forged-${index}`, primaryFrench: "inventé" })
    ).join("\n")}\n`,
    "utf8"
  );
  writeFileSync(
    entryPolicies,
    `${Array.from({ length: 5_311 }, (_, index) =>
      JSON.stringify({ entryKey: `forged-${index}`, treatment: "name" })
    ).join("\n")}\n`,
    "utf8"
  );

  const emptyRuns: never[] = [];
  const withoutHash = {
    schemaVersion: FRENCH_ENTITY_MERGE_ATTESTATION_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_MERGE_ATTESTATION_POLICY_VERSION,
    releaseKey: "forged-release",
    releaseSnapshotFingerprint: "a".repeat(64),
    plan: { path: plan, fileSha256: "b".repeat(64), planHash: "c".repeat(64) },
    batchManifest: {
      path: manifest,
      fileSha256: "d".repeat(64),
      manifestHash: "e".repeat(64)
    },
    manifestHash: "e".repeat(64),
    resultsDirectory: resultsDir,
    counts: {
      batches: 0,
      runs: 0,
      receipts: 0,
      reviewUnits: 0,
      uniqueThreads: 0
    },
    runs: emptyRuns,
    runsDigest: hashFrenchEntityJson(emptyRuns),
    outputs: {
      canonicalEntities: {
        path: canonicalEntities,
        sha256: "f".repeat(64),
        records: 4_091
      },
      canonicalEntryPolicies: {
        path: entryPolicies,
        sha256: "1".repeat(64),
        records: 5_311
      }
    },
    mergeHash: "2".repeat(64),
    gateHash: "3".repeat(64)
  };
  writeFileSync(
    attestation,
    `${JSON.stringify({
      ...withoutHash,
      attestationHash: hashFrenchEntityJson(withoutHash)
    })}\n`,
    "utf8"
  );

  assert.throws(
    () =>
      runFrenchEntityGateCli({
        plan,
        manifest,
        resultsDir,
        attestation,
        canonicalEntities,
        entryPolicies,
        releaseKey: "forged-release"
      }),
    /french-entity-attestation-invalid-counts/u
  );
});
