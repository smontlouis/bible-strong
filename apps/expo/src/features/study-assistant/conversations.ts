import { parseToolActivity, type ToolActivity } from '@bible-strong/ai-contract/contract'
import { validCheckpoint, type MemoryCheckpoint } from './conversationMemory'

export type ReadingContext = {
  key: string
  label: string
  detail: string
  content?: string
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
}
export type ConversationStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export const storageKey = (account: string) =>
  `bible-strong.assistant.v1:${encodeURIComponent(account)}`
const MAX_CHARACTERS = 2_000_000
const isContext = (value: unknown): value is ReadingContext => {
  if (!value || typeof value !== 'object') return false
  const c = value as ReadingContext
  return (
    typeof c.key === 'string' &&
    c.key.length < 1000 &&
    typeof c.label === 'string' &&
    c.label.length <= 500 &&
    typeof c.detail === 'string' &&
    c.detail.length <= 500 &&
    (c.content === undefined || (typeof c.content === 'string' && c.content.length <= 12000)) &&
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
    ].includes(c.kind)
  )
}
export function loadConversations(storage: ConversationStorage, account: string): Conversation[] {
  const raw = storage.getItem(storageKey(account))
  if (!raw) return []
  if (raw.length > MAX_CHARACTERS) throw new Error('LOCAL_HISTORY_INVALID')
  const data: unknown = JSON.parse(raw)
  if (!Array.isArray(data) || data.length > 50) throw new Error('LOCAL_HISTORY_INVALID')
  return data.map((c: Conversation) => {
    if (
      !c ||
      typeof c.id !== 'string' ||
      c.id.length > 100 ||
      typeof c.title !== 'string' ||
      c.title.length > 120 ||
      !Number.isFinite(c.updatedAt) ||
      !Array.isArray(c.messages) ||
      c.messages.length > 300
    )
      throw new Error('LOCAL_HISTORY_INVALID')
    return {
      id: c.id,
      title: c.title,
      updatedAt: c.updatedAt,
      ...(validCheckpoint(c.memory) ? { memory: c.memory } : {}),
      messages: c.messages.map(m => {
        if (
          !m ||
          typeof m.id !== 'string' ||
          !['user', 'assistant'].includes(m.role) ||
          typeof m.text !== 'string' ||
          m.text.length > 60000 ||
          !Number.isFinite(m.createdAt) ||
          !['complete', 'streaming', 'interrupted', 'error'].includes(m.state) ||
          (m.context !== undefined && !isContext(m.context))
        )
          throw new Error('LOCAL_HISTORY_INVALID')
        if (m.tools !== undefined && (!Array.isArray(m.tools) || m.tools.length > 6))
          throw new Error('LOCAL_HISTORY_INVALID')
        const tools = m.tools?.map(value => {
          const tool = parseToolActivity(value)
          return {
            ...tool,
            state: tool.state === 'running' ? ('interrupted' as const) : tool.state,
          }
        })
        return {
          ...(tools ? { tools } : {}),
          id: m.id,
          role: m.role,
          text: m.text,
          state: m.state === 'streaming' ? 'interrupted' : m.state,
          createdAt: m.createdAt,
          ...(m.context ? { context: m.context } : {}),
        }
      }),
    }
  })
}
export function saveConversations(
  storage: ConversationStorage,
  account: string,
  conversations: Conversation[]
) {
  if (conversations.length > 50 || conversations.some(c => c.messages.length > 300))
    throw new Error('LOCAL_HISTORY_FULL')
  const raw = JSON.stringify(conversations)
  if (raw.length > MAX_CHARACTERS) throw new Error('LOCAL_HISTORY_FULL')
  storage.setItem(storageKey(account), raw)
}
export function newConversation(): Conversation {
  return { id: crypto.randomUUID(), title: '', updatedAt: Date.now(), messages: [] }
}

export function loadSelectedConversation(
  storage: ConversationStorage,
  account: string,
  conversations: Conversation[]
): Conversation | undefined {
  const id = storage.getItem(`${storageKey(account)}:active`)
  return id === null ? conversations[0] : conversations.find(c => c.id === id)
}
export function saveSelectedConversation(
  storage: ConversationStorage,
  account: string,
  id: string | null
) {
  storage.setItem(`${storageKey(account)}:active`, id || '')
}
