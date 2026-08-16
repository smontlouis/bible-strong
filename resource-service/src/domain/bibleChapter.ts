import { Context, Data, Effect } from 'effect'

import {
  BibleChapterDto,
  BibleChapterVerseDto,
  BibleTextRevisionDto,
  BibleVersionCoverageDto,
  BibleVersePresentationDto,
  type BibleVersePresentation,
} from '../../../src/features/resources/bibleChapterContract'

export type BibleChapterLocation = {
  versionId: string
  book: number
  chapter: number
}

export type ActiveBibleChapter = BibleChapterLocation & {
  revision: string
  verses: readonly {
    number: number
    text: string
    presentation: BibleVersePresentation
  }[]
}

export type ActiveBibleCoverage = {
  versionId: string
  revision: string
  books: readonly number[]
  chaptersByBook: Record<string, readonly number[]>
  verseCountByBookChapter: Record<string, number>
}

export class UnsupportedBibleVersion extends Data.TaggedError('UnsupportedBibleVersion')<{
  readonly versionId: string
}> {}

export class ActiveBiblePublicationUnavailable extends Data.TaggedError(
  'ActiveBiblePublicationUnavailable'
)<{
  readonly versionId: string
}> {}

export class BibleChapterNotFound extends Data.TaggedError(
  'BibleChapterNotFound'
)<BibleChapterLocation> {}

export class BibleChapterRepositoryFailure extends Data.TaggedError(
  'BibleChapterRepositoryFailure'
)<{
  readonly cause: unknown
}> {}

export type BibleChapterRepositoryError =
  | ActiveBiblePublicationUnavailable
  | BibleChapterNotFound
  | BibleChapterRepositoryFailure

export type BibleChapterRepositoryService = {
  findActiveChapter: (
    input: BibleChapterLocation
  ) => Effect.Effect<ActiveBibleChapter, BibleChapterRepositoryError>
  findActiveCoverage: (
    versionId: string
  ) => Effect.Effect<ActiveBibleCoverage, BibleChapterRepositoryError>
}

export class BibleChapterRepository extends Context.Tag('BibleChapterRepository')<
  BibleChapterRepository,
  BibleChapterRepositoryService
>() {}

const supportedVersions = new Set(['LSG'])

export const readBibleChapter = (
  input: BibleChapterLocation
): Effect.Effect<
  BibleChapterDto,
  UnsupportedBibleVersion | BibleChapterRepositoryError,
  BibleChapterRepository
> =>
  Effect.gen(function* () {
    if (!supportedVersions.has(input.versionId)) {
      return yield* new UnsupportedBibleVersion({ versionId: input.versionId })
    }
    const repository = yield* BibleChapterRepository
    const chapter = yield* repository.findActiveChapter(input)

    return new BibleChapterDto({
      resource: new BibleTextRevisionDto({
        kind: 'bible-text',
        versionId: chapter.versionId,
        revision: chapter.revision,
      }),
      book: chapter.book,
      chapter: chapter.chapter,
      verses: chapter.verses.map(
        verse =>
          new BibleChapterVerseDto({
            number: verse.number,
            text: verse.text,
            presentation: new BibleVersePresentationDto(verse.presentation),
          })
      ),
    })
  })

export const readBibleCoverage = (
  versionId: string
): Effect.Effect<
  BibleVersionCoverageDto,
  UnsupportedBibleVersion | BibleChapterRepositoryError,
  BibleChapterRepository
> =>
  Effect.gen(function* () {
    if (!supportedVersions.has(versionId)) {
      return yield* new UnsupportedBibleVersion({ versionId })
    }
    const repository = yield* BibleChapterRepository
    const coverage = yield* repository.findActiveCoverage(versionId)
    return new BibleVersionCoverageDto({
      resource: new BibleTextRevisionDto({
        kind: 'bible-text',
        versionId,
        revision: coverage.revision,
      }),
      books: [...coverage.books],
      chaptersByBook: Object.fromEntries(
        Object.entries(coverage.chaptersByBook).map(([book, chapters]) => [book, [...chapters]])
      ),
      verseCountByBookChapter: coverage.verseCountByBookChapter,
    })
  })
