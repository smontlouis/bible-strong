import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FlatList, TouchableOpacity } from 'react-native'
import { KeyboardAwareScrollView, useKeyboardState } from 'react-native-keyboard-controller'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@emotion/react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { useAtomValue, useSetAtom } from 'jotai/react'
import Empty from '~common/Empty'
import AlphabetList from '~common/AlphabetList'
import FilterHeaderButton from '~common/FilterHeaderButton'
import SearchInput from '~common/SearchInput'
import Box, { HStack, TouchableBox, VStack } from '~common/ui/Box'
import { Chip } from '~common/ui/NewChip'
import { FeatherIcon } from '~common/ui/Icon'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import type {
  SearchOptions,
  SearchResult,
  SearchSortOrder,
} from '~features/resources/bibleSearchAccess'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { appLogger } from '~helpers/agentObservability'
import type { StrongLexiconSearchResult } from '~features/resources/strongLexiconAccess'
import useDebounce from '~helpers/useDebounce'
import useBibleVerses from '~features/resources/useBibleVerses'
import { removeBreakLines } from '~helpers/utils'
import SearchEmptyState from '~features/search/SearchEmptyState'
import { useOpenStudyObject } from '~features/studyRelations/useOpenStudyObject'
import type { RootState } from '~redux/modules/reducer'
import { useSelector } from 'react-redux'
import {
  searchFiltersAtom,
  SearchItemType,
  SearchSection,
  type SearchCanon,
} from '~state/searchFilters'
import {
  DEFAULT_BIBLE_VERSION_FILTER,
  resolveSearchVersionFilter,
} from '~state/searchVersionFilter'
import { useDefaultBibleVersion } from '~state/useDefaultBibleVersion'
import { installedVersionsSignalAtom } from '~state/app'
import { resourcesLanguageAtom } from '~state/resourcesLanguage'
import SharedSearchEntityResultRow from './shared/SearchEntityResultRow'
import { allSearchItemFilters, searchItemFilterOrder } from './shared/SearchItemFilterBar'
import SearchFacetBar from './shared/SearchFacetBar'
import SearchSectionBlock, {
  SEARCH_SECTION_LOAD_MORE_COUNT,
  SEARCH_SECTION_PREVIEW_LIMIT,
} from './shared/SearchSectionBlock'
import { searchWithMatches } from './shared/searchFuzzy'
import {
  getSortedLinkSearchItems,
  getSortedNoteSearchItems,
  getSortedStudySearchItems,
  type DictionarySearchRow,
  type NaveSearchItemRow,
} from './shared/searchItems'
import type { SearchEntityResult } from './shared/searchResultTypes'
import Header from '~common/Header'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import {
  getSearchResultsModel,
  getSearchFacets,
  getSectionsForFacet,
  SEARCH_MIN_QUERY_LENGTH,
  type SQLiteSearchResultSection,
  type SearchFacetId,
  type SearchSectionId,
} from './searchResultsModel'
import { localQueryOptions } from '~helpers/queryOptions'
import { getBibleViewParamsForReferenceSegment } from './searchNavigation'
import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import { createOfflineCopyDownloadItem } from '~helpers/downloadItemFactory'
import useConnection from '~helpers/useConnection'
import {
  resourceFailureFromAccessError,
  resourceFailureFromAvailability,
  resourceFailureFromStrongModuleAvailability,
} from '~features/resources/resourceFailure'
import PassageSearchFiltersSheet from './PassageSearchFiltersSheet'
import type { SheetRef } from '~common/sheet'
import SearchSourceFiltersSheet from './SearchSourceFiltersSheet'
import { parseStrongReference } from '~helpers/bibleSearchInput'
import { getBooksForCanon } from '~helpers/bibleBookCatalog'
import { getBibleVersionCanonId } from '~helpers/bibleVersions'
import { createStrongIdentity } from '~helpers/strongIdentities'
import { isExactBibleReferenceInput } from '~helpers/bcvParser'

type Props = {
  searchValue: string
  setSearchValue: (value: string) => void
}

const MIN_SEARCH_LENGTH = SEARCH_MIN_QUERY_LENGTH
const SEARCH_ALPHABET_FOOTER_HEIGHT = 70
const PASSAGE_SEARCH_PAGE_SIZE = 20

type DictionaryRow = DictionarySearchRow
type NaveRow = NaveSearchItemRow

const useKeyboardFooterBottom = (footerHeight: number) => {
  const insets = useSafeAreaInsets()
  const keyboardHeight = useKeyboardState(state => state.height)
  const isKeyboardVisible = useKeyboardState(state => state.isVisible)
  const bottom = isKeyboardVisible ? Math.max(0, keyboardHeight - insets.bottom - footerHeight) : 0

  return bottom
}

const SQLiteSearchScreen = ({ searchValue, setSearchValue }: Props) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const keyboardFooterBottom = useKeyboardFooterBottom(SEARCH_ALPHABET_FOOTER_HEIGHT)
  const openStudyObject = useOpenStudyObject()
  const resources = useResourceAccess()
  const isConnected = useConnection()
  const defaultBibleVersion = useDefaultBibleVersion()
  const installedVersionsSignal = useAtomValue(installedVersionsSignalAtom)
  const resourcesLanguage = useAtomValue(resourcesLanguageAtom)
  const notes = useSelector((state: RootState) => state.user.bible.notes)
  const links = useSelector((state: RootState) => state.user.bible.links)
  const studies = useSelector((state: RootState) => state.user.bible.studies)

  // Global persisted filters — read once at mount, write on every change
  const globalFilters = useAtomValue(searchFiltersAtom)
  const setGlobalFilters = useSetAtom(searchFiltersAtom)

  const debouncedSearchValue = useDebounce(searchValue, 600)
  const [noteResults, setNoteResults] = useState<SearchEntityResult[]>([])
  const [linkResults, setLinkResults] = useState<SearchEntityResult[]>([])
  const [studyResults, setStudyResults] = useState<SearchEntityResult[]>([])
  const [isNoteSearching, setIsNoteSearching] = useState(false)
  const [isLinkSearching, setIsLinkSearching] = useState(false)
  const [isStudySearching, setIsStudySearching] = useState(false)
  const [visibleCounts, setVisibleCounts] = useState<Partial<Record<SearchSectionId, number>>>({})
  const [selectedFacet, setSelectedFacet] = useState<SearchFacetId>('all')
  const [strongLetter, setStrongLetter] = useState('a')
  const [dictionaryLetter, setDictionaryLetter] = useState('a')
  const [naveLetter, setNaveLetter] = useState('a')
  const [section, _setSection] = useState<SearchSection>(globalFilters.section)
  const [canon, _setCanon] = useState<SearchCanon>(globalFilters.canon)
  const [book, _setBook] = useState(globalFilters.book)
  const [selectedVersion, _setSelectedVersion] = useState(
    globalFilters.selectedVersion || DEFAULT_BIBLE_VERSION_FILTER
  )
  const resolvedSelectedVersion = resolveSearchVersionFilter(selectedVersion, defaultBibleVersion)
  const [sortOrder, _setSortOrder] = useState<SearchSortOrder>(globalFilters.sortOrder)
  const [itemFilters, _setItemFilters] = useState(globalFilters.itemFilters)
  const sourceFiltersRef = useRef<SheetRef>(null)
  const passageFiltersRef = useRef<SheetRef>(null)
  const activeItemFilterTypes = searchItemFilterOrder.filter(itemType => itemFilters[itemType])
  const singleActiveItemType =
    activeItemFilterTypes.length === 1 ? activeItemFilterTypes[0] : undefined
  const browseItemType = singleActiveItemType !== 'passages' ? singleActiveItemType : undefined
  const isSoloPaginatedSection = (sectionId: SearchSectionId) =>
    singleActiveItemType === sectionId &&
    (sectionId === 'passages' ||
      sectionId === 'strong' ||
      sectionId === 'dictionary' ||
      sectionId === 'nave')

  const strongAvailabilityQuery = useQuery({
    queryKey: [...resourceQueryKeys.strongLexiconAvailability('core'), isConnected],
    queryFn: async () => ({
      availability: await resources.strongLexicon.getModuleAvailability('core'),
      recoveries: await resources.strongLexicon.getModuleRecoveryActions?.('core'),
    }),
    networkMode: 'always',
    staleTime: Infinity,
    enabled: itemFilters.strong,
  })
  const dictionaryAvailabilityQuery = useQuery({
    queryKey: [
      ...resourceQueryKeys.offlineDatabaseAvailability(
        'DICTIONNAIRE',
        resourcesLanguage.DICTIONNAIRE
      ),
      isConnected,
    ],
    queryFn: () =>
      resources.dictionary.getAvailability?.(resourcesLanguage.DICTIONNAIRE) ??
      Promise.resolve({ status: 'available' as const }),
    networkMode: 'always',
    staleTime: Infinity,
    enabled: itemFilters.dictionary,
  })
  const naveAvailabilityQuery = useQuery({
    queryKey: [
      ...resourceQueryKeys.offlineDatabaseAvailability('NAVE', resourcesLanguage.NAVE),
      isConnected,
    ],
    queryFn: () =>
      resources.nave.getAvailability?.(resourcesLanguage.NAVE) ??
      Promise.resolve({ status: 'available' as const }),
    networkMode: 'always',
    staleTime: Infinity,
    enabled: itemFilters.nave,
  })

  const setSection = (v: SearchSection) => {
    _setSection(v)
    setGlobalFilters(prev => ({ ...prev, section: v }))
  }
  const setBook = (v: number) => {
    _setBook(v)
    setGlobalFilters(prev => ({ ...prev, book: v }))
  }
  const setSelectedVersion = (v: string) => {
    const resolvedVersion = resolveSearchVersionFilter(v, defaultBibleVersion)
    const versionCanon = getBibleVersionCanonId(resolvedVersion)
    const nextCanon = canon && canon !== versionCanon ? '' : canon
    const nextBook =
      book && !getBooksForCanon(versionCanon).some(candidate => candidate.Numero === book)
        ? 0
        : book

    _setSelectedVersion(v)
    if (nextCanon !== canon) _setCanon(nextCanon)
    if (nextBook !== book) _setBook(nextBook)
    setGlobalFilters(prev => ({
      ...prev,
      selectedVersion: v,
      canon: nextCanon,
      book: nextBook,
    }))
  }
  const setSortOrder = (v: SearchSortOrder) => {
    _setSortOrder(v)
    setGlobalFilters(prev => ({ ...prev, sortOrder: v }))
  }
  const toggleItemFilter = (type: SearchItemType) => {
    const next = { ...itemFilters, [type]: !itemFilters[type] }
    if (!searchItemFilterOrder.some(itemType => next[itemType])) return

    _setItemFilters(next)
    setGlobalFilters(prev => ({ ...prev, itemFilters: next }))
  }
  const resetItemFilters = () => {
    _setItemFilters(allSearchItemFilters)
    setGlobalFilters(prev => ({ ...prev, itemFilters: allSearchItemFilters }))
  }
  const increaseVisibleCount = (sectionId: SearchSectionId) => {
    setVisibleCounts(prev => ({
      ...prev,
      [sectionId]:
        (prev[sectionId] || SEARCH_SECTION_PREVIEW_LIMIT) + SEARCH_SECTION_LOAD_MORE_COUNT,
    }))
  }

  const installedVersionsQuery = useQuery({
    queryKey: ['search-installed-bible-versions', installedVersionsSignal],
    queryFn: () => resources.bibleSearch.getInstalledVersions(),
    ...localQueryOptions,
  })
  const installedVersions = installedVersionsQuery.data ?? []
  const hasInstalledVersions = !installedVersionsQuery.isSuccess || installedVersions.length > 0

  useEffect(() => {
    if (!installedVersionsQuery.isSuccess) return
    const compatibleVersions = canon
      ? installedVersions.filter(version => getBibleVersionCanonId(version) === canon)
      : installedVersions
    if (!resolvedSelectedVersion || !compatibleVersions.includes(resolvedSelectedVersion)) {
      const fallbackVersionFilter = compatibleVersions.includes(defaultBibleVersion)
        ? DEFAULT_BIBLE_VERSION_FILTER
        : compatibleVersions[0] || ''
      setSelectedVersion(fallbackVersionFilter)
    }
    // Reconcile the persisted filter when the inventory or selected canon changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    canon,
    defaultBibleVersion,
    installedVersions,
    installedVersionsQuery.isSuccess,
    resolvedSelectedVersion,
  ])

  const canonBooks = getBooksForCanon(canon || getBibleVersionCanonId(resolvedSelectedVersion))
  const books = [
    {
      Numero: 0,
      Nom: t('Tout'),
      Chapitres: 0,
    },
    ...canonBooks,
  ].map(b => ({
    value: b.Numero,
    label: t(b.Nom),
  }))

  const sectionValues: { value: SearchSection; label: string }[] = [
    { value: '', label: t('Toute la Bible') },
    { value: 'at', label: t('Ancien Testament') },
    { value: 'nt', label: t('Nouveau Testament') },
  ]

  const canonLabels: Record<Exclude<SearchCanon, ''>, string> = {
    'protestant-66': t('search.canon.protestant'),
    'catholic-73': t('search.canon.catholic'),
    'clementine-vulgate': t('search.canon.clementine'),
    'theotex-septuagint': t('search.canon.septuagint'),
  }
  const availableCanons = Array.from(
    new Set(installedVersions.map(version => getBibleVersionCanonId(version)))
  )
  const setCanon = (v: SearchCanon) => {
    const compatibleVersions = v
      ? installedVersions.filter(version => getBibleVersionCanonId(version) === v)
      : installedVersions
    const nextVersion = compatibleVersions.includes(resolvedSelectedVersion)
      ? selectedVersion
      : compatibleVersions.includes(defaultBibleVersion)
        ? DEFAULT_BIBLE_VERSION_FILTER
        : compatibleVersions[0] || ''
    const nextBook =
      v && book && !getBooksForCanon(v).some(candidate => candidate.Numero === book) ? 0 : book

    _setCanon(v)
    if (nextVersion !== selectedVersion) _setSelectedVersion(nextVersion)
    if (nextBook !== book) _setBook(nextBook)
    setGlobalFilters(prev => ({
      ...prev,
      canon: v,
      selectedVersion: nextVersion,
      book: nextBook,
    }))
  }
  const canonValues: { value: SearchCanon; label: string }[] = [
    { value: '', label: t('Tous les canons') },
    ...availableCanons.map(value => ({ value, label: canonLabels[value] })),
  ]

  const versionValues = [
    {
      value: DEFAULT_BIBLE_VERSION_FILTER,
      label: `${t('bibleDefaults.defaultReadingTitle')} (${defaultBibleVersion})`,
    },
    ...installedVersions.map(v => ({ value: v, label: v })),
  ]

  const sortOrderValues: { value: SearchSortOrder; label: string }[] = [
    { value: 'relevance', label: t('Pertinence') },
    { value: 'book', label: t('Ordre biblique') },
  ]

  useEffect(() => {
    setVisibleCounts({})
  }, [debouncedSearchValue])

  useEffect(() => {
    const trimmed = debouncedSearchValue.trim()
    const shouldSearch =
      itemFilters.notes && browseItemType === 'notes'
        ? searchValue.trim() === trimmed
        : itemFilters.notes &&
          browseItemType !== 'notes' &&
          searchValue.trim().length >= MIN_SEARCH_LENGTH &&
          trimmed.length >= MIN_SEARCH_LENGTH

    if (!shouldSearch) {
      if (browseItemType === 'notes' && searchValue.trim() !== trimmed) return
      setNoteResults([])
      setIsNoteSearching(false)
      return
    }

    let cancelled = false
    setIsNoteSearching(true)
    const timeout = setTimeout(() => {
      if (cancelled) return
      const sortedItems = getSortedNoteSearchItems(notes, t)
      setNoteResults(
        browseItemType === 'notes' && trimmed.length < MIN_SEARCH_LENGTH
          ? sortedItems
          : searchWithMatches(sortedItems, trimmed)
      )
      setIsNoteSearching(false)
    }, 0)

    return () => {
      cancelled = true
      clearTimeout(timeout)
      setIsNoteSearching(false)
    }
  }, [browseItemType, debouncedSearchValue, itemFilters.notes, notes, searchValue, t])

  useEffect(() => {
    const trimmed = debouncedSearchValue.trim()
    const shouldSearch =
      itemFilters.studies && browseItemType === 'studies'
        ? searchValue.trim() === trimmed
        : itemFilters.studies &&
          browseItemType !== 'studies' &&
          searchValue.trim().length >= MIN_SEARCH_LENGTH &&
          trimmed.length >= MIN_SEARCH_LENGTH

    if (!shouldSearch) {
      if (browseItemType === 'studies' && searchValue.trim() !== trimmed) return
      setStudyResults([])
      setIsStudySearching(false)
      return
    }

    let cancelled = false
    setIsStudySearching(true)
    const timeout = setTimeout(() => {
      if (cancelled) return
      const sortedItems = getSortedStudySearchItems(studies, t)
      setStudyResults(
        browseItemType === 'studies' && trimmed.length < MIN_SEARCH_LENGTH
          ? sortedItems
          : searchWithMatches(sortedItems, trimmed)
      )
      setIsStudySearching(false)
    }, 0)

    return () => {
      cancelled = true
      clearTimeout(timeout)
      setIsStudySearching(false)
    }
  }, [browseItemType, debouncedSearchValue, itemFilters.studies, searchValue, studies, t])

  useEffect(() => {
    const trimmed = debouncedSearchValue.trim()
    const shouldSearch =
      itemFilters.links && browseItemType === 'links'
        ? searchValue.trim() === trimmed
        : itemFilters.links &&
          browseItemType !== 'links' &&
          searchValue.trim().length >= MIN_SEARCH_LENGTH &&
          trimmed.length >= MIN_SEARCH_LENGTH

    if (!shouldSearch) {
      if (browseItemType === 'links' && searchValue.trim() !== trimmed) return
      setLinkResults([])
      setIsLinkSearching(false)
      return
    }

    let cancelled = false
    setIsLinkSearching(true)
    const timeout = setTimeout(() => {
      if (cancelled) return
      const sortedItems = getSortedLinkSearchItems(links, t)
      setLinkResults(
        browseItemType === 'links' && trimmed.length < MIN_SEARCH_LENGTH
          ? sortedItems
          : searchWithMatches(sortedItems, trimmed)
      )
      setIsLinkSearching(false)
    }, 0)

    return () => {
      cancelled = true
      clearTimeout(timeout)
      setIsLinkSearching(false)
    }
  }, [browseItemType, debouncedSearchValue, itemFilters.links, links, searchValue, t])

  const trimmedSearchValue = debouncedSearchValue.trim()
  const strongReference = parseStrongReference(trimmedSearchValue)
  const isBibleReference = isExactBibleReferenceInput(trimmedSearchValue)
  const shouldSearchPassages =
    itemFilters.passages &&
    searchValue.trim().length >= MIN_SEARCH_LENGTH &&
    trimmedSearchValue.length >= MIN_SEARCH_LENGTH &&
    Boolean(resolvedSelectedVersion) &&
    !strongReference &&
    !isBibleReference
  const passageQuery = useInfiniteQuery({
    queryKey: [
      'sqlite-passage-search',
      trimmedSearchValue,
      section,
      canon,
      book,
      resolvedSelectedVersion,
      sortOrder,
      isConnected,
    ],
    queryFn: async ({ pageParam, signal }) => {
      try {
        const sectionMap: Record<string, 'ot' | 'nt'> = { at: 'ot', nt: 'nt' }
        const options: SearchOptions = {
          signal,
          limit: PASSAGE_SEARCH_PAGE_SIZE,
          offset: pageParam,
          sortOrder,
          version: resolvedSelectedVersion,
          canon: canon || getBibleVersionCanonId(resolvedSelectedVersion),
          searchLanguage: resourcesLanguage.NAVE,
          ...(book && { book }),
          ...(sectionMap[section] && { section: sectionMap[section] }),
        }

        return await appLogger.measure(
          'database',
          'search.sqlite',
          () => resources.bibleSearch.searchPage(debouncedSearchValue, options),
          {
            queryLength: debouncedSearchValue.length,
            version: resolvedSelectedVersion,
            book,
            section,
            canon,
            sortOrder,
          }
        )
      } catch (error) {
        console.error('[Search] Bible search error:', error)
        throw error
      }
    },
    initialPageParam: 0,
    getNextPageParam: (_lastPage, pages) => {
      const loaded = pages.reduce((total, page) => total + page.results.length, 0)
      const count = pages[0]?.count ?? 0
      return loaded < count ? loaded : undefined
    },
    enabled: shouldSearchPassages,
    retry: false,
    ...localQueryOptions,
  })
  const results: SearchResult[] | null = !itemFilters.passages
    ? null
    : strongReference || isBibleReference
      ? []
      : shouldSearchPassages
        ? (passageQuery.data?.pages.flatMap(page => page.results) ?? null)
        : null
  const totalCount = passageQuery.data?.pages[0]?.count ?? 0
  const isSearching = shouldSearchPassages && passageQuery.isFetching
  const searchError = passageQuery.isError ? t('search.error.searchFailed') : null

  const shouldSearchStrong =
    itemFilters.strong &&
    ((browseItemType === 'strong' && searchValue.trim() === trimmedSearchValue) ||
      (browseItemType !== 'strong' &&
        searchValue.trim().length >= MIN_SEARCH_LENGTH &&
        trimmedSearchValue.length >= MIN_SEARCH_LENGTH))
  const strongQuery = useInfiniteQuery({
    queryKey: [
      'sqlite-strong-search',
      resourcesLanguage.STRONG,
      browseItemType,
      trimmedSearchValue,
      strongLetter,
    ],
    queryFn: async ({ pageParam, signal }) => {
      try {
        if (strongReference) {
          const entries = await resources.strongLexicon.loadPreview(
            [createStrongIdentity(strongReference.number, strongReference.language)],
            resourcesLanguage.STRONG
          )
          return {
            entries: entries.map(entry => ({
              id: entry.id,
              stepCode: entry.stepCode,
              classicStrong: entry.classicStrong,
              language: entry.language,
              original: entry.original,
              transliteration: entry.transliteration,
              gloss: entry.gloss,
            })),
          }
        }
        return await resources.strongLexicon.listEntries({
          signal,
          language: resourcesLanguage.STRONG,
          limit: 20,
          ...(pageParam ? { cursor: pageParam } : {}),
          ...(browseItemType === 'strong' && !trimmedSearchValue
            ? { prefix: strongLetter }
            : { search: trimmedSearchValue }),
        })
      } catch (error) {
        appLogger.captureError('database', 'search.strong.failed', error)
        throw error
      }
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.nextCursor,
    enabled: shouldSearchStrong,
    retry: false,
    ...localQueryOptions,
  })
  const strongResults: StrongLexiconSearchResult[] = shouldSearchStrong
    ? (strongQuery.data?.pages.flatMap(page => page.entries) ?? [])
    : []
  const isStrongSearching = shouldSearchStrong && strongQuery.isFetching

  const shouldSearchDictionary =
    itemFilters.dictionary &&
    ((browseItemType === 'dictionary' && searchValue.trim() === trimmedSearchValue) ||
      (browseItemType !== 'dictionary' &&
        searchValue.trim().length >= MIN_SEARCH_LENGTH &&
        trimmedSearchValue.length >= MIN_SEARCH_LENGTH))
  const dictionaryQuery = useInfiniteQuery({
    queryKey: [
      'sqlite-dictionary-search',
      resourcesLanguage.DICTIONNAIRE,
      browseItemType,
      trimmedSearchValue,
      dictionaryLetter,
    ],
    queryFn: async ({ pageParam, signal }) => {
      try {
        return browseItemType === 'dictionary' && !trimmedSearchValue
          ? await resources.dictionary.listByLetterPage(
              dictionaryLetter,
              { signal, limit: 20, ...(pageParam ? { cursor: pageParam } : {}) },
              resourcesLanguage.DICTIONNAIRE
            )
          : await resources.dictionary.searchPage(
              trimmedSearchValue,
              { signal, limit: 20, ...(pageParam ? { cursor: pageParam } : {}) },
              resourcesLanguage.DICTIONNAIRE
            )
      } catch (error) {
        appLogger.captureError('database', 'search.dictionary.failed', error)
        throw error
      }
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.nextCursor,
    enabled: shouldSearchDictionary,
    retry: false,
    ...localQueryOptions,
  })
  const dictionaryResults: DictionaryRow[] = shouldSearchDictionary
    ? (dictionaryQuery.data?.pages.flatMap(page => page.entries) ?? [])
    : []
  const isDictionarySearching = shouldSearchDictionary && dictionaryQuery.isFetching

  const shouldSearchNave =
    itemFilters.nave &&
    ((browseItemType === 'nave' && searchValue.trim() === trimmedSearchValue) ||
      (browseItemType !== 'nave' &&
        searchValue.trim().length >= MIN_SEARCH_LENGTH &&
        trimmedSearchValue.length >= MIN_SEARCH_LENGTH))
  const naveQuery = useInfiniteQuery({
    queryKey: [
      'sqlite-nave-search',
      resourcesLanguage.NAVE,
      browseItemType,
      trimmedSearchValue,
      naveLetter,
    ],
    queryFn: async ({ pageParam, signal }) => {
      try {
        return browseItemType === 'nave' && !trimmedSearchValue
          ? await resources.nave.listByLetterPage(
              naveLetter,
              { signal, limit: 20, ...(pageParam ? { cursor: pageParam } : {}) },
              resourcesLanguage.NAVE
            )
          : await resources.nave.searchPage(
              trimmedSearchValue,
              { signal, limit: 20, ...(pageParam ? { cursor: pageParam } : {}) },
              resourcesLanguage.NAVE
            )
      } catch (error) {
        appLogger.captureError('database', 'search.nave.failed', error)
        throw error
      }
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.nextCursor,
    enabled: shouldSearchNave,
    retry: false,
    ...localQueryOptions,
  })
  const naveResults: NaveRow[] = shouldSearchNave
    ? (naveQuery.data?.pages.flatMap(page => page.topics) ?? [])
    : []
  const isNaveSearching = shouldSearchNave && naveQuery.isFetching

  const searchModel = getSearchResultsModel({
    query: searchValue,
    debouncedQuery: debouncedSearchValue,
    browseItemType,
    itemFilters,
    noteResults,
    linkResults,
    studyResults,
    strongResults,
    dictionaryResults,
    naveResults,
    passageResults: results,
    totalPassageCount: totalCount,
    searchError,
    loading: {
      passages: isSearching,
      notes: isNoteSearching,
      links: isLinkSearching,
      studies: isStudySearching,
      strong: isStrongSearching,
      dictionary: isDictionarySearching,
      nave: isNaveSearching,
    },
    t,
  })
  const searchFacets = getSearchFacets(searchModel.sections)
  const effectiveSelectedFacet = searchFacets.some(facet => facet.id === selectedFacet)
    ? selectedFacet
    : 'all'
  const visibleSearchSections = getSectionsForFacet(searchModel.sections, effectiveSelectedFacet)
  const shouldShowFacets =
    !browseItemType &&
    searchValue.trim().length >= MIN_SEARCH_LENGTH &&
    trimmedSearchValue.length >= MIN_SEARCH_LENGTH &&
    searchFacets.length > 1
  const activePassageFilterCount = [
    selectedVersion !== DEFAULT_BIBLE_VERSION_FILTER,
    section !== '',
    canon !== '',
    book !== 0,
    sortOrder !== 'relevance',
  ].filter(Boolean).length
  const sourceFilterCount =
    activeItemFilterTypes.length === searchItemFilterOrder.length ? 0 : activeItemFilterTypes.length

  const resetPassageFilters = () => {
    _setSelectedVersion(DEFAULT_BIBLE_VERSION_FILTER)
    _setSection('')
    _setCanon('')
    _setBook(0)
    _setSortOrder('relevance')
    setGlobalFilters(previous => ({
      ...previous,
      selectedVersion: DEFAULT_BIBLE_VERSION_FILTER,
      section: '',
      canon: '',
      book: 0,
      sortOrder: 'relevance',
    }))
  }

  const updateSearchValue = (value: string) => {
    setSelectedFacet('all')
    setSearchValue(value)
  }

  function renderPassageError(): ReactNode {
    const recoveryIdentity = { kind: 'bible', versionId: defaultBibleVersion } as const
    const recoveryFileSize = Math.max(
      1,
      Math.round(createOfflineCopyDownloadItem(recoveryIdentity).estimatedSize / 1_000_000)
    )

    if (searchError || installedVersionsQuery.isError) {
      return (
        <ResourceUnavailableView
          identity={recoveryIdentity}
          title={t('resource.search.temporarilyUnavailable')}
          fileSize={recoveryFileSize}
          failure={resourceFailureFromAccessError(
            passageQuery.error ?? installedVersionsQuery.error
          )}
          size="small"
          onRetry={() => {
            void installedVersionsQuery.refetch()
            void passageQuery.refetch()
          }}
        />
      )
    }

    if (!hasInstalledVersions) {
      return (
        <ResourceUnavailableView
          identity={recoveryIdentity}
          title={t('resource.search.offlineCopyNeeded')}
          offlineTitle={t('resource.search.temporarilyUnavailable')}
          fileSize={recoveryFileSize}
          failure={{ cause: 'offline-copy-required', recoveries: ['acquire-offline-copy'] }}
          size="small"
          onRetry={() => {
            void installedVersionsQuery.refetch()
            void passageQuery.refetch()
          }}
        />
      )
    }

    return null
  }

  const openSearchItem = (item: SearchEntityResult) => {
    openStudyObject(item)
  }

  const renderBrowseAlphabet = () => {
    if (debouncedSearchValue.trim()) return null

    switch (browseItemType) {
      case 'strong':
        return <AlphabetList letter={strongLetter} setLetter={setStrongLetter} />
      case 'dictionary':
        return (
          <AlphabetList
            color="secondary"
            letter={dictionaryLetter}
            setLetter={setDictionaryLetter}
          />
        )
      case 'nave':
        return <AlphabetList color="quint" letter={naveLetter} setLetter={setNaveLetter} />
      default:
        return null
    }
  }
  const browseAlphabet = renderBrowseAlphabet()
  const shouldRenderSearchList = searchModel.shouldRenderSearchList
  const alphabetFooterInset = browseAlphabet ? SEARCH_ALPHABET_FOOTER_HEIGHT : 0
  const listBottomInset = alphabetFooterInset + keyboardFooterBottom

  const renderBrowseDatabaseState = () => {
    if (browseItemType === 'strong' && (strongAvailabilityQuery.isError || strongQuery.isError)) {
      return (
        <ResourceUnavailableView
          identity={{ kind: 'strong-lexicon-module', moduleId: 'core' }}
          title={t('resource.strong.temporarilyUnavailable')}
          fileSize={35}
          failure={resourceFailureFromAccessError(
            strongQuery.error ?? strongAvailabilityQuery.error
          )}
          size="small"
          onRetry={() => {
            void strongAvailabilityQuery.refetch()
            void strongQuery.refetch()
          }}
        />
      )
    }

    if (
      browseItemType === 'dictionary' &&
      (dictionaryAvailabilityQuery.isError || dictionaryQuery.isError)
    ) {
      return (
        <ResourceUnavailableView
          identity={{
            kind: 'database',
            databaseId: 'DICTIONNAIRE',
            language: resourcesLanguage.DICTIONNAIRE,
          }}
          title={t('resource.dictionary.temporarilyUnavailable')}
          fileSize={22}
          failure={resourceFailureFromAccessError(
            dictionaryQuery.error ?? dictionaryAvailabilityQuery.error
          )}
          size="small"
          onRetry={() => {
            void dictionaryAvailabilityQuery.refetch()
            void dictionaryQuery.refetch()
          }}
        />
      )
    }

    if (browseItemType === 'nave' && (naveAvailabilityQuery.isError || naveQuery.isError)) {
      return (
        <ResourceUnavailableView
          identity={{ kind: 'database', databaseId: 'NAVE', language: resourcesLanguage.NAVE }}
          title={t('resource.nave.temporarilyUnavailable')}
          fileSize={7}
          failure={resourceFailureFromAccessError(naveQuery.error ?? naveAvailabilityQuery.error)}
          size="small"
          onRetry={() => {
            void naveAvailabilityQuery.refetch()
            void naveQuery.refetch()
          }}
        />
      )
    }

    if (
      browseItemType === 'strong' &&
      strongAvailabilityQuery.data &&
      strongAvailabilityQuery.data.availability.status !== 'available'
    ) {
      return (
        <ResourceUnavailableView
          identity={{ kind: 'strong-lexicon-module', moduleId: 'core' }}
          title={t('resource.strong.offlineCopyNeeded')}
          offlineTitle={t('resource.strong.temporarilyUnavailable')}
          fileSize={35}
          size="small"
          failure={resourceFailureFromStrongModuleAvailability(
            strongAvailabilityQuery.data.availability,
            strongAvailabilityQuery.data.recoveries
          )}
          onRetry={() => {
            void strongAvailabilityQuery.refetch()
            void strongQuery.refetch()
          }}
        />
      )
    }

    if (
      browseItemType === 'dictionary' &&
      dictionaryAvailabilityQuery.data?.status === 'unavailable'
    ) {
      return (
        <ResourceUnavailableView
          identity={{
            kind: 'database',
            databaseId: 'DICTIONNAIRE',
            language: resourcesLanguage.DICTIONNAIRE,
          }}
          title={t('resource.dictionary.offlineCopyNeeded')}
          offlineTitle={t('resource.dictionary.temporarilyUnavailable')}
          fileSize={22}
          size="small"
          failure={resourceFailureFromAvailability(dictionaryAvailabilityQuery.data)}
          onRetry={() => {
            void dictionaryAvailabilityQuery.refetch()
            void dictionaryQuery.refetch()
          }}
        />
      )
    }

    if (browseItemType === 'nave' && naveAvailabilityQuery.data?.status === 'unavailable') {
      return (
        <ResourceUnavailableView
          identity={{ kind: 'database', databaseId: 'NAVE', language: resourcesLanguage.NAVE }}
          title={t('resource.nave.offlineCopyNeeded')}
          offlineTitle={t('resource.nave.temporarilyUnavailable')}
          fileSize={7}
          size="small"
          failure={resourceFailureFromAvailability(naveAvailabilityQuery.data)}
          onRetry={() => {
            void naveAvailabilityQuery.refetch()
            void naveQuery.refetch()
          }}
        />
      )
    }

    return null
  }

  const renderSoloEmptyState = () => {
    const hasSearch = debouncedSearchValue.trim().length > 0

    switch (browseItemType) {
      case 'notes':
        return (
          <Empty
            icon={require('~assets/images/empty-state-icons/note.svg')}
            message={hasSearch ? t('Aucune note trouvée') : t('Aucune note')}
          />
        )
      case 'links':
        return (
          <Empty
            icon={require('~assets/images/empty-state-icons/link.svg')}
            message={hasSearch ? t('Aucun lien trouvé') : t('Aucun lien')}
          />
        )
      case 'studies':
        return (
          <Empty
            icon={require('~assets/images/empty-state-icons/study.svg')}
            message={hasSearch ? t('Aucune étude trouvée') : t('Aucune étude...')}
          />
        )
      case 'strong':
        return (
          <Empty
            icon={require('~assets/images/empty-state-icons/word.svg')}
            message={t('Aucune strong trouvée...')}
          />
        )
      case 'dictionary':
        return (
          <Empty
            icon={require('~assets/images/empty-state-icons/word.svg')}
            message={t('Aucun mot trouvé...')}
          />
        )
      case 'nave':
        return (
          <Empty
            icon={require('~assets/images/empty-state-icons/word.svg')}
            message={t('Aucun mot trouvé...')}
          />
        )
      default:
        return <SearchNoResultsState query={debouncedSearchValue} />
    }
  }

  function renderContent(): ReactNode {
    const browseDatabaseState = renderBrowseDatabaseState()

    if (browseDatabaseState) {
      return browseDatabaseState
    }

    if (shouldRenderSearchList) {
      const soloPaginatedSection =
        visibleSearchSections.length === 1 && isSoloPaginatedSection(visibleSearchSections[0].id)
          ? visibleSearchSections[0]
          : undefined

      const renderSearchResult = (item: SearchEntityResult) =>
        item.referenceSegment ? (
          <ReferenceSearchResultRow key={item.id} item={item} />
        ) : (
          <SharedSearchEntityResultRow
            key={item.id}
            item={item}
            onPress={() => openSearchItem(item)}
          />
        )

      const fetchNextPage = (sectionId: SearchSectionId) => {
        if (
          sectionId === 'passages' &&
          passageQuery.hasNextPage &&
          !passageQuery.isFetchingNextPage
        ) {
          void passageQuery.fetchNextPage()
        }
        if (sectionId === 'strong' && strongQuery.hasNextPage && !strongQuery.isFetchingNextPage) {
          void strongQuery.fetchNextPage()
        }
        if (
          sectionId === 'dictionary' &&
          dictionaryQuery.hasNextPage &&
          !dictionaryQuery.isFetchingNextPage
        ) {
          void dictionaryQuery.fetchNextPage()
        }
        if (sectionId === 'nave' && naveQuery.hasNextPage && !naveQuery.isFetchingNextPage) {
          void naveQuery.fetchNextPage()
        }
      }

      const isSectionLoading = (sectionId: SearchSectionId) =>
        (sectionId === 'passages' && isSearching) ||
        (sectionId === 'links' && isLinkSearching) ||
        (sectionId === 'strong' && isStrongSearching) ||
        (sectionId === 'dictionary' && isDictionarySearching) ||
        (sectionId === 'nave' && isNaveSearching)

      const sectionHasMore = (sectionId: SearchSectionId) =>
        (sectionId === 'passages' && passageQuery.hasNextPage) ||
        (sectionId === 'strong' && strongQuery.hasNextPage) ||
        (sectionId === 'dictionary' && dictionaryQuery.hasNextPage) ||
        (sectionId === 'nave' && naveQuery.hasNextPage)

      const passageFilterAction = (
        <TouchableBox
          center
          minHeight={40}
          px={8}
          accessibilityLabel={t('Filtrer')}
          onPress={() => passageFiltersRef.current?.present()}
        >
          <FeatherIcon
            name="sliders"
            size={15}
            color={activePassageFilterCount ? 'primary' : 'tertiary'}
          />
        </TouchableBox>
      )

      if (soloPaginatedSection) {
        return (
          <FlatList
            keyboardShouldPersistTaps="handled"
            renderScrollComponent={props => (
              <KeyboardAwareScrollView
                {...props}
                bottomOffset={listBottomInset}
                disableScrollOnKeyboardHide
              />
            )}
            style={{
              flex: 1,
              backgroundColor: theme.colors.reverse,
            }}
            ListFooterComponent={listBottomInset ? <Box height={listBottomInset} /> : null}
            removeClippedSubviews
            data={soloPaginatedSection.items}
            keyExtractor={item => item.id}
            renderItem={({ item }) => renderSearchResult(item)}
            onEndReachedThreshold={0.4}
            onEndReached={() => fetchNextPage(soloPaginatedSection.id)}
            ListHeaderComponent={
              <SearchSectionBlock
                section={soloPaginatedSection}
                visibleCount={0}
                onLoadMore={() => undefined}
                onPressItem={openSearchItem}
                statusMessage={soloPaginatedSection.id === 'passages' ? renderPassageError() : null}
                isLoading={isSectionLoading(soloPaginatedSection.id)}
                hasMore={sectionHasMore(soloPaginatedSection.id)}
                showLoadMoreButton={false}
                headerAction={
                  soloPaginatedSection.id === 'passages' ? passageFilterAction : undefined
                }
                renderItems={false}
              />
            }
          />
        )
      }

      return (
        <FlatList
          keyboardShouldPersistTaps="handled"
          renderScrollComponent={props => (
            <KeyboardAwareScrollView
              {...props}
              bottomOffset={listBottomInset}
              disableScrollOnKeyboardHide
            />
          )}
          style={{
            flex: 1,
            backgroundColor: theme.colors.reverse,
          }}
          ListFooterComponent={listBottomInset ? <Box height={listBottomInset} /> : null}
          removeClippedSubviews
          data={visibleSearchSections}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (singleActiveItemType) fetchNextPage(singleActiveItemType)
          }}
          keyExtractor={(section: SQLiteSearchResultSection) => section.id}
          ListEmptyComponent={
            searchModel.isBrowseLoading ? (
              <Box px={20} py={16}>
                <Text color="grey">{String(t('Chargement...'))}</Text>
              </Box>
            ) : searchModel.showNoResults ? (
              browseItemType ? (
                renderSoloEmptyState()
              ) : (
                <SearchNoResultsState query={debouncedSearchValue} />
              )
            ) : (
              <SearchEmptyState isOnline={isConnected} onExamplePress={updateSearchValue} />
            )
          }
          renderItem={({ item: section }: { item: SQLiteSearchResultSection }) => (
            <SearchSectionBlock
              section={section}
              visibleCount={
                isSoloPaginatedSection(section.id)
                  ? section.items.length
                  : visibleCounts[section.id] || SEARCH_SECTION_PREVIEW_LIMIT
              }
              onLoadMore={() => {
                const currentVisible = visibleCounts[section.id] || SEARCH_SECTION_PREVIEW_LIMIT
                increaseVisibleCount(section.id)
                if (
                  section.id === 'passages' &&
                  currentVisible + SEARCH_SECTION_LOAD_MORE_COUNT >= section.items.length &&
                  passageQuery.hasNextPage &&
                  !passageQuery.isFetchingNextPage
                ) {
                  void passageQuery.fetchNextPage()
                }
                if (
                  section.id === 'strong' &&
                  currentVisible + SEARCH_SECTION_LOAD_MORE_COUNT >= section.items.length &&
                  strongQuery.hasNextPage &&
                  !strongQuery.isFetchingNextPage
                ) {
                  void strongQuery.fetchNextPage()
                }
                if (
                  section.id === 'dictionary' &&
                  currentVisible + SEARCH_SECTION_LOAD_MORE_COUNT >= section.items.length &&
                  dictionaryQuery.hasNextPage &&
                  !dictionaryQuery.isFetchingNextPage
                ) {
                  void dictionaryQuery.fetchNextPage()
                }
                if (
                  section.id === 'nave' &&
                  currentVisible + SEARCH_SECTION_LOAD_MORE_COUNT >= section.items.length &&
                  naveQuery.hasNextPage &&
                  !naveQuery.isFetchingNextPage
                ) {
                  void naveQuery.fetchNextPage()
                }
              }}
              onPressItem={openSearchItem}
              renderItem={renderSearchResult}
              statusMessage={section.id === 'passages' ? renderPassageError() : null}
              isLoading={isSectionLoading(section.id)}
              hasMore={sectionHasMore(section.id)}
              showLoadMoreButton={!isSoloPaginatedSection(section.id)}
              headerAction={section.id === 'passages' ? passageFilterAction : undefined}
            />
          )}
        />
      )
    }

    return null
  }

  return (
    <Box flex={1}>
      <Header
        title=""
        rightComponent={
          <FilterHeaderButton
            activeFilterCount={sourceFilterCount}
            onPress={() => sourceFiltersRef.current?.present()}
          />
        }
      >
        <Box pb={5}>
          <Box px={20}>
            <SearchInput
              placeholder={t('search.placeholder')}
              onChangeText={updateSearchValue}
              value={searchValue}
              onDelete={() => updateSearchValue('')}
            />
          </Box>
          <Box>
            <VStack>
              {shouldShowFacets ? (
                <SearchFacetBar
                  facets={searchFacets}
                  selectedFacet={effectiveSelectedFacet}
                  onSelect={setSelectedFacet}
                />
              ) : null}
            </VStack>
          </Box>
        </Box>
      </Header>

      <SearchSourceFiltersSheet
        ref={sourceFiltersRef}
        itemFilters={itemFilters}
        passageFilterCount={activePassageFilterCount}
        onToggle={toggleItemFilter}
        onReset={resetItemFilters}
        onOpenPassageFilters={() => passageFiltersRef.current?.present()}
      />

      <PassageSearchFiltersSheet
        ref={passageFiltersRef}
        defaultVersionValue={DEFAULT_BIBLE_VERSION_FILTER}
        section={section}
        canon={canon}
        book={book}
        selectedVersion={selectedVersion}
        sortOrder={sortOrder}
        sectionChoices={sectionValues}
        canonChoices={canonValues}
        bookChoices={books}
        versionChoices={versionValues}
        sortOrderChoices={sortOrderValues}
        onSectionChange={setSection}
        onCanonChange={setCanon}
        onBookChange={setBook}
        onVersionChange={setSelectedVersion}
        onSortOrderChange={setSortOrder}
        onReset={resetPassageFilters}
      />

      {renderContent()}
      {browseAlphabet ? (
        <Box
          position="absolute"
          bottom={keyboardFooterBottom}
          left={0}
          right={0}
          backgroundColor="reverse"
        >
          {browseAlphabet}
        </Box>
      ) : null}
    </Box>
  )
}

const SearchNoResultsState = ({ query }: { query: string }) => {
  const { t } = useTranslation()
  const theme = useTheme()

  return (
    <Box flex={1} alignItems="center" justifyContent="center" px={20} py={60}>
      <Box mb={18}>
        <Image
          source={require('~assets/images/empty-state-icons/search.svg')}
          style={{ width: 80, height: 80, opacity: 0.6 }}
          tintColor={theme.colors.tertiary}
          contentFit="contain"
        />
      </Box>
      <Text title fontSize={18} textAlign="center" mb={8}>
        {t('Aucun résultat')}
      </Text>
      <Text color="tertiary" textAlign="center">
        {t('Aucun résultat trouvé pour "{{query}}"', { query })}
      </Text>
    </Box>
  )
}

const ReferenceSearchResultRow = ({ item }: { item: SearchEntityResult }) => {
  const pushRouteOnce = usePushRouteOnce()
  const version = useDefaultBibleVersion()
  const segment = item.referenceSegment!

  const verseCount = segment.endVerse - segment.startVerse + 1
  const verseIds = Array.from({ length: verseCount }, (_, i) => ({
    Livre: segment.book,
    Chapitre: segment.chapter,
    Verset: segment.startVerse + i,
  }))
  const verses = useBibleVerses(verseIds)
  const content = verses.map(v => v.Texte).join(' ')

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() =>
        pushRouteOnce({
          pathname: '/bible-view',
          params: getBibleViewParamsForReferenceSegment(segment),
        })
      }
    >
      <Box px={20} py={12} borderBottomWidth={1} borderColor="border">
        <VStack>
          <HStack alignItems="center" gap={6} mb={2}>
            <Text bold fontSize={15} numberOfLines={1}>
              {item.title}
            </Text>
            <Chip>{version}</Chip>
          </HStack>
          {content ? (
            <Paragraph small numberOfLines={5}>
              {removeBreakLines(content)}
              {segment.isWholeChapter ? '...' : ''}
            </Paragraph>
          ) : null}
        </VStack>
      </Box>
    </TouchableOpacity>
  )
}

export default SQLiteSearchScreen
