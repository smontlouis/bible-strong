import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildMobileResourceCatalog,
  type MobileResourceInventoryEntry
} from "./packageMobileResourceCatalog.js";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Resource artifacts live in R2. Delivered archives keep the immutable key the
 * Resource service publishes them under (`revisions/<sha256>/<path>`); new
 * authoring inputs use `sources/<sha256>/<path>`. Tools read them with the
 * operator's wrangler session, never through the public Worker.
 */
export const R2_SOURCE_SCHEME = "r2://";
export const DEFAULT_R2_BUCKET = "bible-strong-resource-artifacts-prod";

const RESOURCE_SERVICE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../packages/resource-service"
);

export const isR2Location = (location: string) =>
  location.startsWith(R2_SOURCE_SCHEME);

export const r2Location = (bucket: string, key: string) =>
  `${R2_SOURCE_SCHEME}${bucket}/${key}`;

export const parseR2Location = (location: string) => {
  const match = /^r2:\/\/([^/]+)\/(.+)$/u.exec(location);
  if (!match) throw new Error(`r2-location-invalid:${location}`);
  return { bucket: match[1]!, key: match[2]! };
};

/** The SHA-256 a content-addressed key promises, when it carries one. */
export const keySha256 = (key: string) =>
  /^(?:revisions|sources)\/([0-9a-f]{64})\//u.exec(key)?.[1];

const sha256File = async (filePath: string) =>
  createHash("sha256")
    .update(await readFile(filePath))
    .digest("hex");

/**
 * Downloads an `r2://bucket/key` object to `destination` and, for
 * content-addressed keys, proves the bytes match the key's SHA-256.
 */
export async function downloadR2Object(location: string, destination: string) {
  const { bucket, key } = parseR2Location(location);
  await mkdir(path.dirname(destination), { recursive: true });
  try {
    await execFileAsync(
      "yarn",
      [
        "wrangler",
        "r2",
        "object",
        "get",
        `${bucket}/${key}`,
        "--file",
        destination,
        "--remote"
      ],
      { cwd: RESOURCE_SERVICE_DIR, maxBuffer: 16 * 1024 * 1024 }
    );
  } catch (cause) {
    throw new Error(`r2-object-read-failed:${location}`, { cause });
  }
  const expected = keySha256(key);
  if (expected && (await sha256File(destination)) !== expected) {
    throw new Error(`r2-object-integrity-mismatch:${location}`);
  }
}

/** Uploads a local file under a content-addressed `sources/` key. */
export async function uploadR2Source(options: {
  bucket: string;
  filePath: string;
  fileName: string;
  contentType: string;
}): Promise<string> {
  const key = `sources/${await sha256File(options.filePath)}/${options.fileName}`;
  try {
    await execFileAsync(
      "yarn",
      [
        "wrangler",
        "r2",
        "object",
        "put",
        `${options.bucket}/${key}`,
        "--file",
        path.resolve(options.filePath),
        "--content-type",
        options.contentType,
        "--cache-control",
        "private, no-store",
        "--remote"
      ],
      { cwd: RESOURCE_SERVICE_DIR, maxBuffer: 16 * 1024 * 1024 }
    );
  } catch (cause) {
    throw new Error(`r2-object-write-failed:${key}`, { cause });
  }
  return r2Location(options.bucket, key);
}

interface BuiltArchive {
  catalogId: string;
  archivePath: string;
  entry: string;
  sha256: string;
}

/** Offline archives of the publication bundles found in the given folders. */
async function findBuiltArchives(
  bundleRoots: readonly string[]
): Promise<BuiltArchive[]> {
  const archives: BuiltArchive[] = [];
  for (const root of bundleRoots) {
    for (const name of await readdir(root)) {
      const manifestPath = path.join(root, name, "manifest.json");
      if (!existsSync(manifestPath)) continue;
      const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
        identity: { kind: string; versionId: string };
        offlineArtifact: { path: string; entry: string; sha256: string };
      };
      const prefix =
        manifest.identity.kind === "strong-bible-index"
          ? "bible-strong"
          : manifest.identity.kind === "bible-text"
            ? "bible"
            : undefined;
      if (!prefix) continue;
      archives.push({
        catalogId: `${prefix}:${manifest.identity.versionId}`,
        archivePath: path.join(root, name, manifest.offlineArtifact.path),
        entry: manifest.offlineArtifact.entry,
        sha256: manifest.offlineArtifact.sha256
      });
    }
  }
  return archives;
}

const readJson = async <Value>(filePath: string) =>
  JSON.parse(await readFile(filePath, "utf8")) as Value;

type CatalogResources = Record<string, { archiveSha256: string }>;

/**
 * Source overrides for `resources:release:mobile`: every built archive that
 * differs from the delivered catalog is cataloged from its local bytes.
 */
export async function writeCatalogOverrides(options: {
  root: string;
  bundleRoots: readonly string[];
  output: string;
}) {
  const catalog = await readJson<{ resources: CatalogResources }>(
    path.join(
      options.root,
      "../../packages/resource-catalog/src/mobile-resource-catalog.json"
    )
  );
  const overrides: Record<string, { canonical: string }> = {};
  for (const archive of await findBuiltArchives(options.bundleRoots)) {
    if (catalog.resources[archive.catalogId]?.archiveSha256 === archive.sha256)
      continue;
    overrides[archive.catalogId] = {
      canonical: path.resolve(archive.archivePath)
    };
  }
  await writeFile(options.output, `${JSON.stringify(overrides, null, 2)}\n`);
  return overrides;
}

/**
 * Replaces, in the delivered mobile catalog, only the entries of built
 * archives that changed. Entries are computed by the catalog builder from the
 * local archives; every other entry, encrypted copies included, is kept as is,
 * so the patch needs no other source. Changed entries lose their encrypted
 * copy until `resources:offline:encrypt` recreates it.
 */
export async function patchMobileCatalog(options: {
  root: string;
  bundleRoots: readonly string[];
  generatedAt: string;
}) {
  const catalogPath = path.join(
    options.root,
    "../../packages/resource-catalog/src/mobile-resource-catalog.json"
  );
  const catalog = await readJson<{
    generatedAt: string;
    resourceCount: number;
    resources: Record<
      string,
      { archiveSha256: string } & Record<string, unknown>
    >;
  }>(catalogPath);
  if (options.generatedAt <= catalog.generatedAt) {
    throw new Error("mobile-catalog-patch-generated-at-not-newer");
  }
  const changed = (await findBuiltArchives(options.bundleRoots)).filter(
    (archive) =>
      catalog.resources[archive.catalogId]?.archiveSha256 !== archive.sha256
  );
  if (changed.length === 0) return [];
  const inventory = (
    await readJson<MobileResourceInventoryEntry[]>(
      path.join(options.root, "config/mobile-resource-inventory.json")
    )
  ).filter((entry) =>
    changed.some((archive) => archive.catalogId === entry.id)
  );
  const workDir = await mkdtemp(path.join(tmpdir(), "mobile-catalog-patch-"));
  try {
    const result = await buildMobileResourceCatalog({
      root: options.root,
      outputDir: path.join(workDir, "release"),
      inventory,
      requiredIds: changed.map((archive) => archive.catalogId),
      requiredBundleRoles: {},
      generatedAt: options.generatedAt,
      sourceOverrides: Object.fromEntries(
        changed.map((archive) => [
          archive.catalogId,
          { canonical: archive.archivePath }
        ])
      )
    });
    const patch = await readJson<{ resources: typeof catalog.resources }>(
      result.catalogPath
    );
    for (const archive of changed) {
      const entry = patch.resources[archive.catalogId];
      if (entry?.archiveSha256 !== archive.sha256) {
        throw new Error(
          `mobile-catalog-patch-archive-mismatch:${archive.catalogId}`
        );
      }
      catalog.resources[archive.catalogId] = entry;
    }
    catalog.generatedAt = options.generatedAt;
    await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
  return changed.map((archive) => archive.catalogId);
}

/**
 * Points the mobile inventory at the R2 copies of published archives, after
 * reading each one back from R2 and proving its SHA-256. The catalog then
 * stays reproducible from the inventory without any other host.
 */
export async function adoptPublishedArchives(options: {
  root: string;
  bundleRoots: readonly string[];
  bucket: string;
}) {
  const inventoryPath = path.join(
    options.root,
    "config/mobile-resource-inventory.json"
  );
  const requiredIdsPath = path.join(
    options.root,
    "config/mobile-resource-required-ids.json"
  );
  const inventory = await readJson<
    Array<{
      id: string;
      artifactUrl: string;
      sources: Array<Record<string, string>>;
    }>
  >(inventoryPath);
  const requiredIds = await readJson<{
    bundleRoles?: Record<string, string[]>;
  }>(requiredIdsPath);
  const adopted: string[] = [];
  const workDir = await mkdtemp(path.join(tmpdir(), "r2-adopt-"));
  try {
    for (const archive of await findBuiltArchives(options.bundleRoots)) {
      const resource = inventory.find(
        (entry) => entry.id === archive.catalogId
      );
      if (!resource)
        throw new Error(`r2-adopt-inventory-missing:${archive.catalogId}`);
      const stableKey = new URL(resource.artifactUrl).pathname.replace(
        /^\/+/u,
        ""
      );
      const location = r2Location(
        options.bucket,
        `revisions/${archive.sha256}/${stableKey}`
      );
      const current = resource.sources;
      if (current.length === 1 && current[0]!.sourceUrl === location) continue;
      await downloadR2Object(location, path.join(workDir, "object"));
      resource.sources = [
        { role: "canonical", sourceUrl: location, entry: archive.entry }
      ];
      delete requiredIds.bundleRoles?.[archive.catalogId];
      adopted.push(archive.catalogId);
    }
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
  await writeFile(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);
  await writeFile(requiredIdsPath, `${JSON.stringify(requiredIds, null, 2)}\n`);
  return adopted;
}

async function main(argv: readonly string[]) {
  const [command, ...rest] = argv;
  const bundleRoots: string[] = [];
  let output: string | undefined;
  for (let index = 0; index < rest.length; index += 2) {
    if (rest[index] === "--bundles")
      bundleRoots.push(path.resolve(rest[index + 1]!));
    else if (rest[index] === "--output")
      output = path.resolve(rest[index + 1]!);
    else throw new Error(`r2-artifact-sources-argument-unknown:${rest[index]}`);
  }
  if (bundleRoots.length === 0)
    throw new Error("r2-artifact-sources-bundles-required");
  const root = process.cwd();
  if (command === "catalog-overrides") {
    if (!output) throw new Error("r2-artifact-sources-output-required");
    const overrides = await writeCatalogOverrides({
      root,
      bundleRoots,
      output
    });
    console.log(
      `${Object.keys(overrides).length} changed archives → ${output}`
    );
  } else if (command === "catalog-patch") {
    const generatedAt = process.env.MOBILE_CATALOG_GENERATED_AT?.trim();
    if (!generatedAt)
      throw new Error("r2-artifact-sources-generated-at-required");
    const patched = await patchMobileCatalog({
      root,
      bundleRoots,
      generatedAt
    });
    console.log(
      `${patched.length} catalog entries patched: ${patched.join(" ")}`
    );
  } else if (command === "adopt") {
    const bucket = process.env.RESOURCE_R2_BUCKET?.trim() || DEFAULT_R2_BUCKET;
    const adopted = await adoptPublishedArchives({ root, bundleRoots, bucket });
    console.log(
      `${adopted.length} inventory entries now point at R2: ${adopted.join(" ")}`
    );
  } else {
    throw new Error(
      "usage: r2ArtifactSources <catalog-overrides|catalog-patch|adopt> --bundles <dir>..."
    );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
