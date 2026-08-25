import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";

import {
  finalizeFrenchInternalProposerArtifact,
  FRENCH_INTERNAL_ASSEMBLY_CONFIG_SCHEMA_VERSION,
  FRENCH_INTERNAL_PROPOSER_ARTIFACT_SCHEMA_VERSION,
  type FrenchInternalArbiterArtifact,
  type FrenchInternalAssemblyConfigurationFile,
  type FrenchInternalAuditorArtifact,
  type FrenchInternalProposerArtifact
} from "../scripts/assembleLexiconV3FrenchInternalReview.js";
import {
  buildLexiconV3FrenchInternalArbiterWork,
  buildLexiconV3FrenchInternalAuditorWork,
  finalizeAdjudicationView,
  finalizeLexiconV3FrenchInternalArbiterDrafts,
  finalizeLexiconV3FrenchInternalAuditorDrafts,
  FRENCH_INTERNAL_REQUIRED_AUDIT_CHECKS,
  type FrenchInternalArbiterView,
  type FrenchInternalAuditorView
} from "../scripts/lexiconV3FrenchInternalAdjudication.js";
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
import {
  buildFrenchPacket,
  type LexiconV3FrenchPacket
} from "../src/lexiconV3/frenchPackets.js";
import { frenchPacketFixtureEnglishRelease } from "./lexiconV3FrenchPacketFixture.js";

test("builds hash-bound arbiter and auditor artifacts without a third proposal", async (t) => {
  const fixture = writeFixture(t, 1);
  const arbiterBuild = await buildLexiconV3FrenchInternalArbiterWork(
    fixture.arbiterBuild
  );
  assert.equal(arbiterBuild.counts.records, 1);
  const arbiterView = readJsonl<FrenchInternalArbiterView>(
    fixture.paths.arbiterViews
  )[0]!;
  assert.deepEqual(arbiterView.decisionContract.allowedSelections, [
    "proposalA",
    "proposalB"
  ]);
  assert.equal(arbiterView.decisionContract.fusionAllowed, false);

  writeJsonl(fixture.paths.arbiterDrafts, [
    arbiterDraft(arbiterView, "proposalB")
  ]);
  const arbiterSummary = await finalizeLexiconV3FrenchInternalArbiterDrafts(
    fixture.arbiterFinalize
  );
  assert.equal(arbiterSummary.counts.accepted, 1);
  const arbiter = readJsonl<FrenchInternalArbiterArtifact>(
    fixture.paths.arbiters
  )[0]!;
  assert.equal(arbiter.inputHash, arbiterView.viewHash);
  assert.equal(arbiter.selectedProposal, "proposalB");

  const auditorBuild = await buildLexiconV3FrenchInternalAuditorWork(
    fixture.auditorBuild
  );
  assert.equal(auditorBuild.counts.records, 1);
  const auditorView = readJsonl<FrenchInternalAuditorView>(
    fixture.paths.auditorViews
  )[0]!;
  assert.equal(
    auditorView.arbitration.proposal.glossFr,
    auditorView.proposalB.proposal.glossFr
  );
  assert.deepEqual(
    auditorView.auditContract.requiredChecks,
    FRENCH_INTERNAL_REQUIRED_AUDIT_CHECKS
  );

  writeJsonl(fixture.paths.auditorDrafts, [auditorDraft(auditorView)]);
  const auditorSummary = await finalizeLexiconV3FrenchInternalAuditorDrafts(
    fixture.auditorFinalize
  );
  assert.equal(auditorSummary.counts.safe, 1);
  const auditor = readJsonl<FrenchInternalAuditorArtifact>(
    fixture.paths.auditors
  )[0]!;
  assert.equal(auditor.inputHash, auditorView.viewHash);
  assert.equal(Object.keys(auditor.checks).length, 12);
});

test("rejects a rehashed arbiter view that mutates a rendered proposal", async (t) => {
  const fixture = writeFixture(t, 1);
  await buildLexiconV3FrenchInternalArbiterWork(fixture.arbiterBuild);
  const view = readJsonl<FrenchInternalArbiterView>(
    fixture.paths.arbiterViews
  )[0]!;
  const { viewHash: _viewHash, ...content } = view;
  void _viewHash;
  const tampered = finalizeAdjudicationView({
    ...content,
    proposalA: {
      ...content.proposalA,
      proposal: {
        ...content.proposalA.proposal,
        glossFr: "fusion interdite"
      }
    }
  });
  writeJsonl(fixture.paths.arbiterViews, [tampered]);
  writeJsonl(fixture.paths.arbiterDrafts, [
    arbiterDraft(tampered, "proposalA")
  ]);
  await assert.rejects(
    finalizeLexiconV3FrenchInternalArbiterDrafts(fixture.arbiterFinalize),
    /arbiter-view-lineage-mismatch/u
  );
});

test("fails closed on invalid choice, missing key, duplicate key, and order drift", async (t) => {
  const fixture = writeFixture(t, 2);
  await buildLexiconV3FrenchInternalArbiterWork(fixture.arbiterBuild);
  const views = readJsonl<FrenchInternalArbiterView>(
    fixture.paths.arbiterViews
  );

  writeJsonl(fixture.paths.arbiterDrafts, [
    { ...arbiterDraft(views[0]!, "proposalA"), selectedProposal: "proposalC" },
    arbiterDraft(views[1]!, "proposalA")
  ]);
  await assert.rejects(
    finalizeLexiconV3FrenchInternalArbiterDrafts(fixture.arbiterFinalize),
    /invalid-french-arbiter-selection/u
  );

  writeJsonl(fixture.paths.arbiterDrafts, [
    arbiterDraft(views[0]!, "proposalA")
  ]);
  await assert.rejects(
    finalizeLexiconV3FrenchInternalArbiterDrafts(fixture.arbiterFinalize),
    /missing-french-adjudication-arbiter-draft/u
  );

  writeJsonl(fixture.paths.arbiterDrafts, [
    arbiterDraft(views[0]!, "proposalA"),
    arbiterDraft(views[0]!, "proposalA")
  ]);
  await assert.rejects(
    finalizeLexiconV3FrenchInternalArbiterDrafts(fixture.arbiterFinalize),
    /duplicate-french-adjudication-arbiter-draft/u
  );

  writeJsonl(fixture.paths.arbiterDrafts, [
    arbiterDraft(views[1]!, "proposalA"),
    arbiterDraft(views[0]!, "proposalA")
  ]);
  await assert.rejects(
    finalizeLexiconV3FrenchInternalArbiterDrafts(fixture.arbiterFinalize),
    /arbiter-draft-order-mismatch/u
  );
});

test("rejects stale proposer lineage even when the changed artifact is rehashed", async (t) => {
  const fixture = writeFixture(t, 1);
  await buildLexiconV3FrenchInternalArbiterWork(fixture.arbiterBuild);
  const view = readJsonl<FrenchInternalArbiterView>(
    fixture.paths.arbiterViews
  )[0]!;
  writeJsonl(fixture.paths.arbiterDrafts, [arbiterDraft(view, "proposalA")]);
  const proposer = readJsonl<FrenchInternalProposerArtifact>(
    fixture.paths.proposerA
  )[0]!;
  const { artifactHash: _artifactHash, ...content } = proposer;
  void _artifactHash;
  writeJsonl(fixture.paths.proposerA, [
    finalizeFrenchInternalProposerArtifact({
      ...content,
      glossFr: "proposition changée"
    })
  ]);
  await assert.rejects(
    finalizeLexiconV3FrenchInternalArbiterDrafts(fixture.arbiterFinalize),
    /arbiter-view-lineage-mismatch/u
  );
});

test("requires the auditor's exact twelve-check set before artifact finalization", async (t) => {
  const fixture = writeFixture(t, 1);
  await buildLexiconV3FrenchInternalArbiterWork(fixture.arbiterBuild);
  const arbiterView = readJsonl<FrenchInternalArbiterView>(
    fixture.paths.arbiterViews
  )[0]!;
  writeJsonl(fixture.paths.arbiterDrafts, [
    arbiterDraft(arbiterView, "proposalA")
  ]);
  await finalizeLexiconV3FrenchInternalArbiterDrafts(fixture.arbiterFinalize);
  await buildLexiconV3FrenchInternalAuditorWork(fixture.auditorBuild);
  const view = readJsonl<FrenchInternalAuditorView>(
    fixture.paths.auditorViews
  )[0]!;
  const draft = auditorDraft(view);
  const { siblingStepConsistency: _missing, ...tenChecks } = draft.checks;
  void _missing;
  writeJsonl(fixture.paths.auditorDrafts, [{ ...draft, checks: tenChecks }]);
  await assert.rejects(
    finalizeLexiconV3FrenchInternalAuditorDrafts(fixture.auditorFinalize),
    /invalid-french-auditor-check-keys/u
  );
});

function writeFixture(t: TestContext, count: number) {
  const directory = mkdtempSync(join(tmpdir(), "lexicon-v3-fr-adjudication-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const configuration = configurationFile();
  const packets = Array.from({ length: count }, (_, index) =>
    packet(index + 3056)
  );
  const proposerA = packets.map((value, index) =>
    proposer(value, "proposerA", index)
  );
  const proposerB = packets.map((value, index) =>
    proposer(value, "proposerB", index)
  );
  const paths = {
    packets: join(directory, "packets.jsonl"),
    proposerA: join(directory, "proposer-a.jsonl"),
    proposerB: join(directory, "proposer-b.jsonl"),
    configuration: join(directory, "configuration.json"),
    arbiterViews: join(directory, "arbiter-input.jsonl"),
    arbiterViewSummary: join(directory, "arbiter-input.summary.json"),
    arbiterDrafts: join(directory, "arbiter-drafts.jsonl"),
    arbiters: join(directory, "arbiter.jsonl"),
    arbiterSummary: join(directory, "arbiter.summary.json"),
    auditorViews: join(directory, "auditor-input.jsonl"),
    auditorViewSummary: join(directory, "auditor-input.summary.json"),
    auditorDrafts: join(directory, "auditor-drafts.jsonl"),
    auditors: join(directory, "auditor.jsonl"),
    auditorSummary: join(directory, "auditor.summary.json")
  };
  writeJsonl(paths.packets, packets);
  writeJsonl(paths.proposerA, proposerA);
  writeJsonl(paths.proposerB, proposerB);
  writeFileSync(
    paths.configuration,
    `${JSON.stringify(configuration, null, 2)}\n`,
    "utf8"
  );
  const common = {
    packetsPath: paths.packets,
    proposerAPath: paths.proposerA,
    proposerBPath: paths.proposerB,
    configurationPath: paths.configuration
  };
  const arbiterBuild = {
    ...common,
    outputPath: paths.arbiterViews,
    summaryPath: paths.arbiterViewSummary
  };
  const arbiterFinalize = {
    ...arbiterBuild,
    viewsPath: paths.arbiterViews,
    draftsPath: paths.arbiterDrafts,
    outputPath: paths.arbiters,
    summaryPath: paths.arbiterSummary,
    agentId: "codex-agent:arbiter-test",
    taskName: "/test/fr/arbiter",
    completedAt: "2026-07-13T10:00:00.000Z"
  };
  const auditorBuild = {
    ...common,
    arbiterViewsPath: paths.arbiterViews,
    arbiterPath: paths.arbiters,
    outputPath: paths.auditorViews,
    summaryPath: paths.auditorViewSummary
  };
  const auditorFinalize = {
    ...auditorBuild,
    viewsPath: paths.auditorViews,
    draftsPath: paths.auditorDrafts,
    outputPath: paths.auditors,
    summaryPath: paths.auditorSummary,
    agentId: "codex-agent:auditor-test",
    taskName: "/test/fr/auditor",
    completedAt: "2026-07-13T11:00:00.000Z"
  };
  return {
    paths,
    arbiterBuild,
    arbiterFinalize,
    auditorBuild,
    auditorFinalize
  };
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
  index: number
): FrenchInternalProposerArtifact {
  return finalizeFrenchInternalProposerArtifact({
    schemaVersion: FRENCH_INTERNAL_PROPOSER_ARTIFACT_SCHEMA_VERSION,
    role,
    entryKey: packetValue.entryKey,
    packetHash: packetValue.packetHash,
    englishHash: packetValue.english.contentHash,
    generationConfigHash: configurationFile().generationConfigHash,
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
    arbiterPromptHash: hashFrenchInternalJson("prompt-arbiter"),
    auditorPromptHash: hashFrenchInternalJson("prompt-auditor"),
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

function readJsonl<T>(path: string): T[] {
  return readFileSync(path, "utf8")
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}
