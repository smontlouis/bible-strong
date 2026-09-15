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
import { parseStrongReference } from '~helpers/bibleSearchInput'
import { isExactBibleReferenceInput } from '~helpers/bcvParser'
import { getBibleVersionCanonId } from '~helpers/bibleVersions'
import { appLogger } from '~helpers/agentObservability'
import { localQueryOptions, staticResourceQueryOptions } from '~helpers/queryOptions'
import { searchRateLimitQueryOptions } from './searchRateLimit'
import { SEARCH_MIN_QUERY_LENGTH } from './searchResultsModel'
import { useAppendOnlySearchResults, passageResultKey } from './useAppendOnlySearchResults'

const PASSAGE_SEARCH_PAGE_SIZE = 20

export function usePassageSearch({
  searchValue,
  version,
  searchLanguage,
  enabled,
  section = '',
  canon = '',
  book = 0,
  sortOrder = 'relevance',
}: {
  searchValue: string
  version: string
  searchLanguage: ResourceLanguage
  enabled: boolean
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
  const shouldSearchPassages =
    enabled &&
    trimmedSearchValue.length >= SEARCH_MIN_QUERY_LENGTH &&
    Boolean(version) &&
    !strongReference &&
    !isBibleReference
  const passageQuery = useInfiniteQuery({
    queryKey: [
      'sqlite-passage-search-v2',
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
      'semantic-passage-search-v1',
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
    enabled: shouldSearchPassages && Boolean(isConnected),
    ...searchRateLimitQueryOptions,
    ...staticResourceQueryOptions,
    ...localQueryOptions,
  })
  const results: SearchResult[] | null = !enabled
    ? null
    : strongReference || isBibleReference
      ? []
      : shouldSearchPassages
        ? (passageQuery.data?.pages.flatMap(page => page.results) ?? null)
        : null
  const semanticResults =
    shouldSearchPassages && isConnected
      ? (semanticPassageQuery.data?.pages.flatMap(page => page.results) ?? [])
      : []
  const isSemanticSearching =
    shouldSearchPassages && Boolean(isConnected) && semanticPassageQuery.isFetching
  const semanticSearchError =
    shouldSearchPassages && isConnected && semanticPassageQuery.isError
      ? t('search.semanticUnavailable')
      : null
  const mergedPassages = useAppendOnlySearchResults(
    JSON.stringify([
      trimmedSearchValue,
      section,
      canon,
      book,
      version,
      sortOrder,
      searchLanguage,
      isConnected,
    ]),
    shouldSearchPassages
      ? [
          ...(results ?? []),
          ...(!passageQuery.isPending || passageQuery.isError ? semanticResults : []),
        ]
      : [],
    passageResultKey
  )
  const totalCount = mergedPassages.length
  const isSearching = shouldSearchPassages && passageQuery.isFetching
  const searchError =
    shouldSearchPassages && passageQuery.isError ? t('search.error.searchFailed') : null

  return {
    trimmedSearchValue,
    strongReference,
    isBibleReference,
    shouldSearchPassages,
    passageQuery,
    semanticPassageQuery,
    canSearchSemantic: shouldSearchPassages && Boolean(isConnected),
    results,
    semanticResults,
    isSemanticSearching,
    semanticSearchError,
    mergedPassages,
    totalCount,
    isSearching,
    searchError,
  }
}
