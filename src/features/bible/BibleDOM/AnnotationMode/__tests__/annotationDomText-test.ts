/** @jest-environment jsdom */

import { clampAnnotationWordRange, collectAnnotationTextNodes } from '../annotationDomText'

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
})
