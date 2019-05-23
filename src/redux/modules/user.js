import produce from 'immer'
import { clearSelectedVerses } from './bible'

// export const USER_LOGIN_SUCCESS = 'USER_LOGIN_SUCCESS'
// export const USER_UPDATE_PROFILE = 'USER_UPDATE_PROFILE'
// export const USER_LOGOUT = 'USER_LOGOUT'
export const ADD_HIGHLIGHT = 'user/ADD_HIGHLIGHT'
export const REMOVE_HIGHLIGHT = 'user/REMOVE_HIGHLIGHT'
export const SET_SETTINGS_ALIGN_CONTENT = 'user/SET_SETTINGS_ALIGN_CONTENT'
// export const SAVE_NOTE = 'user/SAVE_NOTE'
// export const EDIT_NOTE = 'user/EDIT_NOTE'
// export const REMOVE_NOTE = 'user/REMOVE_NOTE'

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
      alignContent: 'justify'
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
    case ADD_HIGHLIGHT: {
      draft.bible.highlights = {
        ...draft.bible.highlights,
        ...action.selectedVerses
      }
      return
    }
    case REMOVE_HIGHLIGHT: {
      Object.keys(action.selectedVerses).forEach((key) => {
        delete draft.bible.highlights[key]
      })
      return
    }
    case SET_SETTINGS_ALIGN_CONTENT: {
      draft.bible.settings.alignContent = action.payload
    }
  }
}, initialState)

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
