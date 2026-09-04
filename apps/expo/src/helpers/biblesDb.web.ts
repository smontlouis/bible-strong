import type {
  BibleJsonData,
  BibleVerse,
  BibleVersionCoverage,
  BibleVersionMetadata,
  CanonicalBibleActiveTag,
  CanonicalBibleJsonData,
  CanonicalBibleLayoutEvent,
  CanonicalBibleVersePayload,
  DbHealthStatus,
  InsertBibleOptions,
  LegacyBibleJsonData,
  SearchOptions,
  SearchResult,
  SearchSortOrder,
} from './biblesDb'

export type {
  BibleJsonData,
  BibleVerse,
  BibleVersionCoverage,
  BibleVersionMetadata,
  CanonicalBibleActiveTag,
  CanonicalBibleJsonData,
  CanonicalBibleLayoutEvent,
  CanonicalBibleVersePayload,
  DbHealthStatus,
  InsertBibleOptions,
  LegacyBibleJsonData,
  SearchOptions,
  SearchResult,
  SearchSortOrder,
}

const onlineOnlyError = () => new Error('WEB_ONLINE_ONLY')
const rejectOnlineOnly = async <T>(): Promise<T> => {
  throw onlineOnlyError()
}

export const openBiblesDb = () => rejectOnlineOnly<never>()
export const closeBiblesDb = async (): Promise<void> => {}
export const checkBiblesDbHealth = async (): Promise<DbHealthStatus> => 'missing'
export const resetBiblesDb = async (): Promise<void> => {}
export const getChapterVerses = () => rejectOnlineOnly<BibleVerse[]>()
export const getBibleCanonicalHeadingVerses = () => rejectOnlineOnly<BibleVerse[]>()
export const getVerseText = () => rejectOnlineOnly<string | undefined>()
export const getMultipleVerses = () => rejectOnlineOnly<Record<string, string>>()
export const getChapterVerseCount = () => rejectOnlineOnly<number>()
export const getBibleVersionCoverage = () => rejectOnlineOnly<BibleVersionCoverage>()
export const isVersionInstalled = async (): Promise<boolean> => false
export const getInstalledVersions = async (): Promise<string[]> => []
export const getBibleVersionMetadata = async (): Promise<BibleVersionMetadata | null> => null
export const insertBibleVersion = () => rejectOnlineOnly<void>()
export const removeBibleVersion = async (): Promise<void> => {}
export const searchVerses = (_query: string, _options?: SearchOptions) =>
  rejectOnlineOnly<SearchResult[]>()
export const searchVersesCount = (_query: string, _options?: SearchOptions) =>
  rejectOnlineOnly<number>()
