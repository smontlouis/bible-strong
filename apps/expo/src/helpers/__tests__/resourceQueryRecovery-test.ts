import { onlineManager, QueryClient, QueryObserver } from '@tanstack/react-query'
import { refetchResourceOnReconnect } from '../resourceQueryRecovery'
import { resourceQueryKeys } from '../resourceQueryKeys'

it.each([
  ['unavailable', { status: 'unavailable' }],
  ['failed chapter', { success: false, error: { type: 'RESOURCE_OFFLINE' } }],
  ['unavailable infinite page', { pages: [{ status: 'unavailable' }] }],
  ['thrown error', new Error('offline')],
])('recovers a cached %s on reconnection despite infinite freshness', async (_, failure) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryDefaults(resourceQueryKeys.all(), {
    refetchOnReconnect: refetchResourceOnReconnect,
  })
  client.mount()
  onlineManager.setOnline(false)
  const queryFn = jest
    .fn()
    .mockImplementationOnce(() =>
      failure instanceof Error ? Promise.reject(failure) : Promise.resolve(failure)
    )
    .mockResolvedValue({ status: 'available' })
  const observer = new QueryObserver(client, {
    queryKey: resourceQueryKeys.offlineDatabaseAvailability('TRESOR', 'en'),
    queryFn,
    networkMode: 'always',
    staleTime: Infinity,
  })
  const unsubscribe = observer.subscribe(() => {})
  try {
    await observer.refetch()
    expect(queryFn).toHaveBeenCalledTimes(1)
    onlineManager.setOnline(true)
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(queryFn).toHaveBeenCalledTimes(2)
    expect(observer.getCurrentResult().data).toEqual({ status: 'available' })
  } finally {
    unsubscribe()
    client.unmount()
    client.clear()
    onlineManager.setOnline(true)
  }
})

it('keeps successful immutable resource reads cached on reconnection', async () => {
  const client = new QueryClient()
  client.setQueryDefaults(resourceQueryKeys.all(), {
    refetchOnReconnect: refetchResourceOnReconnect,
  })
  client.mount()
  onlineManager.setOnline(false)
  const queryFn = jest.fn().mockResolvedValue({ status: 'available' })
  const observer = new QueryObserver(client, {
    queryKey: resourceQueryKeys.offlineDatabaseAvailability('TRESOR', 'en'),
    queryFn,
    networkMode: 'always',
    staleTime: Infinity,
  })
  const unsubscribe = observer.subscribe(() => {})
  try {
    await observer.refetch()
    onlineManager.setOnline(true)
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(queryFn).toHaveBeenCalledTimes(1)
  } finally {
    unsubscribe()
    client.unmount()
    client.clear()
    onlineManager.setOnline(true)
  }
})

it('recovers an unavailable read when reopening a screen that missed reconnection', async () => {
  const client = new QueryClient()
  client.setQueryDefaults(resourceQueryKeys.all(), {
    refetchOnReconnect: refetchResourceOnReconnect,
    refetchOnMount: refetchResourceOnReconnect,
  })
  const queryKey = resourceQueryKeys.offlineDatabaseAvailability('TRESOR', 'en')
  client.setQueryData(queryKey, { status: 'unavailable' })
  const queryFn = jest.fn().mockResolvedValue({ status: 'available' })
  const observer = new QueryObserver(client, {
    queryKey,
    queryFn,
    networkMode: 'always',
    staleTime: Infinity,
  })
  const unsubscribe = observer.subscribe(() => {})
  try {
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(queryFn).toHaveBeenCalledTimes(1)
    expect(observer.getCurrentResult().data).toEqual({ status: 'available' })
  } finally {
    unsubscribe()
    client.clear()
  }
})
