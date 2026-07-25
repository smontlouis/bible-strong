import { resolveBoxBackgroundColor } from '../boxColor'

const colors = {
  primary: 'rgb(89,131,240)',
  reverse: 'rgb(255,255,255)',
}

describe('resolveBoxBackgroundColor', () => {
  it('applies a final alpha to a theme color token', () => {
    expect(resolveBoxBackgroundColor({ bg: 'primary', bgOpacity: '020', colors })).toBe(
      'rgba(89, 131, 240, 0.2)'
    )
  })

  it('applies a final alpha to a direct color', () => {
    expect(
      resolveBoxBackgroundColor({
        backgroundColor: '#ff0000',
        bgOpacity: '030',
        colors,
      })
    ).toBe('rgba(255, 0, 0, 0.3)')
  })

  it('replaces an existing alpha instead of multiplying it', () => {
    expect(
      resolveBoxBackgroundColor({
        bg: 'rgba(10, 20, 30, 0.4)',
        bgOpacity: '050',
        colors,
      })
    ).toBe('rgba(10, 20, 30, 0.5)')
  })

  it('preserves the background shorthand across the fixed opacity scale', () => {
    expect(resolveBoxBackgroundColor({ background: true, bgOpacity: '005', colors })).toBe(
      'rgba(255, 255, 255, 0.05)'
    )
    expect(resolveBoxBackgroundColor({ background: true, bgOpacity: '050', colors })).toBe(
      'rgba(255, 255, 255, 0.5)'
    )
  })

  it('safely preserves unsupported colors', () => {
    expect(
      resolveBoxBackgroundColor({
        bg: 'platformSemanticColor',
        bgOpacity: '010',
        colors,
      })
    ).toBe('platformSemanticColor')
  })
})
