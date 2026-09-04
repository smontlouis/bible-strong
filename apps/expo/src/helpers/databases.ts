import * as FileSystem from 'expo-file-system/legacy'
import { to } from 'await-to-js'

import i18n, { getLanguage } from '~i18n'
import {
  ResourceLanguage,
  DatabaseId,
  getSqliteDirPath,
  getSharedSqliteDirPath,
  getJsonDirPath,
  isSharedDB,
  BASE_SQLITE_DIR,
} from '~helpers/databaseTypes'
import { resolveResourceCatalogStatus } from '~helpers/resourcePublication'
import { createOfflineCopyId } from '~helpers/offlineCopyId'

export const databaseDictionnaireName = 'dictionnaire.sqlite'
export const databaseTresorName = 'commentaires-tresor.sqlite'
export const databaseMhyName = 'mhy.sqlite'
export const databaseNaveName = 'nave.sqlite'

export const databaseBiblesName = 'bibles.sqlite'

export const getDictionaryDbPath = (work: string, lang: ResourceLanguage): string =>
  `${getSqliteDirPath(lang)}/dictionaries/${work}.sqlite`

export const getDictionaryDirectoryDbPath = (): string =>
  `${getSharedSqliteDirPath()}/dictionary-directory.sqlite`

export const getCommentaryDbPath = (resourceId: string, lang: ResourceLanguage): string =>
  resourceId === 'MHY'
    ? getDbPath('MHY', lang)
    : `${getSqliteDirPath(lang)}/commentaries/${resourceId}.sqlite`

// Map DatabaseId to file names
export const databaseFileNames: Record<DatabaseId, string> = {
  DICTIONNAIRE: databaseDictionnaireName,
  NAVE: databaseNaveName,
  TRESOR: databaseTresorName,
  MHY: databaseMhyName,
  TIMELINE: 'bible-timeline-events.json',
  BIBLES: databaseBiblesName,
}

// Get the file name for a database
export const getDbFileName = (dbId: DatabaseId): string => databaseFileNames[dbId]

// Get the full path for a database based on language
export const getDbPath = (dbId: DatabaseId, lang: ResourceLanguage): string => {
  const fileName = getDbFileName(dbId)

  // Shared databases go to shared folder
  if (isSharedDB(dbId)) {
    return `${getSharedSqliteDirPath()}/${fileName}`
  }

  // JSON files (TIMELINE) go to language-specific document folder
  if (dbId === 'TIMELINE') {
    return `${getJsonDirPath(lang)}/${fileName}`
  }

  // SQLite databases go to language-specific SQLite folder
  return `${getSqliteDirPath(lang)}/${fileName}`
}

// Legacy path (before migration) - used for migration detection
export const getLegacyDbPath = (dbId: DatabaseId): string => {
  const fileName = getDbFileName(dbId)

  if (dbId === 'TIMELINE') {
    return `${FileSystem.documentDirectory}${fileName}`
  }

  return `${BASE_SQLITE_DIR}/${fileName}`
}

const initSQLiteDir = async () => {
  const sqliteDir = await FileSystem.getInfoAsync(sqliteDirPath)

  if (!sqliteDir.exists) {
    await FileSystem.makeDirectoryAsync(sqliteDirPath)
  } else if (!sqliteDir.isDirectory) {
    throw new Error('SQLite dir is not a directory')
  }
}

// Initialize all language-specific directories
export const initLanguageDirs = async (lang: ResourceLanguage) => {
  const dirs = [getSqliteDirPath(lang), getSharedSqliteDirPath(), getJsonDirPath(lang)]

  for (const dir of dirs) {
    const dirInfo = await FileSystem.getInfoAsync(dir)
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
    }
  }
}

const sqliteDirPath = `${FileSystem.documentDirectory}SQLite`

export const getIfDatabaseNeedsUpdate = async (dbId: IdDatabase) => {
  const { path } = databases()[dbId]
  const lang = getLanguage()
  if (dbId === 'MHY' && lang !== 'fr') return false

  const [errF, file] = await to(FileSystem.getInfoAsync(path))

  if (!file?.exists) {
    return false
  }

  const resourceLang = isSharedDB(dbId) ? 'fr' : lang
  const resourceId = createOfflineCopyId({
    kind: 'database',
    databaseId: dbId,
    language: resourceLang,
  })
  const [statusError, status] = await to(resolveResourceCatalogStatus(resourceId))
  if (errF || statusError || !status) {
    console.log(`Error for${dbId}`, errF, statusError)
    return false
  }
  return status === 'update-available'
}

export const getIfDatabaseNeedsDownload = async (dbId: IdDatabase) => {
  const { path } = databases()[dbId]

  await initSQLiteDir()

  const file = await FileSystem.getInfoAsync(path)

  if (!file.exists) {
    return true
  }

  return false
}

// Check if database needs download for a specific language
export const getIfDatabaseNeedsDownloadForLang = async (
  dbId: IdDatabase,
  lang: ResourceLanguage
) => {
  const path = getDbPath(dbId as DatabaseId, lang)

  await initLanguageDirs(lang)

  const file = await FileSystem.getInfoAsync(path)

  if (!file.exists) {
    return true
  }

  return false
}

// Database configuration with language-aware paths
export const databases = (lang?: ResourceLanguage) => {
  // Default to current UI language if not specified
  const effectiveLang = lang || getLanguage()

  return {
    DICTIONNAIRE: {
      id: 'DICTIONNAIRE' as const,
      name: i18n.t('Dictionnaire Westphal'),
      desc: i18n.t('Dictionnaire Encyclopédique de la Bible A. Westphal.'),
      fileSize: 22532096,
      path: getDbPath('DICTIONNAIRE', effectiveLang),
    },
    NAVE: {
      id: 'NAVE' as const,
      name: i18n.t('Bible thématique Nave'),
      desc: i18n.t('Plus de 20.000 sujets et sous-thèmes, et 100.000 références aux Écritures.'),
      fileSize: 7448576,
      path: getDbPath('NAVE', effectiveLang),
    },
    TRESOR: {
      id: 'TRESOR' as const,
      name: i18n.t('Références croisées'),
      desc: i18n.t(
        "L'un des ensembles les plus complets de références croisées jamais compilées, composé de plus de 572.000 entrées."
      ),
      fileSize: 5434368,
      path: getDbPath('TRESOR', effectiveLang), // Always uses shared path
    },
    MHY: {
      id: 'MHY' as const,
      name: i18n.t('Commentaires'),
      desc: i18n.t('Commentaires concis de Matthew Henry. Traduction Dominique Osché.'),
      fileSize: 6574080,
      path: getDbPath('MHY', effectiveLang),
    },
    TIMELINE: {
      id: 'TIMELINE' as const,
      name: i18n.t('Chronologie de la Bible'),
      desc: i18n.t('Chronologie des événements bibliques'),
      fileSize: 3187836,
      path: getDbPath('TIMELINE', effectiveLang),
    },
  }
}

export type IdDatabase = keyof ReturnType<typeof databases>

// Legacy function for backward compatibility
export const getDatabases = () => {
  return databases()
}
