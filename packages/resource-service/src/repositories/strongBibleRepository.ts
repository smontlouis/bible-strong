import { Effect } from 'effect'
import { sql, type Kysely } from 'kysely'

import { getStrongBibleConcordanceCandidates } from '@bible-strong/resource-domain/strong-bible-concordance'
import {
  decodeStrongBibleOccurrenceCursor,
  encodeStrongBibleOccurrenceCursor,
} from '@bible-strong/resource-domain/contracts/strongBibleContract'
import type { StrongBibleSpan } from '@bible-strong/resource-domain/strong-bible'
import { STRONG_IDENTITY_KINDS } from '@bible-strong/resource-domain/strong-identities'
import { tryDatabasePromise } from '../database/databaseEffect'
import { makeNeonDatabase, type NeonDatabaseConfig } from '../database/neonDatabase'
import type { ResourceDatabase } from '../database/types'
import {
  ActiveStrongBiblePublicationUnavailable,
  StrongBibleChapterNotFound,
  StrongBibleRepositoryFailure,
  type ActiveStrongBibleCounts,
  type StrongBibleReferencesLookup,
  type StrongBibleRepositoryService,
  type StrongBibleResourceRevision,
} from '../domain/strongBible'

type StrongBiblePublicationMetadata = {
  dataset_id: string
  resource_revision?: string
  text_revision: string
  text_sha256: string
  strong_revision: string
}

type BiblePublicationMetadata = {
  resource_revision?: string
  text_revision?: string
  text_sha256?: string
}

const metadataFrom = (value: Record<string, unknown>) => value as StrongBiblePublicationMetadata

const revisionFrom = (publication: {
  revision: string
  metadata: Record<string, unknown>
  resource_identity: string
}): StrongBibleResourceRevision => {
  const metadata = metadataFrom(publication.metadata)
  return {
    versionId: publication.resource_identity.slice('strong-bible-index:'.length),
    datasetId: metadata.dataset_id,
    revision: metadata.resource_revision ?? publication.revision,
    textRevision: metadata.text_revision,
    textSha256: metadata.text_sha256,
    strongRevision: metadata.strong_revision,
  }
}

type SpanRow = {
  book: number
  chapter: number
  verse: number
  ordinal: number
  start_offset: number
  length: number
  step_token_ids: number[]
  identity_order: number | null
  identity_id: number | null
  kind: string | null
  code: string | null
}

const groupSpans = (rows: readonly SpanRow[]) => {
  const spansByVerse = new Map<string, StrongBibleSpan[]>()
  const spans = new Map<string, StrongBibleSpan>()
  for (const row of rows) {
    const verseKey = `${row.book}-${row.chapter}-${row.verse}`
    const spanKey = `${verseKey}-${row.ordinal}`
    let span = spans.get(spanKey)
    if (!span) {
      span = {
        ordinal: row.ordinal,
        startOffset: row.start_offset,
        length: row.length,
        ...(row.step_token_ids.length ? { stepTokenIds: [...row.step_token_ids] } : {}),
        identities: [],
      }
      spans.set(spanKey, span)
      const verseSpans = spansByVerse.get(verseKey) ?? []
      verseSpans.push(span)
      spansByVerse.set(verseKey, verseSpans)
    }
    if (
      row.kind &&
      row.code &&
      STRONG_IDENTITY_KINDS.includes(row.kind as (typeof STRONG_IDENTITY_KINDS)[number]) &&
      !span.identities.some(identity => identity.kind === row.kind && identity.code === row.code)
    ) {
      span.identities.push({
        kind: row.kind as StrongBibleSpan['identities'][number]['kind'],
        code: row.code,
      })
    }
  }
  return spansByVerse
}

/**
 * How the counts of several references are fetched. `one-statement` gathers them in a single
 * round trip. `read-by-read` reads each reference as its own counts route does, a round trip
 * or two per reference: it is the reference the single statement is tested against.
 */
export type StrongBibleReferenceCountsRead = 'one-statement' | 'read-by-read'

export type StrongBibleRepositoryOptions = {
  referenceCountsRead?: StrongBibleReferenceCountsRead
}

type PublicationRow = {
  id: number
  revision: string
  metadata: Record<string, unknown>
  resource_identity: string
}
type IdentityCandidate = { kind: (typeof STRONG_IDENTITY_KINDS)[number]; code: string }
type IdentityRow = { identity_id: number | null; kind: string | null; code: string | null }

// Row choices of a concordance read. The reads of one reference and of several apply the
// same ones, so they can differ only in how rows are fetched.

/** The identities a reference may name in the index of a book, in the order they are tried. */
const identityCandidatesOf = (book: number, reference: string | number): IdentityCandidate[] =>
  getStrongBibleConcordanceCandidates(book, reference).flatMap(candidate => {
    const kind = STRONG_IDENTITY_KINDS[candidate.kind]
    return kind ? [{ kind, code: candidate.code }] : []
  })

/** The identity a reference names: the first of its candidates that the index holds. */
const identityNamedBy = (
  candidates: readonly IdentityCandidate[],
  identities: readonly IdentityRow[]
): ActiveStrongBibleCounts['identity'] => {
  for (const candidate of candidates) {
    const identity = identities.find(
      row => row.kind === candidate.kind && row.code === candidate.code
    )
    if (identity?.identity_id != null) {
      return { id: identity.identity_id, kind: candidate.kind, code: candidate.code }
    }
  }
  return undefined
}

// An index is read only with the Bible text it was aligned on.
const activePublicationOf = <Row extends PublicationRow>(
  versionId: string,
  rows: readonly Row[]
): Row | undefined => {
  const publication = rows.find(row => row.resource_identity === `strong-bible-index:${versionId}`)
  const biblePublication = rows.find(row => row.resource_identity === `bible-text:${versionId}`)
  if (!publication || !biblePublication) return undefined

  const bibleMetadata = biblePublication.metadata as BiblePublicationMetadata
  const bibleTextRevision =
    bibleMetadata.text_revision ?? bibleMetadata.resource_revision ?? biblePublication.revision
  const strongMetadata = metadataFrom(publication.metadata)
  return bibleTextRevision === strongMetadata.text_revision &&
    bibleMetadata.text_sha256 === strongMetadata.text_sha256
    ? publication
    : undefined
}

export const makeKyselyStrongBibleRepository = (
  database: Kysely<ResourceDatabase>,
  options: StrongBibleRepositoryOptions = {}
): StrongBibleRepositoryService => {
  // The index of a version, the Bible text it was aligned on and, for a concordance read,
  // the identities a reference may name: one statement, where each was a round trip.
  const readActivePublications = (versionId: string, candidates: readonly IdentityCandidate[]) =>
    tryDatabasePromise('strong-bible.publication.read-active', () =>
      database
        .selectFrom('resource_publications')
        .leftJoin('strong_bible_identities', join =>
          candidates.length
            ? join
                .onRef('strong_bible_identities.publication_id', '=', 'resource_publications.id')
                .on(
                  'resource_publications.resource_identity',
                  '=',
                  `strong-bible-index:${versionId}`
                )
                // Every kind with every code: an index condition, where the pairs themselves
                // would be tested on each identity of the index. The pair is chosen below.
                .on('strong_bible_identities.kind', 'in', [
                  ...new Set(candidates.map(candidate => candidate.kind)),
                ])
                .on('strong_bible_identities.code', 'in', [
                  ...new Set(candidates.map(candidate => candidate.code)),
                ])
            : join.on(sql<boolean>`false`)
        )
        .select([
          'resource_publications.id',
          'resource_publications.revision',
          'resource_publications.metadata',
          'resource_publications.resource_identity',
          'strong_bible_identities.identity_id',
          'strong_bible_identities.kind',
          'strong_bible_identities.code',
        ])
        .where('resource_publications.resource_identity', 'in', [
          `strong-bible-index:${versionId}`,
          `bible-text:${versionId}`,
        ])
        .where('resource_publications.status', '=', 'active')
        .execute()
    ).pipe(Effect.mapError(cause => new StrongBibleRepositoryFailure({ cause })))

  const findActivePublication = (versionId: string) =>
    readActivePublications(versionId, []).pipe(
      Effect.map(rows => activePublicationOf(versionId, rows))
    )

  /**
   * The active index of a version and the identity a reference names in it: the first of
   * its candidates, in the order they are tried, that the index holds.
   */
  const findActiveIdentity = (versionId: string, book: number, reference: string | number) =>
    Effect.gen(function* () {
      const candidates = identityCandidatesOf(book, reference)
      const rows = yield* readActivePublications(versionId, candidates)
      const publication = activePublicationOf(versionId, rows)
      if (!publication) return undefined
      return {
        publication,
        identity: identityNamedBy(
          candidates,
          rows.filter(row => row.id === publication.id)
        ),
      }
    })

  const loadSpanRows = (
    publicationId: number,
    locations: readonly { book: number; chapter: number; verse?: number }[]
  ) =>
    tryDatabasePromise('strong-bible.spans.read', () => {
      let query = database
        .selectFrom('strong_bible_spans')
        .leftJoin('strong_bible_span_identities', join =>
          join
            .onRef(
              'strong_bible_span_identities.publication_id',
              '=',
              'strong_bible_spans.publication_id'
            )
            .onRef('strong_bible_span_identities.book', '=', 'strong_bible_spans.book')
            .onRef('strong_bible_span_identities.chapter', '=', 'strong_bible_spans.chapter')
            .onRef('strong_bible_span_identities.verse', '=', 'strong_bible_spans.verse')
            .onRef('strong_bible_span_identities.ordinal', '=', 'strong_bible_spans.ordinal')
        )
        .leftJoin('strong_bible_identities', join =>
          join
            .onRef(
              'strong_bible_identities.publication_id',
              '=',
              'strong_bible_span_identities.publication_id'
            )
            .onRef(
              'strong_bible_identities.identity_id',
              '=',
              'strong_bible_span_identities.identity_id'
            )
        )
        .select([
          'strong_bible_spans.book',
          'strong_bible_spans.chapter',
          'strong_bible_spans.verse',
          'strong_bible_spans.ordinal',
          'strong_bible_spans.start_offset',
          'strong_bible_spans.length',
          'strong_bible_spans.step_token_ids',
          'strong_bible_span_identities.identity_order',
          'strong_bible_span_identities.identity_id',
          'strong_bible_identities.kind',
          'strong_bible_identities.code',
        ])
        .where('strong_bible_spans.publication_id', '=', publicationId)
      if (locations.length > 0) {
        query = query.where(expression =>
          expression.or(
            locations.map(location =>
              expression.and([
                expression('strong_bible_spans.book', '=', location.book),
                expression('strong_bible_spans.chapter', '=', location.chapter),
                ...(location.verse === undefined
                  ? []
                  : [expression('strong_bible_spans.verse', '=', location.verse)]),
              ])
            )
          )
        )
      }
      return query
        .orderBy('strong_bible_spans.book')
        .orderBy('strong_bible_spans.chapter')
        .orderBy('strong_bible_spans.verse')
        .orderBy('strong_bible_spans.ordinal')
        .orderBy('strong_bible_span_identities.identity_order')
        .execute() as Promise<SpanRow[]>
    }).pipe(Effect.mapError(cause => new StrongBibleRepositoryFailure({ cause })))

  const findCountsByBook: StrongBibleRepositoryService['findCountsByBook'] = input =>
    Effect.gen(function* () {
      const found = yield* findActiveIdentity(input.versionId, input.book, input.reference)
      if (!found) {
        return yield* new ActiveStrongBiblePublicationUnavailable({ versionId: input.versionId })
      }
      const { publication, identity } = found
      if (!identity) return { ...revisionFrom(publication), counts: [] }
      const rows = yield* tryDatabasePromise('strong-bible.counts.read', () =>
        database
          .selectFrom('strong_bible_span_identities')
          .select('book')
          .select(
            sql<number>`count(distinct (${sql.ref('book')}, ${sql.ref('chapter')}, ${sql.ref(
              'verse'
            )}))`.as('verse_count')
          )
          .where('publication_id', '=', publication.id)
          .where('identity_id', '=', identity.id)
          .groupBy('book')
          .orderBy('book')
          .execute()
      ).pipe(Effect.mapError(cause => new StrongBibleRepositoryFailure({ cause })))
      return {
        ...revisionFrom(publication),
        identity,
        counts: rows.map(row => ({ book: row.book, verseCount: Number(row.verse_count) })),
      }
    })

  // A reference asked twice is answered once.
  const distinctReferences = (input: StrongBibleReferencesLookup): string[] => [
    ...new Set(input.references),
  ]

  // The counts of several references as their own route reads them, one after the other.
  // It is the reference the single statement is tested against.
  const readReferenceCountsReadByRead: StrongBibleRepositoryService['findCountsByBookOfReferences'] =
    input =>
      Effect.gen(function* () {
        const publication = yield* findActivePublication(input.versionId)
        if (!publication) {
          return yield* new ActiveStrongBiblePublicationUnavailable({ versionId: input.versionId })
        }
        const references = yield* Effect.forEach(distinctReferences(input), reference =>
          findCountsByBook({ versionId: input.versionId, book: input.book, reference }).pipe(
            Effect.map(({ identity, counts }) => ({
              reference,
              ...(identity ? { identity } : {}),
              counts,
            }))
          )
        )
        return { ...revisionFrom(publication), references }
      })

  // The counts of several references in one round trip: the index, the Bible text it was
  // aligned on, the identities the references may name and the counts of each of them.
  //
  // The statement only fetches. Which identity a reference names is chosen in TypeScript, by
  // the rule its own counts read applies, so it returns the counts of every candidate found.
  const readReferenceCountsInOneStatement: StrongBibleRepositoryService['findCountsByBookOfReferences'] =
    input =>
      Effect.gen(function* () {
        const references = distinctReferences(input)
        const candidates = references.map(reference => identityCandidatesOf(input.book, reference))
        const index = `strong-bible-index:${input.versionId}`
        type ReferenceCountRows = {
          publications: PublicationRow[]
          identities: { identity_id: number; kind: string; code: string }[]
          counts: { identity_id: number; book: number; verse_count: number }[]
        }
        const gathered = yield* tryDatabasePromise('strong-bible.counts-batch.read', () =>
          sql<ReferenceCountRows>`
            WITH publications AS MATERIALIZED (
              SELECT id, revision, metadata, resource_identity
                FROM resource_publications
               WHERE resource_identity IN (${index}, ${`bible-text:${input.versionId}`})
                 AND status = 'active'
            ),
            -- Every kind with every code, as for one reference: the pair is chosen in TypeScript.
            identities AS MATERIALIZED (
              SELECT i.identity_id, i.kind, i.code
                FROM strong_bible_identities i
               WHERE i.publication_id
                     = (SELECT id FROM publications WHERE resource_identity = ${index})
                 AND i.kind = ANY (${[
                   ...new Set(candidates.flat().map(candidate => candidate.kind)),
                 ]}::text[])
                 AND i.code = ANY (${[
                   ...new Set(candidates.flat().map(candidate => candidate.code)),
                 ]}::text[])
            ),
            counts AS MATERIALIZED (
              SELECT s.identity_id,
                     s.book,
                     count(DISTINCT (s.book, s.chapter, s.verse)) AS verse_count
                FROM strong_bible_span_identities s
               WHERE s.publication_id
                     = (SELECT id FROM publications WHERE resource_identity = ${index})
                 AND s.identity_id = ANY (ARRAY(SELECT identity_id FROM identities))
               GROUP BY s.identity_id, s.book
            )
            SELECT
              (SELECT coalesce(
                        jsonb_agg(
                          jsonb_build_object(
                            'id', id,
                            'revision', revision,
                            'metadata', metadata,
                            'resource_identity', resource_identity
                          )
                        ),
                        '[]'::jsonb
                      )
                 FROM publications) AS publications,
              (SELECT coalesce(
                        jsonb_agg(
                          jsonb_build_object('identity_id', identity_id, 'kind', kind, 'code', code)
                        ),
                        '[]'::jsonb
                      )
                 FROM identities) AS identities,
              (SELECT coalesce(
                        jsonb_agg(
                          jsonb_build_object(
                            'identity_id', identity_id, 'book', book, 'verse_count', verse_count
                          )
                          ORDER BY identity_id, book
                        ),
                        '[]'::jsonb
                      )
                 FROM counts) AS counts
          `.execute(database)
        ).pipe(Effect.mapError(cause => new StrongBibleRepositoryFailure({ cause })))
        const rows = gathered.rows[0]
        const publication = rows && activePublicationOf(input.versionId, rows.publications)
        if (!rows || !publication) {
          return yield* new ActiveStrongBiblePublicationUnavailable({ versionId: input.versionId })
        }
        return {
          ...revisionFrom(publication),
          references: references.map((reference, position) => {
            const identity = identityNamedBy(candidates[position] ?? [], rows.identities)
            if (!identity) return { reference, counts: [] }
            return {
              reference,
              identity,
              counts: rows.counts
                .filter(count => count.identity_id === identity.id)
                .map(count => ({ book: count.book, verseCount: Number(count.verse_count) })),
            }
          }),
        }
      })

  return {
    findActiveCoverage: versionId =>
      Effect.gen(function* () {
        const publication = yield* findActivePublication(versionId)
        if (!publication) {
          return yield* new ActiveStrongBiblePublicationUnavailable({ versionId })
        }
        const rows = yield* tryDatabasePromise('strong-bible.coverage.read', () =>
          database
            .selectFrom('strong_bible_verses')
            .select(['book', 'chapter'])
            .select(expression => expression.fn.count('verse').as('verse_count'))
            .where('publication_id', '=', publication.id)
            .groupBy(['book', 'chapter'])
            .orderBy('book')
            .orderBy('chapter')
            .execute()
        ).pipe(Effect.mapError(cause => new StrongBibleRepositoryFailure({ cause })))
        if (rows.length === 0) {
          return yield* new ActiveStrongBiblePublicationUnavailable({ versionId })
        }
        const chaptersByBook: Record<string, number[]> = {}
        const verseCountByBookChapter: Record<string, number> = {}
        for (const row of rows) {
          chaptersByBook[row.book] ??= []
          chaptersByBook[row.book]!.push(row.chapter)
          verseCountByBookChapter[`${row.book}-${row.chapter}`] = Number(row.verse_count)
        }
        return {
          ...revisionFrom(publication),
          books: Object.keys(chaptersByBook).map(Number),
          chaptersByBook,
          verseCountByBookChapter,
        }
      }),
    findActiveChapter: input =>
      Effect.gen(function* () {
        const publication = yield* findActivePublication(input.versionId)
        if (!publication) {
          return yield* new ActiveStrongBiblePublicationUnavailable({ versionId: input.versionId })
        }
        const verses = yield* tryDatabasePromise('strong-bible.chapter.verses', () =>
          database
            .selectFrom('strong_bible_verses')
            .select('verse')
            .where('publication_id', '=', publication.id)
            .where('book', '=', input.book)
            .where('chapter', '=', input.chapter)
            .orderBy('verse')
            .execute()
        ).pipe(Effect.mapError(cause => new StrongBibleRepositoryFailure({ cause })))
        if (verses.length === 0) return yield* new StrongBibleChapterNotFound(input)
        const spanRows = yield* loadSpanRows(publication.id, [input])
        const spansByVerse = groupSpans(spanRows)
        return {
          ...revisionFrom(publication),
          book: input.book,
          chapter: input.chapter,
          verses: verses.map(row => ({
            number: row.verse,
            spans: spansByVerse.get(`${input.book}-${input.chapter}-${row.verse}`) ?? [],
          })),
        }
      }),
    findCountsByBook,
    findCountsByBookOfReferences:
      options.referenceCountsRead === 'read-by-read'
        ? readReferenceCountsReadByRead
        : readReferenceCountsInOneStatement,
    findOccurrences: input =>
      Effect.gen(function* () {
        const found = yield* findActiveIdentity(input.versionId, input.book, input.reference)
        if (!found) {
          return yield* new ActiveStrongBiblePublicationUnavailable({ versionId: input.versionId })
        }
        const { publication, identity } = found
        if (!identity) return { ...revisionFrom(publication), verses: [] }
        let query = database
          .selectFrom('strong_bible_span_identities')
          .innerJoin('strong_bible_spans', join =>
            join
              .onRef(
                'strong_bible_spans.publication_id',
                '=',
                'strong_bible_span_identities.publication_id'
              )
              .onRef('strong_bible_spans.book', '=', 'strong_bible_span_identities.book')
              .onRef('strong_bible_spans.chapter', '=', 'strong_bible_span_identities.chapter')
              .onRef('strong_bible_spans.verse', '=', 'strong_bible_span_identities.verse')
              .onRef('strong_bible_spans.ordinal', '=', 'strong_bible_span_identities.ordinal')
          )
          .select([
            'strong_bible_span_identities.book',
            'strong_bible_span_identities.chapter',
            'strong_bible_span_identities.verse',
          ])
          .distinct()
          .where('strong_bible_span_identities.publication_id', '=', publication.id)
          .where('strong_bible_span_identities.identity_id', '=', identity.id)
        if (!input.allBooks)
          query = query.where('strong_bible_span_identities.book', '=', input.book)
        if (input.lexemeId !== undefined) {
          query = query.where('strong_bible_spans.lexeme_id', '=', input.lexemeId)
        }
        const cursor = decodeStrongBibleOccurrenceCursor(input.cursor)
        if (cursor) {
          query = query.where(expression =>
            expression.or([
              expression('strong_bible_span_identities.book', '>', cursor.book),
              expression.and([
                expression('strong_bible_span_identities.book', '=', cursor.book),
                expression('strong_bible_span_identities.chapter', '>', cursor.chapter),
              ]),
              expression.and([
                expression('strong_bible_span_identities.book', '=', cursor.book),
                expression('strong_bible_span_identities.chapter', '=', cursor.chapter),
                expression('strong_bible_span_identities.verse', '>', cursor.verse),
              ]),
            ])
          )
        }
        const limit = input.limit ?? 100
        const locationRows = yield* tryDatabasePromise('strong-bible.occurrences.read', () =>
          query
            .orderBy('strong_bible_span_identities.book')
            .orderBy('strong_bible_span_identities.chapter')
            .orderBy('strong_bible_span_identities.verse')
            .limit(limit + 1)
            .execute()
        ).pipe(Effect.mapError(cause => new StrongBibleRepositoryFailure({ cause })))
        const locations = locationRows.slice(0, limit)
        const spanRows = locations.length ? yield* loadSpanRows(publication.id, locations) : []
        const spansByVerse = groupSpans(spanRows)
        const lastLocation = locations.at(-1)
        return {
          ...revisionFrom(publication),
          identity,
          verses: locations.map(location => ({
            ...location,
            spans: spansByVerse.get(`${location.book}-${location.chapter}-${location.verse}`) ?? [],
          })),
          ...(locationRows.length > limit && lastLocation
            ? { nextCursor: encodeStrongBibleOccurrenceCursor(lastLocation) }
            : {}),
        }
      }),
    findLemmaStats: input =>
      Effect.gen(function* () {
        const found = yield* findActiveIdentity(input.versionId, input.book, input.reference)
        if (!found) {
          return yield* new ActiveStrongBiblePublicationUnavailable({ versionId: input.versionId })
        }
        const { publication, identity } = found
        if (!identity) return { ...revisionFrom(publication), lemmas: [] }
        const rows = yield* tryDatabasePromise('strong-bible.lemmas.read', () =>
          database
            .selectFrom('strong_bible_span_identities')
            .innerJoin('strong_bible_spans', join =>
              join
                .onRef(
                  'strong_bible_spans.publication_id',
                  '=',
                  'strong_bible_span_identities.publication_id'
                )
                .onRef('strong_bible_spans.book', '=', 'strong_bible_span_identities.book')
                .onRef('strong_bible_spans.chapter', '=', 'strong_bible_span_identities.chapter')
                .onRef('strong_bible_spans.verse', '=', 'strong_bible_span_identities.verse')
                .onRef('strong_bible_spans.ordinal', '=', 'strong_bible_span_identities.ordinal')
            )
            .innerJoin('strong_bible_lexemes', join =>
              join
                .onRef(
                  'strong_bible_lexemes.publication_id',
                  '=',
                  'strong_bible_spans.publication_id'
                )
                .onRef('strong_bible_lexemes.lexeme_id', '=', 'strong_bible_spans.lexeme_id')
            )
            .select([
              'strong_bible_lexemes.lexeme_id',
              'strong_bible_lexemes.lemma',
              'strong_bible_lexemes.part_of_speech',
            ])
            .select(
              sql<number>`count(distinct (${sql.ref(
                'strong_bible_spans.book'
              )}, ${sql.ref('strong_bible_spans.chapter')}, ${sql.ref(
                'strong_bible_spans.verse'
              )}))`.as('occurrence_count')
            )
            .where('strong_bible_span_identities.publication_id', '=', publication.id)
            .where('strong_bible_span_identities.identity_id', '=', identity.id)
            .groupBy([
              'strong_bible_lexemes.lexeme_id',
              'strong_bible_lexemes.lemma',
              'strong_bible_lexemes.part_of_speech',
            ])
            .orderBy('occurrence_count', 'desc')
            .orderBy('strong_bible_lexemes.lemma')
            .execute()
        ).pipe(Effect.mapError(cause => new StrongBibleRepositoryFailure({ cause })))
        return {
          ...revisionFrom(publication),
          identity,
          lemmas: rows.map(row => ({
            id: row.lexeme_id,
            lemma: row.lemma,
            partOfSpeech: row.part_of_speech,
            occurrenceCount: Number(row.occurrence_count),
          })),
        }
      }),
  }
}

export const makeNeonStrongBibleRepository = (config: NeonDatabaseConfig) => {
  const database = makeNeonDatabase(config)
  return {
    repository: makeKyselyStrongBibleRepository(database),
    dispose: () => database.destroy(),
  }
}
