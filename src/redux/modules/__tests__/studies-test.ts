/* eslint-env jest */

import studiesReducer, {
  UPDATE_STUDY,
  DELETE_STUDY,
  PUBLISH_STUDY,
  ADD_STUDIES,
} from '../user/studies'
import type { Study, StudiesObj } from '../user'

const getInitialState = () => ({
  id: 'user-123',
  displayName: 'Test User',
  photoURL: 'https://example.com/photo.jpg',
  bible: {
    studies: {} as StudiesObj,
    tags: {} as { [key: string]: any },
  },
})

const createStudy = (id: string, overrides?: Partial<Study>): Study => ({
  id,
  title: `Study ${id}`,
  created_at: Date.now(),
  modified_at: Date.now(),
  content: { ops: ['Test content'] },
  user: {
    id: 'user-123',
    displayName: 'Test User',
    photoUrl: 'https://example.com/photo.jpg',
  },
  ...overrides,
})

describe('Studies Reducer', () => {
  let initialState: ReturnType<typeof getInitialState>

  beforeEach(() => {
    initialState = getInitialState()
  })

  describe('UPDATE_STUDY', () => {
    it('should create a new study', () => {
      const newState = studiesReducer(initialState, {
        type: UPDATE_STUDY,
        payload: {
          id: 'study-1',
          title: 'New Study',
          content: { ops: ['Content'] },
          created_at: Date.now(),
          modified_at: Date.now(),
        },
      })
      expect(newState.bible.studies['study-1']).toBeDefined()
      expect(newState.bible.studies['study-1'].title).toBe('New Study')
    })

    it('should update existing study', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          studies: {
            'study-1': createStudy('study-1', { title: 'Old Title' }),
          },
        },
      }
      const newState = studiesReducer(state, {
        type: UPDATE_STUDY,
        payload: {
          id: 'study-1',
          title: 'New Title',
        },
      })
      expect(newState.bible.studies['study-1'].title).toBe('New Title')
    })

    it('should preserve existing properties when updating', () => {
      const originalCreatedAt = Date.now() - 10000
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          studies: {
            'study-1': createStudy('study-1', {
              created_at: originalCreatedAt,
              published: true,
            }),
          },
        },
      }
      const newState = studiesReducer(state, {
        type: UPDATE_STUDY,
        payload: {
          id: 'study-1',
          title: 'Updated Title',
        },
      })
      expect(newState.bible.studies['study-1'].created_at).toBe(originalCreatedAt)
      expect(newState.bible.studies['study-1'].published).toBe(true)
    })

    it('should update user info from current state', () => {
      const newState = studiesReducer(initialState, {
        type: UPDATE_STUDY,
        payload: {
          id: 'study-1',
          title: 'New Study',
        },
      })
      expect(newState.bible.studies['study-1'].user.id).toBe('user-123')
      expect(newState.bible.studies['study-1'].user.displayName).toBe('Test User')
      expect(newState.bible.studies['study-1'].user.photoUrl).toBe('https://example.com/photo.jpg')
    })

    it('should update content', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          studies: {
            'study-1': createStudy('study-1'),
          },
        },
      }
      const newContent = { ops: ['Updated content'] }
      const newState = studiesReducer(state, {
        type: UPDATE_STUDY,
        payload: {
          id: 'study-1',
          content: newContent,
        },
      })
      expect(newState.bible.studies['study-1'].content).toEqual(newContent)
    })

    it('should update tags', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          studies: {
            'study-1': createStudy('study-1'),
          },
        },
      }
      const tags = { 'tag-1': { id: 'tag-1', name: 'Test' } }
      const newState = studiesReducer(state, {
        type: UPDATE_STUDY,
        payload: {
          id: 'study-1',
          tags,
        },
      })
      expect(newState.bible.studies['study-1'].tags).toEqual(tags)
    })

    it('should update modified_at', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          studies: {
            'study-1': createStudy('study-1', { modified_at: Date.now() - 10000 }),
          },
        },
      }
      const newModifiedAt = Date.now()
      const newState = studiesReducer(state, {
        type: UPDATE_STUDY,
        payload: {
          id: 'study-1',
          modified_at: newModifiedAt,
        },
      })
      expect(newState.bible.studies['study-1'].modified_at).toBe(newModifiedAt)
    })
  })

  describe('DELETE_STUDY', () => {
    it('should delete a study', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          studies: {
            'study-1': createStudy('study-1'),
            'study-2': createStudy('study-2'),
          },
        },
      }
      const newState = studiesReducer(state, {
        type: DELETE_STUDY,
        payload: 'study-1',
      })
      expect(newState.bible.studies['study-1']).toBeUndefined()
      expect(newState.bible.studies['study-2']).toBeDefined()
    })

    it('should remove study references from tags', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          studies: {
            'study-1': createStudy('study-1', {
              tags: { 'tag-1': { id: 'tag-1', name: 'Test' } },
            }),
          },
          tags: {
            'tag-1': {
              id: 'tag-1',
              name: 'Test',
              studies: { 'study-1': true },
            },
          },
        },
      }
      const newState = studiesReducer(state, {
        type: DELETE_STUDY,
        payload: 'study-1',
      })
      expect(newState.bible.studies['study-1']).toBeUndefined()
      expect(newState.bible.tags['tag-1'].studies['study-1']).toBeUndefined()
    })

    it('should handle deleting non-existent study', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          studies: {
            'study-1': createStudy('study-1'),
          },
        },
      }
      const newState = studiesReducer(state, {
        type: DELETE_STUDY,
        payload: 'non-existent',
      })
      expect(newState.bible.studies['study-1']).toBeDefined()
    })
  })

  describe('PUBLISH_STUDY', () => {
    it('should set published to true', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          studies: {
            'study-1': createStudy('study-1', { published: false }),
          },
        },
      }
      const newState = studiesReducer(state, {
        type: PUBLISH_STUDY,
        payload: 'study-1',
        publish: true,
      })
      expect(newState.bible.studies['study-1'].published).toBe(true)
    })

    it('should set published to false (unpublish)', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          studies: {
            'study-1': createStudy('study-1', { published: true }),
          },
        },
      }
      const newState = studiesReducer(state, {
        type: PUBLISH_STUDY,
        payload: 'study-1',
        publish: false,
      })
      expect(newState.bible.studies['study-1'].published).toBe(false)
    })

    it('should update modified_at when publishing', () => {
      const oldModifiedAt = Date.now() - 10000
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          studies: {
            'study-1': createStudy('study-1', { modified_at: oldModifiedAt }),
          },
        },
      }
      const beforePublish = Date.now()
      const newState = studiesReducer(state, {
        type: PUBLISH_STUDY,
        payload: 'study-1',
        publish: true,
      })
      expect(newState.bible.studies['study-1'].modified_at).toBeGreaterThanOrEqual(beforePublish)
    })
  })

  describe('ADD_STUDIES', () => {
    it('should replace all studies', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          studies: {
            'study-1': createStudy('study-1'),
          },
        },
      }
      const newStudies = {
        'study-2': createStudy('study-2'),
        'study-3': createStudy('study-3'),
      }
      const newState = studiesReducer(state, {
        type: ADD_STUDIES,
        payload: newStudies,
      })
      expect(newState.bible.studies['study-1']).toBeUndefined()
      expect(newState.bible.studies['study-2']).toBeDefined()
      expect(newState.bible.studies['study-3']).toBeDefined()
    })

    it('should set empty studies', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          studies: {
            'study-1': createStudy('study-1'),
          },
        },
      }
      const newState = studiesReducer(state, {
        type: ADD_STUDIES,
        payload: {},
      })
      expect(Object.keys(newState.bible.studies)).toHaveLength(0)
    })
  })

  describe('default case', () => {
    it('should return state unchanged for unknown action', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          studies: {
            'study-1': createStudy('study-1'),
          },
        },
      }
      const newState = studiesReducer(state, { type: 'UNKNOWN_ACTION' })
      expect(newState).toEqual(state)
    })
  })
})
