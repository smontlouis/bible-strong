import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { writeJsonFileImmutable } from "./immutableFile.js";

interface FrozenSource {
  path: string;
  sha256: string;
}

interface FreezeManifest {
  generatedAt: string;
  status: "frozen-for-arbitration";
  packet: string;
  sources: Record<string, FrozenSource>;
}

function requiredArg(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`missing-argument:${name}`);
  return value;
}

function repeatedArgs(name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) {
      values.push(process.argv[index + 1] as string);
    }
  }
  return values;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function sourceRecord(spec: string): Promise<[string, FrozenSource]> {
  const separator = spec.indexOf("=");
  if (separator <= 0 || separator === spec.length - 1) {
    throw new Error(`invalid-source:${spec}`);
  }
  const name = spec.slice(0, separator);
  const sourcePath = spec.slice(separator + 1);
  const raw = await readFile(sourcePath, "utf8");
  return [name, { path: sourcePath, sha256: sha256(raw) }];
}

export async function verifyFreezeManifest(
  manifest: FreezeManifest
): Promise<void> {
  for (const [name, source] of Object.entries(manifest.sources)) {
    const current = sha256(await readFile(source.path, "utf8"));
    if (current !== source.sha256) {
      throw new Error(
        `frozen-source-changed:${name}:${source.sha256}:${current}`
      );
    }
  }
}

async function main(): Promise<void> {
  const outputPath = requiredArg("--output");
  if (process.argv.includes("--verify")) {
    const manifest = JSON.parse(
      await readFile(outputPath, "utf8")
    ) as FreezeManifest;
    await verifyFreezeManifest(manifest);
    process.stdout.write(
      `${JSON.stringify({ output: outputPath, status: "verified", sources: manifest.sources }, null, 2)}\n`
    );
    return;
  }

  if (existsSync(outputPath)) {
    throw new Error(`freeze-manifest-already-exists:${outputPath}`);
  }
  const sourceSpecs = repeatedArgs("--source");
  if (sourceSpecs.length === 0) throw new Error("missing-argument:--source");
  const sourceEntries = await Promise.all(sourceSpecs.map(sourceRecord));
  const sources = Object.fromEntries(sourceEntries);
  if (Object.keys(sources).length !== sourceEntries.length) {
    throw new Error("duplicate-source-name");
  }
  const manifest: FreezeManifest = {
    generatedAt: new Date().toISOString(),
    status: "frozen-for-arbitration",
    packet: requiredArg("--packet"),
    sources
  };
  await writeJsonFileImmutable(outputPath, manifest);
  process.stdout.write(
    `${JSON.stringify({ output: path.resolve(outputPath), ...manifest }, null, 2)}\n`
  );
}

if (process.argv[1]?.endsWith("semanticRefillArtifactFreeze.ts")) {
  await main();
}
