import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  buildMobileResourceCatalog,
  type MobileResourceCatalog
} from "./packageMobileResourceCatalog.js";
import { sha256ResourcePublicationFile } from "./resourcePublicationEnvelope.js";
import { commitResourcePublicationBundle } from "./resourcePublicationCommit.js";

const execFileAsync = promisify(execFile);
const archiveEntry = "study-links.sqlite" as const;

export type StudyLinksCounts = {
  nodes: number;
  links: number;
};

export type CanonicalStudyLinksPublication = {
  format: "bible-strong-canonical-study-links";
  schemaVersion: 1;
  revision: string;
  contentSha256: string;
  counts: StudyLinksCounts;
};

export type StudyLinksResourcePublicationManifest = {
  format: "bible-strong-resource-publication";
  schemaVersion: 1;
  identity: {
    kind: "study-links";
    resourceId: "STUDY_LINKS";
    language: "mul";
  };
  revision: string;
  publicationRevision: string;
  canonical: {
    path: string;
    mediaType: "application/json";
    schemaVersion: 1;
    sha256: string;
    bytes: number;
  };
  offlineArtifact: {
    path: string;
    mediaType: "application/zip";
    entry: typeof archiveEntry;
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
    onlineAccess: true;
    offlineDownload: true;
  };
  counts: StudyLinksCounts;
};

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, item]) => [key, sortJsonValue(item)])
  );
}

function buildStudyLinksPublicationRevision(
  manifest: Omit<
    StudyLinksResourcePublicationManifest,
    "publicationRevision"
  >
): string {
  const digest = createHash("sha256")
    .update(JSON.stringify(sortJsonValue(manifest)))
    .digest("hex");
  return `study-links-${digest.slice(0, 20)}`;
}

const queryStudyLinksMetadata = async (sqlitePath: string) => {
  const { stdout } = await execFileAsync("sqlite3", [
    "-json",
    sqlitePath,
    `SELECT revision, nodes_count AS nodes, links_count AS links
     FROM RESOURCE_METADATA`
  ]);
  const rows = JSON.parse(stdout || "[]") as Array<
    StudyLinksCounts & { revision: string }
  >;
  const row = rows[0];
  if (
    rows.length !== 1 ||
    !row?.revision ||
    [row.nodes, row.links].some(
      (count) => !Number.isSafeInteger(count) || count <= 0
    )
  ) {
    throw new Error("study-links-publication-metadata-invalid");
  }
  return row;
};

export async function buildStudyLinksResourcePublication(options: {
  sqlitePath: string;
  outputDir: string;
  generatedAt?: string;
}): Promise<{
  outputDir: string;
  manifestPath: string;
  manifest: StudyLinksResourcePublicationManifest;
}> {
  const sqlitePath = path.resolve(options.sqlitePath);
  const outputDir = path.resolve(options.outputDir);
  if (!existsSync(sqlitePath)) {
    throw new Error(
      `study-links-publication-source-missing:${sqlitePath}`
    );
  }
  if (existsSync(outputDir)) {
    throw new Error(
      `study-links-publication-output-exists:${outputDir}`
    );
  }
  const canonicalRelativePath = "canonical/study-links.json";
  const offlineRelativePath = "offline/study-links.sqlite.zip";

  return commitResourcePublicationBundle({
    outputDir,
    build: async (temporaryDir) => {
      const mobileReleaseDir = `${temporaryDir}-mobile`;
      const canonicalPath = path.join(temporaryDir, canonicalRelativePath);
      try {
        const metadata = await queryStudyLinksMetadata(sqlitePath);
        const contentSha256 = await sha256ResourcePublicationFile(sqlitePath);
        const counts: StudyLinksCounts = {
          nodes: metadata.nodes,
          links: metadata.links
        };
        const canonical: CanonicalStudyLinksPublication = {
          format: "bible-strong-canonical-study-links",
          schemaVersion: 1,
          revision: metadata.revision,
          contentSha256,
          counts
        };
        await mkdir(path.dirname(canonicalPath), { recursive: true });
        await writeFile(
          canonicalPath,
          `${JSON.stringify(canonical)}\n`,
          "utf8"
        );
        const mobile = await buildMobileResourceCatalog({
          outputDir: mobileReleaseDir,
          generatedAt: options.generatedAt,
          inventory: [
            {
              id: "study-links",
              artifactUrl:
                "https://local.invalid/databases/study-links.sqlite.zip",
              sources: [
                {
                  role: "canonical",
                  sourceUrl:
                    "https://local.invalid/databases/study-links.sqlite",
                  sourcePath: sqlitePath,
                  entry: archiveEntry
                }
              ],
              strategy: "archive-extract",
              resourceRevision: metadata.revision
            }
          ],
          requiredIds: ["study-links"]
        });
        const catalog = JSON.parse(
          await readFile(mobile.catalogPath, "utf8")
        ) as MobileResourceCatalog;
        const artifact = catalog.resources["study-links"];
        if (!artifact)
          throw new Error("study-links-publication-offline-missing");
        const offlineArtifactPath = path.join(
          temporaryDir,
          offlineRelativePath
        );
        await mkdir(path.dirname(offlineArtifactPath), { recursive: true });
        await copyFile(
          path.join(mobileReleaseDir, artifact.file),
          offlineArtifactPath
        );
        const [canonicalStat, offlineStat] = await Promise.all([
          stat(canonicalPath),
          stat(offlineArtifactPath)
        ]);
        const manifestWithoutPublicationRevision: Omit<
          StudyLinksResourcePublicationManifest,
          "publicationRevision"
        > = {
          format: "bible-strong-resource-publication",
          schemaVersion: 1,
          identity: {
            kind: "study-links",
            resourceId: "STUDY_LINKS",
            language: "mul"
          },
          revision: metadata.revision,
          canonical: {
            path: canonicalRelativePath,
            mediaType: "application/json",
            schemaVersion: 1,
            sha256: await sha256ResourcePublicationFile(canonicalPath),
            bytes: canonicalStat.size
          },
          offlineArtifact: {
            path: offlineRelativePath,
            mediaType: "application/zip",
            entry: archiveEntry,
            sha256: await sha256ResourcePublicationFile(offlineArtifactPath),
            bytes: offlineStat.size,
            contentSha256
          },
          provenance: {
            generator: "bible-lexicon-maker",
            sourceVersion: metadata.revision,
            sourceSha256: contentSha256,
            generatedAt: options.generatedAt ?? new Date().toISOString()
          },
          rights: {
            holder: "Bible Strong",
            termsReference: "Liens générés par Bible Strong.",
            attribution: "Liens d’étude Bible Strong",
            online: true,
            offline: true
          },
          deliveryCapabilities: {
            onlineAccess: true,
            offlineDownload: true
          },
          counts
        };
        const manifest: StudyLinksResourcePublicationManifest = {
          ...manifestWithoutPublicationRevision,
          publicationRevision: buildStudyLinksPublicationRevision(
            manifestWithoutPublicationRevision
          )
        };
        await writeFile(
          path.join(temporaryDir, "manifest.json"),
          `${JSON.stringify(manifest, null, 2)}\n`,
          "utf8"
        );
        return {
          outputDir,
          manifestPath: path.join(outputDir, "manifest.json"),
          manifest
        };
      } finally {
        await rm(mobileReleaseDir, { recursive: true, force: true });
      }
    },
    validate: validateStudyLinksResourcePublication
  });
}

export async function validateStudyLinksResourcePublication(
  bundleDir: string
): Promise<StudyLinksResourcePublicationManifest> {
  const root = path.resolve(bundleDir);
  const manifest = JSON.parse(
    await readFile(path.join(root, "manifest.json"), "utf8")
  ) as StudyLinksResourcePublicationManifest;
  const { publicationRevision, ...manifestWithoutPublicationRevision } =
    manifest;
  if (
    manifest.format !== "bible-strong-resource-publication" ||
    manifest.schemaVersion !== 1 ||
    manifest.identity?.kind !== "study-links" ||
    manifest.identity.resourceId !== "STUDY_LINKS" ||
    manifest.identity.language !== "mul" ||
    manifest.offlineArtifact?.entry !== archiveEntry ||
    manifest.canonical?.schemaVersion !== 1 ||
    publicationRevision !==
      buildStudyLinksPublicationRevision(
        manifestWithoutPublicationRevision
      )
  ) {
    throw new Error("study-links-publication-manifest-invalid");
  }
  const canonicalPath = path.join(root, manifest.canonical.path);
  const offlinePath = path.join(root, manifest.offlineArtifact.path);
  if (
    !(await lstat(canonicalPath)).isFile() ||
    !(await lstat(offlinePath)).isFile()
  ) {
    throw new Error("study-links-publication-artifact-invalid");
  }
  if (
    (await sha256ResourcePublicationFile(canonicalPath)) !==
      manifest.canonical.sha256 ||
    (await sha256ResourcePublicationFile(offlinePath)) !==
      manifest.offlineArtifact.sha256
  ) {
    throw new Error("study-links-publication-checksum-invalid");
  }
  const canonical = JSON.parse(
    await readFile(canonicalPath, "utf8")
  ) as CanonicalStudyLinksPublication;
  if (
    canonical.format !== "bible-strong-canonical-study-links" ||
    canonical.schemaVersion !== 1 ||
    canonical.revision !== manifest.revision ||
    canonical.contentSha256 !== manifest.offlineArtifact.contentSha256 ||
    JSON.stringify(canonical.counts) !== JSON.stringify(manifest.counts)
  ) {
    throw new Error("study-links-publication-canonical-invalid");
  }
  const extractionDir = await mkdtemp(
    path.join(tmpdir(), "study-links-publication-")
  );
  try {
    await execFileAsync("unzip", [
      "-qq",
      offlinePath,
      archiveEntry,
      "-d",
      extractionDir
    ]);
    const sqlitePath = path.join(extractionDir, archiveEntry);
    if (
      (await sha256ResourcePublicationFile(sqlitePath)) !==
      canonical.contentSha256
    ) {
      throw new Error("study-links-publication-content-invalid");
    }
    const metadata = await queryStudyLinksMetadata(sqlitePath);
    if (
      metadata.revision !== canonical.revision ||
      JSON.stringify({ nodes: metadata.nodes, links: metadata.links }) !==
        JSON.stringify(canonical.counts)
    ) {
      throw new Error("study-links-publication-parity-invalid");
    }
  } finally {
    await rm(extractionDir, { recursive: true, force: true });
  }
  return manifest;
}

const readOption = (args: string[], name: string) => {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : undefined;
  if (!value) throw new Error(`study-links-publication-cli-option-missing:${name}`);
  return value;
};

const main = async () => {
  const args = process.argv.slice(2);
  if (args[0] === "validate") {
    console.log(
      JSON.stringify(
        await validateStudyLinksResourcePublication(readOption(args, "--bundle"))
      )
    );
    return;
  }
  const { manifest } = await buildStudyLinksResourcePublication({
    sqlitePath: readOption(args, "--sqlite"),
    outputDir: readOption(args, "--output-dir")
  });
  console.log(
    JSON.stringify({ revision: manifest.revision, counts: manifest.counts })
  );
};

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main();
}
