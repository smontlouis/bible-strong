import { getDisplayedStrongIdentities, resolveDisplayedStrongIdentities } from '../strongIdentities'

describe('interlinear Strong identity display', () => {
  it('keeps the disambiguated identity instead of its classical family', () => {
    expect(
      getDisplayedStrongIdentities([
        { kind: 'strong', code: 'H0310' },
        { kind: 'estrong', code: 'H0310' },
        { kind: 'dstrong', code: 'H0310A' },
        { kind: 'ustrong', code: 'H0310B' },
      ])
    ).toEqual([{ kind: 'dstrong', code: 'H0310A' }])
  })

  it('keeps a classical identity when no matching disambiguated identity exists', () => {
    expect(
      getDisplayedStrongIdentities([
        { kind: 'strong', code: 'H0430' },
        { kind: 'dstrong', code: 'H0310A' },
      ])
    ).toEqual([
      { kind: 'dstrong', code: 'H0310A' },
      { kind: 'strong', code: 'H0430' },
    ])
  })

  it('prefers an extended identity over its classical family when no dStrong exists', () => {
    expect(
      getDisplayedStrongIdentities([
        { kind: 'strong', code: 'G3056' },
        { kind: 'estrong', code: 'G3056' },
      ])
    ).toEqual([{ kind: 'estrong', code: 'G3056' }])
  })

  it('removes duplicate identities', () => {
    expect(
      getDisplayedStrongIdentities([
        { kind: 'dstrong', code: 'G0026A' },
        { kind: 'dstrong', code: 'G0026A' },
      ])
    ).toEqual([{ kind: 'dstrong', code: 'G0026A' }])
  })

  it('keeps the disambiguated LORD identity and the separate preposition identity', () => {
    expect(
      getDisplayedStrongIdentities([
        { kind: 'strong', code: 'H3068' },
        { kind: 'dstrong', code: 'H3068G' },
        { kind: 'strong', code: 'H0413' },
      ])
    ).toEqual([
      { kind: 'dstrong', code: 'H3068G' },
      { kind: 'strong', code: 'H0413' },
    ])
  })
})

describe('aligned Strong identity resolution', () => {
  it('keeps target order while using richer aligned codes', () => {
    expect(
      resolveDisplayedStrongIdentities(
        [
          { kind: 'strong', code: 'H3068' },
          { kind: 'strong', code: 'H413' },
        ],
        [
          { kind: 'strong', code: 'H0413' },
          { kind: 'strong', code: 'H3068' },
          { kind: 'dstrong', code: 'H3068G' },
        ]
      )
    ).toEqual([
      { kind: 'dstrong', code: 'H3068G' },
      { kind: 'strong', code: 'H0413' },
    ])
  })
})
