import {
  parseRoutingDecision,
  parseStudySource,
  parseStudySurfaceContext,
  parseStudyWidget,
  parseToolActivity,
  type RoutingDecision,
  type StudySource,
  type StudySurfaceContext,
  type StudyWidget,
  type ToolActivity,
} from '@bible-strong/ai-contract/contract'
import { validCheckpoint, type MemoryCheckpoint } from './conversationMemory'

export type ReadingContext = {
  bibleVersion?: string
  key: string
  label: string
  detail: string
  content?: string
  activeContext?: StudySurfaceContext
  kind:
    | 'passage'
    | 'word'
    | 'commentary'
    | 'dictionary'
    | 'nave'
    | 'plan'
    | 'meditation'
    | 'entity'
    | 'person'
    | 'place'
    | 'timeline'
}

export type LocalMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  state: 'complete' | 'streaming' | 'interrupted' | 'error'
  widgets?: StudyWidget[]
  sources?: StudySource[]
  routing?: RoutingDecision[]
  tools?: ToolActivity[]
  context?: ReadingContext
  createdAt: number
}

export type Conversation = {
  memory?: MemoryCheckpoint
  id: string
  title: string
  updatedAt: number
  messages: LocalMessage[]
  summaryMessageCount?: number
}

export type ConversationMetadata = Omit<Conversation, 'messages' | 'summaryMessageCount'> & {
  createdAt: number
  messageCount: number
  schemaVersion: 1
}

export type ConversationTurn = {
  schemaVersion: 1
  createdAt: number
  user: LocalMessage
  assistant: LocalMessage
}

export const MAX_CONVERSATIONS = 50
export const MAX_MESSAGES = 300

const isContext = (value: unknown): value is ReadingContext => {
  if (!value || typeof value !== 'object') return false
  const context = value as ReadingContext
  let validActiveContext = true
  try {
    parseStudySurfaceContext(context.activeContext)
  } catch {
    validActiveContext = false
  }
  return (
    validActiveContext &&
    (context.bibleVersion === undefined ||
      (typeof context.bibleVersion === 'string' &&
        /^[A-Za-z0-9_-]{1,40}$/.test(context.bibleVersion))) &&
    typeof context.key === 'string' &&
    context.key.length < 1000 &&
    typeof context.label === 'string' &&
    context.label.length <= 500 &&
    typeof context.detail === 'string' &&
    context.detail.length <= 500 &&
    (context.content === undefined ||
      (typeof context.content === 'string' && context.content.length <= 12000)) &&
    [
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
    ].includes(context.kind)
  )
}

export function parsePersistedMessage(value: unknown): LocalMessage {
  if (!value || typeof value !== 'object') throw new Error('CLOUD_HISTORY_INVALID')
  const message = value as LocalMessage
  if (
    typeof message.id !== 'string' ||
    message.id.length > 100 ||
    !['user', 'assistant'].includes(message.role) ||
    typeof message.text !== 'string' ||
    message.text.length > 60000 ||
    (message.role === 'user' && message.text.length > 5000) ||
    !Number.isFinite(message.createdAt) ||
    !['complete', 'streaming', 'interrupted', 'error'].includes(message.state) ||
    (message.context !== undefined && !isContext(message.context))
  )
    throw new Error('CLOUD_HISTORY_INVALID')
  if (message.tools !== undefined && (!Array.isArray(message.tools) || message.tools.length > 6))
    throw new Error('CLOUD_HISTORY_INVALID')
  if (
    message.routing !== undefined &&
    (!Array.isArray(message.routing) || message.routing.length > 3)
  )
    throw new Error('CLOUD_HISTORY_INVALID')
  if (
    message.sources !== undefined &&
    (!Array.isArray(message.sources) || message.sources.length > 6)
  )
    throw new Error('CLOUD_HISTORY_INVALID')
  if (
    message.widgets !== undefined &&
    (!Array.isArray(message.widgets) || message.widgets.length > 6)
  )
    throw new Error('CLOUD_HISTORY_INVALID')

  const widgets = message.widgets?.map(parseStudyWidget)
  const sources = message.sources?.map(parseStudySource)
  const routing = message.routing?.map(parseRoutingDecision)
  const tools = message.tools?.map(item => {
    const tool = parseToolActivity(item)
    return {
      ...tool,
      state: tool.state === 'running' ? ('interrupted' as const) : tool.state,
    }
  })
  return {
    ...(tools ? { tools } : {}),
    ...(routing ? { routing } : {}),
    ...(sources ? { sources } : {}),
    ...(widgets ? { widgets } : {}),
    id: message.id,
    role: message.role,
    text: message.text,
    state: message.state === 'streaming' ? 'interrupted' : message.state,
    createdAt: message.createdAt,
    ...(message.context ? { context: message.context } : {}),
  }
}

export function parseConversationMetadata(id: string, value: unknown): ConversationMetadata {
  if (!value || typeof value !== 'object') throw new Error('CLOUD_HISTORY_INVALID')
  const metadata = value as Partial<ConversationMetadata>
  if (
    id.length > 100 ||
    metadata.schemaVersion !== 1 ||
    typeof metadata.title !== 'string' ||
    metadata.title.length > 120 ||
    !Number.isFinite(metadata.createdAt) ||
    !Number.isFinite(metadata.updatedAt) ||
    !Number.isInteger(metadata.messageCount) ||
    metadata.messageCount! < 0 ||
    metadata.messageCount! > MAX_MESSAGES
  )
    throw new Error('CLOUD_HISTORY_INVALID')
  return {
    id,
    schemaVersion: 1,
    title: metadata.title,
    createdAt: metadata.createdAt!,
    updatedAt: metadata.updatedAt!,
    messageCount: metadata.messageCount!,
    ...(validCheckpoint(metadata.memory) ? { memory: metadata.memory } : {}),
  }
}

export function parseConversationTurn(value: unknown): ConversationTurn {
  if (!value || typeof value !== 'object') throw new Error('CLOUD_HISTORY_INVALID')
  const turn = value as Partial<ConversationTurn>
  const user = parsePersistedMessage(turn.user)
  const assistant = parsePersistedMessage(turn.assistant)
  if (
    turn.schemaVersion !== 1 ||
    !Number.isFinite(turn.createdAt) ||
    user.role !== 'user' ||
    user.state !== 'complete' ||
    assistant.role !== 'assistant' ||
    assistant.state === 'streaming'
  )
    throw new Error('CLOUD_HISTORY_INVALID')
  return { schemaVersion: 1, createdAt: turn.createdAt!, user, assistant }
}

export function hydrateConversation(
  metadata: ConversationMetadata,
  turns: ConversationTurn[]
): Conversation {
  const messages = turns.flatMap(turn => [turn.user, turn.assistant])
  if (messages.length > MAX_MESSAGES || metadata.messageCount !== messages.length)
    throw new Error('CLOUD_HISTORY_INVALID')
  return {
    id: metadata.id,
    title: metadata.title,
    updatedAt: metadata.updatedAt,
    messages,
    ...(metadata.memory ? { memory: metadata.memory } : {}),
  }
}

export function latestCompletedTurn(conversation: Conversation): ConversationTurn | undefined {
  const user = conversation.messages.at(-2)
  const assistant = conversation.messages.at(-1)
  if (
    !user ||
    !assistant ||
    user.role !== 'user' ||
    user.state !== 'complete' ||
    assistant.role !== 'assistant' ||
    assistant.state === 'streaming'
  )
    return undefined
  return { schemaVersion: 1, createdAt: user.createdAt, user, assistant }
}

export function persistableTurns(conversation: Conversation): ConversationTurn[] {
  const turns: ConversationTurn[] = []
  for (let index = 0; index < conversation.messages.length; index += 2) {
    const user = conversation.messages[index]
    const assistant = conversation.messages[index + 1]
    if (!user || !assistant || assistant.state === 'streaming') continue
    const turn = parseConversationTurn({
      schemaVersion: 1,
      createdAt: user.createdAt,
      user,
      assistant,
    })
    turns.push(turn)
  }
  return turns
}

export function conversationMetadata(conversation: Conversation): ConversationMetadata {
  return parseConversationMetadata(conversation.id, {
    schemaVersion: 1,
    title: conversation.title,
    createdAt: conversation.messages[0]?.createdAt ?? conversation.updatedAt,
    updatedAt: conversation.updatedAt,
    messageCount: persistableTurns(conversation).length * 2,
    memory: conversation.memory,
  })
}

export function assertConversationCapacity(conversations: Conversation[], current: Conversation) {
  if (
    current.messages.length > MAX_MESSAGES - 2 ||
    (!current.messages.length && conversations.length >= MAX_CONVERSATIONS)
  )
    throw new Error('CLOUD_HISTORY_FULL')
}

export function newConversation(): Conversation {
  return { id: crypto.randomUUID(), title: '', updatedAt: Date.now(), messages: [] }
}

type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>
export const followReadingPreferenceKey = (account: string) =>
  `bible-strong.assistant-ui.v1:${encodeURIComponent(account)}:follow-reading`

export function loadFollowReadingPreference(storage: PreferenceStorage, account: string): boolean {
  return storage.getItem(followReadingPreferenceKey(account)) === 'true'
}

export function saveFollowReadingPreference(
  storage: PreferenceStorage,
  account: string,
  enabled: boolean
) {
  storage.setItem(followReadingPreferenceKey(account), enabled ? 'true' : 'false')
}
