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
  buildCommentaryChapterSections,
  closestCommentarySection,
} from '@bible-strong/resource-domain/commentary-chapter-sections'
import {
  CommentaryChapterResponseDto,
  CommentaryCoverageResponseDto,
  CommentaryVerseResponseDto,
  CommentaryVerseSectionDto,
  CommentaryVerseSectionsResponseDto,
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
export type CommentaryChaptersLookup = {
  collections: readonly string[]
  language: SupplementaryLanguage
  book: number
  chapter: number
}
export type CommentaryVerseSectionsLookup = {
  collections: readonly string[]
  language: SupplementaryLanguage
  book: number
  chapter: number
  verse: number
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
  /**
   * The comments of one chapter in several commentaries, read together. A commentary
   * without an active publication is left out; one that says nothing on the chapter has
   * no comments.
   */
  findCommentaryChapters: (
    input: CommentaryChaptersLookup
  ) => Effect.Effect<
    readonly { collection: string; revision: string; comments: Record<string, string> }[],
    SupplementaryRepositoryFailure
  >
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

/**
 * For each commentary, the section the public site shows on a verse: the sections of the
 * chapter are built as the site builds them, and the closest one is kept.
 *
 * Sections are built for the catalog identity of a commentary. A publication is named like
 * it, except one edition that is not the anthology read by source document.
 */
export const readCommentaryVerseSections = (input: CommentaryVerseSectionsLookup) =>
  Effect.gen(function* () {
    const repository = yield* SupplementaryRepository
    const chapters = yield* repository.findCommentaryChapters(input)
    const published = new Map(chapters.map(chapter => [chapter.collection, chapter]))
    return new CommentaryVerseSectionsResponseDto({
      verseKey: `${input.book}-${input.chapter}-${input.verse}`,
      sections: input.collections.flatMap(collection => {
        const chapter = published.get(collection)
        const section =
          chapter &&
          closestCommentarySection(
            buildCommentaryChapterSections(collection, chapter.comments),
            input.verse
          )
        return section
          ? [
              new CommentaryVerseSectionDto({
                resource: revisionDto('commentary', collection, input.language, chapter.revision),
                slug: section.slug,
                startVerse: section.startVerse,
                endVerse: section.endVerse,
                content: section.content,
              }),
            ]
          : []
      }),
      unavailable: input.collections.filter(collection => !published.has(collection)),
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
