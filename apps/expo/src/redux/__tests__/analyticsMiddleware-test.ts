import { analyticsMiddleware } from '../analyticsMiddleware'
import { trackAnalyticsEvent } from '~helpers/analytics'
import type { RootState } from '../modules/reducer'

jest.mock('~helpers/analytics', () => ({ trackAnalyticsEvent: jest.fn() }))
jest.mock('../modules/user/notes', () => ({
  addNoteAction: { match: (action: { type: string }) => action.type === 'note' },
}))
jest.mock('../modules/plan', () => ({
  addPlan: { match: (action: { type: string }) => action.type === 'plan' },
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
