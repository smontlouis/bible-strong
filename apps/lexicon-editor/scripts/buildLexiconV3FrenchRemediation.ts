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

import { readFrenchInternalPackets } from "./assembleLexiconV3FrenchInternalReview.js";
import {
  assertFrenchInternalRemediationPlan,
  buildFrenchInternalRemediationPlan,
  frenchInternalRemediationPacketLogicalDigest,
  frenchInternalRemediationReviewLogicalDigest,
  type FrenchInternalRemediationPlan,
  type FrenchInternalRemediationSourceArtifact
} from "../src/lexiconV3/frenchInternalRemediation.js";
import type { FrenchInternalReviewRecord } from "../src/lexiconV3/frenchInternalReview.js";
import type { LexiconV3FrenchPacket } from "../src/lexiconV3/frenchPackets.js";
import {
  assertFrenchEntityMentionsArtifact,
  type FrenchEntityMentionsArtifact
} from "../src/lexiconV3/frenchEntityMentions.js";

const DEFAULT_PACKETS = "outputs/lexicon-v3/fr-internal/french-packets.jsonl";
const DEFAULT_REVIEWS = "outputs/lexicon-v3/fr-internal/french-review.jsonl";
const DEFAULT_OUTPUT =
  "outputs/lexicon-v3/fr-internal/remediation/round-001/plan.json";

export interface BuildLexiconV3FrenchRemediationOptions {
  packetsPath: string;
  reviewsPath: string;
  entityMentionsPath?: string;
  outputPath: string;
  round: number;
  maxRounds: number;
}

export function buildLexiconV3FrenchRemediation(
  options: BuildLexiconV3FrenchRemediationOptions
): FrenchInternalRemediationPlan {
  assertRequiredFile(options.packetsPath, "packets");
  assertRequiredFile(options.reviewsPath, "reviews");
  if (options.entityMentionsPath) {
    assertRequiredFile(options.entityMentionsPath, "entity-mentions");
  }
  const packets = readFrenchInternalPackets(options.packetsPath).records;
  const reviews = readFrenchInternalReviewRecords(options.reviewsPath);
  const entityMentions = options.entityMentionsPath
    ? readFrenchEntityMentions(options.entityMentionsPath)
    : undefined;
  const sources = {
    packets: frenchInternalRemediationPacketSource(
      options.packetsPath,
      packets
    ),
    reviews: frenchInternalRemediationReviewSource(options.reviewsPath, reviews)
  };
  const plan = buildFrenchInternalRemediationPlan({
    round: options.round,
    maxRounds: options.maxRounds,
    packets,
    reviews,
    requiredEntityMentions: entityMentions?.requiredEntityMentions,
    sources
  });
  assertFrenchInternalRemediationPlan(plan, {
    packets,
    reviews,
    requiredEntityMentions: entityMentions?.requiredEntityMentions,
    sources
  });
  installTextContentAddressed(
    options.outputPath,
    `${JSON.stringify(plan, null, 2)}\n`
  );
  const installed = readFrenchInternalRemediationPlan(options.outputPath);
  assertFrenchInternalRemediationPlan(installed, {
    packets,
    reviews,
    requiredEntityMentions: entityMentions?.requiredEntityMentions,
    sources
  });
  return installed;
}

export function readFrenchInternalRemediationPlan(
  path: string
): FrenchInternalRemediationPlan {
  assertRequiredFile(path, "plan");
  try {
    return JSON.parse(
      readFileSync(path, "utf8")
    ) as FrenchInternalRemediationPlan;
  } catch {
    throw new Error(`french-remediation-plan-invalid-json:${resolve(path)}`);
  }
}

export function readFrenchInternalReviewRecords(
  path: string,
  options: { allowEmpty?: boolean } = {}
): FrenchInternalReviewRecord[] {
  assertRequiredFile(path, "review");
  const records: FrenchInternalReviewRecord[] = [];
  for (const [index, line] of readFileSync(path, "utf8")
    .split(/\r?\n/u)
    .entries()) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line) as FrenchInternalReviewRecord);
    } catch {
      throw new Error(
        `french-remediation-review-invalid-json:${resolve(path)}:${index + 1}`
      );
    }
  }
  if (records.length === 0 && !options.allowEmpty) {
    throw new Error(`french-remediation-review-empty:${resolve(path)}`);
  }
  return records;
}

function readFrenchEntityMentions(path: string): FrenchEntityMentionsArtifact {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error(
      `french-remediation-entity-mentions-invalid-json:${resolve(path)}`
    );
  }
  assertFrenchEntityMentionsArtifact(value);
  return value;
}

export function frenchInternalRemediationPacketSource(
  path: string,
  packets: readonly LexiconV3FrenchPacket[]
): FrenchInternalRemediationSourceArtifact {
  return {
    path: resolve(path),
    sha256: sha256File(path),
    records: packets.length,
    logicalDigest: frenchInternalRemediationPacketLogicalDigest(packets)
  };
}

export function frenchInternalRemediationReviewSource(
  path: string,
  reviews: readonly FrenchInternalReviewRecord[]
): FrenchInternalRemediationSourceArtifact {
  return {
    path: resolve(path),
    sha256: sha256File(path),
    records: reviews.length,
    logicalDigest: frenchInternalRemediationReviewLogicalDigest(reviews)
  };
}

export function assertFrenchInternalRemediationSourceFile(
  source: FrenchInternalRemediationSourceArtifact,
  label: string
): void {
  if (
    resolve(source.path) !== source.path ||
    !existsSync(source.path) ||
    sha256File(source.path) !== source.sha256
  ) {
    throw new Error(`french-remediation-${label}-source-file-stale`);
  }
}

export function installTextContentAddressed(path: string, text: string): void {
  const output = resolve(path);
  mkdirSync(dirname(output), { recursive: true });
  if (existsSync(output)) {
    if (readFileSync(output, "utf8") === text) return;
    throw new Error(`french-remediation-output-stale:${output}`);
  }
  const temporary = `${output}.tmp-${process.pid}-${Date.now()}`;
  rmSync(temporary, { force: true });
  try {
    writeFileSync(temporary, text, "utf8");
    renameSync(temporary, output);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}

export function parseBuildLexiconV3FrenchRemediationArgs(
  args: readonly string[]
): BuildLexiconV3FrenchRemediationOptions {
  const values = new Map<string, string>();
  const allowed = new Set([
    "packets",
    "reviews",
    "entity-mentions",
    "output",
    "round",
    "max-rounds"
  ]);
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index] ?? "";
    if (!token.startsWith("--"))
      throw new Error(`unexpected-argument:${token}`);
    const key = token.slice(2);
    if (!allowed.has(key)) throw new Error(`unknown-option:${key}`);
    if (values.has(key)) throw new Error(`duplicate-option:${key}`);
    const value = args[index + 1];
    if (!value || value.startsWith("--"))
      throw new Error(`missing-value:${key}`);
    values.set(key, value);
    index += 1;
  }
  return {
    packetsPath: resolve(values.get("packets") ?? DEFAULT_PACKETS),
    reviewsPath: resolve(values.get("reviews") ?? DEFAULT_REVIEWS),
    ...(values.has("entity-mentions")
      ? { entityMentionsPath: resolve(values.get("entity-mentions")!) }
      : {}),
    outputPath: resolve(values.get("output") ?? DEFAULT_OUTPUT),
    round: Number(values.get("round") ?? 1),
    maxRounds: Number(values.get("max-rounds") ?? 3)
  };
}

function assertRequiredFile(path: string, label: string): void {
  if (!existsSync(path)) {
    throw new Error(`french-remediation-${label}-missing:${resolve(path)}`);
  }
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  try {
    const plan = buildLexiconV3FrenchRemediation(
      parseBuildLexiconV3FrenchRemediationArgs(process.argv.slice(2))
    );
    process.stdout.write(
      `${JSON.stringify(
        {
          event: "french-remediation-plan-built",
          round: plan.round,
          maxRounds: plan.maxRounds,
          selected: plan.counts.selected,
          planHash: plan.planHash
        },
        null,
        2
      )}\n`
    );
  } catch (error) {
    process.stderr.write(
      `${basename(process.argv[1] ?? "buildLexiconV3FrenchRemediation")}: ${
        error instanceof Error ? error.message : String(error)
      }\n`
    );
    process.exitCode = 1;
  }
}
