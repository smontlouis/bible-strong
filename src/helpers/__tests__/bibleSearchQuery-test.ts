import { buildNearFtsQuery, sanitizeFtsQuery } from '../bibleSearchQuery'

describe('Bible search query', () => {
  it('treats apostrophes and punctuation as token boundaries like FTS5', () => {
    expect(sanitizeFtsQuery("l'amour de Dieu")).toBe('l* amour* de* Dieu*')
    expect(sanitizeFtsQuery('au-dessus de tout')).toBe('au* dessus* de* tout*')
  })

  it('builds the proximity query from the same token boundaries', () => {
    expect(buildNearFtsQuery("l'amour de Dieu")).toBe('NEAR(l amour de Dieu, 5)')
  })

  it('preserves phrases and explicit operators while removing unsafe punctuation', () => {
    expect(sanitizeFtsQuery('"l’amour de Dieu"')).toBe('"l amour de Dieu"')
    expect(sanitizeFtsQuery('amour OR grâce')).toBe('amour OR grâce')
  })
})
