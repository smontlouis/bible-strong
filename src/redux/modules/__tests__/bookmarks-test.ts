/* eslint-env jest */

import produce from 'immer'
import bookmarksReducer, {
  ADD_BOOKMARK,
  REMOVE_BOOKMARK,
  UPDATE_BOOKMARK,
  MOVE_BOOKMARK,
  MAX_BOOKMARKS,
} from '../user/bookmarks'
import type { Bookmark } from '~common/types'

const getInitialState = () => ({
  bible: {
    bookmarks: {} as { [key: string]: Bookmark },
  },
})

const createBookmark = (id: string, overrides?: Partial<Bookmark>): Bookmark => ({
  id,
  book: 1,
  chapter: 1,
  verse: 1,
  version: 'LSG',
  date: Date.now(),
  ...overrides,
})

describe('Bookmarks Reducer', () => {
  let initialState: ReturnType<typeof getInitialState>

  beforeEach(() => {
    initialState = getInitialState()
  })

  describe('ADD_BOOKMARK', () => {
    it('should add a bookmark', () => {
      const bookmark = createBookmark('bookmark-1')
      const newState = bookmarksReducer(initialState, {
        type: ADD_BOOKMARK,
        payload: bookmark,
      })
      expect(newState.bible.bookmarks['bookmark-1']).toEqual(bookmark)
    })

    it('should add multiple bookmarks', () => {
      let state = bookmarksReducer(initialState, {
        type: ADD_BOOKMARK,
        payload: createBookmark('bookmark-1'),
      })
      state = bookmarksReducer(state, {
        type: ADD_BOOKMARK,
        payload: createBookmark('bookmark-2', { book: 2, chapter: 3 }),
      })
      expect(Object.keys(state.bible.bookmarks)).toHaveLength(2)
      expect(state.bible.bookmarks['bookmark-1']).toBeDefined()
      expect(state.bible.bookmarks['bookmark-2']).toBeDefined()
    })

    it('should allow up to MAX_BOOKMARKS', () => {
      let state = initialState
      for (let i = 0; i < MAX_BOOKMARKS; i++) {
        state = bookmarksReducer(state, {
          type: ADD_BOOKMARK,
          payload: createBookmark(`bookmark-${i}`),
        })
      }
      expect(Object.keys(state.bible.bookmarks)).toHaveLength(MAX_BOOKMARKS)
    })
  })

  describe('REMOVE_BOOKMARK', () => {
    it('should remove a bookmark', () => {
      const state = {
        bible: {
          bookmarks: {
            'bookmark-1': createBookmark('bookmark-1'),
            'bookmark-2': createBookmark('bookmark-2'),
          },
        },
      }
      const newState = bookmarksReducer(state, {
        type: REMOVE_BOOKMARK,
        payload: 'bookmark-1',
      })
      expect(newState.bible.bookmarks['bookmark-1']).toBeUndefined()
      expect(newState.bible.bookmarks['bookmark-2']).toBeDefined()
    })

    it('should handle removing non-existent bookmark', () => {
      const state = {
        bible: {
          bookmarks: {
            'bookmark-1': createBookmark('bookmark-1'),
          },
        },
      }
      const newState = bookmarksReducer(state, {
        type: REMOVE_BOOKMARK,
        payload: 'non-existent',
      })
      expect(newState.bible.bookmarks['bookmark-1']).toBeDefined()
    })
  })

  describe('UPDATE_BOOKMARK', () => {
    it('should update bookmark properties', () => {
      const state = {
        bible: {
          bookmarks: {
            'bookmark-1': createBookmark('bookmark-1', { book: 1, chapter: 1 }),
          },
        },
      }
      const newState = bookmarksReducer(state, {
        type: UPDATE_BOOKMARK,
        payload: { id: 'bookmark-1', book: 5, chapter: 10 },
      })
      expect(newState.bible.bookmarks['bookmark-1'].book).toBe(5)
      expect(newState.bible.bookmarks['bookmark-1'].chapter).toBe(10)
    })

    it('should preserve other properties when updating', () => {
      const originalDate = Date.now()
      const state = {
        bible: {
          bookmarks: {
            'bookmark-1': createBookmark('bookmark-1', { date: originalDate }),
          },
        },
      }
      const newState = bookmarksReducer(state, {
        type: UPDATE_BOOKMARK,
        payload: { id: 'bookmark-1', book: 5 },
      })
      expect(newState.bible.bookmarks['bookmark-1'].date).toBe(originalDate)
      expect(newState.bible.bookmarks['bookmark-1'].version).toBe('LSG')
    })

    it('should do nothing if bookmark does not exist', () => {
      const state = {
        bible: {
          bookmarks: {
            'bookmark-1': createBookmark('bookmark-1'),
          },
        },
      }
      const newState = bookmarksReducer(state, {
        type: UPDATE_BOOKMARK,
        payload: { id: 'non-existent', book: 5 },
      })
      expect(newState.bible.bookmarks['bookmark-1'].book).toBe(1)
      expect(newState.bible.bookmarks['non-existent']).toBeUndefined()
    })
  })

  describe('MOVE_BOOKMARK', () => {
    it('should move bookmark to new location', () => {
      const state = {
        bible: {
          bookmarks: {
            'bookmark-1': createBookmark('bookmark-1', { book: 1, chapter: 1, verse: 1 }),
          },
        },
      }
      const newState = bookmarksReducer(state, {
        type: MOVE_BOOKMARK,
        payload: { id: 'bookmark-1', book: 10, chapter: 5, verse: 3 },
      })
      expect(newState.bible.bookmarks['bookmark-1'].book).toBe(10)
      expect(newState.bible.bookmarks['bookmark-1'].chapter).toBe(5)
      expect(newState.bible.bookmarks['bookmark-1'].verse).toBe(3)
    })

    it('should update version when provided', () => {
      const state = {
        bible: {
          bookmarks: {
            'bookmark-1': createBookmark('bookmark-1', { version: 'LSG' }),
          },
        },
      }
      const newState = bookmarksReducer(state, {
        type: MOVE_BOOKMARK,
        payload: { id: 'bookmark-1', book: 1, chapter: 1, verse: 1, version: 'KJV' },
      })
      expect(newState.bible.bookmarks['bookmark-1'].version).toBe('KJV')
    })

    it('should not change version when not provided', () => {
      const state = {
        bible: {
          bookmarks: {
            'bookmark-1': createBookmark('bookmark-1', { version: 'LSG' }),
          },
        },
      }
      const newState = bookmarksReducer(state, {
        type: MOVE_BOOKMARK,
        payload: { id: 'bookmark-1', book: 10, chapter: 5, verse: 3 },
      })
      expect(newState.bible.bookmarks['bookmark-1'].version).toBe('LSG')
    })

    it('should update date when moving', () => {
      const oldDate = Date.now() - 10000
      const state = {
        bible: {
          bookmarks: {
            'bookmark-1': createBookmark('bookmark-1', { date: oldDate }),
          },
        },
      }
      const beforeMove = Date.now()
      const newState = bookmarksReducer(state, {
        type: MOVE_BOOKMARK,
        payload: { id: 'bookmark-1', book: 10, chapter: 5, verse: 3 },
      })
      expect(newState.bible.bookmarks['bookmark-1'].date).toBeGreaterThanOrEqual(beforeMove)
    })

    it('should do nothing if bookmark does not exist', () => {
      const state = {
        bible: {
          bookmarks: {
            'bookmark-1': createBookmark('bookmark-1'),
          },
        },
      }
      const newState = bookmarksReducer(state, {
        type: MOVE_BOOKMARK,
        payload: { id: 'non-existent', book: 10, chapter: 5, verse: 3 },
      })
      expect(newState.bible.bookmarks['bookmark-1'].book).toBe(1)
    })
  })

  describe('default case', () => {
    it('should return state unchanged for unknown action', () => {
      const state = {
        bible: {
          bookmarks: {
            'bookmark-1': createBookmark('bookmark-1'),
          },
        },
      }
      const newState = bookmarksReducer(state, { type: 'UNKNOWN_ACTION' })
      expect(newState).toEqual(state)
    })
  })

  describe('MAX_BOOKMARKS constant', () => {
    it('should be 8', () => {
      expect(MAX_BOOKMARKS).toBe(8)
    })
  })
})
