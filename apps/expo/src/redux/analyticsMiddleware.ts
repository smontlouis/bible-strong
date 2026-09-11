import type { Middleware } from '@reduxjs/toolkit'
import { trackAnalyticsEvent } from '~helpers/analytics'
import type { RootState } from './modules/reducer'
import { addNoteAction } from './modules/user/notes'
import { addPlan, markAsRead } from './modules/plan'

export const analyticsMiddleware: Middleware<object, RootState> = store => next => action => {
  const before = store.getState()
  const result = next(action)
  if (addNoteAction.match(action)) {
    const created = Object.keys(action.payload).filter(key => !before.user.bible.notes[key]).length
    if (created) void trackAnalyticsEvent('note_created', { count: created })
  }
  if (addPlan.match(action) && !before.plan.myPlans.some(plan => plan.id === action.payload.id)) {
    void trackAnalyticsEvent('plan_started')
  }
  if (markAsRead.match(action)) {
    const { planId, readingSliceId } = action.payload
    const previous = before.plan.ongoingPlans.find(plan => plan.id === planId)?.readingSlices[
      readingSliceId
    ]
    const current = store.getState().plan.ongoingPlans.find(plan => plan.id === planId)
      ?.readingSlices[readingSliceId]
    if (previous !== 'Completed' && current === 'Completed') {
      void trackAnalyticsEvent('plan_reading_completed')
    }
  }
  return result
}
