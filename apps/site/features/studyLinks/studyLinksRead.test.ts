import { describe, expect, it } from 'vitest'
import { studyLinkPath } from './studyLinksRead'

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
