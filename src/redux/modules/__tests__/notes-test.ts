/* eslint-env jest */

import notesReducer, { ADD_NOTE, REMOVE_NOTE } from '../user/notes'
import type { Note, NotesObj } from '../user'

const getInitialState = () => ({
  bible: {
    notes: {} as NotesObj,
    tags: {} as { [key: string]: any },
  },
})

const createNote = (overrides?: Partial<Note>): Note => ({
  title: 'Test Note',
  description: 'This is a test note',
  date: Date.now(),
  ...overrides,
})

describe('Notes Reducer', () => {
  let initialState: ReturnType<typeof getInitialState>

  beforeEach(() => {
    initialState = getInitialState()
  })

  describe('ADD_NOTE', () => {
    it('should add a note', () => {
      const note = createNote()
      const newState = notesReducer(initialState, {
        type: ADD_NOTE,
        payload: { '1-1-1': note },
      })
      expect(newState.bible.notes['1-1-1']).toBeDefined()
      expect(newState.bible.notes['1-1-1'].title).toBe('Test Note')
      expect(newState.bible.notes['1-1-1'].description).toBe('This is a test note')
    })

    it('should add note with multiple verse keys', () => {
      const note = createNote()
      const newState = notesReducer(initialState, {
        type: ADD_NOTE,
        payload: { '1-1-1/1-1-2/1-1-3': note },
      })
      expect(newState.bible.notes['1-1-1/1-1-2/1-1-3']).toBeDefined()
    })

    it('should merge with existing notes', () => {
      const state = {
        bible: {
          notes: {
            '1-1-1': createNote({ title: 'Existing Note' }),
          },
          tags: {},
        },
      }
      const newState = notesReducer(state, {
        type: ADD_NOTE,
        payload: { '1-1-2': createNote({ title: 'New Note' }) },
      })
      expect(newState.bible.notes['1-1-1'].title).toBe('Existing Note')
      expect(newState.bible.notes['1-1-2'].title).toBe('New Note')
    })

    it('should overwrite existing note with same key', () => {
      const state = {
        bible: {
          notes: {
            '1-1-1': createNote({ title: 'Old Note' }),
          },
          tags: {},
        },
      }
      const newState = notesReducer(state, {
        type: ADD_NOTE,
        payload: { '1-1-1': createNote({ title: 'Updated Note' }) },
      })
      expect(newState.bible.notes['1-1-1'].title).toBe('Updated Note')
    })

    it('should preserve tags on note', () => {
      const note = createNote({ tags: { 'tag-1': { id: 'tag-1', name: 'Test', date: Date.now(), strongsGrec: {} } } })
      const newState = notesReducer(initialState, {
        type: ADD_NOTE,
        payload: { '1-1-1': note },
      })
      expect(newState.bible.notes['1-1-1'].tags?.['tag-1'].id).toBe('tag-1')
      expect(newState.bible.notes['1-1-1'].tags?.['tag-1'].name).toBe('Test')
    })
  })

  describe('REMOVE_NOTE', () => {
    it('should remove a note', () => {
      const state = {
        bible: {
          notes: {
            '1-1-1': createNote(),
            '1-1-2': createNote(),
          },
          tags: {},
        },
      }
      const newState = notesReducer(state, {
        type: REMOVE_NOTE,
        payload: '1-1-1',
      })
      expect(newState.bible.notes['1-1-1']).toBeUndefined()
      expect(newState.bible.notes['1-1-2']).toBeDefined()
    })

    it('should remove note with composite key', () => {
      const state = {
        bible: {
          notes: {
            '1-1-1/1-1-2': createNote(),
          },
          tags: {},
        },
      }
      const newState = notesReducer(state, {
        type: REMOVE_NOTE,
        payload: '1-1-1/1-1-2',
      })
      expect(newState.bible.notes['1-1-1/1-1-2']).toBeUndefined()
    })

    it('should remove note references from tags', () => {
      const state = {
        bible: {
          notes: {
            '1-1-1': createNote({
              tags: { 'tag-1': { id: 'tag-1', name: 'Test', date: Date.now(), strongsGrec: {} } },
            }),
          },
          tags: {
            'tag-1': {
              id: 'tag-1',
              name: 'Test',
              notes: { '1-1-1': true },
            },
          },
        },
      }
      const newState = notesReducer(state, {
        type: REMOVE_NOTE,
        payload: '1-1-1',
      })
      expect(newState.bible.notes['1-1-1']).toBeUndefined()
      expect(newState.bible.tags['tag-1'].notes['1-1-1']).toBeUndefined()
    })

    it('should handle removing non-existent note', () => {
      const state = {
        bible: {
          notes: {
            '1-1-1': createNote(),
          },
          tags: {},
        },
      }
      const newState = notesReducer(state, {
        type: REMOVE_NOTE,
        payload: '1-1-99',
      })
      expect(newState.bible.notes['1-1-1']).toBeDefined()
    })
  })

  describe('default case', () => {
    it('should return state unchanged for unknown action', () => {
      const state = {
        bible: {
          notes: {
            '1-1-1': createNote(),
          },
          tags: {},
        },
      }
      const newState = notesReducer(state, { type: 'UNKNOWN_ACTION' })
      expect(newState).toEqual(state)
    })
  })
})
