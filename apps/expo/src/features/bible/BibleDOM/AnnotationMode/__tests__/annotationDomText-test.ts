/** @jest-environment jsdom */

import { getWordIndexFromCharOffset, tokenizeVerseText } from '~helpers/wordTokenizer'
import {
  clampAnnotationWordRange,
  collectAnnotationTextNodes,
  createAnnotationTextRanges,
  getAnnotationCharOffset,
  getAnnotationInsertionPoint,
} from '../annotationDomText'

describe('collectAnnotationTextNodes', () => {
  it('excludes visible Strong references from canonical annotation offsets', () => {
    const verse = document.createElement('span')
    verse.innerHTML =
      'Au <span data-ignore-verse-touch="true">430</span>commencement était la Parole.'
    document.body.appendChild(verse)

    const result = collectAnnotationTextNodes(verse)

    expect(result.fullText).toBe('Au commencement était la Parole.')
    expect(result.textNodes).toHaveLength(2)
    expect(result.textNodes[1]).toMatchObject({
      startOffset: 3,
      endOffset: 32,
    })
  })

  it('keeps a stale out-of-bounds annotation visible without mutating its saved range', () => {
    expect(clampAnnotationWordRange(18, 20, 5)).toEqual({ start: 4, end: 4 })
    expect(clampAnnotationWordRange(2, 20, 5)).toEqual({ start: 2, end: 4 })
  })

  it('places inline annotation items immediately after the selected word', () => {
    document.body.innerHTML = '<span id="verse">Au commencement était la Parole.</span>'
    const verse = document.getElementById('verse')!
    const insertionPoint = getAnnotationInsertionPoint(verse, 1)

    expect(insertionPoint).toBeDefined()
    const marker = document.createElement('span')
    marker.dataset.ignoreVerseTouch = 'true'
    const range = document.createRange()
    range.setStart(insertionPoint!.node, insertionPoint!.offset)
    range.collapse(true)
    range.insertNode(marker)

    expect(verse.innerHTML).toBe(
      'Au commencement<span data-ignore-verse-touch="true"></span> était la Parole.'
    )
  })
})

describe('getAnnotationCharOffset', () => {
  // Genèse 1:9, with a tag item placed after « rassemblent »: \uE000 is the icon glyph.
  const verseText =
    'Dieu dit : Que les eaux qui sont au-dessous du ciel se rassemblent en un seul lieu, et que le sec paraisse. Et cela fut ainsi.'
  const renderVerse = () => {
    document.body.innerHTML =
      '<span id="verse">Dieu dit : Que les eaux qui sont au-dessous du ciel se rassemblent' +
      '<span data-ignore-verse-touch="true"><span>\uE000</span><span>A étudier</span></span>' +
      ' en un seul lieu, et que le sec paraisse. Et cela fut ainsi.</span>'
    return document.getElementById('verse')!
  }
  const wordAt = (text: string, offset: number) => {
    const tokens = tokenizeVerseText(text)
    const index = getWordIndexFromCharOffset(tokens, offset)
    return tokens.find(token => token.index === index)?.word
  }

  it('finds the word clicked after an inline item', () => {
    const verse = renderVerse()
    const textAfterItem = verse.lastChild as Text

    const offset = getAnnotationCharOffset(
      verse,
      textAfterItem,
      textAfterItem.data.indexOf('paraisse') + 2
    )

    expect(wordAt(verseText, offset)).toBe('paraisse.')
  })

  it('finds the word clicked after a visible Strong reference', () => {
    document.body.innerHTML =
      '<span id="verse">Au <span data-ignore-verse-touch="true">H430</span>commencement était la Parole.</span>'
    const verse = document.getElementById('verse')!
    const textAfterReference = verse.lastChild as Text

    const offset = getAnnotationCharOffset(
      verse,
      textAfterReference,
      textAfterReference.data.indexOf('était')
    )

    expect(wordAt('Au commencement était la Parole.', offset)).toBe('était')
  })

  it('places a caret inside an inline item where the item was inserted', () => {
    const verse = renderVerse()
    const itemText = verse.querySelector('[data-ignore-verse-touch] span:last-child')!.firstChild!

    expect(getAnnotationCharOffset(verse, itemText, 3)).toBe(
      verseText.indexOf('rassemblent') + 'rassemblent'.length
    )
    expect(getAnnotationCharOffset(verse, verse, 2)).toBe(
      verseText.indexOf('rassemblent') + 'rassemblent'.length
    )
  })

  it('maps every word back to the offset its highlight starts at', () => {
    const verse = renderVerse()
    const { textNodes } = collectAnnotationTextNodes(verse)

    for (const token of tokenizeVerseText(verseText).filter(token => !token.isWhitespace)) {
      const [range] = createAnnotationTextRanges(textNodes, token.charStart, token.charEnd)
      expect(getAnnotationCharOffset(verse, range.startContainer, range.startOffset)).toBe(
        token.charStart
      )
    }
  })
})
