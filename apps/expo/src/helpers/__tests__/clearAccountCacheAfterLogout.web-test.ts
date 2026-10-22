const mockCalls: string[] = []
const mockClearIndexedDbPersistence = jest.fn(async () => {
  mockCalls.push('clear')
})

jest.mock('firebase/firestore', () => ({
  terminate: jest.fn(async () => {
    mockCalls.push('terminate')
  }),
  clearIndexedDbPersistence: () => mockClearIndexedDbPersistence(),
}))
jest.mock('~redux/store', () => ({
  persistor: {
    flush: jest.fn(async () => {
      mockCalls.push('flush')
    }),
  },
}))
jest.mock('../firebase', () => ({ firebaseDb: {} }))

describe('clearAccountCacheAfterLogout on the web', () => {
  const globalWithWindow = globalThis as unknown as { window?: unknown }
  const originalWindow = globalWithWindow.window
  const reload = jest.fn(() => {
    mockCalls.push('reload')
  })

  beforeEach(() => {
    mockCalls.length = 0
    jest.clearAllMocks()
    globalWithWindow.window = { location: { reload } }
  })

  afterAll(() => {
    globalWithWindow.window = originalWindow
  })

  it('saves the signed-out state, empties the Firestore cache, then reloads the page', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { clearAccountCacheAfterLogout } = require('../clearAccountCacheAfterLogout.web')
    await clearAccountCacheAfterLogout()

    expect(mockCalls).toEqual(['flush', 'terminate', 'clear', 'reload'])
  })

  it('still reloads when another tab keeps the cache open', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    mockClearIndexedDbPersistence.mockRejectedValueOnce(new Error('failed-precondition'))
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { clearAccountCacheAfterLogout } = require('../clearAccountCacheAfterLogout.web')
    await clearAccountCacheAfterLogout()

    expect(mockCalls).toEqual(['flush', 'terminate', 'reload'])
  })
})
