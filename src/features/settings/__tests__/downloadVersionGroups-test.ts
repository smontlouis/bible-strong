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
      bibleVersion('LSGS', 'fr'),
      bibleVersion('KJV', 'en'),
      bibleVersion('INT_EN', 'en'),
      bibleVersion('KJVS', 'en'),
      bibleVersion('BHS', 'other', 'he'),
      bibleVersion('SBLGNT', 'other', 'grc'),
    ]
    const groups = buildBibleVersionGroups(versionList)

    expect(groups.map(group => group.key)).toEqual(['bible-fr', 'bible-en', 'bible-other'])
    expect(groups.map(group => group.titleKey)).toEqual([
      'downloads.section.bibleFr',
      'downloads.section.bibleEn',
      'downloads.section.bibleOther',
    ])

    const frenchIds = groups[0]!.versions.map(version => version.id)
    expect(frenchIds).toEqual(expect.arrayContaining(['LSG', 'S21', 'DBY', 'DBR', 'INT']))
    expect(frenchIds).not.toContain('LSGS')

    const englishIds = groups[1]!.versions.map(version => version.id)
    expect(englishIds).toEqual(expect.arrayContaining(['KJV', 'INT_EN']))
    expect(englishIds).not.toContain('KJVS')

    expect(groups[2]!.versions.map(version => version.id)).toEqual(
      expect.arrayContaining(['BHS', 'SBLGNT'])
    )
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
