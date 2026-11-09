const mockSet = jest.fn()
const mockInvoke = jest.fn((..._args: unknown[]) => Promise.resolve())
let mockTheme = 'dark'
let mockPreferredColorScheme: string | undefined = 'dark'

jest.mock('~helpers/useCurrentThemeSelector', () => () => ({ theme: mockTheme }))
jest.mock('react-redux', () => ({
  useSelector: (select: (state: unknown) => unknown) =>
    select({ user: { bible: { settings: { preferredColorScheme: mockPreferredColorScheme } } } }),
}))
jest.mock('~helpers/storage.desktop', () => ({
  storage: { set: (...args: unknown[]) => mockSet(...args) },
}))
jest.mock('~helpers/agentObservability', () => ({ appLogger: { warn: jest.fn() } }))
jest.mock('../bridge', () => ({ invoke: (...args: unknown[]) => mockInvoke(...args) }))
// The palettes themselves; the theme index also loads React Native, which this suite does not.
jest.mock('~themes/index', () => {
  const colors = jest.requireActual('../../themes/colors').default
  return {
    __esModule: true,
    baseTheme: { colors },
    default: {
      dark: { colors: jest.requireActual('../../themes/darkColors').default },
      sepia: { colors: jest.requireActual('../../themes/sepiaColors').default },
    },
  }
})

import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import { APPEARANCE_KEY, useDesktopAppearance } from '../useDesktopAppearance'

const Probe = () => {
  useDesktopAppearance()
  return null
}

describe('the window ground and title bar follow the theme', () => {
  beforeAll(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  })

  beforeEach(() => {
    mockSet.mockClear()
    mockInvoke.mockClear()
    mockPreferredColorScheme = 'dark'
  })

  it('stores the dark ground for the next launch and paints the window with it', () => {
    mockTheme = 'dark'
    act(() => {
      create(<Probe />)
    })
    expect(mockSet).toHaveBeenCalledWith(
      APPEARANCE_KEY,
      JSON.stringify({ background: '#0e1521', scheme: 'dark', followsSystem: false })
    )
    expect(mockInvoke).toHaveBeenCalledWith('window_set_appearance', {
      color: '#0e1521',
      scheme: 'dark',
      followsSystem: false,
    })
  })

  it('follows a change to a light theme', () => {
    mockTheme = 'dark'
    mockPreferredColorScheme = 'light'
    let renderer: ReactTestRenderer | undefined
    act(() => {
      renderer = create(<Probe />)
    })
    mockTheme = 'sepia'
    act(() => {
      renderer?.update(<Probe />)
    })
    expect(mockSet).toHaveBeenLastCalledWith(
      APPEARANCE_KEY,
      JSON.stringify({ background: 'rgb(245,242,227)', scheme: 'light', followsSystem: false })
    )
    expect(mockInvoke).toHaveBeenLastCalledWith('window_set_appearance', {
      color: 'rgb(245,242,227)',
      scheme: 'light',
      followsSystem: false,
    })
  })

  it('leaves the title bar to the system when the theme follows the system', () => {
    mockTheme = 'dark'
    for (const preference of ['auto', undefined]) {
      mockPreferredColorScheme = preference
      act(() => {
        create(<Probe />)
      })
      expect(mockInvoke).toHaveBeenLastCalledWith('window_set_appearance', {
        color: '#0e1521',
        scheme: 'dark',
        followsSystem: true,
      })
    }
  })
})
