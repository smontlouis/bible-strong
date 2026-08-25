import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";

import { buildLexiconV3FrenchRemediation } from "../scripts/buildLexiconV3FrenchRemediation.js";
import {
  assertFrenchInternalRemediationEntityPacketSelection,
  buildFrenchInternalRemediationProposerArgs,
  parseRunLexiconV3FrenchInternalRemediationArgs
} from "../scripts/runLexiconV3FrenchInternalRemediation.js";
import { parseFrenchCodexProposersArgs } from "../scripts/runLexiconV3FrenchCodexPilotProposers.js";

import {
  assertFrenchInternalRemediationPlan,
  buildFrenchInternalRemediationMerge,
  buildFrenchInternalRemediationPlan,
  buildFrenchInternalRemediationProposerInputLink,
  frenchInternalRemediationPacketLogicalDigest,
  frenchInternalRemediationReviewLogicalDigest,
  FRENCH_INTERNAL_REMEDIATION_POLICY_VERSION,
  renderFrenchInternalRemediationReviews,
  type FrenchInternalRemediationPlan
} from "../src/lexiconV3/frenchInternalRemediation.js";
import { assertFrenchInternalPublicationContract } from "../src/lexiconV3/frenchPublicationContract.js";
import {
  FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE,
  buildFrenchInternalAgentProof,
  buildFrenchInternalCarrierTerms,
  finalizeFrenchInternalExecutionAttestation,
  finalizeFrenchInternalExecutionReceipt,
  finalizeFrenchInternalReviewRecord,
  finalizeFrenchInternalSiblingConsistencyProof,
  FRENCH_INTERNAL_EXECUTION_ATTESTATION_SCHEMA_VERSION,
  FRENCH_INTERNAL_EXECUTION_RECEIPT_SCHEMA_VERSION,
  FRENCH_INTERNAL_PINNED_CODEX_SHA256,
  FRENCH_INTERNAL_PINNED_CODEX_VERSION,
  FRENCH_INTERNAL_PROMPT_VERSION,
  FRENCH_INTERNAL_REVIEW_POLICY_VERSION,
  FRENCH_INTERNAL_REVIEW_SCHEMA_VERSION,
  frenchInternalArbiterDependencies,
  frenchInternalArbiterResponsePayload,
  frenchInternalAuditorDependencies,
  frenchInternalGenerationConfigHash,
  hashFrenchInternalJson,
  type FrenchInternalAgentProof,
  type FrenchInternalAudit,
  type FrenchInternalExecutionReceipt,
  type FrenchInternalReviewConfiguration,
  type FrenchInternalReviewRecord,
  type FrenchInternalReviewStatus
} from "../src/lexiconV3/frenchInternalReview.js";
import {
  FRENCH_PROPOSAL_SCHEMA_VERSION,
  type FrenchLexiconProposal,
  type FrenchValidationContext,
  validateFrenchProposal
} from "../src/lexiconV3/frenchValidation.js";
import {
  buildFrenchPacket,
  buildFrenchPacketEnglishReleaseLineage,
  type LexiconV3FrenchPacket
} from "../src/lexiconV3/frenchPackets.js";

test("builds parseable proposer arguments for a non-empty remediation round", () => {
  const options = parseRunLexiconV3FrenchInternalRemediationArgs([]);
  const args = buildFrenchInternalRemediationProposerArgs(options, {
    manifestPath: "/tmp/remediation/round-001/agent-batches/manifest.json",
    runtimeRoot: "/tmp/remediation/round-001/runtime",
    expectedEntries: 2
  });

  assert.equal(
    args.filter((value) => value === "--a-reasoning-effort").length,
    1
  );
  assert.equal(
    args.filter((value) => value === "--b-reasoning-effort").length,
    1
  );
  const parsed = parseFrenchCodexProposersArgs(args);
  assert.equal(parsed.expectedEntries, 2);
  assert.equal(
    parsed.proposerA.reasoningEffort,
    options.proposerAReasoningEffort
  );
  assert.equal(
    parsed.proposerB.reasoningEffort,
    options.proposerBReasoningEffort
  );
});

test("keeps a 300-entry pilot distinct from the 22,717-entry entity corpus", () => {
  const releaseKey = "lexicon-v3-en-canary";
  const releaseSnapshotFingerprint = "f".repeat(64);
  const entityPackets = Array.from(
    { length: 22_717 },
    (_, index) =>
      ({
        entryKey: `greek:G${String(index + 1).padStart(5, "0")}`,
        packetHash: createHash("sha256").update(String(index)).digest("hex"),
        englishRelease: { releaseKey, releaseSnapshotFingerprint }
      }) as LexiconV3FrenchPacket
  );
  const selectedPackets = entityPackets.slice(0, 300);

  assert.deepEqual(
    assertFrenchInternalRemediationEntityPacketSelection({
      selectedPackets,
      entityPackets,
      releaseKey,
      releaseSnapshotFingerprint
    }),
    {
      selectedEntries: 300,
      entityEntries: 22_717,
      releaseKey,
      releaseSnapshotFingerprint
    }
  );
  assert.throws(
    () =>
      assertFrenchInternalRemediationEntityPacketSelection({
        selectedPackets: [
          {
            ...selectedPackets[0]!,
            packetHash: "0".repeat(64)
          }
        ],
        entityPackets,
        releaseKey,
        releaseSnapshotFingerprint
      }),
    /french-remediation-entity-packet-selection-drift/u
  );
  assert.throws(
    () =>
      assertFrenchInternalRemediationEntityPacketSelection({
        selectedPackets,
        entityPackets,
        releaseKey,
        releaseSnapshotFingerprint: "e".repeat(64)
      }),
    /french-remediation-entity-packet-lineage-invalid/u
  );
});

test("selects every and only non-auto-validated parent with exact hashes", () => {
  const fixture = remediationFixture();
  const plan = buildPlan(fixture);

  assert.deepEqual(plan.keys, [fixture.reviewPacket.entryKey]);
  assert.equal(plan.counts.selected, 1);
  assert.equal(plan.counts.statuses.auto_validated, 1);
  assert.equal(plan.counts.statuses.review_needed, 1);
  assert.equal(
    plan.items[0]?.parentReviewArtifactHash,
    fixture.reviewNeeded.artifactHash
  );
  assert.equal(plan.items[0]?.packetHash, fixture.reviewPacket.packetHash);
  assert.equal(
    plan.items[0]?.englishHash,
    fixture.reviewPacket.english.contentHash
  );
  assert.deepEqual(
    plan.items[0]?.parentDiagnostics.audit?.reasons,
    fixture.reviewNeeded.auditor?.reasons
  );
  assert.deepEqual(
    plan.items[0]?.parentDiagnostics.validation.selected,
    fixture.reviewNeeded.arbiter?.validation.issues
  );
  assert.equal(plan.contentHash, hashFrenchInternalJson({ keys: plan.keys }));
  assert.deepEqual(plan.executionContract, {
    runtime: "codex-internal-agent-runtime",
    cel: "forbidden",
    aiGateway: "forbidden",
    localTools: "disabled",
    networkDataTools: "disabled",
    shell: "disabled",
    proposers: ["proposerA", "proposerB"],
    proposerIndependenceRequired: true,
    arbiterAndAuditorRequired: true,
    exactSelectedCoverageRequired: true,
    replacementPolicy: "fresh-attempt-advances-auto-validated-only-publishes"
  });
  assert.doesNotThrow(() =>
    assertFrenchInternalRemediationPlan(plan, {
      packets: fixture.packets,
      reviews: fixture.reviews,
      sources: plan.sources
    })
  );
});

test("rejects a rehashed or stale parent plan", () => {
  const fixture = remediationFixture();
  const plan = buildPlan(fixture);
  const tamperedContent = {
    ...withoutPlanHash(plan),
    items: [
      {
        ...plan.items[0]!,
        parentReviewArtifactHash: "f".repeat(64)
      }
    ]
  };
  const tampered = {
    ...tamperedContent,
    planHash: hashFrenchInternalJson(tamperedContent)
  } as FrenchInternalRemediationPlan;

  assert.throws(
    () =>
      assertFrenchInternalRemediationPlan(tampered, {
        packets: fixture.packets,
        reviews: fixture.reviews,
        sources: tampered.sources
      }),
    /invalid-french-remediation-plan-content/u
  );
});

test("replaces only a fresh auto-validated attempt and preserves all other rows", () => {
  const fixture = remediationFixture();
  const plan = buildPlan(fixture);
  const attempted = reviewRecord(
    fixture.reviewPacket,
    "auto_validated",
    "attempt",
    "safe"
  );
  const attemptedSource = {
    path: "/tmp/attempted.jsonl",
    sha256: "c".repeat(64),
    records: 1,
    logicalDigest: frenchInternalRemediationReviewLogicalDigest([attempted])
  };
  const result = buildFrenchInternalRemediationMerge({
    plan,
    packets: fixture.packets,
    previousReviews: fixture.reviews,
    attemptedReviews: [attempted],
    ...inputProof(plan, attempted),
    attemptedReviewsSource: attemptedSource
  });

  assert.equal(result.merge.counts.attempted, 1);
  assert.equal(result.merge.counts.replaced, 1);
  assert.equal(result.merge.counts.residual, 0);
  assert.equal(result.merge.replacements.length, 1);
  assert.equal(
    result.merge.replacements[0]?.parentReviewArtifactHash,
    fixture.reviewNeeded.artifactHash
  );
  assert.equal(
    result.merge.replacements[0]?.attemptedReviewArtifactHash,
    attempted.artifactHash
  );
  assert.equal(
    result.records.find(
      (record) => record.entryKey === fixture.autoPacket.entryKey
    )?.executionAttestation?.attestationHash,
    fixture.autoValidated.executionAttestation?.attestationHash
  );
  assert.equal(
    result.records.find(
      (record) => record.entryKey === fixture.reviewPacket.entryKey
    )?.executionAttestation?.attestationHash,
    attempted.executionAttestation?.attestationHash
  );
  assert.ok(
    result.records.every((record) => record.status === "auto_validated")
  );
});

test("advances a hold as the diagnostic parent for the next bounded round", () => {
  const fixture = remediationFixture();
  const plan = buildPlan(fixture);
  const attempted = reviewRecord(
    fixture.reviewPacket,
    "review_needed",
    "attempt-hold",
    "hold"
  );
  const result = buildFrenchInternalRemediationMerge({
    plan,
    packets: fixture.packets,
    previousReviews: fixture.reviews,
    attemptedReviews: [attempted],
    ...inputProof(plan, attempted),
    attemptedReviewsSource: {
      path: "/tmp/attempted-hold.jsonl",
      sha256: "d".repeat(64),
      records: 1,
      logicalDigest: frenchInternalRemediationReviewLogicalDigest([attempted])
    }
  });

  assert.equal(result.merge.counts.replaced, 0);
  assert.equal(result.merge.counts.retained, 1);
  assert.equal(result.merge.counts.residual, 1);
  assert.equal(
    result.merge.residuals[0]?.entryKey,
    fixture.reviewPacket.entryKey
  );
  assert.equal(
    result.records.find(
      (record) => record.entryKey === fixture.reviewPacket.entryKey
    )?.executionAttestation?.attestationHash,
    attempted.executionAttestation?.attestationHash
  );
  const nextPlan = buildFrenchInternalRemediationPlan({
    round: 2,
    maxRounds: 3,
    packets: fixture.packets,
    reviews: result.records,
    sources: sources(fixture.packets, result.records)
  });
  assert.equal(
    nextPlan.items[0]?.parentReviewArtifactHash,
    result.records.find(
      (record) => record.entryKey === fixture.reviewPacket.entryKey
    )?.artifactHash
  );
  assert.deepEqual(
    nextPlan.items[0]?.parentDiagnostics.audit?.reasons,
    attempted.auditor?.reasons
  );
});

test("fails closed on incomplete attempt coverage and reused agent identity", () => {
  const fixture = remediationFixture();
  const plan = buildPlan(fixture);
  const coverageProof = reviewRecord(
    fixture.reviewPacket,
    "auto_validated",
    "coverage-proof",
    "safe"
  );
  assert.throws(
    () =>
      buildFrenchInternalRemediationMerge({
        plan,
        packets: fixture.packets,
        previousReviews: fixture.reviews,
        attemptedReviews: [],
        ...inputProof(plan, coverageProof),
        attemptedReviewsSource: {
          path: "/tmp/empty.jsonl",
          sha256: "e".repeat(64),
          records: 0,
          logicalDigest: frenchInternalRemediationReviewLogicalDigest([])
        }
      }),
    /attempted-review-coverage/u
  );

  const reused = reviewRecord(
    fixture.reviewPacket,
    "auto_validated",
    "parent",
    "safe"
  );
  assert.throws(
    () =>
      buildFrenchInternalRemediationMerge({
        plan,
        packets: fixture.packets,
        previousReviews: fixture.reviews,
        attemptedReviews: [reused],
        ...inputProof(plan, reused),
        attemptedReviewsSource: {
          path: "/tmp/reused.jsonl",
          sha256: "f".repeat(64),
          records: 1,
          logicalDigest: frenchInternalRemediationReviewLogicalDigest([reused])
        }
      }),
    /attempt-agent-not-fresh/u
  );

  const fresh = reviewRecord(
    fixture.reviewPacket,
    "auto_validated",
    "fresh-but-wrong-input",
    "safe"
  );
  assert.throws(
    () =>
      buildFrenchInternalRemediationMerge({
        plan,
        packets: fixture.packets,
        previousReviews: fixture.reviews,
        attemptedReviews: [fresh],
        ...inputProof(plan, fresh, { proposerAInputHash: "8".repeat(64) }),
        attemptedReviewsSource: {
          path: "/tmp/wrong-input.jsonl",
          sha256: "7".repeat(64),
          records: 1,
          logicalDigest: frenchInternalRemediationReviewLogicalDigest([fresh])
        }
      }),
    /attempt-input-not-bound/u
  );
});

test("refuses a round outside the declared bound", () => {
  const fixture = remediationFixture();
  assert.throws(
    () =>
      buildFrenchInternalRemediationPlan({
        round: 4,
        maxRounds: 3,
        packets: fixture.packets,
        reviews: fixture.reviews,
        sources: sources(fixture.packets, fixture.reviews)
      }),
    /round-invalid:4:3/u
  );
});

test("writes and replays a content-addressed plan without network", (t) => {
  const fixture = remediationFixture();
  const directory = temporaryDirectory(t);
  const packetsPath = join(directory, "packets.jsonl");
  const reviewsPath = join(directory, "reviews.jsonl");
  const planPath = join(directory, "round-001", "plan.json");
  writeJsonl(packetsPath, fixture.packets);
  writeJsonl(reviewsPath, fixture.reviews);
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error("fetch-must-not-be-called");
  }) as typeof globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const plan = buildLexiconV3FrenchRemediation({
    packetsPath,
    reviewsPath,
    outputPath: planPath,
    round: 1,
    maxRounds: 2
  });
  const replay = buildLexiconV3FrenchRemediation({
    packetsPath,
    reviewsPath,
    outputPath: planPath,
    round: 1,
    maxRounds: 2
  });

  assert.equal(fetchCalls, 0);
  assert.equal(replay.planHash, plan.planHash);
  assert.equal(
    JSON.parse(readFileSync(planPath, "utf8")).planHash,
    plan.planHash
  );
});

test("publishes one full cohort plus an exactly replayed remediation cohort", (t) => {
  const directory = temporaryDirectory(t);
  const packets = [
    packet(3056, "λόγος", "logos", "word"),
    packet(26, "ἀγάπη", "agapē", "love"),
    packet(4102, "πίστις", "pistis", "faith")
  ];
  const packetsPath = join(directory, "packets.jsonl");
  const initialPath = join(directory, "initial-reviews.jsonl");
  const planPath = join(directory, "plan.json");
  const manifestPath = join(directory, "manifest.json");
  const proposerSummaryPath = join(directory, "proposer-summary.json");
  const adjudicationSummaryPath = join(directory, "adjudication-summary.json");
  const attemptedPath = join(directory, "attempted.jsonl");
  const mergedPath = join(directory, "merged.jsonl");
  const mergeSummaryPath = join(directory, "merge-summary.json");
  const runSummaryPath = join(directory, "run-summary.json");
  writeJsonl(packetsPath, packets);

  const fullClosure = {
    namespace: "/fr-internal/full",
    selectionHash: hashFrenchInternalJson({ full: true }),
    keyOrderHash: hashFrenchInternalJson(
      packets.map((packet) => packet.entryKey)
    ),
    proposerManifestHash: hashFrenchInternalJson("full-proposer-manifest"),
    proposerSummaryHash: hashFrenchInternalJson("full-proposer-summary"),
    arbiterManifestHash: hashFrenchInternalJson("full-arbiter-manifest"),
    arbiterSummaryHash: hashFrenchInternalJson("full-arbiter-summary"),
    auditorManifestHash: hashFrenchInternalJson("full-auditor-manifest"),
    auditorSummaryHash: hashFrenchInternalJson("full-auditor-summary"),
    adjudicationSummaryHash: hashFrenchInternalJson("full-adjudication-summary")
  };
  const initialDrafts = [
    reviewRecord(packets[0]!, "auto_validated", "full-existing-auto", "safe", {
      ...fullClosure,
      executionReceiptsDigest: "0".repeat(64)
    }),
    reviewRecord(packets[1]!, "review_needed", "full-parent", "hold", {
      ...fullClosure,
      executionReceiptsDigest: "0".repeat(64)
    }),
    reviewRecord(packets[2]!, "review_needed", "full-parent-two", "hold", {
      ...fullClosure,
      executionReceiptsDigest: "0".repeat(64)
    })
  ];
  const initial = finalizeExecutionCohort(initialDrafts, fullClosure);
  writeJsonl(initialPath, initial);

  const sourceArtifacts = {
    packets: reviewSource(
      packetsPath,
      packets.length,
      frenchInternalRemediationPacketLogicalDigest(packets)
    ),
    reviews: reviewSource(
      initialPath,
      initial.length,
      frenchInternalRemediationReviewLogicalDigest(initial)
    )
  };
  const plan = buildFrenchInternalRemediationPlan({
    round: 1,
    maxRounds: 3,
    packets,
    reviews: initial,
    sources: sourceArtifacts
  });
  writeJson(planPath, plan);

  const namespace = "/fr-internal/custom/remediation-r001";
  const selectionHash = hashFrenchInternalJson({
    namespace,
    keys: plan.keys
  });
  const manifestContent = {
    runKind: "custom",
    namespace,
    sourcePaths: { selection: planPath, packets: packetsPath },
    sourceDigests: {
      selection: fileHash(planPath),
      packets: fileHash(packetsPath)
    },
    lineage: {
      releaseKey: packets[0]!.englishRelease.releaseKey,
      releaseSnapshotFingerprint:
        packets[0]!.englishRelease.releaseSnapshotFingerprint
    },
    selection: {
      sourcePath: planPath,
      sourceFileHash: fileHash(planPath),
      expectedEntries: plan.keys.length,
      keys: plan.keys,
      keyOrderHash: hashFrenchInternalJson(plan.keys),
      contentHash: selectionHash
    },
    counts: { entries: plan.keys.length }
  };
  const manifest = {
    ...manifestContent,
    manifestHash: hashFrenchInternalJson(manifestContent)
  };
  writeJson(manifestPath, manifest);

  const proposerContent = {
    runKind: "custom",
    namespace,
    selectionHash,
    keyOrderHash: manifest.selection.keyOrderHash,
    coverage: "exact",
    manifestHash: manifest.manifestHash,
    counts: {
      entries: plan.keys.length,
      proposerA: plan.keys.length,
      proposerB: plan.keys.length
    }
  };
  const proposerSummary = {
    ...proposerContent,
    summaryHash: hashFrenchInternalJson(proposerContent)
  };
  writeJson(proposerSummaryPath, proposerSummary);

  const arbiterManifestHash = hashFrenchInternalJson(
    "remediation-arbiter-manifest"
  );
  const arbiterSummaryHash = hashFrenchInternalJson(
    "remediation-arbiter-summary"
  );
  const auditorManifestHash = hashFrenchInternalJson(
    "remediation-auditor-manifest"
  );
  const auditorSummaryHash = hashFrenchInternalJson(
    "remediation-auditor-summary"
  );
  const attemptedDraft = reviewRecord(
    packets[1]!,
    "auto_validated",
    "fresh-remediation-attempt",
    "safe",
    {
      namespace,
      selectionHash,
      keyOrderHash: manifest.selection.keyOrderHash,
      proposerManifestHash: manifest.manifestHash,
      proposerSummaryHash: proposerSummary.summaryHash,
      arbiterManifestHash,
      arbiterSummaryHash,
      auditorManifestHash,
      auditorSummaryHash,
      executionReceiptsDigest: "0".repeat(64),
      adjudicationSummaryHash: "0".repeat(64)
    }
  );
  const attemptedDraftHold = reviewRecord(
    packets[2]!,
    "review_needed",
    "fresh-remediation-hold",
    "hold",
    {
      namespace,
      selectionHash,
      keyOrderHash: manifest.selection.keyOrderHash,
      proposerManifestHash: manifest.manifestHash,
      proposerSummaryHash: proposerSummary.summaryHash,
      arbiterManifestHash,
      arbiterSummaryHash,
      auditorManifestHash,
      auditorSummaryHash,
      executionReceiptsDigest: "0".repeat(64),
      adjudicationSummaryHash: "0".repeat(64)
    }
  );
  const attemptedReceiptsDigest = cohortExecutionReceiptsDigest([
    attemptedDraft,
    attemptedDraftHold
  ]);
  const executionReceiptsSummaryHash = hashFrenchInternalJson(
    "remediation-execution-receipts-summary"
  );
  const adjudicationContent = {
    namespace,
    phase: "all",
    expectedEntries: plan.keys.length,
    proposerProof: { summaryHash: proposerSummary.summaryHash },
    outputs: {
      arbiter: { summaryHash: arbiterSummaryHash },
      auditor: { summaryHash: auditorSummaryHash },
      executionReceipts: {
        summaryHash: executionReceiptsSummaryHash,
        output: {
          logicalDigest: attemptedReceiptsDigest,
          records: plan.keys.length * 4
        }
      }
    }
  };
  const adjudicationSummary = {
    ...adjudicationContent,
    summaryHash: hashFrenchInternalJson(adjudicationContent)
  };
  writeJson(adjudicationSummaryPath, adjudicationSummary);

  const customClosure = {
    namespace,
    selectionHash,
    keyOrderHash: manifest.selection.keyOrderHash,
    proposerManifestHash: manifest.manifestHash,
    proposerSummaryHash: proposerSummary.summaryHash,
    arbiterManifestHash,
    arbiterSummaryHash,
    auditorManifestHash,
    auditorSummaryHash,
    adjudicationSummaryHash: adjudicationSummary.summaryHash
  };
  const attempted = finalizeExecutionCohort(
    [attemptedDraft, attemptedDraftHold],
    customClosure
  );
  writeJsonl(attemptedPath, attempted);

  const batchManifestSha256 = fileHash(manifestPath);
  const proposerInputs = attempted.flatMap(
    (record) =>
      inputProof(plan, record, {
        batchManifestPath: manifestPath,
        batchManifestSha256
      }).proposerInputs
  );
  const proof = {
    proposerInputs,
    batchManifestSource: {
      path: manifestPath,
      sha256: batchManifestSha256,
      records: proposerInputs.length,
      logicalDigest: hashFrenchInternalJson({
        manifestSha256: batchManifestSha256,
        proposerInputs
      })
    }
  };
  const mergeBuild = buildFrenchInternalRemediationMerge({
    plan,
    packets,
    previousReviews: initial,
    attemptedReviews: attempted,
    ...proof,
    attemptedReviewsSource: reviewSource(
      attemptedPath,
      attempted.length,
      frenchInternalRemediationReviewLogicalDigest(attempted)
    )
  });
  writeFileSync(
    mergedPath,
    renderFrenchInternalRemediationReviews(mergeBuild.records),
    "utf8"
  );
  writeJson(mergeSummaryPath, mergeBuild.merge);

  const roundContent = {
    round: 1,
    namespace,
    planPath,
    planHash: plan.planHash,
    selected: plan.keys.length,
    batchManifestPath: manifestPath,
    batchManifestHash: manifest.manifestHash,
    proposerSummaryPath,
    proposerSummaryHash: proposerSummary.summaryHash,
    adjudicationSummaryPath,
    adjudicationSummarySha256: fileHash(adjudicationSummaryPath),
    attemptedReviewPath: attemptedPath,
    attemptedReviewSha256: fileHash(attemptedPath),
    mergedReviewPath: mergedPath,
    mergeSummaryPath,
    mergeHash: mergeBuild.merge.mergeHash,
    replaced: mergeBuild.merge.counts.replaced,
    residual: mergeBuild.merge.counts.residual
  };
  const round = {
    ...roundContent,
    roundHash: hashFrenchInternalJson(roundContent)
  };

  const planPath2 = join(directory, "plan-002.json");
  const manifestPath2 = join(directory, "manifest-002.json");
  const proposerSummaryPath2 = join(directory, "proposer-summary-002.json");
  const adjudicationSummaryPath2 = join(
    directory,
    "adjudication-summary-002.json"
  );
  const attemptedPath2 = join(directory, "attempted-002.jsonl");
  const mergedPath2 = join(directory, "merged-002.jsonl");
  const mergeSummaryPath2 = join(directory, "merge-summary-002.json");
  const plan2 = buildFrenchInternalRemediationPlan({
    round: 2,
    maxRounds: 3,
    packets,
    reviews: mergeBuild.records,
    sources: {
      packets: sourceArtifacts.packets,
      reviews: reviewSource(
        mergedPath,
        mergeBuild.records.length,
        frenchInternalRemediationReviewLogicalDigest(mergeBuild.records)
      )
    }
  });
  assert.equal(plan2.keys.length, 1);
  assert.equal(plan2.keys[0], packets[2]!.entryKey);
  writeJson(planPath2, plan2);

  const namespace2 = "/fr-internal/custom/remediation-r002";
  const selectionHash2 = hashFrenchInternalJson({
    namespace: namespace2,
    keys: plan2.keys
  });
  const manifestContent2 = {
    runKind: "custom",
    namespace: namespace2,
    sourcePaths: { selection: planPath2, packets: packetsPath },
    sourceDigests: {
      selection: fileHash(planPath2),
      packets: fileHash(packetsPath)
    },
    lineage: manifest.lineage,
    selection: {
      sourcePath: planPath2,
      sourceFileHash: fileHash(planPath2),
      expectedEntries: plan2.keys.length,
      keys: plan2.keys,
      keyOrderHash: hashFrenchInternalJson(plan2.keys),
      contentHash: selectionHash2
    },
    counts: { entries: plan2.keys.length }
  };
  const manifest2 = {
    ...manifestContent2,
    manifestHash: hashFrenchInternalJson(manifestContent2)
  };
  writeJson(manifestPath2, manifest2);
  const proposerContent2 = {
    runKind: "custom",
    namespace: namespace2,
    selectionHash: selectionHash2,
    keyOrderHash: manifest2.selection.keyOrderHash,
    coverage: "exact",
    manifestHash: manifest2.manifestHash,
    counts: {
      entries: plan2.keys.length,
      proposerA: plan2.keys.length,
      proposerB: plan2.keys.length
    }
  };
  const proposerSummary2 = {
    ...proposerContent2,
    summaryHash: hashFrenchInternalJson(proposerContent2)
  };
  writeJson(proposerSummaryPath2, proposerSummary2);
  const arbiterManifestHash2 = hashFrenchInternalJson(
    "remediation-two-arbiter-manifest"
  );
  const arbiterSummaryHash2 = hashFrenchInternalJson(
    "remediation-two-arbiter-summary"
  );
  const auditorManifestHash2 = hashFrenchInternalJson(
    "remediation-two-auditor-manifest"
  );
  const auditorSummaryHash2 = hashFrenchInternalJson(
    "remediation-two-auditor-summary"
  );
  const attemptedDraft2 = reviewRecord(
    packets[2]!,
    "auto_validated",
    "fresh-remediation-two",
    "safe",
    {
      namespace: namespace2,
      selectionHash: selectionHash2,
      keyOrderHash: manifest2.selection.keyOrderHash,
      proposerManifestHash: manifest2.manifestHash,
      proposerSummaryHash: proposerSummary2.summaryHash,
      arbiterManifestHash: arbiterManifestHash2,
      arbiterSummaryHash: arbiterSummaryHash2,
      auditorManifestHash: auditorManifestHash2,
      auditorSummaryHash: auditorSummaryHash2,
      executionReceiptsDigest: "0".repeat(64),
      adjudicationSummaryHash: "0".repeat(64)
    }
  );
  const attemptedReceiptsDigest2 = cohortExecutionReceiptsDigest([
    attemptedDraft2
  ]);
  const adjudicationContent2 = {
    namespace: namespace2,
    phase: "all",
    expectedEntries: plan2.keys.length,
    proposerProof: { summaryHash: proposerSummary2.summaryHash },
    outputs: {
      arbiter: { summaryHash: arbiterSummaryHash2 },
      auditor: { summaryHash: auditorSummaryHash2 },
      executionReceipts: {
        summaryHash: hashFrenchInternalJson(
          "remediation-two-execution-receipts-summary"
        ),
        output: {
          logicalDigest: attemptedReceiptsDigest2,
          records: plan2.keys.length * 4
        }
      }
    }
  };
  const adjudicationSummary2 = {
    ...adjudicationContent2,
    summaryHash: hashFrenchInternalJson(adjudicationContent2)
  };
  writeJson(adjudicationSummaryPath2, adjudicationSummary2);
  const attempted2 = finalizeExecutionCohort([attemptedDraft2], {
    namespace: namespace2,
    selectionHash: selectionHash2,
    keyOrderHash: manifest2.selection.keyOrderHash,
    proposerManifestHash: manifest2.manifestHash,
    proposerSummaryHash: proposerSummary2.summaryHash,
    arbiterManifestHash: arbiterManifestHash2,
    arbiterSummaryHash: arbiterSummaryHash2,
    auditorManifestHash: auditorManifestHash2,
    auditorSummaryHash: auditorSummaryHash2,
    adjudicationSummaryHash: adjudicationSummary2.summaryHash
  });
  writeJsonl(attemptedPath2, attempted2);
  const proof2 = inputProof(plan2, attempted2[0]!, {
    batchManifestPath: manifestPath2,
    batchManifestSha256: fileHash(manifestPath2)
  });
  const mergeBuild2 = buildFrenchInternalRemediationMerge({
    plan: plan2,
    packets,
    previousReviews: mergeBuild.records,
    attemptedReviews: attempted2,
    ...proof2,
    attemptedReviewsSource: reviewSource(
      attemptedPath2,
      attempted2.length,
      frenchInternalRemediationReviewLogicalDigest(attempted2)
    )
  });
  writeFileSync(
    mergedPath2,
    renderFrenchInternalRemediationReviews(mergeBuild2.records),
    "utf8"
  );
  writeJson(mergeSummaryPath2, mergeBuild2.merge);
  const roundContent2 = {
    round: 2,
    namespace: namespace2,
    planPath: planPath2,
    planHash: plan2.planHash,
    selected: plan2.keys.length,
    batchManifestPath: manifestPath2,
    batchManifestHash: manifest2.manifestHash,
    proposerSummaryPath: proposerSummaryPath2,
    proposerSummaryHash: proposerSummary2.summaryHash,
    adjudicationSummaryPath: adjudicationSummaryPath2,
    adjudicationSummarySha256: fileHash(adjudicationSummaryPath2),
    attemptedReviewPath: attemptedPath2,
    attemptedReviewSha256: fileHash(attemptedPath2),
    mergedReviewPath: mergedPath2,
    mergeSummaryPath: mergeSummaryPath2,
    mergeHash: mergeBuild2.merge.mergeHash,
    replaced: mergeBuild2.merge.counts.replaced,
    residual: mergeBuild2.merge.counts.residual
  };
  const round2 = {
    ...roundContent2,
    roundHash: hashFrenchInternalJson(roundContent2)
  };
  const runContent = {
    schemaVersion: "lexicon-v3-french-internal-remediation-run@1",
    policyVersion: FRENCH_INTERNAL_REMEDIATION_POLICY_VERSION,
    status: "complete",
    maxRounds: 3,
    executionContract: {
      runtime: "codex-internal-agent-runtime",
      cel: "forbidden",
      aiGateway: "forbidden",
      localTools: "disabled",
      networkDataTools: "disabled",
      shell: "disabled",
      boundedRounds: true,
      exactCoverage: true,
      mergePolicy: "fresh-attempt-advances-auto-validated-only-publishes"
    },
    initialReviews: sourceArtifacts.reviews,
    rounds: [round, round2],
    finalReviews: reviewSource(
      mergedPath2,
      mergeBuild2.records.length,
      frenchInternalRemediationReviewLogicalDigest(mergeBuild2.records)
    ),
    residuals: []
  } as const;
  const runSummary = {
    ...runContent,
    runHash: hashFrenchInternalJson(runContent)
  };
  writeJson(runSummaryPath, runSummary);

  const publication = assertFrenchInternalPublicationContract({
    finalReviewsPath: mergedPath2,
    finalReviews: mergeBuild2.records,
    packetsPath,
    packets,
    remediationSummaryPath: runSummaryPath
  });
  assert.equal(publication.cohorts, 3);
  assert.equal(publication.remediationRounds, 2);
  assert.equal(publication.remediationRunHash, runSummary.runHash);

  const invalidPackets = structuredClone(packets);
  invalidPackets[0]!.packetHash = "0".repeat(64);
  assert.throws(
    () =>
      assertFrenchInternalPublicationContract({
        finalReviewsPath: mergedPath2,
        finalReviews: mergeBuild2.records,
        packetsPath,
        packets: invalidPackets,
        remediationSummaryPath: runSummaryPath
      }),
    /french-publication-packet-invalid:/u
  );

  const fullCustomRound = {
    ...round,
    selected: 22_717
  };
  const { roundHash: _oldRoundHash, ...fullCustomRoundContent } =
    fullCustomRound;
  void _oldRoundHash;
  const forgedRound = {
    ...fullCustomRoundContent,
    roundHash: hashFrenchInternalJson(fullCustomRoundContent)
  };
  const forgedRunContent = {
    ...runContent,
    rounds: [forgedRound, round2]
  };
  const forgedRun = {
    ...forgedRunContent,
    runHash: hashFrenchInternalJson(forgedRunContent)
  };
  const forgedSummaryPath = join(directory, "run-summary-full-custom.json");
  writeJson(forgedSummaryPath, forgedRun);
  assert.throws(
    () =>
      assertFrenchInternalPublicationContract({
        finalReviewsPath: mergedPath2,
        finalReviews: mergeBuild2.records,
        packetsPath,
        packets,
        remediationSummaryPath: forgedSummaryPath
      }),
    /french-publication-remediation-cannot-replace-full-corpus:1/u
  );
});

interface RemediationFixture {
  packets: LexiconV3FrenchPacket[];
  reviews: FrenchInternalReviewRecord[];
  autoPacket: LexiconV3FrenchPacket;
  reviewPacket: LexiconV3FrenchPacket;
  autoValidated: FrenchInternalReviewRecord;
  reviewNeeded: FrenchInternalReviewRecord;
}

function remediationFixture(): RemediationFixture {
  const autoPacket = packet(3056, "λόγος", "logos", "word");
  const reviewPacket = packet(26, "ἀγάπη", "agapē", "love");
  const autoValidated = reviewRecord(
    autoPacket,
    "auto_validated",
    "existing-auto",
    "safe"
  );
  const reviewNeeded = reviewRecord(
    reviewPacket,
    "review_needed",
    "parent",
    "hold"
  );
  return {
    packets: [autoPacket, reviewPacket],
    reviews: [autoValidated, reviewNeeded],
    autoPacket,
    reviewPacket,
    autoValidated,
    reviewNeeded
  };
}

function buildPlan(fixture: RemediationFixture): FrenchInternalRemediationPlan {
  return buildFrenchInternalRemediationPlan({
    round: 1,
    maxRounds: 3,
    packets: fixture.packets,
    reviews: fixture.reviews,
    sources: sources(fixture.packets, fixture.reviews)
  });
}

function sources(
  packets: LexiconV3FrenchPacket[],
  reviews: FrenchInternalReviewRecord[]
): FrenchInternalRemediationPlan["sources"] {
  return {
    packets: {
      path: "/tmp/packets.jsonl",
      sha256: "a".repeat(64),
      records: packets.length,
      logicalDigest: frenchInternalRemediationPacketLogicalDigest(packets)
    },
    reviews: {
      path: "/tmp/reviews.jsonl",
      sha256: "b".repeat(64),
      records: reviews.length,
      logicalDigest: frenchInternalRemediationReviewLogicalDigest(reviews)
    }
  };
}

function inputProof(
  plan: FrenchInternalRemediationPlan,
  attempted: FrenchInternalReviewRecord,
  overrides: {
    proposerAInputHash?: string;
    proposerBInputHash?: string;
    batchManifestSha256?: string;
    batchManifestPath?: string;
  } = {}
): Pick<
  Parameters<typeof buildFrenchInternalRemediationMerge>[0],
  "proposerInputs" | "batchManifestSource"
> {
  const batchManifestSha256 = overrides.batchManifestSha256 ?? "9".repeat(64);
  const item = plan.items.find(
    (candidate) => candidate.entryKey === attempted.entryKey
  )!;
  const proposerInputs = [
    buildFrenchInternalRemediationProposerInputLink({
      item,
      batchManifestSha256,
      proposerAInputHash:
        overrides.proposerAInputHash ??
        attempted.agentProofs!.proposerA!.inputHash,
      proposerBInputHash:
        overrides.proposerBInputHash ??
        attempted.agentProofs!.proposerB!.inputHash
    })
  ];
  return {
    proposerInputs,
    batchManifestSource: {
      path: overrides.batchManifestPath ?? "/tmp/batch-manifest.json",
      sha256: batchManifestSha256,
      records: proposerInputs.length,
      logicalDigest: hashFrenchInternalJson({
        manifestSha256: batchManifestSha256,
        proposerInputs
      })
    }
  };
}

function packet(
  strongNumber: number,
  original: string,
  transliteration: string,
  gloss: string
): LexiconV3FrenchPacket {
  const eStrong = `G${String(strongNumber).padStart(4, "0")}`;
  const entryKey = `greek:${eStrong}`;
  const meaning = `A ${original} means ${gloss}.`;
  const meaningHtml = `<p>A <b>${original}</b> means ${gloss}.</p>`;
  return buildFrenchPacket(
    {
      entryKey,
      identity: {
        stepEntryId: strongNumber,
        language: "greek",
        eStrong,
        dStrong: eStrong,
        uStrong: eStrong,
        original,
        transliteration,
        morph: "N"
      },
      englishRelease: buildFrenchPacketEnglishReleaseLineage({
        entryKey,
        releaseKey: "lexicon-v3-en-fixture",
        releaseSnapshotFingerprint: "6".repeat(64),
        gloss: {
          fieldVersionId: 1,
          state: "auto_validated",
          method: "fixture",
          generator: "fixture",
          valueText: gloss
        },
        meaning: {
          fieldVersionId: 2,
          state: "auto_validated",
          method: "fixture",
          generator: "fixture",
          valueText: meaning,
          valueHtml: meaningHtml
        }
      }),
      english: {
        contentHash: hashFrenchInternalJson({ eStrong, gloss }),
        status: "validated",
        gloss,
        meaning,
        meaningHtml,
        sources: ["fixture"],
        issues: []
      },
      evidence: {
        occurrenceGlosses: [],
        concordanceForms: [
          {
            surface: "parole",
            normalized: "parole",
            count: 4,
            strongCount: 1,
            witnessFamilies: ["Darby-family", "Sg1910"],
            sources: ["Darby", "DarbyR", "Sg1910"]
          }
        ],
        legacy: null,
        existingFrench: null,
        resourceFrench: []
      },
      protectedContent: {
        strongCodes: [],
        references: [],
        originalTokens: [original]
      }
    },
    "2026-07-13T09:00:00.000Z"
  );
}

interface ReviewExecutionFixture {
  namespace: string;
  selectionHash: string;
  keyOrderHash: string;
  proposerManifestHash: string;
  proposerSummaryHash: string;
  arbiterManifestHash: string;
  arbiterSummaryHash: string;
  auditorManifestHash: string;
  auditorSummaryHash: string;
  executionReceiptsDigest: string;
  adjudicationSummaryHash: string;
}

function defaultReviewExecution(
  packet: LexiconV3FrenchPacket
): ReviewExecutionFixture {
  return {
    namespace: "/fr-internal/custom/test",
    selectionHash: "1".repeat(64),
    keyOrderHash: hashFrenchInternalJson([packet.entryKey]),
    proposerManifestHash: "2".repeat(64),
    proposerSummaryHash: "3".repeat(64),
    arbiterManifestHash: "4".repeat(64),
    arbiterSummaryHash: "5".repeat(64),
    auditorManifestHash: "6".repeat(64),
    auditorSummaryHash: "7".repeat(64),
    executionReceiptsDigest: "8".repeat(64),
    adjudicationSummaryHash: "9".repeat(64)
  };
}

function reviewRecord(
  packet: LexiconV3FrenchPacket,
  status: FrenchInternalReviewStatus,
  identityPrefix: string,
  auditVerdict: FrenchInternalAudit["verdict"],
  execution: ReviewExecutionFixture = defaultReviewExecution(packet)
): FrenchInternalReviewRecord {
  const configuration = frenchConfiguration();
  const generationConfigHash =
    frenchInternalGenerationConfigHash(configuration);
  const proposalA = proposal(packet, `${identityPrefix}/proposal-a`);
  const proposalB = proposal(packet, `${identityPrefix}/proposal-b`);
  const context = validationContext(packet);
  const validationA = validateFrenchProposal(proposalA, context);
  const validationB = validateFrenchProposal(proposalB, context);
  const arbitration = {
    verdict: "accept" as const,
    selectedProposal: "proposalA" as const,
    reasons: [],
    proposal: proposalA,
    validation: validationA
  };
  const audit: FrenchInternalAudit = {
    verdict: auditVerdict,
    reasons: auditVerdict === "safe" ? [] : ["nouvelle vérification requise"],
    confidence: 0.97,
    checks: passingAuditChecks()
  };
  const common = {
    entryKey: packet.entryKey,
    packetHash: packet.packetHash,
    englishHash: packet.english.contentHash,
    generationConfigHash
  };
  const receiptA = reviewReceipt({
    role: "proposerA",
    packet,
    identityPrefix,
    execution,
    inputHash: hashFrenchInternalJson({ identityPrefix, role: "proposerA" }),
    completedAt: "2026-07-13T10:00:00.000Z"
  });
  const receiptB = reviewReceipt({
    role: "proposerB",
    packet,
    identityPrefix,
    execution,
    inputHash: hashFrenchInternalJson({ identityPrefix, role: "proposerB" }),
    completedAt: "2026-07-13T10:01:00.000Z"
  });
  const receiptArbiter = reviewReceipt({
    role: "arbiter",
    packet,
    identityPrefix,
    execution,
    inputHash: hashFrenchInternalJson({ identityPrefix, role: "arbiter" }),
    completedAt: "2026-07-13T10:02:00.000Z"
  });
  const receiptAuditor = reviewReceipt({
    role: "auditor",
    packet,
    identityPrefix,
    execution,
    inputHash: hashFrenchInternalJson({ identityPrefix, role: "auditor" }),
    completedAt: "2026-07-13T10:03:00.000Z"
  });
  const proofA = buildFrenchInternalAgentProof({
    role: "proposerA",
    ...common,
    inputHash: hashFrenchInternalJson({ identityPrefix, role: "proposerA" }),
    executionReceiptHash: receiptA.receiptHash,
    agentId: receiptA.agentId,
    taskName: receiptA.taskName,
    response: proposalA,
    completedAt: "2026-07-13T10:00:00.000Z"
  });
  const proofB = buildFrenchInternalAgentProof({
    role: "proposerB",
    ...common,
    inputHash: hashFrenchInternalJson({ identityPrefix, role: "proposerB" }),
    executionReceiptHash: receiptB.receiptHash,
    agentId: receiptB.agentId,
    taskName: receiptB.taskName,
    response: proposalB,
    completedAt: "2026-07-13T10:01:00.000Z"
  });
  const proofArbiter = buildFrenchInternalAgentProof({
    role: "arbiter",
    ...common,
    inputHash: hashFrenchInternalJson({ identityPrefix, role: "arbiter" }),
    executionReceiptHash: receiptArbiter.receiptHash,
    agentId: receiptArbiter.agentId,
    taskName: receiptArbiter.taskName,
    dependencies: frenchInternalArbiterDependencies(proofA, proofB),
    response: frenchInternalArbiterResponsePayload(arbitration),
    completedAt: "2026-07-13T10:02:00.000Z"
  });
  const proofAuditor = buildFrenchInternalAgentProof({
    role: "auditor",
    ...common,
    inputHash: hashFrenchInternalJson({ identityPrefix, role: "auditor" }),
    executionReceiptHash: receiptAuditor.receiptHash,
    agentId: receiptAuditor.agentId,
    taskName: receiptAuditor.taskName,
    dependencies: frenchInternalAuditorDependencies({
      proposerA: proofA,
      proposerB: proofB,
      arbiter: proofArbiter,
      arbitration
    }),
    response: audit,
    completedAt: "2026-07-13T10:03:00.000Z"
  });
  const agentProofs: Record<
    "proposerA" | "proposerB" | "arbiter" | "auditor",
    FrenchInternalAgentProof
  > = {
    proposerA: proofA,
    proposerB: proofB,
    arbiter: proofArbiter,
    auditor: proofAuditor
  };
  return finalizeFrenchInternalReviewRecord({
    schemaVersion: FRENCH_INTERNAL_REVIEW_SCHEMA_VERSION,
    reviewMode: "internal_agents",
    policyVersion: FRENCH_INTERNAL_REVIEW_POLICY_VERSION,
    entryKey: packet.entryKey,
    packetHash: packet.packetHash,
    englishHash: packet.english.contentHash,
    generationConfigHash,
    configuration,
    status,
    proposalA,
    proposalB,
    validationA,
    validationB,
    arbiter: arbitration,
    auditor: audit,
    agentProofs,
    executionAttestation: finalizeFrenchInternalExecutionAttestation({
      schemaVersion: FRENCH_INTERNAL_EXECUTION_ATTESTATION_SCHEMA_VERSION,
      namespace: execution.namespace,
      releaseKey: packet.englishRelease.releaseKey,
      releaseSnapshotFingerprint:
        packet.englishRelease.releaseSnapshotFingerprint,
      selectionHash: execution.selectionHash,
      keyOrderHash: execution.keyOrderHash,
      proposerManifestHash: execution.proposerManifestHash,
      proposerSummaryHash: execution.proposerSummaryHash,
      arbiterManifestHash: execution.arbiterManifestHash,
      arbiterSummaryHash: execution.arbiterSummaryHash,
      auditorManifestHash: execution.auditorManifestHash,
      auditorSummaryHash: execution.auditorSummaryHash,
      executionReceiptsDigest: execution.executionReceiptsDigest,
      adjudicationSummaryHash: execution.adjudicationSummaryHash,
      roleReceipts: {
        proposerA: receiptA,
        proposerB: receiptB,
        arbiter: receiptArbiter,
        auditor: receiptAuditor
      }
    }),
    siblingConsistency: finalizeFrenchInternalSiblingConsistencyProof({
      schemaVersion: "lexicon-v3-french-sibling-consistency-proof@1",
      familyKey: `${packet.identity.language}:${packet.identity.eStrong.replace(/^([GH])(\d+).*$/u, (_match, prefix, digits) => `${prefix}${Number(digits)}`)}`,
      entryKey: packet.entryKey,
      memberEntryKeys: [packet.entryKey],
      familyInputDigest: hashFrenchInternalJson([packet.entryKey]),
      verdict: "consistent",
      issues: []
    }),
    carrierTerms: buildFrenchInternalCarrierTerms(
      proposalA,
      proposalB,
      proposalA,
      context
    ),
    issues: [],
    generatedAt: "2026-07-13T10:04:00.000Z"
  });
}

function finalizeExecutionCohort(
  records: readonly FrenchInternalReviewRecord[],
  execution: Omit<ReviewExecutionFixture, "executionReceiptsDigest">
): FrenchInternalReviewRecord[] {
  const executionReceiptsDigest = cohortExecutionReceiptsDigest(records);
  return records.map((record) => {
    const previous = record.executionAttestation!;
    const executionAttestation = finalizeFrenchInternalExecutionAttestation({
      schemaVersion: FRENCH_INTERNAL_EXECUTION_ATTESTATION_SCHEMA_VERSION,
      ...execution,
      executionReceiptsDigest,
      releaseKey: previous.releaseKey,
      releaseSnapshotFingerprint: previous.releaseSnapshotFingerprint,
      roleReceipts: previous.roleReceipts
    });
    const { artifactHash: _artifactHash, ...content } = record;
    void _artifactHash;
    return finalizeFrenchInternalReviewRecord({
      ...content,
      executionAttestation
    });
  });
}

function reviewReceipt(input: {
  role: "proposerA" | "proposerB" | "arbiter" | "auditor";
  packet: LexiconV3FrenchPacket;
  identityPrefix: string;
  execution: ReviewExecutionFixture;
  inputHash: string;
  completedAt: string;
}): FrenchInternalExecutionReceipt {
  const profile = FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE[input.role];
  const threadId = reviewThreadId(input.identityPrefix, input.role);
  const manifestHash =
    input.role === "proposerA" || input.role === "proposerB"
      ? input.execution.proposerManifestHash
      : input.role === "arbiter"
        ? input.execution.arbiterManifestHash
        : input.execution.auditorManifestHash;
  return finalizeFrenchInternalExecutionReceipt({
    schemaVersion: FRENCH_INTERNAL_EXECUTION_RECEIPT_SCHEMA_VERSION,
    role: input.role,
    entryKey: input.packet.entryKey,
    batchId: `batch-${input.role}`,
    namespace: input.execution.namespace,
    manifestHash,
    selectionHash: input.execution.selectionHash,
    inputHash: input.inputHash,
    artifactHash: hashFrenchInternalJson({
      identityPrefix: input.identityPrefix,
      role: input.role,
      artifact: true
    }),
    agentId: `codex-agent:${threadId}`,
    taskName: `/${input.identityPrefix}/${input.role}`,
    threadId,
    model: profile.model,
    reasoningEffort: profile.reasoningEffort,
    executorPolicyVersion:
      FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.executorPolicyVersion,
    executor: {
      path: "/sealed/codex",
      version: FRENCH_INTERNAL_PINNED_CODEX_VERSION,
      sha256: FRENCH_INTERNAL_PINNED_CODEX_SHA256
    },
    capabilities: {
      localTools: "disabled",
      networkDataTools: "disabled",
      shell: "disabled",
      eventPolicy: "agent-message-only",
      sealedWorkingDirectory: `/sealed/${input.identityPrefix}/${input.role}`,
      disabledFeaturesHash: "a".repeat(64),
      environmentPolicyHash: "b".repeat(64)
    },
    sourcePaths: {
      input: `/sealed/${input.identityPrefix}/${input.role}/input.jsonl`,
      runPointer: `/sealed/${input.identityPrefix}/${input.role}/run.json`
    },
    sourceHashes: {
      input: input.inputHash,
      runPointer: hashFrenchInternalJson({
        identityPrefix: input.identityPrefix,
        role: input.role,
        pointer: true
      })
    },
    resultPaths: {
      agentEvents: `/sealed/${input.identityPrefix}/${input.role}/events.jsonl`,
      structuredResponse: `/sealed/${input.identityPrefix}/${input.role}/response.json`
    },
    resultHashes: {
      agentEvents: hashFrenchInternalJson({
        identityPrefix: input.identityPrefix,
        role: input.role,
        events: true
      }),
      structuredResponse: hashFrenchInternalJson({
        identityPrefix: input.identityPrefix,
        role: input.role,
        response: true
      })
    },
    startedAt: "2026-07-13T09:59:00.000Z",
    completedAt: input.completedAt,
    runHash: hashFrenchInternalJson({
      identityPrefix: input.identityPrefix,
      role: input.role,
      run: true
    })
  });
}

function reviewThreadId(identityPrefix: string, role: string): string {
  const hex = hashFrenchInternalJson({ identityPrefix, role });
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function proposal(
  packet: LexiconV3FrenchPacket,
  model: string
): FrenchLexiconProposal {
  const original = packet.identity.original;
  return {
    schemaVersion: FRENCH_PROPOSAL_SCHEMA_VERSION,
    entryKey: packet.entryKey,
    derivedFromEnglishHash: packet.english.contentHash,
    model,
    glossFr: "parole",
    meaningSegmentsFr: [],
    entityMentionsFr: [],
    meaningFr: `Un ${original} signifie une parole.`,
    meaningHtmlFr: `<p>Un <b>${original}</b> signifie une parole.</p>`,
    notesFr: "",
    carrierTermsFr: ["parole"],
    confidence: 0.97
  };
}

function validationContext(
  packet: LexiconV3FrenchPacket
): FrenchValidationContext {
  return {
    entryKey: packet.entryKey,
    englishHash: packet.english.contentHash,
    englishStatus: packet.english.status,
    englishGloss: packet.english.gloss,
    englishMeaning: packet.english.meaning,
    original: packet.identity.original,
    sourceStrongCodes: packet.protectedContent.strongCodes,
    sourceReferences: packet.protectedContent.references,
    concordanceForms: packet.evidence.concordanceForms
  };
}

function frenchConfiguration(): FrenchInternalReviewConfiguration {
  return {
    promptVersion: FRENCH_INTERNAL_PROMPT_VERSION,
    proposerAPromptHash: hashFrenchInternalJson("prompt-a"),
    proposerBPromptHash: hashFrenchInternalJson("prompt-b"),
    arbiterPromptHash: hashFrenchInternalJson("prompt-arbiter"),
    auditorPromptHash: hashFrenchInternalJson("prompt-auditor"),
    styleGuideHash: hashFrenchInternalJson("style-guide"),
    termbaseHash: hashFrenchInternalJson("termbase"),
    canonicalNamesHash: hashFrenchInternalJson("canonical-names"),
    canonicalEntitiesHash: hashFrenchInternalJson("canonical-entities"),
    canonicalEntryPoliciesHash: hashFrenchInternalJson("canonical-policies"),
    entityMergeAttestationHash: hashFrenchInternalJson("entity-attestation"),
    entityGateHash: hashFrenchInternalJson("entity-gate"),
    entityMentionsHash: hashFrenchInternalJson("entity-mentions"),
    htmlRendererVersion: "lexicon-v3-french-html-renderer@3",
    approvedExecutionProfile: FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE
  };
}

function passingAuditChecks(): FrenchInternalAudit["checks"] {
  return {
    identityExact: "pass",
    semanticCoverage: "pass",
    noSemanticAddition: "pass",
    noSemanticOmission: "pass",
    polarityModalityUncertaintyPreserved: "pass",
    glossMorphologyConform: "pass",
    properNamesAndTermsConform: "pass",
    entityMentionsConform: "pass",
    protectedContentPreserved: "pass",
    htmlStructurePreserved: "pass",
    naturalFrench: "pass",
    siblingStepConsistency: "pass"
  };
}

function withoutPlanHash(
  plan: FrenchInternalRemediationPlan
): Omit<FrenchInternalRemediationPlan, "planHash"> {
  const { planHash: _planHash, ...content } = plan;
  void _planHash;
  return content;
}

function temporaryDirectory(t: TestContext): string {
  const directory = mkdtempSync(join(tmpdir(), "lexicon-v3-fr-remediation-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function writeJsonl(path: string, records: readonly unknown[]): void {
  writeFileSync(
    path,
    `${records.map((record) => JSON.stringify(record)).join("\n")}\n`,
    "utf8"
  );
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function fileHash(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function reviewSource(path: string, records: number, logicalDigest: string) {
  return { path, sha256: fileHash(path), records, logicalDigest };
}

function cohortExecutionReceiptsDigest(
  records: readonly FrenchInternalReviewRecord[]
): string {
  const roleOrder = ["proposerA", "proposerB", "arbiter", "auditor"] as const;
  return hashFrenchInternalJson(
    [...records]
      .sort((left, right) => left.entryKey.localeCompare(right.entryKey))
      .flatMap((record) =>
        roleOrder.map((role) => ({
          entryKey: record.entryKey,
          role,
          receiptHash:
            record.executionAttestation!.roleReceipts[role].receiptHash
        }))
      )
  );
}
