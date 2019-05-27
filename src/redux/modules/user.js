import produce from 'immer'
import { clearSelectedVerses } from './bible'
import orderVerses from '~helpers/orderVerses'

// export const USER_LOGIN_SUCCESS = 'USER_LOGIN_SUCCESS'
// export const USER_UPDATE_PROFILE = 'USER_UPDATE_PROFILE'
// export const USER_LOGOUT = 'USER_LOGOUT'
export const ADD_NOTE = 'user/ADD_NOTE'
export const ADD_HIGHLIGHT = 'user/ADD_HIGHLIGHT'
export const REMOVE_HIGHLIGHT = 'user/REMOVE_HIGHLIGHT'
export const SET_SETTINGS_ALIGN_CONTENT = 'user/SET_SETTINGS_ALIGN_CONTENT'
export const INCREASE_SETTINGS_FONTSIZE_SCALE = 'user/INCREASE_SETTINGS_FONTSIZE_SCALE'
export const DECREASE_SETTINGS_FONTSIZE_SCALE = 'user/DECREASE_SETTINGS_FONTSIZE_SCALE'
export const SET_SETTINGS_TEXT_DISPLAY = 'user/SET_SETTINGS_TEXT_DISPLAY'
export const SET_SETTINGS_THEME = 'user/SET_SETTINGS_THEME'
export const SAVE_NOTE = 'user/SAVE_NOTE'
export const EDIT_NOTE = 'user/EDIT_NOTE'
export const REMOVE_NOTE = 'user/REMOVE_NOTE'

const initialState = {
  email: '',
  displayName: '',
  photoURL: '',
  provider: '',
  lastSeen: 0,
  emailVerified: false,
  bible: {
    highlights: {},
    notes: {},
    settings: {
      alignContent: 'justify',
      fontSizeScale: 0,
      textDisplay: 'inline',
      theme: 'default'
    }
  }
}

const addDateAndColorToVerses = (verses, color) => {
  const formattedObj = Object.keys(verses).reduce((obj, verse) => ({
    ...obj,
    [verse]: {
      color,
      date: Date.now()
    }
  }), {})

  return formattedObj
}

// UserReducer
export default produce((draft, action) => {
  switch (action.type) {
    case ADD_NOTE: {
      draft.bible.notes = {
        ...draft.bible.notes,
        ...action.payload
      }
      break
    }
    case ADD_HIGHLIGHT: {
      draft.bible.highlights = {
        ...draft.bible.highlights,
        ...action.selectedVerses
      }
      break
    }
    case REMOVE_HIGHLIGHT: {
      Object.keys(action.selectedVerses).forEach((key) => {
        delete draft.bible.highlights[key]
      })
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
  }
}, initialState)

export function addNote (note) {
  return (dispatch, getState) => {
    let selectedVerses = getState().bible.selectedVerses
    selectedVerses = orderVerses(selectedVerses)
    let key = Object.keys(selectedVerses).join('/')
    dispatch(clearSelectedVerses())
    return dispatch({ type: ADD_NOTE, payload: { [key]: note } })
  }
}

export function addHighlight (color) {
  return (dispatch, getState) => {
    const selectedVerses = getState().bible.selectedVerses

    dispatch(clearSelectedVerses())
    return dispatch({ type: ADD_HIGHLIGHT, selectedVerses: addDateAndColorToVerses(selectedVerses, color) })
  }
}

export function removeHighlight () {
  return (dispatch, getState) => {
    const selectedVerses = getState().bible.selectedVerses

    dispatch(clearSelectedVerses())
    return dispatch({ type: REMOVE_HIGHLIGHT, selectedVerses })
  }
}

export function setSettingsAlignContent (payload) {
  return {
    type: SET_SETTINGS_ALIGN_CONTENT,
    payload
  }
}

export function setSettingsTextDisplay (payload) {
  return {
    type: SET_SETTINGS_TEXT_DISPLAY,
    payload
  }
}

export function setSettingsTheme (payload) {
  return {
    type: SET_SETTINGS_THEME,
    payload
  }
}

export function increaseSettingsFontSizeScale () {
  return {
    type: INCREASE_SETTINGS_FONTSIZE_SCALE
  }
}

export function decreaseSettingsFontSizeScale () {
  return {
    type: DECREASE_SETTINGS_FONTSIZE_SCALE
  }
}
