import { prepareMemory, type MemoryCheckpoint } from '../conversationMemory'
import {
  loadConversations,
  saveConversations,
  type Conversation,
  type LocalMessage,
} from '../conversations'
const conversation = (count: number): Conversation => ({
  id: 'c',
  title: 'Etude',
  updatedAt: 1,
  messages: Array.from({ length: count }, (_, i): LocalMessage[] => [
    { id: `u${i}`, role: 'user', text: 'q'.repeat(100), state: 'complete', createdAt: i },
    { id: `a${i}`, role: 'assistant', text: 'a'.repeat(1900), state: 'complete', createdAt: i },
  ]).flat(),
})
it('keeps all messages below and at the threshold without a model call', async () => {
  const compact = jest.fn()
  for (const count of [4, 16]) {
    const result = await prepareMemory(
      conversation(count),
      compact,
      new AbortController().signal,
      () => {},
      () => {}
    )
    expect(result.history).toHaveLength(count * 2)
  }
  expect(compact).not.toHaveBeenCalled()
})
it('summarizes only old pairs, preserves recent text and reuses a persisted checkpoint', async () => {
  const c = conversation(17),
    original = JSON.stringify(c.messages),
    compact = jest.fn(async () => 'Mémoire.'),
    saved: MemoryCheckpoint[] = []
  const result = await prepareMemory(
    c,
    compact,
    new AbortController().signal,
    m => saved.push(m),
    () => {}
  )
  expect(compact.mock.calls).toHaveLength(1)
  expect(result.history).toHaveLength(12)
  expect(result.memorySummary).toBe('Mémoire.')
  expect(JSON.stringify(c.messages)).toBe(original)
  let raw = ''
  const storage = {
    getItem: () => raw,
    setItem: (_k: string, v: string) => {
      raw = v
    },
    removeItem: () => {},
  }
  saveConversations(storage, 'account', [{ ...c, memory: saved[0] }])
  await prepareMemory(
    loadConversations(storage, 'account')[0],
    compact,
    new AbortController().signal,
    () => {},
    () => {}
  )
  expect(compact.mock.calls).toHaveLength(1)
})
it('updates the old summary using only newly aged messages, and invalidates edited prefixes', async () => {
  let checkpoint: MemoryCheckpoint | undefined
  await prepareMemory(
    conversation(17),
    async () => 'Initial',
    new AbortController().signal,
    m => {
      checkpoint = m
    },
    () => {}
  )
  const c = { ...conversation(27), memory: checkpoint }
  const requests: { summary: string; history: unknown[] }[] = []
  await prepareMemory(
    c,
    async input => {
      requests.push(input)
      return 'Updated'
    },
    new AbortController().signal,
    () => {},
    () => {}
  )
  expect(requests[0].summary).toBe('Initial')
  expect(requests[0].history).toHaveLength(20)
  c.messages[0].text = 'changed'
  requests.length = 0
  await prepareMemory(
    c,
    async input => {
      requests.push(input)
      return 'Rebuilt'
    },
    new AbortController().signal,
    () => {},
    () => {}
  )
  expect(requests[0].summary).toBe('')
  expect(requests[0].history.length).toBeGreaterThan(20)
})
it('does not save a failed or oversize summary and honors cancellation', async () => {
  const save = jest.fn(),
    c = conversation(17)
  await expect(
    prepareMemory(
      c,
      async () => 'x'.repeat(3001),
      new AbortController().signal,
      save,
      () => {}
    )
  ).rejects.toThrow('COMPACTION_FAILED')
  expect(save).not.toHaveBeenCalled()
  const controller = new AbortController()
  await expect(
    prepareMemory(
      c,
      async () => {
        controller.abort()
        return 'Résumé'
      },
      controller.signal,
      save,
      () => {}
    )
  ).rejects.toThrow('INTERRUPTED')
  expect(save).not.toHaveBeenCalled()
})

it('compacts an oversized single exchange instead of slicing its content', async () => {
  const c = conversation(1)
  c.messages[1].text = 'a'.repeat(40000)
  const result = await prepareMemory(
    c,
    async input => {
      expect(input.history[1].content).toHaveLength(40000)
      return 'Résumé complet'
    },
    new AbortController().signal,
    () => {},
    () => {}
  )
  expect(result.history).toEqual([])
  expect(result.memorySummary).toBe('Résumé complet')
})

it('discards obsolete checkpoints while preserving all original messages', () => {
  const c = conversation(17)
  const raw = JSON.stringify([
    {
      ...c,
      memory: {
        version: 'memory-1',
        summary: 'Old unvalidated text',
        coveredPairs: 10,
        throughId: 'a9',
        digest: 'a'.repeat(64),
      },
    },
  ])
  const store = { getItem: () => raw, setItem: () => {}, removeItem: () => {} }
  const loaded = loadConversations(store, 'test')[0]
  expect(loaded.memory).toBeUndefined()
  expect(loaded.messages).toEqual(c.messages)
})
