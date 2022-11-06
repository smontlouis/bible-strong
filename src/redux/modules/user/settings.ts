import produce, { Draft } from 'immer'
import {
  CurrentTheme,
  PreferredColorScheme,
  PreferredDarkTheme,
  PreferredLightTheme,
} from '~common/types'

import defaultColors from '~themes/colors'
import darkColors from '~themes/darkColors'
import { UserState } from '../user'

export const SET_SETTINGS_ALIGN_CONTENT = 'user/SET_SETTINGS_ALIGN_CONTENT'
export const INCREASE_SETTINGS_FONTSIZE_SCALE =
  'user/INCREASE_SETTINGS_FONTSIZE_SCALE'
export const DECREASE_SETTINGS_FONTSIZE_SCALE =
  'user/DECREASE_SETTINGS_FONTSIZE_SCALE'
export const SET_SETTINGS_TEXT_DISPLAY = 'user/SET_SETTINGS_TEXT_DISPLAY'
export const SET_SETTINGS_THEME = 'user/SET_SETTINGS_THEME'
export const SET_SETTINGS_PRESS = 'user/SET_SETTINGS_PRESS'
export const SET_SETTINGS_NOTES_DISPLAY = 'user/SET_SETTINGS_NOTES_DISPLAY'
export const SET_SETTINGS_COMMENTS_DISPLAY =
  'user/SET_SETTINGS_COMMENTS_DISPLAY'
export const CHANGE_COLOR = 'user/CHANGE_COLOR'
export const SET_SETTINGS_PREFERRED_COLOR_SCHEME =
  'user/SET_SETTINGS_PREFERRED_COLOR_SCHEME'
export const SET_SETTINGS_PREFERRED_LIGHT_THEME =
  'user/SET_SETTINGS_PREFERRED_LIGHT_THEME'
export const SET_SETTINGS_PREFERRED_DARK_THEME =
  'user/SET_SETTINGS_PREFERRED_DARK_THEME'

export default produce((draft: Draft<UserState>, action) => {
  switch (action.type) {
    // !TODO: Fix change color
    case CHANGE_COLOR: {
      const currentTheme = draft.bible.settings.theme
      const color =
        action.color ||
        (currentTheme === 'dark'
          ? darkColors[action.name as keyof typeof darkColors]
          : defaultColors[action.name as keyof typeof defaultColors])
      // @ts-ignore
      draft.bible.settings.colors[currentTheme][action.name] = color
      break
    }
    case SET_SETTINGS_ALIGN_CONTENT: {
      draft.bible.settings.alignContent = action.payload
      break
    }
    case SET_SETTINGS_TEXT_DISPLAY: {
      draft.bible.settings.textDisplay = action.payload
      break
    }
    case SET_SETTINGS_THEME: {
      draft.bible.settings.theme = action.payload
      break
    }
    case SET_SETTINGS_PREFERRED_COLOR_SCHEME: {
      console.log('DO STUFF')
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

export function setSettingsTextDisplay(payload: string) {
  return {
    type: SET_SETTINGS_TEXT_DISPLAY,
    payload,
  }
}

export function setSettingsTheme(payload: CurrentTheme) {
  return {
    type: SET_SETTINGS_THEME,
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

export function setSettingsCommentaires(payload: string) {
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

export function changeColor({
  name,
  color,
}: {
  name: keyof typeof defaultColors
  color: string
}) {
  return {
    type: CHANGE_COLOR,
    name,
    color,
  }
}
