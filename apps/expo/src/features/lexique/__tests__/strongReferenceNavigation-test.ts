import {
  formatStrongOsisReference,
  getBibleViewRouteForStrongOsisReference,
} from '../strongReferenceNavigation'

jest.mock('~assets/bible_versions/books-desc', () => {
  const books = Array.from({ length: 73 }, (_, index) => ({
    Numero: index + 1,
    Nom: `Livre ${index + 1}`,
    Chapitres: 1,
  }))
  books[39] = { Numero: 40, Nom: 'Matthieu', Chapitres: 28 }
  return books
})

jest.mock('~i18n', () => ({
  __esModule: true,
  getLanguage: () => 'fr',
  default: {
    t: (key: string) => key,
  },
}))

describe('Strong reference navigation', () => {
  it('formats an OSIS reference with the localized Bible book name', () => {
    expect(formatStrongOsisReference('Matt.16.18')).toBe('Matthieu 16:18')
  })

  it('preserves chapter-only and cross-chapter ranges in the label', () => {
    expect(formatStrongOsisReference('Matt.16')).toBe('Matthieu 16')
    expect(formatStrongOsisReference('Matt.16.18-Matt.17.2')).toBe('Matthieu 16:18-17:2')
    expect(formatStrongOsisReference('Matt.16-Matt.18')).toBe('Matthieu 16-18')
  })

  it('opens an OSIS reference in a focused Bible Viewer without forcing a version', () => {
    expect(getBibleViewRouteForStrongOsisReference('Matt.16.18')).toEqual({
      pathname: '/bible-view',
      params: {
        contextDisplayMode: 'focused',
        book: JSON.stringify({ Numero: 40, Nom: 'Matthieu', Chapitres: 28 }),
        chapter: '16',
        verse: '18',
        focusVerses: JSON.stringify([18]),
      },
    })
  })

  it('returns no label or destination for an unsupported reference', () => {
    expect(formatStrongOsisReference('Unknown.1.1')).toBe('Unknown.1.1')
    expect(getBibleViewRouteForStrongOsisReference('Unknown.1.1')).toBeUndefined()
  })
})
