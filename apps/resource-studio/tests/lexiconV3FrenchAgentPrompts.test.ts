import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";

import { buildLexiconV3FrenchInternalConfiguration } from "../scripts/buildLexiconV3FrenchInternalConfiguration.js";
import {
  buildFrenchInternalPromptManifest,
  FRENCH_INTERNAL_PROMPT_MANIFEST_SCHEMA_VERSION,
  FRENCH_INTERNAL_ROLE_PROMPTS,
  frenchInternalPromptHash
} from "../src/lexiconV3/frenchAgentPrompts.js";
import { finalizeFrenchEntityMentionsArtifact } from "../src/lexiconV3/frenchEntityMentions.js";
import { finalizeFrenchEntityPipelineSummary } from "../src/lexiconV3/frenchEntityPipeline.js";

test("pins four distinct offline role prompts", () => {
  const manifest = buildFrenchInternalPromptManifest();
  const hashes = Object.values(manifest.prompts).map((prompt) => prompt.sha256);
  assert.equal(new Set(hashes).size, 4);
  assert.match(manifest.contentHash, /^[a-f0-9]{64}$/u);
  assert.match(FRENCH_INTERNAL_ROLE_PROMPTS.proposerA, /aveugle/u);
  assert.match(FRENCH_INTERNAL_ROLE_PROMPTS.proposerB, /non fiables/u);
  assert.match(FRENCH_INTERNAL_ROLE_PROMPTS.arbiter, /proposalA ou proposalB/u);
  assert.match(FRENCH_INTERNAL_ROLE_PROMPTS.auditor, /douze contrôles/u);
  for (const role of ["proposerA", "proposerB"] as const) {
    const prompt = FRENCH_INTERNAL_ROLE_PROMPTS[role];
    assert.match(prompt, /lemme éditorial/u);
    assert.match(prompt, /primaryFr/u);
    assert.match(prompt, /derivedFr/u);
    assert.match(prompt, /allowedFrenchForms/u);
    assert.match(
      prompt,
      /différer du lemme que par la flexion de nombre explicitement dérivée/u
    );
    assert.match(prompt, /glossFr emploie toujours exactement/u);
    assert.match(prompt, /graphies? historiques? concurrentes?/u);
  }
  assert.match(
    FRENCH_INTERNAL_ROLE_PROMPTS.arbiter,
    /refuse tout pluriel tiré de allowedFrenchForms/u
  );
  assert.match(
    FRENCH_INTERNAL_ROLE_PROMPTS.auditor,
    /jamais une flexion de allowedFrenchForms/u
  );
  assert.equal(
    FRENCH_INTERNAL_PROMPT_MANIFEST_SCHEMA_VERSION,
    "lexicon-v3-french-internal-prompt-manifest@2"
  );
  assert.equal(manifest.promptVersion, "lexicon-v3-french-internal-prompts@4");
  assert.doesNotMatch(
    Object.values(FRENCH_INTERNAL_ROLE_PROMPTS).join("\n"),
    /https?:|\b(?:Gateway|CEL)\b|fetch\(/iu
  );
  assert.equal(
    frenchInternalPromptHash("proposerA"),
    manifest.prompts.proposerA.sha256
  );
});

test("refuses to build a configuration without a replayable physical entity-agent attestation", (t) => {
  const fixture = writeFixture(t);
  assert.throws(
    () => buildLexiconV3FrenchInternalConfiguration(fixture.options),
    /french-entity-attestation-invalid/u
  );
});

test("refuses editorial digest drift", (t) => {
  const fixture = writeFixture(t);
  writeFileSync(fixture.termbase, "tampered\n", "utf8");
  assert.throws(
    () => buildLexiconV3FrenchInternalConfiguration(fixture.options),
    /artifact-digest-mismatch:termbase/u
  );
});

function writeFixture(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), "lexicon-v3-fr-config-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const guide = join(directory, "guide.json");
  const entities = join(directory, "entities.jsonl");
  const termbase = join(directory, "termbase.jsonl");
  const editorialSummary = join(directory, "summary.json");
  const canonicalEntities = join(directory, "canonical-entities.jsonl");
  const canonicalEntryPolicies = join(directory, "canonical-policies.jsonl");
  const entityManifest = join(directory, "entity-manifest.json");
  const entityResultsDir = join(directory, "entity-results");
  const entityMergeAttestation = join(
    directory,
    "entity-merge-attestation.json"
  );
  const entityGate = join(directory, "entity-gate.json");
  const entityMentions = join(directory, "entity-mentions.json");
  const entityPipelineSummary = join(directory, "entity-pipeline-summary.json");
  writeFileSync(guide, "{}\n", "utf8");
  writeFileSync(entities, "{}\n", "utf8");
  writeFileSync(termbase, "{}\n", "utf8");
  writeFileSync(canonicalEntities, "{}\n", "utf8");
  writeFileSync(canonicalEntryPolicies, "{}\n", "utf8");
  writeFileSync(entityManifest, "{}\n", "utf8");
  writeFileSync(entityMergeAttestation, "{}\n", "utf8");
  writeFileSync(entityGate, "{}\n", "utf8");
  const mentions = finalizeFrenchEntityMentionsArtifact({
    inputHashes: {
      stepEntries: "a".repeat(64),
      canonicalEntities: "b".repeat(64),
      canonicalPolicies: "c".repeat(64),
      englishMeanings: "d".repeat(64)
    },
    requiredEntityMentions: []
  });
  writeFileSync(entityMentions, `${JSON.stringify(mentions)}\n`, "utf8");
  const digest = (path: string) =>
    createHash("sha256").update(readFileSync(path)).digest("hex");
  writeFileSync(
    editorialSummary,
    `${JSON.stringify({
      schemaVersion: "lexicon-v3-french-editorial-build@1",
      counts: { entries: 1 },
      sourceDigests: { editorialGuide: digest(guide) },
      artifacts: {
        entityRegistry: {
          path: entities,
          sha256: digest(entities),
          records: 1
        },
        termbaseCandidates: {
          path: termbase,
          sha256: digest(termbase),
          records: 1
        }
      },
      summaryContentHash: "a".repeat(64)
    })}\n`,
    "utf8"
  );
  const pipelineSummary = finalizeFrenchEntityPipelineSummary({
    generatedAt: "2026-07-14T00:00:00.000Z",
    sourcePaths: {
      plan: join(directory, "plan.json"),
      entityMergeAttestation,
      canonicalEntities,
      canonicalEntryPolicies,
      packets: join(directory, "packets.jsonl"),
      mentionResolutionArtifact: null,
      mentionResolutionAttestation: null
    },
    sourceHashes: {
      plan: "1".repeat(64),
      entityMergeAttestation: digest(entityMergeAttestation),
      canonicalEntities: digest(canonicalEntities),
      canonicalEntryPolicies: digest(canonicalEntryPolicies),
      packets: "2".repeat(64),
      mentionResolutionArtifact: null,
      mentionResolutionAttestation: null
    },
    outputPaths: {
      entityGate,
      entityMentions,
      summary: entityPipelineSummary
    },
    outputHashes: {
      entityGate: digest(entityGate),
      entityMentions: digest(entityMentions)
    },
    lineage: {
      planHash: "3".repeat(64),
      releaseKey: "fixture-release",
      releaseSnapshotFingerprint: "4".repeat(64),
      entityMergeAttestationHash: "6".repeat(64),
      entityGateHash: "5".repeat(64),
      entityMentionsHash: mentions.contentHash,
      mentionResolutionAttestationHash: null
    },
    counts: {
      packets: 1,
      canonicalEntities: 1,
      canonicalEntryPolicies: 1,
      requiredEntityMentions: 0,
      exactEntityMentions: 0,
      contextualEntityMentions: 0,
      nonEntityMentions: 0,
      quarantinedEntityMentions: 0,
      blockingEntityMentions: 0
    }
  });
  writeFileSync(
    entityPipelineSummary,
    `${JSON.stringify(pipelineSummary, null, 2)}\n`,
    "utf8"
  );
  return {
    termbase,
    options: {
      editorialSummary,
      guide,
      output: join(directory, "configuration.json"),
      promptManifest: join(directory, "prompt-manifest.json"),
      canonicalEntities,
      canonicalEntryPolicies,
      entityManifest,
      entityResultsDir,
      entityMergeAttestation,
      entityGate,
      entityMentions,
      entityPipelineSummary,
      expectedEntries: 1
    }
  };
}
