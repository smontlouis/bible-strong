/* eslint-env jest */

import highlightsReducer, {
  ADD_HIGHLIGHT,
  REMOVE_HIGHLIGHT,
  CHANGE_HIGHLIGHT_COLOR,
} from '../user/highlights'
import type { Highlight, HighlightsObj } from '../user'

const getInitialState = () => ({
  bible: {
    highlights: {} as HighlightsObj,
    tags: {} as { [key: string]: any },
  },
})

describe('Highlights Reducer', () => {
  let initialState: ReturnType<typeof getInitialState>

  beforeEach(() => {
    initialState = getInitialState()
  })

  describe('ADD_HIGHLIGHT', () => {
    it('should add highlights for selected verses', () => {
      const selectedVerses = {
        '1-1-1': { color: 'yellow', date: Date.now(), tags: {} },
        '1-1-2': { color: 'yellow', date: Date.now(), tags: {} },
      }
      const newState = highlightsReducer(initialState, {
        type: ADD_HIGHLIGHT,
        selectedVerses,
      })
      expect(newState.bible.highlights['1-1-1']).toBeDefined()
      expect(newState.bible.highlights['1-1-2']).toBeDefined()
      expect(newState.bible.highlights['1-1-1'].color).toBe('yellow')
    })

    it('should merge with existing highlights', () => {
      const state = {
        bible: {
          highlights: {
            '1-1-1': { color: 'red', date: Date.now(), tags: {} },
          },
          tags: {},
        },
      }
      const selectedVerses = {
        '1-1-2': { color: 'blue', date: Date.now(), tags: {} },
      }
      const newState = highlightsReducer(state, {
        type: ADD_HIGHLIGHT,
        selectedVerses,
      })
      expect(newState.bible.highlights['1-1-1']).toBeDefined()
      expect(newState.bible.highlights['1-1-2']).toBeDefined()
    })

    it('should overwrite existing highlight with same key', () => {
      const state = {
        bible: {
          highlights: {
            '1-1-1': { color: 'red', date: Date.now(), tags: {} },
          },
          tags: {},
        },
      }
      const selectedVerses = {
        '1-1-1': { color: 'blue', date: Date.now(), tags: {} },
      }
      const newState = highlightsReducer(state, {
        type: ADD_HIGHLIGHT,
        selectedVerses,
      })
      expect(newState.bible.highlights['1-1-1'].color).toBe('blue')
    })
  })

  describe('CHANGE_HIGHLIGHT_COLOR', () => {
    it('should change color of specified highlights', () => {
      const state = {
        bible: {
          highlights: {
            '1-1-1': { color: 'red', date: Date.now(), tags: {} },
            '1-1-2': { color: 'red', date: Date.now(), tags: {} },
          },
          tags: {},
        },
      }
      const newState = highlightsReducer(state, {
        type: CHANGE_HIGHLIGHT_COLOR,
        verseIds: { '1-1-1': true, '1-1-2': true },
        color: 'green',
      })
      expect(newState.bible.highlights['1-1-1'].color).toBe('green')
      expect(newState.bible.highlights['1-1-2'].color).toBe('green')
    })

    it('should only change color of specified verses', () => {
      const state = {
        bible: {
          highlights: {
            '1-1-1': { color: 'red', date: Date.now(), tags: {} },
            '1-1-2': { color: 'blue', date: Date.now(), tags: {} },
          },
          tags: {},
        },
      }
      const newState = highlightsReducer(state, {
        type: CHANGE_HIGHLIGHT_COLOR,
        verseIds: { '1-1-1': true },
        color: 'green',
      })
      expect(newState.bible.highlights['1-1-1'].color).toBe('green')
      expect(newState.bible.highlights['1-1-2'].color).toBe('blue')
    })

    it('should preserve other highlight properties', () => {
      const originalDate = Date.now()
      const tags = { 'tag-1': { id: 'tag-1', name: 'Test' } }
      const state = {
        bible: {
          highlights: {
            '1-1-1': { color: 'red', date: originalDate, tags },
          },
          tags: {},
        },
      }
      const newState = highlightsReducer(state, {
        type: CHANGE_HIGHLIGHT_COLOR,
        verseIds: { '1-1-1': true },
        color: 'green',
      })
      expect(newState.bible.highlights['1-1-1'].date).toBe(originalDate)
      expect(newState.bible.highlights['1-1-1'].tags).toEqual(tags)
    })
  })

  describe('REMOVE_HIGHLIGHT', () => {
    it('should remove specified highlights', () => {
      const state = {
        bible: {
          highlights: {
            '1-1-1': { color: 'red', date: Date.now(), tags: {} },
            '1-1-2': { color: 'blue', date: Date.now(), tags: {} },
          },
          tags: {},
        },
      }
      const newState = highlightsReducer(state, {
        type: REMOVE_HIGHLIGHT,
        selectedVerses: { '1-1-1': true },
      })
      expect(newState.bible.highlights['1-1-1']).toBeUndefined()
      expect(newState.bible.highlights['1-1-2']).toBeDefined()
    })

    it('should remove multiple highlights at once', () => {
      const state = {
        bible: {
          highlights: {
            '1-1-1': { color: 'red', date: Date.now(), tags: {} },
            '1-1-2': { color: 'blue', date: Date.now(), tags: {} },
            '1-1-3': { color: 'green', date: Date.now(), tags: {} },
          },
          tags: {},
        },
      }
      const newState = highlightsReducer(state, {
        type: REMOVE_HIGHLIGHT,
        selectedVerses: { '1-1-1': true, '1-1-3': true },
      })
      expect(newState.bible.highlights['1-1-1']).toBeUndefined()
      expect(newState.bible.highlights['1-1-2']).toBeDefined()
      expect(newState.bible.highlights['1-1-3']).toBeUndefined()
    })

    it('should remove highlight references from tags', () => {
      const state = {
        bible: {
          highlights: {
            '1-1-1': { color: 'red', date: Date.now(), tags: { 'tag-1': { id: 'tag-1', name: 'Test' } } },
          },
          tags: {
            'tag-1': {
              id: 'tag-1',
              name: 'Test',
              highlights: { '1-1-1': true },
            },
          },
        },
      }
      const newState = highlightsReducer(state, {
        type: REMOVE_HIGHLIGHT,
        selectedVerses: { '1-1-1': true },
      })
      expect(newState.bible.highlights['1-1-1']).toBeUndefined()
      expect(newState.bible.tags['tag-1'].highlights['1-1-1']).toBeUndefined()
    })

    it('should handle removing non-existent highlight', () => {
      const state = {
        bible: {
          highlights: {
            '1-1-1': { color: 'red', date: Date.now(), tags: {} },
          },
          tags: {},
        },
      }
      const newState = highlightsReducer(state, {
        type: REMOVE_HIGHLIGHT,
        selectedVerses: { '1-1-99': true },
      })
      expect(newState.bible.highlights['1-1-1']).toBeDefined()
    })
  })

  describe('default case', () => {
    it('should return state unchanged for unknown action', () => {
      const state = {
        bible: {
          highlights: {
            '1-1-1': { color: 'red', date: Date.now(), tags: {} },
          },
          tags: {},
        },
      }
      const newState = highlightsReducer(state, { type: 'UNKNOWN_ACTION' })
      expect(newState).toEqual(state)
    })
  })
})
