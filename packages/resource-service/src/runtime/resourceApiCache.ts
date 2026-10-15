import mobileResourceCatalog from '@bible-strong/resource-catalog/catalog'
import { resourceEtagMatches } from '../http/conditionalRequest'
import { withResourceCorsHeaders } from '../http/cors'
import { resourceRequestIdFrom } from '../http/requestId'
import { BIBLE_SEARCH_CACHE_REVISION } from '../search/bibleSearchRevision'
import resourceApiInvalidations from './resourceApiInvalidations.json'
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

/**
 * How many times the operator invalidated a resource by hand (`yarn cache:invalidate`), by its
 * catalog identity. A resource absent from the list keeps the key its content names.
 */
export const RESOURCE_API_INVALIDATIONS: Readonly<Record<string, number>> = resourceApiInvalidations

// Published content the Artifact catalog does not describe: its key changes only by hand.
const UNCATALOGUED_RESOURCE_PREFIXES = ['cross-references:'] as const

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
  const database = match(/^\/v1\/(naves|timelines)\/([^/]+)\//)
  if (database) {
    const names = { naves: 'NAVE', timelines: 'TIMELINE' }
    return [
      `database:${names[database[0] as keyof typeof names]}:${decodeURIComponent(database[1])}`,
    ]
  }
  // A dictionary or a commentary is a database named by its work and its language. What
  // gathers every work of a language (`/v1/dictionaries/verses/…`) names none.
  const work = match(/^\/v1\/(?:dictionaries|commentaries)\/([^/]+)\/([^/]+)\//)
  if (work && work[0] !== 'verses') {
    return [`database:${decodeURIComponent(work[0])}:${decodeURIComponent(work[1])}`]
  }
  if (/^\/v1\/commentaries\/verses\/[^/]+\/sections$/u.test(pathname)) {
    const language = url.searchParams.get('language')
    const commentaries = (url.searchParams.get('commentaries') ?? '').split(',').filter(Boolean)
    return language ? commentaries.map(id => `database:${id}:${language}`) : []
  }
  const crossReferences = match(/^\/v1\/cross-references\/([^/]+)\//)
  if (crossReferences) return [`cross-references:${decodeURIComponent(crossReferences[0])}`]
  return []
}

export const resourceApiCacheRevisionFrom = async (
  request: Request,
  catalog: unknown,
  searchRevision = BIBLE_SEARCH_CACHE_REVISION,
  invalidations: Readonly<Record<string, number>> = RESOURCE_API_INVALIDATIONS
): Promise<string> => {
  const resourceIds = catalogResourceIdsFrom(request)
  const resources =
    catalog && typeof catalog === 'object' && 'resources' in catalog ? catalog.resources : undefined
  const revisionOf = (resourceId: string): string[] | undefined => {
    const entry =
      resources && typeof resources === 'object'
        ? (resources as Record<string, CatalogEntry>)[resourceId]
        : undefined
    const published = entry?.contentSha256 ?? entry?.archiveSha256
    const revision =
      typeof published === 'string' && published
        ? published
        : UNCATALOGUED_RESOURCE_PREFIXES.some(prefix => resourceId.startsWith(prefix))
          ? 'uncatalogued'
          : undefined
    if (!revision) return undefined
    const invalidation = invalidations[resourceId]
    // Absent, the key is the one the content alone named before invalidations existed.
    return invalidation
      ? [resourceId, revision, `invalidation-${invalidation}`]
      : [resourceId, revision]
  }
  const revisions = resourceIds.map(revisionOf)
  const catalogRevision =
    resourceIds.length && revisions.every(revision => revision !== undefined)
      ? await resourceApiCacheEpochFrom(revisions)
      : await catalogFingerprintOf(catalog)

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
 * Names what the cached routes answer for the same content. Bump it in the deployment that
 * changes what a cached route answers: a field added, removed or corrected, another order,
 * another rule. A deployment that changes no answer leaves it as it is, and keeps the cache.
 * Left as it is after an answer changed, the earlier answer is served until it expires, thirty
 * days for a read (ADR-0076, amended).
 */
export const RESOURCE_API_ANSWER_REVISION = 'answers-1'

/**
 * The namespace a response is cached under: the revision of the content it reads and the
 * revision of the answers, never the Worker version, so that a deployment keeps the cache.
 * It is spelled as the fallback namespace of earlier Workers was, whose entries it keeps.
 */
export const resourceApiCacheEpochFor = (
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
// and the revision of the answers. It is kept as long as a rarely read page needs.
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
  // A stored response carries no request ID: the caller's own is added to what it is sent.
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

export type ResourceApiCacheOperation = 'match' | 'put'

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

  const key = cacheRequest(request, cacheEpoch)
  const hit = await cache.match(key).catch(cause => {
    reportCacheFailure('match', cause)
    return undefined
  })
  if (hit) return responseForClient(hit, 'HIT', request, corsAllowedOrigins)

  const response = await load()
  if (response.status !== 200) {
    return responseForClient(response, undefined, request, corsAllowedOrigins)
  }
  waitUntil(
    cache.put(key, cacheableResponse(response.clone(), ttlSeconds)).catch(cause => {
      reportCacheFailure('put', cause)
    })
  )
  return responseForClient(response, 'MISS', request, corsAllowedOrigins)
}
