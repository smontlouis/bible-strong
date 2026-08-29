import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test, { type TestContext } from "node:test";

import {
  parseFrenchPilotQualityGateArgs,
  resolveFrenchPilotQualityGateGeneratedAt
} from "../scripts/buildLexiconV3FrenchPilotQualityGate.js";
import {
  FRENCH_PILOT_QUALITY_GATE_POLICY_VERSION,
  FRENCH_PILOT_QUALITY_GATE_SCHEMA_VERSION,
  assertFrenchPilotQualityGate,
  finalizeFrenchPilotQualityGate,
  frenchPilotQualityGateFilename,
  readFrenchPilotQualityGate,
  type FrenchPilotQualityGate,
  type FrenchPilotQualityGateContent,
  type FrenchPilotQualityGateSourceLabel
} from "../src/lexiconV3/frenchPilotQualityGate.js";
import {
  FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE,
  hashFrenchInternalJson
} from "../src/lexiconV3/frenchInternalReview.js";

const SOURCE_LABELS: FrenchPilotQualityGateSourceLabel[] = [
  "pilotManifest",
  "pilotSelection",
  "selectedPackets",
  "configuration",
  "proposerSummary",
  "adjudicationSummary",
  "executionReceipts",
  "executionReceiptsSummary",
  "assembledReview",
  "assemblySummary",
  "remediationSummary",
  "finalReview",
  "blindReauditManifest",
  "blindReauditSummary",
  "blindReauditReceipts",
  "blindReauditDecisions"
];

test("accepts an exact content-addressed PASS gate and replays every source", (t) => {
  const fixture = gateFixture(t);
  assert.doesNotThrow(() =>
    assertFrenchPilotQualityGate(fixture.gate, {
      verifySourceFiles: true,
      requireContentAddressedPath: fixture.path,
      expectedReleaseKey: fixture.gate.lineage.releaseKey,
      expectedReleaseSnapshotFingerprint:
        fixture.gate.lineage.releaseSnapshotFingerprint,
      expectedSourceLogicalDigest: fixture.gate.lineage.sourceLogicalDigest,
      expectedGenerationConfigHash: fixture.gate.lineage.generationConfigHash
    })
  );
  assert.equal(
    readFrenchPilotQualityGate(fixture.path, { verifySourceFiles: true })
      .gateHash,
    fixture.gate.gateHash
  );
});

test("fails closed when the gate is absent or not stored under its hash", (t) => {
  const directory = temporaryDirectory(t);
  assert.throws(
    () => readFrenchPilotQualityGate(join(directory, "missing.json")),
    /french-pilot-quality-gate-missing/u
  );

  const fixture = gateFixture(t);
  const alias = join(directory, "gate.json");
  writeFileSync(alias, readFileSync(fixture.path));
  assert.throws(
    () => readFrenchPilotQualityGate(alias),
    /path-not-content-addressed/u
  );
});

test("rejects a mixed English release, snapshot or generation configuration", (t) => {
  const fixture = gateFixture(t);
  const mixedRelease = rehashGate({
    ...fixture.gate,
    lineage: { ...fixture.gate.lineage, releaseKey: "other-release" }
  });
  assert.throws(
    () =>
      assertFrenchPilotQualityGate(mixedRelease, {
        expectedReleaseKey: fixture.gate.lineage.releaseKey
      }),
    /release-key-stale/u
  );

  const mixedSnapshot = rehashGate({
    ...fixture.gate,
    lineage: {
      ...fixture.gate.lineage,
      releaseSnapshotFingerprint: "a".repeat(64)
    }
  });
  assert.throws(
    () =>
      assertFrenchPilotQualityGate(mixedSnapshot, {
        expectedReleaseSnapshotFingerprint:
          fixture.gate.lineage.releaseSnapshotFingerprint
      }),
    /release-snapshot-stale/u
  );

  const mixedConfig = rehashGate({
    ...fixture.gate,
    lineage: {
      ...fixture.gate.lineage,
      generationConfigHash: "b".repeat(64)
    }
  });
  assert.throws(
    () =>
      assertFrenchPilotQualityGate(mixedConfig, {
        expectedGenerationConfigHash: fixture.gate.lineage.generationConfigHash
      }),
    /generation-config-stale/u
  );
});

test("detects a tampered execution receipt after gate publication", (t) => {
  const fixture = gateFixture(t);
  writeFileSync(
    fixture.gate.sourceArtifacts.executionReceipts.path,
    "tampered receipt\n",
    "utf8"
  );
  assert.throws(
    () =>
      assertFrenchPilotQualityGate(fixture.gate, {
        verifySourceFiles: true
      }),
    /source-stale:executionReceipts/u
  );
});

test("rejects residual reviews, violations and a forged self hash", (t) => {
  const fixture = gateFixture(t);
  const residual = rehashGate({
    ...fixture.gate,
    quality: {
      ...fixture.gate.quality,
      statusCounts: {
        ...fixture.gate.quality.statusCounts,
        auto_validated: 299,
        review_needed: 1
      }
    }
  });
  assert.throws(
    () => assertFrenchPilotQualityGate(residual),
    /residual-status/u
  );

  const violation = rehashGate({
    ...fixture.gate,
    quality: {
      ...fixture.gate.quality,
      violationCounts: {
        ...fixture.gate.quality.violationCounts,
        html: 1
      }
    }
  });
  assert.throws(
    () => assertFrenchPilotQualityGate(violation),
    /has-violations/u
  );

  const forged = structuredClone(fixture.gate);
  forged.lineage.releaseKey = "forged";
  assert.throws(
    () => assertFrenchPilotQualityGate(forged),
    /envelope-invalid/u
  );
});

test("derives a stable gate hash and filename from sealed blind receipts", (t) => {
  const fixture = gateFixture(t);
  const proof = {
    blindReauditSummaryGeneratedAt: "2026-07-13T21:00:00.000Z",
    blindReceiptCompletedAts: [
      "2026-07-13T20:58:00.000Z",
      "2026-07-13T21:00:00.000Z",
      "2026-07-13T20:59:00.000Z"
    ]
  } as const;
  const { gateHash: _gateHash, ...content } = fixture.gate;
  void _gateHash;

  const first = finalizeFrenchPilotQualityGate({
    ...content,
    generatedAt: resolveFrenchPilotQualityGateGeneratedAt(proof)
  });
  const second = finalizeFrenchPilotQualityGate({
    ...content,
    generatedAt: resolveFrenchPilotQualityGateGeneratedAt({
      ...proof,
      blindReceiptCompletedAts: [...proof.blindReceiptCompletedAts].reverse()
    })
  });

  assert.equal(first.generatedAt, proof.blindReauditSummaryGeneratedAt);
  assert.equal(first.gateHash, second.gateHash);
  assert.equal(
    frenchPilotQualityGateFilename(first.gateHash),
    frenchPilotQualityGateFilename(second.gateHash)
  );
});

test("requires canonical and exactly coherent explicit gate timestamps", () => {
  const sealed = "2026-07-13T21:00:00.000Z";
  const proof = {
    blindReauditSummaryGeneratedAt: sealed,
    blindReceiptCompletedAts: ["2026-07-13T20:59:00.000Z", sealed, sealed]
  };

  assert.equal(resolveFrenchPilotQualityGateGeneratedAt(proof, sealed), sealed);
  assert.throws(
    () =>
      resolveFrenchPilotQualityGateGeneratedAt(proof, "2026-07-13T21:00:00Z"),
    /french-pilot-quality-gate-generated-at-invalid/u
  );
  assert.throws(
    () =>
      resolveFrenchPilotQualityGateGeneratedAt(
        proof,
        "2026-07-13T21:00:01.000Z"
      ),
    /french-pilot-quality-gate-generated-at-incoherent/u
  );
  assert.throws(
    () =>
      resolveFrenchPilotQualityGateGeneratedAt({
        ...proof,
        blindReauditSummaryGeneratedAt: "2026-07-13T20:59:00.000Z"
      }),
    /french-pilot-quality-gate-generated-at-proof-incoherent/u
  );
  assert.throws(
    () =>
      resolveFrenchPilotQualityGateGeneratedAt({
        ...proof,
        blindReceiptCompletedAts: ["2026-07-13T21:00:00Z"]
      }),
    /french-pilot-quality-gate-generated-at-proof-invalid/u
  );
});

test("uses a strict gate CLI parser", () => {
  const defaults = parseFrenchPilotQualityGateArgs([]);
  assert.equal(
    defaults.entityMergeAttestationPath,
    resolve(
      "outputs/lexicon-v3/french-entities/resolved/entity-merge-attestation.json"
    )
  );
  assert.throws(
    () => parseFrenchPilotQualityGateArgs(["--unknown", "x"]),
    /unknown-option:unknown/u
  );
  assert.throws(
    () =>
      parseFrenchPilotQualityGateArgs([
        "--output-dir",
        "a",
        "--output-dir",
        "b"
      ]),
    /duplicate-option:output-dir/u
  );
  assert.throws(
    () => parseFrenchPilotQualityGateArgs(["--output-dir"]),
    /missing-value:output-dir/u
  );
});

function gateFixture(t: TestContext): {
  gate: FrenchPilotQualityGate;
  path: string;
} {
  const directory = temporaryDirectory(t);
  const sourceArtifacts = Object.fromEntries(
    SOURCE_LABELS.map((label, index) => {
      const path = resolve(
        directory,
        `${String(index).padStart(2, "0")}-${label}.json`
      );
      writeFileSync(path, `${JSON.stringify({ label })}\n`, "utf8");
      const buffer = readFileSync(path);
      return [
        label,
        { path, sha256: sha256(buffer), bytes: buffer.byteLength }
      ];
    })
  ) as FrenchPilotQualityGateContent["sourceArtifacts"];
  const transitivePath = resolve(directory, "transitive-receipt-run.json");
  writeFileSync(transitivePath, '{"run":true}\n', "utf8");
  const transitiveBuffer = readFileSync(transitivePath);
  const content: FrenchPilotQualityGateContent = {
    schemaVersion: FRENCH_PILOT_QUALITY_GATE_SCHEMA_VERSION,
    policyVersion: FRENCH_PILOT_QUALITY_GATE_POLICY_VERSION,
    status: "pass",
    generatedAt: "2026-07-13T21:00:00.000Z",
    lineage: {
      releaseKey: "lexicon-v3-en-test.2",
      releaseSnapshotFingerprint: "1".repeat(64),
      sourceLogicalDigest: "2".repeat(64),
      packetSchemaVersion: "lexicon-v3-french-packet@3",
      pilotManifestHash: "3".repeat(64),
      pilotSelectionHash: "4".repeat(64),
      pilotKeyOrderHash: "5".repeat(64),
      selectedPacketsLogicalDigest: "6".repeat(64),
      generationConfigHash: "7".repeat(64),
      approvedExecutionProfileHash: hashFrenchInternalJson(
        FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE
      )
    },
    sourceArtifacts,
    transitiveArtifacts: [
      {
        label: "pilot:proposerRuns",
        path: transitivePath,
        sha256: sha256(transitiveBuffer),
        bytes: transitiveBuffer.byteLength
      }
    ],
    coverage: {
      expectedEntries: 300,
      selectedEntries: 300,
      packetEntries: 300,
      proposerAEntries: 300,
      proposerBEntries: 300,
      arbiterEntries: 300,
      auditorEntries: 300,
      assembledReviewEntries: 300,
      finalReviewEntries: 300,
      executionReceipts: 1200,
      expectedExecutionReceipts: 1200,
      exactSelection: true,
      exactPackets: true,
      exactRoleProofs: true,
      exactFinalReviews: true
    },
    roles: {
      approvedExecutionProfile: FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE,
      receiptsPerEntry: 4,
      fourDistinctRolesPerEntry: true,
      fourDistinctAgentsPerEntry: true,
      fourDistinctThreadsPerEntry: true,
      allReceiptsContentAddressed: true
    },
    quality: {
      statusCounts: {
        auto_validated: 300,
        review_needed: 0,
        blocked_source_issue: 0,
        failed: 0
      },
      violationCounts: {
        identity: 0,
        protectedContent: 0,
        source: 0,
        html: 0,
        structural: 0,
        validator: 0,
        audit: 0,
        sibling: 0
      },
      strata: {
        language: {
          greek: {
            selected: 300,
            autoValidated: 300,
            validatorClean: 300,
            auditorSafe: 300,
            siblingConsistent: 300,
            passRate: 1
          }
        }
      },
      allRequiredStrataRepresented: true
    },
    remediation: {
      status: "complete",
      maxRounds: 3,
      roundsUsed: 1,
      residualEntries: 0,
      initialReviewLogicalDigest: "8".repeat(64),
      finalReviewLogicalDigest: "9".repeat(64),
      runHash: "a".repeat(64)
    },
    blindReaudit: {
      status: "passed",
      sampleSize: 60,
      safe: 60,
      hold: 0,
      block: 0,
      violations: 0,
      freshAgainstPriorAgents: 60,
      freshAgainstPriorThreads: 60,
      manifestHash: "b".repeat(64),
      selectionHash: "c".repeat(64),
      summaryHash: "d".repeat(64),
      receiptsLogicalDigest: "e".repeat(64),
      decisionsLogicalDigest: "f".repeat(64),
      strata: { language: { greek: 30, hebrew: 30 } }
    }
  };
  const gate = finalizeFrenchPilotQualityGate(content);
  const path = resolve(
    directory,
    frenchPilotQualityGateFilename(gate.gateHash)
  );
  writeFileSync(path, `${JSON.stringify(gate, null, 2)}\n`, "utf8");
  return { gate, path };
}

function rehashGate(
  value: Omit<FrenchPilotQualityGate, "gateHash"> | FrenchPilotQualityGate
): FrenchPilotQualityGate {
  const { gateHash: _gateHash, ...content } = value as FrenchPilotQualityGate;
  void _gateHash;
  return finalizeFrenchPilotQualityGate(content);
}

function temporaryDirectory(t: TestContext): string {
  const directory = mkdtempSync(join(tmpdir(), "lexicon-v3-fr-pilot-gate-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
