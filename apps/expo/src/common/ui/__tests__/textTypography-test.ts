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
it('does not alter native styles', () => {
  Object.assign(Platform, { OS: 'ios' })
  const style = { fontFamily: 'System', fontSize: 20 }
  expect(resolveTextTypography('normal', style)).toBe(style)
})
