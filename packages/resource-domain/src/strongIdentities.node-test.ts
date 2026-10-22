import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { formatStrongDisplayCode } from './strongIdentities'

describe('Strong display code', () => {
  it('drops the zeros that pad the stored number', () => {
    assert.equal(formatStrongDisplayCode('G0026'), 'G26')
    assert.equal(formatStrongDisplayCode('H0430'), 'H430')
    assert.equal(formatStrongDisplayCode('G2316'), 'G2316')
  })

  it('keeps the letter of a split sense as it is written', () => {
    assert.equal(formatStrongDisplayCode('H0802G'), 'H802G')
    assert.equal(formatStrongDisplayCode('H2148v'), 'H2148v')
  })

  it('keeps a lone zero and leaves what is not a Strong code alone', () => {
    assert.equal(formatStrongDisplayCode('G0000'), 'G0')
    assert.equal(formatStrongDisplayCode('g0026'), 'G26')
    assert.equal(formatStrongDisplayCode('lemma'), 'lemma')
  })
})
