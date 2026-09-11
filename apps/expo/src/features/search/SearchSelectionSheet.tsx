import SearchSourceFiltersSheet from './SearchSourceFiltersSheet'
import SearchTypeIcon from './shared/SearchTypeIcon'
import { FilterHeaderButtonContent } from '~common/FilterHeaderButton'
import HeaderAction from '~common/ContextualPanel/HeaderAction'
import { useCatalogSearch } from './discovery/useCatalogSearch'
import { getUniverseColor } from '~themes/universeColors'
import { SheetFlashList, SheetHeader, type SheetRef } from '~common/sheet'
import Sheet from '~common/ContextualPanel/ContextualSheet'
import RelationVersionButton from '~features/studyRelations/RelationVersionButton'
import InlineSheetContent from '~common/ContextualPanel/InlineSheetContent'
import HeaderContent from '~common/ContextualPanel/HeaderContent'
import { useTheme } from '~themes/ThemeProvider'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useAtomValue } from 'jotai/react'
import { Ref, useDeferredValue, useState, useRef } from 'react'
import { ActivityIndicator, Platform } from 'react-native'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import AlphabetList from '~common/AlphabetList'
import SheetSearchInput from '~common/SheetSearchInput'
import Empty from '~common/Empty'
import Box, { HStack, VStack, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import useBibleVerses from '~features/resources/useBibleVerses'
import useDebounce from '~helpers/useDebounce'
import type { DictionarySummary } from '~features/resources/dictionaryAccess'
import type { NaveTopicSummary } from '~features/resources/naveAccess'
import { useResourceAccess } from '~features/resources/resourceAccess'
import SharedSearchEntityResultRow from '~features/search/shared/SearchEntityResultRow'
import {
  getNextSearchItemFilters,
  relationSearchItemFilterOrder,
  searchItemFilterOrder,
  searchItemFilterConfig,
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
import type { SearchItemFilters, SearchItemType } from '~state/searchFilters'
import { getEndpointFallbackLabel, type RelationEndpoint } from '~features/studyRelations/domain'
import { createDictionaryEndpoint, createNaveEndpoint } from '~features/studyRelations/endpoints'
import {
  getSortedLinkTargetItems,
  getSortedNoteTargetItems,
  getSortedStudyTargetItems,
  getSortedAnnotationTargetItems,
  searchReferenceAndStrongTargets,
  type RelationTargetResult,
} from '~features/studyRelations/targetSearch'
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
  | 'commentary'
  | 'plan'
  | 'timeline'
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

export type SearchSelectionSheetProps = {
  inline?: boolean
  active?: boolean
  ref?: Ref<SheetRef | null>
  title?: string
  sourceEndpoint?: RelationEndpoint | null
  allowedTypes?: RelationEndpoint['type'][]
  allowedSources?: SearchItemType[]
  initialSource?: SearchItemType
  onDismiss?: () => void
  onSelectItem: (item: SearchEntityResult, version: VersionCode) => void | Promise<void>
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
  commentary: null,
  plan: null,
  timeline: null,
  passages: null,
  notes: 'note',
  links: 'link',
  studies: 'study',
  strong: 'strong',
  dictionary: 'dictionary',
  nave: 'nave',
}

const getAllowedSearchItemTypes = (allowedTypes?: RelationEndpoint['type'][]): SearchItemType[] => {
  if (!allowedTypes) return relationSearchItemFilterOrder

  const allowedSet = new Set(allowedTypes.map(type => relationTypeToSearchItemType[type]))
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

const VerseTargetDescription = ({
  endpoint,
}: {
  endpoint: Extract<RelationEndpoint, { type: 'verse' }>
}) => {
  const verses = useBibleVerses(getVerseIds(endpoint), endpoint.version)
  const description = verses.map(verse => verse.Texte).join(' ')

  if (!description) return null

  return (
    <Text className="text-[13px] text-tertiary" numberOfLines={1}>
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
    <Box className="overflow-hidden border-continuous flex-[1] min-h-[180px] justify-center items-center">
      <ActivityIndicator color={theme.colors.grey} />
    </Box>
  )
}

const SearchSelectionSheet = ({
  ref,
  active = true,
  title,
  sourceEndpoint = null,
  onSelectItem,
  onDismiss,
  allowedSources,
  initialSource,
  allowedTypes,
  inline = false,
}: SearchSelectionSheetProps) => {
  const { t } = useTranslation()
  const filtersRef = useRef<SheetRef>(null)
  const resources = useResourceAccess()
  const defaultBibleVersion = useDefaultBibleVersion()
  const { openVersionSelector } = useBookAndVersionSelector()
  const resourcesLanguage = useAtomValue(resourcesLanguageAtom)
  const enabledItemTypes = allowedSources ?? getAllowedSearchItemTypes(allowedTypes)
  const allowedTypesKey = `${enabledItemTypes.join('|')}:${initialSource ?? ''}`
  const initialFilters = () =>
    getSearchItemFiltersForTypes(
      initialSource && enabledItemTypes.includes(initialSource) ? [initialSource] : enabledItemTypes
    )
  const [searchValue, setSearchValue] = useState('')
  const [itemFilters, setItemFilters] = useState<SearchItemFilters>(initialFilters)
  const [previousAllowedTypesKey, setPreviousAllowedTypesKey] = useState(allowedTypesKey)
  if (previousAllowedTypesKey !== allowedTypesKey) {
    setPreviousAllowedTypesKey(allowedTypesKey)
    setItemFilters(initialFilters())
    setSearchValue('')
  }
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
    active &&
    itemFilters.notes &&
    (deferredBrowseMode === 'note' || (!deferredBrowseMode && deferredSearchHasValue))
  const shouldBuildStudyTargets =
    active &&
    itemFilters.studies &&
    (deferredBrowseMode === 'study' || (!deferredBrowseMode && deferredSearchHasValue))
  const shouldBuildLinkTargets =
    active &&
    itemFilters.links &&
    (deferredBrowseMode === 'link' || (!deferredBrowseMode && deferredSearchHasValue))
  const noteTargets = shouldBuildNoteTargets ? getSortedNoteTargetItems(notes) : []
  const studyTargets = shouldBuildStudyTargets ? getSortedStudyTargetItems(studies) : []
  const linkTargets = shouldBuildLinkTargets ? getSortedLinkTargetItems(links) : []
  const shouldBuildAnnotationTargets =
    active &&
    itemFilters.passages &&
    (!allowedTypes || allowedTypes.includes('annotation')) &&
    !deferredBrowseMode &&
    deferredSearchHasValue
  const annotationTargets = shouldBuildAnnotationTargets
    ? getSortedAnnotationTargetItems(wordAnnotations)
    : []
  const fuzzyNoteTargets = searchWithMatches(noteTargets, deferredSearchValue)
  const fuzzyLinkTargets = searchWithMatches(linkTargets, deferredSearchValue)
  const fuzzyStudyTargets = searchWithMatches(studyTargets, deferredSearchValue)
  const fuzzyAnnotationTargets = searchWithMatches(annotationTargets, deferredSearchValue)
  const isAllowed = (type: RelationEndpoint['type']) => {
    if (!active || (allowedTypes && !allowedTypes.includes(type))) return false
    const itemType = relationTypeToSearchItemType[type]
    return enabledItemTypes.includes(itemType) && itemFilters[itemType]
  }

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

  const selectTarget = async (target: SearchEntityResult) => {
    if (!enabledItemTypes.includes(target.type) || !itemFilters[target.type]) return
    await onSelectItem(target, passageVersion)
    resetPicker()
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
  const catalogSources = (['commentary', 'plan', 'timeline'] as const).filter(
    type => enabledItemTypes.includes(type) && itemFilters[type]
  )
  const catalog = useCatalogSearch(
    deferredSearchValue,
    undefined,
    active && catalogSources.length > 0,
    catalogSources
  )
  const searchSections: RelationTargetSection[] = [
    ...catalogSources.flatMap(type => {
      const items = catalog.items
        .filter(item => item.type === type)
        .map(item => ({
          id: item.id,
          title: item.title,
          subtitle: item.subtitle,
          type: item.type,
          iconType: item.type,
          catalogResult: item,
        }))
      return items.length
        ? [
            {
              id: type,
              title: t(type === 'plan' ? 'Plans' : `tabs.${type}`),
              count: items.length,
              items,
            },
          ]
        : []
    }),
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
    catalog.loading ||
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
    : enabledItemTypes.length === 1
      ? enabledItemTypes[0] === 'passages'
        ? t('commandPalette.passagePlaceholder')
        : t('commandPalette.scopedPlaceholder', {
            scope: t(searchItemFilterConfig[enabledItemTypes[0]].labelKey),
          })
      : t('Passage, Strong, note, lien, étude...')

  const modalTitle: string =
    title || (browseMode ? t(browseModeLabelKeys[browseMode]) : t('Rechercher'))
  const modalSubtitle = getSourceEndpointSubtitle(sourceEndpoint, t)

  const renderTargetSearchItem = (item: SearchEntityResult) => {
    const endpoint = item.endpoint
    if (item.catalogResult)
      return (
        <SharedSearchEntityResultRow
          item={item}
          onPress={() => void selectTarget(item)}
          showArrow
        />
      )
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
    <Box className="overflow-hidden border-continuous flex-[1] min-h-[260px] justify-center px-[20px]">
      <Empty icon={emptyIcon} message={message} />
    </Box>
  )
  const renderLoadingState = () => <LoadingIndicator />

  const passageVersionSelector = (
    <RelationVersionButton
      version={passageVersion}
      onVersionChange={setPassageVersion}
      className="overflow-hidden border-continuous flex-row items-center justify-center gap-[5px] px-[8px] py-[6px] rounded-[8px] bg-light-grey"
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
    >
      <FeatherIcon name="book-open" size={14} color={getUniverseColor('bible')} />
      <Text className="text-primary text-[13px] font-bold">{passageVersion}</Text>
      <FeatherIcon name="chevron-down" size={13} color="primary" />
    </RelationVersionButton>
  )

  const searchHeader = (
    <Box className="overflow-hidden border-continuous px-[20px] pt-[8px] pb-[12px]">
      <SheetSearchInput
        value={searchValue}
        onChangeText={handleSearch}
        onDelete={() => handleSearch('')}
        placeholder={placeholder}
        autoFocus
      />
    </Box>
  )

  const allSelected = enabledItemTypes.every(type => itemFilters[type])
  const singleType = activeItemTypes.length === 1 ? activeItemTypes[0] : undefined
  const canChangeFilters = enabledItemTypes.length > 1
  const filterContent = singleType ? (
    <HStack className="items-center gap-[6px] px-[12px] mr-[8px] min-h-[44px]">
      <SearchTypeIcon type={singleType} size={16} color="primary" />
      <Text className="text-primary text-[13px]" numberOfLines={1}>
        {t(searchItemFilterConfig[singleType].labelKey)}
      </Text>
      {canChangeFilters && <FeatherIcon name="chevron-down" size={13} color="primary" />}
    </HStack>
  ) : (
    <FilterHeaderButtonContent activeFilterCount={allSelected ? 0 : activeItemTypes.length} />
  )
  const filterControl = canChangeFilters ? (
    <TouchableBox
      accessibilityRole="button"
      accessibilityLabel={t('Filtrer')}
      onPress={() => filtersRef.current?.present()}
    >
      {filterContent}
    </TouchableBox>
  ) : (
    filterContent
  )
  const Container = inline ? InlineSheetContent : Sheet
  return (
    <>
      <Container
        ref={ref}
        onDismiss={() => {
          resetPicker()
          onDismiss?.()
        }}
        panelWidth={500}
        panelHeaderContent={searchHeader}
        snapPoints={[0.75]}
        header={
          <SheetHeader title={modalTitle} subTitle={modalSubtitle} rightComponent={filterControl}>
            {searchHeader}
          </SheetHeader>
        }
      >
        {Platform.OS === 'web' && (
          <>
            {inline && <HeaderAction>{filterControl}</HeaderAction>}
            {inline && <HeaderContent>{searchHeader}</HeaderContent>}
          </>
        )}
        <VStack
          className={
            Platform.OS === 'web' ? 'h-[360px]' : 'overflow-hidden border-continuous flex-[1]'
          }
        >
          {catalog.error ? (
            <Box className="p-[20px]">
              <Text onPress={catalog.retry}>{t('Réessayer')}</Text>
            </Box>
          ) : resourceFailure ? (
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
                if (
                  browseMode === 'nave' &&
                  naveQuery.hasNextPage &&
                  !naveQuery.isFetchingNextPage
                ) {
                  void naveQuery.fetchNextPage()
                }
              }}
              renderItem={({ item: section }: { item: RelationTargetSection }) => (
                <SearchSectionBlock
                  section={section}
                  headerAction={section.id === 'passages' ? passageVersionSelector : undefined}
                  visibleCount={
                    browseMode === section.id &&
                    (section.id === 'strong' ||
                      section.id === 'dictionary' ||
                      section.id === 'nave')
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
      </Container>
      <SearchSourceFiltersSheet
        ref={filtersRef}
        itemFilters={itemFilters}
        enabledTypes={enabledItemTypes}
        emptyMeansAll
        showPassageFilters={false}
        passageFilterCount={0}
        onToggle={toggleItemFilter}
        onReset={() => {
          setItemFilters(getSearchItemFiltersForTypes(enabledItemTypes))
          setVisibleCounts({})
        }}
        onOpenPassageFilters={() => {}}
      />
    </>
  )
}

export default SearchSelectionSheet
