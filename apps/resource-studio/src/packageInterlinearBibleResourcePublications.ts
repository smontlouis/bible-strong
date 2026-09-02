import { createHash, randomUUID } from "node:crypto";
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
  utimes,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { promisify } from "node:util";

import { validateBibleResourcePublication } from "./packageResourcePublication.js";
import {
  assertResourcePublicationArtifact,
  decodeResourcePublicationEnvelope,
  isNonEmptyString,
  isNonNegativeInteger,
  isRecord,
  isSha256,
  resolveResourcePublicationPath,
  sha256ResourcePublicationFile
} from "./resourcePublicationEnvelope.js";
import { commitResourcePublicationBundle } from "./resourcePublicationCommit.js";
import { STRONG_IDENTITY_KINDS as IDENTITY_KINDS } from "./strongIdentityKinds.js";

const execFileAsync = promisify(execFile);
const ZIP_TIME = new Date("1980-01-01T00:00:00.000Z");
const MAX_SQLITE_BYTES = 128 * 1024 * 1024;
type Locale = "fr" | "en";
type BibleTextByLocation = Map<string, string>;

export interface CanonicalInterlinearBiblePublication {
  format: "bible-strong-canonical-interlinear-index";
  schemaVersion: 1;
  applicationVersionId: "BHG";
  datasetId: "STEP";
  language: Locale;
  indexRevision: string;
  textRevision: string;
  textSha256: string;
  verses: Array<{ id: number; book: number; chapter: number; verse: number }>;
  tokens: Array<{
    id: number;
    verseId: number;
    ordinal: number;
    startOffset: number;
    length: number;
  }>;
  segments: Array<{
    id: number;
    tokenId: number;
    ordinal: number;
    startOffset: number;
    length: number;
    transliteration: string;
    lemma: string;
    morphology: string;
    gloss: string;
  }>;
  segmentIdentities: Array<{
    segmentId: number;
    identityOrder: number;
    kind: (typeof IDENTITY_KINDS)[number];
    code: string;
  }>;
}

export interface InterlinearBiblePublicationManifest {
  format: "bible-strong-resource-publication";
  schemaVersion: 1;
  identity: {
    kind: "interlinear-index";
    versionId: "BHG";
    datasetId: "STEP";
    language: Locale;
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
  rights: {
    holder: string;
    termsReference: string;
    attribution: string;
    reviewedAt: string;
    online: boolean;
    offline: boolean;
  };
  deliveryCapabilities: {
    onlineAccess: boolean;
    offlineDownload: boolean;
    localDevelopmentAccess: true;
  };
  dependencies: {
    bible: {
      resourceIdentity: "bible-text:BHG";
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
  counts: {
    verses: number;
    tokens: number;
    segments: number;
    identities: number;
  };
}

export interface InterlinearPublicationOptions {
  sqlitePath: string;
  bibleBundleDir: string;
  outputDir: string;
  language: Locale;
  attribution: string;
  rightsReviewedAt: string;
  generatedAt?: string;
}

export async function buildInterlinearBibleResourcePublication(
  options: InterlinearPublicationOptions
): Promise<{
  outputDir: string;
  manifest: InterlinearBiblePublicationManifest;
}> {
  const sourceSqlite = path.resolve(options.sqlitePath);
  const outputDir = path.resolve(options.outputDir);
  if (!existsSync(sourceSqlite))
    throw new Error(`interlinear-source-missing:${sourceSqlite}`);
  if (existsSync(outputDir))
    throw new Error(`interlinear-output-already-exists:${outputDir}`);
  if (
    !isNonEmptyString(options.attribution) ||
    !isNonEmptyString(options.rightsReviewedAt)
  ) {
    throw new Error("interlinear-publication-metadata-invalid");
  }

  const bibleManifest = await validateBibleResourcePublication(
    options.bibleBundleDir
  );
  if (bibleManifest.identity.versionId !== "BHG") {
    throw new Error("interlinear-bible-dependency-invalid");
  }
  const bibleCanonicalValue: unknown = JSON.parse(
    await readFile(
      path.join(
        path.resolve(options.bibleBundleDir),
        bibleManifest.canonical.path
      ),
      "utf8"
    )
  );
  if (
    !isRecord(bibleCanonicalValue) ||
    !isRecord(bibleCanonicalValue.verses) ||
    !isNonEmptyString(bibleCanonicalValue.textRevision) ||
    !isSha256(bibleCanonicalValue.textSha256)
  ) {
    throw new Error("interlinear-bible-dependency-invalid");
  }
  const bibleCanonical = {
    textRevision: bibleCanonicalValue.textRevision,
    textSha256: bibleCanonicalValue.textSha256,
    texts: decodeBibleTexts(bibleCanonicalValue.verses)
  };

  const workDir = await mkdtemp(path.join(tmpdir(), "interlinear-build-"));
  const entry = `bible-step-interlinear-${options.language}.sqlite`;
  const normalizedSqlite = path.join(workDir, entry);
  const canonicalRelative = `canonical/bible-bhg-interlinear-${options.language}.json`;
  const offlineRelative = `offline/${entry}.zip`;

  try {
    return await commitResourcePublicationBundle({
      outputDir,
      build: async (temporaryDir) => {
        const canonicalPath = path.join(temporaryDir, canonicalRelative);
        const offlinePath = path.join(temporaryDir, offlineRelative);
        await Promise.all([
          mkdir(workDir, { recursive: true }),
          mkdir(path.dirname(canonicalPath), { recursive: true }),
          mkdir(path.dirname(offlinePath), { recursive: true })
        ]);
        await copyFile(sourceSqlite, normalizedSqlite);
        const sourceSha256 = await sha256ResourcePublicationFile(sourceSqlite);
        const metadata = bindBibleDependency(
          normalizedSqlite,
          options.language,
          bibleCanonical.textRevision,
          bibleCanonical.textSha256
        );
        const content = readCanonicalContent(normalizedSqlite, {
          language: options.language,
          textRevision: bibleCanonical.textRevision,
          textSha256: bibleCanonical.textSha256,
          bibleTexts: bibleCanonical.texts
        });
        const withoutRevision = {
          format: "bible-strong-canonical-interlinear-index" as const,
          schemaVersion: 1 as const,
          applicationVersionId: "BHG" as const,
          datasetId: "STEP" as const,
          language: options.language,
          textRevision: bibleCanonical.textRevision,
          textSha256: bibleCanonical.textSha256,
          ...content
        };
        const revision =
          deriveInterlinearBibleResourceRevision(withoutRevision);
        const canonical: CanonicalInterlinearBiblePublication = {
          ...withoutRevision,
          indexRevision: revision
        };
        bindIndexRevision(normalizedSqlite, revision);
        await writeFile(
          canonicalPath,
          `${JSON.stringify(canonical)}\n`,
          "utf8"
        );
        await utimes(normalizedSqlite, ZIP_TIME, ZIP_TIME);
        await execFileAsync("zip", [
          "-X",
          "-q",
          "-j",
          offlinePath,
          normalizedSqlite
        ]);

        const [canonicalStats, offlineStats, sqliteStats] = await Promise.all([
          stat(canonicalPath),
          stat(offlinePath),
          stat(normalizedSqlite)
        ]);
        const manifest: InterlinearBiblePublicationManifest = {
          format: "bible-strong-resource-publication",
          schemaVersion: 1,
          identity: {
            kind: "interlinear-index",
            versionId: "BHG",
            datasetId: "STEP",
            language: options.language
          },
          revision,
          canonical: {
            path: canonicalRelative,
            mediaType: "application/json",
            schemaVersion: 1,
            sha256: await sha256ResourcePublicationFile(canonicalPath),
            bytes: canonicalStats.size
          },
          offlineArtifact: {
            path: offlineRelative,
            mediaType: "application/zip",
            entry,
            sha256: await sha256ResourcePublicationFile(offlinePath),
            bytes: offlineStats.size,
            contentSha256: await sha256ResourcePublicationFile(normalizedSqlite)
          },
          provenance: {
            generator: "bible-lexicon-maker",
            sourceVersion: metadata.sourceVersion,
            sourceSha256,
            generatedAt: options.generatedAt ?? new Date().toISOString()
          },
          rights: {
            holder: options.attribution,
            termsReference: "CC BY 4.0",
            attribution: options.attribution,
            reviewedAt: options.rightsReviewedAt,
            online: true,
            offline: true
          },
          deliveryCapabilities: {
            onlineAccess: true,
            offlineDownload: true,
            localDevelopmentAccess: true
          },
          dependencies: {
            bible: {
              resourceIdentity: "bible-text:BHG",
              revision: bibleCanonical.textRevision,
              textSha256: bibleCanonical.textSha256,
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
          counts: {
            verses: canonical.verses.length,
            tokens: canonical.tokens.length,
            segments: canonical.segments.length,
            identities: canonical.segmentIdentities.length
          }
        };
        if (sqliteStats.size <= 0) throw new Error("interlinear-offline-empty");
        await writeFile(
          path.join(temporaryDir, "manifest.json"),
          `${JSON.stringify(manifest, null, 2)}\n`,
          "utf8"
        );
        return { outputDir, manifest };
      },
      validate: validateInterlinearBibleResourcePublication
    });
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

export async function validateInterlinearBibleResourcePublication(
  bundleDir: string
): Promise<InterlinearBiblePublicationManifest> {
  const root = path.resolve(bundleDir);
  const raw: unknown = JSON.parse(
    await readFile(path.join(root, "manifest.json"), "utf8")
  );
  const envelope = decodeResourcePublicationEnvelope(raw);
  const manifest = decodeManifest(envelope);
  const canonicalPath = resolveResourcePublicationPath(
    root,
    manifest.canonical.path
  );
  const offlinePath = resolveResourcePublicationPath(
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
      offlinePath,
      manifest.offlineArtifact,
      "offline",
      root
    )
  ]);
  const canonical = decodeCanonical(
    JSON.parse(await readFile(canonicalPath, "utf8"))
  );
  if (
    canonical.language !== manifest.identity.language ||
    canonical.indexRevision !== manifest.revision ||
    deriveInterlinearBibleResourceRevision(canonical) !== manifest.revision ||
    canonical.textRevision !== manifest.dependencies.bible.revision ||
    canonical.textSha256 !== manifest.dependencies.bible.textSha256 ||
    JSON.stringify(manifest.counts) !==
      JSON.stringify({
        verses: canonical.verses.length,
        tokens: canonical.tokens.length,
        segments: canonical.segments.length,
        identities: canonical.segmentIdentities.length
      })
  ) {
    throw new Error("interlinear-publication-declaration-mismatch");
  }
  await assertSingleBoundedZipEntry(
    offlinePath,
    manifest.offlineArtifact.entry
  );
  const extractedDir = await mkdtemp(
    path.join(tmpdir(), "interlinear-publication-")
  );
  try {
    await execFileAsync("unzip", [
      "-qq",
      offlinePath,
      manifest.offlineArtifact.entry,
      "-d",
      extractedDir
    ]);
    const extracted = path.join(extractedDir, manifest.offlineArtifact.entry);
    if (
      !(await lstat(extracted)).isFile() ||
      (await sha256ResourcePublicationFile(extracted)) !==
        manifest.offlineArtifact.contentSha256
    ) {
      throw new Error("interlinear-publication-offline-content-mismatch");
    }
    const offlineCanonical = readCanonicalContent(extracted, {
      language: canonical.language,
      indexRevision: canonical.indexRevision,
      textRevision: canonical.textRevision,
      textSha256: canonical.textSha256
    });
    if (
      JSON.stringify(offlineCanonical) !==
      JSON.stringify({
        verses: canonical.verses,
        tokens: canonical.tokens,
        segments: canonical.segments,
        segmentIdentities: canonical.segmentIdentities
      })
    ) {
      throw new Error("interlinear-publication-offline-parity-mismatch");
    }
  } finally {
    await rm(extractedDir, { recursive: true, force: true });
  }
  return manifest;
}

async function assertSingleBoundedZipEntry(
  archivePath: string,
  expectedEntry: string
): Promise<void> {
  const { stdout: names } = await execFileAsync("unzip", ["-Z1", archivePath]);
  if (names.split(/\r?\n/u).filter(Boolean).join("\n") !== expectedEntry) {
    throw new Error("interlinear-publication-offline-entry-mismatch");
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
    !Number.isSafeInteger(Number(bytes)) ||
    Number(bytes) <= 0 ||
    Number(bytes) > MAX_SQLITE_BYTES
  ) {
    throw new Error("interlinear-publication-offline-size-invalid");
  }
}

export function deriveInterlinearBibleResourceRevision(
  canonical:
    | Omit<CanonicalInterlinearBiblePublication, "indexRevision">
    | CanonicalInterlinearBiblePublication
): string {
  const content = Object.fromEntries(
    Object.entries(canonical).filter(([key]) => key !== "indexRevision")
  );
  const digest = createHash("sha256")
    .update(JSON.stringify(normalizeJson(content)))
    .digest("hex");
  return `bhg-interlinear-${canonical.language}-${digest.slice(0, 20)}`;
}

function bindBibleDependency(
  sqlitePath: string,
  language: Locale,
  textRevision: string,
  textSha256: string
): { sourceVersion: string } {
  const database = new DatabaseSync(sqlitePath);
  try {
    const metadata = Object.fromEntries(
      database
        .prepare("SELECT key, value FROM ResourceMetadata")
        .all()
        .map((row) => [row.key, row.value])
    ) as Record<string, string>;
    if (
      metadata.schemaVersion !== "5" ||
      metadata.datasetId !== "STEP" ||
      metadata.locale !== language ||
      !isNonEmptyString(metadata.sourceVersion) ||
      database.prepare("PRAGMA integrity_check").get()?.integrity_check !==
        "ok" ||
      database.prepare("PRAGMA foreign_key_check").all().length !== 0
    ) {
      throw new Error("interlinear-source-invalid");
    }
    const update = database.prepare(
      "INSERT INTO ResourceMetadata(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
    );
    database.exec("BEGIN IMMEDIATE");
    update.run("applicationVersionId", "BHG");
    update.run("textRevision", textRevision);
    update.run("textSha256", textSha256);
    database.exec("COMMIT");
    database.exec("VACUUM");
    return { sourceVersion: metadata.sourceVersion };
  } finally {
    database.close();
  }
}

function bindIndexRevision(sqlitePath: string, indexRevision: string): void {
  const database = new DatabaseSync(sqlitePath);
  try {
    database
      .prepare(
        "INSERT INTO ResourceMetadata(key, value) VALUES ('indexRevision', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
      )
      .run(indexRevision);
    database.exec("VACUUM");
  } finally {
    database.close();
  }
}

function readCanonicalContent(
  sqlitePath: string,
  expected: {
    language: Locale;
    indexRevision?: string;
    textRevision: string;
    textSha256: string;
    bibleTexts?: BibleTextByLocation;
  }
) {
  const database = new DatabaseSync(sqlitePath, { readOnly: true });
  try {
    const metadata = Object.fromEntries(
      database
        .prepare("SELECT key, value FROM ResourceMetadata")
        .all()
        .map((row) => [row.key, row.value])
    ) as Record<string, string>;
    if (
      metadata.applicationVersionId !== "BHG" ||
      metadata.datasetId !== "STEP" ||
      metadata.locale !== expected.language ||
      metadata.schemaVersion !== "5" ||
      metadata.textRevision !== expected.textRevision ||
      metadata.textSha256 !== expected.textSha256 ||
      (expected.indexRevision !== undefined &&
        metadata.indexRevision !== expected.indexRevision)
    ) {
      throw new Error("interlinear-source-metadata-invalid");
    }
    if (
      database.prepare("PRAGMA integrity_check").get()?.integrity_check !==
        "ok" ||
      database.prepare("PRAGMA foreign_key_check").all().length !== 0
    ) {
      throw new Error("interlinear-source-integrity-invalid");
    }
    const verses = database
      .prepare(
        "SELECT id, bookOrder AS book, chapter, verse FROM Verses ORDER BY id"
      )
      .all() as CanonicalInterlinearBiblePublication["verses"];
    const tokens = database
      .prepare(
        "SELECT id, verseId, readingOrdinal AS ordinal, startOffset, length FROM Tokens ORDER BY id"
      )
      .all() as CanonicalInterlinearBiblePublication["tokens"];
    const segments = database
      .prepare(
        `SELECT s.id, s.tokenId, s.ordinal, s.startOffset, s.length,
                       tr.value AS transliteration, l.value AS lemma,
                       m.code AS morphology, g.text AS gloss
                  FROM Segments s
                  JOIN Transliterations tr ON tr.id=s.transliterationId
                  JOIN Lemmas l ON l.id=s.lemmaId
                  JOIN Morphologies m ON m.id=s.morphologyId
                  JOIN Glosses g ON g.id=s.glossId
                 ORDER BY s.id`
      )
      .all() as CanonicalInterlinearBiblePublication["segments"];
    const rows = database
      .prepare(
        `SELECT s.id AS segmentId,
                       c0.code AS strong, c1.code AS estrong,
                       c2.code AS dstrong, c3.code AS ustrong
                  FROM Segments s
                  LEFT JOIN StrongCodes c0 ON c0.id=s.strongCodeId
                  LEFT JOIN StrongCodes c1 ON c1.id=s.eStrongCodeId
                  LEFT JOIN StrongCodes c2 ON c2.id=s.dStrongCodeId
                  LEFT JOIN StrongCodes c3 ON c3.id=s.uStrongCodeId
                 ORDER BY s.id`
      )
      .all() as Array<Record<string, unknown> & { segmentId: number }>;
    const segmentIdentities = rows.flatMap((row) =>
      IDENTITY_KINDS.flatMap((kind, identityOrder) =>
        typeof row[kind] === "string"
          ? [
              {
                segmentId: row.segmentId,
                identityOrder,
                kind,
                code: row[kind] as string
              }
            ]
          : []
      )
    );
    const rawCounts = {
      verses: Number(
        (
          database.prepare("SELECT COUNT(*) AS count FROM Verses").get() as {
            count: number;
          }
        ).count
      ),
      tokens: Number(
        (
          database.prepare("SELECT COUNT(*) AS count FROM Tokens").get() as {
            count: number;
          }
        ).count
      ),
      segments: Number(
        (
          database.prepare("SELECT COUNT(*) AS count FROM Segments").get() as {
            count: number;
          }
        ).count
      ),
      identities: segmentIdentities.length
    };
    const declaredCounts = {
      verses: Number(metadata.verseCount),
      tokens: Number(metadata.tokenCount),
      segments: Number(metadata.segmentCount),
      identities: Number(metadata.identityCount)
    };
    if (
      JSON.stringify(rawCounts) !== JSON.stringify(declaredCounts) ||
      verses.length !== rawCounts.verses ||
      tokens.length !== rawCounts.tokens ||
      segments.length !== rawCounts.segments
    ) {
      throw new Error("interlinear-source-count-mismatch");
    }
    validateCanonicalGraph(
      { verses, tokens, segments, segmentIdentities },
      expected.bibleTexts
    );
    validateStrongVerseIndex(
      database,
      verses,
      tokens,
      segments,
      segmentIdentities
    );
    return { verses, tokens, segments, segmentIdentities };
  } finally {
    database.close();
  }
}

type CanonicalInterlinearContent = Pick<
  CanonicalInterlinearBiblePublication,
  "verses" | "tokens" | "segments" | "segmentIdentities"
>;

const isPositiveInteger = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) > 0;

function validateCanonicalGraph(
  content: CanonicalInterlinearContent,
  bibleTexts?: BibleTextByLocation
): void {
  if (
    content.verses.length === 0 ||
    content.tokens.length === 0 ||
    content.segments.length === 0 ||
    content.segmentIdentities.length === 0
  ) {
    throw new Error("interlinear-canonical-empty");
  }
  const verseIds = new Set<number>();
  const verseLocations = new Set<string>();
  const verseTextById = new Map<number, string>();
  for (const verse of content.verses) {
    if (
      !isPositiveInteger(verse.id) ||
      !isPositiveInteger(verse.book) ||
      !isPositiveInteger(verse.chapter) ||
      !isNonNegativeInteger(verse.verse) ||
      verseIds.has(verse.id)
    ) {
      throw new Error("interlinear-canonical-verse-invalid");
    }
    const location = `${verse.book}:${verse.chapter}:${verse.verse}`;
    if (verseLocations.has(location))
      throw new Error("interlinear-canonical-verse-duplicate");
    verseIds.add(verse.id);
    verseLocations.add(location);
    if (bibleTexts) {
      const text = bibleTexts.get(location);
      if (text === undefined)
        throw new Error("interlinear-bible-coverage-mismatch");
      verseTextById.set(verse.id, text);
    }
  }
  if (bibleTexts && bibleTexts.size !== verseLocations.size)
    throw new Error("interlinear-bible-coverage-mismatch");

  const tokenIds = new Set<number>();
  const tokenOrdinals = new Set<string>();
  const tokenById = new Map<
    number,
    CanonicalInterlinearBiblePublication["tokens"][number]
  >();
  for (const token of content.tokens) {
    if (
      !isPositiveInteger(token.id) ||
      !verseIds.has(token.verseId) ||
      !isNonNegativeInteger(token.ordinal) ||
      !isNonNegativeInteger(token.startOffset) ||
      !isNonNegativeInteger(token.length) ||
      (bibleTexts &&
        token.startOffset + token.length >
          (verseTextById.get(token.verseId)?.length ?? -1)) ||
      tokenIds.has(token.id)
    ) {
      throw new Error("interlinear-canonical-token-invalid");
    }
    const ordinal = `${token.verseId}:${token.ordinal}`;
    if (tokenOrdinals.has(ordinal))
      throw new Error("interlinear-canonical-token-duplicate");
    tokenIds.add(token.id);
    tokenOrdinals.add(ordinal);
    tokenById.set(token.id, token);
  }

  const segmentIds = new Set<number>();
  const segmentOrdinals = new Set<string>();
  const segmentById = new Map<
    number,
    CanonicalInterlinearBiblePublication["segments"][number]
  >();
  for (const segment of content.segments) {
    const token = tokenById.get(segment.tokenId);
    if (
      !isPositiveInteger(segment.id) ||
      !token ||
      !isNonNegativeInteger(segment.ordinal) ||
      !isNonNegativeInteger(segment.startOffset) ||
      !isNonNegativeInteger(segment.length) ||
      segment.startOffset + segment.length > token.length ||
      !isNonEmptyString(segment.transliteration) ||
      typeof segment.lemma !== "string" ||
      typeof segment.morphology !== "string" ||
      typeof segment.gloss !== "string" ||
      segmentIds.has(segment.id)
    ) {
      throw new Error("interlinear-canonical-segment-invalid");
    }
    const ordinal = `${segment.tokenId}:${segment.ordinal}`;
    if (segmentOrdinals.has(ordinal))
      throw new Error("interlinear-canonical-segment-duplicate");
    segmentIds.add(segment.id);
    segmentOrdinals.add(ordinal);
    segmentById.set(segment.id, segment);
  }

  const identities = new Set<string>();
  for (const identity of content.segmentIdentities) {
    if (
      !segmentById.has(identity.segmentId) ||
      !isNonNegativeInteger(identity.identityOrder) ||
      IDENTITY_KINDS[identity.identityOrder] !== identity.kind ||
      !IDENTITY_KINDS.includes(identity.kind) ||
      !isNonEmptyString(identity.code)
    ) {
      throw new Error("interlinear-canonical-identity-invalid");
    }
    const key = `${identity.segmentId}:${identity.kind}`;
    if (identities.has(key))
      throw new Error("interlinear-canonical-identity-duplicate");
    identities.add(key);
  }
}

function decodeBibleTexts(value: Record<string, unknown>): BibleTextByLocation {
  const texts = new Map<string, string>();
  for (const [bookKey, chaptersValue] of Object.entries(value)) {
    if (!/^[1-9]\d*$/u.test(bookKey) || !isRecord(chaptersValue))
      throw new Error("interlinear-bible-dependency-invalid");
    for (const [chapterKey, versesValue] of Object.entries(chaptersValue)) {
      if (!/^[1-9]\d*$/u.test(chapterKey) || !isRecord(versesValue))
        throw new Error("interlinear-bible-dependency-invalid");
      for (const [verseKey, verseValue] of Object.entries(versesValue)) {
        if (
          !/^(?:0|[1-9]\d*)$/u.test(verseKey) ||
          !isRecord(verseValue) ||
          typeof verseValue.text !== "string"
        ) {
          throw new Error("interlinear-bible-dependency-invalid");
        }
        texts.set(`${bookKey}:${chapterKey}:${verseKey}`, verseValue.text);
      }
    }
  }
  if (texts.size === 0) throw new Error("interlinear-bible-dependency-invalid");
  return texts;
}

function validateStrongVerseIndex(
  database: DatabaseSync,
  verses: CanonicalInterlinearBiblePublication["verses"],
  tokens: CanonicalInterlinearBiblePublication["tokens"],
  segments: CanonicalInterlinearBiblePublication["segments"],
  identities: CanonicalInterlinearBiblePublication["segmentIdentities"]
): void {
  const verseByToken = new Map(
    tokens.map((token) => [token.id, token.verseId])
  );
  const tokenBySegment = new Map(
    segments.map((segment) => [segment.id, segment.tokenId])
  );
  const verseIds = new Set(verses.map((verse) => verse.id));
  const expected = new Map<string, number>();
  for (const identity of identities) {
    const verseId = verseByToken.get(
      tokenBySegment.get(identity.segmentId) ?? -1
    );
    if (!verseId || !verseIds.has(verseId))
      throw new Error("interlinear-strong-index-reference-invalid");
    const key = `${verseId}:${identity.code}`;
    expected.set(key, (expected.get(key) ?? 0) | (1 << identity.identityOrder));
  }
  const actualRows = database
    .prepare(
      `SELECT svi.verseId AS verseId, sc.code AS code, svi.kindMask AS kindMask
         FROM StrongVerseIndex svi
         JOIN StrongCodes sc ON sc.id=svi.codeId
        ORDER BY svi.verseId, sc.code`
    )
    .all() as Array<{ verseId: number; code: string; kindMask: number }>;
  const actual = new Map(
    actualRows.map((row) => [`${row.verseId}:${row.code}`, row.kindMask])
  );
  if (
    actualRows.length !== actual.size ||
    actual.size !== expected.size ||
    [...expected].some(([key, kindMask]) => actual.get(key) !== kindMask)
  ) {
    throw new Error("interlinear-strong-index-parity-mismatch");
  }
}

function decodeCanonical(value: unknown): CanonicalInterlinearBiblePublication {
  if (!isRecord(value)) throw new Error("interlinear-canonical-invalid");
  if (
    value.format !== "bible-strong-canonical-interlinear-index" ||
    value.schemaVersion !== 1 ||
    value.applicationVersionId !== "BHG" ||
    value.datasetId !== "STEP" ||
    (value.language !== "fr" && value.language !== "en") ||
    !isNonEmptyString(value.indexRevision) ||
    !isNonEmptyString(value.textRevision) ||
    !isSha256(value.textSha256) ||
    !Array.isArray(value.verses) ||
    !Array.isArray(value.tokens) ||
    !Array.isArray(value.segments) ||
    !Array.isArray(value.segmentIdentities)
  ) {
    throw new Error("interlinear-canonical-invalid");
  }
  const canonical = value as unknown as CanonicalInterlinearBiblePublication;
  validateCanonicalGraph(canonical);
  return canonical;
}

function decodeManifest(value: unknown): InterlinearBiblePublicationManifest {
  if (!isRecord(value)) throw new Error("interlinear-manifest-invalid");
  const identity = value.identity;
  const dependencies = value.dependencies;
  const counts = value.counts;
  if (
    !isRecord(identity) ||
    identity.kind !== "interlinear-index" ||
    identity.versionId !== "BHG" ||
    identity.datasetId !== "STEP" ||
    (identity.language !== "fr" && identity.language !== "en") ||
    !isRecord(dependencies) ||
    !isRecord(dependencies.bible) ||
    dependencies.bible.resourceIdentity !== "bible-text:BHG" ||
    !isNonEmptyString(dependencies.bible.revision) ||
    !isSha256(dependencies.bible.textSha256) ||
    dependencies.bible.online !== "required" ||
    dependencies.bible.offline !== "required" ||
    !Array.isArray(dependencies.strongLexiconModules) ||
    dependencies.strongLexiconModules.length !== 1 ||
    !isRecord(dependencies.strongLexiconModules[0]) ||
    dependencies.strongLexiconModules[0].resourceIdentity !==
      "strong-lexicon:core" ||
    dependencies.strongLexiconModules[0].online !==
      "required-for-lexical-details" ||
    dependencies.strongLexiconModules[0].offline !==
      "required-for-lexical-details" ||
    !isRecord(value.canonical) ||
    value.canonical.schemaVersion !== 1 ||
    !isRecord(counts) ||
    !isNonNegativeInteger(counts.verses) ||
    !isNonNegativeInteger(counts.tokens) ||
    !isNonNegativeInteger(counts.segments) ||
    !isNonNegativeInteger(counts.identities)
  ) {
    throw new Error("interlinear-manifest-invalid");
  }
  return value as unknown as InterlinearBiblePublicationManifest;
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

async function buildAllFromCli() {
  const args = new Map<string, string>();
  for (let index = 2; index < process.argv.length; index += 2) {
    const key = process.argv[index];
    const value = process.argv[index + 1];
    if (!key?.startsWith("--") || !value)
      throw new Error("interlinear-cli-invalid");
    if (args.has(key.slice(2)))
      throw new Error(`interlinear-cli-duplicate:${key}`);
    args.set(key.slice(2), value);
  }
  const allowed = new Set([
    "fr-sqlite",
    "en-sqlite",
    "bible-bundle",
    "output-dir",
    "generated-at"
  ]);
  for (const key of args.keys())
    if (!allowed.has(key)) throw new Error(`interlinear-cli-unknown:${key}`);
  const root = path.resolve(
    args.get("output-dir") ?? "outputs/releases/interlinear-bible-publications"
  );
  if (existsSync(root))
    throw new Error(`interlinear-output-already-exists:${root}`);
  const stagingRoot = `${root}.tmp-${process.pid}-${randomUUID()}`;
  const bibleBundle =
    args.get("bible-bundle") ??
    "outputs/releases/ordinary-bible-publications-issue-302-v5/bhg";
  const common = {
    bibleBundleDir: bibleBundle,
    attribution:
      "Données créées par STEPBible.org à partir des travaux de Tyndale House Cambridge",
    rightsReviewedAt: "2026-08-16",
    generatedAt: args.get("generated-at")
  };
  try {
    const publications = [];
    for (const language of ["fr", "en"] as const) {
      publications.push(
        await buildInterlinearBibleResourcePublication({
          ...common,
          language,
          sqlitePath:
            args.get(`${language}-sqlite`) ??
            `outputs/releases/bible-step-interlinear-runtime-v5/bible-step-interlinear-${language}.sqlite`,
          outputDir: path.join(stagingRoot, language)
        })
      );
    }
    const [french, english] = await Promise.all(
      publications.map(async (publication) =>
        decodeCanonical(
          JSON.parse(
            await readFile(
              path.join(
                publication.outputDir,
                publication.manifest.canonical.path
              ),
              "utf8"
            )
          )
        )
      )
    );
    assertSharedInterlinearStructure(french!, english!);
    await mkdir(path.dirname(root), { recursive: true });
    await rename(stagingRoot, root);
  } catch (error) {
    await rm(stagingRoot, { recursive: true, force: true });
    throw error;
  }
}

export function assertSharedInterlinearStructure(
  french: CanonicalInterlinearBiblePublication,
  english: CanonicalInterlinearBiblePublication
): void {
  const shared = (canonical: CanonicalInterlinearBiblePublication) => ({
    applicationVersionId: canonical.applicationVersionId,
    datasetId: canonical.datasetId,
    textRevision: canonical.textRevision,
    textSha256: canonical.textSha256,
    verses: canonical.verses,
    tokens: canonical.tokens,
    segments: canonical.segments.map((segment) => ({
      id: segment.id,
      tokenId: segment.tokenId,
      ordinal: segment.ordinal,
      startOffset: segment.startOffset,
      length: segment.length,
      transliteration: segment.transliteration,
      lemma: segment.lemma,
      morphology: segment.morphology
    })),
    segmentIdentities: canonical.segmentIdentities
  });
  if (JSON.stringify(shared(french)) !== JSON.stringify(shared(english))) {
    throw new Error("interlinear-publication-locale-structure-mismatch");
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildAllFromCli().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
