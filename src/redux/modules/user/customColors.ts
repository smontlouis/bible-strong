import produce from 'immer'
import { CustomColor } from '../user'

export const ADD_CUSTOM_COLOR = 'user/ADD_CUSTOM_COLOR'
export const UPDATE_CUSTOM_COLOR = 'user/UPDATE_CUSTOM_COLOR'
export const DELETE_CUSTOM_COLOR = 'user/DELETE_CUSTOM_COLOR'

const MAX_CUSTOM_COLORS = 5

export default produce((draft, action) => {
  switch (action.type) {
    case ADD_CUSTOM_COLOR: {
      if (draft.bible.settings.customHighlightColors.length < MAX_CUSTOM_COLORS) {
        draft.bible.settings.customHighlightColors.push(action.payload)
      }
      break
    }
    case UPDATE_CUSTOM_COLOR: {
      const { id, hex, name } = action.payload
      const colorIndex = draft.bible.settings.customHighlightColors.findIndex(
        (c: CustomColor) => c.id === id
      )
      if (colorIndex !== -1) {
        draft.bible.settings.customHighlightColors[colorIndex].hex = hex
        draft.bible.settings.customHighlightColors[colorIndex].name = name
      }
      break
    }
    case DELETE_CUSTOM_COLOR: {
      const id = action.payload
      draft.bible.settings.customHighlightColors =
        draft.bible.settings.customHighlightColors.filter((c: CustomColor) => c.id !== id)
      break
    }
    default:
      break
  }
})

export function addCustomColor(
  hex: string,
  name?: string
): {
  type: typeof ADD_CUSTOM_COLOR
  payload: CustomColor
} {
  return {
    type: ADD_CUSTOM_COLOR,
    payload: {
      id: `custom-${Date.now()}`,
      hex,
      createdAt: Date.now(),
      name,
    },
  }
}

export function updateCustomColor(
  id: string,
  hex: string,
  name?: string
): { type: typeof UPDATE_CUSTOM_COLOR; payload: { id: string; hex: string; name?: string } } {
  return {
    type: UPDATE_CUSTOM_COLOR,
    payload: { id, hex, name },
  }
}

export function deleteCustomColor(id: string): {
  type: typeof DELETE_CUSTOM_COLOR
  payload: string
} {
  return {
    type: DELETE_CUSTOM_COLOR,
    payload: id,
  }
}
