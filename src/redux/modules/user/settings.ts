import { createAction } from '@reduxjs/toolkit'
import { PreferredColorScheme, PreferredDarkTheme, PreferredLightTheme } from '~common/types'
import defaultColors from '~themes/colors'
import { HighlightType } from '../user'

// Action type constants for backward compatibility
export const SET_SETTINGS_ALIGN_CONTENT = 'user/SET_SETTINGS_ALIGN_CONTENT'
export const SET_SETTINGS_LINE_HEIGHT = 'user/SET_SETTINGS_LINE_HEIGHT'
export const INCREASE_SETTINGS_FONTSIZE_SCALE = 'user/INCREASE_SETTINGS_FONTSIZE_SCALE'
export const DECREASE_SETTINGS_FONTSIZE_SCALE = 'user/DECREASE_SETTINGS_FONTSIZE_SCALE'
export const SET_SETTINGS_TEXT_DISPLAY = 'user/SET_SETTINGS_TEXT_DISPLAY'
export const SET_SETTINGS_PRESS = 'user/SET_SETTINGS_PRESS'
export const SET_SETTINGS_NOTES_DISPLAY = 'user/SET_SETTINGS_NOTES_DISPLAY'
export const SET_SETTINGS_LINKS_DISPLAY = 'user/SET_SETTINGS_LINKS_DISPLAY'
export const SET_SETTINGS_TAGS_DISPLAY = 'user/SET_SETTINGS_TAGS_DISPLAY'
export const SET_SETTINGS_COMMENTS_DISPLAY = 'user/SET_SETTINGS_COMMENTS_DISPLAY'
export const CHANGE_COLOR = 'user/CHANGE_COLOR'
export const SET_SETTINGS_PREFERRED_COLOR_SCHEME = 'user/SET_SETTINGS_PREFERRED_COLOR_SCHEME'
export const SET_SETTINGS_PREFERRED_LIGHT_THEME = 'user/SET_SETTINGS_PREFERRED_LIGHT_THEME'
export const SET_SETTINGS_PREFERRED_DARK_THEME = 'user/SET_SETTINGS_PREFERRED_DARK_THEME'
export const TOGGLE_SETTINGS_SHARE_VERSE_NUMBERS = 'user/SET_SETTINGS_SHARE_VERSE_NUMBERS'
export const TOGGLE_SETTINGS_SHARE_INLINE_VERSES = 'user/SET_SETTINGS_SHARE_INLINE_VERSES'
export const TOGGLE_SETTINGS_SHARE_QUOTES = 'user/SET_SETTINGS_SHARE_QUOTES'
export const TOGGLE_SETTINGS_SHARE_APP_NAME = 'user/SET_SETTINGS_SHARE_APP_NAME'
export const SET_DEFAULT_COLOR_NAME = 'user/SET_DEFAULT_COLOR_NAME'
export const SET_DEFAULT_COLOR_TYPE = 'user/SET_DEFAULT_COLOR_TYPE'
export const SET_DEFAULT_BIBLE_VERSION = 'user/SET_DEFAULT_BIBLE_VERSION'

// RTK Action Creators
export const setSettingsAlignContent = createAction(
  SET_SETTINGS_ALIGN_CONTENT,
  (payload: string) => ({ payload })
)

export const setSettingsLineHeight = createAction(
  SET_SETTINGS_LINE_HEIGHT,
  (payload: 'normal' | 'small' | 'large') => ({ payload })
)

export const setSettingsTextDisplay = createAction(
  SET_SETTINGS_TEXT_DISPLAY,
  (payload: string) => ({ payload })
)

export const setSettingsPreferredColorScheme = createAction(
  SET_SETTINGS_PREFERRED_COLOR_SCHEME,
  (payload: PreferredColorScheme) => ({ payload })
)

export const setSettingsPreferredLightTheme = createAction(
  SET_SETTINGS_PREFERRED_LIGHT_THEME,
  (payload: PreferredLightTheme) => ({ payload })
)

export const setSettingsPreferredDarkTheme = createAction(
  SET_SETTINGS_PREFERRED_DARK_THEME,
  (payload: PreferredDarkTheme) => ({ payload })
)

export const setSettingsNotesDisplay = createAction(
  SET_SETTINGS_NOTES_DISPLAY,
  (payload: string) => ({ payload })
)

export const setSettingsLinksDisplay = createAction(
  SET_SETTINGS_LINKS_DISPLAY,
  (payload: 'inline' | 'block') => ({ payload })
)

export const setSettingsTagsDisplay = createAction(
  SET_SETTINGS_TAGS_DISPLAY,
  (payload: 'inline' | 'block') => ({ payload })
)

export const setSettingsCommentaires = createAction(
  SET_SETTINGS_COMMENTS_DISPLAY,
  (payload: boolean) => ({ payload })
)

export const increaseSettingsFontSizeScale = createAction(INCREASE_SETTINGS_FONTSIZE_SCALE)

export const decreaseSettingsFontSizeScale = createAction(DECREASE_SETTINGS_FONTSIZE_SCALE)

export const setSettingsPress = createAction(SET_SETTINGS_PRESS, (payload: string) => ({
  payload,
}))

export const changeColor = createAction(
  CHANGE_COLOR,
  ({ name, color }: { name: keyof typeof defaultColors; color?: string }) => ({
    payload: { name, color },
  })
)

export const toggleSettingsShareVerseNumbers = createAction(TOGGLE_SETTINGS_SHARE_VERSE_NUMBERS)

export const toggleSettingsShareLineBreaks = createAction(TOGGLE_SETTINGS_SHARE_INLINE_VERSES)

export const toggleSettingsShareQuotes = createAction(TOGGLE_SETTINGS_SHARE_QUOTES)

export const toggleSettingsShareAppName = createAction(TOGGLE_SETTINGS_SHARE_APP_NAME)

export const setDefaultColorName = createAction(
  SET_DEFAULT_COLOR_NAME,
  (colorKey: string, name?: string) => ({
    payload: { colorKey, name },
  })
)

export const setDefaultColorType = createAction(
  SET_DEFAULT_COLOR_TYPE,
  (colorKey: string, type?: HighlightType) => ({
    payload: { colorKey, type },
  })
)

export const setDefaultBibleVersion = createAction(
  SET_DEFAULT_BIBLE_VERSION,
  (payload: string) => ({ payload })
)
