import * as bridgeCommands from './dispatch'

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
    handle(action: BibleDOMBridgeAction): Promise<void>
    rejected?(value: unknown): void
  }
): Promise<'handled' | 'rejected'> => {
  const action = decodeBibleDOMBridgeAction(value)
  if (!action) {
    options.rejected?.(value)
    return 'rejected'
  }
  await options.handle(action)
  return 'handled'
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export const getStringPayload = (payload: unknown): string | undefined =>
  typeof payload === 'string' ? payload : undefined

export const getToastPayload = (payload: unknown): { message?: string; type?: string } => {
  if (!isRecord(payload)) return {}
  return {
    message: getStringPayload(payload.message),
    type: getStringPayload(payload.type),
  }
}
