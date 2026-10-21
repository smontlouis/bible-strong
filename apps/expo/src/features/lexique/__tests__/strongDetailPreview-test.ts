import {
  getStrongEditorialPreviewHtml,
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

  it('keeps the start of a long editorial text, cut after a word, and a short one whole', () => {
    const html = '<p>Un <b>mot</b> commun, partagé entre tous.</p><p>Suite de l’article.</p>'

    expect(getStrongEditorialPreviewHtml(html, 1000)).toBe(html)
    expect(getStrongEditorialPreviewHtml(html, 5)).toBe('<p>Un <b>mot</b>')
    expect(getStrongEditorialPreviewHtml(html, 12)).toBe('<p>Un <b>mot</b> commun,')
  })

  it('reports hidden items only when the total exceeds the displayed count', () => {
    expect(hasHiddenStrongPreviewItems(4, 4)).toBe(false)
    expect(hasHiddenStrongPreviewItems(5, 4)).toBe(true)
    expect(hasHiddenStrongPreviewItems(3, 3)).toBe(false)
  })
})
