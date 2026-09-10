import { getBookmarkVerse } from '~helpers/bookmarkVerse'
import { createSelector } from '@reduxjs/toolkit'
import type { Bookmark } from '~common/types'
import { RootState } from '~redux/modules/reducer'

// Base selector
export const selectBookmarksObj = (state: RootState) => state.user.bible.bookmarks || {}

// Selector for bookmarks count
export const selectBookmarksCount = createSelector(
  [selectBookmarksObj],
  bookmarks => Object.keys(bookmarks).length
)

// Selector factory for a chapter bookmark, including legacy deleted verse fields.
// Only returns chapter-level bookmarks (not verse-specific bookmarks)
export const makeSelectBookmarkForChapter = () =>
  createSelector(
    [
      selectBookmarksObj,
      (_: RootState, book: number) => book,
      (_: RootState, __: number, chapter: number) => chapter,
    ],
    (bookmarks, book, chapter): Bookmark | undefined => {
      return Object.values(bookmarks).find(
        b => b.book === book && b.chapter === chapter && getBookmarkVerse(b.verse) === undefined
      )
    }
  )

// Selector factory for bookmark by exact verse (book + chapter + verse)
export const makeSelectBookmarkForVerse = () =>
  createSelector(
    [
      selectBookmarksObj,
      (_: RootState, book: number) => book,
      (_: RootState, __: number, chapter: number) => chapter,
      (_: RootState, __: number, ___: number, verse: number) => verse,
    ],
    (bookmarks, book, chapter, verse): Bookmark | undefined => {
      return Object.values(bookmarks).find(
        b => b.book === book && b.chapter === chapter && getBookmarkVerse(b.verse) === verse
      )
    }
  )

// Selector for all bookmarks sorted by date (most recent first)
export const selectSortedBookmarks = createSelector([selectBookmarksObj], bookmarks =>
  Object.values(bookmarks).sort((a, b) => b.date - a.date)
)

export const selectLatestAddedBookmark = createSelector([selectBookmarksObj], bookmarks =>
  Object.values(bookmarks).reduce<Bookmark | undefined>(
    (latest, bookmark) =>
      !latest || (bookmark.createdAt ?? bookmark.date) > (latest.createdAt ?? latest.date)
        ? bookmark
        : latest,
    undefined
  )
)

// Selector for bookmarks in a specific chapter (for displaying icons in BibleView)
export const makeSelectBookmarksInChapter = () =>
  createSelector(
    [
      selectBookmarksObj,
      (_: RootState, book: number) => book,
      (_: RootState, __: number, chapter: number) => chapter,
    ],
    (bookmarks, book, chapter): Record<number, Bookmark> => {
      const result: Record<number, Bookmark> = {}
      Object.values(bookmarks).forEach(b => {
        const verse = getBookmarkVerse(b.verse)
        if (b.book === book && b.chapter === chapter && verse !== undefined) {
          result[verse] = b
        }
      })
      return result
    }
  )
