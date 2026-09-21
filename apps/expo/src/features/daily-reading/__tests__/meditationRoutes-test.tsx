import type { Plan } from '~common/types'
import PlanRoute from '../../../../app/plan'
import PlanSliceRoute from '../../../../app/plan-slice'
import LegacyDailyRoute from '../../../../app/daily-meditation'
import { useLocalSearchParams } from 'expo-router'
import { useReadingContent } from '../useDailyMeditation'

jest.mock('expo-router', () => ({ Redirect: 'Redirect', useLocalSearchParams: jest.fn() }))
jest.mock('../useDailyMeditation', () => ({ useReadingContent: jest.fn() }))
jest.mock('~features/plans/PlanScreen/PlanScreen', () => 'PlanScreen')
jest.mock('~features/plans/PlanSliceScreen/PlanSliceScreen', () => 'PlanSliceScreen')

const collection: Plan = {
  id: 'book',
  title: 'Book',
  type: 'meditation',
  lang: 'fr',
  sections: [],
  author: { id: 'author', displayName: 'Author', photoUrl: '' },
}

beforeEach(() => {
  jest.mocked(useReadingContent).mockReturnValue({
    collection,
    isError: false,
    isOffline: false,
    retry: jest.fn(),
  })
})
it('redirects old collection links to the dedicated collection page', () => {
  jest
    .mocked(useLocalSearchParams)
    .mockReturnValue({ plan: JSON.stringify({ id: 'book', title: 'Old snapshot' }) })
  expect(PlanRoute().props.href).toEqual({
    pathname: '/meditation-collection',
    params: { collectionId: 'book' },
  })
})
it('redirects an old reading link to the shared reader by stable ID', () => {
  jest
    .mocked(useLocalSearchParams)
    .mockReturnValue({ readingSlice: JSON.stringify({ planId: 'book', id: 'extra', slices: [] }) })
  expect(PlanSliceRoute().props.href).toEqual({
    pathname: '/meditation',
    params: { collectionId: 'book', readingId: 'extra' },
  })
})
it('preserves the original daily date in old notification links', () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ collectionId: 'book', date: '2024-02-29' })
  expect(LegacyDailyRoute().props.href).toEqual({
    pathname: '/meditation',
    params: { collectionId: 'book', date: '2024-02-29' },
  })
})
it('keeps reading plans on their own screens', () => {
  jest.mocked(useReadingContent).mockReturnValue({
    collection: { ...collection, id: 'plan', type: 'yearly' },
    isError: false,
    isOffline: false,
    retry: jest.fn(),
  })
  jest.mocked(useLocalSearchParams).mockReturnValue({ planId: 'plan', readingSliceId: '1' })
  expect(PlanRoute().type).toBe('PlanScreen')
  expect(PlanSliceRoute().type).toBe('PlanSliceScreen')
})
