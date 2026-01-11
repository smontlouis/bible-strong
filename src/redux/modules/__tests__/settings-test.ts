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
jest.mock('~themes/colors', () => ({ primary: '#000', secondary: '#111' }))
jest.mock('~themes/darkColors', () => ({ primary: '#222', secondary: '#333' }))
jest.mock('~themes/blackColors', () => ({ primary: '#444', secondary: '#555' }))
jest.mock('~themes/sepiaColors', () => ({ primary: '#666', secondary: '#777' }))
jest.mock('~themes/natureColors', () => ({ primary: '#888', secondary: '#999' }))
jest.mock('~themes/sunsetColors', () => ({ primary: '#aaa', secondary: '#bbb' }))
jest.mock('~themes/mauveColors', () => ({ primary: '#ccc', secondary: '#ddd' }))
jest.mock('~themes/nightColors', () => ({ primary: '#eee', secondary: '#fff' }))

import type { Bookmark } from '~common/types'
import userReducer, { UserState } from '../user'
import {
  setSettingsAlignContent,
  setSettingsLineHeight,
  increaseSettingsFontSizeScale,
  decreaseSettingsFontSizeScale,
  setSettingsTextDisplay,
  setSettingsPreferredColorScheme,
  setSettingsPreferredLightTheme,
  setSettingsPreferredDarkTheme,
  setSettingsPress,
  setSettingsNotesDisplay,
  setSettingsLinksDisplay,
  setSettingsCommentaires,
  toggleSettingsShareVerseNumbers,
  toggleSettingsShareLineBreaks,
  toggleSettingsShareQuotes,
  toggleSettingsShareAppName,
  setDefaultColorName,
  setDefaultColorType,
  setDefaultBibleVersion,
  changeColor,
} from '../user/settings'

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
        alignContent: 'left' as const,
        lineHeight: 'normal' as const,
        fontSizeScale: 0,
        textDisplay: 'inline' as const,
        preferredColorScheme: 'auto' as const,
        preferredLightTheme: 'default' as const,
        preferredDarkTheme: 'dark' as const,
        press: 'longPress' as const,
        notesDisplay: 'inline' as const,
        linksDisplay: 'inline' as const,
        commentsDisplay: false,
        shareVerses: {
          hasVerseNumbers: true,
          hasInlineVerses: true,
          hasQuotes: true,
          hasAppName: true,
        },
        fontFamily: 'Avenir',
        theme: 'default' as const,
        colors: {
          default: { primary: '#000', secondary: '#111' },
          dark: { primary: '#222', secondary: '#333' },
          black: { primary: '#444', secondary: '#555' },
          sepia: { primary: '#666', secondary: '#777' },
          nature: { primary: '#888', secondary: '#999' },
          sunset: { primary: '#aaa', secondary: '#bbb' },
          mauve: { primary: '#ccc', secondary: '#ddd' },
          night: { primary: '#eee', secondary: '#fff' },
        },
        compare: { LSG: true },
        customHighlightColors: [],
      },
    },
  }) as unknown as UserState

// Helper to create partial state for testing
const createState = (overrides: Partial<UserState['bible']['settings']>): UserState =>
  ({
    ...getInitialState(),
    bible: {
      ...getInitialState().bible,
      settings: {
        ...getInitialState().bible.settings,
        ...overrides,
      },
    },
  }) as unknown as UserState

describe('Settings Reducer', () => {
  let initialState: UserState

  beforeEach(() => {
    initialState = getInitialState()
  })

  describe('setSettingsAlignContent', () => {
    it('should set align content to left', () => {
      const state = createState({ alignContent: 'justify' as const })
      const newState = userReducer(state, setSettingsAlignContent('left'))
      expect(newState.bible.settings.alignContent).toBe('left')
    })

    it('should set align content to justify', () => {
      const newState = userReducer(initialState, setSettingsAlignContent('justify'))
      expect(newState.bible.settings.alignContent).toBe('justify')
    })
  })

  describe('setSettingsLineHeight', () => {
    it('should set line height to normal', () => {
      const newState = userReducer(initialState, setSettingsLineHeight('normal'))
      expect(newState.bible.settings.lineHeight).toBe('normal')
    })

    it('should set line height to small', () => {
      const newState = userReducer(initialState, setSettingsLineHeight('small'))
      expect(newState.bible.settings.lineHeight).toBe('small')
    })

    it('should set line height to large', () => {
      const newState = userReducer(initialState, setSettingsLineHeight('large'))
      expect(newState.bible.settings.lineHeight).toBe('large')
    })
  })

  describe('increaseSettingsFontSizeScale', () => {
    it('should increase font size scale by 1', () => {
      const newState = userReducer(initialState, increaseSettingsFontSizeScale())
      expect(newState.bible.settings.fontSizeScale).toBe(1)
    })

    it('should not exceed 5', () => {
      const state = createState({ fontSizeScale: 5 })
      const newState = userReducer(state, increaseSettingsFontSizeScale())
      expect(newState.bible.settings.fontSizeScale).toBe(5)
    })

    it('should increase from 4 to 5', () => {
      const state = createState({ fontSizeScale: 4 })
      const newState = userReducer(state, increaseSettingsFontSizeScale())
      expect(newState.bible.settings.fontSizeScale).toBe(5)
    })
  })

  describe('decreaseSettingsFontSizeScale', () => {
    it('should decrease font size scale by 1', () => {
      const newState = userReducer(initialState, decreaseSettingsFontSizeScale())
      expect(newState.bible.settings.fontSizeScale).toBe(-1)
    })

    it('should not go below -5', () => {
      const state = createState({ fontSizeScale: -5 })
      const newState = userReducer(state, decreaseSettingsFontSizeScale())
      expect(newState.bible.settings.fontSizeScale).toBe(-5)
    })

    it('should decrease from -4 to -5', () => {
      const state = createState({ fontSizeScale: -4 })
      const newState = userReducer(state, decreaseSettingsFontSizeScale())
      expect(newState.bible.settings.fontSizeScale).toBe(-5)
    })
  })

  describe('setSettingsTextDisplay', () => {
    it('should set text display to inline', () => {
      const newState = userReducer(initialState, setSettingsTextDisplay('inline'))
      expect(newState.bible.settings.textDisplay).toBe('inline')
    })

    it('should set text display to block', () => {
      const newState = userReducer(initialState, setSettingsTextDisplay('block'))
      expect(newState.bible.settings.textDisplay).toBe('block')
    })
  })

  describe('setSettingsPreferredColorScheme', () => {
    it('should set preferred color scheme to auto', () => {
      const newState = userReducer(initialState, setSettingsPreferredColorScheme('auto'))
      expect(newState.bible.settings.preferredColorScheme).toBe('auto')
    })

    it('should set preferred color scheme to light', () => {
      const newState = userReducer(initialState, setSettingsPreferredColorScheme('light'))
      expect(newState.bible.settings.preferredColorScheme).toBe('light')
    })

    it('should set preferred color scheme to dark', () => {
      const newState = userReducer(initialState, setSettingsPreferredColorScheme('dark'))
      expect(newState.bible.settings.preferredColorScheme).toBe('dark')
    })
  })

  describe('setSettingsPreferredLightTheme', () => {
    const themes = ['default', 'sepia', 'nature', 'sunset', 'mauve'] as const
    themes.forEach(theme => {
      it(`should set preferred light theme to ${theme}`, () => {
        const newState = userReducer(initialState, setSettingsPreferredLightTheme(theme))
        expect(newState.bible.settings.preferredLightTheme).toBe(theme)
      })
    })
  })

  describe('setSettingsPreferredDarkTheme', () => {
    const themes = ['dark', 'black', 'night'] as const
    themes.forEach(theme => {
      it(`should set preferred dark theme to ${theme}`, () => {
        const newState = userReducer(initialState, setSettingsPreferredDarkTheme(theme))
        expect(newState.bible.settings.preferredDarkTheme).toBe(theme)
      })
    })
  })

  describe('setSettingsPress', () => {
    it('should set press to shortPress', () => {
      const newState = userReducer(initialState, setSettingsPress('shortPress'))
      expect(newState.bible.settings.press).toBe('shortPress')
    })

    it('should set press to longPress', () => {
      const newState = userReducer(initialState, setSettingsPress('longPress'))
      expect(newState.bible.settings.press).toBe('longPress')
    })
  })

  describe('setSettingsNotesDisplay', () => {
    it('should set notes display to inline', () => {
      const newState = userReducer(initialState, setSettingsNotesDisplay('inline'))
      expect(newState.bible.settings.notesDisplay).toBe('inline')
    })

    it('should set notes display to block', () => {
      const newState = userReducer(initialState, setSettingsNotesDisplay('block'))
      expect(newState.bible.settings.notesDisplay).toBe('block')
    })
  })

  describe('setSettingsLinksDisplay', () => {
    it('should set links display to inline', () => {
      const newState = userReducer(initialState, setSettingsLinksDisplay('inline'))
      expect(newState.bible.settings.linksDisplay).toBe('inline')
    })

    it('should set links display to block', () => {
      const newState = userReducer(initialState, setSettingsLinksDisplay('block'))
      expect(newState.bible.settings.linksDisplay).toBe('block')
    })
  })

  describe('setSettingsCommentaires', () => {
    it('should set comments display to true', () => {
      const newState = userReducer(initialState, setSettingsCommentaires(true))
      expect(newState.bible.settings.commentsDisplay).toBe(true)
    })

    it('should set comments display to false', () => {
      const state = createState({ commentsDisplay: true })
      const newState = userReducer(state, setSettingsCommentaires(false))
      expect(newState.bible.settings.commentsDisplay).toBe(false)
    })
  })

  describe('toggleSettingsShareVerseNumbers', () => {
    it('should toggle hasVerseNumbers from true to false', () => {
      const newState = userReducer(initialState, toggleSettingsShareVerseNumbers())
      expect(newState.bible.settings.shareVerses.hasVerseNumbers).toBe(false)
    })

    it('should toggle hasVerseNumbers from false to true', () => {
      const state = createState({
        shareVerses: { ...getInitialState().bible.settings.shareVerses, hasVerseNumbers: false },
      })
      const newState = userReducer(state, toggleSettingsShareVerseNumbers())
      expect(newState.bible.settings.shareVerses.hasVerseNumbers).toBe(true)
    })
  })

  describe('toggleSettingsShareLineBreaks', () => {
    it('should toggle hasInlineVerses', () => {
      const newState = userReducer(initialState, toggleSettingsShareLineBreaks())
      expect(newState.bible.settings.shareVerses.hasInlineVerses).toBe(false)
    })
  })

  describe('toggleSettingsShareQuotes', () => {
    it('should toggle hasQuotes', () => {
      const newState = userReducer(initialState, toggleSettingsShareQuotes())
      expect(newState.bible.settings.shareVerses.hasQuotes).toBe(false)
    })
  })

  describe('toggleSettingsShareAppName', () => {
    it('should toggle hasAppName', () => {
      const newState = userReducer(initialState, toggleSettingsShareAppName())
      expect(newState.bible.settings.shareVerses.hasAppName).toBe(false)
    })
  })

  describe('setDefaultColorName', () => {
    it('should set default color name', () => {
      const newState = userReducer(initialState, setDefaultColorName('color1', 'My Color'))
      expect(newState.bible.settings.defaultColorNames?.color1).toBe('My Color')
    })

    it('should create defaultColorNames object if it does not exist', () => {
      const newState = userReducer(initialState, setDefaultColorName('color2', 'Second Color'))
      expect(newState.bible.settings.defaultColorNames).toBeDefined()
      expect(newState.bible.settings.defaultColorNames?.color2).toBe('Second Color')
    })

    it('should remove color name when set to empty', () => {
      const state = createState({
        defaultColorNames: { color1: 'My Color', color2: 'Other' },
      })
      const newState = userReducer(state, setDefaultColorName('color1', ''))
      expect(newState.bible.settings.defaultColorNames?.color1).toBeUndefined()
      expect(newState.bible.settings.defaultColorNames?.color2).toBe('Other')
    })

    it('should delete defaultColorNames object when last entry removed', () => {
      const state = createState({
        defaultColorNames: { color1: 'My Color' },
      })
      const newState = userReducer(state, setDefaultColorName('color1', ''))
      expect(newState.bible.settings.defaultColorNames).toBeUndefined()
    })
  })

  describe('setDefaultColorType', () => {
    it('should set default color type to textColor', () => {
      const newState = userReducer(initialState, setDefaultColorType('color1', 'textColor'))
      expect(newState.bible.settings.defaultColorTypes?.color1).toBe('textColor')
    })

    it('should set default color type to underline', () => {
      const newState = userReducer(initialState, setDefaultColorType('color1', 'underline'))
      expect(newState.bible.settings.defaultColorTypes?.color1).toBe('underline')
    })

    it('should remove color type when set to background (default)', () => {
      const state = createState({
        defaultColorTypes: { color1: 'textColor' as const, color2: 'underline' as const },
      })
      const newState = userReducer(state, setDefaultColorType('color1', 'background'))
      expect(newState.bible.settings.defaultColorTypes?.color1).toBeUndefined()
      expect(newState.bible.settings.defaultColorTypes?.color2).toBe('underline')
    })

    it('should delete defaultColorTypes object when last entry removed', () => {
      const state = createState({
        defaultColorTypes: { color1: 'textColor' as const },
      })
      const newState = userReducer(state, setDefaultColorType('color1', 'background'))
      expect(newState.bible.settings.defaultColorTypes).toBeUndefined()
    })
  })

  describe('setDefaultBibleVersion', () => {
    it('should set default Bible version', () => {
      const newState = userReducer(initialState, setDefaultBibleVersion('KJV'))
      expect(newState.bible.settings.defaultBibleVersion).toBe('KJV')
    })
  })

  describe('changeColor', () => {
    it('should change color with provided color value', () => {
      const newState = userReducer(initialState, changeColor({ name: 'primary', color: '#ff0000' }))
      expect(newState.bible.settings.colors.default.primary).toBe('#ff0000')
    })

    it('should reset color to default when no color provided', () => {
      const state = createState({
        colors: {
          ...getInitialState().bible.settings.colors,
          default: { ...getInitialState().bible.settings.colors.default, primary: '#ff0000' },
        },
      })
      const newState = userReducer(state, changeColor({ name: 'primary' }))
      expect(newState.bible.settings.colors.default.primary).toBe('#000')
    })
  })

  describe('default case', () => {
    it('should return state unchanged for unknown action', () => {
      const newState = userReducer(initialState, { type: 'UNKNOWN_ACTION' } as any)
      expect(newState.bible.settings).toEqual(initialState.bible.settings)
    })
  })
})
