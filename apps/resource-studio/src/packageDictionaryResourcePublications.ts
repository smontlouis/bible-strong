import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
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
  buildMobileResourceCatalog,
  type MobileResourceCatalog
} from "./packageMobileResourceCatalog.js";
import {
  buildDictionaryDirectoryResourcePublication,
  validateDictionaryDirectoryResourcePublication
} from "./packageDictionaryDirectoryResourcePublication.js";
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
import {
  commitResourcePublicationBundle,
  commitResourcePublicationTransaction
} from "./resourcePublicationCommit.js";

const execFileAsync = promisify(execFile);
const normalizeDictionarySqliteScript = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../workflows/dictionaries/scripts/normalize-sqlite.mjs"
);
const normalizeDictionaryLibraryScript = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../workflows/dictionaries/scripts/normalize-library.mjs"
);

export type DictionaryLanguage = "fr" | "en";
export type DictionaryPassageEvidenceKind =
  "source-citation" | "verse-name" | "verse-phrase";

export interface DictionaryPublicationMetadata {
  work: string;
  resourceId: string;
  language: DictionaryLanguage;
  title: string;
  abbreviation: string;
  authors: string[];
  description: string;
  edition: string;
  source: string;
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
  correspondenceSeedsPath?: string;
}

export type CanonicalDictionaryEntry = {
  id: number;
  word: string;
  normalizedWord: string;
  definition: string;
  correspondenceId?: string;
};

export type CanonicalDictionaryVerseAnchor = {
  verseKey: string;
  words: string[];
};

export type CanonicalDictionaryPassageAnchor = {
  verseKey: string;
  entries: Array<{
    entryId: number;
    evidenceKind: DictionaryPassageEvidenceKind;
  }>;
};

export interface CanonicalDictionaryPublication {
  format: "bible-strong-canonical-dictionary";
  schemaVersion: 2;
  resourceId: string;
  work: string;
  language: DictionaryLanguage;
  editorial: Pick<
    DictionaryPublicationMetadata,
    "title" | "abbreviation" | "authors" | "description" | "edition" | "source"
  >;
  revision: string;
  sourceVersion: string;
  sourceSha256: string;
  entries: CanonicalDictionaryEntry[];
  verseAnchors: CanonicalDictionaryVerseAnchor[];
  passageAnchors: CanonicalDictionaryPassageAnchor[];
}

export interface DictionaryResourcePublicationManifest {
  format: "bible-strong-resource-publication";
  schemaVersion: 1;
  identity: {
    kind: "dictionary";
    resourceId: string;
    work: string;
    language: DictionaryLanguage;
  };
  editorial: CanonicalDictionaryPublication["editorial"];
  revision: string;
  canonical: {
    path: string;
    mediaType: "application/json";
    schemaVersion: 2;
    sha256: string;
    bytes: number;
  };
  offlineArtifact: {
    path: string;
    mediaType: "application/zip";
    entry: "dictionnaire.sqlite";
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
  rights: DictionaryPublicationMetadata["rights"];
  deliveryCapabilities: DictionaryPublicationMetadata["deliveryCapabilities"];
  alphabeticalBrowse: {
    initials: string[];
    entryCountByInitial: Record<string, number>;
  };
  counts: {
    entries: number;
    verseAnchors: number;
    wordReferences: number;
    passageEntryReferences: number;
  };
}

type DictionarySqliteEntry = {
  id: number;
  sanitized_word: string;
  word: string;
  definition: string;
  correspondence_id: string | null;
};

type DictionarySqliteVerse = { id: string; ref: string };
type DictionarySqlitePassageAnchor = {
  verse_key: string;
  entry_id: number;
  evidence_kind: string;
  ordinal: number;
};

const isDictionaryLanguage = (value: unknown): value is DictionaryLanguage =>
  value === "fr" || value === "en";

const isDictionaryWork = (value: unknown): value is string =>
  typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value);

const isDictionaryResourceId = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Z0-9][A-Z0-9_]{1,63}$/u.test(value);

const sha256Buffer = (value: Buffer): string =>
  createHash("sha256").update(value).digest("hex");

const sha256File = (filePath: string): Promise<string> =>
  sha256ResourcePublicationFile(filePath);

const queryJson = async <T>(
  sqlitePath: string,
  query: string
): Promise<T[]> => {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync("sqlite3", ["-json", sqlitePath, query], {
      maxBuffer: 512 * 1024 * 1024
    }));
  } catch (cause) {
    throw new Error("dictionary-publication-sqlite-invalid", { cause });
  }
  try {
    return JSON.parse(stdout || "[]") as T[];
  } catch (cause) {
    throw new Error("dictionary-publication-sqlite-output-invalid", { cause });
  }
};

const normalizeDictionaryWord = (word: string): string =>
  word.trim().toLocaleLowerCase();

const isDictionaryVerseKey = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= 128 &&
  value === value.trim() &&
  value.split("-").length === 3 &&
  value.split("-").every((segment) => segment.length > 0) &&
  !Array.from(value).some(
    (character) =>
      character === "\\" || character === "/" || character.charCodeAt(0) <= 0x1f
  );

const readDictionarySqlite = async (
  sqlitePath: string,
  language: DictionaryLanguage
): Promise<
  Pick<
    CanonicalDictionaryPublication,
    "entries" | "verseAnchors" | "passageAnchors"
  >
> => {
  const integrity = await queryJson<{ integrity_check: string }>(
    sqlitePath,
    "PRAGMA integrity_check"
  );
  if (
    integrity.length !== 1 ||
    integrity[0]?.integrity_check?.toLocaleLowerCase() !== "ok"
  ) {
    throw new Error(
      `dictionary-publication-sqlite-integrity-invalid:${language}`
    );
  }
  const tables = await queryJson<{ name: string }>(
    sqlitePath,
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );
  const tableNames = tables.map((row) => row.name);
  const requiredTables = [
    "dictionnaire",
    "dictionary_correspondences",
    "dictionary_passage_anchors",
    "verses"
  ];
  if (requiredTables.some((table) => !tableNames.includes(table))) {
    throw new Error(`dictionary-publication-sqlite-tables-invalid:${language}`);
  }

  const entryRows = await queryJson<DictionarySqliteEntry>(
    sqlitePath,
    `SELECT entry.id, entry.sanitized_word, entry.word, entry.definition,
            correspondence.correspondence_id
     FROM dictionnaire entry
     LEFT JOIN dictionary_correspondences correspondence ON correspondence.entry_id = entry.id
     ORDER BY entry.id`
  );
  if (entryRows.length === 0)
    throw new Error(`dictionary-publication-entries-empty:${language}`);
  const entryIds = new Set<number>();
  const entries = entryRows.map((row) => {
    if (
      !Number.isSafeInteger(row.id) ||
      row.id <= 0 ||
      !isNonEmptyString(row.sanitized_word) ||
      !isNonEmptyString(row.word) ||
      typeof row.definition !== "string"
    ) {
      throw new Error(`dictionary-publication-entry-invalid:${language}`);
    }
    if (entryIds.has(row.id))
      throw new Error(`dictionary-publication-entry-duplicate:${language}`);
    entryIds.add(row.id);
    const normalizedWord = normalizeDictionaryWord(row.sanitized_word);
    if (!normalizedWord)
      throw new Error(
        `dictionary-publication-entry-normalized-invalid:${language}`
      );
    return {
      id: row.id,
      word: row.word,
      normalizedWord,
      definition: row.definition,
      ...(isNonEmptyString(row.correspondence_id)
        ? { correspondenceId: row.correspondence_id }
        : {})
    };
  });

  const verseRows = await queryJson<DictionarySqliteVerse>(
    sqlitePath,
    "SELECT id, ref FROM verses ORDER BY id"
  );
  const verseKeys = new Set<string>();
  const verseAnchors = verseRows.map((row) => {
    if (!isDictionaryVerseKey(row.id) || verseKeys.has(row.id)) {
      throw new Error(`dictionary-publication-verse-key-invalid:${language}`);
    }
    verseKeys.add(row.id);
    let references: unknown;
    try {
      references = JSON.parse(row.ref);
    } catch (cause) {
      throw new Error(
        `dictionary-publication-verse-references-invalid:${language}`,
        { cause }
      );
    }
    if (
      !Array.isArray(references) ||
      references.some(
        (reference) => typeof reference !== "string" || !reference.trim()
      )
    ) {
      throw new Error(
        `dictionary-publication-verse-references-invalid:${language}`
      );
    }
    const words = [
      ...new Set(
        references.map((reference) => normalizeDictionaryWord(reference))
      )
    ];
    if (words.some((word) => !word)) {
      throw new Error(
        `dictionary-publication-verse-reference-empty:${language}`
      );
    }
    return { verseKey: row.id, words };
  });
  const passageRows = await queryJson<DictionarySqlitePassageAnchor>(
    sqlitePath,
    `SELECT verse_key, entry_id, evidence_kind, ordinal
     FROM dictionary_passage_anchors
     ORDER BY verse_key, ordinal, entry_id`
  );
  const passageAnchorsByVerse = new Map<
    string,
    CanonicalDictionaryPassageAnchor["entries"]
  >();
  const passageIdentities = new Set<string>();
  for (const row of passageRows) {
    const identity = `${row.verse_key}:${row.entry_id}:${row.evidence_kind}`;
    if (
      !isDictionaryVerseKey(row.verse_key) ||
      !entryIds.has(row.entry_id) ||
      !["source-citation", "verse-name", "verse-phrase"].includes(
        row.evidence_kind
      ) ||
      !Number.isSafeInteger(row.ordinal) ||
      row.ordinal < 0 ||
      passageIdentities.has(identity)
    ) {
      throw new Error(
        `dictionary-publication-passage-anchor-invalid:${language}`
      );
    }
    passageIdentities.add(identity);
    const anchors = passageAnchorsByVerse.get(row.verse_key) ?? [];
    anchors.push({
      entryId: row.entry_id,
      evidenceKind: row.evidence_kind as DictionaryPassageEvidenceKind
    });
    passageAnchorsByVerse.set(row.verse_key, anchors);
  }
  const passageAnchors = [...passageAnchorsByVerse].map(
    ([verseKey, passageEntries]) => ({ verseKey, entries: passageEntries })
  );
  return { entries, verseAnchors, passageAnchors };
};

export const deriveDictionaryRevision = (
  work: string,
  language: DictionaryLanguage,
  content: Pick<
    CanonicalDictionaryPublication,
    "entries" | "verseAnchors" | "passageAnchors"
  >
): string => {
  const semanticSha256 = sha256Buffer(
    Buffer.from(
      JSON.stringify({
        work,
        language,
        entries: content.entries,
        verseAnchors: content.verseAnchors,
        passageAnchors: content.passageAnchors
      }),
      "utf8"
    )
  );
  return `dictionary-${work}-${language}-${semanticSha256.slice(0, 20)}`;
};

const countCanonical = (canonical: CanonicalDictionaryPublication) => ({
  entries: canonical.entries.length,
  verseAnchors: canonical.verseAnchors.length,
  wordReferences: canonical.verseAnchors.reduce(
    (total, anchor) => total + anchor.words.length,
    0
  ),
  passageEntryReferences: canonical.passageAnchors.reduce(
    (total, anchor) => total + anchor.entries.length,
    0
  )
});

const deriveAlphabeticalBrowse = (
  canonical: CanonicalDictionaryPublication
) => {
  const entryCountByInitial: Record<string, number> = {};
  for (const entry of canonical.entries) {
    const initial = [...entry.normalizedWord][0] ?? "#";
    entryCountByInitial[initial] = (entryCountByInitial[initial] ?? 0) + 1;
  }
  const initials = Object.keys(entryCountByInitial).sort((left, right) =>
    left.localeCompare(right)
  );
  return {
    initials,
    entryCountByInitial: Object.fromEntries(
      initials.map((initial) => [initial, entryCountByInitial[initial] ?? 0])
    )
  };
};

const validateMetadata = (metadata: DictionaryPublicationMetadata) => {
  for (const [label, value] of [
    ["work", metadata.work],
    ["resource-id", metadata.resourceId],
    ["title", metadata.title],
    ["abbreviation", metadata.abbreviation],
    ["description", metadata.description],
    ["edition", metadata.edition],
    ["source", metadata.source],
    ["source-version", metadata.sourceVersion],
    ["rights-holder", metadata.rights.holder],
    ["terms-reference", metadata.rights.termsReference],
    ["attribution", metadata.rights.attribution]
  ] as const) {
    if (!value.trim())
      throw new Error(`dictionary-publication-${label}-missing`);
  }
  if (!isDictionaryWork(metadata.work))
    throw new Error("dictionary-publication-work-invalid");
  if (!isDictionaryResourceId(metadata.resourceId))
    throw new Error("dictionary-publication-resource-id-invalid");
  if (!isDictionaryLanguage(metadata.language))
    throw new Error("dictionary-publication-language-invalid");
  if (
    !Array.isArray(metadata.authors) ||
    metadata.authors.length === 0 ||
    metadata.authors.some((author) => !isNonEmptyString(author))
  ) {
    throw new Error("dictionary-publication-authors-invalid");
  }
  if (
    (metadata.deliveryCapabilities.onlineAccess && !metadata.rights.online) ||
    (metadata.deliveryCapabilities.offlineDownload && !metadata.rights.offline)
  ) {
    throw new Error("dictionary-publication-rights-mismatch");
  }
};

const writePublicationMetadata = async (
  sqlitePath: string,
  canonical: CanonicalDictionaryPublication
) => {
  const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
  await execFileAsync("sqlite3", [
    sqlitePath,
    `BEGIN IMMEDIATE;
     DROP TABLE IF EXISTS RESOURCE_METADATA;
     CREATE TABLE RESOURCE_METADATA (
       resource_id TEXT NOT NULL,
       work TEXT NOT NULL,
       language TEXT NOT NULL,
       revision TEXT NOT NULL,
       source_version TEXT NOT NULL,
       source_sha256 TEXT NOT NULL
     );
     INSERT INTO RESOURCE_METADATA VALUES (
       ${quote(`dictionary:${canonical.work}:${canonical.language}`)},
       ${quote(canonical.work)},
       ${quote(canonical.language)},
       ${quote(canonical.revision)},
       ${quote(canonical.sourceVersion)},
       ${quote(canonical.sourceSha256)}
     );
     COMMIT;`
  ]);
};

const currentArchiveEntry = "dictionnaire.sqlite" as const;

const assertSingleBoundedZipEntry = async (archivePath: string) => {
  const { stdout: names } = await execFileAsync("unzip", ["-Z1", archivePath]);
  const entries = names.split(/\r?\n/u).filter(Boolean);
  if (entries.length !== 1 || entries[0] !== currentArchiveEntry) {
    throw new Error("dictionary-publication-offline-entries-invalid");
  }
  const { stdout: listing } = await execFileAsync("zipinfo", [
    "-l",
    archivePath,
    currentArchiveEntry
  ]);
  const line = listing
    .split(/\r?\n/u)
    .find((value) => value.trimEnd().endsWith(` ${currentArchiveEntry}`));
  const bytes = line?.trim().split(/\s+/u)[3];
  if (
    !line?.trimStart().startsWith("-") ||
    !bytes ||
    !/^\d+$/u.test(bytes) ||
    Number(bytes) > 256 * 1024 * 1024
  ) {
    throw new Error("dictionary-publication-offline-size-invalid");
  }
};

export async function buildDictionaryResourcePublication(
  options: DictionaryPublicationMetadata & {
    sqlitePath: string;
    outputDir: string;
    generatedAt?: string;
    prepared?: boolean;
  }
): Promise<{
  outputDir: string;
  manifestPath: string;
  canonicalPath: string;
  offlineArtifactPath: string;
  manifest: DictionaryResourcePublicationManifest;
}> {
  const sourceSqlitePath = path.resolve(options.sqlitePath);
  const outputDir = path.resolve(options.outputDir);
  if (!existsSync(sourceSqlitePath)) {
    throw new Error(
      `dictionary-publication-source-missing:${sourceSqlitePath}`
    );
  }
  if (existsSync(outputDir))
    throw new Error(`dictionary-publication-output-exists:${outputDir}`);
  validateMetadata(options);

  const sourceSha256 = await sha256File(sourceSqlitePath);
  const canonicalRelativePath = `canonical/dictionary-${options.work}-${options.language}.json`;
  const offlineRelativePath = `offline/dictionary-${options.work}-${options.language}.sqlite.zip`;

  return commitResourcePublicationBundle({
    outputDir,
    build: async (temporaryDir) => {
      const mobileReleaseDir = `${temporaryDir}-mobile`;
      const canonicalPath = path.join(temporaryDir, canonicalRelativePath);
      const normalizedSqlitePath = path.join(
        temporaryDir,
        "work/dictionnaire.sqlite"
      );
      try {
        await Promise.all([
          mkdir(path.dirname(canonicalPath), { recursive: true }),
          mkdir(path.dirname(normalizedSqlitePath), { recursive: true })
        ]);
        await copyFile(sourceSqlitePath, normalizedSqlitePath);
        if (!options.prepared) {
          await execFileAsync(process.execPath, [
            normalizeDictionarySqliteScript,
            "--database",
            normalizedSqlitePath,
            "--work",
            options.work,
            "--language",
            options.language
          ]);
        }
        const source = await readDictionarySqlite(
          normalizedSqlitePath,
          options.language
        );
        const revision = deriveDictionaryRevision(
          options.work,
          options.language,
          source
        );
        const canonical: CanonicalDictionaryPublication = {
          format: "bible-strong-canonical-dictionary",
          schemaVersion: 2,
          resourceId: options.resourceId,
          work: options.work,
          language: options.language,
          editorial: {
            title: options.title,
            abbreviation: options.abbreviation,
            authors: options.authors,
            description: options.description,
            edition: options.edition,
            source: options.source
          },
          revision,
          sourceVersion: options.sourceVersion,
          sourceSha256,
          entries: source.entries,
          verseAnchors: source.verseAnchors,
          passageAnchors: source.passageAnchors
        };
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
              id: `database:${options.resourceId}:${options.language}`,
              artifactUrl: `https://local.invalid/databases/dictionary-${options.work}-${options.language}.sqlite.zip`,
              sources: [
                {
                  role: "canonical",
                  sourceUrl: `https://local.invalid/databases/dictionary-${options.work}-${options.language}.sqlite`,
                  sourcePath: normalizedSqlitePath,
                  entry: currentArchiveEntry
                }
              ],
              strategy: "archive-extract"
            }
          ],
          requiredIds: [`database:${options.resourceId}:${options.language}`]
        });
        const catalog = JSON.parse(
          await readFile(mobileResult.catalogPath, "utf8")
        ) as MobileResourceCatalog;
        const mobileArtifact =
          catalog.resources[
            `database:${options.resourceId}:${options.language}`
          ];
        if (!mobileArtifact)
          throw new Error("dictionary-publication-offline-missing");

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
          throw new Error("dictionary-publication-offline-content-mismatch");
        }
        const manifest: DictionaryResourcePublicationManifest = {
          format: "bible-strong-resource-publication",
          schemaVersion: 1,
          identity: {
            kind: "dictionary",
            resourceId: options.resourceId,
            work: options.work,
            language: options.language
          },
          editorial: canonical.editorial,
          revision,
          canonical: {
            path: canonicalRelativePath,
            mediaType: "application/json",
            schemaVersion: 2,
            sha256: canonicalSha256,
            bytes: canonicalStats.size
          },
          offlineArtifact: {
            path: offlineRelativePath,
            mediaType: "application/zip",
            entry: currentArchiveEntry,
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
    validate: validateDictionaryResourcePublication
  });
}

export async function buildAllDictionaryResourcePublications(options: {
  outputDir: string;
  publications: Array<DictionaryPublicationMetadata & { sqlitePath: string }>;
  normalizationPublications?: Array<
    DictionaryPublicationMetadata & { sqlitePath: string }
  >;
  referenceBibles?: { fr: string; en: string };
  generatedAt?: string;
}): Promise<DictionaryResourcePublicationManifest[]> {
  const outputDir = path.resolve(options.outputDir);
  if (existsSync(outputDir))
    throw new Error(`dictionary-publication-output-exists:${outputDir}`);
  const stagingDir = await mkdtemp(
    path.join(tmpdir(), "dictionary-publications-")
  );
  const normalizationDir = await mkdtemp(
    path.join(tmpdir(), "dictionary-normalization-")
  );
  try {
    const normalizationConfigPath = path.join(
      normalizationDir,
      "dictionary.json"
    );
    const normalizedRoot = path.join(normalizationDir, "normalized");
    await writeFile(
      normalizationConfigPath,
      `${JSON.stringify(
        {
          publications:
            options.normalizationPublications ?? options.publications
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    const normalizationArguments = [
      normalizeDictionaryLibraryScript,
      "--config",
      normalizationConfigPath,
      "--output-root",
      normalizedRoot
    ];
    if (options.referenceBibles) {
      normalizationArguments.push(
        "--lsg-bible",
        path.resolve(options.referenceBibles.fr),
        "--kjv-bible",
        path.resolve(options.referenceBibles.en)
      );
    }
    await execFileAsync(process.execPath, normalizationArguments, {
      maxBuffer: 16 * 1024 * 1024
    });
    await buildDictionaryDirectoryResourcePublication({
      sqlitePath: path.join(normalizedRoot, "dictionary-directory.sqlite"),
      outputDir: path.join(stagingDir, "directory"),
      generatedAt: options.generatedAt
    });
    await Promise.all(
      options.publications.map((publication) =>
        execFileAsync("sqlite3", [
          path.join(normalizedRoot, `${publication.work}.sqlite`),
          `DELETE FROM dictionary_passage_anchors
           WHERE evidence_kind IN ('verse-name', 'verse-phrase');
           PRAGMA optimize;
           VACUUM;`
        ])
      )
    );
    const manifests: DictionaryResourcePublicationManifest[] = [];
    const identities = new Set<string>();
    for (const publication of options.publications) {
      const identity = `${publication.work}:${publication.language}`;
      if (identities.has(identity))
        throw new Error(
          `dictionary-publication-identity-duplicate:${identity}`
        );
      identities.add(identity);
      const result = await buildDictionaryResourcePublication({
        ...publication,
        sqlitePath: path.join(normalizedRoot, `${publication.work}.sqlite`),
        prepared: true,
        generatedAt: options.generatedAt,
        outputDir: path.join(stagingDir, publication.work, publication.language)
      });
      manifests.push(result.manifest);
    }
    await mkdir(path.dirname(outputDir), { recursive: true });
    await rename(stagingDir, outputDir);
    return manifests;
  } catch (error) {
    await rm(stagingDir, { recursive: true, force: true });
    throw error;
  } finally {
    await rm(normalizationDir, { recursive: true, force: true });
  }
}

export async function validateDictionaryResourcePublication(
  bundleDir: string
): Promise<DictionaryResourcePublicationManifest> {
  const root = path.resolve(bundleDir);
  const manifestPath = path.join(root, "manifest.json");
  const manifestStat = await lstat(manifestPath);
  if (!manifestStat.isFile())
    throw new Error("dictionary-publication-manifest-invalid");
  const manifest = decodeDictionaryManifest(
    JSON.parse(await readFile(manifestPath, "utf8"))
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
  const canonical = decodeCanonicalDictionary(
    JSON.parse(await readFile(canonicalPath, "utf8"))
  );
  if (
    canonical.resourceId !== manifest.identity.resourceId ||
    canonical.work !== manifest.identity.work ||
    canonical.language !== manifest.identity.language ||
    JSON.stringify(canonical.editorial) !==
      JSON.stringify(manifest.editorial) ||
    canonical.revision !== manifest.revision ||
    canonical.revision !==
      deriveDictionaryRevision(canonical.work, canonical.language, canonical) ||
    canonical.sourceVersion !== manifest.provenance.sourceVersion ||
    canonical.sourceSha256 !== manifest.provenance.sourceSha256 ||
    JSON.stringify(countCanonical(canonical)) !==
      JSON.stringify(manifest.counts) ||
    JSON.stringify(deriveAlphabeticalBrowse(canonical)) !==
      JSON.stringify(manifest.alphabeticalBrowse)
  ) {
    throw new Error("dictionary-publication-declaration-mismatch");
  }

  const extractedDir = await mkdtemp(
    path.join(tmpdir(), "dictionary-publication-validate-")
  );
  try {
    await assertSingleBoundedZipEntry(archivePath);
    await execFileAsync("unzip", [
      "-qq",
      archivePath,
      currentArchiveEntry,
      "-d",
      extractedDir
    ]);
    const sqlitePath = path.join(extractedDir, currentArchiveEntry);
    if (!(await lstat(sqlitePath)).isFile()) {
      throw new Error("dictionary-publication-offline-entry-type-invalid");
    }
    if (
      (await sha256File(sqlitePath)) !== manifest.offlineArtifact.contentSha256
    ) {
      throw new Error("dictionary-publication-offline-content-mismatch");
    }
    const offline = await readDictionarySqlite(sqlitePath, canonical.language);
    if (
      JSON.stringify(offline.entries) !== JSON.stringify(canonical.entries) ||
      JSON.stringify(offline.verseAnchors) !==
        JSON.stringify(canonical.verseAnchors)
    ) {
      throw new Error("dictionary-publication-offline-content-mismatch");
    }
    const metadataRows = await queryJson<{
      resource_id: string;
      work: string;
      language: string;
      revision: string;
      source_version: string;
      source_sha256: string;
    }>(
      sqlitePath,
      "SELECT resource_id, work, language, revision, source_version, source_sha256 FROM RESOURCE_METADATA"
    );
    const metadata = metadataRows[0];
    if (
      metadataRows.length !== 1 ||
      metadata?.resource_id !==
        `dictionary:${canonical.work}:${canonical.language}` ||
      metadata.work !== canonical.work ||
      metadata.language !== canonical.language ||
      metadata.revision !== canonical.revision ||
      metadata.source_version !== canonical.sourceVersion ||
      metadata.source_sha256 !== canonical.sourceSha256
    ) {
      throw new Error("dictionary-publication-offline-metadata-mismatch");
    }
  } finally {
    await rm(extractedDir, { recursive: true, force: true });
  }
  return manifest;
}

type DictionaryCatalogContracts = {
  catalogPath: string;
  inventoryPath: string;
  requiredIdsPath: string;
};

const dictionaryBundleDirectories = async (root: string): Promise<string[]> => {
  const bundles: string[] = [];
  for (const work of await readdir(path.resolve(root), {
    withFileTypes: true
  })) {
    if (!work.isDirectory()) continue;
    if (existsSync(path.join(root, work.name, "manifest.json"))) {
      bundles.push(path.join(root, work.name));
      continue;
    }
    for (const language of await readdir(path.join(root, work.name), {
      withFileTypes: true
    })) {
      if (language.isDirectory()) {
        bundles.push(path.join(root, work.name, language.name));
      }
    }
  }
  return bundles.sort();
};

const zipEntryBytes = async (archivePath: string, entry: string) => {
  const { stdout } = await execFileAsync("zipinfo", ["-l", archivePath, entry]);
  const line = stdout
    .split(/\r?\n/u)
    .find((value) => value.trimEnd().endsWith(` ${entry}`));
  const bytes = Number(line?.trim().split(/\s+/u)[3]);
  if (!Number.isSafeInteger(bytes) || bytes <= 0) {
    throw new Error("dictionary-publication-offline-size-invalid");
  }
  return bytes;
};

export async function synchronizeDictionaryCatalogContracts(
  root: string,
  contracts: DictionaryCatalogContracts
): Promise<string[]> {
  const [catalog, inventory, required] = await Promise.all([
    readFile(contracts.catalogPath, "utf8").then((value) => JSON.parse(value)),
    readFile(contracts.inventoryPath, "utf8").then((value) =>
      JSON.parse(value)
    ),
    readFile(contracts.requiredIdsPath, "utf8").then((value) =>
      JSON.parse(value)
    )
  ]);
  if (
    !catalog?.resources ||
    !Array.isArray(inventory) ||
    !Array.isArray(required?.resourceIds)
  ) {
    throw new Error("dictionary-publication-catalog-contract-invalid");
  }
  const inventoryById = new Map<
    string,
    { id: string } & Record<string, unknown>
  >(
    inventory.map((item: { id: string } & Record<string, unknown>) => [
      item.id,
      item
    ])
  );
  const ids: string[] = [];
  for (const bundleDir of await dictionaryBundleDirectories(root)) {
    if (existsSync(path.join(bundleDir, "manifest.json"))) {
      const candidate = JSON.parse(
        await readFile(path.join(bundleDir, "manifest.json"), "utf8")
      ) as { identity?: { kind?: string } };
      if (candidate.identity?.kind === "dictionary-directory") {
        const manifest =
          await validateDictionaryDirectoryResourcePublication(bundleDir);
        const id = "dictionary-directory";
        const file = "dictionaries/dictionary-directory.sqlite.zip";
        const contentBytes = await zipEntryBytes(
          path.join(bundleDir, manifest.offlineArtifact.path),
          manifest.offlineArtifact.entry
        );
        const artifactUrl = new URL(
          file,
          "https://api.bible-strong.app/v1/offline-artifacts/"
        );
        artifactUrl.searchParams.set("sha256", manifest.offlineArtifact.sha256);
        catalog.resources[id] = {
          id,
          url: artifactUrl.toString(),
          file,
          entry: manifest.offlineArtifact.entry,
          entries: {
            canonical: {
              entry: manifest.offlineArtifact.entry,
              sha256: manifest.offlineArtifact.contentSha256,
              bytes: contentBytes
            }
          },
          archiveSha256: manifest.offlineArtifact.sha256,
          archiveBytes: manifest.offlineArtifact.bytes,
          contentSha256: manifest.offlineArtifact.contentSha256,
          contentBytes,
          resourceRevision: manifest.revision,
          installedBytes: contentBytes,
          peakInstallationBytes: Math.ceil(
            (manifest.offlineArtifact.bytes + contentBytes) * 1.15
          ),
          strategy: "archive-extract"
        };
        inventoryById.set(id, {
          id,
          artifactUrl: `https://assets.bible-strong.app/${file}`,
          sources: [
            {
              role: "canonical",
              sourceUrl: `https://assets.bible-strong.app/${file.replace(/\.zip$/u, "")}`,
              entry: manifest.offlineArtifact.entry
            }
          ],
          strategy: "archive-extract",
          resourceRevision: manifest.revision
        });
        ids.push(id);
        continue;
      }
    }
    const manifest = await validateDictionaryResourcePublication(bundleDir);
    const id = `database:${manifest.identity.resourceId}:${manifest.identity.language}`;
    const file = `dictionaries/dictionary-${manifest.identity.work}-${manifest.identity.language}.sqlite.zip`;
    const contentBytes = await zipEntryBytes(
      path.join(bundleDir, manifest.offlineArtifact.path),
      manifest.offlineArtifact.entry
    );
    const artifactUrl = new URL(
      file,
      "https://api.bible-strong.app/v1/offline-artifacts/"
    );
    artifactUrl.searchParams.set("sha256", manifest.offlineArtifact.sha256);
    catalog.resources[id] = {
      id,
      url: artifactUrl.toString(),
      file,
      entry: manifest.offlineArtifact.entry,
      entries: {
        canonical: {
          entry: manifest.offlineArtifact.entry,
          sha256: manifest.offlineArtifact.contentSha256,
          bytes: contentBytes
        }
      },
      archiveSha256: manifest.offlineArtifact.sha256,
      archiveBytes: manifest.offlineArtifact.bytes,
      contentSha256: manifest.offlineArtifact.contentSha256,
      contentBytes,
      resourceRevision: manifest.revision,
      installedBytes: contentBytes,
      peakInstallationBytes: Math.ceil(
        (manifest.offlineArtifact.bytes + contentBytes) * 1.15
      ),
      strategy: "archive-extract"
    };
    inventoryById.set(id, {
      id,
      artifactUrl: `https://assets.bible-strong.app/${file}`,
      sources: [
        {
          role: "canonical",
          sourceUrl: `https://assets.bible-strong.app/${file.replace(/\.zip$/u, "")}`,
          entry: manifest.offlineArtifact.entry
        }
      ],
      strategy: "archive-extract",
      resourceRevision: manifest.revision
    });
    ids.push(id);
  }
  catalog.resources = Object.fromEntries(
    Object.entries(catalog.resources).sort(([left], [right]) =>
      left.localeCompare(right)
    )
  );
  catalog.resourceCount = Object.keys(catalog.resources).length;
  catalog.generatedAt = new Date().toISOString();
  required.resourceIds = [...new Set([...required.resourceIds, ...ids])].sort();
  const transactionId = randomUUID();
  const preparedCatalogPath = `${contracts.catalogPath}.prepared-${transactionId}`;
  const preparedInventoryPath = `${contracts.inventoryPath}.prepared-${transactionId}`;
  const preparedRequiredIdsPath = `${contracts.requiredIdsPath}.prepared-${transactionId}`;
  try {
    await Promise.all([
      writeFile(
        preparedCatalogPath,
        `${JSON.stringify(catalog, null, 2)}\n`,
        "utf8"
      ),
      writeFile(
        preparedInventoryPath,
        `${JSON.stringify(
          [...inventoryById.values()].sort(
            (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id)
          ),
          null,
          2
        )}\n`,
        "utf8"
      ),
      writeFile(
        preparedRequiredIdsPath,
        `${JSON.stringify(required, null, 2)}\n`,
        "utf8"
      )
    ]);
    await commitResourcePublicationTransaction({
      replacements: [
        {
          preparedPath: preparedCatalogPath,
          targetPath: contracts.catalogPath,
          replaceExisting: true
        },
        {
          preparedPath: preparedInventoryPath,
          targetPath: contracts.inventoryPath,
          replaceExisting: true
        },
        {
          preparedPath: preparedRequiredIdsPath,
          targetPath: contracts.requiredIdsPath,
          replaceExisting: true
        }
      ]
    });
  } finally {
    await Promise.all([
      rm(preparedCatalogPath, { force: true }),
      rm(preparedInventoryPath, { force: true }),
      rm(preparedRequiredIdsPath, { force: true })
    ]);
  }
  return ids.sort();
}

const decodeCanonicalDictionary = (
  value: unknown
): CanonicalDictionaryPublication => {
  if (!isRecord(value))
    throw new Error("dictionary-publication-canonical-invalid");
  const candidate = value as Partial<CanonicalDictionaryPublication>;
  if (
    candidate.format !== "bible-strong-canonical-dictionary" ||
    candidate.schemaVersion !== 2 ||
    !isDictionaryResourceId(candidate.resourceId) ||
    !isDictionaryWork(candidate.work) ||
    !isDictionaryLanguage(candidate.language) ||
    !isRecord(candidate.editorial) ||
    !isNonEmptyString(candidate.editorial.title) ||
    !isNonEmptyString(candidate.editorial.abbreviation) ||
    !Array.isArray(candidate.editorial.authors) ||
    candidate.editorial.authors.length === 0 ||
    candidate.editorial.authors.some((author) => !isNonEmptyString(author)) ||
    !isNonEmptyString(candidate.editorial.description) ||
    !isNonEmptyString(candidate.editorial.edition) ||
    !isNonEmptyString(candidate.editorial.source) ||
    !isNonEmptyString(candidate.revision) ||
    !isNonEmptyString(candidate.sourceVersion) ||
    !isSha256(candidate.sourceSha256) ||
    !Array.isArray(candidate.entries) ||
    !Array.isArray(candidate.verseAnchors) ||
    !Array.isArray(candidate.passageAnchors) ||
    candidate.entries.length === 0
  ) {
    throw new Error("dictionary-publication-canonical-invalid");
  }
  const entryIds = new Set<number>();
  for (const entry of candidate.entries) {
    if (
      !isRecord(entry) ||
      !isNonNegativeInteger(entry.id) ||
      entry.id === 0 ||
      !isNonEmptyString(entry.word) ||
      !isNonEmptyString(entry.normalizedWord) ||
      typeof entry.definition !== "string" ||
      (entry.correspondenceId !== undefined &&
        !isNonEmptyString(entry.correspondenceId)) ||
      entryIds.has(entry.id)
    ) {
      throw new Error("dictionary-publication-canonical-entry-invalid");
    }
    entryIds.add(entry.id);
  }
  const verseKeys = new Set<string>();
  for (const anchor of candidate.verseAnchors) {
    if (
      !isRecord(anchor) ||
      !isNonEmptyString(anchor.verseKey) ||
      !isDictionaryVerseKey(anchor.verseKey) ||
      !Array.isArray(anchor.words) ||
      anchor.words.some((word) => !isNonEmptyString(word)) ||
      verseKeys.has(anchor.verseKey)
    ) {
      throw new Error("dictionary-publication-canonical-verse-invalid");
    }
    verseKeys.add(anchor.verseKey);
  }
  const passageKeys = new Set<string>();
  for (const anchor of candidate.passageAnchors) {
    if (
      !isRecord(anchor) ||
      !isDictionaryVerseKey(anchor.verseKey) ||
      !Array.isArray(anchor.entries) ||
      anchor.entries.length === 0 ||
      passageKeys.has(anchor.verseKey)
    ) {
      throw new Error("dictionary-publication-canonical-passage-invalid");
    }
    passageKeys.add(anchor.verseKey);
    const identities = new Set<string>();
    for (const entry of anchor.entries) {
      if (
        !isRecord(entry) ||
        !isNonNegativeInteger(entry.entryId) ||
        entry.entryId === 0 ||
        !entryIds.has(entry.entryId) ||
        !["source-citation", "verse-name", "verse-phrase"].includes(
          entry.evidenceKind
        ) ||
        identities.has(`${entry.entryId}:${entry.evidenceKind}`)
      ) {
        throw new Error("dictionary-publication-canonical-passage-invalid");
      }
      identities.add(`${entry.entryId}:${entry.evidenceKind}`);
    }
  }
  return candidate as CanonicalDictionaryPublication;
};

const decodeDictionaryManifest = (
  value: unknown
): DictionaryResourcePublicationManifest => {
  const envelope = decodeResourcePublicationEnvelope(value);
  const candidate = value as Partial<DictionaryResourcePublicationManifest>;
  if (
    !isRecord(candidate.identity) ||
    candidate.identity.kind !== "dictionary" ||
    !isDictionaryResourceId(candidate.identity.resourceId) ||
    !isDictionaryWork(candidate.identity.work) ||
    !isDictionaryLanguage(candidate.identity.language) ||
    !isRecord(candidate.editorial) ||
    envelope.canonical.schemaVersion !== 2 ||
    envelope.offlineArtifact.entry !== currentArchiveEntry ||
    !isRecord(candidate.alphabeticalBrowse) ||
    !Array.isArray(candidate.alphabeticalBrowse.initials) ||
    !isRecord(candidate.alphabeticalBrowse.entryCountByInitial) ||
    !isRecord(candidate.counts) ||
    !isNonNegativeInteger(candidate.counts.entries) ||
    !isNonNegativeInteger(candidate.counts.verseAnchors) ||
    !isNonNegativeInteger(candidate.counts.wordReferences) ||
    !isNonNegativeInteger(candidate.counts.passageEntryReferences)
  ) {
    throw new Error("dictionary-publication-manifest-invalid");
  }
  return candidate as DictionaryResourcePublicationManifest;
};

const parseCliArgs = (
  args: readonly string[],
  allowed: ReadonlySet<string>
) => {
  const values: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key || !allowed.has(key))
      throw new Error(`dictionary-publication-cli-option-unknown:${key ?? ""}`);
    if (!value || value.startsWith("--"))
      throw new Error(`dictionary-publication-cli-option-value-missing:${key}`);
    if (values[key])
      throw new Error(`dictionary-publication-cli-option-duplicate:${key}`);
    values[key] = value;
  }
  return values;
};

const main = async () => {
  const [command = "build", ...rawArgs] = process.argv.slice(2);
  if (command === "sync-catalog") {
    const args = parseCliArgs(rawArgs, new Set(["--root"]));
    if (!args["--root"])
      throw new Error("dictionary-publication-cli-root-missing");
    const repositoryRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../.."
    );
    console.log(
      JSON.stringify(
        await synchronizeDictionaryCatalogContracts(args["--root"], {
          catalogPath: path.join(
            repositoryRoot,
            "packages/resource-catalog/src/mobile-resource-catalog.json"
          ),
          inventoryPath: path.join(
            repositoryRoot,
            "apps/resource-studio/config/mobile-resource-inventory.json"
          ),
          requiredIdsPath: path.join(
            repositoryRoot,
            "apps/resource-studio/config/mobile-resource-required-ids.json"
          )
        }),
        null,
        2
      )
    );
    return;
  }
  if (command === "validate") {
    const args = parseCliArgs(rawArgs, new Set(["--bundle"]));
    if (!args["--bundle"])
      throw new Error("dictionary-publication-cli-bundle-missing");
    console.log(
      JSON.stringify(
        await validateDictionaryResourcePublication(args["--bundle"]),
        null,
        2
      )
    );
    return;
  }
  const args = parseCliArgs(
    command === "build" ? rawArgs : [command, ...rawArgs],
    new Set(["--config", "--output-dir", "--work"])
  );
  if (!args["--config"] || !args["--output-dir"]) {
    throw new Error("dictionary-publication-cli-required-options-missing");
  }
  const configPath = path.resolve(args["--config"]);
  const config = JSON.parse(await readFile(configPath, "utf8")) as {
    publications: Array<DictionaryPublicationMetadata & { sqlitePath: string }>;
  };
  if (!Array.isArray(config.publications) || config.publications.length === 0) {
    throw new Error("dictionary-publication-config-empty");
  }
  const configDir = path.dirname(configPath);
  const requestedWorks = args["--work"]
    ? new Set(
        args["--work"]
          .split(",")
          .map((work) => work.trim())
          .filter(Boolean)
      )
    : undefined;
  const selectedPublications = requestedWorks
    ? config.publications.filter((publication) =>
        requestedWorks.has(publication.work)
      )
    : config.publications;
  if (requestedWorks) {
    const missingWorks = [...requestedWorks].filter(
      (work) =>
        !selectedPublications.some((publication) => publication.work === work)
    );
    if (missingWorks.length > 0)
      throw new Error(
        `dictionary-publication-cli-work-unknown:${missingWorks.join(",")}`
      );
  }
  const manifests = await buildAllDictionaryResourcePublications({
    outputDir: args["--output-dir"],
    publications: selectedPublications.map((publication) => ({
      ...publication,
      sqlitePath: path.resolve(configDir, publication.sqlitePath),
      ...(publication.correspondenceSeedsPath
        ? {
            correspondenceSeedsPath: path.resolve(
              configDir,
              publication.correspondenceSeedsPath
            )
          }
        : {})
    })),
    normalizationPublications: config.publications.map((publication) => ({
      ...publication,
      sqlitePath: path.resolve(configDir, publication.sqlitePath),
      ...(publication.correspondenceSeedsPath
        ? {
            correspondenceSeedsPath: path.resolve(
              configDir,
              publication.correspondenceSeedsPath
            )
          }
        : {})
    }))
  });
  console.log(
    JSON.stringify(
      manifests.map((manifest) => ({
        work: manifest.identity.work,
        language: manifest.identity.language,
        revision: manifest.revision
      })),
      null,
      2
    )
  );
};

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
