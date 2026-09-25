const mockGetToken = jest.fn()
const mockInitialize = jest.fn()
const mockCaptureError = jest.fn()
const mockFetch = jest.fn()

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }))
jest.mock('@react-native-firebase/app', () => ({ getApp: jest.fn(() => ({})) }))
jest.mock('../../../modules/bible-strong-app-check/src/BibleStrongAppCheckModule', () => ({
  __esModule: true,
  default: null,
}))
jest.mock('@react-native-firebase/app-check', () => ({
  getToken: (...args: unknown[]) => mockGetToken(...args),
  initializeAppCheck: (...args: unknown[]) => mockInitialize(...args),
  ReactNativeFirebaseAppCheckProvider: class {
    configure() {}
  },
}))
jest.mock('../agentObservability', () => ({
  appLogger: { captureError: (...args: unknown[]) => mockCaptureError(...args) },
}))

const apiUrl = 'https://api.bible-strong.app/v1/bibles/LSG/books/1/chapters/1'
const artifactUrl = 'https://api.bible-strong.app/v1/offline-artifacts/bibles/bible-lsg.json.zip'
const nativeError = (message: string) =>
  Object.assign(new Error(message), { code: 'appCheck/token-error' })
const deferredToken = () => {
  let resolve!: (value: { token: string }) => void
  let reject!: (error: Error) => void
  const promise = new Promise<{ token: string }>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, resolve, reject }
}

describe('Native Resource App Check token acquisition', () => {
  const originalFetch = globalThis.fetch
  const originalDev = Object.getOwnPropertyDescriptor(globalThis, '__DEV__')
  let appCheck: typeof import('../resourceAppCheck')

  beforeEach(async () => {
    jest.resetModules()
    jest.useFakeTimers({ now: 1_000 })
    mockGetToken.mockReset().mockResolvedValue({ token: 'valid-token' })
    mockInitialize.mockReset().mockResolvedValue({})
    mockCaptureError.mockReset()
    mockFetch.mockReset().mockImplementation(async () => new Response('{}', { status: 200 }))
    globalThis.fetch = mockFetch
    Object.defineProperty(globalThis, '__DEV__', { configurable: true, value: false })
    appCheck = await import('../resourceAppCheck')
  })

  afterEach(() => {
    jest.useRealTimers()
    globalThis.fetch = originalFetch
    if (originalDev) Object.defineProperty(globalThis, '__DEV__', originalDev)
    else Reflect.deleteProperty(globalThis, '__DEV__')
  })

  it('shares one SDK request across simultaneous API reads and artifact downloads', async () => {
    await Promise.all([
      ...Array.from({ length: 10 }, () => appCheck.resourceApiFetch(apiUrl)),
      ...Array.from({ length: 10 }, () => appCheck.getResourceDownloadAppCheckToken(artifactUrl)),
    ])

    expect(mockGetToken).toHaveBeenCalledTimes(1)
    expect(mockGetToken).toHaveBeenCalledWith(expect.anything(), false)
    expect(mockFetch).toHaveBeenCalledTimes(10)
    expect(mockCaptureError).not.toHaveBeenCalled()
  })

  it('preserves the initial refusal and suppresses calls and duplicate reports during cooldown', async () => {
    const refusal = nativeError('Error returned from API. code: 403 body: App attestation failed.')
    mockGetToken.mockRejectedValueOnce(refusal)
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => appCheck.resourceApiFetch(apiUrl))
    )
    expect(results.every(result => result.status === 'rejected')).toBe(true)
    await expect(appCheck.getResourceAppCheckToken()).rejects.toMatchObject({ cause: refusal })
    await expect(appCheck.getResourceAppCheckToken(true)).rejects.toMatchObject({ cause: refusal })
    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockGetToken).toHaveBeenCalledTimes(1)
    expect(mockCaptureError).toHaveBeenCalledTimes(1)

    await jest.advanceTimersByTimeAsync(2_000)
    await expect(appCheck.getResourceAppCheckToken()).resolves.toBe('valid-token')
    expect(mockGetToken).toHaveBeenCalledTimes(2)
  })

  it('shares a forced refresh when simultaneous reads receive 401', async () => {
    mockGetToken.mockImplementation(async (_app, force) => ({ token: force ? 'fresh' : 'cached' }))
    mockFetch.mockImplementation(
      async (_url, init) =>
        new Response(null, {
          status: new Headers(init.headers).get('X-Firebase-AppCheck') === 'fresh' ? 200 : 401,
        })
    )

    const responses = await Promise.all(
      Array.from({ length: 10 }, () => appCheck.resourceApiFetch(apiUrl))
    )
    expect(responses.every(response => response.status === 200)).toBe(true)
    expect(mockGetToken.mock.calls.map(call => call[1])).toEqual([false, true])
  })

  it('queues one forced refresh behind a normal lookup, and lets normal callers join that refresh', async () => {
    const normal = deferredToken()
    const refresh = deferredToken()
    mockGetToken.mockReturnValueOnce(normal.promise).mockReturnValueOnce(refresh.promise)
    const lookup = appCheck.getResourceAppCheckToken()
    const forced = Array.from({ length: 5 }, () => appCheck.getResourceAppCheckToken(true))
    normal.resolve({ token: 'cached' })
    await expect(lookup).resolves.toBe('cached')
    await jest.advanceTimersByTimeAsync(0)
    const joining = appCheck.getResourceAppCheckToken()
    refresh.resolve({ token: 'fresh' })
    await expect(Promise.all([...forced, joining])).resolves.toEqual(Array(6).fill('fresh'))
    expect(mockGetToken.mock.calls.map(call => call[1])).toEqual([false, true])
  })

  it('does not run a queued forced refresh after the normal lookup fails', async () => {
    const normal = deferredToken()
    const refusal = nativeError('App attestation failed.')
    mockGetToken.mockReturnValueOnce(normal.promise)
    const results = Promise.allSettled([
      appCheck.getResourceAppCheckToken(),
      appCheck.getResourceAppCheckToken(true),
    ])
    normal.reject(refusal)
    expect(await results).toEqual([
      expect.objectContaining({
        status: 'rejected',
        reason: expect.objectContaining({ cause: refusal }),
      }),
      expect.objectContaining({
        status: 'rejected',
        reason: expect.objectContaining({ cause: refusal }),
      }),
    ])
    expect(mockGetToken).toHaveBeenCalledTimes(1)
    expect(mockCaptureError).toHaveBeenCalledTimes(1)
  })

  it('backs off up to 30 seconds, retains the first error through throttling and resets after success', async () => {
    const refusal = nativeError('Error returned from API. code: 403 body: App attestation failed.')
    const throttle = nativeError('Too many attempts.')
    mockGetToken.mockRejectedValue(throttle).mockRejectedValueOnce(refusal)

    for (const [index, delay] of [2_000, 4_000, 8_000, 16_000, 30_000, 30_000].entries()) {
      await expect(appCheck.getResourceAppCheckToken()).rejects.toBeInstanceOf(
        appCheck.ResourceAppCheckError
      )
      expect(mockCaptureError).toHaveBeenLastCalledWith(
        'download',
        'resource_app_check.token_failed',
        index === 0 ? refusal : throttle,
        expect.objectContaining({
          consecutiveFailures: index + 1,
          retryAfterMs: delay,
          initialFailure: refusal,
        })
      )
      await jest.advanceTimersByTimeAsync(delay - 1)
      await expect(appCheck.getResourceAppCheckToken(true)).rejects.toBeInstanceOf(
        appCheck.ResourceAppCheckError
      )
      expect(mockGetToken).toHaveBeenCalledTimes(index + 1)
      await jest.advanceTimersByTimeAsync(1)
    }

    mockGetToken.mockResolvedValueOnce({ token: 'recovered' })
    await expect(appCheck.getResourceAppCheckToken()).resolves.toBe('recovered')
    await expect(appCheck.getResourceAppCheckToken()).rejects.toMatchObject({ cause: throttle })
    expect(mockCaptureError).toHaveBeenLastCalledWith(
      'download',
      'resource_app_check.token_failed',
      throttle,
      expect.objectContaining({
        consecutiveFailures: 1,
        retryAfterMs: 2_000,
        initialFailure: throttle,
      })
    )
  })

  it('can recover from a rejected initialization after cooldown', async () => {
    mockInitialize.mockRejectedValueOnce(new Error('Initialization failed'))
    await expect(appCheck.getResourceAppCheckToken()).rejects.toThrow()
    expect(mockGetToken).not.toHaveBeenCalled()
    await jest.advanceTimersByTimeAsync(2_000)
    await expect(appCheck.getResourceAppCheckToken()).resolves.toBe('valid-token')
    expect(mockInitialize).toHaveBeenCalledTimes(2)
  })

  it('keeps expiry management with the SDK and refuses empty tokens', async () => {
    await expect(appCheck.getResourceAppCheckToken()).resolves.toBe('valid-token')
    mockGetToken.mockResolvedValueOnce({ token: 'renewed-by-sdk' })
    await expect(appCheck.getResourceAppCheckToken()).resolves.toBe('renewed-by-sdk')
    mockGetToken.mockResolvedValueOnce({ token: '' })
    await expect(appCheck.resourceApiFetch(apiUrl)).rejects.toThrow(
      'RESOURCE_APP_CHECK_TOKEN_FAILED'
    )
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
