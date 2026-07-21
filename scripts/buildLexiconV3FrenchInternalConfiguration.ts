import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  FRENCH_INTERNAL_ASSEMBLY_CONFIG_SCHEMA_VERSION,
  type FrenchInternalAssemblyConfigurationFile
} from "./assembleLexiconV3FrenchInternalReview.js";
import {
  buildFrenchInternalPromptManifest,
  frenchInternalPromptHash,
  type FrenchInternalPromptManifest
} from "../src/lexiconV3/frenchAgentPrompts.js";
import { FRENCH_HTML_RENDERER_VERSION } from "../src/lexiconV3/frenchHtmlRenderer.js";
import {
  FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE,
  FRENCH_INTERNAL_PROMPT_VERSION,
  frenchInternalGenerationConfigHash
} from "../src/lexiconV3/frenchInternalReview.js";
import {
  assertFrenchEntityPipelineSummary,
  type FrenchEntityPipelineSummary
} from "../src/lexiconV3/frenchEntityPipeline.js";
import {
  assertFrenchEntityMentionsArtifact,
  assertFrenchEntityMentionsPublishable,
  type FrenchEntityMentionsArtifact
} from "../src/lexiconV3/frenchEntityMentions.js";
import {
  assertFrenchEntityMentionResolutionAttestation,
  type FrenchEntityMentionResolutionAttestation
} from "../src/lexiconV3/frenchEntityMentionResolution.js";
import { assertFrenchEntityMergeAttestationFromFiles } from "../src/lexiconV3/frenchEntityMergeAttestation.js";

const DEFAULT_EDITORIAL_SUMMARY =
  "outputs/lexicon-v3/french-editorial/summary.json";
const DEFAULT_GUIDE = "src/lexiconV3/sources/french-editorial-guide.json";
const DEFAULT_OUTPUT = "outputs/lexicon-v3/fr-internal/configuration.json";
const DEFAULT_PROMPT_MANIFEST =
  "outputs/lexicon-v3/fr-internal/prompt-manifest.json";
const DEFAULT_ENTITY_ROOT = "outputs/lexicon-v3/french-entities";
const DEFAULT_ENTITY_RESOLVED = `${DEFAULT_ENTITY_ROOT}/resolved`;
const DEFAULT_ENTITY_MANIFEST = `${DEFAULT_ENTITY_ROOT}/agent-batches/manifest.json`;
const DEFAULT_ENTITY_RESULTS = `${DEFAULT_ENTITY_ROOT}/agent-results`;
const DEFAULT_ENTITY_MERGE_ATTESTATION = `${DEFAULT_ENTITY_RESOLVED}/entity-merge-attestation.json`;
const DEFAULT_CANONICAL_ENTITIES = `${DEFAULT_ENTITY_RESOLVED}/canonical-entities.jsonl`;
const DEFAULT_CANONICAL_ENTRY_POLICIES = `${DEFAULT_ENTITY_RESOLVED}/canonical-entry-name-policies.jsonl`;
const DEFAULT_ENTITY_GATE = `${DEFAULT_ENTITY_RESOLVED}/entity-gate.json`;
const DEFAULT_ENTITY_MENTIONS = `${DEFAULT_ENTITY_RESOLVED}/required-entity-mentions.json`;
const DEFAULT_ENTITY_PIPELINE_SUMMARY = `${DEFAULT_ENTITY_RESOLVED}/entity-pipeline-summary.json`;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

interface EditorialSummary {
  schemaVersion: string;
  counts: { entries: number };
  sourceDigests: { editorialGuide: string };
  artifacts: {
    entityRegistry: { path: string; sha256: string; records: number };
    termbaseCandidates: { path: string; sha256: string; records: number };
  };
  summaryContentHash: string;
}

export interface BuildFrenchInternalConfigurationOptions {
  editorialSummary: string;
  guide: string;
  output: string;
  promptManifest: string;
  canonicalEntities: string;
  canonicalEntryPolicies: string;
  entityManifest: string;
  entityResultsDir: string;
  entityMergeAttestation: string;
  entityGate: string;
  entityMentions: string;
  entityPipelineSummary: string;
  expectedEntries?: number;
}

export interface FrenchInternalConfigurationBuildResult {
  configuration: FrenchInternalAssemblyConfigurationFile;
  promptManifest: FrenchInternalPromptManifest;
}

function main(): void {
  const args = parseFrenchInternalConfigurationArgs(process.argv.slice(2));
  const result = buildLexiconV3FrenchInternalConfiguration({
    editorialSummary: resolve(
      args["editorial-summary"] ?? DEFAULT_EDITORIAL_SUMMARY
    ),
    guide: resolve(args.guide ?? DEFAULT_GUIDE),
    output: resolve(args.output ?? DEFAULT_OUTPUT),
    promptManifest: resolve(args["prompt-manifest"] ?? DEFAULT_PROMPT_MANIFEST),
    canonicalEntities: resolve(
      args["canonical-entities"] ?? DEFAULT_CANONICAL_ENTITIES
    ),
    canonicalEntryPolicies: resolve(
      args["canonical-entry-policies"] ?? DEFAULT_CANONICAL_ENTRY_POLICIES
    ),
    entityManifest: resolve(args["entity-manifest"] ?? DEFAULT_ENTITY_MANIFEST),
    entityResultsDir: resolve(
      args["entity-results-dir"] ?? DEFAULT_ENTITY_RESULTS
    ),
    entityMergeAttestation: resolve(
      args["entity-merge-attestation"] ?? DEFAULT_ENTITY_MERGE_ATTESTATION
    ),
    entityGate: resolve(args["entity-gate"] ?? DEFAULT_ENTITY_GATE),
    entityMentions: resolve(args["entity-mentions"] ?? DEFAULT_ENTITY_MENTIONS),
    entityPipelineSummary: resolve(
      args["entity-pipeline-summary"] ?? DEFAULT_ENTITY_PIPELINE_SUMMARY
    )
  });
  process.stdout.write(`${JSON.stringify(result.configuration, null, 2)}\n`);
}

export function buildLexiconV3FrenchInternalConfiguration(
  options: BuildFrenchInternalConfigurationOptions
): FrenchInternalConfigurationBuildResult {
  const expectedEntries = options.expectedEntries ?? 22_717;
  const summary = readJson<EditorialSummary>(options.editorialSummary);
  if (summary.schemaVersion !== "lexicon-v3-french-editorial-build@1") {
    throw new Error("invalid-french-editorial-summary-schema");
  }
  if (summary.counts.entries !== expectedEntries) {
    throw new Error("french-editorial-summary-entry-count-mismatch");
  }
  if (!SHA256_PATTERN.test(summary.summaryContentHash)) {
    throw new Error("invalid-french-editorial-summary-content-hash");
  }

  const styleGuideHash = sha256File(options.guide);
  if (summary.sourceDigests.editorialGuide !== styleGuideHash) {
    throw new Error("french-editorial-guide-lineage-mismatch");
  }
  assertArtifact(
    summary.artifacts.entityRegistry,
    expectedEntries,
    false,
    "entity-registry"
  );
  assertArtifact(
    summary.artifacts.termbaseCandidates,
    expectedEntries,
    true,
    "termbase"
  );
  const entityPipelineSummary = readJson<FrenchEntityPipelineSummary>(
    options.entityPipelineSummary
  );
  assertFrenchEntityPipelineSummary(entityPipelineSummary);
  const mergeReplay = assertFrenchEntityMergeAttestationFromFiles({
    attestationPath: options.entityMergeAttestation,
    manifestPath: options.entityManifest,
    resultsDirectory: options.entityResultsDir,
    canonicalEntitiesPath: options.canonicalEntities,
    canonicalEntryPoliciesPath: options.canonicalEntryPolicies
  });
  const entityMentions = readJson<FrenchEntityMentionsArtifact>(
    options.entityMentions
  );
  assertFrenchEntityMentionsArtifact(entityMentions);
  assertFrenchEntityMentionsPublishable(entityMentions);
  const canonicalEntitiesHash = sha256File(options.canonicalEntities);
  const canonicalEntryPoliciesHash = sha256File(options.canonicalEntryPolicies);
  const entityGateHash = sha256File(options.entityGate);
  const entityMentionsHash = sha256File(options.entityMentions);
  const entityMergeAttestationHash = sha256File(options.entityMergeAttestation);
  assertEntityPipelineConfigurationLineage({
    summary: entityPipelineSummary,
    canonicalEntities: options.canonicalEntities,
    canonicalEntryPolicies: options.canonicalEntryPolicies,
    entityGate: options.entityGate,
    entityMentions: options.entityMentions,
    entityMergeAttestation: options.entityMergeAttestation,
    canonicalEntitiesHash,
    canonicalEntryPoliciesHash,
    entityGateHash,
    entityMentionsHash,
    entityMergeAttestationHash,
    entityMergeAttestationContentHash: mergeReplay.attestation.attestationHash
  });
  const configuration = {
    promptVersion: FRENCH_INTERNAL_PROMPT_VERSION,
    proposerAPromptHash: frenchInternalPromptHash("proposerA"),
    proposerBPromptHash: frenchInternalPromptHash("proposerB"),
    arbiterPromptHash: frenchInternalPromptHash("arbiter"),
    auditorPromptHash: frenchInternalPromptHash("auditor"),
    styleGuideHash,
    termbaseHash: summary.artifacts.termbaseCandidates.sha256,
    canonicalNamesHash: summary.artifacts.entityRegistry.sha256,
    entityMergeAttestationHash,
    canonicalEntitiesHash,
    canonicalEntryPoliciesHash,
    entityGateHash,
    entityMentionsHash,
    htmlRendererVersion: FRENCH_HTML_RENDERER_VERSION,
    approvedExecutionProfile: FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE
  };
  const output: FrenchInternalAssemblyConfigurationFile = {
    schemaVersion: FRENCH_INTERNAL_ASSEMBLY_CONFIG_SCHEMA_VERSION,
    configuration,
    generationConfigHash: frenchInternalGenerationConfigHash(configuration)
  };
  const promptManifest = buildFrenchInternalPromptManifest();
  writePairAtomic(
    options.output,
    `${JSON.stringify(output, null, 2)}\n`,
    options.promptManifest,
    `${JSON.stringify(promptManifest, null, 2)}\n`
  );
  return { configuration: output, promptManifest };
}

function assertArtifact(
  artifact: { path: string; sha256: string; records: number } | undefined,
  expectedEntries: number,
  requireFullCoverage: boolean,
  label: string
): void {
  if (!artifact || !SHA256_PATTERN.test(artifact.sha256)) {
    throw new Error(`invalid-french-editorial-artifact:${label}`);
  }
  if (requireFullCoverage && artifact.records !== expectedEntries) {
    throw new Error(`french-editorial-artifact-count-mismatch:${label}`);
  }
  if (!requireFullCoverage && artifact.records <= 0) {
    throw new Error(`empty-french-editorial-artifact:${label}`);
  }
  if (sha256File(artifact.path) !== artifact.sha256) {
    throw new Error(`french-editorial-artifact-digest-mismatch:${label}`);
  }
}

function assertEntityPipelineConfigurationLineage(input: {
  summary: FrenchEntityPipelineSummary;
  canonicalEntities: string;
  canonicalEntryPolicies: string;
  entityGate: string;
  entityMentions: string;
  entityMergeAttestation: string;
  canonicalEntitiesHash: string;
  canonicalEntryPoliciesHash: string;
  entityGateHash: string;
  entityMentionsHash: string;
  entityMergeAttestationHash: string;
  entityMergeAttestationContentHash: string;
}): void {
  const resolutionPath = input.summary.sourcePaths.mentionResolutionAttestation;
  const resolutionFileHash =
    input.summary.sourceHashes.mentionResolutionAttestation;
  const resolutionContentHash =
    input.summary.lineage.mentionResolutionAttestationHash;
  const resolutionFields = [
    resolutionPath,
    resolutionFileHash,
    resolutionContentHash,
    input.summary.sourcePaths.mentionResolutionArtifact,
    input.summary.sourceHashes.mentionResolutionArtifact
  ];
  const resolutionPresent = resolutionFields.every(
    (value) => typeof value === "string"
  );
  const resolutionAbsent = resolutionFields.every((value) => value === null);
  if (
    (!resolutionPresent && !resolutionAbsent) ||
    (resolutionPresent &&
      (sha256File(resolutionPath!) !== resolutionFileHash ||
        sha256File(input.summary.sourcePaths.mentionResolutionArtifact!) !==
          input.summary.sourceHashes.mentionResolutionArtifact)) ||
    resolve(input.summary.sourcePaths.canonicalEntities) !==
      resolve(input.canonicalEntities) ||
    resolve(input.summary.sourcePaths.canonicalEntryPolicies) !==
      resolve(input.canonicalEntryPolicies) ||
    resolve(input.summary.sourcePaths.entityMergeAttestation) !==
      resolve(input.entityMergeAttestation) ||
    resolve(input.summary.outputPaths.entityGate) !==
      resolve(input.entityGate) ||
    resolve(input.summary.outputPaths.entityMentions) !==
      resolve(input.entityMentions) ||
    input.summary.sourceHashes.canonicalEntities !==
      input.canonicalEntitiesHash ||
    input.summary.sourceHashes.canonicalEntryPolicies !==
      input.canonicalEntryPoliciesHash ||
    input.summary.sourceHashes.entityMergeAttestation !==
      input.entityMergeAttestationHash ||
    input.summary.lineage.entityMergeAttestationHash !==
      input.entityMergeAttestationContentHash ||
    input.summary.outputHashes.entityGate !== input.entityGateHash ||
    input.summary.outputHashes.entityMentions !== input.entityMentionsHash ||
    input.summary.counts.blockingEntityMentions !== 0
  ) {
    throw new Error("french-entity-pipeline-configuration-lineage-mismatch");
  }
  if (resolutionPresent) {
    const attestation = readJson<FrenchEntityMentionResolutionAttestation>(
      resolutionPath!
    );
    assertFrenchEntityMentionResolutionAttestation(attestation);
    if (
      attestation.attestationHash !== resolutionContentHash ||
      attestation.finalMentionsHash !== input.summary.lineage.entityMentionsHash
    ) {
      throw new Error(
        "french-entity-pipeline-configuration-resolution-lineage"
      );
    }
  }
}

function readJson<T>(path: string): T {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    throw new Error(`invalid-json:${path}`);
  }
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function writePairAtomic(
  firstPath: string,
  firstContent: string,
  secondPath: string,
  secondContent: string
): void {
  if (resolve(firstPath) === resolve(secondPath)) {
    throw new Error("configuration-and-prompt-manifest-paths-must-differ");
  }
  const firstTemp = `${firstPath}.tmp-${process.pid}`;
  const secondTemp = `${secondPath}.tmp-${process.pid}`;
  const firstBackup = `${firstPath}.bak-${process.pid}`;
  const secondBackup = `${secondPath}.bak-${process.pid}`;
  mkdirSync(dirname(firstPath), { recursive: true });
  mkdirSync(dirname(secondPath), { recursive: true });
  const firstExists = existsSync(firstPath);
  const secondExists = existsSync(secondPath);
  let firstBackedUp = false;
  let secondBackedUp = false;
  let firstInstalled = false;
  let secondInstalled = false;
  try {
    writeFileSync(firstTemp, firstContent, "utf8");
    writeFileSync(secondTemp, secondContent, "utf8");
    if (firstExists) {
      renameSync(firstPath, firstBackup);
      firstBackedUp = true;
    }
    if (secondExists) {
      renameSync(secondPath, secondBackup);
      secondBackedUp = true;
    }
    renameSync(firstTemp, firstPath);
    firstInstalled = true;
    renameSync(secondTemp, secondPath);
    secondInstalled = true;
    rmSync(firstBackup, { force: true });
    rmSync(secondBackup, { force: true });
  } catch (error) {
    rmSync(firstTemp, { force: true });
    rmSync(secondTemp, { force: true });
    if (firstInstalled) rmSync(firstPath, { force: true });
    if (secondInstalled) rmSync(secondPath, { force: true });
    if (firstBackedUp && existsSync(firstBackup)) {
      renameSync(firstBackup, firstPath);
    }
    if (secondBackedUp && existsSync(secondBackup)) {
      renameSync(secondBackup, secondPath);
    }
    throw error;
  }
}

export function parseFrenchInternalConfigurationArgs(
  values: readonly string[]
): Record<string, string> {
  const allowed = new Set([
    "editorial-summary",
    "guide",
    "output",
    "prompt-manifest",
    "canonical-entities",
    "canonical-entry-policies",
    "entity-manifest",
    "entity-results-dir",
    "entity-merge-attestation",
    "entity-gate",
    "entity-mentions",
    "entity-pipeline-summary"
  ]);
  const parsed: Record<string, string> = {};
  for (let index = 0; index < values.length; index += 1) {
    const token = values[index] ?? "";
    if (!token.startsWith("--")) {
      throw new Error(`unexpected-argument:${token}`);
    }
    const [key, inline] = token.slice(2).split("=", 2);
    if (!allowed.has(key)) throw new Error(`unknown-option:${key}`);
    if (parsed[key] !== undefined) throw new Error(`duplicate-option:${key}`);
    const next = values[index + 1];
    if (inline !== undefined) {
      if (!inline) throw new Error(`missing-value:${key}`);
      parsed[key] = inline;
    } else if (next && !next.startsWith("--")) {
      parsed[key] = next;
      index += 1;
    } else throw new Error(`missing-value:${key}`);
  }
  return parsed;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
