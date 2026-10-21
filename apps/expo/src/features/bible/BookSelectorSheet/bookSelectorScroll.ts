export const BOOK_ITEM_HEIGHT = 46
export const LIST_CHAPTER_SIZE = 60
export const LIST_CHAPTER_GAP = 10
export const LIST_CHAPTER_VERTICAL_PADDING = 10
const LIST_CHAPTER_MAX_WIDTH = 500
const BOOKS_SHOWN_ABOVE_SELECTED = 2

export const getListChapterLayout = (windowWidth: number) => {
  const maxWidth = Math.min(LIST_CHAPTER_MAX_WIDTH, windowWidth)
  const itemsPerRow = Math.max(1, Math.floor(maxWidth / (LIST_CHAPTER_SIZE + LIST_CHAPTER_GAP)))
  const totalItemsWidth = itemsPerRow * LIST_CHAPTER_SIZE + (itemsPerRow - 1) * LIST_CHAPTER_GAP

  return {
    maxWidth,
    itemsPerRow,
    horizontalMargin: (maxWidth - totalItemsWidth) / 2,
  }
}

// Height of an expanded book's chapter grid, padding included
export const getListChapterGridHeight = (chapterCount: number, windowWidth: number) => {
  const rows = Math.ceil(chapterCount / getListChapterLayout(windowWidth).itemsPerRow)

  return (
    rows * LIST_CHAPTER_SIZE +
    Math.max(0, rows - 1) * LIST_CHAPTER_GAP +
    2 * LIST_CHAPTER_VERTICAL_PADDING
  )
}

interface ListBookInput {
  bookIndex: number
  chapterCount: number
  windowWidth: number
  scrollOffset: number
}

// Whether an expanded book, the only one, ends above the part of the list on screen
export const isExpandedBookAboveViewport = ({
  bookIndex,
  chapterCount,
  windowWidth,
  scrollOffset,
}: ListBookInput) =>
  bookIndex >= 0 &&
  (bookIndex + 1) * BOOK_ITEM_HEIGHT + getListChapterGridHeight(chapterCount, windowWidth) <=
    scrollOffset

// Keeps `scrollOffset` while the only expanded book's grid is on screen, otherwise scrolls just
// enough to show it whole without pushing the book's title off the top
export const getRevealChaptersOffset = ({
  bookIndex,
  chapterCount,
  windowWidth,
  scrollOffset,
  viewportHeight,
}: ListBookInput & { viewportHeight: number }) => {
  const bookTop = BOOK_ITEM_HEIGHT * Math.max(bookIndex, 0)
  const gridBottom =
    bookTop + BOOK_ITEM_HEIGHT + getListChapterGridHeight(chapterCount, windowWidth)
  if (viewportHeight <= 0 || gridBottom <= scrollOffset + viewportHeight) return scrollOffset

  return Math.max(scrollOffset, Math.min(bookTop, gridBottom - viewportHeight))
}

interface ChapterRowScrollInput {
  chapterIndex: number
  itemsPerRow: number
  itemSize: number
  gap: number
  gridTop: number
  viewportHeight: number
  baseOffset: number
}

// Keeps `baseOffset` while the chapter's row is visible, otherwise centres that row
export const getChapterRowScrollOffset = ({
  chapterIndex,
  itemsPerRow,
  itemSize,
  gap,
  gridTop,
  viewportHeight,
  baseOffset,
}: ChapterRowScrollInput) => {
  if (chapterIndex < 0 || viewportHeight <= 0) return baseOffset

  const row = Math.floor(chapterIndex / Math.max(1, itemsPerRow))
  const rowTop = gridTop + row * (itemSize + gap)
  if (rowTop + itemSize <= baseOffset + viewportHeight) return baseOffset

  return Math.max(baseOffset, rowTop - (viewportHeight - itemSize) / 2)
}

interface BookListScrollInput {
  bookIndex: number
  chapterIndex: number
  windowWidth: number
  viewportHeight: number
}

// The selected book is the only expanded one when the selector opens
export const getBookListScrollOffset = ({
  bookIndex,
  chapterIndex,
  windowWidth,
  viewportHeight,
}: BookListScrollInput) => {
  const bookTop = BOOK_ITEM_HEIGHT * Math.max(bookIndex, 0)

  return getChapterRowScrollOffset({
    chapterIndex,
    itemsPerRow: getListChapterLayout(windowWidth).itemsPerRow,
    itemSize: LIST_CHAPTER_SIZE,
    gap: LIST_CHAPTER_GAP,
    gridTop: bookTop + BOOK_ITEM_HEIGHT + LIST_CHAPTER_VERTICAL_PADDING,
    viewportHeight,
    baseOffset: Math.max(0, bookTop - BOOKS_SHOWN_ABOVE_SELECTED * BOOK_ITEM_HEIGHT),
  })
}
