export type ResourceRequestClass = 'public-catalog' | 'artifact' | 'search' | 'reading' | 'other'

export const resourceRequestClassFrom = (request: Request): ResourceRequestClass => {
  const url = new URL(request.url)
  if (url.pathname === '/v1/offline-catalog') return 'public-catalog'
  if (url.pathname.startsWith('/v1/offline-artifacts/')) return 'artifact'
  if (!url.pathname.startsWith('/v1/')) return 'other'
  if (
    url.pathname.endsWith('/search') ||
    url.pathname.endsWith('/random') ||
    url.searchParams.has('search')
  ) {
    return 'search'
  }
  return 'reading'
}

export const isDynamicResourceRequest = (request: Request): boolean =>
  resourceRequestClassFrom(request) === 'search'
