import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import DictionaryListScreen from '~features/dictionnary/DictionaryListScreen'
import NaveListScreen from '~features/nave/NaveListScreen'

jest.mock('react-native-section-list-get-item-layout', () => () => jest.fn())
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }))
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: { status: 'available' },
    error: undefined,
    isError: false,
    refetch: jest.fn(),
  }),
}))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('jotai/react', () => ({ useAtomValue: () => ({ DICTIONNAIRE: 'fr' }) }))
jest.mock('~state/resourcesLanguage', () => ({
  resourcesLanguageAtom: {},
  useResourceLanguage: () => ['fr', jest.fn()],
}))
jest.mock('src/state/resourcesLanguage', () => ({ useResourceLanguage: () => ['fr', jest.fn()] }), {
  virtual: true,
})
jest.mock('~helpers/useLanguage', () => () => 'fr')
jest.mock('~features/resources/resourceAccess', () => ({
  useResourceAccess: () => ({ dictionary: {}, nave: {} }),
}))
jest.mock('~features/lexique/useUtilities', () => ({
  useSearchValue: () => ({
    searchValue: '',
    debouncedSearchValue: '',
    setSearchValue: jest.fn(),
  }),
  useInfiniteResultsByLetterOrSearch: () => ({
    results: [],
    isLoading: false,
    error: 'NETWORK_OFFLINE',
    recoveries: ['retry'],
    retry: jest.fn(),
    fetchNextPage: jest.fn(),
    hasNextPage: false,
  }),
}))
jest.mock('~features/resources/ResourceUnavailableView', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return (props: Record<string, unknown>) =>
    ReactModule.createElement('ResourceUnavailableView', props)
})
jest.mock('~common/ui/Box', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    ReactModule.createElement('Box', props, children)
})
jest.mock('~common/ui/FormSheetScreen', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return ({ children }: React.PropsWithChildren) =>
    ReactModule.createElement('FormSheetScreen', null, children)
})
jest.mock('~common/Header', () => () => null)
jest.mock('~common/AlphabetList', () => () => null)
jest.mock('~common/Empty', () => () => null)
jest.mock('~common/Loading', () => () => null)
jest.mock('~common/SearchInput', () => () => null)
jest.mock('~common/SectionTitle', () => () => null)
jest.mock('~common/Link', () => () => null)
jest.mock('~common/ui/MenuView', () => ({ MenuView: () => null }), { virtual: true })
jest.mock('~common/ui/Icon', () => ({ FeatherIcon: () => null }))
jest.mock('~common/ui/SectionList', () => () => null)
jest.mock('~common/ui/Text', () => () => null)
jest.mock('~features/dictionnary/DictionnaireItem', () => () => null)
jest.mock('~features/nave/NaveItem', () => () => null)
jest.mock('~navigation/useCanGoBackInStack', () => ({ useCanGoBackInStack: () => false }))
jest.mock('~navigation/usePushRouteOnce', () => ({ usePushRouteOnce: () => jest.fn() }))
jest.mock('~features/app-switcher/utils/useResolveNewTabSelection', () => ({
  useResolveNewTabSelection: () => jest.fn(),
}))
jest.mock('~helpers/toast', () => ({ toast: jest.fn() }))

describe('resource failure list screens', () => {
  let renderer: ReactTestRenderer

  beforeAll(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  })

  afterEach(() => act(() => renderer.unmount()))

  it.each([
    ['Dictionary', <DictionaryListScreen key="dictionary" dictionaryAtom={{} as never} />],
    ['Nave', <NaveListScreen key="nave" naveAtom={{} as never} />],
  ])('keeps %s network errors classified as offline', (_name, screen) => {
    act(() => {
      renderer = create(screen)
    })

    expect(
      renderer.root.find(node => String(node.type) === 'ResourceUnavailableView').props.failure
    ).toEqual({ cause: 'network-offline', recoveries: ['retry'] })
  })
})
