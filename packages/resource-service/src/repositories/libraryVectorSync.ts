// Keeps the Vectorize indexes of the library (ADR-0103, amendment of 2026-11-12) in step with
// Neon, which stays the source of truth: every passage of an active publication has one vector in
// the index of its language, under libraryVectorId, with its filter fields. Values are read from
// `library_passages.embedding`, never embedded again.
//
// Two ways, both idempotent:
// - by keys, for a writer that knows what it changed (an index run, a collection import): the
//   passages it wrote are upserted, the ones it deleted are deleted;
// - by reconciliation, for what no writer reports (a republication deletes the passages of the
//   previous publication by cascade): every identifier of an index is listed and compared with
//   Neon, missing passages are upserted and the others deleted. About 1.1 s a page of 1,000
//   identifiers on 2026-11-12, so 6 min for French and 11 min for English, side by side.
// Vectorize applies writes a few seconds to minutes later: a reconciliation right after a write
// may see it undone and do it again, which changes nothing.
import { Pool, type PoolClient } from 'pg'

import type { LibraryCorpus, LibraryLanguage } from '../search/libraryDocuments'
import { perspectiveOf } from '../search/libraryPerspectives'
import { libraryVectorId, libraryVectorRecord } from '../search/libraryVectorIndex'

export const LIBRARY_VECTOR_LANGUAGES: readonly LibraryLanguage[] = ['fr', 'en']
/** Records a Vectorize upsert carries: about 11 MB of JSON, under the 100 MB of a request. */
export const LIBRARY_VECTOR_UPSERT_BATCH = 1000
/** Vectorize deletes at most 100 identifiers a request. */
export const LIBRARY_VECTOR_DELETE_BATCH = 100
/** Passages read from Neon at once for their vectors. */
const READ_BATCH = 500
/**
 * A reconciliation that would delete more than this share of an index stops: a database that is
 * not production (the local one) would otherwise empty it. Republishing the largest work (the
 * Ellen G. White writings, 19 % of the French index) stays under it.
 */
export const LIBRARY_VECTOR_MAX_DELETED_SHARE = 0.25
/** Below this many deletions a reconciliation never stops. */
const MASS_DELETE_MINIMUM = 1000

export type LibraryVectorUpsert = {
  id: string
  values: number[]
  metadata: Record<string, string | number | boolean>
}

/** Where the library vectors are kept: the Vectorize indexes, through their REST API. */
export type LibraryVectorStore = {
  upsert(language: LibraryLanguage, records: readonly LibraryVectorUpsert[]): Promise<void>
  delete(language: LibraryLanguage, ids: readonly string[]): Promise<void>
  /** Every identifier of the index, a page at a time. */
  listIds(language: LibraryLanguage): AsyncIterable<readonly string[]>
}

export type LibraryPassageKey = { publication_id: number; passage_key: string }
export type LibraryLanguagePassageKey = LibraryPassageKey & { language: LibraryLanguage }

/** The identifiers Neon holds that the index lacks, and the ones the index holds in excess. */
export function libraryVectorDifference(
  expected: ReadonlyMap<string, LibraryPassageKey>,
  present: ReadonlySet<string>
) {
  const missing = [...expected].filter(([id]) => !present.has(id)).map(([, key]) => key)
  const extra = [...present].filter(id => !expected.has(id))
  return { missing, extra }
}

type PassageVectorRow = LibraryPassageKey & {
  language: LibraryLanguage
  work: string
  corpus: LibraryCorpus
  tradition: string | null
  tags: string[]
  book: number | null
  chapter: number | null
  labelled: boolean
  embedding: string
}

/** The record of a passage row: its identifier, its vector and its filter fields. */
export function libraryVectorUpsertOf(row: PassageVectorRow): LibraryVectorUpsert {
  const record = libraryVectorRecord({
    publication_id: row.publication_id,
    passage_key: row.passage_key,
    language: row.language,
    work: row.work,
    corpus: row.corpus,
    perspective: perspectiveOf(row.tradition, row.tags),
    book: row.book,
    chapter: row.chapter,
    labelled: row.labelled,
  })
  return { id: record.id, values: JSON.parse(row.embedding) as number[], metadata: record.metadata }
}

/** Upserts these passages from their rows in Neon, by language; a key without a row is skipped. */
async function upsertFromNeon(
  client: PoolClient,
  store: LibraryVectorStore,
  keys: readonly LibraryPassageKey[],
  onProgress?: (line: string) => void
) {
  let upserted = 0
  const pending: Record<LibraryLanguage, LibraryVectorUpsert[]> = { fr: [], en: [] }
  const flush = async (language: LibraryLanguage, all = false) => {
    while (pending[language].length >= (all ? 1 : LIBRARY_VECTOR_UPSERT_BATCH)) {
      const batch = pending[language].splice(0, LIBRARY_VECTOR_UPSERT_BATCH)
      await store.upsert(language, batch)
      upserted += batch.length
      if (upserted % 50_000 < batch.length) onProgress?.(`vectors: ${upserted} upserted`)
    }
  }
  for (let start = 0; start < keys.length; start += READ_BATCH) {
    const slice = keys.slice(start, start + READ_BATCH)
    const { rows } = await client.query<PassageVectorRow>(
      `select p.publication_id, p.passage_key, p.language, p.work, p.corpus, p.tradition, p.tags,
         p.book, p.chapter, (p.corpus <> 'document' or p.target ? 'labels') as labelled,
         p.embedding::text as embedding
       from unnest($1::int[], $2::text[]) as wanted(publication_id, passage_key)
       join library_passages p using (publication_id, passage_key)`,
      [slice.map(key => key.publication_id), slice.map(key => key.passage_key)]
    )
    for (const row of rows) pending[row.language].push(libraryVectorUpsertOf(row))
    for (const language of LIBRARY_VECTOR_LANGUAGES) await flush(language)
  }
  for (const language of LIBRARY_VECTOR_LANGUAGES) await flush(language, true)
  return upserted
}

async function deleteIds(store: LibraryVectorStore, language: LibraryLanguage, ids: readonly string[]) {
  for (let start = 0; start < ids.length; start += LIBRARY_VECTOR_DELETE_BATCH)
    await store.delete(language, ids.slice(start, start + LIBRARY_VECTOR_DELETE_BATCH))
}

/**
 * The passages a writer changed: those it wrote are upserted from Neon (their rows must be
 * written), those it deleted are deleted from the index of their language.
 */
export async function syncLibraryVectors(
  client: PoolClient,
  store: LibraryVectorStore,
  changes: {
    upserted?: readonly LibraryPassageKey[]
    deleted?: readonly LibraryLanguagePassageKey[]
    onProgress?: (line: string) => void
  }
) {
  const deleted = changes.deleted ?? []
  for (const language of LIBRARY_VECTOR_LANGUAGES)
    await deleteIds(
      store,
      language,
      deleted
        .filter(key => key.language === language)
        .map(key => libraryVectorId(key.publication_id, key.passage_key))
    )
  const upserted = await upsertFromNeon(client, store, changes.upserted ?? [], changes.onProgress)
  return { upserted, deleted: deleted.length }
}

/** The passages of a publication, to delete from the indexes before its rows go. */
export async function libraryPassageKeysOf(client: PoolClient, publicationIds: readonly number[]) {
  if (!publicationIds.length) return []
  const { rows } = await client.query<LibraryLanguagePassageKey>(
    `select publication_id, passage_key, language from library_passages
     where publication_id = any($1::int[])`,
    [publicationIds]
  )
  return rows
}

export type LibraryVectorReconciliation = Record<
  LibraryLanguage,
  { passages: number; vectors: number; missing: number; extra: number; upserted: number; deleted: number }
>

/**
 * Compares every index with the passages of the active publications and repairs it. With
 * `refresh`, these passages are upserted even when present: an index run that embedded a passage
 * again under the same key.
 */
export async function reconcileLibraryVectors(
  client: PoolClient,
  store: LibraryVectorStore,
  options: {
    dryRun?: boolean
    languages?: readonly LibraryLanguage[]
    refresh?: readonly LibraryPassageKey[]
    allowMassDelete?: boolean
    onProgress?: (line: string) => void
  } = {}
): Promise<LibraryVectorReconciliation> {
  const languages = options.languages ?? LIBRARY_VECTOR_LANGUAGES
  const { rows } = await client.query<LibraryLanguagePassageKey>(
    `select p.publication_id, p.passage_key, p.language from library_passages p
     join resource_publications r on r.id = p.publication_id
     where r.status = 'active' and p.language = any($1::text[])`,
    [languages]
  )
  const expected = Object.fromEntries(
    languages.map(language => [language, new Map<string, LibraryPassageKey>()])
  ) as Record<LibraryLanguage, Map<string, LibraryPassageKey>>
  for (const row of rows)
    expected[row.language].set(libraryVectorId(row.publication_id, row.passage_key), {
      publication_id: row.publication_id,
      passage_key: row.passage_key,
    })
  // Both indexes are listed side by side: the listing takes most of the time.
  const listed = await Promise.all(
    languages.map(async language => {
      const present = new Set<string>()
      for await (const page of store.listIds(language)) {
        for (const id of page) present.add(id)
        if (present.size % 100_000 < page.length)
          options.onProgress?.(`vectors ${language}: ${present.size} listed`)
      }
      return [language, present] as const
    })
  )
  const report = {} as LibraryVectorReconciliation
  const refresh = new Set((options.refresh ?? []).map(key => libraryVectorId(key.publication_id, key.passage_key)))
  for (const [language, present] of listed) {
    const { missing, extra } = libraryVectorDifference(expected[language], present)
    if (
      !options.dryRun &&
      !options.allowMassDelete &&
      present.size &&
      extra.length > MASS_DELETE_MINIMUM &&
      (extra.length > present.size * LIBRARY_VECTOR_MAX_DELETED_SHARE || !expected[language].size)
    )
      throw new Error(
        `LIBRARY_VECTOR_MASS_DELETE ${language}: ${extra.length} of ${present.size} vectors would go`
      )
    const toUpsert = [
      ...missing,
      ...[...refresh]
        .filter(id => present.has(id) && expected[language].has(id))
        .map(id => expected[language].get(id)!),
    ]
    report[language] = {
      passages: expected[language].size,
      vectors: present.size,
      missing: missing.length,
      extra: extra.length,
      upserted: 0,
      deleted: 0,
    }
    if (options.dryRun) continue
    await deleteIds(store, language, extra)
    report[language].deleted = extra.length
    report[language].upserted = await upsertFromNeon(client, store, toUpsert, options.onProgress)
  }
  return report
}

const LOCAL_DATABASE = 'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong'

/** A reconciliation on its own connection, under the lock of the index runs. */
export async function reconcileLibraryVectorIndexes(
  store: LibraryVectorStore,
  options: Parameters<typeof reconcileLibraryVectors>[2] & { connectionString?: string } = {}
) {
  const pool = new Pool({
    connectionString: options.connectionString ?? process.env.RESOURCE_DATABASE_URL ?? LOCAL_DATABASE,
    max: 1,
  })
  const client = await pool.connect()
  try {
    const { rows } = await client.query<{ locked: boolean }>(
      'select pg_try_advisory_lock(3252027) as locked'
    )
    if (!rows[0]?.locked) throw new Error('LIBRARY_INDEX_ALREADY_RUNNING')
    return await reconcileLibraryVectors(client, store, options)
  } finally {
    await client.query('select pg_advisory_unlock(3252027)').catch(() => undefined)
    client.release()
    await pool.end()
  }
}
