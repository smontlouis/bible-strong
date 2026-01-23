/* eslint-env jest */

// Mock react-native before any imports
import type { Bookmark, Tag, TagsObj } from '~common/types'
import userReducer, { UserState } from '../user'
import { addTag, updateTag, removeTag, toggleTagEntity, entitiesArray } from '../user/tags'

jest.mock('react-native', () => ({
  Appearance: {
    getColorScheme: jest.fn(() => 'light'),
  },
}))

// Mock expo-file-system
jest.mock('expo-file-system/legacy', () => ({}))
jest.mock('expo-file-system', () => ({}))

// Mock expo-sqlite
jest.mock('expo-sqlite', () => ({}))

// Mock bibleVersions and databases to avoid deep import chains
jest.mock('~helpers/bibleVersions', () => ({
  versions: {},
  getIfVersionNeedsUpdate: jest.fn(),
}))

jest.mock('~helpers/databases', () => ({
  databases: {},
  getIfDatabaseNeedsUpdate: jest.fn(),
}))

// Mock modules before importing reducer
jest.mock('~state/tabs', () => ({
  tabGroupsAtom: {},
}))

jest.mock('jotai/vanilla', () => ({
  getDefaultStore: jest.fn(() => ({
    set: jest.fn(),
  })),
}))

jest.mock('~helpers/firebase', () => ({
  firebaseDb: {
    collection: jest.fn(),
  },
}))

jest.mock('~i18n', () => ({
  getLanguage: jest.fn(() => 'fr'),
}))

jest.mock('~helpers/languageUtils', () => ({
  getDefaultBibleVersion: jest.fn(() => 'LSG'),
}))

// Mock theme imports
jest.mock('~themes/colors', () => ({ primary: '#000' }))
jest.mock('~themes/darkColors', () => ({ primary: '#111' }))
jest.mock('~themes/blackColors', () => ({ primary: '#222' }))
jest.mock('~themes/sepiaColors', () => ({ primary: '#333' }))
jest.mock('~themes/natureColors', () => ({ primary: '#444' }))
jest.mock('~themes/sunsetColors', () => ({ primary: '#555' }))
jest.mock('~themes/mauveColors', () => ({ primary: '#666' }))
jest.mock('~themes/nightColors', () => ({ primary: '#777' }))

// Mock generateUUID to return predictable values
jest.mock('~helpers/generateUUID', () => {
  let counter = 0
  return jest.fn(() => `uuid-${++counter}`)
})

const getInitialState = (): UserState =>
  ({
    id: '',
    email: '',
    displayName: '',
    photoURL: '',
    provider: '',
    subscription: undefined,
    emailVerified: false,
    createdAt: null,
    isLoading: true,
    notifications: {
      verseOfTheDay: '07:00',
      notificationId: '',
    },
    changelog: {
      isLoading: true,
      lastSeen: 0,
      data: [],
    },
    needsUpdate: {},
    fontFamily: 'Avenir',
    bible: {
      changelog: {},
      bookmarks: {} as { [key: string]: Bookmark },
      highlights: {},
      notes: {},
      links: {},
      studies: {},
      tags: {} as TagsObj,
      strongsHebreu: {},
      strongsGrec: {},
      words: {},
      naves: {},
      settings: {
        defaultBibleVersion: 'LSG',
        alignContent: 'left',
        lineHeight: 'normal',
        fontSizeScale: 0,
        textDisplay: 'inline',
        preferredColorScheme: 'auto',
        preferredLightTheme: 'default',
        preferredDarkTheme: 'dark',
        press: 'longPress',
        notesDisplay: 'inline',
        linksDisplay: 'inline',
        commentsDisplay: false,
        shareVerses: {
          hasVerseNumbers: true,
          hasInlineVerses: true,
          hasQuotes: true,
          hasAppName: true,
        },
        fontFamily: 'Avenir',
        theme: 'default',
        colors: {
          default: { primary: '#000' },
          dark: { primary: '#111' },
          black: { primary: '#222' },
          sepia: { primary: '#333' },
          nature: { primary: '#444' },
          sunset: { primary: '#555' },
          mauve: { primary: '#666' },
          night: { primary: '#777' },
        },
        compare: {
          LSG: true,
        },
        customHighlightColors: [],
      },
    },
  }) as unknown as UserState

const createTag = (id: string, name: string, overrides?: Partial<Tag>): Tag => ({
  id,
  name,
  date: Date.now(),
  ...overrides,
})

describe('Tags Reducer', () => {
  let initialState: UserState

  beforeEach(() => {
    initialState = getInitialState()
    jest.clearAllMocks()
  })

  describe('addTag', () => {
    it('should add a new tag', () => {
      const newState = userReducer(initialState, addTag('Test Tag'))
      const tagIds = Object.keys(newState.bible.tags)
      expect(tagIds).toHaveLength(1)
      expect(newState.bible.tags[tagIds[0]].name).toBe('Test Tag')
    })

    it('should set id and date on new tag', () => {
      const beforeAdd = Date.now()
      const newState = userReducer(initialState, addTag('Test Tag'))
      const tagIds = Object.keys(newState.bible.tags)
      const tag = newState.bible.tags[tagIds[0]]
      expect(tag.id).toBeDefined()
      expect(tag.date).toBeGreaterThanOrEqual(beforeAdd)
    })

    it('should add multiple tags', () => {
      let state = userReducer(initialState, addTag('Tag 1'))
      state = userReducer(state, addTag('Tag 2'))
      expect(Object.keys(state.bible.tags)).toHaveLength(2)
    })
  })

  describe('updateTag', () => {
    it('should update tag name', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          tags: {
            'tag-1': createTag('tag-1', 'Old Name'),
          },
        },
      } as UserState
      const newState = userReducer(state, updateTag('tag-1', 'New Name'))
      expect(newState.bible.tags['tag-1'].name).toBe('New Name')
    })

    it('should update tag name in all entities that reference it', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          tags: {
            'tag-1': createTag('tag-1', 'Old Name'),
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
      } as UserState
      const newState = userReducer(state, updateTag('tag-1', 'New Name'))
      expect(newState.bible.tags['tag-1'].name).toBe('New Name')
      expect(newState.bible.highlights['1-1-1'].tags['tag-1'].name).toBe('New Name')
      expect(newState.bible.notes['1-1-2'].tags?.['tag-1'].name).toBe('New Name')
    })
  })

  describe('removeTag', () => {
    it('should remove a tag', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          tags: {
            'tag-1': createTag('tag-1', 'Tag 1'),
            'tag-2': createTag('tag-2', 'Tag 2'),
          },
        },
      } as UserState
      const newState = userReducer(state, removeTag('tag-1'))
      expect(newState.bible.tags['tag-1']).toBeUndefined()
      expect(newState.bible.tags['tag-2']).toBeDefined()
    })

    it('should remove tag from all entities', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          tags: {
            'tag-1': createTag('tag-1', 'Tag 1'),
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
      } as UserState
      const newState = userReducer(state, removeTag('tag-1'))
      expect(newState.bible.tags['tag-1']).toBeUndefined()
      expect(newState.bible.highlights['1-1-1'].tags['tag-1']).toBeUndefined()
      expect(newState.bible.notes['1-1-2'].tags?.['tag-1']).toBeUndefined()
    })
  })

  describe('toggleTagEntity', () => {
    describe('with ids (multiple items)', () => {
      it('should add tag to multiple highlights', () => {
        const state = {
          ...initialState,
          bible: {
            ...initialState.bible,
            tags: {
              'tag-1': createTag('tag-1', 'Tag 1'),
            },
            highlights: {
              '1-1-1': { color: 'red', date: Date.now(), tags: {} },
              '1-1-2': { color: 'blue', date: Date.now(), tags: {} },
            },
          },
        } as UserState
        const newState = userReducer(
          state,
          toggleTagEntity({
            item: {
              entity: 'highlights',
              ids: { '1-1-1': true, '1-1-2': true },
            },
            tagId: 'tag-1',
          })
        )
        expect(newState.bible.highlights['1-1-1'].tags['tag-1']).toBeDefined()
        expect(newState.bible.highlights['1-1-2'].tags['tag-1']).toBeDefined()
        expect(newState.bible.tags['tag-1'].highlights?.['1-1-1']).toBe(true)
        expect(newState.bible.tags['tag-1'].highlights?.['1-1-2']).toBe(true)
      })

      it('should remove tag from multiple highlights when already tagged', () => {
        const state = {
          ...initialState,
          bible: {
            ...initialState.bible,
            tags: {
              'tag-1': createTag('tag-1', 'Tag 1', {
                highlights: { '1-1-1': true, '1-1-2': true },
              }),
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
        } as UserState
        const newState = userReducer(
          state,
          toggleTagEntity({
            item: {
              entity: 'highlights',
              ids: { '1-1-1': true, '1-1-2': true },
            },
            tagId: 'tag-1',
          })
        )
        expect(newState.bible.highlights['1-1-1'].tags['tag-1']).toBeUndefined()
        expect(newState.bible.highlights['1-1-2'].tags['tag-1']).toBeUndefined()
        expect(newState.bible.tags['tag-1'].highlights?.['1-1-1']).toBeUndefined()
        expect(newState.bible.tags['tag-1'].highlights?.['1-1-2']).toBeUndefined()
      })

      it('should create highlight entity if it does not exist when adding tag', () => {
        const state = {
          ...initialState,
          bible: {
            ...initialState.bible,
            tags: {
              'tag-1': createTag('tag-1', 'Tag 1'),
            },
            highlights: {},
          },
        } as UserState
        const newState = userReducer(
          state,
          toggleTagEntity({
            item: {
              entity: 'highlights',
              ids: { '1-1-1': true },
            },
            tagId: 'tag-1',
          })
        )
        expect(newState.bible.highlights['1-1-1']).toBeDefined()
        expect(newState.bible.highlights['1-1-1'].color).toBe('')
        expect(newState.bible.highlights['1-1-1'].tags['tag-1']).toBeDefined()
      })

      it('should delete highlight with no color and no tags after untag', () => {
        const state = {
          ...initialState,
          bible: {
            ...initialState.bible,
            tags: {
              'tag-1': createTag('tag-1', 'Tag 1', {
                highlights: { '1-1-1': true },
              }),
            },
            highlights: {
              '1-1-1': {
                color: '',
                date: Date.now(),
                tags: { 'tag-1': { id: 'tag-1', name: 'Tag 1' } },
              },
            },
          },
        } as UserState
        const newState = userReducer(
          state,
          toggleTagEntity({
            item: {
              entity: 'highlights',
              ids: { '1-1-1': true },
            },
            tagId: 'tag-1',
          })
        )
        expect(newState.bible.highlights['1-1-1']).toBeUndefined()
      })

      it('should not delete highlight with color when untagging', () => {
        const state = {
          ...initialState,
          bible: {
            ...initialState.bible,
            tags: {
              'tag-1': createTag('tag-1', 'Tag 1', {
                highlights: { '1-1-1': true },
              }),
            },
            highlights: {
              '1-1-1': {
                color: 'red',
                date: Date.now(),
                tags: { 'tag-1': { id: 'tag-1', name: 'Tag 1' } },
              },
            },
          },
        } as UserState
        const newState = userReducer(
          state,
          toggleTagEntity({
            item: {
              entity: 'highlights',
              ids: { '1-1-1': true },
            },
            tagId: 'tag-1',
          })
        )
        expect(newState.bible.highlights['1-1-1']).toBeDefined()
        expect(newState.bible.highlights['1-1-1'].color).toBe('red')
      })
    })

    describe('with id (single item)', () => {
      it('should add tag to a single entity', () => {
        const state = {
          ...initialState,
          bible: {
            ...initialState.bible,
            tags: {
              'tag-1': createTag('tag-1', 'Tag 1'),
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
        } as UserState
        const newState = userReducer(
          state,
          toggleTagEntity({
            item: {
              entity: 'studies',
              id: 'study-1',
            },
            tagId: 'tag-1',
          })
        )
        expect(newState.bible.studies['study-1'].tags?.['tag-1']).toBeDefined()
        expect(newState.bible.tags['tag-1'].studies?.['study-1']).toBe(true)
      })

      it('should remove tag from a single entity when already tagged', () => {
        const state = {
          ...initialState,
          bible: {
            ...initialState.bible,
            tags: {
              'tag-1': createTag('tag-1', 'Tag 1', {
                studies: { 'study-1': true },
              }),
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
        } as UserState
        const newState = userReducer(
          state,
          toggleTagEntity({
            item: {
              entity: 'studies',
              id: 'study-1',
            },
            tagId: 'tag-1',
          })
        )
        expect(newState.bible.studies['study-1'].tags?.['tag-1']).toBeUndefined()
        expect(newState.bible.tags['tag-1'].studies?.['study-1']).toBeUndefined()
      })

      it('should create entity with title if it does not exist', () => {
        const state = {
          ...initialState,
          bible: {
            ...initialState.bible,
            tags: {
              'tag-1': createTag('tag-1', 'Tag 1'),
            },
            words: {},
          },
        } as UserState
        const newState = userReducer(
          state,
          toggleTagEntity({
            item: {
              entity: 'words',
              id: 'word-1',
              title: 'Word Title',
            },
            tagId: 'tag-1',
          })
        )
        expect(newState.bible.words['word-1']).toBeDefined()
        expect(newState.bible.words['word-1'].title).toBe('Word Title')
        expect(newState.bible.words['word-1'].tags['tag-1']).toBeDefined()
      })

      it('should delete word/strongs/nave entity when last tag is removed', () => {
        const entities = ['naves', 'strongsHebreu', 'strongsGrec', 'words'] as const

        entities.forEach(entity => {
          const state = {
            ...initialState,
            bible: {
              ...initialState.bible,
              tags: {
                'tag-1': createTag('tag-1', 'Tag 1', {
                  [entity]: { 'item-1': true },
                }),
              },
              [entity]: {
                'item-1': {
                  id: 'item-1',
                  title: 'Item',
                  tags: { 'tag-1': { id: 'tag-1', name: 'Tag 1' } },
                },
              },
            },
          } as UserState
          const newState = userReducer(
            state,
            toggleTagEntity({
              item: {
                entity,
                id: 'item-1',
              },
              tagId: 'tag-1',
            })
          )
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
        ...initialState,
        bible: {
          ...initialState.bible,
          tags: {
            'tag-1': createTag('tag-1', 'Tag 1'),
          },
        },
      } as UserState
      const newState = userReducer(state, { type: 'UNKNOWN_ACTION' } as any)
      expect(newState.bible.tags).toEqual(state.bible.tags)
    })
  })
})
