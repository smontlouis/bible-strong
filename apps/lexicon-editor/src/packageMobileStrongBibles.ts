import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import {
  copyFile,
  mkdir,
  rename,
  rm,
  stat,
  utimes,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  CANONICAL_BIBLE_SCHEMA_VERSION,
  compileStrongBibleMobilePublication,
  MOBILE_STRONG_SQLITE_SCHEMA_VERSION
} from "./strongBibleMobilePublication.js";

const execFileAsync = promisify(execFile);
const REPRODUCIBLE_ZIP_TIME = new Date("1980-01-01T00:00:00.000Z");

export const MOBILE_STRONG_RELEASE_SCHEMA_VERSION = 2;
export const DEFAULT_MOBILE_STRONG_RELEASE =
  "outputs/releases/bible-strong-mobile-v3-candidate";

export interface MobileStrongBibleSource {
  applicationVersionId: string;
  datasetId: string;
  sourceVersion: string;
  relativePath: string;
}

export const MOBILE_STRONG_BIBLE_SOURCES = [
  {
    applicationVersionId: "LSG",
    datasetId: "LSG",
    sourceVersion: "SG1910",
    relativePath: "outputs/releases/strong-jsonl-v3/bible-sg1910-strong.jsonl"
  },
  {
    applicationVersionId: "DBY",
    datasetId: "DBY",
    sourceVersion: "DARBY",
    relativePath: "outputs/releases/strong-jsonl-v3/bible-darby-strong.jsonl"
  },
  {
    applicationVersionId: "DBR",
    datasetId: "DBYR",
    sourceVersion: "DARBYR",
    relativePath: "outputs/releases/strong-jsonl-v3/bible-darbyr-strong.jsonl"
  }
] as const satisfies readonly MobileStrongBibleSource[];

interface MobileArtifactCatalogEntry {
  file: string;
  entry: string;
  archiveSha256: string;
  archiveBytes: number;
  contentSha256: string;
  contentBytes: number;
  textRevision: string;
  textSha256: string;
  schemaVersion: number;
}

export interface MobileStrongBibleCatalog {
  format: "bible-strong-mobile-publications";
  schemaVersion: number;
  generatedAt: string;
  bibles: Array<{
    applicationVersionId: string;
    datasetId: string;
    sourceVersion: string;
    sourceSha256: string;
    canonical: MobileArtifactCatalogEntry & {
      verseCount: number;
      noteCount: number;
      headingCount: number;
    };
    strong: MobileArtifactCatalogEntry & {
      strongRevision: string;
      verseCount: number;
      occurrenceCount: number;
      unalignedOccurrenceCount: number;
      identityCount: number;
      lexemeAssignmentCount: number;
      lexemeCount: number;
    };
  }>;
}

export async function packageMobileStrongBibles(
  options: {
    root?: string;
    outputDir?: string;
    generatedAt?: string;
    sources?: readonly MobileStrongBibleSource[];
  } = {}
): Promise<{
  outputDir: string;
  catalogPath: string;
  catalogSha256: string;
  bibleCount: number;
  archiveBytes: number;
}> {
  const root = path.resolve(options.root ?? process.cwd());
  const outputDir = path.resolve(
    root,
    options.outputDir ?? DEFAULT_MOBILE_STRONG_RELEASE
  );
  if (existsSync(outputDir)) {
    throw new Error(`mobile-strong-release-already-exists:${outputDir}`);
  }
  const temporaryDir = `${outputDir}.tmp-${process.pid}-${randomUUID()}`;
  const buildDir = path.join(temporaryDir, ".build");
  await mkdir(path.join(temporaryDir, "bibles"), { recursive: true });
  await mkdir(buildDir, { recursive: true });

  try {
    const bibles: MobileStrongBibleCatalog["bibles"] = [];
    for (const source of options.sources ?? MOBILE_STRONG_BIBLE_SOURCES) {
      const basename = source.applicationVersionId.toLowerCase();
      const canonicalEntry = `bible-${basename}.json`;
      const strongEntry = `bible-${basename}-strong.sqlite`;
      const canonicalFile = `bibles/${canonicalEntry}.zip`;
      const strongFile = `bibles/${strongEntry}.zip`;
      const canonicalJsonPath = path.join(buildDir, canonicalEntry);
      const strongSqlitePath = path.join(buildDir, strongEntry);
      const summary = await compileStrongBibleMobilePublication({
        inputPath: path.resolve(root, source.relativePath),
        canonicalJsonPath,
        strongSqlitePath,
        applicationVersionId: source.applicationVersionId,
        datasetId: source.datasetId,
        expectedVersion: source.sourceVersion
      });
      const canonicalArchivePath = path.join(temporaryDir, canonicalFile);
      const strongArchivePath = path.join(temporaryDir, strongFile);
      await Promise.all([
        createDeterministicZip({
          inputPath: canonicalJsonPath,
          entryName: canonicalEntry,
          archivePath: canonicalArchivePath,
          stagingRoot: path.join(buildDir, "zip-canonical")
        }),
        createDeterministicZip({
          inputPath: strongSqlitePath,
          entryName: strongEntry,
          archivePath: strongArchivePath,
          stagingRoot: path.join(buildDir, "zip-strong")
        })
      ]);
      const [canonicalArchiveStats, strongArchiveStats] = await Promise.all([
        stat(canonicalArchivePath),
        stat(strongArchivePath)
      ]);

      bibles.push({
        applicationVersionId: source.applicationVersionId,
        datasetId: source.datasetId,
        sourceVersion: source.sourceVersion,
        sourceSha256: summary.sourceSha256,
        canonical: {
          file: canonicalFile,
          entry: canonicalEntry,
          archiveSha256: await sha256File(canonicalArchivePath),
          archiveBytes: canonicalArchiveStats.size,
          contentSha256: summary.canonicalJsonSha256,
          contentBytes: summary.canonicalJsonBytes,
          textRevision: summary.textRevision,
          textSha256: summary.textSha256,
          schemaVersion: CANONICAL_BIBLE_SCHEMA_VERSION,
          verseCount: summary.verseCount,
          noteCount: summary.noteCount,
          headingCount: summary.headingCount
        },
        strong: {
          file: strongFile,
          entry: strongEntry,
          archiveSha256: await sha256File(strongArchivePath),
          archiveBytes: strongArchiveStats.size,
          contentSha256: summary.strongSha256,
          contentBytes: summary.strongBytes,
          textRevision: summary.textRevision,
          textSha256: summary.textSha256,
          schemaVersion: MOBILE_STRONG_SQLITE_SCHEMA_VERSION,
          strongRevision: summary.strongRevision,
          verseCount: summary.verseCount,
          occurrenceCount: summary.occurrenceCount,
          unalignedOccurrenceCount: summary.unalignedOccurrenceCount,
          identityCount: summary.identityCount,
          lexemeAssignmentCount: summary.lexemeAssignmentCount,
          lexemeCount: summary.lexemeCount
        }
      });
    }

    const catalog: MobileStrongBibleCatalog = {
      format: "bible-strong-mobile-publications",
      schemaVersion: MOBILE_STRONG_RELEASE_SCHEMA_VERSION,
      generatedAt: options.generatedAt ?? new Date().toISOString(),
      bibles
    };
    const catalogPath = path.join(temporaryDir, "catalog.json");
    await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
    await writeChecksums(temporaryDir, catalog);
    await rm(buildDir, { recursive: true, force: true });
    const catalogSha256 = await sha256File(catalogPath);
    await mkdir(path.dirname(outputDir), { recursive: true });
    await rename(temporaryDir, outputDir);

    return {
      outputDir,
      catalogPath: path.join(outputDir, "catalog.json"),
      catalogSha256,
      bibleCount: bibles.length,
      archiveBytes: bibles.reduce(
        (total, bible) =>
          total + bible.canonical.archiveBytes + bible.strong.archiveBytes,
        0
      )
    };
  } catch (error) {
    await rm(temporaryDir, { recursive: true, force: true });
    throw error;
  }
}

async function createDeterministicZip(options: {
  inputPath: string;
  entryName: string;
  archivePath: string;
  stagingRoot: string;
}): Promise<void> {
  await mkdir(options.stagingRoot, { recursive: true });
  await mkdir(path.dirname(options.archivePath), { recursive: true });
  const stagedPath = path.join(options.stagingRoot, options.entryName);
  await copyFile(options.inputPath, stagedPath);
  await utimes(stagedPath, REPRODUCIBLE_ZIP_TIME, REPRODUCIBLE_ZIP_TIME);
  await execFileAsync(
    "zip",
    ["-X", "-9", "-q", options.archivePath, options.entryName],
    {
      cwd: options.stagingRoot,
      env: { ...process.env, TZ: "UTC" }
    }
  );
}

async function writeChecksums(
  directory: string,
  catalog: MobileStrongBibleCatalog
): Promise<void> {
  const files = catalog.bibles.flatMap((bible) => [
    bible.canonical.file,
    bible.strong.file
  ]);
  const lines = await Promise.all(
    files.map(
      async (file) => `${await sha256File(path.join(directory, file))}  ${file}`
    )
  );
  lines.push(
    `${await sha256File(path.join(directory, "catalog.json"))}  catalog.json`
  );
  await writeFile(path.join(directory, "SHA256SUMS"), `${lines.join("\n")}\n`);
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const outputIndex = args.indexOf("--output-dir");
  const outputDir = outputIndex >= 0 ? args[outputIndex + 1] : undefined;
  const rootIndex = args.indexOf("--root");
  const root = rootIndex >= 0 ? args[rootIndex + 1] : undefined;
  const result = await packageMobileStrongBibles({ root, outputDir });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  await main();
}
