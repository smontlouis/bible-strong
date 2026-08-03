import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import CompareVersesTabScreen from '../CompareVersesTabScreen'

jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: { verseNumber: 2, versesInCurrentChapter: 16 } }),
}))

jest.mock('jotai/react', () => ({
  useAtom: () => [
    {
      id: 'compare-test',
      title: 'Comparer',
      type: 'compare',
      data: { selectedVerses: { '45-2-2': true } },
    },
    jest.fn(),
  ],
}))

jest.mock('react-redux', () => ({
  shallowEqual: jest.fn(),
  useSelector: () => ['LSG'],
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

jest.mock('~helpers/verseToReference', () => () => 'Romains 2:2')
jest.mock('~helpers/bibleVersions', () => ({ versions: { LSG: { name: 'Louis Segond' } } }))
jest.mock('~helpers/bibleCoverage', () => ({ getMaxChapterVerseCount: jest.fn() }))
jest.mock('~helpers/queryOptions', () => ({ localQueryOptions: {} }))
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
jest.mock('~features/bible/BibleCompareVerseItem', () => ({
  __esModule: true,
  default: mockHostComponent('BibleCompareVerseItem'),
}))
jest.mock('~features/bible/BibleVerseDetailFooter', () => ({
  __esModule: true,
  default: mockHostComponent('BibleVerseDetailFooter'),
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
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    act(() => renderer?.unmount())
    consoleError.mockRestore()
  })

  it('keeps previous and next verse controls inside the padded scroll content', () => {
    act(() => {
      renderer = create(<CompareVersesTabScreen compareAtom={{} as never} />)
    })

    const scrollView = renderer.root.find(node => String(node.type) === 'ScrollView')
    expect(scrollView.props.contentContainerStyle).toEqual(
      expect.objectContaining({ paddingBottom: expect.any(Number) })
    )
    expect(
      scrollView.findAll(node => String(node.type) === 'BibleVerseDetailFooter')
    ).toHaveLength(1)
  })
})
