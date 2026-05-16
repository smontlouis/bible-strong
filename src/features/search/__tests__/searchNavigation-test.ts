import { getBibleViewParamsForSearchResult } from '../searchNavigation'

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
      isReadOnly: 'true',
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
})
