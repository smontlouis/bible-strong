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
  __esModule: true,
  default: { t: (key: string) => key },
  t: (key: string) => key,
}))

describe('searchRelationTargets', () => {
  it('returns canonical verse endpoints for bible references', () => {
    const [result] = searchRelationTargets('Jean 3:16')

    expect(result).toMatchObject({
      type: 'passages',
      title: 'Jean 3:16',
      endpoint: {
        type: 'verse',
        verseKeys: ['43-3-16'],
      },
    })
  })

  it('returns strong endpoints for strong codes', () => {
    expect(searchRelationTargets('G26')[0].endpoint).toMatchObject({
      type: 'strong',
      language: 'greek',
      code: '26',
      labelFallback: 'G26',
    })

    expect(searchRelationTargets('H7225')[0].endpoint).toMatchObject({
      type: 'strong',
      language: 'hebrew',
      code: '7225',
      labelFallback: 'H7225',
    })

    expect(searchRelationTargets(' h 0430 ')[0]).toMatchObject({
      title: 'H430',
      endpoint: {
        type: 'strong',
        language: 'hebrew',
        code: '430',
        labelFallback: 'H430',
      },
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

    expect(results.map(result => result.type)).toEqual(['notes', 'studies'])
    expect(results[0].endpoint).toMatchObject({ type: 'note', noteId: 'note1' })
    expect(results[1].endpoint).toMatchObject({ type: 'study', studyId: 'study1' })
  })

  it('normalizes accents, Greek diacritics, and Hebrew niqqud for local targets', () => {
    const notes = {
      french: { title: 'Éternel', description: 'Une note', date: 1 },
      greek: { title: 'Ἀγάπη', description: 'Une note', date: 2 },
      hebrew: { title: 'אֱלֹהִים', description: 'Une note', date: 3 },
    }

    expect(searchRelationTargets('eternel', { notes })[0].id).toBe('note:french')
    expect(searchRelationTargets('αγαπη', { notes })[0].id).toBe('note:greek')
    expect(searchRelationTargets('אלהים', { notes })[0].id).toBe('note:hebrew')
  })

  it('falls back to the study map key when persisted studies have no id field', () => {
    const [result] = searchRelationTargets('grâce', {
      studies: {
        legacyStudy: {
          title: 'Étude sur la grâce',
          created_at: 1,
          modified_at: 1,
          content: null,
          user: { id: 'user', displayName: 'User', photoUrl: '' },
        } as any,
      },
    })

    expect(result).toMatchObject({
      id: 'study:legacyStudy',
      endpoint: { type: 'study', studyId: 'legacyStudy' },
    })
  })

  it('returns word annotations as durable relation targets', () => {
    const [result] = searchRelationTargets('commencement', {
      wordAnnotations: {
        annotation1: {
          id: 'annotation1',
          version: 'LSG',
          ranges: [
            { verseKey: '1-1-1', startWordIndex: 0, endWordIndex: 1, text: 'Au commencement' },
          ],
          color: 'color1',
          type: 'underline',
          date: 1,
        },
      },
    })

    expect(result).toMatchObject({
      id: 'annotation:annotation1',
      title: 'Au commencement',
      description: 'Livre 1 1:1 · LSG',
      endpoint: { type: 'annotation', annotationId: 'annotation1' },
    })
  })
})
