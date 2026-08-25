import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";

import {
  assertFrenchModelCallBudget,
  buildFrenchRunSummary,
  callGateway,
  compactFrenchRunRecords,
  frenchGenerationConfigHash,
  processPacket,
  readAndValidateFrenchPackets,
  validateFrenchPacketBuildAttestation,
  verifyFrenchRunRecord,
  type FrenchRunRecord
} from "../scripts/generateLexiconV3French.js";
import {
  buildFrenchPacket,
  type LexiconV3FrenchPacket
} from "../src/lexiconV3/frenchPackets.js";
import { frenchPacketFixtureEnglishRelease } from "./lexiconV3FrenchPacketFixture.js";

test("compacts a failed French attempt into its successful resume result", () => {
  const failed = runRecord("greek:G0001", "old-packet", "failed");
  const success = runRecord("greek:G0001", "current-packet", "review_needed");
  const other = runRecord("greek:G0002", "other-packet", "auto_validated");

  const compacted = compactFrenchRunRecords([failed, other, success]);

  assert.deepEqual(
    compacted.map((record) => [
      record.entryKey,
      record.packetHash,
      record.status
    ]),
    [
      ["greek:G0001", "current-packet", "review_needed"],
      ["greek:G0002", "other-packet", "auto_validated"]
    ]
  );
});

test("requires an explicit model-call ceiling for a paid bulk run", () => {
  assert.doesNotThrow(() =>
    assertFrenchModelCallBudget({
      dryRun: true,
      plannedModelCalls: 64_611,
      maxModelCalls: null
    })
  );
  assert.doesNotThrow(() =>
    assertFrenchModelCallBudget({
      dryRun: false,
      plannedModelCalls: 300,
      maxModelCalls: null
    })
  );
  assert.throws(
    () =>
      assertFrenchModelCallBudget({
        dryRun: false,
        plannedModelCalls: 301,
        maxModelCalls: null
      }),
    /model-call-budget-approval-required/u
  );
  assert.throws(
    () =>
      assertFrenchModelCallBudget({
        dryRun: false,
        plannedModelCalls: 301,
        maxModelCalls: 300
      }),
    /model-call-budget-exceeded/u
  );
  assert.doesNotThrow(() =>
    assertFrenchModelCallBudget({
      dryRun: false,
      plannedModelCalls: 301,
      maxModelCalls: 301
    })
  );
});

test("binds resumable records to models, reasoning, prompts, and artifact content", async () => {
  const base = {
    modelA: "provider/model-a",
    modelB: "provider/model-b",
    arbiterModel: "provider/model-c",
    reasoningA: "low",
    reasoningB: "low",
    reasoningArbiter: "low"
  };
  assert.notEqual(
    frenchGenerationConfigHash(base),
    frenchGenerationConfigHash({ ...base, reasoningArbiter: "medium" })
  );
  const record = await processPacket(
    frenchPacket("greek:G0001", "review_needed", 1),
    { ...base, apiKey: "fixture", timeoutMs: 1_000 }
  );
  assert.doesNotThrow(() => verifyFrenchRunRecord(record));
  assert.throws(
    () =>
      verifyFrenchRunRecord({
        ...record,
        generationConfigHash: "0".repeat(64)
      }),
    /artifact-hash/u
  );
});

test("records the actual gateway model and provider instead of trusting the request alias", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        model: "actual-model",
        provider: "actual-provider",
        choices: [{ message: { content: "{}" } }],
        usage: { prompt_tokens: 1, completion_tokens: 1 }
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );

  const result = await callGateway({
    apiKey: "fixture",
    model: "requested-provider/requested-model",
    timeoutMs: 1_000,
    reasoningEffort: "low",
    system: "system",
    user: "user"
  });

  assert.equal(result.model, "actual-provider/actual-model");
  assert.deepEqual(result.proof, {
    requestedModel: "requested-provider/requested-model",
    actualModel: "actual-model",
    provider: "actual-provider",
    identity: "actual-provider/actual-model",
    verified: true
  });
});

test("does not duplicate a provider already present in the gateway model", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        model: "openai/gpt-5.4-mini",
        choices: [{ message: { content: "{}" } }]
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
          "x-ai-gateway-provider": "openai"
        }
      }
    );

  const result = await callGateway({
    apiKey: "fixture",
    model: "openai/gpt-5.4-mini",
    timeoutMs: 1_000,
    reasoningEffort: "low",
    system: "system",
    user: "user"
  });

  assert.equal(result.model, "openai/gpt-5.4-mini");
  assert.deepEqual(result.proof, {
    requestedModel: "openai/gpt-5.4-mini",
    actualModel: "openai/gpt-5.4-mini",
    provider: "openai",
    identity: "openai/gpt-5.4-mini",
    verified: true
  });
});

test("uses the provider-qualified model returned by the gateway as execution proof", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        model: "google/gemini-test",
        choices: [{ message: { content: "{}" } }]
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );

  const result = await callGateway({
    apiKey: "fixture",
    model: "gateway/alias",
    timeoutMs: 1_000,
    reasoningEffort: "low",
    system: "system",
    user: "user"
  });

  assert.equal(result.model, "google/gemini-test");
  assert.deepEqual(result.proof, {
    requestedModel: "gateway/alias",
    actualModel: "google/gemini-test",
    provider: "google",
    identity: "google/gemini-test",
    verified: true
  });
});

test("retries without unsupported response_format", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  const requestBodies: Array<Record<string, unknown>> = [];
  globalThis.fetch = async (_input, init) => {
    requestBodies.push(
      JSON.parse(String(init?.body)) as Record<string, unknown>
    );
    if (requestBodies.length === 1) {
      return new Response(
        JSON.stringify({
          error: {
            message: "Invalid input",
            param: "response_format"
          }
        }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({
        model: "openai/model-test",
        choices: [{ message: { content: "{}" } }]
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  };

  const result = await callGateway({
    apiKey: "fixture",
    model: "openai/model-test",
    timeoutMs: 1_000,
    reasoningEffort: "low",
    system: "system",
    user: "user"
  });

  assert.equal(requestBodies.length, 2);
  assert.ok("response_format" in requestBodies[0]!);
  assert.equal("response_format" in requestBodies[1]!, false);
  assert.equal(result.proof.verified, true);
});

test("preflights every packet hash, schema, and duplicate before returning input", (t) => {
  const directory = temporaryDirectory(t);
  const input = join(directory, "packets.jsonl");
  const first = frenchPacket("greek:G0001", "validated", 1);
  const duplicate = frenchPacket("greek:G0001", "human_validated", 2);
  const invalid = {
    ...frenchPacket("greek:G0003", "validated", 3),
    packetHash: "0".repeat(64)
  };
  writeFileSync(
    input,
    `${[first, duplicate, invalid].map((value) => JSON.stringify(value)).join("\n")}\n`,
    "utf8"
  );

  assert.throws(
    () => readAndValidateFrenchPackets(input),
    (error: unknown) => {
      assert.match(String(error), /duplicate-entry-key:2:greek:G0001/u);
      assert.match(String(error), /packet-hash-mismatch/u);
      return true;
    }
  );
});

test("attests packet path, digest, and count while accepting optional build fields", (t) => {
  const directory = temporaryDirectory(t);
  const input = join(directory, "packets.jsonl");
  const summaryPath = join(directory, "packets.summary.json");
  const packet = frenchPacket("greek:G0001", "validated", 1);
  writeFileSync(input, `${JSON.stringify(packet)}\n`, "utf8");
  const inputAttestation = readAndValidateFrenchPackets(input);
  const summary = {
    schemaVersion: "lexicon-v3-french-packet-build@1",
    outputPackets: 1,
    outputDigest: inputAttestation.inputDigest,
    sourcePaths: {
      output: input,
      authoring: join(directory, "authoring.sqlite")
    },
    sourceDigests: {
      englishAuthoring: "a".repeat(64)
    },
    englishLineageFingerprint: "b".repeat(64)
  };
  writeFileSync(summaryPath, `${JSON.stringify(summary)}\n`, "utf8");

  const attestation = validateFrenchPacketBuildAttestation({
    summaryPath,
    inputPath: input,
    inputDigest: inputAttestation.inputDigest,
    inputPackets: inputAttestation.packets.length
  });
  assert.equal(attestation.path, summaryPath);
  assert.match(attestation.digest, /^[a-f0-9]{64}$/u);
  assert.throws(
    () =>
      validateFrenchPacketBuildAttestation({
        summaryPath,
        inputPath: input,
        inputDigest: inputAttestation.inputDigest,
        inputPackets: inputAttestation.packets.length,
        requireReviewedAuthoring: true
      }),
    /requires-reviewed-authoring/u
  );
  writeFileSync(
    summaryPath,
    `${JSON.stringify({
      ...summary,
      schemaVersion: "lexicon-v3-french-packet-build@2",
      englishAuthoring: { snapshotFingerprint: "c".repeat(64) }
    })}\n`,
    "utf8"
  );
  assert.doesNotThrow(() =>
    validateFrenchPacketBuildAttestation({
      summaryPath,
      inputPath: input,
      inputDigest: inputAttestation.inputDigest,
      inputPackets: inputAttestation.packets.length,
      requireReviewedAuthoring: true
    })
  );

  const mismatches: Array<[Record<string, unknown>, RegExp]> = [
    [{ ...summary, outputDigest: "0".repeat(64) }, /digest-mismatch/u],
    [{ ...summary, outputPackets: 2 }, /count-mismatch/u],
    [
      {
        ...summary,
        sourcePaths: { ...summary.sourcePaths, output: "/tmp/other" }
      },
      /path-mismatch/u
    ]
  ];
  for (const [mismatch, expected] of mismatches) {
    writeFileSync(summaryPath, `${JSON.stringify(mismatch)}\n`, "utf8");
    assert.throws(
      () =>
        validateFrenchPacketBuildAttestation({
          summaryPath,
          inputPath: input,
          inputDigest: inputAttestation.inputDigest,
          inputPackets: inputAttestation.packets.length
        }),
      expected
    );
  }
});

test("never calls a model for English review-needed or source-issue packets", async () => {
  let gatewayCalls = 0;
  const gateway = async (): Promise<never> => {
    gatewayCalls += 1;
    throw new Error("gateway-must-not-be-called");
  };
  const options = {
    apiKey: "fixture",
    modelA: "provider/model-a",
    modelB: "provider/model-b",
    arbiterModel: "provider/model-c",
    timeoutMs: 1_000,
    reasoningA: "low",
    reasoningB: "low",
    reasoningArbiter: "low",
    gateway
  };

  const reviewNeeded = await processPacket(
    frenchPacket("greek:G0001", "review_needed", 1),
    options
  );
  const sourceIssue = await processPacket(
    frenchPacket("hebrew:H0001", "source_issue", 2),
    options
  );

  assert.equal(gatewayCalls, 0);
  assert.equal(reviewNeeded.status, "review_needed");
  assert.deepEqual(reviewNeeded.issues, ["blocked-by-english-review-needed"]);
  assert.equal(sourceIssue.status, "blocked_source_issue");
  assert.deepEqual(sourceIssue.issues, ["blocked-by-english-source"]);
  assert.equal(reviewNeeded.usage.proposerA.inputTokens, 0);
  assert.equal(sourceIssue.usage.arbiter.outputTokens, 0);
});

test("writes the attested v3 summary with generation config and coverage", async () => {
  const validated = frenchPacket("greek:G0001", "validated", 1);
  const reviewPacket = frenchPacket("greek:G0002", "review_needed", 2);
  const reviewRecord = await processPacket(reviewPacket, {
    apiKey: "fixture",
    modelA: "provider/model-a",
    modelB: "provider/model-b",
    arbiterModel: "provider/model-c",
    timeoutMs: 1_000,
    reasoningA: "low",
    reasoningB: "low",
    reasoningArbiter: "low"
  });
  const summary = buildFrenchRunSummary({
    inputPath: "/tmp/packets.jsonl",
    inputDigest: "1".repeat(64),
    packetSummary: {
      path: "/tmp/packets.summary.json",
      digest: "2".repeat(64)
    },
    outputPath: "/tmp/review.jsonl",
    outputDigest: "3".repeat(64),
    inputPackets: [validated, reviewPacket],
    selectedPackets: [validated, reviewPacket],
    planned: [validated, reviewPacket],
    records: [reviewRecord],
    dryRun: false,
    modelA: "provider/model-a",
    modelB: "provider/model-b",
    arbiterModel: "provider/model-c",
    args: {
      only: "G0001,G0002",
      offset: "0",
      limit: "2",
      reasoningA: "low",
      reasoningB: "low",
      reasoningArbiter: "low"
    }
  });

  assert.equal(summary.schemaVersion, "lexicon-v3-french-run-summary@3");
  assert.equal(summary.inputDigest, "1".repeat(64));
  assert.equal(summary.outputDigest, "3".repeat(64));
  assert.equal(summary.plannedModelCalls, 3);
  assert.deepEqual(summary.selection, {
    only: ["G0001", "G0002"],
    offset: 0,
    limit: 2,
    inputPackets: 2,
    selectedPackets: 2
  });
  assert.equal(summary.coverage.eligibleForModels, 1);
  assert.equal(summary.coverage.blockedByEnglishReview, 1);
  assert.equal(summary.coverage.successfulRecordsForSelection, 1);
  assert.equal(summary.statusCounts.selectedEnglish.validated, 1);
  assert.equal(summary.statusCounts.selectedEnglish.review_needed, 1);
  assert.equal(summary.statusCounts.outputRecords.review_needed, 1);
  assert.equal(summary.generation.promptVersion, "lexicon-v3-french-prompts@3");
  assert.match(summary.generation.configHash, /^[a-f0-9]{64}$/u);

  const dryRunSummary = buildFrenchRunSummary({
    ...frenchSummaryOptions([validated]),
    outputDigest: "4".repeat(64),
    dryRun: true
  });
  assert.equal(dryRunSummary.outputDigest, null);
});

function temporaryDirectory(t: TestContext): string {
  const directory = mkdtempSync(join(tmpdir(), "lexicon-v3-fr-run-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function frenchPacket(
  entryKey: string,
  status: LexiconV3FrenchPacket["english"]["status"],
  stepEntryId: number
): LexiconV3FrenchPacket {
  const language = entryKey.startsWith("hebrew:") ? "hebrew" : "greek";
  const strong =
    entryKey.split(":")[1] ?? (language === "hebrew" ? "H0001" : "G0001");
  return buildFrenchPacket(
    {
      entryKey,
      englishRelease: frenchPacketFixtureEnglishRelease({
        entryKey,
        gloss: "word",
        meaning: "A fixture lexical meaning.",
        meaningHtml: "<p>A fixture lexical meaning.</p>",
        glossFieldVersionId: stepEntryId * 2 - 1,
        meaningFieldVersionId: stepEntryId * 2,
        state:
          status === "human_validated" ? "human_validated" : "auto_validated"
      }),
      identity: {
        stepEntryId,
        language,
        eStrong: strong,
        dStrong: strong,
        uStrong: strong,
        original: language === "hebrew" ? "אָב" : "λόγος",
        transliteration: language === "hebrew" ? "av" : "logos",
        morph: "N"
      },
      english: {
        contentHash: stepEntryId.toString(16).padStart(64, "0"),
        status,
        gloss: "word",
        meaning: "A fixture lexical meaning.",
        meaningHtml: "<p>A fixture lexical meaning.</p>",
        sources: ["fixture"],
        issues: []
      },
      evidence: {
        occurrenceGlosses: [],
        concordanceForms: [],
        legacy: null,
        existingFrench: null,
        resourceFrench: []
      },
      protectedContent: {
        strongCodes: [strong],
        references: [],
        originalTokens: []
      }
    },
    "2026-07-12T00:00:00.000Z"
  );
}

function frenchSummaryOptions(
  packets: LexiconV3FrenchPacket[]
): Parameters<typeof buildFrenchRunSummary>[0] {
  return {
    inputPath: "/tmp/packets.jsonl",
    inputDigest: "1".repeat(64),
    packetSummary: null,
    outputPath: "/tmp/review.jsonl",
    outputDigest: null,
    inputPackets: packets,
    selectedPackets: packets,
    planned: packets,
    records: [],
    dryRun: true,
    modelA: "provider/model-a",
    modelB: "provider/model-b",
    arbiterModel: "provider/model-c",
    args: {}
  };
}

function runRecord(
  entryKey: string,
  packetHash: string,
  status: FrenchRunRecord["status"]
): FrenchRunRecord {
  const usage = { inputTokens: 0, outputTokens: 0 };
  return {
    schemaVersion: "lexicon-v3-french-review@2",
    entryKey,
    packetHash,
    englishHash: "english-hash",
    generationConfigHash: frenchGenerationConfigHash({
      modelA: "provider/model-a",
      modelB: "provider/model-b",
      arbiterModel: "provider/model-c",
      reasoningA: "low",
      reasoningB: "low",
      reasoningArbiter: "low"
    }),
    status,
    models: { proposerA: "a", proposerB: "b", arbiter: "c" },
    carrierTerms: [],
    issues: [],
    usage: { proposerA: usage, proposerB: usage, arbiter: usage },
    artifactHash: "a".repeat(64),
    generatedAt: "2026-07-12T00:00:00.000Z"
  };
}
