import { Effect } from 'effect'
import { sql, type Kysely } from 'kysely'

import type {
  ActiveBibleChapter,
  ActiveBibleVerseTexts,
  BibleChapterRepositoryService,
} from '../domain/bibleChapter'
import {
  ActiveBiblePublicationUnavailable,
  BibleChapterNotFound,
  BibleChapterRepositoryFailure,
  BibleVerseSelectionNotFound,
} from '../domain/bibleChapter'
import { makeNeonDatabase, type NeonDatabaseConfig } from '../database/neonDatabase'
import { tryDatabasePromise } from '../database/databaseEffect'
import type { ResourceDatabase } from '../database/types'

type BiblePublicationMetadata = {
  canon: { id: string; orderedBooks: number[] }
  versification: string
  resource_revision?: string
  text_revision?: string
  text_sha256?: string
}

const bibleMetadata = (value: Record<string, unknown>): BiblePublicationMetadata =>
  value as BiblePublicationMetadata

export const makeKyselyBibleChapterRepository = (
  database: Kysely<ResourceDatabase>
): BibleChapterRepositoryService => ({
  findActiveVerseTexts: input =>
    Effect.gen(function* () {
      const publication = yield* tryDatabasePromise('bible.verse-texts.read-publication', () =>
        database
          .selectFrom('resource_publications')
          .select(['id', 'revision', 'metadata'])
          .where('resource_publications.resource_identity', '=', `bible-text:${input.versionId}`)
          .where('resource_publications.status', '=', 'active')
          .executeTakeFirst()
      ).pipe(Effect.mapError(cause => new BibleChapterRepositoryFailure({ cause })))

      if (!publication) {
        return yield* new ActiveBiblePublicationUnavailable({ versionId: input.versionId })
      }

      const rows = yield* tryDatabasePromise('bible.verse-texts.read-active', () =>
        database
          .selectFrom('bible_verses')
          .select(['book', 'chapter', 'verse', 'text'])
          .where('publication_id', '=', publication.id)
          .where(expression =>
            expression.or(
              input.locations.map(location =>
                expression.and([
                  expression('book', '=', location.book),
                  expression('chapter', '=', location.chapter),
                  expression('verse', '=', location.verse),
                ])
              )
            )
          )
          .orderBy('book')
          .orderBy('chapter')
          .orderBy('verse')
          .execute()
      ).pipe(Effect.mapError(cause => new BibleChapterRepositoryFailure({ cause })))

      if (rows.length === 0) {
        return yield* new BibleVerseSelectionNotFound(input)
      }

      const metadata = bibleMetadata(publication.metadata)
      return {
        versionId: input.versionId,
        revision: metadata.resource_revision ?? metadata.text_revision ?? publication.revision,
        textRevision: metadata.text_revision ?? metadata.resource_revision ?? publication.revision,
        ...(metadata.text_sha256 ? { textSha256: metadata.text_sha256 } : {}),
        verses: rows.map(row => ({
          book: row.book,
          chapter: row.chapter,
          verse: row.verse,
          text: row.text,
        })),
      } satisfies ActiveBibleVerseTexts
    }),
  findActiveChapter: input =>
    Effect.gen(function* () {
      const rows = yield* tryDatabasePromise('bible.chapter.read-active', () =>
        database
          .selectFrom('resource_publications')
          .leftJoin('bible_verses', join =>
            join
              .onRef('bible_verses.publication_id', '=', 'resource_publications.id')
              .on('bible_verses.book', '=', input.book)
              .on('bible_verses.chapter', '=', input.chapter)
          )
          .select([
            'resource_publications.revision',
            'resource_publications.metadata',
            'bible_verses.verse',
            'bible_verses.text',
            'bible_verses.presentation',
          ])
          .where('resource_publications.resource_identity', '=', `bible-text:${input.versionId}`)
          .where('resource_publications.status', '=', 'active')
          .orderBy('bible_verses.verse')
          .execute()
      ).pipe(Effect.mapError(cause => new BibleChapterRepositoryFailure({ cause })))

      if (rows.length === 0) {
        return yield* new ActiveBiblePublicationUnavailable({ versionId: input.versionId })
      }
      if (rows[0]?.verse === null) return yield* new BibleChapterNotFound(input)

      return {
        ...input,
        revision:
          bibleMetadata(rows[0]!.metadata).resource_revision ??
          bibleMetadata(rows[0]!.metadata).text_revision ??
          rows[0]!.revision,
        textRevision:
          bibleMetadata(rows[0]!.metadata).text_revision ??
          bibleMetadata(rows[0]!.metadata).resource_revision ??
          rows[0]!.revision,
        ...(bibleMetadata(rows[0]!.metadata).text_sha256
          ? { textSha256: bibleMetadata(rows[0]!.metadata).text_sha256 }
          : {}),
        verses: rows.map(row => ({
          number: row.verse!,
          text: row.text!,
          presentation: row.presentation!,
        })),
      } satisfies ActiveBibleChapter
    }),
  findActiveCoverage: versionId =>
    Effect.gen(function* () {
      const publication = yield* tryDatabasePromise('bible.coverage.read-publication', () =>
        database
          .selectFrom('resource_publications')
          .select(['id', 'revision', 'metadata'])
          .where('resource_identity', '=', `bible-text:${versionId}`)
          .where('status', '=', 'active')
          .executeTakeFirst()
      ).pipe(Effect.mapError(cause => new BibleChapterRepositoryFailure({ cause })))

      if (!publication) return yield* new ActiveBiblePublicationUnavailable({ versionId })
      const rows = yield* tryDatabasePromise('bible.coverage.read-active', () =>
        database
          .selectFrom('bible_verses')
          .select(['book', 'chapter'])
          .select(expression => expression.fn.count('bible_verses.verse').as('verse_count'))
          .where('publication_id', '=', publication.id)
          .groupBy(['book', 'chapter'])
          .orderBy('book')
          .orderBy('chapter')
          .execute()
      ).pipe(Effect.mapError(cause => new BibleChapterRepositoryFailure({ cause })))

      if (rows.length === 0) {
        return yield* new ActiveBiblePublicationUnavailable({ versionId })
      }
      const chaptersByBook: Record<string, number[]> = {}
      const verseCountByBookChapter: Record<string, number> = {}
      for (const row of rows) {
        const book = row.book!
        const chapter = row.chapter!
        if (!chaptersByBook[book]) {
          chaptersByBook[book] = []
        }
        chaptersByBook[book]!.push(chapter)
        verseCountByBookChapter[`${book}-${chapter}`] = Number(row.verse_count)
      }
      const metadata = bibleMetadata(publication.metadata)
      const books = metadata.canon.orderedBooks.filter(book => chaptersByBook[book] !== undefined)
      return {
        versionId,
        revision: metadata.resource_revision ?? metadata.text_revision ?? publication.revision,
        textRevision: metadata.resource_revision ?? metadata.text_revision ?? publication.revision,
        ...(metadata.text_sha256 ? { textSha256: metadata.text_sha256 } : {}),
        canon: metadata.canon,
        versification: metadata.versification,
        books,
        chaptersByBook,
        verseCountByBookChapter,
      }
    }),
  findActivePericopes: versionId =>
    Effect.gen(function* () {
      const publication = yield* tryDatabasePromise('bible.pericopes.read-publication', () =>
        database
          .selectFrom('resource_publications')
          .select(['id', 'revision', 'metadata'])
          .where('resource_identity', '=', `bible-text:${versionId}`)
          .where('status', '=', 'active')
          .executeTakeFirst()
      ).pipe(Effect.mapError(cause => new BibleChapterRepositoryFailure({ cause })))

      if (!publication) return yield* new ActiveBiblePublicationUnavailable({ versionId })
      const rows = yield* tryDatabasePromise('bible.pericopes.read-active', () =>
        database
          .selectFrom('bible_verses')
          .select(['book', 'chapter', 'verse', 'presentation'])
          .where('publication_id', '=', publication.id)
          .where(
            sql<boolean>`jsonb_array_length(${sql.ref('bible_verses.presentation')} -> 'headings') > 0`
          )
          .orderBy('bible_verses.book')
          .orderBy('bible_verses.chapter')
          .orderBy('bible_verses.verse')
          .execute()
      ).pipe(Effect.mapError(cause => new BibleChapterRepositoryFailure({ cause })))

      const metadata = bibleMetadata(publication.metadata)
      return {
        versionId,
        revision: metadata.resource_revision ?? metadata.text_revision ?? publication.revision,
        textRevision: metadata.resource_revision ?? metadata.text_revision ?? publication.revision,
        ...(metadata.text_sha256 ? { textSha256: metadata.text_sha256 } : {}),
        verses: rows.flatMap(row =>
          row.presentation!.headings.length > 0
            ? [
                {
                  book: row.book!,
                  chapter: row.chapter!,
                  verse: row.verse!,
                  headings: row.presentation!.headings,
                },
              ]
            : []
        ),
      }
    }),
})

export const makeNeonBibleChapterRepository = (config: NeonDatabaseConfig) => {
  const database = makeNeonDatabase(config)

  return {
    repository: makeKyselyBibleChapterRepository(database),
    dispose: () => database.destroy(),
  }
}
