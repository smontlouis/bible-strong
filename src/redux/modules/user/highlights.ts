import { createAction } from '@reduxjs/toolkit'
import { Dispatch } from 'redux'
import { SelectedVerses } from 'src/state/tabs'
import { HighlightsObj } from '../user'
import type { RootState } from '../reducer'

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
  (verseIds: SelectedVerses, color: string) => ({
    payload: { verseIds, color },
  })
)

// Helper to add date and color to verses
const addDateAndColorToVerses = (
  verses: SelectedVerses,
  highlightedVerses: HighlightsObj,
  color: string
): HighlightsObj => {
  const date = Date.now()
  const formattedObj = Object.keys(verses).reduce<HighlightsObj>((obj, verse) => {
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
  return (dispatch: Dispatch, getState: () => RootState) => {
    const highlightedVerses = getState().user.bible.highlights

    return dispatch(
      addHighlightAction(addDateAndColorToVerses(selectedVerses, highlightedVerses, color))
    )
  }
}
