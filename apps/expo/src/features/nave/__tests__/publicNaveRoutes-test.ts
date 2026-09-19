import { buildPublicNavePath, parsePublicNaveRoute } from '../publicNaveRoutes'

describe('public Nave routes', () => {
  it('round-trips language and normalized topic identity', () => {
    const route = { language: 'fr' as const, topic: 'bonté' }
    expect(buildPublicNavePath(route)).toBe('/nave/fr/bont%C3%A9')
    expect(parsePublicNaveRoute('fr', 'bonté')).toEqual(route)
  })

  it('rejects unsupported languages and empty topics', () => {
    expect(parsePublicNaveRoute('de', 'liebe')).toBeUndefined()
    expect(parsePublicNaveRoute('fr', '')).toBeUndefined()
  })
})
