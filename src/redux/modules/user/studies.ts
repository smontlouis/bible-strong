import produce from 'immer'
import { Study } from '../user'
import { removeEntityInTags } from '../utils'

export const CREATE_STUDY = 'user/CREATE_STUDY'
export const UPDATE_STUDY = 'user/UPDATE_STUDY'
export const DELETE_STUDY = 'user/DELETE_STUDY'
export const PUBLISH_STUDY = 'user/PUBLISH_STUDY'
export const ADD_STUDIES = 'user/ADD_STUDIES'

export default produce((draft, action) => {
  switch (action.type) {
    case UPDATE_STUDY: {
      const {
        id,
        content,
        title,
        modified_at,
        created_at,
        tags,
      } = action.payload

      draft.bible.studies[id] = {
        id,
        ...draft.bible.studies[id],
        ...(created_at && { created_at }),
        ...(modified_at && { modified_at }),
        ...(title && { title }),
        ...(content && { content }),
        ...(tags && { tags }),
        user: {
          id: draft.id,
          displayName: draft.displayName,
          photoUrl: draft.photoURL,
        },
      }

      break
    }
    case DELETE_STUDY: {
      delete draft.bible.studies[action.payload]
      removeEntityInTags(draft, 'studies', action.payload)
      break
    }
    case PUBLISH_STUDY: {
      const study = draft.bible.studies[action.payload]
      study.published = action.publish
      study.modified_at = Date.now()
      break
    }
    case ADD_STUDIES: {
      draft.bible.studies = action.payload
      break
    }
    default:
      break
  }
})

// STUDIES
export type StudyMutation = {
  id: string
  created_at?: number
  modified_at?: number
  title?: string
  content?: string | null
  tags?: any
}

export function updateStudy(payload: StudyMutation) {
  return {
    type: UPDATE_STUDY,
    payload,
  }
}

export function addStudies(payload: { [key: string]: Study }) {
  return {
    type: ADD_STUDIES,
    payload,
  }
}

export function deleteStudy(id: string) {
  return {
    type: DELETE_STUDY,
    payload: id,
  }
}

export function publishStudy(id, publish = true) {
  return async dispatch => {
    await dispatch({
      type: PUBLISH_STUDY,
      payload: id,
      publish,
    })
  }
}
