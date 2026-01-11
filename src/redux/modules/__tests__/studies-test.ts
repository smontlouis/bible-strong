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
import userReducer, { UserState, Study, StudiesObj } from '../user'
import { updateStudy, addStudies, deleteStudy, publishStudyAction } from '../user/studies'

const getInitialState = (): UserState =>
  ({
    id: 'user-123',
    email: '',
    displayName: 'Test User',
    photoURL: 'https://example.com/photo.jpg',
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
      studies: {} as StudiesObj,
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

const createStudy = (id: string, overrides?: Partial<Study>): Study => ({
  id,
  title: `Study ${id}`,
  created_at: Date.now(),
  modified_at: Date.now(),
  content: { ops: ['Test content'] },
  user: {
    id: 'user-123',
    displayName: 'Test User',
    photoUrl: 'https://example.com/photo.jpg',
  },
  ...overrides,
})

describe('Studies Reducer', () => {
  let initialState: UserState

  beforeEach(() => {
    initialState = getInitialState()
  })

  describe('updateStudy', () => {
    it('should create a new study', () => {
      const newState = userReducer(
        initialState,
        updateStudy({
          id: 'study-1',
          title: 'New Study',
          content: { ops: ['Content'] } as any,
          created_at: Date.now(),
          modified_at: Date.now(),
        })
      )
      expect(newState.bible.studies['study-1']).toBeDefined()
      expect(newState.bible.studies['study-1'].title).toBe('New Study')
    })

    it('should update existing study', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          studies: {
            'study-1': createStudy('study-1', { title: 'Old Title' }),
          },
        },
      } as UserState
      const newState = userReducer(
        state,
        updateStudy({
          id: 'study-1',
          title: 'New Title',
        })
      )
      expect(newState.bible.studies['study-1'].title).toBe('New Title')
    })

    it('should preserve existing properties when updating', () => {
      const originalCreatedAt = Date.now() - 10000
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          studies: {
            'study-1': createStudy('study-1', {
              created_at: originalCreatedAt,
              published: true,
            }),
          },
        },
      } as UserState
      const newState = userReducer(
        state,
        updateStudy({
          id: 'study-1',
          title: 'Updated Title',
        })
      )
      expect(newState.bible.studies['study-1'].created_at).toBe(originalCreatedAt)
      expect(newState.bible.studies['study-1'].published).toBe(true)
    })

    it('should update user info from current state', () => {
      const newState = userReducer(
        initialState,
        updateStudy({
          id: 'study-1',
          title: 'New Study',
        })
      )
      expect(newState.bible.studies['study-1'].user.id).toBe('user-123')
      expect(newState.bible.studies['study-1'].user.displayName).toBe('Test User')
      expect(newState.bible.studies['study-1'].user.photoUrl).toBe('https://example.com/photo.jpg')
    })

    it('should update content', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          studies: {
            'study-1': createStudy('study-1'),
          },
        },
      } as UserState
      const newContent = { ops: ['Updated content'] }
      const newState = userReducer(
        state,
        updateStudy({
          id: 'study-1',
          content: newContent as any,
        })
      )
      expect(newState.bible.studies['study-1'].content).toEqual(newContent)
    })

    it('should update tags', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          studies: {
            'study-1': createStudy('study-1'),
          },
        },
      } as UserState
      const tags = { 'tag-1': { id: 'tag-1', name: 'Test' } }
      const newState = userReducer(
        state,
        updateStudy({
          id: 'study-1',
          tags,
        })
      )
      expect(newState.bible.studies['study-1'].tags).toEqual(tags)
    })

    it('should update modified_at', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          studies: {
            'study-1': createStudy('study-1', { modified_at: Date.now() - 10000 }),
          },
        },
      } as UserState
      const newModifiedAt = Date.now()
      const newState = userReducer(
        state,
        updateStudy({
          id: 'study-1',
          modified_at: newModifiedAt,
        })
      )
      expect(newState.bible.studies['study-1'].modified_at).toBe(newModifiedAt)
    })
  })

  describe('deleteStudy', () => {
    it('should delete a study', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          studies: {
            'study-1': createStudy('study-1'),
            'study-2': createStudy('study-2'),
          },
        },
      } as UserState
      const newState = userReducer(state, deleteStudy('study-1'))
      expect(newState.bible.studies['study-1']).toBeUndefined()
      expect(newState.bible.studies['study-2']).toBeDefined()
    })

    it('should remove study references from tags', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          studies: {
            'study-1': createStudy('study-1', {
              tags: { 'tag-1': { id: 'tag-1', name: 'Test', date: Date.now() } },
            }),
          },
          tags: {
            'tag-1': {
              id: 'tag-1',
              name: 'Test',
              date: Date.now(),
              studies: { 'study-1': true },
            },
          },
        },
      } as UserState
      const newState = userReducer(state, deleteStudy('study-1'))
      expect(newState.bible.studies['study-1']).toBeUndefined()
      expect(newState.bible.tags['tag-1'].studies?.['study-1']).toBeUndefined()
    })

    it('should handle deleting non-existent study', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          studies: {
            'study-1': createStudy('study-1'),
          },
        },
      } as UserState
      const newState = userReducer(state, deleteStudy('non-existent'))
      expect(newState.bible.studies['study-1']).toBeDefined()
    })
  })

  describe('publishStudyAction', () => {
    it('should set published to true', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          studies: {
            'study-1': createStudy('study-1', { published: false }),
          },
        },
      } as UserState
      const newState = userReducer(state, publishStudyAction('study-1', true))
      expect(newState.bible.studies['study-1'].published).toBe(true)
    })

    it('should set published to false (unpublish)', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          studies: {
            'study-1': createStudy('study-1', { published: true }),
          },
        },
      } as UserState
      const newState = userReducer(state, publishStudyAction('study-1', false))
      expect(newState.bible.studies['study-1'].published).toBe(false)
    })

    it('should update modified_at when publishing', () => {
      const oldModifiedAt = Date.now() - 10000
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          studies: {
            'study-1': createStudy('study-1', { modified_at: oldModifiedAt }),
          },
        },
      } as UserState
      const beforePublish = Date.now()
      const newState = userReducer(state, publishStudyAction('study-1', true))
      expect(newState.bible.studies['study-1'].modified_at).toBeGreaterThanOrEqual(beforePublish)
    })
  })

  describe('addStudies', () => {
    it('should replace all studies', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          studies: {
            'study-1': createStudy('study-1'),
          },
        },
      } as UserState
      const newStudies = {
        'study-2': createStudy('study-2'),
        'study-3': createStudy('study-3'),
      }
      const newState = userReducer(state, addStudies(newStudies))
      expect(newState.bible.studies['study-1']).toBeUndefined()
      expect(newState.bible.studies['study-2']).toBeDefined()
      expect(newState.bible.studies['study-3']).toBeDefined()
    })

    it('should set empty studies', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          studies: {
            'study-1': createStudy('study-1'),
          },
        },
      } as UserState
      const newState = userReducer(state, addStudies({}))
      expect(Object.keys(newState.bible.studies)).toHaveLength(0)
    })
  })

  describe('default case', () => {
    it('should return state unchanged for unknown action', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          studies: {
            'study-1': createStudy('study-1'),
          },
        },
      } as UserState
      const newState = userReducer(state, { type: 'UNKNOWN_ACTION' } as any)
      expect(newState.bible.studies).toEqual(state.bible.studies)
    })
  })
})
