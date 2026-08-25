import {
  getBibleViewParamsForReferenceSegment,
  getBibleViewParamsForSearchResult,
} from '../searchNavigation'

describe('getBibleViewParamsForSearchResult', () => {
  it('preserves the tapped search result version in Bible view params', () => {
    expect(
      getBibleViewParamsForSearchResult({
        book: 51,
        chapter: 2,
        verse: 19,
        version: 'DBY',
      })
    ).toEqual({
      contextDisplayMode: 'focused',
      book: JSON.stringify({ Numero: 51, Nom: 'Colossiens', Chapitres: 4 }),
      chapter: '2',
      verse: '19',
      version: 'DBY',
      focusVerses: JSON.stringify([19]),
    })
  })

  it('keeps different result versions distinct', () => {
    const lsgParams = getBibleViewParamsForSearchResult({
      book: 51,
      chapter: 2,
      verse: 19,
      version: 'LSG',
    })
    const dbyParams = getBibleViewParamsForSearchResult({
      book: 51,
      chapter: 2,
      verse: 19,
      version: 'DBY',
    })

    expect(lsgParams.version).toBe('LSG')
    expect(dbyParams.version).toBe('DBY')
  })

  it('opens a whole-chapter reference as a full chapter and a verse as focused context', () => {
    expect(
      getBibleViewParamsForReferenceSegment({
        book: 49,
        chapter: 2,
        startVerse: 1,
        endVerse: 3,
        isWholeChapter: true,
      })
    ).toEqual({
      contextDisplayMode: 'fullChapter',
      book: JSON.stringify({ Numero: 49, Nom: 'Éphésiens', Chapitres: 6 }),
      chapter: '2',
      verse: '1',
    })

    expect(
      getBibleViewParamsForReferenceSegment({
        book: 49,
        chapter: 2,
        startVerse: 8,
        endVerse: 8,
        isWholeChapter: false,
      })
    ).toEqual({
      contextDisplayMode: 'focused',
      book: JSON.stringify({ Numero: 49, Nom: 'Éphésiens', Chapitres: 6 }),
      chapter: '2',
      verse: '8',
      focusVerses: JSON.stringify([8]),
    })
  })
})
