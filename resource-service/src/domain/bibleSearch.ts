import { Context, Data, Effect } from 'effect'

import {
  BibleMultiSearchResponseDto,
  BibleSearchResponseDto,
  BibleSearchResultDto,
  BibleTextRevisionDto,
} from '../../../src/features/resources/bibleChapterContract'
import { isOrdinaryBibleVersionId } from '../../../src/helpers/ordinaryBibleVersions'
import { UnsupportedBibleVersion } from './bibleChapter'
import type { BibleCanonId } from '../../../src/helpers/bibleBookCatalog'

export type BibleSearchInput = {
  versionId: string
  query: string
  book?: number
  section?: 'ot' | 'nt'
  canon?: BibleCanonId
  sortOrder?: 'relevance' | 'book'
  limit?: number
  offset?: number
}

export type BibleMultiSearchInput = Omit<BibleSearchInput, 'versionId'> & {
  versionIds: string[]
}

export type ActiveBibleSearch = {
  versionId: string
  revision: string
  textRevision: string
  textSha256?: string
  count: number
  results: {
    version: string
    book: number
    chapter: number
    verse: number
    text: string
    highlighted: string
  }[]
}

export type ActiveBibleMultiSearch = {
  resources: {
    versionId: string
    revision: string
    textRevision: string
    textSha256?: string
  }[]
  count: number
  results: ActiveBibleSearch['results']
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
  searchMany: (
    input: BibleMultiSearchInput
  ) => Effect.Effect<ActiveBibleMultiSearch, BibleSearchRepositoryError>
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

export const readBibleSearchMany = (
  input: BibleMultiSearchInput
): Effect.Effect<
  BibleMultiSearchResponseDto,
  BibleSearchRepositoryError | UnsupportedBibleVersion,
  BibleSearchRepository
> =>
  Effect.gen(function* () {
    const versionIds = [...new Set(input.versionIds)]
    const unsupported = versionIds.find(versionId => !isOrdinaryBibleVersionId(versionId))
    if (unsupported) return yield* new UnsupportedBibleVersion({ versionId: unsupported })

    const active = yield* (yield* BibleSearchRepository).searchMany({ ...input, versionIds })
    return new BibleMultiSearchResponseDto({
      resources: active.resources.map(
        resource =>
          new BibleTextRevisionDto({
            kind: 'bible-text',
            versionId: resource.versionId,
            revision: resource.revision,
            textRevision: resource.textRevision,
            ...(resource.textSha256 ? { textSha256: resource.textSha256 } : {}),
          })
      ),
      count: active.count,
      results: active.results.map(result => new BibleSearchResultDto(result)),
    })
  })
