import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { Provider } from 'react-redux'
import { createStore } from 'redux'
import type { ComputedPlan, OngoingPlan } from '~common/types'
import ScheduledPlanContent from '../PlanScreen/ScheduledPlanContent'

const mockPush = jest.fn()
const mockStart = jest.fn((payload: unknown) => ({ type: 'start', payload }))
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({}),
}))
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
        { id: 'one', status: 'Completed', slices: [] },
        { id: 'two', status: 'Idle', slices: [] },
      ],
    },
  ],
}
let renderer: ReactTestRenderer
const render = (participation?: OngoingPlan) => {
  const store = createStore(() => ({
    plan: { ongoingPlans: participation ? [participation] : [] },
  }))
  act(() => {
    renderer = create(
      <Provider store={store}>
        <ScheduledPlanContent plan={plan} />
      </Provider>
    )
  })
}
afterEach(() => {
  act(() => renderer.unmount())
  jest.clearAllMocks()
})
it('continues legacy progress without a start date or a new enrollment', () => {
  render({ id: 'plan', status: 'Progress', readingSlices: { one: 'Completed' } })
  const button = renderer.root.find(node => String(node.type) === 'Button')
  expect(button.props.children).toBe('readingPlans.continue')
  act(() => button.props.onPress())
  expect(mockStart).not.toHaveBeenCalled()
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/plan-slice',
    params: { planId: 'plan', readingSliceId: 'two' },
  })
  expect(renderer.root.findAll(node => String(node.type) === 'DatePicker')).toHaveLength(0)
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
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/plan-slice',
    params: { planId: 'plan', readingSliceId: 'one' },
  })
})
