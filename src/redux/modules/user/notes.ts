import { createAction } from '@reduxjs/toolkit'
import { VerseIds } from '~common/types'
import generateUUID from '~helpers/generateUUID'
import orderVerses from '~helpers/orderVerses'
import { Note } from '../user'

// Action type constants for backward compatibility
export const ADD_NOTE = 'user/ADD_NOTE'
export const REMOVE_NOTE = 'user/REMOVE_NOTE'

// RTK Action Creators
export const addNoteAction = createAction(
  ADD_NOTE,
  (noteData: { [key: string]: Note }, selectedVerseKeys?: string[]) => ({
    payload: noteData,
    meta: { selectedVerseKeys },
  })
)

export const deleteNote = createAction(REMOVE_NOTE, (noteId: string) => ({
  payload: noteId,
}))

// Helper function that creates the note with proper key
export function addNote(note: Note, selectedVerses: VerseIds = {}) {
  selectedVerses = orderVerses(selectedVerses)
  const selectedVerseKeys = Object.keys(selectedVerses)

  const noteId = note.id || generateUUID()
  return addNoteAction({ [noteId]: { ...note, id: noteId } }, selectedVerseKeys)
}
