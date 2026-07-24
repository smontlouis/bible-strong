import type { Version } from '~helpers/bibleVersions'

export interface BibleVersionGroup {
  key: 'bible-fr' | 'bible-en' | 'bible-other'
  titleKey:
    | 'downloads.section.bibleFr'
    | 'downloads.section.bibleEn'
    | 'downloads.section.bibleOther'
  versions: Version[]
}

export const buildBibleVersionGroups = (versionList: Version[]): BibleVersionGroup[] => {
  const visibleVersions = versionList.filter(version => !['LSGS', 'KJVS'].includes(version.id))

  return [
    {
      key: 'bible-fr',
      titleKey: 'downloads.section.bibleFr',
      versions: visibleVersions.filter(version => version.type === 'fr'),
    },
    {
      key: 'bible-en',
      titleKey: 'downloads.section.bibleEn',
      versions: visibleVersions.filter(version => version.type === 'en'),
    },
    {
      key: 'bible-other',
      titleKey: 'downloads.section.bibleOther',
      versions: visibleVersions.filter(version => version.type === 'other'),
    },
  ]
}
