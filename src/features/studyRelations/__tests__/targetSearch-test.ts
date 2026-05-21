import { searchRelationTargets } from '../targetSearch'

jest.mock('~features/search/BibleReferenceWidget', () => ({
  parseBibleReference: (query: string) =>
    query.toLowerCase().includes('jean') || query.toLowerCase().includes('jn')
      ? [{ book: 43, chapter: 3, startVerse: 16, endVerse: 16, isWholeChapter: false }]
      : [],
}))

jest.mock('~assets/bible_versions/books-desc', () => {
  const books = Array.from({ length: 66 }, (_, index) => ({
    Numero: index + 1,
    Nom: `Livre ${index + 1}`,
    Chapitres: 1,
  }))
  books[42] = { Numero: 43, Nom: 'Jean', Chapitres: 21 }
  return books
})

jest.mock('~i18n', () => ({
  t: (key: string) => key,
}))

describe('searchRelationTargets', () => {
  it('returns canonical verse endpoints for bible references', () => {
    const [result] = searchRelationTargets('Jean 3:16')

    expect(result).toMatchObject({
      type: 'verse',
      title: 'Jean 3:16',
      endpoint: {
        type: 'verse',
        verseKeys: ['43-3-16'],
      },
    })
  })

  it('returns strong endpoints for strong codes', () => {
    expect(searchRelationTargets('G26')[0].endpoint).toEqual({
      type: 'strong',
      language: 'greek',
      code: '26',
      label: 'G26',
    })

    expect(searchRelationTargets('H7225')[0].endpoint).toEqual({
      type: 'strong',
      language: 'hebrew',
      code: '7225',
      label: 'H7225',
    })
  })

  it('returns note and study targets from user data', () => {
    const results = searchRelationTargets('grâce', {
      notes: {
        note1: { title: 'Grâce', description: 'Une note', date: 1 },
      },
      studies: {
        study1: {
          id: 'study1',
          title: 'Étude sur la grâce',
          created_at: 1,
          modified_at: 1,
          content: null,
          user: { id: 'user', displayName: 'User', photoUrl: '' },
        },
      },
    })

    expect(results.map(result => result.type)).toEqual(['note', 'study'])
    expect(results[0].endpoint).toMatchObject({ type: 'note', noteId: 'note1' })
    expect(results[1].endpoint).toMatchObject({ type: 'study', studyId: 'study1' })
  })
})
