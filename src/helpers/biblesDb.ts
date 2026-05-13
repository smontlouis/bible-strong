import * as FileSystem from 'expo-file-system/legacy'
import * as Sentry from '@sentry/react-native'
import * as SQLite from 'expo-sqlite'
import { getSharedSqliteDirPath } from '~helpers/databaseTypes'
import { databaseBiblesName } from '~helpers/databases'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BibleVerse {
  Livre: number
  Chapitre: number
  Verset: number
  Texte: string
}

export interface SearchResult {
  version: string
  book: number
  chapter: number
  verse: number
  text: string
  highlighted: string
}

export type SearchSortOrder = 'relevance' | 'book'

export interface SearchOptions {
  version?: string
  book?: number
  section?: 'ot' | 'nt'
  sortOrder?: SearchSortOrder
  limit?: number
  offset?: number
}

// ---------------------------------------------------------------------------
// Singleton with mutex to prevent concurrent opens
// ---------------------------------------------------------------------------

let db: SQLite.SQLiteDatabase | null = null
let openPromise: Promise<SQLite.SQLiteDatabase> | null = null
let inFlightCount = 0
let dbLockedForReset = false

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
          text TEXT NOT NULL
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_verses_lookup
          ON verses(version, book, chapter, verse);

        CREATE INDEX IF NOT EXISTS idx_verses_chapter
          ON verses(version, book, chapter);

        CREATE VIRTUAL TABLE IF NOT EXISTS verses_fts USING fts5(
          text,
          content='verses',
          content_rowid='id',
          tokenize='unicode61 remove_diacritics 2'
        );

        CREATE TABLE IF NOT EXISTS versions_meta (
          version TEXT PRIMARY KEY,
          installed_at INTEGER NOT NULL,
          verse_count INTEGER NOT NULL DEFAULT 0
        );
      `)

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
    }>(
      'SELECT book, chapter, verse, text FROM verses WHERE version = ? AND book = ? AND chapter = ? ORDER BY verse',
      [version, book, chapter]
    )

    return rows.map(r => ({
      Livre: r.book,
      Chapitre: r.chapter,
      Verset: r.verse,
      Texte: r.text,
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
  verseKeys: string[]
): Promise<Record<string, string>> {
  if (verseKeys.length === 0) return Promise.resolve({})

  return withDbError('getMultipleVerses', async () => {
    const d = await getDb()
    const result: Record<string, string> = {}

    // Build a single query using OR clauses, batched to avoid SQL limits
    const BATCH_SIZE = 200
    for (let i = 0; i < verseKeys.length; i += BATCH_SIZE) {
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
}

export function insertBibleVersion(
  version: string,
  jsonData: Record<string, Record<string, Record<string, string>>>,
  options?: InsertBibleOptions
): Promise<void> {
  return withDbError(`insertBibleVersion(${version})`, async () => {
    const d = await getDb()

    await d.withExclusiveTransactionAsync(async () => {
      // Delete existing data for this version first (re-download case)
      // Remove FTS entries before deleting verses (content-sync table needs explicit delete)
      await d.runAsync(
        `INSERT INTO verses_fts(verses_fts, rowid, text)
       SELECT 'delete', id, text FROM verses WHERE version = ?`,
        [version]
      )
      await d.runAsync('DELETE FROM verses WHERE version = ?', [version])
      await d.runAsync('DELETE FROM versions_meta WHERE version = ?', [version])

      let totalCount = 0
      const BATCH_SIZE = 500

      // Collect all rows first
      const allRows: [string, number, number, number, string][] = []
      for (const bookStr of Object.keys(jsonData)) {
        const bookNum = Number(bookStr)
        if (isNaN(bookNum)) continue
        const chapters = jsonData[bookStr]
        for (const chapterStr of Object.keys(chapters)) {
          const chapterNum = Number(chapterStr)
          if (isNaN(chapterNum)) continue
          const verses = chapters[chapterStr]
          for (const verseStr of Object.keys(verses)) {
            // Skip non-numeric verse keys (e.g. "12a", "20+NUM" — variant verses)
            if (!/^\d+$/.test(verseStr)) continue
            const verseNum = Number(verseStr)
            const text = verses[verseStr]
            if (typeof text !== 'string') continue
            allRows.push([version, bookNum, chapterNum, verseNum, text])
          }
        }
      }

      const totalBatches = Math.ceil(allRows.length / BATCH_SIZE)

      // Batch insert
      for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
        // Check for cancellation between batches
        if (options?.isCancelled?.()) {
          throw new Error('CANCELLED')
        }

        const batch = allRows.slice(i, i + BATCH_SIZE)
        const placeholders = batch.map(() => '(?, ?, ?, ?, ?)').join(', ')
        const flatParams: (string | number)[] = []
        for (const row of batch) {
          flatParams.push(...row)
        }

        await d.runAsync(
          `INSERT INTO verses (version, book, chapter, verse, text) VALUES ${placeholders}`,
          flatParams
        )
        totalCount += batch.length

        // Report progress after each batch
        const batchIndex = Math.floor(i / BATCH_SIZE) + 1
        options?.onInsertProgress?.(batchIndex / totalBatches)
      }

      // Populate FTS index for this version
      await d.runAsync(
        `INSERT INTO verses_fts(rowid, text)
       SELECT id, text FROM verses WHERE version = ?`,
        [version]
      )

      // Record metadata
      await d.runAsync(
        'INSERT INTO versions_meta (version, installed_at, verse_count) VALUES (?, ?, ?)',
        [version, Date.now(), totalCount]
      )
    })

    console.log(`[BiblesDB] Inserted version ${version}`)
  })
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
        `INSERT INTO verses_fts(verses_fts, rowid, text)
         SELECT 'delete', id, text FROM verses WHERE version = ?`,
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
  if (options?.section === 'ot') {
    existsConditions.push('vf.book <= 39')
  } else if (options?.section === 'nt') {
    existsConditions.push('vf.book > 39')
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

/**
 * Build a NEAR query from raw user input for proximity-boosted ranking.
 * Returns null for single-word queries or inputs with explicit operators.
 */
function buildNearQuery(raw: string, distance: number = 5): string | null {
  const trimmed = raw.trim()

  // Skip if user typed explicit FTS5 operators or quoted phrases
  if (/\b(AND|OR|NOT)\b/.test(trimmed) || trimmed.includes('"')) return null

  const tokens = trimmed
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .split(/\s+/)
    .filter(Boolean)

  if (tokens.length < 2) return null

  return `NEAR(${tokens.join(' ')}, ${distance})`
}

/**
 * Search verses using FTS5 full-text search.
 *
 * Supports:
 * - Prefix search: "amou*"
 * - Phrase search: "\"amour de Dieu\""
 * - Boolean: "amour OR grace", "amour NOT colere"
 *
 * For multi-word queries sorted by relevance, uses two-tier proximity ranking:
 * 1. NEAR results (words within 5 tokens of each other), ranked by BM25
 * 2. Broad results (standard prefix search), ranked by BM25, deduped
 *
 * Results are highlighted with {{ and }} markers.
 */
export function searchVerses(query: string, options?: SearchOptions): Promise<SearchResult[]> {
  return withDbError('searchVerses', async () => {
    const d = await getDb()
    const ftsQuery = sanitizeFtsQuery(query)
    if (!ftsQuery) return []

    const limit = options?.limit ?? 100
    const offset = options?.offset ?? 0
    const orderBy = options?.sortOrder === 'book' ? 'v.book, v.chapter, v.verse' : 'rank'

    const nearQuery = buildNearQuery(query)

    // Two-tier proximity search for multi-word + relevance sort
    if (nearQuery && options?.sortOrder !== 'book') {
      try {
        const { where: nearWhere, params: nearParams } = buildSearchFilter(nearQuery, options)
        const nearSql = `
          WITH fts AS MATERIALIZED (
            SELECT rowid, highlight(verses_fts, 0, '{{', '}}') AS highlighted, rank
            FROM verses_fts
            ${nearWhere}
            ORDER BY rank LIMIT ?
          )
          SELECT v.version, v.book, v.chapter, v.verse, v.text, fts.highlighted
          FROM fts
          JOIN verses v ON v.id = fts.rowid
          ORDER BY fts.rank
        `
        nearParams.push(limit)
        const nearResults = await d.getAllAsync<SearchResult>(nearSql, nearParams)

        if (nearResults.length >= limit) return nearResults

        // Fill remaining slots with broader results
        const remaining = limit - nearResults.length
        const { where: broadWhere, params: broadParams } = buildSearchFilter(ftsQuery, options)
        const broadSql = `
          WITH fts AS MATERIALIZED (
            SELECT rowid, highlight(verses_fts, 0, '{{', '}}') AS highlighted, rank
            FROM verses_fts
            ${broadWhere}
            ORDER BY rank LIMIT ?
          )
          SELECT v.version, v.book, v.chapter, v.verse, v.text, fts.highlighted
          FROM fts
          JOIN verses v ON v.id = fts.rowid
          ORDER BY fts.rank
        `
        // Over-fetch to account for dedup
        broadParams.push(remaining + nearResults.length)
        const broadResults = await d.getAllAsync<SearchResult>(broadSql, broadParams)

        // Dedup: remove broad results already in NEAR results
        const nearKeys = new Set(
          nearResults.map(r => `${r.version}-${r.book}-${r.chapter}-${r.verse}`)
        )
        const extra = broadResults.filter(
          r => !nearKeys.has(`${r.version}-${r.book}-${r.chapter}-${r.verse}`)
        )

        return [...nearResults, ...extra].slice(0, limit)
      } catch {
        // NEAR query failed (e.g. syntax issue) → fall through to standard search
      }
    }

    // Standard single-tier search (single word, book order, or NEAR fallback)
    const { where, params } = buildSearchFilter(ftsQuery, options)

    let sql: string
    if (orderBy === 'rank') {
      // Relevance sort: paginate inside CTE, outer just joins for metadata
      sql = `
        WITH fts AS MATERIALIZED (
          SELECT rowid, highlight(verses_fts, 0, '{{', '}}') AS highlighted, rank
          FROM verses_fts
          ${where}
          ORDER BY rank LIMIT ? OFFSET ?
        )
        SELECT v.version, v.book, v.chapter, v.verse, v.text, fts.highlighted
        FROM fts
        JOIN verses v ON v.id = fts.rowid
        ORDER BY fts.rank
      `
      params.push(limit, offset)
    } else {
      // Book sort: CTE does MATCH + filter only, outer does ordering + pagination
      sql = `
        WITH fts AS MATERIALIZED (
          SELECT rowid, highlight(verses_fts, 0, '{{', '}}') AS highlighted
          FROM verses_fts
          ${where}
        )
        SELECT v.version, v.book, v.chapter, v.verse, v.text, fts.highlighted
        FROM fts
        JOIN verses v ON v.id = fts.rowid
        ORDER BY v.book, v.chapter, v.verse
        LIMIT ? OFFSET ?
      `
      params.push(limit, offset)
    }

    return d.getAllAsync<SearchResult>(sql, params)
  })
}

/**
 * Count matching verses for a search query.
 */
export function searchVersesCount(query: string, options?: SearchOptions): Promise<number> {
  return withDbError('searchVersesCount', async () => {
    const d = await getDb()
    const ftsQuery = sanitizeFtsQuery(query)
    if (!ftsQuery) return 0

    const { where, params } = buildSearchFilter(ftsQuery, options)

    // No JOIN needed: filtering is handled via correlated EXISTS inside buildSearchFilter
    const sql = `
      SELECT COUNT(*) as cnt
      FROM verses_fts
      ${where}
    `

    const row = await d.getFirstAsync<{ cnt: number }>(sql, params)
    return row?.cnt ?? 0
  })
}

/**
 * Sanitize and prepare a user query for FTS5.
 * - Wraps bare words with implicit AND
 * - Preserves quoted phrases
 * - Preserves prefix operator (*)
 * - Strips dangerous chars
 */
function sanitizeFtsQuery(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  // If user typed explicit operators, pass through after basic sanitation
  if (/\b(AND|OR|NOT)\b/.test(trimmed) || trimmed.includes('"')) {
    // Remove chars that could break FTS5 syntax (keep alphanumeric, spaces, quotes, *, -)
    return trimmed.replace(/[^\p{L}\p{N}\s"*\-]/gu, '')
  }

  // Simple query: split into tokens and add prefix matching (*)
  const tokens = trimmed
    .replace(/[^\p{L}\p{N}\s*]/gu, '')
    .split(/\s+/)
    .filter(Boolean)

  if (tokens.length === 0) return ''

  // Add * to each token for prefix matching (e.g. "amour" -> "amour*")
  return tokens.map(t => (t.endsWith('*') ? t : t + '*')).join(' ')
}
