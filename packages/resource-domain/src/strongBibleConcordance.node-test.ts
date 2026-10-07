import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { getStrongBibleConcordanceCandidates } from './strongBibleConcordance'

describe('Strong Bible concordance candidates', () => {
  it('tells apart two senses whose suffixes only differ by their letter case', () => {
    const prophet = getStrongBibleConcordanceCandidates(38, 'H2148v')
    const descendantOfPerez = getStrongBibleConcordanceCandidates(16, 'H2148V')

    assert.deepEqual(prophet[0], { kind: 2, code: 'H2148v' })
    assert.deepEqual(descendantOfPerez[0], { kind: 2, code: 'H2148V' })
    assert.equal(
      descendantOfPerez.some(candidate => candidate.code === 'H2148v'),
      false
    )
  })

  it('tries a suffix as it is written before its upper-cased spelling, for each kind', () => {
    assert.deepEqual(getStrongBibleConcordanceCandidates(38, 'H2148v'), [
      { kind: 2, code: 'H2148v' },
      { kind: 2, code: 'H2148V' },
      { kind: 1, code: 'H2148v' },
      { kind: 1, code: 'H2148V' },
    ])
  })

  it('still resolves a loosely written reference as dStrong before eStrong', () => {
    for (const [reference, expected] of [
      ['h1254a', 'H1254A'],
      ['H2148a', 'H2148A'],
    ] as const) {
      const candidates = getStrongBibleConcordanceCandidates(1, reference)
      const upperCased = candidates.filter(candidate => candidate.code === expected)

      assert.deepEqual(upperCased, [
        { kind: 2, code: expected },
        { kind: 1, code: expected },
      ])
      assert.ok(
        candidates.findIndex(candidate => candidate.kind === 2 && candidate.code === expected) <
          candidates.findIndex(candidate => candidate.kind === 1)
      )
    }
  })

  it('normalises the prefix letter and keeps the padded and unpadded numbers', () => {
    assert.deepEqual(getStrongBibleConcordanceCandidates(1, 'h0430G'), [
      { kind: 2, code: 'H0430G' },
      { kind: 2, code: 'H430G' },
      { kind: 1, code: 'H0430G' },
      { kind: 1, code: 'H430G' },
    ])
  })

  it('leaves classical numbers as they were', () => {
    assert.deepEqual(getStrongBibleConcordanceCandidates(3, '413'), [
      { kind: 0, code: 'H413' },
      { kind: 0, code: 'H0413' },
    ])
    assert.deepEqual(getStrongBibleConcordanceCandidates(40, 3056), [{ kind: 0, code: 'G3056' }])
    assert.deepEqual(getStrongBibleConcordanceCandidates(1, 'h0430'), [
      { kind: 0, code: 'H0430' },
      { kind: 0, code: 'H430' },
    ])
  })

  it('rejects a reference that is not a Strong code', () => {
    assert.deepEqual(getStrongBibleConcordanceCandidates(1, 'Zacharie'), [])
  })
})
