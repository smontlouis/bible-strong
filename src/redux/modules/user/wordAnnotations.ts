import { createAction } from '@reduxjs/toolkit'
import { Dispatch } from 'redux'
import { TagsObj } from '~common/types'
import generateUUID from '~helpers/generateUUID'
import { VersionCode } from '~state/tabs'

export interface AnnotationRange {
  verseKey: string
  startWordIndex: number
  endWordIndex: number
  text: string
}

export interface WordAnnotation {
  id: string
  version: VersionCode
  ranges: AnnotationRange[]
  color: string
  type: 'background' | 'underline' | 'circle'
  date: number
  tags?: TagsObj
  noteId?: string
}

export type WordAnnotationsObj = { [id: string]: WordAnnotation }

export const ADD_WORD_ANNOTATION = 'user/ADD_WORD_ANNOTATION'
export const UPDATE_WORD_ANNOTATION = 'user/UPDATE_WORD_ANNOTATION'
export const REMOVE_WORD_ANNOTATION = 'user/REMOVE_WORD_ANNOTATION'
export const REMOVE_WORD_ANNOTATIONS_IN_RANGE = 'user/removeWordAnnotationsInRange'
export const CHANGE_WORD_ANNOTATION_COLOR = 'user/CHANGE_WORD_ANNOTATION_COLOR'
export const CHANGE_WORD_ANNOTATION_TYPE = 'user/CHANGE_WORD_ANNOTATION_TYPE'

export const addWordAnnotationAction = createAction(
  ADD_WORD_ANNOTATION,
  (annotation: WordAnnotation) => ({ payload: { annotation } })
)

export const updateWordAnnotationAction = createAction(
  UPDATE_WORD_ANNOTATION,
  (id: string, changes: Partial<WordAnnotation>) => ({ payload: { id, changes } })
)

export const removeWordAnnotationAction = createAction(REMOVE_WORD_ANNOTATION, (id: string) => ({
  payload: { id },
}))

export const changeWordAnnotationColorAction = createAction(
  CHANGE_WORD_ANNOTATION_COLOR,
  (id: string, color: string) => ({ payload: { id, color } })
)

export const changeWordAnnotationTypeAction = createAction(
  CHANGE_WORD_ANNOTATION_TYPE,
  (id: string, type: 'background' | 'underline' | 'circle') => ({ payload: { id, type } })
)

interface WordPosition {
  verseKey: string
  wordIndex: number
}

export const removeWordAnnotationsInRangeAction = createAction(
  REMOVE_WORD_ANNOTATIONS_IN_RANGE,
  (version: string, start: WordPosition, end: WordPosition) => ({
    payload: { version, start, end },
  })
)

export function addWordAnnotation({
  id,
  version,
  ranges,
  color,
  type,
  noteId,
  tags,
}: {
  id?: string
  version: VersionCode
  ranges: AnnotationRange[]
  color: string
  type: 'background' | 'underline' | 'circle'
  noteId?: string
  tags?: TagsObj
}) {
  return (dispatch: Dispatch) => {
    const annotation: WordAnnotation = {
      id: id ?? generateUUID(),
      version,
      ranges,
      color,
      type,
      date: Date.now(),
      ...(noteId && { noteId }),
      ...(tags && { tags }),
    }
    dispatch(addWordAnnotationAction(annotation))
  }
}

export function updateWordAnnotation(id: string, changes: Partial<WordAnnotation>) {
  return (dispatch: Dispatch) => dispatch(updateWordAnnotationAction(id, changes))
}

export function removeWordAnnotation(id: string) {
  return (dispatch: Dispatch) => dispatch(removeWordAnnotationAction(id))
}

export function changeWordAnnotationColor(id: string, color: string) {
  return (dispatch: Dispatch) => dispatch(changeWordAnnotationColorAction(id, color))
}

export function changeWordAnnotationType(id: string, type: 'background' | 'underline' | 'circle') {
  return (dispatch: Dispatch) => dispatch(changeWordAnnotationTypeAction(id, type))
}
