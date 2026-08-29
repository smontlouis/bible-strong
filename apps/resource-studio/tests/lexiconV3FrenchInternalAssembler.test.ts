import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";

import {
  assembleFrenchInternalReviewRecords,
  assembleLexiconV3FrenchInternalReview,
  assertFrenchInternalConfigurationMatchesManifest,
  finalizeFrenchInternalArbiterArtifact,
  finalizeFrenchInternalAuditorArtifact,
  finalizeFrenchInternalProposerArtifact,
  FRENCH_INTERNAL_ARBITER_ARTIFACT_SCHEMA_VERSION,
  FRENCH_INTERNAL_ASSEMBLY_CONFIG_SCHEMA_VERSION,
  FRENCH_INTERNAL_ASSEMBLY_SUMMARY_SCHEMA_VERSION,
  FRENCH_INTERNAL_AUDITOR_ARTIFACT_SCHEMA_VERSION,
  FRENCH_INTERNAL_PROPOSER_ARTIFACT_SCHEMA_VERSION,
  frenchInternalAssemblyGeneratedAt,
  frenchInternalRoleArtifactHash,
  resolveFrenchInternalAssemblyPairForReplay,
  type FrenchInternalArbiterArtifact,
  type FrenchInternalAssemblyConfigurationFile,
  type FrenchInternalAssemblySummary,
  type FrenchInternalAuditorArtifact,
  type FrenchInternalProposerArtifact,
  type FrenchInternalVerifiedExecution
} from "../scripts/assembleLexiconV3FrenchInternalReview.js";
import type { FrenchCodexManifestContext } from "../scripts/buildLexiconV3FrenchCodexBatches.js";
import { FRENCH_HTML_RENDERER_VERSION } from "../src/lexiconV3/frenchHtmlRenderer.js";
import {
  FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE,
  FRENCH_INTERNAL_EXECUTION_RECEIPT_SCHEMA_VERSION,
  FRENCH_INTERNAL_PINNED_CODEX_SHA256,
  FRENCH_INTERNAL_PINNED_CODEX_VERSION,
  FRENCH_INTERNAL_PROMPT_VERSION,
  FRENCH_INTERNAL_REVIEW_POLICY_VERSION,
  finalizeFrenchInternalExecutionReceipt,
  frenchInternalGenerationConfigHash,
  hashFrenchInternalJson,
  type FrenchInternalAuditChecks,
  type FrenchInternalReviewConfiguration
} from "../src/lexiconV3/frenchInternalReview.js";
import {
  buildFrenchPacket,
  type LexiconV3FrenchPacket
} from "../src/lexiconV3/frenchPackets.js";
import { frenchPacketFixtureEnglishRelease } from "./lexiconV3FrenchPacketFixture.js";
import { finalizeFrenchEntityMentionsArtifact } from "../src/lexiconV3/frenchEntityMentions.js";

test("assembles locally, never calls fetch, and reconstructs HTML from segments", (t) => {
  const fixture = writeAssemblyFixture(t);
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error("fetch-must-not-be-called");
  }) as typeof globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const packets = readJsonl<LexiconV3FrenchPacket>(fixture.options.packetsPath);
  const proposerA = readJsonl<FrenchInternalProposerArtifact>(
    fixture.options.proposerAPath
  );
  const proposerB = readJsonl<FrenchInternalProposerArtifact>(
    fixture.options.proposerBPath
  );
  const arbiters = readJsonl<FrenchInternalArbiterArtifact>(
    fixture.options.arbiterPath
  );
  const auditors = readJsonl<FrenchInternalAuditorArtifact>(
    fixture.options.auditorPath
  );
  const configuration = JSON.parse(
    readFileSync(fixture.options.configurationPath, "utf8")
  ) as FrenchInternalAssemblyConfigurationFile;
  const build = assembleFrenchInternalReviewRecords({
    packets,
    proposerA,
    proposerB,
    arbiters,
    auditors,
    configuration,
    entityMentions: emptyEntityMentions(),
    execution: syntheticVerifiedExecution({
      packet: packets[0]!,
      proposerA: proposerA[0]!,
      proposerB: proposerB[0]!,
      arbiter: arbiters[0]!,
      auditor: auditors[0]!
    }),
    generatedAt: fixture.options.generatedAt
  });

  assert.equal(fetchCalls, 0);
  assert.equal(build.records.length, 1);
  assert.equal(build.statusCounts.auto_validated, 1);
  const output = build.records;
  assert.equal(output.length, 1);
  assert.equal(output[0]?.status, "auto_validated");
  assert.equal(
    output[0]?.arbiter?.proposal.meaningHtmlFr,
    "<p>Un <b>λόγος</b> signifie une parole.</p>"
  );
  assert.equal(
    output[0]?.arbiter?.proposal.meaningFr,
    "Un λόγος signifie une parole."
  );
  const rawProposer = readFileSync(fixture.options.proposerAPath, "utf8");
  assert.equal(rawProposer.includes("meaningHtmlFr"), false);
  assert.equal(rawProposer.includes('meaningFr"'), false);
  assert.deepEqual(
    readdirSync(fixture.directory).filter((name) => name.includes(".tmp-")),
    []
  );
});

test("derives generatedAt deterministically from the latest sealed receipt", (t) => {
  const fixture = writeAssemblyFixture(t, "deterministic-time");
  const input = readAssemblyFixtureInput(fixture);

  const first = assembleFrenchInternalReviewRecords(input);
  const second = assembleFrenchInternalReviewRecords(input);

  assert.equal(first.generatedAt, "2026-07-13T10:03:00.000Z");
  assert.deepEqual(second, first);
  assert.equal(
    frenchInternalAssemblyGeneratedAt(input.execution),
    "2026-07-13T10:03:00.000Z"
  );
  assert.equal(
    frenchInternalAssemblyGeneratedAt(
      input.execution,
      "2026-07-13T10:04:00.000Z"
    ),
    "2026-07-13T10:04:00.000Z"
  );
  assert.throws(
    () =>
      frenchInternalAssemblyGeneratedAt(
        input.execution,
        "2026-07-13T10:04:00Z"
      ),
    /invalid-french-internal-generated-at/u
  );
});

test("restart reuses an exact assembled pair without changing its bytes", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "lexicon-v3-fr-restart-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const outputPath = join(directory, "review.jsonl");
  const summaryPath = join(directory, "review.summary.json");
  const outputText = `${JSON.stringify({
    entryKey: "greek:G3056",
    artifactHash: "a".repeat(64)
  })}\n`;
  const summary = assemblySummaryFixture(outputText);
  const summaryText = `${JSON.stringify(summary, null, 2)}\n`;
  writeFileSync(outputPath, outputText, "utf8");
  writeFileSync(summaryPath, summaryText, "utf8");

  const beforeOutput = readFileSync(outputPath, "utf8");
  const beforeSummary = readFileSync(summaryPath, "utf8");
  const replay = resolveFrenchInternalAssemblyPairForReplay({
    expectedOutputText: outputText,
    expectedSummary: summary,
    existingOutputText: beforeOutput,
    existingSummaryText: beforeSummary
  });

  assert.equal(replay.reused, true);
  assert.deepEqual(replay.summary, summary);
  assert.equal(readFileSync(outputPath, "utf8"), beforeOutput);
  assert.equal(readFileSync(summaryPath, "utf8"), beforeSummary);
  assert.throws(
    () =>
      resolveFrenchInternalAssemblyPairForReplay({
        expectedOutputText: outputText,
        expectedSummary: summary,
        existingOutputText: outputText
      }),
    /french-internal-existing-output-pair-incomplete/u
  );
  assert.throws(
    () =>
      resolveFrenchInternalAssemblyPairForReplay({
        expectedOutputText: outputText,
        expectedSummary: summary,
        existingOutputText: `${outputText} `,
        existingSummaryText: summaryText
      }),
    /french-internal-existing-output-pair-stale/u
  );

  const { summaryDigest: _summaryDigest, ...summaryContent } = summary;
  void _summaryDigest;
  const driftedContent = {
    ...summaryContent,
    generationConfigHash: "f".repeat(64)
  };
  const driftedSummary: FrenchInternalAssemblySummary = {
    ...driftedContent,
    summaryDigest: hashFrenchInternalJson(driftedContent)
  };
  assert.throws(
    () =>
      resolveFrenchInternalAssemblyPairForReplay({
        expectedOutputText: outputText,
        expectedSummary: summary,
        existingOutputText: outputText,
        existingSummaryText: `${JSON.stringify(driftedSummary, null, 2)}\n`
      }),
    /french-internal-existing-output-pair-stale/u
  );
});

test("rejects a tampered proposer artifact before assembling", (t) => {
  const fixture = writeAssemblyFixture(t);
  const proposer = readJsonl<FrenchInternalProposerArtifact>(
    fixture.options.proposerAPath
  )[0]!;
  writeJsonl(fixture.options.proposerAPath, [
    { ...proposer, glossFr: "altération" }
  ]);

  assert.throws(
    () => assembleLexiconV3FrenchInternalReview(fixture.options),
    /role-artifact-hash-mismatch/u
  );
});

test("rejects duplicate and missing role records fail-closed", (t) => {
  const duplicate = writeAssemblyFixture(t, "duplicate");
  const proposer = readJsonl<FrenchInternalProposerArtifact>(
    duplicate.options.proposerAPath
  )[0]!;
  writeJsonl(duplicate.options.proposerAPath, [proposer, proposer]);
  assert.throws(
    () => assembleLexiconV3FrenchInternalReview(duplicate.options),
    /duplicate-french-internal-entry/u
  );

  const missing = writeAssemblyFixture(t, "missing");
  const auditor = readJsonl<FrenchInternalAuditorArtifact>(
    missing.options.auditorPath
  )[0]!;
  const orphan = finalizeFrenchInternalAuditorArtifact({
    ...withoutArtifactHash(auditor),
    entryKey: "greek:G9999"
  });
  writeJsonl(missing.options.auditorPath, [orphan]);
  assert.throws(
    () => assembleFixtureCore(missing),
    /missing-french-internal-role:auditor:greek:G3056/u
  );
});

test("rejects stale packet lineage even when the role artifact is rehashed", (t) => {
  const fixture = writeAssemblyFixture(t);
  const arbiter = readJsonl<FrenchInternalArbiterArtifact>(
    fixture.options.arbiterPath
  )[0]!;
  const stale = finalizeFrenchInternalArbiterArtifact({
    ...withoutArtifactHash(arbiter),
    packetHash: "0".repeat(64)
  });
  writeJsonl(fixture.options.arbiterPath, [stale]);

  assert.throws(
    () => assembleFixtureCore(fixture),
    /role-packet-stale:greek:G3056:arbiter/u
  );
});

test("forbids raw HTML fields in proposer JSON even with a matching hash", (t) => {
  const fixture = writeAssemblyFixture(t);
  const proposer = readJsonl<FrenchInternalProposerArtifact>(
    fixture.options.proposerAPath
  )[0]!;
  const content = {
    ...withoutArtifactHash(proposer),
    meaningHtmlFr: "<script>interdit</script>"
  };
  const withRawHtml = {
    ...content,
    artifactHash: frenchInternalRoleArtifactHash(
      content as Omit<FrenchInternalProposerArtifact, "artifactHash">
    )
  };
  writeJsonl(fixture.options.proposerAPath, [withRawHtml]);

  assert.throws(
    () => assembleLexiconV3FrenchInternalReview(fixture.options),
    /invalid-french-internal-proposer-keys/u
  );
});

test("binds full execution configuration to the passed pilot gate", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "lexicon-v3-fr-gate-config-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, "configuration.json");
  const configuration = configurationFile();
  writeFileSync(path, `${JSON.stringify(configuration)}\n`, "utf8");
  const base = {
    namespace: "/fr-internal/full",
    expectedEntries: 1,
    selectionHash: "1".repeat(64),
    keyOrderHash: "2".repeat(64),
    selectedPackets: {},
    lineage: {
      releaseKey: "release",
      releaseSnapshotFingerprint: "3".repeat(64),
      sourceLogicalDigest: "4".repeat(64)
    }
  } as unknown as Omit<
    FrenchCodexManifestContext,
    "runKind" | "pilotQualityGate"
  >;
  const full = {
    ...base,
    runKind: "full",
    pilotQualityGate: {
      path: "/sealed/pilot-quality-gate.json",
      sha256: "5".repeat(64),
      bytes: 1,
      gateHash: "6".repeat(64),
      generationConfigHash: configuration.generationConfigHash
    }
  } satisfies FrenchCodexManifestContext;
  assert.doesNotThrow(() =>
    assertFrenchInternalConfigurationMatchesManifest(full, path)
  );
  assert.throws(
    () =>
      assertFrenchInternalConfigurationMatchesManifest(
        {
          ...full,
          pilotQualityGate: {
            ...full.pilotQualityGate!,
            generationConfigHash: "f".repeat(64)
          }
        },
        path
      ),
    /pilot-gate-configuration-mismatch/u
  );
  assert.doesNotThrow(() =>
    assertFrenchInternalConfigurationMatchesManifest(
      {
        ...base,
        runKind: "custom",
        namespace: "/fr-internal/custom/test",
        pilotQualityGate: null
      } as FrenchCodexManifestContext,
      path
    )
  );
});

interface AssemblyFixture {
  directory: string;
  options: Parameters<typeof assembleLexiconV3FrenchInternalReview>[0];
}

function writeAssemblyFixture(
  t: TestContext,
  suffix = "fixture"
): AssemblyFixture {
  const directory = mkdtempSync(
    join(tmpdir(), `lexicon-v3-fr-internal-${suffix}-`)
  );
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const packet = frenchPacket();
  const configuration = configurationFile();
  const common = {
    entryKey: packet.entryKey,
    packetHash: packet.packetHash,
    englishHash: packet.english.contentHash,
    generationConfigHash: configuration.generationConfigHash
  };
  const translatedSegments = [
    { id: "t0", text: "Un" },
    { id: "t1", text: "λόγος" },
    { id: "t2", text: "signifie une parole." }
  ];
  const proposerA = finalizeFrenchInternalProposerArtifact({
    schemaVersion: FRENCH_INTERNAL_PROPOSER_ARTIFACT_SCHEMA_VERSION,
    role: "proposerA",
    ...common,
    inputHash: "1".repeat(64),
    agentId: "codex-agent:00000000-0000-4000-8000-000000000001",
    taskName: "/root/fr/proposer-a",
    completedAt: "2026-07-13T10:00:00.000Z",
    glossFr: "parole",
    meaningSegmentsFr: translatedSegments,
    requiredEntityMentions: [],
    entityMentionsFr: [],
    notesFr: "",
    carrierTermsFr: ["parole"],
    confidence: 0.97
  });
  const proposerB = finalizeFrenchInternalProposerArtifact({
    schemaVersion: FRENCH_INTERNAL_PROPOSER_ARTIFACT_SCHEMA_VERSION,
    role: "proposerB",
    ...common,
    inputHash: "2".repeat(64),
    agentId: "codex-agent:00000000-0000-4000-8000-000000000002",
    taskName: "/root/fr/proposer-b",
    completedAt: "2026-07-13T10:01:00.000Z",
    glossFr: "parole",
    meaningSegmentsFr: translatedSegments,
    requiredEntityMentions: [],
    entityMentionsFr: [],
    notesFr: "",
    carrierTermsFr: ["parole"],
    confidence: 0.96
  });
  const arbiter = finalizeFrenchInternalArbiterArtifact({
    schemaVersion: FRENCH_INTERNAL_ARBITER_ARTIFACT_SCHEMA_VERSION,
    role: "arbiter",
    ...common,
    inputHash: "3".repeat(64),
    agentId: "codex-agent:00000000-0000-4000-8000-000000000003",
    taskName: "/root/fr/arbiter",
    completedAt: "2026-07-13T10:02:00.000Z",
    verdict: "accept",
    selectedProposal: "proposalA",
    reasons: []
  });
  const auditor = finalizeFrenchInternalAuditorArtifact({
    schemaVersion: FRENCH_INTERNAL_AUDITOR_ARTIFACT_SCHEMA_VERSION,
    role: "auditor",
    ...common,
    inputHash: "4".repeat(64),
    agentId: "codex-agent:00000000-0000-4000-8000-000000000004",
    taskName: "/root/fr/auditor",
    completedAt: "2026-07-13T10:03:00.000Z",
    verdict: "safe",
    reasons: [],
    confidence: 0.97,
    checks: passingChecks()
  });
  const options = {
    packetsPath: join(directory, "packets.jsonl"),
    proposerAPath: join(directory, "proposer-a.jsonl"),
    proposerBPath: join(directory, "proposer-b.jsonl"),
    arbiterPath: join(directory, "arbiter.jsonl"),
    auditorPath: join(directory, "auditor.jsonl"),
    configurationPath: join(directory, "configuration.json"),
    canonicalEntitiesPath: join(directory, "canonical-entities.jsonl"),
    canonicalEntryPoliciesPath: join(
      directory,
      "canonical-entry-policies.jsonl"
    ),
    entityMergeAttestationPath: join(
      directory,
      "entity-merge-attestation.json"
    ),
    entityGatePath: join(directory, "entity-gate.json"),
    entityMentionsPath: join(directory, "entity-mentions.json"),
    entityPacketsPath: join(directory, "entity-packets.jsonl"),
    executionReceiptsPath: join(directory, "execution-receipts.jsonl"),
    executionReceiptsSummaryPath: join(
      directory,
      "execution-receipts.summary.json"
    ),
    adjudicationSummaryPath: join(directory, "adjudication-summary.json"),
    outputPath: join(directory, "review.jsonl"),
    summaryPath: join(directory, "review.summary.json"),
    generatedAt: "2026-07-13T10:04:00.000Z"
  };
  writeJsonl(options.packetsPath, [packet]);
  writeJsonl(options.proposerAPath, [proposerA]);
  writeJsonl(options.proposerBPath, [proposerB]);
  writeJsonl(options.arbiterPath, [arbiter]);
  writeJsonl(options.auditorPath, [auditor]);
  writeFileSync(options.canonicalEntitiesPath, "{}\n", "utf8");
  writeFileSync(options.canonicalEntryPoliciesPath, "{}\n", "utf8");
  writeFileSync(options.entityMergeAttestationPath, "{}\n", "utf8");
  writeFileSync(options.entityGatePath, "{}\n", "utf8");
  writeFileSync(options.entityMentionsPath, "{}\n", "utf8");
  writeJsonl(options.entityPacketsPath, [packet]);
  writeFileSync(
    options.configurationPath,
    `${JSON.stringify(configuration, null, 2)}\n`,
    "utf8"
  );
  // These are deliberately invalid placeholders for tests that fail earlier
  // while parsing/tamper-checking a role artifact. The successful assembly
  // test supplies a verified execution in memory below.
  writeFileSync(options.executionReceiptsPath, "{}\n", "utf8");
  writeFileSync(options.executionReceiptsSummaryPath, "{}\n", "utf8");
  writeFileSync(options.adjudicationSummaryPath, "{}\n", "utf8");
  return { directory, options };
}

function frenchPacket(): LexiconV3FrenchPacket {
  return buildFrenchPacket(
    {
      entryKey: "greek:G3056",
      englishRelease: frenchPacketFixtureEnglishRelease({
        entryKey: "greek:G3056",
        gloss: "word",
        meaning: "A λόγος means a word.",
        meaningHtml: "<p>A <b>λόγος</b> means a word.</p>"
      }),
      identity: {
        stepEntryId: 3056,
        language: "greek",
        eStrong: "G3056",
        dStrong: "G3056",
        uStrong: "G3056",
        original: "λόγος",
        transliteration: "logos",
        morph: "N"
      },
      english: {
        contentHash: "e".repeat(64),
        status: "validated",
        gloss: "word",
        meaning: "A λόγος means a word.",
        meaningHtml: "<p>A <b>λόγος</b> means a word.</p>",
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
        originalTokens: ["λόγος"]
      }
    },
    "2026-07-13T09:00:00.000Z"
  );
}

function configurationFile(): FrenchInternalAssemblyConfigurationFile {
  const configuration: FrenchInternalReviewConfiguration = {
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
    htmlRendererVersion: FRENCH_HTML_RENDERER_VERSION,
    approvedExecutionProfile: FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE
  };
  return {
    schemaVersion: FRENCH_INTERNAL_ASSEMBLY_CONFIG_SCHEMA_VERSION,
    configuration,
    generationConfigHash: frenchInternalGenerationConfigHash(configuration)
  };
}

function syntheticVerifiedExecution(input: {
  packet: LexiconV3FrenchPacket;
  proposerA: FrenchInternalProposerArtifact;
  proposerB: FrenchInternalProposerArtifact;
  arbiter: FrenchInternalArbiterArtifact;
  auditor: FrenchInternalAuditorArtifact;
}): FrenchInternalVerifiedExecution {
  const manifestHashes = {
    proposerA: "5".repeat(64),
    proposerB: "5".repeat(64),
    arbiter: "6".repeat(64),
    auditor: "7".repeat(64)
  } as const;
  const artifacts = {
    proposerA: input.proposerA,
    proposerB: input.proposerB,
    arbiter: input.arbiter,
    auditor: input.auditor
  } as const;
  const receipts = Object.fromEntries(
    (Object.keys(artifacts) as Array<keyof typeof artifacts>).map((role) => {
      const artifact = artifacts[role];
      const profile = FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE[role];
      const threadId = artifact.agentId.slice("codex-agent:".length);
      return [
        role,
        finalizeFrenchInternalExecutionReceipt({
          schemaVersion: FRENCH_INTERNAL_EXECUTION_RECEIPT_SCHEMA_VERSION,
          role,
          entryKey: artifact.entryKey,
          batchId: `batch-${role}`,
          namespace: "/fr-internal/pilot",
          manifestHash: manifestHashes[role],
          selectionHash: "4".repeat(64),
          inputHash: artifact.inputHash,
          artifactHash: artifact.artifactHash,
          agentId: artifact.agentId,
          taskName: artifact.taskName,
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
            sealedWorkingDirectory: `/sealed/${role}`,
            disabledFeaturesHash: "8".repeat(64),
            environmentPolicyHash: "9".repeat(64)
          },
          sourcePaths: {
            input: `/sealed/${role}/input.jsonl`,
            runPointer: `/sealed/${role}/run.json`
          },
          sourceHashes: {
            input: artifact.inputHash,
            runPointer: hashFrenchInternalJson({ role, pointer: true })
          },
          resultPaths: {
            agentEvents: `/sealed/${role}/events.jsonl`,
            structuredResponse: `/sealed/${role}/response.json`
          },
          resultHashes: {
            agentEvents: hashFrenchInternalJson({ role, events: true }),
            structuredResponse: hashFrenchInternalJson({
              role,
              response: true
            })
          },
          startedAt: "2026-07-13T09:59:00.000Z",
          completedAt: artifact.completedAt,
          runHash: hashFrenchInternalJson({ role, threadId })
        })
      ];
    })
  ) as FrenchInternalVerifiedExecution["receiptsByEntry"] extends Map<
    string,
    infer T
  >
    ? T
    : never;
  return {
    namespace: "/fr-internal/pilot",
    releaseKey: input.packet.englishRelease.releaseKey,
    releaseSnapshotFingerprint:
      input.packet.englishRelease.releaseSnapshotFingerprint,
    selectionHash: "4".repeat(64),
    keyOrderHash: hashFrenchInternalJson([input.packet.entryKey]),
    proposerManifestHash: "5".repeat(64),
    proposerSummaryHash: "a".repeat(64),
    arbiterManifestHash: "6".repeat(64),
    arbiterSummaryHash: "b".repeat(64),
    auditorManifestHash: "7".repeat(64),
    auditorSummaryHash: "c".repeat(64),
    executionReceiptsDigest: hashFrenchInternalJson(
      Object.values(receipts).map((receipt) => receipt.receiptHash)
    ),
    adjudicationSummaryHash: "d".repeat(64),
    receiptsByEntry: new Map([[input.packet.entryKey, receipts]])
  };
}

function readAssemblyFixtureInput(
  fixture: AssemblyFixture
): Omit<
  Parameters<typeof assembleFrenchInternalReviewRecords>[0],
  "generatedAt"
> {
  const packets = readJsonl<LexiconV3FrenchPacket>(fixture.options.packetsPath);
  const proposerA = readJsonl<FrenchInternalProposerArtifact>(
    fixture.options.proposerAPath
  );
  const proposerB = readJsonl<FrenchInternalProposerArtifact>(
    fixture.options.proposerBPath
  );
  const arbiters = readJsonl<FrenchInternalArbiterArtifact>(
    fixture.options.arbiterPath
  );
  const auditors = readJsonl<FrenchInternalAuditorArtifact>(
    fixture.options.auditorPath
  );
  const configuration = JSON.parse(
    readFileSync(fixture.options.configurationPath, "utf8")
  ) as FrenchInternalAssemblyConfigurationFile;
  return {
    packets,
    proposerA,
    proposerB,
    arbiters,
    auditors,
    configuration,
    entityMentions: emptyEntityMentions(),
    execution: syntheticVerifiedExecution({
      packet: packets[0]!,
      proposerA: proposerA[0]!,
      proposerB: proposerB[0]!,
      arbiter: arbiters[0]!,
      auditor: auditors[0]!
    })
  };
}

function emptyEntityMentions() {
  return finalizeFrenchEntityMentionsArtifact({
    inputHashes: {
      stepEntries: "a".repeat(64),
      canonicalEntities: "b".repeat(64),
      canonicalPolicies: "c".repeat(64),
      englishMeanings: "d".repeat(64)
    },
    requiredEntityMentions: []
  });
}

function assembleFixtureCore(fixture: AssemblyFixture) {
  const input = readAssemblyFixtureInput(fixture);
  return assembleFrenchInternalReviewRecords({
    ...input,
    generatedAt: fixture.options.generatedAt
  });
}

function assemblySummaryFixture(
  outputText: string
): FrenchInternalAssemblySummary {
  const summaryContent: Omit<FrenchInternalAssemblySummary, "summaryDigest"> = {
    schemaVersion: FRENCH_INTERNAL_ASSEMBLY_SUMMARY_SCHEMA_VERSION,
    policyVersion: FRENCH_INTERNAL_REVIEW_POLICY_VERSION,
    // Deliberately later than the sealed receipts: this represents a valid
    // legacy wall-clock assembly that a restart must preserve.
    generatedAt: "2026-07-13T10:04:00.000Z",
    sourcePaths: {
      packets: "/sealed/packets.jsonl",
      proposerA: "/sealed/proposer-a.jsonl",
      proposerB: "/sealed/proposer-b.jsonl",
      arbiter: "/sealed/arbiter.jsonl",
      auditor: "/sealed/auditor.jsonl",
      configuration: "/sealed/configuration.json",
      canonicalEntities: "/sealed/canonical-entities.jsonl",
      canonicalEntryPolicies: "/sealed/canonical-entry-policies.jsonl",
      entityMergeAttestation: "/sealed/entity-merge-attestation.json",
      entityGate: "/sealed/entity-gate.json",
      entityMentions: "/sealed/entity-mentions.json",
      entityPackets: "/sealed/entity-packets.jsonl",
      executionReceipts: "/sealed/execution-receipts.jsonl",
      executionReceiptsSummary: "/sealed/execution-receipts.summary.json",
      adjudicationSummary: "/sealed/adjudication-summary.json",
      output: "/sealed/review.jsonl"
    },
    sourceDigests: {
      packets: "1".repeat(64),
      proposerA: "2".repeat(64),
      proposerB: "3".repeat(64),
      arbiter: "4".repeat(64),
      auditor: "5".repeat(64),
      configuration: "6".repeat(64),
      canonicalEntities: "a".repeat(64),
      canonicalEntryPolicies: "b".repeat(64),
      entityMergeAttestation: "f".repeat(64),
      entityGate: "c".repeat(64),
      entityMentions: "d".repeat(64),
      entityPackets: "e".repeat(64),
      executionReceipts: "7".repeat(64),
      executionReceiptsSummary: "8".repeat(64),
      adjudicationSummary: "9".repeat(64)
    },
    executionAttestation: {
      namespace: "/fr-internal/pilot",
      selectionHash: "a".repeat(64),
      executionReceiptsDigest: "b".repeat(64),
      adjudicationSummaryHash: "c".repeat(64)
    },
    generationConfigHash: "d".repeat(64),
    counts: {
      packets: 1,
      proposerA: 1,
      proposerB: 1,
      arbiters: 1,
      auditors: 1,
      outputRecords: 1,
      statuses: {
        auto_validated: 1,
        review_needed: 0,
        blocked_source_issue: 0,
        failed: 0
      }
    },
    recordsLogicalDigest: "e".repeat(64),
    outputDigest: createHash("sha256").update(outputText).digest("hex")
  };
  return {
    ...summaryContent,
    summaryDigest: hashFrenchInternalJson(summaryContent)
  };
}

function passingChecks(): FrenchInternalAuditChecks {
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

function writeJsonl(path: string, values: unknown[]): void {
  writeFileSync(
    path,
    `${values.map((value) => JSON.stringify(value)).join("\n")}\n`,
    "utf8"
  );
}

function readJsonl<T>(path: string): T[] {
  return readFileSync(path, "utf8")
    .split(/\r?\n/u)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as T);
}

function withoutArtifactHash<T extends { artifactHash: string }>(
  value: T
): Omit<T, "artifactHash"> {
  const { artifactHash: _artifactHash, ...content } = value;
  void _artifactHash;
  return content;
}
