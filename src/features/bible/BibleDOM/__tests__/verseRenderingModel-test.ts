import {
  createVerseKey,
  getAdjacentFocusVerses,
  getFadePosition,
  getFocusVerseNumbers,
  getParallelVerseRows,
  getTaggedVersesByLastVerse,
  getVersesWithWordAnnotations,
  shouldRenderVerseInFocusedContext,
} from '../verseRenderingModel'

const verse = {
  Livre: 1,
  Chapitre: 1,
  Verset: 2,
  Texte: 'Verse text',
}

describe('verseRenderingModel', () => {
  it('creates canonical Verse keys from Bible row identity', () => {
    expect(createVerseKey(verse)).toBe('1-1-2')
  })

  it('computes focused verse numbers and adjacent fade verses', () => {
    const focusNumbers = getFocusVerseNumbers(['2', 3])

    expect(focusNumbers).toEqual([2, 3])
    expect(getAdjacentFocusVerses(focusNumbers)).toEqual({ prev: 1, next: 4 })
    expect(getFadePosition(1, true, { prev: 1, next: 4 })).toBe('top')
    expect(getFadePosition(4, true, { prev: 1, next: 4 })).toBe('bottom')
    expect(getFadePosition(2, true, { prev: 1, next: 4 })).toBeUndefined()
  })

  it('filters focused context to focused and adjacent fade verses', () => {
    expect(
      shouldRenderVerseInFocusedContext({
        verseNumber: 2,
        isContextFocused: true,
        hasFocusVerses: true,
        isFocused: true,
      })
    ).toBe(true)
    expect(
      shouldRenderVerseInFocusedContext({
        verseNumber: 1,
        isContextFocused: true,
        hasFocusVerses: true,
        isFocused: false,
        fadePosition: 'top',
      })
    ).toBe(true)
    expect(
      shouldRenderVerseInFocusedContext({
        verseNumber: 5,
        isContextFocused: true,
        hasFocusVerses: true,
        isFocused: false,
      })
    ).toBe(false)
  })

  it('indexes tagged verses by their last Verse key', () => {
    const tag = { lastVerse: '1-1-2', tags: [], date: 1, color: 'red', verseIds: ['1-1-2'] }

    expect(getTaggedVersesByLastVerse([tag]).get('1-1-2')).toBe(tag)
  })

  it('indexes word annotations for the active Bible version', () => {
    const annotations = {
      a: {
        id: 'a',
        version: 'LSG',
        color: 'red',
        type: 'background' as const,
        date: 1,
        createdAt: 1,
        updatedAt: 1,
        ranges: [{ verseKey: '1-1-2', startWordIndex: 1, endWordIndex: 2, text: 'text' }],
      },
      b: {
        id: 'b',
        version: 'KJV',
        color: 'blue',
        type: 'background' as const,
        date: 1,
        createdAt: 1,
        updatedAt: 1,
        ranges: [{ verseKey: '1-1-3', startWordIndex: 1, endWordIndex: 2, text: 'text' }],
      },
    }

    expect([...getVersesWithWordAnnotations(annotations, 'LSG')]).toEqual(['1-1-2'])
  })

  it('creates placeholder parallel rows for missing verses', () => {
    const rows = getParallelVerseRows(
      0,
      [
        {
          id: 'KJV',
          verses: [],
        },
      ],
      verse,
      'LSG'
    )

    expect(rows).toEqual([
      { version: 'LSG', verse },
      { version: 'KJV', verse: { ...verse, Texte: '' }, error: undefined },
    ])
  })
})
