import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * Fingerprint every executable TypeScript input that can affect a Lexicon V3
 * authoring, release, projection, or deployment. Release verification replays
 * this function from disk; a copied meta value is never treated as proof that
 * the currently checked-out projector is unchanged.
 */
export function lexiconV3CodeFingerprint(): string {
  const sourceFiles = listTypescriptFiles("src");
  const lexiconFiles = listTypescriptFiles("src/lexiconV3");
  const pipelineScripts = listTypescriptFiles("scripts").filter((path) =>
    /LexiconV3/iu.test(basename(path))
  );
  const candidates = [
    ...new Set([...sourceFiles, ...lexiconFiles, ...pipelineScripts])
  ].sort();
  const digests = candidates.map((path) => ({
    path,
    digest: createHash("sha256")
      .update(readFileSync(resolve(PROJECT_ROOT, path)))
      .digest("hex")
  }));
  return createHash("sha256").update(stableJson(digests)).digest("hex");
}

function listTypescriptFiles(directory: string): string[] {
  const resolved = resolve(PROJECT_ROOT, directory);
  if (!existsSync(resolved)) return [];
  return readdirSync(resolved, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => relative(PROJECT_ROOT, join(resolved, entry.name)));
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
