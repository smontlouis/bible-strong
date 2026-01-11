/* eslint-env jest */

// Mock react-native before any imports
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

import type { Bookmark } from '~common/types'
import userReducer, { UserState, Link, LinksObj } from '../user'
import { addLinkAction, updateLink, deleteLink } from '../user/links'

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
      links: {} as LinksObj,
      studies: {},
      tags: {},
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

const createLink = (overrides?: Partial<Link>): Link => ({
  url: 'https://example.com',
  linkType: 'website',
  date: Date.now(),
  ...overrides,
})

describe('Links Reducer', () => {
  let initialState: UserState

  beforeEach(() => {
    initialState = getInitialState()
  })

  describe('addLinkAction', () => {
    it('should add a link', () => {
      const link = createLink()
      const newState = userReducer(initialState, addLinkAction({ '1-1-1': link }))
      expect(newState.bible.links['1-1-1']).toBeDefined()
      expect(newState.bible.links['1-1-1'].url).toBe('https://example.com')
      expect(newState.bible.links['1-1-1'].linkType).toBe('website')
    })

    it('should add YouTube link with videoId', () => {
      const link = createLink({
        url: 'https://youtube.com/watch?v=abc123',
        linkType: 'youtube',
        videoId: 'abc123',
      })
      const newState = userReducer(initialState, addLinkAction({ '1-1-1': link }))
      expect(newState.bible.links['1-1-1'].linkType).toBe('youtube')
      expect(newState.bible.links['1-1-1'].videoId).toBe('abc123')
    })

    it('should add link with OpenGraph data', () => {
      const link = createLink({
        ogData: {
          title: 'Example Site',
          description: 'A description',
          image: 'https://example.com/image.jpg',
          siteName: 'Example',
          fetchedAt: Date.now(),
        },
      })
      const newState = userReducer(initialState, addLinkAction({ '1-1-1': link }))
      expect(newState.bible.links['1-1-1'].ogData?.title).toBe('Example Site')
    })

    it('should add link with custom title', () => {
      const link = createLink({
        customTitle: 'My Custom Title',
      })
      const newState = userReducer(initialState, addLinkAction({ '1-1-1': link }))
      expect(newState.bible.links['1-1-1'].customTitle).toBe('My Custom Title')
    })

    it('should add link with composite verse key', () => {
      const link = createLink()
      const newState = userReducer(initialState, addLinkAction({ '1-1-1/1-1-2/1-1-3': link }))
      expect(newState.bible.links['1-1-1/1-1-2/1-1-3']).toBeDefined()
    })

    it('should merge with existing links', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          links: {
            '1-1-1': createLink({ url: 'https://existing.com' }),
          },
        },
      } as UserState
      const newState = userReducer(
        state,
        addLinkAction({ '1-1-2': createLink({ url: 'https://new.com' }) })
      )
      expect(newState.bible.links['1-1-1'].url).toBe('https://existing.com')
      expect(newState.bible.links['1-1-2'].url).toBe('https://new.com')
    })

    it('should overwrite existing link with same key', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          links: {
            '1-1-1': createLink({ url: 'https://old.com' }),
          },
        },
      } as UserState
      const newState = userReducer(
        state,
        addLinkAction({ '1-1-1': createLink({ url: 'https://updated.com' }) })
      )
      expect(newState.bible.links['1-1-1'].url).toBe('https://updated.com')
    })
  })

  describe('updateLink', () => {
    it('should update link properties', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          links: {
            '1-1-1': createLink({ url: 'https://old.com' }),
          },
        },
      } as UserState
      const newState = userReducer(state, updateLink('1-1-1', { url: 'https://updated.com' }))
      expect(newState.bible.links['1-1-1'].url).toBe('https://updated.com')
    })

    it('should update custom title', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          links: {
            '1-1-1': createLink(),
          },
        },
      } as UserState
      const newState = userReducer(state, updateLink('1-1-1', { customTitle: 'New Title' }))
      expect(newState.bible.links['1-1-1'].customTitle).toBe('New Title')
    })

    it('should update ogData', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          links: {
            '1-1-1': createLink(),
          },
        },
      } as UserState
      const newState = userReducer(
        state,
        updateLink('1-1-1', {
          ogData: {
            title: 'Updated Title',
            description: 'Updated description',
            fetchedAt: Date.now(),
          },
        })
      )
      expect(newState.bible.links['1-1-1'].ogData?.title).toBe('Updated Title')
    })

    it('should preserve other properties when updating', () => {
      const originalDate = Date.now()
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          links: {
            '1-1-1': createLink({ date: originalDate, linkType: 'youtube' }),
          },
        },
      } as UserState
      const newState = userReducer(state, updateLink('1-1-1', { customTitle: 'New Title' }))
      expect(newState.bible.links['1-1-1'].date).toBe(originalDate)
      expect(newState.bible.links['1-1-1'].linkType).toBe('youtube')
    })

    it('should do nothing if link does not exist', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          links: {
            '1-1-1': createLink(),
          },
        },
      } as UserState
      const newState = userReducer(state, updateLink('1-1-99', { customTitle: 'New Title' }))
      expect(newState.bible.links['1-1-99']).toBeUndefined()
      expect(newState.bible.links['1-1-1'].customTitle).toBeUndefined()
    })
  })

  describe('deleteLink', () => {
    it('should remove a link', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          links: {
            '1-1-1': createLink(),
            '1-1-2': createLink(),
          },
        },
      } as UserState
      const newState = userReducer(state, deleteLink('1-1-1'))
      expect(newState.bible.links['1-1-1']).toBeUndefined()
      expect(newState.bible.links['1-1-2']).toBeDefined()
    })

    it('should remove link with composite key', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          links: {
            '1-1-1/1-1-2': createLink(),
          },
        },
      } as UserState
      const newState = userReducer(state, deleteLink('1-1-1/1-1-2'))
      expect(newState.bible.links['1-1-1/1-1-2']).toBeUndefined()
    })

    it('should remove link references from tags', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          links: {
            '1-1-1': createLink({
              tags: { 'tag-1': { id: 'tag-1', name: 'Test', date: Date.now() } },
            }),
          },
          tags: {
            'tag-1': {
              id: 'tag-1',
              name: 'Test',
              date: Date.now(),
              links: { '1-1-1': true },
            },
          },
        },
      } as UserState
      const newState = userReducer(state, deleteLink('1-1-1'))
      expect(newState.bible.links['1-1-1']).toBeUndefined()
      expect(newState.bible.tags['tag-1'].links?.['1-1-1']).toBeUndefined()
    })

    it('should handle removing non-existent link', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          links: {
            '1-1-1': createLink(),
          },
        },
      } as UserState
      const newState = userReducer(state, deleteLink('1-1-99'))
      expect(newState.bible.links['1-1-1']).toBeDefined()
    })
  })

  describe('default case', () => {
    it('should return state unchanged for unknown action', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          links: {
            '1-1-1': createLink(),
          },
        },
      } as UserState
      const newState = userReducer(state, { type: 'UNKNOWN_ACTION' } as any)
      expect(newState.bible.links).toEqual(state.bible.links)
    })
  })

  describe('link types', () => {
    const linkTypes: Array<Link['linkType']> = [
      'youtube',
      'twitter',
      'instagram',
      'tiktok',
      'vimeo',
      'spotify',
      'facebook',
      'linkedin',
      'github',
      'website',
    ]

    linkTypes.forEach(linkType => {
      it(`should handle ${linkType} link type`, () => {
        const link = createLink({ linkType })
        const newState = userReducer(initialState, addLinkAction({ '1-1-1': link }))
        expect(newState.bible.links['1-1-1'].linkType).toBe(linkType)
      })
    })
  })
})
