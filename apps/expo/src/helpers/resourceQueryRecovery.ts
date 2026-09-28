const isUnavailable = (data: unknown): boolean => {
  if (!data || typeof data !== 'object') return false
  if ('status' in data && data.status === 'unavailable') return true
  if ('success' in data && data.success === false) return true
  return 'pages' in data && Array.isArray(data.pages) && data.pages.some(isUnavailable)
}

// Resource reads also run offline and cache immutable data indefinitely. Only
// failed reads need to bypass that freshness when connectivity returns.
export const refetchResourceOnReconnect = (query: {
  state: { status: string; data: unknown }
}): 'always' | false =>
  query.state.status === 'error' || isUnavailable(query.state.data) ? 'always' : false
