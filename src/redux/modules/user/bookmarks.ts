import { createAction } from '@reduxjs/toolkit'
import type { Bookmark } from '~common/types'

// Action type constants for backward compatibility
export const ADD_BOOKMARK = 'user/ADD_BOOKMARK'
export const REMOVE_BOOKMARK = 'user/REMOVE_BOOKMARK'
export const UPDATE_BOOKMARK = 'user/UPDATE_BOOKMARK'
export const MOVE_BOOKMARK = 'user/MOVE_BOOKMARK'

export const MAX_BOOKMARKS = 8

// RTK Action Creators
export const addBookmarkAction = createAction(ADD_BOOKMARK, (bookmark: Bookmark) => ({
  payload: bookmark,
}))

export const removeBookmark = createAction(REMOVE_BOOKMARK, (bookmarkId: string) => ({
  payload: bookmarkId,
}))

export const updateBookmark = createAction(
  UPDATE_BOOKMARK,
  (id: string, updates: Partial<Omit<Bookmark, 'id'>>) => ({
    payload: { id, ...updates },
  })
)

export const moveBookmark = createAction(
  MOVE_BOOKMARK,
  (id: string, location: { book: number; chapter: number; verse?: number; version?: string }) => ({
    payload: { id, ...location },
  })
)

// Thunk that checks max bookmarks before adding
export function addBookmark(bookmark: Bookmark) {
  return (dispatch: any, getState: any) => {
    const bookmarks = getState().user.bible.bookmarks || {}
    if (Object.keys(bookmarks).length >= MAX_BOOKMARKS) {
      return { error: 'MAX_BOOKMARKS_REACHED' }
    }
    return dispatch(addBookmarkAction(bookmark))
  }
}
