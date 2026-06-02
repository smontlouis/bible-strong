import { SheetFlashList, Sheet, type SheetRef } from '~common/sheet'
import { useTheme } from '@emotion/react'
import { Ref, useDeferredValue, useEffect, useState } from 'react'
import { ActivityIndicator } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import AlphabetList from '~common/AlphabetList'
import SheetSearchInput from '~common/SheetSearchInput'
import Empty from '~common/Empty'
import ModalHeader from '~common/ModalHeader'
import Box, { VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import useBibleVerses from '~helpers/useBibleVerses'
import useDebounce from '~helpers/useDebounce'
import loadLexiqueByLetter, { type LexiqueRow } from '~helpers/loadLexiqueByLetter'
import loadLexiqueBySearch from '~helpers/loadLexiqueBySearch'
import loadDictionnaireByLetter, {
  type DictionnaireLetterRow,
} from '~helpers/loadDictionnaireByLetter'
import loadDictionnaireBySearch, {
  type DictionnaireSearchRow,
} from '~helpers/loadDictionnaireBySearch'
import loadNaveByLetter, { type NaveLetterRow } from '~helpers/loadNaveByLetter'
import loadNaveBySearch, { type NaveSearchRow } from '~helpers/loadNaveBySearch'
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
  searchReferenceAndStrongTargets,
  type RelationTargetResult,
} from './targetSearch'

type BrowseMode = 'note' | 'link' | 'study' | 'strong' | 'nave' | 'dictionary'
type NaveRow = NaveLetterRow | NaveSearchRow
type DictionaryRow = DictionnaireLetterRow | DictionnaireSearchRow
type MatchedRelationTargetResult = RelationTargetResult
type RelationTargetSectionId =
  | 'passages'
  | 'notes'
  | 'links'
  | 'studies'
  | 'strong'
  | 'dictionary'
  | 'nave'
type RelationTargetSection = SearchResultSection<RelationTargetSectionId>

type Props = {
  ref?: Ref<SheetRef | null>
  title?: string
  sourceEndpoint: RelationEndpoint | null
  onCreated?: () => void
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
  id: `nave:${nave.name_lower}`,
  type: 'nave',
  iconType: 'nave',
  title: nave.name,
  subtitle: 'Nave',
  endpoint: createNaveEndpoint({ nameLower: nave.name_lower, labelFallback: nave.name }),
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
    dictionary.rowid ?? dictionary.sanitized_word ?? dictionary.word,
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
    case 'word':
      return endpoint.labelFallback || getEndpointFallbackLabel(endpoint)
  }
}

const isDatabaseError = (value: unknown): value is { error: string } =>
  typeof value === 'object' && value !== null && 'error' in value

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
  const verses = useBibleVerses(getVerseIds(endpoint))
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
  allowedTypes,
}: Props) => {
  const { t } = useTranslation()
  const dispatch = useDispatch<AppDispatch>()
  const allowedTypesKey = allowedTypes?.join('|') || ''
  const [searchValue, setSearchValue] = useState('')
  const [itemFilters, setItemFilters] = useState<SearchItemFilters>(() =>
    getSearchItemFiltersForTypes(getAllowedSearchItemTypesFromKey(allowedTypesKey))
  )
  const [strongLetter, setStrongLetter] = useState('a')
  const [naveLetter, setNaveLetter] = useState('a')
  const [dictionaryLetter, setDictionaryLetter] = useState('a')
  const [strongResults, setStrongResults] = useState<LexiqueRow[]>([])
  const [naveResults, setNaveResults] = useState<NaveRow[]>([])
  const [dictionaryResults, setDictionaryResults] = useState<DictionaryRow[]>([])
  const [visibleCounts, setVisibleCounts] = useState<
    Partial<Record<RelationTargetSectionId, number>>
  >({})
  const [isStrongLoading, setIsStrongLoading] = useState(false)
  const [isNaveLoading, setIsNaveLoading] = useState(false)
  const [isDictionaryLoading, setIsDictionaryLoading] = useState(false)
  const [strongError, setStrongError] = useState<string | null>(null)
  const [naveError, setNaveError] = useState<string | null>(null)
  const [dictionaryError, setDictionaryError] = useState<string | null>(null)
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
  const fuzzyNoteTargets = searchWithMatches(noteTargets, deferredSearchValue)
  const fuzzyLinkTargets = searchWithMatches(linkTargets, deferredSearchValue)
  const fuzzyStudyTargets = searchWithMatches(studyTargets, deferredSearchValue)
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

  useEffect(() => {
    if (!shouldLoadStrongTargets) {
      setStrongResults([])
      return
    }

    let isMounted = true
    setIsStrongLoading(true)
    setStrongError(null)

    const loader = deferredStrongSearchValue.trim()
      ? loadLexiqueBySearch(deferredStrongSearchValue)
      : loadLexiqueByLetter(strongLetter)

    loader.then(results => {
      if (!isMounted) return
      if (isDatabaseError(results)) {
        setStrongResults([])
        setStrongError(results.error)
      } else {
        setStrongResults(results)
      }
      setIsStrongLoading(false)
    })

    return () => {
      isMounted = false
    }
  }, [deferredStrongSearchValue, shouldLoadStrongTargets, strongLetter])

  const shouldLoadNaveTargets =
    isAllowed('nave') &&
    (deferredBrowseMode === 'nave' || (!deferredBrowseMode && deferredSearchHasValue))
  const shouldLoadDictionaryTargets =
    isAllowed('dictionary') &&
    (deferredBrowseMode === 'dictionary' || (!deferredBrowseMode && deferredSearchHasValue))

  useEffect(() => {
    if (!shouldLoadNaveTargets) {
      setNaveResults([])
      return
    }

    let isMounted = true
    setIsNaveLoading(true)
    setNaveError(null)

    const loader = deferredResourceSearchValue.trim()
      ? loadNaveBySearch(deferredResourceSearchValue)
      : loadNaveByLetter(naveLetter)

    loader.then(results => {
      if (!isMounted) return
      if (isDatabaseError(results)) {
        setNaveResults([])
        setNaveError(results.error)
      } else {
        setNaveResults(results)
      }
      setIsNaveLoading(false)
    })

    return () => {
      isMounted = false
    }
  }, [deferredResourceSearchValue, naveLetter, shouldLoadNaveTargets])

  useEffect(() => {
    if (!shouldLoadDictionaryTargets) {
      setDictionaryResults([])
      return
    }

    let isMounted = true
    setIsDictionaryLoading(true)
    setDictionaryError(null)

    const loader = deferredResourceSearchValue.trim()
      ? loadDictionnaireBySearch(deferredResourceSearchValue)
      : loadDictionnaireByLetter(dictionaryLetter)

    loader.then(results => {
      if (!isMounted) return
      if (isDatabaseError(results)) {
        setDictionaryResults([])
        setDictionaryError(results.error)
      } else {
        setDictionaryResults(results)
      }
      setIsDictionaryLoading(false)
    })

    return () => {
      isMounted = false
    }
  }, [deferredResourceSearchValue, dictionaryLetter, shouldLoadDictionaryTargets])

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

  const selectTarget = (endpoint: RelationEndpoint) => {
    if (!sourceEndpoint) return
    if (endpointsMatch(sourceEndpoint, endpoint)) return

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
    handleSearch('')
    setItemFilters(getSearchItemFiltersForTypes(enabledItemTypes))
    setVisibleCounts({})
    onCreated?.()
  }

  const immediateReferenceResults = searchReferenceAndStrongTargets(searchValue)
  const referenceItems = immediateReferenceResults.filter(
    result => result.endpoint.type === 'verse' && isAllowed('verse')
  )
  const noteItems = itemFilters.notes ? fuzzyNoteTargets : []
  const linkItems = itemFilters.links ? fuzzyLinkTargets : []
  const studyItems = itemFilters.studies ? fuzzyStudyTargets : []
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
    isStrongLoading ||
    isNaveLoading ||
    isDictionaryLoading

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
        onPress={() => selectTarget(endpoint)}
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

  const headerComponent = (
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
        <>
          <ModalHeader
            title={modalTitle}
            subTitle={modalSubtitle}
            hasBackButton={Boolean(browseMode)}
            onBackPress={exitBrowseMode}
          />
          {headerComponent}
        </>
      }
    >
      <VStack flex={1}>
        {strongError && browseMode === 'strong' ? (
          <Box px={20} py={24}>
            <Text color="grey">{t('Impossible de charger le lexique Strong.')}</Text>
          </Box>
        ) : naveError && browseMode === 'nave' ? (
          <Box px={20} py={24}>
            <Text color="grey">{t('Impossible de charger la nave...')}</Text>
          </Box>
        ) : dictionaryError && browseMode === 'dictionary' ? (
          <Box px={20} py={24}>
            <Text color="grey">{t('Impossible de charger le dictionnaire...')}</Text>
          </Box>
        ) : (
          <SheetFlashList
            data={searchSections}
            renderItem={({ item: section }: { item: RelationTargetSection }) => (
              <SearchSectionBlock
                section={section}
                visibleCount={visibleCounts[section.id] || SEARCH_SECTION_PREVIEW_LIMIT}
                onLoadMore={() => increaseVisibleCount(section.id)}
                onPressItem={() => undefined}
                renderItem={renderTargetSearchItem}
                isLoading={
                  (section.id === 'strong' && (isStrongLoading || isStrongPending)) ||
                  (section.id === 'dictionary' && (isDictionaryLoading || isDictionaryPending)) ||
                  (section.id === 'nave' && (isNaveLoading || isNavePending))
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
