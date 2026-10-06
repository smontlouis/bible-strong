import type { ResourceLanguage } from '../resources/publicSite'

export type BibleVersion = {
  id: string
  name: string
  nameEn?: string
  /** BCP 47 language of the text; `he-grc` pairs both original languages. */
  language: string
  copyright?: string
}

// Display metadata of the Bibles served online. The shared catalog only carries identities,
// so names and notices mirror the study workspace (apps/expo/src/helpers/bibleVersions.ts).
// A test keeps this list aligned with the catalog without bundling it into the page.
export const BIBLE_VERSIONS: readonly BibleVersion[] = [
  { id: 'AMP', name: 'Amplified Bible', language: 'en', copyright: '© 2015 by The Lockman Foundation, La Habra, CA 90631' },
  { id: 'ASV', name: 'American Standard Version', language: 'en', copyright: '1901 — Public Domain' },
  { id: 'BCC1923', name: 'Bible catholique Crampon 1923', language: 'fr', copyright: '© mission-web.com' },
  { id: 'BDS', name: 'Bible du Semeur', language: 'fr', copyright: '© 2000 Société Biblique Internationale' },
  { id: 'BFC', name: 'Bible en Français courant', language: 'fr', copyright: '© Alliance Biblique Française' },
  { id: 'BHG', name: 'Bible hébraïque et grecque', nameEn: 'Hebrew & Greek Bible', language: 'he-grc', copyright: 'STEPBible.org / Tyndale House Cambridge — CC BY 4.0' },
  { id: 'BHS', name: 'Biblia Hebraica Stuttgartensia (AT)', nameEn: 'Biblia Hebraica Stuttgartensia (OT)', language: 'he', copyright: '© Deutsche Bibelgesellschaft, Stuttgart 1967/77' },
  { id: 'BSB', name: 'Berean Standard Bible', language: 'en', copyright: '© Berean Bible — CC0 / Public Domain' },
  { id: 'CHU', name: 'Bible Chouraqui 1985', language: 'fr', copyright: '© 1977 Editions Desclée de Brouwer' },
  { id: 'CSB', name: 'Christian Standard Bible', language: 'en', copyright: '© 2017 Holman Bible Publishers' },
  { id: 'DARBY', name: 'Darby Bible', language: 'en', copyright: '1889 — Public Domain' },
  { id: 'DBR', name: 'Bible Darby révisée', language: 'fr', copyright: '© Bibles et Publications Chrétiennes - CC BY-NC-ND' },
  { id: 'DBY', name: 'Bible Darby', language: 'fr', copyright: '1890 Libre de droit' },
  { id: 'DEL', name: "Tanach and Delitzsch's Hebrew New Testament", language: 'he', copyright: '© Bible Society in Israel, 2018.' },
  { id: 'EASY', name: 'EasyEnglish Bible 2018', language: 'en', copyright: 'Copyright © MissionAssist 2018' },
  { id: 'ESV', name: 'English Standard Version', language: 'en', copyright: '© 2001 Crossway Bibles' },
  { id: 'FMAR', name: 'Martin 1744', language: 'fr', copyright: '1744 Libre de droit' },
  { id: 'FRC97', name: 'Français courant', language: 'fr', copyright: '© Alliance Biblique Française' },
  { id: 'GW', name: 'God’s Word Translation', language: 'en', copyright: '© 1995 God’s Word to the Nations Bible Society' },
  { id: 'KJF', name: 'King James Française', language: 'fr', copyright: '© 1611 Traduction française, Bible des réformateurs 2006' },
  { id: 'KJV', name: 'King James Version', language: 'en', copyright: 'Public Domain except in the United Kingdom (Crown rights)' },
  { id: 'LAU', name: 'Bible de Lausanne 1872', nameEn: 'Lausanne Bible 1872', language: 'fr', copyright: '1872 - Domaine public' },
  { id: 'LSG', name: 'Bible Segond 1910', language: 'fr', copyright: '1910 - Libre de droit' },
  { id: 'LXX', name: 'Septante (AT)', nameEn: 'Septuagint (OT)', language: 'grc', copyright: 'Texte grec-français édité par ThéoTeX Éditions - theotex.org' },
  { id: 'LXX_FR', name: 'Septante française (AT)', nameEn: 'French Septuagint (OT)', language: 'fr', copyright: 'Texte grec-français édité par ThéoTeX Éditions - theotex.org' },
  { id: 'NASB1995', name: 'New American Standard Bible 1995', language: 'en', copyright: '© 1960–1995 The Lockman Foundation. All rights reserved.' },
  { id: 'NASB2020', name: 'New American Standard Bible 2020', language: 'en', copyright: '© 1960–2020 The Lockman Foundation. All rights reserved.' },
  { id: 'NBS', name: 'Nouvelle Bible Segond', language: 'fr', copyright: '© 2002 Société Biblique Française' },
  { id: 'NEG79', name: 'Nouvelle Edition de Genève 1979', language: 'fr', copyright: '© 1979 Société Biblique de Genève' },
  { id: 'NET', name: 'New English Translation', language: 'en', copyright: '© 1996-2016 Biblical Studies Press, L.L.C.' },
  { id: 'NFC', name: 'Nouvelle Français courant', language: 'fr', copyright: "Alliance biblique française Bibli'0, ©2019" },
  { id: 'NIV', name: 'New International Version', language: 'en', copyright: '© NIV® 1973, 1978, 1984, 2011 Biblica' },
  { id: 'NKJV', name: 'New King James Version', language: 'en', copyright: '© 1982 Thomas Nelson, Inc' },
  { id: 'NLT', name: 'New Living Translation', language: 'en', copyright: '© 1996, 2004, 2015 Tyndale House Foundation' },
  { id: 'NVS78P', name: 'Nouvelle Segond révisée', language: 'fr', copyright: '© Alliance Biblique Française' },
  { id: 'OST', name: 'Ostervald', language: 'fr', copyright: '1881 Libre de droit' },
  { id: 'PDV2017', name: 'Parole de Vie 2017', language: 'fr', copyright: "© 2000 Société biblique française - Bibli'O" },
  { id: 'POV', name: 'Parole vivante (NT)', language: 'fr', copyright: '© 2013' },
  { id: 'RLT', name: 'Revised Literal Translation', language: 'en', copyright: '© 2018 Michael W. Jones, Sr. — GPL' },
  { id: 'RV1895', name: 'Revised Version 1895', language: 'en', copyright: '1895 — Public Domain' },
  { id: 'RWEBSTER', name: "Revised Webster's Bible", language: 'en', copyright: '1833 — Public Domain' },
  { id: 'S21', name: 'Bible Segond 21', language: 'fr', copyright: '© 2007 Société Biblique de Genève' },
  { id: 'SBLGNT', name: 'SBL NT. Grec (NT)', nameEn: 'SBL NT. Greek (NT)', language: 'grc', copyright: '© 2010 Society of Bible Litterature' },
  { id: 'TLV', name: 'Tree of Life Version', language: 'en', copyright: '© 2015 The Messianic Jewish Family Bible Society' },
  { id: 'TR1624', name: 'Elzevir Textus Receptus 1624 (NT)', language: 'grc' },
  { id: 'TR1894', name: 'Scrivener’s Textus Receptus 1894 (NT)', language: 'grc' },
  { id: 'VUL', name: 'Vulgate clémentine (latin)', nameEn: 'Clementine Vulgate (Latin)', language: 'la', copyright: 'Domaine public - Clementine Text Project' },
]

const versionsBySlug = new Map(BIBLE_VERSIONS.map(version => [bibleVersionSlug(version.id), version]))

/** `LXX_FR` reads `lxx-fr` in a path, as in the study workspace (ADR-0053). */
export function bibleVersionSlug(versionId: string): string {
  return versionId.toLowerCase().replaceAll('_', '-')
}

export const findBibleVersion = (slug: string | undefined): BibleVersion | undefined =>
  slug ? versionsBySlug.get(slug.toLowerCase()) : undefined

/**
 * The interface language of a Bible page: the text language when the site speaks it,
 * otherwise French unless English glosses were asked for.
 */
export const bibleVersionPageLanguage = (
  version: BibleVersion,
  gloss?: string
): ResourceLanguage => (version.language === 'en' || gloss === 'en' ? 'en' : 'fr')

export const bibleVersionName = (version: BibleVersion, language: ResourceLanguage): string =>
  (language === 'en' && version.nameEn) || version.name

/**
 * Whether a version is expected to carry a book, from the testament its name announces.
 * Deuterocanonical books are only linked within the version being read.
 */
export const bibleVersionCoversBook = (version: BibleVersion, book: number): boolean => {
  if (book > 66) return false
  if (/\((?:AT|OT)\)/u.test(version.name)) return book <= 39
  if (/\(NT\)/u.test(version.name)) return book >= 40
  return true
}
