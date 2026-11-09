import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'
import type { SearchSortOrder } from '~helpers/biblesDb'
import type { BibleCanonId } from '~helpers/bibleBookCatalog'
import { DEFAULT_BIBLE_VERSION_FILTER } from './searchVersionFilter'

export type SearchSection = '' | 'at' | 'nt'
export type SearchCanon = '' | BibleCanonId
export type SearchItemType =
  | 'passages'
  | 'meaning'
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
/** Sources added after filters were first saved: a missing value follows the older source. */
type LaterSearchItemType = CatalogSearchItemType | 'meaning'
export type SearchItemFilters = Record<Exclude<SearchItemType, LaterSearchItemType>, boolean> &
  Partial<Record<LaterSearchItemType, boolean>>

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
    meaning: true,
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
  const passages = filters.passages || references === true
  const normalized = {
    ...currentFilters,
    passages,
    // The passages found by meaning were part of Passages until they got a section of their own.
    meaning: filters.meaning ?? passages,
    commentary: filters.commentary ?? allLegacy,
    plan: filters.plan ?? allLegacy,
    timeline: filters.timeline ?? allLegacy,
  }
  if (legacyScope) {
    const selected = legacyScope === 'passage' ? 'passages' : legacyScope
    return Object.fromEntries(
      Object.keys(normalized).map(key => [
        key,
        key === selected || (key === 'meaning' && selected === 'passages'),
      ])
    ) as Record<SearchItemType, boolean>
  }
  return normalized as Record<SearchItemType, boolean>
}
