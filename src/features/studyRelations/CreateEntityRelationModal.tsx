import { SheetFlashList, Sheet, SheetHeader, type SheetRef } from '~common/sheet'
import { useTheme } from '@emotion/react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useAtomValue } from 'jotai/react'
import { Ref, useDeferredValue, useEffect, useState } from 'react'
import { ActivityIndicator } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import AlphabetList from '~common/AlphabetList'
import SheetSearchInput from '~common/SheetSearchInput'
import Empty from '~common/Empty'
import Box, { TouchableBox, VStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import useBibleVerses from '~features/resources/useBibleVerses'
import useDebounce from '~helpers/useDebounce'
import type { DictionarySummary } from '~features/resources/dictionaryAccess'
import type { NaveTopicSummary } from '~features/resources/naveAccess'
import { useResourceAccess } from '~features/resources/resourceAccess'
import SharedSearchEntityResultRow from '~features/search/shared/SearchEntityResultRow'
import SearchItemFilterBar, {
  getNextSearchItemFilters,
  searchItemFilterOrder,
} from '~features/search/shared/SearchItemFilterBar'
import SearchSectionBlock, {
  SEARCH_SECTION_LOAD_MORE_COUNT,
  SEARCH_SECTION_PREVIEW_LIMIT,
  type SearchResultSection,
} from '~features/search/shared/SearchSectionBlock'
import { searchRelationTargetsWithMatches } from '~features/search/shared/searchFuzzy'
import { getStrongSearchItems } from '~features/search/shared/searchItems'
import type { SearchEntityResult } from '~features/search/shared/searchResultTypes'
import { removeBreakLines } from '~helpers/utils'
import { RootState } from '~redux/modules/reducer'
import { attachNoteToVerseAction, createStudyRelation } from '~redux/modules/user'
import type { AppDispatch } from '~redux/store'
import type { SearchItemFilters, SearchItemType } from '~state/searchFilters'
import { endpointsMatch, getEndpointFallbackLabel, type RelationEndpoint } from './domain'
import { createDictionaryEndpoint, createNaveEndpoint } from './endpoints'
import {
  getSortedLinkTargetItems,
  getSortedNoteTargetItems,
  getSortedStudyTargetItems,
  getSortedAnnotationTargetItems,
  searchReferenceAndStrongTargets,
  type RelationTargetResult,
} from './targetSearch'
import type { StrongLexiconSearchResult } from '~features/resources/strongLexiconAccess'
import { resourcesLanguageAtom } from '~state/resourcesLanguage'
import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'
import { ResourceAccessError } from '~features/resources/resourceAccessError'
import { resourceFailureFromAccessError } from '~features/resources/resourceFailure'
import { createOfflineCopyDownloadItem } from '~helpers/downloadItemFactory'
import type { OfflineCopyIdentity } from '~helpers/offlineCopyId'
import { useDefaultBibleVersion } from '~state/useDefaultBibleVersion'
import { useBookAndVersionSelector } from '~features/bible/BookSelectorSheet/BookSelectorSheetProvider'
import type { BibleTab, VersionCode } from '~state/tabs'

const VERSION_SELECTOR_BOOK = { Numero: 1, Nom: 'Genèse', Chapitres: 50 } as const
const EMPTY_VERSIONS: VersionCode[] = []
const EMPTY_SELECTED_VERSES = {}

type BrowseMode = 'note' | 'link' | 'study' | 'strong' | 'nave' | 'dictionary'
type NaveRow = NaveTopicSummary
type DictionaryRow = DictionarySummary
type MatchedRelationTargetResult = RelationTargetResult
type RelationTargetSectionId =
  | 'passages'
  | 'annotations'
  | 'notes'
  | 'links'
  | 'studies'
  | 'strong'
  | 'dictionary'
  | 'nave'
type RelationTargetSection = SearchResultSection<RelationTargetSectionId>
type RelationResourceFailure = {
  identity: OfflineCopyIdentity
  title: string
  error: unknown
  retry: () => Promise<unknown>
}

type Props = {
  ref?: Ref<SheetRef | null>
  title?: string
  sourceEndpoint: RelationEndpoint | null
  onCreated?: () => void
  onSelectTarget?: (target: RelationTargetResult) => void | Promise<void>
  allowedTypes?: RelationEndpoint['type'][]
}

const browseModeLabelKeys: Record<BrowseMode, string> = {
  note: 'Notes',
  link: 'Liens',
  study: 'Études',
  strong: 'Strong',
  nave: 'Nave',
  dictionary: 'Dictionnaire',
}

const relationTypeToSearchItemType: Record<RelationEndpoint['type'], SearchItemType> = {
  verse: 'passages',
  note: 'notes',
  externalLink: 'links',
  annotation: 'passages',
  study: 'studies',
  strong: 'strong',
  nave: 'nave',
  dictionary: 'dictionary',
  word: 'dictionary',
}

const searchItemTypeToBrowseMode: Record<SearchItemType, BrowseMode | null> = {
  passages: null,
  notes: 'note',
  links: 'link',
  studies: 'study',
  strong: 'strong',
  dictionary: 'dictionary',
  nave: 'nave',
}

const getAllowedSearchItemTypes = (allowedTypes?: RelationEndpoint['type'][]): SearchItemType[] => {
  if (!allowedTypes) return searchItemFilterOrder

  const allowedSet = new Set(allowedTypes.map(type => relationTypeToSearchItemType[type]))
  return searchItemFilterOrder.filter(type => allowedSet.has(type))
}

const getAllowedSearchItemTypesFromKey = (allowedTypesKey: string): SearchItemType[] => {
  if (!allowedTypesKey) return searchItemFilterOrder

  const allowedSet = new Set(
    allowedTypesKey
      .split('|')
      .map(type => relationTypeToSearchItemType[type as RelationEndpoint['type']])
      .filter(Boolean)
  )
  return searchItemFilterOrder.filter(type => allowedSet.has(type))
}

const getSearchItemFiltersForTypes = (enabledTypes: SearchItemType[]) => {
  const enabledSet = new Set(enabledTypes)
  return searchItemFilterOrder.reduce(
    (filters, type) => ({
      ...filters,
      [type]: enabledSet.has(type),
    }),
    {} as SearchItemFilters
  )
}

const getNaveTargetResult = (nave: NaveRow): RelationTargetResult => ({
  id: `nave:${nave.normalizedName}`,
  type: 'nave',
  iconType: 'nave',
  title: nave.name,
  subtitle: 'Nave',
  endpoint: createNaveEndpoint({ nameLower: nave.normalizedName, labelFallback: nave.name }),
})

const getDictionaryTargetResult = (dictionary: DictionaryRow): RelationTargetResult => ({
  id: getDictionaryTargetKey(dictionary),
  type: 'dictionary',
  iconType: 'dictionary',
  title: dictionary.word,
  subtitle: 'Dictionnaire',
  endpoint: createDictionaryEndpoint({ word: dictionary.word, labelFallback: dictionary.word }),
})

const getDictionaryTargetKey = (dictionary: DictionaryRow, index?: number) =>
  [
    'dictionary',
    dictionary.id ?? dictionary.normalizedWord ?? dictionary.word,
    dictionary.word,
    index,
  ]
    .filter(value => value !== undefined && value !== null && value !== '')
    .join(':')

const getSourceEndpointSubtitle = (
  endpoint: RelationEndpoint | null,
  t: (key: string) => string
) => {
  if (!endpoint) return undefined

  switch (endpoint.type) {
    case 'verse':
      return getEndpointFallbackLabel(endpoint)
    case 'note':
      return t('Note')
    case 'study':
      return t('Étude')
    case 'strong':
      return endpoint.originalWord || endpoint.labelFallback || getEndpointFallbackLabel(endpoint)
    case 'nave':
      return endpoint.labelFallback || getEndpointFallbackLabel(endpoint)
    case 'dictionary':
    case 'externalLink':
    case 'annotation':
    case 'word':
      return endpoint.labelFallback || getEndpointFallbackLabel(endpoint)
  }
}

const searchWithMatches = (
  targets: RelationTargetResult[],
  keyword: string
): MatchedRelationTargetResult[] =>
  searchRelationTargetsWithMatches(targets, keyword).filter(
    (item): item is MatchedRelationTargetResult => Boolean(item.endpoint)
  )

const getVerseIds = (endpoint: RelationEndpoint) =>
  endpoint.type === 'verse'
    ? endpoint.verseKeys.map(key => {
        const [Livre, Chapitre, Verset] = key.split('-')
        return { Livre, Chapitre, Verset }
      })
    : []

const getNoteVerseAttachmentEndpoints = (
  sourceEndpoint: RelationEndpoint,
  targetEndpoint: RelationEndpoint
) => {
  const endpoints = [sourceEndpoint, targetEndpoint]
  const noteEndpoint = endpoints.find(
    (endpoint): endpoint is Extract<RelationEndpoint, { type: 'note' }> => endpoint.type === 'note'
  )
  const verseEndpoint = endpoints.find(
    (endpoint): endpoint is Extract<RelationEndpoint, { type: 'verse' }> =>
      endpoint.type === 'verse'
  )

  if (!noteEndpoint || !verseEndpoint) return undefined
  return { noteEndpoint, verseEndpoint }
}

const VerseTargetDescription = ({
  endpoint,
}: {
  endpoint: Extract<RelationEndpoint, { type: 'verse' }>
}) => {
  const verses = useBibleVerses(getVerseIds(endpoint), endpoint.version)
  const description = verses.map(verse => verse.Texte).join(' ')

  if (!description) return null

  return (
    <Text fontSize={13} color="tertiary" numberOfLines={1}>
      {removeBreakLines(description)}
    </Text>
  )
}

const RelationTargetRow = ({
  item,
  onPress,
}: {
  item: MatchedRelationTargetResult
  onPress: () => void
}) => (
  <SharedSearchEntityResultRow
    item={item}
    onPress={onPress}
    showArrow
    description={
      item.endpoint.type === 'verse' ? (
        <VerseTargetDescription endpoint={item.endpoint} />
      ) : undefined
    }
    descriptionColor="tertiary"
  />
)

const LoadingIndicator = () => {
  const theme = useTheme()
  return (
    <Box flex minHeight={180} justifyContent="center" alignItems="center">
      <ActivityIndicator color={theme.colors.grey} />
    </Box>
  )
}

const CreateEntityRelationModal = ({
  ref,
  title,
  sourceEndpoint,
  onCreated,
  onSelectTarget,
  allowedTypes,
}: Props) => {
  const { t } = useTranslation()
  const resources = useResourceAccess()
  const defaultBibleVersion = useDefaultBibleVersion()
  const { openVersionSelector } = useBookAndVersionSelector()
  const resourcesLanguage = useAtomValue(resourcesLanguageAtom)
  const dispatch = useDispatch<AppDispatch>()
  const allowedTypesKey = allowedTypes?.join('|') || ''
  const [searchValue, setSearchValue] = useState('')
  const [itemFilters, setItemFilters] = useState<SearchItemFilters>(() =>
    getSearchItemFiltersForTypes(getAllowedSearchItemTypesFromKey(allowedTypesKey))
  )
  const [strongLetter, setStrongLetter] = useState('a')
  const [naveLetter, setNaveLetter] = useState('a')
  const [dictionaryLetter, setDictionaryLetter] = useState('a')
  const [passageVersion, setPassageVersion] = useState<VersionCode>(defaultBibleVersion)
  const [visibleCounts, setVisibleCounts] = useState<
    Partial<Record<RelationTargetSectionId, number>>
  >({})
  const debouncedStrongSearchValue = useDebounce(searchValue, 300)
  const debouncedResourceSearchValue = useDebounce(searchValue, 300)
  const deferredSearchValue = useDeferredValue(searchValue)
  const deferredStrongSearchValue = useDeferredValue(debouncedStrongSearchValue)
  const deferredResourceSearchValue = useDeferredValue(debouncedResourceSearchValue)
  const enabledItemTypes = getAllowedSearchItemTypes(allowedTypes)
  const activeItemTypes = searchItemFilterOrder.filter(
    type => enabledItemTypes.includes(type) && itemFilters[type]
  )
  const browseMode =
    activeItemTypes.length === 1 ? searchItemTypeToBrowseMode[activeItemTypes[0]] : null
  const deferredBrowseMode = useDeferredValue(browseMode)
  const immediateSearchHasValue = Boolean(searchValue.trim())
  const deferredSearchHasValue = Boolean(deferredSearchValue.trim())
  const isStrongPending =
    browseMode === 'strong' &&
    immediateSearchHasValue &&
    debouncedStrongSearchValue !== deferredStrongSearchValue
  const isLocalSearchPending =
    browseMode !== 'strong' && immediateSearchHasValue && searchValue !== deferredSearchValue
  const isNavePending =
    browseMode === 'nave' &&
    immediateSearchHasValue &&
    debouncedResourceSearchValue !== deferredResourceSearchValue
  const isDictionaryPending =
    browseMode === 'dictionary' &&
    immediateSearchHasValue &&
    debouncedResourceSearchValue !== deferredResourceSearchValue

  const notes = useSelector((state: RootState) => state.user.bible.notes)
  const links = useSelector((state: RootState) => state.user.bible.links)
  const studies = useSelector((state: RootState) => state.user.bible.studies)
  const wordAnnotations = useSelector((state: RootState) => state.user.bible.wordAnnotations)
  const shouldBuildNoteTargets =
    itemFilters.notes &&
    (deferredBrowseMode === 'note' || (!deferredBrowseMode && deferredSearchHasValue))
  const shouldBuildStudyTargets =
    itemFilters.studies &&
    (deferredBrowseMode === 'study' || (!deferredBrowseMode && deferredSearchHasValue))
  const shouldBuildLinkTargets =
    itemFilters.links &&
    (deferredBrowseMode === 'link' || (!deferredBrowseMode && deferredSearchHasValue))
  const noteTargets = shouldBuildNoteTargets ? getSortedNoteTargetItems(notes) : []
  const studyTargets = shouldBuildStudyTargets ? getSortedStudyTargetItems(studies) : []
  const linkTargets = shouldBuildLinkTargets ? getSortedLinkTargetItems(links) : []
  const shouldBuildAnnotationTargets =
    itemFilters.passages && !deferredBrowseMode && deferredSearchHasValue
  const annotationTargets = shouldBuildAnnotationTargets
    ? getSortedAnnotationTargetItems(wordAnnotations)
    : []
  const fuzzyNoteTargets = searchWithMatches(noteTargets, deferredSearchValue)
  const fuzzyLinkTargets = searchWithMatches(linkTargets, deferredSearchValue)
  const fuzzyStudyTargets = searchWithMatches(studyTargets, deferredSearchValue)
  const fuzzyAnnotationTargets = searchWithMatches(annotationTargets, deferredSearchValue)
  const isAllowed = (type: RelationEndpoint['type']) => {
    const itemType = relationTypeToSearchItemType[type]
    return enabledItemTypes.includes(itemType) && itemFilters[itemType]
  }

  useEffect(() => {
    setItemFilters(getSearchItemFiltersForTypes(getAllowedSearchItemTypesFromKey(allowedTypesKey)))
  }, [allowedTypesKey])

  const shouldLoadStrongTargets =
    isAllowed('strong') &&
    (deferredBrowseMode === 'strong' || (!deferredBrowseMode && deferredSearchHasValue))

  const strongQuery = useInfiniteQuery({
    queryKey: [
      'relation-strong-targets',
      resourcesLanguage.STRONG,
      deferredStrongSearchValue,
      strongLetter,
    ],
    queryFn: async ({ pageParam }) => {
      const availability = await resources.strongLexicon.getModuleAvailability('core')
      if (availability.status !== 'available') {
        throw new ResourceAccessError(
          availability.status === 'corrupt' ? 'INVALID_OFFLINE_COPY' : 'UNKNOWN',
          (await resources.strongLexicon.getModuleRecoveryActions?.('core')) ?? [
            'acquire-offline-copy',
          ]
        )
      }
      return resources.strongLexicon.listEntries({
        language: resourcesLanguage.STRONG,
        limit: 20,
        ...(pageParam ? { cursor: pageParam } : {}),
        ...(deferredStrongSearchValue.trim()
          ? { search: deferredStrongSearchValue }
          : { prefix: strongLetter }),
      })
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.nextCursor,
    enabled: shouldLoadStrongTargets,
  })
  const strongResults: StrongLexiconSearchResult[] = shouldLoadStrongTargets
    ? (strongQuery.data?.pages.flatMap(page => page.entries) ?? [])
    : []

  const shouldLoadNaveTargets =
    isAllowed('nave') &&
    (deferredBrowseMode === 'nave' || (!deferredBrowseMode && deferredSearchHasValue))
  const shouldLoadDictionaryTargets =
    isAllowed('dictionary') &&
    (deferredBrowseMode === 'dictionary' || (!deferredBrowseMode && deferredSearchHasValue))

  const naveQuery = useInfiniteQuery({
    queryKey: [
      'relation-nave-targets',
      resourcesLanguage.NAVE,
      deferredResourceSearchValue,
      naveLetter,
    ],
    queryFn: async ({ pageParam }) => {
      const availability = await resources.nave.getAvailability?.(resourcesLanguage.NAVE)
      if (availability?.status === 'unavailable') {
        throw new ResourceAccessError(
          availability.reason === 'invalid-offline-copy' ? 'INVALID_OFFLINE_COPY' : 'UNKNOWN',
          availability.recoveries
        )
      }
      return deferredResourceSearchValue.trim()
        ? resources.nave.searchPage(
            deferredResourceSearchValue,
            { limit: 20, ...(pageParam ? { cursor: pageParam } : {}) },
            resourcesLanguage.NAVE
          )
        : resources.nave.listByLetterPage(
            naveLetter,
            { limit: 20, ...(pageParam ? { cursor: pageParam } : {}) },
            resourcesLanguage.NAVE
          )
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.nextCursor,
    enabled: shouldLoadNaveTargets,
  })
  const naveResults: NaveRow[] =
    shouldLoadNaveTargets && naveQuery.data ? naveQuery.data.pages.flatMap(page => page.topics) : []
  const dictionaryQuery = useInfiniteQuery({
    queryKey: [
      'relation-dictionary-targets',
      resourcesLanguage.DICTIONNAIRE,
      deferredResourceSearchValue,
      dictionaryLetter,
    ],
    queryFn: async ({ pageParam }) => {
      const availability = await resources.dictionary.getAvailability?.(
        resourcesLanguage.DICTIONNAIRE
      )
      if (availability?.status === 'unavailable') {
        throw new ResourceAccessError(
          availability.reason === 'invalid-offline-copy' ? 'INVALID_OFFLINE_COPY' : 'UNKNOWN',
          availability.recoveries
        )
      }
      return deferredResourceSearchValue.trim()
        ? resources.dictionary.searchPage(
            deferredResourceSearchValue,
            { limit: 20, ...(pageParam ? { cursor: pageParam } : {}) },
            resourcesLanguage.DICTIONNAIRE
          )
        : resources.dictionary.listByLetterPage(
            dictionaryLetter,
            { limit: 20, ...(pageParam ? { cursor: pageParam } : {}) },
            resourcesLanguage.DICTIONNAIRE
          )
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.nextCursor,
    enabled: shouldLoadDictionaryTargets,
  })
  const dictionaryResults: DictionaryRow[] =
    shouldLoadDictionaryTargets && dictionaryQuery.data
      ? dictionaryQuery.data.pages.flatMap(page => page.entries)
      : []

  const handleSearch = (value: string) => {
    setSearchValue(value)
  }

  const toggleItemFilter = (type: SearchItemType) => {
    setItemFilters(filters => getNextSearchItemFilters(filters, type, enabledItemTypes))
    setVisibleCounts({})
  }

  const exitBrowseMode = () => {
    setItemFilters(getSearchItemFiltersForTypes(enabledItemTypes))
    setVisibleCounts({})
    handleSearch('')
  }

  const increaseVisibleCount = (sectionId: RelationTargetSectionId) => {
    setVisibleCounts(prev => ({
      ...prev,
      [sectionId]:
        (prev[sectionId] || SEARCH_SECTION_PREVIEW_LIMIT) + SEARCH_SECTION_LOAD_MORE_COUNT,
    }))
  }

  const resetPicker = () => {
    handleSearch('')
    setItemFilters(getSearchItemFiltersForTypes(enabledItemTypes))
    setVisibleCounts({})
  }

  const selectTarget = async (target: RelationTargetResult) => {
    const endpoint = target.endpoint

    if (onSelectTarget) {
      resetPicker()
      await onSelectTarget(target)
      return
    }

    if (!sourceEndpoint || endpointsMatch(sourceEndpoint, endpoint)) return

    const noteVerseAttachment = getNoteVerseAttachmentEndpoints(sourceEndpoint, endpoint)

    if (noteVerseAttachment) {
      dispatch(attachNoteToVerseAction(noteVerseAttachment))
    } else {
      dispatch(
        createStudyRelation({
          endpoints: [sourceEndpoint, endpoint],
        })
      )
    }
    resetPicker()
    onCreated?.()
  }

  const immediateReferenceResults = searchReferenceAndStrongTargets(searchValue, passageVersion)
  const referenceItems = immediateReferenceResults.filter(
    result => result.endpoint.type === 'verse' && isAllowed('verse')
  )
  const noteItems = itemFilters.notes ? fuzzyNoteTargets : []
  const linkItems = itemFilters.links ? fuzzyLinkTargets : []
  const studyItems = itemFilters.studies ? fuzzyStudyTargets : []
  const annotationItems = itemFilters.passages ? fuzzyAnnotationTargets : []
  const directStrongItems = immediateReferenceResults.filter(
    result => result.endpoint.type === 'strong' && isAllowed('strong')
  )
  const strongItems = itemFilters.strong
    ? [
        ...directStrongItems,
        ...(deferredSearchHasValue || deferredBrowseMode === 'strong'
          ? getStrongSearchItems(strongResults, t)
          : []),
      ]
    : []
  const dictionaryItems = itemFilters.dictionary
    ? dictionaryResults.map((dictionary, index) => ({
        ...getDictionaryTargetResult(dictionary),
        id: getDictionaryTargetKey(dictionary, index),
      }))
    : []
  const naveItems = itemFilters.nave ? naveResults.map(getNaveTargetResult) : []
  const searchSections: RelationTargetSection[] = [
    ...(referenceItems.length
      ? [
          {
            id: 'passages' as const,
            title: t('Passages'),
            count: referenceItems.length,
            items: referenceItems,
          },
        ]
      : []),
    ...(annotationItems.length
      ? [
          {
            id: 'annotations' as const,
            title: t('Annotations'),
            count: annotationItems.length,
            items: annotationItems,
          },
        ]
      : []),
    ...(noteItems.length
      ? [{ id: 'notes' as const, title: t('Notes'), count: noteItems.length, items: noteItems }]
      : []),
    ...(linkItems.length
      ? [{ id: 'links' as const, title: t('Liens'), count: linkItems.length, items: linkItems }]
      : []),
    ...(studyItems.length
      ? [
          {
            id: 'studies' as const,
            title: t('Études'),
            count: studyItems.length,
            items: studyItems,
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
          },
        ]
      : []),
    ...(naveItems.length
      ? [{ id: 'nave' as const, title: t('Nave'), count: naveItems.length, items: naveItems }]
      : []),
  ]
  const isListLoading =
    isLocalSearchPending ||
    isStrongPending ||
    isNavePending ||
    isDictionaryPending ||
    (shouldLoadStrongTargets && strongQuery.isFetching) ||
    (shouldLoadNaveTargets && naveQuery.isFetching) ||
    (shouldLoadDictionaryTargets && dictionaryQuery.isFetching)

  const resourceFailures: (RelationResourceFailure | undefined)[] = [
    shouldLoadStrongTargets && strongQuery.isError
      ? {
          identity: { kind: 'strong-lexicon-module', moduleId: 'core' } as const,
          title: t('resource.strong.temporarilyUnavailable'),
          error: strongQuery.error,
          retry: strongQuery.refetch,
        }
      : undefined,
    shouldLoadNaveTargets && naveQuery.isError
      ? {
          identity: {
            kind: 'database',
            databaseId: 'NAVE',
            language: resourcesLanguage.NAVE,
          } as const,
          title: t('resource.nave.temporarilyUnavailable'),
          error: naveQuery.error,
          retry: naveQuery.refetch,
        }
      : undefined,
    shouldLoadDictionaryTargets && dictionaryQuery.isError
      ? {
          identity: {
            kind: 'database',
            databaseId: 'DICTIONNAIRE',
            language: resourcesLanguage.DICTIONNAIRE,
          } as const,
          title: t('resource.dictionary.temporarilyUnavailable'),
          error: dictionaryQuery.error,
          retry: dictionaryQuery.refetch,
        }
      : undefined,
  ]
  const resourceFailure = resourceFailures.find(
    (failure): failure is RelationResourceFailure => failure !== undefined
  )

  const placeholder = browseMode
    ? {
        note: t('Rechercher dans les notes'),
        link: t('Rechercher dans les liens'),
        study: t('Rechercher dans les études'),
        strong: t('Rechercher un code Strong'),
        nave: t('Rechercher dans Nave'),
        dictionary: t('Rechercher dans le dictionnaire'),
      }[browseMode]
    : t('Passage, Strong, note, lien, étude...')

  const modalTitle: string = browseMode
    ? t(browseModeLabelKeys[browseMode])
    : title || t('Ajouter une relation')
  const modalSubtitle = getSourceEndpointSubtitle(sourceEndpoint, t)

  const renderTargetSearchItem = (item: SearchEntityResult) => {
    const endpoint = item.endpoint
    if (!endpoint) return null

    return (
      <RelationTargetRow
        key={item.id}
        item={item as RelationTargetResult}
        onPress={() => void selectTarget(item as RelationTargetResult)}
      />
    )
  }

  const emptyMessage = browseMode
    ? t('Aucun élément trouvé dans {{target}}', {
        target: t(browseModeLabelKeys[browseMode]).toLowerCase(),
      })
    : immediateSearchHasValue
      ? t('Aucune cible trouvée')
      : t('Rechercher un passage, un Strong, une note, une étude, Nave ou un mot')

  const emptyIcon = browseMode
    ? {
        note: require('~assets/images/empty-state-icons/note.svg'),
        link: require('~assets/images/empty-state-icons/link.svg'),
        study: require('~assets/images/empty-state-icons/study.svg'),
        strong: require('~assets/images/empty-state-icons/word.svg'),
        nave: require('~assets/images/empty-state-icons/word.svg'),
        dictionary: require('~assets/images/empty-state-icons/word.svg'),
      }[browseMode]
    : require('~assets/images/empty-state-icons/search.svg')

  const renderEmptyState = (message = emptyMessage) => (
    <Box flex minHeight={260} justifyContent="center" px={20}>
      <Empty icon={emptyIcon} message={message} />
    </Box>
  )
  const renderLoadingState = () => <LoadingIndicator />

  const passageVersionSelector = (
    <TouchableBox
      accessibilityRole="button"
      accessibilityLabel={t('accessibility.chooseVersion', { version: passageVersion })}
      onPress={() =>
        openVersionSelector({
          actions: {
            setSelectedVersion: version => setPassageVersion(version),
            setParallelVersion: () => undefined,
          },
          data: {
            selectedVersion: passageVersion,
            parallelVersions: EMPTY_VERSIONS,
            selectedBook: VERSION_SELECTOR_BOOK,
            selectedChapter: 1,
            selectedVerse: 1,
            focusVerses: undefined,
            temp: {
              selectedBook: VERSION_SELECTOR_BOOK,
              selectedChapter: 1,
              selectedVerse: 1,
            },
            selectedVerses: EMPTY_SELECTED_VERSES,
            selectionMode: 'grid',
            isSelectionMode: undefined,
            contextDisplayMode: 'focused',
          } satisfies BibleTab['data'],
        })
      }
      row
      center
      gap={5}
      px={8}
      py={6}
      borderRadius={8}
      bg="lightGrey"
    >
      <FeatherIcon name="book-open" size={14} color="primary" />
      <Text color="primary" fontSize={13} fontWeight="bold">
        {passageVersion}
      </Text>
      <FeatherIcon name="chevron-down" size={13} color="primary" />
    </TouchableBox>
  )

  const searchHeader = (
    <Box px={20} pt={8} pb={12}>
      <SheetSearchInput
        value={searchValue}
        onChangeText={handleSearch}
        onDelete={() => handleSearch('')}
        placeholder={placeholder}
        autoFocus
      />

      <SearchItemFilterBar
        itemFilters={itemFilters}
        onToggle={toggleItemFilter}
        enabledTypes={enabledItemTypes}
        px={0}
        mt={10}
        mb={0}
      />
    </Box>
  )

  return (
    <Sheet
      ref={ref}
      snapPoints={[0.75]}
      header={
        <SheetHeader
          title={modalTitle}
          subTitle={modalSubtitle}
          hasBackButton={Boolean(browseMode)}
          onBackPress={exitBrowseMode}
        >
          {searchHeader}
        </SheetHeader>
      }
    >
      <VStack flex={1}>
        {resourceFailure ? (
          <ResourceUnavailableView
            identity={resourceFailure.identity}
            title={resourceFailure.title}
            fileSize={Math.max(
              1,
              Math.round(
                createOfflineCopyDownloadItem(resourceFailure.identity).estimatedSize / 1_000_000
              )
            )}
            failure={resourceFailureFromAccessError(resourceFailure.error)}
            onRetry={() => void resourceFailure.retry()}
          />
        ) : (
          <SheetFlashList
            keyboardShouldPersistTaps="handled"
            data={searchSections}
            onEndReachedThreshold={0.4}
            onEndReached={() => {
              if (
                browseMode === 'strong' &&
                strongQuery.hasNextPage &&
                !strongQuery.isFetchingNextPage
              ) {
                void strongQuery.fetchNextPage()
              }
              if (
                browseMode === 'dictionary' &&
                dictionaryQuery.hasNextPage &&
                !dictionaryQuery.isFetchingNextPage
              ) {
                void dictionaryQuery.fetchNextPage()
              }
              if (browseMode === 'nave' && naveQuery.hasNextPage && !naveQuery.isFetchingNextPage) {
                void naveQuery.fetchNextPage()
              }
            }}
            renderItem={({ item: section }: { item: RelationTargetSection }) => (
              <SearchSectionBlock
                section={section}
                headerAction={section.id === 'passages' ? passageVersionSelector : undefined}
                visibleCount={
                  browseMode === section.id &&
                  (section.id === 'strong' || section.id === 'dictionary' || section.id === 'nave')
                    ? section.items.length
                    : visibleCounts[section.id] || SEARCH_SECTION_PREVIEW_LIMIT
                }
                onLoadMore={() => {
                  const currentVisible = visibleCounts[section.id] || SEARCH_SECTION_PREVIEW_LIMIT
                  increaseVisibleCount(section.id)
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
                onPressItem={() => undefined}
                renderItem={renderTargetSearchItem}
                isLoading={
                  (section.id === 'strong' && (strongQuery.isFetching || isStrongPending)) ||
                  (section.id === 'dictionary' &&
                    (dictionaryQuery.isFetching || isDictionaryPending)) ||
                  (section.id === 'nave' && (naveQuery.isFetching || isNavePending))
                }
                hasMore={
                  (section.id === 'strong' && strongQuery.hasNextPage) ||
                  (section.id === 'dictionary' && dictionaryQuery.hasNextPage) ||
                  (section.id === 'nave' && naveQuery.hasNextPage)
                }
                showLoadMoreButton={
                  !(
                    browseMode === section.id &&
                    (section.id === 'strong' ||
                      section.id === 'dictionary' ||
                      section.id === 'nave')
                  )
                }
              />
            )}
            keyExtractor={(section: RelationTargetSection) => section.id}
            estimatedItemSize={260}
            ListEmptyComponent={isListLoading ? renderLoadingState() : renderEmptyState()}
          />
        )}
        {!deferredSearchHasValue && browseMode === 'strong' && (
          <AlphabetList letter={strongLetter} setLetter={setStrongLetter} />
        )}
        {!deferredSearchHasValue && browseMode === 'nave' && (
          <AlphabetList color="quint" letter={naveLetter} setLetter={setNaveLetter} />
        )}
        {!deferredSearchHasValue && browseMode === 'dictionary' && (
          <AlphabetList
            color="secondary"
            letter={dictionaryLetter}
            setLetter={setDictionaryLetter}
          />
        )}
      </VStack>
    </Sheet>
  )
}

export default CreateEntityRelationModal
