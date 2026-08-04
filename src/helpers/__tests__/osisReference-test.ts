import { getSupportedOsisBookNumber, normalizeOsisReference } from '../osisReference'

describe('normalizeOsisReference', () => {
  it.each([
    ['Rom.5.13-17', 'Rom.5.13-Rom.5.17'],
    ['Rom.8.1-11', 'Rom.8.1-Rom.8.11'],
    ['Rom.1-8', 'Rom.1-Rom.8'],
  ])('expands a supported relative range: %s', (input, expected) => {
    expect(normalizeOsisReference(input)).toBe(expected)
  })

  it('preserves complete OSIS ranges', () => {
    expect(normalizeOsisReference('Gen.1.31-Gen.2.3')).toBe('Gen.1.31-Gen.2.3')
  })

  it('does not normalize an unknown book identifier', () => {
    expect(normalizeOsisReference('garbage.1-2')).toBe('garbage.1-2')
    expect(normalizeOsisReference('toString.1-2')).toBe('toString.1-2')
  })

  it('owns the canonical and deuterocanonical app book mapping', () => {
    expect(getSupportedOsisBookNumber('Gen')).toBe(1)
    expect(getSupportedOsisBookNumber('Rev')).toBe(66)
    expect(getSupportedOsisBookNumber('Tob')).toBe(67)
    expect(getSupportedOsisBookNumber('2Macc')).toBe(73)
    expect(getSupportedOsisBookNumber('1Esd')).toBe(74)
    expect(getSupportedOsisBookNumber('3Macc')).toBe(75)
    expect(getSupportedOsisBookNumber('4Macc')).toBe(76)
    expect(getSupportedOsisBookNumber('PssSol')).toBe(77)
    expect(getSupportedOsisBookNumber('PrMan')).toBeUndefined()
  })
})
