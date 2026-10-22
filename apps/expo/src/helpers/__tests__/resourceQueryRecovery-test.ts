import { onlineManager, QueryClient, QueryObserver } from '@tanstack/react-query'
import {
  isRefusedResourceRequest,
  refetchResourceOnReconnect,
  retryUnlessRefused,
} from '../resourceQueryRecovery'
import { resourceQueryKeys } from '../resourceQueryKeys'
import { ResourceAccessError } from '~features/resources/resourceAccessError'

it.each([
  ['unavailable', { status: 'unavailable' }],
  ['failed chapter', { success: false, error: { type: 'RESOURCE_OFFLINE' } }],
  ['unavailable infinite page', { pages: [{ status: 'unavailable' }] }],
  ['module missing offline', { status: 'missing', moduleId: 'simple-fr' }],
  [
    'partly unavailable commentary chapter',
    { commentsByVerse: {}, unavailableResources: [{ resourceId: 'MHY' }] },
  ],
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

describe('automatic retries of resource requests', () => {
  const refused = (httpStatus: number, retryAfterSeconds?: number) =>
    new ResourceAccessError('TEMPORARY_UNAVAILABLE', ['retry'], {
      httpStatus,
      ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
    })

  it('retries a server or network failure once', () => {
    expect(retryUnlessRefused(0, refused(500))).toBe(true)
    expect(retryUnlessRefused(0, new ResourceAccessError('NETWORK_OFFLINE'))).toBe(true)
    expect(retryUnlessRefused(0, new Error('firestore'))).toBe(true)
    expect(retryUnlessRefused(1, refused(500))).toBe(false)
  })

  it('leaves refused requests and requests to wait to the reader', () => {
    expect(isRefusedResourceRequest(refused(404))).toBe(true)
    expect(isRefusedResourceRequest(refused(403))).toBe(true)
    expect(isRefusedResourceRequest(refused(429, 60))).toBe(true)
    expect(isRefusedResourceRequest(refused(503, 30))).toBe(true)
    expect(retryUnlessRefused(0, refused(429, 60))).toBe(false)
    expect(retryUnlessRefused(0, refused(503, 30))).toBe(false)
    expect(retryUnlessRefused(0, refused(400))).toBe(false)
  })
})
