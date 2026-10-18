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
let mockLeave = () => {}
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
  useNavigation: () => ({
    addListener: (_event: string, listener: () => void) => {
      mockLeave = listener
      return () => {}
    },
  }),
}))
jest.mock('~navigation/usePushRouteOnce', () => ({ usePushRouteOnce: () => mockPush }))
jest.mock('react-native', () => ({ ScrollView: 'ScrollView', Platform: { OS: 'ios' } }))
jest.mock('expo-image', () => ({ Image: 'Image' }))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'fr' } }),
}))
jest.mock('../plan.hooks', () => ({ useFireStorage: () => undefined }))
jest.mock('~features/daily-reading/useDailyMeditation', () => ({
  useLocalReadingDate: () => '2026-09-14',
}))
jest.mock('~features/daily-reading/ReadingDatePicker', () => 'DatePicker')
jest.mock('~redux/modules/plan', () => ({
  startPlan: (payload: unknown) => mockStart(payload),
  markAsRead: () => ({ type: 'read' }),
  markEntitySliceAsRead: (payload: unknown) => mockRead(payload),
  markEntitySliceAsUnread: (payload: unknown) => mockUnread(payload),
}))
jest.mock('~common/Link', () => 'Link')
jest.mock('~common/ui/Box', () => 'Box')
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
let renderer: ReactTestRenderer
const render = (participation?: OngoingPlan, initialReadingSliceId?: string) => {
  const store = createStore(() => ({
    plan: { ongoingPlans: participation ? [participation] : [] },
  }))
  act(() => {
    renderer = create(
      <Provider store={store}>
        <ScheduledPlanContent plan={plan} initialReadingSliceId={initialReadingSliceId} />
      </Provider>
    )
  })
}
const links = (role: string) =>
  renderer.root.findAll(
    node => String(node.type) === 'Link' && node.props.accessibilityRole === role
  )
afterEach(() => {
  act(() => renderer.unmount())
  jest.clearAllMocks()
})
it('continues legacy progress with the first element of the next day', () => {
  render({ id: 'plan', status: 'Progress', readingSlices: { one: 'Completed' } })
  const button = renderer.root.find(node => String(node.type) === 'Button')
  expect(button.props.children).toBe('readingPlans.continue')
  act(() => button.props.onPress())
  expect(mockStart).not.toHaveBeenCalled()
  expect(mockRead).not.toHaveBeenCalled()
  act(() => mockLeave())
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
  expect(renderer.root.findAll(node => String(node.type) === 'DatePicker')).toHaveLength(0)
})
it('continues a day with its next unread element, identified by its place when it has no id', () => {
  render(followed)
  act(() => renderer.root.find(node => String(node.type) === 'Button').props.onPress())
  act(() => mockLeave())
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
  const button = renderer.root.find(node => String(node.type) === 'Button')
  expect(button.props.children).toBe('readingPlans.start')
  act(() => button.props.onPress())
  expect(mockStart).toHaveBeenCalledWith({ planId: 'plan', startDate: '2026-09-14' })
  act(() => mockLeave())
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
  act(() => mockLeave())
  expect(mockRead).toHaveBeenCalledTimes(1)
  expect(mockRead).toHaveBeenCalledWith(element)
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
