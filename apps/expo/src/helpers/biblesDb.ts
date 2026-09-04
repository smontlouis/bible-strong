import * as FileSystem from 'expo-file-system/legacy'
import * as Sentry from '@sentry/react-native'
import * as SQLite from 'expo-sqlite'
import { getSharedSqliteDirPath } from '~helpers/databaseTypes'
import { databaseBiblesName } from '~helpers/databases'
import { sanitizeFtsQuery } from '~helpers/bibleSearchQuery'
import {
  findClosestBibleSearchTerm,
  highlightBibleSearchText,
  normalizeBibleSearchText,
  parseBibleTextSearchQuery,
} from '~helpers/bibleSearchInput'
import { getImportableBibleVerses } from '~helpers/bibleJsonImport'
import type { CanonicalBibleNote } from '~helpers/canonicalBibleNotes'
import type { CanonicalBibleHeading } from '~helpers/canonicalBibleHeadings'
import { getBookIdsForCanon, type BibleCanonId } from '~helpers/bibleBookCatalog'
import { versions } from '~helpers/bibleVersions'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BibleVerse {
  Livre: number
  Chapitre: number
  Verset: number
  Texte: string
  Layout?: CanonicalBibleLayoutEvent[]
  StartTags?: CanonicalBibleActiveTag[]
  Notes?: CanonicalBibleNote[]
  Headings?: CanonicalBibleHeading[]
  TextRevision?: string
}

export interface CanonicalBibleActiveTag {
  tag: string
  attributes?: Record<string, string>
}

export interface CanonicalBibleLayoutEvent {
  offset: number
  order: number
  type: 'open' | 'close' | 'self'
  tag: string
  attributes?: Record<string, string>
}

export interface CanonicalBibleVersePayload {
  text: string
  startTags: CanonicalBibleActiveTag[]
  layout: CanonicalBibleLayoutEvent[]
  notes?: CanonicalBibleNote[]
  headings?: CanonicalBibleHeading[]
}

export interface CanonicalBibleJsonData {
  format: 'bible-strong-canonical-bible'
  schemaVersion: number
  applicationVersionId: string
  datasetId: string
  sourceVersion: string
  textRevision: string
  textSha256: string
  sourceSha256: string
  verseCount: number
  noteCount?: number
  headingCount?: number
  verses: Record<string, Record<string, Record<string, CanonicalBibleVersePayload>>>
}

export type LegacyBibleJsonData = Record<string, Record<string, Record<string, string>>>
export type BibleJsonData = LegacyBibleJsonData | CanonicalBibleJsonData
type BibleVerseImportData = Record<
  string,
  Record<string, Record<string, string | CanonicalBibleVersePayload>>
>

export interface BibleVersionMetadata {
  version: string
  installedAt: number
  verseCount: number
  textRevision?: string
  textSha256?: string
  sourceSha256?: string
  schemaVersion?: number
  resourceGeneration?: string
}

export interface SearchResult {
  version: string
  book: number
  chapter: number
  verse: number
  text: string
  highlighted: string
  match?: {
    kind: 'lexical' | 'topic' | 'semantic' | 'hybrid'
    topicId?: string
    topicLabel?: string
    sources?: readonly string[]
  }
  endChapter?: number
  endVerse?: number
}

export type SearchSortOrder = 'relevance' | 'book'

export interface SearchOptions {
  signal?: AbortSignal
  version?: string
  versionIds?: readonly string[]
  book?: number
  section?: 'ot' | 'nt'
  canon?: BibleCanonId
  sortOrder?: SearchSortOrder
  limit?: number
  offset?: number
  searchLanguage?: 'fr' | 'en'
}

export interface BibleVersionCoverage {
  canon?: { id: string; orderedBooks: number[] }
  versification?: string
  books: number[]
  chaptersByBook: Record<number, number[]>
  verseCountByBookChapter: Record<string, number>
}

// ---------------------------------------------------------------------------
// Singleton with mutex to prevent concurrent opens
// ---------------------------------------------------------------------------

let db: SQLite.SQLiteDatabase | null = null
let openPromise: Promise<SQLite.SQLiteDatabase> | null = null
let inFlightCount = 0
let dbLockedForReset = false

class BibleQueryCancelledError extends Error {
  constructor() {
    super('Bible query cancelled')
    this.name = 'BibleQueryCancelledError'
  }
}

const POLL_MS = 20

async function waitForResetLock(): Promise<void> {
  while (dbLockedForReset) {
    await new Promise(r => setTimeout(r, POLL_MS))
  }
}

async function waitForInFlight(): Promise<void> {
  while (inFlightCount > 0) {
    await new Promise(r => setTimeout(r, POLL_MS))
  }
}

/** Close the DB handle WITHOUT managing the reset lock — callers must hold it. */
async function closeUnsafe(): Promise<void> {
  // If an open is still in flight, wait for it to resolve so we close the
  // instance it produced rather than orphaning it. Otherwise a concurrent
  // reset could delete the files while a stale open is completing, leaving
  // a zombie handle pointing at deleted files.
  if (openPromise) {
    try {
      await openPromise
    } catch {
      // Open failed — singleton is already cleared in openBiblesDb's catch.
    }
  }
  if (db) {
    await db.closeAsync()
    db = null
    openPromise = null
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export async function openBiblesDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db
  if (openPromise) return openPromise

  openPromise = (async () => {
    try {
      const dir = getSharedSqliteDirPath()
      const dirInfo = await FileSystem.getInfoAsync(dir)
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
      }
      const instance = await SQLite.openDatabaseAsync(
        databaseBiblesName,
        { useNewConnection: true },
        dir
      )

      await instance.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;

        CREATE TABLE IF NOT EXISTS verses (
          id INTEGER PRIMARY KEY,
          version TEXT NOT NULL,
          book INTEGER NOT NULL,
          chapter INTEGER NOT NULL,
          verse INTEGER NOT NULL,
          text TEXT NOT NULL,
          normalized_text TEXT NOT NULL DEFAULT '',
          start_tags_json TEXT NOT NULL DEFAULT '[]',
          layout_json TEXT NOT NULL DEFAULT '[]',
          notes_json TEXT NOT NULL DEFAULT '[]',
          headings_json TEXT NOT NULL DEFAULT '[]'
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_verses_lookup
          ON verses(version, book, chapter, verse);

        CREATE INDEX IF NOT EXISTS idx_verses_chapter
          ON verses(version, book, chapter);

        CREATE VIRTUAL TABLE IF NOT EXISTS verses_fts USING fts5(
          text,
          normalized_text,
          content='verses',
          content_rowid='id',
          tokenize='unicode61 remove_diacritics 2'
        );

        CREATE TABLE IF NOT EXISTS versions_meta (
          version TEXT PRIMARY KEY,
          installed_at INTEGER NOT NULL,
          verse_count INTEGER NOT NULL DEFAULT 0,
          text_revision TEXT,
          text_sha256 TEXT,
          source_sha256 TEXT,
          schema_version INTEGER,
          resource_generation TEXT
        );

        CREATE TABLE IF NOT EXISTS database_meta (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `)
      await ensureTableColumn(instance, 'verses', 'layout_json', "TEXT NOT NULL DEFAULT '[]'")
      await ensureTableColumn(instance, 'verses', 'start_tags_json', "TEXT NOT NULL DEFAULT '[]'")
      await ensureTableColumn(instance, 'verses', 'notes_json', "TEXT NOT NULL DEFAULT '[]'")
      await ensureTableColumn(instance, 'verses', 'headings_json', "TEXT NOT NULL DEFAULT '[]'")
      await ensureTableColumn(instance, 'verses', 'normalized_text', 'TEXT')
      await ensureTableColumn(instance, 'versions_meta', 'text_revision', 'TEXT')
      await ensureTableColumn(instance, 'versions_meta', 'text_sha256', 'TEXT')
      await ensureTableColumn(instance, 'versions_meta', 'source_sha256', 'TEXT')
      await ensureTableColumn(instance, 'versions_meta', 'schema_version', 'INTEGER')
      await ensureTableColumn(instance, 'versions_meta', 'resource_generation', 'TEXT')
      await ensureBibleSearchIndex(instance)

      db = instance
      openPromise = null
      console.log('[BiblesDB] Database opened and schema ensured')
      return instance
    } catch (e) {
      // Reset singleton so next call retries instead of returning rejected promise
      db = null
      openPromise = null
      throw e
    }
  })()

  return openPromise
}

export async function closeBiblesDb(): Promise<void> {
  // Gate new queries while we're shutting down, then wait for in-flight
  // operations to drain before releasing the handle. No timeout: cutting
  // off a long write (e.g. insertBibleVersion exclusive transaction) would
  // corrupt the import and defeat the purpose of this guard.
  dbLockedForReset = true
  try {
    await waitForInFlight()
    await closeUnsafe()
    console.log('[BiblesDB] Database closed')
  } finally {
    dbLockedForReset = false
  }
}

// ---------------------------------------------------------------------------
// Health check & recovery
// ---------------------------------------------------------------------------

export type DbHealthStatus = 'ok' | 'corrupted' | 'missing'

/**
 * Check if the bibles.sqlite file is healthy.
 * Requires the DB to be open — call after `openBiblesDb()`.
 */
export async function checkBiblesDbHealth(): Promise<DbHealthStatus> {
  const dir = getSharedSqliteDirPath()
  const filePath = `${dir}/${databaseBiblesName}`
  const fileInfo = await FileSystem.getInfoAsync(filePath)

  if (!fileInfo.exists) return 'missing'

  try {
    // Route through withDbError so the quick_check query participates in
    // the reset lock / in-flight tracking like every other SQL operation.
    const quickCheck = await withDbError('checkBiblesDbHealth', async () => {
      const d = await getDb()
      const row = await d.getFirstAsync<{ quick_check: string }>('PRAGMA quick_check')
      return row?.quick_check
    })
    return quickCheck === 'ok' ? 'ok' : 'corrupted'
  } catch {
    return 'corrupted'
  }
}

/**
 * Close the DB, delete the file (+ WAL/SHM), and re-open.
 * After this call all versions will appear as "not installed".
 */
export async function resetBiblesDb(): Promise<void> {
  // Hold the reset lock across the entire close → delete → reopen sequence
  // so no other query can grab the (soon-to-be-deleted) handle in between.
  dbLockedForReset = true
  try {
    await waitForInFlight()
    await closeUnsafe()

    const dir = getSharedSqliteDirPath()
    const basePath = `${dir}/${databaseBiblesName}`

    for (const suffix of ['', '-wal', '-shm']) {
      const path = `${basePath}${suffix}`
      const info = await FileSystem.getInfoAsync(path)
      if (info.exists) {
        await FileSystem.deleteAsync(path, { idempotent: true })
      }
    }

    console.log('[BiblesDB] Database files deleted, re-opening fresh')
    await openBiblesDb()
  } finally {
    dbLockedForReset = false
  }
}

/**
 * Get the database instance, opening it if necessary.
 */
async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    return openBiblesDb()
  }
  return db
}

async function ensureTableColumn(
  database: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  definition: string
): Promise<void> {
  const columns = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`)
  if (!columns.some(item => item.name === column)) {
    await database.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
}

const SEARCH_INDEX_SCHEMA_VERSION = '5'
const SEARCH_INDEX_SCHEMA_KEY = 'bible_search_schema_version'
const NORMALIZED_TEXT_MIGRATION_BATCH_SIZE = 500

const getOfflineNormalizedSearchText = (version: string, text: string) => {
  const language = versions[version]?.language
  return language === 'he' || language === 'grc' || language === 'he-grc'
    ? normalizeBibleSearchText(text)
    : ''
}

async function populateOfflineNormalizedVerseText(
  database: SQLite.SQLiteDatabase
): Promise<boolean> {
  let changed = false
  let lastId = 0

  while (true) {
    const rows = await database.getAllAsync<{ id: number; version: string; text: string }>(
      `SELECT id, version, text
       FROM verses
       WHERE id > ?
       ORDER BY id
       LIMIT ?`,
      [lastId, NORMALIZED_TEXT_MIGRATION_BATCH_SIZE]
    )
    if (rows.length === 0) return changed

    const normalizedAssignments = rows.map(() => 'WHEN ? THEN ?').join(' ')
    const ids = rows.map(() => '?').join(', ')
    const params: (string | number)[] = []
    rows.forEach(row => params.push(row.id, getOfflineNormalizedSearchText(row.version, row.text)))
    rows.forEach(row => params.push(row.id))

    await database.runAsync(
      `UPDATE verses
       SET normalized_text = CASE id ${normalizedAssignments} ELSE normalized_text END
       WHERE id IN (${ids})`,
      params
    )
    changed = true
    lastId = rows.at(-1)?.id ?? lastId
  }
}

async function ensureBibleSearchIndex(database: SQLite.SQLiteDatabase): Promise<void> {
  const [migration, ftsColumns] = await Promise.all([
    database.getFirstAsync<{ value: string }>('SELECT value FROM database_meta WHERE key = ?', [
      SEARCH_INDEX_SCHEMA_KEY,
    ]),
    database.getAllAsync<{ name: string }>('PRAGMA table_info(verses_fts)'),
  ])
  const normalizedTextChanged =
    migration?.value === SEARCH_INDEX_SCHEMA_VERSION
      ? false
      : await populateOfflineNormalizedVerseText(database)
  const requiresRebuild =
    normalizedTextChanged ||
    !ftsColumns.some(column => column.name === 'text') ||
    !ftsColumns.some(column => column.name === 'normalized_text') ||
    ftsColumns.some(column => column.name === 'stemmed_text')

  if (requiresRebuild) {
    await database.withExclusiveTransactionAsync(async () => {
      await database.execAsync(`
        DROP TABLE IF EXISTS verses_fts_vocab;
        DROP TABLE IF EXISTS verses_fts;
        CREATE VIRTUAL TABLE verses_fts USING fts5(
          text,
          normalized_text,
          content='verses',
          content_rowid='id',
          tokenize='unicode61 remove_diacritics 2'
        );
        INSERT INTO verses_fts(verses_fts) VALUES('rebuild');
      `)
    })
  }

  await database.execAsync(
    "CREATE VIRTUAL TABLE IF NOT EXISTS verses_fts_vocab USING fts5vocab(verses_fts, 'col')"
  )
  await database.runAsync(
    `INSERT INTO database_meta(key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [SEARCH_INDEX_SCHEMA_KEY, SEARCH_INDEX_SCHEMA_VERSION]
  )
}

// ---------------------------------------------------------------------------
// Error wrapper — logs + reports to Sentry, then re-throws
// ---------------------------------------------------------------------------

/**
 * Detect errors thrown when an SQLite handle was released mid-operation
 * (typically due to a concurrent close/reset).
 *
 * Matches only the specific "already released" wording — the Expo bridge
 * prefixes every native rejection with "Call to function 'NativeDatabase.*'
 * has been rejected" (see expo#28176), so matching NativeDatabase/
 * NativeStatement would also retry on unrelated SQLite errors like
 * "no such table" and mask real bugs.
 */
function isReleasedHandleError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  if (msg.includes('already released')) return true
  const cause = (e as { cause?: unknown })?.cause
  if (cause) {
    const causeMsg = cause instanceof Error ? cause.message : String(cause)
    if (causeMsg.includes('already released')) return true
  }
  return false
}

async function withDbError<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    // Acquire a slot: wait for the reset lock to clear, increment the
    // counter, then re-check the lock. This TOCTOU re-check prevents a
    // race where a reset sets the lock between our wait and our increment
    // and then closes the handle while our fn() is running.
    while (true) {
      await waitForResetLock()
      inFlightCount++
      if (!dbLockedForReset) break
      inFlightCount--
    }

    try {
      return await fn()
    } catch (e) {
      if (e instanceof BibleQueryCancelledError) throw e
      if (attempt === 0 && isReleasedHandleError(e)) {
        // DB handle was released concurrently — drop the singleton so the
        // next getDb() reopens a fresh connection, then retry once.
        db = null
        openPromise = null
        continue
      }
      console.error(`[BiblesDB] ${operation} failed:`, e)
      Sentry.withScope(scope => {
        scope.setTag('db.name', 'bibles')
        scope.setExtra('operation', operation)
        scope.setExtra('retried', attempt > 0)
        Sentry.captureException(e)
      })
      throw e
    } finally {
      inFlightCount--
    }
  }
  // Unreachable: loop either returns or throws on each iteration.
  throw new Error('[BiblesDB] withDbError: unreachable')
}

// ---------------------------------------------------------------------------
// Queries — replace loadBible / loadBibleChapter for regular versions
// ---------------------------------------------------------------------------

/**
 * Get all verses for a chapter. Returns them sorted by verse number.
 */
export function getChapterVerses(
  version: string,
  book: number,
  chapter: number
): Promise<BibleVerse[]> {
  return withDbError('getChapterVerses', async () => {
    const d = await getDb()
    const rows = await d.getAllAsync<{
      book: number
      chapter: number
      verse: number
      text: string
      layout_json: string
      start_tags_json: string
      notes_json: string
      headings_json: string
      text_revision: string | null
    }>(
      `SELECT v.book, v.chapter, v.verse, v.text, v.start_tags_json,
              v.layout_json, v.notes_json, v.headings_json, m.text_revision
       FROM verses v
       LEFT JOIN versions_meta m ON m.version = v.version
       WHERE v.version = ? AND v.book = ? AND v.chapter = ?
       ORDER BY v.verse`,
      [version, book, chapter]
    )

    return rows.map(r => ({
      Livre: r.book,
      Chapitre: r.chapter,
      Verset: r.verse,
      Texte: r.text,
      Layout: parseCanonicalLayout(r.layout_json),
      StartTags: parseCanonicalStartTags(r.start_tags_json),
      Notes: parseCanonicalNotes(r.notes_json),
      Headings: parseCanonicalHeadings(r.headings_json),
      ...(r.text_revision ? { TextRevision: r.text_revision } : {}),
    }))
  })
}

export function getBibleCanonicalHeadingVerses(version: string): Promise<BibleVerse[]> {
  return withDbError('getBibleCanonicalHeadingVerses', async () => {
    const d = await getDb()
    const rows = await d.getAllAsync<{
      book: number
      chapter: number
      verse: number
      headings_json: string
    }>(
      `SELECT book, chapter, verse, headings_json
       FROM verses
       WHERE version = ? AND headings_json != '[]'
       ORDER BY book, chapter, verse`,
      [version]
    )

    return rows.map(row => ({
      Livre: row.book,
      Chapitre: row.chapter,
      Verset: row.verse,
      Texte: '',
      Headings: parseCanonicalHeadings(row.headings_json),
    }))
  })
}

/**
 * Get a single verse's text.
 */
export function getVerseText(
  version: string,
  book: number,
  chapter: number,
  verse: number
): Promise<string | null> {
  return withDbError('getVerseText', async () => {
    const d = await getDb()
    const row = await d.getFirstAsync<{ text: string }>(
      'SELECT text FROM verses WHERE version = ? AND book = ? AND chapter = ? AND verse = ?',
      [version, book, chapter, verse]
    )
    return row?.text ?? null
  })
}

/**
 * Get text for multiple verses at once.
 * @param verseKeys Array of "book-chapter-verse" strings (e.g. "1-1-1")
 * @returns Record keyed by the same "book-chapter-verse" strings
 */
export function getMultipleVerses(
  version: string,
  verseKeys: string[],
  shouldCancel?: () => boolean
): Promise<Record<string, string>> {
  if (verseKeys.length === 0) return Promise.resolve({})

  return withDbError('getMultipleVerses', async () => {
    const d = await getDb()
    const result: Record<string, string> = {}

    // Build a single query using OR clauses, batched to avoid SQL limits
    const BATCH_SIZE = 200
    for (let i = 0; i < verseKeys.length; i += BATCH_SIZE) {
      if (shouldCancel?.()) throw new BibleQueryCancelledError()
      const batch = verseKeys.slice(i, i + BATCH_SIZE)
      const conditions = batch.map(() => '(book = ? AND chapter = ? AND verse = ?)').join(' OR ')
      const params: (string | number)[] = [version]

      for (const key of batch) {
        const [b, c, v] = key.split('-').map(Number)
        params.push(b, c, v)
      }

      const rows = await d.getAllAsync<{
        book: number
        chapter: number
        verse: number
        text: string
      }>(
        `SELECT book, chapter, verse, text FROM verses WHERE version = ? AND (${conditions})`,
        params
      )
      if (shouldCancel?.()) throw new BibleQueryCancelledError()

      for (const row of rows) {
        result[`${row.book}-${row.chapter}-${row.verse}`] = row.text
      }
    }

    return result
  })
}

/**
 * Get the verse count for a given chapter.
 */
export function getChapterVerseCount(
  version: string,
  book: number,
  chapter: number
): Promise<number> {
  return withDbError('getChapterVerseCount', async () => {
    const d = await getDb()
    const row = await d.getFirstAsync<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM verses WHERE version = ? AND book = ? AND chapter = ?',
      [version, book, chapter]
    )
    return row?.cnt ?? 0
  })
}

export function getBibleVersionCoverage(version: string): Promise<BibleVersionCoverage> {
  return withDbError('getBibleVersionCoverage', async () => {
    const d = await getDb()
    const rows = await d.getAllAsync<{
      book: number
      chapter: number
      verseCount: number
    }>(
      `SELECT book, chapter, COUNT(*) as verseCount
       FROM verses
       WHERE version = ?
       GROUP BY book, chapter
       ORDER BY book, chapter`,
      [version]
    )

    const books: number[] = []
    const chaptersByBook: Record<number, number[]> = {}
    const verseCountByBookChapter: Record<string, number> = {}

    rows.forEach(({ book, chapter, verseCount }) => {
      if (!chaptersByBook[book]) {
        chaptersByBook[book] = []
        books.push(book)
      }
      chaptersByBook[book].push(chapter)
      verseCountByBookChapter[`${book}-${chapter}`] = verseCount
    })

    return {
      books,
      chaptersByBook,
      verseCountByBookChapter,
    }
  })
}

// ---------------------------------------------------------------------------
// Version management
// ---------------------------------------------------------------------------

export function isVersionInstalled(version: string): Promise<boolean> {
  return withDbError('isVersionInstalled', async () => {
    const d = await getDb()
    const row = await d.getFirstAsync<{ version: string }>(
      'SELECT version FROM versions_meta WHERE version = ?',
      [version]
    )
    return row != null
  })
}

export function getInstalledVersions(): Promise<string[]> {
  return withDbError('getInstalledVersions', async () => {
    const d = await getDb()
    const rows = await d.getAllAsync<{ version: string }>('SELECT version FROM versions_meta')
    return rows.map(r => r.version)
  })
}

export function getBibleVersionMetadata(version: string): Promise<BibleVersionMetadata | null> {
  return withDbError('getBibleVersionMetadata', async () => {
    const d = await getDb()
    const row = await d.getFirstAsync<{
      version: string
      installed_at: number
      verse_count: number
      text_revision: string | null
      text_sha256: string | null
      source_sha256: string | null
      schema_version: number | null
      resource_generation: string | null
    }>(
      `SELECT version, installed_at, verse_count, text_revision, text_sha256,
              source_sha256, schema_version, resource_generation
       FROM versions_meta WHERE version = ?`,
      [version]
    )
    if (!row) return null
    return {
      version: row.version,
      installedAt: row.installed_at,
      verseCount: row.verse_count,
      ...(row.text_revision ? { textRevision: row.text_revision } : {}),
      ...(row.text_sha256 ? { textSha256: row.text_sha256 } : {}),
      ...(row.source_sha256 ? { sourceSha256: row.source_sha256 } : {}),
      ...(row.schema_version != null ? { schemaVersion: row.schema_version } : {}),
      ...(row.resource_generation ? { resourceGeneration: row.resource_generation } : {}),
    }
  })
}

/**
 * Batch-insert an entire Bible version from parsed JSON data.
 *
 * Expected JSON shape:
 * {
 *   "1": { "1": { "1": "In the beginning...", "2": "..." }, "2": { ... } },
 *   "2": { ... }
 * }
 *
 * Uses withExclusiveTransactionAsync for safe bulk insert.
 */
export interface InsertBibleOptions {
  onInsertProgress?: (progress: number) => void
  isCancelled?: () => boolean
  beforeCommit?: () => void | Promise<void>
  publicationMetadata?: {
    textRevision: string
    textSha256: string
    sourceSha256?: string
    schemaVersion: number
    verseCount: number
    resourceGeneration?: string
  }
}

export function insertBibleVersion(
  version: string,
  jsonData: BibleJsonData,
  options?: InsertBibleOptions
): Promise<void> {
  return withDbError(`insertBibleVersion(${version})`, async () => {
    const d = await getDb()

    await d.withExclusiveTransactionAsync(async () => {
      // Delete existing data for this version first (re-download case)
      // Remove FTS entries before deleting verses (content-sync table needs explicit delete)
      await d.runAsync(
        `INSERT INTO verses_fts(verses_fts, rowid, text, normalized_text)
       SELECT 'delete', id, text, normalized_text FROM verses WHERE version = ?`,
        [version]
      )
      await d.runAsync('DELETE FROM verses WHERE version = ?', [version])
      await d.runAsync('DELETE FROM versions_meta WHERE version = ?', [version])

      let totalCount = 0
      const BATCH_SIZE = 500

      // Collect all rows first
      const canonicalPublication = isCanonicalBibleJsonData(jsonData) ? jsonData : undefined
      if (canonicalPublication && canonicalPublication.applicationVersionId !== version) {
        throw new Error(
          `CANONICAL_BIBLE_VERSION_MISMATCH:${canonicalPublication.applicationVersionId}:${version}`
        )
      }
      const versesData: BibleVerseImportData =
        canonicalPublication?.verses ?? (jsonData as LegacyBibleJsonData)
      const allRows: [
        string,
        number,
        number,
        number,
        string,
        string,
        string,
        string,
        string,
        string,
      ][] = []
      let canonicalNoteCount = 0
      let canonicalHeadingCount = 0
      for (const { bookNumber, chapterNumber, verseNumber, verseData } of getImportableBibleVerses(
        versesData
      )) {
        if (typeof verseData === 'string') {
          allRows.push([
            version,
            bookNumber,
            chapterNumber,
            verseNumber,
            verseData,
            getOfflineNormalizedSearchText(version, verseData),
            '[]',
            '[]',
            '[]',
            '[]',
          ])
          continue
        }
        canonicalNoteCount += verseData.notes?.length ?? 0
        canonicalHeadingCount += verseData.headings?.length ?? 0
        allRows.push([
          version,
          bookNumber,
          chapterNumber,
          verseNumber,
          verseData.text,
          getOfflineNormalizedSearchText(version, verseData.text),
          JSON.stringify(verseData.startTags ?? []),
          JSON.stringify(verseData.layout ?? []),
          JSON.stringify(verseData.notes ?? []),
          JSON.stringify(verseData.headings ?? []),
        ])
      }
      if (canonicalPublication && allRows.length !== canonicalPublication.verseCount) {
        throw new Error(
          `CANONICAL_BIBLE_VERSE_COUNT_MISMATCH:${allRows.length}:${canonicalPublication.verseCount}`
        )
      }
      if (
        options?.publicationMetadata &&
        allRows.length !== options.publicationMetadata.verseCount
      ) {
        throw new Error(
          `BIBLE_PUBLICATION_VERSE_COUNT_MISMATCH:${allRows.length}:${options.publicationMetadata.verseCount}`
        )
      }
      if (
        canonicalPublication?.headingCount !== undefined &&
        canonicalHeadingCount !== canonicalPublication.headingCount
      ) {
        throw new Error(
          `CANONICAL_BIBLE_HEADING_COUNT_MISMATCH:${canonicalHeadingCount}:${canonicalPublication.headingCount}`
        )
      }
      if (
        canonicalPublication?.noteCount !== undefined &&
        canonicalNoteCount !== canonicalPublication.noteCount
      ) {
        throw new Error(
          `CANONICAL_BIBLE_NOTE_COUNT_MISMATCH:${canonicalNoteCount}:${canonicalPublication.noteCount}`
        )
      }

      const totalBatches = Math.ceil(allRows.length / BATCH_SIZE)

      // Batch insert
      for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
        // Check for cancellation between batches
        if (options?.isCancelled?.()) {
          throw new Error('CANCELLED')
        }

        const batch = allRows.slice(i, i + BATCH_SIZE)
        const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')
        const flatParams: (string | number)[] = []
        for (const row of batch) {
          flatParams.push(...row)
        }

        await d.runAsync(
          `INSERT INTO verses (
             version, book, chapter, verse, text, normalized_text, start_tags_json, layout_json,
             notes_json, headings_json
           )
           VALUES ${placeholders}`,
          flatParams
        )
        totalCount += batch.length

        // Report progress after each batch
        const batchIndex = Math.floor(i / BATCH_SIZE) + 1
        options?.onInsertProgress?.(batchIndex / totalBatches)
      }

      // Populate FTS index for this version
      await d.runAsync(
        `INSERT INTO verses_fts(rowid, text, normalized_text)
       SELECT id, text, normalized_text FROM verses WHERE version = ?`,
        [version]
      )

      // Record metadata
      const publicationMetadata = canonicalPublication ?? options?.publicationMetadata
      await d.runAsync(
        `INSERT INTO versions_meta(
           version, installed_at, verse_count, text_revision,
           text_sha256, source_sha256, schema_version, resource_generation
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          version,
          Date.now(),
          totalCount,
          publicationMetadata?.textRevision ?? null,
          publicationMetadata?.textSha256 ?? null,
          publicationMetadata?.sourceSha256 ?? null,
          publicationMetadata?.schemaVersion ?? null,
          options?.publicationMetadata?.resourceGeneration ?? null,
        ]
      )
      await options?.beforeCommit?.()
    })

    console.log(`[BiblesDB] Inserted version ${version}`)
  })
}

function parseCanonicalJsonArray<T>(value: string): T[] {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const parseCanonicalLayout = (value: string): CanonicalBibleLayoutEvent[] =>
  parseCanonicalJsonArray<CanonicalBibleLayoutEvent>(value)

const parseCanonicalStartTags = (value: string): CanonicalBibleActiveTag[] =>
  parseCanonicalJsonArray<CanonicalBibleActiveTag>(value)

const parseCanonicalNotes = (value: string): CanonicalBibleNote[] =>
  parseCanonicalJsonArray<CanonicalBibleNote>(value)

const parseCanonicalHeadings = (value: string): CanonicalBibleHeading[] =>
  parseCanonicalJsonArray<CanonicalBibleHeading>(value)

function isCanonicalBibleJsonData(data: BibleJsonData): data is CanonicalBibleJsonData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'format' in data &&
    data.format === 'bible-strong-canonical-bible'
  )
}

/**
 * Remove a Bible version from the database.
 */
export function removeBibleVersion(version: string): Promise<void> {
  return withDbError(`removeBibleVersion(${version})`, async () => {
    const d = await getDb()

    await d.withExclusiveTransactionAsync(async () => {
      // Remove FTS entries first (content-sync table needs explicit delete)
      await d.runAsync(
        `INSERT INTO verses_fts(verses_fts, rowid, text, normalized_text)
         SELECT 'delete', id, text, normalized_text FROM verses WHERE version = ?`,
        [version]
      )

      await d.runAsync('DELETE FROM verses WHERE version = ?', [version])
      await d.runAsync('DELETE FROM versions_meta WHERE version = ?', [version])
    })

    console.log(`[BiblesDB] Removed version ${version}`)
  })
}

// ---------------------------------------------------------------------------
// FTS5 Search
// ---------------------------------------------------------------------------

/**
 * Build the WHERE clause and params shared by search and count queries.
 *
 * Uses a correlated `EXISTS` predicate instead of JOIN conditions to ensure
 * the FTS5 virtual table remains the outer driver. This avoids planner flips
 * to the `verses` table and also avoids materializing huge `rowid IN (...)`
 * lists when filters are broad (e.g. NT only), which can block the connection.
 */
function buildSearchFilter(ftsQuery: string, options?: SearchOptions) {
  let where = 'WHERE verses_fts MATCH ?'
  const params: (string | number)[] = [ftsQuery]

  const existsConditions: string[] = []
  const existsParams: (string | number)[] = []

  if (options?.version) {
    existsConditions.push('vf.version = ?')
    existsParams.push(options.version)
  }
  if (options?.book) {
    existsConditions.push('vf.book = ?')
    existsParams.push(options.book)
  }
  if (options?.versionIds) {
    if (options.versionIds.length === 0) {
      existsConditions.push('FALSE')
    } else {
      existsConditions.push(`vf.version IN (${options.versionIds.map(() => '?').join(', ')})`)
      existsParams.push(...options.versionIds)
    }
  }
  if (options?.section === 'ot') {
    existsConditions.push('(vf.book BETWEEN 1 AND 39 OR vf.book BETWEEN 67 AND 77)')
  } else if (options?.section === 'nt') {
    existsConditions.push('vf.book BETWEEN 40 AND 66')
  }

  if (existsConditions.length > 0) {
    where += `
      AND EXISTS (
        SELECT 1
        FROM verses vf
        WHERE vf.id = verses_fts.rowid
          AND ${existsConditions.join(' AND ')}
      )
    `
    params.push(...existsParams)
  }

  return { where, params }
}

const scopeSearchFtsQuery = (ftsQuery: string) => `{text normalized_text} : (${ftsQuery})`

type ResolvedFtsQuery = {
  ftsQuery: string
  highlightQuery: string
}

const resolveFtsQuery = async (
  database: SQLite.SQLiteDatabase,
  rawQuery: string,
  options?: SearchOptions
): Promise<ResolvedFtsQuery | null> => {
  const parsed = parseBibleTextSearchQuery(rawQuery)
  const primaryQuery = sanitizeFtsQuery(rawQuery)
  if (!parsed || !primaryQuery) return null

  const scopedPrimaryQuery = scopeSearchFtsQuery(primaryQuery)
  const { where, params } = buildSearchFilter(scopedPrimaryQuery, options)
  const primaryMatch = await database.getFirstAsync<{ found: number }>(
    `SELECT EXISTS(SELECT 1 FROM verses_fts ${where} LIMIT 1) AS found`,
    params
  )
  if (primaryMatch?.found || parsed.kind === 'phrase') {
    return { ftsQuery: scopedPrimaryQuery, highlightQuery: rawQuery }
  }

  let changed = false
  const correctableTerms = parsed.terms.filter(term => term.length >= 4)
  const initialCharacters = [...new Set(correctableTerms.map(term => term.charAt(0)))]
  const candidateRows =
    correctableTerms.length > 0
      ? await database.getAllAsync<{ term: string }>(
          `SELECT term
       FROM verses_fts_vocab
       WHERE substr(term, 1, 1) IN (${initialCharacters.map(() => '?').join(', ')})
         AND length(term) BETWEEN ? AND ?
       LIMIT 2000`,
          [
            ...initialCharacters,
            Math.max(1, Math.min(...correctableTerms.map(term => term.length)) - 2),
            Math.max(...correctableTerms.map(term => term.length)) + 2,
          ]
        )
      : []
  const correctedTerms = parsed.terms.map(term => {
    if (term.length < 4) return term
    const candidates: string[] = []
    for (const candidateRow of candidateRows) {
      const candidate = candidateRow.term
      if (candidate.charAt(0) === term.charAt(0) && Math.abs(candidate.length - term.length) <= 2) {
        candidates.push(candidate)
      }
    }
    const correction = findClosestBibleSearchTerm(term, candidates)
    changed ||= Boolean(correction && correction !== term)
    return correction ?? term
  })

  if (!changed) return { ftsQuery: scopedPrimaryQuery, highlightQuery: rawQuery }

  return {
    ftsQuery: scopeSearchFtsQuery(correctedTerms.map(term => `${term}*`).join(' ')),
    highlightQuery: correctedTerms.join(' '),
  }
}

const highlightSearchResults = (results: SearchResult[], query: string): SearchResult[] =>
  results.map(result => ({
    ...result,
    highlighted: highlightBibleSearchText(result.text, query),
  }))

const getCanonicalBookOrderSql = (canon?: BibleCanonId) => {
  if (!canon) return 'v.book'
  const cases = getBookIdsForCanon(canon)
    .map((bookId, index) => `WHEN ${bookId} THEN ${index + 1}`)
    .join(' ')
  return `CASE v.book ${cases} ELSE 999 END`
}

const executeSearchResults = async (
  database: SQLite.SQLiteDatabase,
  parsed: NonNullable<ReturnType<typeof parseBibleTextSearchQuery>>,
  resolved: ResolvedFtsQuery,
  options?: SearchOptions
) => {
  const limit = options?.limit ?? 100
  const offset = options?.offset ?? 0
  const { where, params } = buildSearchFilter(resolved.ftsQuery, options)
  const canonicalBookOrder = getCanonicalBookOrderSql(options?.canon)

  let sql: string
  if (options?.sortOrder !== 'book') {
    sql = `
      WITH fts AS MATERIALIZED (
        SELECT rowid,
               rank,
               CASE WHEN instr(lower(text), lower(?)) > 0 THEN 0 ELSE 1 END AS exact_tier
        FROM verses_fts
        ${where}
        ORDER BY exact_tier, rank, rowid
        LIMIT ? OFFSET ?
      )
      SELECT v.version, v.book, v.chapter, v.verse, v.text, v.text AS highlighted
      FROM fts
      JOIN verses v ON v.id = fts.rowid
      ORDER BY fts.exact_tier, fts.rank, fts.rowid
    `
    params.unshift(parsed.raw)
    params.push(limit, offset)
  } else {
    sql = `
      WITH fts AS MATERIALIZED (
        SELECT rowid
        FROM verses_fts
        ${where}
      )
      SELECT v.version, v.book, v.chapter, v.verse, v.text, v.text AS highlighted
      FROM fts
      JOIN verses v ON v.id = fts.rowid
      ORDER BY ${canonicalBookOrder}, v.chapter, v.verse, v.version
      LIMIT ? OFFSET ?
    `
    params.push(limit, offset)
  }

  return highlightSearchResults(
    await database.getAllAsync<SearchResult>(sql, params),
    resolved.highlightQuery
  )
}

const executeSearchCount = async (
  database: SQLite.SQLiteDatabase,
  resolved: ResolvedFtsQuery,
  options?: SearchOptions
) => {
  const { where, params } = buildSearchFilter(resolved.ftsQuery, options)
  const row = await database.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM verses_fts ${where}`,
    params
  )
  return row?.cnt ?? 0
}

/** Search verses using natural terms or an entirely quoted phrase. */
export function searchVerses(query: string, options?: SearchOptions): Promise<SearchResult[]> {
  return withDbError('searchVerses', async () => {
    const d = await getDb()
    const resolved = await resolveFtsQuery(d, query, options)
    const parsed = parseBibleTextSearchQuery(query)
    if (!resolved || !parsed) return []

    return executeSearchResults(d, parsed, resolved, options)
  })
}

/**
 * Count matching verses for a search query.
 */
export function searchVersesCount(query: string, options?: SearchOptions): Promise<number> {
  return withDbError('searchVersesCount', async () => {
    const d = await getDb()
    const resolved = await resolveFtsQuery(d, query, options)
    if (!resolved) return 0

    return executeSearchCount(d, resolved, options)
  })
}

export function searchVersesPage(
  query: string,
  options?: SearchOptions
): Promise<{ results: SearchResult[]; count: number }> {
  return withDbError('searchVersesPage', async () => {
    const database = await getDb()
    const parsed = parseBibleTextSearchQuery(query)
    const resolved = await resolveFtsQuery(database, query, options)
    if (!parsed || !resolved) return { results: [], count: 0 }

    const [results, count] = await Promise.all([
      executeSearchResults(database, parsed, resolved, options),
      executeSearchCount(database, resolved, options),
    ])
    return { results, count }
  })
}
