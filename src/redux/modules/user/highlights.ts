import { createAction } from '@reduxjs/toolkit'
import { Dispatch } from 'redux'
import { SelectedVerses } from 'src/state/tabs'
import { TagsObj } from '~common/types'
import { HighlightsObj } from '../user'

// Action type constants for backward compatibility
export const ADD_HIGHLIGHT = 'user/ADD_HIGHLIGHT'
export const REMOVE_HIGHLIGHT = 'user/REMOVE_HIGHLIGHT'
export const CHANGE_HIGHLIGHT_COLOR = 'user/CHANGE_HIGHLIGHT_COLOR'

// RTK Action Creators
export const addHighlightAction = createAction(ADD_HIGHLIGHT, (selectedVerses: HighlightsObj) => ({
  payload: { selectedVerses },
}))

export const removeHighlight = createAction(
  REMOVE_HIGHLIGHT,
  ({ selectedVerses }: { selectedVerses: SelectedVerses }) => ({
    payload: { selectedVerses },
  })
)

export const changeHighlightColor = createAction(
  CHANGE_HIGHLIGHT_COLOR,
  (verseIds: Record<string, any>, color: string) => ({
    payload: { verseIds, color },
  })
)

// Helper to add date and color to verses
const addDateAndColorToVerses = (verses: any, highlightedVerses: any, color: any) => {
  const date = Date.now()
  const formattedObj = Object.keys(verses).reduce((obj, verse) => {
    return {
      ...obj,
      [verse]: {
        color: color || highlightedVerses[verse]?.color || '',
        date,
        ...(highlightedVerses[verse] && {
          tags: highlightedVerses[verse].tags || {},
        }),
      },
    }
  }, {})

  return formattedObj
}

// Thunk that adds date and color before dispatching
export function addHighlight({
  color,
  selectedVerses,
}: {
  color: string
  selectedVerses: SelectedVerses
}) {
  return (dispatch: Dispatch, getState: any) => {
    const highlightedVerses = getState().user.bible.highlights

    return dispatch(
      addHighlightAction(addDateAndColorToVerses(selectedVerses, highlightedVerses, color))
    )
  }
}
