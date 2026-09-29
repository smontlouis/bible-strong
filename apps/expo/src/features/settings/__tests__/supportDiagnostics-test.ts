import { getSupportDiagnostics } from '../supportDiagnostics'

const mockUser = { uid: 'firebase-123', isAnonymous: false, refreshToken: 'must-not-leak' }
const mockAuth = jest.fn((): typeof mockUser | null => mockUser)
jest.mock('~helpers/firebaseAuthRuntime', () => ({ getCurrentAuthUser: () => mockAuth() }))
jest.mock('@sentry/react-native', () => ({
  getCurrentScope: () => ({
    getUser: () => ({ id: 'firebase-123', email: 'private@example.com' }),
  }),
  lastEventId: () => 'last-event',
}))
jest.mock('expo-application', () => ({
  nativeApplicationVersion: '27.0.18',
  nativeBuildVersion: '42',
}))
jest.mock('expo-updates', () => ({ updateId: 'update-123', channel: 'production' }))
jest.mock('../supportDevice', () => ({
  getSupportDevice: () => ({ model: 'iPhone 17', osVersion: '26' }),
}))

describe('support diagnostics', () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, '__DEV__', { value: false, configurable: true })
  })
  afterAll(() => {
    Reflect.deleteProperty(globalThis, '__DEV__')
  })
  it('includes lookup IDs and installed versions without copying profiles or credentials', () => {
    const result = getSupportDiagnostics('fr')
    expect(result).toMatchObject({
      firebaseUid: 'firebase-123',
      sentryUserId: 'firebase-123',
      lastSentryEventId: 'last-event',
      appVersion: '27.0.18',
      build: '42',
      updateId: 'update-123',
      model: 'iPhone 17',
      language: 'fr',
    })
    expect(JSON.stringify(result)).not.toMatch(/must-not-leak|private@example.com|refreshToken/)
  })

  it('works when there is no Firebase user', () => {
    mockAuth.mockReturnValueOnce(null)
    expect(getSupportDiagnostics('en')).toMatchObject({ account: 'guest', firebaseUid: undefined })
  })
})
