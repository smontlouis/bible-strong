import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";

import { finalizeLexiconV3FrenchProposerDrafts } from "../scripts/finalizeLexiconV3FrenchProposerDrafts.js";
import {
  FRENCH_INTERNAL_ASSEMBLY_CONFIG_SCHEMA_VERSION,
  FRENCH_INTERNAL_PROPOSER_ARTIFACT_SCHEMA_VERSION,
  type FrenchInternalAssemblyConfigurationFile,
  type FrenchInternalProposerArtifact
} from "../scripts/assembleLexiconV3FrenchInternalReview.js";
import { FRENCH_INTERNAL_PROPOSER_DRAFT_SCHEMA_VERSION } from "../src/lexiconV3/frenchAgentDrafts.js";
import {
  buildFrenchHtmlTemplate,
  FRENCH_HTML_RENDERER_VERSION
} from "../src/lexiconV3/frenchHtmlRenderer.js";
import {
  FRENCH_INTERNAL_PROPOSER_VIEW_SCHEMA_VERSION,
  FRENCH_INTERNAL_WORK_POLICY_VERSION,
  finalizeFrenchInternalView,
  type FrenchInternalProposerAView
} from "../src/lexiconV3/frenchInternalWork.js";
import {
  FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE,
  FRENCH_INTERNAL_PROMPT_VERSION,
  frenchInternalGenerationConfigHash,
  hashFrenchInternalJson,
  type FrenchInternalReviewConfiguration
} from "../src/lexiconV3/frenchInternalReview.js";
import { buildFrenchPacket } from "../src/lexiconV3/frenchPackets.js";
import { frenchPacketFixtureEnglishRelease } from "./lexiconV3FrenchPacketFixture.js";

test("binds a proposer draft to its exact blind input view", async (t) => {
  const fixture = writeFixture(t);
  const summary = await finalizeLexiconV3FrenchProposerDrafts(fixture.options);
  assert.equal(summary.counts.artifacts, 1);
  assert.equal(summary.counts.validatorClean, 1);
  const artifact = JSON.parse(
    readFileSync(fixture.options.outputPath, "utf8").trim()
  ) as FrenchInternalProposerArtifact;
  assert.equal(
    artifact.schemaVersion,
    FRENCH_INTERNAL_PROPOSER_ARTIFACT_SCHEMA_VERSION
  );
  assert.equal(artifact.inputHash, fixture.view.viewHash);
  assert.equal(artifact.agentId, "codex-agent:test-a");
  assert.match(artifact.artifactHash, /^[a-f0-9]{64}$/u);
});

test("rejects a view changed after its hash was sealed", async (t) => {
  const fixture = writeFixture(t);
  writeFileSync(
    fixture.options.viewsPath,
    `${JSON.stringify({
      ...fixture.view,
      english: { ...fixture.view.english, gloss: "tampered" }
    })}\n`,
    "utf8"
  );
  await assert.rejects(
    finalizeLexiconV3FrenchProposerDrafts(fixture.options),
    /view-hash-mismatch/u
  );
});

function writeFixture(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), "lexicon-v3-fr-finalizer-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const packet = buildFrenchPacket(
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
        concordanceForms: [],
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
  const htmlTemplate = buildFrenchHtmlTemplate(packet.english.meaningHtml);
  const entityConstraintsContent = {
    entryPolicy: null,
    mentionPolicies: [],
    canonicalEntities: [],
    requiredMentions: []
  };
  const view = finalizeFrenchInternalView({
    schemaVersion: FRENCH_INTERNAL_PROPOSER_VIEW_SCHEMA_VERSION,
    policyVersion: FRENCH_INTERNAL_WORK_POLICY_VERSION,
    viewKind: "proposer_a_blind" as const,
    role: "proposerA" as const,
    entryKey: packet.entryKey,
    workViewHash: "f".repeat(64),
    lineage: {
      sourceLogicalDigest: "0".repeat(64),
      packetHash: packet.packetHash,
      englishHash: packet.english.contentHash,
      reuseRecordDigest: "1".repeat(64),
      releaseKey: "fixture",
      releaseSnapshotFingerprint: "2".repeat(64),
      glossParentContentHash: "3".repeat(64),
      meaningParentContentHash: "4".repeat(64),
      termbaseContentHash: "5".repeat(64),
      entityContentHash: null,
      morphologyContentHashes: [],
      editorialSummaryContentHash: "6".repeat(64),
      guideSourceDigest: "7".repeat(64)
    },
    identity: packet.identity,
    english: packet.english,
    protectedContent: packet.protectedContent,
    translationTask: {
      locale: "fr" as const,
      outputFields: [
        "glossFr",
        "meaningSegmentsFr",
        "entityMentionsFr",
        "notesFr",
        "carrierTermsFr"
      ] as [
        "glossFr",
        "meaningSegmentsFr",
        "entityMentionsFr",
        "notesFr",
        "carrierTermsFr"
      ],
      htmlRule: "translate-text-segments-only-html-rebuilt-locally" as const,
      identityRule:
        "translate-exact-step-entry-never-generalize-to-classical-strong" as const,
      htmlTemplate
    },
    guide: {
      schemaVersion: "lexicon-v3-french-editorial-guide@1",
      locale: "fr",
      releaseRule: "fixture"
    },
    guideContentHash: "8".repeat(64),
    canonicalRegistry: [],
    entityConstraints: {
      ...entityConstraintsContent,
      contextHash: hashFrenchInternalJson(entityConstraintsContent)
    },
    morphology: [],
    translationProfile: {
      pos: "noun" as const,
      properName: false,
      theological: false,
      meaningCohort: "unchanged" as const,
      meaningSize: "short" as const,
      englishRiskCategories: []
    },
    evidencePolicy: {
      mode: "blind-independent-translation" as const,
      frenchEntryCandidatesExposed: false as const,
      allowedFrenchContext: [
        "editorial-guide",
        "green-canonical-registry",
        "canonical-entry-name-policies",
        "required-entity-mentions",
        "morphology-registry"
      ] as [
        "editorial-guide",
        "green-canonical-registry",
        "canonical-entry-name-policies",
        "required-entity-mentions",
        "morphology-registry"
      ]
    }
  }) as unknown as FrenchInternalProposerAView;
  const configuration = configurationFile();
  const options = {
    role: "proposerA" as const,
    viewsPath: join(directory, "views.jsonl"),
    draftsPath: join(directory, "drafts.jsonl"),
    packetsPath: join(directory, "packets.jsonl"),
    configurationPath: join(directory, "configuration.json"),
    outputPath: join(directory, "artifacts.jsonl"),
    summaryPath: join(directory, "summary.json"),
    agentId: "codex-agent:test-a",
    taskName: "/test/proposer-a",
    completedAt: "2026-07-13T10:00:00.000Z"
  };
  writeFileSync(options.viewsPath, `${JSON.stringify(view)}\n`, "utf8");
  writeFileSync(
    options.draftsPath,
    `${JSON.stringify({
      schemaVersion: FRENCH_INTERNAL_PROPOSER_DRAFT_SCHEMA_VERSION,
      role: "proposerA",
      entryKey: packet.entryKey,
      inputHash: view.viewHash,
      glossFr: "parole",
      meaningSegmentsFr: [
        { id: "t0", text: "Un" },
        { id: "t1", text: "λόγος" },
        { id: "t2", text: "signifie une parole." }
      ],
      entityMentionsFr: [],
      notesFr: "",
      carrierTermsFr: ["parole"],
      confidence: 0.97
    })}\n`,
    "utf8"
  );
  writeFileSync(options.packetsPath, `${JSON.stringify(packet)}\n`, "utf8");
  writeFileSync(
    options.configurationPath,
    `${JSON.stringify(configuration, null, 2)}\n`,
    "utf8"
  );
  return { options, view };
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
