import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Provider } from 'react-redux'
import { createStore } from 'redux'
import { useReadingContent } from '../useDailyMeditation'

jest.mock('react-native', () => ({ AppState: {} }))

const mockPlan = { id: 'plan', kind: 'reading-plan', sections: [] }
let mockStore: ReturnType<typeof createStore>
const mockFetch = jest.fn()
jest.mock('~redux/modules/plan', () => ({
  fetchPlan: () => {
    mockFetch()
    return { type: 'loaded' }
  },
}))
jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useDispatch: () => (action: { type: string }) => ({
    unwrap: async () => {
      mockStore.dispatch(action)
      return mockPlan
    },
  }),
}))
jest.mock('~features/plans/readingCalendar', () => ({
  normalizeMeditationCollection: (plan: unknown) => plan,
}))
jest.mock('../meditationPassage', () => ({}))

it('reloads Redux content when a previously loaded plan is removed and reopened', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  mockStore = createStore((state = { plan: { myPlans: [] as (typeof mockPlan)[] } }, action) => {
    if (action.type === 'loaded') return { plan: { myPlans: [mockPlan] } }
    if (action.type === 'remove') return { plan: { myPlans: [] } }
    return state
  })
  let result: ReturnType<typeof useReadingContent>
  const Reader = () => {
    result = useReadingContent('plan')
    return null
  }
  const render = () =>
    create(
      <Provider store={mockStore}>
        <QueryClientProvider client={client}>
          <Reader />
        </QueryClientProvider>
      </Provider>
    )
  let tree: ReactTestRenderer
  await act(async () => {
    tree = render()
    await new Promise(resolve => setTimeout(resolve, 20))
  })
  expect(result!.collection?.id).toBe('plan')
  await act(async () => {
    tree!.unmount()
  })
  mockStore.dispatch({ type: 'remove' })
  await act(async () => {
    tree = render()
    await new Promise(resolve => setTimeout(resolve, 20))
  })
  expect(mockFetch).toHaveBeenCalledTimes(2)
  expect(result!.collection?.id).toBe('plan')
  await act(async () => {
    tree!.unmount()
  })
  client.clear()
})
