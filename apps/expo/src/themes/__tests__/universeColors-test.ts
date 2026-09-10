import colors from '../colors'
import darkColors from '../darkColors'
import { getUniverseColor, resolveUniverseColors } from '../universeColors'

it.each([colors, darkColors])(
  'keeps Bible tabs, passages and verse relations neutral in each palette',
  palette => {
    const bible = resolveUniverseColors(palette, 'bible')
    expect(bible.foreground).toBe(palette.tertiary)
    expect(bible.foreground).not.toBe(palette.color1)
    expect(bible.background).not.toBe('transparent')
    expect(resolveUniverseColors(palette, 'passages')).toEqual(bible)
    expect(resolveUniverseColors(palette, 'verse')).toEqual(bible)
  }
)

it('updates foreground and background from the supplied palette without a native theme context', () => {
  const palette = { ...colors, primary: '#123456' }
  expect(resolveUniverseColors(palette, 'strong')).toEqual({
    foreground: '#123456',
    background: 'rgba(18, 52, 86, 0.12)',
  })
  expect(resolveUniverseColors(palette, 'commentary-resource')).toEqual(
    resolveUniverseColors(palette, 'commentary')
  )
})

it('shares identity across search, tab and relation vocabulary', () => {
  expect(getUniverseColor('notes')).toBe(getUniverseColor('note'))
  expect(getUniverseColor('studies')).toBe(getUniverseColor('study'))
  expect(getUniverseColor('externalLink')).toBe(getUniverseColor('links'))
  expect(getUniverseColor('reference')).toBe(getUniverseColor('references'))
})
