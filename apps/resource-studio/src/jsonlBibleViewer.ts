import { createReadStream, existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";

import { BOOK_IDS } from "./books.js";
import {
  queryStrongBibleConcordance,
  queryStrongBibleLemmaStats,
  readStrongBibleSqliteChapter,
  readStrongBibleSqliteInfo,
  type StrongIdentityKind
} from "./strongBibleSqlite.js";

export const JSONL_BIBLE_SOURCES = [
  {
    id: "OST",
    label: "Ostervald",
    shortLabel: "OST",
    sourceVersion: "OST",
    relativePath: "outputs/strong-jsonl-permissive/ost/bible-ost-strong.jsonl",
    sqliteRelativePath:
      "outputs/releases/bible-strong-production-v5/bibles/bible-ost-strong.sqlite",
    manifestPath: "outputs/strong-jsonl-permissive/ost/manifest.json"
  },
  {
    id: "FMAR",
    label: "Martin",
    shortLabel: "FMAR",
    sourceVersion: "FMAR",
    relativePath:
      "outputs/strong-jsonl-permissive/fmar/bible-fmar-strong.jsonl",
    sqliteRelativePath:
      "outputs/releases/bible-strong-production-v5/bibles/bible-fmar-strong.sqlite",
    manifestPath: "outputs/strong-jsonl-permissive/fmar/manifest.json"
  },
  {
    id: "NVS78P",
    label: "NVS78P",
    shortLabel: "NVS78P",
    sourceVersion: "NVS78P",
    relativePath:
      "outputs/strong-jsonl-permissive/nvs78p/bible-nvs78p-strong.jsonl",
    sqliteRelativePath:
      "outputs/releases/bible-strong-production-v5/bibles/bible-nvs78p-strong.sqlite",
    manifestPath: "outputs/strong-jsonl-permissive/nvs78p/manifest.json"
  },
  {
    id: "NEG79",
    label: "Nouvelle Édition de Genève 1979",
    shortLabel: "NEG79",
    sourceVersion: "NEG79",
    relativePath:
      "outputs/strong-jsonl-permissive/neg79/bible-neg79-strong.jsonl",
    sqliteRelativePath:
      "outputs/releases/bible-strong-production-v5/bibles/bible-neg79-strong.sqlite",
    manifestPath: "outputs/strong-jsonl-permissive/neg79/manifest.json"
  },
  {
    id: "NBS",
    label: "Nouvelle Bible Segond",
    shortLabel: "NBS",
    sourceVersion: "NBS",
    relativePath: "outputs/strong-jsonl-permissive/nbs/bible-nbs-strong.jsonl",
    sqliteRelativePath:
      "outputs/releases/bible-strong-production-v5/bibles/bible-nbs-strong.sqlite",
    manifestPath: "outputs/strong-jsonl-permissive/nbs/manifest.json"
  },
  {
    id: "DBY",
    label: "Darby",
    shortLabel: "DBY",
    sourceVersion: "DARBY",
    relativePath: "outputs/releases/strong-jsonl-v3/bible-darby-strong.jsonl",
    sqliteRelativePath:
      "outputs/releases/bible-strong-production-v5/bibles/bible-dby-strong.sqlite",
    manifestPath: "outputs/releases/strong-jsonl-v3/manifests/darby.json"
  },
  {
    id: "DBYR",
    label: "Darby révisée",
    shortLabel: "DBYR",
    sourceVersion: "DARBYR",
    relativePath: "outputs/releases/strong-jsonl-v3/bible-darbyr-strong.jsonl",
    sqliteRelativePath:
      "outputs/releases/bible-strong-production-v5/bibles/bible-dbyr-strong.sqlite",
    manifestPath: "outputs/releases/strong-jsonl-v3/manifests/darbyr.json"
  },
  {
    id: "LSG",
    label: "Louis Segond 1910",
    shortLabel: "LSG",
    sourceVersion: "SG1910",
    relativePath: "outputs/releases/strong-jsonl-v3/bible-sg1910-strong.jsonl",
    sqliteRelativePath:
      "outputs/releases/bible-strong-production-v5/bibles/bible-lsg-strong.sqlite",
    manifestPath: "outputs/releases/strong-jsonl-v3/manifests/sg1910.json"
  }
] as const;

export type JsonlBibleId = (typeof JSONL_BIBLE_SOURCES)[number]["id"];

export interface JsonlBibleVerse {
  ref: string;
  version: string;
  book: number;
  bookId: string;
  chapter: number;
  verse: number;
  text: string;
}

export interface JsonlBibleCatalogVersion {
  id: JsonlBibleId;
  label: string;
  shortLabel: string;
  sourceVersion: string;
  available: boolean;
  path: string;
  sizeBytes: number;
  sha256?: string;
  verseCount: number;
  taggedTokenCount?: number;
  enrichedTagCount?: number;
  books: Array<{ bookId: string; chapters: number[]; verseCount: number }>;
}

export interface JsonlBibleCatalog {
  generatedAt: string;
  versions: JsonlBibleCatalogVersion[];
  books: Array<{ bookId: string; chapters: number[] }>;
}

export interface JsonlBibleChapter {
  bookId: string;
  chapter: number;
  versions: Array<{
    id: JsonlBibleId;
    label: string;
    shortLabel: string;
    sourceVersion: string;
    verses: JsonlBibleVerse[];
  }>;
}

export interface JsonlBibleConcordance {
  version: JsonlBibleId;
  versionLabel: string;
  requestedCode: string;
  matchedKind: StrongIdentityKind;
  matchedCode: string;
  lemmaFilter?: {
    lemma: string;
    partOfSpeech?: string;
  };
  total: number;
  limit: number;
  offset: number;
  items: Array<{
    ref: string;
    bookId: string;
    chapter: number;
    verse: number;
    surface: string;
    startOffset: number;
    endOffset: number;
    text: string;
  }>;
}

export interface JsonlBibleLemmaStats {
  available: boolean;
  version: JsonlBibleId;
  versionLabel: string;
  datasetVersion?: string;
  requestedCode: string;
  matchedKind?: StrongIdentityKind;
  matchedCode?: string;
  total: number;
  resolved: number;
  unresolvedAmbiguous: number;
  unavailable: number;
  lemmas: Array<{
    lemma: string;
    partOfSpeech: string;
    occurrences: number;
  }>;
}

interface CatalogCacheEntry {
  fingerprint: string;
  value: JsonlBibleCatalog;
}

const catalogCache = new Map<string, CatalogCacheEntry>();
const chapterCache = new Map<string, Promise<JsonlBibleVerse[]>>();

export class JsonlBibleViewerError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string
  ) {
    super(code);
  }
}

export function parseJsonlBibleIds(value: string | null): JsonlBibleId[] {
  const requested = (value ?? JSONL_BIBLE_SOURCES.map(({ id }) => id).join(","))
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
  if (requested.length === 0) {
    throw new JsonlBibleViewerError(400, "missing-jsonl-bible-version");
  }
  const allowed = new Set(JSONL_BIBLE_SOURCES.map(({ id }) => id));
  const unique = [...new Set(requested)];
  if (unique.some((id) => !allowed.has(id as JsonlBibleId))) {
    throw new JsonlBibleViewerError(400, "invalid-jsonl-bible-version");
  }
  return unique as JsonlBibleId[];
}

export async function getJsonlBibleCatalog(options: {
  root: string;
}): Promise<JsonlBibleCatalog> {
  const root = path.resolve(options.root);
  const fingerprint = await sourceFingerprint(root);
  const cached = catalogCache.get(root);
  if (cached?.fingerprint === fingerprint) return cached.value;

  const versions = await Promise.all(
    JSONL_BIBLE_SOURCES.map(async (source) => {
      const filePath = path.resolve(root, source.relativePath);
      const sqlitePath = path.resolve(root, source.sqliteRelativePath);
      if (existsSync(sqlitePath)) {
        const [fileStats, info] = await Promise.all([
          stat(sqlitePath),
          Promise.resolve(readStrongBibleSqliteInfo(sqlitePath))
        ]);
        if (
          info.datasetId !== source.id ||
          info.version !== source.sourceVersion
        ) {
          throw new JsonlBibleViewerError(
            500,
            `sqlite-bible-metadata-mismatch:${source.id}`
          );
        }
        return {
          ...source,
          available: true,
          path: source.sqliteRelativePath,
          sizeBytes: fileStats.size,
          sha256: info.sourceSha256,
          verseCount: info.verseCount,
          taggedTokenCount: info.occurrenceCount,
          enrichedTagCount: info.identityCount - info.occurrenceCount,
          books: info.books
        } satisfies JsonlBibleCatalogVersion;
      }
      if (!existsSync(filePath)) {
        return {
          ...source,
          available: false,
          path: source.relativePath,
          sizeBytes: 0,
          verseCount: 0,
          books: []
        } satisfies JsonlBibleCatalogVersion;
      }
      const [fileStats, outline, manifest] = await Promise.all([
        stat(filePath),
        scanJsonlBibleOutline(filePath, source.sourceVersion),
        readManifestMetrics(root, source)
      ]);
      return {
        ...source,
        available: true,
        path: source.relativePath,
        sizeBytes: fileStats.size,
        sha256: manifest.sha256,
        verseCount: outline.verseCount,
        taggedTokenCount: manifest.taggedTokenCount,
        enrichedTagCount: manifest.enrichedTagCount,
        books: outline.books
      } satisfies JsonlBibleCatalogVersion;
    })
  );
  const chaptersByBook = new Map<string, Set<number>>();
  for (const version of versions) {
    for (const book of version.books) {
      const chapters = chaptersByBook.get(book.bookId) ?? new Set<number>();
      for (const chapter of book.chapters) chapters.add(chapter);
      chaptersByBook.set(book.bookId, chapters);
    }
  }
  const value: JsonlBibleCatalog = {
    generatedAt: new Date().toISOString(),
    versions,
    books: BOOK_IDS.filter((bookId) => chaptersByBook.has(bookId)).map(
      (bookId) => ({
        bookId,
        chapters: [...(chaptersByBook.get(bookId) ?? [])].sort((a, b) => a - b)
      })
    )
  };
  catalogCache.set(root, { fingerprint, value });
  return value;
}

export async function getJsonlBibleChapter(options: {
  root: string;
  versions: JsonlBibleId[];
  bookId: string;
  chapter: number;
}): Promise<JsonlBibleChapter> {
  if (!BOOK_IDS.includes(options.bookId as (typeof BOOK_IDS)[number])) {
    throw new JsonlBibleViewerError(400, "invalid-book");
  }
  if (!Number.isSafeInteger(options.chapter) || options.chapter < 1) {
    throw new JsonlBibleViewerError(400, "invalid-chapter");
  }
  const selected = options.versions.map((id) => {
    const source = JSONL_BIBLE_SOURCES.find((item) => item.id === id);
    if (!source) {
      throw new JsonlBibleViewerError(400, "invalid-jsonl-bible-version");
    }
    return source;
  });
  const versions = await Promise.all(
    selected.map(async (source) => {
      const filePath = path.resolve(options.root, source.relativePath);
      const sqlitePath = path.resolve(options.root, source.sqliteRelativePath);
      if (existsSync(sqlitePath)) {
        return {
          id: source.id,
          label: source.label,
          shortLabel: source.shortLabel,
          sourceVersion: source.sourceVersion,
          verses: readStrongBibleSqliteChapter({
            sqlitePath,
            bookId: options.bookId,
            chapter: options.chapter
          })
        };
      }
      if (!existsSync(filePath)) {
        throw new JsonlBibleViewerError(
          404,
          `jsonl-bible-not-found:${source.id}`
        );
      }
      return {
        id: source.id,
        label: source.label,
        shortLabel: source.shortLabel,
        sourceVersion: source.sourceVersion,
        verses: await readJsonlBibleChapter({
          filePath,
          sourceVersion: source.sourceVersion,
          bookId: options.bookId,
          chapter: options.chapter
        })
      };
    })
  );
  return { bookId: options.bookId, chapter: options.chapter, versions };
}

export function getJsonlBibleConcordance(options: {
  root: string;
  version: JsonlBibleId;
  code: string;
  bookId?: string;
  lemma?: string;
  partOfSpeech?: string;
  limit?: number;
  offset?: number;
}): JsonlBibleConcordance {
  const source = JSONL_BIBLE_SOURCES.find(
    (item) => item.id === options.version
  );
  if (!source) {
    throw new JsonlBibleViewerError(400, "invalid-jsonl-bible-version");
  }
  const sqlitePath = path.resolve(options.root, source.sqliteRelativePath);
  if (!existsSync(sqlitePath)) {
    throw new JsonlBibleViewerError(
      404,
      `strong-bible-sqlite-not-found:${source.id}`
    );
  }
  const requestedCode = options.code.trim();
  if (!/^[GH]\d{1,5}[A-Za-z]*$/u.test(requestedCode)) {
    throw new JsonlBibleViewerError(400, "invalid-concordance-code");
  }
  const kinds: StrongIdentityKind[] = /[A-Za-z]$/u.test(requestedCode)
    ? ["dstrong", "estrong"]
    : ["strong"];
  const candidates = [
    requestedCode,
    requestedCode.replace(
      /^([GH])0*(\d+)/u,
      (_, family, digits) => `${family}${String(digits).padStart(4, "0")}`
    )
  ].filter((value, index, values) => values.indexOf(value) === index);
  for (const kind of kinds) {
    for (const code of candidates) {
      const result = queryStrongBibleConcordance({
        sqlitePath,
        kind,
        code,
        bookId: options.bookId,
        lemma: options.lemma,
        partOfSpeech: options.partOfSpeech,
        limit: options.limit,
        offset: options.offset
      });
      if (result.total > 0) {
        return {
          version: source.id,
          versionLabel: source.label,
          requestedCode,
          matchedKind: kind,
          matchedCode: code,
          ...(options.lemma !== undefined
            ? {
                lemmaFilter: {
                  lemma: options.lemma,
                  ...(options.partOfSpeech !== undefined
                    ? { partOfSpeech: options.partOfSpeech }
                    : {})
                }
              }
            : {}),
          total: result.total,
          limit: Math.min(Math.max(options.limit ?? 20, 1), 100),
          offset: Math.max(options.offset ?? 0, 0),
          items: result.items
        };
      }
    }
  }
  return {
    version: source.id,
    versionLabel: source.label,
    requestedCode,
    matchedKind: kinds[0]!,
    matchedCode: requestedCode,
    total: 0,
    limit: Math.min(Math.max(options.limit ?? 20, 1), 100),
    offset: Math.max(options.offset ?? 0, 0),
    items: []
  };
}

export function getJsonlBibleLemmaStats(options: {
  root: string;
  version: JsonlBibleId;
  code: string;
}): JsonlBibleLemmaStats {
  const source = JSONL_BIBLE_SOURCES.find(
    (item) => item.id === options.version
  );
  if (!source) {
    throw new JsonlBibleViewerError(400, "invalid-jsonl-bible-version");
  }
  const requestedCode = options.code.trim();
  if (!/^[GH]\d{1,5}[A-Za-z]*$/u.test(requestedCode)) {
    throw new JsonlBibleViewerError(400, "invalid-lemma-code");
  }
  const unavailable = {
    available: false,
    version: source.id,
    versionLabel: source.label,
    requestedCode,
    total: 0,
    resolved: 0,
    unresolvedAmbiguous: 0,
    unavailable: 0,
    lemmas: []
  } satisfies JsonlBibleLemmaStats;
  const sqlitePath = path.resolve(options.root, source.sqliteRelativePath);
  if (!existsSync(sqlitePath)) return unavailable;
  const info = readStrongBibleSqliteInfo(sqlitePath);
  if (info.lexemeAssignmentCount === 0) return unavailable;
  const datasetVersion = info.lemmaDatasetVersion ?? "ctb-reference-lemmas@1";
  const kinds: StrongIdentityKind[] = /[A-Za-z]$/u.test(requestedCode)
    ? ["dstrong", "estrong"]
    : ["strong"];
  const candidates = [
    requestedCode,
    requestedCode.replace(
      /^([GH])0*(\d+)/u,
      (_, family, digits) => `${family}${String(digits).padStart(4, "0")}`
    )
  ].filter((value, index, values) => values.indexOf(value) === index);
  for (const kind of kinds) {
    for (const code of candidates) {
      const result = queryStrongBibleLemmaStats({ sqlitePath, kind, code });
      if (result.total > 0) {
        return {
          available: true,
          version: source.id,
          versionLabel: source.label,
          datasetVersion,
          requestedCode,
          ...result,
          unresolvedAmbiguous: 0,
          unavailable: result.total - result.resolved
        };
      }
    }
  }
  return {
    ...unavailable,
    available: true,
    datasetVersion,
    matchedKind: kinds[0],
    matchedCode: requestedCode
  };
}

async function scanJsonlBibleOutline(
  filePath: string,
  sourceVersion: string
): Promise<{
  verseCount: number;
  books: Array<{ bookId: string; chapters: number[]; verseCount: number }>;
}> {
  const books = new Map<
    string,
    { chapters: Set<number>; verseCount: number }
  >();
  let verseCount = 0;
  for await (const verse of streamJsonlBible(filePath, sourceVersion)) {
    verseCount += 1;
    const book = books.get(verse.bookId) ?? {
      chapters: new Set<number>(),
      verseCount: 0
    };
    book.chapters.add(verse.chapter);
    book.verseCount += 1;
    books.set(verse.bookId, book);
  }
  return {
    verseCount,
    books: BOOK_IDS.filter((bookId) => books.has(bookId)).map((bookId) => {
      const book = books.get(bookId)!;
      return {
        bookId,
        chapters: [...book.chapters].sort((a, b) => a - b),
        verseCount: book.verseCount
      };
    })
  };
}

async function readJsonlBibleChapter(options: {
  filePath: string;
  sourceVersion: string;
  bookId: string;
  chapter: number;
}): Promise<JsonlBibleVerse[]> {
  const fileStats = await stat(options.filePath);
  const cacheKey = [
    options.filePath,
    fileStats.mtimeMs,
    options.bookId,
    options.chapter
  ].join(":");
  const cached = chapterCache.get(cacheKey);
  if (cached) return cached;
  const promise = (async () => {
    const verses: JsonlBibleVerse[] = [];
    let found = false;
    for await (const verse of streamJsonlBible(
      options.filePath,
      options.sourceVersion
    )) {
      const matches =
        verse.bookId === options.bookId && verse.chapter === options.chapter;
      if (matches) {
        verses.push(verse);
        found = true;
      } else if (found) {
        break;
      }
    }
    return verses;
  })();
  chapterCache.set(cacheKey, promise);
  if (chapterCache.size > 64) {
    const oldest = chapterCache.keys().next().value;
    if (oldest) chapterCache.delete(oldest);
  }
  return promise;
}

async function* streamJsonlBible(
  filePath: string,
  sourceVersion: string
): AsyncGenerator<JsonlBibleVerse> {
  const lines = createInterface({
    input: createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity
  });
  let lineNumber = 0;
  for await (const line of lines) {
    lineNumber += 1;
    if (!line.trim()) continue;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      throw new JsonlBibleViewerError(
        500,
        `invalid-jsonl:${path.basename(filePath)}:${lineNumber}`
      );
    }
    if (!isJsonlBibleVerse(value) || value.version !== sourceVersion) {
      throw new JsonlBibleViewerError(
        500,
        `invalid-jsonl-verse:${path.basename(filePath)}:${lineNumber}`
      );
    }
    yield value;
  }
}

function isJsonlBibleVerse(value: unknown): value is JsonlBibleVerse {
  if (!value || typeof value !== "object") return false;
  const verse = value as Partial<JsonlBibleVerse>;
  return (
    typeof verse.ref === "string" &&
    typeof verse.version === "string" &&
    Number.isSafeInteger(verse.book) &&
    typeof verse.bookId === "string" &&
    Number.isSafeInteger(verse.chapter) &&
    Number.isSafeInteger(verse.verse) &&
    typeof verse.text === "string"
  );
}

async function sourceFingerprint(root: string): Promise<string> {
  const parts = await Promise.all(
    JSONL_BIBLE_SOURCES.map(async (source) => {
      const filePath = path.resolve(root, source.relativePath);
      const sqlitePath = path.resolve(root, source.sqliteRelativePath);
      if (existsSync(sqlitePath)) {
        const fileStats = await stat(sqlitePath);
        return `${source.id}:sqlite:${fileStats.size}:${fileStats.mtimeMs}`;
      }
      if (!existsSync(filePath)) return `${source.id}:missing`;
      const fileStats = await stat(filePath);
      return `${source.id}:jsonl:${fileStats.size}:${fileStats.mtimeMs}`;
    })
  );
  return parts.join("|");
}

async function readManifestMetrics(
  root: string,
  source: (typeof JSONL_BIBLE_SOURCES)[number]
): Promise<{
  sha256?: string;
  taggedTokenCount?: number;
  enrichedTagCount?: number;
}> {
  const manifestPath = path.resolve(root, source.manifestPath);
  if (!existsSync(manifestPath)) return {};
  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      sha256?: string;
      artifact?: { sha256?: string };
      metrics?: { taggedTokenCount?: number; enrichedTagCount?: number };
      artifacts?: Array<{
        file?: string;
        sha256?: string;
        version?: string;
        metrics?: {
          taggedTokenCount?: number;
          enrichedTagCount?: number;
        };
      }>;
      sourceManifest?: {
        artifact?: { sha256?: string };
        metrics?: {
          taggedTokenCount?: number;
          enrichedTagCount?: number;
        };
        artifacts?: Array<{
          file?: string;
          sha256?: string;
          version?: string;
          metrics?: {
            taggedTokenCount?: number;
            enrichedTagCount?: number;
          };
        }>;
      };
    };
    const payload = manifest.sourceManifest ?? manifest;
    if (payload.metrics) {
      return {
        sha256: manifest.sha256 ?? payload.artifact?.sha256,
        taggedTokenCount: payload.metrics.taggedTokenCount,
        enrichedTagCount: payload.metrics.enrichedTagCount
      };
    }
    const artifact = payload.artifacts?.find(
      (item) => item.version === source.sourceVersion
    );
    return {
      sha256: manifest.sha256 ?? artifact?.sha256,
      taggedTokenCount: artifact?.metrics?.taggedTokenCount,
      enrichedTagCount: artifact?.metrics?.enrichedTagCount
    };
  } catch {
    return {};
  }
}
