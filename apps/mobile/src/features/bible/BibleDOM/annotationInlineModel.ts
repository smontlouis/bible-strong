import type { WordAnnotationsObj } from '~redux/modules/user/wordAnnotations'
import { getWordAnnotationAnchorRange } from '~redux/modules/user/wordAnnotationRanges'

export const getAnnotationInlineAnchorKey = ({
  wordAnnotations,
  relationItemsByAnnotation,
  version,
  relationsAreInline,
  tagsAreInline,
}: {
  wordAnnotations: WordAnnotationsObj
  relationItemsByAnnotation: Record<string, readonly unknown[]>
  version: string
  relationsAreInline: boolean
  tagsAreInline: boolean
}): string =>
  Object.entries(wordAnnotations)
    .flatMap(([annotationId, annotation]) => {
      if (annotation.version !== version) return []
      const hasRelations =
        relationsAreInline && (relationItemsByAnnotation[annotationId]?.length || 0) > 0
      const hasTags = tagsAreInline && Object.keys(annotation.tags || {}).length > 0
      if (!hasRelations && !hasTags) return []

      const anchorRange = getWordAnnotationAnchorRange(annotation, 'end')
      if (!anchorRange) return []
      return [
        `${annotationId}:${anchorRange.verseKey}:${anchorRange.endWordIndex}:${Number(
          hasRelations
        )}:${Number(hasTags)}`,
      ]
    })
    .sort()
    .join('|')
