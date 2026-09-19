import { describe, expect, it } from '@jest/globals'

import { buildPublicDictionaryPath, parsePublicDictionaryRoute } from '../publicDictionaryRoutes'

describe('public dictionary routes', () => {
  it('builds the canonical ID-and-slug route', () => {
    expect(
      buildPublicDictionaryPath({
        language: 'fr',
        work: 'westphal',
        entryId: 43,
        word: 'Saint-Esprit',
      })
    ).toBe('/dictionary/fr/westphal/43/saint-esprit')
  })

  it('parses and normalizes valid route segments', () => {
    expect(
      parsePublicDictionaryRoute({ language: 'EN', work: 'Smith', entryId: '7', slug: 'Aaron' })
    ).toEqual({ language: 'en', work: 'smith', entryId: 7, slug: 'aaron' })
  })

  it('rejects unstable or malformed identities', () => {
    expect(
      parsePublicDictionaryRoute({
        language: 'fr',
        work: 'westphal',
        entryId: '43',
        slug: 'saint esprit',
      })
    ).toBe(undefined)
    expect(
      parsePublicDictionaryRoute({ language: 'fr', work: 'westphal', entryId: '0', slug: 'ange' })
    ).toBe(undefined)
    expect(
      parsePublicDictionaryRoute({ language: 'de', work: 'westphal', entryId: '43', slug: 'ange' })
    ).toBe(undefined)
  })
})
