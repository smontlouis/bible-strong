import { parsePublicTabAction, type PublicOpenTabAction } from './publicTabActions'
export {
  PUBLIC_TAB_TARGET_SCHEMAS,
  type PublicOpenTabAction,
  type PublicTabType,
} from './publicTabActions'
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
export const CLIENT_CAPABILITIES = ['open_tab', 'open_public_tab'] as const
export type ClientCapability = (typeof CLIENT_CAPABILITIES)[number]
export const STUDY_SURFACE_KINDS = [
  'passage',
  'word',
  'commentary',
  'dictionary',
  'nave',
  'plan',
  'meditation',
  'entity',
  'person',
  'place',
  'timeline',
] as const
export type StudySurfaceContext = {
  kind: (typeof STUDY_SURFACE_KINDS)[number]
  resourceId?: string
  language?: 'fr' | 'en'
  book?: number
  chapter?: number
  startVerse?: number
  endVerse?: number
  sectionId?: string
  work?: string
  entryId?: number
  normalizedName?: string
  bibleVersion?: string
  reference?: string
}
export type StudyRequest = {
  question: string
  clientCapabilities?: ClientCapability[]
  appLanguage?: 'fr' | 'en'
  /** Legacy combined preference, retained for older clients. */
  bibleVersion?: string
  defaultBibleVersion?: string
  defaultStrongBibleVersion?: string
  readingBibleVersion?: string
  history: HistoryMessage[]
  readingContext: string
  activeContext?: StudySurfaceContext
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
export type PassageTabTarget = {
  kind: 'passage'
  book: number
  chapter: number
  startVerse: number
  endVerse: number
  version: string
  isWholeChapter?: boolean
}
export type PassageOpenTabAction = {
  id: string
  kind: 'open_tab'
  tabType: 'bible' | 'compare'
  target: PassageTabTarget
}
export type OpenTabAction = PassageOpenTabAction | PublicOpenTabAction
export type AssistantAction = OpenTabAction
export type StudyEvent =
  | { type: 'widget'; widget: StudyWidget }
  | { type: 'source'; source: StudySource }
  | { type: 'action'; action: AssistantAction }
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
          'clientCapabilities',
          'history',
          'readingContext',
          'activeContext',
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
  const clientCapabilities = parseClientCapabilities(input.clientCapabilities)
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
  const activeContext = parseStudySurfaceContext(input.activeContext)
  const summary = input.memorySummary ?? ''
  if (typeof summary !== 'string' || summary.length > 3000) throw new Error('INVALID_MEMORY')
  const history = parseHistory(input.history, 32000 - summary.length)
  return {
    question: input.question.trim(),
    ...(clientCapabilities.length ? { clientCapabilities } : {}),
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
    ...(activeContext ? { activeContext } : {}),
    memorySummary: summary,
  }
}
function parseClientCapabilities(value: unknown): ClientCapability[] {
  if (value === undefined) return []
  if (
    !Array.isArray(value) ||
    value.length > CLIENT_CAPABILITIES.length ||
    new Set(value).size !== value.length ||
    value.some(item => !CLIENT_CAPABILITIES.includes(item as ClientCapability))
  )
    throw new Error('INVALID_CLIENT_CAPABILITIES')
  return value as ClientCapability[]
}
export function parseStudySurfaceContext(value: unknown): StudySurfaceContext | undefined {
  if (value === undefined) return undefined
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('INVALID_ACTIVE_CONTEXT')
  const input = value as Record<string, unknown>
  const allowed = [
    'kind',
    'resourceId',
    'language',
    'book',
    'chapter',
    'startVerse',
    'endVerse',
    'sectionId',
    'work',
    'entryId',
    'normalizedName',
    'bibleVersion',
    'reference',
  ]
  if (
    Object.keys(input).some(key => !allowed.includes(key)) ||
    !STUDY_SURFACE_KINDS.includes(input.kind as StudySurfaceContext['kind'])
  )
    throw new Error('INVALID_ACTIVE_CONTEXT')
  const bounded = (key: string, pattern: RegExp, max = 200) => {
    const field = input[key]
    if (
      field !== undefined &&
      (typeof field !== 'string' || field.length > max || !pattern.test(field))
    )
      throw new Error('INVALID_ACTIVE_CONTEXT')
  }
  bounded('resourceId', /^[A-Za-z0-9][A-Za-z0-9-]{1,63}$/u, 64)
  bounded('sectionId', /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u)
  bounded('work', /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/u, 80)
  bounded('normalizedName', /^[^\\/\u0000-\u001f]{1,200}$/u)
  bounded('bibleVersion', /^[A-Za-z0-9_-]{1,40}$/u, 40)
  bounded('reference', /^(?:[GH]\d{1,5}[A-Za-z]{0,4}|[^\u0000-\u001f]{1,200})$/u)
  if (input.language !== undefined && !['fr', 'en'].includes(String(input.language)))
    throw new Error('INVALID_ACTIVE_CONTEXT')
  for (const [key, max] of [
    ['book', 66],
    ['chapter', 150],
    ['entryId', 10_000_000],
  ] as const) {
    const field = input[key]
    if (
      field !== undefined &&
      (!Number.isInteger(field) || Number(field) < 1 || Number(field) > max)
    )
      throw new Error('INVALID_ACTIVE_CONTEXT')
  }
  for (const key of ['startVerse', 'endVerse'] as const) {
    const field = input[key]
    if (
      field !== undefined &&
      (!Number.isInteger(field) || Number(field) < 0 || Number(field) > 176)
    )
      throw new Error('INVALID_ACTIVE_CONTEXT')
  }
  if (
    input.startVerse !== undefined &&
    input.endVerse !== undefined &&
    Number(input.endVerse) < Number(input.startVerse)
  )
    throw new Error('INVALID_ACTIVE_CONTEXT')
  return Object.fromEntries(
    Object.entries(input).filter(([, field]) => field !== undefined)
  ) as StudySurfaceContext
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
  if (event.type === 'action') return { type: 'action', action: parseAssistantAction(event.action) }
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

export function parseAssistantAction(value: unknown): AssistantAction {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_ACTION')
  const action = value as Record<string, unknown>
  if (
    Object.keys(action).some(key => !['id', 'kind', 'tabType', 'target'].includes(key)) ||
    typeof action.id !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/u.test(action.id) ||
    action.kind !== 'open_tab'
  )
    throw new Error('INVALID_ACTION')
  if (action.tabType !== 'bible' && action.tabType !== 'compare')
    return parsePublicTabAction(action.id, action.tabType, action.target)
  return {
    id: action.id,
    kind: 'open_tab',
    tabType: action.tabType,
    target: parsePassageTabTarget(action.target),
  }
}

function parsePassageTabTarget(value: unknown): PassageTabTarget {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_ACTION')
  const target = value as Record<string, unknown>
  if (
    Object.keys(target).some(
      key =>
        ![
          'kind',
          'book',
          'chapter',
          'startVerse',
          'endVerse',
          'version',
          'isWholeChapter',
        ].includes(key)
    ) ||
    target.kind !== 'passage' ||
    !Number.isInteger(target.book) ||
    Number(target.book) < 1 ||
    Number(target.book) > 77 ||
    !Number.isInteger(target.chapter) ||
    Number(target.chapter) < 1 ||
    Number(target.chapter) > 150 ||
    !Number.isInteger(target.startVerse) ||
    Number(target.startVerse) < 1 ||
    Number(target.startVerse) > 176 ||
    !Number.isInteger(target.endVerse) ||
    Number(target.endVerse) < Number(target.startVerse) ||
    Number(target.endVerse) > 176 ||
    typeof target.version !== 'string' ||
    !/^[A-Za-z0-9_-]{1,40}$/u.test(target.version) ||
    (target.isWholeChapter !== undefined && typeof target.isWholeChapter !== 'boolean')
  )
    throw new Error('INVALID_ACTION')
  return {
    kind: 'passage',
    book: Number(target.book),
    chapter: Number(target.chapter),
    startVerse: Number(target.startVerse),
    endVerse: Number(target.endVerse),
    version: target.version,
    ...(target.isWholeChapter !== undefined
      ? { isWholeChapter: target.isWholeChapter as boolean }
      : {}),
  }
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
