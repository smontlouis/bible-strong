import produce from 'immer'
import type { Bookmark } from '~common/types'

export const ADD_BOOKMARK = 'user/ADD_BOOKMARK'
export const REMOVE_BOOKMARK = 'user/REMOVE_BOOKMARK'
export const UPDATE_BOOKMARK = 'user/UPDATE_BOOKMARK'
export const MOVE_BOOKMARK = 'user/MOVE_BOOKMARK'

export const MAX_BOOKMARKS = 8

export default produce((draft, action) => {
  switch (action.type) {
    case ADD_BOOKMARK: {
      draft.bible.bookmarks[action.payload.id] = action.payload
      break
    }
    case REMOVE_BOOKMARK: {
      delete draft.bible.bookmarks[action.payload]
      break
    }
    case UPDATE_BOOKMARK: {
      const { id, ...updates } = action.payload
      if (draft.bible.bookmarks[id]) {
        draft.bible.bookmarks[id] = {
          ...draft.bible.bookmarks[id],
          ...updates,
        }
      }
      break
    }
    case MOVE_BOOKMARK: {
      const { id, book, chapter, verse, version } = action.payload
      if (draft.bible.bookmarks[id]) {
        draft.bible.bookmarks[id].book = book
        draft.bible.bookmarks[id].chapter = chapter
        draft.bible.bookmarks[id].verse = verse
        if (version !== undefined) {
          draft.bible.bookmarks[id].version = version
        }
        draft.bible.bookmarks[id].date = Date.now()
      }
      break
    }
    default:
      break
  }
})

export function addBookmark(bookmark: Bookmark) {
  return (dispatch: any, getState: any) => {
    const bookmarks = getState().user.bible.bookmarks || {}
    if (Object.keys(bookmarks).length >= MAX_BOOKMARKS) {
      return { error: 'MAX_BOOKMARKS_REACHED' }
    }
    return dispatch({ type: ADD_BOOKMARK, payload: bookmark })
  }
}

export function removeBookmark(bookmarkId: string) {
  return { type: REMOVE_BOOKMARK, payload: bookmarkId }
}

export function updateBookmark(id: string, updates: Partial<Omit<Bookmark, 'id'>>) {
  return { type: UPDATE_BOOKMARK, payload: { id, ...updates } }
}

export function moveBookmark(
  id: string,
  location: { book: number; chapter: number; verse?: number; version?: string }
) {
  return { type: MOVE_BOOKMARK, payload: { id, ...location } }
}
