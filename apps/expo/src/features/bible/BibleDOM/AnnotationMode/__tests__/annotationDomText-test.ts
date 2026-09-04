/** @jest-environment jsdom */

import {
  clampAnnotationWordRange,
  collectAnnotationTextNodes,
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
