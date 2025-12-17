import produce from 'immer'

import generateUUID from '~helpers/generateUUID'

export const ADD_TAG = 'user/ADD_TAG'
export const TOGGLE_TAG_ENTITY = 'TOGGLE_TAG_ENTITY'
export const UPDATE_TAG = 'user/UPDATE_TAG'
export const REMOVE_TAG = 'user/REMOVE_TAG'

export const entitiesArray = [
  'highlights',
  'notes',
  'studies',
  'strongsHebreu',
  'strongsGrec',
  'words',
  'naves',
] as const

export default produce((draft, action) => {
  switch (action.type) {
    case ADD_TAG: {
      const tagId = generateUUID()
      draft.bible.tags[tagId] = {
        id: tagId,
        date: Date.now(),
        name: action.payload,
      }
      break
    }
    case UPDATE_TAG: {
      draft.bible.tags[action.id].name = action.value

      entitiesArray.forEach(ent => {
        const entities = draft.bible[ent]
        Object.values(entities).forEach((entity: any) => {
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

      entitiesArray.forEach(ent => {
        const entities = draft.bible[ent]
        Object.values(entities).forEach((entity: any) => {
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
        const hasTag = draft.bible[item.entity][Object.keys(item.ids)[0]]?.tags?.[tagId]

        Object.keys(item.ids).forEach(id => {
          // DELETE OPERATION - In order to have a true toggle, check only for first item with Object.keys(item.ids)[0]
          if (hasTag) {
            try {
              delete draft.bible.tags[tagId][item.entity][id]
              delete draft.bible[item.entity][id].tags[tagId]
            } catch (e) {}

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
              name: draft.bible.tags[tagId].name,
            }
          }
        })
      } else {
        if (!draft.bible[item.entity][item.id]) {
          draft.bible[item.entity][item.id] = {
            id: item.id,
            title: item.title,
            tags: {},
          }
        }

        // DELETE OPERATION
        // eslint-disable-next-line no-lonely-if
        if (draft.bible[item.entity][item.id]?.tags?.[tagId]) {
          delete draft.bible.tags[tagId][item.entity][item.id]
          delete draft.bible[item.entity][item.id].tags[tagId]

          // If words / strongs / nave, delete unused entity
          if (['naves', 'strongsHebreu', 'strongsGrec', 'words'].includes(item.entity)) {
            const hasTags = Object.keys(draft.bible[item.entity][item.id].tags).length

            if (!hasTags) {
              delete draft.bible[item.entity][item.id]
            }
          }

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
            name: draft.bible.tags[tagId].name,
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
export function addTag(payload: any) {
  return {
    type: ADD_TAG,
    payload,
  }
}

export function updateTag(id: any, value: any) {
  return {
    type: UPDATE_TAG,
    id,
    value,
  }
}

export function removeTag(payload: any) {
  return {
    type: REMOVE_TAG,
    payload,
  }
}

export function toggleTagEntity({ item, tagId }: any) {
  return {
    type: TOGGLE_TAG_ENTITY,
    payload: { item, tagId },
  }
}
