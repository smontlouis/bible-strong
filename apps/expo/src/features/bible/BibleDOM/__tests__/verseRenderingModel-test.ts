import {
  createVerseKey,
  getAdjacentFocusVerses,
  getFadePosition,
  getFocusVerseNumbers,
  getParallelVerseModeProps,
  getParallelChapterRows,
  getScrollTargetVerse,
  getTaggedVersesByLastVerse,
  getVersesWithWordAnnotations,
  isVerseDimmedInFocusedContext,
  shouldHighlightOnlyVerseNumber,
  shouldRenderVerseInFocusedContext,
} from '../verseRenderingModel'

const verse = {
  Livre: 1,
  Chapitre: 1,
  Verset: 2,
  Texte: 'Verse text',
}

describe('verseRenderingModel', () => {
  it('shows only the selected passage in previews, including disjoint ranges', () => {
    const selected = [2, 4]
    const visible = [1, 2, 3, 4, 5].filter(verseNumber =>
      shouldRenderVerseInFocusedContext({
        verseNumber,
        isContextFocused: true,
        hasFocusVerses: true,
        isFocused: selected.includes(verseNumber),
        fadePosition: getFadePosition(verseNumber, true, { prev: 1, next: 5 }),
        hideAdjacentVerses: true,
      })
    )
    expect(visible).toEqual([2, 4])
    expect(
      shouldRenderVerseInFocusedContext({
        verseNumber: 1,
        isContextFocused: false,
        hasFocusVerses: true,
        isFocused: false,
        hideAdjacentVerses: true,
      })
    ).toBe(true)
  })
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

  it('uses the focused verse as scroll target in focused context', () => {
    expect(
      getScrollTargetVerse({
        verseToScroll: 1,
        contextDisplayMode: 'focused',
        focusVerses: ['28'],
      })
    ).toBe(28)
    expect(
      getScrollTargetVerse({
        verseToScroll: 12,
        contextDisplayMode: 'fullChapter',
        focusVerses: ['28'],
      })
    ).toBe(12)
  })

  it('dims non-focused verse overlays in focused context', () => {
    expect(
      isVerseDimmedInFocusedContext({
        verseKey: '1-16-12',
        isContextFocused: true,
        focusVerseNumbers: [11],
      })
    ).toBe(true)
    expect(
      isVerseDimmedInFocusedContext({
        verseKey: '1-16-11',
        isContextFocused: true,
        focusVerseNumbers: [11],
      })
    ).toBe(false)
    expect(
      isVerseDimmedInFocusedContext({
        verseKey: '1-16-12',
        isContextFocused: false,
        focusVerseNumbers: [11],
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

  it('limits verse highlights to the verse number in Strong display mode', () => {
    expect(
      shouldHighlightOnlyVerseNumber({
        hasWordAnnotations: false,
        isStrongModeVerse: true,
      })
    ).toBe(true)
    expect(
      shouldHighlightOnlyVerseNumber({
        hasWordAnnotations: false,
        isStrongModeVerse: false,
      })
    ).toBe(false)
    expect(
      shouldHighlightOnlyVerseNumber({
        hasWordAnnotations: true,
        isStrongModeVerse: false,
      })
    ).toBe(true)
  })

  const chapter = (numbers: number[], prefix: string) =>
    numbers.map(Verset => ({ Livre: 44, Chapitre: 8, Verset, Texte: `${prefix} ${Verset}` }))

  const rowNumbers = (rows: ReturnType<typeof getParallelChapterRows>) =>
    rows.map(row => row.rows.map(r => (r.isMissing ? null : Number(r.verse.Verset))))

  it('aligns parallel rows by verse number when a parallel version omits a verse', () => {
    const rows = getParallelChapterRows(
      chapter([36, 37, 38, 39, 40], 'NEG79'),
      [{ id: 'ESV', verses: chapter([36, 38, 39, 40], 'ESV') }],
      'NEG79'
    )

    expect(rows.map(row => row.verse.Verset)).toEqual([36, 37, 38, 39, 40])
    expect(rowNumbers(rows)).toEqual([
      [36, 36],
      [37, null],
      [38, 38],
      [39, 39],
      [40, 40],
    ])
    expect(rows[1].rows[1]).toEqual({
      version: 'ESV',
      verse: { Livre: 44, Chapitre: 8, Verset: 37, Texte: '' },
      error: undefined,
      interlinearMode: undefined,
      isMissing: true,
    })
  })

  it('keeps a row for a verse the primary version omits', () => {
    const rows = getParallelChapterRows(
      chapter([36, 38, 39, 40], 'ESV'),
      [{ id: 'NEG79', verses: chapter([36, 37, 38, 39, 40], 'NEG79') }],
      'ESV'
    )

    expect(rows.map(row => row.verse)).toContainEqual({
      Livre: 44,
      Chapitre: 8,
      Verset: 37,
      Texte: '',
    })
    expect(rowNumbers(rows)).toEqual([
      [36, 36],
      [null, 37],
      [38, 38],
      [39, 39],
      [40, 40],
    ])
    expect(rows[4].rows[1].verse.Texte).toBe('NEG79 40')
  })

  it('merges omissions from several versions in verse order', () => {
    const rows = getParallelChapterRows(
      chapter([1, 2, 4], 'A'),
      [
        { id: 'B', verses: chapter([1, 3, 4], 'B') },
        { id: 'C', verses: chapter([2, 3, 4, 5], 'C') },
      ],
      'A'
    )

    expect(rowNumbers(rows)).toEqual([
      [1, 1, null],
      [2, null, 2],
      [null, 3, 3],
      [4, 4, 4],
      [null, null, 5],
    ])
  })

  it('keeps the error of a parallel version that failed to load', () => {
    const rows = getParallelChapterRows(
      [verse],
      [{ id: 'KJV', verses: [], error: 'NOT_FOUND' as never }],
      'LSG'
    )

    expect(rows).toEqual([
      {
        verse,
        rows: [
          { version: 'LSG', verse },
          {
            version: 'KJV',
            verse: { Livre: 1, Chapitre: 1, Verset: 2, Texte: '' },
            error: 'NOT_FOUND',
          },
        ],
      },
    ])
  })

  it('preserves the resolved presentation mode of each parallel row', () => {
    const rows = getParallelChapterRows(
      [verse],
      [
        {
          id: 'BHG',
          verses: [verse],
          interlinearMode: 'strong',
        },
      ],
      'LSG'
    )

    expect(rows[0].rows[1]).toEqual({
      version: 'BHG',
      verse,
      error: undefined,
      interlinearMode: 'strong',
    })
  })

  it('resolves the primary presentation in the shared parallel row model', () => {
    const rows = getParallelChapterRows([verse], [], 'BHG', 'interlinear')

    expect(rows[0].rows[0]).toEqual({
      version: 'BHG',
      verse,
      interlinearMode: 'interlinear',
    })
  })

  it.each(['interlinear', 'strong', 'transliteration'] as const)(
    'keeps the primary BHG %s mode in parallel display',
    interlinearMode => {
      expect(
        getParallelVerseModeProps({
          version: 'BHG',
          interlinearMode,
        })
      ).toEqual({
        interlinearMode,
      })
    }
  )

  it('does not apply the primary interlinear mode to an incompatible parallel Bible', () => {
    expect(
      getParallelVerseModeProps({
        version: 'BDS',
        interlinearMode: 'strong',
      })
    ).toEqual({
      interlinearMode: undefined,
    })
  })

  it('applies the primary interlinear mode to a compatible parallel Bible', () => {
    expect(
      getParallelVerseModeProps({
        version: 'BHG',
        interlinearMode: 'strong',
      })
    ).toEqual({
      interlinearMode: 'strong',
    })
  })
})
