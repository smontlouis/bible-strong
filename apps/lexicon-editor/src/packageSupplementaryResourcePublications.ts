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
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
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
  sha256ResourcePublicationFile
} from "./resourcePublicationEnvelope.js";

const execFileAsync = promisify(execFile);

export type SupplementaryResourceId = "MHY" | "TRESOR";
export type SupplementaryResourceKind = "commentary" | "cross-references";

export interface SupplementaryPublicationMetadata {
  resourceId: SupplementaryResourceId;
  sourceVersion: string;
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
}

export type CanonicalCommentaryPublication = {
  format: "bible-strong-canonical-commentary";
  schemaVersion: 1;
  resourceId: "MHY";
  language: "fr";
  revision: string;
  sourceVersion: string;
  sourceSha256: string;
  verses: Array<{ verseKey: string; content: string }>;
};

export type CanonicalCrossReferencePublication = {
  format: "bible-strong-canonical-cross-references";
  schemaVersion: 1;
  resourceId: "TRESOR";
  language: "fr";
  revision: string;
  sourceVersion: string;
  sourceSha256: string;
  verseAnchors: Array<{ verseKey: string; references: string[] }>;
};

export type SupplementaryCanonicalPublication =
  | CanonicalCommentaryPublication
  | CanonicalCrossReferencePublication;

type SupplementaryCanonicalContent =
  | Omit<CanonicalCommentaryPublication, "revision" | "sourceVersion" | "sourceSha256">
  | Omit<CanonicalCrossReferencePublication, "revision" | "sourceVersion" | "sourceSha256">;

type PartialSupplementaryCanonicalPublication = {
  format?: CanonicalCommentaryPublication["format"] | CanonicalCrossReferencePublication["format"];
  schemaVersion?: number;
  resourceId?: SupplementaryResourceId;
  language?: string;
  revision?: string;
  sourceVersion?: string;
  sourceSha256?: string;
  verses?: CanonicalCommentaryPublication["verses"];
  verseAnchors?: CanonicalCrossReferencePublication["verseAnchors"];
};

export type SupplementaryResourcePublicationManifest = {
  format: "bible-strong-resource-publication";
  schemaVersion: 1;
  identity: {
    kind: SupplementaryResourceKind;
    resourceId: SupplementaryResourceId;
    language: "fr";
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
    entry: "commentaires-mhy.sqlite" | "commentaires-tresor.sqlite";
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
  rights: SupplementaryPublicationMetadata["rights"];
  deliveryCapabilities: SupplementaryPublicationMetadata["deliveryCapabilities"];
  counts:
    | { chapters: number; verses: number; characters: number }
    | { verseAnchors: number; references: number };
};

type SqliteRow = { id: string; commentaires: string };
type BuildOptions = SupplementaryPublicationMetadata & {
  sqlitePath: string;
  outputDir: string;
  generatedAt?: string;
};

const configFor = (resourceId: SupplementaryResourceId) =>
  resourceId === "MHY"
    ? {
        kind: "commentary" as const,
        entry: "commentaires-mhy.sqlite" as const,
        stem: "mhy-fr",
        resourceIdentity: "commentary:MHY:fr"
      }
    : {
        kind: "cross-references" as const,
        entry: "commentaires-tresor.sqlite" as const,
        stem: "tresor-fr",
        resourceIdentity: "cross-references:fr"
      };

const sha256Buffer = (value: Buffer): string =>
  createHash("sha256").update(value).digest("hex");

const sha256File = (filePath: string): Promise<string> =>
  sha256ResourcePublicationFile(filePath);

const queryJson = async <T>(sqlitePath: string, query: string): Promise<T[]> => {
  try {
    const { stdout } = await execFileAsync("sqlite3", ["-json", sqlitePath, query], {
      maxBuffer: 512 * 1024 * 1024
    });
    return JSON.parse(stdout || "[]") as T[];
  } catch (cause) {
    throw new Error("supplementary-publication-sqlite-invalid", { cause });
  }
};

const verseKey = (value: string): boolean =>
  /^[1-9]\d*-[1-9]\d*(?:-(?:0|[1-9]\d*))?$/.test(value);

const parseVerse = (value: string): [number, number, number] =>
  value.split("-").map(Number) as [number, number, number];

const readSqlite = async (
  sqlitePath: string,
  resourceId: SupplementaryResourceId
): Promise<{
  canonical: SupplementaryCanonicalContent;
  counts: SupplementaryResourcePublicationManifest["counts"];
}> => {
  const integrity = await queryJson<{ integrity_check: string }>(
    sqlitePath,
    "PRAGMA integrity_check"
  );
  if (integrity.length !== 1 || integrity[0]?.integrity_check?.toLowerCase() !== "ok") {
    throw new Error("supplementary-publication-sqlite-integrity-invalid");
  }
  const tables = await queryJson<{ name: string }>(
    sqlitePath,
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );
  const tableNames = tables.map(row => row.name);
  if (
    JSON.stringify(tableNames) !== JSON.stringify(["COMMENTAIRES"]) &&
    JSON.stringify(tableNames) !== JSON.stringify(["COMMENTAIRES", "RESOURCE_METADATA"])
  ) {
    throw new Error("supplementary-publication-sqlite-tables-invalid");
  }
  const rows = await queryJson<SqliteRow>(
    sqlitePath,
    "SELECT id, commentaires FROM COMMENTAIRES ORDER BY id"
  );
  if (rows.length === 0) throw new Error("supplementary-publication-empty");

  if (resourceId === "MHY") {
    const verses: Array<{ verseKey: string; content: string }> = [];
    const chapterKeys = new Set<string>();
    let characters = 0;
    for (const row of rows) {
      if (!/^([1-9]\d*)-([1-9]\d*)$/.test(row.id)) {
        throw new Error("supplementary-publication-commentary-chapter-invalid");
      }
      chapterKeys.add(row.id);
      let decoded: unknown;
      try {
        decoded = JSON.parse(row.commentaires);
      } catch (cause) {
        throw new Error("supplementary-publication-commentary-json-invalid", { cause });
      }
      if (!isRecord(decoded)) throw new Error("supplementary-publication-commentary-json-invalid");
      for (const [number, value] of Object.entries(decoded)) {
        if (!/^(?:0|[1-9]\d*)$/.test(number) || typeof value !== "string") {
          throw new Error("supplementary-publication-commentary-verse-invalid");
        }
        if (!value.trim()) continue;
        const key = `${row.id}-${number}`;
        verses.push({ verseKey: key, content: value });
        characters += value.length;
      }
    }
    verses.sort((left, right) =>
      parseVerse(left.verseKey).join("-").localeCompare(parseVerse(right.verseKey).join("-"), undefined, {
        numeric: true
      })
    );
    return {
      canonical: {
        format: "bible-strong-canonical-commentary",
        schemaVersion: 1,
        resourceId: "MHY",
        language: "fr",
        verses
      },
      counts: { chapters: chapterKeys.size, verses: verses.length, characters }
    };
  }

  const anchors = rows.flatMap(row => {
    if (!verseKey(row.id)) throw new Error("supplementary-publication-cross-reference-key-invalid");
    let decoded: unknown;
    try {
      decoded = JSON.parse(row.commentaires);
    } catch (cause) {
      throw new Error("supplementary-publication-cross-reference-json-invalid", { cause });
    }
    if (!Array.isArray(decoded) || decoded.some(value => typeof value !== "string")) {
      throw new Error("supplementary-publication-cross-reference-list-invalid");
    }
    const references = (decoded as string[]).map(value => value.trim()).filter(Boolean);
    if (references.length === 0) return [];
    return [{ verseKey: row.id, references }];
  });
  if (anchors.length === 0) throw new Error("supplementary-publication-empty");
  return {
    canonical: {
      format: "bible-strong-canonical-cross-references",
      schemaVersion: 1,
      resourceId: "TRESOR",
      language: "fr",
      verseAnchors: anchors
    },
    counts: {
      verseAnchors: anchors.length,
      references: anchors.reduce((total, anchor) => total + anchor.references.length, 0)
    }
  };
};

const validateMetadata = (metadata: SupplementaryPublicationMetadata) => {
  for (const [label, value] of [
    ["source-version", metadata.sourceVersion],
    ["rights-holder", metadata.rights.holder],
    ["terms-reference", metadata.rights.termsReference],
    ["attribution", metadata.rights.attribution]
  ] as const) {
    if (!value.trim()) throw new Error(`supplementary-publication-${label}-missing`);
  }
  if (
    (metadata.deliveryCapabilities.onlineAccess && !metadata.rights.online) ||
    (metadata.deliveryCapabilities.offlineDownload && !metadata.rights.offline)
  ) {
    throw new Error("supplementary-publication-rights-mismatch");
  }
};

const writeMetadata = async (sqlitePath: string, canonical: SupplementaryCanonicalPublication) => {
  const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
  await execFileAsync("sqlite3", [
    sqlitePath,
    `BEGIN IMMEDIATE;
     DROP TABLE IF EXISTS RESOURCE_METADATA;
     CREATE TABLE RESOURCE_METADATA (
       resource_id TEXT NOT NULL,
       language TEXT NOT NULL,
       revision TEXT NOT NULL,
       source_version TEXT NOT NULL,
       source_sha256 TEXT NOT NULL
     );
     INSERT INTO RESOURCE_METADATA VALUES (
       ${quote(canonical.resourceId)}, ${quote(canonical.language)},
       ${quote(canonical.revision)}, ${quote(canonical.sourceVersion)}, ${quote(canonical.sourceSha256)}
     );
     COMMIT;`
  ]);
};

const assertSingleZipEntry = async (
  archivePath: string,
  entry: string
): Promise<void> => {
  const { stdout } = await execFileAsync("unzip", ["-Z1", archivePath]);
  const entries = stdout.split(/\r?\n/u).filter(Boolean);
  if (entries.length !== 1 || entries[0] !== entry) {
    throw new Error("supplementary-publication-offline-entry-invalid");
  }
};

const deriveRevision = (canonical: SupplementaryCanonicalPublication): string =>
  `${canonical.resourceId.toLowerCase()}-${sha256Buffer(
    Buffer.from(
      JSON.stringify(
        canonical.resourceId === "MHY"
          ? { verses: canonical.verses }
          : { verseAnchors: canonical.verseAnchors }
      ),
      "utf8"
    )
  ).slice(0, 20)}`;

export async function buildSupplementaryResourcePublication(
  options: BuildOptions
): Promise<{
  outputDir: string;
  manifest: SupplementaryResourcePublicationManifest;
}> {
  const resource = configFor(options.resourceId);
  const sourceSqlitePath = path.resolve(options.sqlitePath);
  const outputDir = path.resolve(options.outputDir);
  if (!existsSync(sourceSqlitePath)) throw new Error("supplementary-publication-source-missing");
  if (existsSync(outputDir)) throw new Error("supplementary-publication-output-exists");
  validateMetadata(options);
  const sourceSha256 = await sha256File(sourceSqlitePath);
  const source = await readSqlite(sourceSqlitePath, options.resourceId);
  const base = {
    ...source.canonical,
    revision: "",
    sourceVersion: options.sourceVersion,
    sourceSha256
  } as SupplementaryCanonicalPublication;
  base.revision = deriveRevision(base);
  const canonical = base;
  const temporaryDir = `${outputDir}.tmp-${process.pid}-${randomUUID()}`;
  const canonicalRelativePath = `canonical/${resource.stem}.json`;
  const offlineRelativePath = `offline/${resource.entry}.zip`;
  const canonicalPath = path.join(temporaryDir, canonicalRelativePath);
  const normalizedSqlitePath = path.join(temporaryDir, `work/${resource.entry}`);
  const offlineArtifactPath = path.join(temporaryDir, offlineRelativePath);
  try {
    await mkdir(path.dirname(normalizedSqlitePath), { recursive: true });
    await copyFile(sourceSqlitePath, normalizedSqlitePath);
    await writeMetadata(normalizedSqlitePath, canonical);
    await mkdir(path.dirname(canonicalPath), { recursive: true });
    await writeFile(canonicalPath, `${JSON.stringify(canonical)}\n`, "utf8");
    await mkdir(path.dirname(offlineArtifactPath), { recursive: true });
    await execFileAsync("zip", ["-q", "-X", "-j", offlineArtifactPath, normalizedSqlitePath]);
    const canonicalStats = await stat(canonicalPath);
    const archiveStats = await stat(offlineArtifactPath);
    const manifest: SupplementaryResourcePublicationManifest = {
      format: "bible-strong-resource-publication",
      schemaVersion: 1,
      identity: { kind: resource.kind, resourceId: options.resourceId, language: "fr" },
      revision: canonical.revision,
      canonical: {
        path: canonicalRelativePath,
        mediaType: "application/json",
        schemaVersion: 1,
        sha256: await sha256File(canonicalPath),
        bytes: canonicalStats.size
      },
      offlineArtifact: {
        path: offlineRelativePath,
        mediaType: "application/zip",
        entry: resource.entry,
        sha256: await sha256File(offlineArtifactPath),
        bytes: archiveStats.size,
        contentSha256: await sha256File(normalizedSqlitePath)
      },
      provenance: {
        generator: "bible-lexicon-maker",
        sourceVersion: options.sourceVersion,
        sourceSha256,
        generatedAt: options.generatedAt ?? new Date().toISOString()
      },
      rights: options.rights,
      deliveryCapabilities: options.deliveryCapabilities,
      counts: source.counts
    };
    await writeFile(path.join(temporaryDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    await validateSupplementaryResourcePublication(temporaryDir);
    await mkdir(path.dirname(outputDir), { recursive: true });
    await rename(temporaryDir, outputDir);
    return { outputDir, manifest };
  } catch (error) {
    await rm(temporaryDir, { recursive: true, force: true });
    throw error;
  }
}

export async function buildAllSupplementaryResourcePublications(options: {
  mhySqlitePath: string;
  tresorSqlitePath: string;
  outputDir: string;
  mhyMetadata: Omit<SupplementaryPublicationMetadata, "resourceId">;
  tresorMetadata: Omit<SupplementaryPublicationMetadata, "resourceId">;
  generatedAt?: string;
}) {
  const root = path.resolve(options.outputDir);
  if (existsSync(root)) throw new Error("supplementary-publication-output-exists");
  const staging = await mkdtemp(path.join(tmpdir(), "supplementary-publications-"));
  try {
    const fr = await buildSupplementaryResourcePublication({
      ...options.mhyMetadata,
      resourceId: "MHY",
      sqlitePath: options.mhySqlitePath,
      outputDir: path.join(staging, "mhy-fr"),
      generatedAt: options.generatedAt
    });
    const tresor = await buildSupplementaryResourcePublication({
      ...options.tresorMetadata,
      resourceId: "TRESOR",
      sqlitePath: options.tresorSqlitePath,
      outputDir: path.join(staging, "tresor-fr"),
      generatedAt: options.generatedAt
    });
    await mkdir(path.dirname(root), { recursive: true });
    await rename(staging, root);
    return [fr.manifest, tresor.manifest];
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}

const decodeCanonical = (value: unknown): SupplementaryCanonicalPublication => {
  if (!isRecord(value) || (value.format !== "bible-strong-canonical-commentary" && value.format !== "bible-strong-canonical-cross-references")) {
    throw new Error("supplementary-publication-canonical-invalid");
  }
  const candidate = value as PartialSupplementaryCanonicalPublication;
  if (
    candidate.schemaVersion !== 1 ||
    (candidate.resourceId !== "MHY" && candidate.resourceId !== "TRESOR") ||
    candidate.language !== "fr" ||
    !isNonEmptyString(candidate.revision) ||
    !isNonEmptyString(candidate.sourceVersion) ||
    !isSha256(candidate.sourceSha256)
  ) throw new Error("supplementary-publication-canonical-invalid");
  if (candidate.resourceId === "MHY") {
    if (!Array.isArray(candidate.verses) || candidate.verses.length === 0) throw new Error("supplementary-publication-canonical-invalid");
    const keys = new Set<string>();
    for (const verse of candidate.verses) {
      if (!isRecord(verse) || !isNonEmptyString(verse.verseKey) || !verseKey(verse.verseKey) || typeof verse.content !== "string" || !verse.content.trim() || keys.has(verse.verseKey)) throw new Error("supplementary-publication-canonical-verse-invalid");
      keys.add(verse.verseKey);
    }
  } else {
    if (!Array.isArray(candidate.verseAnchors) || candidate.verseAnchors.length === 0) throw new Error("supplementary-publication-canonical-invalid");
    const keys = new Set<string>();
    for (const anchor of candidate.verseAnchors) {
      if (!isRecord(anchor) || !isNonEmptyString(anchor.verseKey) || !verseKey(anchor.verseKey) || !Array.isArray(anchor.references) || anchor.references.length === 0 || anchor.references.some(reference => typeof reference !== "string" || !reference.trim()) || keys.has(anchor.verseKey)) throw new Error("supplementary-publication-canonical-anchor-invalid");
      keys.add(anchor.verseKey);
    }
  }
  return candidate as SupplementaryCanonicalPublication;
};

const decodeManifest = (value: unknown): SupplementaryResourcePublicationManifest => {
  const envelope = decodeResourcePublicationEnvelope(value);
  const candidate = value as Partial<SupplementaryResourcePublicationManifest>;
  if (!isRecord(candidate.identity) || candidate.identity.language !== "fr" ||
      (candidate.identity.resourceId !== "MHY" && candidate.identity.resourceId !== "TRESOR") ||
      (candidate.identity.kind !== "commentary" && candidate.identity.kind !== "cross-references") ||
      envelope.canonical.schemaVersion !== 1 ||
      (candidate.identity.resourceId === "MHY" && (candidate.identity.kind !== "commentary" || envelope.offlineArtifact.entry !== "commentaires-mhy.sqlite")) ||
      (candidate.identity.resourceId === "TRESOR" && (candidate.identity.kind !== "cross-references" || envelope.offlineArtifact.entry !== "commentaires-tresor.sqlite")) ||
      !isRecord(candidate.counts) || Object.values(candidate.counts).some(count => !isNonNegativeInteger(count))) {
    throw new Error("supplementary-publication-manifest-invalid");
  }
  return candidate as SupplementaryResourcePublicationManifest;
};

export async function validateSupplementaryResourcePublication(bundleDir: string): Promise<SupplementaryResourcePublicationManifest> {
  const root = path.resolve(bundleDir);
  const manifest = decodeManifest(JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8")));
  const canonicalPath = resolveResourcePublicationPath(root, manifest.canonical.path);
  const archivePath = resolveResourcePublicationPath(root, manifest.offlineArtifact.path);
  await assertResourcePublicationArtifact(canonicalPath, manifest.canonical, "canonical", root);
  await assertResourcePublicationArtifact(archivePath, manifest.offlineArtifact, "offline", root);
  const canonical = decodeCanonical(JSON.parse(await readFile(canonicalPath, "utf8")));
  if (canonical.resourceId !== manifest.identity.resourceId || canonical.revision !== manifest.revision || canonical.revision !== deriveRevision(canonical) || canonical.sourceVersion !== manifest.provenance.sourceVersion || canonical.sourceSha256 !== manifest.provenance.sourceSha256) throw new Error("supplementary-publication-declaration-mismatch");
  const extracted = await mkdtemp(path.join(tmpdir(), "supplementary-publication-validate-"));
  try {
    await assertSingleZipEntry(archivePath, manifest.offlineArtifact.entry);
    await execFileAsync("unzip", ["-qq", archivePath, manifest.offlineArtifact.entry, "-d", extracted]);
    const sqlitePath = path.join(extracted, manifest.offlineArtifact.entry);
    if (!(await lstat(sqlitePath)).isFile() || await sha256File(sqlitePath) !== manifest.offlineArtifact.contentSha256) throw new Error("supplementary-publication-offline-content-mismatch");
    const offline = await readSqlite(sqlitePath, canonical.resourceId);
    if (JSON.stringify(offline.canonical) !== JSON.stringify(({ ...canonical, revision: undefined, sourceVersion: undefined, sourceSha256: undefined } as Record<string, unknown>))) throw new Error("supplementary-publication-offline-content-mismatch");
    const metadataRows = await queryJson<{ resource_id: string; language: string; revision: string; source_version: string; source_sha256: string }>(sqlitePath, "SELECT resource_id, language, revision, source_version, source_sha256 FROM RESOURCE_METADATA");
    const metadata = metadataRows[0];
    if (metadataRows.length !== 1 || metadata?.resource_id !== canonical.resourceId || metadata.language !== canonical.language || metadata.revision !== canonical.revision || metadata.source_version !== canonical.sourceVersion || metadata.source_sha256 !== canonical.sourceSha256) throw new Error("supplementary-publication-offline-metadata-mismatch");
  } finally {
    await rm(extracted, { recursive: true, force: true });
  }
  return manifest;
}

const parseCliArgs = (args: readonly string[]) => {
  const result: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith("--") || !value || value.startsWith("--") || result[key]) throw new Error(`supplementary-publication-cli-argument-invalid:${key ?? ""}`);
    result[key] = value;
  }
  return result;
};

const main = async () => {
  const [command = "build-all", ...raw] = process.argv.slice(2);
  const args = parseCliArgs(raw);
  if (command === "validate") {
    console.log(JSON.stringify(await validateSupplementaryResourcePublication(args["--bundle"]), null, 2));
    return;
  }
  if (command === "build") {
    const metadata = JSON.parse(await readFile(path.resolve(args["--metadata"]), "utf8")) as SupplementaryPublicationMetadata;
    const result = await buildSupplementaryResourcePublication({ ...metadata, sqlitePath: args["--sqlite"], outputDir: args["--output-dir"] });
    console.log(JSON.stringify({ resourceId: result.manifest.identity.resourceId, revision: result.manifest.revision }, null, 2));
    return;
  }
  const mhyMetadata = JSON.parse(await readFile(path.resolve(args["--mhy-metadata"]), "utf8")) as Omit<SupplementaryPublicationMetadata, "resourceId">;
  const tresorMetadata = JSON.parse(await readFile(path.resolve(args["--tresor-metadata"]), "utf8")) as Omit<SupplementaryPublicationMetadata, "resourceId">;
  const manifests = await buildAllSupplementaryResourcePublications({ mhySqlitePath: args["--mhy-sqlite"], tresorSqlitePath: args["--tresor-sqlite"], outputDir: args["--output-dir"], mhyMetadata, tresorMetadata });
  console.log(JSON.stringify(manifests.map(manifest => ({ resourceId: manifest.identity.resourceId, revision: manifest.revision })), null, 2));
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
