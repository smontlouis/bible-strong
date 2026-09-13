import {
  CommentaryReadingIndexRequest,
  CommentaryReadingIndexResponse,
  CommentaryReadingIndexEntry,
  CommentaryReadingResourceIndex,
  CommentaryReadingSectionRequest,
  CommentaryReadingSectionResponse,
} from '@bible-strong/resource-domain/contracts/commentaryReadingContract'
import { Context, Data, Effect } from 'effect'

import {
  CommentaryChapterResponseDto,
  CommentaryCoverageResponseDto,
  CommentaryVerseResponseDto,
  CrossReferenceResponseDto,
  SupplementaryRevisionDto,
} from '@bible-strong/resource-domain/contracts/supplementaryContract'

export type SupplementaryLanguage = 'fr' | 'en'
export type CommentaryVerseLookup = {
  collection: string
  language: SupplementaryLanguage
  verseKey: string
}
export type CommentaryChapterLookup = {
  collection: string
  language: SupplementaryLanguage
  book: number
  chapter: number
}
export type CommentaryCoverageLookup = {
  collection: string
  language: SupplementaryLanguage
}
export type CrossReferenceLookup = { language: 'fr'; verseKey: string }

type ActiveCommentaryVerse = CommentaryVerseLookup & { revision: string; content: string }
type ActiveCommentaryChapter = CommentaryChapterLookup & {
  revision: string
  comments: Record<string, string>
}
type ActiveCommentaryCoverage = CommentaryCoverageLookup & {
  revision: string
  books: number[]
  chaptersByBook: Record<string, number[]>
}
type ActiveCrossReferences = CrossReferenceLookup & { revision: string; references: string[] }

export class ActiveSupplementaryPublicationUnavailable extends Data.TaggedError(
  'ActiveSupplementaryPublicationUnavailable'
)<{ readonly resourceIdentity: string }> {}

export class SupplementaryContentNotFound extends Data.TaggedError('SupplementaryContentNotFound')<{
  readonly resourceIdentity: string
  readonly verseKey?: string
}> {}

export class SupplementaryRepositoryFailure extends Data.TaggedError(
  'SupplementaryRepositoryFailure'
)<{
  readonly cause: unknown
}> {}

export type SupplementaryRepositoryError =
  | ActiveSupplementaryPublicationUnavailable
  | SupplementaryContentNotFound
  | SupplementaryRepositoryFailure

export type SupplementaryRepositoryService = {
  findCommentaryReadingIndex: (input: CommentaryChapterLookup) => Effect.Effect<
    {
      revision: string
      sections: readonly CommentaryReadingIndexEntry[]
    },
    SupplementaryRepositoryError
  >
  findCommentaryReadingSection: (input: CommentaryReadingSectionRequest) => Effect.Effect<
    {
      revision: string
      section: { id: string; rangeStartVerse: number; rangeEndVerse: number; content: string }
    },
    SupplementaryRepositoryError
  >

  findCommentaryVerse: (
    input: CommentaryVerseLookup
  ) => Effect.Effect<ActiveCommentaryVerse, SupplementaryRepositoryError>
  findCommentaryChapter: (
    input: CommentaryChapterLookup
  ) => Effect.Effect<ActiveCommentaryChapter, SupplementaryRepositoryError>
  findCommentaryCoverage: (
    input: CommentaryCoverageLookup
  ) => Effect.Effect<ActiveCommentaryCoverage, SupplementaryRepositoryError>
  findCrossReferences: (
    input: CrossReferenceLookup
  ) => Effect.Effect<ActiveCrossReferences, SupplementaryRepositoryError>
}

export class SupplementaryRepository extends Context.Tag('SupplementaryRepository')<
  SupplementaryRepository,
  SupplementaryRepositoryService
>() {}

const revisionDto = (
  kind: 'commentary' | 'cross-references',
  resourceId: string,
  language: SupplementaryLanguage,
  revision: string
) => new SupplementaryRevisionDto({ kind, resourceId, language, revision })

export const readCommentaryVerse = (input: CommentaryVerseLookup) =>
  Effect.gen(function* () {
    const repository = yield* SupplementaryRepository
    const active = yield* repository.findCommentaryVerse(input)
    return new CommentaryVerseResponseDto({
      resource: revisionDto('commentary', active.collection, active.language, active.revision),
      verseKey: active.verseKey,
      content: active.content,
    })
  })

export const readCommentaryChapter = (input: CommentaryChapterLookup) =>
  Effect.gen(function* () {
    const repository = yield* SupplementaryRepository
    const active = yield* repository.findCommentaryChapter(input)
    return new CommentaryChapterResponseDto({
      resource: revisionDto('commentary', active.collection, active.language, active.revision),
      book: active.book,
      chapter: active.chapter,
      serializedComments: JSON.stringify(active.comments),
    })
  })

export const readCommentaryCoverage = (input: CommentaryCoverageLookup) =>
  Effect.gen(function* () {
    const repository = yield* SupplementaryRepository
    const active = yield* repository.findCommentaryCoverage(input)
    return new CommentaryCoverageResponseDto({
      resource: revisionDto('commentary', active.collection, active.language, active.revision),
      books: active.books,
      chaptersByBook: active.chaptersByBook,
    })
  })

export const readCrossReferences = (input: CrossReferenceLookup) =>
  Effect.gen(function* () {
    const repository = yield* SupplementaryRepository
    const active = yield* repository.findCrossReferences(input)
    return new CrossReferenceResponseDto({
      resource: revisionDto('cross-references', 'TRESOR', 'fr', active.revision),
      verseKey: active.verseKey,
      references: active.references,
    })
  })

export const readCommentaryReadingIndex = (input: CommentaryReadingIndexRequest) =>
  Effect.gen(function* () {
    const repository = yield* SupplementaryRepository
    const resources = [
      ...new Map(
        input.resources.map(resource => [`${resource.resourceId}:${resource.language}`, resource])
      ).values(),
    ]
    const results = yield* Effect.forEach(
      resources,
      resource =>
        repository
          .findCommentaryReadingIndex({
            collection: resource.resourceId,
            language: resource.language,
            book: input.book,
            chapter: input.chapter,
          })
          .pipe(
            Effect.map(result => ({ resource, result, cause: undefined })),
            Effect.catchAll(error =>
              Effect.succeed({
                resource,
                result: undefined,
                cause:
                  error._tag === 'ActiveSupplementaryPublicationUnavailable'
                    ? ('index-unavailable' as const)
                    : error._tag === 'SupplementaryContentNotFound'
                      ? ('not-found' as const)
                      : ('temporary-unavailable' as const),
              })
            )
          ),
      { concurrency: 5 }
    )
    return new CommentaryReadingIndexResponse({
      book: input.book,
      chapter: input.chapter,
      indexes: results.flatMap(item =>
        item.result
          ? [
              new CommentaryReadingResourceIndex({
                resource: revisionDto(
                  'commentary',
                  item.resource.resourceId,
                  item.resource.language,
                  item.result.revision
                ),
                sections: item.result.sections.map(
                  section => new CommentaryReadingIndexEntry(section)
                ),
              }),
            ]
          : []
      ),
      unavailable: results.flatMap(item =>
        item.cause ? [{ ...item.resource, cause: item.cause }] : []
      ),
    })
  })

export const readCommentaryReadingSection = (input: CommentaryReadingSectionRequest) =>
  Effect.gen(function* () {
    const repository = yield* SupplementaryRepository
    const result = yield* repository.findCommentaryReadingSection(input)
    return new CommentaryReadingSectionResponse({
      resource: revisionDto('commentary', input.resourceId, input.language, result.revision),
      book: input.book,
      chapter: input.chapter,
      section: result.section,
    })
  })
