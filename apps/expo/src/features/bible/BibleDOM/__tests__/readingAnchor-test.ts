import { findReadingAnchor, getReadingAnchorOffset } from '../readingAnchor'

const verse = (number: number, top: number, height: number) => ({
  id: `verset-${number}`,
  getBoundingClientRect: () => ({ top, bottom: top + height, height }) as DOMRect,
})

describe('reading anchor', () => {
  it('finds the verse crossing the reading line and how far into it the line sits', () => {
    expect(
      findReadingAnchor([verse(19, -100, 80), verse(20, 40, 100), verse(21, 140, 60)], 90)
    ).toEqual({ verse: 20, progress: 0.5 })
  })

  it('starts at the top of the first verse below the line', () => {
    expect(findReadingAnchor([verse(1, 100, 80)], 90)).toEqual({ verse: 1, progress: 0 })
  })

  it('finds nothing when every verse is above the line', () => {
    expect(findReadingAnchor([verse(1, -100, 80)], 90)).toBeNull()
  })

  it('brings the same point of the verse back to the line in the new text', () => {
    const verses = [verse(19, 300, 80), verse(20, 380, 200)]
    expect(getReadingAnchorOffset(verses, { verse: 20, progress: 0.5 }, 90)).toBe(390)
  })

  it('falls back on the nearest verse before one the new text does not have', () => {
    const verses = [verse(18, 300, 80), verse(19, 380, 100)]
    expect(getReadingAnchorOffset(verses, { verse: 20, progress: 0 }, 90)).toBe(290)
  })

  it('has nowhere to go when the new text starts after the verse', () => {
    expect(getReadingAnchorOffset([verse(30, 300, 80)], { verse: 20, progress: 0 }, 90)).toBeNull()
  })
})
