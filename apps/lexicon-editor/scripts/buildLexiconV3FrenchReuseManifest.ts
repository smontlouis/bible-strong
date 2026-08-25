import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { runFrenchReuseManifest } from "../src/lexiconV3/frenchReuseManifest.js";

const DEFAULT_AUTHORING = "outputs/lexicon-v3/staging/reviewed-english.sqlite";
const DEFAULT_LEGACY_FULL =
  "data/dictionaries/strong_lexicon.full.production.sqlite";
const DEFAULT_RECORDS =
  "outputs/lexicon-v3/french-reuse/french-reuse.records.jsonl";
const DEFAULT_SUMMARY =
  "outputs/lexicon-v3/french-reuse/french-reuse.summary.json";

export interface FrenchReuseManifestCliOptions {
  authoringDatabase: string;
  legacyFullDatabase: string;
  releaseKey?: string;
  recordsOutput: string;
  summaryOutput: string;
  generatedAt?: string;
}

export function parseFrenchReuseManifestArgs(
  args: readonly string[]
): FrenchReuseManifestCliOptions {
  const allowed = new Set([
    "authoring",
    "legacy-full",
    "release-key",
    "records",
    "summary",
    "generated-at"
  ]);
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument?.startsWith("--")) {
      throw new Error(`french-reuse-unexpected-argument:${argument}`);
    }
    const [key, inlineValue] = argument.slice(2).split("=", 2);
    if (!allowed.has(key)) {
      throw new Error(`french-reuse-unknown-option:${key}`);
    }
    if (values.has(key)) {
      throw new Error(`french-reuse-duplicate-option:${key}`);
    }
    const next = args[index + 1];
    if (inlineValue !== undefined) {
      if (!inlineValue) {
        throw new Error(`french-reuse-missing-argument-value:${key}`);
      }
      values.set(key, inlineValue);
    } else if (next && !next.startsWith("--")) {
      values.set(key, next);
      index += 1;
    } else {
      throw new Error(`french-reuse-missing-argument-value:${key}`);
    }
  }
  return {
    authoringDatabase: resolve(values.get("authoring") ?? DEFAULT_AUTHORING),
    legacyFullDatabase: resolve(
      values.get("legacy-full") ?? DEFAULT_LEGACY_FULL
    ),
    ...(values.get("release-key")
      ? { releaseKey: values.get("release-key") }
      : {}),
    recordsOutput: resolve(values.get("records") ?? DEFAULT_RECORDS),
    summaryOutput: resolve(values.get("summary") ?? DEFAULT_SUMMARY),
    ...(values.get("generated-at")
      ? { generatedAt: values.get("generated-at") }
      : {})
  };
}

export async function runFrenchReuseManifestCli(
  options: FrenchReuseManifestCliOptions
): Promise<void> {
  const build = await runFrenchReuseManifest({
    ...options,
    expectations: null
  });
  console.log(
    JSON.stringify(
      {
        records: build.summary.counts.entries,
        meaningCohorts: build.summary.counts.meaningCohorts,
        glossReviewSeed: build.summary.counts.glossReviewSeed,
        meaningReviewSeed: build.summary.counts.meaningReviewSeed,
        recordsLogicalDigest: build.summary.recordsLogicalDigest,
        recordsOutputDigest: build.summary.recordsOutputDigest,
        manifestDigest: build.summary.manifestDigest,
        recordsOutput: options.recordsOutput,
        summaryOutput: options.summaryOutput
      },
      null,
      2
    )
  );
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) {
  runFrenchReuseManifestCli(
    parseFrenchReuseManifestArgs(process.argv.slice(2))
  ).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `${basename(process.argv[1] ?? "buildLexiconV3FrenchReuseManifest")}: ${message}`
    );
    process.exitCode = 1;
  });
}
