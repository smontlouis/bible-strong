import type { Version } from '~helpers/bibleVersions'
import { buildBibleVersionGroups } from '../downloadVersionGroups'

describe('buildBibleVersionGroups', () => {
  it('presents one French, one English, then one original-language Bible section', () => {
    const versionList = [
      bibleVersion('LSG', 'fr'),
      bibleVersion('S21', 'fr'),
      bibleVersion('DBY', 'fr'),
      bibleVersion('DBR', 'fr'),
      bibleVersion('INT', 'fr'),
      { ...bibleVersion('LSGS', 'fr'), hidden: true },
      bibleVersion('KJV', 'en'),
      bibleVersion('INT_EN', 'en'),
      bibleVersion('KJVS', 'en'),
      bibleVersion('BHS', 'other', 'he'),
      bibleVersion('SBLGNT', 'other', 'grc'),
      bibleVersion('VUL', 'other', 'la'),
      { ...bibleVersion('HIDDEN', 'fr'), hidden: true },
    ]
    const groups = buildBibleVersionGroups(versionList, 'fr')

    expect(groups.map(group => group.key)).toEqual(['bible-fr', 'bible-en', 'bible-original'])
    expect(groups.map(group => group.titleKey)).toEqual([
      'downloads.section.bibleFr',
      'downloads.section.bibleEn',
      'downloads.section.bibleOriginal',
    ])

    const frenchIds = groups[0]!.versions.map(version => version.id)
    expect(frenchIds).toEqual(['DBR', 'DBY', 'INT', 'LSG', 'S21'])
    expect(frenchIds).not.toContain('LSGS')
    expect(frenchIds).not.toContain('HIDDEN')

    const englishIds = groups[1]!.versions.map(version => version.id)
    expect(englishIds).toEqual(['INT_EN', 'KJV'])
    expect(englishIds).not.toContain('KJVS')

    expect(groups[2]!.versions.map(version => version.id)).toEqual(['BHS', 'SBLGNT', 'VUL'])
  })
})

const bibleVersion = (
  id: string,
  type: NonNullable<Version['type']>,
  language: Version['language'] = type === 'en' ? 'en' : 'fr'
): Version => ({
  id,
  name: id,
  type,
  language,
  readingProfile: null,
})
