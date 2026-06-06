import type { Bookmark, StudyNavigateBibleType, Verse } from '~common/types'

export type StudyRelationsModalTarget =
  | string
  | {
      verseKey?: string
      verseIds?: string[]
      relationId?: string
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

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export const getStringPayload = (payload: unknown): string | undefined =>
  typeof payload === 'string' ? payload : undefined

export const getNumberPayload = (payload: unknown): number | undefined =>
  typeof payload === 'number' ? payload : undefined

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

  if (!verseKey && !verseIds.length) return undefined

  return {
    verseKey,
    relationId,
    verseIds,
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
