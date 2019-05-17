import produce from 'immer'
import { clearSelectedVerses } from './bible'

// export const USER_LOGIN_SUCCESS = 'USER_LOGIN_SUCCESS'
// export const USER_UPDATE_PROFILE = 'USER_UPDATE_PROFILE'
// export const USER_LOGOUT = 'USER_LOGOUT'
export const ADD_HIGHLIGHT = 'user/ADD_HIGHLIGHT'
export const REMOVE_HIGHLIGHT = 'user/REMOVE_HIGHLIGHT'
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
    highlights: {
      '1-1-1': 'lorem',
      '1-1-4': 'ipsum'
    },
    notes: {}
  }
}

const addDateToVerses = (verses, now = Date.now()) => {
  const formattedObj = Object.keys(verses).reduce((obj, verse) => ({
    ...obj,
    [verse]: now
  }), {})

  return formattedObj
}

// UserReducer
export default produce((draft, action) => {
  switch (action.type) {
    case ADD_HIGHLIGHT: {
      draft.bible.highlights = {
        ...draft.bible.highlights,
        ...addDateToVerses(action.selectedVerses)
      }
      return
    }
    case REMOVE_HIGHLIGHT: {
      action.selectedVerses.forEach(function (item, key) {
        delete draft.bible.highlights[key]
      })
    }
  }
}, initialState)

export function toggleHighlight (hasHighlighted) {
  return (dispatch, getState) => {
    const selectedVerses = getState().bible.selectedVerses

    dispatch(clearSelectedVerses())

    if (hasHighlighted) {
      return dispatch({ type: REMOVE_HIGHLIGHT, selectedVerses })
    } else {
      return dispatch({ type: ADD_HIGHLIGHT, selectedVerses })
    }
  }
}
