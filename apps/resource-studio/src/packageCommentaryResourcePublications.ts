import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import {
  mkdir,
  open,
  readFile,
  rm,
  stat,
  utimes,
  writeFile
} from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import {
  materializeCommentaryBibleLinks,
  sanitizeCommentaryPublicationHtml
} from "./commentaryPublicationHtml.js";
import { projectSdabcContent } from "./commentaryPresentation.js";
import {
  commitResourcePublicationTransaction,
  type ResourcePublicationReplacement
} from "./resourcePublicationCommit.js";

const execFileAsync = promisify(execFile);
const REPRODUCIBLE_ZIP_TIME = new Date("1980-01-01T00:00:00.000Z");
const ARTIFACT_BASE_URL = "https://api.bible-strong.app/v1/offline-artifacts/";

type Language = "en" | "fr";
type Passage = `${number}-${number}-${number}`;

type LibraryEntry = {
  id: string;
  passage: Passage;
  passageEnd?: Passage;
  resource?: { id: string };
  layer?:
    | "general-commentary"
    | "book-introduction"
    | "egw-supplement"
    | "egw-scripture-index"
    | "egw-indexed-writings";
  editorialKind?: string;
  citations?: Array<{
    paragraphId: string;
    associatedParagraphIds?: string[];
  }>;
  source: {
    language: Language;
    html: string;
    references?: Array<{ id: string; kind: "bible"; osis: string }>;
    externalSources?: Array<{
      label: string;
      url: string;
      policy: "metadata-only";
    }>;
  };
  translation?: {
    language: Language;
    html: string;
    references?: Array<{ id: string; kind: "bible"; osis: string }>;
    externalSources?: Array<{
      label: string;
      url: string;
      policy: "metadata-only";
    }>;
  } | null;
  scope?: { kind: string; start: Passage; end?: Passage };
  sourceAnchors?: Array<{ id: string; passage: Passage }>;
  translationVariants?: Array<{
    id: string;
    passage: Passage;
    translation?: {
      language: Language;
      html: string;
      references?: Array<{ id: string; kind: "bible"; osis: string }>;
    } | null;
  }>;
};

type CommentaryContentPart = {
  id: string;
  html: string;
  layer?: LibraryEntry["layer"];
};

type LibraryIndex = {
  generatedAt: string;
  sourceRevision: string | Record<string, unknown>;
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

type CanonicalNormalizedCommentary = {
  format: "bible-strong-canonical-commentary";
  schemaVersion: 2;
  resourceId: string;
  language: Language;
  revision: string;
  sourceVersion: string;
  sourceSha256: string;
  documents: Array<{ id: string; content: string }>;
  verses: Array<{ verseKey: Passage; documentIds: string[] }>;
};

type AnyCanonicalCommentary =
  CanonicalCommentary | CanonicalNormalizedCommentary;

type CommentaryManifest = {
  format: "bible-strong-resource-publication";
  schemaVersion: 1;
  identity: { kind: "commentary"; resourceId: string; language: Language };
  revision: string;
  canonical: {
    path: string;
    mediaType: "application/json";
    schemaVersion: 1 | 2;
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

const updateJsonArrayHash = <T>(
  hash: ReturnType<typeof createHash>,
  values: readonly T[]
): void => {
  hash.update("[");
  values.forEach((value, index) => {
    if (index > 0) hash.update(",");
    hash.update(JSON.stringify(value));
  });
  hash.update("]");
};

const escapeHtmlAttribute = (value: string | null | undefined): string =>
  String(value ?? "")
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;");

const sourceRevisionToken = (
  sourceRevision: LibraryIndex["sourceRevision"]
): string =>
  typeof sourceRevision === "string"
    ? sourceRevision
    : `library-${sha256Buffer(JSON.stringify(sourceRevision))}`;

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

const htmlForLanguage = (
  entry: LibraryEntry,
  language: Language
): string | undefined => {
  const appendExternalSources = (
    html: string,
    externalSources: LibraryEntry["source"]["externalSources"] = []
  ): string => {
    if (entry.resource?.id !== "egw-writings" || externalSources.length === 0) {
      return html;
    }
    const links = externalSources
      .map(
        ({ url }) =>
          `<p><br><a class="external-source" href="${escapeHtmlAttribute(url)}">View in context</a></p>`
      )
      .join("");
    return `${html}${links}`;
  };
  if (
    entry.translation?.language === language &&
    entry.translation.html.trim()
  ) {
    return sanitizeCommentaryPublicationHtml(
      appendExternalSources(
        materializeCommentaryBibleLinks(entry.translation),
        entry.translation.externalSources
      )
    );
  }
  if (entry.source.language === language && entry.source.html.trim()) {
    return sanitizeCommentaryPublicationHtml(
      appendExternalSources(
        materializeCommentaryBibleLinks(entry.source),
        entry.source.externalSources
      )
    );
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
  if (
    (entry.scope?.kind === "range" || entry.scope?.kind === "section") &&
    end
  ) {
    const from = positions.get(start);
    const to = positions.get(end);
    if (from !== undefined && to !== undefined && to >= from) {
      return passages.slice(from, to + 1);
    }
  }
  return [entry.passage];
};

export const loadCommentaryLibraryEntries = async (
  index: LibraryIndex,
  root = libraryRoot,
  selectedResourceIds?: ReadonlySet<string>
): Promise<Map<string, LibraryEntry[]>> => {
  const descriptors = new Map<
    string,
    { resourceId: string; path: string; sha256: string }
  >();
  for (const chapter of index.chapters) {
    for (const [resourceId, descriptor] of Object.entries(chapter.resources)) {
      if (selectedResourceIds && !selectedResourceIds.has(resourceId)) continue;
      descriptors.set(descriptor.path, { resourceId, ...descriptor });
    }
  }
  const entriesByResource = new Map<string, LibraryEntry[]>();
  for (const descriptor of [...descriptors.values()].sort((a, b) =>
    a.path.localeCompare(b.path)
  )) {
    const bytes = await readFile(path.join(root, descriptor.path));
    if (sha256Buffer(bytes) !== descriptor.sha256) {
      throw new Error(
        `commentary-library-chunk-sha256-mismatch:${descriptor.path}`
      );
    }
    const chunk = JSON.parse(bytes.toString("utf8")) as {
      resourceId: string;
      entries: LibraryEntry[];
    };
    if (chunk.resourceId !== descriptor.resourceId) {
      throw new Error(
        `commentary-library-chunk-resource-mismatch:${descriptor.path}`
      );
    }
    const resourceEntries = entriesByResource.get(chunk.resourceId) ?? [];
    // Entries carrying sourceAnchors are already canonical editorial units.
    // Re-expanding them would restore the provider's repeated per-verse anchors
    // and, for translated resources such as Barnes, publish several competing
    // translations of the same source note.
    resourceEntries.push(...chunk.entries);
    entriesByResource.set(chunk.resourceId, resourceEntries);
  }
  return entriesByResource;
};

export const buildCanonicalCommentary = (
  catalogResource: CatalogResource,
  language: Language,
  index: LibraryIndex,
  entries: readonly LibraryEntry[]
): CanonicalCommentary => {
  const passages = index.chapters
    .flatMap((chapter) => chapter.passages)
    .sort(comparePassages);
  const positions = new Map(
    passages.map((passage, position) => [passage, position])
  );
  const contents = new Map<Passage, CommentaryContentPart[]>();
  for (const entry of entries) {
    const html = htmlForLanguage(entry, language);
    if (!html) continue;
    for (const passage of coveredPassages(entry, passages, positions)) {
      const values = contents.get(passage) ?? [];
      if (!values.some((value) => value.id === entry.id))
        values.push({ id: entry.id, html, layer: entry.layer });
      contents.set(passage, values);
    }
  }
  const verses = [...contents.entries()]
    .filter(([, values]) => values.length > 0)
    .sort(([left], [right]) => comparePassages(left, right))
    .map(([verseKey, values]) => ({
      verseKey,
      content:
        catalogResource.id === "sdabc"
          ? projectSdabcContent(values)
          : values.map((value) => value.html).join("<hr>")
    }));
  if (verses.length === 0) {
    throw new Error(
      `commentary-publication-language-empty:${catalogResource.id}:${language}`
    );
  }
  const resourceId = publicationResourceId(catalogResource.id);
  const sourceVersion = `${sourceRevisionToken(index.sourceRevision)}:${catalogResource.id}:${language}`;
  const sourceHash = createHash("sha256");
  sourceHash.update(
    `{"resourceId":${JSON.stringify(resourceId)},"language":${JSON.stringify(language)},"sourceVersion":${JSON.stringify(sourceVersion)},"verses":`
  );
  updateJsonArrayHash(sourceHash, verses);
  sourceHash.update("}");
  const sourceSha256 = sourceHash.digest("hex");
  const revisionHash = createHash("sha256");
  updateJsonArrayHash(revisionHash, verses);
  const revision = `${resourceId.toLowerCase()}-${language}-${revisionHash.digest("hex").slice(0, 20)}`;
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

const buildCanonicalEgwWritings = async (
  catalogResource: CatalogResource,
  index: LibraryIndex,
  entries: readonly LibraryEntry[]
): Promise<CanonicalNormalizedCommentary> => {
  const artifactPath = path.join(
    workflowRoot,
    ".local/egw-export/egw-indexed-writings.json"
  );
  const artifactBytes = await readFile(artifactPath);
  const expectedArtifactSha =
    typeof index.sourceRevision === "object"
      ? index.sourceRevision.egwWritings
      : undefined;
  if (
    typeof expectedArtifactSha !== "string" ||
    sha256Buffer(artifactBytes) !== expectedArtifactSha
  ) {
    throw new Error("egw-writings-artifact-sha256-mismatch");
  }
  const paragraphs = JSON.parse(artifactBytes.toString("utf8")) as Array<{
    id: string;
    book: { title: string };
    section: { title: string; contextUrl: string };
    sourceReference: string;
    source: LibraryEntry["source"];
  }>;
  const requiredDocumentIds = new Set(
    entries.flatMap((entry) =>
      (entry.citations ?? []).flatMap(
        (citation) => citation.associatedParagraphIds ?? [citation.paragraphId]
      )
    )
  );
  const documents = paragraphs
    .filter((paragraph) => requiredDocumentIds.has(paragraph.id))
    .map((paragraph) => {
      const prose = sanitizeCommentaryPublicationHtml(
        materializeCommentaryBibleLinks(paragraph.source)
      );
      const contextLink = /^https?:\/\//iu.test(paragraph.section.contextUrl)
        ? `<p><br><a class="external-source" href="${escapeHtmlAttribute(paragraph.section.contextUrl)}">View in context</a></p>`
        : "";
      return {
        id: paragraph.id,
        content: `<h3>${escapeHtmlAttribute(paragraph.book.title)}</h3><h4>${escapeHtmlAttribute(paragraph.section.title)}</h4><p><strong>${escapeHtmlAttribute(paragraph.sourceReference)}</strong></p>${prose}${contextLink}`
      };
    });
  if (documents.length !== requiredDocumentIds.size) {
    throw new Error(
      `egw-writings-document-count-mismatch:${documents.length}:${requiredDocumentIds.size}`
    );
  }
  const documentOrder = new Map(
    documents.map((document, position) => [document.id, position])
  );

  const passages = index.chapters
    .flatMap((chapter) => chapter.passages)
    .sort(comparePassages);
  const positions = new Map(
    passages.map((passage, position) => [passage, position])
  );
  const documentsByVerse = new Map<Passage, Set<string>>();
  for (const entry of entries) {
    const documentIds = (entry.citations ?? []).flatMap(
      (citation) => citation.associatedParagraphIds ?? [citation.paragraphId]
    );
    for (const passage of coveredPassages(entry, passages, positions)) {
      const values = documentsByVerse.get(passage) ?? new Set<string>();
      for (const documentId of documentIds) values.add(documentId);
      documentsByVerse.set(passage, values);
    }
  }
  const verses = [...documentsByVerse]
    .sort(([left], [right]) => comparePassages(left, right))
    .map(([verseKey, documentIds]) => ({
      verseKey,
      documentIds: [...documentIds].sort(
        (left, right) =>
          (documentOrder.get(left) ?? Number.MAX_SAFE_INTEGER) -
          (documentOrder.get(right) ?? Number.MAX_SAFE_INTEGER)
      )
    }));
  const resourceId = publicationResourceId(catalogResource.id);
  const language = "en" as const;
  const sourceVersion = `${sourceRevisionToken(index.sourceRevision)}:${catalogResource.id}:${language}`;
  const sourceHash = createHash("sha256");
  sourceHash.update(
    `{"resourceId":${JSON.stringify(resourceId)},"language":"en","sourceVersion":${JSON.stringify(sourceVersion)},"documents":`
  );
  updateJsonArrayHash(sourceHash, documents);
  sourceHash.update(',"verses":');
  updateJsonArrayHash(sourceHash, verses);
  sourceHash.update("}");
  const revisionHash = createHash("sha256");
  updateJsonArrayHash(revisionHash, documents);
  updateJsonArrayHash(revisionHash, verses);
  return {
    format: "bible-strong-canonical-commentary",
    schemaVersion: 2,
    resourceId,
    language,
    revision: `${resourceId}-${language}-${revisionHash.digest("hex").slice(0, 20)}`,
    sourceVersion,
    sourceSha256: sourceHash.digest("hex"),
    documents,
    verses
  };
};

const writeCanonicalJson = async (
  canonicalPath: string,
  canonical: AnyCanonicalCommentary
): Promise<void> => {
  const file = await open(canonicalPath, "w");
  try {
    const metadata = {
      format: canonical.format,
      schemaVersion: canonical.schemaVersion,
      resourceId: canonical.resourceId,
      language: canonical.language,
      revision: canonical.revision,
      sourceVersion: canonical.sourceVersion,
      sourceSha256: canonical.sourceSha256
    };
    const prefix = JSON.stringify(metadata).slice(0, -1);
    await file.write(prefix);
    if (canonical.schemaVersion === 2) {
      await file.write(',"documents":[');
      for (const [index, document] of canonical.documents.entries()) {
        if (index > 0) await file.write(",");
        await file.write(JSON.stringify(document));
      }
      await file.write("]");
    }
    await file.write(',"verses":[');
    for (const [index, verse] of canonical.verses.entries()) {
      if (index > 0) await file.write(",");
      await file.write(JSON.stringify(verse));
    }
    await file.write("]}\n");
  } finally {
    await file.close();
  }
};

const createSqlite = async (
  sqlitePath: string,
  canonical: AnyCanonicalCommentary
): Promise<void> => {
  const database = new DatabaseSync(sqlitePath);
  try {
    database.exec(`
      PRAGMA journal_mode = DELETE;
      PRAGMA synchronous = FULL;
      CREATE TABLE RESOURCE_METADATA (
        resource_id TEXT NOT NULL,
        language TEXT NOT NULL,
        revision TEXT NOT NULL,
        source_version TEXT NOT NULL,
        source_sha256 TEXT NOT NULL
      );
    `);
    if (canonical.schemaVersion === 2) {
      database.exec(`
        CREATE TABLE COMMENTARY_DOCUMENTS (
          id TEXT PRIMARY KEY NOT NULL,
          content TEXT NOT NULL
        );
        CREATE TABLE COMMENTARY_VERSE_DOCUMENTS (
          verse_key TEXT NOT NULL,
          ordinal INTEGER NOT NULL,
          document_id TEXT NOT NULL REFERENCES COMMENTARY_DOCUMENTS(id),
          PRIMARY KEY (verse_key, ordinal)
        );
        CREATE INDEX COMMENTARY_VERSE_DOCUMENTS_LOOKUP
          ON COMMENTARY_VERSE_DOCUMENTS (verse_key);
      `);
      const insertDocument = database.prepare(
        "INSERT INTO COMMENTARY_DOCUMENTS (id, content) VALUES (?, ?)"
      );
      const insertAssociation = database.prepare(
        "INSERT INTO COMMENTARY_VERSE_DOCUMENTS (verse_key, ordinal, document_id) VALUES (?, ?, ?)"
      );
      database.exec("BEGIN IMMEDIATE");
      for (const document of canonical.documents) {
        insertDocument.run(document.id, document.content);
      }
      for (const verse of canonical.verses) {
        verse.documentIds.forEach((documentId, ordinal) => {
          insertAssociation.run(verse.verseKey, ordinal, documentId);
        });
      }
      database.exec("COMMIT");
    } else {
      database.exec(
        "CREATE TABLE COMMENTAIRES (id TEXT PRIMARY KEY NOT NULL, commentaires TEXT NOT NULL)"
      );
    }
    if (canonical.schemaVersion === 1) {
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
      for (const [id, commentaires] of [...chapters.entries()].sort(
        ([left], [right]) => left.localeCompare(right, "en", { numeric: true })
      )) {
        insertChapter.run(id, JSON.stringify(commentaires));
      }
      database.exec("COMMIT");
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
    database.exec("VACUUM;");
  } finally {
    database.close();
  }
  await utimes(sqlitePath, REPRODUCIBLE_ZIP_TIME, REPRODUCIBLE_ZIP_TIME);
};

const buildBundle = async (
  stagingRoot: string,
  catalogResource: CatalogResource,
  language: Language,
  canonical: AnyCanonicalCommentary,
  generatedAt: string
): Promise<{
  bundlePath: string;
  manifest: CommentaryManifest;
  sqliteBytes: number;
}> => {
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
  await writeCanonicalJson(canonicalPath, canonical);
  await createSqlite(sqlitePath, canonical);
  await execFileAsync("zip", ["-q", "-X", "-j", archivePath, sqlitePath]);
  const [canonicalStats, sqliteStats, archiveStats] = await Promise.all([
    stat(canonicalPath),
    stat(sqlitePath),
    stat(archivePath)
  ]);
  const chapters = new Set(
    canonical.verses.map((verse) =>
      verse.verseKey.split("-").slice(0, 2).join("-")
    )
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
      schemaVersion: canonical.schemaVersion,
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
      characters:
        canonical.schemaVersion === 1
          ? canonical.verses.reduce(
              (total, verse) => total + verse.content.length,
              0
            )
          : (() => {
              const lengths = new Map(
                canonical.documents.map((document) => [
                  document.id,
                  document.content.length
                ])
              );
              return canonical.verses.reduce(
                (total, verse) =>
                  total +
                  verse.documentIds.reduce(
                    (sum, id) => sum + (lengths.get(id) ?? 0),
                    0
                  ) +
                  Math.max(0, verse.documentIds.length - 1) * 4,
                0
              );
            })()
    }
  };
  await writeFile(
    path.join(bundlePath, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  await rm(path.join(bundlePath, "work"), { recursive: true, force: true });
  return { bundlePath, manifest, sqliteBytes: sqliteStats.size };
};

const prepareCatalogContractReplacements = async (
  catalogResources: readonly CatalogResource[],
  publications: readonly {
    catalogResource: CatalogResource;
    language: Language;
    manifest: CommentaryManifest;
    sqliteBytes: number;
  }[],
  stagingRoot: string
): Promise<ResourcePublicationReplacement[]> => {
  const mobileCatalog = JSON.parse(
    await readFile(mobileCatalogPath, "utf8")
  ) as MobileCatalog;
  const inventory = JSON.parse(
    await readFile(inventoryPath, "utf8")
  ) as InventoryEntry[];
  const required = JSON.parse(await readFile(requiredIdsPath, "utf8")) as {
    schemaVersion: number;
    resourceIds: string[];
    bundleRoles: Record<string, string[]>;
  };
  const publicationIds = new Set<string>();
  const inventoryById = new Map(inventory.map((item) => [item.id, item]));
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
    Object.entries(mobileCatalog.resources).sort(([left], [right]) =>
      left.localeCompare(right)
    )
  );
  mobileCatalog.resourceCount = Object.keys(mobileCatalog.resources).length;
  mobileCatalog.generatedAt = new Date().toISOString();
  required.resourceIds = [
    ...required.resourceIds,
    ...[...publicationIds]
      .filter((id) => !required.resourceIds.includes(id))
      .sort()
  ];
  const knownCatalogIds = new Set(
    catalogResources.map((resource) => resource.id)
  );
  if (knownCatalogIds.size !== catalogResources.length) {
    throw new Error("commentary-catalog-resource-id-duplicate");
  }
  await mkdir(stagingRoot, { recursive: true });
  const preparedMobileCatalogPath = path.join(
    stagingRoot,
    "mobile-resource-catalog.json"
  );
  const preparedInventoryPath = path.join(
    stagingRoot,
    "mobile-resource-inventory.json"
  );
  const preparedRequiredIdsPath = path.join(
    stagingRoot,
    "mobile-resource-required-ids.json"
  );
  await Promise.all([
    writeFile(
      preparedMobileCatalogPath,
      `${JSON.stringify(mobileCatalog, null, 2)}\n`,
      "utf8"
    ),
    writeFile(
      preparedInventoryPath,
      `${JSON.stringify(
        [...inventoryById.values()].sort((a, b) => a.id.localeCompare(b.id)),
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
  return [
    {
      preparedPath: preparedMobileCatalogPath,
      targetPath: mobileCatalogPath,
      replaceExisting: true
    },
    {
      preparedPath: preparedInventoryPath,
      targetPath: inventoryPath,
      replaceExisting: true
    },
    {
      preparedPath: preparedRequiredIdsPath,
      targetPath: requiredIdsPath,
      replaceExisting: true
    }
  ];
};

const main = async (): Promise<void> => {
  const libraryIndexPath = path.join(libraryRoot, "index.json");
  const catalogPath = path.join(workflowRoot, "data/catalog.json");
  if (!existsSync(libraryIndexPath))
    throw new Error("commentary-library-index-missing");
  const [index, catalogEnvelope] = await Promise.all([
    readFile(libraryIndexPath, "utf8").then(
      (value) => JSON.parse(value) as LibraryIndex
    ),
    readFile(catalogPath, "utf8").then(
      (value) => JSON.parse(value) as { resources: CatalogResource[] }
    )
  ]);
  const catalogResources = catalogEnvelope.resources.filter(
    (resource) => resource.languages.length > 0
  );
  if (catalogResources.length !== Object.keys(index.resources).length) {
    throw new Error(
      `commentary-catalog-library-count-mismatch:${catalogResources.length}:${Object.keys(index.resources).length}`
    );
  }
  const requestedResourceIds = new Set(
    process.argv
      .flatMap((argument, position, arguments_) =>
        arguments_[position - 1] === "--resource" ? [argument] : []
      )
      .filter(Boolean)
  );
  const selectedCatalogResources = requestedResourceIds.size
    ? catalogResources.filter((resource) =>
        requestedResourceIds.has(resource.id)
      )
    : catalogResources;
  if (selectedCatalogResources.length !== requestedResourceIds.size) {
    const unknown = [...requestedResourceIds].filter(
      (resourceId) =>
        !catalogResources.some((resource) => resource.id === resourceId)
    );
    throw new Error(
      `commentary-publication-resource-unknown:${unknown.join(",")}`
    );
  }
  const entriesByResource = await loadCommentaryLibraryEntries(
    index,
    undefined,
    new Set(selectedCatalogResources.map((resource) => resource.id))
  );
  const stagingRoot = `${outputRoot}.tmp-${process.pid}-${randomUUID()}`;
  const catalogStagingRoot = `${outputRoot}.catalog-contracts-${process.pid}-${randomUUID()}`;
  await rm(stagingRoot, { recursive: true, force: true });
  await mkdir(stagingRoot, { recursive: true });
  try {
    const publications = [];
    for (const catalogResource of selectedCatalogResources) {
      const entries = entriesByResource.get(catalogResource.id);
      if (!entries?.length)
        throw new Error(
          `commentary-library-resource-empty:${catalogResource.id}`
        );
      for (const language of catalogResource.languages) {
        const canonical =
          catalogResource.id === "egw-writings"
            ? await buildCanonicalEgwWritings(catalogResource, index, entries)
            : buildCanonicalCommentary(
                catalogResource,
                language,
                index,
                entries
              );
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
    const catalogReplacements = await prepareCatalogContractReplacements(
      catalogResources,
      publications,
      catalogStagingRoot
    );
    const bundleReplacements: ResourcePublicationReplacement[] =
      requestedResourceIds.size === 0
        ? [
            {
              preparedPath: stagingRoot,
              targetPath: outputRoot,
              replaceExisting: true
            }
          ]
        : publications.map((publication) => ({
            preparedPath: publication.bundlePath,
            targetPath: path.join(
              outputRoot,
              path.basename(publication.bundlePath)
            ),
            replaceExisting: true
          }));
    await commitResourcePublicationTransaction({
      replacements: [...bundleReplacements, ...catalogReplacements]
    });
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
          publications: publications.map((publication) => ({
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
  } finally {
    await Promise.all([
      rm(stagingRoot, { recursive: true, force: true }),
      rm(catalogStagingRoot, { recursive: true, force: true })
    ]);
  }
};

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
