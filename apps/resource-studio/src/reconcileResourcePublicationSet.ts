import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type ResourceIdentity = {
  kind?: unknown;
  versionId?: unknown;
  datasetId?: unknown;
  language?: unknown;
  resourceId?: unknown;
  moduleId?: unknown;
};

type PublicationManifest = {
  format?: unknown;
  revision?: unknown;
  identity?: ResourceIdentity;
  canonical?: { path?: unknown };
  offlineArtifact?: { path?: unknown };
};

type PublicationRecord = {
  id: string;
  bundle: string;
  revision: string;
  canonical: string;
  offlineArtifact: string;
};

const defaultRequiredIdsPath = "config/mobile-resource-required-ids.json";

const parseArgs = (raw: readonly string[]) => {
  const roots: string[] = [];
  let required = defaultRequiredIdsPath;
  let report: string | undefined;
  for (let index = 0; index < raw.length; index += 1) {
    const flag = raw[index];
    const value = raw[index + 1];
    if (
      (flag === "--root" || flag === "--required" || flag === "--report") &&
      value
    ) {
      if (flag === "--root") roots.push(value);
      if (flag === "--required") required = value;
      if (flag === "--report") report = value;
      index += 1;
      continue;
    }
    throw new Error(
      `resource-publication-reconcile-argument-invalid:${flag ?? "<missing>"}`
    );
  }
  if (roots.length === 0 && process.env.RESOURCE_PUBLICATION_ROOTS) {
    roots.push(
      ...process.env.RESOURCE_PUBLICATION_ROOTS.split(path.delimiter).filter(
        Boolean
      )
    );
  }
  if (roots.length === 0)
    throw new Error("resource-publication-reconcile-root-required");
  return { roots, required, report };
};

const nonEmpty = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const publicationId = (
  identity: ResourceIdentity | undefined
): string | undefined => {
  if (!identity || !nonEmpty(identity.kind)) return undefined;
  switch (identity.kind) {
    case "bible-text":
      return nonEmpty(identity.versionId)
        ? `bible:${identity.versionId}`
        : undefined;
    case "strong-bible-index":
      return nonEmpty(identity.versionId)
        ? `bible-strong:${identity.versionId}`
        : undefined;
    case "interlinear-index":
      return nonEmpty(identity.versionId) && nonEmpty(identity.language)
        ? `bible-interlinear:${identity.versionId}:${identity.language}`
        : undefined;
    case "dictionary":
      return nonEmpty(identity.resourceId) && nonEmpty(identity.language)
        ? `database:${identity.resourceId}:${identity.language}`
        : undefined;
    case "nave":
      return nonEmpty(identity.language)
        ? `database:NAVE:${identity.language}`
        : undefined;
    case "timeline":
      return nonEmpty(identity.language)
        ? `database:TIMELINE:${identity.language}`
        : undefined;
    case "commentary":
      return nonEmpty(identity.resourceId) && nonEmpty(identity.language)
        ? `database:${identity.resourceId}:${identity.language}`
        : undefined;
    case "cross-references":
      return nonEmpty(identity.resourceId) && nonEmpty(identity.language)
        ? `database:${identity.resourceId}:${identity.language}`
        : undefined;
    case "strong-lexicon-module":
      return nonEmpty(identity.moduleId)
        ? `strong-lexicon:${identity.moduleId}`
        : undefined;
    default:
      return undefined;
  }
};

const manifestFiles = async (root: string): Promise<string[]> => {
  const result: string[] = [];
  const visit = async (directory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(candidate);
      } else if (entry.isFile() && entry.name === "manifest.json") {
        result.push(candidate);
      }
    }
  };
  await visit(path.resolve(root));
  return result.sort((left, right) => left.localeCompare(right));
};

const readPublication = async (
  manifestPath: string
): Promise<PublicationRecord> => {
  const bundle = path.dirname(manifestPath);
  const manifest = JSON.parse(
    await readFile(manifestPath, "utf8")
  ) as PublicationManifest;
  const id = publicationId(manifest.identity);
  if (manifest.format !== "bible-strong-resource-publication" || !id) {
    throw new Error(
      `resource-publication-reconcile-manifest-invalid:${manifestPath}`
    );
  }
  if (!nonEmpty(manifest.revision)) {
    throw new Error(
      `resource-publication-reconcile-revision-missing:${manifestPath}`
    );
  }
  if (
    !nonEmpty(manifest.canonical?.path) ||
    !nonEmpty(manifest.offlineArtifact?.path)
  ) {
    throw new Error(
      `resource-publication-reconcile-artifact-metadata-missing:${manifestPath}`
    );
  }
  const canonical = path.resolve(bundle, manifest.canonical.path);
  const offlineArtifact = path.resolve(bundle, manifest.offlineArtifact.path);
  await stat(canonical);
  await stat(offlineArtifact);
  return {
    id,
    bundle,
    revision: manifest.revision,
    canonical: path.relative(bundle, canonical),
    offlineArtifact: path.relative(bundle, offlineArtifact)
  };
};

export const reconcileResourcePublicationSet = async (options: {
  roots: readonly string[];
  requiredIdsPath?: string;
}) => {
  const requiredContract = JSON.parse(
    await readFile(
      path.resolve(options.requiredIdsPath ?? defaultRequiredIdsPath),
      "utf8"
    )
  ) as { schemaVersion?: unknown; resourceIds?: unknown };
  if (
    requiredContract.schemaVersion !== 1 ||
    !Array.isArray(requiredContract.resourceIds) ||
    requiredContract.resourceIds.some((id) => !nonEmpty(id))
  ) {
    throw new Error("resource-publication-reconcile-required-contract-invalid");
  }
  const requiredIds = [
    ...new Set(requiredContract.resourceIds as string[])
  ].sort();
  const manifests = (
    await Promise.all(options.roots.map((root) => manifestFiles(root)))
  ).flat();
  const records = await Promise.all(
    manifests.map((manifest) => readPublication(manifest))
  );
  const byId = new Map<string, PublicationRecord[]>();
  for (const record of records) {
    const current = byId.get(record.id) ?? [];
    current.push(record);
    byId.set(record.id, current);
  }
  const foundIds = [...byId.keys()].sort();
  const missing = requiredIds.filter((id) => !byId.has(id));
  const duplicates = foundIds.filter((id) => (byId.get(id)?.length ?? 0) > 1);
  const unexpected = foundIds.filter((id) => !requiredIds.includes(id));
  return {
    requiredCount: requiredIds.length,
    foundCount: foundIds.length,
    bundleCount: records.length,
    missing,
    duplicates,
    unexpected,
    complete:
      missing.length === 0 &&
      duplicates.length === 0 &&
      unexpected.length === 0,
    bundles: records.sort((left, right) => left.id.localeCompare(right.id))
  };
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const result = await reconcileResourcePublicationSet({
    roots: options.roots,
    requiredIdsPath: options.required
  });
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  console.log(serialized);
  if (options.report) await writeFile(path.resolve(options.report), serialized);
  if (!result.complete) process.exitCode = 1;
};

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
