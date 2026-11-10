import { getDefaultStore } from 'jotai'
import { askAssistant, fetchAssistantQuota } from '../client'
import { assistantQuotaAtom } from '../assistantQuota'
import { errorTranslationKey } from '../conversationRun'

const mockFetch = jest.fn()
jest.mock('expo/fetch', () => ({ fetch: (...args: unknown[]) => mockFetch(...args) }))
jest.mock('~helpers/firebaseAuthRuntime', () => ({
  getCurrentAuthUser: () => ({ uid: 'reader' }),
}))
jest.mock('../assistantAuthHeaders', () => ({
  assistantAuthHeaders: async () => ({ Authorization: 'Bearer token' }),
}))
jest.mock('../languagePreferences', () => ({ assistantLanguagePreferences: () => ({}) }))
jest.mock('~redux/store', () => ({
  store: { getState: () => ({ user: { bible: { settings: {} } } }) },
}))
jest.mock('~helpers/bibleVersions', () => ({ versions: {} }))
jest.mock('~helpers/languageUtils', () => ({ getDefaultBibleVersion: () => 'LSG' }))
jest.mock('~helpers/strongBiblePublications', () => ({
  resolveStrongNavigationVersionId: () => 'LSG',
}))
jest.mock('~i18n', () => ({ getLanguage: () => 'fr' }))

const daily = { kind: 'daily', limit: 3, remaining: 0, resetsAt: '2026-11-11T00:00:00.000Z' }
const json = (status: number, body: unknown) =>
  ({ ok: status < 300, status, json: async () => body }) as unknown as Response
const stream = (events: unknown[]) =>
  ({
    ok: true,
    status: 200,
    body: new ReadableStream({
      start(controller) {
        for (const event of events)
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`))
        controller.close()
      },
    }),
  }) as unknown as Response

const ask = (emit: (event: unknown) => void = () => {}) =>
  askAssistant(
    { question: 'q', history: [], readingContext: '' },
    new AbortController().signal,
    emit
  )

beforeEach(() => {
  process.env.EXPO_PUBLIC_AI_API_URL = 'https://ai.test'
  mockFetch.mockReset()
  getDefaultStore().set(assistantQuotaAtom, null)
})

it('keeps the quota a refusal carries and names the refusal', async () => {
  mockFetch.mockResolvedValueOnce(json(429, { code: 'DAILY_LIMIT', requestId: 'r', quota: daily }))
  await expect(ask()).rejects.toThrow('DAILY_LIMIT')
  expect(getDefaultStore().get(assistantQuotaAtom)).toEqual({ uid: 'reader', quota: daily })
  // Until the service has shown it counts questions, a question does not declare the quota
  // capability, which an older service refuses; afterwards it does.
  const sent = () => JSON.parse(mockFetch.mock.calls.at(-1)[1].body).clientCapabilities
  expect(sent()).toBeUndefined()

  const waiting = { kind: 'verify_email', limit: 3 }
  mockFetch.mockResolvedValueOnce(
    json(403, { code: 'EMAIL_VERIFICATION_REQUIRED', requestId: 'r', quota: waiting })
  )
  await expect(ask()).rejects.toThrow('EMAIL_VERIFICATION_REQUIRED')
  expect(sent()).toEqual(['quota'])
  expect(getDefaultStore().get(assistantQuotaAtom)?.quota).toEqual(waiting)
  expect(errorTranslationKey('EMAIL_VERIFICATION_REQUIRED')).toBe('assistant.verifyEmail')

  // The beta refusal carries no quota and stays what it was.
  mockFetch.mockResolvedValueOnce(json(403, { code: 'BETA_ACCESS_REQUIRED', requestId: 'r' }))
  await expect(ask()).rejects.toThrow('BETA_ACCESS_REQUIRED')
  // A body that is not JSON still names the status.
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status: 429,
    json: async () => {
      throw new SyntaxError('not json')
    },
  })
  await expect(ask()).rejects.toThrow('DAILY_LIMIT')
})

it('keeps the quota of the stream and passes every event on', async () => {
  const quota = { ...daily, remaining: 2 }
  mockFetch.mockResolvedValueOnce(
    stream([
      { type: 'quota', quota },
      { type: 'delta', text: 'Réponse' },
      { type: 'done', requestId: 'r', model: 'm', modelCalls: 1, toolCalls: 0 },
    ])
  )
  const events: { type: string }[] = []
  await ask(event => events.push(event as { type: string }))
  expect(events.map(event => event.type)).toEqual(['quota', 'delta', 'done'])
  expect(getDefaultStore().get(assistantQuotaAtom)).toEqual({ uid: 'reader', quota })
})

it('reads the quota without asking a question', async () => {
  mockFetch.mockResolvedValueOnce(json(200, { quota: { kind: 'unlimited' } }))
  await expect(fetchAssistantQuota(new AbortController().signal)).resolves.toEqual({
    kind: 'unlimited',
  })
  expect(mockFetch.mock.calls[0][0]).toBe('https://ai.test/v1/study-assistant/quota')
  expect(mockFetch.mock.calls[0][1]).toMatchObject({ method: 'POST' })
  mockFetch.mockResolvedValueOnce(json(404, { code: 'NOT_FOUND' }))
  await expect(fetchAssistantQuota(new AbortController().signal)).rejects.toThrow(
    'QUOTA_UNAVAILABLE'
  )
})
