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
  versions: { LSG: {}, KJV: {}, OST: {} },
  getIfVersionNeedsUpdate: jest.fn(),
}))

jest.mock('~helpers/databases', () => ({
  databases: { STRONG: {}, NAVE: {} },
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
  setVersionUpdated,
  getVersionUpdate,
  getDatabaseUpdate,
} from '../user/versionUpdate'

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
    needsUpdate: {} as { [key: string]: boolean },
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

describe('Version Update Reducer', () => {
  let initialState: UserState

  beforeEach(() => {
    initialState = getInitialState()
  })

  describe('getVersionUpdate.fulfilled', () => {
    it('should set version update status', () => {
      const action = {
        type: getVersionUpdate.fulfilled.type,
        payload: { LSG: true, KJV: false, OST: true },
      }
      const newState = userReducer(initialState, action)
      expect(newState.needsUpdate.LSG).toBe(true)
      expect(newState.needsUpdate.KJV).toBe(false)
      expect(newState.needsUpdate.OST).toBe(true)
    })

    it('should merge with existing update status', () => {
      const state = {
        ...initialState,
        needsUpdate: { LSG: true, KJV: false },
      } as UserState
      const action = {
        type: getVersionUpdate.fulfilled.type,
        payload: { OST: true, NBS: false },
      }
      const newState = userReducer(state, action)
      expect(newState.needsUpdate.LSG).toBe(true)
      expect(newState.needsUpdate.KJV).toBe(false)
      expect(newState.needsUpdate.OST).toBe(true)
      expect(newState.needsUpdate.NBS).toBe(false)
    })

    it('should override existing version status', () => {
      const state = {
        ...initialState,
        needsUpdate: { LSG: true },
      } as UserState
      const action = {
        type: getVersionUpdate.fulfilled.type,
        payload: { LSG: false },
      }
      const newState = userReducer(state, action)
      expect(newState.needsUpdate.LSG).toBe(false)
    })

    it('should handle empty payload', () => {
      const state = {
        ...initialState,
        needsUpdate: { LSG: true },
      } as UserState
      const action = {
        type: getVersionUpdate.fulfilled.type,
        payload: {},
      }
      const newState = userReducer(state, action)
      expect(newState.needsUpdate.LSG).toBe(true)
    })
  })

  describe('getDatabaseUpdate.fulfilled', () => {
    it('should set database update status', () => {
      const action = {
        type: getDatabaseUpdate.fulfilled.type,
        payload: { STRONG: true, NAVE: false },
      }
      const newState = userReducer(initialState, action)
      expect(newState.needsUpdate.STRONG).toBe(true)
      expect(newState.needsUpdate.NAVE).toBe(false)
    })

    it('should merge with existing update status', () => {
      const state = {
        ...initialState,
        needsUpdate: { LSG: true },
      } as UserState
      const action = {
        type: getDatabaseUpdate.fulfilled.type,
        payload: { STRONG: true },
      }
      const newState = userReducer(state, action)
      expect(newState.needsUpdate.LSG).toBe(true)
      expect(newState.needsUpdate.STRONG).toBe(true)
    })
  })

  describe('setVersionUpdated', () => {
    it('should set version as updated (false)', () => {
      const state = {
        ...initialState,
        needsUpdate: { LSG: true, KJV: true },
      } as UserState
      const newState = userReducer(state, setVersionUpdated('LSG'))
      expect(newState.needsUpdate.LSG).toBe(false)
      expect(newState.needsUpdate.KJV).toBe(true)
    })

    it('should set database as updated (false)', () => {
      const state = {
        ...initialState,
        needsUpdate: { STRONG: true, NAVE: true },
      } as UserState
      const newState = userReducer(state, setVersionUpdated('STRONG'))
      expect(newState.needsUpdate.STRONG).toBe(false)
      expect(newState.needsUpdate.NAVE).toBe(true)
    })

    it('should handle setting non-existent version as updated', () => {
      const newState = userReducer(initialState, setVersionUpdated('NEW_VERSION'))
      expect(newState.needsUpdate.NEW_VERSION).toBe(false)
    })

    it('should not affect other versions', () => {
      const state = {
        ...initialState,
        needsUpdate: { LSG: true, KJV: true, OST: false },
      } as UserState
      const newState = userReducer(state, setVersionUpdated('LSG'))
      expect(newState.needsUpdate.LSG).toBe(false)
      expect(newState.needsUpdate.KJV).toBe(true)
      expect(newState.needsUpdate.OST).toBe(false)
    })
  })

  describe('default case', () => {
    it('should return state unchanged for unknown action', () => {
      const state = {
        ...initialState,
        needsUpdate: { LSG: true },
      } as UserState
      const newState = userReducer(state, { type: 'UNKNOWN_ACTION' } as any)
      expect(newState.needsUpdate).toEqual(state.needsUpdate)
    })
  })

  describe('integration scenarios', () => {
    it('should handle full update check and marking as updated', () => {
      // Simulate initial check showing all need update
      let state = userReducer(initialState, {
        type: getVersionUpdate.fulfilled.type,
        payload: { LSG: true, KJV: true, OST: true },
      })
      expect(state.needsUpdate.LSG).toBe(true)
      expect(state.needsUpdate.KJV).toBe(true)
      expect(state.needsUpdate.OST).toBe(true)

      // User updates LSG
      state = userReducer(state, setVersionUpdated('LSG'))
      expect(state.needsUpdate.LSG).toBe(false)
      expect(state.needsUpdate.KJV).toBe(true)
      expect(state.needsUpdate.OST).toBe(true)

      // User updates KJV
      state = userReducer(state, setVersionUpdated('KJV'))
      expect(state.needsUpdate.LSG).toBe(false)
      expect(state.needsUpdate.KJV).toBe(false)
      expect(state.needsUpdate.OST).toBe(true)

      // New check shows only OST needs update
      state = userReducer(state, {
        type: getVersionUpdate.fulfilled.type,
        payload: { LSG: false, KJV: false, OST: true },
      })
      expect(state.needsUpdate.LSG).toBe(false)
      expect(state.needsUpdate.KJV).toBe(false)
      expect(state.needsUpdate.OST).toBe(true)
    })
  })
})
