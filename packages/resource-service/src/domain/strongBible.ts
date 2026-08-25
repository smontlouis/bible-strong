import { Context, Data, Effect } from 'effect'

import {
  StrongBibleBookCountDto,
  StrongBibleChapterDto,
  StrongBibleChapterVerseDto,
  StrongBibleCountsDto,
  StrongBibleCoverageDto,
  StrongBibleIdentityDto,
  StrongBibleLemmaStatDto,
  StrongBibleLemmaStatsDto,
  StrongBibleOccurrencesDto,
  StrongBibleOccurrenceVerseDto,
  StrongBibleRevisionDto,
  StrongBibleSpanDto,
} from '@bible-strong/resource-domain/contracts/strongBibleContract'
import type { StrongBibleSpan } from '@bible-strong/resource-domain/strong-bible'
import { isStrongBibleVersionId } from '@bible-strong/resource-catalog/strong-bibles'

export type StrongBibleResourceRevision = {
  versionId: string
  datasetId: string
  revision: string
  textRevision: string
  textSha256: string
  strongRevision: string
}

export type StrongBibleLocation = { versionId: string; book: number; chapter: number }
export type StrongBibleIdentityLookup = {
  versionId: string
  book: number
  reference: string
}
export type StrongBibleOccurrencesLookup = StrongBibleIdentityLookup & {
  limit?: number
  cursor?: string
  allBooks?: boolean
  lexemeId?: number
}

export type ActiveStrongBibleCoverage = StrongBibleResourceRevision & {
  books: readonly number[]
  chaptersByBook: Record<string, readonly number[]>
  verseCountByBookChapter: Record<string, number>
}
export type ActiveStrongBibleChapter = StrongBibleResourceRevision & {
  book: number
  chapter: number
  verses: readonly { number: number; spans: readonly StrongBibleSpan[] }[]
}
export type ActiveStrongBibleCounts = StrongBibleResourceRevision & {
  identity?: { id: number; kind: StrongBibleIdentityDto['kind']; code: string }
  counts: readonly { book: number; verseCount: number }[]
}
export type ActiveStrongBibleOccurrences = StrongBibleResourceRevision & {
  identity?: { id: number; kind: StrongBibleIdentityDto['kind']; code: string }
  verses: readonly {
    book: number
    chapter: number
    verse: number
    spans: readonly StrongBibleSpan[]
  }[]
  nextCursor?: string
}
export type ActiveStrongBibleLemmaStats = StrongBibleResourceRevision & {
  identity?: { id: number; kind: StrongBibleIdentityDto['kind']; code: string }
  lemmas: readonly { id: number; lemma: string; partOfSpeech: string; occurrenceCount: number }[]
}

export class UnsupportedStrongBibleVersion extends Data.TaggedError(
  'UnsupportedStrongBibleVersion'
)<{ readonly versionId: string }> {}
export class ActiveStrongBiblePublicationUnavailable extends Data.TaggedError(
  'ActiveStrongBiblePublicationUnavailable'
)<{ readonly versionId: string }> {}
export class StrongBibleChapterNotFound extends Data.TaggedError(
  'StrongBibleChapterNotFound'
)<StrongBibleLocation> {}
export class StrongBibleRepositoryFailure extends Data.TaggedError('StrongBibleRepositoryFailure')<{
  readonly cause: unknown
}> {}

export type StrongBibleRepositoryError =
  | ActiveStrongBiblePublicationUnavailable
  | StrongBibleChapterNotFound
  | StrongBibleRepositoryFailure

export type StrongBibleRepositoryService = {
  findActiveCoverage: (
    versionId: string
  ) => Effect.Effect<ActiveStrongBibleCoverage, StrongBibleRepositoryError>
  findActiveChapter: (
    input: StrongBibleLocation
  ) => Effect.Effect<ActiveStrongBibleChapter, StrongBibleRepositoryError>
  findCountsByBook: (
    input: StrongBibleIdentityLookup
  ) => Effect.Effect<ActiveStrongBibleCounts, StrongBibleRepositoryError>
  findOccurrences: (
    input: StrongBibleOccurrencesLookup
  ) => Effect.Effect<ActiveStrongBibleOccurrences, StrongBibleRepositoryError>
  findLemmaStats: (
    input: StrongBibleIdentityLookup
  ) => Effect.Effect<ActiveStrongBibleLemmaStats, StrongBibleRepositoryError>
}

export class StrongBibleRepository extends Context.Tag('StrongBibleRepository')<
  StrongBibleRepository,
  StrongBibleRepositoryService
>() {}

const assertSupported = (versionId: string) =>
  isStrongBibleVersionId(versionId)
    ? Effect.void
    : Effect.fail(new UnsupportedStrongBibleVersion({ versionId }))

const revisionDto = (active: StrongBibleResourceRevision) =>
  new StrongBibleRevisionDto({
    kind: 'strong-bible-index',
    versionId: active.versionId,
    datasetId: active.datasetId,
    revision: active.revision,
    textRevision: active.textRevision,
    textSha256: active.textSha256,
    strongRevision: active.strongRevision,
  })

const identityDto = (identity: ActiveStrongBibleCounts['identity']) =>
  identity ? new StrongBibleIdentityDto(identity) : undefined
const spanDto = (span: StrongBibleSpan) =>
  new StrongBibleSpanDto({
    ...span,
    identities: span.identities.map(identity => new StrongBibleIdentityDto(identity)),
  })

export const readStrongBibleCoverage = (versionId: string) =>
  Effect.gen(function* () {
    yield* assertSupported(versionId)
    const repository = yield* StrongBibleRepository
    const active = yield* repository.findActiveCoverage(versionId)
    return new StrongBibleCoverageDto({
      resource: revisionDto(active),
      books: [...active.books],
      chaptersByBook: Object.fromEntries(
        Object.entries(active.chaptersByBook).map(([book, chapters]) => [book, [...chapters]])
      ),
      verseCountByBookChapter: active.verseCountByBookChapter,
    })
  })

export const readStrongBibleChapter = (input: StrongBibleLocation) =>
  Effect.gen(function* () {
    yield* assertSupported(input.versionId)
    const repository = yield* StrongBibleRepository
    const active = yield* repository.findActiveChapter(input)
    return new StrongBibleChapterDto({
      resource: revisionDto(active),
      book: active.book,
      chapter: active.chapter,
      verses: active.verses.map(
        verse =>
          new StrongBibleChapterVerseDto({
            number: verse.number,
            spans: verse.spans.map(spanDto),
          })
      ),
    })
  })

export const readStrongBibleCounts = (input: StrongBibleIdentityLookup) =>
  Effect.gen(function* () {
    yield* assertSupported(input.versionId)
    const repository = yield* StrongBibleRepository
    const active = yield* repository.findCountsByBook(input)
    return new StrongBibleCountsDto({
      resource: revisionDto(active),
      identity: identityDto(active.identity),
      counts: active.counts.map(count => new StrongBibleBookCountDto(count)),
    })
  })

export const readStrongBibleOccurrences = (input: StrongBibleOccurrencesLookup) =>
  Effect.gen(function* () {
    yield* assertSupported(input.versionId)
    const repository = yield* StrongBibleRepository
    const active = yield* repository.findOccurrences(input)
    return new StrongBibleOccurrencesDto({
      resource: revisionDto(active),
      identity: identityDto(active.identity),
      verses: active.verses.map(
        verse =>
          new StrongBibleOccurrenceVerseDto({
            ...verse,
            spans: verse.spans.map(spanDto),
          })
      ),
      nextCursor: active.nextCursor,
    })
  })

export const readStrongBibleLemmaStats = (input: StrongBibleIdentityLookup) =>
  Effect.gen(function* () {
    yield* assertSupported(input.versionId)
    const repository = yield* StrongBibleRepository
    const active = yield* repository.findLemmaStats(input)
    return new StrongBibleLemmaStatsDto({
      resource: revisionDto(active),
      identity: identityDto(active.identity),
      lemmas: active.lemmas.map(lemma => new StrongBibleLemmaStatDto(lemma)),
    })
  })
