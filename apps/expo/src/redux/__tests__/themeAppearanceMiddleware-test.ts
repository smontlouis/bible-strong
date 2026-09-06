import { Appearance } from 'react-native'

import { applyPreferredColorScheme } from '../themeAppearanceMiddleware'

jest.mock('react-native', () => ({
  Appearance: {
    setColorScheme: jest.fn(),
  },
}))

describe('themeAppearanceMiddleware', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('removes the app-level override when color scheme is auto', () => {
    applyPreferredColorScheme('auto')

    expect(Appearance.setColorScheme).toHaveBeenCalledWith('unspecified')
  })

  it('applies explicit color schemes to Appearance', () => {
    applyPreferredColorScheme('dark')
    applyPreferredColorScheme('light')

    expect(Appearance.setColorScheme).toHaveBeenNthCalledWith(1, 'dark')
    expect(Appearance.setColorScheme).toHaveBeenNthCalledWith(2, 'light')
  })

  it.each(['auto', 'dark', 'light'] as const)(
    'supports %s on runtimes without the native Appearance setter',
    preference => {
      const nativeSetter = Appearance.setColorScheme
      Object.defineProperty(Appearance, 'setColorScheme', { value: undefined, configurable: true })
      try {
        expect(() => applyPreferredColorScheme(preference)).not.toThrow()
      } finally {
        Object.defineProperty(Appearance, 'setColorScheme', { value: nativeSetter })
      }
    }
  )
})
