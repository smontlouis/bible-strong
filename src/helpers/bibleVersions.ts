import * as FileSystem from 'expo-file-system/legacy'

import { getLanguage } from '~i18n'
import { isVersionInstalled } from '~helpers/biblesDb'
import { audioDefault, audioV2 } from './topBibleAudio'
import { zeroFill } from './zeroFill'
import { getDatabases, getDbPath } from './databases'
import { initSQLiteDir } from './sqlite'

export const getIfVersionNeedsUpdate = async (versionId: string) => {
  // Find a way to update the version
  return false
}

export const getIfVersionNeedsDownload = async (versionId: string) => {
  if (versionId === 'INT') {
    await initSQLiteDir()
    const dbPath = getDbPath('INTERLINEAIRE', 'fr')
    const file = await FileSystem.getInfoAsync(dbPath)
    return !file.exists
  }

  if (versionId === 'INT_EN') {
    await initSQLiteDir()
    const dbPath = getDbPath('INTERLINEAIRE', 'en')
    const file = await FileSystem.getInfoAsync(dbPath)
    return !file.exists
  }

  if (versionId === 'LSGS' || versionId === 'KJVS') {
    await initSQLiteDir()

    const dbPath = getDatabases().STRONG.path
    const file = await FileSystem.getInfoAsync(dbPath)

    if (!file.exists) {
      return true
    }

    return false
  }

  // Check bibles.sqlite first
  const installed = await isVersionInstalled(versionId)
  if (installed) {
    return false
  }

  // Fallback: check legacy JSON file (for versions not yet migrated)
  const path = `${FileSystem.documentDirectory}bible-${versionId}.json`
  const file = await FileSystem.getInfoAsync(path)

  if (!file.exists) {
    return true
  }

  return false
}

const bibleStudyToolsBookMapping = [
  'ge',
  'ex',
  'le',
  'nu',
  'de',
  'jos',
  'jud',
  'ru',
  '1sa',
  '2sa',
  '1ki',
  '2ki',
  '1ch',
  '2ch',
  'ezr',
  'ne',
  'es',
  'job',
  'ps',
  'pr',
  'ec',
  'so',
  'isa',
  'jer',
  'la',
  'eze',
  'da',
  'ho',
  'joe',
  'am',
  'ob',
  'jon',
  'mic',
  'na',
  'hab',
  'zen',
  'hag',
  'zec',
  'mal',
  'mt',
  'mr',
  'lu',
  'joh',
  'ac',
  'ro',
  '1co',
  '2co',
  'ga',
  'eph',
  'php',
  'col',
  '1th',
  '2th',
  '1ti',
  '2ti',
  'tit',
  'phm',
  'heb',
  'jas',
  '1pe',
  '2pe',
  '1jo',
  '2jo',
  '3jo',
  'jude',
  're',
]

export interface Version {
  id: string
  name: string
  name_en?: string
  c?: string
  type?: 'en' | 'fr' | 'other'
  hasAudio?: boolean
  hasRedWords?: boolean
  hasPericope?: boolean
  getAudioUrl?: (bookNum: number, chapterNum: number) => string
}

const getLsgAudioUrl = (bookNum: number, chapterNum: number) => {
  const audioBaseUrl = (() => {
    if (audioV2.includes(bookNum.toString())) {
      return 'https://s.topchretien.com/media/topbible/bible_v2/'
    }

    if (audioDefault.includes(bookNum.toString())) {
      return 'https://s.topchretien.com/media/topbible/bible/'
    }

    return 'https://s.topchretien.com/media/topbible/bible_say/'
  })()

  return `${audioBaseUrl}${zeroFill(bookNum, 2)}_${zeroFill(chapterNum, 2)}.mp3`
}

export const versions = {
  LSG: {
    id: 'LSG',
    name: 'Bible Segond 1910',
    c: '1910 - Libre de droit',
    type: 'fr',
    hasRedWords: true,
    hasPericope: true,
    hasAudio: true,
    getAudioUrl: getLsgAudioUrl,
  },
  LSGS: {
    id: 'LSGS',
    name: 'Bible Segond 1910 + Strongs',
    c: '1910 - Libre de droit',
    type: 'fr',
    hasAudio: true,
    getAudioUrl: getLsgAudioUrl,
  },
  NBS: {
    id: 'NBS',
    name: 'Nouvelle Bible Segond',
    c: '© 2002 Société Biblique Française',
    type: 'fr',
    hasRedWords: true,
    hasPericope: true,
  },
  NEG79: {
    id: 'NEG79',
    name: 'Nouvelle Edition de Genève 1979',
    c: '© 1979 Société Biblique de Genève',
    type: 'fr',
    hasRedWords: true,
    hasPericope: true,
  },
  NVS78P: {
    id: 'NVS78P',
    name: 'Nouvelle Segond révisée',
    c: '© Alliance Biblique Française',
    type: 'fr',
    hasRedWords: true,
    hasPericope: true,
  },
  S21: {
    id: 'S21',
    name: 'Bible Segond 21',
    c: '© 2007 Société Biblique de Genève',
    type: 'fr',
    hasRedWords: true,
    hasPericope: true,
  },
  INT: {
    id: 'INT',
    name: 'Bible Interlinéaire',
    name_en: 'Interlinear Bible (FR)',
    c: '©',
    type: 'fr',
  },
  KJF: {
    id: 'KJF',
    name: 'King James Française',
    c: '© 1611 Traduction française, Bible des réformateurs 2006',
    type: 'fr',
    hasRedWords: true,
  },
  DBY: {
    id: 'DBY',
    name: 'Bible Darby',
    c: '1890 Libre de droit',
    type: 'fr',
    hasRedWords: true,
  },
  OST: {
    id: 'OST',
    name: 'Ostervald',
    c: '1881 Libre de droit',
    type: 'fr',
    hasRedWords: true,
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
    type: 'fr',
    hasRedWords: true,
  },
  BDS: {
    id: 'BDS',
    name: 'Bible du Semeur',
    c: '© 2000 Société Biblique Internationale',
    type: 'fr',
    hasRedWords: true,
    hasPericope: true,
    hasAudio: true,
    getAudioUrl: (bookNum: number, chapterNum: number) => {
      return `https://www.bible.audio/media/sem/${
        bookNum > 39 ? 'nt' : 'at'
      }/${bookNum.toString().padStart(2, '0')}_${chapterNum.toString().padStart(3, '0')}.mp3`
    },
  },
  FMAR: {
    id: 'FMAR',
    name: 'Martin 1744',
    c: '1744 Libre de droit',
    type: 'fr',
    hasRedWords: true,
    hasPericope: true,
  },
  BFC: {
    id: 'BFC',
    name: 'Bible en Français courant',
    c: '© Alliance Biblique Française',
    type: 'fr',
    hasRedWords: true,
    hasPericope: true,
  },
  FRC97: {
    id: 'FRC97',
    name: 'Français courant',
    c: '© Alliance Biblique Française',
    type: 'fr',
    hasRedWords: true,
    hasPericope: true,
  },
  NFC: {
    id: 'NFC',
    name: 'Nouvelle Français courant',
    c: "Alliance biblique française Bibli'0, ©2019",
    type: 'fr',
    hasRedWords: true,
    hasPericope: true,
  },
  KJV: {
    id: 'KJV',
    name: 'King James Version',
    c: '1611 Libre de droit',
    type: 'en',
    hasRedWords: true,
    hasPericope: true,
    hasAudio: true,
    getAudioUrl: (bookNum: number, chapterNum: number) => {
      return `https://www.wordpocket.org/bibles/app/audio/1/${bookNum}/${chapterNum}.mp3`
    },
  },
  KJVS: {
    id: 'KJVS',
    name: 'King James Version Strong',
    c: '1611 Libre de droit',
    type: 'en',
    hasAudio: true,
    getAudioUrl: (bookNum: number, chapterNum: number) => {
      return `https://www.wordpocket.org/bibles/app/audio/1/${bookNum}/${chapterNum}.mp3`
    },
  },
  INT_EN: {
    id: 'INT_EN',
    name: 'Bible Interlinéaire (EN)',
    name_en: 'Interlinear Bible',
    c: '©',
    type: 'en',
  },
  NKJV: {
    id: 'NKJV',
    name: 'New King James Version',
    c: '© 1982 Thomas Nelson, Inc',
    type: 'en',
    hasRedWords: true,
    hasPericope: true,
  },
  ESV: {
    id: 'ESV',
    name: 'English Standard Version',
    c: '© 2001 Crossway Bibles',
    type: 'en',
    hasRedWords: true,
    hasPericope: true,
    hasAudio: true,
    getAudioUrl: (bookNum: number, chapterNum: number) => {
      return `https://content.swncdn.com/biblestudytools/audio/esv-mp3/${bookNum
        .toString()
        .padStart(2, '0')}_${
        bibleStudyToolsBookMapping[bookNum - 1]
      }_${chapterNum.toString().padStart(3, '0')}.mp3`
    },
  },
  NIV: {
    id: 'NIV',
    name: 'New International Version',
    c: '© NIV® 1973, 1978, 1984, 2011 Biblica',
    type: 'en',
    hasRedWords: true,
    hasPericope: true,
    hasAudio: true,
    getAudioUrl: (bookNum: number, chapterNum: number) => {
      return `https://www.bible.audio/media/niv/${bookNum > 39 ? 'nt' : 'at'}/${(bookNum > 39
        ? bookNum - 39
        : bookNum
      )
        .toString()
        .padStart(2, '0')}_${chapterNum.toString().padStart(3, '0')}.mp3`
    },
  },
  BCC1923: {
    id: 'BCC1923',
    name: 'Bible catholique Crampon 1923',
    c: '© mission-web.com',
    type: 'fr',
    hasRedWords: true,
    hasPericope: true,
  },
  PDV2017: {
    id: 'PDV2017',
    name: 'Parole de Vie 2017',
    c: "© 2000 Société biblique française - Bibli'O",
    type: 'fr',
    hasRedWords: true,
    hasPericope: true,
  },
  POV: {
    id: 'POV',
    name: 'Parole vivante (NT)',
    c: '© 2013',
    type: 'fr',
    hasRedWords: true,
  },
  EASY: {
    id: 'EASY',
    name: 'EasyEnglish Bible 2018',
    c: 'Copyright © MissionAssist 2018',
    type: 'en',
    hasRedWords: true,
    hasPericope: true,
  },
  TLV: {
    id: 'TLV',
    name: 'Tree of Life Version',
    c: '© 2015 The Messianic Jewish Family Bible Society',
    type: 'en',
    hasRedWords: true,
  },
  NASB2020: {
    id: 'NASB2020',
    name: 'New American Standard Bible 2020',
    c: '© 2020 The Lockman Foundation',
    type: 'en',
    hasRedWords: true,
    hasPericope: true,
  },
  NET: {
    id: 'NET',
    name: 'New English Translation',
    c: '© 1996-2016 Biblical Studies Press, L.L.C.',
    type: 'en',
    hasRedWords: true,
    hasPericope: true,
  },
  GW: {
    id: 'GW',
    name: 'God\u2019s Word Translation',
    c: '\u00a9 1995 God\u2019s Word to the Nations Bible Society',
    type: 'en',
    hasRedWords: true,
    hasPericope: true,
  },
  CSB: {
    id: 'CSB',
    name: 'Christian Standard Bible',
    c: '© 2017 Holman Bible Publishers',
    type: 'en',
    hasRedWords: true,
    hasPericope: true,
  },
  NLT: {
    id: 'NLT',
    name: 'New Living Translation',
    c: '© 1996, 2004, 2015 Tyndale House Foundation',
    type: 'en',
    hasRedWords: true,
    hasPericope: true,
    hasAudio: true,
    getAudioUrl: (bookNum: number, chapterNum: number) => {
      return `https://content.swncdn.com/biblestudytools/audio/nlt-mp3/${bookNum
        .toString()
        .padStart(2, '0')}_${
        bibleStudyToolsBookMapping[bookNum - 1]
      }_${chapterNum.toString().padStart(3, '0')}.mp3`
    },
  },
  AMP: {
    id: 'AMP',
    name: 'Amplified Bible',
    c: '© 2015 by The Lockman Foundation, La Habra, CA 90631',
    type: 'en',
    hasRedWords: true,
    hasPericope: true,
  },
  BHS: {
    id: 'BHS',
    name: 'Biblia Hebraica Stuttgartensia (AT)',
    name_en: 'Biblia Hebraica Stuttgartensia (OT)',
    c: '© Deutsche Bibelgesellschaft, Stuttgart 1967/77',
    type: 'other',
  },
  LXX: {
    id: 'LXX',
    name: 'Septante (AT)',
    name_en: 'Septuagint (OT)',
    type: 'other',
  },
  SBLGNT: {
    id: 'SBLGNT',
    name: 'SBL NT. Grec (NT)',
    name_en: 'SBL NT. Greek (NT)',
    c: '© 2010 Society of Bible Litterature',
    type: 'other',
  },
  TR1624: {
    id: 'TR1624',
    name: 'Elzevir Textus Receptus 1624 (NT)',
    type: 'other',
  },
  TR1894: {
    id: 'TR1894',
    name: 'Scrivener’s Textus Receptus 1894 (NT)',
    type: 'other',
  },
  DEL: {
    id: 'DEL',
    name: "Tanach and Delitzsch's Hebrew New Testament",
    c: '© Bible Society in Israel, 2018.',
    type: 'other',
  },
}

export const getVersions = () => {
  return versions
}

interface VersionsBySection {
  title: string
  data: Version[]
}
export const versionsBySections: VersionsBySection[] = Object.values(versions).reduce(
  (sectionArray, version) => {
    switch (version.id) {
      case 'LSG':
      case 'LSGS':
      case 'NBS':
      case 'NEG79':
      case 'NVS78P':
      case 'S21': {
        // @ts-ignore
        sectionArray[0].data.push(version)
        return sectionArray
      }
      case 'KJV':
      case 'KJVS':
      case 'NKJV':
      case 'NIV':
      case 'ESV':
      case 'AMP':
      case 'NASB2020':
      case 'EASY':
      case 'TLV':
      case 'NET':
      case 'GW':
      case 'CSB':
      case 'NLT':
      case 'INT_EN': {
        // @ts-ignore
        sectionArray[2].data.push(version)
        return sectionArray
      }
      case 'BHS':
      case 'SBLGNT':
      case 'TR1624':
      case 'TR1894':
      case 'DEL':
      case 'LXX': {
        // @ts-ignore
        sectionArray[3].data.push(version)
        return sectionArray
      }
      default: {
        // @ts-ignore
        sectionArray[1].data.push(version)
        return sectionArray
      }
    }
  },
  [
    { title: 'Versions Louis Segond', data: [] },
    { title: 'Autres versions', data: [] },
    { title: 'Versions anglaises', data: [] },
    { title: 'Versions étrangères', data: [] },
  ] as VersionsBySection[]
)

export const versionsBySections_en: VersionsBySection[] = Object.values(versions).reduce(
  (sectionArray, version) => {
    // @ts-ignore
    const versionEn = { ...version, name: version.name_en || version.name }
    switch (version.id) {
      case 'KJV':
      case 'KJVS':
      case 'INT_EN':
      case 'NKJV':
      case 'NIV':
      case 'AMP':
      case 'NASB2020':
      case 'EASY':
      case 'TLV':
      case 'NET':
      case 'GW':
      case 'CSB':
      case 'NLT':
      case 'ESV': {
        // @ts-ignore
        sectionArray[0].data.push(versionEn)
        return sectionArray
      }
      case 'LSG':
      case 'LSGS':
      case 'INT':
      case 'NBS':
      case 'NEG79':
      case 'NVS78P':
      case 'S21':
      case 'KJF':
      case 'DBY':
      case 'OST':
      case 'CHU':
      case 'BDS':
      case 'FMAR':
      case 'BFC':
      case 'FRC97':
      case 'NFC':
      case 'BCC1923':
      case 'PDV2017':
      case 'POV': {
        // @ts-ignore
        sectionArray[1].data.push(versionEn)
        return sectionArray
      }
      case 'BHS':
      case 'SBLGNT':
      case 'TR1624':
      case 'TR1894':
      case 'DEL':
      case 'LXX': {
        // @ts-ignore
        sectionArray[2].data.push(versionEn)
        return sectionArray
      }
      default: {
        return sectionArray
      }
    }
  },
  [
    { title: 'English versions', data: [] },
    { title: 'French versions', data: [] },
    { title: 'Other versions', data: [] },
  ] as VersionsBySection[]
)

export const getVersionsBySections = () => {
  if (getLanguage() === 'fr') {
    return versionsBySections
  }

  return versionsBySections_en
}

export const isStrongVersion = (version: string) =>
  version === 'INT' || version === 'INT_EN' || version === 'LSGS' || version === 'KJVS'
