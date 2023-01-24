import produce from 'immer'
import { VerseIds } from '~common/types'
import orderVerses from '~helpers/orderVerses'
import { Note } from '../user'
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
export function addNote(note: Note, selectedVerses: VerseIds) {
  selectedVerses = orderVerses(selectedVerses)
  const key = Object.keys(selectedVerses).join('/')

  if (!key) {
    return
  }
  return { type: ADD_NOTE, payload: { [key]: note } }
}

export function deleteNote(noteId: string) {
  return {
    type: REMOVE_NOTE,
    payload: noteId,
  }
}
