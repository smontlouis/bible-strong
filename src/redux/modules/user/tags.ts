import { createAction } from '@reduxjs/toolkit'
import generateUUID from '~helpers/generateUUID'

// Action type constants for backward compatibility
export const ADD_TAG = 'user/ADD_TAG'
export const TOGGLE_TAG_ENTITY = 'TOGGLE_TAG_ENTITY'
export const UPDATE_TAG = 'user/UPDATE_TAG'
export const REMOVE_TAG = 'user/REMOVE_TAG'

export const entitiesArray = [
  'highlights',
  'notes',
  'links',
  'studies',
  'strongsHebreu',
  'strongsGrec',
  'words',
  'naves',
] as const

// RTK Action Creators
export const addTag = createAction(ADD_TAG, (name: string) => ({
  payload: { name, id: generateUUID() },
}))

export const updateTag = createAction(UPDATE_TAG, (id: string, value: string) => ({
  payload: { id, value },
}))

export const removeTag = createAction(REMOVE_TAG, (tagId: string) => ({
  payload: tagId,
}))

export interface ToggleTagEntityItem {
  entity: (typeof entitiesArray)[number]
  id?: string
  ids?: Record<string, any>
  title?: string
}

export const toggleTagEntity = createAction(
  TOGGLE_TAG_ENTITY,
  ({ item, tagId }: { item: ToggleTagEntityItem; tagId: string }) => ({
    payload: { item, tagId },
  })
)
