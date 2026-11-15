import React, { useEffect } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { parseConversationMetadata, type ReadingContext } from '../conversations'
import {
  RESUME_WINDOW_MS,
  useAssistantSession,
  type AssistantSession,
} from '../useAssistantSession'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const mockPin = jest.fn(async () => {})
jest.mock('../conversationRepository', () => ({
  observeConversationIndex: (_account: string, next: (remote: unknown[]) => void) => {
    next([
      { id: 'sabbath', title: 'Le sabbat', updatedAt: 1, messages: [], summaryMessageCount: 2 },
    ])
    return () => {}
  },
  observeConversation: () => () => {},
  saveConversation: async () => {},
  deleteConversation: async () => {},
  renameConversation: async () => {},
  pinConversationContext: (...args: unknown[]) => mockPin(...(args as [])),
}))
jest.mock('../aiConsent', () => ({
  useAiConsent: () => ({ status: 'granted', accept: async () => {}, withdraw: async () => {} }),
}))
jest.mock('../client', () => ({
  askAssistant: async () => {},
  compactAssistant: async () => '',
  captureAssistantPreferences: () => ({}),
}))
jest.mock('../assistantConfig', () => ({ assistantAvailable: true }))
jest.mock('~helpers/firebaseAuthRuntime', () => ({
  getCurrentAuthUser: () => ({ uid: 'reader' }),
}))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

const passage = (detail: string): ReadingContext => ({
  key: `passage:${detail}`,
  kind: 'passage',
  label: 'Bible',
  detail,
})

let session!: AssistantSession
function Assistant({ liveContext }: { liveContext: ReadingContext | null }) {
  const value = useAssistantSession({
    account: 'reader',
    signedIn: true,
    liveContext,
    onAction: () => {},
  })
  useEffect(() => {
    session = value
  })
  return null
}

let now = 1_000_000
beforeEach(() => {
  jest.spyOn(Date, 'now').mockImplementation(() => now)
  mockPin.mockClear()
})
afterEach(() => jest.restoreAllMocks())

it('starts on a new conversation and offers to resume the last one', async () => {
  await act(async () => {
    create(<Assistant liveContext={null} />)
  })
  expect(session.current.id).not.toBe('sabbath')
  expect(session.resumable?.title).toBe('Le sabbat')

  await act(async () => session.threadList.onSwitchToThread('sabbath'))
  expect(session.current.id).toBe('sabbath')
  expect(session.resumable).toBeNull()
})

it('reopens on the conversation left less than five minutes ago, on a new one later', async () => {
  await act(async () => {
    create(<Assistant liveContext={null} />)
  })
  await act(async () => session.threadList.onSwitchToThread('sabbath'))

  await act(async () => session.markClosed())
  now += RESUME_WINDOW_MS - 1000
  await act(async () => session.markOpened())
  expect(session.current.id).toBe('sabbath')

  await act(async () => session.markClosed())
  now += RESUME_WINDOW_MS + 1000
  await act(async () => session.markOpened())
  expect(session.current.id).not.toBe('sabbath')
  expect(session.resumable?.id).toBe('sabbath')
})

it('keeps a pinned context wherever the reader goes, until it is unpinned', async () => {
  let renderer!: ReactTestRenderer
  await act(async () => {
    renderer = create(<Assistant liveContext={passage('Jacques 2')} />)
  })
  await act(async () => session.pinContext())
  await act(async () => renderer.update(<Assistant liveContext={passage('Romains 8')} />))
  expect(session.context?.detail).toBe('Jacques 2')
  expect(session.pinnedContext?.detail).toBe('Jacques 2')
  // Not saved yet: the pin goes with the conversation's first question.
  expect(mockPin).not.toHaveBeenCalled()

  // The cross of a pinned chip unpins it: the reading goes with the questions again.
  await act(async () => session.detachContext())
  expect(session.pinnedContext).toBeNull()
  expect(session.context?.detail).toBe('Romains 8')
})

it('saves the pin of a saved conversation at once', async () => {
  await act(async () => {
    create(<Assistant liveContext={passage('Jacques 2')} />)
  })
  await act(async () => session.threadList.onSwitchToThread('sabbath'))
  await act(async () => session.pinContext())
  expect(mockPin).toHaveBeenCalledWith('reader', 'sabbath', passage('Jacques 2'))
  await act(async () => session.unpinContext())
  expect(mockPin).toHaveBeenLastCalledWith('reader', 'sabbath', null)
})

it('reads a pin from the saved conversation, and keeps an unpin', () => {
  const stored = {
    schemaVersion: 1,
    title: 'Jacques',
    createdAt: 1,
    updatedAt: 2,
    messageCount: 2,
  }
  expect(
    parseConversationMetadata('a', { ...stored, pinnedContext: passage('Jacques 2') })
      .pinnedContext
  ).toEqual(passage('Jacques 2'))
  expect(parseConversationMetadata('a', { ...stored, pinnedContext: null }).pinnedContext).toBe(
    null
  )
  expect(
    parseConversationMetadata('a', { ...stored, pinnedContext: { kind: 'nothing' } })
  ).not.toHaveProperty('pinnedContext')
})
