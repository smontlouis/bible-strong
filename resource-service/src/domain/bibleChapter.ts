import { Context, Data, Effect } from 'effect'

import {
  BibleChapterDto,
  BiblePericopeIndexDto,
  BiblePericopeVerseDto,
  BibleChapterVerseDto,
  BibleTextRevisionDto,
  BibleVersionCoverageDto,
  BibleVersePresentationDto,
  BibleVerseTextDto,
  BibleVerseTextsDto,
  type BibleVerseLocation,
  type BibleVersePresentation,
} from '../../../src/features/resources/bibleChapterContract'
import { isOrdinaryBibleVersionId } from '../../../src/helpers/ordinaryBibleVersions'

export type BibleChapterLocation = {
  versionId: string
  book: number
  chapter: number
}

export type ActiveBibleChapter = BibleChapterLocation & {
  revision: string
  textRevision: string
  textSha256?: string
  verses: readonly {
    number: number
    text: string
    presentation: BibleVersePresentation
  }[]
}

export type BibleVerseTextSelection = {
  versionId: string
  locations: readonly BibleVerseLocation[]
}

export type ActiveBibleVerseTexts = {
  versionId: string
  revision: string
  textRevision: string
  textSha256?: string
  verses: readonly (BibleVerseLocation & { text: string })[]
}

export type ActiveBibleCoverage = {
  versionId: string
  revision: string
  textRevision: string
  textSha256?: string
  canon: { id: string; orderedBooks: readonly number[] }
  versification: string
  books: readonly number[]
  chaptersByBook: Record<string, readonly number[]>
  verseCountByBookChapter: Record<string, number>
}

export type ActiveBiblePericopeIndex = {
  versionId: string
  revision: string
  textRevision: string
  textSha256?: string
  verses: readonly {
    book: number
    chapter: number
    verse: number
    headings: BibleVersePresentation['headings']
  }[]
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

export class BibleVerseSelectionNotFound extends Data.TaggedError(
  'BibleVerseSelectionNotFound'
)<BibleVerseTextSelection> {}

export class BibleChapterRepositoryFailure extends Data.TaggedError(
  'BibleChapterRepositoryFailure'
)<{
  readonly cause: unknown
}> {}

export type BibleChapterRepositoryError =
  | ActiveBiblePublicationUnavailable
  | BibleChapterNotFound
  | BibleVerseSelectionNotFound
  | BibleChapterRepositoryFailure

export type BibleChapterRepositoryService = {
  findActiveChapter: (
    input: BibleChapterLocation
  ) => Effect.Effect<ActiveBibleChapter, BibleChapterRepositoryError>
  findActiveCoverage: (
    versionId: string
  ) => Effect.Effect<ActiveBibleCoverage, BibleChapterRepositoryError>
  findActivePericopes: (
    versionId: string
  ) => Effect.Effect<ActiveBiblePericopeIndex, BibleChapterRepositoryError>
  findActiveVerseTexts: (
    input: BibleVerseTextSelection
  ) => Effect.Effect<ActiveBibleVerseTexts, BibleChapterRepositoryError>
}

export class BibleChapterRepository extends Context.Tag('BibleChapterRepository')<
  BibleChapterRepository,
  BibleChapterRepositoryService
>() {}

export const readBibleChapter = (
  input: BibleChapterLocation
): Effect.Effect<
  BibleChapterDto,
  UnsupportedBibleVersion | BibleChapterRepositoryError,
  BibleChapterRepository
> =>
  Effect.gen(function* () {
    if (!isOrdinaryBibleVersionId(input.versionId)) {
      return yield* new UnsupportedBibleVersion({ versionId: input.versionId })
    }
    const repository = yield* BibleChapterRepository
    const chapter = yield* repository.findActiveChapter(input)

    return new BibleChapterDto({
      resource: new BibleTextRevisionDto({
        kind: 'bible-text',
        versionId: chapter.versionId,
        revision: chapter.revision,
        textRevision: chapter.textRevision,
        ...(chapter.textSha256 ? { textSha256: chapter.textSha256 } : {}),
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

export const readBibleVerseTexts = (
  input: BibleVerseTextSelection
): Effect.Effect<
  BibleVerseTextsDto,
  UnsupportedBibleVersion | BibleChapterRepositoryError,
  BibleChapterRepository
> =>
  Effect.gen(function* () {
    if (!isOrdinaryBibleVersionId(input.versionId)) {
      return yield* new UnsupportedBibleVersion({ versionId: input.versionId })
    }
    const repository = yield* BibleChapterRepository
    const selection = yield* repository.findActiveVerseTexts(input)

    return new BibleVerseTextsDto({
      resource: new BibleTextRevisionDto({
        kind: 'bible-text',
        versionId: selection.versionId,
        revision: selection.revision,
        textRevision: selection.textRevision,
        ...(selection.textSha256 ? { textSha256: selection.textSha256 } : {}),
      }),
      verses: selection.verses.map(
        verse =>
          new BibleVerseTextDto({
            book: verse.book,
            chapter: verse.chapter,
            number: verse.verse,
            text: verse.text,
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
    if (!isOrdinaryBibleVersionId(versionId)) {
      return yield* new UnsupportedBibleVersion({ versionId })
    }
    const repository = yield* BibleChapterRepository
    const coverage = yield* repository.findActiveCoverage(versionId)
    return new BibleVersionCoverageDto({
      resource: new BibleTextRevisionDto({
        kind: 'bible-text',
        versionId,
        revision: coverage.revision,
        textRevision: coverage.textRevision,
        ...(coverage.textSha256 ? { textSha256: coverage.textSha256 } : {}),
      }),
      books: [...coverage.books],
      canon: { id: coverage.canon.id, orderedBooks: [...coverage.canon.orderedBooks] },
      versification: coverage.versification,
      chaptersByBook: Object.fromEntries(
        Object.entries(coverage.chaptersByBook).map(([book, chapters]) => [book, [...chapters]])
      ),
      verseCountByBookChapter: coverage.verseCountByBookChapter,
    })
  })

export const readBiblePericopes = (
  versionId: string
): Effect.Effect<
  BiblePericopeIndexDto,
  UnsupportedBibleVersion | BibleChapterRepositoryError,
  BibleChapterRepository
> =>
  Effect.gen(function* () {
    if (!isOrdinaryBibleVersionId(versionId)) {
      return yield* new UnsupportedBibleVersion({ versionId })
    }
    const repository = yield* BibleChapterRepository
    const index = yield* repository.findActivePericopes(versionId)
    return new BiblePericopeIndexDto({
      resource: new BibleTextRevisionDto({
        kind: 'bible-text',
        versionId,
        revision: index.revision,
        textRevision: index.textRevision,
        ...(index.textSha256 ? { textSha256: index.textSha256 } : {}),
      }),
      verses: index.verses.map(verse => new BiblePericopeVerseDto(verse)),
    })
  })
