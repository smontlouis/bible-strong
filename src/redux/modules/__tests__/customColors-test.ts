/* eslint-env jest */

import customColorsReducer, {
  ADD_CUSTOM_COLOR,
  UPDATE_CUSTOM_COLOR,
  DELETE_CUSTOM_COLOR,
} from '../user/customColors'
import type { CustomColor, HighlightType } from '../user'

const getInitialState = () => ({
  bible: {
    settings: {
      customHighlightColors: [] as CustomColor[],
    },
  },
})

const createCustomColor = (id: string, overrides?: Partial<CustomColor>): CustomColor => ({
  id,
  hex: '#ff0000',
  createdAt: Date.now(),
  ...overrides,
})

describe('Custom Colors Reducer', () => {
  let initialState: ReturnType<typeof getInitialState>

  beforeEach(() => {
    initialState = getInitialState()
  })

  describe('ADD_CUSTOM_COLOR', () => {
    it('should add a custom color', () => {
      const color = createCustomColor('custom-1')
      const newState = customColorsReducer(initialState, {
        type: ADD_CUSTOM_COLOR,
        payload: color,
      })
      expect(newState.bible.settings.customHighlightColors).toHaveLength(1)
      expect(newState.bible.settings.customHighlightColors[0]).toEqual(color)
    })

    it('should add custom color with name', () => {
      const color = createCustomColor('custom-1', { name: 'My Red' })
      const newState = customColorsReducer(initialState, {
        type: ADD_CUSTOM_COLOR,
        payload: color,
      })
      expect(newState.bible.settings.customHighlightColors[0].name).toBe('My Red')
    })

    it('should add custom color with type', () => {
      const color = createCustomColor('custom-1', { type: 'textColor' })
      const newState = customColorsReducer(initialState, {
        type: ADD_CUSTOM_COLOR,
        payload: color,
      })
      expect(newState.bible.settings.customHighlightColors[0].type).toBe('textColor')
    })

    it('should add multiple custom colors', () => {
      let state = customColorsReducer(initialState, {
        type: ADD_CUSTOM_COLOR,
        payload: createCustomColor('custom-1', { hex: '#ff0000' }),
      })
      state = customColorsReducer(state, {
        type: ADD_CUSTOM_COLOR,
        payload: createCustomColor('custom-2', { hex: '#00ff00' }),
      })
      state = customColorsReducer(state, {
        type: ADD_CUSTOM_COLOR,
        payload: createCustomColor('custom-3', { hex: '#0000ff' }),
      })
      expect(state.bible.settings.customHighlightColors).toHaveLength(3)
    })

    it('should not exceed maximum of 5 custom colors', () => {
      let state = initialState
      for (let i = 0; i < 7; i++) {
        state = customColorsReducer(state, {
          type: ADD_CUSTOM_COLOR,
          payload: createCustomColor(`custom-${i}`),
        })
      }
      expect(state.bible.settings.customHighlightColors).toHaveLength(5)
    })

    it('should allow exactly 5 custom colors', () => {
      let state = initialState
      for (let i = 0; i < 5; i++) {
        state = customColorsReducer(state, {
          type: ADD_CUSTOM_COLOR,
          payload: createCustomColor(`custom-${i}`),
        })
      }
      expect(state.bible.settings.customHighlightColors).toHaveLength(5)
    })
  })

  describe('UPDATE_CUSTOM_COLOR', () => {
    it('should update color hex', () => {
      const state = {
        bible: {
          settings: {
            customHighlightColors: [createCustomColor('custom-1', { hex: '#ff0000' })],
          },
        },
      }
      const newState = customColorsReducer(state, {
        type: UPDATE_CUSTOM_COLOR,
        payload: { id: 'custom-1', hex: '#00ff00', name: undefined, type: undefined },
      })
      expect(newState.bible.settings.customHighlightColors[0].hex).toBe('#00ff00')
    })

    it('should update color name', () => {
      const state = {
        bible: {
          settings: {
            customHighlightColors: [createCustomColor('custom-1')],
          },
        },
      }
      const newState = customColorsReducer(state, {
        type: UPDATE_CUSTOM_COLOR,
        payload: { id: 'custom-1', hex: '#ff0000', name: 'New Name', type: undefined },
      })
      expect(newState.bible.settings.customHighlightColors[0].name).toBe('New Name')
    })

    it('should update color type', () => {
      const state = {
        bible: {
          settings: {
            customHighlightColors: [createCustomColor('custom-1')],
          },
        },
      }
      const newState = customColorsReducer(state, {
        type: UPDATE_CUSTOM_COLOR,
        payload: { id: 'custom-1', hex: '#ff0000', name: undefined, type: 'underline' as HighlightType },
      })
      expect(newState.bible.settings.customHighlightColors[0].type).toBe('underline')
    })

    it('should update multiple properties at once', () => {
      const state = {
        bible: {
          settings: {
            customHighlightColors: [createCustomColor('custom-1', { hex: '#ff0000', name: 'Old', type: 'background' })],
          },
        },
      }
      const newState = customColorsReducer(state, {
        type: UPDATE_CUSTOM_COLOR,
        payload: { id: 'custom-1', hex: '#00ff00', name: 'New', type: 'textColor' as HighlightType },
      })
      expect(newState.bible.settings.customHighlightColors[0].hex).toBe('#00ff00')
      expect(newState.bible.settings.customHighlightColors[0].name).toBe('New')
      expect(newState.bible.settings.customHighlightColors[0].type).toBe('textColor')
    })

    it('should preserve createdAt when updating', () => {
      const originalCreatedAt = Date.now() - 10000
      const state = {
        bible: {
          settings: {
            customHighlightColors: [createCustomColor('custom-1', { createdAt: originalCreatedAt })],
          },
        },
      }
      const newState = customColorsReducer(state, {
        type: UPDATE_CUSTOM_COLOR,
        payload: { id: 'custom-1', hex: '#00ff00', name: undefined, type: undefined },
      })
      expect(newState.bible.settings.customHighlightColors[0].createdAt).toBe(originalCreatedAt)
    })

    it('should not update if color id not found', () => {
      const state = {
        bible: {
          settings: {
            customHighlightColors: [createCustomColor('custom-1', { hex: '#ff0000' })],
          },
        },
      }
      const newState = customColorsReducer(state, {
        type: UPDATE_CUSTOM_COLOR,
        payload: { id: 'custom-999', hex: '#00ff00', name: undefined, type: undefined },
      })
      expect(newState.bible.settings.customHighlightColors[0].hex).toBe('#ff0000')
    })

    it('should update correct color when multiple exist', () => {
      const state = {
        bible: {
          settings: {
            customHighlightColors: [
              createCustomColor('custom-1', { hex: '#ff0000' }),
              createCustomColor('custom-2', { hex: '#00ff00' }),
              createCustomColor('custom-3', { hex: '#0000ff' }),
            ],
          },
        },
      }
      const newState = customColorsReducer(state, {
        type: UPDATE_CUSTOM_COLOR,
        payload: { id: 'custom-2', hex: '#ffff00', name: undefined, type: undefined },
      })
      expect(newState.bible.settings.customHighlightColors[0].hex).toBe('#ff0000')
      expect(newState.bible.settings.customHighlightColors[1].hex).toBe('#ffff00')
      expect(newState.bible.settings.customHighlightColors[2].hex).toBe('#0000ff')
    })
  })

  describe('DELETE_CUSTOM_COLOR', () => {
    it('should delete a custom color', () => {
      const state = {
        bible: {
          settings: {
            customHighlightColors: [
              createCustomColor('custom-1'),
              createCustomColor('custom-2'),
            ],
          },
        },
      }
      const newState = customColorsReducer(state, {
        type: DELETE_CUSTOM_COLOR,
        payload: 'custom-1',
      })
      expect(newState.bible.settings.customHighlightColors).toHaveLength(1)
      expect(newState.bible.settings.customHighlightColors[0].id).toBe('custom-2')
    })

    it('should handle deleting the only color', () => {
      const state = {
        bible: {
          settings: {
            customHighlightColors: [createCustomColor('custom-1')],
          },
        },
      }
      const newState = customColorsReducer(state, {
        type: DELETE_CUSTOM_COLOR,
        payload: 'custom-1',
      })
      expect(newState.bible.settings.customHighlightColors).toHaveLength(0)
    })

    it('should handle deleting non-existent color', () => {
      const state = {
        bible: {
          settings: {
            customHighlightColors: [createCustomColor('custom-1')],
          },
        },
      }
      const newState = customColorsReducer(state, {
        type: DELETE_CUSTOM_COLOR,
        payload: 'custom-999',
      })
      expect(newState.bible.settings.customHighlightColors).toHaveLength(1)
    })

    it('should delete correct color when multiple exist', () => {
      const state = {
        bible: {
          settings: {
            customHighlightColors: [
              createCustomColor('custom-1'),
              createCustomColor('custom-2'),
              createCustomColor('custom-3'),
            ],
          },
        },
      }
      const newState = customColorsReducer(state, {
        type: DELETE_CUSTOM_COLOR,
        payload: 'custom-2',
      })
      expect(newState.bible.settings.customHighlightColors).toHaveLength(2)
      expect(newState.bible.settings.customHighlightColors[0].id).toBe('custom-1')
      expect(newState.bible.settings.customHighlightColors[1].id).toBe('custom-3')
    })
  })

  describe('default case', () => {
    it('should return state unchanged for unknown action', () => {
      const state = {
        bible: {
          settings: {
            customHighlightColors: [createCustomColor('custom-1')],
          },
        },
      }
      const newState = customColorsReducer(state, { type: 'UNKNOWN_ACTION' })
      expect(newState).toEqual(state)
    })
  })

  describe('highlight types', () => {
    const types: HighlightType[] = ['background', 'textColor', 'underline']
    types.forEach(type => {
      it(`should support ${type} type`, () => {
        const color = createCustomColor('custom-1', { type })
        const newState = customColorsReducer(initialState, {
          type: ADD_CUSTOM_COLOR,
          payload: color,
        })
        expect(newState.bible.settings.customHighlightColors[0].type).toBe(type)
      })
    })
  })
})
