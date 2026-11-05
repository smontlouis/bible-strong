import { appLogger } from '~helpers/agentObservability'
import { applyOpenIntent, decodeOpenIntent, getOpenRefusal } from './open'
import { applyReadingIntent, decodeReadingIntent, getReadingRefusal } from './reading'
import type { ReaderIntent, ReaderOutcome, ReaderRule } from './types'
import type { Reader, ReaderSnapshot, ReaderWorld } from './world'

export type {
  OpenIntent,
  OpenOrigin,
  OpenTarget,
  ReaderIntent,
  ReaderIntentHandler,
  ReaderIntentMessage,
  ReaderOutcome,
  ReaderRule,
} from './types'
export type {
  Reader,
  ReaderNotice,
  ReaderPresentation,
  ReaderRoute,
  ReaderSnapshot,
  ReaderWorld,
} from './world'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const decodeIntent = (value: unknown): ReaderIntent | undefined =>
  decodeReadingIntent(value) ?? decodeOpenIntent(value)

const decodeMessage = (message: unknown): { tabId: string; intent: ReaderIntent } | undefined => {
  if (!isRecord(message) || typeof message.tabId !== 'string' || !message.tabId) return undefined
  const intent = decodeIntent(message.intent)
  return intent ? { tabId: message.tabId, intent } : undefined
}

const getRefusal = (
  intent: ReaderIntent,
  context: { snapshot: ReaderSnapshot; world: ReaderWorld }
): ReaderRule | undefined =>
  intent.kind === 'open' ? getOpenRefusal(intent, context) : getReadingRefusal(intent, context)

const applyIntent = (
  intent: ReaderIntent,
  context: { reader: Reader; snapshot: ReaderSnapshot; world: ReaderWorld }
) =>
  intent.kind === 'open' ? applyOpenIntent(intent, context) : applyReadingIntent(intent, context)

const getKind = (message: unknown) =>
  isRecord(message) && isRecord(message.intent) && typeof message.intent.kind === 'string'
    ? message.intent.kind
    : undefined

/** What the logs say of an intent: its kind, and for an open what it opens and from where. */
const describeIntent = (intent: ReaderIntent) =>
  intent.kind === 'open'
    ? { kind: intent.kind, target: intent.target.kind, origin: intent.origin }
    : { kind: intent.kind }

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
      appLogger.info('webview', 'reader_intent.stale_tab', describeIntent(intent))
      return { status: 'refused', rule: 'stale-tab' }
    }

    const rule = getRefusal(intent, { snapshot, world })
    if (rule) {
      appLogger.debug('webview', 'reader_intent.refused', { ...describeIntent(intent), rule })
      return { status: 'refused', rule }
    }

    await applyIntent(intent, { reader, snapshot, world })
    appLogger.debug('webview', 'reader_intent.done', describeIntent(intent))
    return { status: 'done' }
  } catch (error) {
    appLogger.captureError('webview', 'reader_intent.failed', error, describeIntent(intent))
    return { status: 'failed' }
  }
}
