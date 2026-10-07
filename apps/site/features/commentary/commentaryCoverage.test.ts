import { describe, expect, it } from 'vitest'
import {
  adjacentCommentaryChapters,
  commentaryCovers,
  listCommentaryChapters,
  toCommentaryCoverage,
} from './commentaryCoverage'

const coverage = toCommentaryCoverage({
  books: [43, 19, 99, 20],
  chaptersByBook: { '19': [23, 1], '43': [3], '99': [1], '20': [] },
})

describe('Commentary coverage', () => {
  it('orders books and chapters and leaves out what cannot be addressed', () => {
    expect(coverage).toEqual([
      { book: 19, chapters: [1, 23] },
      { book: 43, chapters: [3] },
    ])
    expect(listCommentaryChapters(coverage)).toEqual([
      { book: 19, chapter: 1 },
      { book: 19, chapter: 23 },
      { book: 43, chapter: 3 },
    ])
  })

  it('tells whether a chapter is commented', () => {
    expect(commentaryCovers(coverage, { book: 19, chapter: 23 })).toBe(true)
    expect(commentaryCovers(coverage, { book: 19, chapter: 2 })).toBe(false)
    expect(commentaryCovers(coverage, { book: 1, chapter: 1 })).toBe(false)
  })

  it('moves to the commented chapters around one, across skipped chapters and books', () => {
    expect(adjacentCommentaryChapters(coverage, { book: 19, chapter: 23 })).toEqual({
      previous: { book: 19, chapter: 1 },
      next: { book: 43, chapter: 3 },
    })
    expect(adjacentCommentaryChapters(coverage, { book: 19, chapter: 1 })).toEqual({
      previous: undefined,
      next: { book: 19, chapter: 23 },
    })
    expect(adjacentCommentaryChapters(coverage, { book: 43, chapter: 3 }).next).toBeUndefined()
    expect(adjacentCommentaryChapters(coverage, { book: 1, chapter: 1 })).toEqual({})
  })
})
