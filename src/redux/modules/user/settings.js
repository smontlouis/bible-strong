import produce from 'immer'

import defaultColors from '~themes/colors'
import darkColors from '~themes/darkColors'

const SET_SETTINGS_ALIGN_CONTENT = 'user/SET_SETTINGS_ALIGN_CONTENT'
const INCREASE_SETTINGS_FONTSIZE_SCALE = 'user/INCREASE_SETTINGS_FONTSIZE_SCALE'
const DECREASE_SETTINGS_FONTSIZE_SCALE = 'user/DECREASE_SETTINGS_FONTSIZE_SCALE'
const SET_SETTINGS_TEXT_DISPLAY = 'user/SET_SETTINGS_TEXT_DISPLAY'
const SET_SETTINGS_THEME = 'user/SET_SETTINGS_THEME'
const SET_SETTINGS_PRESS = 'user/SET_SETTINGS_PRESS'
const SET_SETTINGS_NOTES_DISPLAY = 'user/SET_SETTINGS_NOTES_DISPLAY'
const SET_SETTINGS_COMMENTS_DISPLAY = 'user/SET_SETTINGS_COMMENTS_DISPLAY'
const CHANGE_COLOR = 'user/CHANGE_COLOR'

export default produce((draft, action) => {
  switch (action.type) {
    case CHANGE_COLOR: {
      const currentTheme = draft.bible.settings.theme
      const color =
        action.color ||
        (currentTheme === 'dark'
          ? darkColors[action.name]
          : defaultColors[action.name])
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
      if (draft.bible.settings.fontSizeScale < 3) {
        draft.bible.settings.fontSizeScale += 1
      }
      break
    }
    case DECREASE_SETTINGS_FONTSIZE_SCALE: {
      if (draft.bible.settings.fontSizeScale > -3) {
        draft.bible.settings.fontSizeScale -= 1
      }
      break
    }
    default:
      break
  }
})

// SETTINGS
export function setSettingsAlignContent(payload) {
  return {
    type: SET_SETTINGS_ALIGN_CONTENT,
    payload
  }
}

export function setSettingsTextDisplay(payload) {
  return {
    type: SET_SETTINGS_TEXT_DISPLAY,
    payload
  }
}

export function setSettingsTheme(payload) {
  return {
    type: SET_SETTINGS_THEME,
    payload
  }
}

export function setSettingsNotesDisplay(payload) {
  return {
    type: SET_SETTINGS_NOTES_DISPLAY,
    payload
  }
}

export function setSettingsCommentaires(payload) {
  return {
    type: SET_SETTINGS_COMMENTS_DISPLAY,
    payload
  }
}

export function increaseSettingsFontSizeScale() {
  return {
    type: INCREASE_SETTINGS_FONTSIZE_SCALE
  }
}

export function decreaseSettingsFontSizeScale() {
  return {
    type: DECREASE_SETTINGS_FONTSIZE_SCALE
  }
}

export function setSettingsPress(payload) {
  return {
    type: SET_SETTINGS_PRESS,
    payload
  }
}

export function changeColor({ name, color }) {
  return {
    type: CHANGE_COLOR,
    name,
    color
  }
}
