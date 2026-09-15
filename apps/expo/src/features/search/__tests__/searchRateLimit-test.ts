import { QueryClient } from '@tanstack/react-query'
import { ResourceAccessError } from '~features/resources/resourceAccessError'
import {
  getSearchRateLimitNotice,
  getSearchRateLimitSeconds,
  searchRateLimitQueryOptions,
} from '../searchRateLimit'

const limited = (seconds = 60) =>
  new ResourceAccessError('TEMPORARY_UNAVAILABLE', ['retry'], {
    httpStatus: 429,
    retryAfterSeconds: seconds,
    serverCode: 'RESOURCE_RATE_LIMITED',
  })

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it('retries after Retry-After, never before, and stops after one retry', async () => {
  const client = new QueryClient()
  const request = jest.fn().mockRejectedValue(limited(12))
  const result = client
    .fetchQuery({ queryKey: ['search'], queryFn: request, ...searchRateLimitQueryOptions })
    .catch(error => error)
  try {
    await jest.advanceTimersByTimeAsync(11_999)
    expect(request).toHaveBeenCalledTimes(1)
    await jest.advanceTimersByTimeAsync(1)
    expect(request).toHaveBeenCalledTimes(2)
    expect(await result).toBeInstanceOf(ResourceAccessError)
    await jest.advanceTimersByTimeAsync(60_000)
    expect(request).toHaveBeenCalledTimes(2)
  } finally {
    client.clear()
  }
})

it('recovers automatically when the next attempt succeeds', async () => {
  const client = new QueryClient()
  const request = jest.fn().mockRejectedValueOnce(limited()).mockResolvedValue(['Jean 3:16'])
  const result = client.fetchQuery({
    queryKey: ['search'],
    queryFn: request,
    ...searchRateLimitQueryOptions,
  })
  try {
    await jest.advanceTimersByTimeAsync(60_000)
    expect(await result).toEqual(['Jean 3:16'])
    expect(request).toHaveBeenCalledTimes(2)
  } finally {
    client.clear()
  }
})

it('does not retry cancelled searches or non-429 failures', async () => {
  const client = new QueryClient()
  const request = jest.fn().mockRejectedValue(limited())
  const result = client
    .fetchQuery({ queryKey: ['obsolete-search'], queryFn: request, ...searchRateLimitQueryOptions })
    .catch(error => error)
  try {
    await jest.advanceTimersByTimeAsync(1)
    await client.cancelQueries({ queryKey: ['obsolete-search'] })
    await result
    await jest.advanceTimersByTimeAsync(60_000)
    expect(request).toHaveBeenCalledTimes(1)
    expect(searchRateLimitQueryOptions.retry(0, new Error('network failure'))).toBe(false)
    expect(
      searchRateLimitQueryOptions.retry(
        0,
        new ResourceAccessError('TEMPORARY_UNAVAILABLE', [], { httpStatus: 503 })
      )
    ).toBe(false)
  } finally {
    client.clear()
  }
})

it('provides a fallback delay and distinguishes scheduled retry from exhausted retry', () => {
  expect(
    getSearchRateLimitSeconds(
      new ResourceAccessError('TEMPORARY_UNAVAILABLE', [], { httpStatus: 429 })
    )
  ).toBe(60)
  expect(
    getSearchRateLimitNotice([{ failureReason: limited(20), error: null, isFetching: true }])
  ).toEqual({ seconds: 20, retrying: true })
  expect(
    getSearchRateLimitNotice([
      { failureReason: limited(20), error: limited(20), isFetching: false },
    ])
  ).toEqual({ seconds: 20, retrying: false })
  expect(
    getSearchRateLimitNotice([{ failureReason: null, error: null, isFetching: false }])
  ).toBeUndefined()
})
