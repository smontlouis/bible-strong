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
    // The senses of a number are listed by the simple lexicon of a language and told apart
    // by the detailed lexicon and its entities; no dictionary article is read.
    if (/^\/v1\/strong-lexicon\/numbers\/[^/]+\/senses$/.test(pathname)) {
      return [
        `strong-lexicon:simple-${url.searchParams.get('language')}`,
        'strong-lexicon:core',
        'strong-lexicon:entities',
      ]
    }
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
 * never serves what an older version cached as its own, which is what lets a response be
 * kept long.
 */
export const resourceApiCacheEpochFor = (
  contentRevision: string,
  workerVersion: string | undefined
): string => `${contentRevision}.${workerVersion || 'unversioned'}`

/**
 * Names what the cached routes answer, whatever the Worker version that answers it. Bump it
 * in the deployment that changes what a cached route answers for the same content: a field
 * added, removed or corrected, another order, another rule. Left as it is, that deployment
 * answers each URL once more, in each data center, with what the version before it stored.
 */
export const RESOURCE_API_ANSWER_REVISION = 'answers-1'

/**
 * The namespace of the fallback: the same content, and no Worker version. A deployment
 * starts with nothing under its own namespace, and answers from this one while it reads the
 * database again. A Worker version is never spelled like the suffix, so the two cannot meet.
 */
export const resourceApiFallbackEpochFor = (
  contentRevision: string,
  answerRevision: string = RESOURCE_API_ANSWER_REVISION
): string => `${contentRevision}.fallback-${answerRevision}`

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
  // The counts of several references, `identities/batch/counts`, are counts like those of one.
  /^\/v1\/strong-bibles\/[^/]+\/(?:coverage|books\/\d+\/(?:chapters\/\d+|identities\/[^/]+\/(?:counts|lemmas)))$/,
  /^\/v1\/interlinear-bibles\/[^/]+\/languages\/[^/]+\/(?:coverage|books\/\d+\/chapters\/\d+)$/,
  /^\/v1\/strong-lexicon\/(?:modules\/[^/]+|entries\/[^/]+|numbers\/[^/]+\/senses|morphologies|entities\/(?:chapters\/[^/]+\/\d+|[^/]+))$/,
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

/**
 * Whether a response is also kept for the deployments to come. A search is not: its answer
 * is seldom asked twice, and reading it again behind its caller's back would open the
 * database, and for a semantic search call Workers AI, for an answer nobody may ask for.
 */
export const resourceApiFallbackTakesPart = (request: Request): boolean =>
  resourceApiCacheTtlSeconds(request) !== undefined && !isDynamicResourceRequest(request)

// How long one refresh keeps the others away from its URL, in its isolate and, through the
// cache, in its data center: the time a read of the database may take, and the pause before
// a refresh that stored nothing is tried again.
const REFRESH_CLAIM_SECONDS = 30

// The URLs this isolate is refreshing, by the time each began. Only a time is kept: a
// promise of one request must not be awaited by another.
const refreshesInFlight = new Map<string, number>()

// A caller that sends a validator would have the database answer 304, which is not stored.
const unconditionalRequest = (request: Request): Request => {
  const headers = new Headers(request.headers)
  headers.delete('if-none-match')
  headers.delete('if-modified-since')
  return new Request(request.url, { method: 'GET', headers })
}

const responseForClient = (
  response: Response,
  status?: 'HIT' | 'MISS' | 'STALE',
  request?: Request,
  corsAllowedOrigins: readonly string[] = []
): Response => {
  const headers = new Headers(response.headers)
  headers.set('cache-control', 'private, no-store')
  if (status) headers.set('x-resource-cache', status)
  // A stored response carries no request ID: the caller's own is added to what it is sent.
  if (request && ((status && status !== 'MISS') || !headers.has('x-request-id'))) {
    headers.set(
      'x-request-id',
      resourceRequestIdFrom(request.headers.get('x-request-id') ?? undefined)
    )
  }
  // Only an answer of this version says "not modified". A STALE one is always sent whole:
  // 304 would confirm, in the name of this version, what an earlier one answered.
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

export type ResourceApiCacheOperation = 'match' | 'put' | 'refresh'

/** What answers a deployment that has not read a URL yet, and how that URL is read again. */
export type ResourceApiFallback = {
  /** `resourceApiFallbackEpochFor` of the content the request reads. */
  epoch: string
  /**
   * Reads the database for a caller that has already been answered. Its response is stored
   * when it is a 200 and dropped otherwise: a refusal, an error and an absence leave the
   * fallback as it is.
   */
  refresh: (request: Request) => Promise<Response>
}

// A cache that fails claims nothing: the refresh goes on, as a read does without the cache.
const claimedElsewhere = async (
  cache: ResourceApiEdgeCache,
  marker: Request,
  reportCacheFailure: (operation: ResourceApiCacheOperation, cause: unknown) => void
): Promise<boolean> => {
  try {
    if (await cache.match(marker)) return true
  } catch (cause) {
    reportCacheFailure('match', cause)
    return false
  }
  await cache
    .put(
      marker,
      new Response('refreshing', {
        headers: { 'cache-control': `public, max-age=${REFRESH_CLAIM_SECONDS}` },
      })
    )
    .catch(cause => {
      reportCacheFailure('put', cause)
    })
  return false
}

/**
 * Reads a URL again after its caller was answered with the fallback, and stores the answer
 * of this version under both namespaces. One refresh at a time per URL: the callers that
 * arrive meanwhile are answered with the fallback too, and read nothing.
 */
const refreshFallback = async ({
  request,
  claim,
  marker,
  cache,
  refresh,
  store,
  reportCacheFailure,
}: {
  request: Request
  claim: string
  marker: Request
  cache: ResourceApiEdgeCache
  refresh: ResourceApiFallback['refresh']
  store: (response: Response) => Promise<unknown>
  reportCacheFailure: (operation: ResourceApiCacheOperation, cause: unknown) => void
}): Promise<void> => {
  // Claimed before anything is awaited, so two requests of one isolate cannot both pass.
  const claimedAt = refreshesInFlight.get(claim)
  if (claimedAt !== undefined && Date.now() - claimedAt < REFRESH_CLAIM_SECONDS * 1_000) return
  refreshesInFlight.set(claim, Date.now())
  try {
    // Isolates share nothing but the cache: a short-lived entry tells the others of this
    // data center that the URL is being read. It is not a lock, two may still pass
    // together. It outlives a refresh that stored nothing, which is then not tried again
    // at once.
    if (await claimedElsewhere(cache, marker, reportCacheFailure)) return
    const response = await refresh(unconditionalRequest(request))
    if (response.status === 200) await store(response)
    // Nobody reads this response: what was stored are copies of it. Not awaited: a body
    // that was copied is only done being cancelled once its copies are read.
    void response.body?.cancel().catch(() => undefined)
  } catch (cause) {
    reportCacheFailure('refresh', cause)
  } finally {
    refreshesInFlight.delete(claim)
  }
}

export const routeResourceApiRequest = async ({
  request,
  authorize,
  cache,
  cacheEpoch,
  fallback,
  corsAllowedOrigins = [],
  waitUntil,
  reportCacheFailure = () => undefined,
  load,
}: {
  request: Request
  authorize: (request: Request) => Promise<boolean>
  cache: ResourceApiEdgeCache
  cacheEpoch: string
  fallback?: ResourceApiFallback
  corsAllowedOrigins?: readonly string[]
  waitUntil: (promise: Promise<unknown>) => void
  reportCacheFailure?: (operation: ResourceApiCacheOperation, cause: unknown) => void
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

  const match = async (key: Request): Promise<Response | undefined> => {
    try {
      return await cache.match(key)
    } catch (cause) {
      reportCacheFailure('match', cause)
      return undefined
    }
  }
  const key = cacheRequest(request, cacheEpoch)
  const hit = await match(key)
  if (hit) return responseForClient(hit, 'HIT', request, corsAllowedOrigins)

  // This version has not stored the URL. Everything below is the path of a miss: a cached
  // answer never looks for the fallback.
  const fallbackKey =
    fallback && resourceApiFallbackTakesPart(request)
      ? cacheRequest(request, fallback.epoch)
      : undefined
  // Both copies are stored at once and for as long: the fallback never outlives what its
  // own version would still have answered.
  const store = (response: Response): Promise<unknown> =>
    Promise.all(
      [key, fallbackKey]
        .filter(target => target !== undefined)
        .map(target => [target, cacheableResponse(response.clone(), ttlSeconds)] as const)
        .map(([target, stored]) =>
          cache.put(target, stored).catch(cause => {
            reportCacheFailure('put', cause)
          })
        )
    )

  const kept = fallback && fallbackKey ? await match(fallbackKey) : undefined
  if (fallback && fallbackKey && kept) {
    waitUntil(
      refreshFallback({
        request,
        // Claimed in the name of this version: what the version before it was refreshing
        // a moment ago does not hold this one back.
        claim: key.url,
        marker: cacheRequest(request, `${cacheEpoch}.refreshing`),
        cache,
        refresh: fallback.refresh,
        store,
        reportCacheFailure,
      })
    )
    return responseForClient(kept, 'STALE', request, corsAllowedOrigins)
  }

  const response = await load()
  if (response.status !== 200) {
    return responseForClient(response, undefined, request, corsAllowedOrigins)
  }
  waitUntil(store(response))
  return responseForClient(response, 'MISS', request, corsAllowedOrigins)
}
