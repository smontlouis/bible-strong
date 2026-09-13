import { parseCommentaryProjectionId } from './commentarySelection'
import { COMMENTARY_CATALOG_BY_ID } from '@bible-strong/resource-catalog/commentaries'

/** Associated writings remain available in Resources, but not in inline Bible reading. */
export function isInlineCommentaryEligible(id: string): boolean {
  const projection = parseCommentaryProjectionId(id)
  return !!projection && projection.resourceId !== 'egw-writings'
}

/** Inline reading is an opt-in subset, never a second independent catalog selection. */
export function normalizeInlineCommentaries(value: unknown, selected: readonly string[]): string[] {
  if (!Array.isArray(value)) return []
  const enabled = new Set(
    value.filter(
      (item): item is string => typeof item === 'string' && isInlineCommentaryEligible(item)
    )
  )
  return [...new Set(selected)].filter(item => enabled.has(item)).slice(0, 5)
}

/** Selection IDs are UI identities; the delivery API uses publication identities (e.g. MHY). */
export function getInlineCommentaryResources(
  value: unknown,
  selected: readonly string[],
  enabled = true
) {
  if (!enabled) return []
  return normalizeInlineCommentaries(value, selected).flatMap(id => {
    const projection = parseCommentaryProjectionId(id)
    const entry = projection ? COMMENTARY_CATALOG_BY_ID.get(projection.resourceId) : undefined
    return entry && projection
      ? [{ resourceId: entry.publicationId, language: projection.language }]
      : []
  })
}
