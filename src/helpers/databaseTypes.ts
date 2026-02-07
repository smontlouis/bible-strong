import * as FileSystem from 'expo-file-system/legacy'
import type { ActiveLanguage } from '~helpers/languageUtils'

// ResourceLanguage is an alias for ActiveLanguage
// This allows resource databases to support any active language in the app
export type ResourceLanguage = ActiveLanguage

export type DatabaseId =
  | 'STRONG'
  | 'DICTIONNAIRE'
  | 'NAVE'
  | 'TRESOR'
  | 'MHY'
  | 'INTERLINEAIRE'
  | 'TIMELINE'
  | 'BIBLES'

// Databases that have language-specific content
export const LANGUAGE_SPECIFIC_DBS: DatabaseId[] = [
  'STRONG',
  'DICTIONNAIRE',
  'NAVE',
  'MHY',
  'INTERLINEAIRE',
  'TIMELINE',
]

// Databases that are shared across languages (no translation needed)
export const SHARED_DBS: DatabaseId[] = ['TRESOR', 'BIBLES']

// Databases that can have their language changed by the user
export const USER_SELECTABLE_DBS: DatabaseId[] = [
  'STRONG',
  'DICTIONNAIRE',
  'NAVE',
  'MHY',
  'INTERLINEAIRE',
  'TIMELINE',
]

// Databases that only exist in French
export const FRENCH_ONLY_DBS: DatabaseId[] = ['MHY']

export const isSharedDB = (dbId: DatabaseId): boolean => SHARED_DBS.includes(dbId)

export const isLanguageSpecificDB = (dbId: DatabaseId): boolean =>
  LANGUAGE_SPECIFIC_DBS.includes(dbId)

// Base paths
export const BASE_SQLITE_DIR = `${FileSystem.documentDirectory}SQLite`

// Get SQLite directory path for a specific language
export const getSqliteDirPath = (lang?: ResourceLanguage): string => {
  if (!lang) return BASE_SQLITE_DIR
  return `${BASE_SQLITE_DIR}/${lang}`
}

// Get shared SQLite directory path
export const getSharedSqliteDirPath = (): string => `${BASE_SQLITE_DIR}/shared`

// Get document directory path for JSON files by language
export const getJsonDirPath = (lang: ResourceLanguage): string =>
  `${FileSystem.documentDirectory}${lang}`
