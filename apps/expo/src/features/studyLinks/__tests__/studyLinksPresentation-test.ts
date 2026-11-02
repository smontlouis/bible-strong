import { studyLinkDetail, studyLinkRoute } from '../studyLinksPresentation'

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

describe('studyLinkDetail', () => {
  const article = (key: string, label: string, detail: string) =>
    ({ kind: 'dictionary', key, label, detail }) as const

  it('names only the article, which opens on the other dictionaries', () => {
    const david = article('bost:654', 'David', 'Bost')
    expect(studyLinkDetail(david, [david, article('bost:1', 'Saul', 'Bost')])).toBeUndefined()
  })

  it('tells apart two articles of one name', () => {
    const first = article('bost:1', 'Guéra', 'Bost')
    const second = article('calmet:2', 'guéra', 'Calmet')
    expect(studyLinkDetail(first, [first, second])).toBe('Bost')
    expect(studyLinkDetail(second, [first, second])).toBe('Calmet')
  })

  it('keeps the date of an event and the line on a person', () => {
    const event = { kind: 'timeline', key: 'a', label: 'A', detail: '1029 av. J.-C.' } as const
    const person = { kind: 'entity', key: 'b', label: 'B', detail: 'Roi' } as const
    expect(studyLinkDetail(event, [event])).toBe('1029 av. J.-C.')
    expect(studyLinkDetail(person, [person])).toBe('Roi')
  })

  it('says nothing under a topic', () => {
    const topic = { kind: 'nave', key: 'love', label: 'Amour' } as const
    expect(studyLinkDetail(topic, [topic])).toBeUndefined()
  })
})
