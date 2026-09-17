export const STREAM_VERSION = 1
export type HistoryMessage = { role: 'user' | 'assistant'; content: string }
export type StudyRequest = {
  question: string
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
export type StudyEvent =
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
      key => !['question', 'history', 'readingContext', 'memorySummary'].includes(key)
    )
  )
    throw new Error('INVALID_REQUEST')
  if (typeof input.question !== 'string' || !input.question.trim() || input.question.length > 4000)
    throw new Error('INVALID_REQUEST')
  const context = input.readingContext ?? ''
  if (typeof context !== 'string' || context.length > 13000) throw new Error('INVALID_REQUEST')
  const summary = input.memorySummary ?? ''
  if (typeof summary !== 'string' || summary.length > 3000) throw new Error('INVALID_MEMORY')
  const history = parseHistory(input.history, 32000 - summary.length)
  return {
    question: input.question.trim(),
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
