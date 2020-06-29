import * as FileSystem from 'expo-file-system'
import to from 'await-to-js'

import { biblesRef } from '~helpers/firebase'
import { isFR } from '../../i18n'

export const getIfVersionNeedsUpdate = async (versionId: string) => {
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

  if (!file?.exists) {
    return false
  }

  const [errRF, remoteFile] = await to(biblesRef[versionId].getMetadata())

  if (errF || errRF) {
    console.log('Error...')
    return false
  }

  return file.size !== remoteFile?.size
}

export const getIfVersionNeedsDownload = async (versionId: string) => {
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

interface Version {
  id: string
  name: string
  name_en?: string
  c?: string
}

export const versions: {
  [x: string]: Version
} = {
  LSG: {
    id: 'LSG',
    name: 'Bible Segond 1910',
    c: '1910 - Libre de droit',
  },
  LSGS: {
    id: 'LSGS',
    name: 'Bible Segond 1910 + Strongs',
    c: '1910 - Libre de droit',
  },
  NBS: {
    id: 'NBS',
    name: 'Nouvelle Bible Segond',
    c: '© 2002 Société Biblique Française',
  },
  NEG79: {
    id: 'NEG79',
    name: 'Nouvelle Edition de Genève 1979',
    c: '© 1979 Société Biblique de Genève',
  },
  NVS78P: {
    id: 'NVS78P',
    name: 'Nouvelle Segond révisée',
    c: '© Alliance Biblique Française',
  },
  S21: {
    id: 'S21',
    name: 'Bible Segond 21',
    c: '© 2007 Société Biblique de Genève',
  },
  INT: {
    id: 'INT',
    name: 'Bible Interlinéaire',
    c: '© Editio Critica Maior',
  },
  KJF: {
    id: 'KJF',
    name: 'King James Française',
    c: '© 1611 Traduction française, Bible des réformateurs 2006',
  },
  DBY: {
    id: 'DBY',
    name: 'Bible Darby',
    c: '1890 Libre de droit',
  },
  OST: {
    id: 'OST',
    name: 'Ostervald',
    c: '1881 Libre de droit',
  },
  // JER: {
  //   id: 'JER',
  //   name: 'Bible Jérusalem',
  //   c: '© 1966',
  // },
  CHU: {
    id: 'CHU',
    name: 'Bible Chouraqui 1985',
    c: '© 1977 Editions Desclée de Brouwer',
  },
  BDS: {
    id: 'BDS',
    name: 'Bible du Semeur',
    c: '© 2000 Société Biblique Internationale',
  },
  FMAR: {
    id: 'FMAR',
    name: 'Martin 1744',
    c: '1744 Libre de droit',
  },
  BFC: {
    id: 'BFC',
    name: 'Bible en Français courant',
    c: '© Alliance Biblique Française',
  },
  FRC97: {
    id: 'FRC97',
    name: 'Français courant',
    c: '© Alliance Biblique Française',
  },
  NFC: {
    id: 'NFC',
    name: 'Nouvelle Français courant',
    c: "Alliance biblique française Bibli'0, ©2019",
  },
  KJV: {
    id: 'KJV',
    name: 'King James Version',
    c: '1611 Libre de droit',
  },
  NKJV: {
    id: 'NKJV',
    name: 'New King James Version',
    c: '© 1982 Thomas Nelson, Inc',
  },
  ESV: {
    id: 'ESV',
    name: 'English Standard Version',
    c: '© 2001 Crossway Bibles',
  },
  NIV: {
    id: 'NIV',
    name: 'New International Version',
    c: '© NIV® 1973, 1978, 1984, 2011 Biblica',
  },
  BCC1923: {
    id: 'BCC1923',
    name: 'Bible catholique Crampon 1923',
    c: '© mission-web.com',
  },
  PDV2017: {
    id: 'PDV2017',
    name: 'Parole de Vie 2017',
    c: "© 2000 Société biblique française - Bibli'O",
  },
  POV: {
    id: 'POV',
    name: 'Parole vivante (NT)',
    c: '© 2013',
  },
  BHS: {
    id: 'BHS',
    name: 'Biblia Hebraica Stuttgartensia (AT)',
    name_en: 'Biblia Hebraica Stuttgartensia (OT)',
    c: '© Deutsche Bibelgesellschaft, Stuttgart 1967/77',
  },
  LXX: {
    id: 'LXX',
    name: 'Septante (AT)',
    name_en: 'Septuagint (OT)',
  },
  SBLGNT: {
    id: 'SBLGNT',
    name: 'SBL NT. Grec (NT)',
    name_en: 'SBL NT. Greek (NT)',
    c: '© 2010 Society of Bible Litterature',
  },
  TR1624: {
    id: 'TR1624',
    name: 'Elzevir Textus Receptus 1624 (NT)',
  },
  TR1894: {
    id: 'TR1894',
    name: 'Scrivener’s Textus Receptus 1894 (NT)',
  },
}

interface VersionsBySection {
  title: string
  data: Version[]
}
export const versionsBySections: VersionsBySection[] = Object.values(
  versions
).reduce(
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
      case 'SBLGNT':
      case 'TR1624':
      case 'TR1894':
      case 'LXX': {
        sectionArray[2].data.push(version)
        return sectionArray
      }
      default: {
        sectionArray[1].data.push(version)
        return sectionArray
      }
    }
  },
  <VersionsBySection[]>[
    { title: 'Versions Louis Segond', data: [] },
    { title: 'Autres versions', data: [] },
    { title: 'Versions étrangères', data: [] },
  ]
)

export const versionsBySections_en: VersionsBySection[] = Object.values(
  versions
).reduce(
  (sectionArray, version) => {
    const versionEn = { ...version, name: version.name_en || version.name }
    switch (version.id) {
      case 'KJV':
      case 'NKJV':
      case 'NIV':
      case 'ESV': {
        sectionArray[0].data.push(versionEn)
        return sectionArray
      }
      case 'BHS':
      case 'SBLGNT':
      case 'TR1624':
      case 'TR1894':
      case 'LXX': {
        sectionArray[1].data.push(versionEn)
        return sectionArray
      }
      default: {
        return sectionArray
      }
    }
  },
  <VersionsBySection[]>[
    { title: 'English versions', data: [] },
    { title: 'Other versions', data: [] },
  ]
)

export const getVersionsBySections = () => {
  if (isFR) {
    return versionsBySections
  }

  return versionsBySections_en
}
