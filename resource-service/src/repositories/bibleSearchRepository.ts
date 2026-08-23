import { Effect } from 'effect'
import { sql, type Kysely, type RawBuilder } from 'kysely'

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
import {
  highlightBibleSearchText,
  highlightFuzzyBibleSearchText,
  parseBibleTextSearchQuery,
} from '../../../src/helpers/bibleSearchInput'
import { highlightStemmedBibleSearchText } from '../search/bibleSearchStemming'

type BibleMetadata = {
  resource_revision?: string
  text_revision?: string
  text_sha256?: string
}

const metadata = (value: Record<string, unknown>) => value as BibleMetadata

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
    language: string | null
    match_tier: number | null
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
      const parsed = parseBibleTextSearchQuery(query)
      const normalizedQuery = parsed?.normalized ?? ''
      const normalizedText = sql`bible_search_normalize(bv.text)`
      const queryText = parsed?.terms.map(term => `${term}:*`).join(' & ') ?? ''
      const simpleQuery =
        parsed?.kind === 'phrase'
          ? sql`phraseto_tsquery('simple', ${normalizedQuery})`
          : sql`to_tsquery('simple', ${queryText})`
      const frenchQuery =
        parsed?.kind === 'phrase'
          ? sql`phraseto_tsquery('french', ${normalizedQuery})`
          : sql`to_tsquery('french', ${queryText})`
      const englishQuery =
        parsed?.kind === 'phrase'
          ? sql`phraseto_tsquery('english', ${normalizedQuery})`
          : sql`to_tsquery('english', ${queryText})`
      const simpleVector = sql`to_tsvector('simple', ${normalizedText})`
      const frenchVector = sql`to_tsvector('french', ${normalizedText})`
      const englishVector = sql`to_tsvector('english', ${normalizedText})`
      const textSearchPredicate = sql`(
        (ap.language = 'fr' AND ${frenchVector} @@ ${frenchQuery}) OR
        (ap.language = 'en' AND ${englishVector} @@ ${englishQuery}) OR
        (ap.language NOT IN ('fr', 'en') AND ${simpleVector} @@ ${simpleQuery})
      )`
      const relevanceScore = sql`CASE
        WHEN ap.language = 'fr' THEN ts_rank_cd(${frenchVector}, ${frenchQuery})
        WHEN ap.language = 'en' THEN ts_rank_cd(${englishVector}, ${englishQuery})
        ELSE ts_rank_cd(${simpleVector}, ${simpleQuery})
      END`
      const filters: RawBuilder<boolean>[] = []
      if (input.book !== undefined) filters.push(sql<boolean>`bv.book = ${input.book}`)
      if (input.canon) filters.push(sql<boolean>`ap.canon_id = ${input.canon}`)
      if (input.section === 'ot') {
        filters.push(sql<boolean>`(bv.book BETWEEN 1 AND 39 OR bv.book BETWEEN 67 AND 77)`)
      }
      if (input.section === 'nt') filters.push(sql<boolean>`bv.book BETWEEN 40 AND 66`)
      const filterSql = filters.length > 0 ? sql.join(filters, sql` AND `) : sql`TRUE`
      const fuzzyTerms =
        parsed?.kind === 'terms' ? parsed.terms.filter(term => term.length >= 4) : []
      const requiredShortTerms =
        parsed?.kind === 'terms' ? parsed.terms.filter(term => term.length < 4) : []
      const fuzzyPredicate =
        fuzzyTerms.length > 0
          ? sql.join(
              fuzzyTerms.map(term => sql`${term} <% ${normalizedText}`),
              sql` AND `
            )
          : sql`FALSE`
      const shortTermsPredicate =
        requiredShortTerms.length > 0
          ? sql`${simpleVector} @@ to_tsquery('simple', ${requiredShortTerms
              .map(term => `${term}:*`)
              .join(' & ')})`
          : sql`TRUE`
      const fuzzyScore =
        fuzzyTerms.length > 0
          ? sql`(${sql.join(
              fuzzyTerms.map(term => sql`word_similarity(${term}, ${normalizedText})`),
              sql` + `
            )}) / ${fuzzyTerms.length}`
          : sql`0`
      const resultOrder =
        input.sortOrder === 'book'
          ? sql`canonical_book_order, chapter, verse, version_order`
          : sql`match_tier, relevance_score DESC, canonical_book_order, chapter, verse, version_order`
      const limit = input.limit ?? 100
      const offset = input.offset ?? 0

      const result = yield* tryDatabasePromise('bible.search.read-many', () =>
        sql<SearchRow>`
          WITH active_publications AS (
            SELECT rp.id,
                   replace(rp.resource_identity, 'bible-text:', '') AS version_id,
                   rp.revision,
                   rp.language,
                   rp.metadata,
                   rp.metadata -> 'canon' ->> 'id' AS canon_id,
                   ARRAY(
                     SELECT jsonb_array_elements_text(
                       rp.metadata -> 'canon' -> 'orderedBooks'
                     )::integer
                   ) AS canonical_books,
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
          exact_matches AS MATERIALIZED (
            SELECT ap.version_id,
                   ap.version_order,
                   ap.language,
                   bv.book,
                   bv.chapter,
                   bv.verse,
                   bv.text,
                   array_position(ap.canonical_books, bv.book) AS canonical_book_order,
                   CASE
                     WHEN strpos(lower(bv.text), lower(${parsed?.raw ?? query})) > 0 THEN 0
                     ELSE 1
                   END AS match_tier,
                   ${relevanceScore} AS relevance_score
              FROM active_publications ap
              JOIN bible_verses bv ON bv.publication_id = ap.id
             WHERE ${filterSql}
               AND ${parsed ? textSearchPredicate : sql`FALSE`}
          ),
          fuzzy_matches AS MATERIALIZED (
            SELECT ap.version_id,
                   ap.version_order,
                   ap.language,
                   bv.book,
                   bv.chapter,
                   bv.verse,
                   bv.text,
                   array_position(ap.canonical_books, bv.book) AS canonical_book_order,
                   2 AS match_tier,
                   ${fuzzyScore} AS relevance_score
              FROM active_publications ap
              JOIN bible_verses bv ON bv.publication_id = ap.id
             WHERE ${filterSql}
               AND NOT EXISTS (SELECT 1 FROM exact_matches)
               AND ${fuzzyPredicate}
               AND ${shortTermsPredicate}
          ),
          matched AS (
            SELECT combined.*,
                   row_number() OVER (ORDER BY ${resultOrder}) AS result_position
              FROM (
                SELECT * FROM exact_matches
                UNION ALL
                SELECT * FROM fuzzy_matches
              ) combined
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
                 page.language,
                 page.match_tier,
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
                  highlighted:
                    row.match_tier === 2
                      ? highlightFuzzyBibleSearchText(row.text, query)
                      : row.language === 'fr' || row.language === 'en'
                        ? highlightStemmedBibleSearchText(row.text, query, row.language)
                        : highlightBibleSearchText(row.text, query),
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
        canon: input.canon,
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
