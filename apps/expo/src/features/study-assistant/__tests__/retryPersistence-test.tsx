import React, { useEffect } from 'react'
import { act, create } from 'react-test-renderer'
import type { StudyEvent } from '@bible-strong/ai-contract/contract'
import { useAssistantSession, type AssistantSession } from '../useAssistantSession'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

// A minimal in-memory Firestore: enough for the conversation repository to run for real.
const mockDocuments = new Map<string, Record<string, unknown>>()
const mockListeners = new Set<() => void>()
type MockRef = { path: string; id: string }
type MockQuery = { path: string; field?: string; direction?: string; maximum?: number }
jest.mock('~helpers/firebase', () => {
  const reference = (path: string): MockRef => ({ path, id: path.split('/').at(-1)! })
  const snapshot = (ref: MockRef) => ({
    id: ref.id,
    ref,
    exists: () => mockDocuments.has(ref.path),
    data: () => mockDocuments.get(ref.path),
  })
  const children = (target: MockQuery) => {
    const rows = [...mockDocuments.keys()]
      .filter(
        path =>
          path.startsWith(`${target.path}/`) && !path.slice(target.path.length + 1).includes('/')
      )
      .map(path => snapshot(reference(path)))
    if (target.field) {
      const sign = target.direction === 'desc' ? -1 : 1
      rows.sort(
        (a, b) => sign * (Number(a.data()![target.field!]) - Number(b.data()![target.field!]))
      )
    }
    return rows.slice(0, target.maximum)
  }
  const changed = () => [...mockListeners].forEach(listener => listener())
  const write = (ref: MockRef, data: Record<string, unknown>, options?: { merge?: boolean }) =>
    mockDocuments.set(
      ref.path,
      options?.merge ? { ...mockDocuments.get(ref.path), ...data } : { ...data }
    )
  return {
    firebaseDb: {},
    collection: (_db: unknown, ...segments: string[]): MockQuery => ({ path: segments.join('/') }),
    doc: (parent: MockQuery | object, ...segments: string[]) =>
      reference('path' in parent ? [parent.path, ...segments].join('/') : segments.join('/')),
    orderBy: (field: string, direction = 'asc') => ({ field, direction }),
    limit: (maximum: number) => ({ maximum }),
    query: (target: MockQuery, ...constraints: object[]): MockQuery =>
      Object.assign({}, target, ...constraints),
    onSnapshot: (target: MockRef | MockQuery, next: (value: unknown) => void) => {
      const emit = () =>
        next('id' in target ? snapshot(target) : { docs: children(target), size: 0 })
      mockListeners.add(emit)
      emit()
      return () => mockListeners.delete(emit)
    },
    runTransaction: async (
      _db: unknown,
      update: (transaction: {
        get: (ref: MockRef) => Promise<ReturnType<typeof snapshot>>
        set: typeof write
      }) => Promise<void>
    ) => {
      await update({ get: async ref => snapshot(ref), set: write })
      changed()
    },
    setDoc: async (ref: MockRef, data: Record<string, unknown>, options?: { merge?: boolean }) => {
      write(ref, data, options)
      changed()
    },
    getDocs: async (target: MockQuery) => ({
      docs: children(target),
      size: children(target).length,
    }),
    deleteDoc: async (ref: MockRef) => {
      mockDocuments.delete(ref.path)
      changed()
    },
    writeBatch: () => {
      const paths: string[] = []
      return {
        delete: (ref: MockRef) => paths.push(ref.path),
        commit: async () => {
          paths.forEach(path => mockDocuments.delete(path))
          changed()
        },
      }
    },
  }
})

let mockAnswers: ((emit: (event: StudyEvent) => void) => void)[] = []
jest.mock('../client', () => ({
  askAssistant: async (_input: unknown, _signal: AbortSignal, emit: (event: StudyEvent) => void) =>
    mockAnswers.shift()!(emit),
  compactAssistant: async () => '',
  captureAssistantPreferences: () => ({}),
}))
jest.mock('../assistantConfig', () => ({ assistantAvailable: true }))
jest.mock('~helpers/firebaseAuthRuntime', () => ({
  getCurrentAuthUser: () => ({ uid: 'reader' }),
}))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

const preferences = new Map<string, string>()
const storage = {
  getItem: (key: string) => preferences.get(key) ?? null,
  setItem: (key: string, value: string) => void preferences.set(key, value),
}

let session!: AssistantSession
function Assistant() {
  const value = useAssistantSession({
    account: 'reader',
    signedIn: true,
    liveContext: null,
    preferenceStorage: () => storage,
    onAction: () => {},
  })
  useEffect(() => {
    session = value
  })
  return null
}

const turns = () =>
  [...mockDocuments.entries()].filter(([path]) => path.includes('/turns/')).map(([, data]) => data)
const metadata = () =>
  [...mockDocuments.entries()].find(
    ([path]) => path.includes('/assistantConversations/') && !path.includes('/turns/')
  )?.[1]
const settle = () => act(async () => new Promise<void>(resolve => setTimeout(resolve, 0)))

it('replaces a failed exchange in the saved history when the reader retries it', async () => {
  mockAnswers = [
    () => {
      throw new Error('AI_UNAVAILABLE')
    },
    emit => {
      emit({ type: 'delta', text: 'Une réponse.' })
      emit({ type: 'done', requestId: 'r', model: 'm', modelCalls: 1, toolCalls: 0 })
    },
  ]
  await act(async () => {
    create(<Assistant />)
  })
  expect(session.ready).toBe(true)

  await act(async () => {
    await session.send('Que dit ce passage ?')
  })
  await settle()
  expect(turns()).toHaveLength(1)
  expect(turns()[0]).toMatchObject({ assistant: { state: 'error' } })
  expect(session.retry).toBeDefined()

  await act(async () => {
    session.retry!()
  })
  await settle()

  // One exchange was asked: one is stored, now with its answer.
  expect(turns()).toHaveLength(1)
  expect(turns()[0]).toMatchObject({
    user: { text: 'Que dit ce passage ?' },
    assistant: { state: 'complete', text: 'Une réponse.' },
  })
  expect(metadata()).toMatchObject({ messageCount: 2 })
  expect(session.current.messages.map(message => message.role)).toEqual(['user', 'assistant'])
})
