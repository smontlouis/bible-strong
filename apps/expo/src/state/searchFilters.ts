import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'
import type { SearchSortOrder } from '~helpers/biblesDb'
import type { BibleCanonId } from '~helpers/bibleBookCatalog'
import { DEFAULT_BIBLE_VERSION_FILTER } from './searchVersionFilter'

export type SearchSection = '' | 'at' | 'nt'
export type SearchCanon = '' | BibleCanonId
export type SearchItemType =
  | 'passages'
  | 'notes'
  | 'links'
  | 'studies'
  | 'strong'
  | 'dictionary'
  | 'nave'
  | 'commentary'
  | 'plan'
  | 'timeline'

export type CatalogSearchItemType = 'commentary' | 'plan' | 'timeline'
export type SearchItemFilters = Record<Exclude<SearchItemType, CatalogSearchItemType>, boolean> &
  Partial<Record<CatalogSearchItemType, boolean>>

export interface SearchFilters {
  openResultsInNewTabs?: boolean
  discoveryScope?: 'passage' | 'commentary' | 'plan' | 'timeline'
  section: SearchSection
  canon: SearchCanon
  book: number
  selectedVersion: string
  sortOrder: SearchSortOrder
  itemFilters: SearchItemFilters
}

const defaultSearchFilters: SearchFilters = {
  section: '',
  canon: '',
  book: 0,
  selectedVersion: DEFAULT_BIBLE_VERSION_FILTER,
  sortOrder: 'relevance',
  itemFilters: {
    commentary: true,
    plan: true,
    timeline: true,
    passages: true,
    notes: true,
    links: true,
    studies: true,
    strong: true,
    dictionary: true,
    nave: true,
  },
}

export const searchFiltersAtom = atomWithAsyncStorage<SearchFilters>(
  'searchFilters',
  defaultSearchFilters,
  {
    migrate: value => ({
      ...defaultSearchFilters,
      ...value,
      selectedVersion: value.selectedVersion || DEFAULT_BIBLE_VERSION_FILTER,
      itemFilters: normalizeSearchItemFilters(
        value.itemFilters || defaultSearchFilters.itemFilters,
        value.discoveryScope
      ),
      discoveryScope: undefined,
    }),
  }
)

/** Preserve old single-source filters and migrate the discarded discovery-mode UI. */
export function normalizeSearchItemFilters(
  filters: SearchItemFilters & { references?: boolean },
  legacyScope?: SearchFilters['discoveryScope']
): Record<SearchItemType, boolean> {
  const { references, ...currentFilters } = filters
  const allLegacy = ['passages', 'notes', 'links', 'studies', 'strong', 'dictionary', 'nave'].every(
    key => filters[key as keyof SearchItemFilters]
  )
  const normalized = {
    ...currentFilters,
    passages: filters.passages || references === true,
    commentary: filters.commentary ?? allLegacy,
    plan: filters.plan ?? allLegacy,
    timeline: filters.timeline ?? allLegacy,
  }
  if (legacyScope) {
    const selected = legacyScope === 'passage' ? 'passages' : legacyScope
    return Object.fromEntries(
      Object.keys(normalized).map(key => [key, key === selected])
    ) as Record<SearchItemType, boolean>
  }
  return normalized as Record<SearchItemType, boolean>
}
