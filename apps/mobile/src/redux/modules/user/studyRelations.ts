import { createAction } from '@reduxjs/toolkit'
import generateUUID from '~helpers/generateUUID'
import type {
  Relation,
  RelationDirection,
  RelationEndpoint,
  RelationIndexObj,
  RelationKind,
  RelationPairsObj,
  RelationsObj,
  RelationType,
} from '~features/studyRelations/domain'
import {
  createVerseEndpoint as createVerseRelationEndpoint,
  normalizeRelation,
} from '~features/studyRelations/domain'

export type {
  Relation,
  RelationDirection,
  RelationEndpoint,
  RelationEndpointType,
  RelationIndexEntry,
  RelationIndexObj,
  RelationKind,
  RelationPair,
  RelationPairsObj,
  RelationsObj,
  RelationType,
  StudyRelation,
  StudyRelationsObj,
} from '~features/studyRelations/domain'

export const addRelationAction = createAction<Relation>('user/addRelation')

export const updateRelation = createAction<{
  id: string
  changes: Partial<Pick<Relation, 'type' | 'direction' | 'label' | 'endpoints' | 'kind'>>
}>('user/updateRelation')

export const deleteRelation = createAction<string>('user/deleteRelation')

export const attachNoteToVerseAction = createAction<{
  noteEndpoint: Extract<RelationEndpoint, { type: 'note' }>
  verseEndpoint: Extract<RelationEndpoint, { type: 'verse' }>
}>('user/attachNoteToVerse')

export const setRelationsData = createAction<{
  relations: RelationsObj
  relationIndex?: RelationIndexObj
  relationPairs?: RelationPairsObj
}>('user/setRelationsData')

export const createRelation = (payload: {
  endpoints: [RelationEndpoint, RelationEndpoint]
  kind?: RelationKind
  type?: RelationType
  direction?: RelationDirection
  label?: string
}) => {
  const now = Date.now()
  return addRelationAction(
    normalizeRelation({
      id: generateUUID(),
      kind: payload.kind ?? 'manual',
      endpoints: payload.endpoints,
      type: payload.type ?? 'linked',
      direction: payload.direction ?? 'none',
      label: payload.label,
      createdAt: now,
      updatedAt: now,
    })
  )
}

export const createVerseEndpoint = createVerseRelationEndpoint

export const EMPTY_RELATIONS: RelationsObj = {}
export const EMPTY_RELATION_INDEX: RelationIndexObj = {}
export const EMPTY_RELATION_PAIRS: RelationPairsObj = {}

// Temporary naming aliases for existing UI modules while the storage model is `relations`.
export const addStudyRelationAction = addRelationAction
export const updateStudyRelation = updateRelation
export const deleteStudyRelation = deleteRelation
export const createStudyRelation = createRelation
export const EMPTY_STUDY_RELATIONS = EMPTY_RELATIONS
