import { getStrongBibleConcordanceCandidates } from '../strongBibleConcordance'

describe('Strong Bible concordance identity resolution', () => {
  it('resolves padded lexical codes against unpadded KJV indexes without losing the suffix', () => {
    expect(getStrongBibleConcordanceCandidates(1, 'H0430G')).toEqual([
      { kind: 2, code: 'H0430G' },
      { kind: 2, code: 'H430G' },
      { kind: 1, code: 'H0430G' },
      { kind: 1, code: 'H430G' },
    ])
  })
  it('resolves a suffixed STEP code as dStrong before eStrong', () => {
    expect(getStrongBibleConcordanceCandidates(3, 'H3068G')).toEqual([
      { kind: 2, code: 'H3068G' },
      { kind: 1, code: 'H3068G' },
    ])
  })

  it('normalizes a classic numeric Strong to four digits', () => {
    expect(getStrongBibleConcordanceCandidates(3, '413')).toEqual([
      { kind: 0, code: 'H413' },
      { kind: 0, code: 'H0413' },
    ])
  })

  it('uses the New Testament family for numeric Greek references', () => {
    expect(getStrongBibleConcordanceCandidates(40, 3056)).toEqual([{ kind: 0, code: 'G3056' }])
  })
})
