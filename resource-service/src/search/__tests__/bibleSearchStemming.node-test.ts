import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { highlightStemmedBibleSearchText, stemBibleSearchText } from '../bibleSearchStemming'

describe('Bible search stemming', () => {
  it('stems French and English inflections', () => {
    assert.equal(
      stemBibleSearchText('condamner condamnés condamnation', 'fr'),
      'condamn condamn condamn'
    )
    assert.equal(stemBibleSearchText('loves loved loving', 'en'), 'love love love')
  })

  it('highlights complete words found through stemming', () => {
    assert.equal(
      highlightStemmedBibleSearchText('Ils furent condamnés', 'condamner', 'fr'),
      'Ils furent {{condamnés}}'
    )
    assert.equal(
      highlightStemmedBibleSearchText('He loved the world', 'loving', 'en'),
      'He {{loved}} the world'
    )
  })
})
