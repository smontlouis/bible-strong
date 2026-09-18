import type { ReadingContext, LocalMessage } from '../conversations'
import { convertMessage, messagePartNames } from '../messageRuntime'

const context: ReadingContext = {
  key: 'passage:john-3',
  label: 'Jean 3',
  detail: 'Jean 3 · LSG',
  kind: 'passage',
  bibleVersion: 'LSG',
}

it('converts persisted message features into assistant-ui parts without changing storage', () => {
  const message: LocalMessage = {
    id: 'assistant-1',
    role: 'assistant',
    text: 'Une réponse avec [1].',
    state: 'streaming',
    createdAt: 42,
    tools: [
      {
        callId: 'call-1',
        name: 'get_passage',
        request: '{"reference":"Jean 3"}',
        result: 'Jean 3',
        state: 'complete',
      },
    ],
    routing: [
      {
        sequence: 1,
        phase: 'initial',
        selectedFamilies: ['passage'],
        allowedTools: ['get_passage'],
      },
    ],
    sources: [
      {
        id: 's1',
        title: 'Jean 3',
        excerpt: 'Car Dieu a tant aimé le monde…',
        version: 'LSG',
        kind: 'passage',
        params: { book: '43', chapter: '3', start: '16', end: '16' },
      },
    ],
  }
  const result = convertMessage(message)
  expect(result).toMatchObject({
    id: 'assistant-1',
    role: 'assistant',
    status: { type: 'running' },
    createdAt: new Date(42),
  })
  expect(result.content).toEqual([
    {
      type: 'tool-call',
      toolCallId: 'call-1',
      toolName: 'get_passage',
      args: { reference: 'Jean 3' },
      argsText: '{"reference":"Jean 3"}',
      result: 'Jean 3',
      artifact: { bibleStrongState: 'complete' },
    },
    { type: 'data', name: messagePartNames.routing, data: message.routing?.[0] },
    { type: 'data', name: messagePartNames.source, data: message.sources?.[0] },
    { type: 'text', text: message.text },
  ])
  expect(message).toHaveProperty('tools')
})

it.each([
  ['complete', { type: 'complete', reason: 'stop' }],
  ['interrupted', { type: 'incomplete', reason: 'cancelled' }],
  ['error', { type: 'incomplete', reason: 'error' }],
] as const)('maps %s message state to assistant-ui status', (state, expected) => {
  expect(
    convertMessage({
      id: state,
      role: 'assistant',
      text: 'Réponse',
      state,
      createdAt: 1,
    })
  ).toMatchObject({
    status: expected,
    content: [{ type: 'text', text: 'Réponse' }],
  })
})

it('omits status from user messages while preserving their reading context part', () => {
  const result = convertMessage({
    id: 'user-1',
    role: 'user',
    text: 'Question',
    state: 'complete',
    context,
    createdAt: 1,
  })
  expect(result).not.toHaveProperty('status')
  expect(result.content).toEqual([
    { type: 'text', text: 'Question' },
    { type: 'data', name: messagePartNames.context, data: context },
  ])
})
