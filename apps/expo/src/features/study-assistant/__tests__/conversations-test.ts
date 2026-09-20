import { prepareMemory } from '../conversationMemory'
import {
  assertConversationCapacity,
  conversationMetadata,
  hydrateConversation,
  latestCompletedTurn,
  loadFollowReadingPreference,
  parseConversationMetadata,
  parseConversationTurn,
  persistableTurns,
  saveFollowReadingPreference,
  type Conversation,
  type LocalMessage,
} from '../conversations'

const message = (
  role: LocalMessage['role'],
  text: string,
  state: LocalMessage['state'] = 'complete'
): LocalMessage => ({ id: role + text, role, text, state, createdAt: 1 })

const roundTrip = (conversation: Conversation) =>
  hydrateConversation(conversationMetadata(conversation), persistableTurns(conversation))

describe('cloud assistant conversations', () => {
  it('round-trips completed and interrupted turns with their reading context', () => {
    const context = { key: 'k', label: 'Jean 1', detail: 'Jean 1 · LSG', kind: 'passage' as const }
    const conversation: Conversation = {
      id: 'c',
      title: 'Lecture',
      updatedAt: 2,
      messages: [
        { ...message('user', 'Question'), context },
        message('assistant', 'Réponse'),
        message('user', 'Suite'),
        message('assistant', 'Partiel', 'interrupted'),
      ],
    }
    expect(roundTrip(conversation)).toEqual(conversation)
  })

  it('does not persist an answer while it is streaming', () => {
    const conversation: Conversation = {
      id: 'c',
      title: 'Lecture',
      updatedAt: 1,
      messages: [message('user', 'Question'), message('assistant', 'Partiel', 'streaming')],
    }
    expect(latestCompletedTurn(conversation)).toBeUndefined()
    expect(persistableTurns(conversation)).toEqual([])
  })

  it('rejects invalid metadata and invalid role ordering', () => {
    expect(() => parseConversationMetadata('c', { schemaVersion: 1 })).toThrow(
      'CLOUD_HISTORY_INVALID'
    )
    expect(() =>
      parseConversationTurn({
        schemaVersion: 1,
        createdAt: 1,
        user: message('assistant', 'wrong'),
        assistant: message('user', 'wrong'),
      })
    ).toThrow('CLOUD_HISTORY_INVALID')
  })

  it('restores tool previews and converts an impossible running tool to interrupted', () => {
    const turn = parseConversationTurn({
      schemaVersion: 1,
      createdAt: 1,
      user: message('user', 'Question'),
      assistant: {
        ...message('assistant', 'Text'),
        tools: [
          { callId: 'one', name: 'get_passage', request: '{}', result: '', state: 'running' },
        ],
      },
    })
    expect(turn.assistant.tools?.[0].state).toBe('interrupted')
  })

  it('keeps message context out of incomplete responses sent to model memory', async () => {
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
    expect(history[4].content).toContain('Jean 1 · LSG')
    expect(history.flatMap(item => item.content).join('')).not.toContain('interrompue')
  })

  it('enforces conversation and message limits', () => {
    const initial: Conversation = { id: 'c', title: 'x', updatedAt: 1, messages: [] }
    expect(() => assertConversationCapacity(Array(50).fill(initial), initial)).toThrow(
      'CLOUD_HISTORY_FULL'
    )
  })
})

it('keeps the UI-only reading preference account-scoped', () => {
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  }
  expect(loadFollowReadingPreference(storage, 'alice')).toBe(false)
  saveFollowReadingPreference(storage, 'alice', true)
  expect(loadFollowReadingPreference(storage, 'alice')).toBe(true)
  expect(loadFollowReadingPreference(storage, 'bob')).toBe(false)
})
