import * as FileSystem from 'expo-file-system'
import to from 'await-to-js'

import { databasesRef } from '~helpers/firebase'

const sqliteDirPath = `${FileSystem.documentDirectory}SQLite`

export const getIfDatabaseNeedsUpdate = async dbId => {
  const { path } = databases[dbId]

  const [errF, file] = await to(FileSystem.getInfoAsync(path))

  if (!file.exists) {
    return false
  }

  const [errRF, remoteFile] = await to(databasesRef[dbId].getMetadata())

  if (errF || errRF) {
    console.log(`Error for${dbId}`, errF, errRF)
    return false
  }

  return file.size !== remoteFile.size
}

export const getIfDatabaseNeedsDownload = async dbId => {
  const { path } = databases[dbId]
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

export const databases = {
  DICTIONNAIRE: {
    id: 'DICTIONNAIRE',
    name: 'Dictionnaire Westphal',
    desc: 'Dictionnaire Encyclopédique de la Bible A. Westphal. ',
    fileSize: 22532096,
    path: `${sqliteDirPath}/dictionnaire.sqlite`,
  },
  NAVE: {
    id: 'NAVE',
    name: 'Bible thématique Nave',
    desc:
      'Plus de 20.000 sujets et sous-thèmes, et 100.000 références aux Écritures.',
    fileSize: 7448576,
    path: `${sqliteDirPath}/naveFr.sqlite`,
  },
  TRESOR: {
    id: 'TRESOR',
    name: 'Références croisées',
    desc:
      'L’un des ensembles les plus complets de références croisées jamais compilées, composé de plus de 572.000 entrées.',
    fileSize: 5434368,
    path: `${sqliteDirPath}/commentaires-tresor.sqlite`,
  },
  MHY: {
    id: 'MHY',
    name: 'Commentaires',
    desc: 'Commentaires concis de Matthew Henry. Traduction Dominique Osché.',
    fileSize: 6574080,
    path: `${sqliteDirPath}/commentaires-mhy.sqlite`,
  },
  STRONG: {
    id: 'STRONG',
    name: 'Lexique hébreu & grec',
    desc:
      'Lexique contenu les strongs grecs et hébreu avec leur concordance et définitions',
    fileSize: 34941952,
    path: `${sqliteDirPath}/strong.sqlite`,
  },
  TIMELINE: {
    id: 'TIMELINE',
    name: 'Chronologie de la Bible',
    desc:
      'Lexique contenu les strongs grecs et hébreu avec leur concordance et définitions',
    fileSize: 3187836,
    path: `${FileSystem.documentDirectory}bible-timeline-events.json`,
  },
}
