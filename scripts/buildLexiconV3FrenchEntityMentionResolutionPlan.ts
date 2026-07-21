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
  buildFrenchEntityMentionResolutionPlan,
  type FrenchEntityMentionResolutionPlan
} from "../src/lexiconV3/frenchEntityMentionResolution.js";
import { buildFrenchEntityMentions } from "../src/lexiconV3/frenchEntityMentions.js";
import { buildFrenchEntityMentionsInputFromPackets } from "../src/lexiconV3/frenchEntityPipeline.js";
import { canonicalFrenchInternalJson } from "../src/lexiconV3/frenchCodexExecutionReceipt.js";
import type {
  FrenchCanonicalEntityRecord,
  FrenchCanonicalEntryNamePolicy
} from "../src/lexiconV3/frenchEntityCanonicalization.js";
import type { LexiconV3FrenchPacket } from "../src/lexiconV3/frenchPackets.js";

interface QuarantineRecord {
  reviewEntryKeys: string[];
}

export interface FrenchEntityMentionResolutionPlanCliOptions {
  packets: string;
  canonicalEntities: string;
  canonicalPolicies: string;
  quarantine: string;
  rawMentions: string;
  plan: string;
}

export function buildLexiconV3FrenchEntityMentionResolutionPlan(
  options: FrenchEntityMentionResolutionPlanCliOptions
): FrenchEntityMentionResolutionPlan {
  const packets = readJsonl<LexiconV3FrenchPacket>(options.packets);
  const canonicalEntities = readJsonl<FrenchCanonicalEntityRecord>(
    options.canonicalEntities
  );
  const canonicalPolicies = readJsonl<FrenchCanonicalEntryNamePolicy>(
    options.canonicalPolicies
  );
  const quarantine = readJsonl<QuarantineRecord>(options.quarantine);
  const quarantinedEntryKeys = [
    ...new Set(quarantine.flatMap((record) => record.reviewEntryKeys))
  ].sort(compareText);
  const mentions = buildFrenchEntityMentions(
    buildFrenchEntityMentionsInputFromPackets({
      packets,
      canonicalEntities,
      canonicalEntryPolicies: canonicalPolicies,
      quarantinedEntryKeys
    })
  );
  const plan = buildFrenchEntityMentionResolutionPlan({
    mentions,
    packets,
    canonicalPolicies
  });
  writeAtomically(
    resolve(options.rawMentions),
    `${canonicalFrenchInternalJson(mentions)}\n`
  );
  writeAtomically(
    resolve(options.plan),
    `${canonicalFrenchInternalJson(plan)}\n`
  );
  process.stdout.write(
    `${JSON.stringify(
      {
        rawMentions: resolve(options.rawMentions),
        plan: resolve(options.plan),
        totalMentions: mentions.requiredEntityMentions.length,
        contextualMentions: plan.counts.contextualMentions,
        contextualSourceEntries: plan.counts.sourceEntries,
        blockingMentions: mentions.blockingMentionIds.length,
        mentionsHash: mentions.contentHash,
        planHash: plan.planHash
      },
      null,
      2
    )}\n`
  );
  return plan;
}

export function parseFrenchEntityMentionResolutionPlanArgs(
  args: readonly string[]
): FrenchEntityMentionResolutionPlanCliOptions {
  const values = new Map<string, string>();
  const allowed = new Set([
    "packets",
    "canonical-entities",
    "canonical-policies",
    "quarantine",
    "raw-mentions",
    "plan"
  ]);
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index] ?? "";
    if (!token.startsWith("--")) {
      throw new Error(`french-mention-plan-unexpected-argument:${token}`);
    }
    const [key, inline] = token.slice(2).split("=", 2);
    if (!allowed.has(key) || values.has(key)) {
      throw new Error(`french-mention-plan-invalid-option:${key}`);
    }
    const value = inline ?? args[index + 1];
    if (!value || (!inline && value.startsWith("--"))) {
      throw new Error(`french-mention-plan-missing-value:${key}`);
    }
    values.set(key, value);
    if (inline === undefined) index += 1;
  }
  const required = (key: string): string => {
    const value = values.get(key);
    if (!value) throw new Error(`french-mention-plan-required:${key}`);
    return resolve(value);
  };
  return {
    packets: required("packets"),
    canonicalEntities: required("canonical-entities"),
    canonicalPolicies: required("canonical-policies"),
    quarantine: required("quarantine"),
    rawMentions: required("raw-mentions"),
    plan: required("plan")
  };
}

function readJsonl<T>(pathValue: string): T[] {
  return readFileSync(resolve(pathValue), "utf8")
    .split(/\r?\n/u)
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line) as T;
      } catch {
        throw new Error(
          `french-mention-plan-invalid-jsonl:${basename(pathValue)}:${index + 1}`
        );
      }
    });
}

function writeAtomically(path: string, body: string): void {
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path)) {
    const existing = readFileSync(path, "utf8");
    if (sha256(existing) === sha256(body)) return;
    throw new Error(`french-mention-plan-output-drift:${path}`);
  }
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
  try {
    writeFileSync(temporary, body, { encoding: "utf8", flag: "wx" });
    renameSync(temporary, path);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) {
  try {
    buildLexiconV3FrenchEntityMentionResolutionPlan(
      parseFrenchEntityMentionResolutionPlanArgs(process.argv.slice(2))
    );
  } catch (error) {
    process.stderr.write(
      `${basename(process.argv[1] ?? "buildLexiconV3FrenchEntityMentionResolutionPlan")}: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  }
}
