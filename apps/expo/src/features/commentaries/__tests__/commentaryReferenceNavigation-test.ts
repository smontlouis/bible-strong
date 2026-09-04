import {
  getCommentaryBibleViewRoute,
  getCommentaryPassageBibleViewRoute,
} from '../commentaryReferenceNavigation'

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
  default: { t: (key: string) => key },
}))

describe('commentary reference navigation', () => {
  it('opens a packaged OSIS range in the focused Bible viewer', () => {
    expect(getCommentaryBibleViewRoute('Matt.3.13-Matt.3.17')).toEqual({
      pathname: '/bible-view',
      params: {
        contextDisplayMode: 'focused',
        book: JSON.stringify({ Numero: 40, Nom: 'Matthieu', Chapitres: 28 }),
        chapter: '3',
        verse: '13',
        focusVerses: JSON.stringify([13, 14, 15, 16, 17]),
      },
    })
  })

  it('rejects an unsupported OSIS reference', () => {
    expect(getCommentaryBibleViewRoute('Unknown.1.1')).toBeUndefined()
  })

  it('keeps a single packaged OSIS verse in focused mode', () => {
    expect(getCommentaryBibleViewRoute('Matt.3.13')).toEqual({
      pathname: '/bible-view',
      params: {
        contextDisplayMode: 'focused',
        book: JSON.stringify({ Numero: 40, Nom: 'Matthieu', Chapitres: 28 }),
        chapter: '3',
        verse: '13',
        focusVerses: JSON.stringify([13]),
      },
    })
  })

  it('opens a commentary passage chip in the focused Bible viewer', () => {
    expect(
      getCommentaryPassageBibleViewRoute({
        book: 40,
        chapter: 3,
        startVerse: 13,
        endVerse: 17,
      })
    ).toEqual({
      pathname: '/bible-view',
      params: {
        contextDisplayMode: 'focused',
        book: JSON.stringify({ Numero: 40, Nom: 'Matthieu', Chapitres: 28 }),
        chapter: '3',
        verse: '13',
        focusVerses: JSON.stringify([13, 14, 15, 16, 17]),
      },
    })
  })

  it('does not turn an introduction into a Bible reference', () => {
    expect(
      getCommentaryPassageBibleViewRoute({ book: 40, chapter: 3, startVerse: 0 })
    ).toBeUndefined()
  })

  it('keeps a single commentary passage chip in focused mode', () => {
    expect(
      getCommentaryPassageBibleViewRoute({ book: 40, chapter: 3, startVerse: 13 })
    ).toMatchObject({
      params: {
        contextDisplayMode: 'focused',
        verse: '13',
        focusVerses: JSON.stringify([13]),
      },
    })
  })
})
