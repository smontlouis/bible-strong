import darkColors from '../darkColors'
import { getThemePalette, getThemePalettes, pickStoredThemeColors } from '../themePalette'

describe('theme palettes come from code', () => {
  it('lays the repainted highlight colours over the palette of the theme', () => {
    const palette = getThemePalette('dark', { dark: { color2: '#123456' } })

    expect(palette.canvas).toBe(darkColors.canvas)
    expect(palette.primary).toBe(darkColors.primary)
    expect(palette.color2).toBe('#123456')
    expect(palette.color1).toBe(darkColors.color1)
  })

  it('ignores the structural colours an older store or account still holds', () => {
    const stale = { dark: { canvas: 'rgb(18,45,66)', primary: 'rgb(14,211,185)' } }

    expect(getThemePalette('dark', stale as never).canvas).toBe(darkColors.canvas)
    expect(getThemePalette('dark', stale as never).primary).toBe(darkColors.primary)
  })

  it('keeps only the highlight colours of known themes for the store', () => {
    expect(
      pickStoredThemeColors({
        default: { reverse: '#fff', color1: '#abc', color5: '' },
        night: { reverse: 'rgb(0,50,100)' },
        other: { color1: '#999' },
      })
    ).toEqual({ default: { color1: '#abc' } })
    expect(pickStoredThemeColors(undefined)).toEqual({})
  })

  it('resolves every theme for the Bible document', () => {
    const palettes = getThemePalettes({})

    expect(Object.keys(palettes).sort()).toEqual(
      ['black', 'dark', 'default', 'mauve', 'nature', 'night', 'sepia', 'sunset'].sort()
    )
    expect(palettes.dark.reverse).toBe(darkColors.reverse)
  })
})
