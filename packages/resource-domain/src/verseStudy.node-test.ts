import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { crossReferenceVerses, verseDictionaryEntries, VERSE_STUDY_LIMITS } from './verseStudy'

describe('crossReferenceVerses', () => {
  const self = { book: 43, chapter: 3, verse: 16 }

  it('keeps the verses and leaves out the words they are grouped under', () => {
    assert.deepEqual(
      crossReferenceVerses(['God.', '42-2-14', '45-5-8', 'gave.', '43-1-14'], self),
      [
        { book: 42, chapter: 2, verse: 14 },
        { book: 45, chapter: 5, verse: 8 },
        { book: 43, chapter: 1, verse: 14 },
      ]
    )
  })

  it('names a verse once, never the verse itself nor a book outside the canon', () => {
    assert.deepEqual(
      crossReferenceVerses(['45-5-8', '45-5-8', '43-3-16', '0-3-4', '67-1-1'], self),
      [{ book: 45, chapter: 5, verse: 8 }]
    )
  })

  it('stops at the limit of the surface', () => {
    const many = Array.from({ length: 40 }, (_, index) => `1-1-${index + 1}`)
    assert.equal(crossReferenceVerses(many, self).length, 40)
    assert.equal(
      crossReferenceVerses(many, self, VERSE_STUDY_LIMITS.page.crossReferences).length,
      16
    )
  })
})

describe('verseDictionaryEntries', () => {
  const entry = (normalizedWord: string, evidenceKind: string, work: string) => ({
    normalizedWord,
    evidenceKind,
    work,
  })

  it('names the words of the verse first, each once', () => {
    assert.deepEqual(
      verseDictionaryEntries([
        entry('nicodeme', 'source-citation', 'bost'),
        entry('dieu', 'verse-name', 'calmet'),
        entry('dieu', 'verse-name', 'westphal'),
        entry('foi', 'source-citation', 'westphal'),
      ]).map(found => [found.normalizedWord, found.work]),
      [
        ['dieu', 'calmet'],
        ['nicodeme', 'bost'],
        ['foi', 'westphal'],
      ]
    )
  })

  it('names a subject once, though several dictionaries write on it', () => {
    assert.deepEqual(
      verseDictionaryEntries([
        { ...entry('jesus', 'verse-name', 'westphal'), correspondenceId: 'c-jesus' },
        { ...entry('jesus-christ', 'verse-name', 'bost'), correspondenceId: 'c-jesus' },
        entry('marie', 'verse-name', 'westphal'),
      ]).map(found => found.normalizedWord),
      ['jesus', 'marie']
    )
  })

  it('keeps to the limit of the surface', () => {
    const many = Array.from({ length: 30 }, (_, index) =>
      entry(`w${index}`, 'source-citation', 'x')
    )
    assert.equal(verseDictionaryEntries(many, VERSE_STUDY_LIMITS.page.dictionaryWords).length, 10)
    assert.equal(verseDictionaryEntries(many, VERSE_STUDY_LIMITS.focus.dictionaryWords).length, 8)
  })
})
