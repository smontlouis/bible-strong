import { createDictionaryInternalLinkRoute } from '../dictionaryInternalNavigation'

describe('dictionary internal navigation', () => {
  it('keeps the source language when opening another entry from an English dictionary', () => {
    expect(
      createDictionaryInternalLinkRoute('Jochebed', {
        work: 'smith',
        resourceId: 'dictionary-smith-en',
        dictionaryTitle: 'Smith’s Bible Dictionary',
        language: 'en',
      })
    ).toEqual({
      pathname: '/dictionnary-detail',
      params: {
        word: 'Jochebed',
        work: 'smith',
        resourceId: 'dictionary-smith-en',
        dictionaryTitle: 'Smith’s Bible Dictionary',
        language: 'en',
      },
    })
  })
})
