import { createHash, randomUUID } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import {
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildMobileResourceCatalog,
  type MobileResourceCatalog
} from "./packageMobileResourceCatalog.js";
import type { CanonicalBiblePublication } from "./strongBibleMobilePublication.js";

export interface BibleResourcePublicationMetadata {
  identity: { versionId: string; language: string };
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
  canon: { id: string; orderedBooks: number[] };
  versification: string;
}

export interface BibleResourcePublicationManifest {
  format: "bible-strong-resource-publication";
  schemaVersion: 1;
  identity: {
    kind: "bible-text";
    versionId: string;
    language: string;
  };
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
  rights: BibleResourcePublicationMetadata["rights"];
  deliveryCapabilities: BibleResourcePublicationMetadata["deliveryCapabilities"];
  canon: BibleResourcePublicationMetadata["canon"];
  versification: string;
  coverage: {
    chaptersByBook: Record<string, number[]>;
    verseCountByBookChapter: Record<string, number>;
  };
  counts: {
    books: number;
    chapters: number;
    verses: number;
    notes: number;
    headings: number;
  };
}

export async function buildBibleResourcePublication(
  options: BibleResourcePublicationMetadata & {
    canonicalPath: string;
    outputDir: string;
    generatedAt?: string;
  }
): Promise<{
  outputDir: string;
  manifestPath: string;
  canonicalPath: string;
  offlineArtifactPath: string;
  manifest: BibleResourcePublicationManifest;
}> {
  const sourceCanonicalPath = path.resolve(options.canonicalPath);
  const outputDir = path.resolve(options.outputDir);
  if (!existsSync(sourceCanonicalPath)) {
    throw new Error(
      `resource-publication-canonical-missing:${sourceCanonicalPath}`
    );
  }
  if (existsSync(outputDir)) {
    throw new Error(`resource-publication-output-already-exists:${outputDir}`);
  }
  validateMetadata(options);

  const canonical = JSON.parse(
    await readFile(sourceCanonicalPath, "utf8")
  ) as CanonicalBiblePublication;
  const derived = validateCanonicalBible(canonical, options);
  const normalizedVersion = options.identity.versionId.toLocaleLowerCase();
  const canonicalEntry = `bible-${normalizedVersion}.json`;
  const archiveFile = `${canonicalEntry}.zip`;
  const temporaryDir = `${outputDir}.tmp-${process.pid}-${randomUUID()}`;
  const mobileReleaseDir = `${temporaryDir}-mobile`;

  try {
    const mobileResult = await buildMobileResourceCatalog({
      outputDir: mobileReleaseDir,
      generatedAt: options.generatedAt,
      inventory: [
        {
          id: `bible:${options.identity.versionId}`,
          artifactUrl: `https://local.invalid/offline/${archiveFile}`,
          sources: [
            {
              role: "canonical",
              sourceUrl: `https://local.invalid/canonical/${canonicalEntry}`,
              sourcePath: sourceCanonicalPath,
              entry: canonicalEntry
            }
          ],
          strategy: "sqlite-import"
        }
      ],
      requiredIds: [`bible:${options.identity.versionId}`]
    });
    const mobileCatalog = JSON.parse(
      await readFile(mobileResult.catalogPath, "utf8")
    ) as MobileResourceCatalog;
    const mobileArtifact =
      mobileCatalog.resources[`bible:${options.identity.versionId}`];
    if (!mobileArtifact)
      throw new Error("resource-publication-offline-artifact-missing");

    const canonicalRelativePath = `canonical/${canonicalEntry}`;
    const offlineRelativePath = `offline/${archiveFile}`;
    const bundleCanonicalPath = path.join(temporaryDir, canonicalRelativePath);
    const offlineArtifactPath = path.join(temporaryDir, offlineRelativePath);
    await Promise.all([
      mkdir(path.dirname(bundleCanonicalPath), { recursive: true }),
      mkdir(path.dirname(offlineArtifactPath), { recursive: true })
    ]);
    await Promise.all([
      copyFile(sourceCanonicalPath, bundleCanonicalPath),
      copyFile(
        path.join(mobileReleaseDir, mobileArtifact.file),
        offlineArtifactPath
      )
    ]);

    const canonicalStats = await stat(bundleCanonicalPath);
    const offlineStats = await stat(offlineArtifactPath);
    const canonicalSha256 = await sha256File(bundleCanonicalPath);
    if (mobileArtifact.entries.canonical?.sha256 !== canonicalSha256) {
      throw new Error("resource-publication-offline-content-mismatch");
    }

    const manifest: BibleResourcePublicationManifest = {
      format: "bible-strong-resource-publication",
      schemaVersion: 1,
      identity: { kind: "bible-text", ...options.identity },
      revision: canonical.textRevision,
      canonical: {
        path: canonicalRelativePath,
        mediaType: "application/json",
        schemaVersion: canonical.schemaVersion,
        sha256: canonicalSha256,
        bytes: canonicalStats.size
      },
      offlineArtifact: {
        path: offlineRelativePath,
        mediaType: "application/zip",
        entry: canonicalEntry,
        sha256: await sha256File(offlineArtifactPath),
        bytes: offlineStats.size,
        contentSha256: canonicalSha256
      },
      provenance: {
        generator: "bible-lexicon-maker",
        sourceVersion: canonical.sourceVersion,
        sourceSha256: canonical.sourceSha256,
        generatedAt: options.generatedAt ?? new Date().toISOString()
      },
      rights: options.rights,
      deliveryCapabilities: options.deliveryCapabilities,
      canon: options.canon,
      versification: options.versification,
      coverage: derived.coverage,
      counts: derived.counts
    };
    const manifestPath = path.join(temporaryDir, "manifest.json");
    await writeFile(
      manifestPath,
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8"
    );
    await mkdir(path.dirname(outputDir), { recursive: true });
    await rename(temporaryDir, outputDir);
    return {
      outputDir,
      manifestPath: path.join(outputDir, "manifest.json"),
      canonicalPath: path.join(outputDir, canonicalRelativePath),
      offlineArtifactPath: path.join(outputDir, offlineRelativePath),
      manifest
    };
  } catch (error) {
    await rm(temporaryDir, { recursive: true, force: true });
    throw error;
  } finally {
    await rm(mobileReleaseDir, { recursive: true, force: true });
  }
}

function validateMetadata(metadata: BibleResourcePublicationMetadata): void {
  for (const [label, value] of [
    ["version", metadata.identity.versionId],
    ["language", metadata.identity.language],
    ["rights-holder", metadata.rights.holder],
    ["terms-reference", metadata.rights.termsReference],
    ["attribution", metadata.rights.attribution],
    ["canon", metadata.canon.id],
    ["versification", metadata.versification]
  ] as const) {
    if (!value.trim()) throw new Error(`resource-publication-${label}-missing`);
  }
  if (
    (metadata.deliveryCapabilities.onlineAccess && !metadata.rights.online) ||
    (metadata.deliveryCapabilities.offlineDownload && !metadata.rights.offline)
  ) {
    throw new Error("resource-publication-rights-mismatch");
  }
  if (
    !metadata.deliveryCapabilities.onlineAccess &&
    !metadata.deliveryCapabilities.offlineDownload
  ) {
    throw new Error("resource-publication-delivery-unavailable");
  }
  if (metadata.canon.orderedBooks.length === 0) {
    throw new Error("resource-publication-canon-empty");
  }
}

function validateCanonicalBible(
  canonical: CanonicalBiblePublication,
  metadata: BibleResourcePublicationMetadata
): {
  coverage: BibleResourcePublicationManifest["coverage"];
  counts: BibleResourcePublicationManifest["counts"];
} {
  if (
    canonical.format !== "bible-strong-canonical-bible" ||
    canonical.schemaVersion !== 4 ||
    canonical.applicationVersionId !== metadata.identity.versionId ||
    !canonical.textRevision ||
    !/^[a-f0-9]{64}$/.test(canonical.sourceSha256) ||
    !canonical.verses ||
    typeof canonical.verses !== "object"
  ) {
    throw new Error("resource-publication-canonical-invalid");
  }

  const orderedBooks = Object.keys(canonical.verses)
    .map(Number)
    .sort((left, right) => left - right);
  if (
    JSON.stringify(orderedBooks) !== JSON.stringify(metadata.canon.orderedBooks)
  ) {
    throw new Error("resource-publication-canon-mismatch");
  }

  const chaptersByBook: Record<string, number[]> = {};
  const verseCountByBookChapter: Record<string, number> = {};
  let chapters = 0;
  let verses = 0;
  let notes = 0;
  let headings = 0;
  for (const book of orderedBooks) {
    const chapterRecord = canonical.verses[String(book)]!;
    const chapterNumbers = Object.keys(chapterRecord)
      .map(Number)
      .sort((left, right) => left - right);
    if (
      chapterNumbers.length === 0 ||
      chapterNumbers.some((chapter) => chapter < 1)
    ) {
      throw new Error("resource-publication-coverage-invalid");
    }
    chaptersByBook[String(book)] = chapterNumbers;
    chapters += chapterNumbers.length;
    for (const chapter of chapterNumbers) {
      const verseRecord = chapterRecord[String(chapter)]!;
      const chapterVerses = Object.values(verseRecord);
      if (chapterVerses.length === 0) {
        throw new Error("resource-publication-coverage-invalid");
      }
      verseCountByBookChapter[`${book}-${chapter}`] = chapterVerses.length;
      verses += chapterVerses.length;
      for (const verse of chapterVerses) {
        if (
          typeof verse.text !== "string" ||
          !Array.isArray(verse.startTags) ||
          !Array.isArray(verse.layout) ||
          !Array.isArray(verse.notes) ||
          !Array.isArray(verse.headings)
        ) {
          throw new Error("resource-publication-verse-invalid");
        }
        notes += verse.notes.length;
        headings += verse.headings.length;
      }
    }
  }
  if (
    verses !== canonical.verseCount ||
    notes !== canonical.noteCount ||
    headings !== canonical.headingCount
  ) {
    throw new Error("resource-publication-count-mismatch");
  }
  return {
    coverage: { chaptersByBook, verseCountByBookChapter },
    counts: {
      books: orderedBooks.length,
      chapters,
      verses,
      notes,
      headings
    }
  };
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

function parseCliArgs(args: readonly string[]): Record<string, string> {
  const allowed = new Set(["--canonical", "--metadata", "--output-dir"]);
  const result: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key || !allowed.has(key)) {
      throw new Error(`resource-publication-cli-option-unknown:${key ?? ""}`);
    }
    if (!value || value.startsWith("--")) {
      throw new Error(`resource-publication-cli-option-value-missing:${key}`);
    }
    if (result[key])
      throw new Error(`resource-publication-cli-option-duplicate:${key}`);
    result[key] = value;
  }
  return result;
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  const canonicalPath = args["--canonical"];
  const metadataPath = args["--metadata"];
  const outputDir = args["--output-dir"];
  if (!canonicalPath || !metadataPath || !outputDir) {
    throw new Error("resource-publication-cli-required-options-missing");
  }
  const metadata = JSON.parse(
    await readFile(path.resolve(metadataPath), "utf8")
  ) as BibleResourcePublicationMetadata;
  const result = await buildBibleResourcePublication({
    ...metadata,
    canonicalPath,
    outputDir
  });
  console.log(
    JSON.stringify(
      { outputDir: result.outputDir, revision: result.manifest.revision },
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
