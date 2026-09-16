import { analyticsMiddleware } from '../analyticsMiddleware'
import { trackAnalyticsEvent } from '~helpers/analytics'
import type { RootState } from '../modules/reducer'

jest.mock('~helpers/analytics', () => ({ trackAnalyticsEvent: jest.fn() }))
jest.mock('../modules/user/notes', () => ({
  addNoteAction: { match: (action: { type: string }) => action.type === 'note' },
}))
jest.mock('../modules/plan', () => ({
  startPlan: { match: (action: { type: string }) => action.type === 'start' },
  markAsRead: { match: (action: { type: string }) => action.type === 'reading' },
}))

const state = (completed = false, hasNote = false) =>
  ({
    user: { bible: { notes: hasNote ? { note: { title: 'private' } } : {} } },
    plan: {
      myPlans: [{ id: 'plan' }],
      ongoingPlans: [{ id: 'plan', readingSlices: { reading: completed ? 'Completed' : 'Next' } }],
    },
  }) as unknown as RootState

const run = (before: RootState, after: RootState, action: unknown) => {
  let current = before
  const next = <T>(action: T): T => {
    current = after
    return action
  }
  return analyticsMiddleware({ getState: () => current, dispatch: jest.fn() })(next)(action)
}

beforeEach(() => jest.clearAllMocks())

it('counts note creation without sending its text and ignores edits', () => {
  const action = { type: 'note', payload: { note: { title: 'private' } } }
  expect(run(state(), state(false, true), action)).toBe(action)
  expect(trackAnalyticsEvent).toHaveBeenCalledWith('note_created', { count: 1 })
  jest.clearAllMocks()
  run(state(false, true), state(false, true), action)
  expect(trackAnalyticsEvent).not.toHaveBeenCalled()
})

it('counts completing a reading but not unmarking it', () => {
  const action = { type: 'reading', payload: { planId: 'plan', readingSliceId: 'reading' } }
  run(state(), state(true), action)
  expect(trackAnalyticsEvent).toHaveBeenCalledWith('plan_reading_completed')
  jest.clearAllMocks()
  run(state(true), state(), action)
  expect(trackAnalyticsEvent).not.toHaveBeenCalled()
})

it('does not count a duplicate plan or state hydration as a new plan', () => {
  run(state(), state(), { type: 'plan', payload: { id: 'plan' } })
  run(state(), state(true, true), { type: 'persist/REHYDRATE' })
  expect(trackAnalyticsEvent).not.toHaveBeenCalled()
})

it('ignores automatic plan downloads and counts only a new participation', () => {
  const before = state()
  before.plan.myPlans = []
  run(before, state(), { type: 'plan', payload: { id: 'plan' } })
  expect(trackAnalyticsEvent).not.toHaveBeenCalled()
  const after = state()
  after.plan.ongoingPlans[0].startDate = '2026-09-16'
  const action = { type: 'start', payload: { planId: 'plan', startDate: '2026-09-16' } }
  run(state(), after, action)
  expect(trackAnalyticsEvent).toHaveBeenCalledTimes(1)
  expect(trackAnalyticsEvent).toHaveBeenCalledWith('plan_started')
  jest.clearAllMocks()
  run(after, after, action)
  run(state(), state(), action)
  expect(trackAnalyticsEvent).not.toHaveBeenCalled()
})
