import {
  hasHiddenStrongPreviewItems,
  isStrongEditorialPreviewOverflowing,
} from '../strongDetailPreview'

describe('Strong detail previews', () => {
  it('only reports editorial overflow when text exceeds the rendered preview', () => {
    expect(
      isStrongEditorialPreviewOverflowing('Une définition courte.', ['Une définition courte.'], 5)
    ).toBe(false)
    expect(
      isStrongEditorialPreviewOverflowing(
        'Une définition répartie sur deux lignes.',
        ['Une définition répartie', 'sur deux lignes.'],
        5
      )
    ).toBe(false)
    expect(
      isStrongEditorialPreviewOverflowing(
        'Une définition beaucoup plus longue que son aperçu.',
        ['Une définition beaucoup…'],
        5
      )
    ).toBe(true)
  })

  it('reports hidden items only when the total exceeds the displayed count', () => {
    expect(hasHiddenStrongPreviewItems(4, 4)).toBe(false)
    expect(hasHiddenStrongPreviewItems(5, 4)).toBe(true)
    expect(hasHiddenStrongPreviewItems(3, 3)).toBe(false)
  })
})
