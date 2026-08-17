import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import {
  copyFile,
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

const execFileAsync = promisify(execFile);
const ZIP_TIME = new Date("1980-01-01T00:00:00.000Z");
const IDENTITY_KINDS = ["strong", "estrong", "dstrong", "ustrong"] as const;
type Locale = "fr" | "en";

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
  const bibleCanonical = JSON.parse(
    await readFile(
      path.join(
        path.resolve(options.bibleBundleDir),
        bibleManifest.canonical.path
      ),
      "utf8"
    )
  ) as { textRevision?: unknown; textSha256?: unknown };
  if (
    !isNonEmptyString(bibleCanonical.textRevision) ||
    !isSha256(bibleCanonical.textSha256)
  ) {
    throw new Error("interlinear-bible-dependency-invalid");
  }

  const temporaryDir = `${outputDir}.tmp-${process.pid}-${randomUUID()}`;
  const workDir = path.join(temporaryDir, "work");
  const entry = `bible-step-interlinear-${options.language}.sqlite`;
  const normalizedSqlite = path.join(workDir, entry);
  const canonicalRelative = `canonical/bible-bhg-interlinear-${options.language}.json`;
  const offlineRelative = `offline/${entry}.zip`;
  const canonicalPath = path.join(temporaryDir, canonicalRelative);
  const offlinePath = path.join(temporaryDir, offlineRelative);

  try {
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
    const content = readCanonicalContent(normalizedSqlite, options.language);
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
    const revision = deriveInterlinearBibleResourceRevision(withoutRevision);
    const canonical: CanonicalInterlinearBiblePublication = {
      ...withoutRevision,
      indexRevision: revision
    };
    await writeFile(canonicalPath, `${JSON.stringify(canonical)}\n`, "utf8");
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
    await validateInterlinearBibleResourcePublication(temporaryDir);
    await mkdir(path.dirname(outputDir), { recursive: true });
    await rename(temporaryDir, outputDir);
    return { outputDir, manifest };
  } catch (error) {
    await rm(temporaryDir, { recursive: true, force: true });
    throw error;
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
  const entries = (await execFileAsync("unzip", ["-Z1", offlinePath])).stdout
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean);
  if (entries.length !== 1 || entries[0] !== manifest.offlineArtifact.entry) {
    throw new Error("interlinear-publication-offline-entry-mismatch");
  }
  const extractedDir = await mkdtemp(
    path.join(tmpdir(), "interlinear-publication-")
  );
  try {
    await execFileAsync("unzip", ["-q", offlinePath, "-d", extractedDir]);
    const extracted = path.join(extractedDir, manifest.offlineArtifact.entry);
    if (
      (await sha256ResourcePublicationFile(extracted)) !==
      manifest.offlineArtifact.contentSha256
    ) {
      throw new Error("interlinear-publication-offline-content-mismatch");
    }
    const offlineCanonical = readCanonicalContent(
      extracted,
      canonical.language
    );
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

export function deriveInterlinearBibleResourceRevision(
  canonical:
    | Omit<CanonicalInterlinearBiblePublication, "indexRevision">
    | CanonicalInterlinearBiblePublication
): string {
  const { indexRevision: _ignored, ...content } =
    canonical as CanonicalInterlinearBiblePublication;
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
      database.prepare("PRAGMA integrity_check").get()?.integrity_check !== "ok"
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

function readCanonicalContent(sqlitePath: string, language: Locale) {
  const database = new DatabaseSync(sqlitePath, { readOnly: true });
  try {
    const metadata = Object.fromEntries(
      database
        .prepare("SELECT key, value FROM ResourceMetadata")
        .all()
        .map((row) => [row.key, row.value])
    ) as Record<string, string>;
    if (metadata.locale !== language || metadata.schemaVersion !== "5") {
      throw new Error("interlinear-source-metadata-invalid");
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
    return { verses, tokens, segments, segmentIdentities };
  } finally {
    database.close();
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
  return value as unknown as CanonicalInterlinearBiblePublication;
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
  const root =
    args.get("output-dir") ?? "outputs/releases/interlinear-bible-publications";
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
  for (const language of ["fr", "en"] as const) {
    await buildInterlinearBibleResourcePublication({
      ...common,
      language,
      sqlitePath:
        args.get(`${language}-sqlite`) ??
        `outputs/releases/bible-step-interlinear-runtime-v5/bible-step-interlinear-${language}.sqlite`,
      outputDir: path.join(root, language)
    });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildAllFromCli().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
