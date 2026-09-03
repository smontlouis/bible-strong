import { QueryClient, QueryObserver } from '@tanstack/react-query'

import { staticResourceQueryOptions } from '../queryOptions'

describe('static resource query options', () => {
  it('reuses a successful response when the same resource is observed again', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const queryFn = jest.fn(async () => ({ revision: 'r1' }))
    const createObserver = () =>
      new QueryObserver(queryClient, {
        queryKey: ['resource', 'coverage', 'LSG'],
        queryFn,
        ...staticResourceQueryOptions,
      })

    const firstObserver = createObserver()
    const unsubscribeFirst = firstObserver.subscribe(() => undefined)
    await firstObserver.refetch()
    unsubscribeFirst()

    const secondObserver = createObserver()
    const unsubscribeSecond = secondObserver.subscribe(() => undefined)
    await Promise.resolve()

    expect(queryFn).toHaveBeenCalledTimes(1)

    unsubscribeSecond()
    queryClient.clear()
  })
})
