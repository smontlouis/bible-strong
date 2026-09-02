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
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  buildMobileResourceCatalog,
  type MobileResourceCatalog
} from "./packageMobileResourceCatalog.js";
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

const execFileAsync = promisify(execFile);

export interface NaveResourcePublicationMetadata {
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

export type NaveLanguage = "fr" | "en";
export type NaveResourceId = "NAVE_FR" | "NAVE_EN";

const configFor = (language: NaveLanguage) =>
  language === "fr"
    ? {
        resourceId: "NAVE_FR" as const,
        entry: "nave-fr.sqlite" as const,
        stem: "nave-fr"
      }
    : {
        resourceId: "NAVE_EN" as const,
        entry: "nave.sqlite" as const,
        stem: "nave-en"
      };

const isNaveResourceId = (value: unknown): value is NaveResourceId =>
  value === "NAVE_FR" || value === "NAVE_EN";

const isNaveLanguage = (value: unknown): value is NaveLanguage =>
  value === "fr" || value === "en";

const languageForResourceId = (resourceId: NaveResourceId): NaveLanguage =>
  resourceId === "NAVE_EN" ? "en" : "fr";

export interface CanonicalNavePublication {
  format: "bible-strong-canonical-nave";
  schemaVersion: 1;
  resourceId: NaveResourceId;
  revision: string;
  sourceVersion: string;
  sourceSha256: string;
  topics: Array<{
    normalizedName: string;
    name: string;
    initial: string;
    description: string;
  }>;
  verseAnchors: Array<{
    verseKey: string;
    topicNormalizedNames: string[];
  }>;
}

export interface NaveResourcePublicationManifest {
  format: "bible-strong-resource-publication";
  schemaVersion: 1;
  identity: {
    kind: "nave";
    resourceId: NaveResourceId;
    language: NaveLanguage;
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
    entry: "nave-fr.sqlite" | "nave.sqlite";
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
  rights: NaveResourcePublicationMetadata["rights"];
  deliveryCapabilities: NaveResourcePublicationMetadata["deliveryCapabilities"];
  alphabeticalBrowse: {
    initials: string[];
    topicCountByInitial: Record<string, number>;
  };
  counts: { topics: number; verseAnchors: number; topicReferences: number };
}

type SqliteTopicRow = {
  name_lower: string;
  name: string;
  letter: string;
  description: string;
};

type SqliteVerseRow = { id: string; ref: string };

export async function buildNaveResourcePublication(
  options: NaveResourcePublicationMetadata & {
    sqlitePath: string;
    outputDir: string;
    language?: NaveLanguage;
    generatedAt?: string;
  }
): Promise<{
  outputDir: string;
  manifestPath: string;
  canonicalPath: string;
  offlineArtifactPath: string;
  manifest: NaveResourcePublicationManifest;
}> {
  const sourceSqlitePath = path.resolve(options.sqlitePath);
  const outputDir = path.resolve(options.outputDir);
  const language = options.language ?? "fr";
  const resource = configFor(language);
  if (!existsSync(sourceSqlitePath)) {
    throw new Error(`nave-publication-source-missing:${sourceSqlitePath}`);
  }
  if (existsSync(outputDir)) {
    throw new Error(`nave-publication-output-already-exists:${outputDir}`);
  }
  validateMetadata(options);

  const sourceSha256 = await sha256File(sourceSqlitePath);
  const source = await readNaveSqlite(sourceSqlitePath);
  const revision = deriveNaveRevision({
    ...source,
    resourceId: resource.resourceId
  });
  const canonical: CanonicalNavePublication = {
    format: "bible-strong-canonical-nave",
    schemaVersion: 1,
    resourceId: resource.resourceId,
    revision,
    sourceVersion: options.sourceVersion,
    sourceSha256,
    topics: source.topics,
    verseAnchors: source.verseAnchors
  };

  const canonicalRelativePath = `canonical/${resource.stem}.json`;
  const offlineRelativePath = `offline/${resource.entry}.zip`;

  return commitResourcePublicationBundle({
    outputDir,
    build: async (temporaryDir) => {
      const mobileReleaseDir = `${temporaryDir}-mobile`;
      const canonicalPath = path.join(temporaryDir, canonicalRelativePath);
      const normalizedSqlitePath = path.join(
        temporaryDir,
        `work/${resource.entry}`
      );
      try {
        await Promise.all([
          mkdir(path.dirname(canonicalPath), { recursive: true }),
          mkdir(path.dirname(normalizedSqlitePath), { recursive: true })
        ]);
        await copyFile(sourceSqlitePath, normalizedSqlitePath);
        await writePublicationMetadata(normalizedSqlitePath, canonical);
        await writeFile(
          canonicalPath,
          `${JSON.stringify(canonical)}\n`,
          "utf8"
        );

        const mobileResult = await buildMobileResourceCatalog({
          outputDir: mobileReleaseDir,
          generatedAt: options.generatedAt,
          inventory: [
            {
              id: `database:NAVE:${language}`,
              artifactUrl: `https://local.invalid/databases/${resource.entry}.zip`,
              sources: [
                {
                  role: "canonical",
                  sourceUrl: `https://local.invalid/databases/${resource.entry}`,
                  sourcePath: normalizedSqlitePath,
                  entry: resource.entry
                }
              ],
              strategy: "archive-extract"
            }
          ],
          requiredIds: [`database:NAVE:${language}`]
        });
        const catalog = JSON.parse(
          await readFile(mobileResult.catalogPath, "utf8")
        ) as MobileResourceCatalog;
        const mobileArtifact = catalog.resources[`database:NAVE:${language}`];
        if (!mobileArtifact)
          throw new Error("nave-publication-offline-missing");

        const offlineArtifactPath = path.join(
          temporaryDir,
          offlineRelativePath
        );
        await mkdir(path.dirname(offlineArtifactPath), { recursive: true });
        await copyFile(
          path.join(mobileReleaseDir, mobileArtifact.file),
          offlineArtifactPath
        );
        const canonicalStats = await stat(canonicalPath);
        const offlineStats = await stat(offlineArtifactPath);
        const canonicalSha256 = await sha256File(canonicalPath);
        const contentSha256 = await sha256File(normalizedSqlitePath);
        if (mobileArtifact.entries.canonical?.sha256 !== contentSha256) {
          throw new Error("nave-publication-offline-content-mismatch");
        }

        const manifest: NaveResourcePublicationManifest = {
          format: "bible-strong-resource-publication",
          schemaVersion: 1,
          identity: { kind: "nave", resourceId: resource.resourceId, language },
          revision,
          canonical: {
            path: canonicalRelativePath,
            mediaType: "application/json",
            schemaVersion: 1,
            sha256: canonicalSha256,
            bytes: canonicalStats.size
          },
          offlineArtifact: {
            path: offlineRelativePath,
            mediaType: "application/zip",
            entry: resource.entry,
            sha256: await sha256File(offlineArtifactPath),
            bytes: offlineStats.size,
            contentSha256
          },
          provenance: {
            generator: "bible-lexicon-maker",
            sourceVersion: options.sourceVersion,
            sourceSha256,
            generatedAt: options.generatedAt ?? new Date().toISOString()
          },
          rights: options.rights,
          deliveryCapabilities: options.deliveryCapabilities,
          alphabeticalBrowse: deriveAlphabeticalBrowse(canonical),
          counts: countCanonical(canonical)
        };
        const manifestPath = path.join(temporaryDir, "manifest.json");
        await writeFile(
          manifestPath,
          `${JSON.stringify(manifest, null, 2)}\n`,
          "utf8"
        );
        return {
          outputDir,
          manifestPath: path.join(outputDir, "manifest.json"),
          canonicalPath: path.join(outputDir, canonicalRelativePath),
          offlineArtifactPath: path.join(outputDir, offlineRelativePath),
          manifest
        };
      } finally {
        await rm(mobileReleaseDir, { recursive: true, force: true });
      }
    },
    validate: validateNaveResourcePublication
  });
}

export async function validateNaveResourcePublication(
  bundleDir: string
): Promise<NaveResourcePublicationManifest> {
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
  await assertResourcePublicationArtifact(
    canonicalPath,
    manifest.canonical,
    "canonical",
    root
  );
  await assertResourcePublicationArtifact(
    archivePath,
    manifest.offlineArtifact,
    "offline",
    root
  );

  const canonical = decodeCanonical(
    JSON.parse(await readFile(canonicalPath, "utf8"))
  );
  if (
    canonical.revision !== deriveNaveRevision(canonical) ||
    canonical.revision !== manifest.revision ||
    canonical.sourceVersion !== manifest.provenance.sourceVersion ||
    canonical.sourceSha256 !== manifest.provenance.sourceSha256 ||
    JSON.stringify(countCanonical(canonical)) !==
      JSON.stringify(manifest.counts) ||
    JSON.stringify(deriveAlphabeticalBrowse(canonical)) !==
      JSON.stringify(manifest.alphabeticalBrowse)
  ) {
    throw new Error("nave-publication-declaration-mismatch");
  }

  const extractedDir = await mkdtemp(
    path.join(tmpdir(), "nave-publication-validate-")
  );
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
    if (!(await lstat(sqlitePath)).isFile()) {
      throw new Error("nave-publication-offline-entry-type-invalid");
    }
    if (
      (await sha256ResourcePublicationFile(sqlitePath)) !==
      manifest.offlineArtifact.contentSha256
    ) {
      throw new Error("nave-publication-offline-content-mismatch");
    }
    const offline = await readNaveSqlite(sqlitePath);
    if (
      JSON.stringify(offline.topics) !== JSON.stringify(canonical.topics) ||
      JSON.stringify(offline.verseAnchors) !==
        JSON.stringify(canonical.verseAnchors)
    ) {
      throw new Error("nave-publication-offline-content-mismatch");
    }
    const metadataRows = await queryJson<{
      resource_id: string;
      revision: string;
      source_version: string;
      source_sha256: string;
    }>(
      sqlitePath,
      "SELECT resource_id, revision, source_version, source_sha256 FROM RESOURCE_METADATA"
    );
    const metadata = metadataRows[0];
    if (
      metadataRows.length !== 1 ||
      metadata?.resource_id !== canonical.resourceId ||
      metadata.revision !== canonical.revision ||
      metadata.source_version !== canonical.sourceVersion ||
      metadata.source_sha256 !== canonical.sourceSha256
    ) {
      throw new Error("nave-publication-offline-metadata-mismatch");
    }
  } finally {
    await rm(extractedDir, { recursive: true, force: true });
  }
  return manifest;
}

async function readNaveSqlite(sqlitePath: string): Promise<{
  topics: CanonicalNavePublication["topics"];
  verseAnchors: CanonicalNavePublication["verseAnchors"];
}> {
  const integrity = await queryJson<{ integrity_check: string }>(
    sqlitePath,
    "PRAGMA integrity_check"
  );
  if (
    integrity.length !== 1 ||
    integrity[0]?.integrity_check.toLocaleLowerCase() !== "ok"
  ) {
    throw new Error("nave-publication-sqlite-integrity-invalid");
  }
  const topicRows = await queryJson<SqliteTopicRow>(
    sqlitePath,
    "SELECT name_lower, name, letter, description FROM TOPICS ORDER BY name_lower"
  );
  const topics = topicRows.map((row) => {
    if (
      !isNonEmptyString(row.name_lower) ||
      !isNonEmptyString(row.name) ||
      !isNonEmptyString(row.letter) ||
      typeof row.description !== "string"
    ) {
      throw new Error("nave-publication-topic-invalid");
    }
    return {
      normalizedName: row.name_lower,
      name: row.name,
      initial: row.letter,
      description: row.description
    };
  });
  if (topics.length === 0) throw new Error("nave-publication-topics-empty");
  const topicNames = new Set(topics.map((topic) => topic.normalizedName));
  if (topicNames.size !== topics.length) {
    throw new Error("nave-publication-topic-duplicate");
  }

  const verseRows = await queryJson<SqliteVerseRow>(
    sqlitePath,
    "SELECT id, ref FROM VERSES ORDER BY id"
  );
  const verseAnchors = verseRows.map((row) => {
    if (!/^[1-9]\d*-[1-9]\d*(?:-[1-9]\d*)?$/.test(row.id)) {
      throw new Error(`nave-publication-verse-key-invalid:${row.id}`);
    }
    let references: unknown;
    try {
      references = JSON.parse(row.ref);
    } catch (cause) {
      throw new Error(`nave-publication-verse-references-invalid:${row.id}`, {
        cause
      });
    }
    if (
      !Array.isArray(references) ||
      references.length === 0 ||
      references.some((value) => !isNonEmptyString(value))
    ) {
      throw new Error(`nave-publication-verse-references-invalid:${row.id}`);
    }
    const topicNormalizedNames = [...new Set(references)].sort();
    for (const topicName of topicNormalizedNames) {
      if (!topicNames.has(topicName)) {
        throw new Error(
          `nave-publication-topic-reference-invalid:${row.id}:${topicName}`
        );
      }
    }
    return { verseKey: row.id, topicNormalizedNames };
  });
  if (verseAnchors.length === 0) {
    throw new Error("nave-publication-verse-anchors-empty");
  }
  return { topics, verseAnchors };
}

async function queryJson<T>(sqlitePath: string, sql: string): Promise<T[]> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync("sqlite3", ["-json", sqlitePath, sql], {
      maxBuffer: 256 * 1024 * 1024
    }));
  } catch (cause) {
    throw new Error("nave-publication-sqlite-invalid", { cause });
  }
  try {
    return JSON.parse(stdout || "[]") as T[];
  } catch (cause) {
    throw new Error("nave-publication-sqlite-output-invalid", { cause });
  }
}

async function writePublicationMetadata(
  sqlitePath: string,
  canonical: CanonicalNavePublication
): Promise<void> {
  const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
  await execFileAsync("sqlite3", [
    sqlitePath,
    `BEGIN IMMEDIATE;
     DROP TABLE IF EXISTS RESOURCE_METADATA;
     CREATE TABLE RESOURCE_METADATA (
       resource_id TEXT NOT NULL,
       revision TEXT NOT NULL,
       source_version TEXT NOT NULL,
       source_sha256 TEXT NOT NULL
     );
     INSERT INTO RESOURCE_METADATA VALUES (
       ${quote(canonical.resourceId)},
       ${quote(canonical.revision)},
       ${quote(canonical.sourceVersion)},
       ${quote(canonical.sourceSha256)}
     );
     COMMIT;`
  ]);
}

function countCanonical(canonical: CanonicalNavePublication) {
  return {
    topics: canonical.topics.length,
    verseAnchors: canonical.verseAnchors.length,
    topicReferences: canonical.verseAnchors.reduce(
      (count, anchor) => count + anchor.topicNormalizedNames.length,
      0
    )
  };
}

export function deriveNaveRevision(
  canonical: Pick<CanonicalNavePublication, "topics" | "verseAnchors"> &
    Partial<Pick<CanonicalNavePublication, "resourceId">>
): string {
  const semanticSha256 = sha256Buffer(
    Buffer.from(
      JSON.stringify({
        topics: canonical.topics,
        verseAnchors: canonical.verseAnchors
      }),
      "utf8"
    )
  );
  return `${canonical.resourceId === "NAVE_EN" ? "nave-en" : "nave-fr"}-${semanticSha256.slice(0, 20)}`;
}

function deriveAlphabeticalBrowse(canonical: CanonicalNavePublication) {
  const topicCountByInitial: Record<string, number> = {};
  for (const topic of canonical.topics) {
    topicCountByInitial[topic.initial] =
      (topicCountByInitial[topic.initial] ?? 0) + 1;
  }
  const initials = Object.keys(topicCountByInitial).sort();
  return {
    initials,
    topicCountByInitial: Object.fromEntries(
      initials.map((initial) => [initial, topicCountByInitial[initial] ?? 0])
    )
  };
}

function validateMetadata(metadata: NaveResourcePublicationMetadata): void {
  for (const [label, value] of [
    ["source-version", metadata.sourceVersion],
    ["rights-holder", metadata.rights.holder],
    ["terms-reference", metadata.rights.termsReference],
    ["attribution", metadata.rights.attribution]
  ] as const) {
    if (!value.trim()) throw new Error(`nave-publication-${label}-missing`);
  }
  if (
    (metadata.deliveryCapabilities.onlineAccess && !metadata.rights.online) ||
    (metadata.deliveryCapabilities.offlineDownload && !metadata.rights.offline)
  ) {
    throw new Error("nave-publication-rights-mismatch");
  }
}

function decodeCanonical(value: unknown): CanonicalNavePublication {
  if (!isRecord(value)) {
    throw new Error("nave-publication-canonical-invalid");
  }
  const canonical = value as Partial<CanonicalNavePublication>;
  if (
    canonical.format !== "bible-strong-canonical-nave" ||
    canonical.schemaVersion !== 1 ||
    !isNaveResourceId(canonical.resourceId) ||
    !isNonEmptyString(canonical.revision) ||
    !isNonEmptyString(canonical.sourceVersion) ||
    !isSha256(canonical.sourceSha256) ||
    !Array.isArray(canonical.topics) ||
    !Array.isArray(canonical.verseAnchors) ||
    canonical.topics.length === 0 ||
    canonical.verseAnchors.length === 0 ||
    canonical.topics.some(
      (topic) =>
        !isRecord(topic) ||
        !isNonEmptyString(topic.normalizedName) ||
        !isNonEmptyString(topic.name) ||
        !isNonEmptyString(topic.initial) ||
        typeof topic.description !== "string"
    ) ||
    canonical.verseAnchors.some(
      (anchor) =>
        !isRecord(anchor) ||
        !isNonEmptyString(anchor.verseKey) ||
        !/^[1-9]\d*-[1-9]\d*(?:-[1-9]\d*)?$/.test(anchor.verseKey) ||
        !Array.isArray(anchor.topicNormalizedNames) ||
        anchor.topicNormalizedNames.length === 0 ||
        anchor.topicNormalizedNames.some((topic) => !isNonEmptyString(topic))
    )
  ) {
    throw new Error("nave-publication-canonical-invalid");
  }
  return canonical as CanonicalNavePublication;
}

function decodeManifest(value: unknown): NaveResourcePublicationManifest {
  const envelope = decodeResourcePublicationEnvelope(value);
  const manifest = value as Partial<NaveResourcePublicationManifest>;
  const identity = manifest.identity;
  if (
    !identity ||
    identity.kind !== "nave" ||
    !isNaveResourceId(identity.resourceId) ||
    !isNaveLanguage(identity.language) ||
    identity.language !== languageForResourceId(identity.resourceId) ||
    envelope.canonical.schemaVersion !== 1 ||
    envelope.offlineArtifact.entry !== configFor(identity.language).entry ||
    !manifest.alphabeticalBrowse ||
    !Array.isArray(manifest.alphabeticalBrowse.initials) ||
    manifest.alphabeticalBrowse.initials.some(
      (initial) => !isNonEmptyString(initial)
    ) ||
    !isRecord(manifest.alphabeticalBrowse.topicCountByInitial) ||
    Object.values(manifest.alphabeticalBrowse.topicCountByInitial).some(
      (count) => !isNonNegativeInteger(count)
    ) ||
    !manifest.counts ||
    Object.values(manifest.counts).some((count) => !isNonNegativeInteger(count))
  ) {
    throw new Error("nave-publication-manifest-invalid");
  }
  return manifest as NaveResourcePublicationManifest;
}

function sha256Buffer(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

async function sha256File(filePath: string): Promise<string> {
  return sha256ResourcePublicationFile(filePath);
}

async function assertSingleBoundedZipEntry(
  archivePath: string,
  expectedEntry: string
): Promise<void> {
  const { stdout: names } = await execFileAsync("unzip", ["-Z1", archivePath]);
  const entries = names.split(/\r?\n/u).filter(Boolean);
  if (entries.length !== 1 || entries[0] !== expectedEntry) {
    throw new Error("nave-publication-offline-entries-invalid");
  }
  const { stdout: listing } = await execFileAsync("zipinfo", [
    "-l",
    archivePath,
    expectedEntry
  ]);
  const entryLine = listing
    .split(/\r?\n/u)
    .find((line) => line.trimEnd().endsWith(` ${expectedEntry}`));
  const bytes = entryLine?.trim().split(/\s+/u)[3];
  if (
    !entryLine?.trimStart().startsWith("-") ||
    !bytes ||
    !/^\d+$/u.test(bytes) ||
    Number(bytes) > 256 * 1024 * 1024
  ) {
    throw new Error("nave-publication-offline-size-invalid");
  }
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
      throw new Error(`nave-publication-cli-option-unknown:${key ?? ""}`);
    }
    if (!value || value.startsWith("--")) {
      throw new Error(`nave-publication-cli-option-value-missing:${key}`);
    }
    if (result[key]) {
      throw new Error(`nave-publication-cli-option-duplicate:${key}`);
    }
    result[key] = value;
  }
  return result;
}

async function main(): Promise<void> {
  const [command = "build", ...rawArgs] = process.argv.slice(2);
  if (command === "validate") {
    const args = parseCliArgs(rawArgs, new Set(["--bundle"]));
    const bundle = args["--bundle"];
    if (!bundle) throw new Error("nave-publication-cli-bundle-missing");
    console.log(
      JSON.stringify(await validateNaveResourcePublication(bundle), null, 2)
    );
    return;
  }
  const buildArgs = command === "build" ? rawArgs : [command, ...rawArgs];
  const args = parseCliArgs(
    buildArgs,
    new Set(["--sqlite", "--metadata", "--output-dir", "--language"])
  );
  const sqlitePath = args["--sqlite"];
  const metadataPath = args["--metadata"];
  const outputDir = args["--output-dir"];
  const language = args["--language"] ?? "fr";
  if (!isNaveLanguage(language)) {
    throw new Error("nave-publication-language-invalid");
  }
  if (!sqlitePath || !metadataPath || !outputDir) {
    throw new Error("nave-publication-cli-required-options-missing");
  }
  const metadata = JSON.parse(
    await readFile(path.resolve(metadataPath), "utf8")
  ) as NaveResourcePublicationMetadata;
  const result = await buildNaveResourcePublication({
    ...metadata,
    sqlitePath,
    outputDir,
    language
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
