import * as FileSystem from 'expo-file-system'
import to from 'await-to-js'

import { getDatabasesRef } from '~helpers/firebase'
import i18n, { getLangIsFr } from '~i18n'
import { getI18n } from 'react-i18next'
import {
  databaseDictionnaireName,
  databaseMhyName,
  databaseNaveName,
  databaseStrongName,
  databaseTresorName,
  initSQLiteDir,
} from './sqlite'

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

export const databases = () => {
  return {
    STRONG: {
      id: 'STRONG',
      name: getI18n().t('Lexique hébreu & grec'),
      desc: i18n.t(
        'Lexique contenu les strongs grecs et hébreu avec leur concordance et définitions'
      ),
      fileSize: 34941952,
      path: `${sqliteDirPath}/${databaseStrongName}`,
    },
    DICTIONNAIRE: {
      id: 'DICTIONNAIRE',
      name: i18n.t('Dictionnaire Westphal'),
      desc: i18n.t('Dictionnaire Encyclopédique de la Bible A. Westphal.'),
      fileSize: 22532096,
      path: `${sqliteDirPath}/${databaseDictionnaireName}`,
    },
    NAVE: {
      id: 'NAVE',
      name: i18n.t('Bible thématique Nave'),
      desc: i18n.t(
        'Plus de 20.000 sujets et sous-thèmes, et 100.000 références aux Écritures.'
      ),
      fileSize: 7448576,
      path: `${sqliteDirPath}/${databaseNaveName}`,
    },
    TRESOR: {
      id: 'TRESOR',
      name: i18n.t('Références croisées'),
      desc: i18n.t(
        'L’un des ensembles les plus complets de références croisées jamais compilées, composé de plus de 572.000 entrées.'
      ),
      fileSize: 5434368,
      path: `${sqliteDirPath}/${databaseTresorName}`,
    },
    MHY: {
      id: 'MHY',
      name: i18n.t('Commentaires'),
      desc: i18n.t(
        'Commentaires concis de Matthew Henry. Traduction Dominique Osché.'
      ),
      fileSize: 6574080,
      path: `${sqliteDirPath}/${databaseMhyName}`,
    },
    TIMELINE: {
      id: 'TIMELINE',
      name: i18n.t('Chronologie de la Bible'),
      desc: i18n.t(
        'Lexique contenu les strongs grecs et hébreu avec leur concordance et définitions'
      ),
      fileSize: 3187836,
      path: `${FileSystem.documentDirectory}bible-timeline-events.json`,
    },
    SEARCH: {
      id: 'SEARCH',
      name: i18n.t('Index de recherche'),
      desc: i18n.t('Index permettant une recherche hors-ligne dans la Bible'),
      fileSize: 16795170,
      path: `${FileSystem.documentDirectory}idx-light.json`,
    },
  } as const
}

export type IdDatabase = keyof ReturnType<typeof databases>

export const getDatabases = () => {
  if (getLangIsFr()) {
    return databases()
  }

  // const { MHY, ...databasesEn } = databases()

  return databases()
}
