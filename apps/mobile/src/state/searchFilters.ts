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

export type SearchItemFilters = Record<SearchItemType, boolean>

export interface SearchFilters {
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
      itemFilters: {
        ...defaultSearchFilters.itemFilters,
        ...(value.itemFilters || {}),
      },
    }),
  }
)
