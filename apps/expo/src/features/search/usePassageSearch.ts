import { useInfiniteQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useResourceAccess } from '~features/resources/resourceAccess'
import type {
  SearchOptions,
  SearchResult,
  SearchSortOrder,
} from '~features/resources/bibleSearchAccess'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import type { SearchCanon, SearchSection } from '~state/searchFilters'
import useConnection from '~helpers/useConnection'
import { parseBibleTextSearchQuery, parseStrongReference } from '~helpers/bibleSearchInput'
import { isExactBibleReferenceInput } from '~helpers/bcvParser'
import { getBibleVersionCanonId } from '~helpers/bibleVersions'
import { appLogger } from '~helpers/agentObservability'
import { localQueryOptions, staticResourceQueryOptions } from '~helpers/queryOptions'
import { searchRateLimitQueryOptions } from './searchRateLimit'
import { SEARCH_MIN_QUERY_LENGTH } from './searchResultsModel'

const PASSAGE_SEARCH_PAGE_SIZE = 20

/**
 * Two searches with the same filters, shown apart: the verses that contain the words (offline too)
 * and, online, the passages of the topics the query names or comes close to in meaning.
 */
export function usePassageSearch({
  searchValue,
  version,
  searchLanguage,
  enabled,
  meaningEnabled = enabled,
  section = '',
  canon = '',
  book = 0,
  sortOrder = 'relevance',
}: {
  searchValue: string
  version: string
  searchLanguage: ResourceLanguage
  enabled: boolean
  /** Searches by meaning; follows `enabled` unless the caller shows it as a source of its own. */
  meaningEnabled?: boolean
  section?: SearchSection
  canon?: SearchCanon
  book?: number
  sortOrder?: SearchSortOrder
}) {
  const resources = useResourceAccess()
  const isConnected = useConnection()
  const { t, i18n } = useTranslation()
  const uiLanguage = i18n.language
  const trimmedSearchValue = searchValue.trim()
  const strongReference = parseStrongReference(trimmedSearchValue)
  const isBibleReference = isExactBibleReferenceInput(
    trimmedSearchValue,
    uiLanguage.startsWith('fr') ? 'fr' : 'en'
  )
  const isPassageQuery =
    trimmedSearchValue.length >= SEARCH_MIN_QUERY_LENGTH &&
    Boolean(version) &&
    !strongReference &&
    !isBibleReference
  const shouldSearchPassages = enabled && isPassageQuery
  // Words in quotes ask for those words alone.
  const isPhrase = parseBibleTextSearchQuery(trimmedSearchValue)?.kind === 'phrase'
  const shouldSearchMeaning = meaningEnabled && isPassageQuery && !isPhrase && Boolean(isConnected)
  const passageQuery = useInfiniteQuery({
    queryKey: [
      'sqlite-passage-search',
      'v3',
      searchLanguage,
      uiLanguage,
      trimmedSearchValue,
      section,
      canon,
      book,
      version,
      sortOrder,
      isConnected,
    ],
    queryFn: async ({ pageParam, signal }) => {
      const sectionMap: Record<string, 'ot' | 'nt'> = { at: 'ot', nt: 'nt' }
      const options: SearchOptions = {
        signal,
        limit: PASSAGE_SEARCH_PAGE_SIZE,
        offset: pageParam,
        sortOrder,
        version: version,
        canon: canon || getBibleVersionCanonId(version),
        searchLanguage: searchLanguage,
        ...(book && { book }),
        ...(sectionMap[section] && { section: sectionMap[section] }),
      }

      return await appLogger.measure(
        'database',
        'search.sqlite',
        () => resources.bibleSearch.searchPage(searchValue, options),
        {
          queryLength: searchValue.length,
          version: version,
          book,
          section,
          canon,
          sortOrder,
        },
        signal
      )
    },
    initialPageParam: 0,
    getNextPageParam: (_lastPage, pages) => {
      const loaded = pages.reduce((total, page) => total + page.results.length, 0)
      const count = pages[0]?.count ?? 0
      return loaded < count ? loaded : undefined
    },
    enabled: shouldSearchPassages,
    ...searchRateLimitQueryOptions,
    ...staticResourceQueryOptions,
    ...localQueryOptions,
  })
  const semanticPassageQuery = useInfiniteQuery({
    queryKey: [
      'semantic-passage-search-v2',
      searchLanguage,
      uiLanguage,
      trimmedSearchValue,
      section,
      canon,
      book,
      version,
      sortOrder,
      isConnected,
    ],
    queryFn: async ({ pageParam, signal }) => {
      const sectionMap: Record<string, 'ot' | 'nt'> = { at: 'ot', nt: 'nt' }
      const options: SearchOptions = {
        signal,
        mode: 'semantic',
        limit: PASSAGE_SEARCH_PAGE_SIZE,
        offset: pageParam,
        sortOrder,
        version: version,
        canon: canon || getBibleVersionCanonId(version),
        searchLanguage: searchLanguage,
        ...(book && { book }),
        ...(sectionMap[section] && { section: sectionMap[section] }),
      }

      return await appLogger.measure(
        'database',
        'search.semantic',
        () => resources.bibleSearch.searchPage(searchValue, options),
        {
          queryLength: searchValue.length,
          version: version,
          book,
          section,
          canon,
          sortOrder,
        },
        signal
      )
    },
    initialPageParam: 0,
    getNextPageParam: (_lastPage, pages) => {
      const loaded = pages.reduce((total, page) => total + page.results.length, 0)
      const count = pages[0]?.count ?? 0
      return loaded < count ? loaded : undefined
    },
    enabled: shouldSearchMeaning,
    ...searchRateLimitQueryOptions,
    ...staticResourceQueryOptions,
    ...localQueryOptions,
  })
  const passages: SearchResult[] = shouldSearchPassages
    ? (passageQuery.data?.pages.flatMap(page => page.results) ?? [])
    : []
  const meaningPassages: SearchResult[] = shouldSearchMeaning
    ? (semanticPassageQuery.data?.pages.flatMap(page => page.results) ?? [])
    : []

  return {
    trimmedSearchValue,
    strongReference,
    isBibleReference,
    shouldSearchPassages,
    passageQuery,
    semanticPassageQuery,
    canSearchSemantic: shouldSearchMeaning,
    passages,
    /** Every verse that contains the words, not only the pages loaded. */
    passageCount: shouldSearchPassages ? (passageQuery.data?.pages[0]?.count ?? 0) : 0,
    meaningPassages,
    meaningCount: shouldSearchMeaning ? (semanticPassageQuery.data?.pages[0]?.count ?? 0) : 0,
    isSearching: shouldSearchPassages && passageQuery.isFetching,
    isSemanticSearching: shouldSearchMeaning && semanticPassageQuery.isFetching,
    searchError:
      shouldSearchPassages && passageQuery.isError ? t('search.error.searchFailed') : null,
    semanticSearchError:
      shouldSearchMeaning && semanticPassageQuery.isError ? t('search.semanticUnavailable') : null,
  }
}
