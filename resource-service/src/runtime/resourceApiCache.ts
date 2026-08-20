import mobileResourceCatalog from '../../../src/assets/mobile-resource-catalog.json'
import { resourceEtagMatches } from '../http/conditionalRequest'
import { resourceRequestIdFrom } from '../http/requestId'

export const resourceApiCacheEpochFrom = async (catalog: unknown): Promise<string> => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(catalog))
  )
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

export const RESOURCE_API_CACHE_EPOCH = resourceApiCacheEpochFrom(mobileResourceCatalog)

export type ResourceApiEdgeCache = {
  match(request: Request): Promise<Response | undefined>
  put(request: Request, response: Response): Promise<void>
}

export const enforceResourceApiAppCheck = async (
  request: Request,
  authorize: (request: Request) => Promise<boolean>
): Promise<Response | undefined> => {
  if (!new URL(request.url).pathname.startsWith('/v1/')) return undefined
  return (await authorize(request)) ? undefined : new Response(null, { status: 401 })
}

const LONG_LIVED_PATHS = [
  /^\/v1\/bibles\/[^/]+\/(?:books\/\d+\/chapters\/\d+|verses|pericopes|coverage)$/,
  /^\/v1\/naves\/[^/]+\/(?:topics\/[^/]+|verses\/[^/]+\/topics)$/,
  /^\/v1\/dictionaries\/[^/]+\/(?:entries\/(?:batch|by-id\/[^/]+|[^/]+)|verses\/[^/]+\/words)$/,
  /^\/v1\/strong-bibles\/[^/]+\/(?:coverage|books\/\d+\/(?:chapters\/\d+|identities\/[^/]+\/(?:counts|lemmas)))$/,
  /^\/v1\/interlinear-bibles\/[^/]+\/languages\/[^/]+\/(?:coverage|books\/\d+\/chapters\/\d+)$/,
  /^\/v1\/strong-lexicon\/(?:modules\/[^/]+|entries\/[^/]+|morphologies|entities\/(?:chapters\/[^/]+\/\d+|[^/]+))$/,
  /^\/v1\/commentaries\/[^/]+\/[^/]+\/(?:verses\/[^/]+|chapters\/\d+\/\d+)$/,
  /^\/v1\/cross-references\/[^/]+\/verses\/[^/]+$/,
  /^\/v1\/timelines\/[^/]+\/events\/[^/]+$/,
] as const

const SHORT_LIVED_PATHS = [
  /^\/v1\/naves\/[^/]+\/topics$/,
  /^\/v1\/dictionaries\/[^/]+\/entries$/,
  /^\/v1\/strong-bibles\/[^/]+\/books\/\d+\/identities\/[^/]+\/occurrences$/,
  /^\/v1\/strong-lexicon\/entries$/,
  /^\/v1\/timelines\/[^/]+\/events$/,
] as const

const cacheTtlSeconds = (request: Request): number | undefined => {
  if (request.method !== 'GET') return undefined
  const url = new URL(request.url)
  if (
    url.pathname.endsWith('/search') ||
    url.pathname.endsWith('/random') ||
    url.searchParams.has('search')
  ) {
    return undefined
  }
  if (LONG_LIVED_PATHS.some(pattern => pattern.test(url.pathname))) return 24 * 60 * 60
  if (SHORT_LIVED_PATHS.some(pattern => pattern.test(url.pathname))) return 60 * 60
  return undefined
}

const cacheRequest = (request: Request, cacheEpoch: string): Request => {
  const source = new URL(request.url)
  source.searchParams.sort()
  source.pathname = `/__resource-api-cache/${encodeURIComponent(cacheEpoch)}${source.pathname}`
  return new Request(source, { method: 'GET' })
}

const responseForClient = (
  response: Response,
  status?: 'HIT' | 'MISS',
  request?: Request
): Response => {
  const headers = new Headers(response.headers)
  headers.set('cache-control', 'private, no-store')
  if (status) headers.set('x-resource-cache', status)
  if (request && (status === 'HIT' || !headers.has('x-request-id'))) {
    headers.set(
      'x-request-id',
      resourceRequestIdFrom(request.headers.get('x-request-id') ?? undefined)
    )
  }
  if (status === 'HIT' && request) {
    const etag = headers.get('etag')
    if (etag && resourceEtagMatches(request.headers.get('if-none-match') ?? undefined, etag)) {
      headers.delete('content-length')
      return new Response(null, { status: 304, headers })
    }
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

const cacheableResponse = (response: Response, ttlSeconds: number): Response => {
  const headers = new Headers(response.headers)
  headers.set('cache-control', `public, max-age=${ttlSeconds}`)
  headers.delete('x-resource-cache')
  headers.delete('x-request-id')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export const routeResourceApiRequest = async ({
  request,
  authorize,
  cache,
  cacheEpoch,
  waitUntil,
  reportCacheFailure = () => undefined,
  load,
}: {
  request: Request
  authorize: (request: Request) => Promise<boolean>
  cache: ResourceApiEdgeCache
  cacheEpoch: string
  waitUntil: (promise: Promise<unknown>) => void
  reportCacheFailure?: (operation: 'match' | 'put', cause: unknown) => void
  load: () => Promise<Response>
}): Promise<Response> => {
  const appCheckFailure = await enforceResourceApiAppCheck(request, authorize)
  if (appCheckFailure) return responseForClient(appCheckFailure, undefined, request)

  const ttlSeconds = cacheTtlSeconds(request)
  if (!ttlSeconds) {
    const response = await load()
    return new URL(request.url).pathname.startsWith('/v1/')
      ? responseForClient(response, undefined, request)
      : response
  }

  const key = cacheRequest(request, cacheEpoch)
  let hit: Response | undefined
  try {
    hit = await cache.match(key)
  } catch (cause) {
    reportCacheFailure('match', cause)
  }
  if (hit) return responseForClient(hit, 'HIT', request)

  const response = await load()
  if (response.status !== 200) return responseForClient(response, undefined, request)
  const storedResponse = cacheableResponse(response.clone(), ttlSeconds)
  waitUntil(
    cache.put(key, storedResponse).catch(cause => {
      reportCacheFailure('put', cause)
    })
  )
  return responseForClient(response, 'MISS', request)
}
