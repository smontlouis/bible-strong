import produce, { Draft } from 'immer'
import { Appearance } from 'react-native'
import { PreferredColorScheme, PreferredDarkTheme, PreferredLightTheme } from '~common/types'

import blackColors from '~themes/blackColors'
import defaultColors from '~themes/colors'
import darkColors from '~themes/darkColors'
import mauveColors from '~themes/mauveColors'
import natureColors from '~themes/natureColors'
import nightColors from '~themes/nightColors'
import sepiaColors from '~themes/sepiaColors'
import sunsetColors from '~themes/sunsetColors'

import { HighlightType, UserState } from '../user'

export const SET_SETTINGS_ALIGN_CONTENT = 'user/SET_SETTINGS_ALIGN_CONTENT'
export const SET_SETTINGS_LINE_HEIGHT = 'user/SET_SETTINGS_LINE_HEIGHT'
export const INCREASE_SETTINGS_FONTSIZE_SCALE = 'user/INCREASE_SETTINGS_FONTSIZE_SCALE'
export const DECREASE_SETTINGS_FONTSIZE_SCALE = 'user/DECREASE_SETTINGS_FONTSIZE_SCALE'
export const SET_SETTINGS_TEXT_DISPLAY = 'user/SET_SETTINGS_TEXT_DISPLAY'
export const SET_SETTINGS_PRESS = 'user/SET_SETTINGS_PRESS'
export const SET_SETTINGS_NOTES_DISPLAY = 'user/SET_SETTINGS_NOTES_DISPLAY'
export const SET_SETTINGS_LINKS_DISPLAY = 'user/SET_SETTINGS_LINKS_DISPLAY'
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

export default produce((draft: Draft<UserState>, action) => {
  switch (action.type) {
    // !TODO: Fix change color
    case CHANGE_COLOR: {
      const preferredColorScheme = draft.bible.settings.preferredColorScheme
      const preferredDarkTheme = draft.bible.settings.preferredDarkTheme
      const preferredLightTheme = draft.bible.settings.preferredLightTheme
      const systemColorScheme = Appearance.getColorScheme()

      // Provide derived theme
      const currentTheme = (() => {
        if (preferredColorScheme === 'auto') {
          if (systemColorScheme === 'dark') {
            return preferredDarkTheme
          }
          return preferredLightTheme
        }

        if (preferredColorScheme === 'dark') return preferredDarkTheme
        return preferredLightTheme
      })()

      const getColor = () => {
        if (action.color) {
          return action.color as string
        }
        if (currentTheme === 'black') {
          return blackColors[action.name as keyof typeof blackColors]
        }
        if (currentTheme === 'mauve') {
          return mauveColors[action.name as keyof typeof mauveColors]
        }
        if (currentTheme === 'nature') {
          return natureColors[action.name as keyof typeof natureColors]
        }
        if (currentTheme === 'night') {
          return nightColors[action.name as keyof typeof nightColors]
        }
        if (currentTheme === 'sepia') {
          return sepiaColors[action.name as keyof typeof sepiaColors]
        }
        if (currentTheme === 'sunset') {
          return sunsetColors[action.name as keyof typeof sunsetColors]
        }
        if (currentTheme === 'dark') {
          return darkColors[action.name as keyof typeof darkColors]
        }
        return defaultColors[action.name as keyof typeof defaultColors]
      }

      // @ts-ignore
      draft.bible.settings.colors[currentTheme][action.name] = getColor()
      break
    }
    case SET_SETTINGS_ALIGN_CONTENT: {
      draft.bible.settings.alignContent = action.payload
      break
    }
    case SET_SETTINGS_LINE_HEIGHT: {
      draft.bible.settings.lineHeight = action.payload
      break
    }
    case SET_SETTINGS_TEXT_DISPLAY: {
      draft.bible.settings.textDisplay = action.payload
      break
    }
    case SET_SETTINGS_PREFERRED_COLOR_SCHEME: {
      draft.bible.settings.preferredColorScheme = action.payload
      break
    }
    case SET_SETTINGS_PREFERRED_LIGHT_THEME: {
      draft.bible.settings.preferredLightTheme = action.payload
      break
    }
    case SET_SETTINGS_PREFERRED_DARK_THEME: {
      draft.bible.settings.preferredDarkTheme = action.payload
      break
    }
    case SET_SETTINGS_PRESS: {
      draft.bible.settings.press = action.payload
      break
    }
    case SET_SETTINGS_NOTES_DISPLAY: {
      draft.bible.settings.notesDisplay = action.payload
      break
    }
    case SET_SETTINGS_LINKS_DISPLAY: {
      draft.bible.settings.linksDisplay = action.payload
      break
    }
    case SET_SETTINGS_COMMENTS_DISPLAY: {
      draft.bible.settings.commentsDisplay = action.payload
      break
    }
    case INCREASE_SETTINGS_FONTSIZE_SCALE: {
      if (draft.bible.settings.fontSizeScale < 5) {
        draft.bible.settings.fontSizeScale += 1
      }
      break
    }
    case DECREASE_SETTINGS_FONTSIZE_SCALE: {
      if (draft.bible.settings.fontSizeScale > -5) {
        draft.bible.settings.fontSizeScale -= 1
      }
      break
    }
    case TOGGLE_SETTINGS_SHARE_VERSE_NUMBERS: {
      draft.bible.settings.shareVerses.hasVerseNumbers =
        !draft.bible.settings.shareVerses.hasVerseNumbers
      break
    }
    case TOGGLE_SETTINGS_SHARE_INLINE_VERSES: {
      draft.bible.settings.shareVerses.hasInlineVerses =
        !draft.bible.settings.shareVerses.hasInlineVerses
      break
    }
    case TOGGLE_SETTINGS_SHARE_QUOTES: {
      draft.bible.settings.shareVerses.hasQuotes = !draft.bible.settings.shareVerses.hasQuotes
      break
    }
    case TOGGLE_SETTINGS_SHARE_APP_NAME: {
      draft.bible.settings.shareVerses.hasAppName = !draft.bible.settings.shareVerses.hasAppName
      break
    }
    case SET_DEFAULT_COLOR_NAME: {
      const { colorKey, name } = action.payload
      if (!draft.bible.settings.defaultColorNames) {
        draft.bible.settings.defaultColorNames = {}
      }
      if (name) {
        draft.bible.settings.defaultColorNames[colorKey as keyof typeof draft.bible.settings.defaultColorNames] = name
      } else {
        delete draft.bible.settings.defaultColorNames[colorKey as keyof typeof draft.bible.settings.defaultColorNames]
      }
      break
    }
    case SET_DEFAULT_COLOR_TYPE: {
      const { colorKey, type } = action.payload as { colorKey: string; type?: HighlightType }
      if (!draft.bible.settings.defaultColorTypes) {
        draft.bible.settings.defaultColorTypes = {}
      }
      if (type && type !== 'background') {
        draft.bible.settings.defaultColorTypes[colorKey as keyof typeof draft.bible.settings.defaultColorTypes] = type
      } else {
        delete draft.bible.settings.defaultColorTypes[colorKey as keyof typeof draft.bible.settings.defaultColorTypes]
      }
      break
    }
    default:
      break
  }
})

// SETTINGS
export function setSettingsAlignContent(payload: string) {
  return {
    type: SET_SETTINGS_ALIGN_CONTENT,
    payload,
  }
}

export function setSettingsLineHeight(payload: 'normal' | 'small' | 'large') {
  return {
    type: SET_SETTINGS_LINE_HEIGHT,
    payload,
  }
}
export function setSettingsTextDisplay(payload: string) {
  return {
    type: SET_SETTINGS_TEXT_DISPLAY,
    payload,
  }
}

export function setSettingsPreferredColorScheme(payload: PreferredColorScheme) {
  return {
    type: SET_SETTINGS_PREFERRED_COLOR_SCHEME,
    payload,
  }
}

export function setSettingsPreferredLightTheme(payload: PreferredLightTheme) {
  return {
    type: SET_SETTINGS_PREFERRED_LIGHT_THEME,
    payload,
  }
}

export function setSettingsPreferredDarkTheme(payload: PreferredDarkTheme) {
  return {
    type: SET_SETTINGS_PREFERRED_DARK_THEME,
    payload,
  }
}

export function setSettingsNotesDisplay(payload: string) {
  return {
    type: SET_SETTINGS_NOTES_DISPLAY,
    payload,
  }
}

export function setSettingsLinksDisplay(payload: 'inline' | 'block') {
  return {
    type: SET_SETTINGS_LINKS_DISPLAY,
    payload,
  }
}

export function setSettingsCommentaires(payload: boolean) {
  return {
    type: SET_SETTINGS_COMMENTS_DISPLAY,
    payload,
  }
}

export function increaseSettingsFontSizeScale() {
  return {
    type: INCREASE_SETTINGS_FONTSIZE_SCALE,
  }
}

export function decreaseSettingsFontSizeScale() {
  return {
    type: DECREASE_SETTINGS_FONTSIZE_SCALE,
  }
}

export function setSettingsPress(payload: string) {
  return {
    type: SET_SETTINGS_PRESS,
    payload,
  }
}

export function changeColor({ name, color }: { name: keyof typeof defaultColors; color?: string }) {
  return {
    type: CHANGE_COLOR,
    name,
    color,
  }
}

export function toggleSettingsShareVerseNumbers() {
  return {
    type: TOGGLE_SETTINGS_SHARE_VERSE_NUMBERS,
  }
}

export function toggleSettingsShareLineBreaks() {
  return {
    type: TOGGLE_SETTINGS_SHARE_INLINE_VERSES,
  }
}

export function toggleSettingsShareQuotes() {
  return {
    type: TOGGLE_SETTINGS_SHARE_QUOTES,
  }
}

export function toggleSettingsShareAppName() {
  return {
    type: TOGGLE_SETTINGS_SHARE_APP_NAME,
  }
}

export function setDefaultColorName(colorKey: string, name?: string) {
  return {
    type: SET_DEFAULT_COLOR_NAME,
    payload: { colorKey, name },
  }
}

export function setDefaultColorType(colorKey: string, type?: HighlightType) {
  return {
    type: SET_DEFAULT_COLOR_TYPE,
    payload: { colorKey, type },
  }
}
