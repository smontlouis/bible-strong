import { COMMENTARY_CATALOG_BY_ID } from '@bible-strong/resource-catalog/commentaries'

import type { ResourceLanguage } from '~helpers/databaseTypes'
import { getLanguage } from '~i18n'

export const MAX_SELECTED_COMMENTARIES = 5
export const LEGACY_COMMENTARY_SELECTION_STORAGE_KEY = 'commentarySelection.v1'

export type CommentaryProjectionId = `${string}:${ResourceLanguage}`
export type CommentarySelectionState = CommentaryProjectionId[]

export const DEFAULT_COMMENTARY_SELECTIONS: Record<ResourceLanguage, CommentarySelectionState> = {
  fr: ['barnes:fr', 'acbc:fr', 'mhy-fr:fr'],
  en: ['barnes:en', 'acbc:en', 'mhcc:en'],
}

export const createCommentaryProjectionId = (
  resourceId: string,
  language: ResourceLanguage
): CommentaryProjectionId => `${resourceId}:${language}`

export const parseCommentaryProjectionId = (
  value: string
): {
  resourceId: string
  language: ResourceLanguage
  projectionId: CommentaryProjectionId
} | null => {
  const separator = value.lastIndexOf(':')
  if (separator <= 0) return null
  const resourceId = value.slice(0, separator)
  const language = value.slice(separator + 1)
  if (language !== 'fr' && language !== 'en') return null
  const entry = COMMENTARY_CATALOG_BY_ID.get(resourceId)
  if (!entry?.languages.includes(language)) return null
  return { resourceId, language, projectionId: value as CommentaryProjectionId }
}

export const getDefaultCommentarySelection = (
  language: ResourceLanguage = getLanguage()
): CommentarySelectionState => [...DEFAULT_COMMENTARY_SELECTIONS[language]]

export const normalizeCommentarySelection = (value: unknown): CommentarySelectionState => {
  if (!Array.isArray(value)) return getDefaultCommentarySelection()
  const result: CommentarySelectionState = []
  for (const candidate of value) {
    if (typeof candidate !== 'string' || result.includes(candidate as CommentaryProjectionId)) {
      continue
    }
    const projection = parseCommentaryProjectionId(candidate)
    if (!projection) continue
    result.push(projection.projectionId)
    if (result.length === MAX_SELECTED_COMMENTARIES) break
  }
  return result
}

export const migrateCommentarySelectionState = (value: unknown): CommentarySelectionState => {
  if (Array.isArray(value)) return normalizeCommentarySelection(value)

  // v1 stored one independent list per language. Preserve the list matching the
  // current interface language when collapsing it into the single mixed list.
  const legacy = value && typeof value === 'object' ? (value as Record<string, unknown>) : null
  const language = getLanguage()
  const legacySelection = legacy?.[language]
  if (!Array.isArray(legacySelection)) return getDefaultCommentarySelection(language)
  return normalizeCommentarySelection(
    legacySelection.map(resourceId =>
      typeof resourceId === 'string'
        ? createCommentaryProjectionId(resourceId, language)
        : resourceId
    )
  )
}

export const toggleCommentarySelection = (
  selected: readonly CommentaryProjectionId[],
  projectionId: CommentaryProjectionId
): { selected: CommentarySelectionState; limitReached: boolean } => {
  if (selected.includes(projectionId)) {
    return { selected: selected.filter(id => id !== projectionId), limitReached: false }
  }
  if (selected.length >= MAX_SELECTED_COMMENTARIES) {
    return { selected: [...selected], limitReached: true }
  }
  return { selected: [...selected, projectionId], limitReached: false }
}

export const reorderCommentarySelection = (
  selected: readonly CommentaryProjectionId[],
  fromIndex: number,
  toIndex: number
): CommentarySelectionState => {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= selected.length ||
    toIndex >= selected.length
  ) {
    return [...selected]
  }
  const reordered = [...selected]
  const [moved] = reordered.splice(fromIndex, 1)
  reordered.splice(toIndex, 0, moved)
  return reordered
}

export const orderCommentarySelectionByPositions = (
  selected: readonly CommentaryProjectionId[],
  positions: Readonly<Record<string, number>>
): CommentarySelectionState =>
  [...selected].sort(
    (left, right) =>
      (positions[left] ?? Number.MAX_SAFE_INTEGER) - (positions[right] ?? Number.MAX_SAFE_INTEGER)
  )
