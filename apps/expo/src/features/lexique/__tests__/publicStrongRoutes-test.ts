import {
  buildPublicStrongEntityPath,
  buildPublicStrongPath,
  parsePublicStrongCode,
  publicStrongContext,
} from '../publicStrongRoutes'

describe('public Strong routes', () => {
  it.each([
    ['g3056', { kind: 'strong', code: 'G3056' }],
    ['H430', { kind: 'strong', code: 'H0430' }],
    ['h3651c', { kind: 'dstrong', code: 'H3651C' }],
  ] as const)('normalizes %s', (value, expected) => {
    expect(parsePublicStrongCode(value)).toEqual(expected)
    expect(buildPublicStrongPath(value)).toBe(`/strong/${expected.code.toLocaleLowerCase()}`)
  })

  it('rejects codes without a lexical-language prefix', () => {
    expect(parsePublicStrongCode('3056')).toBeUndefined()
    expect(parsePublicStrongCode('not-a-code')).toBeUndefined()
  })

  it('builds normalized entry subpages and durable entity paths', () => {
    expect(buildPublicStrongPath('G3056', 'dictionary')).toBe('/strong/g3056/dictionary')
    expect(buildPublicStrongPath('G3056', 'related')).toBe('/strong/g3056/related')
    expect(buildPublicStrongPath('G3056', 'concordance')).toBe('/strong/g3056/concordance')
    expect(buildPublicStrongEntityPath('Peter@Matt.4.18')).toBe('/strong/entity/Peter%40Matt.4.18')
  })

  it('creates the existing Strong screen context', () => {
    expect(publicStrongContext({ kind: 'dstrong', code: 'G4074G' })).toEqual({
      book: 40,
      reference: 'G4074G',
      identityKind: 'dstrong',
      identityCode: 'G4074G',
    })
  })
})
