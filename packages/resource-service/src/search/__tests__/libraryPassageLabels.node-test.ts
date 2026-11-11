import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  documentPassages,
  parseCollectionDocument,
  parseCollectionHeader,
  unmatchedPassageLabels,
} from '../libraryCollections'

const labelsOf = (passage: { target: unknown } | undefined) =>
  (passage?.target as { labels?: string[] } | undefined)?.labels

describe('passage labels of a collection document', () => {
  const collection = parseCollectionHeader({
    collection: {
      id: 'studies',
      title: 'Bible Studies',
      language: 'en',
      rights: { holder: 'A publisher', terms_reference: 'Used with permission' },
    },
  })

  it('labels only the passages that contain the excerpt', () => {
    const answer = parseCollectionDocument({
      key: 'an-answer',
      title: 'An Answer',
      text:
        'Our reading of the text comes first.\n\n' +
        'More of our reading. '.repeat(100) +
        '\n\nA critic   wrote that the day means an age; we answer him.',
      labels: ['the millennium'],
      passageLabels: [
        { contains: 'A critic wrote that the day\nmeans an age', labels: ['reports the view of a critic', '<b>'] },
        { contains: 'A sentence that is in no passage at all', labels: ['reports the view of nobody'] },
        { contains: 'too short', labels: ['reports the view of a critic'] },
        { contains: 'A critic wrote that the day means an age', labels: [] },
        'not an entry',
      ],
    })
    assert.ok(answer)
    assert.equal(answer.passageLabels.length, 2, 'short excerpts and entries without a valid label are left out')
    const passages = documentPassages(collection, answer)
    assert.ok(passages.length >= 2)
    assert.deepEqual(labelsOf(passages[0]), ['the millennium'])
    assert.deepEqual(labelsOf(passages.at(-1)), ['the millennium', 'reports the view of a critic'])
    assert.deepEqual(
      unmatchedPassageLabels(answer).map(entry => entry.contains),
      ['A sentence that is in no passage at all']
    )
  })

  it('gives a passage labels even when its document has none', () => {
    const document = parseCollectionDocument({
      key: 'a',
      title: 'T',
      text: 'Some say the law was nailed to the cross.',
      passageLabels: [{ contains: 'the law was nailed to the cross', labels: ['reports the view of critics'] }],
    })
    assert.ok(document)
    assert.deepEqual(labelsOf(documentPassages(collection, document)[0]), ['reports the view of critics'])
    const plain = parseCollectionDocument({ key: 'b', title: 'T', text: 'x' })
    assert.deepEqual(plain?.passageLabels, [])
    assert.equal(labelsOf(documentPassages(collection, plain!)[0]), undefined)
  })
})
