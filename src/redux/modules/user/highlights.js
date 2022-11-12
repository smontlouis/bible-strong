import produce from 'immer'
import { clearSelectedVerses } from '../bible'
import { removeEntityInTags } from '../utils'

export const ADD_HIGHLIGHT = 'user/ADD_HIGHLIGHT'
export const REMOVE_HIGHLIGHT = 'user/REMOVE_HIGHLIGHT'
export const CHANGE_HIGHLIGHT_COLOR = 'user/CHANGE_HIGHLIGHT_COLOR'

const addDateAndColorToVerses = (verses, highlightedVerses, color) => {
  const date = Date.now()
  const formattedObj = Object.keys(verses).reduce((obj, verse) => {
    return {
      ...obj,
      [verse]: {
        color: color || highlightedVerses[verse]?.color,
        date,
        ...(highlightedVerses[verse] && {
          tags: highlightedVerses[verse].tags || {},
        }),
      },
    }
  }, {})

  return formattedObj
}

export default produce((draft, action) => {
  switch (action.type) {
    case ADD_HIGHLIGHT: {
      draft.bible.highlights = {
        ...draft.bible.highlights,
        ...action.selectedVerses,
      }
      break
    }
    case CHANGE_HIGHLIGHT_COLOR: {
      Object.keys(action.verseIds).forEach(key => {
        draft.bible.highlights[key].color = action.color
      })
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
      ),
    })
  }
}

export function removeHighlight(verseIds) {
  return (dispatch, getState) => {
    const { selectedVerses } = getState().bible

    dispatch(clearSelectedVerses())
    return dispatch({
      type: REMOVE_HIGHLIGHT,
      selectedVerses: verseIds || selectedVerses,
    })
  }
}

export function changeHighlightColor(verseIds, color) {
  return { type: CHANGE_HIGHLIGHT_COLOR, verseIds, color }
}
