import * as FileSystem from 'expo-file-system'
import to from 'await-to-js'

import { biblesRef } from '~helpers/firebase'

export const getIfVersionNeedsUpdate = async versionId => {
  if (versionId === 'LSG') {
    return false
  }

  if (versionId === 'INT') {
    // DO SOMETHING HERE
    return false
  }

  if (versionId === 'LSGS') {
    // DO SOMETHING HERE
    return false
  }

  const path = `${FileSystem.documentDirectory}bible-${versionId}.json`

  const [errF, file] = await to(FileSystem.getInfoAsync(path))

  if (!file.exists) {
    return false
  }

  const [errRF, remoteFile] = await to(biblesRef[versionId].getMetadata())

  if (errF || errRF) {
    console.log('Error...')
    return false
  }

  return file.size !== remoteFile.size
}

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

  if (versionId === 'LSGS') {
    const sqliteDirPath = `${FileSystem.documentDirectory}SQLite`
    const sqliteDir = await FileSystem.getInfoAsync(sqliteDirPath)

    if (!sqliteDir.exists) {
      await FileSystem.makeDirectoryAsync(sqliteDirPath)
    } else if (!sqliteDir.isDirectory) {
      throw new Error('SQLite dir is not a directory')
    }

    const dbPath = `${sqliteDirPath}/strong.sqlite`
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
    name: 'Bible Segond 1910',
    c: '1910 - Libre de droit'
  },
  LSGS: {
    id: 'LSGS',
    name: 'Bible Segond 1910 + Strongs',
    c: '1910 - Libre de droit'
  },
  NBS: {
    id: 'NBS',
    name: 'Nouvelle Bible Segond',
    c: '© 2002 Société Biblique Française'
  },
  NEG79: {
    id: 'NEG79',
    name: 'Nouvelle Edition de Genève 1979',
    c: '© 1979 Société Biblique de Genève'
  },
  NVS78P: {
    id: 'NVS78P',
    name: 'Nouvelle Segond révisée',
    c: '© Alliance Biblique Française'
  },
  S21: {
    id: 'S21',
    name: 'Bible Segond 21',
    c: '© 2007 Société Biblique de Genève'
  },
  INT: {
    id: 'INT',
    name: 'Bible Interlinéaire',
    c: '© Editio Critica Maior'
  },
  KJF: {
    id: 'KJF',
    name: 'King James Française',
    c: '© 1611 Traduction française, Bible des réformateurs 2006'
  },
  DBY: {
    id: 'DBY',
    name: 'Bible Darby',
    c: '1890 Libre de droit'
  },
  OST: {
    id: 'OST',
    name: 'Ostervald',
    c: '1881 Libre de droit'
  },
  CHU: {
    id: 'CHU',
    name: 'Bible Chouraqui 1985',
    c: '© 1977 Editions Desclée de Brouwer'
  },
  BDS: {
    id: 'BDS',
    name: 'Bible du Semeur',
    c: '© 2000 Société Biblique Internationale'
  },
  FMAR: {
    id: 'FMAR',
    name: 'Martin 1744',
    c: '1744 Libre de droit'
  },
  FRC97: {
    id: 'FRC97',
    name: 'Français courant',
    c: '© Alliance Biblique Française'
  },
  KJV: {
    id: 'KJV',
    name: 'King James Version',
    c: '1611 Libre de droit'
  },
  NKJV: {
    id: 'NKJV',
    name: 'New King James Version',
    c: '© 1982 Thomas Nelson, Inc'
  },
  ESV: {
    id: 'ESV',
    name: 'English Standard Version',
    c: '© 2001 Crossway Bibles'
  },
  NIV: {
    id: 'NIV',
    name: 'New International Version',
    c: '© NIV® 1973, 1978, 1984, 2011 Biblica'
  },
  // BJC: {
  //   id: 'BJC',
  //   name: 'Bible de Jésus-Christ'
  // },
  POV: {
    id: 'POV',
    name: 'Parole vivante',
    c: '© 2013'
  },
  BHS: {
    id: 'BHS',
    name: 'Biblia Hebraica Stuttgartensia',
    c: '© Deutsche Bibelgesellschaft, Stuttgart 1967/77'
  },
  SBLGNT: {
    id: 'SBLGNT',
    name: 'SBL NT. Grec',
    c: '© 2010 Society of Bible Litterature'
  }
}

export const versionsBySections = Object.values(versions).reduce(
  (sectionArray, version) => {
    switch (version.id) {
      case 'LSG':
      case 'LSGS':
      case 'NBS':
      case 'NEG79':
      case 'NVS78P':
      case 'S21': {
        sectionArray[0].data.push(version)

        return sectionArray
      }
      case 'KJV':
      case 'NKJV':
      case 'NIV':
      case 'ESV':
      case 'BHS':
      case 'SBLGNT': {
        sectionArray[2].data.push(version)
        return sectionArray
      }
      default: {
        sectionArray[1].data.push(version)
        return sectionArray
      }
    }
  },
  [
    { title: 'Versions Louis Segond', data: [] },
    { title: 'Autres versions', data: [] },
    { title: 'Versions étrangères', data: [] }
  ]
)
