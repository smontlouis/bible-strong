/* eslint-env jest */

import tagsReducer, {
  ADD_TAG,
  UPDATE_TAG,
  REMOVE_TAG,
  TOGGLE_TAG_ENTITY,
  entitiesArray,
} from '../user/tags'
import type { TagsObj } from '~common/types'

// Mock generateUUID to return predictable values
jest.mock('~helpers/generateUUID', () => {
  let counter = 0
  return jest.fn(() => `uuid-${++counter}`)
})

const getInitialState = () => ({
  bible: {
    tags: {} as TagsObj,
    highlights: {} as { [key: string]: any },
    notes: {} as { [key: string]: any },
    links: {} as { [key: string]: any },
    studies: {} as { [key: string]: any },
    strongsHebreu: {} as { [key: string]: any },
    strongsGrec: {} as { [key: string]: any },
    words: {} as { [key: string]: any },
    naves: {} as { [key: string]: any },
  },
})

describe('Tags Reducer', () => {
  let initialState: ReturnType<typeof getInitialState>

  beforeEach(() => {
    initialState = getInitialState()
    jest.clearAllMocks()
  })

  describe('ADD_TAG', () => {
    it('should add a new tag', () => {
      const newState = tagsReducer(initialState, {
        type: ADD_TAG,
        payload: 'Test Tag',
      })
      const tagIds = Object.keys(newState.bible.tags)
      expect(tagIds).toHaveLength(1)
      expect(newState.bible.tags[tagIds[0]].name).toBe('Test Tag')
    })

    it('should set id and date on new tag', () => {
      const beforeAdd = Date.now()
      const newState = tagsReducer(initialState, {
        type: ADD_TAG,
        payload: 'Test Tag',
      })
      const tagIds = Object.keys(newState.bible.tags)
      const tag = newState.bible.tags[tagIds[0]]
      expect(tag.id).toBeDefined()
      expect(tag.date).toBeGreaterThanOrEqual(beforeAdd)
    })

    it('should add multiple tags', () => {
      let state = tagsReducer(initialState, {
        type: ADD_TAG,
        payload: 'Tag 1',
      })
      state = tagsReducer(state, {
        type: ADD_TAG,
        payload: 'Tag 2',
      })
      expect(Object.keys(state.bible.tags)).toHaveLength(2)
    })
  })

  describe('UPDATE_TAG', () => {
    it('should update tag name', () => {
      const state = {
        bible: {
          ...initialState.bible,
          tags: {
            'tag-1': { id: 'tag-1', name: 'Old Name', date: Date.now() },
          },
        },
      }
      const newState = tagsReducer(state, {
        type: UPDATE_TAG,
        id: 'tag-1',
        value: 'New Name',
      })
      expect(newState.bible.tags['tag-1'].name).toBe('New Name')
    })

    it('should update tag name in all entities that reference it', () => {
      const state = {
        bible: {
          ...initialState.bible,
          tags: {
            'tag-1': { id: 'tag-1', name: 'Old Name', date: Date.now() },
          },
          highlights: {
            '1-1-1': {
              color: 'red',
              date: Date.now(),
              tags: { 'tag-1': { id: 'tag-1', name: 'Old Name' } },
            },
          },
          notes: {
            '1-1-2': {
              title: 'Note',
              description: 'Test',
              date: Date.now(),
              tags: { 'tag-1': { id: 'tag-1', name: 'Old Name' } },
            },
          },
        },
      }
      const newState = tagsReducer(state, {
        type: UPDATE_TAG,
        id: 'tag-1',
        value: 'New Name',
      })
      expect(newState.bible.tags['tag-1'].name).toBe('New Name')
      expect(newState.bible.highlights['1-1-1'].tags['tag-1'].name).toBe('New Name')
      expect(newState.bible.notes['1-1-2'].tags['tag-1'].name).toBe('New Name')
    })
  })

  describe('REMOVE_TAG', () => {
    it('should remove a tag', () => {
      const state = {
        bible: {
          ...initialState.bible,
          tags: {
            'tag-1': { id: 'tag-1', name: 'Tag 1', date: Date.now() },
            'tag-2': { id: 'tag-2', name: 'Tag 2', date: Date.now() },
          },
        },
      }
      const newState = tagsReducer(state, {
        type: REMOVE_TAG,
        payload: 'tag-1',
      })
      expect(newState.bible.tags['tag-1']).toBeUndefined()
      expect(newState.bible.tags['tag-2']).toBeDefined()
    })

    it('should remove tag from all entities', () => {
      const state = {
        bible: {
          ...initialState.bible,
          tags: {
            'tag-1': { id: 'tag-1', name: 'Tag 1', date: Date.now() },
          },
          highlights: {
            '1-1-1': {
              color: 'red',
              date: Date.now(),
              tags: { 'tag-1': { id: 'tag-1', name: 'Tag 1' } },
            },
          },
          notes: {
            '1-1-2': {
              title: 'Note',
              description: 'Test',
              date: Date.now(),
              tags: { 'tag-1': { id: 'tag-1', name: 'Tag 1' } },
            },
          },
        },
      }
      const newState = tagsReducer(state, {
        type: REMOVE_TAG,
        payload: 'tag-1',
      })
      expect(newState.bible.tags['tag-1']).toBeUndefined()
      expect(newState.bible.highlights['1-1-1'].tags['tag-1']).toBeUndefined()
      expect(newState.bible.notes['1-1-2'].tags['tag-1']).toBeUndefined()
    })
  })

  describe('TOGGLE_TAG_ENTITY', () => {
    describe('with ids (multiple items)', () => {
      it('should add tag to multiple highlights', () => {
        const state = {
          bible: {
            ...initialState.bible,
            tags: {
              'tag-1': { id: 'tag-1', name: 'Tag 1', date: Date.now() },
            },
            highlights: {
              '1-1-1': { color: 'red', date: Date.now(), tags: {} },
              '1-1-2': { color: 'blue', date: Date.now(), tags: {} },
            },
          },
        }
        const newState = tagsReducer(state, {
          type: TOGGLE_TAG_ENTITY,
          payload: {
            item: {
              entity: 'highlights',
              ids: { '1-1-1': true, '1-1-2': true },
            },
            tagId: 'tag-1',
          },
        })
        expect(newState.bible.highlights['1-1-1'].tags['tag-1']).toBeDefined()
        expect(newState.bible.highlights['1-1-2'].tags['tag-1']).toBeDefined()
        expect(newState.bible.tags['tag-1'].highlights['1-1-1']).toBe(true)
        expect(newState.bible.tags['tag-1'].highlights['1-1-2']).toBe(true)
      })

      it('should remove tag from multiple highlights when already tagged', () => {
        const state = {
          bible: {
            ...initialState.bible,
            tags: {
              'tag-1': {
                id: 'tag-1',
                name: 'Tag 1',
                date: Date.now(),
                highlights: { '1-1-1': true, '1-1-2': true },
              },
            },
            highlights: {
              '1-1-1': {
                color: 'red',
                date: Date.now(),
                tags: { 'tag-1': { id: 'tag-1', name: 'Tag 1' } },
              },
              '1-1-2': {
                color: 'blue',
                date: Date.now(),
                tags: { 'tag-1': { id: 'tag-1', name: 'Tag 1' } },
              },
            },
          },
        }
        const newState = tagsReducer(state, {
          type: TOGGLE_TAG_ENTITY,
          payload: {
            item: {
              entity: 'highlights',
              ids: { '1-1-1': true, '1-1-2': true },
            },
            tagId: 'tag-1',
          },
        })
        expect(newState.bible.highlights['1-1-1'].tags['tag-1']).toBeUndefined()
        expect(newState.bible.highlights['1-1-2'].tags['tag-1']).toBeUndefined()
        expect(newState.bible.tags['tag-1'].highlights['1-1-1']).toBeUndefined()
        expect(newState.bible.tags['tag-1'].highlights['1-1-2']).toBeUndefined()
      })

      it('should create highlight entity if it does not exist when adding tag', () => {
        const state = {
          bible: {
            ...initialState.bible,
            tags: {
              'tag-1': { id: 'tag-1', name: 'Tag 1', date: Date.now() },
            },
            highlights: {},
          },
        }
        const newState = tagsReducer(state, {
          type: TOGGLE_TAG_ENTITY,
          payload: {
            item: {
              entity: 'highlights',
              ids: { '1-1-1': true },
            },
            tagId: 'tag-1',
          },
        })
        expect(newState.bible.highlights['1-1-1']).toBeDefined()
        expect(newState.bible.highlights['1-1-1'].color).toBe('')
        expect(newState.bible.highlights['1-1-1'].tags['tag-1']).toBeDefined()
      })

      it('should delete highlight with no color and no tags after untag', () => {
        const state = {
          bible: {
            ...initialState.bible,
            tags: {
              'tag-1': {
                id: 'tag-1',
                name: 'Tag 1',
                date: Date.now(),
                highlights: { '1-1-1': true },
              },
            },
            highlights: {
              '1-1-1': {
                color: '',
                date: Date.now(),
                tags: { 'tag-1': { id: 'tag-1', name: 'Tag 1' } },
              },
            },
          },
        }
        const newState = tagsReducer(state, {
          type: TOGGLE_TAG_ENTITY,
          payload: {
            item: {
              entity: 'highlights',
              ids: { '1-1-1': true },
            },
            tagId: 'tag-1',
          },
        })
        expect(newState.bible.highlights['1-1-1']).toBeUndefined()
      })

      it('should not delete highlight with color when untagging', () => {
        const state = {
          bible: {
            ...initialState.bible,
            tags: {
              'tag-1': {
                id: 'tag-1',
                name: 'Tag 1',
                date: Date.now(),
                highlights: { '1-1-1': true },
              },
            },
            highlights: {
              '1-1-1': {
                color: 'red',
                date: Date.now(),
                tags: { 'tag-1': { id: 'tag-1', name: 'Tag 1' } },
              },
            },
          },
        }
        const newState = tagsReducer(state, {
          type: TOGGLE_TAG_ENTITY,
          payload: {
            item: {
              entity: 'highlights',
              ids: { '1-1-1': true },
            },
            tagId: 'tag-1',
          },
        })
        expect(newState.bible.highlights['1-1-1']).toBeDefined()
        expect(newState.bible.highlights['1-1-1'].color).toBe('red')
      })
    })

    describe('with id (single item)', () => {
      it('should add tag to a single entity', () => {
        const state = {
          bible: {
            ...initialState.bible,
            tags: {
              'tag-1': { id: 'tag-1', name: 'Tag 1', date: Date.now() },
            },
            studies: {
              'study-1': {
                id: 'study-1',
                title: 'Study',
                created_at: Date.now(),
                modified_at: Date.now(),
                content: { ops: [] },
                user: { id: 'user-1', displayName: 'User', photoUrl: '' },
                tags: {},
              },
            },
          },
        }
        const newState = tagsReducer(state, {
          type: TOGGLE_TAG_ENTITY,
          payload: {
            item: {
              entity: 'studies',
              id: 'study-1',
            },
            tagId: 'tag-1',
          },
        })
        expect(newState.bible.studies['study-1'].tags['tag-1']).toBeDefined()
        expect(newState.bible.tags['tag-1'].studies['study-1']).toBe(true)
      })

      it('should remove tag from a single entity when already tagged', () => {
        const state = {
          bible: {
            ...initialState.bible,
            tags: {
              'tag-1': {
                id: 'tag-1',
                name: 'Tag 1',
                date: Date.now(),
                studies: { 'study-1': true },
              },
            },
            studies: {
              'study-1': {
                id: 'study-1',
                title: 'Study',
                created_at: Date.now(),
                modified_at: Date.now(),
                content: { ops: [] },
                user: { id: 'user-1', displayName: 'User', photoUrl: '' },
                tags: { 'tag-1': { id: 'tag-1', name: 'Tag 1' } },
              },
            },
          },
        }
        const newState = tagsReducer(state, {
          type: TOGGLE_TAG_ENTITY,
          payload: {
            item: {
              entity: 'studies',
              id: 'study-1',
            },
            tagId: 'tag-1',
          },
        })
        expect(newState.bible.studies['study-1'].tags['tag-1']).toBeUndefined()
        expect(newState.bible.tags['tag-1'].studies['study-1']).toBeUndefined()
      })

      it('should create entity with title if it does not exist', () => {
        const state = {
          bible: {
            ...initialState.bible,
            tags: {
              'tag-1': { id: 'tag-1', name: 'Tag 1', date: Date.now() },
            },
            words: {},
          },
        }
        const newState = tagsReducer(state, {
          type: TOGGLE_TAG_ENTITY,
          payload: {
            item: {
              entity: 'words',
              id: 'word-1',
              title: 'Word Title',
            },
            tagId: 'tag-1',
          },
        })
        expect(newState.bible.words['word-1']).toBeDefined()
        expect(newState.bible.words['word-1'].title).toBe('Word Title')
        expect(newState.bible.words['word-1'].tags['tag-1']).toBeDefined()
      })

      it('should delete word/strongs/nave entity when last tag is removed', () => {
        const entities = ['naves', 'strongsHebreu', 'strongsGrec', 'words'] as const

        entities.forEach(entity => {
          const state = {
            bible: {
              ...initialState.bible,
              tags: {
                'tag-1': {
                  id: 'tag-1',
                  name: 'Tag 1',
                  date: Date.now(),
                  [entity]: { 'item-1': true },
                },
              },
              [entity]: {
                'item-1': {
                  id: 'item-1',
                  title: 'Item',
                  tags: { 'tag-1': { id: 'tag-1', name: 'Tag 1' } },
                },
              },
            },
          }
          const newState = tagsReducer(state, {
            type: TOGGLE_TAG_ENTITY,
            payload: {
              item: {
                entity,
                id: 'item-1',
              },
              tagId: 'tag-1',
            },
          })
          expect(newState.bible[entity]['item-1']).toBeUndefined()
        })
      })
    })
  })

  describe('entitiesArray', () => {
    it('should contain all entity types', () => {
      expect(entitiesArray).toContain('highlights')
      expect(entitiesArray).toContain('notes')
      expect(entitiesArray).toContain('links')
      expect(entitiesArray).toContain('studies')
      expect(entitiesArray).toContain('strongsHebreu')
      expect(entitiesArray).toContain('strongsGrec')
      expect(entitiesArray).toContain('words')
      expect(entitiesArray).toContain('naves')
    })
  })

  describe('default case', () => {
    it('should return state unchanged for unknown action', () => {
      const state = {
        bible: {
          ...initialState.bible,
          tags: {
            'tag-1': { id: 'tag-1', name: 'Tag 1', date: Date.now() },
          },
        },
      }
      const newState = tagsReducer(state, { type: 'UNKNOWN_ACTION' })
      expect(newState).toEqual(state)
    })
  })
})
