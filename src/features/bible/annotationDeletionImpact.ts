import type { WordAnnotationsObj } from '~redux/modules/user/wordAnnotations'
import {
  findOverlappingWordAnnotationIds,
  normalizeWordSelectionRange,
  type WordPosition,
} from '~redux/modules/user/wordAnnotationRanges'

interface SelectionAnnotationDeletionImpactParams {
  wordAnnotations: WordAnnotationsObj
  version: string
  start: WordPosition
  end: WordPosition
  relationCountsByEndpointIdentity: Record<string, number>
}

export interface SelectionAnnotationDeletionImpact {
  annotationCount: number
  hasNote: boolean
  hasTags: boolean
  hasRelations: boolean
}

export const requiresSelectionAnnotationDeletionConfirmation = (
  impact: SelectionAnnotationDeletionImpact
): boolean => impact.annotationCount > 0

export const getSelectionAnnotationDeletionImpact = ({
  wordAnnotations,
  version,
  start,
  end,
  relationCountsByEndpointIdentity,
}: SelectionAnnotationDeletionImpactParams): SelectionAnnotationDeletionImpact => {
  const selection = normalizeWordSelectionRange(start, end)
  const annotationIds = findOverlappingWordAnnotationIds(wordAnnotations, version, selection)

  return annotationIds.reduce<SelectionAnnotationDeletionImpact>(
    (impact, annotationId) => {
      const annotation = wordAnnotations[annotationId]
      return {
        annotationCount: impact.annotationCount + 1,
        hasNote: impact.hasNote || Boolean(annotation.noteId),
        hasTags: impact.hasTags || Object.keys(annotation.tags || {}).length > 0,
        hasRelations:
          impact.hasRelations ||
          (relationCountsByEndpointIdentity[`annotation:${annotationId}`] || 0) > 0,
      }
    },
    { annotationCount: 0, hasNote: false, hasTags: false, hasRelations: false }
  )
}
