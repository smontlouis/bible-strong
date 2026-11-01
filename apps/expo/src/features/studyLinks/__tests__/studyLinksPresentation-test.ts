import { studyLinkRoute } from '../studyLinksPresentation'

describe('studyLinkRoute', () => {
  it('opens an article in its own work', () => {
    expect(
      studyLinkRoute({ kind: 'dictionary', key: 'bost:654', label: 'David', detail: 'Bost' }, 'fr')
    ).toEqual({
      pathname: '/dictionnary-detail',
      params: {
        word: 'David',
        work: 'bost',
        dictionaryTitle: 'Bost',
        language: 'fr',
        entryId: '654',
      },
    })
  })

  it('opens a topic and an event by their keys', () => {
    expect(studyLinkRoute({ kind: 'nave', key: 'love', label: 'Amour' }, 'fr')).toEqual({
      pathname: '/nave-detail',
      params: { name_lower: 'love', name: 'Amour' },
    })
    expect(studyLinkRoute({ kind: 'timeline', key: 'david', label: 'David' }, 'fr')).toEqual({
      pathname: '/event',
      params: { slug: 'david' },
    })
  })
})
