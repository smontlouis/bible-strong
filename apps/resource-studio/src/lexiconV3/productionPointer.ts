import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";

export const DEFAULT_LEXICON_V3_CURRENT_MANIFEST =
  "data/dictionaries/lexicon-v3-fr/current.json";

const CURRENT_SCHEMA = "lexicon-v3-bilingual-current@1";
const RECEIPT_SCHEMA = "lexicon-v3-bilingual-deployment-receipt@1";
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const RELEASE_KEY_PATTERN = /^[A-Za-z0-9._-]+$/u;
const RELEASE_FILES = [
  "deployment.json",
  "strong_lexicon.fr.core.production.sqlite",
  "strong_lexicon.fr.full.production.sqlite"
] as const;

interface PointerArtifact {
  path: string;
  sha256: string;
  logicalFingerprint: string;
}

interface CurrentPointer {
  schemaVersion: typeof CURRENT_SCHEMA;
  releaseKey: string;
  releaseDirectory: string;
  deploymentReceipt: string;
  deploymentHash: string;
  core: PointerArtifact;
  full: PointerArtifact;
  activatedAt: string;
  pointerHash: string;
}

interface DeploymentReceiptArtifact {
  file: string;
  sha256: string;
  logicalFingerprint: string;
}

interface DeploymentReceipt {
  schemaVersion: typeof RECEIPT_SCHEMA;
  profile: "bilingual";
  releaseKey: string;
  candidateManifestHash: string;
  sourcePath: string;
  deployedAt: string;
  core: DeploymentReceiptArtifact;
  full: DeploymentReceiptArtifact;
  deploymentHash: string;
}

export interface ResolvedLexiconV3ProductionPair {
  pointerPath: string;
  pointerHash: string;
  releaseKey: string;
  releaseDirectory: string;
  deploymentReceipt: string;
  deploymentHash: string;
  core: PointerArtifact;
  full: PointerArtifact;
}

export interface ResolveLexiconV3ProductionOptions {
  verifyBytes?: boolean;
}

/**
 * Reads the activation pointer exactly once, then resolves both immutable
 * artifacts from that same snapshot. A caller cannot accidentally combine the
 * core file from one release with the full file from another.
 */
export function resolveLexiconV3CurrentProduction(
  pointerPath = DEFAULT_LEXICON_V3_CURRENT_MANIFEST,
  options: ResolveLexiconV3ProductionOptions = {}
): ResolvedLexiconV3ProductionPair {
  const resolvedPointerPath = resolve(pointerPath);
  assertRegularFile(resolvedPointerPath, "lexicon-v3-current-pointer");
  const pointer = readJson<CurrentPointer>(
    resolvedPointerPath,
    "lexicon-v3-current-pointer-json-invalid"
  );
  assertCurrentPointer(pointer);

  assertRegularDirectory(pointer.releaseDirectory, "lexicon-v3-release");
  const names = readdirSync(pointer.releaseDirectory).sort();
  if (JSON.stringify(names) !== JSON.stringify([...RELEASE_FILES].sort())) {
    throw new Error(`lexicon-v3-release-files-invalid:${names.join(",")}`);
  }
  for (const path of [
    pointer.deploymentReceipt,
    pointer.core.path,
    pointer.full.path
  ]) {
    assertRegularFile(path, "lexicon-v3-release-artifact");
  }

  const receipt = readJson<DeploymentReceipt>(
    pointer.deploymentReceipt,
    "lexicon-v3-deployment-receipt-json-invalid"
  );
  assertDeploymentReceipt(receipt, pointer);
  if (options.verifyBytes !== false) {
    for (const artifact of [pointer.core, pointer.full]) {
      const actual = fileSha256(artifact.path);
      if (actual !== artifact.sha256) {
        throw new Error(
          `lexicon-v3-production-sha256-mismatch:${basename(artifact.path)}:${actual}:${artifact.sha256}`
        );
      }
    }
  }
  return {
    pointerPath: resolvedPointerPath,
    pointerHash: pointer.pointerHash,
    releaseKey: pointer.releaseKey,
    releaseDirectory: pointer.releaseDirectory,
    deploymentReceipt: pointer.deploymentReceipt,
    deploymentHash: pointer.deploymentHash,
    core: { ...pointer.core },
    full: { ...pointer.full }
  };
}

export function lexiconV3CurrentProductionExists(
  pointerPath = DEFAULT_LEXICON_V3_CURRENT_MANIFEST
): boolean {
  return existsSync(resolve(pointerPath));
}

function assertCurrentPointer(value: CurrentPointer): void {
  assertExactKeys(
    value,
    [
      "activatedAt",
      "core",
      "deploymentHash",
      "deploymentReceipt",
      "full",
      "pointerHash",
      "releaseDirectory",
      "releaseKey",
      "schemaVersion"
    ],
    "lexicon-v3-current-pointer-keys-invalid"
  );
  const { pointerHash, ...content } = value;
  if (
    value.schemaVersion !== CURRENT_SCHEMA ||
    !RELEASE_KEY_PATTERN.test(value.releaseKey) ||
    !isAbsoluteNormalized(value.releaseDirectory) ||
    basename(value.releaseDirectory) !== value.releaseKey ||
    value.deploymentReceipt !==
      join(value.releaseDirectory, RELEASE_FILES[0]) ||
    !SHA256_PATTERN.test(value.deploymentHash) ||
    !Number.isFinite(Date.parse(value.activatedAt)) ||
    !SHA256_PATTERN.test(pointerHash) ||
    hashJson(content) !== pointerHash
  ) {
    throw new Error("lexicon-v3-current-pointer-invalid");
  }
  assertPointerArtifact(
    value.core,
    join(value.releaseDirectory, RELEASE_FILES[1]),
    "core"
  );
  assertPointerArtifact(
    value.full,
    join(value.releaseDirectory, RELEASE_FILES[2]),
    "full"
  );
}

function assertPointerArtifact(
  value: PointerArtifact,
  expectedPath: string,
  label: string
): void {
  assertExactKeys(
    value,
    ["logicalFingerprint", "path", "sha256"],
    `lexicon-v3-current-${label}-keys-invalid`
  );
  if (
    value.path !== expectedPath ||
    !isAbsoluteNormalized(value.path) ||
    !SHA256_PATTERN.test(value.sha256) ||
    !SHA256_PATTERN.test(value.logicalFingerprint)
  ) {
    throw new Error(`lexicon-v3-current-${label}-invalid`);
  }
}

function assertDeploymentReceipt(
  value: DeploymentReceipt,
  pointer: CurrentPointer
): void {
  assertExactKeys(
    value,
    [
      "candidateManifestHash",
      "core",
      "deployedAt",
      "deploymentHash",
      "full",
      "profile",
      "releaseKey",
      "schemaVersion",
      "sourcePath"
    ],
    "lexicon-v3-deployment-receipt-keys-invalid"
  );
  const { deploymentHash, ...content } = value;
  if (
    value.schemaVersion !== RECEIPT_SCHEMA ||
    value.profile !== "bilingual" ||
    value.releaseKey !== pointer.releaseKey ||
    !SHA256_PATTERN.test(value.candidateManifestHash) ||
    !isAbsoluteNormalized(value.sourcePath) ||
    !Number.isFinite(Date.parse(value.deployedAt)) ||
    deploymentHash !== pointer.deploymentHash ||
    hashJson(content) !== deploymentHash
  ) {
    throw new Error("lexicon-v3-deployment-receipt-invalid");
  }
  assertReceiptArtifact(value.core, pointer.core, RELEASE_FILES[1], "core");
  assertReceiptArtifact(value.full, pointer.full, RELEASE_FILES[2], "full");
}

function assertReceiptArtifact(
  value: DeploymentReceiptArtifact,
  pointer: PointerArtifact,
  expectedFile: string,
  label: string
): void {
  assertExactKeys(
    value,
    ["file", "logicalFingerprint", "sha256"],
    `lexicon-v3-deployment-receipt-${label}-keys-invalid`
  );
  if (
    value.file !== expectedFile ||
    value.sha256 !== pointer.sha256 ||
    value.logicalFingerprint !== pointer.logicalFingerprint
  ) {
    throw new Error(`lexicon-v3-deployment-receipt-${label}-invalid`);
  }
}

function assertExactKeys(
  value: unknown,
  expected: readonly string[],
  error: string
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(error);
  }
  const actual = Object.keys(value).sort();
  if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) {
    throw new Error(error);
  }
}

function assertRegularFile(path: string, label: string): void {
  if (!existsSync(path)) throw new Error(`${label}-missing:${path}`);
  const stats = lstatSync(path);
  if (stats.isSymbolicLink() || !stats.isFile() || stats.size < 1) {
    throw new Error(`${label}-not-regular:${path}`);
  }
}

function assertRegularDirectory(path: string, label: string): void {
  const stats = lstatSync(path);
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new Error(`${label}-not-regular:${path}`);
  }
}

function isAbsoluteNormalized(path: string): boolean {
  return resolve(path) === path;
}

function readJson<T>(path: string, error: string): T {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    throw new Error(error);
  }
}

function fileSha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function hashJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
