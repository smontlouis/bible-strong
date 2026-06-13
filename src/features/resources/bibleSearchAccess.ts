import {
  getInstalledVersions,
  searchVerses,
  searchVersesCount,
  type SearchOptions,
  type SearchResult,
} from '~helpers/biblesDb'

export type { SearchOptions, SearchResult, SearchSortOrder } from '~helpers/biblesDb'

export type BibleSearchAccess = {
  getInstalledVersions: () => Promise<string[]>
  searchVerses: (query: string, options?: SearchOptions) => Promise<SearchResult[]>
  searchVersesCount: (query: string, options?: SearchOptions) => Promise<number>
}

export const localBibleSearchAccess: BibleSearchAccess = {
  getInstalledVersions,
  searchVerses,
  searchVersesCount,
}
