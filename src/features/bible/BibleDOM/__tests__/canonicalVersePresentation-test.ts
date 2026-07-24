import {
  buildCanonicalVersePresentation,
  getCanonicalPresentationText,
  shouldInsertCanonicalParagraphBreak,
  shouldInsertCanonicalBlockBreakBeforeVerse,
} from '../canonicalVersePresentation'

describe('canonicalVersePresentation', () => {
  it('does not restart a paragraph that is already active at the beginning of a verse', () => {
    const presentation = buildCanonicalVersePresentation({
      text: 'les cieux.',
      startTags: [{ tag: 'p' }],
      layout: [{ offset: 10, order: 1, type: 'close', tag: 'p' }],
    })

    expect(presentation).toEqual([
      {
        kind: 'element',
        tag: 'p',
        attributes: undefined,
        children: [{ kind: 'text', text: 'les cieux.' }],
      },
    ])
    expect(JSON.stringify(presentation)).not.toContain('"kind":"paragraph-start"')
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
      {
        kind: 'element',
        tag: 'p',
        attributes: undefined,
        children: [{ kind: 'text', text: 'Après.' }],
      },
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
      shouldInsertCanonicalBlockBreakBeforeVerse({
        layout: paragraphOpening,
        verse: 2,
        textDisplay: 'inline',
      })
    ).toBe(true)
    expect(
      shouldInsertCanonicalBlockBreakBeforeVerse({
        layout: [],
        verse: 2,
        textDisplay: 'inline',
      })
    ).toBe(false)
    expect(
      shouldInsertCanonicalBlockBreakBeforeVerse({
        layout: paragraphOpening,
        verse: 1,
        textDisplay: 'inline',
      })
    ).toBe(false)
    expect(
      shouldInsertCanonicalBlockBreakBeforeVerse({
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

  it('inserts V3 notes at their canonical text offset without changing selectable text', () => {
    const presentation = buildCanonicalVersePresentation({
      text: 'La terre était vide.',
      notes: [
        {
          offset: 19,
          order: 5,
          kind: 'note',
          markup: '<note n="a">le vide<i>.</i></note>',
        },
      ],
    })

    expect(presentation).toEqual([
      { kind: 'text', text: 'La terre était vide' },
      {
        kind: 'note-reference',
        note: {
          offset: 19,
          order: 5,
          kind: 'note',
          markup: '<note n="a">le vide<i>.</i></note>',
        },
      },
      { kind: 'text', text: '.' },
    ])
    expect(getCanonicalPresentationText(presentation)).toBe('La terre était vide.')
  })

  it('represents each poetic line boundary without losing cross-verse line groups', () => {
    const presentation = buildCanonicalVersePresentation({
      text: 'Première ligne.Deuxième ligne.',
      startTags: [{ tag: 'lg' }],
      layout: [
        { offset: 0, order: 0, type: 'open', tag: 'l' },
        { offset: 15, order: 1, type: 'close', tag: 'l' },
        { offset: 15, order: 2, type: 'open', tag: 'l' },
        { offset: 30, order: 3, type: 'close', tag: 'l' },
        { offset: 30, order: 4, type: 'close', tag: 'lg' },
      ],
    })

    expect(presentation).toEqual([
      {
        kind: 'element',
        tag: 'lg',
        attributes: undefined,
        children: [
          { kind: 'line-start', offset: 0 },
          {
            kind: 'element',
            tag: 'l',
            attributes: undefined,
            children: [{ kind: 'text', text: 'Première ligne.' }],
          },
          { kind: 'line-start', offset: 15 },
          {
            kind: 'element',
            tag: 'l',
            attributes: undefined,
            children: [{ kind: 'text', text: 'Deuxième ligne.' }],
          },
        ],
      },
    ])
    expect(getCanonicalPresentationText(presentation)).toBe('Première ligne.Deuxième ligne.')
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

  it('preserves canonical V4 red tags as presentation elements', () => {
    const presentation = buildCanonicalVersePresentation({
      text: 'Jesus said',
      layout: [
        { offset: 0, order: 0, type: 'open', tag: 'red' },
        { offset: 10, order: 1, type: 'close', tag: 'red' },
      ],
    })

    expect(presentation).toEqual([
      {
        kind: 'element',
        tag: 'red',
        attributes: undefined,
        children: [{ kind: 'text', text: 'Jesus said' }],
      },
    ])
    expect(getCanonicalPresentationText(presentation)).toBe('Jesus said')
  })

  it('treats V4 list items as block starts without altering their text', () => {
    const presentation = buildCanonicalVersePresentation({
      text: 'First item',
      layout: [
        { offset: 0, order: 0, type: 'open', tag: 'item', attributes: { type: 'x-indent-1' } },
        { offset: 10, order: 1, type: 'close', tag: 'item' },
      ],
    })

    expect(presentation).toEqual([
      { kind: 'line-start', offset: 0 },
      {
        kind: 'element',
        tag: 'item',
        attributes: { type: 'x-indent-1' },
        children: [{ kind: 'text', text: 'First item' }],
      },
    ])
    expect(getCanonicalPresentationText(presentation)).toBe('First item')
  })
})
