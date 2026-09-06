import { webFontFamily } from '../webFontFamily'

describe('browser font families', () => {
  it('maps native default aliases to a usable browser UI font stack', () => {
    for (const family of [undefined, 'normal', 'System', 'Roboto']) {
      expect(webFontFamily(family)).toContain('system-ui')
      expect(webFontFamily(family)).toMatch(/sans-serif$/)
    }
  })

  it('keeps bundled and saved reading faces with matching fallbacks', () => {
    expect(webFontFamily('Literata Book')).toBe('"Literata Book", Georgia, serif')
    expect(webFontFamily('Baskerville')).toBe('"Baskerville", Georgia, serif')
    expect(webFontFamily('Avenir')).toMatch(/^"Avenir", system-ui/)
    expect(webFontFamily('eina-03-bold')).toMatch(/^"eina-03-bold", system-ui/)
    expect(webFontFamily('FiraCode')).toBe('"FiraCode", ui-monospace, monospace')
  })

  it('does not quote generic families or double-wrap an already resolved stack', () => {
    expect(webFontFamily('monospace')).toBe('monospace')
    const resolved = webFontFamily('Avenir')
    expect(webFontFamily(resolved)).toBe(resolved)
  })
})
