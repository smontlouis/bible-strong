import { Context, Data, Effect } from 'effect'

import {
  BibleSearchResponseDto,
  BibleSearchResultDto,
  BibleTextRevisionDto,
} from '../../../src/features/resources/bibleChapterContract'
import { isOrdinaryBibleVersionId } from '../../../src/helpers/ordinaryBibleVersions'
import { UnsupportedBibleVersion } from './bibleChapter'

export type BibleSearchInput = {
  versionId: string
  query: string
  book?: number
  section?: 'ot' | 'nt'
  sortOrder?: 'relevance' | 'book'
  limit?: number
  offset?: number
}

export type ActiveBibleSearch = {
  versionId: string
  revision: string
  textRevision: string
  textSha256?: string
  count: number
  results: Array<{
    version: string
    book: number
    chapter: number
    verse: number
    text: string
    highlighted: string
  }>
}

export class BibleSearchRepositoryFailure extends Data.TaggedError('BibleSearchRepositoryFailure')<{
  readonly cause: unknown
}> {}

export class ActiveBibleSearchPublicationUnavailable extends Data.TaggedError(
  'ActiveBibleSearchPublicationUnavailable'
)<{ readonly versionId: string }> {}

export type BibleSearchRepositoryError =
  | BibleSearchRepositoryFailure
  | ActiveBibleSearchPublicationUnavailable

export type BibleSearchRepositoryService = {
  search: (input: BibleSearchInput) => Effect.Effect<ActiveBibleSearch, BibleSearchRepositoryError>
}

export class BibleSearchRepository extends Context.Tag('BibleSearchRepository')<
  BibleSearchRepository,
  BibleSearchRepositoryService
>() {}

export const readBibleSearch = (
  input: BibleSearchInput
): Effect.Effect<
  BibleSearchResponseDto,
  BibleSearchRepositoryError | UnsupportedBibleVersion,
  BibleSearchRepository
> =>
  Effect.gen(function* () {
    if (!isOrdinaryBibleVersionId(input.versionId)) {
      return yield* new UnsupportedBibleVersion({ versionId: input.versionId })
    }
    const active = yield* (yield* BibleSearchRepository).search(input)
    return new BibleSearchResponseDto({
      resource: new BibleTextRevisionDto({
        kind: 'bible-text',
        versionId: active.versionId,
        revision: active.revision,
        textRevision: active.textRevision,
        ...(active.textSha256 ? { textSha256: active.textSha256 } : {}),
      }),
      count: active.count,
      results: active.results.map(result => new BibleSearchResultDto(result)),
    })
  })
