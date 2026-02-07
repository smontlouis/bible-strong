import * as FileSystem from 'expo-file-system/legacy'
import to from 'await-to-js'

import { getDatabasesRef } from '~helpers/firebase'
import i18n, { getLanguage } from '~i18n'
import { getI18n } from 'react-i18next'
import {
  ResourceLanguage,
  DatabaseId,
  getSqliteDirPath,
  getSharedSqliteDirPath,
  getJsonDirPath,
  isSharedDB,
  BASE_SQLITE_DIR,
} from '~helpers/databaseTypes'

export const databaseDictionnaireName = 'dictionnaire.sqlite'
export const databaseStrongName = 'strong.sqlite'
export const databaseInterlineaireName = 'interlineaire.sqlite'
export const databaseTresorName = 'commentaires-tresor.sqlite'
export const databaseMhyName = 'mhy.sqlite'
export const databaseNaveName = 'nave.sqlite'

export const databaseBiblesName = 'bibles.sqlite'

// Map DatabaseId to file names
export const databaseFileNames: Record<DatabaseId, string> = {
  STRONG: databaseStrongName,
  DICTIONNAIRE: databaseDictionnaireName,
  NAVE: databaseNaveName,
  TRESOR: databaseTresorName,
  MHY: databaseMhyName,
  INTERLINEAIRE: databaseInterlineaireName,
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

/**
 *
 * @TODO - MAKE IT WORK, NOT WORKING ANYMORE
 */
export const getIfDatabaseNeedsUpdate = async (dbId: IdDatabase) => {
  const { path } = databases()[dbId]

  const [errF, file] = await to(FileSystem.getInfoAsync(path))

  if (!file?.exists) {
    return false
  }

  // @ts-expect-error
  const [errRF, remoteFile] = await to(getDatabasesRef()[dbId].getMetadata())

  if (errF || errRF) {
    console.log(`Error for${dbId}`, errF, errRF)
    return false
  }

  // @ts-expect-error
  return file.size !== remoteFile?.size
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
    STRONG: {
      id: 'STRONG' as const,
      name: getI18n().t('Lexique hébreu & grec'),
      desc: i18n.t(
        'Lexique contenu les strongs grecs et hébreu avec leur concordance et définitions'
      ),
      fileSize: 34941952,
      path: getDbPath('STRONG', effectiveLang),
    },
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
    INTERLINEAIRE: {
      id: 'INTERLINEAIRE' as const,
      name: i18n.t('Interlinéaire'),
      desc: i18n.t('Texte interlinéaire hébreu/grec'),
      fileSize: 0, // Size varies
      path: getDbPath('INTERLINEAIRE', effectiveLang),
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
