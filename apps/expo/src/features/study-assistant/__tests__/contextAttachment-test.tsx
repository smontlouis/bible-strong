import React, { useEffect } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import type { ReadingContext } from '../conversations'
import { useAssistantSession, type AssistantSession } from '../useAssistantSession'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

jest.mock('../conversationRepository', () => ({
  observeConversationIndex: (_account: string, next: (remote: never[]) => void) => {
    next([])
    return () => {}
  },
  observeConversation: () => () => {},
  saveConversation: async () => {},
  deleteConversation: async () => {},
  renameConversation: async () => {},
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

it('joins what the reader is looking at, until they take it off, and joins a new passage again', async () => {
  let renderer!: ReactTestRenderer
  await act(async () => {
    renderer = create(<Assistant liveContext={passage('Nombres 6')} />)
  })
  expect(session.context?.detail).toBe('Nombres 6')

  await act(async () => session.detachContext())
  expect(session.context).toBeNull()

  // The same passage stays off; the next one comes joined.
  await act(async () => renderer.update(<Assistant liveContext={passage('Nombres 6')} />))
  expect(session.context).toBeNull()
  await act(async () => renderer.update(<Assistant liveContext={passage('Jean 3')} />))
  expect(session.context?.detail).toBe('Jean 3')

  await act(async () => session.detachContext())
  await act(async () => session.attachContext())
  expect(session.context?.detail).toBe('Jean 3')
})
