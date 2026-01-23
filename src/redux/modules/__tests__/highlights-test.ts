/* eslint-env jest */

// Mock react-native before any imports
import type { Bookmark } from '~common/types'
import userReducer, { UserState, HighlightsObj } from '../user'
import { addHighlightAction, removeHighlight, changeHighlightColor } from '../user/highlights'

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
      highlights: {} as HighlightsObj,
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

describe('Highlights Reducer', () => {
  let initialState: UserState

  beforeEach(() => {
    initialState = getInitialState()
  })

  describe('addHighlightAction', () => {
    it('should add highlights for selected verses', () => {
      const selectedVerses = {
        '1-1-1': { color: 'yellow', date: Date.now(), tags: {} },
        '1-1-2': { color: 'yellow', date: Date.now(), tags: {} },
      }
      const newState = userReducer(initialState, addHighlightAction(selectedVerses))
      expect(newState.bible.highlights['1-1-1']).toBeDefined()
      expect(newState.bible.highlights['1-1-2']).toBeDefined()
      expect(newState.bible.highlights['1-1-1'].color).toBe('yellow')
    })

    it('should merge with existing highlights', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          highlights: {
            '1-1-1': { color: 'red', date: Date.now(), tags: {} },
          },
        },
      } as UserState
      const selectedVerses = {
        '1-1-2': { color: 'blue', date: Date.now(), tags: {} },
      }
      const newState = userReducer(state, addHighlightAction(selectedVerses))
      expect(newState.bible.highlights['1-1-1']).toBeDefined()
      expect(newState.bible.highlights['1-1-2']).toBeDefined()
    })

    it('should overwrite existing highlight with same key', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          highlights: {
            '1-1-1': { color: 'red', date: Date.now(), tags: {} },
          },
        },
      } as UserState
      const selectedVerses = {
        '1-1-1': { color: 'blue', date: Date.now(), tags: {} },
      }
      const newState = userReducer(state, addHighlightAction(selectedVerses))
      expect(newState.bible.highlights['1-1-1'].color).toBe('blue')
    })
  })

  describe('changeHighlightColor', () => {
    it('should change color of specified highlights', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          highlights: {
            '1-1-1': { color: 'red', date: Date.now(), tags: {} },
            '1-1-2': { color: 'red', date: Date.now(), tags: {} },
          },
        },
      } as UserState
      const newState = userReducer(
        state,
        changeHighlightColor({ '1-1-1': true, '1-1-2': true }, 'green')
      )
      expect(newState.bible.highlights['1-1-1'].color).toBe('green')
      expect(newState.bible.highlights['1-1-2'].color).toBe('green')
    })

    it('should only change color of specified verses', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          highlights: {
            '1-1-1': { color: 'red', date: Date.now(), tags: {} },
            '1-1-2': { color: 'blue', date: Date.now(), tags: {} },
          },
        },
      } as UserState
      const newState = userReducer(state, changeHighlightColor({ '1-1-1': true }, 'green'))
      expect(newState.bible.highlights['1-1-1'].color).toBe('green')
      expect(newState.bible.highlights['1-1-2'].color).toBe('blue')
    })

    it('should preserve other highlight properties', () => {
      const originalDate = Date.now()
      const tags = { 'tag-1': { id: 'tag-1', name: 'Test' } }
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          highlights: {
            '1-1-1': { color: 'red', date: originalDate, tags },
          },
        },
      } as UserState
      const newState = userReducer(state, changeHighlightColor({ '1-1-1': true }, 'green'))
      expect(newState.bible.highlights['1-1-1'].date).toBe(originalDate)
      expect(newState.bible.highlights['1-1-1'].tags).toEqual(tags)
    })
  })

  describe('removeHighlight', () => {
    it('should remove specified highlights', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          highlights: {
            '1-1-1': { color: 'red', date: Date.now(), tags: {} },
            '1-1-2': { color: 'blue', date: Date.now(), tags: {} },
          },
        },
      } as UserState
      const newState = userReducer(state, removeHighlight({ selectedVerses: { '1-1-1': true } }))
      expect(newState.bible.highlights['1-1-1']).toBeUndefined()
      expect(newState.bible.highlights['1-1-2']).toBeDefined()
    })

    it('should remove multiple highlights at once', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          highlights: {
            '1-1-1': { color: 'red', date: Date.now(), tags: {} },
            '1-1-2': { color: 'blue', date: Date.now(), tags: {} },
            '1-1-3': { color: 'green', date: Date.now(), tags: {} },
          },
        },
      } as UserState
      const newState = userReducer(
        state,
        removeHighlight({ selectedVerses: { '1-1-1': true, '1-1-3': true } })
      )
      expect(newState.bible.highlights['1-1-1']).toBeUndefined()
      expect(newState.bible.highlights['1-1-2']).toBeDefined()
      expect(newState.bible.highlights['1-1-3']).toBeUndefined()
    })

    it('should remove highlight references from tags', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          highlights: {
            '1-1-1': {
              color: 'red',
              date: Date.now(),
              tags: { 'tag-1': { id: 'tag-1', name: 'Test' } },
            },
          },
          tags: {
            'tag-1': {
              id: 'tag-1',
              name: 'Test',
              date: Date.now(),
              highlights: { '1-1-1': true },
            },
          },
        },
      } as UserState
      const newState = userReducer(state, removeHighlight({ selectedVerses: { '1-1-1': true } }))
      expect(newState.bible.highlights['1-1-1']).toBeUndefined()
      expect(newState.bible.tags['tag-1'].highlights?.['1-1-1']).toBeUndefined()
    })

    it('should handle removing non-existent highlight', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          highlights: {
            '1-1-1': { color: 'red', date: Date.now(), tags: {} },
          },
        },
      } as UserState
      const newState = userReducer(state, removeHighlight({ selectedVerses: { '1-1-99': true } }))
      expect(newState.bible.highlights['1-1-1']).toBeDefined()
    })
  })

  describe('default case', () => {
    it('should return state unchanged for unknown action', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          highlights: {
            '1-1-1': { color: 'red', date: Date.now(), tags: {} },
          },
        },
      } as UserState
      const newState = userReducer(state, { type: 'UNKNOWN_ACTION' } as any)
      expect(newState.bible.highlights).toEqual(state.bible.highlights)
    })
  })
})
