import { createHash, randomUUID } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import {
  appendFile,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";

import { BOOK_IDS } from "./books.js";
import type { ReferenceStrongJsonlRecord } from "./referenceStrongJsonl.js";

export const CTB_REFERENCE_LEMMA_VERSION = "ctb-reference-lemmas@1";

export interface CtbWordLemma {
  lemma: string;
  partOfSpeech: string;
  strongs: string[];
  surface: string;
}

export interface CtbChapterLemmaRecord {
  schemaVersion: 2;
  bookId: string;
  chapter: number;
  sourceUrl: string;
  sourceSha256: string;
  verses: Record<string, CtbWordLemma[]>;
}

export interface CtbReferenceLemmaResult {
  artifactSha256: string;
  cachePath: string;
  cacheSha256: string;
  chapterCount: number;
  lexemeAssignmentCount: number;
  strongAlignmentMismatchCount: number;
  visibleImplicitCorrectionCount: number;
  outputPath: string;
  sizeBytes: number;
  sourceSha256: string;
  strongTagCount: number;
  verseCount: number;
  version: string;
}

export function parseCtbChapterHtml(
  html: string
): Record<string, CtbWordLemma[]> {
  const starts = [
    ...html.matchAll(
      /<span class="verse"><sup\b[^>]*\bid="v(\d+)"[^>]*>[\s\S]*?<\/sup><span class="versetxt">/giu
    )
  ];
  if (starts.length === 0) {
    throw new Error("ctb-lemma-page-without-verses");
  }
  const verses: Record<string, CtbWordLemma[]> = {};
  for (let index = 0; index < starts.length; index += 1) {
    const match = starts[index]!;
    const verse = match[1]!;
    const contentStart = (match.index ?? 0) + match[0].length;
    const contentEnd =
      index + 1 < starts.length
        ? starts[index + 1]!.index!
        : html.indexOf('<div class="clearfix">', contentStart);
    if (contentEnd < contentStart) {
      throw new Error(`ctb-lemma-invalid-verse-boundary:${verse}`);
    }
    const content = html.slice(contentStart, contentEnd);
    const words: CtbWordLemma[] = [];
    for (const word of content.matchAll(/<w\b([^>]*)>([\s\S]*?)<\/w>/giu)) {
      const attributes = parseAttributes(word[1] ?? "");
      const lexeme = parseCtbLexeme(attributes["data-lm"]);
      const strongs = [
        ...(attributes["data-pa"] ?? "").matchAll(/[hg]\d{1,5}/giu)
      ]
        .map((value) => normalizeStrong(value[0]!))
        .filter((strong) => !/^(?:H|G)0000$/u.test(strong));
      words.push({
        ...lexeme,
        strongs,
        surface: decodeEntities(stripTags(word[2] ?? "")).normalize("NFC")
      });
    }
    verses[verse] = words;
  }
  return verses;
}

export function enrichStrongTextWithCtbLemmas(options: {
  text: string;
  annotations: CtbWordLemma[];
  fallbackAnnotations?: CtbWordLemma[][];
  fallbackLexeme?: (
    surface: string,
    strongs: string[]
  ) => CtbWordLemma | undefined;
  ref: string;
}): {
  text: string;
  assignmentCount: number;
  strongAlignmentMismatchCount: number;
  visibleImplicitCorrectionCount: number;
  strongTagCount: number;
} {
  let tokenCursor = 0;
  const usedTokenIndexes = new Set<number>();
  let assignmentCount = 0;
  let strongAlignmentMismatchCount = 0;
  let visibleImplicitCorrectionCount = 0;
  let strongTagCount = 0;
  const text = options.text.replace(
    /<w\b([^>]*)>([\s\S]*?)<\/w>/giu,
    (match, rawAttributes, body) => {
      const attributes = String(rawAttributes);
      const strongValue = parseAttribute(attributes, "strong");
      if (!strongValue) return match;
      strongTagCount += 1;
      const localSurface = decodeEntities(stripTags(String(body))).normalize(
        "NFC"
      );
      const hasLexicalSurface = /[\p{L}\p{N}]/u.test(localSurface);
      const localStrongs = strongValue
        .split(/\s+/u)
        .filter(Boolean)
        .map(normalizeStrong);
      let annotationIndex = options.annotations.findIndex(
        (candidate, index) =>
          index >= tokenCursor &&
          !usedTokenIndexes.has(index) &&
          surfacesMatch(localSurface, candidate.surface)
      );
      if (annotationIndex < 0) {
        annotationIndex = options.annotations.findIndex(
          (candidate, index) =>
            !usedTokenIndexes.has(index) &&
            surfacesMatch(localSurface, candidate.surface)
        );
      }
      if (annotationIndex < 0) {
        const previousUnused = options.annotations
          .map((candidate, index) => ({ candidate, index }))
          .filter(
            ({ candidate, index }) =>
              index < tokenCursor &&
              !usedTokenIndexes.has(index) &&
              localStrongs.every((strong) => candidate.strongs.includes(strong))
          )
          .at(-1);
        if (!hasLexicalSurface && previousUnused) {
          annotationIndex = previousUnused.index;
        }
      }
      if (annotationIndex < 0 && !hasLexicalSurface) {
        const previous = options.annotations
          .map((candidate, index) => ({ candidate, index }))
          .filter(
            ({ candidate, index }) =>
              index < tokenCursor &&
              localStrongs.every((strong) => candidate.strongs.includes(strong))
          )
          .at(-1);
        if (previous) annotationIndex = previous.index;
      }
      if (annotationIndex < 0) {
        annotationIndex = options.annotations.findIndex(
          (candidate, index) =>
            !usedTokenIndexes.has(index) &&
            candidate.strongs.join(" ") === localStrongs.join(" ")
        );
      }
      if (annotationIndex < 0 && !hasLexicalSurface) {
        annotationIndex = options.annotations.findIndex((candidate) =>
          localStrongs.every((strong) => candidate.strongs.includes(strong))
        );
      }
      const fallbackAnnotation =
        annotationIndex < 0 && hasLexicalSurface
          ? options.fallbackAnnotations
              ?.flatMap((annotations) => annotations)
              .find(
                (candidate) =>
                  surfacesMatch(localSurface, candidate.surface) &&
                  (candidate.strongs.length === 0 ||
                    localStrongs.some((strong) =>
                      candidate.strongs.includes(strong)
                    ))
              )
          : undefined;
      const indexedFallbackAnnotation =
        annotationIndex < 0 && hasLexicalSurface && !fallbackAnnotation
          ? options.fallbackLexeme?.(localSurface, localStrongs)
          : undefined;
      let annotation =
        annotationIndex >= 0
          ? options.annotations[annotationIndex]
          : fallbackAnnotation
            ? fallbackAnnotation
            : indexedFallbackAnnotation
              ? indexedFallbackAnnotation
              : !hasLexicalSurface
                ? {
                    lemma: "{non traduit}",
                    partOfSpeech: "§",
                    strongs: [],
                    surface: ""
                  }
                : undefined;
      if (
        hasLexicalSurface &&
        annotation?.partOfSpeech === "§" &&
        options.fallbackLexeme
      ) {
        const lexicalFallback = options.fallbackLexeme(
          localSurface,
          localStrongs
        );
        if (lexicalFallback && lexicalFallback.partOfSpeech !== "§") {
          annotation = lexicalFallback;
          visibleImplicitCorrectionCount += 1;
        }
      }
      if (!annotation) {
        throw new Error(
          `ctb-lemma-surface-not-found:${options.ref}:${strongTagCount}:` +
            `${JSON.stringify(localSurface)}`
        );
      }
      if (annotationIndex >= 0) {
        if (hasLexicalSurface) {
          usedTokenIndexes.add(annotationIndex);
          tokenCursor = Math.max(tokenCursor, annotationIndex + 1);
        }
      }
      assignmentCount += 1;
      if (localStrongs.join(" ") !== annotation.strongs.join(" ")) {
        strongAlignmentMismatchCount += 1;
      }
      const cleanAttributes = attributes
        .replace(/\s+(?:lemma|pos)=(['"])[\s\S]*?\1/giu, "")
        .trimEnd();
      return (
        `<w${cleanAttributes}` +
        ` lemma="${escapeAttribute(annotation.lemma)}"` +
        ` pos="${escapeAttribute(annotation.partOfSpeech)}">` +
        `${body}</w>`
      );
    }
  );
  return {
    text,
    assignmentCount,
    strongAlignmentMismatchCount,
    visibleImplicitCorrectionCount,
    strongTagCount
  };
}

export async function enrichReferenceJsonlWithCtbLemmas(options: {
  baseUrl?: string;
  cachePath: string;
  concurrency?: number;
  fallbackCachePaths?: string[];
  fetchHtml?: (url: string) => Promise<string>;
  inputPath: string;
  onlyBooks?: string[];
  outputPath: string;
  siteVersion: string;
}): Promise<CtbReferenceLemmaResult> {
  const inputPath = path.resolve(options.inputPath);
  const outputPath = path.resolve(options.outputPath);
  const cachePath = path.resolve(options.cachePath);
  if (!existsSync(inputPath)) {
    throw new Error(`ctb-lemma-input-missing:${inputPath}`);
  }
  const records = await readJsonl(inputPath);
  const selectedBooks =
    options.onlyBooks && options.onlyBooks.length > 0
      ? new Set(options.onlyBooks)
      : undefined;
  const selectedRecords = selectedBooks
    ? records.filter((record) => selectedBooks.has(record.bookId))
    : records;
  if (selectedRecords.length === 0) {
    throw new Error("ctb-lemma-no-selected-verses");
  }
  const chapters = uniqueChapters(selectedRecords);
  const cache = await readChapterCache(cachePath);
  const fallbackCaches = await Promise.all(
    (options.fallbackCachePaths ?? []).map((fallbackPath) =>
      readChapterCache(path.resolve(fallbackPath))
    )
  );
  const missing = chapters.filter(
    ({ bookId, chapter }) => !cache.has(chapterKey(bookId, chapter))
  );
  if (missing.length > 0) {
    await mkdir(path.dirname(cachePath), { recursive: true });
    const fetchHtml = options.fetchHtml ?? fetchCtbHtml;
    const baseUrl = (options.baseUrl ?? "https://concordance.bible").replace(
      /\/+$/u,
      ""
    );
    let cacheWrite = Promise.resolve();
    await runConcurrent(
      missing,
      Math.max(1, Math.min(options.concurrency ?? 4, 8)),
      async ({ bookId, chapter }) => {
        const sourceUrl = `${baseUrl}/${options.siteVersion}/${bookId}/${chapter}/`;
        const html = await fetchHtml(sourceUrl);
        const record: CtbChapterLemmaRecord = {
          schemaVersion: 2,
          bookId,
          chapter,
          sourceUrl,
          sourceSha256: sha256Text(html),
          verses: parseCtbChapterHtml(html)
        };
        cache.set(chapterKey(bookId, chapter), record);
        cacheWrite = cacheWrite.then(() =>
          appendFile(cachePath, `${JSON.stringify(record)}\n`, "utf8")
        );
        await cacheWrite;
      }
    );
    await writeCanonicalChapterCache(cachePath, cache);
  }
  const lexemeIndex = buildCtbLexemeIndex([cache, ...fallbackCaches]);

  const outputRecords: ReferenceStrongJsonlRecord[] = [];
  let lexemeAssignmentCount = 0;
  let strongAlignmentMismatchCount = 0;
  let visibleImplicitCorrectionCount = 0;
  let strongTagCount = 0;
  for (const record of selectedRecords) {
    const chapter = cache.get(chapterKey(record.bookId, record.chapter));
    if (!chapter) {
      throw new Error(`ctb-lemma-cache-missing-chapter:${record.ref}`);
    }
    const annotations = chapter.verses[String(record.verse)];
    if (!annotations) {
      throw new Error(`ctb-lemma-cache-missing-verse:${record.ref}`);
    }
    const enriched = enrichStrongTextWithCtbLemmas({
      text: record.text,
      annotations,
      fallbackAnnotations: fallbackCaches
        .map((fallbackCache) =>
          fallbackCache.get(chapterKey(record.bookId, record.chapter))
        )
        .map((fallbackChapter) => fallbackChapter?.verses[String(record.verse)])
        .filter((value): value is CtbWordLemma[] => Boolean(value)),
      fallbackLexeme: (surface, strongs) =>
        strongs
          .map((strong) =>
            lexemeIndex.get(`${normalizeSurface(surface)}\u0000${strong}`)
          )
          .find((value): value is CtbWordLemma => Boolean(value)) ??
        lexemeIndex.get(`${normalizeSurface(surface)}\u0000*`),
      ref: record.ref
    });
    lexemeAssignmentCount += enriched.assignmentCount;
    strongAlignmentMismatchCount += enriched.strongAlignmentMismatchCount;
    visibleImplicitCorrectionCount += enriched.visibleImplicitCorrectionCount;
    strongTagCount += enriched.strongTagCount;
    outputRecords.push({ ...record, text: enriched.text });
  }

  const temporary = `${outputPath}.tmp-${process.pid}-${randomUUID()}`;
  await mkdir(path.dirname(outputPath), { recursive: true });
  await rm(temporary, { force: true });
  await writeFile(
    temporary,
    `${outputRecords.map((record) => JSON.stringify(record)).join("\n")}\n`,
    "utf8"
  );
  await verifyEnrichedJsonl(temporary, outputRecords.length);
  await rm(outputPath, { force: true });
  await rename(temporary, outputPath);
  const [sourceSha256, cacheSha256, artifactSha256, outputStats] =
    await Promise.all([
      sha256File(inputPath),
      sha256File(cachePath),
      sha256File(outputPath),
      stat(outputPath)
    ]);
  return {
    artifactSha256,
    cachePath,
    cacheSha256,
    chapterCount: chapters.length,
    lexemeAssignmentCount,
    strongAlignmentMismatchCount,
    visibleImplicitCorrectionCount,
    outputPath,
    sizeBytes: outputStats.size,
    sourceSha256,
    strongTagCount,
    verseCount: outputRecords.length,
    version: outputRecords[0]?.version ?? ""
  };
}

async function fetchCtbHtml(url: string): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: "text/html",
          "user-agent": "bible-lexicon-maker/ctb-authorized-import"
        }
      });
      if (!response.ok) {
        throw new Error(`http-${response.status}`);
      }
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 250));
      }
    }
  }
  throw new Error(`ctb-lemma-fetch-failed:${url}:${String(lastError)}`);
}

async function readJsonl(
  filePath: string
): Promise<ReferenceStrongJsonlRecord[]> {
  const records: ReferenceStrongJsonlRecord[] = [];
  const lines = createInterface({
    input: createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity
  });
  for await (const line of lines) {
    if (!line.trim()) continue;
    records.push(JSON.parse(line) as ReferenceStrongJsonlRecord);
  }
  return records;
}

async function readChapterCache(
  filePath: string
): Promise<Map<string, CtbChapterLemmaRecord>> {
  const cache = new Map<string, CtbChapterLemmaRecord>();
  if (!existsSync(filePath)) return cache;
  const lines = createInterface({
    input: createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity
  });
  for await (const line of lines) {
    if (!line.trim()) continue;
    const record = JSON.parse(line) as CtbChapterLemmaRecord;
    if (record.schemaVersion !== 2) continue;
    cache.set(chapterKey(record.bookId, record.chapter), record);
  }
  return cache;
}

async function writeCanonicalChapterCache(
  filePath: string,
  cache: Map<string, CtbChapterLemmaRecord>
): Promise<void> {
  const temporary = `${filePath}.tmp-${process.pid}-${randomUUID()}`;
  const records = [...cache.values()].sort(
    (left, right) =>
      BOOK_IDS.indexOf(left.bookId as (typeof BOOK_IDS)[number]) -
        BOOK_IDS.indexOf(right.bookId as (typeof BOOK_IDS)[number]) ||
      left.chapter - right.chapter
  );
  await writeFile(
    temporary,
    `${records.map((record) => JSON.stringify(record)).join("\n")}\n`,
    "utf8"
  );
  await rm(filePath, { force: true });
  await rename(temporary, filePath);
}

async function verifyEnrichedJsonl(
  filePath: string,
  expectedVerses: number
): Promise<void> {
  const source = await readFile(filePath, "utf8");
  const lines = source.trimEnd().split("\n");
  if (lines.length !== expectedVerses) {
    throw new Error(
      `ctb-lemma-output-verse-count:${lines.length}:${expectedVerses}`
    );
  }
  for (const [index, line] of lines.entries()) {
    const record = JSON.parse(line) as ReferenceStrongJsonlRecord;
    for (const match of record.text.matchAll(/<w\b([^>]*)>[\s\S]*?<\/w>/giu)) {
      const strong = parseAttribute(match[1] ?? "", "strong");
      if (
        strong &&
        (!parseAttribute(match[1] ?? "", "lemma") ||
          !parseAttribute(match[1] ?? "", "pos"))
      ) {
        throw new Error(`ctb-lemma-output-incomplete:${index + 1}`);
      }
    }
  }
}

function parseCtbLexeme(
  value: string | undefined
): Pick<CtbWordLemma, "lemma" | "partOfSpeech"> {
  if (!value?.endsWith("]")) {
    throw new Error(`ctb-lemma-invalid-lexeme:${String(value)}`);
  }
  const separator = value.lastIndexOf("[");
  if (separator <= 0) {
    throw new Error(`ctb-lemma-invalid-lexeme:${value}`);
  }
  const lemma = decodeEntities(value.slice(0, separator))
    .trim()
    .normalize("NFC");
  const partOfSpeech = decodeEntities(value.slice(separator + 1, -1))
    .trim()
    .normalize("NFC");
  if (!lemma || !partOfSpeech) {
    throw new Error(`ctb-lemma-empty-lexeme:${value}`);
  }
  return { lemma, partOfSpeech };
}

function parseAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const match of source.matchAll(/([:\w-]+)\s*=\s*(["'])([\s\S]*?)\2/gu)) {
    attributes[match[1]!.toLowerCase()] = decodeEntities(match[3] ?? "");
  }
  return attributes;
}

function parseAttribute(attributes: string, name: string): string | undefined {
  return attributes.match(
    new RegExp(`\\b${name}=(['"])([\\s\\S]*?)\\1`, "iu")
  )?.[2];
}

function normalizeStrong(value: string): string {
  const match = value.trim().match(/^([hg])0*(\d{1,5})/iu);
  if (!match) throw new Error(`ctb-lemma-invalid-strong:${value}`);
  return `${match[1]!.toUpperCase()}${Number(match[2]).toString().padStart(4, "0")}`;
}

function surfacesMatch(left: string, right: string): boolean {
  if (!left && right === "◎") return true;
  return normalizeSurface(left) === normalizeSurface(right);
}

function normalizeSurface(value: string): string {
  const normalized = value
    .normalize("NFC")
    .replace(/[’‘]/gu, "'")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("fr");
  return (
    new Map([
      ["c'", "ce"],
      ["d'", "de"],
      ["j'", "je"],
      ["l'", "le"],
      ["m'", "me"],
      ["n'", "ne"],
      ["qu'", "que"],
      ["s'", "se"],
      ["t'", "te"]
    ]).get(normalized) ?? normalized
  );
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/gu, "");
}

function decodeEntities(value: string): string {
  return value.replace(
    /&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/giu,
    (_, entity: string) => {
      const normalized = entity.toLowerCase();
      if (normalized === "amp") return "&";
      if (normalized === "lt") return "<";
      if (normalized === "gt") return ">";
      if (normalized === "quot") return '"';
      if (normalized === "apos") return "'";
      if (normalized === "nbsp") return "\u00a0";
      const codePoint = normalized.startsWith("#x")
        ? Number.parseInt(normalized.slice(2), 16)
        : Number.parseInt(normalized.slice(1), 10);
      return Number.isSafeInteger(codePoint)
        ? String.fromCodePoint(codePoint)
        : `&${entity};`;
    }
  );
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function buildCtbLexemeIndex(
  caches: Array<Map<string, CtbChapterLemmaRecord>>
): Map<string, CtbWordLemma> {
  const index = new Map<string, CtbWordLemma>();
  const ambiguousSurfaceKeys = new Set<string>();
  for (const cache of caches) {
    for (const chapter of cache.values()) {
      for (const words of Object.values(chapter.verses)) {
        for (const word of words) {
          const surface = normalizeSurface(word.surface);
          if (word.partOfSpeech !== "§") {
            const surfaceKey = `${surface}\u0000*`;
            const existing = index.get(surfaceKey);
            if (existing && existing.lemma !== word.lemma) {
              index.delete(surfaceKey);
              ambiguousSurfaceKeys.add(surfaceKey);
            } else if (!ambiguousSurfaceKeys.has(surfaceKey)) {
              index.set(surfaceKey, word);
            }
          }
          for (const strong of word.strongs) {
            const key = `${surface}\u0000${strong}`;
            const existing = index.get(key);
            if (
              !existing ||
              (existing.partOfSpeech === "§" && word.partOfSpeech !== "§")
            ) {
              index.set(key, word);
            }
          }
        }
      }
    }
  }
  return index;
}

function uniqueChapters(
  records: ReferenceStrongJsonlRecord[]
): Array<{ bookId: string; chapter: number }> {
  return [
    ...new Map(
      records.map((record) => [
        chapterKey(record.bookId, record.chapter),
        { bookId: record.bookId, chapter: record.chapter }
      ])
    ).values()
  ];
}

function chapterKey(bookId: string, chapter: number): string {
  return `${bookId}.${chapter}`;
}

async function runConcurrent<T>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<void>
): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (next < items.length) {
        const item = items[next++]!;
        await task(item);
      }
    })
  );
}

function sha256Text(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}
