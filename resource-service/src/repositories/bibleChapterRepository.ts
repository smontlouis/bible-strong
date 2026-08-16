import { Effect } from 'effect'
import type { Kysely } from 'kysely'

import type { ActiveBibleChapter, BibleChapterRepositoryService } from '../domain/bibleChapter'
import {
  ActiveBiblePublicationUnavailable,
  BibleChapterNotFound,
  BibleChapterRepositoryFailure,
} from '../domain/bibleChapter'
import { makeNeonDatabase, type NeonDatabaseConfig } from '../database/neonDatabase'
import { tryDatabasePromise } from '../database/databaseEffect'
import type { ResourceDatabase } from '../database/types'

export const makeKyselyBibleChapterRepository = (
  database: Kysely<ResourceDatabase>
): BibleChapterRepositoryService => ({
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
        revision: rows[0]!.revision,
        verses: rows.map(row => ({
          number: row.verse!,
          text: row.text!,
          presentation: row.presentation!,
        })),
      } satisfies ActiveBibleChapter
    }),
  findActiveCoverage: versionId =>
    Effect.gen(function* () {
      const rows = yield* tryDatabasePromise('bible.coverage.read-active', () =>
        database
          .selectFrom('resource_publications')
          .leftJoin('bible_verses', 'bible_verses.publication_id', 'resource_publications.id')
          .select(['resource_publications.revision', 'bible_verses.book', 'bible_verses.chapter'])
          .select(expression => expression.fn.count('bible_verses.verse').as('verse_count'))
          .where('resource_publications.resource_identity', '=', `bible-text:${versionId}`)
          .where('resource_publications.status', '=', 'active')
          .groupBy(['resource_publications.revision', 'bible_verses.book', 'bible_verses.chapter'])
          .orderBy('bible_verses.book')
          .orderBy('bible_verses.chapter')
          .execute()
      ).pipe(Effect.mapError(cause => new BibleChapterRepositoryFailure({ cause })))

      if (rows.length === 0 || rows[0]?.book === null) {
        return yield* new ActiveBiblePublicationUnavailable({ versionId })
      }
      const books: number[] = []
      const chaptersByBook: Record<string, number[]> = {}
      const verseCountByBookChapter: Record<string, number> = {}
      for (const row of rows) {
        const book = row.book!
        const chapter = row.chapter!
        if (!chaptersByBook[book]) {
          books.push(book)
          chaptersByBook[book] = []
        }
        chaptersByBook[book]!.push(chapter)
        verseCountByBookChapter[`${book}-${chapter}`] = Number(row.verse_count)
      }
      return {
        versionId,
        revision: rows[0]!.revision,
        books,
        chaptersByBook,
        verseCountByBookChapter,
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
