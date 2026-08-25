import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
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
import { promisify } from "node:util";

import {
  buildMobileResourceCatalog,
  type MobileResourceCatalog,
  type MobileResourceCatalogEntry
} from "./packageMobileResourceCatalog.js";
import {
  verifyCanonicalBiblePublication,
  type CanonicalBiblePublication
} from "./strongBibleMobilePublication.js";
import {
  decodeResourcePublicationEnvelope,
  resolveResourcePublicationPath
} from "./resourcePublicationEnvelope.js";
import { buildCanonicalBibleFromLegacy } from "./legacyBiblePublication.js";

const execFileAsync = promisify(execFile);

export interface BibleResourcePublicationMetadata {
  identity: { versionId: string; language: string };
  rights: {
    holder: string;
    termsReference: string;
    attribution: string;
    reviewedAt?: string;
    online: boolean;
    offline: boolean;
  };
  deliveryCapabilities: {
    onlineAccess: boolean;
    offlineDownload: boolean;
    localDevelopmentAccess?: boolean;
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
  publicationRevision: string;
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
    entries?: MobileResourceCatalogEntry["entries"];
  };
  provenance: {
    generator: "bible-lexicon-maker";
    sourceVersion: string;
    sourceSha256: string;
    generatedAt: string;
    sources?: {
      role: "canonical" | "pericope" | "redWords";
      sourceUrl: string;
      sha256: string;
    }[];
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
    generatedAt: string;
    provenanceSources?: NonNullable<
      BibleResourcePublicationManifest["provenance"]["sources"]
    >;
    offlineArtifact?: {
      path: string;
      catalogEntry: MobileResourceCatalogEntry;
    };
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
  const derived = deriveCanonicalBibleManifestData(canonical, options);
  const normalizedVersion = options.identity.versionId.toLowerCase();
  const canonicalEntry = `bible-${normalizedVersion}.json`;
  const archiveFile = options.offlineArtifact
    ? path.basename(options.offlineArtifact.path)
    : `${canonicalEntry}.zip`;
  const temporaryDir = `${outputDir}.tmp-${process.pid}-${randomUUID()}`;
  const mobileReleaseDir = `${temporaryDir}-mobile`;

  try {
    const mobileResult = options.offlineArtifact
      ? undefined
      : await buildMobileResourceCatalog({
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
    const mobileCatalog = mobileResult
      ? (JSON.parse(
          await readFile(mobileResult.catalogPath, "utf8")
        ) as MobileResourceCatalog)
      : undefined;
    const mobileArtifact =
      options.offlineArtifact?.catalogEntry ??
      mobileCatalog?.resources[`bible:${options.identity.versionId}`];
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
        options.offlineArtifact?.path ??
          path.join(mobileReleaseDir, mobileArtifact.file),
        offlineArtifactPath
      )
    ]);

    const canonicalStats = await stat(bundleCanonicalPath);
    const offlineStats = await stat(offlineArtifactPath);
    const canonicalSha256 = await sha256File(bundleCanonicalPath);
    if (
      !options.offlineArtifact &&
      mobileArtifact.entries.canonical?.sha256 !== canonicalSha256
    ) {
      throw new Error("resource-publication-offline-content-mismatch");
    }

    const manifestWithoutPublicationRevision: Omit<
      BibleResourcePublicationManifest,
      "publicationRevision"
    > = {
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
        entry: mobileArtifact.entry,
        sha256: await sha256File(offlineArtifactPath),
        bytes: offlineStats.size,
        contentSha256: mobileArtifact.entries.canonical!.sha256,
        entries: mobileArtifact.entries
      },
      provenance: {
        generator: "bible-lexicon-maker",
        sourceVersion: canonical.sourceVersion,
        sourceSha256: canonical.sourceSha256,
        generatedAt: options.generatedAt,
        ...(options.provenanceSources
          ? { sources: options.provenanceSources }
          : {})
      },
      rights: options.rights,
      deliveryCapabilities: options.deliveryCapabilities,
      canon: options.canon,
      versification: options.versification,
      coverage: derived.coverage,
      counts: derived.counts
    };
    const manifest: BibleResourcePublicationManifest = {
      ...manifestWithoutPublicationRevision,
      publicationRevision: buildBibleResourcePublicationRevision(
        manifestWithoutPublicationRevision
      )
    };
    const manifestPath = path.join(temporaryDir, "manifest.json");
    await writeFile(
      manifestPath,
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8"
    );
    await validateBibleResourcePublication(temporaryDir);
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

export async function validateBibleResourcePublication(
  bundleDir: string
): Promise<BibleResourcePublicationManifest> {
  const resolvedBundleDir = path.resolve(bundleDir);
  const manifestValue: unknown = JSON.parse(
    await readFile(path.join(resolvedBundleDir, "manifest.json"), "utf8")
  );
  const manifest = decodeManifest(manifestValue);
  const canonicalPath = resolveResourcePublicationPath(
    resolvedBundleDir,
    manifest.canonical.path
  );
  const offlineArtifactPath = resolveResourcePublicationPath(
    resolvedBundleDir,
    manifest.offlineArtifact.path
  );
  const [canonicalStats, offlineStats] = await Promise.all([
    stat(canonicalPath),
    stat(offlineArtifactPath)
  ]);
  if (
    canonicalStats.size !== manifest.canonical.bytes ||
    (await sha256File(canonicalPath)) !== manifest.canonical.sha256
  ) {
    throw new Error("resource-publication-canonical-integrity-mismatch");
  }
  if (
    offlineStats.size !== manifest.offlineArtifact.bytes ||
    (await sha256File(offlineArtifactPath)) !== manifest.offlineArtifact.sha256
  ) {
    throw new Error("resource-publication-offline-integrity-mismatch");
  }

  const canonical = JSON.parse(
    await readFile(canonicalPath, "utf8")
  ) as CanonicalBiblePublication;
  const canonicalVerification = verifyCanonicalBiblePublication(canonical);
  if (
    manifest.canonical.schemaVersion !== canonical.schemaVersion ||
    manifest.identity.versionId !== canonical.applicationVersionId ||
    manifest.revision !== canonicalVerification.textRevision ||
    manifest.publicationRevision !==
      buildBibleResourcePublicationRevision(
        omitPublicationRevision(manifest)
      ) ||
    manifest.provenance.sourceVersion !== canonical.sourceVersion ||
    manifest.provenance.sourceSha256 !== canonical.sourceSha256
  ) {
    throw new Error("resource-publication-canonical-metadata-mismatch");
  }
  const derived = deriveCanonicalBibleManifestData(canonical, manifest);
  if (
    JSON.stringify(manifest.coverage) !== JSON.stringify(derived.coverage) ||
    JSON.stringify(manifest.counts) !== JSON.stringify(derived.counts)
  ) {
    throw new Error("resource-publication-canonical-declaration-mismatch");
  }

  const archiveEntries = manifest.offlineArtifact.entries ?? {
    canonical: {
      entry: manifest.offlineArtifact.entry,
      sha256: manifest.offlineArtifact.contentSha256,
      bytes: 0
    }
  };
  const archivedValues: Partial<
    Record<"canonical" | "pericope" | "redWords", string>
  > = {};
  for (const [role, entry] of Object.entries(archiveEntries)) {
    if (!entry) continue;
    const archived = await execFileAsync(
      "unzip",
      ["-p", offlineArtifactPath, entry.entry],
      { maxBuffer: 128 * 1024 * 1024 }
    );
    const content = Buffer.from(archived.stdout, "utf8");
    if (
      sha256Buffer(content) !== entry.sha256 ||
      (entry.bytes > 0 && content.byteLength !== entry.bytes)
    ) {
      throw new Error("resource-publication-offline-entry-mismatch");
    }
    archivedValues[role as keyof typeof archivedValues] = archived.stdout;
  }
  const archivedCanonical = archivedValues.canonical;
  if (
    !archivedCanonical ||
    sha256Buffer(Buffer.from(archivedCanonical, "utf8")) !==
      manifest.offlineArtifact.contentSha256
  ) {
    throw new Error("resource-publication-offline-primary-content-mismatch");
  }
  const archivedValue: unknown = JSON.parse(archivedCanonical);
  const archivedPublication =
    (archivedValue as Partial<CanonicalBiblePublication>).format ===
    "bible-strong-canonical-bible"
      ? (archivedValue as CanonicalBiblePublication)
      : buildCanonicalBibleFromLegacy({
          versionId: manifest.identity.versionId,
          sourceVersion: manifest.provenance.sourceVersion,
          sourceSha256: manifest.provenance.sourceSha256,
          bible: archivedValue,
          ...(archivedValues.pericope
            ? { pericope: JSON.parse(archivedValues.pericope) }
            : {}),
          ...(archivedValues.redWords
            ? { redWords: JSON.parse(archivedValues.redWords) }
            : {})
        });
  if (
    JSON.stringify(archivedPublication.verses) !==
    JSON.stringify(canonical.verses)
  ) {
    throw new Error("resource-publication-offline-presentation-mismatch");
  }
  return manifest;
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
  if (metadata.canon.orderedBooks.length === 0) {
    throw new Error("resource-publication-canon-empty");
  }
}

function deriveCanonicalBibleManifestData(
  canonical: CanonicalBiblePublication,
  metadata: BibleResourcePublicationMetadata
): {
  coverage: BibleResourcePublicationManifest["coverage"];
  counts: BibleResourcePublicationManifest["counts"];
} {
  const verification = verifyCanonicalBiblePublication(canonical);
  if (canonical.applicationVersionId !== metadata.identity.versionId) {
    throw new Error("resource-publication-canonical-identity-mismatch");
  }

  const orderedBooks = Object.keys(canonical.verses)
    .map(Number)
    .sort((left, right) => left - right);
  if (
    orderedBooks.some((book) => !metadata.canon.orderedBooks.includes(book))
  ) {
    throw new Error("resource-publication-canon-mismatch");
  }

  const chaptersByBook: Record<string, number[]> = {};
  const verseCountByBookChapter: Record<string, number> = {};
  let chapters = 0;
  let verses = 0;
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
    }
  }
  if (verses !== verification.verseCount) {
    throw new Error("resource-publication-count-mismatch");
  }
  return {
    coverage: { chaptersByBook, verseCountByBookChapter },
    counts: {
      books: orderedBooks.length,
      chapters,
      verses,
      notes: verification.noteCount,
      headings: verification.headingCount
    }
  };
}

function decodeManifest(value: unknown): BibleResourcePublicationManifest {
  const envelope = decodeResourcePublicationEnvelope(value);
  const manifest = value as Partial<BibleResourcePublicationManifest>;
  if (
    manifest.identity?.kind !== "bible-text" ||
    !manifest.identity.versionId ||
    !manifest.identity.language ||
    envelope.canonical.schemaVersion < 1 ||
    !manifest.canon ||
    typeof manifest.canon.id !== "string" ||
    manifest.canon.id.length === 0 ||
    !Array.isArray(manifest.canon.orderedBooks) ||
    manifest.canon.orderedBooks.length === 0 ||
    manifest.canon.orderedBooks.some(
      (book) => !Number.isSafeInteger(book) || book < 1
    ) ||
    !manifest.versification ||
    !manifest.coverage ||
    !manifest.coverage.chaptersByBook ||
    !manifest.coverage.verseCountByBookChapter ||
    !manifest.counts ||
    Object.values(manifest.counts).some(
      (count) => !Number.isSafeInteger(count) || count < 0
    )
  ) {
    throw new Error("resource-publication-manifest-invalid");
  }
  validateMetadata(manifest as BibleResourcePublicationManifest);
  return manifest as BibleResourcePublicationManifest;
}

function sha256Buffer(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function buildBibleResourcePublicationRevision(
  manifest: Omit<BibleResourcePublicationManifest, "publicationRevision">
): string {
  const digest = createHash("sha256")
    .update(JSON.stringify(sortJsonValue(manifest)))
    .digest("hex");
  return `${manifest.identity.versionId.toLowerCase()}-${digest.slice(0, 20)}`;
}

function omitPublicationRevision(
  manifest: BibleResourcePublicationManifest
): Omit<BibleResourcePublicationManifest, "publicationRevision"> {
  const {
    publicationRevision: _publicationRevision,
    ...withoutPublicationRevision
  } = manifest;
  void _publicationRevision;
  return withoutPublicationRevision;
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, item]) => [key, sortJsonValue(item)])
  );
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

function parseCliArgs(
  args: readonly string[],
  allowed: ReadonlySet<string>
): Record<string, string> {
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
  const [command = "build", ...rawArgs] = process.argv.slice(2);
  if (command === "validate") {
    const args = parseCliArgs(rawArgs, new Set(["--bundle"]));
    const bundle = args["--bundle"];
    if (!bundle) throw new Error("resource-publication-cli-bundle-missing");
    const manifest = await validateBibleResourcePublication(bundle);
    console.log(JSON.stringify(manifest, null, 2));
    return;
  }
  const buildArgs = command === "build" ? rawArgs : [command, ...rawArgs];
  const args = parseCliArgs(
    buildArgs,
    new Set(["--canonical", "--metadata", "--output-dir", "--generated-at"])
  );
  const canonicalPath = args["--canonical"];
  const metadataPath = args["--metadata"];
  const outputDir = args["--output-dir"];
  const generatedAt = args["--generated-at"];
  if (!canonicalPath || !metadataPath || !outputDir || !generatedAt) {
    throw new Error("resource-publication-cli-required-options-missing");
  }
  const metadata = JSON.parse(
    await readFile(path.resolve(metadataPath), "utf8")
  ) as BibleResourcePublicationMetadata;
  const result = await buildBibleResourcePublication({
    ...metadata,
    canonicalPath,
    outputDir,
    generatedAt
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
