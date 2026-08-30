import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import {
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  utimes,
  writeFile
} from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const REPRODUCIBLE_ZIP_TIME = new Date("1980-01-01T00:00:00.000Z");
const ARTIFACT_BASE_URL = "https://api.bible-strong.app/v1/offline-artifacts/";

type Language = "en" | "fr";
type Passage = `${number}-${number}-${number}`;

type LibraryEntry = {
  id: string;
  passage: Passage;
  passageEnd?: Passage;
  source: { language: Language; html: string };
  translation?: { language: Language; html: string } | null;
  scope?: { kind: string; start: Passage; end?: Passage };
  sourceAnchors?: Array<{ id: string; passage: Passage }>;
  translationVariants?: Array<{
    id: string;
    passage: Passage;
    translation?: { language: Language; html: string } | null;
  }>;
};

type LibraryIndex = {
  generatedAt: string;
  sourceRevision: string;
  resources: Record<string, unknown>;
  chapters: Array<{
    book: number;
    chapter: number;
    passages: Passage[];
    resources: Record<string, { path: string; sha256: string }>;
  }>;
};

type CatalogResource = {
  id: string;
  title: string;
  author: string;
  languages: Language[];
  rights: string;
  source: string;
};

type CanonicalCommentary = {
  format: "bible-strong-canonical-commentary";
  schemaVersion: 1;
  resourceId: string;
  language: Language;
  revision: string;
  sourceVersion: string;
  sourceSha256: string;
  verses: Array<{ verseKey: Passage; content: string }>;
};

type CommentaryManifest = {
  format: "bible-strong-resource-publication";
  schemaVersion: 1;
  identity: { kind: "commentary"; resourceId: string; language: Language };
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
    online: true;
    offline: true;
  };
  deliveryCapabilities: { onlineAccess: true; offlineDownload: true };
  counts: { chapters: number; verses: number; characters: number };
};

type MobileCatalog = {
  format: string;
  schemaVersion: number;
  generatedAt: string;
  resourceCount: number;
  resources: Record<string, Record<string, unknown>>;
};

type InventoryEntry = {
  id: string;
  artifactUrl: string;
  sources: Array<{ role: "canonical"; sourceUrl: string; entry: string }>;
  strategy: "archive-extract";
  resourceRevision?: string;
};

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);
const workflowRoot = path.join(
  repositoryRoot,
  "apps/resource-studio/workflows/commentaries"
);
const libraryRoot = path.join(workflowRoot, ".local/library");
const outputRoot = path.join(
  repositoryRoot,
  "apps/resource-studio/outputs/resource-publications/commentaries"
);
const mobileCatalogPath = path.join(
  repositoryRoot,
  "packages/resource-catalog/src/mobile-resource-catalog.json"
);
const inventoryPath = path.join(
  repositoryRoot,
  "apps/resource-studio/config/mobile-resource-inventory.json"
);
const requiredIdsPath = path.join(
  repositoryRoot,
  "apps/resource-studio/config/mobile-resource-required-ids.json"
);

const sha256Buffer = (value: Buffer | string): string =>
  createHash("sha256").update(value).digest("hex");

const sha256File = async (filePath: string): Promise<string> => {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
};

const parsePassage = (value: Passage): [number, number, number] =>
  value.split("-").map(Number) as [number, number, number];

const comparePassages = (left: Passage, right: Passage): number => {
  const a = parsePassage(left);
  const b = parsePassage(right);
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
};

const publicationResourceId = (catalogId: string): string =>
  catalogId === "mhy-fr" ? "MHY" : catalogId;

const offlineEntry = (catalogId: string, language: Language): string =>
  catalogId === "mhy-fr" && language === "fr"
    ? "commentaires-mhy.sqlite"
    : `commentary-${catalogId}-${language}.sqlite`;

const mobileCatalogId = (resourceId: string, language: Language): string =>
  `database:${resourceId}:${language}`;

const stableArtifactFile = (catalogId: string, language: Language): string =>
  catalogId === "mhy-fr" && language === "fr"
    ? "databases/commentaires-mhy.sqlite.zip"
    : `commentaries/commentary-${catalogId}-${language}.sqlite.zip`;

const expandBarnesEntry = (entry: LibraryEntry): LibraryEntry[] => {
  if (!entry.sourceAnchors?.length) return [entry];
  const variants = new Map(
    (entry.translationVariants ?? []).map(variant => [variant.id, variant.translation])
  );
  return entry.sourceAnchors.map((anchor, index) => ({
    ...entry,
    id: anchor.id,
    passage: anchor.passage,
    passageEnd: undefined,
    scope: undefined,
    sourceAnchors: undefined,
    translationVariants: undefined,
    translation: index === 0 ? entry.translation : (variants.get(anchor.id) ?? null)
  }));
};

const htmlForLanguage = (entry: LibraryEntry, language: Language): string | undefined => {
  if (entry.translation?.language === language && entry.translation.html.trim()) {
    return entry.translation.html.trim();
  }
  if (entry.source.language === language && entry.source.html.trim()) {
    return entry.source.html.trim();
  }
  return undefined;
};

const coveredPassages = (
  entry: LibraryEntry,
  passages: readonly Passage[],
  positions: ReadonlyMap<Passage, number>
): readonly Passage[] => {
  const start = entry.scope?.start ?? entry.passage;
  if (entry.scope?.kind === "chapter") {
    return [entry.passage];
  }
  const end = entry.scope?.end ?? entry.passageEnd;
  if ((entry.scope?.kind === "range" || entry.scope?.kind === "section") && end) {
    const from = positions.get(start);
    const to = positions.get(end);
    if (from !== undefined && to !== undefined && to >= from) {
      return passages.slice(from, to + 1);
    }
  }
  return [entry.passage];
};

const loadEntries = async (
  index: LibraryIndex
): Promise<Map<string, LibraryEntry[]>> => {
  const descriptors = new Map<string, { resourceId: string; path: string; sha256: string }>();
  for (const chapter of index.chapters) {
    for (const [resourceId, descriptor] of Object.entries(chapter.resources)) {
      descriptors.set(descriptor.path, { resourceId, ...descriptor });
    }
  }
  const entriesByResource = new Map<string, LibraryEntry[]>();
  for (const descriptor of [...descriptors.values()].sort((a, b) => a.path.localeCompare(b.path))) {
    const bytes = await readFile(path.join(libraryRoot, descriptor.path));
    if (sha256Buffer(bytes) !== descriptor.sha256) {
      throw new Error(`commentary-library-chunk-sha256-mismatch:${descriptor.path}`);
    }
    const chunk = JSON.parse(bytes.toString("utf8")) as {
      resourceId: string;
      entries: LibraryEntry[];
    };
    if (chunk.resourceId !== descriptor.resourceId) {
      throw new Error(`commentary-library-chunk-resource-mismatch:${descriptor.path}`);
    }
    const resourceEntries = entriesByResource.get(chunk.resourceId) ?? [];
    resourceEntries.push(...chunk.entries.flatMap(expandBarnesEntry));
    entriesByResource.set(chunk.resourceId, resourceEntries);
  }
  return entriesByResource;
};

const buildCanonical = (
  catalogResource: CatalogResource,
  language: Language,
  index: LibraryIndex,
  entries: readonly LibraryEntry[]
): CanonicalCommentary => {
  const passages = index.chapters.flatMap(chapter => chapter.passages).sort(comparePassages);
  const positions = new Map(passages.map((passage, position) => [passage, position]));
  const contents = new Map<Passage, Array<{ id: string; html: string }>>();
  for (const entry of entries) {
    const html = htmlForLanguage(entry, language);
    if (!html) continue;
    for (const passage of coveredPassages(entry, passages, positions)) {
      const values = contents.get(passage) ?? [];
      if (!values.some(value => value.id === entry.id)) values.push({ id: entry.id, html });
      contents.set(passage, values);
    }
  }
  const verses = [...contents.entries()]
    .filter(([, values]) => values.length > 0)
    .sort(([left], [right]) => comparePassages(left, right))
    .map(([verseKey, values]) => ({
      verseKey,
      content: values.map(value => value.html).join("<hr>")
    }));
  if (verses.length === 0) {
    throw new Error(`commentary-publication-language-empty:${catalogResource.id}:${language}`);
  }
  const resourceId = publicationResourceId(catalogResource.id);
  const sourceVersion = `${index.sourceRevision}:${catalogResource.id}:${language}`;
  const sourceSha256 = sha256Buffer(
    JSON.stringify({ resourceId, language, sourceVersion, verses })
  );
  const revision = `${resourceId.toLowerCase()}-${language}-${sha256Buffer(
    JSON.stringify(verses)
  ).slice(0, 20)}`;
  return {
    format: "bible-strong-canonical-commentary",
    schemaVersion: 1,
    resourceId,
    language,
    revision,
    sourceVersion,
    sourceSha256,
    verses
  };
};

const createSqlite = async (
  sqlitePath: string,
  canonical: CanonicalCommentary
): Promise<void> => {
  const database = new DatabaseSync(sqlitePath);
  try {
    database.exec(`
      PRAGMA journal_mode = DELETE;
      PRAGMA synchronous = FULL;
      CREATE TABLE COMMENTAIRES (id TEXT PRIMARY KEY NOT NULL, commentaires TEXT NOT NULL);
      CREATE TABLE RESOURCE_METADATA (
        resource_id TEXT NOT NULL,
        language TEXT NOT NULL,
        revision TEXT NOT NULL,
        source_version TEXT NOT NULL,
        source_sha256 TEXT NOT NULL
      );
    `);
    const chapters = new Map<string, Record<string, string>>();
    for (const verse of canonical.verses) {
      const [book, chapter, number] = parsePassage(verse.verseKey);
      const key = `${book}-${chapter}`;
      const values = chapters.get(key) ?? {};
      values[String(number)] = verse.content;
      chapters.set(key, values);
    }
    const insertChapter = database.prepare(
      "INSERT INTO COMMENTAIRES (id, commentaires) VALUES (?, ?)"
    );
    database.exec("BEGIN IMMEDIATE");
    for (const [id, commentaires] of [...chapters.entries()].sort(([left], [right]) =>
      left.localeCompare(right, "en", { numeric: true })
    )) {
      insertChapter.run(id, JSON.stringify(commentaires));
    }
    database
      .prepare("INSERT INTO RESOURCE_METADATA VALUES (?, ?, ?, ?, ?)")
      .run(
        canonical.resourceId,
        canonical.language,
        canonical.revision,
        canonical.sourceVersion,
        canonical.sourceSha256
      );
    database.exec("COMMIT; VACUUM;");
  } finally {
    database.close();
  }
  await utimes(sqlitePath, REPRODUCIBLE_ZIP_TIME, REPRODUCIBLE_ZIP_TIME);
};

const buildBundle = async (
  stagingRoot: string,
  catalogResource: CatalogResource,
  language: Language,
  canonical: CanonicalCommentary,
  generatedAt: string
): Promise<{ bundlePath: string; manifest: CommentaryManifest; sqliteBytes: number }> => {
  const stem =
    catalogResource.id === "mhy-fr" && language === "fr"
      ? "mhy-fr"
      : `${catalogResource.id}-${language}`;
  const entry = offlineEntry(catalogResource.id, language);
  const bundlePath = path.join(stagingRoot, stem);
  const canonicalRelativePath = `canonical/${stem}.json`;
  const offlineRelativePath = `offline/${entry}.zip`;
  const canonicalPath = path.join(bundlePath, canonicalRelativePath);
  const sqlitePath = path.join(bundlePath, "work", entry);
  const archivePath = path.join(bundlePath, offlineRelativePath);
  await mkdir(path.dirname(canonicalPath), { recursive: true });
  await mkdir(path.dirname(sqlitePath), { recursive: true });
  await mkdir(path.dirname(archivePath), { recursive: true });
  await writeFile(canonicalPath, `${JSON.stringify(canonical)}\n`, "utf8");
  await createSqlite(sqlitePath, canonical);
  await execFileAsync("zip", ["-q", "-X", "-j", archivePath, sqlitePath]);
  const [canonicalStats, sqliteStats, archiveStats] = await Promise.all([
    stat(canonicalPath),
    stat(sqlitePath),
    stat(archivePath)
  ]);
  const chapters = new Set(
    canonical.verses.map(verse => verse.verseKey.split("-").slice(0, 2).join("-"))
  );
  const manifest: CommentaryManifest = {
    format: "bible-strong-resource-publication",
    schemaVersion: 1,
    identity: {
      kind: "commentary",
      resourceId: canonical.resourceId,
      language
    },
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
      entry,
      sha256: await sha256File(archivePath),
      bytes: archiveStats.size,
      contentSha256: await sha256File(sqlitePath)
    },
    provenance: {
      generator: "bible-lexicon-maker",
      sourceVersion: canonical.sourceVersion,
      sourceSha256: canonical.sourceSha256,
      generatedAt
    },
    rights: {
      holder: catalogResource.rights,
      termsReference: catalogResource.rights,
      attribution: `${catalogResource.title} — ${catalogResource.author}`,
      online: true,
      offline: true
    },
    deliveryCapabilities: { onlineAccess: true, offlineDownload: true },
    counts: {
      chapters: chapters.size,
      verses: canonical.verses.length,
      characters: canonical.verses.reduce((total, verse) => total + verse.content.length, 0)
    }
  };
  await writeFile(path.join(bundlePath, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await rm(path.join(bundlePath, "work"), { recursive: true, force: true });
  return { bundlePath, manifest, sqliteBytes: sqliteStats.size };
};

const synchronizeCatalogContracts = async (
  catalogResources: readonly CatalogResource[],
  publications: readonly {
    catalogResource: CatalogResource;
    language: Language;
    manifest: CommentaryManifest;
    sqliteBytes: number;
  }[]
): Promise<void> => {
  const mobileCatalog = JSON.parse(await readFile(mobileCatalogPath, "utf8")) as MobileCatalog;
  const inventory = JSON.parse(await readFile(inventoryPath, "utf8")) as InventoryEntry[];
  const required = JSON.parse(await readFile(requiredIdsPath, "utf8")) as {
    schemaVersion: number;
    resourceIds: string[];
    bundleRoles: Record<string, string[]>;
  };
  const publicationIds = new Set<string>();
  const inventoryById = new Map(inventory.map(item => [item.id, item]));
  for (const publication of publications) {
    const { catalogResource, language, manifest, sqliteBytes } = publication;
    const id = mobileCatalogId(manifest.identity.resourceId, language);
    publicationIds.add(id);
    const file = stableArtifactFile(catalogResource.id, language);
    const artifactUrl = new URL(file, ARTIFACT_BASE_URL);
    artifactUrl.searchParams.set("sha256", manifest.offlineArtifact.sha256);
    mobileCatalog.resources[id] = {
      id,
      url: artifactUrl.toString(),
      file,
      entry: manifest.offlineArtifact.entry,
      entries: {
        canonical: {
          entry: manifest.offlineArtifact.entry,
          sha256: manifest.offlineArtifact.contentSha256,
          bytes: sqliteBytes
        }
      },
      archiveSha256: manifest.offlineArtifact.sha256,
      archiveBytes: manifest.offlineArtifact.bytes,
      contentSha256: manifest.offlineArtifact.contentSha256,
      contentBytes: sqliteBytes,
      resourceRevision: manifest.revision,
      installedBytes: sqliteBytes,
      peakInstallationBytes: Math.ceil(
        (manifest.offlineArtifact.bytes + sqliteBytes) * 1.15
      ),
      strategy: "archive-extract"
    };
    const assetFile = file.replace(/^commentaries\//, "commentaries/");
    inventoryById.set(id, {
      id,
      artifactUrl: `https://assets.bible-strong.app/${assetFile}`,
      sources: [
        {
          role: "canonical",
          sourceUrl: `https://assets.bible-strong.app/${assetFile.replace(/\.zip$/u, "")}`,
          entry: manifest.offlineArtifact.entry
        }
      ],
      strategy: "archive-extract",
      resourceRevision: manifest.revision
    });
  }
  mobileCatalog.resources = Object.fromEntries(
    Object.entries(mobileCatalog.resources).sort(([left], [right]) => left.localeCompare(right))
  );
  mobileCatalog.resourceCount = Object.keys(mobileCatalog.resources).length;
  mobileCatalog.generatedAt = new Date().toISOString();
  required.resourceIds = [
    ...required.resourceIds,
    ...[...publicationIds].filter(id => !required.resourceIds.includes(id)).sort()
  ];
  const knownCatalogIds = new Set(catalogResources.map(resource => resource.id));
  if (knownCatalogIds.size !== catalogResources.length) {
    throw new Error("commentary-catalog-resource-id-duplicate");
  }
  await Promise.all([
    writeFile(mobileCatalogPath, `${JSON.stringify(mobileCatalog, null, 2)}\n`, "utf8"),
    writeFile(
      inventoryPath,
      `${JSON.stringify([...inventoryById.values()].sort((a, b) => a.id.localeCompare(b.id)), null, 2)}\n`,
      "utf8"
    ),
    writeFile(requiredIdsPath, `${JSON.stringify(required, null, 2)}\n`, "utf8")
  ]);
};

const main = async (): Promise<void> => {
  const libraryIndexPath = path.join(libraryRoot, "index.json");
  const catalogPath = path.join(workflowRoot, "data/catalog.json");
  if (!existsSync(libraryIndexPath)) throw new Error("commentary-library-index-missing");
  const [index, catalogEnvelope] = await Promise.all([
    readFile(libraryIndexPath, "utf8").then(value => JSON.parse(value) as LibraryIndex),
    readFile(catalogPath, "utf8").then(
      value => JSON.parse(value) as { resources: CatalogResource[] }
    )
  ]);
  const catalogResources = catalogEnvelope.resources.filter(resource => resource.languages.length > 0);
  if (catalogResources.length !== Object.keys(index.resources).length) {
    throw new Error(
      `commentary-catalog-library-count-mismatch:${catalogResources.length}:${Object.keys(index.resources).length}`
    );
  }
  const entriesByResource = await loadEntries(index);
  const stagingRoot = `${outputRoot}.tmp-${process.pid}-${randomUUID()}`;
  await rm(stagingRoot, { recursive: true, force: true });
  await mkdir(stagingRoot, { recursive: true });
  try {
    const publications = [];
    for (const catalogResource of catalogResources) {
      const entries = entriesByResource.get(catalogResource.id);
      if (!entries?.length) throw new Error(`commentary-library-resource-empty:${catalogResource.id}`);
      for (const language of catalogResource.languages) {
        const canonical = buildCanonical(catalogResource, language, index, entries);
        const bundle = await buildBundle(
          stagingRoot,
          catalogResource,
          language,
          canonical,
          index.generatedAt
        );
        publications.push({ catalogResource, language, ...bundle });
      }
    }
    await synchronizeCatalogContracts(catalogResources, publications);
    await rm(outputRoot, { recursive: true, force: true });
    await mkdir(path.dirname(outputRoot), { recursive: true });
    await rename(stagingRoot, outputRoot);
    console.log(
      JSON.stringify(
        {
          outputRoot,
          resourceCount: catalogResources.length,
          publicationCount: publications.length,
          verseCount: publications.reduce(
            (total, publication) => total + publication.manifest.counts.verses,
            0
          ),
          publications: publications.map(publication => ({
            resourceId: publication.manifest.identity.resourceId,
            language: publication.language,
            revision: publication.manifest.revision,
            bundlePath: path.relative(
              repositoryRoot,
              path.join(outputRoot, path.basename(publication.bundlePath))
            )
          }))
        },
        null,
        2
      )
    );
  } catch (error) {
    await rm(stagingRoot, { recursive: true, force: true });
    throw error;
  }
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
