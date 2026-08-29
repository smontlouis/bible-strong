import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { BOOK_IDS } from "./books.js";
import { tsvEscape } from "./render.js";
import type {
  StrongLedger,
  StrongLedgerBookMetrics,
  StrongLedgerMetrics,
  StrongLedgerVerse,
  StrongLedgerVerseMetrics
} from "./strongLedger.js";

const SCHEMA_VERSION = 1;
const SCOPE_KEY_FACTOR = 1_000_000;
const CHAPTER_KEY_FACTOR = 1_000;

interface SqliteRow {
  ref: string;
  book_id: string;
  chapter: number;
  verse: number;
  text: string;
  tokens_json: string;
  annotations_json: string;
  inventories_json: string;
  metrics_json: string;
  reader_html: string;
  advanced_html: string;
  debug_html: string;
}

interface MetricRow {
  book_id: string;
  metrics_json: string;
}

interface MetadataRow {
  value: string;
}

type SqlParam = string | number;

export function strongLedgerSqlitePath(
  outputDir: string,
  bible: string
): string {
  return path.join(outputDir, `bible-${bible}-strong.sqlite`);
}

export async function writeStrongLedgerSqlite(
  ledger: StrongLedger,
  sqlitePath: string
): Promise<void> {
  await mkdir(path.dirname(sqlitePath), { recursive: true });
  const db = openLedgerDatabase(sqlitePath);

  try {
    db.exec("BEGIN IMMEDIATE");
    db.prepare("delete from verses where bible = ?").run(ledger.bible);
    db.prepare("delete from book_metrics where bible = ?").run(ledger.bible);
    db.prepare("delete from metadata").run();

    writeMetadata(db, ledger);
    writeBookMetrics(db, ledger.bible, ledger.metrics.books);
    insertVerses(db, ledger.bible, ledger.verses);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    db.close();
  }
}

export async function replaceStrongLedgerSqliteVerses(options: {
  sqlitePath: string;
  bible: string;
  verses: StrongLedgerVerse[];
  method: string;
  metadata?: Partial<StrongLedger>;
}): Promise<StrongLedgerMetrics> {
  if (options.verses.length === 0) {
    return readStrongLedgerMetricsSqlite(options.sqlitePath);
  }

  const db = openLedgerDatabase(options.sqlitePath);

  try {
    db.exec("BEGIN IMMEDIATE");
    const deleteVerse = db.prepare(
      "delete from verses where bible = ? and ref = ?"
    );
    for (const verse of options.verses) {
      deleteVerse.run(options.bible, verse.ref);
    }
    insertVerses(db, options.bible, options.verses);

    const affectedBooks = new Set(options.verses.map((verse) => verse.bookId));
    for (const bookId of affectedBooks) {
      const bookMetrics = aggregateBookMetricsFromDatabase(
        db,
        options.bible,
        bookId
      );
      upsertBookMetric(db, options.bible, bookMetrics);
    }

    const metrics = aggregateGlobalMetricsFromDatabase(db, options.bible);
    const ledger = readStrongLedgerMetadataFromOpenDatabase(db);
    writeMetadata(db, {
      ...ledger,
      ...options.metadata,
      generatedAt: metrics.generatedAt,
      scope: "all",
      method: options.method,
      metrics,
      verses: []
    });
    db.exec("COMMIT");
    return metrics;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    db.close();
  }
}

export function readStrongLedgerSqlite(options: {
  sqlitePath: string;
  onlyRef?: string;
  includeVerses?: boolean;
}): StrongLedger {
  const db = openLedgerDatabase(options.sqlitePath);
  try {
    const ledger = readStrongLedgerMetadataFromOpenDatabase(db);
    return {
      ...ledger,
      verses:
        options.includeVerses === false
          ? []
          : readVersesFromOpenDatabase(db, ledger.bible, options.onlyRef)
    };
  } finally {
    db.close();
  }
}

export function readStrongLedgerMetricsSqlite(
  sqlitePath: string
): StrongLedgerMetrics {
  const db = openLedgerDatabase(sqlitePath);
  try {
    return readMetricsFromOpenDatabase(db);
  } finally {
    db.close();
  }
}

export function readStrongLedgerVersesSqlite(options: {
  sqlitePath: string;
  bible: string;
  onlyRef?: string;
  books?: string[];
}): StrongLedgerVerse[] {
  const db = openLedgerDatabase(options.sqlitePath);
  try {
    if (options.books && options.books.length > 0) {
      return readBooksFromOpenDatabase(db, options.bible, options.books);
    }
    return readVersesFromOpenDatabase(db, options.bible, options.onlyRef);
  } finally {
    db.close();
  }
}

export function readStrongLedgerVersesByRefsSqlite(options: {
  sqlitePath: string;
  bible: string;
  refs: string[];
}): StrongLedgerVerse[] {
  const refs = [...new Set(options.refs)].filter(Boolean);
  if (refs.length === 0) return [];
  const db = openLedgerDatabase(options.sqlitePath);
  try {
    db.exec("create temp table requested_refs (ref text primary key)");
    const insert = db.prepare(
      "insert or ignore into requested_refs (ref) values (?)"
    );
    for (const ref of refs) insert.run(ref);
    const rows = db
      .prepare(
        `select v.ref, v.book_id, v.chapter, v.verse, v.text,
                v.tokens_json, v.annotations_json, v.inventories_json,
                v.metrics_json, v.reader_html, v.advanced_html, v.debug_html
         from verses v
         inner join requested_refs requested on requested.ref = v.ref
         where v.bible = ?
         order by v.book_order, v.chapter, v.verse`
      )
      .all(options.bible) as unknown as SqliteRow[];
    return rows.map(rowToVerse);
  } finally {
    db.close();
  }
}

export async function exportStrongLedgerTsvSqlite(options: {
  sqlitePath: string;
  bible: string;
  outputPath: string;
  mode: "reader" | "advanced";
}): Promise<void> {
  await mkdir(path.dirname(options.outputPath), { recursive: true });
  const db = openLedgerDatabase(options.sqlitePath);
  const stream = createWriteStream(options.outputPath, { encoding: "utf8" });

  try {
    stream.write("book_id\tnum_chapter\tnum_verse\ttext\n");
    const rows = db
      .prepare(
        `select book_id, chapter, verse, reader_html, advanced_html
         from verses
         where bible = ?
         order by book_order, chapter, verse`
      )
      .iterate(options.bible) as Iterable<{
      book_id: string;
      chapter: number;
      verse: number;
      reader_html: string;
      advanced_html: string;
    }>;

    for (const row of rows) {
      const html =
        options.mode === "reader" ? row.reader_html : row.advanced_html;
      if (
        !stream.write(
          `${row.book_id}\t${row.chapter}\t${row.verse}\t${tsvEscape(html)}\n`
        )
      ) {
        await onceDrain(stream);
      }
    }
  } finally {
    db.close();
    await closeStream(stream);
  }
}

function openLedgerDatabase(sqlitePath: string): DatabaseSync {
  const db = new DatabaseSync(sqlitePath);
  db.exec(`
    pragma journal_mode = WAL;
    pragma synchronous = NORMAL;
    create table if not exists metadata (
      key text primary key,
      value text not null
    );
    create table if not exists verses (
      bible text not null,
      ref text not null,
      book_id text not null,
      book_order integer not null,
      chapter integer not null,
      verse integer not null,
      text text not null,
      tokens_json text not null,
      annotations_json text not null,
      inventories_json text not null,
      metrics_json text not null,
      reader_html text not null,
      advanced_html text not null,
      debug_html text not null,
      primary key (bible, ref)
    );
    create index if not exists idx_strong_verses_scope
      on verses (bible, book_order, chapter, verse);
    create index if not exists idx_strong_verses_book
      on verses (bible, book_id, chapter, verse);
    create table if not exists book_metrics (
      bible text not null,
      book_id text not null,
      book_order integer not null,
      metrics_json text not null,
      primary key (bible, book_id)
    );
  `);
  return db;
}

function writeMetadata(db: DatabaseSync, ledger: StrongLedger): void {
  const manifest: StrongLedger = {
    ...ledger,
    split: false,
    verseFiles: undefined,
    verses: []
  };
  const upsert = db.prepare(
    `insert into metadata (key, value)
     values (?, ?)
     on conflict(key) do update set value = excluded.value`
  );
  upsert.run("schemaVersion", String(SCHEMA_VERSION));
  upsert.run("ledger", JSON.stringify(manifest));
  upsert.run("metrics", JSON.stringify(ledger.metrics));
}

function writeBookMetrics(
  db: DatabaseSync,
  bible: string,
  books: Record<string, StrongLedgerBookMetrics> | undefined
): void {
  for (const metric of Object.values(books ?? {})) {
    upsertBookMetric(db, bible, metric);
  }
}

function upsertBookMetric(
  db: DatabaseSync,
  bible: string,
  metric: StrongLedgerBookMetrics
): void {
  db.prepare(
    `insert into book_metrics (bible, book_id, book_order, metrics_json)
     values (?, ?, ?, ?)
     on conflict(bible, book_id) do update set
       book_order = excluded.book_order,
       metrics_json = excluded.metrics_json`
  ).run(
    bible,
    metric.bookId,
    bookOrderIndex(metric.bookId),
    JSON.stringify(metric)
  );
}

function insertVerses(
  db: DatabaseSync,
  bible: string,
  verses: StrongLedgerVerse[]
): void {
  const insert = db.prepare(
    `insert into verses (
       bible, ref, book_id, book_order, chapter, verse, text,
       tokens_json, annotations_json, inventories_json, metrics_json,
       reader_html, advanced_html, debug_html
     ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     on conflict(bible, ref) do update set
       book_id = excluded.book_id,
       book_order = excluded.book_order,
       chapter = excluded.chapter,
       verse = excluded.verse,
       text = excluded.text,
       tokens_json = excluded.tokens_json,
       annotations_json = excluded.annotations_json,
       inventories_json = excluded.inventories_json,
       metrics_json = excluded.metrics_json,
       reader_html = excluded.reader_html,
       advanced_html = excluded.advanced_html,
       debug_html = excluded.debug_html`
  );

  for (const verse of verses) {
    insert.run(
      bible,
      verse.ref,
      verse.bookId,
      bookOrderIndex(verse.bookId),
      verse.chapter,
      verse.verse,
      verse.text,
      JSON.stringify(verse.tokens),
      JSON.stringify(verse.annotations),
      JSON.stringify(verse.inventories),
      JSON.stringify(verse.metrics),
      verse.views.readerHtml,
      verse.views.advancedHtml,
      verse.views.debugHtml
    );
  }
}

function readStrongLedgerMetadataFromOpenDatabase(
  db: DatabaseSync
): StrongLedger {
  const row = db
    .prepare("select value from metadata where key = 'ledger'")
    .get() as MetadataRow | undefined;
  if (!row) {
    throw new Error("strong-ledger-sqlite-metadata-missing");
  }
  return JSON.parse(row.value) as StrongLedger;
}

function readMetricsFromOpenDatabase(db: DatabaseSync): StrongLedgerMetrics {
  const row = db
    .prepare("select value from metadata where key = 'metrics'")
    .get() as MetadataRow | undefined;
  if (!row) {
    throw new Error("strong-ledger-sqlite-metrics-missing");
  }
  return JSON.parse(row.value) as StrongLedgerMetrics;
}

function readVersesFromOpenDatabase(
  db: DatabaseSync,
  bible: string,
  onlyRef?: string
): StrongLedgerVerse[] {
  const predicate = scopePredicate(onlyRef);
  const rows = db
    .prepare(
      `select ref, book_id, chapter, verse, text,
              tokens_json, annotations_json, inventories_json, metrics_json,
              reader_html, advanced_html, debug_html
       from verses
       where bible = ?${predicate.sql}
       order by book_order, chapter, verse`
    )
    .all(bible, ...predicate.params) as unknown as SqliteRow[];
  return rows.map(rowToVerse);
}

function readBooksFromOpenDatabase(
  db: DatabaseSync,
  bible: string,
  books: string[]
): StrongLedgerVerse[] {
  const placeholders = books.map(() => "?").join(", ");
  const rows = db
    .prepare(
      `select ref, book_id, chapter, verse, text,
              tokens_json, annotations_json, inventories_json, metrics_json,
              reader_html, advanced_html, debug_html
       from verses
       where bible = ? and book_id in (${placeholders})
       order by book_order, chapter, verse`
    )
    .all(bible, ...books) as unknown as SqliteRow[];
  return rows.map(rowToVerse);
}

function rowToVerse(row: SqliteRow): StrongLedgerVerse {
  return {
    ref: row.ref,
    bookId: row.book_id,
    chapter: row.chapter,
    verse: row.verse,
    text: row.text,
    tokens: JSON.parse(row.tokens_json) as StrongLedgerVerse["tokens"],
    annotations: JSON.parse(
      row.annotations_json
    ) as StrongLedgerVerse["annotations"],
    views: {
      readerHtml: row.reader_html,
      advancedHtml: row.advanced_html,
      debugHtml: row.debug_html
    },
    inventories: JSON.parse(
      row.inventories_json
    ) as StrongLedgerVerse["inventories"],
    metrics: JSON.parse(row.metrics_json) as StrongLedgerVerseMetrics
  };
}

function scopePredicate(scope?: string): { sql: string; params: SqlParam[] } {
  const scopes = (scope ?? "all")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (scopes.length === 0 || scopes.includes("all")) {
    return { sql: "", params: [] };
  }

  const clauses: string[] = [];
  const params: SqlParam[] = [];
  for (const item of scopes) {
    const predicate = singleScopePredicate(item);
    clauses.push(predicate.sql);
    params.push(...predicate.params);
  }

  return {
    sql: ` and (${clauses.join(" or ")})`,
    params
  };
}

function singleScopePredicate(scope: string): {
  sql: string;
  params: SqlParam[];
} {
  if (scope.includes("-")) {
    const range = parseScopeRange(scope);
    if (range) {
      return {
        sql: `((book_order * ${SCOPE_KEY_FACTOR} + chapter * ${CHAPTER_KEY_FACTOR} + verse) between ? and ?)`,
        params: [scopeKey(range.start), scopeKey(range.end)]
      };
    }
  }

  const [bookId, rawChapter, rawVerse] = scope.split(".");
  if (!bookId) return { sql: "1 = 0", params: [] };
  if (rawChapter && rawVerse) {
    return {
      sql: "(book_id = ? and chapter = ? and verse = ?)",
      params: [
        bookId,
        Number.parseInt(rawChapter, 10),
        Number.parseInt(rawVerse, 10)
      ]
    };
  }
  if (rawChapter) {
    return {
      sql: "(book_id = ? and chapter = ?)",
      params: [bookId, Number.parseInt(rawChapter, 10)]
    };
  }
  return { sql: "(book_id = ?)", params: [bookId] };
}

function parseScopeRange(scope: string):
  | {
      start: { bookId: string; chapter: number; verse: number };
      end: { bookId: string; chapter: number; verse: number };
    }
  | undefined {
  const [rawStart, rawEnd] = scope.split("-");
  if (!rawStart || !rawEnd) return undefined;

  const start = parseScopeBound(rawStart);
  const end = parseScopeBound(rawEnd, start?.bookId);
  if (!start || !end) return undefined;

  return {
    start: {
      bookId: start.bookId,
      chapter: start.chapter ?? 1,
      verse: start.verse ?? 1
    },
    end: {
      bookId: end.bookId,
      chapter: end.chapter ?? 999,
      verse: end.verse ?? 999
    }
  };
}

function parseScopeBound(
  value: string,
  defaultBookId?: string
): { bookId: string; chapter?: number; verse?: number } | undefined {
  const parts = value.split(".");
  const bookId = parts[0]?.match(/^\d+$/u) ? defaultBookId : parts.shift();
  if (!bookId) return undefined;

  const [chapter, verse] = parts;
  return {
    bookId,
    chapter: chapter ? Number.parseInt(chapter, 10) : undefined,
    verse: verse ? Number.parseInt(verse, 10) : undefined
  };
}

function scopeKey(ref: {
  bookId: string;
  chapter: number;
  verse: number;
}): number {
  return (
    bookOrderIndex(ref.bookId) * SCOPE_KEY_FACTOR +
    ref.chapter * CHAPTER_KEY_FACTOR +
    ref.verse
  );
}

function aggregateBookMetricsFromDatabase(
  db: DatabaseSync,
  bible: string,
  bookId: string
): StrongLedgerBookMetrics {
  const rows = db
    .prepare(
      "select metrics_json from verses where bible = ? and book_id = ? order by chapter, verse"
    )
    .all(bible, bookId) as Array<{ metrics_json: string }>;
  const metric = emptyBookMetrics(bookId);
  for (const row of rows) {
    addMetrics(
      metric,
      JSON.parse(row.metrics_json) as StrongLedgerVerseMetrics
    );
  }
  finalizeCoverage(metric);
  return metric;
}

function aggregateGlobalMetricsFromDatabase(
  db: DatabaseSync,
  bible: string
): StrongLedgerMetrics {
  const rows = db
    .prepare(
      "select book_id, metrics_json from book_metrics where bible = ? order by book_order"
    )
    .all(bible) as unknown as MetricRow[];
  const generatedAt = new Date().toISOString();
  const books: Record<string, StrongLedgerBookMetrics> = {};
  const metrics: StrongLedgerMetrics = {
    bible,
    generatedAt,
    scope: "all",
    ...emptyMetricCounts(),
    books
  };

  for (const row of rows) {
    const book = JSON.parse(row.metrics_json) as StrongLedgerBookMetrics;
    books[row.book_id] = book;
    addBookMetrics(metrics, book);
  }

  finalizeCoverage(metrics);
  return metrics;
}

function emptyBookMetrics(bookId: string): StrongLedgerBookMetrics {
  return {
    bookId,
    ...emptyMetricCounts(),
    verseCount: 0
  };
}

function emptyMetricCounts(): Omit<
  StrongLedgerMetrics,
  "bible" | "generatedAt" | "scope" | "books"
> {
  return {
    verseCount: 0,
    wordCount: 0,
    readerVisibleStrongCount: 0,
    advancedStrongCount: 0,
    emptyStrongCount: 0,
    phraseStrongCount: 0,
    technicalStrongCount: 0,
    pendingHumanCount: 0,
    rejectedCount: 0,
    referenceStrongOccurrenceCount: 0,
    referenceStrongRepresentedCount: 0,
    referenceStrongCoverage: 0,
    referenceStrongCarrierCount: 0,
    referenceStrongCarrierCoverage: 0,
    originalStrongOccurrenceCount: 0,
    originalRepresentedStrongOccurrenceCount: 0,
    originalRepresentationRate: 0,
    originalStrongCarrierCount: 0,
    originalStrongCarrierRate: 0,
    semanticMissingCount: 0,
    readerMultiStrongWordCount: 0,
    readerOverBudgetStrongCount: 0,
    placementRiskCount: 0,
    placementQuality: 0,
    readerTaggedTokenCount: 0,
    advancedTaggedTokenCount: 0,
    readerTokenCoverage: 0,
    advancedTokenCoverage: 0
  };
}

function addBookMetrics(
  target: Omit<
    StrongLedgerMetrics,
    "bible" | "generatedAt" | "scope" | "books"
  >,
  source: StrongLedgerBookMetrics
): void {
  target.verseCount += source.verseCount;
  target.wordCount += source.wordCount;
  target.readerVisibleStrongCount += source.readerVisibleStrongCount;
  target.advancedStrongCount += source.advancedStrongCount;
  target.emptyStrongCount += source.emptyStrongCount;
  target.phraseStrongCount += source.phraseStrongCount;
  target.technicalStrongCount += source.technicalStrongCount;
  target.pendingHumanCount += source.pendingHumanCount;
  target.rejectedCount += source.rejectedCount;
  target.referenceStrongOccurrenceCount +=
    source.referenceStrongOccurrenceCount;
  target.referenceStrongRepresentedCount +=
    source.referenceStrongRepresentedCount;
  target.referenceStrongCarrierCount += source.referenceStrongCarrierCount;
  target.originalStrongOccurrenceCount += source.originalStrongOccurrenceCount;
  target.originalRepresentedStrongOccurrenceCount +=
    source.originalRepresentedStrongOccurrenceCount;
  target.originalStrongCarrierCount += source.originalStrongCarrierCount;
  target.semanticMissingCount += source.semanticMissingCount;
  target.readerMultiStrongWordCount += source.readerMultiStrongWordCount;
  target.readerOverBudgetStrongCount += source.readerOverBudgetStrongCount;
  target.placementRiskCount += source.placementRiskCount;
  target.readerTaggedTokenCount += source.readerTaggedTokenCount;
  target.advancedTaggedTokenCount += source.advancedTaggedTokenCount;
}

function addMetrics(
  target: Omit<
    StrongLedgerMetrics,
    "bible" | "generatedAt" | "scope" | "books"
  >,
  source: StrongLedgerVerseMetrics
): void {
  target.verseCount += 1;
  target.wordCount += source.wordCount;
  target.readerVisibleStrongCount += source.readerVisibleStrongCount;
  target.advancedStrongCount += source.advancedStrongCount;
  target.emptyStrongCount += source.emptyStrongCount;
  target.phraseStrongCount += source.phraseStrongCount;
  target.technicalStrongCount += source.technicalStrongCount;
  target.pendingHumanCount += source.pendingHumanCount;
  target.rejectedCount += source.rejectedCount;
  target.referenceStrongOccurrenceCount +=
    source.referenceStrongOccurrenceCount;
  target.referenceStrongRepresentedCount +=
    source.referenceStrongRepresentedCount;
  target.referenceStrongCarrierCount += source.referenceStrongCarrierCount;
  target.originalStrongOccurrenceCount += source.originalStrongOccurrenceCount;
  target.originalRepresentedStrongOccurrenceCount +=
    source.originalRepresentedStrongOccurrenceCount;
  target.originalStrongCarrierCount += source.originalStrongCarrierCount;
  target.semanticMissingCount += source.semanticMissingCount;
  target.readerMultiStrongWordCount += source.readerMultiStrongWordCount;
  target.readerOverBudgetStrongCount += source.readerOverBudgetStrongCount;
  target.placementRiskCount += source.placementRiskCount;
  target.readerTaggedTokenCount += source.readerTaggedTokenCount;
  target.advancedTaggedTokenCount += source.advancedTaggedTokenCount;
}

function finalizeCoverage(
  target: Omit<StrongLedgerMetrics, "bible" | "generatedAt" | "scope" | "books">
): void {
  target.referenceStrongCoverage = roundRatio(
    target.referenceStrongRepresentedCount /
      Math.max(1, target.referenceStrongOccurrenceCount)
  );
  target.referenceStrongCarrierCoverage = roundRatio(
    target.referenceStrongCarrierCount /
      Math.max(1, target.referenceStrongOccurrenceCount)
  );
  target.originalRepresentationRate = roundRatio(
    target.originalRepresentedStrongOccurrenceCount /
      Math.max(1, target.originalStrongOccurrenceCount)
  );
  target.originalStrongCarrierRate = roundRatio(
    target.originalStrongCarrierCount /
      Math.max(1, target.originalStrongOccurrenceCount)
  );
  target.readerTokenCoverage = roundRatio(
    target.readerTaggedTokenCount / Math.max(1, target.wordCount)
  );
  target.advancedTokenCoverage = roundRatio(
    target.advancedTaggedTokenCount / Math.max(1, target.wordCount)
  );
  target.placementQuality = roundRatio(
    1 - target.placementRiskCount / Math.max(1, target.readerTaggedTokenCount)
  );
}

function bookOrderIndex(bookId: string): number {
  const index = BOOK_IDS.indexOf(bookId as (typeof BOOK_IDS)[number]);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function roundRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10000) / 10000;
}

async function onceDrain(stream: NodeJS.WritableStream): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const cleanup = (): void => {
      stream.off("drain", onDrain);
      stream.off("error", onError);
    };
    const onDrain = (): void => {
      cleanup();
      resolve();
    };
    const onError = (error: Error): void => {
      cleanup();
      reject(error);
    };
    stream.once("drain", onDrain);
    stream.once("error", onError);
  });
}

async function closeStream(stream: NodeJS.WritableStream): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const cleanup = (): void => {
      stream.off("error", onError);
    };
    const onError = (error: Error): void => {
      cleanup();
      reject(error);
    };
    stream.once("error", onError);
    stream.end(() => {
      cleanup();
      resolve();
    });
  });
}
