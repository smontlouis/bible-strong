let mockAuthStateListener: ((user: unknown) => Promise<void>) | undefined

const mockRunAllCleanups = jest.fn()
const mockTokenReset = jest.fn()
const mockSetSentryUser = jest.fn()

jest.mock('firebase/auth', () => ({
  EmailAuthProvider: { credential: jest.fn() },
  GoogleAuthProvider: jest.fn(),
  OAuthProvider: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  getAdditionalUserInfo: jest.fn(),
  getAuth: jest.fn(() => ({})),
  onAuthStateChanged: jest.fn((_auth, listener) => {
    mockAuthStateListener = listener
  }),
  reauthenticateWithCredential: jest.fn(),
  reload: jest.fn(),
  sendEmailVerification: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  signInWithCustomToken: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signInWithPopup: jest.fn(),
  signOut: jest.fn(),
  updatePassword: jest.fn(),
  updateProfile: jest.fn(),
}))

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
  getCurrentScope: () => ({ setUser: mockSetSentryUser }),
}))

jest.mock('~helpers/firebase', () => ({
  doc: jest.fn(),
  firebaseDb: {},
  getDoc: jest.fn(async () => ({ exists: () => false })),
  setDoc: jest.fn(),
}))

jest.mock('~i18n', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}))

jest.mock('../agentObservability', () => ({
  appLogger: {
    info: jest.fn(),
    warn: jest.fn(),
  },
}))

jest.mock('../cleanupRegistry', () => ({ runAllCleanups: mockRunAllCleanups }))
jest.mock('../firebaseApp.web', () => ({ firebaseApp: {} }))
jest.mock('../storage', () => ({
  storage: {
    getString: jest.fn(),
    remove: jest.fn(),
    set: jest.fn(),
  },
}))
jest.mock('../toast', () => ({ toast: Object.assign(jest.fn(), { success: jest.fn() }) }))
jest.mock('../TokenManager', () => ({ tokenManager: { reset: mockTokenReset } }))

describe('WebFireAuth auth-state cleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuthStateListener = undefined
  })

  it('clears account state once when an authenticated browser session becomes null', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { WebFireAuth } = require('../FireAuth.web') as typeof import('../FireAuth.web')
    const fireAuth = new WebFireAuth()
    const onLogin = jest.fn()
    const onLogout = jest.fn()

    await fireAuth.init(onLogin, jest.fn(), onLogout, jest.fn(), jest.fn(), {} as never)

    const listener = mockAuthStateListener
    expect(listener).toBeDefined()
    await listener?.({
      uid: 'user-1',
      email: 'reader@example.test',
      emailVerified: true,
      displayName: 'Reader',
      photoURL: null,
      metadata: { creationTime: 'today' },
      providerData: [{ providerId: 'password', displayName: 'Reader', photoURL: null }],
    })

    expect(onLogin).toHaveBeenCalledTimes(1)
    await listener?.(null)
    await listener?.(null)

    expect(mockRunAllCleanups).toHaveBeenCalledTimes(1)
    expect(mockTokenReset).toHaveBeenCalledTimes(1)
    expect(mockSetSentryUser).toHaveBeenLastCalledWith(null)
    expect(onLogout).toHaveBeenCalledTimes(1)
    expect(fireAuth.user).toBeNull()
    expect(fireAuth.profile).toBeNull()
  })
})
