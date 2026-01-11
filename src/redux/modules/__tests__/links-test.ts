/* eslint-env jest */

import linksReducer, {
  ADD_LINK,
  UPDATE_LINK,
  REMOVE_LINK,
} from '../user/links'
import type { Link, LinksObj } from '../user'

const getInitialState = () => ({
  bible: {
    links: {} as LinksObj,
    tags: {} as { [key: string]: any },
  },
})

const createLink = (overrides?: Partial<Link>): Link => ({
  url: 'https://example.com',
  linkType: 'website',
  date: Date.now(),
  ...overrides,
})

describe('Links Reducer', () => {
  let initialState: ReturnType<typeof getInitialState>

  beforeEach(() => {
    initialState = getInitialState()
  })

  describe('ADD_LINK', () => {
    it('should add a link', () => {
      const link = createLink()
      const newState = linksReducer(initialState, {
        type: ADD_LINK,
        payload: { '1-1-1': link },
      })
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
      const newState = linksReducer(initialState, {
        type: ADD_LINK,
        payload: { '1-1-1': link },
      })
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
      const newState = linksReducer(initialState, {
        type: ADD_LINK,
        payload: { '1-1-1': link },
      })
      expect(newState.bible.links['1-1-1'].ogData?.title).toBe('Example Site')
    })

    it('should add link with custom title', () => {
      const link = createLink({
        customTitle: 'My Custom Title',
      })
      const newState = linksReducer(initialState, {
        type: ADD_LINK,
        payload: { '1-1-1': link },
      })
      expect(newState.bible.links['1-1-1'].customTitle).toBe('My Custom Title')
    })

    it('should add link with composite verse key', () => {
      const link = createLink()
      const newState = linksReducer(initialState, {
        type: ADD_LINK,
        payload: { '1-1-1/1-1-2/1-1-3': link },
      })
      expect(newState.bible.links['1-1-1/1-1-2/1-1-3']).toBeDefined()
    })

    it('should merge with existing links', () => {
      const state = {
        bible: {
          links: {
            '1-1-1': createLink({ url: 'https://existing.com' }),
          },
          tags: {},
        },
      }
      const newState = linksReducer(state, {
        type: ADD_LINK,
        payload: { '1-1-2': createLink({ url: 'https://new.com' }) },
      })
      expect(newState.bible.links['1-1-1'].url).toBe('https://existing.com')
      expect(newState.bible.links['1-1-2'].url).toBe('https://new.com')
    })

    it('should overwrite existing link with same key', () => {
      const state = {
        bible: {
          links: {
            '1-1-1': createLink({ url: 'https://old.com' }),
          },
          tags: {},
        },
      }
      const newState = linksReducer(state, {
        type: ADD_LINK,
        payload: { '1-1-1': createLink({ url: 'https://updated.com' }) },
      })
      expect(newState.bible.links['1-1-1'].url).toBe('https://updated.com')
    })
  })

  describe('UPDATE_LINK', () => {
    it('should update link properties', () => {
      const state = {
        bible: {
          links: {
            '1-1-1': createLink({ url: 'https://old.com' }),
          },
          tags: {},
        },
      }
      const newState = linksReducer(state, {
        type: UPDATE_LINK,
        payload: { key: '1-1-1', data: { url: 'https://updated.com' } },
      })
      expect(newState.bible.links['1-1-1'].url).toBe('https://updated.com')
    })

    it('should update custom title', () => {
      const state = {
        bible: {
          links: {
            '1-1-1': createLink(),
          },
          tags: {},
        },
      }
      const newState = linksReducer(state, {
        type: UPDATE_LINK,
        payload: { key: '1-1-1', data: { customTitle: 'New Title' } },
      })
      expect(newState.bible.links['1-1-1'].customTitle).toBe('New Title')
    })

    it('should update ogData', () => {
      const state = {
        bible: {
          links: {
            '1-1-1': createLink(),
          },
          tags: {},
        },
      }
      const newState = linksReducer(state, {
        type: UPDATE_LINK,
        payload: {
          key: '1-1-1',
          data: {
            ogData: {
              title: 'Updated Title',
              description: 'Updated description',
              fetchedAt: Date.now(),
            },
          },
        },
      })
      expect(newState.bible.links['1-1-1'].ogData?.title).toBe('Updated Title')
    })

    it('should preserve other properties when updating', () => {
      const originalDate = Date.now()
      const state = {
        bible: {
          links: {
            '1-1-1': createLink({ date: originalDate, linkType: 'youtube' }),
          },
          tags: {},
        },
      }
      const newState = linksReducer(state, {
        type: UPDATE_LINK,
        payload: { key: '1-1-1', data: { customTitle: 'New Title' } },
      })
      expect(newState.bible.links['1-1-1'].date).toBe(originalDate)
      expect(newState.bible.links['1-1-1'].linkType).toBe('youtube')
    })

    it('should do nothing if link does not exist', () => {
      const state = {
        bible: {
          links: {
            '1-1-1': createLink(),
          },
          tags: {},
        },
      }
      const newState = linksReducer(state, {
        type: UPDATE_LINK,
        payload: { key: '1-1-99', data: { customTitle: 'New Title' } },
      })
      expect(newState.bible.links['1-1-99']).toBeUndefined()
      expect(newState.bible.links['1-1-1'].customTitle).toBeUndefined()
    })
  })

  describe('REMOVE_LINK', () => {
    it('should remove a link', () => {
      const state = {
        bible: {
          links: {
            '1-1-1': createLink(),
            '1-1-2': createLink(),
          },
          tags: {},
        },
      }
      const newState = linksReducer(state, {
        type: REMOVE_LINK,
        payload: '1-1-1',
      })
      expect(newState.bible.links['1-1-1']).toBeUndefined()
      expect(newState.bible.links['1-1-2']).toBeDefined()
    })

    it('should remove link with composite key', () => {
      const state = {
        bible: {
          links: {
            '1-1-1/1-1-2': createLink(),
          },
          tags: {},
        },
      }
      const newState = linksReducer(state, {
        type: REMOVE_LINK,
        payload: '1-1-1/1-1-2',
      })
      expect(newState.bible.links['1-1-1/1-1-2']).toBeUndefined()
    })

    it('should remove link references from tags', () => {
      const state = {
        bible: {
          links: {
            '1-1-1': createLink({ tags: { 'tag-1': { id: 'tag-1', name: 'Test', date: Date.now(), strongsGrec: {} } } }),
          },
          tags: {
            'tag-1': {
              id: 'tag-1',
              name: 'Test',
              links: { '1-1-1': true },
            },
          },
        },
      }
      const newState = linksReducer(state, {
        type: REMOVE_LINK,
        payload: '1-1-1',
      })
      expect(newState.bible.links['1-1-1']).toBeUndefined()
      expect(newState.bible.tags['tag-1'].links['1-1-1']).toBeUndefined()
    })

    it('should handle removing non-existent link', () => {
      const state = {
        bible: {
          links: {
            '1-1-1': createLink(),
          },
          tags: {},
        },
      }
      const newState = linksReducer(state, {
        type: REMOVE_LINK,
        payload: '1-1-99',
      })
      expect(newState.bible.links['1-1-1']).toBeDefined()
    })
  })

  describe('default case', () => {
    it('should return state unchanged for unknown action', () => {
      const state = {
        bible: {
          links: {
            '1-1-1': createLink(),
          },
          tags: {},
        },
      }
      const newState = linksReducer(state, { type: 'UNKNOWN_ACTION' })
      expect(newState).toEqual(state)
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
        const newState = linksReducer(initialState, {
          type: ADD_LINK,
          payload: { '1-1-1': link },
        })
        expect(newState.bible.links['1-1-1'].linkType).toBe(linkType)
      })
    })
  })
})
