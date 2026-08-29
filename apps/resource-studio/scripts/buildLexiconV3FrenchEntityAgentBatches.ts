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
  buildFrenchEntityAgentBatches,
  type FrenchEntityAgentBatchBuild,
  type FrenchEntityAgentBatchManifest
} from "../src/lexiconV3/frenchEntityAgentReview.js";
import {
  FRENCH_ENTITY_CANONICALIZATION_DEFAULT_EXPECTATIONS,
  type FrenchEntityCanonicalizationPlan
} from "../src/lexiconV3/frenchEntityCanonicalization.js";

const DEFAULT_PLAN =
  "outputs/lexicon-v3/french-entities/entity-canonicalization-plan.json";
const DEFAULT_OUTPUT_DIR = "outputs/lexicon-v3/french-entities/agent-batches";

export interface FrenchEntityAgentBatchesCliOptions {
  plan: string;
  outputDir: string;
  releaseKey: string;
  maxUnits: number;
  maxInputBytes: number;
}

export function parseFrenchEntityAgentBatchesArgs(
  args: readonly string[]
): FrenchEntityAgentBatchesCliOptions {
  const allowed = new Set([
    "plan",
    "output-dir",
    "release-key",
    "max-units",
    "max-input-bytes"
  ]);
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index] ?? "";
    if (!token.startsWith("--")) {
      throw new Error(`french-entity-batches-unexpected-argument:${token}`);
    }
    const [key, inline] = token.slice(2).split("=", 2);
    if (!allowed.has(key)) {
      throw new Error(`french-entity-batches-unknown-option:${key}`);
    }
    if (values.has(key)) {
      throw new Error(`french-entity-batches-duplicate-option:${key}`);
    }
    const next = args[index + 1];
    if (inline !== undefined) {
      if (!inline)
        throw new Error(`french-entity-batches-missing-value:${key}`);
      values.set(key, inline);
    } else if (next && !next.startsWith("--")) {
      values.set(key, next);
      index += 1;
    } else {
      throw new Error(`french-entity-batches-missing-value:${key}`);
    }
  }
  const releaseKey = values.get("release-key")?.trim();
  if (!releaseKey)
    throw new Error("french-entity-batches-release-key-required");
  return {
    plan: resolve(values.get("plan") ?? DEFAULT_PLAN),
    outputDir: resolve(values.get("output-dir") ?? DEFAULT_OUTPUT_DIR),
    releaseKey,
    maxUnits: positiveInteger(values.get("max-units"), 12, "max-units"),
    maxInputBytes: positiveInteger(
      values.get("max-input-bytes"),
      96 * 1024,
      "max-input-bytes"
    )
  };
}

export function runFrenchEntityAgentBatchesCli(
  options: FrenchEntityAgentBatchesCliOptions
): FrenchEntityAgentBatchBuild {
  const planText = readFileSync(options.plan, "utf8");
  const plan = JSON.parse(planText) as FrenchEntityCanonicalizationPlan;
  const build = buildFrenchEntityAgentBatches({
    plan,
    planPath: resolve(options.plan),
    planFileDigest: sha256(planText),
    expectedReleaseKey: options.releaseKey,
    maxUnits: options.maxUnits,
    maxInputBytes: options.maxInputBytes,
    expectations: FRENCH_ENTITY_CANONICALIZATION_DEFAULT_EXPECTATIONS
  });
  installBuild(build, options.outputDir, plan);
  process.stdout.write(
    `${JSON.stringify(
      {
        outputDir: options.outputDir,
        releaseKey: build.manifest.plan.releaseKey,
        units: build.manifest.counts.units,
        batches: build.manifest.counts.batches,
        agentOwnedEntities: build.manifest.counts.agentOwnedEntities,
        manifestHash: build.manifest.manifestHash
      },
      null,
      2
    )}\n`
  );
  return build;
}

function installBuild(
  build: FrenchEntityAgentBatchBuild,
  outputDirectory: string,
  plan: FrenchEntityCanonicalizationPlan
): void {
  const outputDir = resolve(outputDirectory);
  if (existsSync(outputDir)) {
    const manifestPath = join(outputDir, "manifest.json");
    if (!existsSync(manifestPath)) {
      throw new Error("french-entity-batches-existing-output-incomplete");
    }
    const existing = JSON.parse(
      readFileSync(manifestPath, "utf8")
    ) as FrenchEntityAgentBatchManifest;
    assertFrenchEntityAgentBatchManifest(
      existing,
      plan,
      FRENCH_ENTITY_CANONICALIZATION_DEFAULT_EXPECTATIONS
    );
    if (existing.manifestHash !== build.manifest.manifestHash) {
      throw new Error(
        `french-entity-batches-existing-release-or-plan-mismatch:${existing.plan.releaseKey}:${build.manifest.plan.releaseKey}`
      );
    }
    assertExistingFiles(outputDir, build);
    return;
  }
  const parent = dirname(outputDir);
  mkdirSync(parent, { recursive: true });
  const temporary = `${outputDir}.tmp-${process.pid}-${Date.now()}`;
  mkdirSync(temporary, { recursive: false });
  try {
    for (const [relativePath, text] of build.files) {
      const path = join(temporary, relativePath);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, text, { encoding: "utf8", flag: "wx" });
    }
    assertExistingFiles(temporary, build);
    renameSync(temporary, outputDir);
  } catch (error) {
    rmSync(temporary, { recursive: true, force: true });
    throw error;
  }
}

function assertExistingFiles(
  directory: string,
  build: FrenchEntityAgentBatchBuild
): void {
  for (const [relativePath, text] of build.files) {
    const path = join(directory, relativePath);
    if (!existsSync(path) || sha256(readFileSync(path)) !== sha256(text)) {
      throw new Error(`french-entity-batches-file-drift:${relativePath}`);
    }
  }
}

function positiveInteger(
  value: string | undefined,
  fallback: number,
  label: string
): number {
  const raw = value ?? String(fallback);
  if (!/^[1-9]\d*$/u.test(raw)) {
    throw new Error(`french-entity-batches-invalid-${label}:${raw}`);
  }
  return Number(raw);
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) {
  try {
    runFrenchEntityAgentBatchesCli(
      parseFrenchEntityAgentBatchesArgs(process.argv.slice(2))
    );
  } catch (error) {
    process.stderr.write(
      `${basename(
        process.argv[1] ?? "buildLexiconV3FrenchEntityAgentBatches"
      )}: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  }
}
