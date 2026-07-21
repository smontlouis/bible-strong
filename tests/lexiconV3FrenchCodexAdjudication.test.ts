import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";

import {
  finalizeFrenchInternalProposerArtifact,
  FRENCH_INTERNAL_ASSEMBLY_CONFIG_SCHEMA_VERSION,
  FRENCH_INTERNAL_PROPOSER_ARTIFACT_SCHEMA_VERSION,
  type FrenchInternalAssemblyConfigurationFile,
  type FrenchInternalProposerArtifact
} from "../scripts/assembleLexiconV3FrenchInternalReview.js";
import {
  assertFrenchCodexAdjudicationBatchManifest,
  buildLexiconV3FrenchCodexAdjudicationBatches,
  frenchCodexAdjudicationOutputSchema
} from "../scripts/buildLexiconV3FrenchCodexAdjudicationBatches.js";
import {
  buildLexiconV3FrenchInternalArbiterWork,
  buildLexiconV3FrenchInternalAuditorWork,
  finalizeLexiconV3FrenchInternalArbiterDrafts,
  FRENCH_INTERNAL_REQUIRED_AUDIT_CHECKS,
  type FrenchInternalArbiterView,
  type FrenchInternalAuditorView
} from "../scripts/lexiconV3FrenchInternalAdjudication.js";
import {
  assertFrenchCodexAdjudicationAgentSeparation,
  buildSealedCodexEnvironment,
  buildFrenchCodexAdjudicationPrompt,
  frenchCodexAdjudicationExecArgs,
  parseFrenchCodexAdjudicationResponse,
  parseFrenchCodexThreadEvents,
  resolveFrenchCodexAdjudicationSummaryForReplay,
  selectFrenchCodexAdjudicationBatches
} from "../scripts/runLexiconV3FrenchCodexPilotAdjudication.js";
import {
  FRENCH_INTERNAL_ARBITER_DRAFT_SCHEMA_VERSION,
  FRENCH_INTERNAL_AUDITOR_DRAFT_SCHEMA_VERSION
} from "../src/lexiconV3/frenchAgentDrafts.js";
import {
  buildFrenchHtmlTemplate,
  FRENCH_HTML_RENDERER_VERSION,
  type FrenchHtmlSegmentTranslation
} from "../src/lexiconV3/frenchHtmlRenderer.js";
import {
  FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE,
  FRENCH_INTERNAL_PROMPT_VERSION,
  frenchInternalGenerationConfigHash,
  hashFrenchInternalJson,
  type FrenchInternalAuditChecks,
  type FrenchInternalReviewConfiguration
} from "../src/lexiconV3/frenchInternalReview.js";
import { frenchInternalPromptHash } from "../src/lexiconV3/frenchAgentPrompts.js";
import {
  buildFrenchPacket,
  type LexiconV3FrenchPacket
} from "../src/lexiconV3/frenchPackets.js";
import { frenchPacketFixtureEnglishRelease } from "./lexiconV3FrenchPacketFixture.js";

test("restarting after adjudication preserves a verified legacy summary byte-for-byte", () => {
  const stable = {
    schemaVersion: "lexicon-v3-french-codex-pilot-adjudication-summary@2",
    namespace: "/fr-internal/pilot",
    phase: "all",
    expectedEntries: 300,
    outputs: { executionReceipts: { summaryHash: "a".repeat(64) } }
  };
  const legacyContent = {
    ...stable,
    generatedAt: "2026-07-13T12:34:56.000Z"
  };
  const legacy = {
    ...legacyContent,
    summaryHash: hashFrenchInternalJson(legacyContent)
  };
  const legacyText = `${JSON.stringify(legacy, null, 2)}\n`;
  const deterministicContent = {
    ...stable,
    generatedAt: "2026-07-13T11:00:00.000Z"
  };
  const deterministic = {
    ...deterministicContent,
    summaryHash: hashFrenchInternalJson(deterministicContent)
  };
  const before = createHash("sha256").update(legacyText).digest("hex");

  const replay = resolveFrenchCodexAdjudicationSummaryForReplay(
    deterministic,
    legacyText
  );

  assert.equal(replay.reused, true);
  assert.deepEqual(replay.summary, legacy);
  assert.equal(
    createHash("sha256")
      .update(`${JSON.stringify(replay.summary, null, 2)}\n`)
      .digest("hex"),
    before
  );

  const tamperedContent = {
    ...legacyContent,
    expectedEntries: 299
  };
  const tampered = {
    ...tamperedContent,
    summaryHash: hashFrenchInternalJson(tamperedContent)
  };
  assert.throws(
    () =>
      resolveFrenchCodexAdjudicationSummaryForReplay(
        deterministic,
        `${JSON.stringify(tampered, null, 2)}\n`
      ),
    /existing-summary-stale/u
  );
});

test("builds sealed, hashed arbiter and auditor batches without calling a model", async (t) => {
  const fixture = await writeFixture(t, 2);
  const arbiterManifest = buildLexiconV3FrenchCodexAdjudicationBatches({
    role: "arbiter",
    viewsPath: fixture.arbiterViews,
    viewSummaryPath: fixture.arbiterViewSummary,
    packetsPath: fixture.packets,
    proposerAPath: fixture.proposerA,
    proposerBPath: fixture.proposerB,
    configurationPath: fixture.configuration,
    outputDir: fixture.arbiterBatchDir,
    maxItems: 1,
    maxInputBytes: 500_000
  });
  assertFrenchCodexAdjudicationBatchManifest(arbiterManifest);
  assert.equal(arbiterManifest.namespace, "/fr-internal/pilot");
  assert.equal(arbiterManifest.counts.entries, 2);
  assert.equal(arbiterManifest.counts.batches, 2);
  assert.deepEqual(
    selectFrenchCodexAdjudicationBatches(arbiterManifest.batches, {
      batchRange: { start: 1, end: 2 },
      aggregateOnly: false
    }).map((batch) => batch.batchId),
    ["arbiter-002"]
  );
  assert.throws(
    () =>
      selectFrenchCodexAdjudicationBatches(arbiterManifest.batches, {
        batchRange: { start: 0, end: 1 },
        aggregateOnly: true
      }),
    /aggregate-only-requires-full-coverage/u
  );
  const { manifestHash: _pilotHash, ...fullContent } = arbiterManifest;
  void _pilotHash;
  const fullManifest = {
    ...fullContent,
    namespace: "/fr-internal/full",
    manifestHash: ""
  };
  fullManifest.manifestHash = hashFrenchInternalJson({
    ...fullContent,
    namespace: "/fr-internal/full"
  });
  assert.doesNotThrow(() =>
    assertFrenchCodexAdjudicationBatchManifest(fullManifest)
  );
  const invalidNamespace = {
    ...fullContent,
    namespace: "/fr-internal/other",
    manifestHash: hashFrenchInternalJson({
      ...fullContent,
      namespace: "/fr-internal/other"
    })
  };
  assert.throws(
    () => assertFrenchCodexAdjudicationBatchManifest(invalidNamespace),
    /manifest-invalid/u
  );
  const first = arbiterManifest.batches[0]!;
  assert.equal(first.keys.length, 1);
  assert.equal(first.viewHashes.length, 1);
  assert.equal(first.input.sha256, sha256File(first.input.path));
  assert.equal(
    readJsonl(first.context.proposerA.path)[0]!.entryKey,
    first.keys[0]
  );
  const schema = JSON.parse(
    readFileSync(first.outputSchema.path, "utf8")
  ) as Record<string, unknown>;
  assert.equal(schema.additionalProperties, false);
  assert.match(JSON.stringify(schema), /proposalA/u);
  assert.doesNotMatch(JSON.stringify(schema), /glossFr/u);

  const prompt = buildFrenchCodexAdjudicationPrompt(
    "arbiter",
    first,
    readFileSync(first.input.path, "utf8")
  );
  assert.match(prompt, /Aucun outil, réseau, web, plugin/u);
  assert.match(prompt, new RegExp(first.viewHashes[0]!));
  assert.match(prompt, /interdit de fusionner/u);
  assert.throws(
    () =>
      buildLexiconV3FrenchCodexAdjudicationBatches({
        role: "arbiter",
        viewsPath: fixture.arbiterViews,
        viewSummaryPath: fixture.arbiterViewSummary,
        packetsPath: fixture.packets,
        proposerAPath: fixture.proposerA,
        proposerBPath: fixture.proposerB,
        configurationPath: fixture.configuration,
        outputDir: fixture.arbiterBatchDir,
        maxItems: 1,
        maxInputBytes: 500_000
      }),
    /output-exists/u
  );

  const views = new Map(
    readJsonl<FrenchInternalArbiterView>(first.input.path).map((view) => [
      view.entryKey,
      view
    ])
  );
  const draft = arbiterDraft(views.get(first.keys[0]!)!, "proposalB");
  assert.deepEqual(
    parseFrenchCodexAdjudicationResponse(
      JSON.stringify({ drafts: [draft] }),
      "arbiter",
      first,
      views
    ),
    [draft]
  );
  assert.throws(
    () =>
      parseFrenchCodexAdjudicationResponse(
        JSON.stringify({
          drafts: [{ ...draft, selectedProposal: "proposalC" }]
        }),
        "arbiter",
        first,
        views
      ),
    /invalid-french-arbiter-selection/u
  );

  const auditorManifest = buildLexiconV3FrenchCodexAdjudicationBatches({
    role: "auditor",
    viewsPath: fixture.auditorViews,
    viewSummaryPath: fixture.auditorViewSummary,
    packetsPath: fixture.packets,
    proposerAPath: fixture.proposerA,
    proposerBPath: fixture.proposerB,
    configurationPath: fixture.configuration,
    arbiterViewsPath: fixture.arbiterViews,
    arbiterPath: fixture.arbiters,
    arbiterSummaryPath: fixture.arbiterSummary,
    outputDir: fixture.auditorBatchDir,
    maxItems: 2,
    maxInputBytes: 500_000
  });
  assertFrenchCodexAdjudicationBatchManifest(auditorManifest);
  assert.equal(auditorManifest.counts.entries, 2);
  const auditorBatch = auditorManifest.batches[0]!;
  const auditorSchema = JSON.stringify(
    frenchCodexAdjudicationOutputSchema("auditor", 2)
  );
  for (const check of FRENCH_INTERNAL_REQUIRED_AUDIT_CHECKS) {
    assert.match(auditorSchema, new RegExp(check));
  }
  assert.equal(
    Object.keys(
      (
        JSON.parse(auditorSchema) as {
          properties: {
            drafts: {
              items: { properties: { checks: { properties: object } } };
            };
          };
        }
      ).properties.drafts.items.properties.checks.properties
    ).length,
    12
  );
  const auditorViews = new Map(
    readJsonl<FrenchInternalAuditorView>(auditorBatch.input.path).map(
      (view) => [view.entryKey, view]
    )
  );
  const auditorDrafts = auditorBatch.keys.map((key) =>
    auditorDraft(auditorViews.get(key)!)
  );
  assert.equal(
    parseFrenchCodexAdjudicationResponse(
      JSON.stringify({ drafts: auditorDrafts }),
      "auditor",
      auditorBatch,
      auditorViews
    ).length,
    2
  );
});

test("Codex invocation is read-only, tool-less, and binds the real thread event", () => {
  const args = frenchCodexAdjudicationExecArgs({
    model: "gpt-5.6-terra",
    reasoningEffort: "medium",
    schemaPath: "/tmp/schema.json",
    responsePath: "/tmp/response.json",
    cwd: "/tmp"
  });
  assert.ok(args.includes("read-only"));
  assert.ok(args.includes("--skip-git-repo-check"));
  const environment = buildSealedCodexEnvironment("/tmp/codex-home-test");
  assert.equal(environment.CODEX_HOME, "/tmp/codex-home-test");
  assert.equal(environment.AI_GATEWAY_URL, undefined);
  assert.equal(environment.OPENAI_API_KEY, undefined);
  for (const feature of [
    "plugins",
    "apps",
    "browser_use",
    "browser_use_external",
    "standalone_web_search",
    "code_mode",
    "code_mode_host",
    "hooks",
    "shell_snapshot",
    "shell_tool",
    "unified_exec",
    "workspace_dependencies",
    "multi_agent"
  ]) {
    const index = args.indexOf(feature);
    assert.ok(index > 0, `missing disabled feature ${feature}`);
    assert.equal(args[index - 1], "--disable");
  }
  const response = '{"drafts":[]}';
  const parsed = parseFrenchCodexThreadEvents(
    `${JSON.stringify({ type: "thread.started", thread_id: "019f5c92-5505-71e3-9bd9-89c2b1b417bf" })}\n${JSON.stringify(
      { type: "turn.started" }
    )}\n${JSON.stringify({
      type: "item.completed",
      item: { type: "agent_message", text: response }
    })}\n${JSON.stringify({
      type: "turn.completed",
      usage: { input_tokens: 7, output_tokens: 3 }
    })}\n`,
    response
  );
  assert.equal(parsed.threadId, "019f5c92-5505-71e3-9bd9-89c2b1b417bf");
  assert.equal(parsed.usage?.input_tokens, 7);
  assert.throws(
    () => parseFrenchCodexThreadEvents("{not-json}\n"),
    /event-invalid-json/u
  );
  assert.throws(
    () =>
      parseFrenchCodexThreadEvents(
        `${JSON.stringify({ type: "thread.started", thread_id: "019f5c92-5505-71e3-9bd9-89c2b1b417bf" })}\n${JSON.stringify(
          {
            type: "thread.started",
            thread_id: "019f5c92-6844-7ed1-98e2-c427e288d477"
          }
        )}\n`
      ),
    /thread-event-invalid/u
  );
  assert.throws(
    () =>
      parseFrenchCodexThreadEvents(
        `${JSON.stringify({ type: "thread.started", thread_id: "019f5c92-5505-71e3-9bd9-89c2b1b417bf" })}\n${JSON.stringify(
          { type: "turn.started" }
        )}\n${JSON.stringify({
          type: "item.completed",
          item: { type: "command_execution", text: "forbidden" }
        })}\n`
      ),
    /item-event-forbidden/u
  );
});

test("agent separation rejects collisions with either proposer or the arbiter", async (t) => {
  const fixture = await writeFixture(t, 1);
  const manifest = buildLexiconV3FrenchCodexAdjudicationBatches({
    role: "auditor",
    viewsPath: fixture.auditorViews,
    viewSummaryPath: fixture.auditorViewSummary,
    packetsPath: fixture.packets,
    proposerAPath: fixture.proposerA,
    proposerBPath: fixture.proposerB,
    configurationPath: fixture.configuration,
    arbiterViewsPath: fixture.arbiterViews,
    arbiterPath: fixture.arbiters,
    arbiterSummaryPath: fixture.arbiterSummary,
    outputDir: fixture.auditorBatchDir,
    maxItems: 1,
    maxInputBytes: 500_000
  });
  const batch = manifest.batches[0]!;
  assert.doesNotThrow(() =>
    assertFrenchCodexAdjudicationAgentSeparation(
      batch,
      "codex-agent:auditor-distinct"
    )
  );
  assert.throws(
    () =>
      assertFrenchCodexAdjudicationAgentSeparation(
        batch,
        "codex-agent:proposerA"
      ),
    /agent-collision/u
  );
  assert.throws(
    () =>
      assertFrenchCodexAdjudicationAgentSeparation(
        batch,
        "codex-agent:arbiter-test"
      ),
    /agent-collision/u
  );
});

async function writeFixture(t: TestContext, count: number) {
  const directory = mkdtempSync(
    join(tmpdir(), "lexicon-v3-fr-codex-adjudication-")
  );
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const packets = Array.from({ length: count }, (_, index) =>
    packet(index + 3056)
  );
  const configuration = configurationFile();
  const proposerA = packets.map((value, index) =>
    proposer(value, "proposerA", index, configuration.generationConfigHash)
  );
  const proposerB = packets.map((value, index) =>
    proposer(value, "proposerB", index, configuration.generationConfigHash)
  );
  const paths = {
    packets: join(directory, "packets.jsonl"),
    proposerA: join(directory, "proposer-a.jsonl"),
    proposerB: join(directory, "proposer-b.jsonl"),
    configuration: join(directory, "configuration.json"),
    selection: join(directory, "pilot-keys.json"),
    arbiterViews: join(directory, "arbiter-input.jsonl"),
    arbiterViewSummary: join(directory, "arbiter-input.summary.json"),
    arbiterDrafts: join(directory, "arbiter-drafts.jsonl"),
    arbiters: join(directory, "arbiter.jsonl"),
    arbiterSummary: join(directory, "arbiter.summary.json"),
    auditorViews: join(directory, "auditor-input.jsonl"),
    auditorViewSummary: join(directory, "auditor-input.summary.json"),
    arbiterBatchDir: join(directory, "batches-arbiter"),
    auditorBatchDir: join(directory, "batches-auditor")
  };
  writeJsonl(paths.packets, packets);
  writeJsonl(paths.proposerA, proposerA);
  writeJsonl(paths.proposerB, proposerB);
  writeFileSync(
    paths.configuration,
    `${JSON.stringify(configuration, null, 2)}\n`
  );
  writeFileSync(
    paths.selection,
    `${JSON.stringify({ keys: packets.map((value) => value.entryKey) }, null, 2)}\n`
  );
  const common = {
    packetsPath: paths.packets,
    proposerAPath: paths.proposerA,
    proposerBPath: paths.proposerB,
    configurationPath: paths.configuration,
    selectionPath: paths.selection
  };
  await buildLexiconV3FrenchInternalArbiterWork({
    ...common,
    outputPath: paths.arbiterViews,
    summaryPath: paths.arbiterViewSummary
  });
  const arbiterViews = readJsonl<FrenchInternalArbiterView>(paths.arbiterViews);
  writeJsonl(
    paths.arbiterDrafts,
    arbiterViews.map((view) => arbiterDraft(view, "proposalB"))
  );
  await finalizeLexiconV3FrenchInternalArbiterDrafts({
    ...common,
    viewsPath: paths.arbiterViews,
    draftsPath: paths.arbiterDrafts,
    outputPath: paths.arbiters,
    summaryPath: paths.arbiterSummary,
    agentId: "codex-agent:arbiter-test",
    taskName: "/test/fr/arbiter",
    completedAt: "2026-07-13T11:00:00.000Z"
  });
  await buildLexiconV3FrenchInternalAuditorWork({
    ...common,
    arbiterViewsPath: paths.arbiterViews,
    arbiterPath: paths.arbiters,
    outputPath: paths.auditorViews,
    summaryPath: paths.auditorViewSummary
  });
  return paths;
}

function packet(stepEntryId: number): LexiconV3FrenchPacket {
  const original = stepEntryId === 3056 ? "λόγος" : `λέξη${stepEntryId}`;
  return buildFrenchPacket(
    {
      entryKey: `greek:G${stepEntryId}`,
      englishRelease: frenchPacketFixtureEnglishRelease({
        entryKey: `greek:G${stepEntryId}`,
        gloss: "word",
        meaning: `A ${original} means a word.`,
        meaningHtml: `<p>A <b>${original}</b> means a word.</p>`,
        glossFieldVersionId: stepEntryId * 2 - 1,
        meaningFieldVersionId: stepEntryId * 2
      }),
      identity: {
        stepEntryId,
        language: "greek",
        eStrong: `G${stepEntryId}`,
        dStrong: `G${stepEntryId}`,
        uStrong: `G${stepEntryId}`,
        original,
        transliteration: `lemma-${stepEntryId}`,
        morph: "N"
      },
      english: {
        contentHash: hashFrenchInternalJson({ stepEntryId, language: "en" }),
        status: "validated",
        gloss: "word",
        meaning: `A ${original} means a word.`,
        meaningHtml: `<p>A <b>${original}</b> means a word.</p>`,
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
        strongCodes: [],
        references: [],
        originalTokens: [original]
      }
    },
    "2026-07-13T09:00:00.000Z"
  );
}

function proposer(
  packetValue: LexiconV3FrenchPacket,
  role: "proposerA" | "proposerB",
  index: number,
  generationConfigHash: string
): FrenchInternalProposerArtifact {
  return finalizeFrenchInternalProposerArtifact({
    schemaVersion: FRENCH_INTERNAL_PROPOSER_ARTIFACT_SCHEMA_VERSION,
    role,
    entryKey: packetValue.entryKey,
    packetHash: packetValue.packetHash,
    englishHash: packetValue.english.contentHash,
    generationConfigHash,
    inputHash: hashFrenchInternalJson({ role, index }),
    agentId: `codex-agent:${role}`,
    taskName: `/test/fr/${role}`,
    completedAt: "2026-07-13T09:30:00.000Z",
    glossFr: role === "proposerA" ? "parole" : "mot",
    meaningSegmentsFr: translatedSegments(packetValue, role),
    requiredEntityMentions: [],
    entityMentionsFr: [],
    notesFr: "",
    carrierTermsFr: role === "proposerA" ? ["parole"] : ["mot"],
    confidence: role === "proposerA" ? 0.96 : 0.95
  });
}

function translatedSegments(
  packetValue: LexiconV3FrenchPacket,
  role: "proposerA" | "proposerB"
): FrenchHtmlSegmentTranslation[] {
  return buildFrenchHtmlTemplate(
    packetValue.english.meaningHtml
  ).tokens.flatMap((token) => {
    if (token.kind !== "text" || !token.translatable) return [];
    const text = token.sourceText.includes("means")
      ? role === "proposerA"
        ? " signifie une parole."
        : " désigne un mot."
      : token.sourceText.trim() === "A"
        ? role === "proposerA"
          ? "Un"
          : "Une expression,"
        : token.sourceText;
    return [{ id: token.id, text }];
  });
}

function arbiterDraft(
  view: FrenchInternalArbiterView,
  selectedProposal: "proposalA" | "proposalB"
) {
  return {
    schemaVersion: FRENCH_INTERNAL_ARBITER_DRAFT_SCHEMA_VERSION,
    role: "arbiter" as const,
    entryKey: view.entryKey,
    inputHash: view.viewHash,
    verdict: "accept" as const,
    selectedProposal,
    reasons: []
  };
}

function auditorDraft(view: FrenchInternalAuditorView) {
  return {
    schemaVersion: FRENCH_INTERNAL_AUDITOR_DRAFT_SCHEMA_VERSION,
    role: "auditor" as const,
    entryKey: view.entryKey,
    inputHash: view.viewHash,
    verdict: "safe" as const,
    reasons: [],
    confidence: 0.97,
    checks: Object.fromEntries(
      FRENCH_INTERNAL_REQUIRED_AUDIT_CHECKS.map((check) => [check, "pass"])
    ) as FrenchInternalAuditChecks
  };
}

function configurationFile(): FrenchInternalAssemblyConfigurationFile {
  const configuration: FrenchInternalReviewConfiguration = {
    promptVersion: FRENCH_INTERNAL_PROMPT_VERSION,
    proposerAPromptHash: hashFrenchInternalJson("prompt-a"),
    proposerBPromptHash: hashFrenchInternalJson("prompt-b"),
    arbiterPromptHash: frenchInternalPromptHash("arbiter"),
    auditorPromptHash: frenchInternalPromptHash("auditor"),
    styleGuideHash: hashFrenchInternalJson("style"),
    termbaseHash: hashFrenchInternalJson("termbase"),
    canonicalNamesHash: hashFrenchInternalJson("names"),
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

function writeJsonl(path: string, values: unknown[]): void {
  writeFileSync(
    path,
    `${values.map((value) => JSON.stringify(value)).join("\n")}\n`,
    "utf8"
  );
}

function readJsonl<T = { entryKey: string }>(path: string): T[] {
  return readFileSync(path, "utf8")
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
