import type { SearchResult } from '~helpers/biblesDb'
import type { LexiqueRow } from '~features/resources/strongAccess'
import type { SearchItemType } from '~state/searchFilters'
import type { SearchResultSection } from './shared/SearchSectionBlock'
import {
  getDictionarySearchItems,
  getNaveSearchItems,
  getPassageSearchItems,
  getReferenceSearchItems,
  getStrongSearchItems,
  type DictionarySearchRow,
  type NaveSearchItemRow,
} from './shared/searchItems'
import type { SearchEntityResult } from './shared/searchResultTypes'

export const SEARCH_MIN_QUERY_LENGTH = 2

export type SearchSectionId =
  | 'reference'
  | 'notes'
  | 'links'
  | 'studies'
  | 'strong'
  | 'dictionary'
  | 'nave'
  | 'passages'

export type SQLiteSearchResultSection = SearchResultSection<SearchSectionId> & {
  itemFilterType: SearchItemType
}

type SearchItemFilters = Record<SearchItemType, boolean>

type SearchLoadingState = {
  passages: boolean
  notes: boolean
  links: boolean
  studies: boolean
  strong: boolean
  dictionary: boolean
  nave: boolean
}

type SearchResultsModelInput = {
  query: string
  debouncedQuery: string
  browseItemType?: SearchItemType
  itemFilters: SearchItemFilters
  noteResults: SearchEntityResult[]
  linkResults: SearchEntityResult[]
  studyResults: SearchEntityResult[]
  strongResults: LexiqueRow[]
  dictionaryResults: DictionarySearchRow[]
  naveResults: NaveSearchItemRow[]
  passageResults: SearchResult[] | null
  totalPassageCount: number
  searchError: string | null
  loading: SearchLoadingState
  t: (key: string) => string
}

const getSection = ({
  id,
  title,
  items,
  itemFilterType,
  count = items.length,
}: {
  id: SearchSectionId
  title: string
  items: SearchEntityResult[]
  itemFilterType: SearchItemType
  count?: number
}): SQLiteSearchResultSection => ({
  id,
  title,
  count,
  items,
  itemFilterType,
})

export const shouldShowSearchResultsList = ({
  query,
  debouncedQuery,
  browseItemType,
}: {
  query: string
  debouncedQuery: string
  browseItemType?: SearchItemType
}) =>
  Boolean(browseItemType) ||
  (Boolean(debouncedQuery) &&
    query.trim().length >= SEARCH_MIN_QUERY_LENGTH &&
    debouncedQuery.trim().length >= SEARCH_MIN_QUERY_LENGTH)

export const getSearchResultsModel = ({
  query,
  debouncedQuery,
  browseItemType,
  itemFilters,
  noteResults,
  linkResults,
  studyResults,
  strongResults,
  dictionaryResults,
  naveResults,
  passageResults,
  totalPassageCount,
  searchError,
  loading,
  t,
}: SearchResultsModelInput) => {
  const referenceItems = itemFilters.passages ? getReferenceSearchItems(debouncedQuery) : []
  const noteItems = itemFilters.notes ? noteResults : []
  const linkItems = itemFilters.links ? linkResults : []
  const studyItems = itemFilters.studies ? studyResults : []
  const strongItems = itemFilters.strong ? getStrongSearchItems(strongResults, t) : []
  const dictionaryItems = itemFilters.dictionary ? getDictionarySearchItems(dictionaryResults) : []
  const naveItems = itemFilters.nave ? getNaveSearchItems(naveResults) : []
  const passageItems = itemFilters.passages ? getPassageSearchItems(passageResults ?? []) : []

  const sections: SQLiteSearchResultSection[] = [
    ...(referenceItems.length
      ? [
          getSection({
            id: 'reference',
            title: t('Référence biblique'),
            items: referenceItems,
            itemFilterType: 'passages',
          }),
        ]
      : []),
    ...(noteItems.length
      ? [getSection({ id: 'notes', title: t('Notes'), items: noteItems, itemFilterType: 'notes' })]
      : []),
    ...(linkItems.length
      ? [getSection({ id: 'links', title: t('Liens'), items: linkItems, itemFilterType: 'links' })]
      : []),
    ...(studyItems.length
      ? [
          getSection({
            id: 'studies',
            title: t('Études'),
            items: studyItems,
            itemFilterType: 'studies',
          }),
        ]
      : []),
    ...(strongItems.length
      ? [
          getSection({
            id: 'strong',
            title: t('Strong'),
            items: strongItems,
            itemFilterType: 'strong',
          }),
        ]
      : []),
    ...(dictionaryItems.length
      ? [
          getSection({
            id: 'dictionary',
            title: t('Dictionnaire'),
            items: dictionaryItems,
            itemFilterType: 'dictionary',
          }),
        ]
      : []),
    ...(naveItems.length
      ? [getSection({ id: 'nave', title: t('Nave'), items: naveItems, itemFilterType: 'nave' })]
      : []),
    ...(passageItems.length || (itemFilters.passages && (loading.passages || searchError))
      ? [
          getSection({
            id: 'passages',
            title: t('Passages'),
            count: totalPassageCount || passageItems.length,
            items: passageItems,
            itemFilterType: 'passages',
          }),
        ]
      : []),
  ]

  const isBrowseLoading =
    (browseItemType === 'notes' && loading.notes) ||
    (browseItemType === 'links' && loading.links) ||
    (browseItemType === 'studies' && loading.studies) ||
    (browseItemType === 'strong' && loading.strong) ||
    (browseItemType === 'dictionary' && loading.dictionary) ||
    (browseItemType === 'nave' && loading.nave)

  const hasSearchQuery = Boolean(debouncedQuery)
  const showResultsList = shouldShowSearchResultsList({ query, debouncedQuery, browseItemType })
  const showNoResults =
    showResultsList &&
    !loading.passages &&
    !isBrowseLoading &&
    sections.length === 0 &&
    !searchError

  return {
    hasSearchQuery,
    showResultsList,
    shouldRenderSearchList: showResultsList || !hasSearchQuery,
    isBrowseLoading,
    showNoResults,
    sections,
  }
}
