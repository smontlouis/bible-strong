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
  books[38] = { Numero: 39, Nom: 'Malachie', Chapitres: 4 }
  books[18] = { Numero: 19, Nom: 'Psaumes', Chapitres: 150 }
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

describe('commentary reference navigation in the version being read', () => {
  it('opens an OSIS reference in the given version', () => {
    expect(getCommentaryBibleViewRoute('Matt.3.13', 'NBS')).toMatchObject({
      params: { verse: '13', version: 'NBS' },
    })
  })

  it('opens a commentary passage chip in the given version', () => {
    expect(
      getCommentaryPassageBibleViewRoute({ book: 40, chapter: 3, startVerse: 13, version: 'NBS' })
    ).toMatchObject({
      params: { verse: '13', version: 'NBS' },
    })
  })

  it('opens a passage of a KJV-numbered commentary at the verses of the Bible shown', () => {
    const numbering = { resource: 'commentary:barnes', shownVersion: 'LSG' }
    expect(
      getCommentaryPassageBibleViewRoute({
        book: 39,
        chapter: 4,
        startVerse: 5,
        endVerse: 6,
        numbering,
      })?.params
    ).toMatchObject({ chapter: '3', verse: '23', focusVerses: JSON.stringify([23, 24]) })
    expect(getCommentaryBibleViewRoute('Mal.4.5', 'LSG', numbering)?.params).toMatchObject({
      book: JSON.stringify({ Numero: 39, Nom: 'Malachie', Chapitres: 4 }),
      chapter: '3',
      verse: '23',
      focusVerses: JSON.stringify([23]),
      version: 'LSG',
    })
    // The title of the psalm, held by the KJV verse 1, is not where the passage opens.
    expect(
      getCommentaryBibleViewRoute('Ps.51.1-Ps.51.4', undefined, numbering)?.params
    ).toMatchObject({ chapter: '51', verse: '3', focusVerses: JSON.stringify([3, 4, 5, 6]) })
  })

  it('keeps the passage when the Bible shown numbers it as the commentary', () => {
    expect(
      getCommentaryBibleViewRoute('Mal.4.5', 'KJV', { resource: 'commentary:barnes' })?.params
    ).toMatchObject({ chapter: '4', verse: '5', focusVerses: JSON.stringify([5]) })
  })
})
