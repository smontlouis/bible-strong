import { parseStudyWidget, type StudyWidget } from './widgets'
export {
  parseStudyWidget,
  widgetMemoryText,
  parsePassageTarget,
  type StudyWidget,
  type PassageWidget,
  type LexicalWidget,
  type SourceGroupWidget,
  type NaveWidget,
  type EntityWidget,
  type TimelineWidget,
  type BookWidget,
  type ReadingWidget,
  type FurtherResourcesWidget,
  type ResourceSuggestion,
  type PassageTarget,
} from './widgets'
import { parseStudySource, type StudySource } from './sources'
export { parseStudySource, sourceLink, sourceIdFromLink, type StudySource } from './sources'
export const STREAM_VERSION = 1
export type HistoryMessage = { role: 'user' | 'assistant'; content: string }
export type StudyRequest = {
  question: string
  appLanguage?: 'fr' | 'en'
  /** Legacy combined preference, retained for older clients. */
  bibleVersion?: string
  defaultBibleVersion?: string
  defaultStrongBibleVersion?: string
  readingBibleVersion?: string
  history: HistoryMessage[]
  readingContext: string
  memorySummary?: string
}
export type ToolActivity = {
  callId: string
  name: string
  request: string
  result: string
  state: 'running' | 'complete' | 'error' | 'interrupted'
}
export type RoutingDecision = {
  sequence: number
  selectedFamilies: string[]
  allowedTools: string[]
  phase: 'initial' | 'expansion'
}
export type StudyEvent =
  | { type: 'widget'; widget: StudyWidget }
  | { type: 'source'; source: StudySource }
  | ({ type: 'routing' } & RoutingDecision)
  | ({ type: 'tool' } & ToolActivity)
  | { type: 'status'; message: string }
  | { type: 'delta'; text: string }
  | { type: 'reset' }
  | { type: 'done'; requestId: string; model: string; modelCalls: number; toolCalls: number }
  | { type: 'error'; code: string }

export function parseStudyRequest(value: unknown): StudyRequest {
  if (!value || typeof value !== 'object') throw new Error('INVALID_REQUEST')
  const input = value as Record<string, unknown>
  if (
    Object.keys(input).some(
      key =>
        ![
          'question',
          'history',
          'readingContext',
          'memorySummary',
          'appLanguage',
          'bibleVersion',
          'defaultBibleVersion',
          'defaultStrongBibleVersion',
          'readingBibleVersion',
        ].includes(key)
    )
  )
    throw new Error('INVALID_REQUEST')
  if (typeof input.question !== 'string' || !input.question.trim() || input.question.length > 4000)
    throw new Error('INVALID_REQUEST')
  if (input.appLanguage !== undefined && !['fr', 'en'].includes(String(input.appLanguage)))
    throw new Error('INVALID_LANGUAGE')
  for (const field of [
    'bibleVersion',
    'defaultBibleVersion',
    'defaultStrongBibleVersion',
    'readingBibleVersion',
  ]) {
    const value = input[field]
    if (value !== undefined && (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(value)))
      throw new Error('INVALID_VERSION')
  }
  const context = input.readingContext ?? ''
  if (typeof context !== 'string' || context.length > 13000) throw new Error('INVALID_REQUEST')
  const summary = input.memorySummary ?? ''
  if (typeof summary !== 'string' || summary.length > 3000) throw new Error('INVALID_MEMORY')
  const history = parseHistory(input.history, 32000 - summary.length)
  return {
    question: input.question.trim(),
    ...(input.appLanguage ? { appLanguage: input.appLanguage as 'fr' | 'en' } : {}),
    ...(input.bibleVersion ? { bibleVersion: input.bibleVersion as string } : {}),
    ...(input.defaultBibleVersion
      ? { defaultBibleVersion: input.defaultBibleVersion as string }
      : {}),
    ...(input.defaultStrongBibleVersion
      ? { defaultStrongBibleVersion: input.defaultStrongBibleVersion as string }
      : {}),
    ...(input.readingBibleVersion
      ? { readingBibleVersion: input.readingBibleVersion as string }
      : {}),
    history,
    readingContext: context,
    memorySummary: summary,
  }
}
export function parseHistory(value: unknown = [], maxCharacters = 32000): HistoryMessage[] {
  if (!Array.isArray(value) || value.length > 300 || value.length % 2)
    throw new Error('INVALID_HISTORY')
  let size = 0
  const messages = value.map((item: unknown, index): HistoryMessage => {
    if (!item || typeof item !== 'object') throw new Error('INVALID_HISTORY')
    const message = item as Record<string, unknown>
    if (
      Object.keys(message).some(k => !['role', 'content'].includes(k)) ||
      message.role !== (index % 2 ? 'assistant' : 'user') ||
      typeof message.content !== 'string' ||
      !message.content.trim() ||
      message.content.length > (index % 2 ? 60000 : 5000)
    )
      throw new Error('INVALID_HISTORY')
    size += message.content.length
    return { role: index % 2 ? 'assistant' : 'user', content: message.content }
  })
  if (size > maxCharacters) throw new Error('INVALID_HISTORY')
  return messages
}

export function parseStudyEvent(value: unknown): StudyEvent {
  if (!value || typeof value !== 'object') throw new Error('INVALID_STREAM')
  const event = value as Record<string, unknown>
  if (event.type === 'tool') return { type: 'tool', ...parseToolActivity(event) }
  if (event.type === 'routing') return { type: 'routing', ...parseRoutingDecision(event) }
  if (event.type === 'source') return { type: 'source', source: parseStudySource(event.source) }
  if (event.type === 'widget') return { type: 'widget', widget: parseStudyWidget(event.widget) }
  if (event.type === 'reset') return { type: 'reset' }
  if (event.type === 'delta' && typeof event.text === 'string')
    return { type: 'delta', text: event.text }
  if (event.type === 'status' && typeof event.message === 'string')
    return { type: 'status', message: event.message }
  if (event.type === 'error' && typeof event.code === 'string')
    return { type: 'error', code: event.code }
  if (
    event.type === 'done' &&
    typeof event.requestId === 'string' &&
    typeof event.model === 'string' &&
    typeof event.modelCalls === 'number' &&
    typeof event.toolCalls === 'number'
  )
    return {
      type: 'done',
      requestId: event.requestId,
      model: event.model,
      modelCalls: event.modelCalls,
      toolCalls: event.toolCalls,
    }
  throw new Error('INVALID_STREAM')
}

export function parseToolActivity(value: unknown): ToolActivity {
  if (!value || typeof value !== 'object') throw new Error('INVALID_TOOL_EVENT')
  const v = value as Record<string, unknown>
  const fields = { callId: 200, name: 100, request: 2000, result: 3000 }
  if (
    Object.keys(fields).some(
      key => typeof v[key] !== 'string' || v[key].length > fields[key as keyof typeof fields]
    )
  )
    throw new Error('INVALID_TOOL_EVENT')
  if (!['running', 'complete', 'error', 'interrupted'].includes(String(v.state)))
    throw new Error('INVALID_TOOL_EVENT')
  return {
    callId: v.callId as string,
    name: v.name as string,
    request: v.request as string,
    result: v.result as string,
    state: v.state as ToolActivity['state'],
  }
}

export function parseRoutingDecision(value: unknown): RoutingDecision {
  if (!value || typeof value !== 'object') throw new Error('INVALID_ROUTING_EVENT')
  const v = value as Record<string, unknown>
  const names = (items: unknown, max: number): items is string[] =>
    Array.isArray(items) &&
    items.length <= max &&
    items.every(item => typeof item === 'string' && /^[a-z][a-z0-9_]{0,79}$/.test(item))
  if (
    !Number.isInteger(v.sequence) ||
    Number(v.sequence) < 1 ||
    Number(v.sequence) > 3 ||
    !names(v.selectedFamilies, 8) ||
    !names(v.allowedTools, 20) ||
    !['initial', 'expansion'].includes(String(v.phase))
  )
    throw new Error('INVALID_ROUTING_EVENT')
  return {
    sequence: Number(v.sequence),
    selectedFamilies: v.selectedFamilies,
    allowedTools: v.allowedTools,
    phase: v.phase as RoutingDecision['phase'],
  }
}
