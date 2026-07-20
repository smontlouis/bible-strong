import type { BibleVersionCoverage } from '../biblesDb'
import { getBook } from '../bibleBookCatalog'
import {
  getNextAvailableChapterLocation,
  getPreviousAvailableChapterLocation,
} from '../bibleCoverage'

jest.mock('../biblesDb', () => ({
  getChapterVerseCount: jest.fn(),
}))

const coverage: BibleVersionCoverage = {
  books: [16, 17, 40, 67, 68],
  chaptersByBook: {
    16: [13],
    17: [1],
    40: [1],
    67: [1, 2],
    68: [1],
  },
  verseCountByBookChapter: {},
}

describe('bibleCoverage canonical navigation', () => {
  it('navigates through Clementine order instead of numeric book ids', () => {
    const nehemiah = getBook(16)!
    const target = getNextAvailableChapterLocation(nehemiah, 13, coverage, 'clementine-vulgate')

    expect(target).toEqual({ book: getBook(67), chapter: 1 })
  })

  it('navigates backwards through Clementine order', () => {
    const esther = getBook(17)!
    const target = getPreviousAvailableChapterLocation(esther, 1, coverage, 'clementine-vulgate')

    expect(target).toEqual({ book: getBook(68), chapter: 1 })
  })
})
