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
  if (db) {
    await db.closeAsync()
    db = null
    openPromise = null
    console.log('[BiblesDB] Database closed')
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
    const d = await getDb()
    const row = await d.getFirstAsync<{ quick_check: string }>('PRAGMA quick_check')
    return row?.quick_check === 'ok' ? 'ok' : 'corrupted'
  } catch {
    return 'corrupted'
  }
}

/**
 * Close the DB, delete the file (+ WAL/SHM), and re-open.
 * After this call all versions will appear as "not installed".
 */
export async function resetBiblesDb(): Promise<void> {
  await closeBiblesDb()

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

async function withDbError<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    console.error(`[BiblesDB] ${operation} failed:`, e)
    Sentry.withScope(scope => {
      scope.setTag('db.name', 'bibles')
      scope.setExtra('operation', operation)
      Sentry.captureException(e)
    })
    throw e
  }
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
      // Delete any existing data for this version first (re-download case)
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
 */
function buildSearchFilter(ftsQuery: string, options?: SearchOptions) {
  let where = 'WHERE verses_fts MATCH ?'
  const params: (string | number)[] = [ftsQuery]

  if (options?.version) {
    where += ' AND v.version = ?'
    params.push(options.version)
  }
  if (options?.book) {
    where += ' AND v.book = ?'
    params.push(options.book)
  }
  if (options?.section === 'ot') {
    where += ' AND v.book <= 39'
  } else if (options?.section === 'nt') {
    where += ' AND v.book > 39'
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
          SELECT v.version, v.book, v.chapter, v.verse, v.text,
                 highlight(verses_fts, 0, '{{', '}}') AS highlighted
          FROM verses_fts
          JOIN verses v ON v.id = verses_fts.rowid
          ${nearWhere}
          ORDER BY rank LIMIT ?
        `
        nearParams.push(limit)
        const nearResults = await d.getAllAsync<SearchResult>(nearSql, nearParams)

        if (nearResults.length >= limit) return nearResults

        // Fill remaining slots with broader results
        const remaining = limit - nearResults.length
        const { where: broadWhere, params: broadParams } = buildSearchFilter(ftsQuery, options)
        const broadSql = `
          SELECT v.version, v.book, v.chapter, v.verse, v.text,
                 highlight(verses_fts, 0, '{{', '}}') AS highlighted
          FROM verses_fts
          JOIN verses v ON v.id = verses_fts.rowid
          ${broadWhere}
          ORDER BY rank LIMIT ?
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
    const sql = `
      SELECT v.version, v.book, v.chapter, v.verse, v.text,
             highlight(verses_fts, 0, '{{', '}}') AS highlighted
      FROM verses_fts
      JOIN verses v ON v.id = verses_fts.rowid
      ${where}
      ORDER BY ${orderBy} LIMIT ? OFFSET ?
    `
    params.push(limit, offset)

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

    const sql = `
      SELECT COUNT(*) as cnt
      FROM verses_fts
      JOIN verses v ON v.id = verses_fts.rowid
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
