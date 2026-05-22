import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useTheme } from '@emotion/react'
import { Image } from 'expo-image'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { KeyboardAwareFlatList } from 'react-native-keyboard-aware-scroll-view'
import Fuse, { type FuseResultMatch } from 'fuse.js'

import booksDesc from '~assets/bible_versions/books-desc'
import DictionnaryIcon from '~common/DictionnaryIcon'
import DropdownMenu from '~common/DropdownMenu'
import LexiqueIcon from '~common/LexiqueIcon'
import NaveIcon from '~common/NaveIcon'
import SearchInput from '~common/SearchInput'
import Box, { HStack, TouchableBox, VStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { Chip } from '~common/ui/NewChip'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import {
  getInstalledVersions,
  searchVerses,
  searchVersesCount,
  SearchResult,
  SearchOptions,
  SearchSortOrder,
} from '~helpers/biblesDb'
import { appLogger } from '~helpers/agentObservability'
import { DatabaseError } from '~helpers/catchDatabaseError'
import { deltaToPlainText } from '~helpers/deltaToPlainText'
import formatVerseContent from '~helpers/formatVerseContent'
import loadDictionnaireBySearch, { DictionnaireSearchRow } from '~helpers/loadDictionnaireBySearch'
import loadLexiqueBySearch from '~helpers/loadLexiqueBySearch'
import { LexiqueRow } from '~helpers/loadLexiqueByLetter'
import loadNaveBySearch, { NaveSearchRow } from '~helpers/loadNaveBySearch'
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
import type { Note, Study } from '~redux/modules/user'
import { useSelector } from 'react-redux'
import { searchFiltersAtom, SearchItemType, SearchSection } from '~state/searchFilters'
import { useDefaultBibleVersion } from '~state/useDefaultBibleVersion'
import i18n from '~i18n'

type Props = {
  searchValue: string
  setSearchValue: (value: string) => void
}

const MIN_SEARCH_LENGTH = 2
const STRONG_CODE_REGEX = /^[HG]\d+$/i
const SEARCH_SECTION_PREVIEW_LIMIT = 5
const SEARCH_SECTION_LOAD_MORE_COUNT = 10

type MatchRange = [number, number]
type SearchSectionId =
  | 'reference'
  | 'notes'
  | 'studies'
  | 'strong'
  | 'dictionary'
  | 'nave'
  | 'passages'

type SearchEntityResult = {
  id: string
  type: SearchItemType
  title: string
  subtitle?: string
  description?: string
  iconType: SearchItemType
  endpoint?: RelationEndpoint
  passage?: SearchResult
  referenceSegment?: ReturnType<typeof parseBibleReference>[number]
  matches?: readonly FuseResultMatch[]
}

type SearchResultSection = {
  id: SearchSectionId
  title: string
  count: number
  items: SearchEntityResult[]
  itemFilterType: SearchItemType
}

const itemFilterOrder: SearchItemType[] = [
  'passages',
  'notes',
  'studies',
  'strong',
  'dictionary',
  'nave',
]

const allItemFilters = itemFilterOrder.reduce(
  (filters, type) => ({
    ...filters,
    [type]: true,
  }),
  {} as Record<SearchItemType, boolean>
)

const itemFilterConfig: Record<
  SearchItemType,
  {
    labelKey: string
    color: string
  }
> = {
  passages: { labelKey: 'Passages', color: 'color1' },
  notes: { labelKey: 'Notes', color: 'color2' },
  studies: { labelKey: 'Études', color: 'tertiary' },
  strong: { labelKey: 'Strong', color: 'primary' },
  dictionary: { labelKey: 'Dictionnaire', color: 'secondary' },
  nave: { labelKey: 'Nave', color: 'quint' },
}

const isDatabaseError = (value: unknown): value is DatabaseError =>
  typeof value === 'object' && value !== null && 'error' in value

const normalizeDisplayedText = (value: string = '') => value.replace(/\n/g, ' ')

const searchWithMatches = (
  targets: SearchEntityResult[],
  keyword: string
): SearchEntityResult[] => {
  const trimmed = keyword.trim()
  if (trimmed.length < MIN_SEARCH_LENGTH) return []

  return new Fuse(targets, {
    keys: ['title', 'description'],
    includeMatches: true,
    threshold: 0.15,
    ignoreDiacritics: true,
  })
    .search(trimmed)
    .map(result => ({
      ...result.item,
      matches: result.matches,
    }))
}

const mergeRanges = (ranges: readonly MatchRange[]) =>
  ranges
    .slice()
    .sort((a, b) => a[0] - b[0])
    .reduce<MatchRange[]>((merged, range) => {
      const previous = merged[merged.length - 1]
      if (previous && range[0] <= previous[1] + 1) {
        merged[merged.length - 1] = [previous[0], Math.max(previous[1], range[1])]
      } else {
        merged.push(range)
      }
      return merged
    }, [])

const getMatchForKey = (item: SearchEntityResult, key: string) =>
  item.matches?.find(match => match.key === key)

const createVerseKeys = (book: number, chapter: number, startVerse: number, endVerse: number) =>
  Array.from(
    { length: endVerse - startVerse + 1 },
    (_, index) => `${book}-${chapter}-${startVerse + index}`
  )

const getStrongCode = (strong: LexiqueRow) =>
  String(
    (strong as LexiqueRow & { code?: string | number }).Code ??
      (strong as { code?: string | number }).code ??
      ''
  )

const getStrongOriginalWord = (strong: LexiqueRow) =>
  'Grec' in strong ? strong.Grec : strong.Hebreu

const getNoteSearchItems = (notes: Record<string, Note>, t: (key: string) => string) =>
  Object.entries(notes).map<SearchEntityResult>(([noteId, note]) => {
    const title = note.title || t('Note sans titre')
    return {
      id: `note:${noteId}`,
      type: 'notes',
      iconType: 'notes',
      title,
      subtitle: t('Note'),
      description: note.description,
      endpoint: {
        type: 'note',
        noteId,
        label: title,
      },
    }
  })

const getStudySearchItems = (studies: Record<string, Study>, t: (key: string) => string) =>
  Object.entries(studies).map<SearchEntityResult>(([studyId, study]) => {
    const id = study.id || studyId
    const title = study.title || t('Étude sans titre')
    const description = study.content?.ops
      ? deltaToPlainText(study.content.ops as Parameters<typeof deltaToPlainText>[0])
      : undefined
    return {
      id: `study:${id}`,
      type: 'studies',
      iconType: 'studies',
      title,
      subtitle: t('Étude'),
      description,
      endpoint: {
        type: 'study',
        studyId: id,
        label: title,
      },
    }
  })

const getReferenceSearchItems = (query: string): SearchEntityResult[] =>
  parseBibleReference(query).map((segment, index) => {
    const verseKeys = createVerseKeys(
      segment.book,
      segment.chapter,
      segment.startVerse,
      segment.endVerse
    )
    const verseCount = segment.endVerse - segment.startVerse + 1
    const verseIds = Array.from({ length: verseCount }, (_, i) => ({
      Livre: segment.book,
      Chapitre: segment.chapter,
      Verset: segment.startVerse + i,
    }))
    const title = segment.isWholeChapter
      ? `${i18n.t(booksDesc[segment.book - 1]?.Nom)} ${segment.chapter}`
      : formatVerseContent(verseIds).title

    return {
      id: `reference:${verseKeys.join('/')}:${index}`,
      type: 'passages',
      iconType: 'passages',
      title,
      referenceSegment: segment,
      endpoint: {
        type: 'verse',
        verseKeys,
      },
    }
  })

const getStrongSearchItems = (results: LexiqueRow[], t: (key: string) => string) =>
  results.map<SearchEntityResult>(strong => {
    const code = getStrongCode(strong)
    const isGreek = strong.lexiqueType === 'Grec'
    const prefix = isGreek ? 'G' : 'H'
    return {
      id: `strong:${strong.lexiqueType}:${code}:${strong.Mot}`,
      type: 'strong',
      iconType: 'strong',
      title: strong.Mot,
      subtitle: `${prefix}${code} · ${t(strong.lexiqueType)}`,
      description: getStrongOriginalWord(strong),
      endpoint: {
        type: 'strong',
        language: isGreek ? 'greek' : 'hebrew',
        code,
        label: strong.Mot,
        originalWord: getStrongOriginalWord(strong),
      },
    }
  })

const getDictionarySearchItems = (results: DictionnaireSearchRow[]) =>
  results.map<SearchEntityResult>((dictionary, index) => ({
    id: `dictionary:${dictionary.rowid ?? dictionary.sanitized_word ?? dictionary.word}:${index}`,
    type: 'dictionary',
    iconType: 'dictionary',
    title: dictionary.word,
    subtitle: 'Dictionnaire',
    endpoint: {
      type: 'dictionary',
      word: dictionary.word,
      label: dictionary.word,
    },
  }))

const getNaveSearchItems = (results: NaveSearchRow[]) =>
  results.map<SearchEntityResult>(nave => ({
    id: `nave:${nave.name_lower}`,
    type: 'nave',
    iconType: 'nave',
    title: nave.name,
    subtitle: 'Nave',
    endpoint: {
      type: 'nave',
      nameLower: nave.name_lower,
      label: nave.name,
    },
  }))

const getPassageSearchItems = (results: SearchResult[]) =>
  results.map<SearchEntityResult>(result => {
    const { title } = formatVerseContent([
      { Livre: result.book, Chapitre: result.chapter, Verset: result.verse },
    ])

    return {
      id: `passage:${result.version}:${result.book}:${result.chapter}:${result.verse}`,
      type: 'passages',
      iconType: 'passages',
      title,
      subtitle: result.version,
      description: result.highlighted,
      passage: result,
    }
  })

const SQLiteSearchScreen = ({ searchValue, setSearchValue }: Props) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const router = useRouter()
  const openRelationEndpoint = useOpenRelationEndpoint()
  const notes = useSelector((state: RootState) => state.user.bible.notes)
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
  const [studyResults, setStudyResults] = useState<SearchEntityResult[]>([])
  const [strongResults, setStrongResults] = useState<LexiqueRow[]>([])
  const [dictionaryResults, setDictionaryResults] = useState<DictionnaireSearchRow[]>([])
  const [naveResults, setNaveResults] = useState<NaveSearchRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [hasInstalledVersions, setHasInstalledVersions] = useState(true)
  const [visibleCounts, setVisibleCounts] = useState<Partial<Record<SearchSectionId, number>>>({})

  const [section, _setSection] = useState<SearchSection>(globalFilters.section)
  const [book, _setBook] = useState(globalFilters.book)
  const [selectedVersion, _setSelectedVersion] = useState(globalFilters.selectedVersion)
  const [sortOrder, _setSortOrder] = useState<SearchSortOrder>(globalFilters.sortOrder)
  const [itemFilters, _setItemFilters] = useState(globalFilters.itemFilters)
  const [installedVersions, setInstalledVersions] = useState<string[]>([])

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
    const activeTypes = itemFilterOrder.filter(itemType => itemFilters[itemType])
    const areAllActive = activeTypes.length === itemFilterOrder.length
    const next = (() => {
      if (areAllActive) {
        return itemFilterOrder.reduce(
          (filters, itemType) => ({
            ...filters,
            [itemType]: itemType === type,
          }),
          {} as Record<SearchItemType, boolean>
        )
      }

      const toggled = { ...itemFilters, [type]: !itemFilters[type] }
      const hasActiveFilter = itemFilterOrder.some(itemType => toggled[itemType])
      return hasActiveFilter ? toggled : allItemFilters
    })()
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
      itemFilters.notes &&
      searchValue.trim().length >= MIN_SEARCH_LENGTH &&
      trimmed.length >= MIN_SEARCH_LENGTH

    if (!shouldSearch) {
      setNoteResults([])
      return
    }

    let cancelled = false
    const timeout = setTimeout(() => {
      if (cancelled) return
      setNoteResults(searchWithMatches(getNoteSearchItems(notes, t), trimmed))
    }, 0)

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [debouncedSearchValue, itemFilters.notes, notes, searchValue, t])

  useEffect(() => {
    const trimmed = debouncedSearchValue.trim()
    const shouldSearch =
      itemFilters.studies &&
      searchValue.trim().length >= MIN_SEARCH_LENGTH &&
      trimmed.length >= MIN_SEARCH_LENGTH

    if (!shouldSearch) {
      setStudyResults([])
      return
    }

    let cancelled = false
    const timeout = setTimeout(() => {
      if (cancelled) return
      setStudyResults(searchWithMatches(getStudySearchItems(studies, t), trimmed))
    }, 0)

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [debouncedSearchValue, itemFilters.studies, searchValue, studies, t])

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
      searchValue.trim().length >= MIN_SEARCH_LENGTH &&
      trimmed.length >= MIN_SEARCH_LENGTH

    if (!shouldSearch || strongDb.isLoading || strongDb.proposeDownload) {
      setStrongResults([])
      return
    }

    let cancelled = false
    loadLexiqueBySearch(trimmed).then(results => {
      if (cancelled) return
      setStrongResults(isDatabaseError(results) ? [] : results)
    })

    return () => {
      cancelled = true
    }
  }, [
    debouncedSearchValue,
    itemFilters.strong,
    searchValue,
    strongDb.isLoading,
    strongDb.proposeDownload,
  ])

  useEffect(() => {
    const trimmed = debouncedSearchValue.trim()
    const shouldSearch =
      itemFilters.dictionary &&
      searchValue.trim().length >= MIN_SEARCH_LENGTH &&
      trimmed.length >= MIN_SEARCH_LENGTH

    if (!shouldSearch || dictionaryDb.isLoading || dictionaryDb.proposeDownload) {
      setDictionaryResults([])
      return
    }

    let cancelled = false
    loadDictionnaireBySearch(trimmed).then(results => {
      if (cancelled) return
      setDictionaryResults(isDatabaseError(results) ? [] : results)
    })

    return () => {
      cancelled = true
    }
  }, [
    debouncedSearchValue,
    itemFilters.dictionary,
    searchValue,
    dictionaryDb.isLoading,
    dictionaryDb.proposeDownload,
  ])

  useEffect(() => {
    const trimmed = debouncedSearchValue.trim()
    const shouldSearch =
      itemFilters.nave &&
      searchValue.trim().length >= MIN_SEARCH_LENGTH &&
      trimmed.length >= MIN_SEARCH_LENGTH

    if (!shouldSearch || naveDb.isLoading || naveDb.proposeDownload) {
      setNaveResults([])
      return
    }

    let cancelled = false
    loadNaveBySearch(trimmed).then(results => {
      if (cancelled) return
      setNaveResults(isDatabaseError(results) ? [] : results)
    })

    return () => {
      cancelled = true
    }
  }, [
    debouncedSearchValue,
    itemFilters.nave,
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
    hasSearchQuery &&
    searchValue.trim().length >= MIN_SEARCH_LENGTH &&
    debouncedSearchValue.trim().length >= MIN_SEARCH_LENGTH
  const referenceItems = itemFilters.passages ? getReferenceSearchItems(debouncedSearchValue) : []
  const noteItems = itemFilters.notes ? noteResults : []
  const studyItems = itemFilters.studies ? studyResults : []
  const strongItems = itemFilters.strong ? getStrongSearchItems(strongResults, t) : []
  const dictionaryItems = itemFilters.dictionary ? getDictionarySearchItems(dictionaryResults) : []
  const naveItems = itemFilters.nave ? getNaveSearchItems(naveResults) : []
  const passageItems = itemFilters.passages ? getPassageSearchItems(results ?? []) : []

  const searchSections: SearchResultSection[] = [
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
  const showNoResults =
    showResultsList && !isSearching && searchSections.length === 0 && !searchError

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

  const renderItemFilter = (type: SearchItemType) => {
    const config = itemFilterConfig[type]
    const isActive = itemFilters[type]
    return (
      <TouchableBox
        key={type}
        onPress={() => toggleItemFilter(type)}
        row
        center
        gap={6}
        px={6}
        mr={8}
        borderRadius={8}
        bg="lightGrey"
        opacity={isActive ? 1 : 0.6}
      >
        <SearchTypeIcon type={type} size={15} color={isActive ? config.color : 'grey'} />
        <Text fontSize={13} color={isActive ? undefined : 'grey'} numberOfLines={1}>
          {t(config.labelKey)}
        </Text>
      </TouchableBox>
    )
  }

  function renderContent(): ReactNode {
    if (showResultsList) {
      return (
        <KeyboardAwareFlatList
          enableOnAndroid
          keyboardShouldPersistTaps="handled"
          enableResetScrollToCoords={false}
          style={{
            paddingBottom: 40,
            flex: 1,
            backgroundColor: theme.colors.reverse,
          }}
          removeClippedSubviews
          data={searchSections}
          keyExtractor={(section: SearchResultSection) => section.id}
          ListEmptyComponent={
            showNoResults ? (
              <SearchNoResultsState query={debouncedSearchValue} />
            ) : (
              <SearchEmptyState onExamplePress={setSearchValue} />
            )
          }
          renderItem={({ item: section }: { item: SearchResultSection }) => (
            <SearchSectionBlock
              section={section}
              visibleCount={visibleCounts[section.id] || SEARCH_SECTION_PREVIEW_LIMIT}
              onLoadMore={() => increaseVisibleCount(section.id)}
              onPressItem={openSearchItem}
              statusMessage={section.id === 'passages' ? renderPassageError() : null}
              isLoading={section.id === 'passages' && isSearching}
            />
          )}
        />
      )
    }

    return <SearchEmptyState onExamplePress={setSearchValue} />
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 28, paddingHorizontal: 20, marginBottom: 4, marginTop: 10 }}
      >
        {itemFilterOrder.map(renderItemFilter)}
      </ScrollView>
      {hasInstalledVersions && !hasReference && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{
            maxHeight: 55,
            paddingHorizontal: 20,
            opacity: itemFilters.passages ? 1 : 0.3,
            pointerEvents: itemFilters.passages ? 'auto' : 'none',
          }}
        >
          <DropdownMenu
            title={t('Section')}
            currentValue={section}
            setValue={(v: string) => setSection(v as SearchSection)}
            choices={sectionValues}
          />
          <DropdownMenu title={t('Livre')} currentValue={book} setValue={setBook} choices={books} />
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
        </ScrollView>
      )}

      {renderContent()}
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

const SearchTypeIcon = ({
  type,
  size = 18,
  color,
}: {
  type: SearchItemType
  size?: number
  color?: string
}) => {
  const iconColor = color || itemFilterConfig[type].color

  switch (type) {
    case 'passages':
      return <FeatherIcon name="book-open" size={size} color={iconColor} />
    case 'notes':
      return <FeatherIcon name="file-text" size={size} color={iconColor} />
    case 'studies':
      return <FeatherIcon name="feather" size={size} color={iconColor} />
    case 'strong':
      return <LexiqueIcon color={iconColor} size={size} />
    case 'dictionary':
      return <DictionnaryIcon color={iconColor} size={size} />
    case 'nave':
      return <NaveIcon color={iconColor} size={size} />
  }
}

const HighlightedText = ({
  value,
  match,
  bold,
  color = 'grey',
}: {
  value?: string
  match?: FuseResultMatch
  bold?: boolean
  color?: string
}) => {
  const text = normalizeDisplayedText(value)
  const ranges = match ? mergeRanges(match.indices as MatchRange[]) : []

  if (!text) return null

  if (!ranges.length) {
    return (
      <Text
        bold={bold}
        fontSize={bold ? 15 : 13}
        color={bold ? undefined : color}
        numberOfLines={1}
      >
        {text}
      </Text>
    )
  }

  const chunks: { text: string; highlighted: boolean }[] = []
  let cursor = 0

  ranges.forEach(([start, end]) => {
    if (start > cursor) {
      chunks.push({ text: text.slice(cursor, start), highlighted: false })
    }
    chunks.push({ text: text.slice(start, end + 1), highlighted: true })
    cursor = end + 1
  })

  if (cursor < text.length) {
    chunks.push({ text: text.slice(cursor), highlighted: false })
  }

  return (
    <Text bold={bold} fontSize={bold ? 15 : 13} color={bold ? undefined : color} numberOfLines={1}>
      {chunks.map((chunk, index) => (
        <Text
          key={`${chunk.text}-${index}`}
          bold={chunk.highlighted || bold}
          fontSize={bold ? 15 : 13}
          color={chunk.highlighted ? 'primary' : bold ? undefined : color}
          bg={chunk.highlighted ? 'lightPrimary' : undefined}
        >
          {chunk.text}
        </Text>
      ))}
    </Text>
  )
}

const PassageDescription = ({ highlighted }: { highlighted?: string }) => {
  const parts = (highlighted || '').split(/(\{\{.*?\}\})/g)

  return (
    <Paragraph small numberOfLines={1}>
      {parts.map((part, i) => {
        if (part.startsWith('{{') && part.endsWith('}}')) {
          return (
            <Paragraph small bold color="primary" key={i}>
              {part.slice(2, -2)}
            </Paragraph>
          )
        }
        return part
      })}
    </Paragraph>
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

const SearchEntityResultRow = ({
  item,
  onPress,
}: {
  item: SearchEntityResult
  onPress: () => void
}) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
    <HStack px={20} py={12} borderBottomWidth={1} borderColor="border" alignItems="center" gap={12}>
      <Box
        width={36}
        height={36}
        borderRadius={10}
        bg="lightGrey"
        alignItems="center"
        justifyContent="center"
      >
        <SearchTypeIcon type={item.iconType} />
      </Box>
      <VStack flex={1}>
        <HStack alignItems="center" gap={6} mb={2}>
          <HighlightedText value={item.title} match={getMatchForKey(item, 'title')} bold />
          {item.subtitle && item.type === 'passages' ? <Chip>{item.subtitle}</Chip> : null}
        </HStack>
        {item.passage ? (
          <PassageDescription highlighted={item.description} />
        ) : item.description ? (
          <HighlightedText
            value={item.description}
            match={getMatchForKey(item, 'description')}
            color="grey"
          />
        ) : item.subtitle ? (
          <Text fontSize={13} color="grey" numberOfLines={1}>
            {item.subtitle}
          </Text>
        ) : null}
      </VStack>
    </HStack>
  </TouchableOpacity>
)

const SearchSectionBlock = ({
  section,
  visibleCount,
  onLoadMore,
  onPressItem,
  statusMessage,
  isLoading,
}: {
  section: SearchResultSection
  visibleCount: number
  onLoadMore: () => void
  onPressItem: (item: SearchEntityResult) => void
  statusMessage?: ReactNode
  isLoading?: boolean
}) => {
  const visibleItems = section.items.slice(0, visibleCount)
  const remaining = Math.max(0, section.items.length - visibleCount)

  return (
    <Box pt={10}>
      <HStack px={20} py={8} alignItems="center" gap={8}>
        <Text title fontSize={16} opacity={0.6}>
          {section.title}
        </Text>
        <Chip variant="bold">{section.count}</Chip>
      </HStack>
      {statusMessage}
      {isLoading && !visibleItems.length ? (
        <Box px={20} py={16}>
          <Text color="grey">{String(i18n.t('Recherche en cours...'))}</Text>
        </Box>
      ) : null}
      {visibleItems.map(item =>
        item.referenceSegment ? (
          <ReferenceSearchResultRow key={item.id} item={item} />
        ) : (
          <SearchEntityResultRow key={item.id} item={item} onPress={() => onPressItem(item)} />
        )
      )}
      {remaining > 0 ? (
        <TouchableBox onPress={onLoadMore} py={10} px={20} alignItems="flex-start">
          <Box px={10} py={6} bg="lightGrey" borderRadius={6}>
            <Text color="primary" fontSize={13} bold>
              {String(i18n.t('Voir plus'))}
            </Text>
          </Box>
        </TouchableBox>
      ) : null}
    </Box>
  )
}

export default SQLiteSearchScreen
