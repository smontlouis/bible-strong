import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Keyboard, Platform, TouchableOpacity } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useTheme } from '@emotion/react'
import { Image } from 'expo-image'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { KeyboardAwareFlatList } from 'react-native-keyboard-aware-scroll-view'

import booksDesc from '~assets/bible_versions/books-desc'
import DropdownMenu from '~common/DropdownMenu'
import DownloadRequired from '~common/DownloadRequired'
import Empty from '~common/Empty'
import AlphabetList from '~common/AlphabetList'
import Loading from '~common/Loading'
import SearchInput from '~common/SearchInput'
import Box, { HStack, VStack } from '~common/ui/Box'
import { Chip } from '~common/ui/NewChip'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import Progress from '~common/ui/Progress'
import {
  getInstalledVersions,
  searchVerses,
  searchVersesCount,
  SearchOptions,
  SearchSortOrder,
} from '~helpers/biblesDb'
import type { SearchResult } from '~helpers/biblesDb'
import { appLogger } from '~helpers/agentObservability'
import { DatabaseError } from '~helpers/catchDatabaseError'
import loadDictionnaireBySearch from '~helpers/loadDictionnaireBySearch'
import loadLexiqueBySearch from '~helpers/loadLexiqueBySearch'
import loadLexiqueByLetter, { type LexiqueRow } from '~helpers/loadLexiqueByLetter'
import loadNaveBySearch from '~helpers/loadNaveBySearch'
import loadNaveByLetter from '~helpers/loadNaveByLetter'
import loadDictionnaireByLetter from '~helpers/loadDictionnaireByLetter'
import useDebounce from '~helpers/useDebounce'
import useBibleVerses from '~helpers/useBibleVerses'
import { removeBreakLines } from '~helpers/utils'
import { useWaitForDatabase as useWaitForDictionaryDatabase } from '~common/waitForDictionnaireDB'
import { useWaitForDatabase as useWaitForNaveDatabase } from '~common/waitForNaveDB'
import { useWaitForDatabase as useWaitForStrongDatabase } from '~common/waitForStrongDB'
import { parseBibleReference } from '~features/search/BibleReferenceWidget'
import SearchEmptyState from '~features/search/SearchEmptyState'
import { getBibleViewParamsForSearchResult } from '~features/search/searchNavigation'
import { useOpenRelationEndpoint } from '~features/studyRelations/useOpenRelationEndpoint'
import type { RelationEndpoint } from '~features/studyRelations/domain'
import type { RootState } from '~redux/modules/reducer'
import { useSelector } from 'react-redux'
import { searchFiltersAtom, SearchItemType, SearchSection } from '~state/searchFilters'
import { useDefaultBibleVersion } from '~state/useDefaultBibleVersion'
import SharedSearchEntityResultRow from './shared/SearchEntityResultRow'
import SearchItemFilterBar, {
  getNextSearchItemFilters,
  searchItemFilterOrder,
} from './shared/SearchItemFilterBar'
import SearchSectionBlock, {
  SEARCH_SECTION_LOAD_MORE_COUNT,
  SEARCH_SECTION_PREVIEW_LIMIT,
  type SearchResultSection,
} from './shared/SearchSectionBlock'
import { searchWithMatches } from './shared/searchFuzzy'
import {
  getDictionarySearchItems,
  getLinkSearchItems,
  getNaveSearchItems,
  getNoteSearchItems,
  getPassageSearchItems,
  getReferenceSearchItems,
  getStrongSearchItems,
  getStudySearchItems,
  type DictionarySearchRow,
  type NaveSearchItemRow,
} from './shared/searchItems'
import type { SearchEntityResult } from './shared/searchResultTypes'

type Props = {
  searchValue: string
  setSearchValue: (value: string) => void
}

const MIN_SEARCH_LENGTH = 2
const STRONG_CODE_REGEX = /^[HG]\d+$/i
const SEARCH_ALPHABET_FOOTER_HEIGHT = 70

type DictionaryRow = DictionarySearchRow
type NaveRow = NaveSearchItemRow
type SearchSectionId =
  | 'reference'
  | 'notes'
  | 'links'
  | 'studies'
  | 'strong'
  | 'dictionary'
  | 'nave'
  | 'passages'

type SQLiteSearchResultSection = SearchResultSection<SearchSectionId> & {
  itemFilterType: SearchItemType
}

const isDatabaseError = (value: unknown): value is DatabaseError =>
  typeof value === 'object' && value !== null && 'error' in value

const useKeyboardFooterBottom = (footerHeight: number) => {
  const insets = useSafeAreaInsets()
  const [bottom, setBottom] = useState(0)

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const showSubscription = Keyboard.addListener(showEvent, event => {
      Keyboard.scheduleLayoutAnimation(event)
      setBottom(Math.max(0, event.endCoordinates.height - insets.bottom - footerHeight))
    })
    const hideSubscription = Keyboard.addListener(hideEvent, event => {
      Keyboard.scheduleLayoutAnimation(event)
      setBottom(0)
    })

    return () => {
      showSubscription.remove()
      hideSubscription.remove()
    }
  }, [footerHeight, insets.bottom])

  return bottom
}

const SQLiteSearchScreen = ({ searchValue, setSearchValue }: Props) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const router = useRouter()
  const keyboardFooterBottom = useKeyboardFooterBottom(SEARCH_ALPHABET_FOOTER_HEIGHT)
  const openRelationEndpoint = useOpenRelationEndpoint()
  const notes = useSelector((state: RootState) => state.user.bible.notes)
  const links = useSelector((state: RootState) => state.user.bible.links)
  const studies = useSelector((state: RootState) => state.user.bible.studies)
  const strongDb = useWaitForStrongDatabase()
  const dictionaryDb = useWaitForDictionaryDatabase()
  const naveDb = useWaitForNaveDatabase()

  // Global persisted filters — read once at mount, write on every change
  const globalFilters = useAtomValue(searchFiltersAtom)
  const setGlobalFilters = useSetAtom(searchFiltersAtom)

  const debouncedSearchValue = useDebounce(searchValue, 300)
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [noteResults, setNoteResults] = useState<SearchEntityResult[]>([])
  const [linkResults, setLinkResults] = useState<SearchEntityResult[]>([])
  const [studyResults, setStudyResults] = useState<SearchEntityResult[]>([])
  const [strongResults, setStrongResults] = useState<LexiqueRow[]>([])
  const [dictionaryResults, setDictionaryResults] = useState<DictionaryRow[]>([])
  const [naveResults, setNaveResults] = useState<NaveRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isSearching, setIsSearching] = useState(false)
  const [isNoteSearching, setIsNoteSearching] = useState(false)
  const [isLinkSearching, setIsLinkSearching] = useState(false)
  const [isStudySearching, setIsStudySearching] = useState(false)
  const [isStrongSearching, setIsStrongSearching] = useState(false)
  const [isDictionarySearching, setIsDictionarySearching] = useState(false)
  const [isNaveSearching, setIsNaveSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [hasInstalledVersions, setHasInstalledVersions] = useState(true)
  const [visibleCounts, setVisibleCounts] = useState<Partial<Record<SearchSectionId, number>>>({})
  const [strongLetter, setStrongLetter] = useState('a')
  const [dictionaryLetter, setDictionaryLetter] = useState('a')
  const [naveLetter, setNaveLetter] = useState('a')

  const [section, _setSection] = useState<SearchSection>(globalFilters.section)
  const [book, _setBook] = useState(globalFilters.book)
  const [selectedVersion, _setSelectedVersion] = useState(globalFilters.selectedVersion)
  const [sortOrder, _setSortOrder] = useState<SearchSortOrder>(globalFilters.sortOrder)
  const [itemFilters, _setItemFilters] = useState(globalFilters.itemFilters)
  const [installedVersions, setInstalledVersions] = useState<string[]>([])
  const activeItemFilterTypes = searchItemFilterOrder.filter(itemType => itemFilters[itemType])
  const singleActiveItemType =
    activeItemFilterTypes.length === 1 ? activeItemFilterTypes[0] : undefined
  const browseItemType = singleActiveItemType !== 'passages' ? singleActiveItemType : undefined

  const setSection = (v: SearchSection) => {
    _setSection(v)
    setGlobalFilters(prev => ({ ...prev, section: v }))
  }
  const setBook = (v: number) => {
    _setBook(v)
    setGlobalFilters(prev => ({ ...prev, book: v }))
  }
  const setSelectedVersion = (v: string) => {
    _setSelectedVersion(v)
    setGlobalFilters(prev => ({ ...prev, selectedVersion: v }))
  }
  const setSortOrder = (v: SearchSortOrder) => {
    _setSortOrder(v)
    setGlobalFilters(prev => ({ ...prev, sortOrder: v }))
  }
  const toggleItemFilter = (type: SearchItemType) => {
    const next = getNextSearchItemFilters(itemFilters, type)
    _setItemFilters(next)
    setGlobalFilters(prev => ({ ...prev, itemFilters: next }))
  }
  const increaseVisibleCount = (sectionId: SearchSectionId) => {
    setVisibleCounts(prev => ({
      ...prev,
      [sectionId]:
        (prev[sectionId] || SEARCH_SECTION_PREVIEW_LIMIT) + SEARCH_SECTION_LOAD_MORE_COUNT,
    }))
  }

  // Load installed versions on mount
  useEffect(() => {
    ;(async () => {
      const versions = await getInstalledVersions()
      setInstalledVersions(versions)
      setHasInstalledVersions(versions.length > 0)
    })()
  }, [])

  const books = [
    {
      Numero: 0,
      Nom: t('Tout'),
      Chapitres: 0,
    },
    ...booksDesc,
  ].map(b => ({
    value: b.Numero,
    label: t(b.Nom),
  }))

  const sectionValues = [
    { value: '', label: t('Tout') },
    { value: 'at', label: t('Ancien Testament') },
    { value: 'nt', label: t('Nouveau Testament') },
  ]

  const versionValues = [
    { value: '', label: t('Toutes les versions') },
    ...installedVersions.map(v => ({ value: v, label: v })),
  ]

  const sortOrderValues = [
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
      const sortedItems = getNoteSearchItems(notes, t).sort((a, b) => {
        const left = notes[(a.endpoint as Extract<RelationEndpoint, { type: 'note' }>).noteId]
        const right = notes[(b.endpoint as Extract<RelationEndpoint, { type: 'note' }>).noteId]
        return Number(right?.date || 0) - Number(left?.date || 0)
      })
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
      const sortedItems = getStudySearchItems(studies, t).sort((a, b) => {
        const left = studies[(a.endpoint as Extract<RelationEndpoint, { type: 'study' }>).studyId]
        const right = studies[(b.endpoint as Extract<RelationEndpoint, { type: 'study' }>).studyId]
        return Number(right?.modified_at || 0) - Number(left?.modified_at || 0)
      })
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
      const sortedItems = getLinkSearchItems(links, t).sort((a, b) => {
        const left =
          links[(a.endpoint as Extract<RelationEndpoint, { type: 'externalLink' }>).linkId]
        const right =
          links[(b.endpoint as Extract<RelationEndpoint, { type: 'externalLink' }>).linkId]
        return Number(right?.date || 0) - Number(left?.date || 0)
      })
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

  // Run search
  useEffect(() => {
    const trimmed = debouncedSearchValue?.trim() ?? ''

    // Not enough characters → clear & show empty state
    if (
      !itemFilters.passages ||
      searchValue.trim().length < MIN_SEARCH_LENGTH ||
      trimmed.length < MIN_SEARCH_LENGTH
    ) {
      setResults(null)
      setTotalCount(0)
      setSearchError(null)
      setIsSearching(false)
      return
    }

    // Strong's code → skip Bible FTS, only widgets will search
    if (STRONG_CODE_REGEX.test(trimmed)) {
      setResults([])
      setTotalCount(0)
      setSearchError(null)
      return
    }

    let cancelled = false

    const doSearch = async () => {
      setIsSearching(true)
      setSearchError(null)
      try {
        const sectionMap: Record<string, 'ot' | 'nt'> = { at: 'ot', nt: 'nt' }
        const options: SearchOptions = {
          limit: 200,
          sortOrder,
          ...(selectedVersion && { version: selectedVersion }),
          ...(book && { book }),
          ...(sectionMap[section] && { section: sectionMap[section] }),
        }

        const [searchResults, count] = await appLogger.measure(
          'database',
          'search.sqlite',
          () =>
            Promise.all([
              searchVerses(debouncedSearchValue, options),
              searchVersesCount(debouncedSearchValue, options),
            ]),
          {
            queryLength: debouncedSearchValue.length,
            version: selectedVersion,
            book,
            section,
            sortOrder,
          }
        )

        if (!cancelled) {
          setResults(searchResults)
          setTotalCount(count)
        }
      } catch (e) {
        if (!cancelled) {
          appLogger.error('database', 'search.sqlite.failed', { error: e })
          console.error('[Search] FTS5 error:', e)
          setResults([])
          setTotalCount(0)
          setSearchError(t('search.error.searchFailed'))
        }
      }
      if (!cancelled) {
        setIsSearching(false)
      }
    }

    doSearch()

    return () => {
      cancelled = true
      setIsSearching(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debouncedSearchValue,
    section,
    book,
    selectedVersion,
    sortOrder,
    itemFilters.passages,
    searchValue,
  ])

  useEffect(() => {
    const trimmed = debouncedSearchValue.trim()
    const shouldSearch =
      itemFilters.strong &&
      ((browseItemType === 'strong' && searchValue.trim() === trimmed) ||
        (browseItemType !== 'strong' &&
          searchValue.trim().length >= MIN_SEARCH_LENGTH &&
          trimmed.length >= MIN_SEARCH_LENGTH))

    if (!shouldSearch || strongDb.isLoading || strongDb.proposeDownload) {
      if (browseItemType === 'strong' && searchValue.trim() !== trimmed) {
        return
      }
      setStrongResults([])
      setIsStrongSearching(false)
      return
    }

    let cancelled = false
    setIsStrongSearching(true)
    const loader =
      browseItemType === 'strong' && !trimmed
        ? loadLexiqueByLetter(strongLetter)
        : loadLexiqueBySearch(trimmed)

    loader
      .then(results => {
        if (cancelled) return
        setStrongResults(isDatabaseError(results) ? [] : results)
        setIsStrongSearching(false)
      })
      .catch(error => {
        if (cancelled) return
        appLogger.error('database', 'search.strong.failed', { error })
        setStrongResults([])
        setIsStrongSearching(false)
      })

    return () => {
      cancelled = true
      setIsStrongSearching(false)
    }
  }, [
    browseItemType,
    debouncedSearchValue,
    itemFilters.strong,
    searchValue,
    strongDb.isLoading,
    strongDb.proposeDownload,
    strongLetter,
  ])

  useEffect(() => {
    const trimmed = debouncedSearchValue.trim()
    const shouldSearch =
      itemFilters.dictionary &&
      ((browseItemType === 'dictionary' && searchValue.trim() === trimmed) ||
        (browseItemType !== 'dictionary' &&
          searchValue.trim().length >= MIN_SEARCH_LENGTH &&
          trimmed.length >= MIN_SEARCH_LENGTH))

    if (!shouldSearch || dictionaryDb.isLoading || dictionaryDb.proposeDownload) {
      if (browseItemType === 'dictionary' && searchValue.trim() !== trimmed) {
        return
      }
      setDictionaryResults([])
      setIsDictionarySearching(false)
      return
    }

    let cancelled = false
    setIsDictionarySearching(true)
    const loader =
      browseItemType === 'dictionary' && !trimmed
        ? loadDictionnaireByLetter(dictionaryLetter)
        : loadDictionnaireBySearch(trimmed)

    loader
      .then(results => {
        if (cancelled) return
        setDictionaryResults(isDatabaseError(results) ? [] : results)
        setIsDictionarySearching(false)
      })
      .catch(error => {
        if (cancelled) return
        appLogger.error('database', 'search.dictionary.failed', { error })
        setDictionaryResults([])
        setIsDictionarySearching(false)
      })

    return () => {
      cancelled = true
      setIsDictionarySearching(false)
    }
  }, [
    browseItemType,
    debouncedSearchValue,
    dictionaryLetter,
    itemFilters.dictionary,
    searchValue,
    dictionaryDb.isLoading,
    dictionaryDb.proposeDownload,
  ])

  useEffect(() => {
    const trimmed = debouncedSearchValue.trim()
    const shouldSearch =
      itemFilters.nave &&
      ((browseItemType === 'nave' && searchValue.trim() === trimmed) ||
        (browseItemType !== 'nave' &&
          searchValue.trim().length >= MIN_SEARCH_LENGTH &&
          trimmed.length >= MIN_SEARCH_LENGTH))

    if (!shouldSearch || naveDb.isLoading || naveDb.proposeDownload) {
      if (browseItemType === 'nave' && searchValue.trim() !== trimmed) {
        return
      }
      setNaveResults([])
      setIsNaveSearching(false)
      return
    }

    let cancelled = false
    setIsNaveSearching(true)
    const loader =
      browseItemType === 'nave' && !trimmed
        ? loadNaveByLetter(naveLetter)
        : loadNaveBySearch(trimmed)

    loader
      .then(results => {
        if (cancelled) return
        setNaveResults(isDatabaseError(results) ? [] : results)
        setIsNaveSearching(false)
      })
      .catch(error => {
        if (cancelled) return
        appLogger.error('database', 'search.nave.failed', { error })
        setNaveResults([])
        setIsNaveSearching(false)
      })

    return () => {
      cancelled = true
      setIsNaveSearching(false)
    }
  }, [
    browseItemType,
    debouncedSearchValue,
    itemFilters.nave,
    naveLetter,
    naveDb.isLoading,
    naveDb.proposeDownload,
    searchValue,
  ])

  const hasReference = Boolean(
    itemFilters.passages &&
    searchValue.trim().length >= MIN_SEARCH_LENGTH &&
    debouncedSearchValue &&
    parseBibleReference(debouncedSearchValue).length > 0
  )

  const hasSearchQuery = Boolean(debouncedSearchValue)
  const showResultsList =
    Boolean(browseItemType) ||
    (hasSearchQuery &&
      searchValue.trim().length >= MIN_SEARCH_LENGTH &&
      debouncedSearchValue.trim().length >= MIN_SEARCH_LENGTH)
  const referenceItems = itemFilters.passages ? getReferenceSearchItems(debouncedSearchValue) : []
  const noteItems = itemFilters.notes ? noteResults : []
  const linkItems = itemFilters.links ? linkResults : []
  const studyItems = itemFilters.studies ? studyResults : []
  const strongItems = itemFilters.strong ? getStrongSearchItems(strongResults, t) : []
  const dictionaryItems = itemFilters.dictionary ? getDictionarySearchItems(dictionaryResults) : []
  const naveItems = itemFilters.nave ? getNaveSearchItems(naveResults) : []
  const passageItems = itemFilters.passages ? getPassageSearchItems(results ?? []) : []
  const searchSections: SQLiteSearchResultSection[] = [
    ...(referenceItems.length
      ? [
          {
            id: 'reference' as const,
            title: t('Référence biblique'),
            count: referenceItems.length,
            items: referenceItems,
            itemFilterType: 'passages' as const,
          },
        ]
      : []),
    ...(noteItems.length
      ? [
          {
            id: 'notes' as const,
            title: t('Notes'),
            count: noteItems.length,
            items: noteItems,
            itemFilterType: 'notes' as const,
          },
        ]
      : []),
    ...(linkItems.length
      ? [
          {
            id: 'links' as const,
            title: t('Liens'),
            count: linkItems.length,
            items: linkItems,
            itemFilterType: 'links' as const,
          },
        ]
      : []),
    ...(studyItems.length
      ? [
          {
            id: 'studies' as const,
            title: t('Études'),
            count: studyItems.length,
            items: studyItems,
            itemFilterType: 'studies' as const,
          },
        ]
      : []),
    ...(strongItems.length
      ? [
          {
            id: 'strong' as const,
            title: t('Strong'),
            count: strongItems.length,
            items: strongItems,
            itemFilterType: 'strong' as const,
          },
        ]
      : []),
    ...(dictionaryItems.length
      ? [
          {
            id: 'dictionary' as const,
            title: t('Dictionnaire'),
            count: dictionaryItems.length,
            items: dictionaryItems,
            itemFilterType: 'dictionary' as const,
          },
        ]
      : []),
    ...(naveItems.length
      ? [
          {
            id: 'nave' as const,
            title: t('Nave'),
            count: naveItems.length,
            items: naveItems,
            itemFilterType: 'nave' as const,
          },
        ]
      : []),
    ...(passageItems.length || (itemFilters.passages && (isSearching || searchError))
      ? [
          {
            id: 'passages' as const,
            title: t('Passages'),
            count: totalCount || passageItems.length,
            items: passageItems,
            itemFilterType: 'passages' as const,
          },
        ]
      : []),
  ]
  const isBrowseLoading =
    (browseItemType === 'notes' && isNoteSearching) ||
    (browseItemType === 'links' && isLinkSearching) ||
    (browseItemType === 'studies' && isStudySearching) ||
    (browseItemType === 'strong' && isStrongSearching) ||
    (browseItemType === 'dictionary' && isDictionarySearching) ||
    (browseItemType === 'nave' && isNaveSearching)

  const showNoResults =
    showResultsList &&
    !isSearching &&
    !isBrowseLoading &&
    searchSections.length === 0 &&
    !searchError

  function renderPassageError(): ReactNode {
    if (searchError) {
      return (
        <Box py={10}>
          <Text title fontSize={14} color="quart">
            {searchError}
          </Text>
        </Box>
      )
    }

    if (!hasInstalledVersions) {
      return (
        <Box py={10}>
          <Text title fontSize={14} color="grey">
            {t('Téléchargez une Bible pour activer la recherche hors-ligne.')}
          </Text>
        </Box>
      )
    }

    return null
  }

  const openSearchItem = (item: SearchEntityResult) => {
    if (item.passage) {
      router.push({
        pathname: '/bible-view',
        params: getBibleViewParamsForSearchResult(item.passage),
      })
      return
    }

    if (item.endpoint) {
      openRelationEndpoint(item.endpoint)
    }
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
  const shouldRenderSearchList = showResultsList || !hasSearchQuery
  const alphabetFooterInset = browseAlphabet ? SEARCH_ALPHABET_FOOTER_HEIGHT : 0
  const listBottomInset = alphabetFooterInset + keyboardFooterBottom

  const renderBrowseDatabaseState = () => {
    if (browseItemType === 'strong') {
      if (strongDb.isLoading && strongDb.startDownload) {
        return (
          <Loading message={t('Téléchargement de la base strong...')}>
            <Progress progress={strongDb.progress} />
          </Loading>
        )
      }
      if (strongDb.isLoading && strongDb.proposeDownload) {
        return (
          <DownloadRequired
            size="small"
            title={t('La base de données strong est requise pour accéder à cette page.')}
            setStartDownload={strongDb.setStartDownload}
            fileSize={35}
          />
        )
      }
      if (strongDb.isLoading) {
        return <Loading message={t('Chargement de la base strong...')} />
      }
    }

    if (browseItemType === 'dictionary') {
      if (dictionaryDb.isLoading && dictionaryDb.startDownload) {
        return (
          <Loading message={t('Téléchargement du dictionnaire...')}>
            <Progress progress={dictionaryDb.progress} />
          </Loading>
        )
      }
      if (dictionaryDb.isLoading && dictionaryDb.proposeDownload) {
        return (
          <DownloadRequired
            size="small"
            title={t('La base de données dictionnaire est requise pour accéder à cette page.')}
            setStartDownload={dictionaryDb.setStartDownload}
            fileSize={22}
          />
        )
      }
      if (dictionaryDb.isLoading) {
        return <Loading message={t('Chargement du dictionnaire...')} />
      }
    }

    if (browseItemType === 'nave') {
      if (naveDb.isLoading && naveDb.startDownload) {
        return (
          <Loading message={t('Téléchargement des thèmes...')}>
            <Progress progress={naveDb.progress} />
          </Loading>
        )
      }
      if (naveDb.isLoading && naveDb.proposeDownload) {
        return (
          <DownloadRequired
            size="small"
            title={t(
              'La base de données "Bible thématique Nave" est requise pour accéder à ce module.'
            )}
            setStartDownload={naveDb.setStartDownload}
            fileSize={7}
          />
        )
      }
      if (naveDb.isLoading) {
        return <Loading message={t('Chargement de la base de données...')} />
      }
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
      return (
        <KeyboardAwareFlatList
          enableOnAndroid
          keyboardShouldPersistTaps="handled"
          enableResetScrollToCoords={false}
          style={{
            paddingBottom: listBottomInset || 40,
            flex: 1,
            backgroundColor: theme.colors.reverse,
          }}
          contentContainerStyle={{
            paddingBottom: listBottomInset,
          }}
          removeClippedSubviews
          data={searchSections}
          keyExtractor={(section: SQLiteSearchResultSection) => section.id}
          ListEmptyComponent={
            isBrowseLoading ? (
              <Box px={20} py={16}>
                <Text color="grey">{String(t('Chargement...'))}</Text>
              </Box>
            ) : showNoResults ? (
              browseItemType ? (
                renderSoloEmptyState()
              ) : (
                <SearchNoResultsState query={debouncedSearchValue} />
              )
            ) : (
              <SearchEmptyState onExamplePress={setSearchValue} />
            )
          }
          renderItem={({ item: section }: { item: SQLiteSearchResultSection }) => (
            <SearchSectionBlock
              section={section}
              visibleCount={visibleCounts[section.id] || SEARCH_SECTION_PREVIEW_LIMIT}
              onLoadMore={() => increaseVisibleCount(section.id)}
              onPressItem={openSearchItem}
              renderItem={item =>
                item.referenceSegment ? (
                  <ReferenceSearchResultRow key={item.id} item={item} />
                ) : (
                  <SharedSearchEntityResultRow
                    key={item.id}
                    item={item}
                    onPress={() => openSearchItem(item)}
                  />
                )
              }
              statusMessage={section.id === 'passages' ? renderPassageError() : null}
              isLoading={
                (section.id === 'passages' && isSearching) ||
                (section.id === 'links' && isLinkSearching) ||
                (section.id === 'strong' && isStrongSearching) ||
                (section.id === 'dictionary' && isDictionarySearching) ||
                (section.id === 'nave' && isNaveSearching)
              }
            />
          )}
        />
      )
    }

    return null
  }

  return (
    <Box flex={1}>
      <Box px={20}>
        <SearchInput
          placeholder={t('search.placeholder')}
          onChangeText={setSearchValue}
          value={searchValue}
          onDelete={() => setSearchValue('')}
        />
      </Box>
      <Box>
        <VStack>
          <SearchItemFilterBar
            itemFilters={itemFilters}
            onToggle={toggleItemFilter}
            px={20}
            mt={10}
            mb={0}
            maxHeight={40}
          />
          {hasInstalledVersions && !hasReference && (
            <HStack
              px={20}
              opacity={itemFilters.passages ? 1 : 0.3}
              pointerEvents={itemFilters.passages ? 'auto' : 'none'}
            >
              <DropdownMenu
                title={t('Section')}
                currentValue={section}
                setValue={(v: string) => setSection(v as SearchSection)}
                choices={sectionValues}
              />
              <DropdownMenu
                title={t('Livre')}
                currentValue={book}
                setValue={setBook}
                choices={books}
              />
              {installedVersions.length > 1 && (
                <DropdownMenu
                  title={t('Version')}
                  currentValue={selectedVersion}
                  setValue={setSelectedVersion}
                  choices={versionValues}
                />
              )}
              <DropdownMenu
                title={t('Ordre')}
                currentValue={sortOrder}
                setValue={(v: string) => setSortOrder(v as SearchSortOrder)}
                choices={sortOrderValues}
              />
            </HStack>
          )}
        </VStack>
      </Box>

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
  const router = useRouter()
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
        router.push({
          pathname: '/bible-view',
          params: {
            isReadOnly: 'true',
            book: JSON.stringify(booksDesc[segment.book - 1]),
            chapter: String(segment.chapter),
            verse: String(segment.startVerse),
            ...(segment.isWholeChapter
              ? {}
              : { focusVerses: JSON.stringify(verseIds.map(v => v.Verset)) }),
          },
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
