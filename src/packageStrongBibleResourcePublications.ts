import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createWriteStream, existsSync } from "node:fs";
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
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  assertResourcePublicationArtifact,
  decodeResourcePublicationEnvelope,
  isNonEmptyString,
  isNonNegativeInteger,
  isRecord,
  isSha256,
  resolveResourcePublicationPath,
  sha256ResourcePublicationFile,
  type ResourcePublicationEnvelope
} from "./resourcePublicationEnvelope.js";
import { validateBibleResourcePublication } from "./packageResourcePublication.js";

const execFileAsync = promisify(execFile);
const STRONG_KINDS = ["strong", "estrong", "dstrong", "ustrong"] as const;
const BASE_BUILDER_VERSION = "strong-bible-mobile-publication@2";
const REVERSE_BUILDER_VERSIONS = new Set([
  "reverse-interlinear-mobile-compact@2",
  "reverse-interlinear-mobile-sanitized@9"
]);
const MAX_SQLITE_BYTES = 512 * 1024 * 1024;

type StrongKind = (typeof STRONG_KINDS)[number];
type Location = { book: number; chapter: number; verse: number };
type CanonicalStrongBiblePublication = {
  format: "bible-strong-canonical-strong-index";
  schemaVersion: 1;
  applicationVersionId: string;
  datasetId: string;
  textRevision: string;
  textSha256: string;
  strongRevision: string;
  verses: Location[];
  lexemes: Array<{ id: number; lemma: string; partOfSpeech: string }>;
  identities: Array<{ id: number; kind: StrongKind; code: string }>;
  spans: Array<
    Location & {
      ordinal: number;
      startOffset: number;
      length: number;
      isAligned: boolean;
      lexemeId?: number;
      stepTokenIds?: number[];
    }
  >;
  spanIdentities: Array<
    Location & { ordinal: number; identityOrder: number; identityId: number }
  >;
};

type StrongBibleManifest = ResourcePublicationEnvelope & {
  identity: {
    kind: "strong-bible-index";
    versionId: string;
    datasetId: string;
    language: string;
  };
  dependencies: {
    bible: {
      resourceIdentity: string;
      revision: string;
      textSha256: string;
      online: "required";
      offline: "required";
    };
    strongLexiconModules: Array<{
      resourceIdentity: "strong-lexicon:core";
      online: "required-for-lexical-details";
      offline: "required-for-lexical-details";
    }>;
  };
  counts: ReturnType<typeof countCanonical>;
};

type StrongResourceConfig = {
  schemaVersion: 1;
  rightsReviewedAt: string;
  resources: Array<{
    versionId: string;
    datasetId: string;
    language: string;
    attribution: string;
  }>;
};

type InventoryEntry = {
  id: string;
  artifactUrl: string;
  sources: Array<{ role: string; sourceUrl: string; entry: string }>;
};

type Metadata = Record<string, string>;

const sha256 = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");

export async function buildStrongBibleResourcePublication(options: {
  sourceArchivePath: string;
  sourceUrl: string;
  sourceEntry: string;
  bibleBundleDir: string;
  outputDir: string;
  versionId: string;
  datasetId: string;
  language: string;
  attribution: string;
  rightsReviewedAt: string;
  generatedAt: string;
}): Promise<{ outputDir: string; manifest: StrongBibleManifest }> {
  const archivePath = path.resolve(options.sourceArchivePath);
  const bibleBundleDir = path.resolve(options.bibleBundleDir);
  const outputDir = path.resolve(options.outputDir);
  if (existsSync(outputDir)) {
    throw new Error(`strong-publication-output-already-exists:${outputDir}`);
  }
  await assertSingleBoundedZipEntry(archivePath, options.sourceEntry);
  const extractedDir = await mkdtemp(path.join(tmpdir(), "strong-source-"));
  const staging = `${outputDir}.tmp-${process.pid}-${randomUUID()}`;
  try {
    await execFileAsync("unzip", [
      "-qq",
      archivePath,
      options.sourceEntry,
      "-d",
      extractedDir
    ]);
    const sqlitePath = path.join(extractedDir, options.sourceEntry);
    if (!(await lstat(sqlitePath)).isFile()) {
      throw new Error("strong-publication-source-entry-invalid");
    }
    const canonical = await readStrongSqlite(sqlitePath);
    if (
      canonical.applicationVersionId !== options.versionId ||
      canonical.datasetId !== options.datasetId
    ) {
      throw new Error(
        `strong-publication-identity-mismatch:${options.versionId}`
      );
    }
    const bibleManifest = await readBibleDependency(bibleBundleDir);
    if (
      bibleManifest.identity.versionId !== options.versionId ||
      bibleManifest.revision !== canonical.textRevision ||
      bibleManifest.textSha256 !== canonical.textSha256
    ) {
      throw new Error(
        `strong-publication-bible-dependency-mismatch:${options.versionId}`
      );
    }

    const canonicalRelative = `canonical/bible-${options.versionId.toLowerCase()}-strong.json`;
    const offlineRelative = `offline/bible-${options.versionId.toLowerCase()}-strong.sqlite.zip`;
    const canonicalPath = path.join(staging, canonicalRelative);
    const offlinePath = path.join(staging, offlineRelative);
    await Promise.all([
      mkdir(path.dirname(canonicalPath), { recursive: true }),
      mkdir(path.dirname(offlinePath), { recursive: true })
    ]);
    await writeFile(canonicalPath, `${JSON.stringify(canonical)}\n`, "utf8");
    await copyFile(archivePath, offlinePath);
    const [canonicalStat, offlineStat, sqliteStat] = await Promise.all([
      stat(canonicalPath),
      stat(offlinePath),
      stat(sqlitePath)
    ]);
    const metadata = await readMetadata(sqlitePath);
    const manifest: StrongBibleManifest = {
      format: "bible-strong-resource-publication",
      schemaVersion: 1,
      identity: {
        kind: "strong-bible-index",
        versionId: options.versionId,
        datasetId: options.datasetId,
        language: options.language
      },
      revision: deriveStrongBibleResourceRevision(canonical),
      canonical: {
        path: canonicalRelative,
        mediaType: "application/json",
        schemaVersion: 1,
        sha256: await sha256ResourcePublicationFile(canonicalPath),
        bytes: canonicalStat.size
      },
      offlineArtifact: {
        path: offlineRelative,
        mediaType: "application/zip",
        entry: options.sourceEntry,
        sha256: await sha256ResourcePublicationFile(offlinePath),
        bytes: offlineStat.size,
        contentSha256: await sha256ResourcePublicationFile(sqlitePath)
      },
      provenance: {
        generator: "bible-lexicon-maker",
        sourceVersion: metadata.sourceVersion ?? options.sourceUrl,
        sourceSha256:
          metadata.sourceSha256 ?? sha256(await readFile(archivePath)),
        generatedAt: options.generatedAt
      },
      rights: {
        holder: options.attribution,
        termsReference: `config/strong-bible-resource-publications.json#${options.versionId}`,
        attribution: options.attribution,
        reviewedAt: options.rightsReviewedAt,
        online: bibleManifest.onlineAccess,
        offline: bibleManifest.offlineDownload
      },
      deliveryCapabilities: {
        onlineAccess: bibleManifest.onlineAccess,
        offlineDownload: bibleManifest.offlineDownload,
        localDevelopmentAccess: true
      },
      dependencies: {
        bible: {
          resourceIdentity: `bible-text:${options.versionId}`,
          revision: canonical.textRevision,
          textSha256: canonical.textSha256,
          online: "required",
          offline: "required"
        },
        strongLexiconModules: [
          {
            resourceIdentity: "strong-lexicon:core",
            online: "required-for-lexical-details",
            offline: "required-for-lexical-details"
          }
        ]
      },
      counts: countCanonical(canonical)
    };
    await writeFile(
      path.join(staging, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`
    );
    await validateStrongBibleResourcePublication(staging);
    await mkdir(path.dirname(outputDir), { recursive: true });
    await rename(staging, outputDir);
    return { outputDir, manifest };
  } catch (cause) {
    await rm(staging, { recursive: true, force: true });
    throw cause;
  } finally {
    await rm(extractedDir, { recursive: true, force: true });
  }
}

export async function buildAllStrongBibleResourcePublications(options: {
  root?: string;
  outputDir?: string;
  bibleBundlesDir?: string;
  generatedAt: string;
}): Promise<{ outputDir: string; manifests: StrongBibleManifest[] }> {
  const root = path.resolve(options.root ?? process.cwd());
  const outputDir = path.resolve(
    root,
    options.outputDir ?? "outputs/releases/strong-bible-publications-current"
  );
  if (existsSync(outputDir))
    throw new Error(`strong-publications-output-already-exists:${outputDir}`);
  const config = JSON.parse(
    await readFile(
      path.join(root, "config/strong-bible-resource-publications.json"),
      "utf8"
    )
  ) as StrongResourceConfig;
  const inventory = JSON.parse(
    await readFile(
      path.join(root, "config/mobile-resource-inventory.json"),
      "utf8"
    )
  ) as InventoryEntry[];
  if (config.schemaVersion !== 1 || config.resources.length !== 12) {
    throw new Error("strong-publications-config-invalid");
  }
  const staging = `${outputDir}.tmp-${process.pid}-${randomUUID()}`;
  const downloadDir = `${staging}-downloads`;
  const manifests: StrongBibleManifest[] = [];
  try {
    await mkdir(downloadDir, { recursive: true });
    for (const resource of config.resources) {
      const inventoryEntry = inventory.find(
        (entry) => entry.id === `bible-strong:${resource.versionId}`
      );
      const source = inventoryEntry?.sources.find(
        (item) => item.role === "canonical"
      );
      if (!inventoryEntry || !source) {
        throw new Error(
          `strong-publication-inventory-missing:${resource.versionId}`
        );
      }
      const archivePath = path.join(
        downloadDir,
        `${resource.versionId.toLowerCase()}.zip`
      );
      await download(source.sourceUrl, archivePath);
      const result = await buildStrongBibleResourcePublication({
        ...resource,
        sourceArchivePath: archivePath,
        sourceUrl: source.sourceUrl,
        sourceEntry: source.entry,
        bibleBundleDir: path.resolve(
          root,
          options.bibleBundlesDir ??
            "outputs/releases/ordinary-bible-publications-issue-302-v2",
          resource.versionId.toLowerCase()
        ),
        outputDir: path.join(staging, resource.versionId.toLowerCase()),
        rightsReviewedAt: config.rightsReviewedAt,
        generatedAt: options.generatedAt
      });
      manifests.push(result.manifest);
    }
    await mkdir(path.dirname(outputDir), { recursive: true });
    await rename(staging, outputDir);
    return { outputDir, manifests };
  } catch (cause) {
    await rm(staging, { recursive: true, force: true });
    throw cause;
  } finally {
    await rm(downloadDir, { recursive: true, force: true });
  }
}

export async function validateStrongBibleResourcePublication(
  bundleDir: string
): Promise<StrongBibleManifest> {
  const root = path.resolve(bundleDir);
  const manifest = decodeManifest(
    JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"))
  );
  const canonicalPath = resolveResourcePublicationPath(
    root,
    manifest.canonical.path
  );
  const archivePath = resolveResourcePublicationPath(
    root,
    manifest.offlineArtifact.path
  );
  await Promise.all([
    assertResourcePublicationArtifact(
      canonicalPath,
      manifest.canonical,
      "canonical",
      root
    ),
    assertResourcePublicationArtifact(
      archivePath,
      manifest.offlineArtifact,
      "offline",
      root
    )
  ]);
  const canonical = decodeCanonical(
    JSON.parse(await readFile(canonicalPath, "utf8"))
  );
  if (
    canonical.applicationVersionId !== manifest.identity.versionId ||
    canonical.datasetId !== manifest.identity.datasetId ||
    deriveStrongBibleResourceRevision(canonical) !== manifest.revision ||
    canonical.textRevision !== manifest.dependencies.bible.revision ||
    canonical.textSha256 !== manifest.dependencies.bible.textSha256 ||
    manifest.dependencies.bible.resourceIdentity !==
      `bible-text:${manifest.identity.versionId}` ||
    JSON.stringify(countCanonical(canonical)) !==
      JSON.stringify(manifest.counts)
  ) {
    throw new Error("strong-publication-declaration-mismatch");
  }
  const extractedDir = await mkdtemp(path.join(tmpdir(), "strong-validate-"));
  try {
    await assertSingleBoundedZipEntry(
      archivePath,
      manifest.offlineArtifact.entry
    );
    await execFileAsync("unzip", [
      "-qq",
      archivePath,
      manifest.offlineArtifact.entry,
      "-d",
      extractedDir
    ]);
    const sqlitePath = path.join(extractedDir, manifest.offlineArtifact.entry);
    if (!(await lstat(sqlitePath)).isFile())
      throw new Error("strong-publication-offline-entry-invalid");
    if (
      (await sha256ResourcePublicationFile(sqlitePath)) !==
      manifest.offlineArtifact.contentSha256
    ) {
      throw new Error("strong-publication-offline-content-mismatch");
    }
    const offlineCanonical = await readStrongSqlite(sqlitePath);
    if (JSON.stringify(offlineCanonical) !== JSON.stringify(canonical)) {
      throw new Error("strong-publication-offline-content-mismatch");
    }
  } finally {
    await rm(extractedDir, { recursive: true, force: true });
  }
  return manifest;
}

async function readStrongSqlite(
  sqlitePath: string
): Promise<CanonicalStrongBiblePublication> {
  const integrity = await queryJson<{ integrity_check: string }>(
    sqlitePath,
    "PRAGMA integrity_check"
  );
  if (
    integrity.length !== 1 ||
    integrity[0]?.integrity_check.toLowerCase() !== "ok"
  ) {
    throw new Error("strong-publication-sqlite-integrity-invalid");
  }
  const metadata = await readMetadata(sqlitePath);
  validateStrongRevision(metadata);
  const required = [
    "applicationVersionId",
    "datasetId",
    "textRevision",
    "textSha256",
    "strongRevision"
  ];
  if (
    required.some((key) => !isNonEmptyString(metadata[key])) ||
    !isSha256(metadata.textSha256)
  ) {
    throw new Error("strong-publication-sqlite-metadata-invalid");
  }
  const verses = await queryJson<Location>(
    sqlitePath,
    "SELECT bookOrder AS book, chapter, verse FROM Verses ORDER BY bookOrder, chapter, verse"
  );
  const lexemes = await queryJson<{
    id: number;
    lemma: string;
    partOfSpeech: string;
  }>(
    sqlitePath,
    "SELECT id, lemma, partOfSpeech FROM FrenchLexemes ORDER BY id"
  );
  const identityRows = await queryJson<{
    id: number;
    kind: number;
    code: string;
  }>(sqlitePath, "SELECT id, kind, code FROM StrongCodes ORDER BY id");
  const identities = identityRows.map((row) => ({
    ...row,
    kind: STRONG_KINDS[row.kind]!
  }));
  if (identities.some((identity) => !identity.kind))
    throw new Error("strong-publication-identity-invalid");
  const wordSpanColumns = new Set(
    (
      await queryJson<{ name: string }>(
        sqlitePath,
        "PRAGMA table_info(WordSpans)"
      )
    ).map((row) => row.name)
  );
  const hasExtras =
    (
      await queryJson<{ name: string }>(
        sqlitePath,
        "SELECT name FROM sqlite_master WHERE type='table' AND name='WordStepTokenExtras'"
      )
    ).length === 1;
  const spanRows = await queryJson<
    Location & {
      verseId: number;
      ordinal: number;
      startOffset: number;
      length: number;
      isAligned: number;
      lexemeId: number | null;
      stepTokenId?: number | null;
    }
  >(
    sqlitePath,
    `SELECT v.id AS verseId, v.bookOrder AS book, v.chapter, v.verse,
            s.ordinal, s.startOffset, s.length, s.isAligned, s.lexemeId${
              wordSpanColumns.has("stepTokenId") ? ", s.stepTokenId" : ""
            }
       FROM WordSpans s JOIN Verses v ON v.id=s.verseId
      ORDER BY v.bookOrder, v.chapter, v.verse, s.ordinal`
  );
  const extraRows = hasExtras
    ? await queryJson<{
        verseId: number;
        targetOrdinal: number;
        stepTokenId: number;
      }>(
        sqlitePath,
        `SELECT verseId, targetOrdinal, stepTokenId FROM WordStepTokenExtras
          ORDER BY verseId, targetOrdinal, sourceOrder`
      )
    : [];
  const extras = new Map<string, number[]>();
  for (const row of extraRows) {
    const key = `${row.verseId}-${row.targetOrdinal}`;
    extras.set(key, [...(extras.get(key) ?? []), row.stepTokenId]);
  }
  const spans = spanRows.map((row) => {
    const stepTokenIds = [
      ...(row.stepTokenId == null ? [] : [row.stepTokenId]),
      ...(extras.get(`${row.verseId}-${row.ordinal}`) ?? [])
    ];
    return {
      book: row.book,
      chapter: row.chapter,
      verse: row.verse,
      ordinal: row.ordinal,
      startOffset: row.startOffset,
      length: row.length,
      isAligned: row.isAligned === 1,
      ...(row.lexemeId == null ? {} : { lexemeId: row.lexemeId }),
      ...(stepTokenIds.length ? { stepTokenIds } : {})
    };
  });
  const spanIdentities = await queryJson<
    Location & { ordinal: number; identityOrder: number; identityId: number }
  >(
    sqlitePath,
    `SELECT v.bookOrder AS book, v.chapter, v.verse, w.ordinal,
            w.identityOrder, w.codeId AS identityId
       FROM WordStrongCodes w JOIN Verses v ON v.id=w.verseId
      ORDER BY v.bookOrder, v.chapter, v.verse, w.ordinal, w.identityOrder`
  );
  const canonical: CanonicalStrongBiblePublication = {
    format: "bible-strong-canonical-strong-index",
    schemaVersion: 1,
    applicationVersionId: metadata.applicationVersionId!,
    datasetId: metadata.datasetId!,
    textRevision: metadata.textRevision!,
    textSha256: metadata.textSha256!,
    strongRevision: metadata.strongRevision!,
    verses,
    lexemes,
    identities,
    spans,
    spanIdentities
  };
  const counts = countCanonical(canonical);
  if (
    counts.verses !== Number(metadata.verseCount) ||
    counts.occurrences !== Number(metadata.occurrenceCount) ||
    counts.unalignedOccurrences !== Number(metadata.unalignedOccurrenceCount) ||
    counts.identities !== Number(metadata.identityCount) ||
    counts.lexemeAssignments !== Number(metadata.lexemeAssignmentCount)
  )
    throw new Error("strong-publication-sqlite-counts-mismatch");
  return canonical;
}

async function readMetadata(sqlitePath: string): Promise<Metadata> {
  const rows = await queryJson<{ key: string; value: string }>(
    sqlitePath,
    "SELECT key, value FROM ResourceMetadata ORDER BY key"
  );
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

function validateStrongRevision(metadata: Metadata): void {
  if (
    metadata.builderVersion !== BASE_BUILDER_VERSION ||
    !isSha256(metadata.sourceSha256) ||
    !isSha256(metadata.textSha256)
  ) {
    throw new Error("strong-publication-builder-metadata-invalid");
  }
  const baseRevision = sha256(
    `${BASE_BUILDER_VERSION}\0${metadata.sourceSha256 ?? ""}\0${metadata.textSha256 ?? ""}`
  );
  if (
    metadata.baseStrongRevision &&
    metadata.baseStrongRevision !== baseRevision
  ) {
    throw new Error("strong-publication-base-revision-invalid");
  }
  if (
    metadata.reverseInterlinearBuilderVersion &&
    !REVERSE_BUILDER_VERSIONS.has(metadata.reverseInterlinearBuilderVersion)
  ) {
    throw new Error("strong-publication-reverse-builder-invalid");
  }
  const expected = metadata.reverseInterlinearBuilderVersion
    ? sha256(
        `${metadata.baseStrongRevision}\0${metadata.reverseInterlinearBuilderVersion}\0${metadata.reverseInterlinearStepRevision}\0${JSON.parse(metadata.reverseInterlinearCompatibleRuntimeSha256s ?? "[]").join(",")}\0${metadata.reverseInterlinearMetrics}`
      )
    : baseRevision;
  // The sanitized English pipeline performs a later, separately attested lexical
  // refinement. Its final digest therefore supersedes the reverse-interlinear
  // digest, while the base source/text digest above remains independently proven.
  if (
    !isSha256(metadata.strongRevision) ||
    (metadata.reverseInterlinearBuilderVersion !==
      "reverse-interlinear-mobile-sanitized@9" &&
      metadata.strongRevision !== expected)
  ) {
    throw new Error("strong-publication-revision-invalid");
  }
}

function countCanonical(canonical: CanonicalStrongBiblePublication) {
  return {
    verses: canonical.verses.length,
    occurrences: canonical.spans.length,
    unalignedOccurrences: canonical.spans.filter((span) => !span.isAligned)
      .length,
    identities: canonical.spanIdentities.length,
    lexemeAssignments: canonical.spans.filter(
      (span) => span.lexemeId !== undefined
    ).length,
    lexemes: canonical.lexemes.length
  };
}

export function deriveStrongBibleResourceRevision(
  canonical: CanonicalStrongBiblePublication
): string {
  const digest = sha256(JSON.stringify(normalizeJson(canonical)));
  return `${canonical.applicationVersionId.toLowerCase()}-strong-${digest.slice(0, 20)}`;
}

function normalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeJson);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, normalizeJson(nested)])
    );
  }
  return value;
}

function decodeCanonical(value: unknown): CanonicalStrongBiblePublication {
  if (!isRecord(value)) throw new Error("strong-publication-canonical-invalid");
  const candidate = value as Partial<CanonicalStrongBiblePublication>;
  if (
    candidate.format !== "bible-strong-canonical-strong-index" ||
    candidate.schemaVersion !== 1 ||
    !isNonEmptyString(candidate.applicationVersionId) ||
    !isNonEmptyString(candidate.datasetId) ||
    !isNonEmptyString(candidate.textRevision) ||
    !isSha256(candidate.textSha256) ||
    !isSha256(candidate.strongRevision) ||
    !Array.isArray(candidate.verses) ||
    !Array.isArray(candidate.lexemes) ||
    !Array.isArray(candidate.identities) ||
    !Array.isArray(candidate.spans) ||
    !Array.isArray(candidate.spanIdentities)
  )
    throw new Error("strong-publication-canonical-invalid");
  const positive = (item: unknown): item is number =>
    Number.isSafeInteger(item) && Number(item) > 0;
  const nonNegative = (item: unknown): item is number =>
    Number.isSafeInteger(item) && Number(item) >= 0;
  const location = (item: unknown): item is Location =>
    isRecord(item) &&
    positive(item.book) &&
    positive(item.chapter) &&
    positive(item.verse);
  const verseKeys = new Set<string>();
  for (const verse of candidate.verses) {
    if (!location(verse))
      throw new Error("strong-publication-canonical-verse-invalid");
    const key = `${verse.book}-${verse.chapter}-${verse.verse}`;
    if (verseKeys.has(key))
      throw new Error("strong-publication-canonical-verse-duplicate");
    verseKeys.add(key);
  }
  const lexemeIds = new Set<number>();
  for (const lexeme of candidate.lexemes) {
    if (
      !isRecord(lexeme) ||
      !positive(lexeme.id) ||
      !isNonEmptyString(lexeme.lemma) ||
      !isNonEmptyString(lexeme.partOfSpeech) ||
      lexemeIds.has(lexeme.id)
    ) {
      throw new Error("strong-publication-canonical-lexeme-invalid");
    }
    lexemeIds.add(lexeme.id);
  }
  const identityIds = new Set<number>();
  const identityCodes = new Set<string>();
  for (const identity of candidate.identities) {
    if (
      !isRecord(identity) ||
      !positive(identity.id) ||
      !STRONG_KINDS.includes(identity.kind as StrongKind) ||
      !isNonEmptyString(identity.code) ||
      identityIds.has(identity.id) ||
      identityCodes.has(`${identity.kind}:${identity.code}`)
    ) {
      throw new Error("strong-publication-canonical-identity-invalid");
    }
    identityIds.add(identity.id);
    identityCodes.add(`${identity.kind}:${identity.code}`);
  }
  const spanKeys = new Set<string>();
  for (const span of candidate.spans) {
    const verseKey = isRecord(span)
      ? `${span.book}-${span.chapter}-${span.verse}`
      : "";
    const key = isRecord(span) ? `${verseKey}-${span.ordinal}` : "";
    if (
      !location(span) ||
      !verseKeys.has(verseKey) ||
      !nonNegative(span.ordinal) ||
      !nonNegative(span.startOffset) ||
      !nonNegative(span.length) ||
      typeof span.isAligned !== "boolean" ||
      span.isAligned !== span.length > 0 ||
      (span.lexemeId !== undefined &&
        (!positive(span.lexemeId) || !lexemeIds.has(span.lexemeId))) ||
      (span.stepTokenIds !== undefined &&
        (!Array.isArray(span.stepTokenIds) ||
          span.stepTokenIds.some((token) => !positive(token)))) ||
      spanKeys.has(key)
    ) {
      throw new Error("strong-publication-canonical-span-invalid");
    }
    spanKeys.add(key);
  }
  const spanIdentityKeys = new Set<string>();
  for (const identity of candidate.spanIdentities) {
    const spanKey = isRecord(identity)
      ? `${identity.book}-${identity.chapter}-${identity.verse}-${identity.ordinal}`
      : "";
    const key = isRecord(identity)
      ? `${spanKey}-${identity.identityOrder}`
      : "";
    if (
      !location(identity) ||
      !nonNegative(identity.ordinal) ||
      !spanKeys.has(spanKey) ||
      !nonNegative(identity.identityOrder) ||
      !positive(identity.identityId) ||
      !identityIds.has(identity.identityId) ||
      spanIdentityKeys.has(key)
    ) {
      throw new Error("strong-publication-canonical-span-identity-invalid");
    }
    spanIdentityKeys.add(key);
  }
  return candidate as CanonicalStrongBiblePublication;
}

function decodeManifest(value: unknown): StrongBibleManifest {
  const envelope = decodeResourcePublicationEnvelope(value);
  const manifest = value as Partial<StrongBibleManifest>;
  const identity = manifest.identity;
  const bible = manifest.dependencies?.bible;
  const modules = manifest.dependencies?.strongLexiconModules;
  if (
    identity?.kind !== "strong-bible-index" ||
    !isNonEmptyString(identity.versionId) ||
    !isNonEmptyString(identity.datasetId) ||
    !isNonEmptyString(identity.language) ||
    envelope.canonical.schemaVersion !== 1 ||
    !isRecord(manifest.dependencies) ||
    !bible ||
    !isNonEmptyString(bible.resourceIdentity) ||
    !isNonEmptyString(bible.revision) ||
    !isSha256(bible.textSha256) ||
    bible.online !== "required" ||
    bible.offline !== "required" ||
    !Array.isArray(modules) ||
    modules.length !== 1 ||
    modules[0]?.resourceIdentity !== "strong-lexicon:core" ||
    modules[0].online !== "required-for-lexical-details" ||
    modules[0].offline !== "required-for-lexical-details" ||
    !manifest.counts ||
    Object.values(manifest.counts).some((count) => !isNonNegativeInteger(count))
  )
    throw new Error("strong-publication-manifest-invalid");
  return manifest as StrongBibleManifest;
}

async function readBibleDependency(bundleDir: string): Promise<{
  identity: { versionId: string };
  revision: string;
  textSha256: string;
  onlineAccess: boolean;
  offlineDownload: boolean;
}> {
  const value = await validateBibleResourcePublication(bundleDir);
  const canonicalValue: unknown = JSON.parse(
    await readFile(
      resolveResourcePublicationPath(bundleDir, value.canonical.path),
      "utf8"
    )
  );
  if (!isRecord(canonicalValue) || !isSha256(canonicalValue.textSha256)) {
    throw new Error("strong-publication-bible-canonical-invalid");
  }
  return {
    identity: { versionId: value.identity.versionId },
    revision: value.revision,
    textSha256: canonicalValue.textSha256,
    onlineAccess: value.deliveryCapabilities.onlineAccess,
    offlineDownload: value.deliveryCapabilities.offlineDownload
  };
}

async function queryJson<T>(sqlitePath: string, sql: string): Promise<T[]> {
  try {
    const { stdout } = await execFileAsync(
      "sqlite3",
      ["-json", sqlitePath, sql],
      {
        maxBuffer: 512 * 1024 * 1024
      }
    );
    return JSON.parse(stdout || "[]") as T[];
  } catch (cause) {
    throw new Error("strong-publication-sqlite-invalid", { cause });
  }
}

async function assertSingleBoundedZipEntry(
  archivePath: string,
  expectedEntry: string
): Promise<void> {
  const { stdout: names } = await execFileAsync("unzip", ["-Z1", archivePath]);
  if (names.split(/\r?\n/u).filter(Boolean).join("\n") !== expectedEntry) {
    throw new Error("strong-publication-offline-entries-invalid");
  }
  const { stdout } = await execFileAsync("zipinfo", [
    "-l",
    archivePath,
    expectedEntry
  ]);
  const line = stdout
    .split(/\r?\n/u)
    .find((item) => item.trimEnd().endsWith(` ${expectedEntry}`));
  const bytes = line?.trim().split(/\s+/u)[3];
  if (
    !line?.trimStart().startsWith("-") ||
    !bytes ||
    Number(bytes) > MAX_SQLITE_BYTES
  ) {
    throw new Error("strong-publication-offline-size-invalid");
  }
}

async function download(url: string, destination: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok || !response.body)
    throw new Error(`strong-publication-download-failed:${url}`);
  await pipeline(response.body, createWriteStream(destination));
}

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  if (rawArgs[0] === "validate") {
    if (rawArgs.length !== 3 || rawArgs[1] !== "--bundle" || !rawArgs[2]) {
      throw new Error("strong-publication-cli-validate-invalid");
    }
    const manifest = await validateStrongBibleResourcePublication(rawArgs[2]);
    console.log(
      JSON.stringify(
        { versionId: manifest.identity.versionId, revision: manifest.revision },
        null,
        2
      )
    );
    return;
  }
  const args = new Map<string, string>();
  const allowed = new Set([
    "--output-dir",
    "--bible-bundles-dir",
    "--generated-at"
  ]);
  for (let index = 0; index < rawArgs.length; index += 2) {
    const key = rawArgs[index];
    const value = rawArgs[index + 1];
    if (!key || !allowed.has(key)) {
      throw new Error(`strong-publication-cli-option-unknown:${key ?? ""}`);
    }
    if (!value || value.startsWith("--"))
      throw new Error("strong-publication-cli-invalid");
    if (args.has(key)) {
      throw new Error(`strong-publication-cli-option-duplicate:${key}`);
    }
    args.set(key, value);
  }
  const result = await buildAllStrongBibleResourcePublications({
    outputDir: args.get("--output-dir"),
    bibleBundlesDir: args.get("--bible-bundles-dir"),
    generatedAt: args.get("--generated-at") ?? new Date().toISOString()
  });
  console.log(
    JSON.stringify(
      { outputDir: result.outputDir, resources: result.manifests.length },
      null,
      2
    )
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
