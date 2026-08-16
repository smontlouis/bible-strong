import { Effect } from 'effect'
import { sql, type Kysely } from 'kysely'

import { getStrongBibleConcordanceCandidates } from '../../../src/helpers/strongBibleConcordance'
import type { StrongBibleSpan } from '../../../src/helpers/canonicalStrongVerse'
import { tryDatabasePromise } from '../database/databaseEffect'
import { makeNeonDatabase, type NeonDatabaseConfig } from '../database/neonDatabase'
import type { ResourceDatabase } from '../database/types'
import {
  ActiveStrongBiblePublicationUnavailable,
  StrongBibleChapterNotFound,
  StrongBibleRepositoryFailure,
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
      ['strong', 'estrong', 'dstrong', 'ustrong'].includes(row.kind) &&
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

export const makeKyselyStrongBibleRepository = (
  database: Kysely<ResourceDatabase>
): StrongBibleRepositoryService => {
  const findActivePublication = (versionId: string) =>
    Effect.gen(function* () {
      const publication = yield* tryDatabasePromise('strong-bible.publication.read-active', () =>
        database
          .selectFrom('resource_publications')
          .select(['id', 'revision', 'metadata', 'resource_identity'])
          .where('resource_identity', '=', `strong-bible-index:${versionId}`)
          .where('status', '=', 'active')
          .executeTakeFirst()
      ).pipe(Effect.mapError(cause => new StrongBibleRepositoryFailure({ cause })))
      if (!publication) return undefined

      const biblePublication = yield* tryDatabasePromise(
        'strong-bible.publication.read-bible-dependency',
        () =>
          database
            .selectFrom('resource_publications')
            .select(['revision', 'metadata'])
            .where('resource_identity', '=', `bible-text:${versionId}`)
            .where('status', '=', 'active')
            .executeTakeFirst()
      ).pipe(Effect.mapError(cause => new StrongBibleRepositoryFailure({ cause })))
      if (!biblePublication) return undefined

      const bibleMetadata = biblePublication.metadata as BiblePublicationMetadata
      const bibleTextRevision =
        bibleMetadata.text_revision ?? bibleMetadata.resource_revision ?? biblePublication.revision
      const strongMetadata = metadataFrom(publication.metadata)
      return bibleTextRevision === strongMetadata.text_revision &&
        bibleMetadata.text_sha256 === strongMetadata.text_sha256
        ? publication
        : undefined
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

  const resolveIdentity = (publicationId: number, book: number, reference: string | number) =>
    Effect.gen(function* () {
      const kindNames = ['strong', 'estrong', 'dstrong', 'ustrong'] as const
      for (const candidate of getStrongBibleConcordanceCandidates(book, reference)) {
        const kind = kindNames[candidate.kind]
        if (!kind) continue
        const identity = yield* tryDatabasePromise('strong-bible.identity.resolve', () =>
          database
            .selectFrom('strong_bible_identities')
            .select(['identity_id', 'kind', 'code'])
            .where('publication_id', '=', publicationId)
            .where('kind', '=', kind)
            .where('code', '=', candidate.code)
            .executeTakeFirst()
        ).pipe(Effect.mapError(cause => new StrongBibleRepositoryFailure({ cause })))
        if (identity) {
          return {
            id: identity.identity_id,
            kind: identity.kind as (typeof kindNames)[number],
            code: identity.code,
          }
        }
      }
      return undefined
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
    findCountsByBook: input =>
      Effect.gen(function* () {
        const publication = yield* findActivePublication(input.versionId)
        if (!publication) {
          return yield* new ActiveStrongBiblePublicationUnavailable({ versionId: input.versionId })
        }
        const identity = yield* resolveIdentity(publication.id, input.book, input.reference)
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
      }),
    findOccurrences: input =>
      Effect.gen(function* () {
        const publication = yield* findActivePublication(input.versionId)
        if (!publication) {
          return yield* new ActiveStrongBiblePublicationUnavailable({ versionId: input.versionId })
        }
        const identity = yield* resolveIdentity(publication.id, input.book, input.reference)
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
        const limit = input.limit ?? 100
        const locations = yield* tryDatabasePromise('strong-bible.occurrences.read', () =>
          query
            .orderBy('strong_bible_span_identities.book')
            .orderBy('strong_bible_span_identities.chapter')
            .orderBy('strong_bible_span_identities.verse')
            .limit(limit)
            .offset(input.offset ?? 0)
            .execute()
        ).pipe(Effect.mapError(cause => new StrongBibleRepositoryFailure({ cause })))
        const spanRows = locations.length ? yield* loadSpanRows(publication.id, locations) : []
        const spansByVerse = groupSpans(spanRows)
        return {
          ...revisionFrom(publication),
          identity,
          verses: locations.map(location => ({
            ...location,
            spans: spansByVerse.get(`${location.book}-${location.chapter}-${location.verse}`) ?? [],
          })),
          ...(locations.length >= limit
            ? { nextOffset: (input.offset ?? 0) + locations.length }
            : {}),
        }
      }),
    findLemmaStats: input =>
      Effect.gen(function* () {
        const publication = yield* findActivePublication(input.versionId)
        if (!publication) {
          return yield* new ActiveStrongBiblePublicationUnavailable({ versionId: input.versionId })
        }
        const identity = yield* resolveIdentity(publication.id, input.book, input.reference)
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
