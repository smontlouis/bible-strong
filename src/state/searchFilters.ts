import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'
import type { SearchSortOrder } from '~helpers/biblesDb'

export type SearchSection = '' | 'at' | 'nt'

export interface SearchFilters {
  section: SearchSection
  book: number
  selectedVersion: string
  sortOrder: SearchSortOrder
}

const defaultSearchFilters: SearchFilters = {
  section: '',
  book: 0,
  selectedVersion: '',
  sortOrder: 'relevance',
}

export const searchFiltersAtom = atomWithAsyncStorage<SearchFilters>(
  'searchFilters',
  defaultSearchFilters
)
