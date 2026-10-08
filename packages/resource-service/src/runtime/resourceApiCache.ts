import mobileResourceCatalog from '@bible-strong/resource-catalog/catalog'
import { resourceEtagMatches } from '../http/conditionalRequest'
import { withResourceCorsHeaders } from '../http/cors'
import { resourceRequestIdFrom } from '../http/requestId'
import { BIBLE_SEARCH_CACHE_REVISION } from '../search/bibleSearchRevision'
import { isDynamicResourceRequest } from './resourceRoutePolicy'

export const resourceApiCacheEpochFrom = async (catalog: unknown): Promise<string> => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(catalog))
  )
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

// Serializing and hashing the whole catalog (161 KB) gives the same answer for every request
// an isolate serves, cache hits included, so each catalog is fingerprinted once. A catalog is
// never changed in place.
const catalogFingerprints = new WeakMap<object, string>()

const catalogFingerprintOf = async (catalog: unknown): Promise<string> => {
  if (!catalog || typeof catalog !== 'object') return resourceApiCacheEpochFrom(catalog)
  const known = catalogFingerprints.get(catalog)
  if (known) return known
  const fingerprint = await resourceApiCacheEpochFrom(catalog)
  catalogFingerprints.set(catalog, fingerprint)
  return fingerprint
}

// The value of `STRONG_LEXICON_ENTRY_RESPONSE_REVISION` in `domain/strongLexicon.ts`, which a
// test keeps equal. It is repeated because that module loads Effect, and this one is on the
// path of a cached answer: importing it would make every isolate start with Effect.
export const STRONG_LEXICON_ENTRY_CACHE_REVISION =
  'strong-lexicon-case-sensitive-definition-levels-v2'

const STRONG_LEXICON_BATCH_RESPONSE_REVISION = 'strong-lexicon-batch-case-sensitive-levels-v3'
// A Worker older than the option ignored it and cached the gathered list under the same URL.
const STRONG_LEXICON_ALL_IDENTITIES_RESPONSE_REVISION = 'strong-lexicon-browse-all-identities-v1'
const DICTIONARY_PASSAGE_DISCOVERY_RESPONSE_REVISION = 'dictionary-passage-discovery-directory-v1'

type CatalogEntry = { contentSha256?: unknown; archiveSha256?: unknown }

const catalogResourceIdsFrom = (request: Request): string[] => {
  const url = new URL(request.url)
  const pathname = url.pathname
  const match = (pattern: RegExp) => pathname.match(pattern)?.slice(1)
  if (
    pathname === '/v1/bibles/search' ||
    pathname === '/v1/bibles/semantic-search' ||
    pathname === '/v1/bibles/chapters'
  ) {
    return (url.searchParams.get('versions') ?? '')
      .split(',')
      .filter(Boolean)
      .map(version => `bible:${version}`)
  }
  if (pathname.startsWith('/v1/strong-lexicon/')) {
    const simpleModule = pathname.match(/\/modules\/(simple-(?:fr|en))$/)?.[1]
    if (simpleModule) return [`strong-lexicon:${simpleModule}`]
    if (
      /^\/v1\/strong-lexicon\/(?:entries(?:\/[^/]+)?|random|morphologies)$/.test(pathname) &&
      url.searchParams.get('level') === 'simple'
    )
      return [`strong-lexicon:simple-${url.searchParams.get('language')}`]
    return ['strong-lexicon:core', 'strong-lexicon:resources', 'strong-lexicon:entities']
  }
  const bible = match(/^\/v1\/bibles\/([^/]+)\//)
  if (bible && bible[0] !== 'search') return [`bible:${decodeURIComponent(bible[0])}`]
  const strongBible = match(/^\/v1\/strong-bibles\/([^/]+)\//)
  if (strongBible) return [`bible-strong:${decodeURIComponent(strongBible[0])}`]
  const interlinear = match(/^\/v1\/interlinear-bibles\/([^/]+)\/languages\/([^/]+)\//)
  if (interlinear) {
    return [
      `bible-interlinear:${decodeURIComponent(interlinear[0])}:${decodeURIComponent(interlinear[1])}`,
    ]
  }
  const database = match(/^\/v1\/(naves|dictionaries|timelines)\/([^/]+)\//)
  if (database) {
    const names = { naves: 'NAVE', dictionaries: 'DICTIONNAIRE', timelines: 'TIMELINE' }
    return [
      `database:${names[database[0] as keyof typeof names]}:${decodeURIComponent(database[1])}`,
    ]
  }
  return []
}

export const resourceApiCacheRevisionFrom = async (
  request: Request,
  catalog: unknown,
  searchRevision = BIBLE_SEARCH_CACHE_REVISION
): Promise<string> => {
  const resourceIds = catalogResourceIdsFrom(request)
  let catalogRevision: string
  if (resourceIds.length && catalog && typeof catalog === 'object' && 'resources' in catalog) {
    const resources = catalog.resources
    if (resources && typeof resources === 'object') {
      const revisions = resourceIds.map(resourceId => {
        const entry = (resources as Record<string, CatalogEntry>)[resourceId]
        const revision = entry?.contentSha256 ?? entry?.archiveSha256
        return typeof revision === 'string' && revision ? [resourceId, revision] : undefined
      })
      if (revisions.every((revision): revision is [string, string] => revision !== undefined)) {
        catalogRevision = await resourceApiCacheEpochFrom(revisions)
      } else {
        catalogRevision = await catalogFingerprintOf(catalog)
      }
    } else {
      catalogRevision = await catalogFingerprintOf(catalog)
    }
  } else {
    catalogRevision = await catalogFingerprintOf(catalog)
  }

  const { pathname, searchParams } = new URL(request.url)
  const requestRevision =
    isDynamicResourceRequest(request) && !pathname.endsWith('/random')
      ? await resourceApiCacheEpochFrom([catalogRevision, searchRevision])
      : catalogRevision

  if (pathname === '/v1/strong-lexicon/entries/batch') {
    return resourceApiCacheEpochFrom([requestRevision, STRONG_LEXICON_BATCH_RESPONSE_REVISION])
  }
  if (pathname === '/v1/strong-lexicon/entries' && searchParams.get('identities') === 'all') {
    return resourceApiCacheEpochFrom([
      requestRevision,
      STRONG_LEXICON_ALL_IDENTITIES_RESPONSE_REVISION,
    ])
  }
  if (/^\/v1\/dictionaries\/verses\/[^/]+\/entries$/u.test(pathname)) {
    return resourceApiCacheEpochFrom([
      requestRevision,
      DICTIONARY_PASSAGE_DISCOVERY_RESPONSE_REVISION,
    ])
  }
  return /^\/v1\/strong-lexicon\/entries\/[^/]+$/u.test(pathname)
    ? resourceApiCacheEpochFrom([requestRevision, STRONG_LEXICON_ENTRY_CACHE_REVISION])
    : requestRevision
}

export const RESOURCE_API_CACHE_REVISION = (request: Request) =>
  resourceApiCacheRevisionFrom(request, mobileResourceCatalog)

/**
 * The namespace a response is cached under: the revision of the content it reads, and the
 * Worker version that wrote it. A deployment that changes how a route answers therefore
 * never serves what an older version cached, which is what lets a response be kept long.
 */
export const resourceApiCacheEpochFor = (
  contentRevision: string,
  workerVersion: string | undefined
): string => `${contentRevision}.${workerVersion || 'unversioned'}`

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
  /^\/v1\/bibles\/chapters$/,
  /^\/v1\/bibles\/[^/]+\/(?:books\/\d+\/chapters\/\d+|verses|pericopes|coverage)$/,
  /^\/v1\/naves\/[^/]+\/(?:topics\/[^/]+|verses\/[^/]+\/topics)$/,
  /^\/v1\/dictionaries$/,
  /^\/v1\/dictionaries\/verses\/[^/]+\/entries$/,
  /^\/v1\/dictionaries\/[^/]+\/[^/]+\/(?:entries\/(?:batch|by-id\/[^/]+|[^/]+)|verses\/[^/]+\/(?:words|entries))$/,
  /^\/v1\/strong-bibles\/[^/]+\/(?:coverage|books\/\d+\/(?:chapters\/\d+|identities\/[^/]+\/(?:counts|lemmas)))$/,
  /^\/v1\/interlinear-bibles\/[^/]+\/languages\/[^/]+\/(?:coverage|books\/\d+\/chapters\/\d+)$/,
  /^\/v1\/strong-lexicon\/(?:modules\/[^/]+|entries\/[^/]+|morphologies|entities\/(?:chapters\/[^/]+\/\d+|[^/]+))$/,
  /^\/v1\/commentaries\/[^/]+\/[^/]+\/(?:coverage|verses\/[^/]+|chapters\/\d+\/\d+)$/,
  /^\/v1\/commentaries\/verses\/[^/]+\/sections$/,
  /^\/v1\/cross-references\/[^/]+\/verses\/[^/]+$/,
  /^\/v1\/timelines\/[^/]+\/events\/[^/]+$/,
] as const

const SHORT_LIVED_PATHS = [
  /^\/v1\/naves\/[^/]+\/topics$/,
  /^\/v1\/dictionaries\/directory$/,
  /^\/v1\/dictionaries\/[^/]+\/[^/]+\/entries$/,
  /^\/v1\/strong-bibles\/[^/]+\/books\/\d+\/identities\/[^/]+\/occurrences$/,
  /^\/v1\/strong-lexicon\/entries$/,
  /^\/v1\/timelines\/[^/]+\/events$/,
] as const

const HOUR_SECONDS = 60 * 60
const DAY_SECONDS = 24 * HOUR_SECONDS
// A revisioned response cannot go stale under its key: the key names the content it reads
// and the Worker version that wrote it. It is kept as long as a rarely read page needs.
const REVISIONED_TTL_SECONDS = 30 * DAY_SECONDS

export const resourceApiCacheTtlSeconds = (request: Request): number | undefined => {
  if (request.method !== 'GET') return undefined
  const url = new URL(request.url)
  if (url.pathname.endsWith('/random')) return undefined
  if (isDynamicResourceRequest(request)) return DAY_SECONDS
  if (LONG_LIVED_PATHS.some(pattern => pattern.test(url.pathname))) return REVISIONED_TTL_SECONDS
  if (SHORT_LIVED_PATHS.some(pattern => pattern.test(url.pathname))) return HOUR_SECONDS
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
  request?: Request,
  corsAllowedOrigins: readonly string[] = []
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
      return withResourceCorsHeaders(
        request,
        new Response(null, { status: 304, headers }),
        corsAllowedOrigins
      )
    }
  }
  const clientResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
  return request
    ? withResourceCorsHeaders(request, clientResponse, corsAllowedOrigins)
    : clientResponse
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
  corsAllowedOrigins = [],
  waitUntil,
  reportCacheFailure = () => undefined,
  load,
}: {
  request: Request
  authorize: (request: Request) => Promise<boolean>
  cache: ResourceApiEdgeCache
  cacheEpoch: string
  corsAllowedOrigins?: readonly string[]
  waitUntil: (promise: Promise<unknown>) => void
  reportCacheFailure?: (operation: 'match' | 'put', cause: unknown) => void
  load: () => Promise<Response>
}): Promise<Response> => {
  const appCheckFailure = await enforceResourceApiAppCheck(request, authorize)
  if (appCheckFailure) {
    return responseForClient(appCheckFailure, undefined, request, corsAllowedOrigins)
  }

  const ttlSeconds = resourceApiCacheTtlSeconds(request)
  if (!ttlSeconds) {
    const response = await load()
    return new URL(request.url).pathname.startsWith('/v1/')
      ? responseForClient(response, undefined, request, corsAllowedOrigins)
      : response
  }

  const key = cacheRequest(request, cacheEpoch)
  let hit: Response | undefined
  try {
    hit = await cache.match(key)
  } catch (cause) {
    reportCacheFailure('match', cause)
  }
  if (hit) return responseForClient(hit, 'HIT', request, corsAllowedOrigins)

  const response = await load()
  if (response.status !== 200) {
    return responseForClient(response, undefined, request, corsAllowedOrigins)
  }
  const storedResponse = cacheableResponse(response.clone(), ttlSeconds)
  waitUntil(
    cache.put(key, storedResponse).catch(cause => {
      reportCacheFailure('put', cause)
    })
  )
  return responseForClient(response, 'MISS', request, corsAllowedOrigins)
}
