import { createStrongIdentity, createStrongIdentityForBook } from '../strongIdentities'

describe('createStrongIdentity', () => {
  it('prefixes a classical numeric reference using the lexical language', () => {
    expect(createStrongIdentity('7225', 'hebrew')).toEqual({
      kind: 'strong',
      code: 'H7225',
    })
    expect(createStrongIdentityForBook('746', 40)).toEqual({
      kind: 'strong',
      code: 'G0746',
    })
  })

  it('preserves STEP disambiguation suffixes', () => {
    expect(createStrongIdentityForBook('H3068G', 1)).toEqual({
      kind: 'dstrong',
      code: 'H3068G',
    })
    expect(createStrongIdentityForBook('3651C', 1)).toEqual({
      kind: 'dstrong',
      code: 'H3651C',
    })
    expect(createStrongIdentityForBook('H0310B', 1)).toEqual({
      kind: 'dstrong',
      code: 'H0310B',
    })
  })
})
