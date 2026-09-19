import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { atom, getDefaultStore } from 'jotai/vanilla'

import { getBook } from '~helpers/bibleBookCatalog'
import {
  BibleRouteNavigationProvider,
  type BibleRouteNavigationAdapter,
} from '../bibleRouteNavigation'
import {
  getDefaultBibleTab,
  useBibleTabActions,
  type BibleTab,
  type BibleTabActions,
} from '../tabs'

jest.mock('react-native-url-polyfill/auto', () => ({}))
jest.mock('expo-file-system/legacy', () => ({}))

jest.mock('~i18n', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
  getLanguage: () => 'fr',
}))

jest.mock('~helpers/bibleVersions', () => ({
  versions: {
    LSG: { id: 'LSG' },
    KJV: { id: 'KJV' },
    NBS: { id: 'NBS' },
  },
  getBibleVersionCanonId: () => 'protestant-66',
}))

jest.mock('~helpers/bibleCoverage', () => ({
  getNextAvailableChapterLocation: (book: unknown, chapter: number) => ({
    book,
    chapter: chapter + 1,
  }),
  getPreviousAvailableChapterLocation: (book: unknown, chapter: number) => ({
    book,
    chapter: chapter - 1,
  }),
  resolveBibleCoverageCanonId: () => 'protestant-66',
}))

jest.mock('~helpers/atomWithAsyncStorage', () => {
  const { atom: createAtom } = jest.requireActual<typeof import('jotai/vanilla')>('jotai/vanilla')
  return {
    __esModule: true,
    default: (_key: string, initialValue: unknown) => createAtom(initialValue),
  }
})

jest.mock('~helpers/storage', () => ({
  storage: {
    getString: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
    clearAll: jest.fn(),
  },
}))

const adapter: jest.Mocked<BibleRouteNavigationAdapter> = {
  openChapter: jest.fn(),
  replaceWithChapter: jest.fn(),
  changeVersion: jest.fn(),
  changeStrongMode: jest.fn(),
}

describe('Bible route navigation adapter', () => {
  const bibleAtom = atom<BibleTab>(getDefaultBibleTab('LSG'))
  let actions: BibleTabActions
  let renderer: ReactTestRenderer

  const Harness = () => {
    actions = useBibleTabActions(bibleAtom)
    return null
  }

  beforeEach(() => {
    Object.values(adapter).forEach(mock => mock.mockClear())
    getDefaultStore().set(bibleAtom, getDefaultBibleTab('LSG'))
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    act(() => {
      renderer = create(
        <BibleRouteNavigationProvider adapter={adapter}>
          <Harness />
        </BibleRouteNavigationProvider>
      )
    })
  })

  afterEach(() => act(() => renderer.unmount()))

  it('routes version and Strong presentation changes without mutating the tab', () => {
    act(() => actions.setSelectedVersion('NBS'))
    act(() => actions.setStrongMode('visible'))

    expect(adapter.changeVersion).toHaveBeenCalledWith('NBS')
    expect(adapter.changeStrongMode).toHaveBeenCalledWith('visible')
    expect(getDefaultStore().get(bibleAtom).data.selectedVersion).toBe('LSG')
    expect(getDefaultStore().get(bibleAtom).data.strongMode).toBe('hidden')
  })

  it('routes a validated book and chapter selection', () => {
    const john = getBook(43)!
    act(() => {
      actions.setTempSelectedBook(john)
      actions.setTempSelectedChapter(3)
      actions.validateTempSelected()
    })

    expect(adapter.openChapter).toHaveBeenCalledWith(john, 3)
  })

  it('routes chapter traversal and focused-passage clearing', () => {
    act(() => actions.goToNextChapter())
    expect(adapter.openChapter).toHaveBeenCalledWith(getBook(1), 2)

    act(() => actions.clearFocusVerses())
    expect(adapter.replaceWithChapter).toHaveBeenCalledWith(getBook(1), 1)
  })
})
