// Builds the library search index (ADR-0103) from the active publications. Each publication is
// indexed on its own: passages are rebuilt from its rows, a passage whose embedded text did not
// change keeps its vector, the others are embedded and written, and passages that no longer
// exist are deleted. A republication deletes the old rows by cascade, so the next run indexes
// the new publication in full.
import { createHash } from 'node:crypto'

import { Pool, type PoolClient } from 'pg'

import {
  LIBRARY_CORPORA,
  commentaryPassages,
  dictionaryPassages,
  dictionaryWorkFromIdentity,
  entityPassages,
  navePassages,
  timelinePassages,
  type LibraryCorpus,
  type LibraryPassageDraft,
  type LibrarySectionCuts,
} from '../search/libraryDocuments'
import {
  libraryEmbeddingDocument,
  vectorLiteral,
  type LibraryEmbeddingProvider,
} from '../search/libraryEmbedding'
import { LIBRARY_LEXEME_MINIMUM_PASSAGES } from './librarySearchRepository'

export type LibraryIndexOptions = {
  connectionString?: string
  provider: LibraryEmbeddingProvider
  corpora?: readonly LibraryCorpus[]
  /** Only these resource identities, such as commentary:calvin:en. */
  identities?: readonly string[]
  /** Count passages and characters without embedding or writing. */
  dryRun?: boolean
  /** Drop the HNSW index during the load and build it again at the end: faster for a first load. */
  rebuildVectorIndex?: boolean
  batchSize?: number
  concurrency?: number
  /** Connections that write embedded batches; one connection writes one batch at a time. */
  writers?: number
  /** Count the lexemes again even when no passage changed. */
  refreshLexemes?: boolean
  /** What the index policy cuts from the sections of a commentary (ADR-0106). */
  sectionCuts?: LibrarySectionCuts
  onProgress?: (line: string) => void
}

export type LibraryPublicationReport = {
  identity: string
  corpus: LibraryCorpus
  passages: number
  embedded: number
  kept: number
  deleted: number
  characters: number
  embeddedCharacters: number
  /** Passages Workers AI kept refusing: left out of this run, tried again by the next one. */
  failed: string[]
  durationMs: number
}

type Publication = { id: number; identity: string; language: string | null; corpus: LibraryCorpus }

const LOCAL_DATABASE = 'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong'
const SECTION_PAGE = 2_000

const corpusOf = (identity: string): LibraryCorpus | undefined => {
  if (identity.startsWith('commentary:')) return 'commentary'
  if (dictionaryWorkFromIdentity(identity)) return 'dictionary'
  if (identity === 'nave:fr' || identity === 'nave:en') return 'nave'
  if (identity === 'timeline:fr' || identity === 'timeline:en') return 'timeline'
  if (identity === 'strong-lexicon:entities') return 'entity'
  return undefined
}

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

async function activePublications(client: PoolClient, options: LibraryIndexOptions) {
  const { rows } = await client.query<{
    id: number
    resource_identity: string
    language: string | null
  }>(
    `select id, resource_identity, language from resource_publications
     where status = 'active' order by resource_identity`
  )
  const corpora = new Set(options.corpora ?? LIBRARY_CORPORA)
  return rows.flatMap((row): Publication[] => {
    const corpus = corpusOf(row.resource_identity)
    if (!corpus || !corpora.has(corpus)) return []
    if (options.identities?.length && !options.identities.includes(row.resource_identity)) return []
    return [{ id: row.id, identity: row.resource_identity, language: row.language, corpus }]
  })
}

/** The passages of one publication, page by page so that a large commentary stays in memory bounds. */
async function* publicationPassages(
  client: PoolClient,
  publication: Publication,
  sectionCuts: LibrarySectionCuts = {}
): AsyncGenerator<LibraryPassageDraft[]> {
  const language = publication.language ?? ''
  if (publication.corpus === 'commentary') {
    const [, collection, commentaryLanguage] = publication.identity.split(':')
    let after: [number, number, string] = [0, 0, '']
    for (;;) {
      const { rows } = await client.query<{
        id: string
        book: number
        chapter: number
        range_start_verse: number
        range_end_verse: number
        content: string
      }>(
        `select id, book, chapter, range_start_verse, range_end_verse, content
         from commentary_reading_sections
         where publication_id = $1 and (book, chapter, id) > ($2, $3, $4)
         order by book, chapter, id limit ${SECTION_PAGE}`,
        [publication.id, ...after]
      )
      if (!rows.length) return
      yield rows.flatMap(row =>
        commentaryPassages({ collection, language: commentaryLanguage }, row, sectionCuts)
      )
      const last = rows.at(-1)!
      after = [last.book, last.chapter, last.id]
    }
  }
  if (publication.corpus === 'dictionary') {
    const work = dictionaryWorkFromIdentity(publication.identity)!
    const { rows } = await client.query<{ entry_id: number; word: string; definition: string }>(
      'select entry_id, word, definition from dictionary_entries where publication_id = $1 order by entry_id',
      [publication.id]
    )
    for (let start = 0; start < rows.length; start += SECTION_PAGE)
      yield rows
        .slice(start, start + SECTION_PAGE)
        .flatMap(row => dictionaryPassages(work, language, row))
    return
  }
  if (publication.corpus === 'nave') {
    const { rows } = await client.query<{
      normalized_name: string
      name: string
      description: string
    }>(
      'select normalized_name, name, description from nave_topics where publication_id = $1 order by normalized_name',
      [publication.id]
    )
    yield rows.flatMap(row => navePassages(language, row))
    return
  }
  if (publication.corpus === 'timeline') {
    const { rows } = await client.query<{
      slug: string
      title: string
      description: string
      article: string
      period: string
      dates: string
    }>(
      'select slug, title, description, article, period, dates from timeline_events where publication_id = $1 order by ordinal',
      [publication.id]
    )
    yield rows.flatMap(row => timelinePassages(language, row))
    return
  }
  const { rows } = await client.query<{
    unique_name: string
    language: string
    payload: Record<string, unknown>
  }>(
    `select e.unique_name, t.language, t.payload
     from strong_lexicon_entity_translations t
     join strong_lexicon_entities e on e.publication_id = t.publication_id and e.entity_id = t.entity_id
     where t.publication_id = $1 and t.language in ('fr', 'en')
     order by e.unique_name, t.language`,
    [publication.id]
  )
  // One publication holds both languages: the key carries the language.
  yield rows.flatMap(row =>
    entityPassages(row).map(passage => ({
      ...passage,
      passageKey: `${row.language}:${passage.passageKey}`,
    }))
  )
}

export async function mapConcurrently<T, R>(
  items: readonly T[],
  concurrency: number,
  run: (item: T) => Promise<R>
) {
  const results: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (next < items.length) {
        const index = next++
        results[index] = await run(items[index])
      }
    })
  )
  return results
}

/** The row written for a passage; `embedding` is a vector literal. */
export const passageRow = (
  publicationId: number,
  draft: LibraryPassageDraft & { inputSha256: string },
  provider: Pick<LibraryEmbeddingProvider, 'model' | 'contract'>,
  embedding: string
) => ({
  publication_id: publicationId,
  passage_key: draft.passageKey,
  corpus: draft.corpus,
  language: draft.language,
  work: draft.work,
  work_title: draft.workTitle,
  tradition: draft.tradition,
  tags: draft.tags,
  title: draft.title,
  heading: draft.heading,
  book: draft.book,
  chapter: draft.chapter,
  verse_start: draft.verseStart,
  verse_end: draft.verseEnd,
  part: draft.part,
  content: draft.content,
  target: draft.target,
  model: provider.model,
  contract: provider.contract,
  input_sha256: draft.inputSha256,
  embedding,
})

const INSERT = `
  insert into library_passages (
    publication_id, passage_key, corpus, language, work, work_title, tradition, tags, title,
    heading, book, chapter, verse_start, verse_end, part, content, target, model, contract,
    input_sha256, embedding, search_vector)
  select publication_id, passage_key, corpus, language, work, work_title, tradition, tags, title,
    heading, book, chapter, verse_start, verse_end, part, content, target, model, contract,
    input_sha256, embedding::halfvec,
    to_tsvector(case language when 'fr' then 'french' else 'english' end::regconfig,
      unaccent(heading || ' ' || content))
  from jsonb_to_recordset($1::jsonb) as row(
    publication_id integer, passage_key text, corpus text, language text, work text,
    work_title text, tradition text, tags jsonb, title text, heading text, book integer,
    chapter integer, verse_start integer, verse_end integer, part integer, content text,
    target jsonb, model text, contract text, input_sha256 text, embedding text)
  on conflict (publication_id, passage_key) do update set
    corpus = excluded.corpus, language = excluded.language, work = excluded.work,
    work_title = excluded.work_title, tradition = excluded.tradition, tags = excluded.tags,
    title = excluded.title, heading = excluded.heading, book = excluded.book,
    chapter = excluded.chapter, verse_start = excluded.verse_start, verse_end = excluded.verse_end,
    part = excluded.part, content = excluded.content, target = excluded.target,
    model = excluded.model, contract = excluded.contract, input_sha256 = excluded.input_sha256,
    embedding = excluded.embedding, search_vector = excluded.search_vector`

/**
 * Embeds a batch. A batch Workers AI keeps refusing (an internal error on some content, seen on
 * 2026-11-07) is cut in two until the passage it refuses is found; that passage is left out and
 * reported instead of ending the run.
 */
export async function embedSplitting<T extends { document: string; passageKey: string }>(
  provider: LibraryEmbeddingProvider,
  batch: T[],
  failed: string[]
): Promise<{ draft: T; vector: number[] }[]> {
  try {
    const vectors = await provider.embedDocuments(batch.map(draft => draft.document))
    return batch.map((draft, index) => ({ draft, vector: vectors[index] }))
  } catch (error) {
    if (batch.length === 1) {
      failed.push(batch[0].passageKey)
      return []
    }
    const middle = Math.ceil(batch.length / 2)
    return [
      ...(await embedSplitting(provider, batch.slice(0, middle), failed)),
      ...(await embedSplitting(provider, batch.slice(middle), failed)),
    ]
  }
}

/** PostgreSQL errors carry a five-character SQLSTATE; network and TLS failures do not. */
const isTransient = (error: unknown) => {
  const code = (error as { code?: unknown } | null)?.code
  return !(typeof code === 'string' && /^[0-9A-Z]{5}$/u.test(code))
}

/**
 * Writes one batch, again after a dropped connection (a TLS error ended a production run on
 * 2026-11-07): the insert is an upsert, so a batch written twice is written once.
 */
export async function writeBatch(writers: Pool, rows: string) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await writers.query(INSERT, [rows])
    } catch (error) {
      if (attempt >= 4 || !isTransient(error)) throw error
      await new Promise(resolve => setTimeout(resolve, 1_000 * attempt))
    }
  }
}

async function indexPublication(
  client: PoolClient,
  writers: Pool,
  publication: Publication,
  options: LibraryIndexOptions
): Promise<LibraryPublicationReport> {
  const started = Date.now()
  const { provider } = options
  const batchSize = options.batchSize ?? 50
  const concurrency = options.concurrency ?? 4
  const existing = new Map<string, string>()
  if (!options.dryRun) {
    const { rows } = await client.query<{
      passage_key: string
      input_sha256: string
      model: string
      contract: string
    }>(
      'select passage_key, input_sha256, model, contract from library_passages where publication_id = $1',
      [publication.id]
    )
    for (const row of rows)
      if (row.model === provider.model && row.contract === provider.contract)
        existing.set(row.passage_key, row.input_sha256)
  }
  const seen = new Set<string>()
  const report: LibraryPublicationReport = {
    identity: publication.identity,
    corpus: publication.corpus,
    passages: 0,
    embedded: 0,
    kept: 0,
    deleted: 0,
    characters: 0,
    embeddedCharacters: 0,
    failed: [],
    durationMs: 0,
  }
  for await (const drafts of publicationPassages(client, publication, options.sectionCuts)) {
    const pending: (LibraryPassageDraft & { document: string; inputSha256: string })[] = []
    for (const draft of drafts) {
      if (seen.has(draft.passageKey))
        throw new Error(`LIBRARY_DUPLICATE_PASSAGE ${publication.identity} ${draft.passageKey}`)
      seen.add(draft.passageKey)
      const document = libraryEmbeddingDocument(draft.heading, draft.content)
      const inputSha256 = sha256(`${provider.model}\n${provider.contract}\n${document}`)
      report.passages++
      report.characters += document.length
      if (existing.get(draft.passageKey) === inputSha256) report.kept++
      else pending.push({ ...draft, document, inputSha256 })
    }
    report.embedded += pending.length
    report.embeddedCharacters += pending.reduce((sum, draft) => sum + draft.document.length, 0)
    if (options.dryRun || !pending.length) continue
    const batches: (typeof pending)[] = []
    for (let start = 0; start < pending.length; start += batchSize)
      batches.push(pending.slice(start, start + batchSize))
    await mapConcurrently(batches, concurrency, async batch => {
      const embedded = await embedSplitting(provider, batch, report.failed)
      if (!embedded.length) return
      const rows = embedded.map(({ draft, vector }) =>
        passageRow(publication.id, draft, provider, vectorLiteral(vector))
      )
      // A connection runs one query at a time: batches are written on several connections.
      await writeBatch(writers, JSON.stringify(rows))
    })
    options.onProgress?.(
      `${publication.identity}: ${report.passages} passages, ${report.embedded} embedded`
    )
  }
  if (!options.dryRun) {
    const removed = [...existing.keys()].filter(key => !seen.has(key))
    for (let start = 0; start < removed.length; start += 5_000) {
      const result = await client.query(
        'delete from library_passages where publication_id = $1 and passage_key = any($2::text[])',
        [publication.id, removed.slice(start, start + 5_000)]
      )
      report.deleted += result.rowCount ?? 0
    }
  }
  report.embedded -= report.failed.length
  report.durationMs = Date.now() - started
  return report
}

/** The lexemes the search by words leaves to the search by meaning (about 2 min in full). */
export async function refreshLexemes(client: PoolClient) {
  await client.query('begin')
  try {
    await client.query('delete from library_lexemes')
    await client.query(
      `insert into library_lexemes (lexeme, passages)
       select word, ndoc from ts_stat('select search_vector from library_passages')
       where ndoc > $1`,
      [LIBRARY_LEXEME_MINIMUM_PASSAGES]
    )
    await client.query('commit')
  } catch (error) {
    await client.query('rollback')
    throw error
  }
}

const HNSW_INDEX = `create index if not exists library_passages_cosine_hnsw on library_passages
  using hnsw (embedding halfvec_cosine_ops) with (m = 16, ef_construction = 64)`

export async function indexLibrary(options: LibraryIndexOptions) {
  const connectionString =
    options.connectionString ?? process.env.RESOURCE_DATABASE_URL ?? LOCAL_DATABASE
  const pool = new Pool({ connectionString, max: 1 })
  const writers = new Pool({ connectionString, max: options.writers ?? 4 })
  // An idle writer whose connection drops is discarded by the pool; its next batch reconnects.
  writers.on('error', () => undefined)
  const client = await pool.connect()
  const reports: LibraryPublicationReport[] = []
  let removedInactive = 0
  try {
    // One index run at a time; publications stay readable meanwhile.
    const { rows } = await client.query<{ locked: boolean }>(
      'select pg_try_advisory_lock(3252027) as locked'
    )
    if (!rows[0]?.locked) throw new Error('LIBRARY_INDEX_ALREADY_RUNNING')
    const publications = await activePublications(client, options)
    if (!options.dryRun) {
      // Rows of publications that are no longer active go with them by cascade; none should remain.
      removedInactive =
        (
          await client.query(
            `delete from library_passages p using resource_publications r
             where r.id = p.publication_id and r.status <> 'active'`
          )
        ).rowCount ?? 0
      if (options.rebuildVectorIndex)
        await client.query('drop index if exists library_passages_cosine_hnsw')
    }
    for (const publication of publications) {
      const report = await indexPublication(client, writers, publication, options)
      reports.push(report)
      options.onProgress?.(
        `${report.identity}: ${report.passages} passages, ${report.embedded} embedded, ${report.kept} kept, ${report.deleted} deleted${report.failed.length ? `, ${report.failed.length} refused` : ''} in ${Math.round(report.durationMs / 1000)} s`
      )
    }
    if (!options.dryRun && options.rebuildVectorIndex) {
      options.onProgress?.('building the HNSW index')
      await client.query(`set maintenance_work_mem = '1GB'`)
      await client.query(HNSW_INDEX)
    }
    const changed = removedInactive > 0 || reports.some(report => report.embedded || report.deleted)
    if (!options.dryRun && (changed || options.refreshLexemes)) {
      options.onProgress?.('counting lexemes')
      await refreshLexemes(client)
    }
    if (!options.dryRun) await client.query('analyze library_passages')
    return reports
  } finally {
    await client.query('select pg_advisory_unlock(3252027)').catch(() => undefined)
    client.release()
    await Promise.all([pool.end(), writers.end()])
  }
}
