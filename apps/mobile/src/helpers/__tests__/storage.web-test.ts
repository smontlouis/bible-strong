describe('web storage', () => {
  beforeEach(() => {
    jest.resetModules()
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: (() => {
        const values = new Map<string, string>()
        return {
          clear: () => values.clear(),
          getItem: (key: string) => values.get(key) ?? null,
          removeItem: (key: string) => values.delete(key),
          setItem: (key: string, value: string) => values.set(key, value),
        }
      })(),
    })
  })

  it('persists synchronous values and exposes the Redux persistence adapter', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mmkvStorage, storage } = require('../storage.web') as typeof import('../storage.web')

    storage.set('theme', 'night')
    storage.set('onboarding', true)
    storage.set('fontSize', 18)

    expect(storage.getString('theme')).toBe('night')
    expect(storage.getBoolean('onboarding')).toBe(true)
    expect(storage.getNumber('fontSize')).toBe(18)

    await mmkvStorage.setItem('root', '{"ready":true}')
    expect(await mmkvStorage.getItem('root')).toBe('{"ready":true}')

    storage.remove('theme')
    expect(storage.getString('theme')).toBeUndefined()
  })

  it('falls back to memory when localStorage is unavailable', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => undefined,
    })
    jest.resetModules()

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { storage } = require('../storage.web') as typeof import('../storage.web')

    storage.set('theme', 'night')
    expect(storage.getString('theme')).toBe('night')
    storage.remove('theme')
    expect(storage.getString('theme')).toBeUndefined()
  })
})
