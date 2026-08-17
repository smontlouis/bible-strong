import { Context, Data, Effect } from 'effect'

import {
  InterlinearBibleChapterDto,
  InterlinearBibleCoverageDto,
  InterlinearBibleRevisionDto,
  InterlinearChapterVerseDto,
  InterlinearIdentityDto,
  InterlinearSegmentDto,
  InterlinearTokenDto,
} from '../../../src/features/resources/interlinearBibleContract'
import type { ResourceLanguage } from '../../../src/helpers/databaseTypes'
import type { InterlinearToken } from '../../../src/helpers/interlinearBibleSidecar'

export type InterlinearBibleIdentity = {
  versionId: 'BHG'
  language: ResourceLanguage
}

export type InterlinearBibleLocation = InterlinearBibleIdentity & {
  book: number
  chapter: number
}

export type InterlinearBibleResourceRevision = InterlinearBibleIdentity & {
  datasetId: 'STEP'
  revision: string
  textRevision: string
  textSha256: string
}

export type ActiveInterlinearBibleCoverage = InterlinearBibleResourceRevision & {
  books: readonly number[]
  chaptersByBook: Record<string, readonly number[]>
  verseCountByBookChapter: Record<string, number>
}

export type ActiveInterlinearBibleChapter = InterlinearBibleResourceRevision & {
  book: number
  chapter: number
  verses: readonly { number: number; tokens: readonly InterlinearToken[] }[]
}

export class UnsupportedInterlinearBible extends Data.TaggedError('UnsupportedInterlinearBible')<{
  readonly versionId: string
  readonly language: string
}> {}
export class ActiveInterlinearBiblePublicationUnavailable extends Data.TaggedError(
  'ActiveInterlinearBiblePublicationUnavailable'
)<InterlinearBibleIdentity> {}
export class InterlinearBibleChapterNotFound extends Data.TaggedError(
  'InterlinearBibleChapterNotFound'
)<InterlinearBibleLocation> {}
export class InterlinearBibleRepositoryFailure extends Data.TaggedError(
  'InterlinearBibleRepositoryFailure'
)<{ readonly cause: unknown }> {}

export type InterlinearBibleRepositoryError =
  | ActiveInterlinearBiblePublicationUnavailable
  | InterlinearBibleChapterNotFound
  | InterlinearBibleRepositoryFailure

export type InterlinearBibleRepositoryService = {
  findActiveCoverage: (
    input: InterlinearBibleIdentity
  ) => Effect.Effect<ActiveInterlinearBibleCoverage, InterlinearBibleRepositoryError>
  findActiveChapter: (
    input: InterlinearBibleLocation
  ) => Effect.Effect<ActiveInterlinearBibleChapter, InterlinearBibleRepositoryError>
}

export class InterlinearBibleRepository extends Context.Tag('InterlinearBibleRepository')<
  InterlinearBibleRepository,
  InterlinearBibleRepositoryService
>() {}

const assertSupported = (input: { versionId: string; language: string }) =>
  input.versionId === 'BHG' && (input.language === 'fr' || input.language === 'en')
    ? Effect.void
    : Effect.fail(new UnsupportedInterlinearBible(input))

const revisionDto = (resource: InterlinearBibleResourceRevision) =>
  new InterlinearBibleRevisionDto({
    kind: 'interlinear-index',
    versionId: resource.versionId,
    datasetId: resource.datasetId,
    language: resource.language,
    revision: resource.revision,
    textRevision: resource.textRevision,
    textSha256: resource.textSha256,
  })

const tokenDto = (token: InterlinearToken) =>
  new InterlinearTokenDto({
    id: token.id!,
    ordinal: token.ordinal,
    startOffset: token.startOffset,
    length: token.length,
    segments: token.segments.map(
      segment =>
        new InterlinearSegmentDto({
          ...segment,
          identities: segment.identities.map(identity => new InterlinearIdentityDto(identity)),
        })
    ),
  })

export const readInterlinearBibleCoverage = (input: InterlinearBibleIdentity) =>
  Effect.gen(function* () {
    yield* assertSupported(input)
    const repository = yield* InterlinearBibleRepository
    const active = yield* repository.findActiveCoverage(input)
    return new InterlinearBibleCoverageDto({
      resource: revisionDto(active),
      books: [...active.books],
      chaptersByBook: Object.fromEntries(
        Object.entries(active.chaptersByBook).map(([book, chapters]) => [book, [...chapters]])
      ),
      verseCountByBookChapter: active.verseCountByBookChapter,
    })
  })

export const readInterlinearBibleChapter = (input: InterlinearBibleLocation) =>
  Effect.gen(function* () {
    yield* assertSupported(input)
    const repository = yield* InterlinearBibleRepository
    const active = yield* repository.findActiveChapter(input)
    return new InterlinearBibleChapterDto({
      resource: revisionDto(active),
      book: active.book,
      chapter: active.chapter,
      verses: active.verses.map(
        verse =>
          new InterlinearChapterVerseDto({
            number: verse.number,
            tokens: verse.tokens.map(tokenDto),
          })
      ),
    })
  })
