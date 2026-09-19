import {
  buildPublicTimelineEventPath,
  buildPublicTimelineIndexPath,
  parsePublicTimelineRoute,
} from '../publicTimelineRoutes'

describe('public timeline routes', () => {
  it('builds index and event routes', () => {
    expect(buildPublicTimelineIndexPath('fr')).toBe('/timeline/fr')
    expect(buildPublicTimelineEventPath({ language: 'en', slug: 'birth-of-moses' })).toBe(
      '/timeline/en/birth-of-moses'
    )
  })

  it('parses normalized language and event slugs', () => {
    expect(parsePublicTimelineRoute({ language: 'FR' })).toEqual({ language: 'fr' })
    expect(parsePublicTimelineRoute({ language: 'EN', slug: 'Birth-of-Moses' })).toEqual({
      language: 'en',
      slug: 'birth-of-moses',
    })
  })

  it('rejects unsupported languages and malformed slugs', () => {
    expect(parsePublicTimelineRoute({ language: 'de' })).toBeUndefined()
    expect(parsePublicTimelineRoute({ language: 'fr', slug: 'birth of moses' })).toBeUndefined()
  })
})
