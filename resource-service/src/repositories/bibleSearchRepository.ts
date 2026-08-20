import { Effect } from 'effect'
import { sql, type Kysely } from 'kysely'

import { tryDatabasePromise } from '../database/databaseEffect'
import { makeNeonDatabase, type NeonDatabaseConfig } from '../database/neonDatabase'
import type { ResourceDatabase } from '../database/types'
import {
  ActiveBibleSearchPublicationUnavailable,
  BibleSearchRepositoryFailure,
  type ActiveBibleMultiSearch,
  type BibleMultiSearchInput,
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
): BibleSearchRepositoryService => {
  type SearchRow = {
    version_id: string
    revision: string
    metadata: Record<string, unknown>
    book: number | null
    chapter: number | null
    verse: number | null
    text: string | null
    total_count: number | string
  }

  const searchMany = (
    input: BibleMultiSearchInput
  ): Effect.Effect<
    ActiveBibleMultiSearch,
    ActiveBibleSearchPublicationUnavailable | BibleSearchRepositoryFailure
  > =>
    Effect.gen(function* () {
      const versionIds = [...new Set(input.versionIds)]
      const resourceIdentities = versionIds.map(versionId => `bible-text:${versionId}`)
      const query = input.query.trim()
      const filters = [sql`bv.text ILIKE ${`%${query}%`}`]
      if (input.book !== undefined) filters.push(sql`bv.book = ${input.book}`)
      if (input.section === 'ot') filters.push(sql`bv.book <= 39`)
      if (input.section === 'nt') filters.push(sql`bv.book >= 40`)
      const resultOrder =
        input.sortOrder === 'book'
          ? sql`bv.book, bv.chapter, bv.verse, ap.version_order`
          : sql`similarity(bv.text, ${query}) DESC, bv.book, bv.chapter, bv.verse, ap.version_order`
      const limit = input.limit ?? 100
      const offset = input.offset ?? 0

      const result = yield* tryDatabasePromise('bible.search.read-many', () =>
        sql<SearchRow>`
          WITH active_publications AS (
            SELECT rp.id,
                   replace(rp.resource_identity, 'bible-text:', '') AS version_id,
                   rp.revision,
                   rp.metadata,
                   array_position(
                     ARRAY[${sql.join(resourceIdentities.map(identity => sql`${identity}`))}]::text[],
                     rp.resource_identity
                   ) AS version_order
              FROM resource_publications rp
             WHERE rp.status = 'active'
               AND rp.resource_identity IN (${sql.join(
                 resourceIdentities.map(identity => sql`${identity}`)
               )})
          ),
          matched AS (
            SELECT ap.version_id,
                   ap.version_order,
                   bv.book,
                   bv.chapter,
                   bv.verse,
                   bv.text,
                   row_number() OVER (ORDER BY ${resultOrder}) AS result_position
              FROM active_publications ap
              JOIN bible_verses bv ON bv.publication_id = ap.id
             WHERE ${sql.join(filters, sql` AND `)}
          ),
          totals AS (
            SELECT count(*) AS total_count FROM matched
          )
          SELECT ap.version_id,
                 ap.revision,
                 ap.metadata,
                 page.book,
                 page.chapter,
                 page.verse,
                 page.text,
                 totals.total_count
            FROM active_publications ap
            CROSS JOIN totals
            LEFT JOIN matched page
              ON page.version_id = ap.version_id
             AND page.result_position > ${offset}
             AND page.result_position <= ${offset + limit}
           ORDER BY page.result_position NULLS LAST, ap.version_order
        `.execute(database)
      ).pipe(Effect.mapError(cause => new BibleSearchRepositoryFailure({ cause })))

      const rows = result.rows
      const resources = versionIds.flatMap(versionId => {
        const publication = rows.find(row => row.version_id === versionId)
        if (!publication) return []
        const bibleMetadata = metadata(publication.metadata)
        return [
          {
            versionId,
            revision:
              bibleMetadata.resource_revision ??
              bibleMetadata.text_revision ??
              publication.revision,
            textRevision:
              bibleMetadata.text_revision ??
              bibleMetadata.resource_revision ??
              publication.revision,
            ...(bibleMetadata.text_sha256 ? { textSha256: bibleMetadata.text_sha256 } : {}),
          },
        ]
      })
      const missingVersion = versionIds.find(
        versionId => !resources.some(resource => resource.versionId === versionId)
      )
      if (missingVersion) {
        return yield* new ActiveBibleSearchPublicationUnavailable({ versionId: missingVersion })
      }

      return {
        resources,
        count: Number(rows[0]?.total_count ?? 0),
        results: rows.flatMap(row =>
          row.book === null || row.chapter === null || row.verse === null || row.text === null
            ? []
            : [
                {
                  version: row.version_id,
                  book: row.book,
                  chapter: row.chapter,
                  verse: row.verse,
                  text: row.text,
                  highlighted: highlight(row.text, query),
                },
              ]
        ),
      }
    })

  return {
    searchMany,
    search: input =>
      searchMany({
        versionIds: [input.versionId],
        query: input.query,
        book: input.book,
        section: input.section,
        sortOrder: input.sortOrder,
        limit: input.limit,
        offset: input.offset,
      }).pipe(
        Effect.map(active => {
          const resource = active.resources[0]!
          return {
            ...resource,
            count: active.count,
            results: active.results,
          }
        })
      ),
  }
}

export const makeNeonBibleSearchRepository = (config: NeonDatabaseConfig) => {
  const database = makeNeonDatabase(config)
  return {
    repository: makeKyselyBibleSearchRepository(database),
    dispose: () => database.destroy(),
  }
}
