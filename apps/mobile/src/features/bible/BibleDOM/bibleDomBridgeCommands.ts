import type { Bookmark, StudyNavigateBibleType, Verse } from '~common/types'
import type { CanonicalBibleNote } from '~helpers/canonicalBibleNotes'
import { createStrongSelection, type StrongSelection } from '~helpers/strongSelection'
import type { RelationEndpoint } from '~features/studyRelations/domain'
import * as bridgeCommands from './dispatch'

export type StudyRelationsModalTarget =
  | string
  | {
      verseKey?: string
      verseIds?: string[]
      relationId?: string
      endpoint?: RelationEndpoint
    }

export type BibleDOMBridgeAction = {
  type: string
  payload?: unknown
  params?: {
    verse: Verse
    isSelectionMode?: StudyNavigateBibleType
  }
  bookCode?: string
  chapter?: string | number
  verse?: string | number
}

const bridgeCommandTypes = new Set<string>(
  Object.values(bridgeCommands).filter(value => typeof value === 'string') as string[]
)

export const decodeBibleDOMBridgeAction = (value: unknown): BibleDOMBridgeAction | undefined => {
  if (!isRecord(value) || typeof value.type !== 'string' || !bridgeCommandTypes.has(value.type)) {
    return undefined
  }
  if (
    value.chapter !== undefined &&
    typeof value.chapter !== 'string' &&
    typeof value.chapter !== 'number'
  ) {
    return undefined
  }
  if (
    value.verse !== undefined &&
    typeof value.verse !== 'string' &&
    typeof value.verse !== 'number'
  ) {
    return undefined
  }
  return value as unknown as BibleDOMBridgeAction
}

export const routeBibleDOMBridgeAction = async (
  value: unknown,
  options: {
    personalBibleDataEnabled: boolean
    handle(action: BibleDOMBridgeAction): Promise<void>
    rejected?(value: unknown): void
  }
): Promise<'handled' | 'blocked' | 'rejected'> => {
  const action = decodeBibleDOMBridgeAction(value)
  if (!action) {
    options.rejected?.(value)
    return 'rejected'
  }
  if (!options.personalBibleDataEnabled && bridgeCommands.isPersonalBibleDataAction(action.type)) {
    return 'blocked'
  }
  await options.handle(action)
  return 'handled'
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export const getStringPayload = (payload: unknown): string | undefined =>
  typeof payload === 'string' ? payload : undefined

export const getNumberPayload = (payload: unknown): number | undefined =>
  typeof payload === 'number' ? payload : undefined

export const getStrongRelationSelectionPayload = (
  payload: unknown,
  version: string
): StrongSelection | undefined => {
  if (
    !isRecord(payload) ||
    payload.type !== 'strong' ||
    typeof payload.code !== 'string' ||
    (payload.language !== 'hebrew' && payload.language !== 'greek')
  ) {
    return undefined
  }

  return createStrongSelection(
    [{ kind: 'strong', code: payload.code }],
    payload.language === 'hebrew' ? 1 : 40,
    version
  )
}

export const getToastPayload = (payload: unknown): { message?: string; type?: string } => {
  if (!isRecord(payload)) return {}
  return {
    message: getStringPayload(payload.message),
    type: getStringPayload(payload.type),
  }
}

export const getVerseIdsPayload = (payload: unknown): string[] => {
  if (!isRecord(payload) || !Array.isArray(payload.verseIds)) return []
  return payload.verseIds.filter((verseId): verseId is string => typeof verseId === 'string')
}

export const getStudyRelationsModalTarget = (
  payload: unknown
): StudyRelationsModalTarget | undefined => {
  if (typeof payload === 'string') return payload
  if (!isRecord(payload)) return undefined

  const verseKey = getStringPayload(payload.verseKey)
  const relationId = getStringPayload(payload.relationId)
  const verseIds = getVerseIdsPayload(payload)
  const endpoint = isRecord(payload.endpoint)
    ? (payload.endpoint as unknown as RelationEndpoint)
    : undefined

  if (!verseKey && !verseIds.length && !endpoint) return undefined

  return {
    verseKey,
    relationId,
    verseIds,
    endpoint,
  }
}

export const getNoteNavigationPayload = (
  payload: unknown
): { noteId?: string; verseIds: string[] } => {
  if (typeof payload === 'string') {
    return { noteId: payload, verseIds: [] }
  }
  if (!isRecord(payload)) {
    return { verseIds: [] }
  }
  return {
    noteId: getStringPayload(payload.noteId),
    verseIds: getVerseIdsPayload(payload),
  }
}

export const getBookmarkPayload = (payload: unknown): Bookmark | undefined =>
  isRecord(payload) ? (payload as unknown as Bookmark) : undefined

export const getCanonicalBibleNotePayload = (payload: unknown): CanonicalBibleNote | undefined => {
  if (
    !isRecord(payload) ||
    typeof payload.offset !== 'number' ||
    typeof payload.order !== 'number' ||
    payload.kind !== 'note' ||
    typeof payload.markup !== 'string'
  ) {
    return undefined
  }

  return {
    offset: payload.offset,
    order: payload.order,
    kind: 'note',
    markup: payload.markup,
  }
}
