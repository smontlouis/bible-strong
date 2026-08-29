import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  FRENCH_INTERNAL_DEFAULT_EXPECTATIONS,
  runFrenchInternalWork,
  writeFrenchInternalPilotViews,
  type FrenchInternalMeaningSize,
  type FrenchInternalSourcePaths,
  type FrenchInternalWorkOutputPaths
} from "../src/lexiconV3/frenchInternalWork.js";

const DEFAULT_PACKETS = "outputs/lexicon-v3/fr-internal/french-packets.jsonl";
const DEFAULT_PACKET_SUMMARY =
  "outputs/lexicon-v3/fr-internal/french-packets.summary.json";
const DEFAULT_REUSE_RECORDS =
  "outputs/lexicon-v3/french-reuse/french-reuse.records.jsonl";
const DEFAULT_REUSE_SUMMARY =
  "outputs/lexicon-v3/french-reuse/french-reuse.summary.json";
const DEFAULT_EDITORIAL_DIR = "outputs/lexicon-v3/french-editorial";
const DEFAULT_ENTITY_DIR = "outputs/lexicon-v3/french-entities/resolved";
const DEFAULT_GUIDE = "src/lexiconV3/sources/french-editorial-guide.json";
const DEFAULT_OUTPUT_DIR = "outputs/lexicon-v3/fr-internal/work";

export interface FrenchInternalWorkCliOptions {
  sourcePaths: FrenchInternalSourcePaths;
  outputPaths: FrenchInternalWorkOutputPaths;
  generatedAt?: string;
  shardBatchSizes?: Partial<Record<FrenchInternalMeaningSize, number>>;
}

export function parseFrenchInternalWorkArgs(
  args: readonly string[]
): FrenchInternalWorkCliOptions {
  const allowed = new Set([
    "packets",
    "packet-summary",
    "reuse-records",
    "reuse-summary",
    "entity-registry",
    "canonical-entities",
    "canonical-entry-policies",
    "entity-merge-attestation",
    "entity-gate",
    "entity-mentions",
    "entity-mention-resolution-attestation",
    "entity-dir",
    "termbase",
    "morphology",
    "editorial-summary",
    "editorial-dir",
    "guide",
    "output-dir",
    "work-items",
    "proposer-a",
    "proposer-b",
    "pilot-keys",
    "shards",
    "summary",
    "generated-at",
    "short-batch",
    "medium-batch",
    "long-batch",
    "very-long-batch"
  ]);
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument?.startsWith("--")) {
      throw new Error(`french-internal-work-unexpected-argument:${argument}`);
    }
    const [key, inline] = argument.slice(2).split("=", 2);
    if (!allowed.has(key)) {
      throw new Error(`french-internal-work-unknown-option:${key}`);
    }
    if (values.has(key)) {
      throw new Error(`french-internal-work-duplicate-option:${key}`);
    }
    const next = args[index + 1];
    if (inline !== undefined) {
      if (!inline) {
        throw new Error(`french-internal-work-missing-option-value:${key}`);
      }
      values.set(key, inline);
    } else if (next && !next.startsWith("--")) {
      values.set(key, next);
      index += 1;
    } else {
      throw new Error(`french-internal-work-missing-option-value:${key}`);
    }
  }
  const editorialDir = resolve(
    values.get("editorial-dir") ?? DEFAULT_EDITORIAL_DIR
  );
  const outputDir = resolve(values.get("output-dir") ?? DEFAULT_OUTPUT_DIR);
  const entityDir = resolve(values.get("entity-dir") ?? DEFAULT_ENTITY_DIR);
  const shardBatchSizes = parseShardBatchSizes(values);
  return {
    sourcePaths: {
      packets: resolve(values.get("packets") ?? DEFAULT_PACKETS),
      packetSummary: resolve(
        values.get("packet-summary") ?? DEFAULT_PACKET_SUMMARY
      ),
      reuseRecords: resolve(
        values.get("reuse-records") ?? DEFAULT_REUSE_RECORDS
      ),
      reuseSummary: resolve(
        values.get("reuse-summary") ?? DEFAULT_REUSE_SUMMARY
      ),
      entityRegistry: resolve(
        values.get("entity-registry") ??
          join(editorialDir, "entity-registry.jsonl")
      ),
      canonicalEntities: resolve(
        values.get("canonical-entities") ??
          join(entityDir, "canonical-entities.jsonl")
      ),
      canonicalEntryPolicies: resolve(
        values.get("canonical-entry-policies") ??
          join(entityDir, "canonical-entry-name-policies.jsonl")
      ),
      entityMergeAttestation: resolve(
        values.get("entity-merge-attestation") ??
          join(entityDir, "entity-merge-attestation.json")
      ),
      entityGate: resolve(
        values.get("entity-gate") ?? join(entityDir, "entity-gate.json")
      ),
      entityMentions: resolve(
        values.get("entity-mentions") ??
          join(entityDir, "required-entity-mentions.json")
      ),
      entityMentionResolutionAttestation: resolve(
        values.get("entity-mention-resolution-attestation") ??
          join(entityDir, "entity-mention-resolution-attestation.json")
      ),
      termbase: resolve(
        values.get("termbase") ??
          join(editorialDir, "termbase-candidates.jsonl")
      ),
      morphology: resolve(
        values.get("morphology") ??
          join(editorialDir, "morphology-translations.jsonl")
      ),
      editorialSummary: resolve(
        values.get("editorial-summary") ?? join(editorialDir, "summary.json")
      ),
      guide: resolve(values.get("guide") ?? DEFAULT_GUIDE)
    },
    outputPaths: {
      workItems: resolve(
        values.get("work-items") ?? join(outputDir, "work-items.jsonl")
      ),
      proposerA: resolve(
        values.get("proposer-a") ?? join(outputDir, "proposer-a-input.jsonl")
      ),
      proposerB: resolve(
        values.get("proposer-b") ?? join(outputDir, "proposer-b-input.jsonl")
      ),
      pilotKeys: resolve(
        values.get("pilot-keys") ?? join(outputDir, "pilot-keys.json")
      ),
      shards: resolve(values.get("shards") ?? join(outputDir, "shards.json")),
      summary: resolve(values.get("summary") ?? join(outputDir, "summary.json"))
    },
    ...(values.get("generated-at")
      ? { generatedAt: values.get("generated-at") }
      : {}),
    ...(shardBatchSizes ? { shardBatchSizes } : {})
  };
}

export function runFrenchInternalWorkCli(
  options: FrenchInternalWorkCliOptions
): void {
  const build = runFrenchInternalWork({
    ...options,
    expectations: FRENCH_INTERNAL_DEFAULT_EXPECTATIONS,
    pilotSize: FRENCH_INTERNAL_DEFAULT_EXPECTATIONS.expectedPilotSize
  });
  const pilotViews = writeFrenchInternalPilotViews(build);
  process.stdout.write(
    `${JSON.stringify(
      {
        workItems: build.summary.counts.workItems,
        proposerAViews: build.summary.counts.proposerAViews,
        proposerBViews: build.summary.counts.proposerBViews,
        pilotKeys: build.summary.counts.pilotKeys,
        shards: build.summary.counts.shards,
        sourceLogicalDigest: build.summary.lineage.sourceLogicalDigest,
        workItemsDigest: build.summary.artifacts.workItems.sha256,
        proposerAOutputDigest: build.summary.artifacts.proposerA.sha256,
        proposerBOutputDigest: build.summary.artifacts.proposerB.sha256,
        pilotProposerAOutputDigest: pilotViews.proposerA.sha256,
        pilotProposerBOutputDigest: pilotViews.proposerB.sha256,
        summaryHash: build.summary.summaryHash,
        outputPaths: build.summary.outputPaths,
        pilotViewOutputPaths: pilotViews.outputPaths
      },
      null,
      2
    )}\n`
  );
}

function parseShardBatchSizes(
  values: Map<string, string>
): Partial<Record<FrenchInternalMeaningSize, number>> | undefined {
  const optionKeys: Array<[string, FrenchInternalMeaningSize]> = [
    ["short-batch", "short"],
    ["medium-batch", "medium"],
    ["long-batch", "long"],
    ["very-long-batch", "very_long"]
  ];
  const result: Partial<Record<FrenchInternalMeaningSize, number>> = {};
  for (const [option, size] of optionKeys) {
    const raw = values.get(option);
    if (raw === undefined) continue;
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new Error(
        `french-internal-work-invalid-batch-size:${option}:${raw}`
      );
    }
    result[size] = parsed;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) {
  try {
    runFrenchInternalWorkCli(
      parseFrenchInternalWorkArgs(process.argv.slice(2))
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `${basename(process.argv[1] ?? "buildLexiconV3FrenchInternalWork")}: ${message}\n`
    );
    process.exitCode = 1;
  }
}
