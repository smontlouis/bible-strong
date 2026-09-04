import { createSelector } from '@reduxjs/toolkit'

import { buildNoteListRows } from '~features/entityListQuery/noteListRows'
import type { RootState } from '~redux/modules/reducer'

const selectNotes = (state: RootState) => state.user.bible.notes
const selectWordAnnotations = (state: RootState) => state.user.bible.wordAnnotations
const selectRelations = (state: RootState) => state.user.bible.relations

export const selectNoteListRows = createSelector(
  [
    selectNotes,
    selectWordAnnotations,
    selectRelations,
    (_: RootState, annotationLabel: string) => annotationLabel,
  ],
  buildNoteListRows
)
