jest.mock('expo/virtual/env', () => ({ env: process.env }))
const mockLogEvent = jest.fn()
const mockSetUserId = jest.fn()
const mockInitializeAnalytics = jest.fn(() => ({}))
const mockIsSupported = jest.fn(async () => true)
jest.mock('firebase/analytics', () => ({
  isSupported: mockIsSupported,
  initializeAnalytics: mockInitializeAnalytics,
  logEvent: mockLogEvent,
  setUserId: mockSetUserId,
}))
jest.mock('../firebaseApp.web', () => ({ firebaseApp: { options: { measurementId: 'G-TEST' } } }))
jest.mock('../agentObservability', () => ({ appLogger: { warn: jest.fn() } }))

describe('browser analytics', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    process.env.EXPO_PUBLIC_ANALYTICS_DEBUG = 'true'
    mockIsSupported.mockResolvedValue(true)
    Object.defineProperty(globalThis, 'window', {
      value: { location: { origin: 'https://example.test', search: '?private=value' } },
      configurable: true,
    })
  })
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_ANALYTICS_DEBUG
  })

  it('initializes once, disables automatic page views, and sends sanitized SPA pages', async () => {
    const { trackAnalyticsScreen, identifyAnalyticsUser } = await import('../analytics.web')
    await identifyAnalyticsUser('uid')
    await trackAnalyticsScreen(['(app)', 'notes', '[id]'])
    await trackAnalyticsScreen(['search'])
    await identifyAnalyticsUser(null)
    expect(mockInitializeAnalytics).toHaveBeenCalledTimes(1)
    expect(mockInitializeAnalytics).toHaveBeenCalledWith(expect.anything(), {
      config: { send_page_view: false },
    })
    expect(mockLogEvent).toHaveBeenCalledWith(expect.anything(), 'page_view', {
      page_title: '[id]',
      page_location: 'https://example.test/notes/[id]',
      page_path: '/notes/[id]',
      debug_mode: true,
    })
    expect(mockSetUserId).toHaveBeenLastCalledWith(expect.anything(), null)
  })

  it('does not initialize in an unsupported browser', async () => {
    mockIsSupported.mockResolvedValue(false)
    const { trackAnalyticsScreen } = await import('../analytics.web')
    await expect(trackAnalyticsScreen(['index'])).resolves.toBeUndefined()
    expect(mockInitializeAnalytics).not.toHaveBeenCalled()
  })

  it('isolates a blocked SDK from navigation and authentication', async () => {
    mockIsSupported.mockRejectedValue(new Error('blocked'))
    const { trackAnalyticsScreen, identifyAnalyticsUser } = await import('../analytics.web')
    await expect(trackAnalyticsScreen(['index'])).resolves.toBeUndefined()
    await expect(identifyAnalyticsUser(null)).resolves.toBeUndefined()
  })
})
