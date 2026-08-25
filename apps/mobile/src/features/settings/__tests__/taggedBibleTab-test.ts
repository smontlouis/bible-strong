import { getTaggedBibleTabData, getTaggedWordAnnotationVerseKeys } from '../taggedBibleTab'

jest.mock('~assets/bible_versions/books-desc', () => [
  { Numero: 1, Nom: 'Genèse', Chapitres: 50 },
  { Numero: 67, Nom: 'Tobie', Chapitres: 14 },
])

describe('getTaggedBibleTabData', () => {
  it('preserves the preferred version and complete verse range', () => {
    expect(
      getTaggedBibleTabData({
        verseKeys: ['67-1-1', '67-1-3'],
        preferredVersion: 'VUL',
        defaultVersion: 'LSG',
      })
    ).toMatchObject({
      selectedBook: { Numero: 67, Nom: 'Tobie', Chapitres: 14 },
      selectedChapter: 1,
      selectedVerse: 1,
      selectedVersion: 'VUL',
      focusVerses: [1, 3],
      entityReference: {
        verseKeys: ['67-1-1', '67-1-3'],
        preferredVersion: 'VUL',
      },
    })
  })

  it("uses the user's configured default for a legacy entity", () => {
    expect(
      getTaggedBibleTabData({
        verseKeys: ['67-1-1'],
        defaultVersion: 'DBY',
      })
    ).toMatchObject({
      selectedVersion: 'DBY',
      entityReference: {
        verseKeys: ['67-1-1'],
      },
    })
  })

  it('keeps every range from a tagged word annotation', () => {
    expect(
      getTaggedWordAnnotationVerseKeys({
        verseKey: '67-1-1',
        verseKeys: ['67-1-1', '67-1-3'],
      })
    ).toEqual(['67-1-1', '67-1-3'])
  })
})
