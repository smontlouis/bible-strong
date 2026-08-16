import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, realpath } from "node:fs/promises";
import path from "node:path";

export interface ResourcePublicationEnvelope {
  format: "bible-strong-resource-publication";
  schemaVersion: 1;
  identity: Record<string, unknown>;
  revision: string;
  canonical: {
    path: string;
    mediaType: "application/json";
    schemaVersion: number;
    sha256: string;
    bytes: number;
  };
  offlineArtifact: {
    path: string;
    mediaType: "application/zip";
    entry: string;
    sha256: string;
    bytes: number;
    contentSha256: string;
  };
  provenance: {
    generator: "bible-lexicon-maker";
    sourceVersion: string;
    sourceSha256: string;
    generatedAt: string;
  };
  rights: {
    holder: string;
    termsReference: string;
    attribution: string;
    online: boolean;
    offline: boolean;
  };
  deliveryCapabilities: {
    onlineAccess: boolean;
    offlineDownload: boolean;
  };
}

export function decodeResourcePublicationEnvelope(
  value: unknown
): ResourcePublicationEnvelope {
  if (!isRecord(value)) {
    throw new Error("resource-publication-manifest-invalid");
  }
  if (value.format !== "bible-strong-resource-publication") {
    throw new Error("resource-publication-manifest-format-invalid");
  }
  if (value.schemaVersion !== 1) {
    throw new Error(
      `resource-publication-manifest-version-unsupported:${String(value.schemaVersion)}`
    );
  }
  const canonical = value.canonical;
  const offline = value.offlineArtifact;
  const provenance = value.provenance;
  const rights = value.rights;
  const delivery = value.deliveryCapabilities;
  if (
    !isRecord(value.identity) ||
    !isNonEmptyString(value.revision) ||
    !isRecord(canonical) ||
    !isBundlePath(canonical.path) ||
    canonical.mediaType !== "application/json" ||
    !isNonNegativeInteger(canonical.schemaVersion) ||
    !isSha256(canonical.sha256) ||
    !isNonNegativeInteger(canonical.bytes) ||
    !isRecord(offline) ||
    !isBundlePath(offline.path) ||
    offline.mediaType !== "application/zip" ||
    !isBundlePath(offline.entry) ||
    !isSha256(offline.sha256) ||
    !isNonNegativeInteger(offline.bytes) ||
    !isSha256(offline.contentSha256) ||
    !isRecord(provenance) ||
    provenance.generator !== "bible-lexicon-maker" ||
    !isNonEmptyString(provenance.sourceVersion) ||
    !isSha256(provenance.sourceSha256) ||
    !isNonEmptyString(provenance.generatedAt) ||
    !isRecord(rights) ||
    !isNonEmptyString(rights.holder) ||
    !isNonEmptyString(rights.termsReference) ||
    !isNonEmptyString(rights.attribution) ||
    typeof rights.online !== "boolean" ||
    typeof rights.offline !== "boolean" ||
    !isRecord(delivery) ||
    typeof delivery.onlineAccess !== "boolean" ||
    typeof delivery.offlineDownload !== "boolean"
  ) {
    throw new Error("resource-publication-manifest-invalid");
  }
  if (
    (delivery.onlineAccess && !rights.online) ||
    (delivery.offlineDownload && !rights.offline)
  ) {
    throw new Error("resource-publication-rights-mismatch");
  }
  return value as unknown as ResourcePublicationEnvelope;
}

export function resolveResourcePublicationPath(
  bundleDir: string,
  relativePath: string
): string {
  if (!isBundlePath(relativePath)) {
    throw new Error("resource-publication-path-invalid");
  }
  const resolved = path.resolve(bundleDir, relativePath);
  if (!resolved.startsWith(`${bundleDir}${path.sep}`)) {
    throw new Error("resource-publication-path-invalid");
  }
  return resolved;
}

export async function assertResourcePublicationArtifact(
  filePath: string,
  artifact: { bytes: number; sha256: string },
  label: string,
  bundleDir: string
): Promise<void> {
  const fileStat = await lstat(filePath);
  const [realFilePath, realBundleDir] = await Promise.all([
    realpath(filePath),
    realpath(bundleDir)
  ]);
  if (
    !fileStat.isFile() ||
    !realFilePath.startsWith(`${realBundleDir}${path.sep}`) ||
    fileStat.size !== artifact.bytes ||
    (await sha256ResourcePublicationFile(filePath)) !== artifact.sha256
  ) {
    throw new Error(`resource-publication-${label}-integrity-mismatch`);
  }
}

export async function sha256ResourcePublicationFile(
  filePath: string
): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

export function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function isBundlePath(value: unknown): value is string {
  return (
    isNonEmptyString(value) &&
    !path.isAbsolute(value) &&
    !value.includes("\\") &&
    value
      .split("/")
      .every(
        (segment) => segment.length > 0 && segment !== "." && segment !== ".."
      )
  );
}
