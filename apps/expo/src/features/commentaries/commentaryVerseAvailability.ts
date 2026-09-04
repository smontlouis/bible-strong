import {
  COMMENTARY_CATALOG_BY_ID,
  type CommentaryCatalogEntry,
  type CommentaryLanguage,
} from '@bible-strong/resource-catalog/commentaries'

import type { CommentaryUnavailableResource } from '~features/resources/commentaryAccess'
import type { Comment } from './types'
import type { CommentaryProjectionId } from './commentarySelection'

export type CommentaryVerseAvailabilityState = 'verse' | 'chapter' | 'no-content' | 'unavailable'

export type CommentaryVerseAvailability = {
  projectionId: CommentaryProjectionId
  entry: CommentaryCatalogEntry
  language: CommentaryLanguage
  resourceCode: string
  state: CommentaryVerseAvailabilityState
  comment?: Comment
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
    const unavailable = unavailableResources.some(
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
