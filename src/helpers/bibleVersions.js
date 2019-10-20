import * as FileSystem from 'expo-file-system'

export const getIfVersionNeedsDownload = async versionId => {
  if (versionId === 'LSG') {
    return false
  }

  if (versionId === 'INT') {
    const sqliteDirPath = `${FileSystem.documentDirectory}SQLite`
    const sqliteDir = await FileSystem.getInfoAsync(sqliteDirPath)

    if (!sqliteDir.exists) {
      await FileSystem.makeDirectoryAsync(sqliteDirPath)
    } else if (!sqliteDir.isDirectory) {
      throw new Error('SQLite dir is not a directory')
    }

    const dbPath = `${sqliteDirPath}/interlineaire.sqlite`
    const file = await FileSystem.getInfoAsync(dbPath)

    if (!file.exists) {
      return true
    }

    return false
  }

  const path = `${FileSystem.documentDirectory}bible-${versionId}.json`
  const file = await FileSystem.getInfoAsync(path)

  // if (__DEV__) {
  //   if (file.exists) {
  //     FileSystem.deleteAsync(file.uri)
  //     file = await FileSystem.getInfoAsync(path)
  //   }
  // }

  if (!file.exists) {
    return true
  }

  return false
}

export const versions = {
  LSG: {
    id: 'LSG',
    name: 'Bible Segond 1910'
  },
  INT: {
    id: 'INT',
    name: 'Bible Second Interlinéaire'
  },
  KJF: {
    id: 'KJF',
    name: 'King James Française'
  },
  DBY: {
    id: 'DBY',
    name: 'Bible Darby'
  },
  OST: {
    id: 'OST',
    name: 'Ostervald'
  },
  CHU: {
    id: 'CHU',
    name: 'Bible Chouraqui 1985'
  },
  BDS: {
    id: 'BDS',
    name: 'Bible du Semeur'
  },
  FMAR: {
    id: 'FMAR',
    name: 'Martin 1744'
  },
  FRC97: {
    id: 'FRC97',
    name: 'Français courant'
  },
  NBS: {
    id: 'NBS',
    name: 'Nouvelle Bible Segond'
  },
  NEG79: {
    id: 'NEG79',
    name: 'Nouvelle Edition de Genève 1979'
  },
  NVS78P: {
    id: 'NVS78P',
    name: 'Nouvelle Segond révisée'
  },
  S21: {
    id: 'S21',
    name: 'Bible Segond 21'
  }
}
