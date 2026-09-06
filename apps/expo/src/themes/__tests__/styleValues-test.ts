import colors from '../colors'
import { colorWithOpacity, resolveFontFamily, resolveThemeColor } from '../styleValues'

jest.mock('react-native', () => ({ Platform: { OS: 'web' } }))

it('resolves palette tokens and preserves custom colors', () => {
  expect(resolveThemeColor({ colors }, 'primary')).toBe(colors.primary)
  expect(resolveThemeColor({ colors }, '#ff0000')).toBe('#ff0000')
  expect(resolveThemeColor({ colors }, undefined)).toBeUndefined()
})

it('applies a final alpha rather than multiplying an existing alpha', () => {
  expect(colorWithOpacity(resolveThemeColor({ colors }, 'primary'), 0.2)).toBe(
    'rgba(89, 131, 240, 0.2)'
  )
  expect(colorWithOpacity('#ff0000', 0.3)).toBe('rgba(255, 0, 0, 0.3)')
  expect(colorWithOpacity('rgba(10, 20, 30, 0.4)', 0.5)).toBe('rgba(10, 20, 30, 0.5)')
  expect(colorWithOpacity(colors.reverse, 0.05)).toBe('rgba(255, 255, 255, 0.05)')
})

it('keeps transparent, absent, and platform-specific colors intact', () => {
  expect(colorWithOpacity('transparent', 0.5)).toBe('transparent')
  expect(colorWithOpacity(undefined, 0.5)).toBeUndefined()
  expect(colorWithOpacity('#ff0000')).toBe('#ff0000')
  expect(colorWithOpacity('platformSemanticColor', 0.1)).toBe('platformSemanticColor')
})

it('preserves web font fallbacks without setting a font when none is requested', () => {
  expect(resolveFontFamily(undefined)).toBeUndefined()
  expect(resolveFontFamily('System')).toContain('system-ui')
  expect(resolveFontFamily('eina-03-bold')).toContain('eina-03-bold')
})
