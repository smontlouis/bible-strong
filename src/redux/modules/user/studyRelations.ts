import { createAction } from '@reduxjs/toolkit'
import generateUUID from '~helpers/generateUUID'
import type {
  RelationDirection,
  RelationEndpoint,
  RelationType,
  StudyRelation,
  StudyRelationsObj,
} from '~features/studyRelations/domain'
import { normalizeStudyRelation } from '~features/studyRelations/domain'

export type {
  RelationDirection,
  RelationEndpoint,
  RelationEndpointType,
  RelationType,
  StudyRelation,
  StudyRelationsObj,
} from '~features/studyRelations/domain'

export const addStudyRelationAction = createAction<StudyRelation>('user/addStudyRelation')

export const updateStudyRelation = createAction<{
  id: string
  changes: Partial<Pick<StudyRelation, 'type' | 'direction' | 'label' | 'endpoints'>>
}>('user/updateStudyRelation')

export const deleteStudyRelation = createAction<string>('user/deleteStudyRelation')

export const createStudyRelation = (payload: {
  endpoints: [RelationEndpoint, RelationEndpoint]
  type?: RelationType
  direction?: RelationDirection
  label?: string
}) => {
  const now = Date.now()
  return addStudyRelationAction(
    normalizeStudyRelation({
      id: generateUUID(),
      endpoints: payload.endpoints,
      type: payload.type ?? 'linked',
      direction: payload.direction ?? 'none',
      label: payload.label,
      createdAt: now,
      updatedAt: now,
    })
  )
}

export const createVerseEndpoint = (verseKeys: string[], label?: string): RelationEndpoint => ({
  type: 'verse',
  verseKeys,
  label,
})

export const EMPTY_STUDY_RELATIONS: StudyRelationsObj = {}
