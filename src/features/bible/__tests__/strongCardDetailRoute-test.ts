import { createStrongCardDetailRouteParams } from '../strongCardDetailRoute'

describe('createStrongCardDetailRouteParams', () => {
  it('preserves the ResourceModal verse context for the Strong detail page', () => {
    expect(
      createStrongCardDetailRouteParams({
        book: '1',
        identity: { kind: 'strong', code: 'H0430' },
        strongBibleVersionId: 'DBY',
        bibleVersion: 'DBY',
        bibleChapter: 1,
        bibleVerse: 1,
        clickedWord: 'Dieu',
        morphologyCodes: ['HNcmpa'],
      })
    ).toEqual({
      book: '1',
      identityKind: 'strong',
      identityCode: 'H0430',
      strongBibleVersionId: 'DBY',
      bibleVersion: 'DBY',
      bibleChapter: '1',
      bibleVerse: '1',
      clickedWord: 'Dieu',
      morphologyCodes: JSON.stringify(['HNcmpa']),
    })
  })
})
