import { Effect } from 'effect'
import { type Kysely } from 'kysely'

import { tryDatabasePromise } from '../database/databaseEffect'
import { makeNeonDatabase, type NeonDatabaseConfig } from '../database/neonDatabase'
import type { ResourceDatabase } from '../database/types'
import {
  ActiveBibleSearchPublicationUnavailable,
  BibleSearchRepositoryFailure,
  type BibleSearchInput,
  type BibleSearchRepositoryService,
} from '../domain/bibleSearch'

type BibleMetadata = {
  resource_revision?: string
  text_revision?: string
  text_sha256?: string
}

const metadata = (value: Record<string, unknown>) => value as BibleMetadata

const highlight = (text: string, query: string) => {
  const terms = query
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .map(term => term.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'))
  if (terms.length === 0) return text
  const pattern = new RegExp(`(${terms.join('|')})`, 'giu')
  return text.replace(pattern, '{{$1}}')
}

export const makeKyselyBibleSearchRepository = (
  database: Kysely<ResourceDatabase>
): BibleSearchRepositoryService => ({
  search: input =>
    Effect.gen(function* () {
      const publication = yield* tryDatabasePromise('bible.search.read-publication', () =>
        database
          .selectFrom('resource_publications')
          .select(['id', 'revision', 'metadata'])
          .where('resource_identity', '=', `bible-text:${input.versionId}`)
          .where('status', '=', 'active')
          .executeTakeFirst()
      ).pipe(Effect.mapError(cause => new BibleSearchRepositoryFailure({ cause })))
      if (!publication) {
        return yield* new ActiveBibleSearchPublicationUnavailable({ versionId: input.versionId })
      }

      const query = input.query.trim()
      const pattern = `%${query}%`
      let filtered = database
        .selectFrom('bible_verses')
        .select(['book', 'chapter', 'verse', 'text'])
        .where('publication_id', '=', publication.id)
        .where('text', 'ilike', pattern)
      if (input.book !== undefined) filtered = filtered.where('book', '=', input.book)
      if (input.section === 'ot') filtered = filtered.where('book', '<=', 39)
      if (input.section === 'nt') filtered = filtered.where('book', '>=', 40)

      const countRow = yield* tryDatabasePromise('bible.search.count', () =>
        filtered
          .clearSelect()
          .select(expression => expression.fn.count('verse').as('count'))
          .executeTakeFirst()
      ).pipe(Effect.mapError(cause => new BibleSearchRepositoryFailure({ cause })))
      const count = Number(countRow?.count ?? 0)
      const sortOrder = input.sortOrder ?? 'relevance'
      const rows = yield* tryDatabasePromise('bible.search.read-results', () => {
        let ordered = filtered
        if (sortOrder === 'book') {
          ordered = ordered.orderBy('book').orderBy('chapter').orderBy('verse')
        } else {
          ordered = ordered.orderBy('book').orderBy('chapter').orderBy('verse')
        }
        return ordered
          .limit(input.limit ?? 100)
          .offset(input.offset ?? 0)
          .execute()
      }).pipe(Effect.mapError(cause => new BibleSearchRepositoryFailure({ cause })))
      const bibleMetadata = metadata(publication.metadata)
      return {
        versionId: input.versionId,
        revision:
          bibleMetadata.resource_revision ?? bibleMetadata.text_revision ?? publication.revision,
        textRevision:
          bibleMetadata.text_revision ?? bibleMetadata.resource_revision ?? publication.revision,
        ...(bibleMetadata.text_sha256 ? { textSha256: bibleMetadata.text_sha256 } : {}),
        count,
        results: rows.map(row => ({
          version: input.versionId,
          book: row.book,
          chapter: row.chapter,
          verse: row.verse,
          text: row.text,
          highlighted: highlight(row.text, query),
        })),
      }
    }),
})

export const makeNeonBibleSearchRepository = (config: NeonDatabaseConfig) => {
  const database = makeNeonDatabase(config)
  return {
    repository: makeKyselyBibleSearchRepository(database),
    dispose: () => database.destroy(),
  }
}
