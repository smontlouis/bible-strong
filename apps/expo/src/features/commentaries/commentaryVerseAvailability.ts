import {
  COMMENTARY_CATALOG_BY_ID,
  type CommentaryCatalogEntry,
  type CommentaryLanguage,
} from '@bible-strong/resource-catalog/commentaries'

import type { CommentaryUnavailableResource } from '~features/resources/commentaryAccess'
import {
  bibleVerseInResource,
  commentaryResourceKey,
  resourceRangeInReaderChapter,
} from '~features/resources/resourceNumbering'
import type { Comment } from './types'
import type { CommentaryProjectionId } from './commentarySelection'

export type CommentaryVerseAvailabilityState = 'verse' | 'chapter' | 'no-content' | 'unavailable'

export type CommentaryVerseAvailability = {
  projectionId: CommentaryProjectionId
  entry: CommentaryCatalogEntry
  language: CommentaryLanguage
  resourceCode: string
  state: CommentaryVerseAvailabilityState
  /** Why an `unavailable` resource could not be read, so the row can say what would fix it. */
  unavailableCause?: CommentaryUnavailableResource['cause']
  comment?: Comment
  /** The commentary's own verse for the reader's verse, where its page opens (KJV Mal 4:5). */
  location?: { book: number; chapter: number; verse: number }
  /** The verses the comment covers in the reader's numbering, clipped to the reader's chapter. */
  passageRange?: Pick<Comment, 'rangeStartVerse' | 'rangeEndVerse'>
}

const parseProjectionId = (value: string) => {
  const separator = value.lastIndexOf(':')
  if (separator <= 0) return null
  const resourceId = value.slice(0, separator)
  const languageValue = value.slice(separator + 1)
  const language: CommentaryLanguage | null =
    languageValue === 'fr' ? 'fr' : languageValue === 'en' ? 'en' : null
  if (!language) return null
  const entry = COMMENTARY_CATALOG_BY_ID.get(resourceId)
  if (!entry?.languages.includes(language)) return null
  return {
    resourceId,
    language,
    projectionId: value as CommentaryProjectionId,
  }
}

export const buildCommentaryVerseAvailability = ({
  selectedProjectionIds,
  commentsByVerse,
  verseNumber,
  unavailableResources,
}: {
  selectedProjectionIds: readonly string[]
  commentsByVerse: Readonly<Record<string, readonly Comment[]>>
  verseNumber: number
  unavailableResources: readonly CommentaryUnavailableResource[]
}): CommentaryVerseAvailability[] =>
  selectedProjectionIds.flatMap(value => {
    const projection = parseProjectionId(value)
    if (!projection) return []
    const entry = COMMENTARY_CATALOG_BY_ID.get(projection.resourceId)
    if (!entry) return []
    const resourceCode = `${entry.publicationId}:${projection.language}`
    const unavailable = unavailableResources.find(
      resource => resource.resourceId === entry.id && resource.language === projection.language
    )
    const comment = (commentsByVerse[String(verseNumber)] ?? []).find(
      currentComment => currentComment.resource.code === resourceCode
    )
    const hasChapterContent = Object.values(commentsByVerse).some(comments =>
      comments.some(comment => comment.resource.code === resourceCode)
    )

    return [
      {
        projectionId: projection.projectionId,
        entry,
        language: projection.language,
        resourceCode,
        state: unavailable
          ? 'unavailable'
          : comment
            ? 'verse'
            : hasChapterContent
              ? 'chapter'
              : 'no-content',
        unavailableCause: unavailable?.cause,
        comment,
      },
    ]
  })

export const formatCommentaryPassageLabel = (
  headerTitle: string,
  comment: Pick<Comment, 'rangeStartVerse' | 'rangeEndVerse'>
) => {
  const chapterTitle = headerTitle.replace(/:\d+(?:[-–]\d+)?$/u, '')
  return comment.rangeStartVerse === comment.rangeEndVerse
    ? `${chapterTitle}:${comment.rangeStartVerse}`
    : `${chapterTitle}:${comment.rangeStartVerse}–${comment.rangeEndVerse}`
}

type ChapterComments = {
  chapter: number
  commentsByVerse: Readonly<Record<string, readonly Comment[]>>
  unavailableResources: readonly CommentaryUnavailableResource[]
}

/**
 * The verse each selected commentary is read at for a verse of a Bible, in its own numbering
 * (LSG Malachi 3:23 is KJV Malachi 4:5), grouped by the commentary chapter to load. A commentary
 * without an equivalent verse is left out.
 */
export const getCommentaryChaptersForVerse = ({
  selectedProjectionIds,
  verse,
  version,
}: {
  selectedProjectionIds: readonly string[]
  verse: string
  version: string | undefined
}) => {
  const groups = new Map<
    number,
    { projectionId: string; resourceId: string; language: CommentaryLanguage }[]
  >()
  for (const value of selectedProjectionIds) {
    const projection = parseProjectionId(value)
    if (!projection) continue
    const key = bibleVerseInResource(verse, version, commentaryResourceKey(projection.resourceId))
    const chapter = Number(key?.split('-')[1])
    if (!Number.isSafeInteger(chapter)) continue
    groups.set(chapter, [...(groups.get(chapter) ?? []), projection])
  }
  return [...groups]
    .sort(([left], [right]) => left - right)
    .map(([chapter, items]) => ({ chapter, items }))
}

/**
 * The availability of each selected commentary for a verse of a Bible, each read at its own
 * verse in the chapters loaded for it, with where its page opens and the verses its comment
 * covers in the reader's numbering.
 */
export const buildReaderCommentaryVerseAvailability = ({
  selectedProjectionIds,
  verse,
  version,
  chapters,
}: {
  selectedProjectionIds: readonly string[]
  verse: string
  version: string | undefined
  chapters: readonly ChapterComments[]
}): CommentaryVerseAvailability[] => {
  const [book, readerChapter] = verse.split('-').map(Number)
  return selectedProjectionIds.flatMap(value => {
    const projection = parseProjectionId(value)
    if (!projection) return []
    const resource = commentaryResourceKey(projection.resourceId)
    const [, chapter, verseNumber] = (bibleVerseInResource(verse, version, resource) ?? '')
      .split('-')
      .map(Number)
    const loaded = chapters.find(item => item.chapter === chapter)
    const [item] = buildCommentaryVerseAvailability({
      selectedProjectionIds: [value],
      commentsByVerse: loaded?.commentsByVerse ?? {},
      verseNumber: loaded ? verseNumber : Number.NaN,
      unavailableResources: loaded?.unavailableResources ?? [],
    })
    if (!item) return []
    if (!loaded) return [item]
    const range = item.comment
      ? resourceRangeInReaderChapter({ version, book, chapter: readerChapter }, resource, chapter, {
          start: item.comment.rangeStartVerse,
          end: item.comment.rangeEndVerse,
        })
      : undefined
    return [
      {
        ...item,
        location: { book, chapter, verse: verseNumber },
        ...(range && { passageRange: { rangeStartVerse: range.start, rangeEndVerse: range.end } }),
      },
    ]
  })
}
