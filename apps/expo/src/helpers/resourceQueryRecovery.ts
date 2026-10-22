import { ResourceAccessError } from '~features/resources/resourceAccessError'

const isUnavailable = (data: unknown): boolean => {
  if (!data || typeof data !== 'object') return false
  if ('status' in data && data.status === 'unavailable') return true
  // A module read while offline without its Offline copy is missing until the network returns.
  if ('status' in data && data.status === 'missing') return true
  if ('success' in data && data.success === false) return true
  // A commentary chapter lists the selected resources it could not read.
  if (
    'unavailableResources' in data &&
    Array.isArray(data.unavailableResources) &&
    data.unavailableResources.length > 0
  ) {
    return true
  }
  return 'pages' in data && Array.isArray(data.pages) && data.pages.some(isUnavailable)
}

// Resource reads also run offline and cache immutable data indefinitely. Only
// failed reads need to bypass that freshness when connectivity returns.
export const refetchResourceOnReconnect = (query: {
  state: { status: string; data: unknown }
}): 'always' | false =>
  query.state.status === 'error' || isUnavailable(query.state.data) ? 'always' : false

// The server refused the request (4xx, rate limit included) or asked not to be called again
// before a delay (Retry-After): an automatic retry would get the same answer, so it is left to
// the reader's explicit retry.
export const isRefusedResourceRequest = (error: unknown): boolean =>
  error instanceof ResourceAccessError &&
  ((error.httpStatus !== undefined && error.httpStatus >= 400 && error.httpStatus < 500) ||
    error.retryAfterSeconds !== undefined)

/** One automatic retry, as by default, except for a request the Resource API refused. */
export const retryUnlessRefused = (failureCount: number, error: unknown): boolean =>
  failureCount < 1 && !isRefusedResourceRequest(error)
