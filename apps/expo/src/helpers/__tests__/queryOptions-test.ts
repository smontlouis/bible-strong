import { focusManager, QueryClient, QueryObserver } from '@tanstack/react-query'

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

  it.each([
    ['keeps a successful read', { revision: 'r1' }, 1],
    ['reads a failed one again', { status: 'unavailable' }, 2],
  ])('%s when the app returns to the foreground', async (_, firstResult, expectedCalls) => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    queryClient.mount()
    const queryFn = jest
      .fn()
      .mockResolvedValueOnce(firstResult)
      .mockResolvedValue({ revision: 'r1' })
    const observer = new QueryObserver(queryClient, {
      queryKey: ['strong-lexicon', 'entry', 'fr'],
      queryFn,
      ...staticResourceQueryOptions,
    })
    const unsubscribe = observer.subscribe(() => undefined)
    try {
      await observer.refetch()
      focusManager.setFocused(false)
      focusManager.setFocused(true)
      await new Promise(resolve => setTimeout(resolve, 0))
      expect(queryFn).toHaveBeenCalledTimes(expectedCalls)
    } finally {
      unsubscribe()
      focusManager.setFocused(undefined)
      queryClient.unmount()
      queryClient.clear()
    }
  })
})
