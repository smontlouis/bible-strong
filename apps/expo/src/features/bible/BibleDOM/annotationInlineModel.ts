import type { WordAnnotationsObj } from '~redux/modules/user/wordAnnotations'
import { getWordAnnotationAnchorRange } from '~redux/modules/user/wordAnnotationRanges'

export const getAnnotationInlineAnchorKey = ({
  wordAnnotations,
  relationItemsByAnnotation,
  versions,
  relationsAreInline,
  tagsAreInline,
}: {
  wordAnnotations: WordAnnotationsObj
  relationItemsByAnnotation: Record<string, readonly unknown[]>
  // Every version on screen
  versions: readonly string[]
  relationsAreInline: boolean
  tagsAreInline: boolean
}): string =>
  Object.entries(wordAnnotations)
    .flatMap(([annotationId, annotation]) => {
      if (!versions.includes(annotation.version)) return []
      const hasRelations =
        relationsAreInline && (relationItemsByAnnotation[annotationId]?.length || 0) > 0
      const hasTags = tagsAreInline && Object.keys(annotation.tags || {}).length > 0
      if (!hasRelations && !hasTags) return []

      const anchorRange = getWordAnnotationAnchorRange(annotation, 'end')
      if (!anchorRange) return []
      return [
        `${annotationId}:${annotation.version}:${anchorRange.verseKey}:${anchorRange.endWordIndex}:${Number(
          hasRelations
        )}:${Number(hasTags)}`,
      ]
    })
    .sort()
    .join('|')
