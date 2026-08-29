import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  statSync
} from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

interface CachedFileHash {
  size: number;
  mtimeMs: number;
  ctimeMs: number;
  ino: number;
  hash: string;
}

const fileHashCache = new Map<string, CachedFileHash>();

interface CacheOutputRecord {
  path: string;
  hash: string;
}

interface CacheRecord {
  version: 2;
  fingerprint: string;
  outputs: CacheOutputRecord[];
  writtenAt: string;
}

export function contentFingerprint(options: {
  namespace: string;
  inputPaths?: string[];
  values?: unknown;
}): string {
  const hash = createHash("sha256");
  hash.update(options.namespace);
  hash.update("\0");
  hash.update(canonicalJson(options.values ?? null));

  for (const inputPath of [...(options.inputPaths ?? [])].sort()) {
    hash.update("\0");
    hash.update(inputPath);
    hash.update("\0");
    hash.update(hashPath(inputPath));
  }
  return hash.digest("hex");
}

export function cacheRecordMatches(
  metadataPath: string,
  fingerprint: string,
  outputPaths: string | string[]
): boolean {
  const record = readCacheRecord(metadataPath);
  return (
    record?.fingerprint === fingerprint &&
    cacheOutputsAreCurrent(metadataPath, record, outputPaths)
  );
}

/**
 * Checks only the content-addressed outputs recorded in a sidecar. This is
 * useful for resumable pipelines whose input database is expected to evolve
 * after an earlier task completed.
 */
export function cacheRecordIsCurrent(
  metadataPath: string,
  outputPaths: string | string[]
): boolean {
  const record = readCacheRecord(metadataPath);
  return (
    record !== undefined &&
    cacheOutputsAreCurrent(metadataPath, record, outputPaths)
  );
}

export async function writeCacheRecord(
  metadataPath: string,
  fingerprint: string,
  outputPaths: string | string[]
): Promise<void> {
  const normalizedOutputPaths = normalizeOutputPaths(outputPaths);
  if (normalizedOutputPaths.length === 0) {
    throw new Error(`cache-record-requires-output:${metadataPath}`);
  }
  const normalizedMetadataPath = path.resolve(metadataPath);
  if (normalizedOutputPaths.includes(normalizedMetadataPath)) {
    throw new Error(`cache-record-cannot-hash-itself:${metadataPath}`);
  }
  const ignoredPaths = new Set([normalizedMetadataPath]);
  const outputs = normalizedOutputPaths.map((outputPath) => {
    if (!existsSync(outputPath)) {
      throw new Error(`missing-cache-output:${outputPath}`);
    }
    return {
      path: outputPath,
      hash: hashPathFresh(outputPath, ignoredPaths)
    };
  });

  await mkdir(path.dirname(metadataPath), { recursive: true });
  const temporaryPath = `${metadataPath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(
      temporaryPath,
      `${JSON.stringify(
        {
          version: 2,
          fingerprint,
          outputs,
          writtenAt: new Date().toISOString()
        } satisfies CacheRecord,
        null,
        2
      )}\n`,
      "utf8"
    );
    await rename(temporaryPath, metadataPath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

export function fileCacheMetadataPath(filePath: string): string {
  return `${filePath}.strong-cache.json`;
}

export function directoryCacheMetadataPath(directoryPath: string): string {
  return path.join(directoryPath, ".strong-cache.json");
}

function hashPath(filePath: string): string {
  if (!existsSync(filePath)) return "missing";
  const stat = statSync(filePath);
  if (stat.isDirectory()) {
    const hash = createHash("sha256");
    for (const entry of readdirSync(filePath).sort()) {
      hash.update(entry);
      hash.update("\0");
      hash.update(hashPath(path.join(filePath, entry)));
      hash.update("\0");
    }
    return `directory:${hash.digest("hex")}`;
  }
  if (!stat.isFile()) return `not-a-regular-file:${stat.mode}`;
  const cached = fileHashCache.get(filePath);
  if (
    cached &&
    cached.size === stat.size &&
    cached.mtimeMs === stat.mtimeMs &&
    cached.ctimeMs === stat.ctimeMs &&
    cached.ino === stat.ino
  ) {
    return cached.hash;
  }
  const hash = createHash("sha256");
  const descriptor = openSync(filePath, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead = 0;
    do {
      bytesRead = readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    closeSync(descriptor);
  }
  const digest = hash.digest("hex");
  fileHashCache.set(filePath, {
    size: stat.size,
    mtimeMs: stat.mtimeMs,
    ctimeMs: stat.ctimeMs,
    ino: stat.ino,
    hash: digest
  });
  return digest;
}

function hashPathFresh(filePath: string, ignoredPaths: Set<string>): string {
  const normalizedPath = path.resolve(filePath);
  if (ignoredPaths.has(normalizedPath)) return "ignored";
  if (!existsSync(normalizedPath)) return "missing";
  const stat = statSync(normalizedPath);
  if (stat.isDirectory()) {
    const hash = createHash("sha256");
    for (const entry of readdirSync(normalizedPath).sort()) {
      const entryPath = path.join(normalizedPath, entry);
      if (ignoredPaths.has(entryPath)) continue;
      hash.update(entry);
      hash.update("\0");
      hash.update(hashPathFresh(entryPath, ignoredPaths));
      hash.update("\0");
    }
    return `directory:${hash.digest("hex")}`;
  }
  if (!stat.isFile()) return `not-a-regular-file:${stat.mode}`;

  const hash = createHash("sha256");
  const descriptor = openSync(normalizedPath, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead = 0;
    do {
      bytesRead = readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    closeSync(descriptor);
  }
  return hash.digest("hex");
}

function readCacheRecord(metadataPath: string): CacheRecord | undefined {
  if (!existsSync(metadataPath)) return undefined;
  try {
    const record = JSON.parse(
      readFileSync(metadataPath, "utf8")
    ) as Partial<CacheRecord>;
    if (
      record.version !== 2 ||
      typeof record.fingerprint !== "string" ||
      !Array.isArray(record.outputs) ||
      record.outputs.some(
        (output) =>
          typeof output?.path !== "string" || typeof output.hash !== "string"
      )
    ) {
      return undefined;
    }
    return record as CacheRecord;
  } catch {
    return undefined;
  }
}

function cacheOutputsAreCurrent(
  metadataPath: string,
  record: CacheRecord,
  outputPaths: string | string[]
): boolean {
  const normalizedOutputPaths = normalizeOutputPaths(outputPaths);
  if (
    normalizedOutputPaths.length === 0 ||
    record.outputs.length !== normalizedOutputPaths.length
  ) {
    return false;
  }
  const ignoredPaths = new Set([path.resolve(metadataPath)]);
  return record.outputs.every((output, index) => {
    const expectedPath = normalizedOutputPaths[index];
    return (
      expectedPath !== undefined &&
      output.path === expectedPath &&
      existsSync(expectedPath) &&
      output.hash === hashPathFresh(expectedPath, ignoredPaths)
    );
  });
}

function normalizeOutputPaths(outputPaths: string | string[]): string[] {
  return [
    ...new Set(
      (Array.isArray(outputPaths) ? outputPaths : [outputPaths]).map(
        (outputPath) => path.resolve(outputPath)
      )
    )
  ].sort();
}

function canonicalJson(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "undefined";
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
    .join(",")}}`;
}
