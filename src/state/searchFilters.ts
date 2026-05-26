import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'
import type { SearchSortOrder } from '~helpers/biblesDb'

export type SearchSection = '' | 'at' | 'nt'
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
  book: number
  selectedVersion: string
  sortOrder: SearchSortOrder
  itemFilters: SearchItemFilters
}

const defaultSearchFilters: SearchFilters = {
  section: '',
  book: 0,
  selectedVersion: '',
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
      itemFilters: {
        ...defaultSearchFilters.itemFilters,
        ...(value.itemFilters || {}),
      },
    }),
  }
)
