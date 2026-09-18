import { prepareMemory } from '../conversationMemory'
import { runConversation } from '../conversationRun'
import { type Conversation, type ReadingContext } from '../conversations'
const empty: Conversation = { id: 'thread', title: '', updatedAt: 1, messages: [] }
it('freezes message context and completes the streamed answer', async () => {
  const context: ReadingContext = {
    key: 'k',
    label: 'Jean 1',
    detail: 'Jean 1 · LSG',
    kind: 'passage',
  }
  const updates: Conversation[] = []
  await runConversation({
    conversation: empty,
    question: 'Explique',
    context,
    controller: new AbortController(),
    isCurrent: () => true,
    onUpdate: c => updates.push(c),
    onProgress: () => {},
    onError: () => {},
    request: async (input, _signal, emit) => {
      context.detail = 'Romains 8'
      expect(input.readingContext).toBe('Jean 1 · LSG')
      emit({ type: 'delta', text: 'Une réponse.' })
      emit({ type: 'done', requestId: 'r', model: 'm', modelCalls: 1, toolCalls: 0 })
    },
  })
  expect(updates.at(-1)?.messages[0].context?.detail).toBe('Jean 1 · LSG')
  expect(updates.at(-1)?.messages[1]).toMatchObject({ text: 'Une réponse.', state: 'complete' })
})
it('keeps cancelled text but excludes it from future model history', async () => {
  const updates: Conversation[] = [],
    controller = new AbortController(),
    errors: string[] = []
  await runConversation({
    conversation: empty,
    question: 'Explique',
    context: null,
    controller,
    isCurrent: () => true,
    onUpdate: c => updates.push(c),
    onProgress: () => {},
    onError: k => errors.push(k),
    request: async (_i, _s, emit) => {
      emit({ type: 'delta', text: 'Partie reçue' })
      controller.abort()
      throw new Error('aborted')
    },
  })
  expect(updates.at(-1)?.messages[1]).toMatchObject({ text: 'Partie reçue', state: 'interrupted' })
  expect(
    (
      await prepareMemory(
        updates.at(-1)!,
        async () => {
          throw new Error('Not needed')
        },
        new AbortController().signal,
        () => {},
        () => {}
      )
    ).history
  ).toEqual([])
  expect(errors).toEqual(['assistant.interrupted'])
})
it('ignores late output after the account session is replaced', async () => {
  let current = true
  const updates: Conversation[] = []
  await runConversation({
    conversation: empty,
    question: 'Explique',
    context: null,
    controller: new AbortController(),
    isCurrent: () => current,
    onUpdate: c => updates.push(c),
    onProgress: () => {},
    onError: () => {},
    request: async (_i, _s, emit) => {
      current = false
      emit({ type: 'delta', text: 'Other account must not see this' })
      emit({ type: 'done', requestId: 'r', model: 'm', modelCalls: 1, toolCalls: 0 })
    },
  })
  expect(updates).toHaveLength(1)
  expect(updates[0].messages[1].text).toBe('')
})

it('persists the checkpoint and sends it with recent history before answering', async () => {
  const messages = Array.from({ length: 17 }, (_, i) => [
    {
      id: `u${i}`,
      role: 'user' as const,
      text: 'q'.repeat(100),
      state: 'complete' as const,
      createdAt: i,
    },
    {
      id: `a${i}`,
      role: 'assistant' as const,
      text: 'a'.repeat(1900),
      state: 'complete' as const,
      createdAt: i,
    },
  ]).flat()
  const updates: Conversation[] = [],
    progress: string[] = []
  await runConversation({
    conversation: { ...empty, messages },
    question: 'Suite',
    context: null,
    controller: new AbortController(),
    isCurrent: () => true,
    onUpdate: c => updates.push(c),
    onProgress: k => progress.push(k),
    onError: () => {},
    compact: async () => 'Mémoire condensée',
    request: async (input, _s, emit) => {
      expect(updates.at(-1)?.memory?.summary).toBe('Mémoire condensée')
      expect(input.memorySummary).toBe('Mémoire condensée')
      expect(input.history).toHaveLength(12)
      emit({ type: 'delta', text: 'Suite de la discussion' })
      emit({ type: 'done', requestId: 'r', model: 'm', modelCalls: 1, toolCalls: 0 })
    },
  })
  expect(progress).toContain('assistant.modal.compacting')
  expect(updates.at(-1)?.messages).toHaveLength(36)
  expect(updates.at(-1)?.messages.at(-1)?.state).toBe('complete')
})

it('preserves a partial answer on network failure and never retries automatically', async () => {
  const updates: Conversation[] = [],
    errors: string[] = []
  const request = jest.fn(async (_input, _signal, emit) => {
    emit({ type: 'delta', text: 'Texte reçu avant la panne.' })
    throw new TypeError('Network request failed')
  })
  await runConversation({
    conversation: empty,
    question: 'Question',
    context: null,
    controller: new AbortController(),
    request,
    isCurrent: () => true,
    onUpdate: c => updates.push(c),
    onProgress: () => {},
    onError: e => errors.push(e),
  })
  expect(request).toHaveBeenCalledTimes(1)
  expect(updates.at(-1)?.messages.at(-1)).toMatchObject({
    text: 'Texte reçu avant la panne.',
    state: 'error',
  })
  expect(errors).toEqual(['assistant.unavailable'])
  expect(
    (
      await prepareMemory(
        updates.at(-1)!,
        async () => {
          throw new Error('Not needed')
        },
        new AbortController().signal,
        () => {},
        () => {}
      )
    ).history
  ).toEqual([])
})
it('retains tool results and interrupts unfinished calls without adding them to model memory', async () => {
  const updates: Conversation[] = []
  await runConversation({
    conversation: empty,
    question: 'Explique',
    context: null,
    controller: new AbortController(),
    isCurrent: () => true,
    onUpdate: c => updates.push(c),
    onProgress: () => {},
    onError: () => {},
    request: async (_i, _s, emit) => {
      emit({
        type: 'tool',
        callId: '1',
        name: 'get_passage',
        request: '{}',
        result: '',
        state: 'running',
      })
      emit({
        type: 'tool',
        callId: '1',
        name: 'get_passage',
        request: '{}',
        result: 'PRIVATE_TOOL_PREVIEW',
        state: 'complete',
      })
      emit({
        type: 'tool',
        callId: '2',
        name: 'search',
        request: '{}',
        result: '',
        state: 'running',
      })
      emit({
        type: 'routing',
        sequence: 1,
        phase: 'initial',
        selectedFamilies: ['commentary'],
        allowedTools: ['get_commentary_excerpt'],
      })
      emit({ type: 'delta', text: 'Réponse' })
      emit({ type: 'done', requestId: 'r', model: 'm', modelCalls: 1, toolCalls: 2 })
    },
  })
  const conversation = updates.at(-1)!
  expect(conversation.messages[1].routing?.[0].selectedFamilies).toEqual(['commentary'])
  expect(conversation.messages[1].tools?.map(t => t.state)).toEqual(['complete', 'interrupted'])
  const memory = await prepareMemory(
    conversation,
    async () => {
      throw new Error('unexpected')
    },
    new AbortController().signal,
    () => {},
    () => {}
  )
  expect(JSON.stringify(memory)).not.toContain('PRIVATE_TOOL_PREVIEW')
  expect(JSON.stringify(memory)).not.toContain('get_commentary_excerpt')
})

it('preserves ordered resource cards when a grouped card grows and the response is interrupted', async () => {
  const updates: Conversation[] = []
  const controller = new AbortController()
  await runConversation({
    conversation: empty,
    question: 'Compare ces événements',
    context: null,
    controller,
    isCurrent: () => true,
    onUpdate: c => updates.push(c),
    onProgress: () => {},
    onError: () => {},
    request: async (_input, _signal, emit) => {
      emit({
        type: 'widget',
        widget: {
          id: 'w1',
          kind: 'event_timeline',
          title: 'Événements',
          events: ['creation'],
          language: 'fr',
        },
      })
      emit({
        type: 'widget',
        widget: {
          id: 'w2',
          kind: 'book_overview',
          title: 'Genèse',
          book: 1,
          version: 'LSG',
          language: 'fr',
        },
      })
      emit({
        type: 'widget',
        widget: {
          id: 'w1',
          kind: 'event_timeline',
          title: 'Événements',
          events: ['creation', 'flood'],
          language: 'fr',
        },
      })
      controller.abort()
      throw new Error('aborted')
    },
  })
  expect(updates.at(-1)?.messages[1]).toMatchObject({
    state: 'interrupted',
    widgets: [
      { id: 'w1', events: ['creation', 'flood'] },
      { id: 'w2', book: 1 },
    ],
  })
})
it('freezes the selected Bible version with the reading context', async () => {
  await runConversation({
    conversation: empty,
    question: 'Explain',
    context: {
      key: 'k',
      label: 'John',
      detail: 'John 15:4 · KJV',
      kind: 'passage',
      bibleVersion: 'KJV',
    },
    controller: new AbortController(),
    isCurrent: () => true,
    onUpdate: () => {},
    onProgress: () => {},
    onError: () => {},
    request: async (input, _signal, emit) => {
      expect(input.readingBibleVersion).toBe('KJV')
      expect(input.defaultBibleVersion).toBeUndefined()
      emit({ type: 'done', requestId: 'r', model: 'm', modelCalls: 1, toolCalls: 0 })
    },
  })
})
it('keeps preference values fixed for a question even if settings change before the request', async () => {
  const preferences = {
    appLanguage: 'fr' as const,
    defaultBibleVersion: 'NBS',
    defaultStrongBibleVersion: 'KJV',
  }
  await runConversation({
    conversation: empty,
    question: 'Explain',
    context: {
      key: 's21',
      label: 'Jean',
      detail: 'Jean 15:4 · S21',
      kind: 'passage',
      bibleVersion: 'S21',
    },
    preferences,
    controller: new AbortController(),
    isCurrent: () => true,
    onUpdate: () => {
      preferences.defaultStrongBibleVersion = 'LSG'
    },
    onProgress: () => {},
    onError: () => {},
    request: async (input, _signal, emit) => {
      expect(input).toMatchObject({
        appLanguage: 'fr',
        defaultBibleVersion: 'NBS',
        defaultStrongBibleVersion: 'KJV',
        readingBibleVersion: 'S21',
      })
      emit({ type: 'done', requestId: 'r', model: 'm', modelCalls: 1, toolCalls: 0 })
    },
  })
})
