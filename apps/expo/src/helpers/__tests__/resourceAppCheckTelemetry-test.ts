const mockLog = jest.fn()
const mockSubscribe = jest.fn()
jest.mock('@sentry/react-native', () => ({
  logger: { info: (...args: unknown[]) => mockLog(...args) },
}))
jest.mock('react-native', () => ({
  Platform: { OS: 'android', Version: 28 },
  AppState: { addEventListener: (...args: unknown[]) => mockSubscribe(...args) },
}))
jest.mock('expo-application', () => ({
  nativeApplicationVersion: '27.0.18',
  nativeBuildVersion: '508',
}))

describe('App Check aggregate telemetry', () => {
  let telemetry: typeof import('../resourceAppCheckTelemetry')
  const originalDev = Object.getOwnPropertyDescriptor(globalThis, '__DEV__')
  beforeEach(async () => {
    jest.resetModules()
    jest.useFakeTimers()
    jest.clearAllMocks()
    Object.defineProperty(globalThis, '__DEV__', { configurable: true, value: false })
    telemetry = await import('../resourceAppCheckTelemetry')
  })
  afterEach(() => {
    jest.useRealTimers()
    if (originalDev) Object.defineProperty(globalThis, '__DEV__', originalDev)
  })
  const observation = {
    provider: 'recaptchaEnterprise',
    outcome: 'success' as const,
    phase: 'acquire' as const,
    forceRefresh: false,
    durationMs: 10,
  }
  it('aggregates all observations without sampling and flushes once per minute', () => {
    for (let i = 0; i < 100; i++) telemetry.recordAppCheckObservation(observation)
    expect(mockLog).not.toHaveBeenCalled()
    jest.advanceTimersByTime(60000)
    expect(mockLog).toHaveBeenCalledTimes(1)
    expect(mockLog).toHaveBeenCalledWith(
      'resource_app_check.summary',
      expect.objectContaining({ count: 100, durationTotalMs: 1000, buildNumber: '508' })
    )
    telemetry.flushAppCheckTelemetry()
    expect(mockLog).toHaveBeenCalledTimes(1)
    expect(mockSubscribe).toHaveBeenCalledTimes(1)
  })
  it('flushes on background, keeps outcomes separate, and tolerates logging failures', () => {
    telemetry.recordAppCheckObservation(observation)
    telemetry.recordAppCheckObservation({ ...observation, outcome: 'failure' })
    mockSubscribe.mock.calls[0][1]('background')
    expect(mockLog).toHaveBeenCalledTimes(2)
    jest.advanceTimersByTime(60000)
    expect(mockLog).toHaveBeenCalledTimes(2)
    mockLog.mockImplementationOnce(() => {
      throw new Error('transport failed')
    })
    telemetry.recordAppCheckObservation(observation)
    expect(() => telemetry.flushAppCheckTelemetry()).not.toThrow()
  })
  it('drops unrelated logs and strips automatic user and arbitrary attributes', () => {
    expect(telemetry.filterAppCheckLog({ level: 'info', message: 'unrelated' })).toBeNull()
    expect(
      telemetry.filterAppCheckLog({
        level: 'info',
        message: 'resource_app_check.summary',
        attributes: {
          count: 1,
          'sentry.release': 'release',
          'user.id': 'private',
          email: 'private',
          token: 'secret',
          arbitrary: 'secret',
        },
      })
    ).toEqual({
      level: 'info',
      message: 'resource_app_check.summary',
      attributes: { count: 1, 'sentry.release': 'release' },
    })
  })
})
