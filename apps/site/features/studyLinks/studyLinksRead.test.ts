import { describe, expect, it } from 'vitest'
import { studyLinkDetail, studyLinkPath } from './studyLinksRead'

describe('studyLinkPath', () => {
  it('opens an article of its own work', () => {
    expect(
      studyLinkPath({ kind: 'dictionary', key: 'bost:654', label: 'David', detail: 'Bost' }, 'fr')
    ).toBe('/dictionary/fr/bost/654/david')
  })

  it('opens a topic and an event', () => {
    expect(studyLinkPath({ kind: 'nave', key: 'love', label: 'Amour' }, 'fr')).toBe('/nave/fr/love')
    expect(studyLinkPath({ kind: 'timeline', key: 'david', label: 'David' }, 'en')).toBe(
      '/timeline/en/david'
    )
  })
})

describe('studyLinkDetail', () => {
  const article = (label: string, detail: string) =>
    ({ kind: 'dictionary', label, detail }) as const

  it('names only the article, which leads to the other dictionaries', () => {
    const david = article('David', 'Bost')
    expect(studyLinkDetail(david, [david, article('Saul', 'Bost')])).toBeUndefined()
  })

  it('tells apart two articles of one name', () => {
    const first = article('Guéra', 'Bost')
    expect(studyLinkDetail(first, [first, article('guéra', 'Calmet')])).toBe('Bost')
  })

  it('keeps the date of an event', () => {
    const event = { kind: 'timeline', label: 'A', detail: '1029 av. J.-C.' } as const
    expect(studyLinkDetail(event, [event])).toBe('1029 av. J.-C.')
  })
})
