import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import PlaygroundPreferences, { PLAYGROUND_THEME_OPTIONS } from '../PlaygroundPreferences'

const mockChangeLanguage = jest.fn()
const mockSelectTheme = jest.fn()
let mockLanguage = 'fr'

jest.mock('@emotion/react', () => ({
  useTheme: () => ({ colors: { primary: '#5983f0' } }),
}))

jest.mock('@expo/vector-icons', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  return {
    Feather: (props: Record<string, unknown>) => React.createElement('Feather', props),
  }
})

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: {
      get language() {
        return mockLanguage
      },
      changeLanguage: mockChangeLanguage,
    },
    t: (key: string) => key,
  }),
}))

jest.mock('react-native', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  return {
    Platform: { OS: 'ios' },
    Pressable: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement('Pressable', props, children),
  }
})

jest.mock('~common/ui/Box', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  const MockBox = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('Box', props, children)
  return { __esModule: true, default: MockBox, HStack: MockBox, VStack: MockBox }
})

jest.mock('~common/ui/Text', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  return ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('Text', props, children)
})

describe('PlaygroundPreferences', () => {
  beforeAll(() => {
    ;(
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
  })

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    mockChangeLanguage.mockClear()
    mockSelectTheme.mockClear()
    mockLanguage = 'fr'
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  const renderPreferences = () => {
    let renderer: ReactTestRenderer
    act(() => {
      renderer = create(
        <PlaygroundPreferences selectedTheme="default" onSelectTheme={mockSelectTheme} />
      )
    })
    return renderer!
  }

  it('offers both languages and every application theme', () => {
    const renderer = renderPreferences()
    const findHostByTestId = (testID: string) =>
      renderer.root.findAll(
        node => String(node.type) === 'Pressable' && node.props.testID === testID
      )

    expect(findHostByTestId('playground-language-fr')).toHaveLength(1)
    expect(findHostByTestId('playground-language-en')).toHaveLength(1)
    PLAYGROUND_THEME_OPTIONS.forEach(option => {
      expect(findHostByTestId(`playground-theme-${option.id}`)).toHaveLength(1)
    })

    act(() => renderer.unmount())
  })

  it('changes preview language without resetting resources', () => {
    const renderer = renderPreferences()

    act(() => renderer.root.findByProps({ testID: 'playground-language-en' }).props.onPress())

    expect(mockChangeLanguage).toHaveBeenCalledWith('en')
    expect(mockSelectTheme).not.toHaveBeenCalled()
    act(() => renderer.unmount())
  })

  it('selects light and dark palettes through local preview state', () => {
    const renderer = renderPreferences()

    act(() => renderer.root.findByProps({ testID: 'playground-theme-sepia' }).props.onPress())
    expect(mockSelectTheme).toHaveBeenCalledWith('sepia')

    mockSelectTheme.mockClear()
    act(() => renderer.root.findByProps({ testID: 'playground-theme-night' }).props.onPress())
    expect(mockSelectTheme).toHaveBeenCalledWith('night')

    act(() => renderer.unmount())
  })
})
