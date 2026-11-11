// Imports a document collection into the library (ADR-0106). A new
// file of a collection becomes a new revision of its publication, library:<collection>:<language>;
// once all its passages are written it replaces the previous revision, whose passages go with it.
import { Pool } from 'pg'

import {
  collectionIdentity,
  documentPassages,
  parseCollectionDocument,
  unmatchedPassageLabels,
  type LibraryCollection,
  type LibraryDocument,
} from '../search/libraryCollections'
import {
  libraryEmbeddingDocument,
  vectorLiteral,
  type LibraryEmbeddingProvider,
} from '../search/libraryEmbedding'
import {
  embedSplitting,
  mapConcurrently,
  passageRow,
  refreshLexemes,
  sha256,
  writeBatch,
} from './libraryIndexRepository'

const LOCAL_DATABASE = 'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong'
export const LIBRARY_COLLECTION_KIND = 'library-collection'

export type LibraryCollectionImportOptions = {
  connectionString?: string
  provider: LibraryEmbeddingProvider
  /** The collection the first line of the prepared file describes. */
  collection: LibraryCollection
  /** The other lines of the prepared file, one per document. */
  records: readonly Record<string, unknown>[]
  /** Where the records come from, recorded in the provenance. */
  source: string
  batchSize?: number
  concurrency?: number
  writers?: number
  onProgress?: (line: string) => void
}

export type LibraryCollectionImportReport = {
  identity: string
  revision: string
  status: 'activated' | 'unchanged'
  documents: number
  skipped: number
  passages: number
  embedded: number
  reused: number
  /** Passage labels whose excerpt is in none of the passages of their document. */
  unmatchedPassageLabels: number
  failed: string[]
}

export async function importLibraryCollection(
  options: LibraryCollectionImportOptions
): Promise<LibraryCollectionImportReport> {
  const { provider, collection } = options
  const documents: LibraryDocument[] = []
  for (const record of options.records) {
    const document = parseCollectionDocument(record)
    if (document) documents.push(document)
  }
  const keys = new Set<string>()
  for (const document of documents) {
    if (keys.has(document.key)) throw new Error(`LIBRARY_DUPLICATE_DOCUMENT ${document.key}`)
    keys.add(document.key)
  }
  const drafts = documents
    .flatMap(document => documentPassages(collection, document))
    .map(draft => {
      const document = libraryEmbeddingDocument(draft.heading, draft.content)
      return {
        ...draft,
        document,
        inputSha256: sha256(`${provider.model}\n${provider.contract}\n${document}`),
      }
    })
  const identity = collectionIdentity(collection.id, collection.language)
  // Documents without passage labels hash as they did before passage labels existed.
  const canonical = sha256(
    JSON.stringify(
      documents.map(({ passageLabels, ...document }) =>
        passageLabels.length ? { ...document, passageLabels } : document
      )
    )
  )
  const revision = `${collection.id}-${collection.language}-${canonical.slice(0, 20)}`
  const report: LibraryCollectionImportReport = {
    identity,
    revision,
    status: 'unchanged',
    documents: documents.length,
    skipped: options.records.length - documents.length,
    passages: drafts.length,
    embedded: 0,
    reused: 0,
    unmatchedPassageLabels: documents.reduce(
      (total, document) => total + unmatchedPassageLabels(document).length,
      0
    ),
    failed: [],
  }

  const connectionString =
    options.connectionString ?? process.env.RESOURCE_DATABASE_URL ?? LOCAL_DATABASE
  const pool = new Pool({ connectionString, max: 1 })
  const writers = new Pool({ connectionString, max: options.writers ?? 4 })
  writers.on('error', () => undefined)
  const client = await pool.connect()
  try {
    // The library index and collection imports write one at a time.
    const { rows: lock } = await client.query<{ locked: boolean }>(
      'select pg_try_advisory_lock(3252027) as locked'
    )
    if (!lock[0]?.locked) throw new Error('LIBRARY_INDEX_ALREADY_RUNNING')
    const { rows: active } = await client.query<{ id: number; revision: string }>(
      `select id, revision from resource_publications
       where resource_identity = $1 and status = 'active'`,
      [identity]
    )
    if (active[0]?.revision === revision) return report

    // A vector whose embedded text did not change is copied from the active revision.
    const previous = new Map<string, { input: string; embedding: string }>()
    if (active[0]) {
      const { rows } = await client.query<{
        passage_key: string
        input_sha256: string
        embedding: string
      }>(
        `select passage_key, input_sha256, embedding::text as embedding
         from library_passages where publication_id = $1`,
        [active[0].id]
      )
      for (const row of rows)
        previous.set(row.passage_key, { input: row.input_sha256, embedding: row.embedding })
    }

    await client.query(
      `delete from resource_publications
       where resource_identity = $1 and revision = $2 and status = 'staged'`,
      [identity, revision]
    )
    const now = new Date().toISOString()
    const { rows: created } = await client.query<{ id: number }>(
      `insert into resource_publications (resource_identity, resource_kind, revision, language,
         status, canonical_sha256, offline_artifact_sha256, provenance, rights, metadata)
       values ($1, $2, $3, $4, 'staged', $5, $5, $6, $7, $8) returning id`,
      [
        identity,
        LIBRARY_COLLECTION_KIND,
        revision,
        collection.language,
        canonical,
        JSON.stringify({
          generator: 'library:collection',
          source: options.source,
          source_sha256: canonical,
          imported_at: now,
        }),
        JSON.stringify({ ...collection.rights, online: true, offline: false, reviewed_at: now }),
        JSON.stringify({
          collection: collection.id,
          title: collection.title,
          documents: documents.length,
          passages: drafts.length,
        }),
      ]
    )
    const publicationId = created[0].id

    const reused = drafts.filter(
      draft => previous.get(draft.passageKey)?.input === draft.inputSha256
    )
    const pending = drafts.filter(
      draft => previous.get(draft.passageKey)?.input !== draft.inputSha256
    )
    const batchSize = options.batchSize ?? 50
    for (let start = 0; start < reused.length; start += 500) {
      const rows = reused
        .slice(start, start + 500)
        .map(draft =>
          passageRow(publicationId, draft, provider, previous.get(draft.passageKey)!.embedding)
        )
      await writeBatch(writers, JSON.stringify(rows))
    }
    report.reused = reused.length
    const batches: (typeof pending)[] = []
    for (let start = 0; start < pending.length; start += batchSize)
      batches.push(pending.slice(start, start + batchSize))
    let done = 0
    await mapConcurrently(batches, options.concurrency ?? 8, async batch => {
      const embedded = await embedSplitting(provider, batch, report.failed)
      if (embedded.length)
        await writeBatch(
          writers,
          JSON.stringify(
            embedded.map(({ draft, vector }) =>
              passageRow(publicationId, draft, provider, vectorLiteral(vector))
            )
          )
        )
      report.embedded += embedded.length
      done += batch.length
      if (done % 1000 < batch.length) options.onProgress?.(`${identity}: ${done}/${pending.length} embedded`)
    })

    // The new revision replaces the previous one, whose passages are deleted with it.
    await client.query('begin')
    try {
      await client.query(
        'delete from resource_publications where resource_identity = $1 and id <> $2',
        [identity, publicationId]
      )
      await client.query(
        `update resource_publications set status = 'active', activated_at = now() where id = $1`,
        [publicationId]
      )
      await client.query('commit')
    } catch (error) {
      await client.query('rollback')
      throw error
    }
    report.status = 'activated'
    options.onProgress?.('counting lexemes')
    await refreshLexemes(client)
    await client.query('analyze library_passages')
    return report
  } finally {
    await client.query('select pg_advisory_unlock(3252027)').catch(() => undefined)
    client.release()
    await Promise.all([pool.end(), writers.end()])
  }
}
