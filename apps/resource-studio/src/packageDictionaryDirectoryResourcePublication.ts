import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

import {
  buildMobileResourceCatalog,
  type MobileResourceCatalog
} from "./packageMobileResourceCatalog.js";
import { sha256ResourcePublicationFile } from "./resourcePublicationEnvelope.js";

const execFileAsync = promisify(execFile);
const archiveEntry = "dictionary-directory.sqlite" as const;

export type DictionaryDirectoryCounts = {
  works: number;
  entries: number;
  correspondences: number;
  passageAnchors: number;
};

export type CanonicalDictionaryDirectoryPublication = {
  format: "bible-strong-canonical-dictionary-directory";
  schemaVersion: 1;
  revision: string;
  contentSha256: string;
  counts: DictionaryDirectoryCounts;
};

export type DictionaryDirectoryResourcePublicationManifest = {
  format: "bible-strong-resource-publication";
  schemaVersion: 1;
  identity: {
    kind: "dictionary-directory";
    resourceId: "DICTIONARY_DIRECTORY";
    language: "mul";
  };
  revision: string;
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
    onlineAccess: false;
    offlineDownload: true;
  };
  counts: DictionaryDirectoryCounts;
};

const queryDirectoryMetadata = async (sqlitePath: string) => {
  const { stdout } = await execFileAsync("sqlite3", [
    "-json",
    sqlitePath,
    `SELECT revision, works_count AS works, entries_count AS entries,
            correspondences_count AS correspondences,
            passage_anchors_count AS passageAnchors
     FROM RESOURCE_METADATA`
  ]);
  const rows = JSON.parse(stdout || "[]") as Array<
    DictionaryDirectoryCounts & { revision: string }
  >;
  const row = rows[0];
  if (
    rows.length !== 1 ||
    !row?.revision ||
    [row.works, row.entries, row.correspondences, row.passageAnchors].some(
      (count) => !Number.isSafeInteger(count) || count < 0
    )
  ) {
    throw new Error("dictionary-directory-publication-metadata-invalid");
  }
  return row;
};

export async function buildDictionaryDirectoryResourcePublication(options: {
  sqlitePath: string;
  outputDir: string;
  generatedAt?: string;
}): Promise<{
  outputDir: string;
  manifestPath: string;
  manifest: DictionaryDirectoryResourcePublicationManifest;
}> {
  const sqlitePath = path.resolve(options.sqlitePath);
  const outputDir = path.resolve(options.outputDir);
  if (!existsSync(sqlitePath)) {
    throw new Error(
      `dictionary-directory-publication-source-missing:${sqlitePath}`
    );
  }
  if (existsSync(outputDir)) {
    throw new Error(
      `dictionary-directory-publication-output-exists:${outputDir}`
    );
  }
  const temporaryDir = `${outputDir}.tmp-${process.pid}-${randomUUID()}`;
  const mobileReleaseDir = `${temporaryDir}-mobile`;
  const canonicalRelativePath = "canonical/dictionary-directory.json";
  const offlineRelativePath = "offline/dictionary-directory.sqlite.zip";
  const canonicalPath = path.join(temporaryDir, canonicalRelativePath);
  try {
    const metadata = await queryDirectoryMetadata(sqlitePath);
    const contentSha256 = await sha256ResourcePublicationFile(sqlitePath);
    const counts: DictionaryDirectoryCounts = {
      works: metadata.works,
      entries: metadata.entries,
      correspondences: metadata.correspondences,
      passageAnchors: metadata.passageAnchors
    };
    const canonical: CanonicalDictionaryDirectoryPublication = {
      format: "bible-strong-canonical-dictionary-directory",
      schemaVersion: 1,
      revision: metadata.revision,
      contentSha256,
      counts
    };
    await mkdir(path.dirname(canonicalPath), { recursive: true });
    await writeFile(canonicalPath, `${JSON.stringify(canonical)}\n`, "utf8");
    const mobile = await buildMobileResourceCatalog({
      outputDir: mobileReleaseDir,
      generatedAt: options.generatedAt,
      inventory: [
        {
          id: "dictionary-directory",
          artifactUrl:
            "https://local.invalid/dictionaries/dictionary-directory.sqlite.zip",
          sources: [
            {
              role: "canonical",
              sourceUrl:
                "https://local.invalid/dictionaries/dictionary-directory.sqlite",
              sourcePath: sqlitePath,
              entry: archiveEntry
            }
          ],
          strategy: "archive-extract",
          resourceRevision: metadata.revision
        }
      ],
      requiredIds: ["dictionary-directory"]
    });
    const catalog = JSON.parse(
      await readFile(mobile.catalogPath, "utf8")
    ) as MobileResourceCatalog;
    const artifact = catalog.resources["dictionary-directory"];
    if (!artifact)
      throw new Error("dictionary-directory-publication-offline-missing");
    const offlineArtifactPath = path.join(temporaryDir, offlineRelativePath);
    await mkdir(path.dirname(offlineArtifactPath), { recursive: true });
    await copyFile(
      path.join(mobileReleaseDir, artifact.file),
      offlineArtifactPath
    );
    const [canonicalStat, offlineStat] = await Promise.all([
      stat(canonicalPath),
      stat(offlineArtifactPath)
    ]);
    const manifest: DictionaryDirectoryResourcePublicationManifest = {
      format: "bible-strong-resource-publication",
      schemaVersion: 1,
      identity: {
        kind: "dictionary-directory",
        resourceId: "DICTIONARY_DIRECTORY",
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
        holder: "Selon les ressources dictionnaires participantes",
        termsReference: "Voir les droits de chaque dictionnaire participant.",
        attribution: "Index de découverte des dictionnaires Bible Strong",
        online: false,
        offline: true
      },
      deliveryCapabilities: {
        onlineAccess: false,
        offlineDownload: true
      },
      counts
    };
    await writeFile(
      path.join(temporaryDir, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8"
    );
    await mkdir(path.dirname(outputDir), { recursive: true });
    await rename(temporaryDir, outputDir);
    return {
      outputDir,
      manifestPath: path.join(outputDir, "manifest.json"),
      manifest
    };
  } catch (error) {
    await rm(temporaryDir, { recursive: true, force: true });
    throw error;
  } finally {
    await rm(mobileReleaseDir, { recursive: true, force: true });
  }
}

export async function validateDictionaryDirectoryResourcePublication(
  bundleDir: string
): Promise<DictionaryDirectoryResourcePublicationManifest> {
  const root = path.resolve(bundleDir);
  const manifest = JSON.parse(
    await readFile(path.join(root, "manifest.json"), "utf8")
  ) as DictionaryDirectoryResourcePublicationManifest;
  if (
    manifest.format !== "bible-strong-resource-publication" ||
    manifest.schemaVersion !== 1 ||
    manifest.identity?.kind !== "dictionary-directory" ||
    manifest.identity.resourceId !== "DICTIONARY_DIRECTORY" ||
    manifest.identity.language !== "mul" ||
    manifest.offlineArtifact?.entry !== archiveEntry ||
    manifest.canonical?.schemaVersion !== 1
  ) {
    throw new Error("dictionary-directory-publication-manifest-invalid");
  }
  const canonicalPath = path.join(root, manifest.canonical.path);
  const offlinePath = path.join(root, manifest.offlineArtifact.path);
  if (
    !(await lstat(canonicalPath)).isFile() ||
    !(await lstat(offlinePath)).isFile()
  ) {
    throw new Error("dictionary-directory-publication-artifact-invalid");
  }
  if (
    (await sha256ResourcePublicationFile(canonicalPath)) !==
      manifest.canonical.sha256 ||
    (await sha256ResourcePublicationFile(offlinePath)) !==
      manifest.offlineArtifact.sha256
  ) {
    throw new Error("dictionary-directory-publication-checksum-invalid");
  }
  const canonical = JSON.parse(
    await readFile(canonicalPath, "utf8")
  ) as CanonicalDictionaryDirectoryPublication;
  if (
    canonical.format !== "bible-strong-canonical-dictionary-directory" ||
    canonical.schemaVersion !== 1 ||
    canonical.revision !== manifest.revision ||
    canonical.contentSha256 !== manifest.offlineArtifact.contentSha256 ||
    JSON.stringify(canonical.counts) !== JSON.stringify(manifest.counts)
  ) {
    throw new Error("dictionary-directory-publication-canonical-invalid");
  }
  const extractionDir = await mkdtemp(
    path.join(tmpdir(), "dictionary-directory-publication-")
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
      throw new Error("dictionary-directory-publication-content-invalid");
    }
    const metadata = await queryDirectoryMetadata(sqlitePath);
    if (
      metadata.revision !== canonical.revision ||
      JSON.stringify({
        works: metadata.works,
        entries: metadata.entries,
        correspondences: metadata.correspondences,
        passageAnchors: metadata.passageAnchors
      }) !== JSON.stringify(canonical.counts)
    ) {
      throw new Error("dictionary-directory-publication-parity-invalid");
    }
  } finally {
    await rm(extractionDir, { recursive: true, force: true });
  }
  return manifest;
}
