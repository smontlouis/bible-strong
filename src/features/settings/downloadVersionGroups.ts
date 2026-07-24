import type { Version } from '~helpers/bibleVersions'

export interface BibleVersionGroup {
  key: 'bible-fr' | 'bible-en' | 'bible-original'
  titleKey:
    | 'downloads.section.bibleFr'
    | 'downloads.section.bibleEn'
    | 'downloads.section.bibleOriginal'
  versions: Version[]
}

const ORIGINAL_LANGUAGES = new Set<Version['language']>(['he', 'grc', 'la'])

export const buildBibleVersionGroups = (
  versionList: Version[],
  appLanguage: string
): BibleVersionGroup[] => {
  const visibleVersions = versionList
    .filter(version => !version.hidden && version.id !== 'KJVS')
    .sort((left, right) => {
      const leftName = appLanguage === 'en' ? (left.name_en ?? left.name) : left.name
      const rightName = appLanguage === 'en' ? (right.name_en ?? right.name) : right.name
      return leftName.localeCompare(rightName, appLanguage)
    })

  return [
    {
      key: 'bible-fr',
      titleKey: 'downloads.section.bibleFr',
      versions: visibleVersions.filter(version => version.language === 'fr'),
    },
    {
      key: 'bible-en',
      titleKey: 'downloads.section.bibleEn',
      versions: visibleVersions.filter(version => version.language === 'en'),
    },
    {
      key: 'bible-original',
      titleKey: 'downloads.section.bibleOriginal',
      versions: visibleVersions.filter(version => ORIGINAL_LANGUAGES.has(version.language)),
    },
  ]
}
