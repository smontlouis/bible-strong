import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { assertFrenchEntityMergeAttestationFromFiles } from "../src/lexiconV3/frenchEntityMergeAttestation.js";

const DEFAULT_PLAN =
  "outputs/lexicon-v3/french-entities/entity-canonicalization-plan.json";
const DEFAULT_RESOLVED = "outputs/lexicon-v3/french-entities/resolved";
const DEFAULT_MANIFEST =
  "outputs/lexicon-v3/french-entities/agent-batches/manifest.json";
const DEFAULT_RESULTS = "outputs/lexicon-v3/french-entities/agent-results";

export interface FrenchEntityGateCliOptions {
  plan: string;
  manifest: string;
  resultsDir: string;
  attestation: string;
  canonicalEntities: string;
  entryPolicies: string;
  releaseKey: string;
}

export function parseFrenchEntityGateArgs(
  args: readonly string[]
): FrenchEntityGateCliOptions {
  const allowed = new Set([
    "plan",
    "manifest",
    "results-dir",
    "attestation",
    "resolved-dir",
    "canonical-entities",
    "entry-policies",
    "release-key"
  ]);
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index] ?? "";
    if (!token.startsWith("--")) {
      throw new Error(`french-entity-gate-unexpected-argument:${token}`);
    }
    const [key, inline] = token.slice(2).split("=", 2);
    if (!allowed.has(key)) {
      throw new Error(`french-entity-gate-unknown-option:${key}`);
    }
    if (values.has(key)) {
      throw new Error(`french-entity-gate-duplicate-option:${key}`);
    }
    const next = args[index + 1];
    if (inline !== undefined) {
      if (!inline) throw new Error(`french-entity-gate-missing-value:${key}`);
      values.set(key, inline);
    } else if (next && !next.startsWith("--")) {
      values.set(key, next);
      index += 1;
    } else {
      throw new Error(`french-entity-gate-missing-value:${key}`);
    }
  }
  const releaseKey = values.get("release-key")?.trim();
  if (!releaseKey) throw new Error("french-entity-gate-release-key-required");
  const resolvedDir = resolve(values.get("resolved-dir") ?? DEFAULT_RESOLVED);
  return {
    plan: resolve(values.get("plan") ?? DEFAULT_PLAN),
    manifest: resolve(values.get("manifest") ?? DEFAULT_MANIFEST),
    resultsDir: resolve(values.get("results-dir") ?? DEFAULT_RESULTS),
    attestation: resolve(
      values.get("attestation") ??
        join(resolvedDir, "entity-merge-attestation.json")
    ),
    canonicalEntities: resolve(
      values.get("canonical-entities") ??
        join(resolvedDir, "canonical-entities.jsonl")
    ),
    entryPolicies: resolve(
      values.get("entry-policies") ??
        join(resolvedDir, "canonical-entry-name-policies.jsonl")
    ),
    releaseKey
  };
}

export function runFrenchEntityGateCli(options: FrenchEntityGateCliOptions) {
  const replay = assertFrenchEntityMergeAttestationFromFiles({
    attestationPath: options.attestation,
    manifestPath: options.manifest,
    resultsDirectory: options.resultsDir,
    canonicalEntitiesPath: options.canonicalEntities,
    canonicalEntryPoliciesPath: options.entryPolicies,
    expectedReleaseKey: options.releaseKey
  });
  if (resolve(replay.manifest.plan.path) !== resolve(options.plan)) {
    throw new Error("french-entity-gate-plan-path-mismatch");
  }
  const gate = replay.merged.gate;
  process.stdout.write(`${JSON.stringify(gate, null, 2)}\n`);
  return gate;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) {
  try {
    runFrenchEntityGateCli(parseFrenchEntityGateArgs(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(
      `${basename(process.argv[1] ?? "gateLexiconV3FrenchEntities")}: ${
        error instanceof Error ? error.message : String(error)
      }\n`
    );
    process.exitCode = 1;
  }
}
