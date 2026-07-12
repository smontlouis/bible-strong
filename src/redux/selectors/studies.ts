import { createSelector } from '@reduxjs/toolkit'

import { deltaToPlainText } from '~helpers/deltaToPlainText'
import type { RootState } from '~redux/modules/reducer'

const selectStudies = (state: RootState) => state.user.bible.studies

export const selectStudyListRows = createSelector([selectStudies], studies =>
  Object.entries(studies).map(([studyId, study]) => ({
    ...study,
    id: study.id || studyId,
    searchDescription: study.content?.ops
      ? deltaToPlainText(study.content.ops as Parameters<typeof deltaToPlainText>[0])
      : undefined,
  }))
)
