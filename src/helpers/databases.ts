import * as FileSystem from 'expo-file-system'
import to from 'await-to-js'

import { getDatabasesRef } from '~helpers/firebase'
import i18n, { getLangIsFr } from '~i18n'
import { getI18n } from 'react-i18next'

const sqliteDirPath = `${FileSystem.documentDirectory}SQLite`

export const getIfDatabaseNeedsUpdate = async (dbId: string) => {
  const { path } = databases()[dbId]

  const [errF, file] = await to(FileSystem.getInfoAsync(path))

  if (!file?.exists) {
    return false
  }

  const [errRF, remoteFile] = await to(getDatabasesRef()[dbId].getMetadata())

  if (errF || errRF) {
    console.log(`Error for${dbId}`, errF, errRF)
    return false
  }

  return file.size !== remoteFile?.size
}

export const getIfDatabaseNeedsDownload = async (dbId: string) => {
  const { path } = databases()[dbId]
  const sqliteDirPath = `${FileSystem.documentDirectory}SQLite`
  const sqliteDir = await FileSystem.getInfoAsync(sqliteDirPath)

  if (!sqliteDir.exists) {
    await FileSystem.makeDirectoryAsync(sqliteDirPath)
  } else if (!sqliteDir.isDirectory) {
    throw new Error('SQLite dir is not a directory')
  }

  const file = await FileSystem.getInfoAsync(path)

  if (!file.exists) {
    return true
  }

  return false
}

export const databases = (): {
  [DATABASEID: string]: {
    id: string
    name: string
    desc: string
    fileSize: number
    path: string
  }
} => {
  return {
    STRONG: {
      id: 'STRONG',
      name: getI18n().t('Lexique hébreu & grec'),
      desc: i18n.t(
        'Lexique contenu les strongs grecs et hébreu avec leur concordance et définitions'
      ),
      fileSize: 34941952,
      path: `${sqliteDirPath}/strong.sqlite`,
    },
    DICTIONNAIRE: {
      id: 'DICTIONNAIRE',
      name: i18n.t('Dictionnaire Westphal'),
      desc: i18n.t('Dictionnaire Encyclopédique de la Bible A. Westphal.'),
      fileSize: 22532096,
      path: `${sqliteDirPath}/dictionnaire.sqlite`,
    },
    NAVE: {
      id: 'NAVE',
      name: i18n.t('Bible thématique Nave'),
      desc: i18n.t(
        'Plus de 20.000 sujets et sous-thèmes, et 100.000 références aux Écritures.'
      ),
      fileSize: 7448576,
      path: `${sqliteDirPath}/naveFr.sqlite`,
    },
    TRESOR: {
      id: 'TRESOR',
      name: i18n.t('Références croisées'),
      desc: i18n.t(
        'L’un des ensembles les plus complets de références croisées jamais compilées, composé de plus de 572.000 entrées.'
      ),
      fileSize: 5434368,
      path: `${sqliteDirPath}/commentaires-tresor.sqlite`,
    },
    MHY: {
      id: 'MHY',
      name: i18n.t('Commentaires'),
      desc: i18n.t(
        'Commentaires concis de Matthew Henry. Traduction Dominique Osché.'
      ),
      fileSize: 6574080,
      path: `${sqliteDirPath}/commentaires-mhy.sqlite`,
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
  }
}

export const getDatabases = () => {
  if (getLangIsFr()) {
    return databases()
  }

  const { MHY, ...databasesEn } = databases()
  return databasesEn
}
