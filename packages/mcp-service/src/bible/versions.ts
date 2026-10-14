import { isStrongBibleVersionId } from '@bible-strong/resource-catalog/strong-bibles'
import type { StudyLanguage } from '../language'

export type BibleVersion = {
  id: string
  name: string
  nameEn?: string
  /** BCP 47 language of the text; `he-grc` pairs both original languages. */
  language: string
}

// The Bibles read online, named as the public site names them
// (apps/site/features/bible/bibleVersions.ts). A test keeps the list equal to the catalog.
export const BIBLE_VERSIONS: readonly BibleVersion[] = [
  { id: 'AMP', name: 'Amplified Bible', language: 'en' },
  { id: 'ASV', name: 'American Standard Version', language: 'en' },
  { id: 'BCC1923', name: 'Bible catholique Crampon 1923', language: 'fr' },
  { id: 'BDS', name: 'Bible du Semeur', language: 'fr' },
  { id: 'BFC', name: 'Bible en Français courant', language: 'fr' },
  { id: 'BHG', name: 'Bible hébraïque et grecque', nameEn: 'Hebrew & Greek Bible', language: 'he-grc' },
  { id: 'BHS', name: 'Biblia Hebraica Stuttgartensia (AT)', nameEn: 'Biblia Hebraica Stuttgartensia (OT)', language: 'he' },
  { id: 'BSB', name: 'Berean Standard Bible', language: 'en' },
  { id: 'CHU', name: 'Bible Chouraqui 1985', language: 'fr' },
  { id: 'CSB', name: 'Christian Standard Bible', language: 'en' },
  { id: 'DARBY', name: 'Darby Bible', language: 'en' },
  { id: 'DBR', name: 'Bible Darby révisée', language: 'fr' },
  { id: 'DBY', name: 'Bible Darby', language: 'fr' },
  { id: 'DEL', name: "Tanach and Delitzsch's Hebrew New Testament", language: 'he' },
  { id: 'EASY', name: 'EasyEnglish Bible 2018', language: 'en' },
  { id: 'ESV', name: 'English Standard Version', language: 'en' },
  { id: 'FMAR', name: 'Martin 1744', language: 'fr' },
  { id: 'FRC97', name: 'Français courant', language: 'fr' },
  { id: 'GW', name: 'God’s Word Translation', language: 'en' },
  { id: 'KJF', name: 'King James Française', language: 'fr' },
  { id: 'KJV', name: 'King James Version', language: 'en' },
  { id: 'LAU', name: 'Bible de Lausanne 1872', nameEn: 'Lausanne Bible 1872', language: 'fr' },
  { id: 'LSG', name: 'Bible Segond 1910', language: 'fr' },
  { id: 'LXX', name: 'Septante (AT)', nameEn: 'Septuagint (OT)', language: 'grc' },
  { id: 'LXX_FR', name: 'Septante française (AT)', nameEn: 'French Septuagint (OT)', language: 'fr' },
  { id: 'NASB1995', name: 'New American Standard Bible 1995', language: 'en' },
  { id: 'NASB2020', name: 'New American Standard Bible 2020', language: 'en' },
  { id: 'NBS', name: 'Nouvelle Bible Segond', language: 'fr' },
  { id: 'NEG79', name: 'Nouvelle Edition de Genève 1979', language: 'fr' },
  { id: 'NET', name: 'New English Translation', language: 'en' },
  { id: 'NFC', name: 'Nouvelle Français courant', language: 'fr' },
  { id: 'NIV', name: 'New International Version', language: 'en' },
  { id: 'NKJV', name: 'New King James Version', language: 'en' },
  { id: 'NLT', name: 'New Living Translation', language: 'en' },
  { id: 'NVS78P', name: 'Nouvelle Segond révisée', language: 'fr' },
  { id: 'OST', name: 'Ostervald', language: 'fr' },
  { id: 'PDV2017', name: 'Parole de Vie 2017', language: 'fr' },
  { id: 'POV', name: 'Parole vivante (NT)', language: 'fr' },
  { id: 'RLT', name: 'Revised Literal Translation', language: 'en' },
  { id: 'RV1895', name: 'Revised Version 1895', language: 'en' },
  { id: 'RWEBSTER', name: "Revised Webster's Bible", language: 'en' },
  { id: 'S21', name: 'Bible Segond 21', language: 'fr' },
  { id: 'SBLGNT', name: 'SBL NT. Grec (NT)', nameEn: 'SBL NT. Greek (NT)', language: 'grc' },
  { id: 'TLV', name: 'Tree of Life Version', language: 'en' },
  { id: 'TR1624', name: 'Elzevir Textus Receptus 1624 (NT)', language: 'grc' },
  { id: 'TR1894', name: 'Scrivener’s Textus Receptus 1894 (NT)', language: 'grc' },
  { id: 'VUL', name: 'Vulgate clémentine (latin)', nameEn: 'Clementine Vulgate (Latin)', language: 'la' },
]

/** `LXX_FR` reads `lxx-fr` in a public path. */
export const versionSlug = (versionId: string): string =>
  versionId.toLowerCase().replaceAll('_', '-')

const versionsBySlug = new Map(BIBLE_VERSIONS.map(version => [versionSlug(version.id), version]))

/** Finds a version however it is written: `LSG`, `lsg`, `lxx-fr`, `LXX_FR`. */
export const findVersion = (value: string | undefined): BibleVersion | undefined =>
  value ? versionsBySlug.get(versionSlug(value.trim())) : undefined

export const versionName = (version: BibleVersion, language: StudyLanguage): string =>
  (language === 'en' && version.nameEn) || version.name

/** The Bible a passage is read in when none is asked for. */
export const defaultVersionId = (language: StudyLanguage): string =>
  language === 'en' ? 'KJV' : 'LSG'

/** The Bible whose words carry Strong numbers, read when none is asked for. */
export const defaultStrongVersionId = defaultVersionId

export const hasStrongNumbers = (versionId: string): boolean => isStrongBibleVersionId(versionId)

/** The Bible holding the Hebrew and Greek text the word-by-word reading is built on. */
export const ORIGINAL_VERSION_ID = 'BHG'

/** The direction a version is read in for a given book. */
export const versionDirection = (version: BibleVersion, book: number): 'ltr' | 'rtl' => {
  if (version.language === 'he') return 'rtl'
  if (version.language === 'he-grc') return book <= 39 ? 'rtl' : 'ltr'
  return 'ltr'
}
