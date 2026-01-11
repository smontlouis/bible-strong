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

// Mock generateUUID to return predictable values
jest.mock('~helpers/generateUUID', () => {
  let counter = 0
  return jest.fn(() => `uuid-${++counter}`)
})

import type { Bookmark } from '~common/types'
import userReducer, { UserState, CustomColor, HighlightType } from '../user'
import { addCustomColor, updateCustomColor, deleteCustomColor } from '../user/customColors'

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

const createCustomColor = (id: string, overrides?: Partial<CustomColor>): CustomColor => ({
  id,
  hex: '#ff0000',
  createdAt: Date.now(),
  ...overrides,
})

describe('Custom Colors Reducer', () => {
  let initialState: UserState

  beforeEach(() => {
    initialState = getInitialState()
    jest.clearAllMocks()
  })

  describe('addCustomColor', () => {
    it('should add a custom color', () => {
      const action = addCustomColor('#ff0000')
      const newState = userReducer(initialState, action)
      expect(newState.bible.settings.customHighlightColors).toHaveLength(1)
      expect(newState.bible.settings.customHighlightColors[0].hex).toBe('#ff0000')
      expect(newState.bible.settings.customHighlightColors[0].id).toMatch(/^custom-uuid-/)
    })

    it('should add custom color with name', () => {
      const action = addCustomColor('#ff0000', 'My Red')
      const newState = userReducer(initialState, action)
      expect(newState.bible.settings.customHighlightColors[0].name).toBe('My Red')
    })

    it('should add custom color with type', () => {
      const action = addCustomColor('#ff0000', undefined, 'textColor')
      const newState = userReducer(initialState, action)
      expect(newState.bible.settings.customHighlightColors[0].type).toBe('textColor')
    })

    it('should add multiple custom colors', () => {
      let state = userReducer(initialState, addCustomColor('#ff0000'))
      state = userReducer(state, addCustomColor('#00ff00'))
      state = userReducer(state, addCustomColor('#0000ff'))
      expect(state.bible.settings.customHighlightColors).toHaveLength(3)
    })

    it('should not exceed maximum of 5 custom colors', () => {
      let state = initialState
      for (let i = 0; i < 7; i++) {
        state = userReducer(state, addCustomColor(`#ff000${i}`))
      }
      expect(state.bible.settings.customHighlightColors).toHaveLength(5)
    })

    it('should allow exactly 5 custom colors', () => {
      let state = initialState
      for (let i = 0; i < 5; i++) {
        state = userReducer(state, addCustomColor(`#ff000${i}`))
      }
      expect(state.bible.settings.customHighlightColors).toHaveLength(5)
    })
  })

  describe('updateCustomColor', () => {
    it('should update color hex', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          settings: {
            ...initialState.bible.settings,
            customHighlightColors: [createCustomColor('custom-1', { hex: '#ff0000' })],
          },
        },
      } as UserState
      const newState = userReducer(state, updateCustomColor('custom-1', '#00ff00'))
      expect(newState.bible.settings.customHighlightColors[0].hex).toBe('#00ff00')
    })

    it('should update color name', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          settings: {
            ...initialState.bible.settings,
            customHighlightColors: [createCustomColor('custom-1')],
          },
        },
      } as UserState
      const newState = userReducer(state, updateCustomColor('custom-1', '#ff0000', 'New Name'))
      expect(newState.bible.settings.customHighlightColors[0].name).toBe('New Name')
    })

    it('should update color type', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          settings: {
            ...initialState.bible.settings,
            customHighlightColors: [createCustomColor('custom-1')],
          },
        },
      } as UserState
      const newState = userReducer(
        state,
        updateCustomColor('custom-1', '#ff0000', undefined, 'underline')
      )
      expect(newState.bible.settings.customHighlightColors[0].type).toBe('underline')
    })

    it('should update multiple properties at once', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          settings: {
            ...initialState.bible.settings,
            customHighlightColors: [
              createCustomColor('custom-1', { hex: '#ff0000', name: 'Old', type: 'background' }),
            ],
          },
        },
      } as UserState
      const newState = userReducer(state, updateCustomColor('custom-1', '#00ff00', 'New', 'textColor'))
      expect(newState.bible.settings.customHighlightColors[0].hex).toBe('#00ff00')
      expect(newState.bible.settings.customHighlightColors[0].name).toBe('New')
      expect(newState.bible.settings.customHighlightColors[0].type).toBe('textColor')
    })

    it('should preserve createdAt when updating', () => {
      const originalCreatedAt = Date.now() - 10000
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          settings: {
            ...initialState.bible.settings,
            customHighlightColors: [createCustomColor('custom-1', { createdAt: originalCreatedAt })],
          },
        },
      } as UserState
      const newState = userReducer(state, updateCustomColor('custom-1', '#00ff00'))
      expect(newState.bible.settings.customHighlightColors[0].createdAt).toBe(originalCreatedAt)
    })

    it('should not update if color id not found', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          settings: {
            ...initialState.bible.settings,
            customHighlightColors: [createCustomColor('custom-1', { hex: '#ff0000' })],
          },
        },
      } as UserState
      const newState = userReducer(state, updateCustomColor('custom-999', '#00ff00'))
      expect(newState.bible.settings.customHighlightColors[0].hex).toBe('#ff0000')
    })

    it('should update correct color when multiple exist', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          settings: {
            ...initialState.bible.settings,
            customHighlightColors: [
              createCustomColor('custom-1', { hex: '#ff0000' }),
              createCustomColor('custom-2', { hex: '#00ff00' }),
              createCustomColor('custom-3', { hex: '#0000ff' }),
            ],
          },
        },
      } as UserState
      const newState = userReducer(state, updateCustomColor('custom-2', '#ffff00'))
      expect(newState.bible.settings.customHighlightColors[0].hex).toBe('#ff0000')
      expect(newState.bible.settings.customHighlightColors[1].hex).toBe('#ffff00')
      expect(newState.bible.settings.customHighlightColors[2].hex).toBe('#0000ff')
    })
  })

  describe('deleteCustomColor', () => {
    it('should delete a custom color', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          settings: {
            ...initialState.bible.settings,
            customHighlightColors: [createCustomColor('custom-1'), createCustomColor('custom-2')],
          },
        },
      } as UserState
      const newState = userReducer(state, deleteCustomColor('custom-1'))
      expect(newState.bible.settings.customHighlightColors).toHaveLength(1)
      expect(newState.bible.settings.customHighlightColors[0].id).toBe('custom-2')
    })

    it('should handle deleting the only color', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          settings: {
            ...initialState.bible.settings,
            customHighlightColors: [createCustomColor('custom-1')],
          },
        },
      } as UserState
      const newState = userReducer(state, deleteCustomColor('custom-1'))
      expect(newState.bible.settings.customHighlightColors).toHaveLength(0)
    })

    it('should handle deleting non-existent color', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          settings: {
            ...initialState.bible.settings,
            customHighlightColors: [createCustomColor('custom-1')],
          },
        },
      } as UserState
      const newState = userReducer(state, deleteCustomColor('custom-999'))
      expect(newState.bible.settings.customHighlightColors).toHaveLength(1)
    })

    it('should delete correct color when multiple exist', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          settings: {
            ...initialState.bible.settings,
            customHighlightColors: [
              createCustomColor('custom-1'),
              createCustomColor('custom-2'),
              createCustomColor('custom-3'),
            ],
          },
        },
      } as UserState
      const newState = userReducer(state, deleteCustomColor('custom-2'))
      expect(newState.bible.settings.customHighlightColors).toHaveLength(2)
      expect(newState.bible.settings.customHighlightColors[0].id).toBe('custom-1')
      expect(newState.bible.settings.customHighlightColors[1].id).toBe('custom-3')
    })
  })

  describe('default case', () => {
    it('should return state unchanged for unknown action', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          settings: {
            ...initialState.bible.settings,
            customHighlightColors: [createCustomColor('custom-1')],
          },
        },
      } as UserState
      const newState = userReducer(state, { type: 'UNKNOWN_ACTION' } as any)
      expect(newState.bible.settings.customHighlightColors).toEqual(
        state.bible.settings.customHighlightColors
      )
    })
  })

  describe('highlight types', () => {
    const types: HighlightType[] = ['background', 'textColor', 'underline']
    types.forEach(type => {
      it(`should support ${type} type`, () => {
        const action = addCustomColor('#ff0000', undefined, type)
        const newState = userReducer(initialState, action)
        expect(newState.bible.settings.customHighlightColors[0].type).toBe(type)
      })
    })
  })
})
