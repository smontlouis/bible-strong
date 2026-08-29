import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  buildLexiconV3BilingualCandidateManifest,
  writeLexiconV3BilingualCandidateManifest
} from "../src/lexiconV3/productionCandidateManifest.js";
import { buildLexiconV3Production } from "../src/lexiconV3/release.js";

const DEFAULT_AUTHORING = "outputs/lexicon-v3/authoring.sqlite";
const DEFAULT_SOURCE =
  "data/dictionaries/strong_lexicon.full.production.sqlite";
const DEFAULT_CORE = "outputs/lexicon-v3/strong_lexicon.core.candidate.sqlite";
const DEFAULT_FULL = "outputs/lexicon-v3/strong_lexicon.full.candidate.sqlite";
const DEFAULT_CORE_EN =
  "outputs/lexicon-v3/strong_lexicon.en.core.candidate.sqlite";
const DEFAULT_BILINGUAL_MANIFEST =
  "outputs/lexicon-v3/strong_lexicon.bilingual.candidate.manifest.json";

function main(): void {
  const args = parseLexiconV3ProductionBuildArgs(process.argv.slice(2));
  const releaseKey = args.releaseKey?.trim();
  if (!releaseKey) throw new Error("missing-release-key");
  const profile = args.profile?.trim() || "bilingual";
  if (profile !== "bilingual" && profile !== "core-en") {
    throw new Error(`invalid-release-profile:${profile}`);
  }
  if (profile === "core-en" && (args.coreOutput || args.fullOutput)) {
    throw new Error("core-en-uses-output-option");
  }
  if (profile === "bilingual" && args.output) {
    throw new Error("bilingual-uses-core-output-and-full-output-options");
  }
  const candidateManifestPath =
    profile === "bilingual"
      ? resolve(args.candidateManifest ?? DEFAULT_BILINGUAL_MANIFEST)
      : null;
  const common = {
    authoringPath: resolve(args.authoring ?? DEFAULT_AUTHORING),
    releaseKey,
    sourcePath: resolve(args.source ?? DEFAULT_SOURCE),
    overwriteExisting: args.write === "true"
  };
  const result =
    profile === "core-en"
      ? buildLexiconV3Production({
          ...common,
          profile: "core-en",
          outputPath: resolve(args.output ?? DEFAULT_CORE_EN)
        })
      : buildLexiconV3Production({
          ...common,
          profile: "bilingual",
          coreOutputPath: resolve(args.coreOutput ?? DEFAULT_CORE),
          fullOutputPath: resolve(args.fullOutput ?? DEFAULT_FULL)
        });
  const candidateManifest: string | null = candidateManifestPath;
  if (result.profile === "bilingual") {
    if (
      !candidateManifest ||
      [
        common.authoringPath,
        common.sourcePath,
        result.core.path,
        result.full.path
      ].some((path) => resolve(path) === candidateManifest)
    ) {
      throw new Error("bilingual-candidate-manifest-path-collision");
    }
    writeLexiconV3BilingualCandidateManifest(
      candidateManifest,
      buildLexiconV3BilingualCandidateManifest(result),
      args.write === "true"
    );
  }
  console.log(
    JSON.stringify(
      {
        ...result,
        ...(candidateManifest ? { candidateManifest } : {})
      },
      null,
      2
    )
  );
}

export function parseLexiconV3ProductionBuildArgs(
  argv: readonly string[]
): Record<string, string> {
  const allowed = new Set([
    "authoring",
    "releaseKey",
    "source",
    "write",
    "profile",
    "coreOutput",
    "fullOutput",
    "output",
    "candidateManifest"
  ]);
  const args: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (!token.startsWith("--")) {
      throw new Error(`unexpected-argument:${token}`);
    }
    const [rawKey, inlineValue] = token.slice(2).split("=", 2);
    const key = camelCase(rawKey);
    if (!allowed.has(key)) throw new Error(`unknown-option:${rawKey}`);
    if (args[key] !== undefined) throw new Error(`duplicate-option:${rawKey}`);
    const next = argv[index + 1];
    if (inlineValue !== undefined) {
      if (!inlineValue) throw new Error(`missing-value:${rawKey}`);
      args[key] = inlineValue;
    } else if (next && !next.startsWith("--")) {
      args[key] = next;
      index += 1;
    } else throw new Error(`missing-value:${rawKey}`);
  }
  return args;
}

function camelCase(value: string): string {
  return value.replace(/-([a-z])/gu, (_, letter: string) =>
    letter.toUpperCase()
  );
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `${basename(process.argv[1] ?? "buildLexiconV3Production")}: ${message}\n`
    );
    process.exitCode = 1;
  }
}
