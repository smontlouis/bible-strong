import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import type {
  LexiconV3BilingualReleaseIdentity,
  LexiconV3BilingualProductionBuildSummary,
  LexiconV3ProductionDatabaseSummary
} from "./release.js";

export const LEXICON_V3_BILINGUAL_CANDIDATE_MANIFEST_SCHEMA =
  "lexicon-v3-bilingual-candidate-manifest@1" as const;

export interface LexiconV3BilingualCandidateManifest {
  schemaVersion: typeof LEXICON_V3_BILINGUAL_CANDIDATE_MANIFEST_SCHEMA;
  generatedAt: string;
  profile: "bilingual";
  releaseKey: string;
  sourcePath: string;
  releaseIdentity: LexiconV3BilingualReleaseIdentity;
  core: LexiconV3ProductionDatabaseSummary;
  full: LexiconV3ProductionDatabaseSummary;
  manifestHash: string;
}

export function buildLexiconV3BilingualCandidateManifest(
  summary: LexiconV3BilingualProductionBuildSummary,
  generatedAt = new Date().toISOString()
): LexiconV3BilingualCandidateManifest {
  const coreIdentity = readReleaseIdentity(summary.core.path);
  const fullIdentity = readReleaseIdentity(summary.full.path);
  if (canonicalJson(coreIdentity) !== canonicalJson(fullIdentity)) {
    throw new Error("bilingual-candidate-release-identity-mismatch");
  }
  const content = {
    schemaVersion: LEXICON_V3_BILINGUAL_CANDIDATE_MANIFEST_SCHEMA,
    generatedAt,
    profile: "bilingual" as const,
    releaseKey: summary.releaseKey,
    sourcePath: resolve(summary.sourcePath),
    releaseIdentity: coreIdentity,
    core: { ...summary.core, path: resolve(summary.core.path) },
    full: { ...summary.full, path: resolve(summary.full.path) }
  };
  const manifest = {
    ...content,
    manifestHash: hashCanonical(content)
  };
  assertLexiconV3BilingualCandidateManifest(manifest);
  return manifest;
}

export function readLexiconV3BilingualCandidateManifest(
  path: string
): LexiconV3BilingualCandidateManifest {
  const resolved = resolve(path);
  if (!existsSync(resolved)) {
    throw new Error(`missing-bilingual-candidate-manifest:${resolved}`);
  }
  let manifest: unknown;
  try {
    manifest = JSON.parse(readFileSync(resolved, "utf8"));
  } catch {
    throw new Error("bilingual-candidate-manifest-json-invalid");
  }
  assertLexiconV3BilingualCandidateManifest(manifest);
  return manifest;
}

export function writeLexiconV3BilingualCandidateManifest(
  path: string,
  manifest: LexiconV3BilingualCandidateManifest,
  overwriteExisting = false
): void {
  assertLexiconV3BilingualCandidateManifest(manifest);
  const output = resolve(path);
  const text = `${JSON.stringify(manifest, null, 2)}\n`;
  if (existsSync(output)) {
    if (readFileSync(output, "utf8") === text) return;
    if (!overwriteExisting) {
      throw new Error(
        `bilingual-candidate-manifest-exists-requires-write:${output}`
      );
    }
  }
  mkdirSync(dirname(output), { recursive: true });
  const temporary = `${output}.tmp-${process.pid}-${Date.now()}`;
  try {
    writeFileSync(temporary, text, {
      encoding: "utf8",
      flag: "wx"
    });
    renameSync(temporary, output);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}

export function assertLexiconV3BilingualCandidateManifest(
  value: unknown
): asserts value is LexiconV3BilingualCandidateManifest {
  if (!value || typeof value !== "object") {
    throw new Error("bilingual-candidate-manifest-invalid");
  }
  const manifest = value as Partial<LexiconV3BilingualCandidateManifest>;
  if (
    manifest.schemaVersion !== LEXICON_V3_BILINGUAL_CANDIDATE_MANIFEST_SCHEMA ||
    manifest.profile !== "bilingual" ||
    !manifest.releaseKey?.trim() ||
    !manifest.sourcePath?.trim() ||
    !manifest.generatedAt ||
    !Number.isFinite(Date.parse(manifest.generatedAt))
  ) {
    throw new Error("bilingual-candidate-manifest-header-invalid");
  }
  assertReleaseIdentity(manifest.releaseIdentity, manifest.releaseKey);
  assertCandidateSummary(manifest.core, "core", manifest.releaseKey);
  assertCandidateSummary(manifest.full, "full", manifest.releaseKey);
  if (resolve(manifest.core!.path) === resolve(manifest.full!.path)) {
    throw new Error("bilingual-candidate-manifest-path-collision");
  }
  const { manifestHash, ...content } = manifest;
  if (!manifestHash || hashCanonical(content) !== manifestHash) {
    throw new Error("bilingual-candidate-manifest-hash-invalid");
  }
}

function readReleaseIdentity(
  path: string
): LexiconV3BilingualCandidateManifest["releaseIdentity"] {
  const db = new DatabaseSync(resolve(path), { readOnly: true });
  try {
    const meta = Object.fromEntries(
      (
        db
          .prepare(
            `SELECT key, value FROM DictionaryMeta
             WHERE key IN (
               'lexiconV3ReleaseKey', 'lexiconV3SourceFingerprint',
               'lexiconV3SourceLogicalFingerprint',
               'lexiconV3EntryIdentityFingerprint',
               'lexiconV3CodeFingerprint', 'lexiconV3PolicyVersion',
               'lexiconV3SnapshotFingerprint',
               'lexiconV3RightsManifestDigest', 'lexiconV3ReleaseProfile'
             ) ORDER BY key`
          )
          .all() as unknown as Array<{ key: string; value: string }>
      ).map((row) => [row.key, row.value])
    );
    if (meta.lexiconV3ReleaseKey === undefined) {
      throw new Error("bilingual-candidate-release-identity-missing");
    }
    const identity = {
      releaseKey: meta.lexiconV3ReleaseKey,
      sourceFingerprint: meta.lexiconV3SourceFingerprint ?? "",
      sourceLogicalFingerprint: meta.lexiconV3SourceLogicalFingerprint ?? "",
      entryIdentityFingerprint: meta.lexiconV3EntryIdentityFingerprint ?? "",
      codeFingerprint: meta.lexiconV3CodeFingerprint ?? "",
      policyVersion: meta.lexiconV3PolicyVersion ?? "",
      snapshotFingerprint: meta.lexiconV3SnapshotFingerprint ?? "",
      rightsManifestDigest: meta.lexiconV3RightsManifestDigest ?? "",
      releaseProfile: meta.lexiconV3ReleaseProfile as "bilingual"
    };
    assertReleaseIdentity(identity, meta.lexiconV3ReleaseKey);
    return identity;
  } finally {
    db.close();
  }
}

function assertReleaseIdentity(
  identity: LexiconV3BilingualCandidateManifest["releaseIdentity"] | undefined,
  releaseKey: string
): void {
  if (
    !identity ||
    identity.releaseKey !== releaseKey ||
    identity.releaseProfile !== "bilingual" ||
    !releaseKey.trim() ||
    !/^[a-f0-9]{64}$/u.test(identity.sourceFingerprint) ||
    !/^[a-f0-9]{64}$/u.test(identity.sourceLogicalFingerprint) ||
    !/^[a-f0-9]{64}$/u.test(identity.entryIdentityFingerprint) ||
    !/^[a-f0-9]{64}$/u.test(identity.codeFingerprint) ||
    !identity.policyVersion.trim() ||
    !/^[a-f0-9]{64}$/u.test(identity.snapshotFingerprint) ||
    !/^[a-f0-9]{64}$/u.test(identity.rightsManifestDigest)
  ) {
    throw new Error("bilingual-candidate-release-identity-invalid");
  }
}

function assertCandidateSummary(
  value: LexiconV3ProductionDatabaseSummary | undefined,
  profile: "core" | "full",
  releaseKey: string
): void {
  if (
    !value ||
    value.profile !== profile ||
    value.releaseKey !== releaseKey ||
    !value.path?.trim() ||
    !/^[a-f0-9]{64}$/u.test(value.sha256) ||
    !/^[a-f0-9]{64}$/u.test(value.logicalFingerprint) ||
    value.integrity !== "ok" ||
    value.foreignKeyViolations !== 0 ||
    value.freelistPages !== 0 ||
    !Number.isInteger(value.stepEntries) ||
    value.stepEntries <= 0
  ) {
    throw new Error(`bilingual-candidate-manifest-${profile}-invalid`);
  }
}

function hashCanonical(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
      .join(",")}}`;
  }
  const rendered = JSON.stringify(value);
  if (rendered === undefined) {
    throw new Error("unsupported-bilingual-candidate-manifest-value");
  }
  return rendered;
}
