import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  assertFrenchEntityMentionResolutionPlan,
  FRENCH_ENTITY_MENTION_DECISION_SCHEMA_VERSION,
  FRENCH_ENTITY_MENTION_RESOLUTION_POLICY_VERSION,
  type FrenchEntityMentionResolutionPlan,
  type FrenchEntityMentionResolutionUnit
} from "../src/lexiconV3/frenchEntityMentionResolution.js";
import {
  canonicalFrenchInternalJson,
  hashFrenchInternalJson
} from "../src/lexiconV3/frenchCodexExecutionReceipt.js";

export const FRENCH_ENTITY_MENTION_BATCH_MANIFEST_SCHEMA_VERSION =
  "lexicon-v3-french-entity-mention-batch-manifest@1" as const;

export interface FrenchEntityMentionAgentBatchRecord {
  batchId: string;
  unitIds: string[];
  inputPath: string;
  inputSha256: string;
  inputHash: string;
  schemaPath: string;
  schemaSha256: string;
  batchHash: string;
}

export interface FrenchEntityMentionAgentBatchManifest {
  schemaVersion: typeof FRENCH_ENTITY_MENTION_BATCH_MANIFEST_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_ENTITY_MENTION_RESOLUTION_POLICY_VERSION;
  namespace: "/fr-internal/entity-mentions";
  planPath: string;
  planSha256: string;
  planHash: string;
  counts: { units: number; batches: number };
  batches: FrenchEntityMentionAgentBatchRecord[];
  manifestHash: string;
}

interface CliOptions {
  plan: string;
  outputDir: string;
  maxUnits: number;
  maxInputBytes: number;
}

export function buildLexiconV3FrenchEntityMentionAgentBatches(
  options: CliOptions
): FrenchEntityMentionAgentBatchManifest {
  const planPath = resolve(options.plan);
  const planText = readFileSync(planPath, "utf8");
  const plan = JSON.parse(planText) as FrenchEntityMentionResolutionPlan;
  assertFrenchEntityMentionResolutionPlan(plan);
  const groups = chunkUnits(
    plan.units,
    options.maxUnits,
    options.maxInputBytes
  );
  const outputDir = resolve(options.outputDir);
  if (existsSync(outputDir)) {
    const manifest = JSON.parse(
      readFileSync(join(outputDir, "manifest.json"), "utf8")
    ) as FrenchEntityMentionAgentBatchManifest;
    assertManifest(manifest);
    if (manifest.planHash !== plan.planHash) {
      throw new Error("french-mention-batches-existing-plan-drift");
    }
    return manifest;
  }
  mkdirSync(dirname(outputDir), { recursive: true });
  const temporary = `${outputDir}.tmp-${process.pid}-${Date.now()}`;
  mkdirSync(temporary, { recursive: false });
  try {
    const batches = groups.map((units, index) => {
      const batchId = `mention-${String(index + 1).padStart(4, "0")}`;
      const batchDir = join(temporary, batchId);
      mkdirSync(batchDir, { recursive: false });
      const input = {
        schemaVersion: "lexicon-v3-french-entity-mention-agent-input@1",
        policyVersion: FRENCH_ENTITY_MENTION_RESOLUTION_POLICY_VERSION,
        planHash: plan.planHash,
        batchId,
        units
      };
      const inputText = `${canonicalFrenchInternalJson(input)}\n`;
      const schemaText = `${JSON.stringify(decisionSchema(units), null, 2)}\n`;
      const inputPath = join(batchDir, "input.json");
      const schemaPath = join(batchDir, "decision.schema.json");
      writeFileSync(inputPath, inputText, { encoding: "utf8", flag: "wx" });
      writeFileSync(schemaPath, schemaText, { encoding: "utf8", flag: "wx" });
      const content = {
        batchId,
        unitIds: units.map((unit) => unit.unitId),
        inputPath: join(outputDir, relative(temporary, inputPath)),
        inputSha256: sha256(inputText),
        inputHash: hashFrenchInternalJson(input),
        schemaPath: join(outputDir, relative(temporary, schemaPath)),
        schemaSha256: sha256(schemaText)
      };
      return {
        ...content,
        batchHash: hashFrenchInternalJson(content)
      } satisfies FrenchEntityMentionAgentBatchRecord;
    });
    const withoutHash = {
      schemaVersion: FRENCH_ENTITY_MENTION_BATCH_MANIFEST_SCHEMA_VERSION,
      policyVersion: FRENCH_ENTITY_MENTION_RESOLUTION_POLICY_VERSION,
      namespace: "/fr-internal/entity-mentions" as const,
      planPath,
      planSha256: sha256(planText),
      planHash: plan.planHash,
      counts: { units: plan.units.length, batches: batches.length },
      batches
    };
    const manifest = {
      ...withoutHash,
      manifestHash: hashFrenchInternalJson(withoutHash)
    };
    writeFileSync(
      join(temporary, "manifest.json"),
      `${canonicalFrenchInternalJson(manifest)}\n`,
      { encoding: "utf8", flag: "wx" }
    );
    renameSync(temporary, outputDir);
    assertManifest(manifest);
    process.stdout.write(
      `${JSON.stringify(
        {
          outputDir,
          units: manifest.counts.units,
          batches: manifest.counts.batches,
          manifestHash: manifest.manifestHash
        },
        null,
        2
      )}\n`
    );
    return manifest;
  } catch (error) {
    rmSync(temporary, { recursive: true, force: true });
    throw error;
  }
}

export function assertFrenchEntityMentionAgentBatchManifest(
  manifest: FrenchEntityMentionAgentBatchManifest
): void {
  assertManifest(manifest);
}

function chunkUnits(
  units: readonly FrenchEntityMentionResolutionUnit[],
  maxUnits: number,
  maxInputBytes: number
): FrenchEntityMentionResolutionUnit[][] {
  const groups: FrenchEntityMentionResolutionUnit[][] = [];
  let current: FrenchEntityMentionResolutionUnit[] = [];
  for (const unit of units) {
    const next = [...current, unit];
    const bytes = Buffer.byteLength(
      canonicalFrenchInternalJson({ units: next })
    );
    if (
      current.length > 0 &&
      (next.length > maxUnits || bytes > maxInputBytes)
    ) {
      groups.push(current);
      current = [unit];
    } else {
      current = next;
    }
    if (
      Buffer.byteLength(canonicalFrenchInternalJson({ units: current })) >
      maxInputBytes
    ) {
      throw new Error(`french-mention-batches-unit-too-large:${unit.unitId}`);
    }
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

function decisionSchema(
  units: readonly FrenchEntityMentionResolutionUnit[]
): object {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    additionalProperties: false,
    required: ["decisions"],
    properties: {
      decisions: {
        type: "array",
        minItems: units.length,
        maxItems: units.length,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "schemaVersion",
            "policyVersion",
            "role",
            "unitId",
            "inputHash",
            "disposition",
            "selectedEntryKey",
            "reasonCodes",
            "rationale",
            "confidence"
          ],
          properties: {
            schemaVersion: {
              type: "string",
              enum: [FRENCH_ENTITY_MENTION_DECISION_SCHEMA_VERSION]
            },
            policyVersion: {
              type: "string",
              enum: [FRENCH_ENTITY_MENTION_RESOLUTION_POLICY_VERSION]
            },
            role: {
              type: "string",
              enum: ["proposerA", "proposerB", "arbiter"]
            },
            unitId: {
              type: "string",
              enum: units.map((unit) => unit.unitId)
            },
            inputHash: {
              type: "string",
              enum: units.map((unit) => unit.inputHash)
            },
            disposition: {
              type: "string",
              enum: ["select", "non-entity", "policy-repair", "quarantine"]
            },
            selectedEntryKey: {
              anyOf: [
                {
                  type: "string",
                  enum: [
                    ...new Set(
                      units.flatMap((unit) =>
                        unit.candidates.map((candidate) => candidate.entryKey)
                      )
                    )
                  ]
                },
                { type: "null" }
              ]
            },
            reasonCodes: {
              type: "array",
              items: { type: "string", minLength: 1 }
            },
            rationale: { type: "string" },
            confidence: { type: "number", minimum: 0, maximum: 1 }
          }
        }
      }
    }
  };
}

function assertManifest(manifest: FrenchEntityMentionAgentBatchManifest): void {
  const { manifestHash, ...content } = manifest;
  if (
    manifest.schemaVersion !==
      FRENCH_ENTITY_MENTION_BATCH_MANIFEST_SCHEMA_VERSION ||
    manifest.policyVersion !==
      FRENCH_ENTITY_MENTION_RESOLUTION_POLICY_VERSION ||
    manifest.namespace !== "/fr-internal/entity-mentions" ||
    !/^[a-f0-9]{64}$/u.test(manifest.planSha256) ||
    !/^[a-f0-9]{64}$/u.test(manifest.planHash) ||
    manifest.counts.units !==
      manifest.batches.reduce((sum, batch) => sum + batch.unitIds.length, 0) ||
    manifest.counts.batches !== manifest.batches.length ||
    hashFrenchInternalJson(content) !== manifestHash
  ) {
    throw new Error("french-mention-batches-manifest-invalid");
  }
}

function parseArgs(args: readonly string[]): CliOptions {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index] ?? "";
    const [key, inline] = token.startsWith("--")
      ? token.slice(2).split("=", 2)
      : ["", ""];
    if (!key || values.has(key))
      throw new Error(`french-mention-batches-option:${token}`);
    const value = inline ?? args[index + 1];
    if (!value || (!inline && value.startsWith("--"))) {
      throw new Error(`french-mention-batches-value:${key}`);
    }
    values.set(key, value);
    if (inline === undefined) index += 1;
  }
  const required = (key: string): string => {
    const value = values.get(key);
    if (!value) throw new Error(`french-mention-batches-required:${key}`);
    return resolve(value);
  };
  return {
    plan: required("plan"),
    outputDir: required("output-dir"),
    maxUnits: positiveInteger(values.get("max-units") ?? "12", "max-units"),
    maxInputBytes: positiveInteger(
      values.get("max-input-bytes") ?? "160000",
      "max-input-bytes"
    )
  };
}

function positiveInteger(value: string, label: string): number {
  if (!/^[1-9]\d*$/u.test(value))
    throw new Error(`french-mention-batches-${label}`);
  return Number(value);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) {
  try {
    buildLexiconV3FrenchEntityMentionAgentBatches(
      parseArgs(process.argv.slice(2))
    );
  } catch (error) {
    process.stderr.write(
      `${basename(process.argv[1] ?? "buildLexiconV3FrenchEntityMentionAgentBatches")}: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  }
}
