jest.mock('~assets/bible_versions/books-desc', () => {
  const books = Array.from({ length: 66 }, (_, index) => ({
    Numero: index + 1,
    Nom: `Livre ${index + 1}`,
    Chapitres: 1,
  }))
  books[0] = { Numero: 1, Nom: 'Genèse', Chapitres: 50 }
  books[64] = { Numero: 65, Nom: 'Jude', Chapitres: 1 }
  return books
})

jest.mock('~i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string, options?: Record<string, unknown>) =>
      options?.bookNumber ? `Livre ${options.bookNumber}` : key,
  },
}))

import verseToReference from '../verseToReference'

describe('verseToReference', () => {
  it('keeps same-chapter references compact', () => {
    expect(verseToReference(['1-1-1', '1-1-3', '1-1-4', '1-1-5'])).toBe('Genèse 1:1,3-5')
  })

  it('separates references from different books instead of merging verse numbers', () => {
    expect(verseToReference(['1-4-1', '65-1-24'])).toBe('Genèse 4:1; Jude 1:24')
  })

  it('orders references by book, chapter, then verse', () => {
    expect(verseToReference(['65-1-24', '1-4-1', '1-1-2'])).toBe(
      'Genèse 1:2; Genèse 4:1; Jude 1:24'
    )
  })
})
