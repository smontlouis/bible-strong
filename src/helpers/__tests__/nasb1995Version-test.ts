import {
  getBibleVersionCanonId,
  getBibleVersionVersificationId,
  versions,
  versionsBySections,
  versionsBySections_en,
} from '../bibleVersions'

jest.mock('~i18n', () => ({
  getLanguage: () => 'fr',
}))

jest.mock('~features/resources/resourceAvailability', () => ({
  getIfLocalResourceNeedsDownload: jest.fn(),
}))

describe('NASB 1995 version', () => {
  it('registers the Bible.com edition with its attribution and default canon', () => {
    expect(versions.NASB1995).toMatchObject({
      id: 'NASB1995',
      name: 'New American Standard Bible 1995',
      c: '© 1960, 1962, 1963, 1968, 1971, 1972, 1973, 1975, 1977, 1995 The Lockman Foundation',
      type: 'en',
      canonId: 'protestant-66',
      versificationId: 'bible-strong-default',
    })
    expect(getBibleVersionCanonId('NASB1995')).toBe('protestant-66')
    expect(getBibleVersionVersificationId('NASB1995')).toBe('bible-strong-default')
  })

  it('lists NASB 1995 with the English versions in both UI languages', () => {
    expect(versionsBySections[2].data).toContainEqual(versions.NASB1995)
    expect(versionsBySections_en[0].data).toContainEqual(versions.NASB1995)
  })
})
