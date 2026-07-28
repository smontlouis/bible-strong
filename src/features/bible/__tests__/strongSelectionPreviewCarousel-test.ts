import { getStrongSelectionPreviewIndex } from '../strongSelectionPreviewCarousel'

describe('getStrongSelectionPreviewIndex', () => {
  it('selects the next chip as soon as half of its card is reached', () => {
    expect(getStrongSelectionPreviewIndex(149, 300, 3)).toBe(0)
    expect(getStrongSelectionPreviewIndex(150, 300, 3)).toBe(1)
    expect(getStrongSelectionPreviewIndex(449, 300, 3)).toBe(1)
    expect(getStrongSelectionPreviewIndex(450, 300, 3)).toBe(2)
  })

  it('keeps the selected index inside the available previews', () => {
    expect(getStrongSelectionPreviewIndex(-100, 300, 3)).toBe(0)
    expect(getStrongSelectionPreviewIndex(1_000, 300, 3)).toBe(2)
  })
})
