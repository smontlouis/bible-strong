import {
  buildCanonicalVersePresentation,
  getCanonicalPresentationText,
  shouldInsertCanonicalParagraphBreak,
  shouldInsertCanonicalParagraphBreakBeforeVerse,
} from '../canonicalVersePresentation'

describe('canonicalVersePresentation', () => {
  it('does not restart a paragraph that is already active at the beginning of a verse', () => {
    const presentation = buildCanonicalVersePresentation({
      text: 'les cieux.',
      startTags: [{ tag: 'p' }],
      layout: [{ offset: 10, order: 1, type: 'close', tag: 'p' }],
    })

    expect(presentation).toEqual([{ kind: 'text', text: 'les cieux.' }])
  })

  it('represents a paragraph boundary once where the paragraph actually opens', () => {
    const presentation = buildCanonicalVersePresentation({
      text: 'Avant. Après.',
      layout: [
        { offset: 7, order: 0, type: 'open', tag: 'p' },
        { offset: 13, order: 1, type: 'close', tag: 'p' },
      ],
    })

    expect(presentation).toEqual([
      { kind: 'text', text: 'Avant. ' },
      { kind: 'paragraph-start', offset: 7 },
      { kind: 'text', text: 'Après.' },
    ])
  })

  it('keeps mid-verse paragraph boundaries in both text display modes', () => {
    expect(
      shouldInsertCanonicalParagraphBreak({
        offset: 0,
        verse: 1,
        textDisplay: 'inline',
      })
    ).toBe(false)
    expect(
      shouldInsertCanonicalParagraphBreak({
        offset: 0,
        verse: 2,
        textDisplay: 'inline',
      })
    ).toBe(true)
    expect(
      shouldInsertCanonicalParagraphBreak({
        offset: 0,
        verse: 2,
        textDisplay: 'block',
      })
    ).toBe(false)
    expect(
      shouldInsertCanonicalParagraphBreak({
        offset: 7,
        verse: 2,
        textDisplay: 'block',
      })
    ).toBe(true)
  })

  it('places a verse-boundary paragraph break before the whole verse', () => {
    const paragraphOpening = [{ offset: 0, order: 0, type: 'open' as const, tag: 'p' }]

    expect(
      shouldInsertCanonicalParagraphBreakBeforeVerse({
        layout: paragraphOpening,
        verse: 2,
        textDisplay: 'inline',
      })
    ).toBe(true)
    expect(
      shouldInsertCanonicalParagraphBreakBeforeVerse({
        layout: [],
        verse: 2,
        textDisplay: 'inline',
      })
    ).toBe(false)
    expect(
      shouldInsertCanonicalParagraphBreakBeforeVerse({
        layout: paragraphOpening,
        verse: 1,
        textDisplay: 'inline',
      })
    ).toBe(false)
    expect(
      shouldInsertCanonicalParagraphBreakBeforeVerse({
        layout: paragraphOpening,
        verse: 2,
        textDisplay: 'block',
      })
    ).toBe(false)
  })

  it('adds Strong references without changing canonical selectable text or layout', () => {
    const hidden = buildCanonicalVersePresentation({
      text: 'Dieu créa.',
      startTags: [],
      layout: [
        { offset: 0, order: 0, type: 'open', tag: 'small-caps' },
        { offset: 4, order: 1, type: 'close', tag: 'small-caps' },
      ],
    })
    const visible = buildCanonicalVersePresentation({
      text: 'Dieu créa.',
      startTags: [],
      layout: [
        { offset: 0, order: 0, type: 'open', tag: 'small-caps' },
        { offset: 4, order: 1, type: 'close', tag: 'small-caps' },
      ],
      strongSpans: [
        {
          ordinal: 0,
          startOffset: 0,
          length: 4,
          identities: [{ kind: 'strong', code: 'H0430' }],
        },
      ],
    })

    expect(getCanonicalPresentationText(hidden)).toBe('Dieu créa.')
    expect(getCanonicalPresentationText(visible)).toBe('Dieu créa.')
    expect(JSON.stringify(visible)).toContain('"reference":"430"')
    expect(visible[0]).toEqual(expect.objectContaining({ kind: 'element', tag: 'small-caps' }))
  })

  it('interprets red-word ranges as inclusive word indices', () => {
    const presentation = buildCanonicalVersePresentation({
      text: 'Au commencement Jésus parla.',
      redWordRanges: [{ start: 2, end: 2 }],
    })

    expect(presentation).toEqual([
      { kind: 'text', text: 'Au commencement ' },
      {
        kind: 'element',
        tag: 'red-word',
        attributes: undefined,
        children: [{ kind: 'text', text: 'Jésus' }],
      },
      { kind: 'text', text: ' parla.' },
    ])
    expect(getCanonicalPresentationText(presentation)).toBe('Au commencement Jésus parla.')
  })
})
