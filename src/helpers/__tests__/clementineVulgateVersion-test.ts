jest.mock('~i18n', () => ({
  getLanguage: () => 'fr',
}))

jest.mock('~features/resources/resourceAvailability', () => ({
  getIfLocalResourceNeedsDownload: jest.fn(),
}))

import {
  getBibleVersionCanonId,
  getBibleVersionVersificationId,
  versions,
  versionsBySections,
  versionsBySections_en,
} from '../bibleVersions'

describe('Clementine Vulgate version', () => {
  it('registers VUL with its canon, versification, source, and foreign-language sections', () => {
    expect(versions.VUL).toMatchObject({
      id: 'VUL',
      type: 'other',
      c: 'Domaine public - Clementine Text Project',
      canonId: 'clementine-vulgate',
      versificationId: 'clementine-vulgate',
      sourceUrl:
        'https://bitbucket.org/clementinetextproject/text/src/edc85da058be630183d26e4deb6714ade80e600c/',
    })
    expect(getBibleVersionCanonId('VUL')).toBe('clementine-vulgate')
    expect(getBibleVersionVersificationId('VUL')).toBe('clementine-vulgate')
    expect(versionsBySections[3].data).toContainEqual(versions.VUL)
    expect(versionsBySections_en[2].data).toContainEqual({
      ...versions.VUL,
      name: versions.VUL.name_en,
    })
  })

  it('keeps existing versions on the default Protestant canon and versification', () => {
    expect(getBibleVersionCanonId('LSG')).toBe('protestant-66')
    expect(getBibleVersionVersificationId('LSG')).toBe('bible-strong-default')
    expect(getBibleVersionVersificationId('LAU')).toBe('bible-strong-french-4-chapter-joel')
  })
})
