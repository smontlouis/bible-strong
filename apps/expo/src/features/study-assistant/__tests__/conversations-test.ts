import { prepareMemory } from '../conversationMemory'
import {
  loadConversations,
  loadSelectedConversation,
  loadFollowReadingPreference,
  saveFollowReadingPreference,
  saveSelectedConversation,
  saveConversations,
  storageKey,
  type Conversation,
  type ConversationStorage,
  type LocalMessage,
} from '../conversations'
const memory = (): ConversationStorage => {
  const values = new Map<string, string>()
  return {
    getItem: k => values.get(k) ?? null,
    setItem: (k, v) => {
      values.set(k, v)
    },
    removeItem: k => {
      values.delete(k)
    },
  }
}
const message = (
  role: LocalMessage['role'],
  text: string,
  state: LocalMessage['state'] = 'complete'
): LocalMessage => ({ id: role + text, role, text, state, createdAt: 1 })
describe('local assistant conversations', () => {
  it('keeps accounts separate and marks an unfinished persisted answer as interrupted', () => {
    const store = memory()
    const c: Conversation = {
      id: 'c',
      title: 'Lecture',
      updatedAt: 1,
      messages: [message('user', 'Question'), message('assistant', 'Partiel', 'streaming')],
    }
    saveConversations(store, 'alice', [c])
    expect(loadConversations(store, 'bob')).toEqual([])
    expect(loadConversations(store, 'alice')[0].messages[1].state).toBe('interrupted')
  })
  it('rejects corrupt data without overwriting it', () => {
    const store = memory()
    store.setItem(storageKey('alice'), '{broken')
    expect(() => loadConversations(store, 'alice')).toThrow()
    expect(store.getItem(storageKey('alice'))).toBe('{broken')
  })
  it('keeps the message context and excludes incomplete responses', async () => {
    const messages = [
      message('user', 'Ancienne'),
      message('assistant', 'Ancienne réponse'),
      ...Array.from({ length: 3 }, (_, i) => [
        message('user', `Q${i}`),
        message('assistant', 'x'.repeat(7000)),
      ]).flat(),
      message('user', 'Dernière'),
      message('assistant', 'interrompue', 'interrupted'),
    ]
    messages[4].context = { key: 'k', label: 'Jean 1', detail: 'Jean 1 · LSG', kind: 'passage' }
    const { history } = await prepareMemory(
      { id: 'c', title: 't', messages, updatedAt: 1 },
      async () => {
        throw new Error('Not needed')
      },
      new AbortController().signal,
      () => {},
      () => {}
    )
    expect(history).toHaveLength(8)
    expect(history[4].content).toContain('Jean 1 · LSG')
    expect(history.flatMap(m => m.content).join('')).not.toContain('interrompue')
    expect(history.reduce((n, m) => n + m.content.length, 0)).toBeLessThanOrEqual(32000)
  })
  it('refuses a full store without silently deleting conversations', () => {
    const store = memory()
    const initial: Conversation = { id: 'c', title: 'x', updatedAt: 1, messages: [] }
    saveConversations(store, 'alice', [initial])
    expect(() => saveConversations(store, 'alice', Array(51).fill(initial))).toThrow(
      'LOCAL_HISTORY_FULL'
    )
    expect(loadConversations(store, 'alice')).toHaveLength(1)
  })
})

it('restores the selected thread rather than always choosing the newest, with account isolation', () => {
  const store = memory(),
    newer: Conversation = { id: 'newer', title: 'New', updatedAt: 2, messages: [] },
    older: Conversation = { id: 'older', title: 'Old', updatedAt: 1, messages: [] }
  expect(loadSelectedConversation(store, 'alice', [newer, older])?.id).toBe('newer')
  saveSelectedConversation(store, 'alice', 'older')
  expect(loadSelectedConversation(store, 'alice', [newer, older])?.id).toBe('older')
  expect(loadSelectedConversation(store, 'bob', [newer, older])?.id).toBe('newer')
  saveSelectedConversation(store, 'alice', null)
  expect(loadSelectedConversation(store, 'alice', [newer, older])).toBeUndefined()
})
it('restores tool previews and never restores a running activity as complete', () => {
  const storage = memory()
  const c: Conversation = {
    id: 'tools',
    title: 'Tools',
    updatedAt: 1,
    messages: [
      {
        ...message('assistant', 'Text'),
        tools: [
          { callId: 'one', name: 'get_passage', request: '{}', result: '', state: 'running' },
        ],
      },
    ],
  }
  saveConversations(storage, 'account', [c])
  expect(loadConversations(storage, 'account')[0].messages[0].tools?.[0].state).toBe('interrupted')
})
it('defaults the reading-follow preference to off and persists it per account', () => {
  const storage = memory()
  expect(loadFollowReadingPreference(storage, 'alice')).toBe(false)
  saveFollowReadingPreference(storage, 'alice', true)
  expect(loadFollowReadingPreference(storage, 'alice')).toBe(true)
  expect(loadFollowReadingPreference(storage, 'bob')).toBe(false)
})
