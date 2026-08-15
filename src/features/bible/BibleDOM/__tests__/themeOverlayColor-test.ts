import { withColorAlpha } from '../themeOverlayColor'

describe('withColorAlpha', () => {
  it.each([
    ['rgb(18,45,66)', 0.5, 'rgba(18, 45, 66, 0.5)'],
    ['rgba(18, 45, 66, 0.25)', 0, 'rgba(18, 45, 66, 0)'],
    ['#FFFAF8', 0.5, 'rgba(255, 250, 248, 0.5)'],
    ['#fff', 0.5, 'rgba(255, 255, 255, 0.5)'],
  ])('applies alpha %s → %s', (color, alpha, expected) => {
    expect(withColorAlpha(color, alpha)).toBe(expected)
  })

  it('keeps an unsupported CSS color usable', () => {
    expect(withColorAlpha('var(--reader-background)', 0.5)).toBe(
      'color-mix(in srgb, var(--reader-background) 50%, transparent)'
    )
  })
})
