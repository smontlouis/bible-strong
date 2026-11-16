jest.mock('@react-native-firebase/remote-config', () => {
  throw new Error('Native Remote Config must not run in the browser')
})

describe('web store review flag', () => {
  it('stays disabled without importing native network polyfills', () => {
    const originalHeaders = globalThis.Headers
    const originalResponse = globalThis.Response
    const { useStoreReviewing } = require('../storeReviewing.web')

    expect(useStoreReviewing()).toBe(false)
    expect(globalThis.Headers).toBe(originalHeaders)
    expect(globalThis.Response).toBe(originalResponse)
  })
})
