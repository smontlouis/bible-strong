import { buildNearFtsQuery, sanitizeFtsQuery } from '../bibleSearchQuery'

describe('Bible search query', () => {
  it('normalizes natural terms and applies prefixes automatically', () => {
    expect(sanitizeFtsQuery("l'amour de Dieu")).toBe('l* amour* de* dieu*')
    expect(sanitizeFtsQuery('au-dessus de tout')).toBe('au* dessus* de* tout*')
    expect(sanitizeFtsQuery('ÉTERNEL')).toBe('eternel*')
  })

  it('builds the proximity query from the same token boundaries', () => {
    expect(buildNearFtsQuery("l'amour de Dieu")).toBe('NEAR(l amour de dieu, 5)')
  })

  it('supports an entirely quoted phrase without exposing FTS operators', () => {
    expect(sanitizeFtsQuery('"l’amour de Dieu"')).toBe('"l amour de dieu"')
    expect(buildNearFtsQuery('"l’amour de Dieu"')).toBeNull()
  })

  it('treats expert operators and asterisks as ordinary input', () => {
    expect(sanitizeFtsQuery('amour OR grâce')).toBe('amour* or* grace*')
    expect(sanitizeFtsQuery('condam*')).toBe('condam*')
  })
})
