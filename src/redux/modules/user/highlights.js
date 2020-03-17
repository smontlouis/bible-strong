import produce from 'immer'
import { clearSelectedVerses } from '../bible'
import { removeEntityInTags } from '../utils'

const ADD_HIGHLIGHT = 'user/ADD_HIGHLIGHT'
const REMOVE_HIGHLIGHT = 'user/REMOVE_HIGHLIGHT'

const addDateAndColorToVerses = (verses, highlightedVerses, color) => {
  const formattedObj = Object.keys(verses).reduce(
    (obj, verse) => ({
      ...obj,
      [verse]: {
        color,
        date: Date.now(),
        ...(highlightedVerses[verse] && {
          tags: highlightedVerses[verse].tags || {}
        })
      }
    }),
    {}
  )

  return formattedObj
}

export default produce((draft, action) => {
  switch (action.type) {
    case ADD_HIGHLIGHT: {
      draft.bible.highlights = {
        ...draft.bible.highlights,
        ...action.selectedVerses
      }
      break
    }
    case REMOVE_HIGHLIGHT: {
      Object.keys(action.selectedVerses).forEach(key => {
        delete draft.bible.highlights[key]
        removeEntityInTags(draft, 'highlights', key)
      })
      break
    }
    default:
      break
  }
})

// HIGHLIGHTS
export function addHighlight(color) {
  return (dispatch, getState) => {
    const { selectedVerses } = getState().bible
    const highlightedVerses = getState().user.bible.highlights

    dispatch(clearSelectedVerses())
    return dispatch({
      type: ADD_HIGHLIGHT,
      selectedVerses: addDateAndColorToVerses(
        selectedVerses,
        highlightedVerses,
        color
      )
    })
  }
}

export function removeHighlight() {
  return (dispatch, getState) => {
    const { selectedVerses } = getState().bible

    dispatch(clearSelectedVerses())
    return dispatch({ type: REMOVE_HIGHLIGHT, selectedVerses })
  }
}
