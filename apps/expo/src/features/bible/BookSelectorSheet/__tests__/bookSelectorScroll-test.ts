import {
  getBookListScrollOffset,
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
    expect(getBookListScrollOffset({ ...phone, bookIndex: 0, chapterIndex: 0 })).toBe(0)
  })

  it('shows two books above the selected one when its chapter is already visible', () => {
    expect(getBookListScrollOffset({ ...phone, bookIndex: 42, chapterIndex: 2 })).toBe(46 * 40)
  })

  it('centres the chapter row when it sits below the viewport', () => {
    // Psalms is the 19th book, chapter 119 sits on row 23 of its grid
    const gridTop = 18 * 46 + 46 + 10
    const rowTop = gridTop + 23 * 70

    expect(getBookListScrollOffset({ ...phone, bookIndex: 18, chapterIndex: 118 })).toBe(
      rowTop - (600 - 60) / 2
    )
  })

  it('falls back to the book when the chapter is unknown', () => {
    expect(getBookListScrollOffset({ ...phone, bookIndex: 18, chapterIndex: -1 })).toBe(46 * 16)
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
  const psalms = { bookIndex: 18, chapterCount: 150, windowWidth: 1024 }
  const psalmsBottom = 19 * 46 + getListChapterGridHeight(150, 1024)

  it('is true once the list is scrolled past the book and its chapters', () => {
    expect(isExpandedBookAboveViewport({ ...psalms, scrollOffset: psalmsBottom })).toBe(true)
  })

  it('is false while any part of the book is on screen, or without an expanded book', () => {
    expect(isExpandedBookAboveViewport({ ...psalms, scrollOffset: psalmsBottom - 1 })).toBe(false)
    expect(isExpandedBookAboveViewport({ ...psalms, bookIndex: -1, scrollOffset: 10_000 })).toBe(
      false
    )
  })
})

describe('getRevealChaptersOffset', () => {
  // Revelation, the last of 66 books, with 22 chapters in four rows on a phone
  const revelation = { bookIndex: 65, chapterCount: 22, windowWidth: 390, viewportHeight: 600 }
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
        bookIndex: 18,
        chapterCount: 150,
        windowWidth: 390,
        viewportHeight: 600,
        scrollOffset: 0,
      })
    ).toBe(18 * 46)
  })
})
