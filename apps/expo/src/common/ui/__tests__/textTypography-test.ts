import { Platform, StyleSheet } from 'react-native'
import { resolveTextTypography } from '../textTypography'

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
  StyleSheet: jest.requireActual('react-native-web/dist/cjs/exports/StyleSheet'),
}))

beforeEach(() => {
  Object.assign(Platform, { OS: 'web' })
})
it('sets the interface font without depending on a DOM ancestor', () => {
  expect(StyleSheet.flatten(resolveTextTypography('normal'))?.fontFamily).toContain('system-ui')
})
it('normalizes an explicit native alias without losing local size or weight', () => {
  expect(
    StyleSheet.flatten(
      resolveTextTypography('Avenir', [
        { fontSize: 14 },
        { fontFamily: 'System', fontWeight: 'bold' },
      ])
    )
  ).toMatchObject({
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: expect.stringContaining('system-ui'),
  })
})
it('preserves a selected reading face and explicit override precedence', () => {
  expect(
    StyleSheet.flatten(
      resolveTextTypography('normal', [{ fontFamily: 'Avenir' }, { fontFamily: 'Literata Book' }])
    )?.fontFamily
  ).toBe('"Literata Book", Georgia, serif')
})
it('sets the interface face on native under any face the style names', () => {
  Object.assign(Platform, { OS: 'ios' })
  const style = { fontFamily: 'System', fontSize: 20 }
  expect(resolveTextTypography('Pulp Display', style)).toEqual([
    { fontFamily: 'Pulp Display' },
    style,
  ])
  expect(StyleSheet.flatten(resolveTextTypography('Pulp Display', { fontSize: 20 }))).toEqual({
    fontFamily: 'Pulp Display',
    fontSize: 20,
  })
})
it('lets a nested text inherit its parent face', () => {
  const style = { fontSize: 20 }
  expect(resolveTextTypography(undefined, style)).toBe(style)
  Object.assign(Platform, { OS: 'ios' })
  expect(resolveTextTypography(undefined, style)).toBe(style)
})
