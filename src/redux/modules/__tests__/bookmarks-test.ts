/* eslint-env jest */

// Mock react-native before any imports
jest.mock('react-native', () => ({
  Appearance: {
    getColorScheme: jest.fn(() => 'light'),
  },
}))

// Mock expo-file-system
jest.mock('expo-file-system/legacy', () => ({}))
jest.mock('expo-file-system', () => ({}))

// Mock expo-sqlite
jest.mock('expo-sqlite', () => ({}))

// Mock bibleVersions and databases to avoid deep import chains
jest.mock('~helpers/bibleVersions', () => ({
  versions: {},
  getIfVersionNeedsUpdate: jest.fn(),
}))

jest.mock('~helpers/databases', () => ({
  databases: {},
  getIfDatabaseNeedsUpdate: jest.fn(),
}))

// Mock modules before importing reducer
jest.mock('~state/tabs', () => ({
  tabGroupsAtom: {},
}))

jest.mock('jotai/vanilla', () => ({
  getDefaultStore: jest.fn(() => ({
    set: jest.fn(),
  })),
}))

jest.mock('~helpers/firebase', () => ({
  firebaseDb: {
    collection: jest.fn(),
  },
}))

jest.mock('~i18n', () => ({
  getLanguage: jest.fn(() => 'fr'),
}))

jest.mock('~helpers/languageUtils', () => ({
  getDefaultBibleVersion: jest.fn(() => 'LSG'),
}))

// Mock theme imports
jest.mock('~themes/colors', () => ({ primary: '#000' }))
jest.mock('~themes/darkColors', () => ({ primary: '#111' }))
jest.mock('~themes/blackColors', () => ({ primary: '#222' }))
jest.mock('~themes/sepiaColors', () => ({ primary: '#333' }))
jest.mock('~themes/natureColors', () => ({ primary: '#444' }))
jest.mock('~themes/sunsetColors', () => ({ primary: '#555' }))
jest.mock('~themes/mauveColors', () => ({ primary: '#666' }))
jest.mock('~themes/nightColors', () => ({ primary: '#777' }))

import type { Bookmark } from '~common/types'
import userReducer, { UserState } from '../user'
import {
  addBookmarkAction,
  removeBookmark,
  updateBookmark,
  moveBookmark,
  MAX_BOOKMARKS,
} from '../user/bookmarks'

const getInitialState = (): UserState =>
  ({
    id: '',
    email: '',
    displayName: '',
    photoURL: '',
    provider: '',
    subscription: undefined,
    emailVerified: false,
    createdAt: null,
    isLoading: true,
    notifications: {
      verseOfTheDay: '07:00',
      notificationId: '',
    },
    changelog: {
      isLoading: true,
      lastSeen: 0,
      data: [],
    },
    needsUpdate: {},
    fontFamily: 'Avenir',
    bible: {
      changelog: {},
      bookmarks: {} as { [key: string]: Bookmark },
      highlights: {},
      notes: {},
      links: {},
      studies: {},
      tags: {},
      strongsHebreu: {},
      strongsGrec: {},
      words: {},
      naves: {},
      settings: {
        defaultBibleVersion: 'LSG',
        alignContent: 'left',
        lineHeight: 'normal',
        fontSizeScale: 0,
        textDisplay: 'inline',
        preferredColorScheme: 'auto',
        preferredLightTheme: 'default',
        preferredDarkTheme: 'dark',
        press: 'longPress',
        notesDisplay: 'inline',
        linksDisplay: 'inline',
        commentsDisplay: false,
        shareVerses: {
          hasVerseNumbers: true,
          hasInlineVerses: true,
          hasQuotes: true,
          hasAppName: true,
        },
        fontFamily: 'Avenir',
        theme: 'default',
        colors: {
          default: { primary: '#000' },
          dark: { primary: '#111' },
          black: { primary: '#222' },
          sepia: { primary: '#333' },
          nature: { primary: '#444' },
          sunset: { primary: '#555' },
          mauve: { primary: '#666' },
          night: { primary: '#777' },
        },
        compare: {
          LSG: true,
        },
        customHighlightColors: [],
      },
    },
  }) as unknown as UserState

const createBookmark = (id: string, overrides?: Partial<Bookmark>): Bookmark => ({
  id,
  name: '',
  color: '#000000',
  book: 1,
  chapter: 1,
  verse: 1,
  version: 'LSG',
  date: Date.now(),
  ...overrides,
})

describe('Bookmarks Reducer', () => {
  let initialState: UserState

  beforeEach(() => {
    initialState = getInitialState()
  })

  describe('addBookmarkAction', () => {
    it('should add a bookmark', () => {
      const bookmark = createBookmark('bookmark-1')
      const newState = userReducer(initialState, addBookmarkAction(bookmark))
      expect(newState.bible.bookmarks['bookmark-1']).toEqual(bookmark)
    })

    it('should add multiple bookmarks', () => {
      let state = userReducer(initialState, addBookmarkAction(createBookmark('bookmark-1')))
      state = userReducer(
        state,
        addBookmarkAction(createBookmark('bookmark-2', { book: 2, chapter: 3 }))
      )
      expect(Object.keys(state.bible.bookmarks)).toHaveLength(2)
      expect(state.bible.bookmarks['bookmark-1']).toBeDefined()
      expect(state.bible.bookmarks['bookmark-2']).toBeDefined()
    })

    it('should allow up to MAX_BOOKMARKS', () => {
      let state = initialState
      for (let i = 0; i < MAX_BOOKMARKS; i++) {
        state = userReducer(state, addBookmarkAction(createBookmark(`bookmark-${i}`)))
      }
      expect(Object.keys(state.bible.bookmarks)).toHaveLength(MAX_BOOKMARKS)
    })
  })

  describe('removeBookmark', () => {
    it('should remove a bookmark', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          bookmarks: {
            'bookmark-1': createBookmark('bookmark-1'),
            'bookmark-2': createBookmark('bookmark-2'),
          },
        },
      } as UserState
      const newState = userReducer(state, removeBookmark('bookmark-1'))
      expect(newState.bible.bookmarks['bookmark-1']).toBeUndefined()
      expect(newState.bible.bookmarks['bookmark-2']).toBeDefined()
    })

    it('should handle removing non-existent bookmark', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          bookmarks: {
            'bookmark-1': createBookmark('bookmark-1'),
          },
        },
      } as UserState
      const newState = userReducer(state, removeBookmark('non-existent'))
      expect(newState.bible.bookmarks['bookmark-1']).toBeDefined()
    })
  })

  describe('updateBookmark', () => {
    it('should update bookmark properties', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          bookmarks: {
            'bookmark-1': createBookmark('bookmark-1', { book: 1, chapter: 1 }),
          },
        },
      } as UserState
      const newState = userReducer(state, updateBookmark('bookmark-1', { book: 5, chapter: 10 }))
      expect(newState.bible.bookmarks['bookmark-1'].book).toBe(5)
      expect(newState.bible.bookmarks['bookmark-1'].chapter).toBe(10)
    })

    it('should preserve other properties when updating', () => {
      const originalDate = Date.now()
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          bookmarks: {
            'bookmark-1': createBookmark('bookmark-1', { date: originalDate }),
          },
        },
      } as UserState
      const newState = userReducer(state, updateBookmark('bookmark-1', { book: 5 }))
      expect(newState.bible.bookmarks['bookmark-1'].date).toBe(originalDate)
      expect(newState.bible.bookmarks['bookmark-1'].version).toBe('LSG')
    })

    it('should do nothing if bookmark does not exist', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          bookmarks: {
            'bookmark-1': createBookmark('bookmark-1'),
          },
        },
      } as UserState
      const newState = userReducer(state, updateBookmark('non-existent', { book: 5 }))
      expect(newState.bible.bookmarks['bookmark-1'].book).toBe(1)
      expect(newState.bible.bookmarks['non-existent']).toBeUndefined()
    })
  })

  describe('moveBookmark', () => {
    it('should move bookmark to new location', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          bookmarks: {
            'bookmark-1': createBookmark('bookmark-1', { book: 1, chapter: 1, verse: 1 }),
          },
        },
      } as UserState
      const newState = userReducer(
        state,
        moveBookmark('bookmark-1', { book: 10, chapter: 5, verse: 3 })
      )
      expect(newState.bible.bookmarks['bookmark-1'].book).toBe(10)
      expect(newState.bible.bookmarks['bookmark-1'].chapter).toBe(5)
      expect(newState.bible.bookmarks['bookmark-1'].verse).toBe(3)
    })

    it('should update version when provided', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          bookmarks: {
            'bookmark-1': createBookmark('bookmark-1', { version: 'LSG' }),
          },
        },
      } as UserState
      const newState = userReducer(
        state,
        moveBookmark('bookmark-1', { book: 1, chapter: 1, verse: 1, version: 'KJV' })
      )
      expect(newState.bible.bookmarks['bookmark-1'].version).toBe('KJV')
    })

    it('should not change version when not provided', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          bookmarks: {
            'bookmark-1': createBookmark('bookmark-1', { version: 'LSG' }),
          },
        },
      } as UserState
      const newState = userReducer(
        state,
        moveBookmark('bookmark-1', { book: 10, chapter: 5, verse: 3 })
      )
      expect(newState.bible.bookmarks['bookmark-1'].version).toBe('LSG')
    })

    it('should update date when moving', () => {
      const oldDate = Date.now() - 10000
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          bookmarks: {
            'bookmark-1': createBookmark('bookmark-1', { date: oldDate }),
          },
        },
      } as UserState
      const beforeMove = Date.now()
      const newState = userReducer(
        state,
        moveBookmark('bookmark-1', { book: 10, chapter: 5, verse: 3 })
      )
      expect(newState.bible.bookmarks['bookmark-1'].date).toBeGreaterThanOrEqual(beforeMove)
    })

    it('should do nothing if bookmark does not exist', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          bookmarks: {
            'bookmark-1': createBookmark('bookmark-1'),
          },
        },
      } as UserState
      const newState = userReducer(
        state,
        moveBookmark('non-existent', { book: 10, chapter: 5, verse: 3 })
      )
      expect(newState.bible.bookmarks['bookmark-1'].book).toBe(1)
    })
  })

  describe('default case', () => {
    it('should return state unchanged for unknown action', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          bookmarks: {
            'bookmark-1': createBookmark('bookmark-1'),
          },
        },
      } as UserState
      const newState = userReducer(state, { type: 'UNKNOWN_ACTION' } as any)
      expect(newState.bible.bookmarks).toEqual(state.bible.bookmarks)
    })
  })

  describe('MAX_BOOKMARKS constant', () => {
    it('should be 8', () => {
      expect(MAX_BOOKMARKS).toBe(8)
    })
  })
})
