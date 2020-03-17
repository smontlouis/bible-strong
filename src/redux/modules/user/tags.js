import produce from 'immer'
import * as Sentry from '@sentry/react-native'

import generateUUID from '~helpers/generateUUID'

const ADD_TAG = 'user/ADD_TAG'
const TOGGLE_TAG_ENTITY = 'TOGGLE_TAG_ENTITY'
const UPDATE_TAG = 'user/UPDATE_TAG'
const REMOVE_TAG = 'user/REMOVE_TAG'

export default produce((draft, action) => {
  switch (action.type) {
    case ADD_TAG: {
      const tagId = generateUUID()
      draft.bible.tags[tagId] = {
        id: tagId,
        date: Date.now(),
        name: action.payload
      }
      break
    }
    case UPDATE_TAG: {
      draft.bible.tags[action.id].name = action.value
      const entitiesArray = ['highlights', 'notes', 'studies']

      entitiesArray.forEach(ent => {
        const entities = draft.bible[ent]
        Object.values(entities).forEach(entity => {
          const entityTags = entity.tags
          if (entityTags && entityTags[action.id]) {
            entityTags[action.id].name = action.value
          }
        })
      })

      break
    }
    case REMOVE_TAG: {
      delete draft.bible.tags[action.payload]

      const entitiesArray = ['highlights', 'notes', 'studies']

      entitiesArray.forEach(ent => {
        const entities = draft.bible[ent]
        Object.values(entities).forEach(entity => {
          const entityTags = entity.tags
          if (entityTags && entityTags[action.payload]) {
            delete entityTags[action.payload]
          }
        })
      })
      break
    }
    case TOGGLE_TAG_ENTITY: {
      const { item, tagId } = action.payload

      if (item.ids) {
        const hasTag =
          draft.bible[item.entity][Object.keys(item.ids)[0]].tags &&
          draft.bible[item.entity][Object.keys(item.ids)[0]].tags[tagId]

        Object.keys(item.ids).forEach(id => {
          // DELETE OPERATION - In order to have a true toggle, check only for first item with Object.keys(item.ids)[0]
          if (hasTag) {
            try {
              delete draft.bible.tags[tagId][item.entity][id]
              delete draft.bible[item.entity][id].tags[tagId]
            } catch (e) {
              Sentry.captureException(e)
            }

            // ADD OPERATION
          } else {
            if (!draft.bible.tags[tagId][item.entity]) {
              draft.bible.tags[tagId][item.entity] = {}
            }
            draft.bible.tags[tagId][item.entity][id] = true

            if (!draft.bible[item.entity][id].tags) {
              draft.bible[item.entity][id].tags = {}
            }
            draft.bible[item.entity][id].tags[tagId] = {
              id: tagId,
              name: draft.bible.tags[tagId].name
            }
          }
        })
      } else {
        // DELETE OPERATION

        // eslint-disable-next-line no-lonely-if
        if (
          draft.bible[item.entity][item.id].tags &&
          draft.bible[item.entity][item.id].tags[tagId]
        ) {
          delete draft.bible.tags[tagId][item.entity][item.id]
          delete draft.bible[item.entity][item.id].tags[tagId]
          // ADD OPERATION
        } else {
          if (!draft.bible.tags[tagId][item.entity]) {
            draft.bible.tags[tagId][item.entity] = {}
          }
          draft.bible.tags[tagId][item.entity][item.id] = true

          if (!draft.bible[item.entity][item.id].tags) {
            draft.bible[item.entity][item.id].tags = {}
          }
          draft.bible[item.entity][item.id].tags[tagId] = {
            id: tagId,
            name: draft.bible.tags[tagId].name
          }
        }
      }

      break
    }
    default:
      break
  }
})

// TAGS
export function addTag(payload) {
  return {
    type: ADD_TAG,
    payload
  }
}

export function updateTag(id, value) {
  return {
    type: UPDATE_TAG,
    id,
    value
  }
}

export function removeTag(payload) {
  return {
    type: REMOVE_TAG,
    payload
  }
}

export function toggleTagEntity({ item, tagId }) {
  return {
    type: TOGGLE_TAG_ENTITY,
    payload: { item, tagId }
  }
}
