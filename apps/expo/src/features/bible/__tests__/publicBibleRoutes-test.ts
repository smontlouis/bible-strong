import { getBook } from '~helpers/bibleBookCatalog'
import { buildPublicBiblePath, parsePublicBibleRoute } from '../publicBibleRoutes'

jest.mock('~helpers/bibleVersions', () => ({
  versions: {
    LSG: { id: 'LSG' },
    NBS: { id: 'NBS' },
    LXX_FR: { id: 'LXX_FR' },
  },
}))

describe('public Bible routes', () => {
  it('parses an OSIS chapter route', () => {
    expect(parsePublicBibleRoute(['lsg', 'john', '3'])).toEqual({
      version: 'LSG',
      presentation: 'text',
      book: getBook(43),
      chapter: 3,
    })
  })

  it.each(['john', 'jean', 'jhn', 'Jean'])('resolves the %s alias to John', alias => {
    const route = parsePublicBibleRoute(['lsg', alias, '3'])
    expect(route?.book).toEqual(getBook(43))
    expect(route && buildPublicBiblePath(route)).toBe('/bible/lsg/john/3')
  })

  it('parses Strong and reverse-interlinear passage routes', () => {
    expect(parsePublicBibleRoute(['lsg', 'strong', 'jean', '3', '16-18'])).toMatchObject({
      version: 'LSG',
      presentation: 'strong',
      book: getBook(43),
      chapter: 3,
      passage: { startVerse: 16, endVerse: 18 },
    })
    expect(parsePublicBibleRoute('lsg/reverse-interlinear/jean/3/16', 'fr')).toMatchObject({
      version: 'LSG',
      presentation: 'reverse-interlinear',
      passage: { startVerse: 16 },
      glossLanguage: 'fr',
    })
  })

  it('normalizes version and book identities when building a route', () => {
    expect(
      buildPublicBiblePath({
        version: 'LXX_FR',
        presentation: 'text',
        book: getBook(22)!,
        chapter: 1,
        passage: { startVerse: 1, endVerse: 4 },
      })
    ).toBe('/bible/lxx-fr/song/1/1-4')
  })

  it('uses the supported deuterocanonical OSIS identities', () => {
    expect(
      buildPublicBiblePath({
        version: 'LSG',
        presentation: 'text',
        book: getBook(67)!,
        chapter: 1,
      })
    ).toBe('/bible/lsg/tob/1')
    expect(parsePublicBibleRoute(['lsg', 'tobie', '1'])?.book).toEqual(getBook(67))
  })

  it('round-trips reverse-interlinear routes with a gloss language', () => {
    const route = {
      version: 'LSG',
      presentation: 'reverse-interlinear' as const,
      book: getBook(43)!,
      chapter: 3,
      passage: { startVerse: 16, endVerse: 18 },
      glossLanguage: 'en' as const,
    }
    const path = buildPublicBiblePath(route)
    const [pathname, search] = path.split('?')
    expect(
      parsePublicBibleRoute(
        pathname.split('/').slice(2),
        new URLSearchParams(search).get('gloss') ?? undefined
      )
    ).toEqual(route)
  })

  it('rejects malformed and unsupported routes', () => {
    expect(parsePublicBibleRoute(['missing', 'jean', '3'])).toBeUndefined()
    expect(parsePublicBibleRoute(['lsg', 'jean', '22'])).toBeUndefined()
    expect(parsePublicBibleRoute(['lsg', 'jean', '3', '18-16'])).toBeUndefined()
    expect(parsePublicBibleRoute(['lsg', 'jean', '3', '1-999999999'])).toBeUndefined()
    expect(parsePublicBibleRoute(['nbs', 'strong', 'jean', '3'])).toBeUndefined()
    expect(parsePublicBibleRoute(['nbs', 'reverse-interlinear', 'jean', '3'])).toBeUndefined()
  })

  it('keeps every generated OSIS book slug unique', () => {
    const paths = Array.from({ length: 77 }, (_, index) => getBook(index + 1))
      .filter(book => book !== undefined)
      .map(book =>
        buildPublicBiblePath({
          version: 'LSG',
          presentation: 'text',
          book,
          chapter: 1,
        })
      )
    expect(new Set(paths).size).toBe(paths.length)
  })
})
