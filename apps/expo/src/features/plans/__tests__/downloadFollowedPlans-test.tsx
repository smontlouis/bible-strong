import React from 'react'
import { act, create } from 'react-test-renderer'
import { useDownloadFollowedPlans } from '../plan.hooks'

const mockState = {
  plan: {
    myPlans: [{ id: 'downloaded' }],
    ongoingPlans: [
      { id: 'started', status: 'Progress', readingSlices: {} },
      { id: 'idle', status: 'Idle', readingSlices: {} },
      { id: 'downloaded', status: 'Progress', readingSlices: {} },
      { id: 'unavailable', status: 'Idle', readingSlices: { a: 'Completed' } },
    ],
  },
}
const mockFetchPlan = jest.fn((arg: { id: string }) => arg)
const mockDispatch = jest.fn((action: { id: string }) => ({
  unwrap: () =>
    action.id === 'unavailable'
      ? Promise.reject(new Error('Reading content is unavailable'))
      : Promise.resolve(),
}))

jest.mock('react-redux', () => ({
  shallowEqual: () => true,
  useSelector: (select: (state: typeof mockState) => unknown) => select(mockState),
  useDispatch: () => mockDispatch,
}))
jest.mock('~redux/modules/plan', () => ({
  cacheImage: jest.fn(),
  fetchPlan: (arg: { id: string }) => mockFetchPlan(arg),
  updatePlans: jest.fn(),
}))
jest.mock('~redux/selectors/plan', () => ({}))
jest.mock('~i18n', () => ({ __esModule: true, default: { t: (key: string) => key } }))
jest.mock('~helpers/firebase', () => ({ cdnUrl: '' }))
jest.mock('~helpers/bibleBookCatalog', () => ({ getBook: jest.fn() }))
jest.mock('~helpers/toast', () => ({ toast: { error: jest.fn() } }))
jest.mock('~features/resources/resourceAccess', () => ({ defaultResourceAccess: {} }))
jest.mock('../../../state/useDefaultBibleVersion', () => ({ useDefaultBibleVersion: jest.fn() }))
jest.mock('~state/tabs', () => ({}))

const Probe = () => {
  useDownloadFollowedPlans()
  return null
}

beforeAll(() => {
  ;(
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true
})

it('downloads started plans this device lacks, once per session when the download fails', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  await act(async () => {
    create(<Probe />)
  })
  expect(mockFetchPlan.mock.calls.map(([arg]) => arg)).toEqual([
    { id: 'started' },
    { id: 'unavailable' },
  ])
  expect(warn).toHaveBeenCalledWith(
    '[Plans] Could not download a followed plan',
    'unavailable',
    expect.any(Error)
  )

  // A later home mount retries a plan that downloaded (a logout clears it), not one that failed.
  mockFetchPlan.mockClear()
  await act(async () => {
    create(<Probe />)
  })
  expect(mockFetchPlan.mock.calls.map(([arg]) => arg)).toEqual([{ id: 'started' }])
  warn.mockRestore()
})
