import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { VersionCatalogList } from '../VersionCatalogView'
import type { VersionCatalogSection } from '../versionCatalog'

const mockScrollToLocation = jest.fn()
const mockScrollTo = jest.fn()

jest.mock('react-native', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  return {
    SectionList: React.forwardRef(
      (
        { children, ...props }: React.PropsWithChildren<Record<string, unknown>>,
        ref: React.ForwardedRef<unknown>
      ) => {
        React.useImperativeHandle(ref, () => ({
          getScrollResponder: () => ({ scrollTo: mockScrollTo }),
          scrollToLocation: mockScrollToLocation,
        }))
        return React.createElement('SectionList', props, children)
      }
    ),
    TouchableOpacity: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement('TouchableOpacity', props, children),
  }
})

jest.mock('expo-router', () => ({
  useNavigation: () => ({ addListener: jest.fn(() => jest.fn()) }),
}))

jest.mock('jotai/react', () => ({
  useAtom: () => ['language', jest.fn()],
  useAtomValue: () => 0,
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

jest.mock('~common/ui/Box', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  return ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('Box', props, children)
})

jest.mock('~common/ui/Text', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  return ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('Text', props, children)
})

jest.mock('~common/ui/Icon', () => ({
  FeatherIcon: () => null,
}))

jest.mock('~common/ChoiceFilterModal', () => () => null)
jest.mock('~common/FiltersHeader', () => () => null)
jest.mock('~common/SearchFilterModal', () => () => null)
jest.mock('~common/sheet', () => ({
  Sheet: ({ children }: React.PropsWithChildren) => children,
  SheetHeader: () => null,
  SheetView: ({ children }: React.PropsWithChildren) => children,
}))
jest.mock('~helpers/useLanguage', () => () => 'fr')
jest.mock('~state/app', () => ({
  installedVersionsSignalAtom: Symbol('installedVersionsSignalAtom'),
}))
jest.mock('../versionCatalogState', () => ({
  bibleVersionGroupingAtom: Symbol('bibleVersionGroupingAtom'),
}))
jest.mock('../versionAvailability', () => ({
  getDownloadedBibleVersionIds: async () => new Set(),
}))
jest.mock('~features/resources/resourceAccess', () => ({
  useResourceAccess: () => ({
    offlineCopies: { isAvailable: async () => false },
  }),
}))

const sections: VersionCatalogSection[] = Array.from({ length: 5 }, (_, sectionIndex) => ({
  key: `section-${sectionIndex}`,
  title: `Section ${sectionIndex}`,
  data:
    sectionIndex === 4
      ? [
          {
            id: 'BHG',
            displayName: 'Bible hébraïque et grecque',
          } as VersionCatalogSection['data'][number],
        ]
      : Array.from(
          { length: 11 },
          (_, itemIndex) =>
            ({
              id: `VERSION-${sectionIndex}-${itemIndex}`,
              displayName: `Version ${sectionIndex}-${itemIndex}`,
            }) as VersionCatalogSection['data'][number]
        ),
}))

const createRenderer = () => {
  let renderer: ReactTestRenderer
  const consoleError = jest.spyOn(console, 'error').mockImplementation((message, ...args) => {
    if (typeof message === 'string' && message.startsWith('react-test-renderer is deprecated')) {
      return
    }
    console.warn(message, ...args)
  })

  try {
    act(() => {
      renderer = create(
        <VersionCatalogList
          sections={sections}
          grouping="language"
          query=""
          revealVersionId="BHG"
          revealKey={1}
          scrollToTopKey="language:all:"
          openStyleInfo={jest.fn()}
          renderItem={() => null}
        />
      )
    })
  } finally {
    consoleError.mockRestore()
  }

  return renderer!
}

describe('VersionCatalogList', () => {
  beforeAll(() => {
    global.requestAnimationFrame = callback => {
      callback(0)
      return 1
    }
    global.cancelAnimationFrame = jest.fn()
  })

  beforeEach(() => {
    ;(
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
    mockScrollTo.mockClear()
    mockScrollToLocation.mockClear()
  })

  it('retries the exact selected-version reveal after SectionList falls back to an estimate', () => {
    const renderer = createRenderer()
    const list = renderer.root.findByType('SectionList' as never)

    expect(list.props.initialNumToRender).toBe(44)
    expect(list.props.getItemLayout(undefined, 48)).toEqual({
      index: 48,
      length: 72,
      offset: 3456,
    })
    expect(mockScrollTo).not.toHaveBeenCalled()
    expect(mockScrollToLocation).not.toHaveBeenCalled()

    act(() => {
      list.props.onLayout({ nativeEvent: { layout: { height: 700 } } })
    })

    expect(mockScrollTo).toHaveBeenLastCalledWith({
      animated: false,
      y: 3456,
    })
    expect(mockScrollToLocation).toHaveBeenCalledTimes(1)

    act(() => {
      list.props.onScrollToIndexFailed({ averageItemLength: 64, index: 50 })
    })

    expect(mockScrollTo).toHaveBeenCalledWith({
      animated: false,
      y: 3200,
    })
    expect(mockScrollToLocation).toHaveBeenCalledTimes(2)
    expect(mockScrollToLocation).toHaveBeenLastCalledWith({
      sectionIndex: 4,
      itemIndex: 0,
      animated: false,
      viewPosition: 0.5,
    })

    act(() => {
      list.props.onScrollToIndexFailed({ averageItemLength: 0, index: 48 })
    })

    expect(mockScrollTo).toHaveBeenLastCalledWith({
      animated: false,
      y: 3456,
    })
    expect(mockScrollToLocation).toHaveBeenCalledTimes(3)
  })
})
