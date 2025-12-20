import produce from 'immer'
import { VerseIds } from '~common/types'
import orderVerses from '~helpers/orderVerses'
import { Link } from '../user'
import { removeEntityInTags } from '../utils'

export const ADD_LINK = 'user/ADD_LINK'
export const UPDATE_LINK = 'user/UPDATE_LINK'
export const REMOVE_LINK = 'user/REMOVE_LINK'

export default produce((draft, action) => {
  switch (action.type) {
    case ADD_LINK: {
      draft.bible.links = {
        ...draft.bible.links,
        ...action.payload,
      }
      break
    }
    case UPDATE_LINK: {
      const { key, data } = action.payload
      if (draft.bible.links[key]) {
        draft.bible.links[key] = {
          ...draft.bible.links[key],
          ...data,
        }
      }
      break
    }
    case REMOVE_LINK: {
      delete draft.bible.links[action.payload]
      removeEntityInTags(draft, 'links', action.payload)
      break
    }
    default:
      break
  }
})

// LINKS
export function addLink(link: Link, selectedVerses: VerseIds) {
  selectedVerses = orderVerses(selectedVerses)
  const key = Object.keys(selectedVerses).join('/')

  if (!key) {
    return
  }
  return { type: ADD_LINK, payload: { [key]: link } }
}

export function updateLink(key: string, data: Partial<Link>) {
  return {
    type: UPDATE_LINK,
    payload: { key, data },
  }
}

export function deleteLink(linkId: string) {
  return {
    type: REMOVE_LINK,
    payload: linkId,
  }
}

// Alias for consistency with removeNote, removeHighlight pattern
export const removeLink = deleteLink
