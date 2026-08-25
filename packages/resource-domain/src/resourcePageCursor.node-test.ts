import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  decodeDictionaryPageCursor,
  decodeNavePageCursor,
  decodeStrongLexiconPageCursor,
  encodeDictionaryPageCursor,
  encodeNavePageCursor,
  encodeStrongLexiconPageCursor,
} from './resourcePageCursor'

describe('resource page cursors', () => {
  it('round-trips every public cursor shape', () => {
    const dictionary = ['agape', 12] as const
    const nave = ['Amour', 'amour'] as const
    const strong = { gloss: 'parole', baseCode: 3056, id: 42 }

    assert.deepEqual(decodeDictionaryPageCursor(encodeDictionaryPageCursor(dictionary)), dictionary)
    assert.deepEqual(decodeNavePageCursor(encodeNavePageCursor(nave)), nave)
    assert.deepEqual(decodeStrongLexiconPageCursor(encodeStrongLexiconPageCursor(strong)), strong)
  })
})
