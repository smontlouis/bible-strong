import { appLogger } from '~helpers/agentObservability'
import { applyReadingIntent, decodeReadingIntent, getReadingRefusal } from './reading'
import type { ReaderIntent, ReaderOutcome } from './types'
import type { Reader, ReaderWorld } from './world'

export type {
  ReaderIntent,
  ReaderIntentHandler,
  ReaderIntentMessage,
  ReaderOutcome,
  ReaderRule,
} from './types'
export type { Reader, ReaderPresentation, ReaderSnapshot, ReaderWorld } from './world'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const decodeMessage = (message: unknown): { tabId: string; intent: ReaderIntent } | undefined => {
  if (!isRecord(message) || typeof message.tabId !== 'string' || !message.tabId) return undefined
  const intent = decodeReadingIntent(message.intent)
  return intent ? { tabId: message.tabId, intent } : undefined
}

const getKind = (message: unknown) =>
  isRecord(message) && isRecord(message.intent) && typeof message.intent.kind === 'string'
    ? message.intent.kind
    : undefined

/**
 * The only way in for what the Bible reader page asks (ADR-0098). It decodes the message once,
 * refuses an intent sent for another Tab, applies the rules before any effect, and never throws.
 */
export const handleReaderIntent = async (
  message: unknown,
  reader: Reader,
  world: ReaderWorld
): Promise<ReaderOutcome> => {
  const decoded = decodeMessage(message)
  if (!decoded) {
    appLogger.captureError(
      'webview',
      'reader_intent.rejected',
      new Error('READER_INTENT_REJECTED'),
      { kind: getKind(message) }
    )
    return { status: 'rejected' }
  }

  const { tabId, intent } = decoded
  try {
    const snapshot = reader.now()
    if (tabId !== snapshot.tabId) {
      appLogger.info('webview', 'reader_intent.stale_tab', { kind: intent.kind })
      return { status: 'refused', rule: 'stale-tab' }
    }

    const rule = getReadingRefusal(intent, { snapshot, world })
    if (rule) {
      appLogger.debug('webview', 'reader_intent.refused', { kind: intent.kind, rule })
      return { status: 'refused', rule }
    }

    await applyReadingIntent(intent, { reader, snapshot, world })
    appLogger.debug('webview', 'reader_intent.done', { kind: intent.kind })
    return { status: 'done' }
  } catch (error) {
    appLogger.captureError('webview', 'reader_intent.failed', error, { kind: intent.kind })
    return { status: 'failed' }
  }
}
