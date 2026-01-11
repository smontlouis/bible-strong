/* eslint-env jest */

import settingsReducer, {
  SET_SETTINGS_ALIGN_CONTENT,
  SET_SETTINGS_LINE_HEIGHT,
  INCREASE_SETTINGS_FONTSIZE_SCALE,
  DECREASE_SETTINGS_FONTSIZE_SCALE,
  SET_SETTINGS_TEXT_DISPLAY,
  SET_SETTINGS_PRESS,
  SET_SETTINGS_NOTES_DISPLAY,
  SET_SETTINGS_LINKS_DISPLAY,
  SET_SETTINGS_COMMENTS_DISPLAY,
  SET_SETTINGS_PREFERRED_COLOR_SCHEME,
  SET_SETTINGS_PREFERRED_LIGHT_THEME,
  SET_SETTINGS_PREFERRED_DARK_THEME,
  TOGGLE_SETTINGS_SHARE_VERSE_NUMBERS,
  TOGGLE_SETTINGS_SHARE_INLINE_VERSES,
  TOGGLE_SETTINGS_SHARE_QUOTES,
  TOGGLE_SETTINGS_SHARE_APP_NAME,
  SET_DEFAULT_COLOR_NAME,
  SET_DEFAULT_COLOR_TYPE,
  SET_DEFAULT_BIBLE_VERSION,
  CHANGE_COLOR,
} from '../user/settings'
import type { UserState } from '../user'

// Mock react-native Appearance
jest.mock('react-native', () => ({
  Appearance: {
    getColorScheme: jest.fn(() => 'light'),
  },
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

const getInitialState = () =>
  ({
    bible: {
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
    bible: {
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

  describe('SET_SETTINGS_ALIGN_CONTENT', () => {
    it('should set align content to left', () => {
      const state = createState({ alignContent: 'justify' as const })
      const newState = settingsReducer(state, {
        type: SET_SETTINGS_ALIGN_CONTENT,
        payload: 'left',
      })
      expect(newState.bible.settings.alignContent).toBe('left')
    })

    it('should set align content to justify', () => {
      const newState = settingsReducer(initialState, {
        type: SET_SETTINGS_ALIGN_CONTENT,
        payload: 'justify',
      })
      expect(newState.bible.settings.alignContent).toBe('justify')
    })
  })

  describe('SET_SETTINGS_LINE_HEIGHT', () => {
    it('should set line height to normal', () => {
      const newState = settingsReducer(initialState, {
        type: SET_SETTINGS_LINE_HEIGHT,
        payload: 'normal',
      })
      expect(newState.bible.settings.lineHeight).toBe('normal')
    })

    it('should set line height to small', () => {
      const newState = settingsReducer(initialState, {
        type: SET_SETTINGS_LINE_HEIGHT,
        payload: 'small',
      })
      expect(newState.bible.settings.lineHeight).toBe('small')
    })

    it('should set line height to large', () => {
      const newState = settingsReducer(initialState, {
        type: SET_SETTINGS_LINE_HEIGHT,
        payload: 'large',
      })
      expect(newState.bible.settings.lineHeight).toBe('large')
    })
  })

  describe('INCREASE_SETTINGS_FONTSIZE_SCALE', () => {
    it('should increase font size scale by 1', () => {
      const newState = settingsReducer(initialState, {
        type: INCREASE_SETTINGS_FONTSIZE_SCALE,
      })
      expect(newState.bible.settings.fontSizeScale).toBe(1)
    })

    it('should not exceed 5', () => {
      const state = createState({ fontSizeScale: 5 })
      const newState = settingsReducer(state, {
        type: INCREASE_SETTINGS_FONTSIZE_SCALE,
      })
      expect(newState.bible.settings.fontSizeScale).toBe(5)
    })

    it('should increase from 4 to 5', () => {
      const state = createState({ fontSizeScale: 4 })
      const newState = settingsReducer(state, {
        type: INCREASE_SETTINGS_FONTSIZE_SCALE,
      })
      expect(newState.bible.settings.fontSizeScale).toBe(5)
    })
  })

  describe('DECREASE_SETTINGS_FONTSIZE_SCALE', () => {
    it('should decrease font size scale by 1', () => {
      const newState = settingsReducer(initialState, {
        type: DECREASE_SETTINGS_FONTSIZE_SCALE,
      })
      expect(newState.bible.settings.fontSizeScale).toBe(-1)
    })

    it('should not go below -5', () => {
      const state = createState({ fontSizeScale: -5 })
      const newState = settingsReducer(state, {
        type: DECREASE_SETTINGS_FONTSIZE_SCALE,
      })
      expect(newState.bible.settings.fontSizeScale).toBe(-5)
    })

    it('should decrease from -4 to -5', () => {
      const state = createState({ fontSizeScale: -4 })
      const newState = settingsReducer(state, {
        type: DECREASE_SETTINGS_FONTSIZE_SCALE,
      })
      expect(newState.bible.settings.fontSizeScale).toBe(-5)
    })
  })

  describe('SET_SETTINGS_TEXT_DISPLAY', () => {
    it('should set text display to inline', () => {
      const newState = settingsReducer(initialState, {
        type: SET_SETTINGS_TEXT_DISPLAY,
        payload: 'inline',
      })
      expect(newState.bible.settings.textDisplay).toBe('inline')
    })

    it('should set text display to block', () => {
      const newState = settingsReducer(initialState, {
        type: SET_SETTINGS_TEXT_DISPLAY,
        payload: 'block',
      })
      expect(newState.bible.settings.textDisplay).toBe('block')
    })
  })

  describe('SET_SETTINGS_PREFERRED_COLOR_SCHEME', () => {
    it('should set preferred color scheme to auto', () => {
      const newState = settingsReducer(initialState, {
        type: SET_SETTINGS_PREFERRED_COLOR_SCHEME,
        payload: 'auto',
      })
      expect(newState.bible.settings.preferredColorScheme).toBe('auto')
    })

    it('should set preferred color scheme to light', () => {
      const newState = settingsReducer(initialState, {
        type: SET_SETTINGS_PREFERRED_COLOR_SCHEME,
        payload: 'light',
      })
      expect(newState.bible.settings.preferredColorScheme).toBe('light')
    })

    it('should set preferred color scheme to dark', () => {
      const newState = settingsReducer(initialState, {
        type: SET_SETTINGS_PREFERRED_COLOR_SCHEME,
        payload: 'dark',
      })
      expect(newState.bible.settings.preferredColorScheme).toBe('dark')
    })
  })

  describe('SET_SETTINGS_PREFERRED_LIGHT_THEME', () => {
    const themes = ['default', 'sepia', 'nature', 'sunset', 'mauve'] as const
    themes.forEach(theme => {
      it(`should set preferred light theme to ${theme}`, () => {
        const newState = settingsReducer(initialState, {
          type: SET_SETTINGS_PREFERRED_LIGHT_THEME,
          payload: theme,
        })
        expect(newState.bible.settings.preferredLightTheme).toBe(theme)
      })
    })
  })

  describe('SET_SETTINGS_PREFERRED_DARK_THEME', () => {
    const themes = ['dark', 'black', 'night'] as const
    themes.forEach(theme => {
      it(`should set preferred dark theme to ${theme}`, () => {
        const newState = settingsReducer(initialState, {
          type: SET_SETTINGS_PREFERRED_DARK_THEME,
          payload: theme,
        })
        expect(newState.bible.settings.preferredDarkTheme).toBe(theme)
      })
    })
  })

  describe('SET_SETTINGS_PRESS', () => {
    it('should set press to shortPress', () => {
      const newState = settingsReducer(initialState, {
        type: SET_SETTINGS_PRESS,
        payload: 'shortPress',
      })
      expect(newState.bible.settings.press).toBe('shortPress')
    })

    it('should set press to longPress', () => {
      const newState = settingsReducer(initialState, {
        type: SET_SETTINGS_PRESS,
        payload: 'longPress',
      })
      expect(newState.bible.settings.press).toBe('longPress')
    })
  })

  describe('SET_SETTINGS_NOTES_DISPLAY', () => {
    it('should set notes display to inline', () => {
      const newState = settingsReducer(initialState, {
        type: SET_SETTINGS_NOTES_DISPLAY,
        payload: 'inline',
      })
      expect(newState.bible.settings.notesDisplay).toBe('inline')
    })

    it('should set notes display to block', () => {
      const newState = settingsReducer(initialState, {
        type: SET_SETTINGS_NOTES_DISPLAY,
        payload: 'block',
      })
      expect(newState.bible.settings.notesDisplay).toBe('block')
    })
  })

  describe('SET_SETTINGS_LINKS_DISPLAY', () => {
    it('should set links display to inline', () => {
      const newState = settingsReducer(initialState, {
        type: SET_SETTINGS_LINKS_DISPLAY,
        payload: 'inline',
      })
      expect(newState.bible.settings.linksDisplay).toBe('inline')
    })

    it('should set links display to block', () => {
      const newState = settingsReducer(initialState, {
        type: SET_SETTINGS_LINKS_DISPLAY,
        payload: 'block',
      })
      expect(newState.bible.settings.linksDisplay).toBe('block')
    })
  })

  describe('SET_SETTINGS_COMMENTS_DISPLAY', () => {
    it('should set comments display to true', () => {
      const newState = settingsReducer(initialState, {
        type: SET_SETTINGS_COMMENTS_DISPLAY,
        payload: true,
      })
      expect(newState.bible.settings.commentsDisplay).toBe(true)
    })

    it('should set comments display to false', () => {
      const state = createState({ commentsDisplay: true })
      const newState = settingsReducer(state, {
        type: SET_SETTINGS_COMMENTS_DISPLAY,
        payload: false,
      })
      expect(newState.bible.settings.commentsDisplay).toBe(false)
    })
  })

  describe('TOGGLE_SETTINGS_SHARE_VERSE_NUMBERS', () => {
    it('should toggle hasVerseNumbers from true to false', () => {
      const newState = settingsReducer(initialState, {
        type: TOGGLE_SETTINGS_SHARE_VERSE_NUMBERS,
      })
      expect(newState.bible.settings.shareVerses.hasVerseNumbers).toBe(false)
    })

    it('should toggle hasVerseNumbers from false to true', () => {
      const state = createState({
        shareVerses: { ...getInitialState().bible.settings.shareVerses, hasVerseNumbers: false },
      })
      const newState = settingsReducer(state, {
        type: TOGGLE_SETTINGS_SHARE_VERSE_NUMBERS,
      })
      expect(newState.bible.settings.shareVerses.hasVerseNumbers).toBe(true)
    })
  })

  describe('TOGGLE_SETTINGS_SHARE_INLINE_VERSES', () => {
    it('should toggle hasInlineVerses', () => {
      const newState = settingsReducer(initialState, {
        type: TOGGLE_SETTINGS_SHARE_INLINE_VERSES,
      })
      expect(newState.bible.settings.shareVerses.hasInlineVerses).toBe(false)
    })
  })

  describe('TOGGLE_SETTINGS_SHARE_QUOTES', () => {
    it('should toggle hasQuotes', () => {
      const newState = settingsReducer(initialState, {
        type: TOGGLE_SETTINGS_SHARE_QUOTES,
      })
      expect(newState.bible.settings.shareVerses.hasQuotes).toBe(false)
    })
  })

  describe('TOGGLE_SETTINGS_SHARE_APP_NAME', () => {
    it('should toggle hasAppName', () => {
      const newState = settingsReducer(initialState, {
        type: TOGGLE_SETTINGS_SHARE_APP_NAME,
      })
      expect(newState.bible.settings.shareVerses.hasAppName).toBe(false)
    })
  })

  describe('SET_DEFAULT_COLOR_NAME', () => {
    it('should set default color name', () => {
      const newState = settingsReducer(initialState, {
        type: SET_DEFAULT_COLOR_NAME,
        payload: { colorKey: 'color1', name: 'My Color' },
      })
      expect(newState.bible.settings.defaultColorNames?.color1).toBe('My Color')
    })

    it('should create defaultColorNames object if it does not exist', () => {
      const newState = settingsReducer(initialState, {
        type: SET_DEFAULT_COLOR_NAME,
        payload: { colorKey: 'color2', name: 'Second Color' },
      })
      expect(newState.bible.settings.defaultColorNames).toBeDefined()
      expect(newState.bible.settings.defaultColorNames?.color2).toBe('Second Color')
    })

    it('should remove color name when set to empty', () => {
      const state = createState({
        defaultColorNames: { color1: 'My Color', color2: 'Other' },
      })
      const newState = settingsReducer(state, {
        type: SET_DEFAULT_COLOR_NAME,
        payload: { colorKey: 'color1', name: '' },
      })
      expect(newState.bible.settings.defaultColorNames?.color1).toBeUndefined()
      expect(newState.bible.settings.defaultColorNames?.color2).toBe('Other')
    })

    it('should delete defaultColorNames object when last entry removed', () => {
      const state = createState({
        defaultColorNames: { color1: 'My Color' },
      })
      const newState = settingsReducer(state, {
        type: SET_DEFAULT_COLOR_NAME,
        payload: { colorKey: 'color1', name: '' },
      })
      expect(newState.bible.settings.defaultColorNames).toBeUndefined()
    })
  })

  describe('SET_DEFAULT_COLOR_TYPE', () => {
    it('should set default color type to textColor', () => {
      const newState = settingsReducer(initialState, {
        type: SET_DEFAULT_COLOR_TYPE,
        payload: { colorKey: 'color1', type: 'textColor' },
      })
      expect(newState.bible.settings.defaultColorTypes?.color1).toBe('textColor')
    })

    it('should set default color type to underline', () => {
      const newState = settingsReducer(initialState, {
        type: SET_DEFAULT_COLOR_TYPE,
        payload: { colorKey: 'color1', type: 'underline' },
      })
      expect(newState.bible.settings.defaultColorTypes?.color1).toBe('underline')
    })

    it('should remove color type when set to background (default)', () => {
      const state = createState({
        defaultColorTypes: { color1: 'textColor' as const, color2: 'underline' as const },
      })
      const newState = settingsReducer(state, {
        type: SET_DEFAULT_COLOR_TYPE,
        payload: { colorKey: 'color1', type: 'background' },
      })
      expect(newState.bible.settings.defaultColorTypes?.color1).toBeUndefined()
      expect(newState.bible.settings.defaultColorTypes?.color2).toBe('underline')
    })

    it('should delete defaultColorTypes object when last entry removed', () => {
      const state = createState({
        defaultColorTypes: { color1: 'textColor' as const },
      })
      const newState = settingsReducer(state, {
        type: SET_DEFAULT_COLOR_TYPE,
        payload: { colorKey: 'color1', type: 'background' },
      })
      expect(newState.bible.settings.defaultColorTypes).toBeUndefined()
    })
  })

  describe('SET_DEFAULT_BIBLE_VERSION', () => {
    it('should set default Bible version', () => {
      const newState = settingsReducer(initialState, {
        type: SET_DEFAULT_BIBLE_VERSION,
        payload: 'KJV',
      })
      expect(newState.bible.settings.defaultBibleVersion).toBe('KJV')
    })
  })

  describe('CHANGE_COLOR', () => {
    it('should change color with provided color value', () => {
      const newState = settingsReducer(initialState, {
        type: CHANGE_COLOR,
        name: 'primary',
        color: '#ff0000',
      })
      expect(newState.bible.settings.colors.default.primary).toBe('#ff0000')
    })

    it('should reset color to default when no color provided', () => {
      const state = createState({
        colors: {
          ...getInitialState().bible.settings.colors,
          default: { ...getInitialState().bible.settings.colors.default, primary: '#ff0000' },
        },
      })
      const newState = settingsReducer(state, {
        type: CHANGE_COLOR,
        name: 'primary',
      })
      expect(newState.bible.settings.colors.default.primary).toBe('#000')
    })
  })

  describe('default case', () => {
    it('should return state unchanged for unknown action', () => {
      const newState = settingsReducer(initialState, { type: 'UNKNOWN_ACTION' })
      expect(newState).toEqual(initialState)
    })
  })
})
