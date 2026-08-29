import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { readLexiconV3BilingualCandidateManifest } from "../src/lexiconV3/productionCandidateManifest.js";
import { deployLexiconV3BilingualCandidates } from "../src/lexiconV3/release.js";

const DEFAULT_AUTHORING = "outputs/lexicon-v3/authoring.sqlite";
const DEFAULT_CANDIDATE_MANIFEST =
  "outputs/lexicon-v3/strong_lexicon.bilingual.candidate.manifest.json";
const DEFAULT_RELEASES_ROOT = "data/dictionaries/lexicon-v3-fr/releases";
const DEFAULT_CURRENT_MANIFEST = "data/dictionaries/lexicon-v3-fr/current.json";

export interface LexiconV3ProductionDeployCliOptions {
  authoringPath: string;
  candidateManifestPath: string;
  releaseKey: string;
  releaseDirectory: string;
  currentManifestPath: string;
  deployedAt?: string;
}

export function parseLexiconV3ProductionDeployArgs(
  argv: readonly string[]
): LexiconV3ProductionDeployCliOptions {
  const args = parseArgs(argv);
  const releaseKey = args.releaseKey?.trim();
  if (!releaseKey) throw new Error("missing-release-key");
  const releasesRoot = resolve(args.releasesRoot ?? DEFAULT_RELEASES_ROOT);
  return {
    authoringPath: resolve(args.authoring ?? DEFAULT_AUTHORING),
    candidateManifestPath: resolve(
      args.candidateManifest ?? DEFAULT_CANDIDATE_MANIFEST
    ),
    releaseKey,
    releaseDirectory: resolve(releasesRoot, releaseKey),
    currentManifestPath: resolve(
      args.currentManifest ?? DEFAULT_CURRENT_MANIFEST
    ),
    ...(args.deployedAt ? { deployedAt: args.deployedAt } : {})
  };
}

export function runLexiconV3ProductionDeploy(
  options: LexiconV3ProductionDeployCliOptions
): ReturnType<typeof deployLexiconV3BilingualCandidates> {
  const manifest = readLexiconV3BilingualCandidateManifest(
    options.candidateManifestPath
  );
  if (options.releaseKey !== manifest.releaseKey) {
    throw new Error(
      `bilingual-candidate-release-mismatch:${options.releaseKey}:${manifest.releaseKey}`
    );
  }
  const protectedInputs = [
    options.authoringPath,
    options.candidateManifestPath,
    manifest.sourcePath,
    manifest.core.path,
    manifest.full.path
  ].map((path) => resolve(path));
  const currentManifestPath = resolve(options.currentManifestPath);
  const deploymentLockPath = `${currentManifestPath}.deploy-lock.sqlite`;
  if (
    protectedInputs.includes(currentManifestPath) ||
    protectedInputs.includes(deploymentLockPath) ||
    protectedInputs.some((path) =>
      path.startsWith(`${resolve(options.releaseDirectory)}/`)
    ) ||
    currentManifestPath.startsWith(`${resolve(options.releaseDirectory)}/`) ||
    deploymentLockPath.startsWith(`${resolve(options.releaseDirectory)}/`)
  ) {
    throw new Error("french-production-deploy-path-collision");
  }
  return deployLexiconV3BilingualCandidates({
    authoringPath: options.authoringPath,
    sourcePath: manifest.sourcePath,
    releaseKey: manifest.releaseKey,
    coreCandidatePath: manifest.core.path,
    fullCandidatePath: manifest.full.path,
    expectedCoreSha256: manifest.core.sha256,
    expectedFullSha256: manifest.full.sha256,
    expectedCoreLogicalFingerprint: manifest.core.logicalFingerprint,
    expectedFullLogicalFingerprint: manifest.full.logicalFingerprint,
    candidateManifestHash: manifest.manifestHash,
    candidateManifest: manifest,
    releaseDirectory: options.releaseDirectory,
    currentManifestPath: options.currentManifestPath,
    ...(options.deployedAt ? { deployedAt: options.deployedAt } : {})
  });
}

function parseArgs(argv: readonly string[]): Record<string, string> {
  const allowed = new Set([
    "authoring",
    "candidateManifest",
    "releaseKey",
    "releasesRoot",
    "currentManifest",
    "deployedAt"
  ]);
  const result: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (!token.startsWith("--")) {
      throw new Error(`unexpected-argument:${token}`);
    }
    const [rawKey, inlineValue] = token.slice(2).split("=", 2);
    const key = rawKey.replace(/-([a-z])/gu, (_, letter: string) =>
      letter.toUpperCase()
    );
    if (!allowed.has(key)) throw new Error(`unknown-option:${rawKey}`);
    if (result[key] !== undefined) {
      throw new Error(`duplicate-option:${rawKey}`);
    }
    const next = argv[index + 1];
    if (inlineValue !== undefined) {
      if (!inlineValue) throw new Error(`missing-value:${rawKey}`);
      result[key] = inlineValue;
    } else if (next && !next.startsWith("--")) {
      result[key] = next;
      index += 1;
    } else throw new Error(`missing-value:${rawKey}`);
  }
  return result;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) {
  try {
    const result = runLexiconV3ProductionDeploy(
      parseLexiconV3ProductionDeployArgs(process.argv.slice(2))
    );
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `${basename(process.argv[1] ?? "deployLexiconV3Production")}: ${message}\n`
    );
    process.exitCode = 1;
  }
}
