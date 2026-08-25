import { createHash, randomBytes } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  canonicalFrenchEntityJson,
  type FrenchEntityCanonicalizationExpectations
} from "../src/lexiconV3/frenchEntityCanonicalization.js";
import { buildNextFrenchEntityRemediationRoundPlanFromStoredState } from "./runLexiconV3FrenchEntityRemediationRound.js";

const DEFAULT_MANIFEST =
  "outputs/lexicon-v3/french-entities/agent-batches/manifest.json";
const DEFAULT_RESULTS = "outputs/lexicon-v3/french-entities/agent-results";

export interface FrenchEntityRemediationPlanCliOptions {
  manifest: string;
  resultsDir: string;
  releaseKey: string;
  previousRoundPlan: string | null;
  output: string | null;
  outputDir: string | null;
}

export interface FrenchEntityRemediationPlanCliDependencies {
  /** Test/fixture-only override; CLI production always uses frozen defaults. */
  expectations?: FrenchEntityCanonicalizationExpectations;
}

export interface FrenchEntityRemediationPlanCliSummary {
  releaseKey: string;
  round: number;
  parentRoundHash: string | null;
  units: number;
  planHash: string;
  planPath: string;
  fileSha256: string;
  manifestHash: string;
  canonicalPlanHash: string;
  baseRunsReplayed: number;
  historicalRoundsReplayed: number;
  historicalRunsReplayed: number;
}

export function parseFrenchEntityRemediationPlanArgs(
  args: readonly string[]
): FrenchEntityRemediationPlanCliOptions {
  const allowed = new Set([
    "manifest",
    "results-dir",
    "release-key",
    "previous-round-plan",
    "output",
    "output-dir"
  ]);
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index] ?? "";
    if (!token.startsWith("--")) {
      throw new Error(
        `french-entity-remediation-plan-unexpected-argument:${token}`
      );
    }
    const key = token.slice(2);
    if (!allowed.has(key)) {
      throw new Error(`french-entity-remediation-plan-unknown-option:${key}`);
    }
    if (values.has(key)) {
      throw new Error(`french-entity-remediation-plan-duplicate-option:${key}`);
    }
    const value = args[index + 1];
    if (!value || !value.trim() || value.startsWith("--")) {
      throw new Error(`french-entity-remediation-plan-missing-value:${key}`);
    }
    values.set(key, value);
    index += 1;
  }
  const releaseKey = values.get("release-key")?.trim();
  if (!releaseKey) {
    throw new Error("french-entity-remediation-plan-release-key-required");
  }
  if (values.has("output") && values.has("output-dir")) {
    throw new Error("french-entity-remediation-plan-output-mode-collision");
  }
  return {
    manifest: resolve(values.get("manifest") ?? DEFAULT_MANIFEST),
    resultsDir: resolve(values.get("results-dir") ?? DEFAULT_RESULTS),
    releaseKey,
    previousRoundPlan: optionalResolved(values.get("previous-round-plan")),
    output: optionalResolved(values.get("output")),
    outputDir: optionalResolved(values.get("output-dir"))
  };
}

export function runFrenchEntityRemediationPlanCli(
  options: FrenchEntityRemediationPlanCliOptions,
  dependencies: FrenchEntityRemediationPlanCliDependencies = {}
): FrenchEntityRemediationPlanCliSummary {
  const built = buildNextFrenchEntityRemediationRoundPlanFromStoredState({
    manifest: options.manifest,
    resultsDir: options.resultsDir,
    releaseKey: options.releaseKey,
    ...(options.previousRoundPlan
      ? { previousRoundPlan: options.previousRoundPlan }
      : {}),
    ...(dependencies.expectations
      ? { expectations: dependencies.expectations }
      : {})
  });
  const planText = `${canonicalFrenchEntityJson(built.plan)}\n`;
  const planPath = resolvePlanOutputPath(options, built.plan);
  publishImmutableText(planPath, planText);
  if (readFileSync(planPath, "utf8") !== planText) {
    throw new Error(`french-entity-remediation-plan-publish-drift:${planPath}`);
  }
  const summary: FrenchEntityRemediationPlanCliSummary = {
    releaseKey: options.releaseKey,
    round: built.plan.round,
    parentRoundHash: built.plan.parentRoundHash,
    units: built.plan.unitIds.length,
    planHash: built.plan.planHash,
    planPath,
    fileSha256: sha256(planText),
    manifestHash: built.manifestHash,
    canonicalPlanHash: built.canonicalPlanHash,
    baseRunsReplayed: built.baseRunCount,
    historicalRoundsReplayed: built.historicalRoundCount,
    historicalRunsReplayed: built.historicalRunCount
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}

function resolvePlanOutputPath(
  options: FrenchEntityRemediationPlanCliOptions,
  plan: { round: number; planHash: string }
): string {
  if (options.output) return resolve(options.output);
  const outputDirectory = resolve(
    options.outputDir ?? join(options.resultsDir, "remediation", "plans")
  );
  return join(
    outputDirectory,
    `round-${String(plan.round).padStart(2, "0")}-${plan.planHash}.json`
  );
}

/** Atomic no-clobber publication: concurrent writers can never replace data. */
function publishImmutableText(path: string, text: string): void {
  if (existsSync(path)) {
    throw new Error(`french-entity-remediation-plan-output-collision:${path}`);
  }
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}-${randomBytes(8).toString("hex")}`;
  let descriptor: number | null = null;
  try {
    descriptor = openSync(temporary, "wx", 0o444);
    writeFileSync(descriptor, text, "utf8");
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = null;
    try {
      linkSync(temporary, path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw new Error(
          `french-entity-remediation-plan-output-collision:${path}`
        );
      }
      throw error;
    }
  } finally {
    if (descriptor !== null) closeSync(descriptor);
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

function optionalResolved(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? resolve(trimmed) : null;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    runFrenchEntityRemediationPlanCli(
      parseFrenchEntityRemediationPlanArgs(process.argv.slice(2))
    );
  } catch (error) {
    process.stderr.write(`${errorMessage(error)}\n`);
    process.exitCode = 1;
  }
}
