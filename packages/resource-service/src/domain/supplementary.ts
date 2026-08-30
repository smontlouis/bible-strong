import { Context, Data, Effect } from 'effect'

import {
  CommentaryChapterResponseDto,
  CommentaryVerseResponseDto,
  CrossReferenceResponseDto,
  SupplementaryRevisionDto,
} from '@bible-strong/resource-domain/contracts/supplementaryContract'

export type SupplementaryLanguage = 'fr' | 'en'
export type CommentaryVerseLookup = { collection: string; language: SupplementaryLanguage; verseKey: string }
export type CommentaryChapterLookup = {
  collection: string
  language: SupplementaryLanguage
  book: number
  chapter: number
}
export type CrossReferenceLookup = { language: 'fr'; verseKey: string }

type ActiveCommentaryVerse = CommentaryVerseLookup & { revision: string; content: string }
type ActiveCommentaryChapter = CommentaryChapterLookup & {
  revision: string
  comments: Record<string, string>
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
  findCommentaryVerse: (
    input: CommentaryVerseLookup
  ) => Effect.Effect<ActiveCommentaryVerse, SupplementaryRepositoryError>
  findCommentaryChapter: (
    input: CommentaryChapterLookup
  ) => Effect.Effect<ActiveCommentaryChapter, SupplementaryRepositoryError>
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
