import { Effect } from 'effect'
import type { Kysely } from 'kysely'

import type { ResourceLanguage } from '../../../src/helpers/databaseTypes'
import type {
  InterlinearIdentityKind,
  InterlinearToken,
} from '../../../src/helpers/interlinearBibleSidecar'
import { STRONG_IDENTITY_KINDS } from '../../../src/helpers/strongIdentities'
import { tryDatabasePromise } from '../database/databaseEffect'
import { makeNeonDatabase, type NeonDatabaseConfig } from '../database/neonDatabase'
import type { ResourceDatabase } from '../database/types'
import {
  ActiveInterlinearBiblePublicationUnavailable,
  InterlinearBibleChapterNotFound,
  InterlinearBibleRepositoryFailure,
  type InterlinearBibleRepositoryService,
  type InterlinearBibleResourceRevision,
} from '../domain/interlinearBible'

type InterlinearPublicationMetadata = {
  dataset_id: 'STEP'
  language: ResourceLanguage
  resource_revision?: string
  text_revision: string
  text_sha256: string
}

type BiblePublicationMetadata = {
  resource_revision?: string
  text_revision?: string
  text_sha256?: string
}

const revisionFrom = (publication: {
  revision: string
  metadata: Record<string, unknown>
  resource_identity: string
}): InterlinearBibleResourceRevision => {
  const metadata = publication.metadata as InterlinearPublicationMetadata
  const [, versionId, language] = publication.resource_identity.split(':')
  return {
    versionId: versionId as 'BHG',
    datasetId: metadata.dataset_id,
    language: language as ResourceLanguage,
    revision: metadata.resource_revision ?? publication.revision,
    textRevision: metadata.text_revision,
    textSha256: metadata.text_sha256,
  }
}

type InterlinearRow = {
  verse: number
  token_id: number
  token_ordinal: number
  token_start_offset: number
  token_length: number
  segment_id: number
  segment_ordinal: number
  segment_start_offset: number
  segment_length: number
  transliteration: string
  lemma: string
  morphology: string
  gloss: string
  identity_order: number | null
  kind: string | null
  code: string | null
}

const groupRows = (rows: readonly InterlinearRow[]) => {
  const tokensByVerse: Record<number, InterlinearToken[]> = {}
  const tokens = new Map<number, InterlinearToken>()
  const segments = new Map<number, InterlinearToken['segments'][number]>()

  for (const row of rows) {
    let token = tokens.get(row.token_id)
    if (!token) {
      token = {
        id: row.token_id,
        ordinal: row.token_ordinal,
        startOffset: row.token_start_offset,
        length: row.token_length,
        segments: [],
      }
      tokens.set(row.token_id, token)
      tokensByVerse[row.verse] ??= []
      tokensByVerse[row.verse]!.push(token)
    }

    let segment = segments.get(row.segment_id)
    if (!segment) {
      segment = {
        ordinal: row.segment_ordinal,
        startOffset: row.segment_start_offset,
        length: row.segment_length,
        transliteration: row.transliteration,
        lemma: row.lemma,
        morphology: row.morphology,
        gloss: row.gloss,
        identities: [],
      }
      segments.set(row.segment_id, segment)
      token.segments.push(segment)
    }
    if (row.kind && row.code && STRONG_IDENTITY_KINDS.some(kind => kind === row.kind)) {
      segment.identities.push({ kind: row.kind as InterlinearIdentityKind, code: row.code })
    }
  }
  return tokensByVerse
}

export const makeKyselyInterlinearBibleRepository = (
  database: Kysely<ResourceDatabase>
): InterlinearBibleRepositoryService => {
  const findActivePublication = (versionId: 'BHG', language: ResourceLanguage) =>
    Effect.gen(function* () {
      const publication = yield* tryDatabasePromise('interlinear.publication.read-active', () =>
        database
          .selectFrom('resource_publications')
          .select(['id', 'revision', 'metadata', 'resource_identity'])
          .where('resource_identity', '=', `interlinear-index:${versionId}:${language}`)
          .where('status', '=', 'active')
          .executeTakeFirst()
      ).pipe(Effect.mapError(cause => new InterlinearBibleRepositoryFailure({ cause })))
      if (!publication) return undefined

      const biblePublication = yield* tryDatabasePromise(
        'interlinear.publication.read-bible-dependency',
        () =>
          database
            .selectFrom('resource_publications')
            .select(['revision', 'metadata'])
            .where('resource_identity', '=', `bible-text:${versionId}`)
            .where('status', '=', 'active')
            .executeTakeFirst()
      ).pipe(Effect.mapError(cause => new InterlinearBibleRepositoryFailure({ cause })))
      if (!biblePublication) return undefined

      const bibleMetadata = biblePublication.metadata as BiblePublicationMetadata
      const bibleTextRevision =
        bibleMetadata.text_revision ?? bibleMetadata.resource_revision ?? biblePublication.revision
      const metadata = publication.metadata as InterlinearPublicationMetadata
      return bibleTextRevision === metadata.text_revision &&
        bibleMetadata.text_sha256 === metadata.text_sha256
        ? publication
        : undefined
    })

  return {
    findActiveCoverage: input =>
      Effect.gen(function* () {
        const publication = yield* findActivePublication(input.versionId, input.language)
        if (!publication) {
          return yield* new ActiveInterlinearBiblePublicationUnavailable(input)
        }
        const rows = yield* tryDatabasePromise('interlinear.coverage.read', () =>
          database
            .selectFrom('interlinear_bible_verses')
            .select(['book', 'chapter'])
            .select(expression => expression.fn.count('verse').as('verse_count'))
            .where('publication_id', '=', publication.id)
            .groupBy(['book', 'chapter'])
            .orderBy('book')
            .orderBy('chapter')
            .execute()
        ).pipe(Effect.mapError(cause => new InterlinearBibleRepositoryFailure({ cause })))
        if (!rows.length) return yield* new ActiveInterlinearBiblePublicationUnavailable(input)
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
        const publication = yield* findActivePublication(input.versionId, input.language)
        if (!publication) {
          return yield* new ActiveInterlinearBiblePublicationUnavailable({
            versionId: input.versionId,
            language: input.language,
          })
        }
        const verses = yield* tryDatabasePromise('interlinear.chapter.verses', () =>
          database
            .selectFrom('interlinear_bible_verses')
            .select(['verse_id', 'verse'])
            .where('publication_id', '=', publication.id)
            .where('book', '=', input.book)
            .where('chapter', '=', input.chapter)
            .orderBy('verse')
            .execute()
        ).pipe(Effect.mapError(cause => new InterlinearBibleRepositoryFailure({ cause })))
        if (!verses.length) return yield* new InterlinearBibleChapterNotFound(input)

        const rows = (yield* tryDatabasePromise('interlinear.chapter.tokens', () =>
          database
            .selectFrom('interlinear_bible_verses')
            .innerJoin('interlinear_bible_tokens', join =>
              join
                .onRef(
                  'interlinear_bible_tokens.publication_id',
                  '=',
                  'interlinear_bible_verses.publication_id'
                )
                .onRef(
                  'interlinear_bible_tokens.verse_id',
                  '=',
                  'interlinear_bible_verses.verse_id'
                )
            )
            .innerJoin('interlinear_bible_segments', join =>
              join
                .onRef(
                  'interlinear_bible_segments.publication_id',
                  '=',
                  'interlinear_bible_tokens.publication_id'
                )
                .onRef(
                  'interlinear_bible_segments.token_id',
                  '=',
                  'interlinear_bible_tokens.token_id'
                )
            )
            .leftJoin('interlinear_bible_segment_identities', join =>
              join
                .onRef(
                  'interlinear_bible_segment_identities.publication_id',
                  '=',
                  'interlinear_bible_segments.publication_id'
                )
                .onRef(
                  'interlinear_bible_segment_identities.segment_id',
                  '=',
                  'interlinear_bible_segments.segment_id'
                )
            )
            .select([
              'interlinear_bible_verses.verse',
              'interlinear_bible_tokens.token_id',
              'interlinear_bible_tokens.ordinal as token_ordinal',
              'interlinear_bible_tokens.start_offset as token_start_offset',
              'interlinear_bible_tokens.length as token_length',
              'interlinear_bible_segments.segment_id',
              'interlinear_bible_segments.ordinal as segment_ordinal',
              'interlinear_bible_segments.start_offset as segment_start_offset',
              'interlinear_bible_segments.length as segment_length',
              'interlinear_bible_segments.transliteration',
              'interlinear_bible_segments.lemma',
              'interlinear_bible_segments.morphology',
              'interlinear_bible_segments.gloss',
              'interlinear_bible_segment_identities.identity_order',
              'interlinear_bible_segment_identities.kind',
              'interlinear_bible_segment_identities.code',
            ])
            .where('interlinear_bible_verses.publication_id', '=', publication.id)
            .where('interlinear_bible_verses.book', '=', input.book)
            .where('interlinear_bible_verses.chapter', '=', input.chapter)
            .orderBy('interlinear_bible_verses.verse')
            .orderBy('interlinear_bible_tokens.ordinal')
            .orderBy('interlinear_bible_segments.ordinal')
            .orderBy('interlinear_bible_segment_identities.identity_order')
            .execute()
        ).pipe(
          Effect.mapError(cause => new InterlinearBibleRepositoryFailure({ cause }))
        )) as InterlinearRow[]
        const tokensByVerse = groupRows(rows)
        return {
          ...revisionFrom(publication),
          book: input.book,
          chapter: input.chapter,
          verses: verses.map(row => ({
            number: row.verse,
            tokens: tokensByVerse[row.verse] ?? [],
          })),
        }
      }),
  }
}

export const makeNeonInterlinearBibleRepository = (config: NeonDatabaseConfig) => {
  const database = makeNeonDatabase(config)
  return {
    repository: makeKyselyInterlinearBibleRepository(database),
    dispose: () => database.destroy(),
  }
}
