import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import FiltersHeader from '~common/FiltersHeader'
import { useInfiniteResultsByLetterOrSearch } from '../useUtilities'
import LexiqueListScreen from '../LexiqueListScreen'

jest.mock('~themes/ThemeProvider', () => ({ useTheme: () => ({ fontFamily: {} }) }))
jest.mock('~themes/styleValues', () => ({ resolveFontFamily: () => '' }))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('@tanstack/react-query', () => ({ useQuery: () => ({}) }))
jest.mock('~state/resourcesLanguage', () => ({
  useResourceLanguage: () => jest.requireActual<typeof React>('react').useState('fr'),
}))
jest.mock('~helpers/useConnection', () => () => true)
jest.mock('~navigation/useCanGoBackInStack', () => ({ useCanGoBackInStack: () => false }))
jest.mock('~features/app-switcher/utils/useResolveNewTabSelection', () => ({
  useResolveNewTabSelection: () => jest.fn(),
}))
const mockListEntries = jest.fn()
jest.mock('~features/resources/resourceAccess', () => ({
  useResourceAccess: () => ({ strongLexicon: { listEntries: mockListEntries } }),
}))
jest.mock('../useUtilities', () => ({
  useSearchValue: () => ({ searchValue: '', debouncedSearchValue: '', setSearchValue: jest.fn() }),
  useInfiniteResultsByLetterOrSearch: jest.fn(() => ({ results: [], isLoading: false })),
}))
jest.mock('~common/FiltersHeader', () => () => null)
jest.mock('~common/ui/Box', () => ({
  __esModule: true,
  default: ({ children }: React.PropsWithChildren) => children,
}))
jest.mock('~common/ui/FormSheetScreen', () => ({
  __esModule: true,
  default: ({ children }: React.PropsWithChildren) => children,
}))
jest.mock('~common/AlphabetList', () => () => null)
jest.mock('~assets/images/empty-state-icons/word.svg', () => 'word')
jest.mock('~common/Empty', () => () => null)
jest.mock('~common/Loading', () => () => null)
jest.mock('~common/SearchInput', () => () => null)
jest.mock('~common/SectionTitle', () => () => null)
jest.mock('~common/ui/SectionList', () => () => null)
jest.mock('~common/ui/Text', () => () => null)
jest.mock('../LexiqueItem', () => () => null)
jest.mock('~features/resources/ResourceUnavailableScreen', () => () => null)

describe('Lexique filters', () => {
  let renderer: ReactTestRenderer
  beforeEach(() => {
    jest.clearAllMocks()
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  })
  afterEach(() => act(() => renderer?.unmount()))

  it.each([undefined, 'hebrew', 'greek'] as const)(
    'initializes queries with %s',
    initialLexicalLanguage => {
      act(() => {
        renderer = create(<LexiqueListScreen initialLexicalLanguage={initialLexicalLanguage} />)
      })
      const args = jest.mocked(useInfiniteResultsByLetterOrSearch).mock.lastCall!
      for (const query of [args[0], args[1]]) {
        query.query('a', { limit: 50, cursor: 'next' })
        expect(mockListEntries).toHaveBeenLastCalledWith(
          expect.objectContaining({
            lexicalLanguage: initialLexicalLanguage,
            language: 'fr',
            cursor: 'next',
          })
        )
        expect(query.queryKey).toContain(initialLexicalLanguage ?? 'all')
      }
    }
  )

  it('changes both query modes and resets the lexicon filter', () => {
    act(() => {
      renderer = create(<LexiqueListScreen />)
    })
    const header = () => renderer.root.findByType(FiltersHeader).props
    act(() => header().filters[1].options[2].onSelect())
    act(() => header().filters[0].options[1].onSelect())
    const args = jest.mocked(useInfiniteResultsByLetterOrSearch).mock.lastCall!
    for (const query of [args[0], args[1]]) {
      query.query('a', { limit: 50 })
      expect(mockListEntries).toHaveBeenLastCalledWith(
        expect.objectContaining({ lexicalLanguage: 'greek', language: 'en' })
      )
      expect(query.queryKey).toContain('greek')
    }
    act(() => header().onReset())
    expect(header().filters[1].active).toBe(false)
    expect(jest.mocked(useInfiniteResultsByLetterOrSearch).mock.lastCall![0].queryKey).toContain(
      'all'
    )
  })
})
