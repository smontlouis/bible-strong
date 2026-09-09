import {
  getReferenceSearchItems,
  getReferenceSearchItemsFromSegments,
} from '~features/search/shared/searchItems'
import {
  parseBibleReferenceInput,
  parseBibleReferenceSegments,
  parseInlineBibleReferences,
  isExactBibleReferenceInput,
} from '../bcvParser'

let mockLanguage: 'fr' | 'en' = 'fr'
jest.mock('../../../i18n', () => ({
  __esModule: true,
  getLanguage: () => mockLanguage,
  default: { t: (key: string) => key },
}))

beforeEach(() => {
  mockLanguage = 'fr'
})

describe('reference parsing follows the current language without reloading modules', () => {
  it('switches from French to English and back using the same imported functions', () => {
    expect(parseBibleReferenceSegments('Ésaïe 2:3-5')).toEqual([
      { book: 23, chapter: 2, startVerse: 3, endVerse: 5, isWholeChapter: false },
    ])
    mockLanguage = 'en'
    expect(parseBibleReferenceSegments('Isaiah 2:3-5')).toEqual([
      { book: 23, chapter: 2, startVerse: 3, endVerse: 5, isWholeChapter: false },
    ])
    expect(isExactBibleReferenceInput('Isaiah 2:3-5')).toBe(true)
    expect(parseInlineBibleReferences('Read Isaiah 2:3')[0].target.book).toBe(23)
    mockLanguage = 'fr'
    expect(isExactBibleReferenceInput('Ésaïe 2:3-5')).toBe(true)
  })

  it('respects the explicit content language independently of the interface', () => {
    expect(parseBibleReferenceSegments('Isaiah 2', 'en')[0]).toMatchObject({
      book: 23,
      chapter: 2,
      startVerse: 1,
      endVerse: 22,
      isWholeChapter: true,
    })
    mockLanguage = 'en'
    expect(parseInlineBibleReferences('Lisez Ésaïe 2:3', 'fr')[0].target.book).toBe(23)
    expect(parseBibleReferenceSegments('Ésaïe 2:3', 'fr')[0].startVerse).toBe(3)
  })

  it.each([
    ['fr', 'Genèse 1'],
    ['en', 'Genesis 1'],
  ] as const)('keeps all chapter verses in %s', (language, query) => {
    mockLanguage = language
    expect(parseBibleReferenceInput(query)).toMatchObject({
      isExact: true,
      segments: [{ book: 1, chapter: 1, startVerse: 1, endVerse: 31, isWholeChapter: true }],
    })
  })

  it('expands a range spanning chapters and keeps partial boundaries', () => {
    expect(parseBibleReferenceSegments('Genesis 1:30-2:3', 'en')).toEqual([
      { book: 1, chapter: 1, startVerse: 30, endVerse: 31, isWholeChapter: false },
      { book: 1, chapter: 2, startVerse: 1, endVerse: 3, isWholeChapter: false },
    ])
    expect(
      parseBibleReferenceSegments('Genèse 1-2', 'fr').map(segment => segment.endVerse)
    ).toEqual([31, 25])
  })

  it('preserves disjoint verse sequences and distinguishes prose from direct input', () => {
    expect(
      parseBibleReferenceInput('Jean 3:16,18', 'fr').segments.map(segment => [
        segment.startVerse,
        segment.endVerse,
      ])
    ).toEqual([
      [16, 16],
      [18, 18],
    ])
    expect(parseBibleReferenceInput('Lire Jean 3:16', 'fr')).toMatchObject({
      isExact: false,
      segments: [{ book: 43, chapter: 3, startVerse: 16, endVerse: 16 }],
    })
  })

  it('gives Search and the command palette identical targets after language changes', () => {
    for (const [language, query] of [
      ['fr', 'Ésaïe 2:3-5'],
      ['en', 'Isaiah 2'],
      ['fr', 'Genèse 1:30-2:3'],
    ] as const) {
      mockLanguage = language
      const input = parseBibleReferenceInput(query, language)
      expect(input.isExact).toBe(true)
      const paletteItems = getReferenceSearchItemsFromSegments(input.segments)
      const searchItems = getReferenceSearchItems(query)
      expect(searchItems).toEqual(paletteItems)
      expect(searchItems.length).toBeGreaterThan(0)
    }
  })

  it('rejects invalid and unsupported references without throwing', () => {
    expect(parseBibleReferenceInput('Jean 999:999', 'fr').isExact).toBe(false)
    expect(parseBibleReferenceSegments('inconnu', 'fr')).toEqual([])
  })
})
