import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import type { ComputedPlan } from '~common/types'
import MeditationCollectionContent from '../PlanScreen/MeditationCollectionContent'

jest.mock('~features/daily-reading/useCollectionChoice', () => ({
  useCollectionChoice: () => ({ choose: jest.fn(), pending: false, error: false, selected: false }),
}))
const mockPush = jest.fn()
jest.mock('expo-image', () => ({ Image: 'Image' }))
jest.mock('../plan.hooks', () => ({ useFireStorage: () => undefined }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('react-native', () => ({ ScrollView: 'ScrollView', Platform: { OS: 'ios' } }))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'fr' } }),
}))
jest.mock('~features/daily-reading/useDailyMeditation', () => ({
  useLocalReadingDate: () => '2026-09-14',
}))
jest.mock('~features/daily-reading/ReadingDatePicker', () => 'DatePicker')
jest.mock('~common/Link', () => 'Link')
jest.mock('~common/ui/Box', () => 'Box')
jest.mock('~common/ui/Text', () => 'Text')
jest.mock('~common/ui/Button', () => 'Button')
jest.mock('~common/ui/Icon', () => ({ FeatherIcon: 'Icon' }))
jest.mock('~common/ui/PageContent', () => ({ pageContentStyle: {} }))

const plan: ComputedPlan = {
  id: 'collection',
  title: 'Collection',
  type: 'meditation',
  lang: 'fr',
  status: 'Progress',
  progress: 0.5,
  author: { id: 'author', displayName: 'Author', photoUrl: '' },
  sections: [
    {
      id: 'all',
      title: '',
      subTitle: '',
      progress: 0.5,
      data: [
        {
          id: 'today',
          title: 'Today, 14 septembre',
          calendarDate: '09-14',
          slices: [],
          status: 'Completed',
        },
        { id: 'october', title: 'October, 1 octobre', calendarDate: '10-01', slices: [] },
        { id: 'extra', title: 'Bonus', calendarDate: null, slices: [], status: 'Completed' },
      ],
    },
  ],
}
let renderer: ReactTestRenderer
const text = () => renderer.root.findAll(node => String(node.type) === 'Text').map(node => node.props.children).join(' ')
afterEach(() => {
  act(() => renderer.unmount())
  jest.clearAllMocks()
})
it('browses dated readings without exposing complementary entries', () => {
  const open = jest.fn()
  act(() => {
    renderer = create(<MeditationCollectionContent plan={plan} onReadingSlicePress={open} />)
  })
  expect(text()).toContain('Today')
  expect(text()).not.toContain('October,')
  expect(text()).not.toContain('dailyReading.legacyHistory')
  expect(text()).not.toContain('Bonus')
  expect(text()).not.toContain('dailyReading.additionalReadings')
  act(() =>
    renderer.root
      .find(
        node =>
          String(node.type) === 'Link' && node.props.accessibilityLabel === 'dailyReading.nextMonth'
      )
      .props.onPress()
  )
  expect(text()).toContain('October')
  expect(text()).not.toContain('Bonus')
  expect(mockPush).not.toHaveBeenCalled()
})
it('opens a reading by stable identifiers when outside an existing tab', () => {
  act(() => {
    renderer = create(<MeditationCollectionContent plan={plan} />)
  })
  act(() =>
    renderer.root
      .findAll(node => String(node.type) === 'Link')
      .find(node => node.props.accessibilityRole === 'button' && !node.props.accessibilityState)!
      .props.onPress()
  )
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/meditation',
    params: { collectionId: 'collection', readingId: 'today', date: '2026-09-14' },
  })
})
