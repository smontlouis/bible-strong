import { compareText } from '../compareText'

// The reference the helper must match.
const localeCompare = (
  left: string,
  right: string,
  locales?: string,
  options?: Intl.CollatorOptions
) =>
  // eslint-disable-next-line no-restricted-syntax
  left.localeCompare(right, locales, options)

describe('compareText', () => {
  const words = ['éclair', 'Zèbre', 'arbre', 'Écho', 'zone', 'Arbre', 'b10', 'b2']

  it('orders like localeCompare without arguments', () => {
    expect([...words].sort(compareText)).toEqual(
      [...words].sort((left, right) => localeCompare(left, right))
    )
  })

  it('orders like localeCompare with a locale and options', () => {
    const options = { sensitivity: 'base' } as const
    expect([...words].sort((left, right) => compareText(left, right, 'fr', options))).toEqual(
      [...words].sort((left, right) => localeCompare(left, right, 'fr', options))
    )
  })

  it('treats case and accents as equal at base sensitivity', () => {
    expect(compareText('Écho', 'echo', 'fr', { sensitivity: 'base' })).toBe(0)
  })

  it('falls back to code units for a locale Intl refuses', () => {
    expect(compareText('b', 'a', 'not a locale!')).toBe(1)
    expect(compareText('a', 'b', 'not a locale!')).toBe(-1)
    expect(compareText('a', 'a', 'not a locale!')).toBe(0)
  })
})
