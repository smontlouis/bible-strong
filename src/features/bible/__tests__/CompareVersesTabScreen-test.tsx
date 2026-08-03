import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import CompareVersesTabScreen from '../CompareVersesTabScreen'

const mockSetCompareTab = jest.fn()

jest.mock('jotai/react', () => ({
  useAtom: () => [
    {
      id: 'compare-test',
      title: 'Comparer',
      type: 'compare',
      data: { selectedVerses: { '45-2-2': true } },
    },
    mockSetCompareTab,
  ],
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

jest.mock('~helpers/verseToReference', () => () => 'Romains 2:2')
jest.mock('~features/app-switcher/utils/useOpenInNewTab', () => ({
  useOpenInNewTab: () => jest.fn(),
}))

function mockHostComponent(name: string) {
  const ReactModule = jest.requireActual<typeof React>('react')
  return ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    ReactModule.createElement(name, props, children)
}

jest.mock('~common/ui/Container', () => ({
  __esModule: true,
  default: mockHostComponent('Container'),
}))
jest.mock('~common/Header', () => ({ __esModule: true, default: mockHostComponent('Header') }))
jest.mock('~common/ui/ScrollView', () => ({
  __esModule: true,
  default: mockHostComponent('ScrollView'),
}))
jest.mock('~common/ui/Box', () => ({ __esModule: true, default: mockHostComponent('Box') }))
jest.mock('~common/Empty', () => ({ __esModule: true, default: mockHostComponent('Empty') }))
jest.mock('../resources/CompareCard', () => ({
  __esModule: true,
  default: mockHostComponent('CompareCard'),
}))
jest.mock('../CompareVersionSelectorSheet', () => ({
  __esModule: true,
  default: mockHostComponent('CompareVersionSelectorSheet'),
}))
jest.mock(
  '~common/ui/MenuView',
  () => {
    const ReactModule = jest.requireActual<typeof React>('react')
    return {
      MenuView: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
        ReactModule.createElement('MenuView', props, children),
    }
  },
  { virtual: true }
)
jest.mock('~common/ui/Icon', () => ({ FeatherIcon: mockHostComponent('FeatherIcon') }))

describe('CompareVersesTabScreen', () => {
  let renderer: ReactTestRenderer
  let consoleError: jest.SpyInstance

  beforeEach(() => {
    mockSetCompareTab.mockClear()
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    act(() => renderer?.unmount())
    consoleError.mockRestore()
  })

  it('keeps comparison content inside the padded scroll area', () => {
    act(() => {
      renderer = create(<CompareVersesTabScreen compareAtom={{} as never} />)
    })

    const scrollView = renderer.root.find(node => String(node.type) === 'ScrollView')
    expect(scrollView.props.contentContainerStyle).toEqual(
      expect.objectContaining({ paddingBottom: expect.any(Number) })
    )
    expect(scrollView.findAll(node => String(node.type) === 'CompareCard')).toHaveLength(1)
  })

  it('exposes a Strong mode toggle that updates the comparison tab', () => {
    act(() => {
      renderer = create(<CompareVersesTabScreen compareAtom={{} as never} />)
    })

    const header = renderer.root.find(node => String(node.type) === 'Header')
    const menu = header.props.rightComponent
    expect(menu.props.actions).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'toggle-strong', state: 'off' })])
    )

    act(() => menu.props.onPressAction({ nativeEvent: { event: 'toggle-strong' } }))

    const update = mockSetCompareTab.mock.calls.at(-1)?.[0]
    expect(
      update({
        id: 'compare-test',
        title: 'Comparer',
        type: 'compare',
        data: { selectedVerses: { '45-2-2': true } },
      }).data.strongMode
    ).toBe(true)
  })
})
