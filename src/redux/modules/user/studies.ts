import produce from 'immer'
import { removeEntityInTags } from '../utils'

export const CREATE_STUDY = 'user/CREATE_STUDY'
export const UPDATE_STUDY = 'user/UPDATE_STUDY'
export const DELETE_STUDY = 'user/DELETE_STUDY'
export const PUBLISH_STUDY = 'user/PUBLISH_STUDY'

export default produce((draft, action) => {
  switch (action.type) {
    case CREATE_STUDY: {
      const { id, content, title } = action.payload
      draft.bible.studies[id] = {
        id,
        created_at: Date.now(),
        modified_at: Date.now(),
        title: title || 'Document sans titre',
        content: content || null,
        user: {
          id: draft.id,
          displayName: draft.displayName,
          photoUrl: draft.photoURL,
        },
      }
      break
    }
    case UPDATE_STUDY: {
      const study = draft.bible.studies[action.payload.id]
      if (study) {
        study.modified_at = Date.now()
        if (action.payload.content) {
          study.content = action.payload.content
        }
        if (action.payload.title) {
          study.title = action.payload.title
        }

        // Just in case
        study.user = {
          id: draft.id,
          displayName: draft.displayName,
          photoUrl: draft.photoURL,
        }
      } else {
        throw new Error(`Cannot find study: ${action.payload.id}`)
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
    default:
      break
  }
})

// STUDIES

export function createStudy({
  id,
  content,
  title,
}: {
  id: string
  content: string
  title: string
}) {
  return {
    type: CREATE_STUDY,
    payload: { id, content, title },
  }
}

export function updateStudy({
  id,
  content,
  title,
}: {
  id: string
  content: string
  title: string
}) {
  return {
    type: UPDATE_STUDY,
    payload: { id, content, title },
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
