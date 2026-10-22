import { createAction } from '@reduxjs/toolkit'
import { Study } from '../user'
import type { Dispatch } from 'redux'

// Action type constants for backward compatibility
export const CREATE_STUDY = 'user/CREATE_STUDY'
export const UPDATE_STUDY = 'user/UPDATE_STUDY'
export const DELETE_STUDY = 'user/DELETE_STUDY'
export const PUBLISH_STUDY = 'user/PUBLISH_STUDY'
export const ADD_STUDIES = 'user/ADD_STUDIES'

export type StudyMutation = {
  id: string
  created_at?: number
  modified_at?: number
  title?: string
  content?: Study['content']
  tags?: Study['tags']
}

// `localOnly` marks a change received from another install: it is already in Firestore, and
// writing it back would cost a write and could overwrite a newer edit made meanwhile.
type StudyActionOptions = { localOnly?: boolean }

// RTK Action Creators
export const updateStudy = createAction(
  UPDATE_STUDY,
  (payload: StudyMutation, options?: StudyActionOptions) => ({
    payload,
    meta: { localOnly: options?.localOnly ?? false },
  })
)

export const addStudies = createAction(ADD_STUDIES, (payload: { [key: string]: Study }) => ({
  payload,
}))

export const deleteStudy = createAction(
  DELETE_STUDY,
  (id: string, options?: StudyActionOptions) => ({
    payload: id,
    meta: { localOnly: options?.localOnly ?? false },
  })
)

export const isLocalOnlyStudyAction = (action: { type: string }): boolean =>
  (updateStudy.match(action) || deleteStudy.match(action)) && action.meta.localOnly

export const publishStudyAction = createAction(
  PUBLISH_STUDY,
  (id: string, publish: boolean = true) => ({
    payload: { id, publish },
  })
)

// Thunk for async publish
export function publishStudy(id: string, publish = true) {
  return async (dispatch: Dispatch) => {
    await dispatch(publishStudyAction(id, publish))
  }
}
