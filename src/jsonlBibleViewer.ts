import { createReadStream, existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";

import { BOOK_IDS } from "./books.js";

const JSONL_BIBLE_SOURCES = [
  {
    id: "OST",
    label: "Ostervald",
    shortLabel: "OST",
    sourceVersion: "OST",
    relativePath:
      "outputs/releases/strong-jsonl-permissive/bible-ost-strong.jsonl",
    manifestPath: "outputs/releases/strong-jsonl-permissive/manifests/ost.json"
  },
  {
    id: "FMAR",
    label: "Martin",
    shortLabel: "FMAR",
    sourceVersion: "FMAR",
    relativePath:
      "outputs/releases/strong-jsonl-permissive/bible-fmar-strong.jsonl",
    manifestPath: "outputs/releases/strong-jsonl-permissive/manifests/fmar.json"
  },
  {
    id: "NVS78P",
    label: "NVS78P",
    shortLabel: "NVS78P",
    sourceVersion: "NVS78P",
    relativePath:
      "outputs/releases/strong-jsonl-permissive/bible-nvs78p-strong.jsonl",
    manifestPath:
      "outputs/releases/strong-jsonl-permissive/manifests/nvs78p.json"
  },
  {
    id: "NEG79",
    label: "Nouvelle Édition de Genève 1979",
    shortLabel: "NEG79",
    sourceVersion: "NEG79",
    relativePath:
      "outputs/releases/strong-jsonl-permissive/bible-neg79-strong.jsonl",
    manifestPath:
      "outputs/releases/strong-jsonl-permissive/manifests/neg79.json"
  },
  {
    id: "NBS",
    label: "Nouvelle Bible Segond",
    shortLabel: "NBS",
    sourceVersion: "NBS",
    relativePath:
      "outputs/releases/strong-jsonl-permissive/bible-nbs-strong.jsonl",
    manifestPath: "outputs/releases/strong-jsonl-permissive/manifests/nbs.json"
  },
  {
    id: "DBY",
    label: "Darby",
    shortLabel: "DBY",
    sourceVersion: "DARBY",
    relativePath: "outputs/releases/strong-jsonl/bible-darby-strong.jsonl",
    manifestPath: "outputs/releases/strong-jsonl/manifests/darby.json"
  },
  {
    id: "DBYR",
    label: "Darby révisée",
    shortLabel: "DBYR",
    sourceVersion: "DARBYR",
    relativePath: "outputs/releases/strong-jsonl/bible-darbyr-strong.jsonl",
    manifestPath: "outputs/releases/strong-jsonl/manifests/darbyr.json"
  },
  {
    id: "LSG",
    label: "Louis Segond 1910",
    shortLabel: "LSG",
    sourceVersion: "SG1910",
    relativePath: "outputs/releases/strong-jsonl/bible-sg1910-strong.jsonl",
    manifestPath: "outputs/releases/strong-jsonl/manifests/sg1910.json"
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
      if (!existsSync(filePath)) return `${source.id}:missing`;
      const fileStats = await stat(filePath);
      return `${source.id}:${fileStats.size}:${fileStats.mtimeMs}`;
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
