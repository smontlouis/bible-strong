import { ResourceAccessError } from '~features/resources/resourceAccessError'

export function getSearchRateLimitSeconds(error: unknown): number | undefined {
  if (!(error instanceof ResourceAccessError) || error.httpStatus !== 429) return undefined
  const seconds = error.retryAfterSeconds
  return seconds !== undefined && Number.isFinite(seconds) && seconds >= 0
    ? Math.max(1, Math.ceil(seconds))
    : 60
}

/** Retry only throttling, once, after the server's cooldown. */
export const searchRateLimitQueryOptions = {
  retry: (failureCount: number, error: unknown) =>
    failureCount < 1 && getSearchRateLimitSeconds(error) !== undefined,
  retryDelay: (_failureCount: number, error: unknown) =>
    (getSearchRateLimitSeconds(error) ?? 60) * 1000,
}

export function getSearchRateLimitNotice(
  queries: readonly { failureReason: unknown; error: unknown; isFetching: boolean }[]
): { seconds: number; retrying: boolean } | undefined {
  const limited = queries.flatMap(query => {
    const seconds = getSearchRateLimitSeconds(query.failureReason ?? query.error)
    return seconds === undefined ? [] : [{ seconds, retrying: query.isFetching }]
  })
  if (!limited.length) return undefined
  return {
    seconds: Math.max(...limited.map(query => query.seconds)),
    retrying: limited.some(query => query.retrying),
  }
}
