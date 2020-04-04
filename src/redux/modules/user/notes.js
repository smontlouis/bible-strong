import produce from 'immer'
import { clearSelectedVerses } from '../bible'
import orderVerses from '~helpers/orderVerses'
import { removeEntityInTags } from '../utils'

export const ADD_NOTE = 'user/ADD_NOTE'
export const REMOVE_NOTE = 'user/REMOVE_NOTE'

export default produce((draft, action) => {
  switch (action.type) {
    case ADD_NOTE: {
      draft.bible.notes = {
        ...draft.bible.notes,
        ...action.payload,
      }
      break
    }
    case REMOVE_NOTE: {
      delete draft.bible.notes[action.payload]
      removeEntityInTags(draft, 'notes', action.payload)
      break
    }
    default:
      break
  }
})

// NOTES
export function addNote(note, noteVerses) {
  return (dispatch, getState) => {
    let selectedVerses = noteVerses || getState().bible.selectedVerses
    selectedVerses = orderVerses(selectedVerses)
    const key = Object.keys(selectedVerses).join('/')
    dispatch(clearSelectedVerses())

    if (!key) {
      return
    }
    return dispatch({ type: ADD_NOTE, payload: { [key]: note } })
  }
}

export function deleteNote(noteId) {
  return {
    type: REMOVE_NOTE,
    payload: noteId,
  }
}
