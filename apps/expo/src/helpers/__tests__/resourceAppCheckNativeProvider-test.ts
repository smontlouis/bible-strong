import { Platform } from 'react-native'
import {
  getResourceAppCheckProviderName,
  initializeResourceAppCheckClient,
} from '../resourceAppCheckNativeProvider'

const mockNativeInitialize = jest.fn()
const mockNativeGetToken = jest.fn()
const mockConfigure = jest.fn()
const mockInitializeAppCheck = jest.fn()
const mockGetToken = jest.fn()
let mockProvider: 'recaptchaEnterprise' | 'playIntegrity' | undefined

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }))
jest.mock('@react-native-firebase/app', () => ({ getApp: () => ({ name: '[DEFAULT]' }) }))
jest.mock('@react-native-firebase/app-check', () => ({
  initializeAppCheck: (...args: unknown[]) => mockInitializeAppCheck(...args),
  getToken: (...args: unknown[]) => mockGetToken(...args),
  ReactNativeFirebaseAppCheckProvider: class {
    configure(options: unknown) {
      mockConfigure(options)
    }
  },
}))
jest.mock('../../../modules/bible-strong-app-check/src/BibleStrongAppCheckModule', () => ({
  __esModule: true,
  get default() {
    return mockProvider
      ? { provider: mockProvider, initialize: mockNativeInitialize, getToken: mockNativeGetToken }
      : null
  },
}))

describe('Build-selected native App Check provider', () => {
  const originalOs = Platform.OS
  const originalDev = Object.getOwnPropertyDescriptor(globalThis, '__DEV__')

  beforeEach(() => {
    jest.clearAllMocks()
    Platform.OS = 'android'
    Object.defineProperty(globalThis, '__DEV__', { configurable: true, value: false })
    mockProvider = 'recaptchaEnterprise'
    mockNativeInitialize.mockResolvedValue(undefined)
    mockNativeGetToken.mockResolvedValue({ token: 'native-app-check-token' })
    mockInitializeAppCheck.mockResolvedValue({ name: 'rnfb-app-check' })
    mockGetToken.mockResolvedValue({ token: 'legacy-app-check-token' })
  })

  afterEach(() => {
    Platform.OS = originalOs
    if (originalDev) Object.defineProperty(globalThis, '__DEV__', originalDev)
  })

  it('uses the beta provider without overwriting its native Firebase factory', async () => {
    const client = await initializeResourceAppCheckClient()
    await expect(client.getToken(false)).resolves.toEqual({ token: 'native-app-check-token' })
    await client.getToken(true)
    expect(mockNativeInitialize).toHaveBeenCalledWith('[DEFAULT]')
    expect(mockNativeGetToken.mock.calls).toEqual([[false], [true]])
    expect(mockInitializeAppCheck).not.toHaveBeenCalled()
    expect(mockGetToken).not.toHaveBeenCalled()
    expect(getResourceAppCheckProviderName()).toBe('recaptchaEnterprise')
  })

  it.each([undefined, 'playIntegrity'] as const)(
    'preserves Play Integrity for an older or standard binary (%s)',
    async provider => {
      mockProvider = provider
      const client = await initializeResourceAppCheckClient()
      await expect(client.getToken(false)).resolves.toEqual({ token: 'legacy-app-check-token' })
      expect(mockConfigure).toHaveBeenCalledWith(
        expect.objectContaining({ android: { provider: 'playIntegrity' } })
      )
      expect(mockNativeInitialize).not.toHaveBeenCalled()
      expect(getResourceAppCheckProviderName()).toBe('playIntegrity')
    }
  )

  it('keeps the Apple provider on iOS', async () => {
    Platform.OS = 'ios'
    await initializeResourceAppCheckClient()
    expect(mockConfigure).toHaveBeenCalledWith(
      expect.objectContaining({ apple: { provider: 'appAttestWithDeviceCheckFallback' } })
    )
    expect(mockNativeInitialize).not.toHaveBeenCalled()
  })

  it('uses debug attestation in development even with the beta module installed', async () => {
    Object.defineProperty(globalThis, '__DEV__', { configurable: true, value: true })
    await initializeResourceAppCheckClient()
    expect(mockConfigure).toHaveBeenCalledWith({
      android: { provider: 'debug' },
      apple: { provider: 'debug' },
    })
    expect(mockNativeInitialize).not.toHaveBeenCalled()
    expect(getResourceAppCheckProviderName()).toBe('debug')
  })

  it('propagates initialization and token failures instead of silently changing provider', async () => {
    const refusal = new Error('App attestation failed')
    mockNativeInitialize.mockRejectedValueOnce(refusal)
    await expect(initializeResourceAppCheckClient()).rejects.toBe(refusal)
    const client = await initializeResourceAppCheckClient()
    mockNativeGetToken.mockRejectedValueOnce(refusal)
    await expect(client.getToken(false)).rejects.toBe(refusal)
    expect(mockInitializeAppCheck).not.toHaveBeenCalled()
  })
})
