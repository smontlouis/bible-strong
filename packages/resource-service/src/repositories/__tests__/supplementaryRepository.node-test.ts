import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildCommentaryCoverage } from '../supplementaryRepository'

describe('commentary repository coverage', () => {
  it('deduplicates and orders covered books and chapters while excluding book introductions', () => {
    assert.deepEqual(buildCommentaryCoverage(['41-3', '1-2', '41-1', '1-2', '19-0', 'invalid']), {
      books: [1, 41],
      chaptersByBook: { 1: [2], 41: [1, 3] },
    })
  })
})
