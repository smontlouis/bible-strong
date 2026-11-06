import type { Bookmark } from '~common/types'
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
}

const bridgeCommandTypes = new Set<string>(
  Object.values(bridgeCommands).filter(value => typeof value === 'string') as string[]
)

export const decodeBibleDOMBridgeAction = (value: unknown): BibleDOMBridgeAction | undefined => {
  if (!isRecord(value) || typeof value.type !== 'string' || !bridgeCommandTypes.has(value.type)) {
    return undefined
  }
  return value as unknown as BibleDOMBridgeAction
}

export const routeBibleDOMBridgeAction = async (
  value: unknown,
  options: {
    personalBibleDataEnabled: boolean
    /** Versions shown only in interlinear presentations: they hold no personal Bible data. */
    interlinearReadingVersions?: readonly string[]
    handle(action: BibleDOMBridgeAction): Promise<void>
    rejected?(value: unknown): void
  }
): Promise<'handled' | 'blocked' | 'rejected'> => {
  const action = decodeBibleDOMBridgeAction(value)
  if (!action) {
    options.rejected?.(value)
    return 'rejected'
  }
  if (bridgeCommands.isPersonalBibleDataAction(action.type)) {
    const actionVersion = getPayloadVersion(action.payload)
    if (
      !options.personalBibleDataEnabled ||
      (actionVersion && options.interlinearReadingVersions?.includes(actionVersion))
    ) {
      return 'blocked'
    }
  }
  await options.handle(action)
  return 'handled'
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export const getStringPayload = (payload: unknown): string | undefined =>
  typeof payload === 'string' ? payload : undefined

/** The version an annotation-mode payload refers to, when the reader names one. */
export const getPayloadVersion = (payload: unknown): string | undefined =>
  isRecord(payload) ? getStringPayload(payload.version) : undefined

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

export const getBookmarkPayload = (payload: unknown): Bookmark | undefined =>
  isRecord(payload) ? (payload as unknown as Bookmark) : undefined
