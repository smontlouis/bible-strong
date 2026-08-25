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
import {
  normalizeTopicSearchText,
  stripTopicQueryPrompt,
  TOPIC_EMBEDDING_CONTRACT,
  TOPIC_EMBEDDING_MIN_SIMILARITY,
  TOPIC_EMBEDDING_MODEL,
  type TopicEmbeddingProvider,
} from '../search/topicEmbedding'

type BibleMetadata = {
  resource_revision?: string
  text_revision?: string
  text_sha256?: string
}

const metadata = (value: Record<string, unknown>) => value as BibleMetadata

export const makeKyselyBibleSearchRepository = (
  database: Kysely<ResourceDatabase>,
  options: {
    embeddingProvider?: TopicEmbeddingProvider
    reportEmbeddingFailure?: (cause: unknown) => void
  } = {}
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
    match_kind: 'lexical' | 'topic' | 'semantic' | 'hybrid' | null
    topic_id: string | null
    topic_label: string | null
    source_list: string | null
    end_chapter: number | null
    end_verse: number | null
    lexical_candidates: number | string
    topic_candidates: number | string
    vector_topic_candidates: number | string
    thematic_candidates: number | string
    source_candidates: { source: string; count: number | string }[] | null
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
      const topicQuery = stripTopicQueryPrompt(query)
      const normalizedRawQuery = normalizeTopicSearchText(query)
      const lexicalQuery = topicQuery !== normalizedRawQuery ? topicQuery : query
      const parsed = parseBibleTextSearchQuery(lexicalQuery)
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
      const normalizedTopicQuery = normalizeTopicSearchText(topicQuery)
      const topicSearchEnabled = parsed?.kind !== 'phrase'
      const topicTerms = normalizedTopicQuery.split(/\s+/).filter(Boolean)
      const semanticQueryEnabled =
        topicSearchEnabled && topicTerms.some(term => /[aeiouy]/.test(term))
      const topicQueryText = topicTerms.map(term => `${term}:*`).join(' & ')
      const topicTextQuery = topicQueryText
        ? sql`to_tsquery('simple', ${topicQueryText})`
        : sql`to_tsquery('simple', '')`
      let topicEmbedding: number[] | undefined
      if (options.embeddingProvider && normalizedTopicQuery && semanticQueryEnabled) {
        const exactTopic = yield* tryDatabasePromise('bible.search.topic-exact-probe', () =>
          database
            .selectFrom('thematic_topic_aliases')
            .select('topic_id')
            .where('normalized_alias', '=', normalizedTopicQuery)
            .limit(1)
            .executeTakeFirst()
        ).pipe(Effect.mapError(cause => new BibleSearchRepositoryFailure({ cause })))
        if (!exactTopic) {
          topicEmbedding = yield* Effect.tryPromise({
            try: () => options.embeddingProvider!.embedQuery(topicQuery),
            catch: cause => cause,
          }).pipe(
            Effect.catchAll(cause => {
              options.reportEmbeddingFailure?.(cause)
              return Effect.succeed(undefined)
            })
          )
        }
      }
      const topicEmbeddingVector = topicEmbedding ? `[${topicEmbedding.join(',')}]` : null
      const topicLanguage = input.language ?? 'fr'
      const resultOrder =
        input.sortOrder === 'book'
          ? sql`canonical_book_order, chapter, verse, version_order`
          : sql`fused_score DESC, canonical_book_order, chapter, verse, version_order`
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
          lexical_ranked AS (
            SELECT combined.*,
                   row_number() OVER (
                     ORDER BY match_tier, relevance_score DESC,
                              canonical_book_order, chapter, verse, version_order
                   ) AS lexical_rank
              FROM (
                SELECT * FROM exact_matches
                UNION ALL
                SELECT * FROM fuzzy_matches
              ) combined
          ),
          topic_exact AS MATERIALIZED (
            SELECT ranked.topic_id,
                   0 AS signal_priority,
                   ranked.signal_rank
              FROM (
                SELECT tta.topic_id,
                       row_number() OVER (
                         ORDER BY (tta.language = ${topicLanguage}) DESC,
                                  tta.is_preferred DESC,
                                  tta.alias
                       ) AS signal_rank
                  FROM thematic_topic_aliases tta
                  JOIN thematic_topics tt ON tt.id = tta.topic_id AND tt.active
                 WHERE tta.language IN (${topicLanguage}, 'en')
                   AND tta.normalized_alias = ${normalizedTopicQuery}
                   AND ${topicSearchEnabled}
              ) ranked
          ),
          topic_text AS MATERIALIZED (
            SELECT ranked.topic_id,
                   1 AS signal_priority,
                   ranked.signal_rank
              FROM (
                SELECT tta.topic_id,
                       row_number() OVER (
                         ORDER BY ts_rank_cd(
                           to_tsvector('simple', bible_search_normalize(tta.alias)),
                           ${topicTextQuery}
                         ) DESC,
                         similarity(bible_search_normalize(tta.alias), ${normalizedTopicQuery}) DESC
                       ) AS signal_rank
                  FROM thematic_topic_aliases tta
                  JOIN thematic_topics tt ON tt.id = tta.topic_id AND tt.active
                 WHERE ${topicSearchEnabled}
                   AND (
                     ${topicQueryText ? sql`to_tsvector('simple', bible_search_normalize(tta.alias)) @@ ${topicTextQuery}` : sql`FALSE`}
                     OR (${normalizedTopicQuery.length >= 4} AND
                         bible_search_normalize(tta.alias) % ${normalizedTopicQuery})
                   )
              ) ranked
             WHERE ranked.signal_rank <= 30
               AND NOT EXISTS (SELECT 1 FROM topic_exact)
          ),
          topic_vector_candidates AS MATERIALIZED (
            SELECT tte.topic_id,
                   1 - (tte.embedding <=> ${topicEmbeddingVector}::vector) AS similarity
              FROM thematic_topic_embeddings tte
              JOIN thematic_topics tt ON tt.id = tte.topic_id AND tt.active
             WHERE tte.model = ${TOPIC_EMBEDDING_MODEL}
               AND tte.contract = ${TOPIC_EMBEDDING_CONTRACT}
               AND ${Boolean(topicEmbedding)}
             ORDER BY tte.embedding <=> ${topicEmbeddingVector}::vector
             LIMIT 40
          ),
          topic_vector AS MATERIALIZED (
            SELECT ranked.topic_id,
                   2 AS signal_priority,
                   ranked.signal_rank
              FROM (
                SELECT candidate.topic_id,
                       candidate.similarity,
                       row_number() OVER (
                         ORDER BY candidate.similarity DESC
                       ) AS signal_rank
                 FROM topic_vector_candidates candidate
             ) ranked
             WHERE ranked.signal_rank <= 5
               AND ranked.similarity >= ${TOPIC_EMBEDDING_MIN_SIMILARITY}
               AND NOT EXISTS (SELECT 1 FROM topic_exact)
               AND NOT EXISTS (SELECT 1 FROM topic_text)
          ),
          topic_signals AS (
            SELECT topic_id, signal_priority, signal_rank FROM topic_exact
            UNION ALL
            SELECT topic_id, signal_priority, signal_rank FROM topic_text
            UNION ALL
            SELECT topic_id, signal_priority, signal_rank FROM topic_vector
          ),
          matched_topics AS MATERIALIZED (
            SELECT ts.topic_id,
                   min(ts.signal_priority) AS signal_priority,
                   sum(
                     (CASE ts.signal_priority WHEN 0 THEN 4.0 WHEN 1 THEN 3.0 ELSE 1.4 END) /
                     (60.0 + ts.signal_rank)
                   ) AS topic_score,
                   coalesce(
                     (
                       SELECT preferred.alias
                         FROM thematic_topic_aliases preferred
                        WHERE preferred.topic_id = ts.topic_id
                          AND preferred.language = ${topicLanguage}
                          AND preferred.is_preferred
                        LIMIT 1
                     ),
                     max(tt.canonical_name)
                   ) AS topic_label
              FROM topic_signals ts
              JOIN thematic_topics tt ON tt.id = ts.topic_id
             GROUP BY ts.topic_id
             ORDER BY topic_score DESC
             LIMIT 20
          ),
          expanded_topics AS (
            SELECT mt.topic_id AS passage_topic_id,
                   mt.topic_id AS matched_topic_id,
                   mt.topic_label,
                   mt.signal_priority,
                   mt.topic_score
              FROM matched_topics mt
            UNION ALL
            SELECT relation.related_topic_id AS passage_topic_id,
                   mt.topic_id AS matched_topic_id,
                   mt.topic_label,
                   mt.signal_priority,
                   mt.topic_score * 0.8 AS topic_score
              FROM matched_topics mt
              JOIN thematic_topic_relations relation
                ON relation.topic_id = mt.topic_id
               AND relation.relation_type = 'see-also'
          ),
          direct_topic_passages AS (
            SELECT expanded.matched_topic_id,
                   expanded.topic_label,
                   expanded.signal_priority,
                   expanded.topic_score,
                   passage.source,
                   passage.book,
                   passage.chapter_start,
                   passage.verse_start,
                   passage.chapter_end,
                   passage.verse_end,
                   passage.source_score,
                   passage.source_votes
              FROM expanded_topics expanded
              JOIN thematic_topic_passages passage
                ON passage.topic_id = expanded.passage_topic_id
          ),
          nave_topic_passages AS (
            SELECT expanded.matched_topic_id,
                   expanded.topic_label,
                   expanded.signal_priority,
                   expanded.topic_score,
                   'nave'::text AS source,
                   split_part(link.verse_key, '-', 1)::integer AS book,
                   split_part(link.verse_key, '-', 2)::integer AS chapter_start,
                   split_part(link.verse_key, '-', 3)::integer AS verse_start,
                   split_part(link.verse_key, '-', 2)::integer AS chapter_end,
                   split_part(link.verse_key, '-', 3)::integer AS verse_end,
                   NULL::double precision AS source_score,
                   NULL::integer AS source_votes
              FROM expanded_topics expanded
              JOIN thematic_topic_sources source_topic
                ON source_topic.topic_id = expanded.passage_topic_id
               AND source_topic.source = 'nave'
              JOIN resource_publications nave_publication
                ON nave_publication.resource_identity = 'nave:en'
               AND nave_publication.status = 'active'
              JOIN nave_verse_links link
                ON link.publication_id = nave_publication.id
               AND link.normalized_name = source_topic.source_key
             WHERE link.verse_key ~ '^\\d+-\\d+-\\d+$'
          ),
          thematic_source_passages AS (
            SELECT * FROM direct_topic_passages
            UNION ALL
            SELECT * FROM nave_topic_passages
          ),
          psalm_reference_offsets AS MATERIALIZED (
            SELECT ap.id AS publication_id,
                   target.chapter,
                   target.verse_count - source.verse_count AS verse_offset
              FROM active_publications ap
              JOIN (
                SELECT publication_id, chapter, count(*)::integer AS verse_count
                  FROM bible_verses
                 WHERE book = 19
                 GROUP BY publication_id, chapter
              ) target ON target.publication_id = ap.id
              JOIN resource_publications source_publication
                ON source_publication.resource_identity = 'bible-text:ESV'
               AND source_publication.status = 'active'
              JOIN (
                SELECT publication_id, chapter, count(*)::integer AS verse_count
                  FROM bible_verses
                 WHERE book = 19
                 GROUP BY publication_id, chapter
              ) source
                ON source.publication_id = source_publication.id
               AND source.chapter = target.chapter
             WHERE target.verse_count - source.verse_count BETWEEN 0 AND 2
          ),
          thematic_candidates AS MATERIALIZED (
            SELECT ap.version_id,
                   ap.version_order,
                   ap.language,
                   bv.book,
                   bv.chapter,
                   bv.verse,
                   bv.text,
                   array_position(ap.canonical_books, bv.book) AS canonical_book_order,
                   source_passage.matched_topic_id,
                   source_passage.topic_label,
                   source_passage.signal_priority,
                   source_passage.source,
                   source_passage.chapter_end,
                   source_passage.verse_end + coalesce(end_reference_offset.verse_offset, 0)
                     AS verse_end,
                   source_passage.topic_score * 100 +
                     CASE source_passage.source
                       WHEN 'nave' THEN 0.030
                       WHEN 'torrey' THEN 0.025
                       ELSE 0.020
                     END +
                     least(0.020, ln(1 + greatest(coalesce(source_passage.source_score, 0), 0)) * 0.005) +
                     least(0.010, ln(1 + greatest(coalesce(source_passage.source_votes, 0), 0)) * 0.001)
                     AS thematic_score
              FROM active_publications ap
              JOIN thematic_source_passages source_passage
                ON array_position(ap.canonical_books, source_passage.book) IS NOT NULL
              LEFT JOIN psalm_reference_offsets start_reference_offset
                ON start_reference_offset.publication_id = ap.id
               AND source_passage.book = 19
               AND start_reference_offset.chapter = source_passage.chapter_start
              LEFT JOIN psalm_reference_offsets end_reference_offset
                ON end_reference_offset.publication_id = ap.id
               AND source_passage.book = 19
               AND end_reference_offset.chapter = source_passage.chapter_end
              JOIN bible_verses bv
                ON bv.publication_id = ap.id
               AND bv.book = source_passage.book
               AND bv.chapter = source_passage.chapter_start
               AND bv.verse = source_passage.verse_start +
                 coalesce(start_reference_offset.verse_offset, 0)
              JOIN bible_verses range_end
                ON range_end.publication_id = ap.id
               AND range_end.book = source_passage.book
               AND range_end.chapter = source_passage.chapter_end
               AND range_end.verse = source_passage.verse_end +
                 coalesce(end_reference_offset.verse_offset, 0)
             WHERE ${filterSql}
          ),
          thematic_collapsed AS (
            SELECT version_id,
                   version_order,
                   language,
                   book,
                   chapter,
                   verse,
                   max(text) AS text,
                   max(canonical_book_order) AS canonical_book_order,
                   min(signal_priority) AS signal_priority,
                   (array_agg(matched_topic_id ORDER BY thematic_score DESC))[1] AS matched_topic_id,
                   (array_agg(topic_label ORDER BY thematic_score DESC))[1] AS topic_label,
                   string_agg(DISTINCT source, ',') AS source_list,
                   (array_agg(chapter_end ORDER BY thematic_score DESC))[1] AS chapter_end,
                   (array_agg(verse_end ORDER BY thematic_score DESC))[1] AS verse_end,
                   max(thematic_score) AS thematic_score
              FROM thematic_candidates
             GROUP BY version_id, version_order, language, book, chapter, verse
          ),
          thematic_ranked AS (
            SELECT thematic_collapsed.*,
                   row_number() OVER (
                     ORDER BY thematic_score DESC, canonical_book_order, chapter, verse, version_order
                   ) AS thematic_rank
              FROM thematic_collapsed
          ),
          contributions AS (
            SELECT version_id,
                   version_order,
                   language,
                   book,
                   chapter,
                   verse,
                   text,
                   canonical_book_order,
                   match_tier,
                   NULL::integer AS signal_priority,
                   NULL::text AS matched_topic_id,
                   NULL::text AS topic_label,
                   NULL::text AS source_list,
                   NULL::integer AS chapter_end,
                   NULL::integer AS verse_end,
                   (CASE match_tier WHEN 0 THEN 3.0 WHEN 1 THEN 2.4 ELSE 1.2 END) /
                     (60.0 + lexical_rank) AS contribution,
                   true AS is_lexical,
                   false AS is_thematic
              FROM lexical_ranked
            UNION ALL
            SELECT version_id,
                   version_order,
                   language,
                   book,
                   chapter,
                   verse,
                   text,
                   canonical_book_order,
                   NULL::integer AS match_tier,
                   signal_priority,
                   matched_topic_id,
                   topic_label,
                   source_list,
                   chapter_end,
                   verse_end,
                   (CASE signal_priority WHEN 0 THEN 4.0 WHEN 1 THEN 3.0 ELSE 1.4 END) /
                     (60.0 + thematic_rank) AS contribution,
                   false AS is_lexical,
                   true AS is_thematic
              FROM thematic_ranked
          ),
          fused AS (
            SELECT version_id,
                   max(version_order) AS version_order,
                   max(language) AS language,
                   book,
                   chapter,
                   verse,
                   max(text) AS text,
                   max(canonical_book_order) AS canonical_book_order,
                   min(match_tier) FILTER (WHERE is_lexical) AS match_tier,
                   bool_or(is_lexical) AS has_lexical,
                   bool_or(is_thematic) AS has_thematic,
                   min(signal_priority) FILTER (WHERE is_thematic) AS signal_priority,
                   (array_agg(matched_topic_id ORDER BY contribution DESC)
                     FILTER (WHERE is_thematic))[1] AS topic_id,
                   (array_agg(topic_label ORDER BY contribution DESC)
                     FILTER (WHERE is_thematic))[1] AS topic_label,
                   (array_agg(source_list ORDER BY contribution DESC)
                     FILTER (WHERE is_thematic))[1] AS source_list,
                   (array_agg(chapter_end ORDER BY contribution DESC)
                     FILTER (WHERE is_thematic))[1] AS end_chapter,
                   (array_agg(verse_end ORDER BY contribution DESC)
                     FILTER (WHERE is_thematic))[1] AS end_verse,
                   sum(contribution) AS fused_score
              FROM contributions
             GROUP BY version_id, book, chapter, verse
          ),
          matched AS (
            SELECT fused.*,
                   CASE
                     WHEN has_lexical AND has_thematic THEN 'hybrid'
                     WHEN has_thematic AND signal_priority = 2 THEN 'semantic'
                     WHEN has_thematic THEN 'topic'
                     ELSE 'lexical'
                   END AS match_kind,
                   row_number() OVER (ORDER BY ${resultOrder}) AS result_position
              FROM fused
          ),
          totals AS (
            SELECT count(*) AS total_count FROM matched
          ),
          source_diagnostics AS (
            SELECT coalesce(
                     jsonb_agg(
                       jsonb_build_object('source', source, 'count', source_count)
                       ORDER BY source
                     ),
                     '[]'::jsonb
                   ) AS source_candidates
              FROM (
                SELECT source, count(*) AS source_count
                  FROM thematic_candidates
                 GROUP BY source
              ) counts
          ),
          diagnostics AS (
            SELECT (SELECT count(*) FROM lexical_ranked) AS lexical_candidates,
                   (SELECT count(*) FROM matched_topics WHERE signal_priority < 2)
                     AS topic_candidates,
                   (SELECT count(*) FROM topic_vector) AS vector_topic_candidates,
                   (SELECT count(*) FROM thematic_collapsed) AS thematic_candidates,
                   source_diagnostics.source_candidates
              FROM source_diagnostics
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
                 page.match_kind,
                 page.topic_id,
                 page.topic_label,
                 page.source_list,
                 page.end_chapter,
                 page.end_verse,
                 diagnostics.lexical_candidates,
                 diagnostics.topic_candidates,
                 diagnostics.vector_topic_candidates,
                 diagnostics.thematic_candidates,
                 diagnostics.source_candidates,
                 totals.total_count
            FROM active_publications ap
            CROSS JOIN totals
            CROSS JOIN diagnostics
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
        diagnostics: {
          lexicalCandidates: Number(rows[0]?.lexical_candidates ?? 0),
          topicCandidates: Number(rows[0]?.topic_candidates ?? 0),
          vectorTopicCandidates: Number(rows[0]?.vector_topic_candidates ?? 0),
          thematicCandidates: Number(rows[0]?.thematic_candidates ?? 0),
          fusedCandidates: Number(rows[0]?.total_count ?? 0),
          sourceCandidates: (rows[0]?.source_candidates ?? []).map(source => ({
            source: source.source,
            count: Number(source.count),
          })),
        },
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
                    row.match_kind === 'topic' || row.match_kind === 'semantic'
                      ? row.text
                      : row.match_tier === 2
                        ? highlightFuzzyBibleSearchText(row.text, lexicalQuery)
                        : row.language === 'fr' || row.language === 'en'
                          ? highlightStemmedBibleSearchText(row.text, lexicalQuery, row.language)
                          : highlightBibleSearchText(row.text, lexicalQuery),
                  match: {
                    kind: row.match_kind ?? 'lexical',
                    ...(row.topic_id ? { topicId: row.topic_id } : {}),
                    ...(row.topic_label ? { topicLabel: row.topic_label } : {}),
                    ...(row.source_list
                      ? { sources: row.source_list.split(',').filter(Boolean).sort() }
                      : {}),
                  },
                  ...(row.end_chapter !== null ? { endChapter: row.end_chapter } : {}),
                  ...(row.end_verse !== null ? { endVerse: row.end_verse } : {}),
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
        language: input.language,
      }).pipe(
        Effect.map(active => {
          const resource = active.resources[0]!
          return {
            ...resource,
            count: active.count,
            results: active.results,
            diagnostics: active.diagnostics,
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
