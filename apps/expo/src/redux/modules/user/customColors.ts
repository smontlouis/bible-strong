import { createAction } from '@reduxjs/toolkit'
import generateUUID from '~helpers/generateUUID'
import { CustomColor, HighlightType } from '../user'

// Action type constants for backward compatibility
export const ADD_CUSTOM_COLOR = 'user/ADD_CUSTOM_COLOR'
export const UPDATE_CUSTOM_COLOR = 'user/UPDATE_CUSTOM_COLOR'
export const DELETE_CUSTOM_COLOR = 'user/DELETE_CUSTOM_COLOR'

// RTK Action Creators
export const addCustomColor = createAction(
  ADD_CUSTOM_COLOR,
  (hex: string, name?: string, highlightType?: HighlightType) => ({
    payload: {
      id: `custom-${generateUUID()}`,
      hex,
      createdAt: Date.now(),
      name,
      type: highlightType,
    } as CustomColor,
  })
)

export const updateCustomColor = createAction(
  UPDATE_CUSTOM_COLOR,
  (id: string, hex: string, name?: string, highlightType?: HighlightType) => ({
    payload: { id, hex, name, type: highlightType },
  })
)

export const deleteCustomColor = createAction(DELETE_CUSTOM_COLOR, (id: string) => ({
  payload: id,
}))
