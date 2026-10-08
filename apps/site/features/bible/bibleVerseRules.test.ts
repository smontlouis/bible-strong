import { describe, expect, it } from 'vitest'
import {
  closestCommentarySection,
  crossReferenceVerses,
  otherMainVersions,
  quoteVerseText,
  verseDictionaryEntries,
  verseStudyVersions,
} from './bibleVerseRules'

describe('quoteVerseText', () => {
  it('quotes a verse on one line and keeps its line-break marks', () => {
    expect(
      quoteVerseText('Grâce à lui, je me repose |dans des prairies verdoyantes,\n et c’est lui ')
    ).toBe('Grâce à lui, je me repose |dans des prairies verdoyantes, et c’est lui')
  })
})

describe('otherMainVersions', () => {
  it('quotes a verse in four other well-known Bibles of its language', () => {
    expect(otherMainVersions('fr', 'LSG')).toEqual(['S21', 'BDS', 'NEG79', 'DBY'])
    expect(otherMainVersions('en', 'ESV')).toEqual(['KJV', 'NIV', 'NKJV', 'NLT'])
  })

  it('keeps to four for a Bible that is not one of them', () => {
    expect(otherMainVersions('fr', 'OST')).toEqual(['LSG', 'S21', 'BDS', 'NEG79'])
  })
})

describe('verseStudyVersions', () => {
  const carrying = ['BDS', 'BHG', 'DBY', 'KJV', 'LSG', 'NEG79', 'OST', 'S21']

  it('reads the well-known Bibles of the language and the original one, in a fixed order', () => {
    expect(verseStudyVersions('fr', 'BHG', carrying)).toEqual([
      'BDS',
      'BHG',
      'DBY',
      'LSG',
      'NEG79',
      'S21',
    ])
  })

  it('leaves out a Bible that does not carry the verse', () => {
    expect(verseStudyVersions('fr', 'BHG', ['LSG', 'S21', 'OST'])).toEqual(['LSG', 'S21'])
    expect(verseStudyVersions('en', 'BHG', ['LSG'])).toEqual([])
  })
})

describe('crossReferenceVerses', () => {
  const self = { book: 43, chapter: 3, verse: 16 }

  it('keeps the verses and leaves out the words they are grouped under', () => {
    expect(crossReferenceVerses(['God.', '42-2-14', '45-5-8', 'gave.', '43-1-14'], self)).toEqual([
      { book: 42, chapter: 2, verse: 14 },
      { book: 45, chapter: 5, verse: 8 },
      { book: 43, chapter: 1, verse: 14 },
    ])
  })

  it('names a verse once, never the verse itself nor a book outside the canon', () => {
    expect(crossReferenceVerses(['45-5-8', '45-5-8', '43-3-16', '0-3-4', '67-1-1'], self)).toEqual([
      { book: 45, chapter: 5, verse: 8 },
    ])
  })

  it('stops at sixteen passages', () => {
    const many = Array.from({ length: 40 }, (_, index) => `1-1-${index + 1}`)
    expect(crossReferenceVerses(many, self)).toHaveLength(16)
  })
})

describe('verseDictionaryEntries', () => {
  const entry = (normalizedWord: string, evidenceKind: string, work: string) => ({
    normalizedWord,
    evidenceKind,
    work,
  })

  it('names the words of the verse first, each once', () => {
    expect(
      verseDictionaryEntries([
        entry('nicodeme', 'source-citation', 'bost'),
        entry('dieu', 'verse-name', 'calmet'),
        entry('dieu', 'verse-name', 'westphal'),
        entry('foi', 'source-citation', 'westphal'),
      ]).map(found => [found.normalizedWord, found.work])
    ).toEqual([
      ['dieu', 'calmet'],
      ['nicodeme', 'bost'],
      ['foi', 'westphal'],
    ])
  })

  it('keeps to ten words', () => {
    const many = Array.from({ length: 30 }, (_, index) =>
      entry(`w${index}`, 'source-citation', 'x')
    )
    expect(verseDictionaryEntries(many)).toHaveLength(10)
  })
})

describe('closestCommentarySection', () => {
  const run = (startVerse: number, endVerse: number) => ({ startVerse, endVerse })

  it('prefers the comment on the fewest verses', () => {
    expect(closestCommentarySection([run(1, 21), run(14, 18), run(16, 16)], 16)).toEqual(
      run(16, 16)
    )
    expect(closestCommentarySection([run(1, 21), run(14, 18)], 17)).toEqual(run(14, 18))
  })

  it('finds nothing where no comment covers the verse', () => {
    expect(closestCommentarySection([run(0, 0), run(1, 5)], 16)).toBeUndefined()
  })
})
