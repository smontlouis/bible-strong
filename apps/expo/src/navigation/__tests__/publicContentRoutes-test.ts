import { isPublicContentPath } from '../publicContentRoutes'

describe('public content route detection', () => {
  it.each([
    '/bible/lsg/john/3/16',
    '/strong/g3056',
    '/strong/entity/Peter%40Matt.4.18',
    '/dictionary/fr/westphal/43/ange',
    '/nave/fr/patience',
    '/commentary/fr/barnes/john/3',
    '/timeline/fr',
    '/timeline/en/birth-of-moses',
  ])('recognizes %s', pathname => {
    expect(isPublicContentPath(pathname)).toBe(true)
  })

  it.each([
    '/',
    '/bible-view',
    '/strong',
    '/strong/dictionary',
    '/dictionnary-detail',
    '/timeline-home',
    '/event',
    '/login',
  ])('keeps %s in the application shell', pathname => {
    expect(isPublicContentPath(pathname)).toBe(false)
  })
})
