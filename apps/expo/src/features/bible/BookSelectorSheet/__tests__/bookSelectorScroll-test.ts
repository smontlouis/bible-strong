import books from '~assets/bible_versions/books-desc'
import { getBookListRows, getTestamentGroups } from '../bookListRows'
import {
  getBookListScrollOffset,
  getBookRowTop,
  getChapterRowScrollOffset,
  getListChapterGridHeight,
  getListChapterLayout,
  getRevealChaptersOffset,
  isExpandedBookAboveViewport,
} from '../bookSelectorScroll'

const phone = { windowWidth: 390, viewportHeight: 600 }

describe('getListChapterLayout', () => {
  it('fits five chapters per row on a phone and caps the width on a tablet', () => {
    expect(getListChapterLayout(390)).toEqual({
      maxWidth: 390,
      itemsPerRow: 5,
      horizontalMargin: 25,
    })
    expect(getListChapterLayout(1024).maxWidth).toBe(500)
    expect(getListChapterLayout(1024).itemsPerRow).toBe(7)
  })
})

describe('getBookListScrollOffset', () => {
  it('starts at the top for Genesis 1', () => {
    expect(getBookListScrollOffset({ ...phone, bookTop: 0, chapterIndex: 0 })).toBe(0)
  })

  it('shows two books above the selected one when its chapter is already visible', () => {
    expect(getBookListScrollOffset({ ...phone, bookTop: 42 * 46, chapterIndex: 2 })).toBe(46 * 40)
  })

  it('keeps the two books above in view under a sticky testament title', () => {
    expect(
      getBookListScrollOffset({ ...phone, bookTop: 42 * 46, chapterIndex: 2, topInset: 40 })
    ).toBe(46 * 40 - 40)
  })

  it('centres the chapter row when it sits below the viewport', () => {
    // Psalms is the 19th book, chapter 119 sits on row 23 of its grid
    const gridTop = 18 * 46 + 46 + 10
    const rowTop = gridTop + 23 * 70

    expect(getBookListScrollOffset({ ...phone, bookTop: 18 * 46, chapterIndex: 118 })).toBe(
      rowTop - (600 - 60) / 2
    )
  })

  it('falls back to the book when the chapter is unknown', () => {
    expect(getBookListScrollOffset({ ...phone, bookTop: 18 * 46, chapterIndex: -1 })).toBe(46 * 16)
  })
})

describe('getChapterRowScrollOffset', () => {
  const grid = { itemsPerRow: 6, itemSize: 48, gap: 10, gridTop: 16, baseOffset: 0 }

  it('does not scroll when the row is visible', () => {
    expect(getChapterRowScrollOffset({ ...grid, chapterIndex: 20, viewportHeight: 600 })).toBe(0)
  })

  it('centres a row below the viewport', () => {
    const rowTop = 16 + 19 * 58

    expect(getChapterRowScrollOffset({ ...grid, chapterIndex: 118, viewportHeight: 600 })).toBe(
      rowTop - (600 - 48) / 2
    )
  })

  it('waits for a measured viewport', () => {
    expect(getChapterRowScrollOffset({ ...grid, chapterIndex: 118, viewportHeight: 0 })).toBe(0)
  })
})

describe('getListChapterGridHeight', () => {
  it('stacks full and partial rows of chapters between the grid padding', () => {
    // Genesis: 50 chapters, ten rows of five on a phone
    expect(getListChapterGridHeight(50, 390)).toBe(10 * 60 + 9 * 10 + 20)
    // Psalms: 150 chapters, 22 rows of seven on a tablet
    expect(getListChapterGridHeight(150, 1024)).toBe(22 * 60 + 21 * 10 + 20)
    // Jude: a single chapter
    expect(getListChapterGridHeight(1, 390)).toBe(60 + 20)
  })
})

describe('isExpandedBookAboveViewport', () => {
  // Psalms, the 19th book, ends at 19 * 46 + 22 rows of chapters on a tablet
  const psalms = { bookTop: 18 * 46, chapterCount: 150, windowWidth: 1024 }
  const psalmsBottom = 19 * 46 + getListChapterGridHeight(150, 1024)

  it('is true once the list is scrolled past the book and its chapters', () => {
    expect(isExpandedBookAboveViewport({ ...psalms, scrollOffset: psalmsBottom })).toBe(true)
  })

  it('is false while any part of the book is on screen, or without an expanded book', () => {
    expect(isExpandedBookAboveViewport({ ...psalms, scrollOffset: psalmsBottom - 1 })).toBe(false)
    expect(
      isExpandedBookAboveViewport({ ...psalms, bookTop: undefined, scrollOffset: 10_000 })
    ).toBe(false)
  })
})

describe('getRevealChaptersOffset', () => {
  // Revelation, the last of 66 books, with 22 chapters in four rows on a phone
  const revelation = { bookTop: 65 * 46, chapterCount: 22, windowWidth: 390, viewportHeight: 600 }
  const revelationTop = 65 * 46
  const gridHeight = getListChapterGridHeight(22, 390)

  it('keeps the offset while the whole grid is on screen', () => {
    expect(getRevealChaptersOffset({ ...revelation, scrollOffset: revelationTop - 100 })).toBe(
      revelationTop - 100
    )
  })

  it('scrolls just enough to show the grid below the screen', () => {
    // The title sits at the bottom of the screen, its chapters hidden under it
    const scrollOffset = revelationTop + 46 - 600

    expect(getRevealChaptersOffset({ ...revelation, scrollOffset })).toBe(
      revelationTop + 46 + gridHeight - 600
    )
  })

  it('stops at the title when the grid is taller than the screen', () => {
    expect(
      getRevealChaptersOffset({
        bookTop: 18 * 46,
        chapterCount: 150,
        windowWidth: 390,
        viewportHeight: 600,
        scrollOffset: 0,
      })
    ).toBe(18 * 46)
  })

  it('stops with the title under a sticky testament title', () => {
    expect(
      getRevealChaptersOffset({
        bookTop: 18 * 46,
        chapterCount: 150,
        windowWidth: 390,
        viewportHeight: 600,
        scrollOffset: 0,
        topInset: 40,
      })
    ).toBe(18 * 46 - 40)
  })

  it('keeps the offset for a book that is not listed', () => {
    expect(getRevealChaptersOffset({ ...revelation, bookTop: undefined, scrollOffset: 30 })).toBe(
      30
    )
  })
})

describe('getBookRowTop', () => {
  const protestant = books.filter(book => book.Numero <= 66)

  it('counts the testament titles above the book', () => {
    const rows = getBookListRows(getTestamentGroups(protestant, false))

    expect(getBookRowTop(rows, 1)).toBe(40)
    // Matthew follows the 39 books of the Old Testament and the title of the New
    expect(getBookRowTop(rows, 40)).toBe(40 + 39 * 46 + 40)
  })

  it('has no title in a list sorted by name', () => {
    const rows = getBookListRows(getTestamentGroups(protestant.slice(0, 3), true))

    expect(getBookRowTop(rows, 3)).toBe(2 * 46)
    expect(getBookRowTop(rows, 40)).toBeUndefined()
  })
})
