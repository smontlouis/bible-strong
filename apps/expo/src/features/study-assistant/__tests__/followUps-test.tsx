import React, { useEffect } from 'react'
import { act, create } from 'react-test-renderer'
import type { StudyEvent, StudyRequest } from '@bible-strong/ai-contract/contract'
import { latestCompletedTurn } from '../conversations'
import { useAssistantSession, type AssistantSession } from '../useAssistantSession'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const mockSaved: unknown[] = []
jest.mock('../conversationRepository', () => ({
  observeConversationIndex: (_account: string, next: (remote: never[]) => void) => {
    next([])
    return () => {}
  },
  observeConversation: () => () => {},
  saveConversation: async (_account: string, conversation: unknown) => {
    mockSaved.push(conversation)
  },
  deleteConversation: async () => {},
  renameConversation: async () => {},
}))
const mockRequests: StudyRequest[] = []
let mockAnswers: ((emit: (event: StudyEvent) => void) => void)[] = []
jest.mock('../client', () => ({
  askAssistant: async (
    input: StudyRequest,
    _signal: AbortSignal,
    emit: (e: StudyEvent) => void
  ) => {
    mockRequests.push(input)
    mockAnswers.shift()!(emit)
  },
  compactAssistant: async () => '',
  captureAssistantPreferences: () => ({}),
}))
jest.mock('../assistantConfig', () => ({ assistantAvailable: true }))
jest.mock('~helpers/firebaseAuthRuntime', () => ({
  getCurrentAuthUser: () => ({ uid: 'reader' }),
}))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

let session!: AssistantSession
function Assistant() {
  const value = useAssistantSession({
    account: 'reader',
    signedIn: true,
    liveContext: null,
    onAction: () => {},
    // The answer shows as it arrives, without the reading pace.
    reduceMotion: true,
  })
  useEffect(() => {
    session = value
  })
  return null
}

const done: StudyEvent = { type: 'done', requestId: 'r', model: 'm', modelCalls: 1, toolCalls: 0 }
const questions = ['Que signifie agapè ?', 'Quels passages parlent de la vie éternelle ?']

it('offers the questions to ask next under the last answer, until another question is asked', async () => {
  mockAnswers = [
    emit => {
      emit({ type: 'delta', text: 'Dieu a tant aimé le monde.' })
      emit({ type: 'follow_ups', questions })
      emit(done)
    },
    emit => {
      emit({ type: 'delta', text: 'Une autre réponse.' })
      emit(done)
    },
  ]
  await act(async () => {
    create(<Assistant />)
  })
  await act(async () => session.send('Explique Jean 3:16'))
  expect(mockRequests[0].clientCapabilities).toContain('follow_ups')
  expect(session.followUps).toEqual(questions)
  // Kept in memory only: the stored turn has no place for them.
  const saved = mockSaved.at(-1) as Parameters<typeof latestCompletedTurn>[0]
  expect(Object.keys(latestCompletedTurn(saved)!.assistant)).not.toContain('followUps')

  await act(async () => session.send('Et ensuite ?'))
  expect(session.followUps).toEqual([])
})

it('offers nothing under an answer that did not complete', async () => {
  mockAnswers = [
    emit => {
      emit({ type: 'delta', text: 'Le début…' })
      emit({ type: 'follow_ups', questions })
      emit({ type: 'error', code: 'GENERATION_FAILED' })
    },
  ]
  await act(async () => {
    create(<Assistant />)
  })
  await act(async () => session.send('Explique Jean 3:16'))
  expect(session.current.messages.at(-1)?.state).toBe('error')
  expect(session.followUps).toEqual([])
})
