import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { likeLiteral } from '../likePattern'

describe('LIKE literal', () => {
  it('turns wildcards and the escape character into literal characters', () => {
    assert.equal(likeLiteral('50%'), '50\\%')
    assert.equal(likeLiteral('a_b'), 'a\\_b')
    assert.equal(likeLiteral('c:\\d'), 'c:\\\\d')
    assert.equal(likeLiteral('Abraham'), 'Abraham')
  })
})
