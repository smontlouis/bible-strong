import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  canonicalFrenchEntityJson,
  FRENCH_ENTITY_CANONICALIZATION_DEFAULT_EXPECTATIONS,
  type FrenchCanonicalEntityRecord,
  type FrenchCanonicalEntryNamePolicy,
  type FrenchEntityCanonicalizationPlan
} from "../src/lexiconV3/frenchEntityCanonicalization.js";
import {
  assertFrenchEntityPipelineArtifacts,
  finalizeFrenchEntityPipelineSummary,
  replayFrenchEntityPipeline,
  type FrenchEntityPipelineSummary
} from "../src/lexiconV3/frenchEntityPipeline.js";
import { type FrenchEntityMentionResolutionAttestation } from "../src/lexiconV3/frenchEntityMentionResolution.js";
import type { FrenchEntityMentionsArtifact } from "../src/lexiconV3/frenchEntityMentions.js";
import { assertFrenchEntityMergeAttestationFromFiles } from "../src/lexiconV3/frenchEntityMergeAttestation.js";
import { canonicalFrenchInternalJson } from "../src/lexiconV3/frenchCodexExecutionReceipt.js";
import type { LexiconV3FrenchPacket } from "../src/lexiconV3/frenchPackets.js";

const DEFAULT_ROOT = "outputs/lexicon-v3/french-entities";
const DEFAULT_RESOLVED = `${DEFAULT_ROOT}/resolved`;
const DEFAULT_PLAN = `${DEFAULT_ROOT}/entity-canonicalization-plan.json`;
const DEFAULT_MANIFEST = `${DEFAULT_ROOT}/agent-batches/manifest.json`;
const DEFAULT_RESULTS = `${DEFAULT_ROOT}/agent-results`;
const DEFAULT_ENTITY_MERGE_ATTESTATION = `${DEFAULT_RESOLVED}/entity-merge-attestation.json`;
const DEFAULT_CANONICAL_ENTITIES = `${DEFAULT_RESOLVED}/canonical-entities.jsonl`;
const DEFAULT_CANONICAL_ENTRY_POLICIES = `${DEFAULT_RESOLVED}/canonical-entry-name-policies.jsonl`;
const DEFAULT_PACKETS = "outputs/lexicon-v3/fr-internal/french-packets.jsonl";
const DEFAULT_ENTITY_GATE = `${DEFAULT_RESOLVED}/entity-gate.json`;
const DEFAULT_ENTITY_MENTIONS = `${DEFAULT_RESOLVED}/required-entity-mentions.json`;
const DEFAULT_SUMMARY = `${DEFAULT_RESOLVED}/entity-pipeline-summary.json`;

export interface FrenchEntityMentionsCliOptions {
  plan: string;
  manifest: string;
  resultsDir: string;
  entityMergeAttestation: string;
  canonicalEntities: string;
  canonicalEntryPolicies: string;
  packets: string;
  entityGate: string;
  output: string;
  summary: string;
  mentionResolutionArtifact?: string;
  mentionResolutionAttestation?: string;
  generatedAt?: string;
}

export interface FrenchEntityMentionsCliResult {
  entityGateHash: string;
  entityMentionsHash: string;
  summary: FrenchEntityPipelineSummary;
}

export function parseFrenchEntityMentionsArgs(
  args: readonly string[]
): FrenchEntityMentionsCliOptions {
  const allowed = new Set([
    "plan",
    "manifest",
    "results-dir",
    "entity-merge-attestation",
    "canonical-entities",
    "canonical-entry-policies",
    "packets",
    "entity-gate",
    "output",
    "summary",
    "mention-resolution-artifact",
    "mention-resolution-attestation",
    "generated-at"
  ]);
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index] ?? "";
    if (!token.startsWith("--")) {
      throw new Error(`french-entity-mentions-unexpected-argument:${token}`);
    }
    const [key, inline] = token.slice(2).split("=", 2);
    if (!allowed.has(key)) {
      throw new Error(`french-entity-mentions-unknown-option:${key}`);
    }
    if (values.has(key)) {
      throw new Error(`french-entity-mentions-duplicate-option:${key}`);
    }
    const next = args[index + 1];
    if (inline !== undefined) {
      if (!inline.trim()) {
        throw new Error(`french-entity-mentions-missing-value:${key}`);
      }
      values.set(key, inline);
    } else if (next && !next.startsWith("--") && next.trim()) {
      values.set(key, next);
      index += 1;
    } else {
      throw new Error(`french-entity-mentions-missing-value:${key}`);
    }
  }
  const generatedAt = values.get("generated-at");
  if (generatedAt && !Number.isFinite(Date.parse(generatedAt))) {
    throw new Error(
      `french-entity-mentions-invalid-generated-at:${generatedAt}`
    );
  }
  return {
    plan: resolve(values.get("plan") ?? DEFAULT_PLAN),
    manifest: resolve(values.get("manifest") ?? DEFAULT_MANIFEST),
    resultsDir: resolve(values.get("results-dir") ?? DEFAULT_RESULTS),
    entityMergeAttestation: resolve(
      values.get("entity-merge-attestation") ?? DEFAULT_ENTITY_MERGE_ATTESTATION
    ),
    canonicalEntities: resolve(
      values.get("canonical-entities") ?? DEFAULT_CANONICAL_ENTITIES
    ),
    canonicalEntryPolicies: resolve(
      values.get("canonical-entry-policies") ?? DEFAULT_CANONICAL_ENTRY_POLICIES
    ),
    packets: resolve(values.get("packets") ?? DEFAULT_PACKETS),
    entityGate: resolve(values.get("entity-gate") ?? DEFAULT_ENTITY_GATE),
    output: resolve(values.get("output") ?? DEFAULT_ENTITY_MENTIONS),
    summary: resolve(values.get("summary") ?? DEFAULT_SUMMARY),
    ...(values.get("mention-resolution-artifact")
      ? {
          mentionResolutionArtifact: resolve(
            values.get("mention-resolution-artifact")!
          )
        }
      : {}),
    ...(values.get("mention-resolution-attestation")
      ? {
          mentionResolutionAttestation: resolve(
            values.get("mention-resolution-attestation")!
          )
        }
      : {}),
    ...(generatedAt ? { generatedAt } : {})
  };
}

export function buildLexiconV3FrenchEntityMentions(
  options: FrenchEntityMentionsCliOptions
): FrenchEntityMentionsCliResult {
  const paths = Object.fromEntries(
    Object.entries(options)
      .filter(
        ([key, value]) => key !== "generatedAt" && typeof value === "string"
      )
      .map(([key, value]) => [key, resolve(value as string)])
  ) as Omit<FrenchEntityMentionsCliOptions, "generatedAt">;
  assertDistinctPaths(paths);
  const mergeReplay = assertFrenchEntityMergeAttestationFromFiles({
    attestationPath: paths.entityMergeAttestation,
    manifestPath: paths.manifest,
    resultsDirectory: paths.resultsDir,
    canonicalEntitiesPath: paths.canonicalEntities,
    canonicalEntryPoliciesPath: paths.canonicalEntryPolicies
  });
  if (resolve(mergeReplay.manifest.plan.path) !== paths.plan) {
    throw new Error("french-entity-mentions-plan-path-mismatch");
  }
  const plan = readJson<FrenchEntityCanonicalizationPlan>(paths.plan, "plan");
  const canonicalEntities = readJsonl<FrenchCanonicalEntityRecord>(
    paths.canonicalEntities,
    "canonical-entities"
  );
  const canonicalEntryPolicies = readJsonl<FrenchCanonicalEntryNamePolicy>(
    paths.canonicalEntryPolicies,
    "canonical-entry-policies"
  );
  const packets = readJsonl<LexiconV3FrenchPacket>(paths.packets, "packets");
  const terminalMerge =
    "quarantinedUnitIds" in mergeReplay.merged ? mergeReplay.merged : null;
  const unitById = new Map(
    plan.reviewUnits.map((unit) => [unit.unitId, unit] as const)
  );
  const quarantinedEntryKeys = terminalMerge
    ? terminalMerge.quarantinedUnitIds.flatMap((unitId) => {
        const unit = unitById.get(unitId);
        if (!unit) {
          throw new Error(
            `french-entity-mentions-quarantine-unit-missing:${unitId}`
          );
        }
        return unit.reviewEntryKeys;
      })
    : [];
  const replay = replayFrenchEntityPipeline({
    plan,
    canonicalEntities,
    canonicalEntryPolicies,
    packets,
    ...(terminalMerge ? { terminalGate: terminalMerge.gate } : {}),
    quarantinedEntryKeys,
    expectations: FRENCH_ENTITY_CANONICALIZATION_DEFAULT_EXPECTATIONS,
    allowBlockingMentions: true
  });
  const entityGate = replay.entityGate;
  let entityMentions = replay.entityMentions;
  let mentionResolutionAttestation: FrenchEntityMentionResolutionAttestation | null =
    null;
  if (entityMentions.blockingMentionIds.length > 0) {
    if (
      !paths.mentionResolutionArtifact ||
      !paths.mentionResolutionAttestation
    ) {
      throw new Error("french-entity-mentions-resolution-required");
    }
    entityMentions = readJson<FrenchEntityMentionsArtifact>(
      paths.mentionResolutionArtifact,
      "mention-resolution-artifact"
    );
    mentionResolutionAttestation =
      readJson<FrenchEntityMentionResolutionAttestation>(
        paths.mentionResolutionAttestation,
        "mention-resolution-attestation"
      );
    assertFrenchEntityPipelineArtifacts({
      entityGate,
      entityMentions,
      canonicalEntities,
      canonicalEntryPolicies,
      packets,
      quarantinedEntryKeys,
      mentionResolutionAttestation
    });
  } else if (
    paths.mentionResolutionArtifact ||
    paths.mentionResolutionAttestation
  ) {
    throw new Error("french-entity-mentions-unexpected-resolution");
  }
  const gateBody = `${canonicalFrenchEntityJson(entityGate)}\n`;
  const mentionsBody = `${canonicalFrenchInternalJson(entityMentions)}\n`;
  const entityGateHash = sha256(gateBody);
  const entityMentionsHash = sha256(mentionsBody);
  // Replaying the same sealed plan must produce byte-identical outputs. An
  // explicit timestamp remains available for controlled rebuilds, otherwise
  // inherit the plan timestamp instead of consulting the wall clock.
  const generatedAt = options.generatedAt ?? plan.generatedAt;
  const summary = finalizeFrenchEntityPipelineSummary({
    generatedAt,
    sourcePaths: {
      plan: paths.plan,
      entityMergeAttestation: paths.entityMergeAttestation,
      canonicalEntities: paths.canonicalEntities,
      canonicalEntryPolicies: paths.canonicalEntryPolicies,
      packets: paths.packets,
      mentionResolutionArtifact: paths.mentionResolutionArtifact ?? null,
      mentionResolutionAttestation: paths.mentionResolutionAttestation ?? null
    },
    sourceHashes: {
      plan: sha256File(paths.plan),
      entityMergeAttestation: sha256File(paths.entityMergeAttestation),
      canonicalEntities: sha256File(paths.canonicalEntities),
      canonicalEntryPolicies: sha256File(paths.canonicalEntryPolicies),
      packets: sha256File(paths.packets),
      mentionResolutionArtifact: paths.mentionResolutionArtifact
        ? sha256File(paths.mentionResolutionArtifact)
        : null,
      mentionResolutionAttestation: paths.mentionResolutionAttestation
        ? sha256File(paths.mentionResolutionAttestation)
        : null
    },
    outputPaths: {
      entityGate: paths.entityGate,
      entityMentions: paths.output,
      summary: paths.summary
    },
    outputHashes: {
      entityGate: entityGateHash,
      entityMentions: entityMentionsHash
    },
    lineage: {
      planHash: plan.planHash,
      releaseKey: plan.sourceLineage.releaseKey,
      releaseSnapshotFingerprint: plan.sourceLineage.releaseSnapshotFingerprint,
      entityMergeAttestationHash: mergeReplay.attestation.attestationHash,
      entityGateHash: entityGate.gateHash,
      entityMentionsHash: entityMentions.contentHash,
      mentionResolutionAttestationHash:
        mentionResolutionAttestation?.attestationHash ?? null
    },
    counts: {
      packets: packets.length,
      canonicalEntities: canonicalEntities.length,
      canonicalEntryPolicies: canonicalEntryPolicies.length,
      requiredEntityMentions: entityMentions.requiredEntityMentions.length,
      exactEntityMentions: entityMentions.requiredEntityMentions.filter(
        (mention) => mention.resolution === "exact"
      ).length,
      contextualEntityMentions: entityMentions.requiredEntityMentions.filter(
        (mention) => mention.resolution === "contextual"
      ).length,
      nonEntityMentions: entityMentions.requiredEntityMentions.filter(
        (mention) => mention.resolution === "non-entity"
      ).length,
      quarantinedEntityMentions: entityMentions.requiredEntityMentions.filter(
        (mention) => mention.resolution === "quarantined"
      ).length,
      blockingEntityMentions: 0
    }
  });
  const summaryBody = `${JSON.stringify(summary, null, 2)}\n`;
  writeFilesAtomically([
    { path: paths.entityGate, body: gateBody },
    { path: paths.output, body: mentionsBody },
    { path: paths.summary, body: summaryBody }
  ]);
  return { entityGateHash, entityMentionsHash, summary };
}

function assertDistinctPaths(
  paths: Omit<FrenchEntityMentionsCliOptions, "generatedAt">
): void {
  const inputs = new Set([
    paths.plan,
    paths.manifest,
    paths.resultsDir,
    paths.entityMergeAttestation,
    paths.canonicalEntities,
    paths.canonicalEntryPolicies,
    paths.packets,
    ...(paths.mentionResolutionArtifact
      ? [paths.mentionResolutionArtifact]
      : []),
    ...(paths.mentionResolutionAttestation
      ? [paths.mentionResolutionAttestation]
      : [])
  ]);
  const outputs = [paths.entityGate, paths.output, paths.summary];
  if (
    inputs.size !==
      7 +
        (paths.mentionResolutionArtifact ? 1 : 0) +
        (paths.mentionResolutionAttestation ? 1 : 0) ||
    new Set(outputs).size !== outputs.length ||
    outputs.some((path) => inputs.has(path))
  ) {
    throw new Error("french-entity-mentions-path-collision");
  }
}

function readJson<T>(path: string, label: string): T {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    throw new Error(`french-entity-mentions-invalid-json:${label}`);
  }
}

function readJsonl<T>(path: string, label: string): T[] {
  const body = readFileSync(path, "utf8");
  const records: T[] = [];
  for (const [index, line] of body.split(/\r?\n/u).entries()) {
    if (!line.length && index === body.split(/\r?\n/u).length - 1) continue;
    if (!line.trim()) {
      throw new Error(
        `french-entity-mentions-blank-jsonl:${label}:${index + 1}`
      );
    }
    try {
      records.push(JSON.parse(line) as T);
    } catch {
      throw new Error(
        `french-entity-mentions-invalid-jsonl:${label}:${index + 1}`
      );
    }
  }
  if (records.length === 0) {
    throw new Error(`french-entity-mentions-empty-jsonl:${label}`);
  }
  return records;
}

function writeFilesAtomically(
  files: readonly { path: string; body: string }[]
): void {
  const temporary = files.map((file) => `${file.path}.tmp-${process.pid}`);
  const backups = files.map((file) => `${file.path}.bak-${process.pid}`);
  const existed = files.map((file) => existsSync(file.path));
  let installed = 0;
  let backedUp = 0;
  try {
    files.forEach((file, index) => {
      mkdirSync(dirname(file.path), { recursive: true });
      rmSync(temporary[index]!, { force: true });
      rmSync(backups[index]!, { force: true });
      writeFileSync(temporary[index]!, file.body, {
        encoding: "utf8",
        flag: "wx"
      });
    });
    files.forEach((file, index) => {
      if (existed[index]) {
        renameSync(file.path, backups[index]!);
      }
      backedUp = index + 1;
    });
    files.forEach((file, index) => {
      renameSync(temporary[index]!, file.path);
      installed = index + 1;
    });
    backups.forEach((backup) => rmSync(backup, { force: true }));
  } catch (error) {
    temporary.forEach((path) => rmSync(path, { force: true }));
    for (let index = 0; index < installed; index += 1) {
      rmSync(files[index]!.path, { force: true });
    }
    for (let index = 0; index < backedUp; index += 1) {
      if (existed[index] && existsSync(backups[index]!)) {
        renameSync(backups[index]!, files[index]!.path);
      }
    }
    backups.forEach((backup) => rmSync(backup, { force: true }));
    throw error;
  }
}

function sha256File(path: string): string {
  return sha256(readFileSync(path));
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function main(): void {
  const result = buildLexiconV3FrenchEntityMentions(
    parseFrenchEntityMentionsArgs(process.argv.slice(2))
  );
  process.stdout.write(`${JSON.stringify(result.summary, null, 2)}\n`);
}

const invoked = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === invoked) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `${basename(process.argv[1] ?? "buildLexiconV3FrenchEntityMentions")}: ${message}\n`
    );
    process.exitCode = 1;
  }
}
