import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import {
  copyFile,
  chmod,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  utimes,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const REPRODUCIBLE_ZIP_TIME = new Date("1980-01-01T00:00:00.000Z");

export const MOBILE_RESOURCE_CATALOG_SCHEMA_VERSION = 1;
export const DEFAULT_MOBILE_RESOURCE_INVENTORY =
  "config/mobile-resource-inventory.json";
export const DEFAULT_MOBILE_RESOURCE_REQUIRED_IDS =
  "config/mobile-resource-required-ids.json";
export const DEFAULT_MOBILE_RESOURCE_RELEASE =
  "outputs/releases/mobile-resources-current";
export const MOBILE_RESOURCE_CATALOG_FILE = "mobile-resource-catalog.json";
export const MOBILE_RESOURCE_ARTIFACT_BASE_URL =
  "https://api.bible-strong.app/v1/offline-artifacts/";

export type MobileResourceInstallationStrategy =
  | "sqlite-import"
  | "archive-extract";

export type MobileResourceEntryRole = "canonical" | "pericope" | "redWords";

export interface MobileResourceInventorySource {
  role: MobileResourceEntryRole;
  sourceUrl: string;
  sourcePath?: string;
  entry: string;
}

export interface MobileResourceInventoryEntry {
  id: string;
  artifactUrl: string;
  sources: MobileResourceInventorySource[];
  strategy: MobileResourceInstallationStrategy;
  resourceRevision?: string;
  coreRevision?: string;
}

export interface MobileResourceCatalogFileEntry {
  entry: string;
  sha256: string;
  bytes: number;
}

export interface MobileResourceCatalogEntry {
  id: string;
  url: string;
  file: string;
  entry: string;
  entries: Partial<
    Record<MobileResourceEntryRole, MobileResourceCatalogFileEntry>
  >;
  archiveSha256: string;
  archiveBytes: number;
  contentSha256: string;
  contentBytes: number;
  installedBytes: number;
  peakInstallationBytes: number;
  strategy: MobileResourceInstallationStrategy;
  resourceRevision?: string;
  coreRevision?: string;
}

export interface MobileResourceCatalog {
  format: "bible-strong-mobile-resource-catalog";
  schemaVersion: number;
  generatedAt: string;
  resourceCount: number;
  resources: Record<string, MobileResourceCatalogEntry>;
}

type MobileResourceBundleRoles = Record<
  string,
  Exclude<MobileResourceEntryRole, "canonical">[]
>;
type MobileResourceSourceOverrides = Record<
  string,
  Partial<Record<MobileResourceEntryRole, string>>
>;

export function validateMobileResourceInventory(
  inventory: readonly MobileResourceInventoryEntry[],
  requiredIds?: readonly string[],
  requiredBundleRoles?: MobileResourceBundleRoles
): void {
  if (inventory.length === 0)
    throw new Error("mobile-resource-inventory-empty");
  const ids = new Set<string>();
  const artifactPaths = new Set<string>();
  for (const resource of inventory) {
    if (!resource.id.trim()) throw new Error("mobile-resource-id-empty");
    if (ids.has(resource.id)) {
      throw new Error(`mobile-resource-id-duplicate:${resource.id}`);
    }
    ids.add(resource.id);
    if (
      resource.id.startsWith("strong-lexicon:") &&
      !resource.resourceRevision?.trim()
    ) {
      throw new Error(`mobile-resource-revision-missing:${resource.id}`);
    }
    if (
      resource.id.startsWith("strong-lexicon:") &&
      resource.id !== "strong-lexicon:core" &&
      !resource.coreRevision?.trim()
    ) {
      throw new Error(`mobile-resource-core-revision-missing:${resource.id}`);
    }
    if (
      !(["sqlite-import", "archive-extract"] as const).includes(
        resource.strategy
      )
    ) {
      throw new Error(`mobile-resource-strategy-invalid:${resource.id}`);
    }
    if (!resource.artifactUrl.endsWith(".zip")) {
      throw new Error(`mobile-resource-artifact-must-be-zip:${resource.id}`);
    }
    const artifactPath = artifactPathFromUrl(resource.artifactUrl);
    if (artifactPaths.has(artifactPath)) {
      throw new Error(`mobile-resource-artifact-duplicate:${artifactPath}`);
    }
    artifactPaths.add(artifactPath);
    if (resource.sources.length === 0) {
      throw new Error(`mobile-resource-sources-empty:${resource.id}`);
    }
    const roles = new Set<MobileResourceEntryRole>();
    const entries = new Set<string>();
    for (const source of resource.sources) {
      if (
        !(
          source.role === "canonical" ||
          source.role === "pericope" ||
          source.role === "redWords"
        )
      ) {
        throw new Error(
          `mobile-resource-role-invalid:${resource.id}:${source.role}`
        );
      }
      if (roles.has(source.role)) {
        throw new Error(
          `mobile-resource-role-duplicate:${resource.id}:${source.role}`
        );
      }
      if (source.role !== "canonical" && !resource.id.startsWith("bible:")) {
        throw new Error(
          `mobile-resource-bible-role-invalid:${resource.id}:${source.role}`
        );
      }
      roles.add(source.role);
      if (!source.entry || path.basename(source.entry) !== source.entry) {
        throw new Error(`mobile-resource-entry-invalid:${resource.id}`);
      }
      if (entries.has(source.entry)) {
        throw new Error(
          `mobile-resource-entry-duplicate:${resource.id}:${source.entry}`
        );
      }
      entries.add(source.entry);
      if (!source.sourceUrl.startsWith("https://")) {
        throw new Error(`mobile-resource-source-invalid:${resource.id}`);
      }
      if (source.sourcePath && !existsSync(source.sourcePath)) {
        throw new Error(
          `mobile-resource-source-path-missing:${resource.id}:${source.role}`
        );
      }
    }
    if (!roles.has("canonical")) {
      throw new Error(`mobile-resource-canonical-entry-missing:${resource.id}`);
    }
    if (
      resource.sources.length > 1 &&
      resource.sources.some((source) =>
        (source.sourcePath ?? source.sourceUrl).endsWith(".zip")
      )
    ) {
      throw new Error(
        `mobile-resource-bundle-source-must-be-direct:${resource.id}`
      );
    }
  }
  if (requiredIds) {
    const required = new Set(requiredIds);
    const missing = [...required].filter((id) => !ids.has(id));
    const unexpected = [...ids].filter((id) => !required.has(id));
    if (missing.length > 0) {
      throw new Error(
        `mobile-resource-required-id-missing:${missing.join(",")}`
      );
    }
    if (unexpected.length > 0) {
      throw new Error(
        `mobile-resource-required-id-unexpected:${unexpected.join(",")}`
      );
    }
  }
  if (requiredBundleRoles) {
    const actual = Object.fromEntries(
      inventory.flatMap((resource) => {
        const roles = resource.sources
          .map((source) => source.role)
          .filter(
            (role): role is Exclude<MobileResourceEntryRole, "canonical"> =>
              role !== "canonical"
          )
          .sort();
        return roles.length > 0 ? [[resource.id, roles]] : [];
      })
    );
    if (JSON.stringify(actual) !== JSON.stringify(requiredBundleRoles)) {
      throw new Error("mobile-resource-bundle-contract-mismatch");
    }
  }
}

export async function buildMobileResourceCatalog(
  options: {
    root?: string;
    outputDir?: string;
    inventory?: readonly MobileResourceInventoryEntry[];
    inventoryPath?: string;
    requiredIds?: readonly string[];
    requiredBundleRoles?: MobileResourceBundleRoles;
    requiredIdsPath?: string;
    appRoot?: string;
    sourceOverrides?: MobileResourceSourceOverrides;
    sourceOverridesPath?: string;
    generatedAt?: string;
    fetcher?: typeof fetch;
  } = {}
): Promise<{
  outputDir: string;
  catalogPath: string;
  catalogSha256: string;
  resourceCount: number;
}> {
  const root = path.resolve(options.root ?? process.cwd());
  const outputDir = path.resolve(
    root,
    options.outputDir ?? DEFAULT_MOBILE_RESOURCE_RELEASE
  );
  if (existsSync(outputDir)) {
    throw new Error(`mobile-resource-release-already-exists:${outputDir}`);
  }
  const baseInventory = options.inventory
    ? [...options.inventory]
    : await readInventory(
        path.resolve(
          root,
          options.inventoryPath ?? DEFAULT_MOBILE_RESOURCE_INVENTORY
        )
      );
  const sourceOverrides =
    options.sourceOverrides ??
    (options.sourceOverridesPath
      ? await readSourceOverrides(
          path.resolve(root, options.sourceOverridesPath)
        )
      : undefined);
  const inventory = applySourceOverrides(baseInventory, sourceOverrides, root);
  const requiredContract = options.requiredIds
    ? {
        resourceIds: options.requiredIds,
        bundleRoles: options.requiredBundleRoles
      }
    : await readRequiredContract(
        path.resolve(
          root,
          options.requiredIdsPath ?? DEFAULT_MOBILE_RESOURCE_REQUIRED_IDS
        )
      );
  validateMobileResourceInventory(
    inventory,
    requiredContract.resourceIds,
    requiredContract.bundleRoles
  );

  const temporaryDir = `${outputDir}.tmp-${process.pid}-${randomUUID()}`;
  const downloadDir = path.join(temporaryDir, ".downloads");
  const stagingDir = path.join(temporaryDir, ".staging");
  await mkdir(downloadDir, { recursive: true });
  await mkdir(stagingDir, { recursive: true });

  try {
    const entries = await mapConcurrent(inventory, 6, (resource) =>
      packageResource({
        resource,
        outputDir: temporaryDir,
        downloadDir,
        stagingDir,
        fetcher: options.fetcher ?? fetch
      })
    );
    const resources = Object.fromEntries(
      entries
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((entry) => [entry.id, entry])
    );
    const catalog: MobileResourceCatalog = {
      format: "bible-strong-mobile-resource-catalog",
      schemaVersion: MOBILE_RESOURCE_CATALOG_SCHEMA_VERSION,
      generatedAt: options.generatedAt ?? new Date().toISOString(),
      resourceCount: entries.length,
      resources
    };
    const catalogPath = path.join(temporaryDir, MOBILE_RESOURCE_CATALOG_FILE);
    await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
    await writeChecksums(temporaryDir, entries);
    await rm(downloadDir, { recursive: true, force: true });
    await rm(stagingDir, { recursive: true, force: true });
    const catalogSha256 = await sha256File(catalogPath);
    await mkdir(path.dirname(outputDir), { recursive: true });
    await rename(temporaryDir, outputDir);
    if (options.appRoot) {
      await synchronizeCatalogWithApp({
        outputDir,
        appRoot: path.resolve(root, options.appRoot)
      });
    }
    return {
      outputDir,
      catalogPath: path.join(outputDir, MOBILE_RESOURCE_CATALOG_FILE),
      catalogSha256,
      resourceCount: entries.length
    };
  } catch (error) {
    await rm(temporaryDir, { recursive: true, force: true });
    throw error;
  }
}

async function packageResource(options: {
  resource: MobileResourceInventoryEntry;
  outputDir: string;
  downloadDir: string;
  stagingDir: string;
  fetcher: typeof fetch;
}): Promise<MobileResourceCatalogEntry> {
  const { resource } = options;
  const artifactFile = artifactPathFromUrl(resource.artifactUrl);
  const artifactPath = path.join(options.outputDir, artifactFile);
  const downloadedSources = await Promise.all(
    resource.sources.map(async (source) => {
      const sourceLocation = source.sourcePath ?? source.sourceUrl;
      const sourceIsZip = sourceLocation.endsWith(".zip");
      const sourcePath = path.join(
        options.downloadDir,
        `${createHash("sha256")
          .update(`${resource.id}:${source.role}`)
          .digest("hex")}${sourceIsZip ? ".zip" : path.extname(source.entry)}`
      );
      if (source.sourcePath) {
        await copyFile(source.sourcePath, sourcePath);
      } else {
        const response = await options.fetcher(source.sourceUrl);
        if (!response.ok) {
          throw new Error(
            `mobile-resource-download-failed:${resource.id}:${source.role}:${response.status}`
          );
        }
        await writeFile(sourcePath, Buffer.from(await response.arrayBuffer()));
      }
      await validateResourceContent(
        sourcePath,
        source.entry,
        sourceIsZip,
        resource.id,
        source.role
      );
      return { source, sourcePath };
    })
  );
  await mkdir(path.dirname(artifactPath), { recursive: true });

  const onlySource =
    downloadedSources.length === 1 ? downloadedSources[0] : undefined;
  if (
    onlySource &&
    (onlySource.source.sourcePath ?? onlySource.source.sourceUrl).endsWith(
      ".zip"
    )
  ) {
    await assertArchiveEntries(
      onlySource.sourcePath,
      [onlySource.source.entry],
      resource.id
    );
    await copyFile(onlySource.sourcePath, artifactPath);
    await validateResourceContent(
      artifactPath,
      onlySource.source.entry,
      true,
      resource.id,
      onlySource.source.role
    );
  } else {
    await createDeterministicZip({
      inputs: downloadedSources.map(({ source, sourcePath }) => ({
        inputPath: sourcePath,
        entryName: source.entry
      })),
      archivePath: artifactPath,
      stagingRoot: path.join(
        options.stagingDir,
        createHash("sha256").update(resource.id).digest("hex")
      )
    });
  }

  const catalogEntries = Object.fromEntries(
    await Promise.all(
      resource.sources.map(async (source) => {
        const content = await readArchiveEntry(artifactPath, source.entry);
        return [
          source.role,
          {
            entry: source.entry,
            sha256: sha256Buffer(content),
            bytes: content.length
          }
        ];
      })
    )
  ) as MobileResourceCatalogEntry["entries"];
  const canonicalEntry = catalogEntries.canonical!;
  const contentBytes = Object.values(catalogEntries).reduce(
    (total, entry) => total + (entry?.bytes ?? 0),
    0
  );
  const contentSha256 =
    resource.sources.length === 1
      ? canonicalEntry.sha256
      : sha256Buffer(
          Buffer.from(
            Object.entries(catalogEntries)
              .sort(([left], [right]) => left.localeCompare(right))
              .map(([role, entry]) => `${role}:${entry!.sha256}`)
              .join("\n")
          )
        );

  const archiveBytes = (await stat(artifactPath)).size;
  const archiveSha256 = await sha256File(artifactPath);
  const artifactUrl = new URL(artifactFile, MOBILE_RESOURCE_ARTIFACT_BASE_URL);
  artifactUrl.searchParams.set("sha256", archiveSha256);
  const installedBytes =
    resource.strategy === "sqlite-import"
      ? Math.ceil(contentBytes * 1.25)
      : contentBytes;
  const peakInstallationBytes = Math.ceil(
    (resource.strategy === "sqlite-import"
      ? archiveBytes + contentBytes + installedBytes * 1.3
      : archiveBytes + contentBytes) * 1.15
  );
  return {
    id: resource.id,
    url: artifactUrl.toString(),
    file: artifactFile,
    entry: canonicalEntry.entry,
    entries: catalogEntries,
    archiveSha256,
    archiveBytes,
    contentSha256,
    contentBytes,
    installedBytes,
    peakInstallationBytes,
    strategy: resource.strategy,
    resourceRevision: resource.resourceRevision,
    coreRevision: resource.coreRevision
  };
}

async function createDeterministicZip(options: {
  inputs: readonly { inputPath: string; entryName: string }[];
  archivePath: string;
  stagingRoot: string;
}): Promise<void> {
  await mkdir(options.stagingRoot, { recursive: true });
  const entryNames = [...options.inputs]
    .sort((left, right) => left.entryName.localeCompare(right.entryName))
    .map(({ inputPath, entryName }) => ({ inputPath, entryName }));
  for (const input of entryNames) {
    const stagedPath = path.join(options.stagingRoot, input.entryName);
    await copyFile(input.inputPath, stagedPath);
    await chmod(stagedPath, 0o644);
    await utimes(stagedPath, REPRODUCIBLE_ZIP_TIME, REPRODUCIBLE_ZIP_TIME);
  }
  await execFileAsync(
    "zip",
    [
      "-X",
      "-9",
      "-q",
      options.archivePath,
      ...entryNames.map(({ entryName }) => entryName)
    ],
    { cwd: options.stagingRoot, env: { ...process.env, TZ: "UTC" } }
  );
}

async function assertArchiveEntries(
  archivePath: string,
  expectedEntries: readonly string[],
  resourceId: string
): Promise<void> {
  const { stdout } = await execFileAsync("unzip", ["-Z1", archivePath]);
  const entries = stdout
    .split("\n")
    .map((value) => value.trim())
    .filter(Boolean);
  if (
    entries.length !== expectedEntries.length ||
    [...entries].sort().join("\n") !== [...expectedEntries].sort().join("\n")
  ) {
    throw new Error(
      `mobile-resource-archive-entry-mismatch:${resourceId}:${entries.join(",")}`
    );
  }
}

async function readArchiveEntry(
  archivePath: string,
  entry: string
): Promise<Buffer> {
  const { stdout } = await execFileAsync("unzip", ["-p", archivePath, entry], {
    encoding: "buffer",
    maxBuffer: 512 * 1024 * 1024
  });
  return Buffer.from(stdout);
}

async function validateResourceContent(
  filePath: string,
  entryName: string,
  isArchive: boolean,
  resourceId: string,
  role: MobileResourceEntryRole
): Promise<void> {
  const content = isArchive
    ? await readArchiveEntry(filePath, entryName)
    : await readFile(filePath);
  if (entryName.endsWith(".json")) {
    try {
      JSON.parse(content.toString("utf8"));
    } catch {
      throw new Error(`mobile-resource-json-invalid:${resourceId}:${role}`);
    }
    return;
  }
  if (
    entryName.endsWith(".sqlite") &&
    !content.subarray(0, 16).equals(Buffer.from("SQLite format 3\0"))
  ) {
    throw new Error(`mobile-resource-sqlite-invalid:${resourceId}:${role}`);
  }
}

function artifactPathFromUrl(url: string): string {
  const pathname = new URL(url).pathname.replace(/^\/+/, "");
  if (!pathname || pathname.split("/").some((part) => part === "..")) {
    throw new Error(`mobile-resource-artifact-path-invalid:${url}`);
  }
  return pathname;
}

function applySourceOverrides(
  inventory: readonly MobileResourceInventoryEntry[],
  overrides: MobileResourceSourceOverrides | undefined,
  root: string
): MobileResourceInventoryEntry[] {
  if (!overrides) return inventory.map((resource) => ({ ...resource }));
  const knownIds = new Set(inventory.map((resource) => resource.id));
  for (const resourceId of Object.keys(overrides)) {
    if (!knownIds.has(resourceId)) {
      throw new Error(
        `mobile-resource-source-override-id-unknown:${resourceId}`
      );
    }
  }
  return inventory.map((resource) => {
    const resourceOverrides = overrides[resource.id];
    if (!resourceOverrides) return { ...resource };
    const knownRoles = new Set(resource.sources.map((source) => source.role));
    for (const role of Object.keys(resourceOverrides)) {
      if (!knownRoles.has(role as MobileResourceEntryRole)) {
        throw new Error(
          `mobile-resource-source-override-role-unknown:${resource.id}:${role}`
        );
      }
    }
    return {
      ...resource,
      sources: resource.sources.map((source) => {
        const overridePath = resourceOverrides[source.role];
        return overridePath
          ? { ...source, sourcePath: path.resolve(root, overridePath) }
          : { ...source };
      })
    };
  });
}

async function readSourceOverrides(
  overridesPath: string
): Promise<MobileResourceSourceOverrides> {
  const value = JSON.parse(await readFile(overridesPath, "utf8")) as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(
      `mobile-resource-source-overrides-invalid:${overridesPath}`
    );
  }
  return value as MobileResourceSourceOverrides;
}

async function readInventory(
  inventoryPath: string
): Promise<MobileResourceInventoryEntry[]> {
  return JSON.parse(
    await readFile(inventoryPath, "utf8")
  ) as MobileResourceInventoryEntry[];
}

async function readRequiredContract(requiredIdsPath: string): Promise<{
  resourceIds: string[];
  bundleRoles: MobileResourceBundleRoles;
}> {
  const contract = JSON.parse(await readFile(requiredIdsPath, "utf8")) as {
    schemaVersion?: number;
    resourceIds?: unknown;
    bundleRoles?: unknown;
  };
  if (
    contract.schemaVersion !== 1 ||
    !Array.isArray(contract.resourceIds) ||
    contract.resourceIds.some((id) => typeof id !== "string") ||
    !contract.bundleRoles ||
    typeof contract.bundleRoles !== "object" ||
    Array.isArray(contract.bundleRoles)
  ) {
    throw new Error(`mobile-resource-required-ids-invalid:${requiredIdsPath}`);
  }
  return {
    resourceIds: contract.resourceIds as string[],
    bundleRoles: contract.bundleRoles as MobileResourceBundleRoles
  };
}

async function synchronizeCatalogWithApp(options: {
  outputDir: string;
  appRoot: string;
}): Promise<void> {
  const assetsDirectory = path.join(options.appRoot, "src", "assets");
  await mkdir(assetsDirectory, { recursive: true });
  const files = [
    {
      source: path.join(options.outputDir, MOBILE_RESOURCE_CATALOG_FILE),
      destination: path.join(assetsDirectory, "mobile-resource-catalog.json")
    }
  ].map((file) => ({
    ...file,
    temporary: `${file.destination}.tmp-${process.pid}-${randomUUID()}`,
    backup: `${file.destination}.backup-${process.pid}-${randomUUID()}`,
    activated: false,
    backedUp: false
  }));
  try {
    await Promise.all(
      files.map((file) => copyFile(file.source, file.temporary))
    );
    for (const file of files) {
      if (existsSync(file.destination)) {
        await rename(file.destination, file.backup);
        file.backedUp = true;
      }
    }
    for (const file of files) {
      await rename(file.temporary, file.destination);
      file.activated = true;
    }
  } catch (error) {
    for (const file of [...files].reverse()) {
      await rm(file.temporary, { force: true });
      if (file.activated) await rm(file.destination, { force: true });
      if (file.backedUp) await rename(file.backup, file.destination);
    }
    throw error;
  }
  await Promise.all(
    files.map(async (file) => {
      try {
        await rm(file.backup, { force: true });
      } catch (error) {
        console.warn(
          `mobile-resource-app-sync-backup-cleanup-failed:${file.backup}`,
          error
        );
      }
    })
  );
}

async function writeChecksums(
  directory: string,
  entries: readonly MobileResourceCatalogEntry[]
): Promise<void> {
  const lines = entries.map((entry) => `${entry.archiveSha256}  ${entry.file}`);
  lines.push(
    `${await sha256File(path.join(directory, MOBILE_RESOURCE_CATALOG_FILE))}  ${MOBILE_RESOURCE_CATALOG_FILE}`
  );
  await writeFile(path.join(directory, "SHA256SUMS"), `${lines.join("\n")}\n`);
}

async function mapConcurrent<Input, Output>(
  inputs: readonly Input[],
  concurrency: number,
  mapper: (input: Input) => Promise<Output>
): Promise<Output[]> {
  const outputs = new Array<Output>(inputs.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < inputs.length) {
      const index = nextIndex;
      nextIndex += 1;
      outputs[index] = await mapper(inputs[index]!);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, inputs.length) }, worker)
  );
  return outputs;
}

function sha256Buffer(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

export function parseMobileResourceCliArgs(
  args: readonly string[]
): Record<string, string> {
  const allowed = new Set([
    "--inventory",
    "--required-ids",
    "--output-dir",
    "--app-root",
    "--source-overrides",
    "--generated-at"
  ]);
  const parsed: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!name || !allowed.has(name)) {
      throw new Error(`mobile-resource-cli-option-unknown:${name ?? ""}`);
    }
    if (name in parsed) {
      throw new Error(`mobile-resource-cli-option-duplicate:${name}`);
    }
    if (!value || value.startsWith("--")) {
      throw new Error(`mobile-resource-cli-option-value-missing:${name}`);
    }
    parsed[name] = value;
  }
  return parsed;
}

async function main(): Promise<void> {
  const args = parseMobileResourceCliArgs(process.argv.slice(2));
  const result = await buildMobileResourceCatalog({
    inventoryPath: args["--inventory"],
    requiredIdsPath: args["--required-ids"],
    outputDir: args["--output-dir"],
    appRoot: args["--app-root"],
    sourceOverridesPath: args["--source-overrides"],
    generatedAt: args["--generated-at"]
  });
  console.log(
    JSON.stringify(
      {
        outputDir: result.outputDir,
        catalogPath: result.catalogPath,
        catalogSha256: result.catalogSha256,
        resourceCount: result.resourceCount
      },
      null,
      2
    )
  );
}

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
