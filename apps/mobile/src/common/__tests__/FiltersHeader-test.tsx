import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import FiltersHeader, { type FiltersHeaderItem } from '../FiltersHeader'

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) => {
      if (key === 'filters.activeCount_one') return `${options?.count} filter`
      if (key === 'filters.activeCount_other') return `${options?.count} filters`
      if (key === 'Réinitialiser') return 'Reset'
      return key
    },
  }),
}))

jest.mock('react-native', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    TouchableOpacity: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement('TouchableOpacity', props, children),
  }
})

jest.mock('~common/Back', () => ({
  __esModule: true,
  default: ({ children }: React.PropsWithChildren) => <>{children}</>,
}))

jest.mock('~common/ui/Box', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  const Box = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    ReactModule.createElement('Box', props, children)
  const HStack = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    ReactModule.createElement('HStack', props, children)

  return { __esModule: true, default: Box, HStack }
})

jest.mock('~common/ui/Icon', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    FeatherIcon: (props: Record<string, unknown>) =>
      ReactModule.createElement('FeatherIcon', props),
  }
})

jest.mock('~common/ui/Text', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    __esModule: true,
    default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement('Text', props, children),
  }
})

jest.mock('~common/sheet', () => {
  return {
    Sheet: ({ children, header }: React.PropsWithChildren<{ header?: React.ReactNode }>) => (
      <>
        {header}
        {children}
      </>
    ),
    SheetHeader: ({ rightComponent }: { rightComponent?: React.ReactNode }) => (
      <>{rightComponent}</>
    ),
    SheetView: ({ children }: React.PropsWithChildren) => <>{children}</>,
  }
})

const createFilter = (
  key: string,
  icon: FiltersHeaderItem['icon'],
  active = false
): FiltersHeaderItem => ({
  key,
  icon,
  active,
  label: key,
  onPress: jest.fn(),
})

describe('FiltersHeader', () => {
  let renderer: ReactTestRenderer
  let consoleError: jest.SpyInstance

  beforeEach(() => {
    ;(
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
    consoleError = jest.spyOn(console, 'error').mockImplementation((message, ...args) => {
      if (typeof message === 'string' && message.startsWith('react-test-renderer is deprecated')) {
        return
      }
      console.warn(message, ...args)
    })
  })

  afterEach(() => {
    act(() => renderer?.unmount())
    consoleError.mockRestore()
  })

  const renderHeader = (filters: FiltersHeaderItem[], onReset = jest.fn()) => {
    act(() => {
      renderer = create(<FiltersHeader title="Versions" filters={filters} onReset={onReset} />)
    })
    return onReset
  }

  it('shows the default label and no reset action without active filters', () => {
    renderHeader([createFilter('search', 'search')])

    expect(renderer.root.findByProps({ accessibilityLabel: 'Filtrer' })).toBeTruthy()
    expect(renderer.root.findAllByProps({ children: 'Reset' })).toHaveLength(0)
  })

  it('shows the active filter icon and a singular accessibility label', () => {
    renderHeader([createFilter('search', 'search', true), createFilter('sort', 'list')])

    expect(renderer.root.findByProps({ accessibilityLabel: '1 filter' })).toBeTruthy()
    expect(
      renderer.root.findAll(
        node =>
          String(node.type) === 'FeatherIcon' &&
          node.props.name === 'search' &&
          node.props.size === 14
      )
    ).toHaveLength(1)
    expect(
      renderer.root.findAll(node => String(node.type) === 'Text' && node.props.children === 'Reset')
    ).toHaveLength(1)
  })

  it('shows only the active-filter count when several filters are active', () => {
    renderHeader([createFilter('search', 'search', true), createFilter('sort', 'list', true)])

    expect(renderer.root.findByProps({ accessibilityLabel: '2 filters' })).toBeTruthy()
    expect(
      renderer.root.findAll(node => String(node.type) === 'Text' && node.props.children === 2)
    ).toHaveLength(1)
    expect(
      renderer.root.findAll(
        node =>
          String(node.type) === 'FeatherIcon' &&
          node.props.name === 'search' &&
          node.props.size === 14
      )
    ).toHaveLength(0)
  })

  it('colors an active filter icon and label with the primary color', () => {
    renderHeader([createFilter('order', 'list', true), createFilter('tags', 'tag')])

    expect(
      renderer.root.find(
        node =>
          String(node.type) === 'FeatherIcon' &&
          node.props.name === 'list' &&
          node.props.size === 20
      ).props.color
    ).toBe('primary')
    expect(renderer.root.findByProps({ children: 'order' }).props.color).toBe('primary')

    expect(
      renderer.root.find(
        node =>
          String(node.type) === 'FeatherIcon' && node.props.name === 'tag' && node.props.size === 20
      ).props.color
    ).toBe('tertiary')
    expect(renderer.root.findByProps({ children: 'tags' }).props.color).toBeUndefined()
  })

  it('uses the same active state to expose and run reset', () => {
    const onReset = renderHeader([createFilter('search', 'search', true)])
    const resetButton = renderer.root.find(
      node => String(node.type) === 'TouchableOpacity' && node.props.onPress === onReset
    )

    act(() => resetButton.props.onPress())

    expect(onReset).toHaveBeenCalledTimes(1)
  })
})
