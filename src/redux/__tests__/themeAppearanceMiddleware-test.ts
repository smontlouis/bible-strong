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
})
