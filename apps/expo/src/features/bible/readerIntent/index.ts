import { appLogger } from '~helpers/agentObservability'
import { applyAnnotateIntent, decodeAnnotateIntent, getAnnotateRefusal } from './annotate'
import { applyOpenIntent, decodeOpenIntent, getOpenRefusal } from './open'
import { applyReadingIntent, decodeReadingIntent, getReadingRefusal } from './reading'
import { applySelectIntent, decodeSelectIntent, getSelectRefusal } from './select'
import type { ReaderIntent, ReaderOutcome, ReaderRule } from './types'
import type { Reader, ReaderSnapshot, ReaderWorld } from './world'

export type {
  AnnotateIntent,
  OpenIntent,
  OpenOrigin,
  OpenTarget,
  ReaderIntent,
  ReaderIntentHandler,
  ReaderIntentMessage,
  ReaderOutcome,
  ReaderRule,
  SelectIntent,
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
  decodeReadingIntent(value) ??
  decodeOpenIntent(value) ??
  decodeSelectIntent(value) ??
  decodeAnnotateIntent(value)

const decodeMessage = (message: unknown): { tabId: string; intent: ReaderIntent } | undefined => {
  if (!isRecord(message) || typeof message.tabId !== 'string' || !message.tabId) return undefined
  const intent = decodeIntent(message.intent)
  return intent ? { tabId: message.tabId, intent } : undefined
}

const getRefusal = (
  intent: ReaderIntent,
  context: { snapshot: ReaderSnapshot; world: ReaderWorld }
): ReaderRule | undefined => {
  switch (intent.kind) {
    case 'open':
      return getOpenRefusal(intent, context)
    case 'toggle-selected-verse':
    case 'clear-selected-verses':
      return getSelectRefusal(intent, context)
    case 'enter-annotation-mode':
    case 'exit-annotation-mode':
    case 'change-word-selection':
    case 'create-word-annotation':
    case 'erase-word-annotations':
    case 'select-word-annotation':
      return getAnnotateRefusal(intent, context)
    default:
      return getReadingRefusal(intent, context)
  }
}

const applyIntent = (
  intent: ReaderIntent,
  context: { reader: Reader; snapshot: ReaderSnapshot; world: ReaderWorld }
) => {
  switch (intent.kind) {
    case 'open':
      return applyOpenIntent(intent, context)
    case 'toggle-selected-verse':
    case 'clear-selected-verses':
      return applySelectIntent(intent, context)
    case 'enter-annotation-mode':
    case 'exit-annotation-mode':
    case 'change-word-selection':
    case 'create-word-annotation':
    case 'erase-word-annotations':
    case 'select-word-annotation':
      return applyAnnotateIntent(intent, context)
    default:
      return applyReadingIntent(intent, context)
  }
}

const getKind = (message: unknown) =>
  isRecord(message) && isRecord(message.intent) && typeof message.intent.kind === 'string'
    ? message.intent.kind
    : undefined

/**
 * What the logs say of an intent: its kind, for an open what it opens and from where, for a verse
 * selected or words annotated the version they were touched in.
 */
const describeIntent = (intent: ReaderIntent) => {
  switch (intent.kind) {
    case 'open':
      return { kind: intent.kind, target: intent.target.kind, origin: intent.origin }
    case 'toggle-selected-verse':
    case 'enter-annotation-mode':
    case 'create-word-annotation':
    case 'erase-word-annotations':
      return { kind: intent.kind, version: intent.version }
    default:
      return { kind: intent.kind }
  }
}

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
