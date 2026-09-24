import {
  buildPublicStrongEntityPath,
  buildPublicStrongPath,
  parsePublicStrongCode,
  publicStrongContext,
  resolvePublicStrongContext,
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

  it('keeps the context verse book instead of the lexical placeholder', () => {
    expect(
      resolvePublicStrongContext(
        { kind: 'dstrong', code: 'G0266' },
        { book: 45, bibleVersion: 'KJV', bibleChapter: 6, bibleVerse: 23 }
      )
    ).toEqual({
      book: 45,
      reference: 'G0266',
      identityKind: 'dstrong',
      identityCode: 'G0266',
      bibleVersion: 'KJV',
      bibleChapter: 6,
      bibleVerse: 23,
    })
  })

  it('falls back to the lexical placeholder book without a context verse', () => {
    expect(resolvePublicStrongContext({ kind: 'dstrong', code: 'H0430' }, { book: 45 })).toEqual({
      book: 1,
      reference: 'H0430',
      identityKind: 'dstrong',
      identityCode: 'H0430',
    })
  })
})
