import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  assertFrenchEntityAgentBatchManifest,
  type FrenchEntityAgentBatchManifest
} from "../src/lexiconV3/frenchEntityAgentReview.js";
import {
  canonicalFrenchEntityJson,
  FRENCH_ENTITY_CANONICALIZATION_DEFAULT_EXPECTATIONS,
  type FrenchEntityCanonicalizationPlan
} from "../src/lexiconV3/frenchEntityCanonicalization.js";
import {
  assertFrenchEntityMergeAttestationV2FromFiles,
  prepareFrenchEntityMergeAttestationV2
} from "../src/lexiconV3/frenchEntityMergeAttestationV2.js";

const DEFAULT_MANIFEST =
  "outputs/lexicon-v3/french-entities/agent-batches/manifest.json";
const DEFAULT_RESULTS = "outputs/lexicon-v3/french-entities/agent-results";
const DEFAULT_OUTPUT = "outputs/lexicon-v3/french-entities/resolved";

export interface FrenchEntityAgentMergeCliOptions {
  manifest: string;
  resultsDir: string;
  outputDir: string;
  releaseKey: string;
  remediationIndex: string | null;
}

export function parseFrenchEntityAgentMergeArgs(
  args: readonly string[]
): FrenchEntityAgentMergeCliOptions {
  const allowed = new Set([
    "manifest",
    "results-dir",
    "output-dir",
    "release-key",
    "remediation-index"
  ]);
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index] ?? "";
    if (!token.startsWith("--")) {
      throw new Error(`french-entity-merge-unexpected-argument:${token}`);
    }
    const [key, inline] = token.slice(2).split("=", 2);
    if (!allowed.has(key)) {
      throw new Error(`french-entity-merge-unknown-option:${key}`);
    }
    if (values.has(key)) {
      throw new Error(`french-entity-merge-duplicate-option:${key}`);
    }
    const next = args[index + 1];
    if (inline !== undefined) {
      if (!inline) throw new Error(`french-entity-merge-missing-value:${key}`);
      values.set(key, inline);
    } else if (next && !next.startsWith("--")) {
      values.set(key, next);
      index += 1;
    } else {
      throw new Error(`french-entity-merge-missing-value:${key}`);
    }
  }
  const releaseKey = values.get("release-key")?.trim();
  if (!releaseKey) throw new Error("french-entity-merge-release-key-required");
  return {
    manifest: resolve(values.get("manifest") ?? DEFAULT_MANIFEST),
    resultsDir: resolve(values.get("results-dir") ?? DEFAULT_RESULTS),
    outputDir: resolve(values.get("output-dir") ?? DEFAULT_OUTPUT),
    releaseKey,
    remediationIndex: values.has("remediation-index")
      ? resolve(values.get("remediation-index") as string)
      : null
  };
}

export function runFrenchEntityAgentMergeCli(
  options: FrenchEntityAgentMergeCliOptions
) {
  const manifestText = readFileSync(options.manifest, "utf8");
  const manifest = JSON.parse(manifestText) as FrenchEntityAgentBatchManifest;
  const planText = readFileSync(manifest.plan.path, "utf8");
  const plan = JSON.parse(planText) as FrenchEntityCanonicalizationPlan;
  assertFrenchEntityAgentBatchManifest(
    manifest,
    plan,
    FRENCH_ENTITY_CANONICALIZATION_DEFAULT_EXPECTATIONS
  );
  if (
    manifest.plan.releaseKey !== options.releaseKey ||
    sha256(planText) !== manifest.plan.fileDigest
  ) {
    throw new Error(
      `french-entity-merge-release-mismatch:${manifest.plan.releaseKey}:${options.releaseKey}`
    );
  }
  const outputDir = resolve(options.outputDir);
  const canonicalEntitiesPath = join(outputDir, "canonical-entities.jsonl");
  const canonicalEntryPoliciesPath = join(
    outputDir,
    "canonical-entry-name-policies.jsonl"
  );
  const attestationPath = join(outputDir, "entity-merge-attestation.json");
  const finalOverlayPath = join(outputDir, "entity-final-overlay.json");
  const quarantinePath = join(outputDir, "entity-quarantine.jsonl");
  const prepared = prepareFrenchEntityMergeAttestationV2({
    manifestPath: options.manifest,
    baseResultsDirectory: options.resultsDir,
    remediationIndexPath: options.remediationIndex,
    canonicalEntitiesPath,
    canonicalEntryPoliciesPath,
    quarantinePath,
    finalOverlayPath,
    expectedReleaseKey: options.releaseKey,
    expectations: FRENCH_ENTITY_CANONICALIZATION_DEFAULT_EXPECTATIONS
  });
  const { merged, attestation } = prepared;
  const files = new Map([
    ["canonical-entities.jsonl", prepared.canonicalEntitiesText],
    [
      "canonical-entry-name-policies.jsonl",
      prepared.canonicalEntryPoliciesText
    ],
    ["entity-final-overlay.json", prepared.overlayText],
    ["entity-quarantine.jsonl", prepared.quarantineText],
    [
      "entity-merge-attestation.json",
      `${canonicalFrenchEntityJson(attestation)}\n`
    ]
  ]);
  const created = installExactly(options.outputDir, files);
  try {
    assertFrenchEntityMergeAttestationV2FromFiles({
      attestationPath,
      manifestPath: options.manifest,
      baseResultsDirectory: options.resultsDir,
      canonicalEntitiesPath,
      canonicalEntryPoliciesPath,
      quarantinePath,
      finalOverlayPath,
      expectedReleaseKey: options.releaseKey,
      expectations: FRENCH_ENTITY_CANONICALIZATION_DEFAULT_EXPECTATIONS
    });
  } catch (error) {
    if (created) {
      rmSync(resolve(options.outputDir), { recursive: true, force: true });
    }
    throw error;
  }
  process.stdout.write(
    `${JSON.stringify(
      {
        releaseKey: options.releaseKey,
        canonicalEntities: merged.canonicalEntities.length,
        entryPolicies: merged.entryPolicies.length,
        gateHash: merged.gate.gateHash,
        mergeHash: merged.mergeHash,
        attestationHash: attestation.attestationHash,
        baseRuns: attestation.counts.base.runs,
        baseReceipts: attestation.counts.base.receipts,
        remediationRounds: attestation.counts.remediation.rounds,
        remediationRuns: attestation.counts.remediation.runs,
        remediationReceipts: attestation.counts.remediation.receipts,
        outputDir: options.outputDir
      },
      null,
      2
    )}\n`
  );
  return merged;
}

function installExactly(
  directory: string,
  files: Map<string, string>
): boolean {
  const output = resolve(directory);
  if (existsSync(output)) {
    const names = [...files.keys()];
    if (
      names.every((name) => {
        const path = join(output, name);
        const expected = files.get(name);
        return (
          expected !== undefined &&
          existsSync(path) &&
          sha256(readFileSync(path)) === sha256(expected)
        );
      })
    ) {
      return false;
    }
    throw new Error("french-entity-merge-existing-output-drift");
  }
  mkdirSync(dirname(output), { recursive: true });
  const temporary = `${output}.tmp-${process.pid}-${Date.now()}`;
  mkdirSync(temporary, { recursive: false });
  try {
    for (const [name, text] of files) {
      writeFileSync(join(temporary, name), text, {
        encoding: "utf8",
        flag: "wx"
      });
    }
    renameSync(temporary, output);
    return true;
  } catch (error) {
    rmSync(temporary, { recursive: true, force: true });
    throw error;
  }
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) {
  try {
    runFrenchEntityAgentMergeCli(
      parseFrenchEntityAgentMergeArgs(process.argv.slice(2))
    );
  } catch (error) {
    process.stderr.write(
      `${basename(
        process.argv[1] ?? "mergeLexiconV3FrenchEntityAgentResults"
      )}: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  }
}
