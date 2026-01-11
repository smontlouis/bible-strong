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
import userReducer, { UserState, Note, NotesObj } from '../user'
import { addNoteAction, deleteNote } from '../user/notes'

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
      notes: {} as NotesObj,
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

const createNote = (overrides?: Partial<Note>): Note => ({
  title: 'Test Note',
  description: 'This is a test note',
  date: Date.now(),
  ...overrides,
})

describe('Notes Reducer', () => {
  let initialState: UserState

  beforeEach(() => {
    initialState = getInitialState()
  })

  describe('addNoteAction', () => {
    it('should add a note', () => {
      const note = createNote()
      const newState = userReducer(initialState, addNoteAction({ '1-1-1': note }))
      expect(newState.bible.notes['1-1-1']).toBeDefined()
      expect(newState.bible.notes['1-1-1'].title).toBe('Test Note')
      expect(newState.bible.notes['1-1-1'].description).toBe('This is a test note')
    })

    it('should add note with multiple verse keys', () => {
      const note = createNote()
      const newState = userReducer(initialState, addNoteAction({ '1-1-1/1-1-2/1-1-3': note }))
      expect(newState.bible.notes['1-1-1/1-1-2/1-1-3']).toBeDefined()
    })

    it('should merge with existing notes', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          notes: {
            '1-1-1': createNote({ title: 'Existing Note' }),
          },
        },
      } as UserState
      const newState = userReducer(state, addNoteAction({ '1-1-2': createNote({ title: 'New Note' }) }))
      expect(newState.bible.notes['1-1-1'].title).toBe('Existing Note')
      expect(newState.bible.notes['1-1-2'].title).toBe('New Note')
    })

    it('should overwrite existing note with same key', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          notes: {
            '1-1-1': createNote({ title: 'Old Note' }),
          },
        },
      } as UserState
      const newState = userReducer(
        state,
        addNoteAction({ '1-1-1': createNote({ title: 'Updated Note' }) })
      )
      expect(newState.bible.notes['1-1-1'].title).toBe('Updated Note')
    })

    it('should preserve tags on note', () => {
      const note = createNote({
        tags: { 'tag-1': { id: 'tag-1', name: 'Test', date: Date.now() } },
      })
      const newState = userReducer(initialState, addNoteAction({ '1-1-1': note }))
      expect(newState.bible.notes['1-1-1'].tags?.['tag-1'].id).toBe('tag-1')
      expect(newState.bible.notes['1-1-1'].tags?.['tag-1'].name).toBe('Test')
    })
  })

  describe('deleteNote', () => {
    it('should remove a note', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          notes: {
            '1-1-1': createNote(),
            '1-1-2': createNote(),
          },
        },
      } as UserState
      const newState = userReducer(state, deleteNote('1-1-1'))
      expect(newState.bible.notes['1-1-1']).toBeUndefined()
      expect(newState.bible.notes['1-1-2']).toBeDefined()
    })

    it('should remove note with composite key', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          notes: {
            '1-1-1/1-1-2': createNote(),
          },
        },
      } as UserState
      const newState = userReducer(state, deleteNote('1-1-1/1-1-2'))
      expect(newState.bible.notes['1-1-1/1-1-2']).toBeUndefined()
    })

    it('should remove note references from tags', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          notes: {
            '1-1-1': createNote({
              tags: { 'tag-1': { id: 'tag-1', name: 'Test', date: Date.now() } },
            }),
          },
          tags: {
            'tag-1': {
              id: 'tag-1',
              name: 'Test',
              date: Date.now(),
              notes: { '1-1-1': true },
            },
          },
        },
      } as UserState
      const newState = userReducer(state, deleteNote('1-1-1'))
      expect(newState.bible.notes['1-1-1']).toBeUndefined()
      expect(newState.bible.tags['tag-1'].notes?.['1-1-1']).toBeUndefined()
    })

    it('should handle removing non-existent note', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          notes: {
            '1-1-1': createNote(),
          },
        },
      } as UserState
      const newState = userReducer(state, deleteNote('1-1-99'))
      expect(newState.bible.notes['1-1-1']).toBeDefined()
    })
  })

  describe('default case', () => {
    it('should return state unchanged for unknown action', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          notes: {
            '1-1-1': createNote(),
          },
        },
      } as UserState
      const newState = userReducer(state, { type: 'UNKNOWN_ACTION' } as any)
      expect(newState.bible.notes).toEqual(state.bible.notes)
    })
  })
})
