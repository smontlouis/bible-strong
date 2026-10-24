import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { Provider } from 'react-redux'
import { createStore } from 'redux'
import type { ComputedPlan, OngoingPlan } from '~common/types'
import ScheduledPlanContent from '../PlanScreen/ScheduledPlanContent'

const mockPush = jest.fn()
const mockStart = jest.fn((payload: unknown) => ({ type: 'start', payload }))
const mockRead = jest.fn((payload: unknown) => ({ type: 'element-read', payload }))
const mockUnread = jest.fn((payload: unknown) => ({ type: 'element-unread', payload }))
const mockSetParams = jest.fn()
let mockParams: Record<string, string> = {}
let mockLeave = () => {}
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ setParams: mockSetParams }),
  useNavigation: () => ({
    addListener: (_event: string, listener: () => void) => {
      mockLeave = listener
      return () => {}
    },
  }),
}))
jest.mock('~navigation/usePushRouteOnce', () => ({ usePushRouteOnce: () => mockPush }))
jest.mock('react-native', () => ({
  ScrollView: 'ScrollView',
  Platform: { OS: 'ios' },
  StyleSheet: { hairlineWidth: 1 },
}))
jest.mock('expo-image', () => ({ Image: 'Image' }))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'fr' } }),
}))
jest.mock('../plan.hooks', () => ({ useFireStorage: () => undefined }))
jest.mock('~features/daily-reading/useDailyMeditation', () => ({
  useLocalReadingDate: () => '2026-09-14',
}))
jest.mock('~features/daily-reading/ReminderSettings', () => 'ReminderSettings')
jest.mock('../planReadingTime', () => ({ useElementSizes: () => ({}), getDayMinutes: () => 0 }))
jest.mock('../PlanStreak', () => 'PlanStreak')
jest.mock('../PlanScreen/PlanDayStrip', () => ({
  __esModule: true,
  default: 'PlanDayStrip',
  formatPlanDate: (date: string) => date,
}))
jest.mock('../PlanScreen/PlanCalendar', () => 'PlanCalendar')
jest.mock('../PlanScreen/PlanProgressCard', () => 'PlanProgressCard')
jest.mock('../PlanScreen/PlanReflection', () => 'PlanReflection')
jest.mock('../PlanScreen/PlanUpNext', () => 'PlanUpNext')
jest.mock('~common/ModalSheet', () => 'Sheet')
jest.mock('~common/sheet', () => ({ SheetView: 'SheetView' }))
jest.mock('~common/ui/SheetWell', () => 'SheetWell')
jest.mock('~redux/selectors/user', () => ({ selectFontFamily: () => undefined }))
jest.mock('~themes/styleValues', () => ({ resolveFontFamily: () => undefined }))
jest.mock('~redux/modules/plan', () => ({
  setPlanReminder: (payload: unknown) => ({ type: 'reminder', payload }),
  startPlan: (payload: unknown) => mockStart(payload),
  markAsRead: () => ({ type: 'read' }),
  markEntitySliceAsRead: (payload: unknown) => mockRead(payload),
  markEntitySliceAsUnread: (payload: unknown) => mockUnread(payload),
}))
jest.mock('~common/Link', () => 'Link')
jest.mock('~common/ui/Box', () => ({
  __esModule: true,
  default: 'Box',
  usePageBottomInset: () => 0,
}))
jest.mock('~common/ui/Text', () => 'Text')
jest.mock('~common/ui/Button', () => 'Button')
jest.mock('~common/ui/Icon', () => ({ FeatherIcon: 'Icon' }))
jest.mock('~common/ui/PageContent', () => ({ pageContentStyle: {} }))
jest.mock('~helpers/chapterToReference', () => ({ chapterToReference: () => 'Genèse' }))
jest.mock('~helpers/verseToReference', () => ({ __esModule: true, default: () => 'Genèse' }))

const plan: ComputedPlan = {
  id: 'plan',
  title: 'Plan',
  type: 'yearly',
  lang: 'fr',
  author: { id: 'a', displayName: 'Author', photoUrl: '' },
  progress: 0.5,
  status: 'Progress',
  sections: [
    {
      id: 's',
      title: '',
      subTitle: '',
      progress: 0.5,
      data: [
        {
          id: 'one',
          status: 'Completed',
          slices: [{ type: 'Chapter', id: 'one-a', chapters: '1|1-3' }],
        },
        {
          id: 'two',
          status: 'Idle',
          slices: [
            { type: 'Title', id: 'two-title', title: 'Lecture' },
            { type: 'Chapter', id: 'two-a', chapters: '1|4-5' },
            { type: 'Verse', verses: '13|1:1-4' },
            { type: 'Text', id: 'two-c', description: 'Méditation' },
          ],
        },
      ],
    },
  ],
}
const followed: OngoingPlan = {
  id: 'plan',
  status: 'Progress',
  readingSlices: { one: 'Completed' },
  entitySlices: { two: ['two-a'] },
}
/** The plan with each day's status, day one first. */
const withStatuses = (statuses: ('Idle' | 'Completed')[]): ComputedPlan => ({
  ...plan,
  sections: plan.sections.map(section => ({
    ...section,
    data: section.data.map((day, index) => ({ ...day, status: statuses[index] })),
  })),
})
let renderer: ReactTestRenderer
const render = (
  participation?: OngoingPlan,
  initialReadingSliceId?: string,
  content: ComputedPlan = plan
) => {
  const store = createStore(() => ({
    plan: { ongoingPlans: participation ? [participation] : [] },
  }))
  act(() => {
    renderer = create(
      <Provider store={store}>
        <ScheduledPlanContent plan={content} initialReadingSliceId={initialReadingSliceId} />
      </Provider>
    )
  })
}
const button = () => renderer.root.find(node => String(node.type) === 'Button')
const strip = () => renderer.root.find(node => String(node.type) === 'PlanDayStrip')
const links = (role: string) =>
  renderer.root.findAll(
    node => String(node.type) === 'Link' && node.props.accessibilityRole === role
  )
/** Leaves the plan for an element's page, and lets that page settle over it. */
const leave = () =>
  act(() => {
    mockLeave()
    jest.runOnlyPendingTimers()
  })
beforeEach(() => {
  jest.useFakeTimers()
})
afterEach(() => {
  act(() => renderer.unmount())
  mockParams = {}
  jest.clearAllMocks()
  jest.useRealTimers()
})
it('continues legacy progress with the first element of the next day', () => {
  render({ id: 'plan', status: 'Progress', readingSlices: { one: 'Completed' } })
  expect(button().props.children).toBe('readingPlans.continueWith')
  act(() => button().props.onPress())
  expect(mockStart).not.toHaveBeenCalled()
  expect(mockRead).not.toHaveBeenCalled()
  leave()
  expect(mockRead).toHaveBeenCalledWith({
    planId: 'plan',
    readingSliceId: 'two',
    entitySliceId: 'two-a',
  })
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/bible-view',
    params: {
      book: '1',
      chapter: '4',
      planEndChapter: '5',
      planId: 'plan',
      readingSliceId: 'two',
      entitySliceId: 'two-a',
    },
  })
  expect(renderer.root.findAll(node => String(node.type) === 'PlanCalendar')).toHaveLength(0)
})
it('continues a day with its next unread element, identified by its place when it has no id', () => {
  render(followed)
  act(() => renderer.root.find(node => String(node.type) === 'Button').props.onPress())
  leave()
  expect(mockRead).toHaveBeenCalledWith({
    planId: 'plan',
    readingSliceId: 'two',
    entitySliceId: 'two:2',
  })
  expect(mockPush.mock.calls[0][0].params).toMatchObject({ book: '13', focusVerses: '[1,2,3,4]' })
})
it('starts a new plan today and opens day one even after browsing another day', () => {
  render()
  act(() =>
    renderer.root
      .find(
        node =>
          String(node.type) === 'Link' && node.props.accessibilityLabel === 'dailyReading.next'
      )
      .props.onPress()
  )
  expect(button().props.children).toBe('readingPlans.start')
  act(() => button().props.onPress())
  expect(mockStart).toHaveBeenCalledWith({ planId: 'plan', startDate: '2026-09-14' })
  leave()
  expect(mockRead).toHaveBeenCalledWith({
    planId: 'plan',
    readingSliceId: 'one',
    entitySliceId: 'one-a',
  })
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/bible-view',
    params: {
      book: '1',
      chapter: '1',
      planEndChapter: '3',
      planId: 'plan',
      readingSliceId: 'one',
      entitySliceId: 'one-a',
    },
  })
})
it('lists the elements of the day with a checkbox each, and none for a title', () => {
  render(followed)
  const checkboxes = links('checkbox')
  expect(checkboxes.map(node => node.props.accessibilityState.checked)).toEqual([
    true,
    false,
    false,
  ])
  act(() => checkboxes[0].props.onPress())
  expect(mockUnread).toHaveBeenCalledWith({
    planId: 'plan',
    readingSliceId: 'two',
    entitySliceId: 'two-a',
  })
  act(() => checkboxes[2].props.onPress())
  expect(mockRead).toHaveBeenCalledWith({
    planId: 'plan',
    readingSliceId: 'two',
    entitySliceId: 'two-c',
  })
  expect(mockPush).not.toHaveBeenCalled()
})
it('opens an element on its own page and marks it as read once the plan is left', () => {
  render(followed)
  act(() => links('link')[2].props.onPress())
  const element = { planId: 'plan', readingSliceId: 'two', entitySliceId: 'two-c' }
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/plan-entity', params: element })
  expect(mockRead).not.toHaveBeenCalled()
  act(() => mockLeave())
  expect(mockRead).not.toHaveBeenCalled()
  act(() => jest.advanceTimersByTime(500))
  leave()
  expect(mockRead).toHaveBeenCalledTimes(1)
  expect(mockRead).toHaveBeenCalledWith(element)
})
it('still marks an opened element as read when the plan goes away before its page settles', () => {
  render(followed)
  act(() => links('link')[2].props.onPress())
  act(() => mockLeave())
  act(() => renderer.unmount())
  expect(mockRead).toHaveBeenCalledWith({
    planId: 'plan',
    readingSliceId: 'two',
    entitySliceId: 'two-c',
  })
  render(followed)
})
it('shows every element of a completed day as read', () => {
  render(followed, 'one')
  expect(links('checkbox').map(node => node.props.accessibilityState.checked)).toEqual([true])
})
it('lets a preview open its elements without any checkbox', () => {
  render(undefined, 'two')
  expect(links('checkbox')).toHaveLength(0)
  expect(links('link')).toHaveLength(3)
})
it('shows today in a scheduled plan even when an earlier day is left behind', () => {
  render(
    { id: 'plan', status: 'Progress', readingSlices: {}, startDate: '2026-09-13' },
    undefined,
    withStatuses(['Idle', 'Idle'])
  )
  expect(strip().props).toMatchObject({ selectedDay: 2, today: 2, done: [false, false] })
  expect(button().props.children).toBe('readingPlans.continueWith')
  const missed = renderer.root.find(
    node => String(node.type) === 'Text' && node.props.children === 'readingPlans.missed'
  )
  expect(missed).toBeTruthy()
})
it('offers to catch up a day left behind once today is read', () => {
  render(
    {
      id: 'plan',
      status: 'Progress',
      readingSlices: { two: 'Completed' },
      startDate: '2026-09-13',
    },
    undefined,
    withStatuses(['Idle', 'Completed'])
  )
  expect(button().props.children).toBe('readingPlans.catchUpDay')
  act(() => button().props.onPress())
  expect(strip().props.selectedDay).toBe(1)
  expect(mockPush.mock.calls[0][0].params).toMatchObject({ readingSliceId: 'one', book: '1' })
})
it('opens what follows at once when it arrives from « Continuer »', () => {
  mockParams = { continue: '1' }
  render(
    { id: 'plan', status: 'Progress', readingSlices: {}, startDate: '2026-09-14' },
    undefined,
    withStatuses(['Idle', 'Idle'])
  )
  expect(mockPush.mock.calls[0][0].params).toMatchObject({ readingSliceId: 'one', book: '1' })
  expect(mockSetParams).toHaveBeenCalledWith({ continue: undefined })
  leave()
  expect(mockRead).toHaveBeenCalledWith({
    planId: 'plan',
    readingSliceId: 'one',
    entitySliceId: 'one-a',
  })
})
