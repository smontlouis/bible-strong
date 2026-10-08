// Every isolate evaluates this module and its static imports before its first request, cached
// answers and preflights included. Keep them free of Effect, the HTTP application and the
// database client: `resourceOrigin.ts` holds those and is imported when a request needs them
// (`workerStartupImports.node-test.ts` checks it).
import {
  makeResourcePreflightResponse,
  parseResourceCorsOrigins,
  withResourceCorsHeaders,
} from '../http/cors'
import { resourceRequestIdFrom } from '../http/requestId'
import { TOPIC_EMBEDDING_CONTRACT } from '../search/topicEmbedding'
import { routeR2ArtifactRequest } from './r2ArtifactDelivery'
import { createFirebaseAppCheckConfig, verifyFirebaseAppCheckRequest } from './firebaseAppCheck'
import {
  enforceResourceApiAppCheck,
  RESOURCE_API_CACHE_REVISION,
  resourceApiCacheEpochFor,
  resourceApiFallbackEpochFor,
  routeResourceApiRequest,
} from './resourceApiCache'
import { protectResourceOriginRead, protectResourceRequest } from './resourceRequestProtection'
import { resourceRequestClassFrom } from './resourceRoutePolicy'
import { makeMetadataOnlyAiGatewayOptions, writeSearchRuntimeEvent } from './searchRuntimeAnalytics'

// Local workerd reads every named export of this module as an entrypoint and refuses to start
// on one that is not a function: export nothing else from here.
export { enforceResourceApiAppCheck, routeResourceApiRequest }
const SEARCH_ANALYTICS_MAX_BODY_BYTES = 4_096

type ResourceOrigin = Pick<typeof import('./resourceOrigin'), 'readResourceOrigin'>

// `GET /health` only says that the Worker answers. It is answered here, with the response the
// HTTP application gives, so that a monitor does not make each new isolate load the
// application. Any other spelling of the route still goes to the application.
const HEALTH_BODY = '{"status":"ok"}'
export const makeResourceHealthResponse = (request: Request): Response | undefined => {
  if (request.method !== 'GET' || new URL(request.url).pathname !== '/health') return undefined
  return new Response(HEALTH_BODY, {
    headers: {
      'content-length': String(HEALTH_BODY.length),
      'content-type': 'application/json',
      'x-request-id': resourceRequestIdFrom(request.headers.get('x-request-id') ?? undefined),
    },
  })
}

// Requests served by this isolate. The request logged with 1 paid for the isolate's start.
let isolateRequests = 0

const analyticsEnabled = (bindings: Env) => bindings.SEARCH_ANALYTICS_ENABLED === 'true'

const runtimeRouteFrom = (request: Request): string => {
  const url = new URL(request.url)
  if (url.pathname === '/v1/search-events') return 'search-events'
  if (url.pathname === '/v1/bibles/semantic-search') return 'bible-semantic-search-many'
  if (/^\/v1\/bibles\/[^/]+\/semantic-search$/u.test(url.pathname))
    return 'bible-semantic-search-one'
  if (url.pathname === '/v1/bibles/search') return 'bible-search-many'
  if (/^\/v1\/bibles\/[^/]+\/search$/u.test(url.pathname)) return 'bible-search-one'
  if (url.pathname === '/v1/strong-lexicon/entries') return 'strong-search'
  if (/^\/v1\/dictionaries\/[^/]+\/entries$/u.test(url.pathname)) return 'dictionary-search'
  if (/^\/v1\/naves\/[^/]+\/topics$/u.test(url.pathname)) return 'nave-search'
  return resourceRequestClassFrom(request)
}

const writeRuntimeSafely = (
  bindings: Env,
  event: Parameters<typeof writeSearchRuntimeEvent>[1]
) => {
  if (!analyticsEnabled(bindings)) return
  try {
    writeSearchRuntimeEvent(bindings.SEARCH_RUNTIME_ANALYTICS, event)
  } catch (cause) {
    console.error(
      JSON.stringify({
        message: 'search runtime analytics write failed',
        event: event.event,
        error: cause instanceof Error ? cause.name : 'UnknownError',
      })
    )
  }
}

// Downloaded volume per client address, so a byte budget can be sized if abuse appears
// (ADR-0065). The address is hashed; logs are sampled.
const reportEncryptedArchiveDelivery = async (request: Request, response: Response) => {
  const address = request.headers.get('cf-connecting-ip') ?? 'unknown'
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(address))
  console.log(
    JSON.stringify({
      message: 'encrypted offline archive delivered',
      path: new URL(request.url).pathname,
      status: response.status,
      bytes: Number(response.headers.get('content-length') ?? 0),
      client: Array.from(new Uint8Array(digest).slice(0, 8), byte =>
        byte.toString(16).padStart(2, '0')
      ).join(''),
    })
  )
}

export const makeResourceWorker = (
  loadOrigin: () => Promise<ResourceOrigin> = () => import('./resourceOrigin')
) => ({
  async fetch(request: Request, bindings: Env, ctx: ExecutionContext): Promise<Response> {
    const isolateRequest = ++isolateRequests
    const corsAllowedOrigins = parseResourceCorsOrigins(bindings.RESOURCE_WEB_ORIGINS)
    const preflight = makeResourcePreflightResponse(request, corsAllowedOrigins)
    if (preflight) return preflight
    const respond = (response: Response) =>
      withResourceCorsHeaders(request, response, corsAllowedOrigins)
    const isSearchAnalyticsRequest = new URL(request.url).pathname === '/v1/search-events'
    const appCheckConfig = createFirebaseAppCheckConfig({
      projectNumber: bindings.FIREBASE_APP_CHECK_PROJECT_NUMBER,
      allowedAppIds: bindings.FIREBASE_APP_CHECK_ALLOWED_APP_IDS,
    })
    const authorize = (candidate: Request) =>
      verifyFirebaseAppCheckRequest(candidate, appCheckConfig)
    const reportLimited = (category: string, requestId: string) => {
      console.warn(
        JSON.stringify({
          message: 'resource request rate limited',
          category,
          requestId,
          path: new URL(request.url).pathname,
        })
      )
    }
    const reportLimiterFailure = (category: string, requestId: string, cause: unknown) => {
      console.error(
        JSON.stringify({
          message: 'resource rate limit binding failure',
          category,
          requestId,
          path: new URL(request.url).pathname,
          error: cause instanceof Error ? cause.message : String(cause),
        })
      )
    }
    const protectionFailure = await protectResourceRequest({
      request,
      authorize,
      limiters: {
        reading: bindings.READING_RATE_LIMITER,
        search: isSearchAnalyticsRequest
          ? bindings.SEARCH_ANALYTICS_RATE_LIMITER
          : bindings.SEARCH_RATE_LIMITER,
        'semantic-search': bindings.SEMANTIC_SEARCH_RATE_LIMITER,
        'encrypted-artifact': bindings.ENCRYPTED_ARCHIVE_RATE_LIMITER,
        artifact: bindings.ARTIFACT_RATE_LIMITER,
      },
      reportForbidden: (category, requestId, appId) => {
        console.warn(
          JSON.stringify({
            message: 'resource request forbidden for attested application',
            category,
            requestId,
            appId,
            path: new URL(request.url).pathname,
          })
        )
      },
      reportLimited,
      reportFailure: reportLimiterFailure,
    })
    if (protectionFailure) return respond(protectionFailure)

    if (isSearchAnalyticsRequest) {
      const declaredBodyBytes = Number(request.headers.get('content-length'))
      if (
        Number.isFinite(declaredBodyBytes) &&
        declaredBodyBytes > SEARCH_ANALYTICS_MAX_BODY_BYTES
      ) {
        return respond(
          new Response(null, {
            status: 413,
            headers: { 'cache-control': 'private, no-store' },
          })
        )
      }
      const body = await request.arrayBuffer()
      if (body.byteLength > SEARCH_ANALYTICS_MAX_BODY_BYTES) {
        return respond(
          new Response(null, {
            status: 413,
            headers: { 'cache-control': 'private, no-store' },
          })
        )
      }
      request = new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body,
      })
    }

    const edgeCache = await caches.open('bible-strong-resources-api')
    const artifactResponse = await routeR2ArtifactRequest({
      request,
      bucket: bindings.RESOURCE_ARTIFACTS,
      authorize: async () => true,
      cache: edgeCache,
      waitUntil: promise => ctx.waitUntil(promise),
      reportCacheFailure: (operation, cause) => {
        console.error(
          JSON.stringify({
            message: 'resource delivery edge cache failure',
            operation,
            path: new URL(request.url).pathname,
            error: cause instanceof Error ? cause.message : String(cause),
          })
        )
      },
    })
    if (artifactResponse) {
      if (resourceRequestClassFrom(request) === 'encrypted-artifact') {
        await reportEncryptedArchiveDelivery(request, artifactResponse)
      }
      return respond(artifactResponse)
    }

    const startedAt = Date.now()
    // Where a read of the database spent its time. The read of a request and the refresh
    // that follows a STALE answer each count their own.
    const newTimings = () => ({
      sqlStatements: 0,
      sqlMs: 0,
      databaseConnectMs: undefined as number | undefined,
    })
    const timings = newTimings()
    const readOrigin = async (originRequest: Request, spent: ReturnType<typeof newTimings>) => {
      const { readResourceOrigin } = await loadOrigin()
      return readResourceOrigin({
        request: originRequest,
        corsAllowedOrigins,
        hyperdriveConnectionString: bindings.HYPERDRIVE.connectionString,
        runTopicEmbedding: (model, input) =>
          bindings.AI.run(
            model,
            input,
            makeMetadataOnlyAiGatewayOptions({
              gatewayId: bindings.AI_GATEWAY_ID,
              environment: bindings.RESOURCE_ENVIRONMENT,
              contract: TOPIC_EMBEDDING_CONTRACT,
              enabled: analyticsEnabled(bindings),
            })
          ),
        searchProductAnalytics: bindings.SEARCH_PRODUCT_ANALYTICS,
        analyticsEnabled: analyticsEnabled(bindings),
        environment: bindings.RESOURCE_ENVIRONMENT,
        writeRuntimeEvent: event => writeRuntimeSafely(bindings, event),
        onSqlStatement: () => {
          spent.sqlStatements += 1
        },
        onSqlDuration: durationMs => {
          spent.sqlMs += durationMs
        },
        onDatabaseConnection: durationMs => {
          spent.databaseConnectMs = durationMs
        },
      })
    }
    const contentRevision =
      request.method === 'GET' ? await RESOURCE_API_CACHE_REVISION(request) : undefined
    let originRefusal: Response | undefined
    const response = await routeResourceApiRequest({
      request,
      authorize: async () => true,
      cache: edgeCache,
      cacheEpoch: contentRevision
        ? resourceApiCacheEpochFor(contentRevision, bindings.CF_VERSION_METADATA?.id)
        : 'uncached-request',
      fallback: contentRevision
        ? {
            epoch: resourceApiFallbackEpochFor(contentRevision),
            refresh: async unconditionalRequest => {
              const refreshStartedAt = Date.now()
              const spent = newTimings()
              // The caller was answered from the cache and is refused nothing, but this
              // read of the database is its doing: it counts against the limit that
              // protects the database. Over it nothing is read, and the fallback stays.
              const refusal = await protectResourceOriginRead({
                request,
                limiter: bindings.ORIGIN_READING_RATE_LIMITER,
                reportFailure: reportLimiterFailure,
              })
              const refreshed = refusal ?? (await readOrigin(unconditionalRequest, spent))
              console.log(
                JSON.stringify({
                  message: 'resource API fallback refresh',
                  requestClass: resourceRequestClassFrom(request),
                  path: new URL(request.url).pathname,
                  status: refreshed.status,
                  limited: refusal !== undefined,
                  stored: refreshed.status === 200,
                  ...spent,
                  durationMs: Date.now() - refreshStartedAt,
                  requestId: resourceRequestIdFrom(
                    request.headers.get('x-request-id') ?? undefined
                  ),
                })
              )
              return refreshed
            },
          }
        : undefined,
      corsAllowedOrigins,
      waitUntil: promise => ctx.waitUntil(promise),
      reportCacheFailure: (operation, cause) => {
        console.error(
          JSON.stringify({
            message: 'resource API edge cache failure',
            operation,
            path: new URL(request.url).pathname,
            error: cause instanceof Error ? cause.message : String(cause),
          })
        )
      },
      load: async () => {
        // The edge cache did not answer: this read opens the database, which has its own,
        // lower limit. A cached answer never gets here and is not counted against it.
        originRefusal = await protectResourceOriginRead({
          request,
          limiter: bindings.ORIGIN_READING_RATE_LIMITER,
          reportLimited,
          reportFailure: reportLimiterFailure,
        })
        if (originRefusal) return originRefusal
        const health = makeResourceHealthResponse(request)
        if (health) return health

        return readOrigin(request, timings)
      },
    })
    // A read refused here is answered and reported like one refused before the cache.
    if (originRefusal) return respond(response)
    const cacheStatus = response.headers.get('x-resource-cache') ?? 'BYPASS'
    // A STALE answer opened no database for its caller: its refresh is logged on its own.
    const originRead = request.method === 'GET' && cacheStatus !== 'HIT' && cacheStatus !== 'STALE'
    console.log(
      JSON.stringify({
        message: 'resource API request',
        requestClass: resourceRequestClassFrom(request),
        method: request.method,
        path: new URL(request.url).pathname,
        status: response.status,
        cache: cacheStatus,
        originRead,
        // Where an uncached read spent its time: opening its connection to Hyperdrive, then
        // its statements (the first one includes that opening). Durations only, never a
        // statement or a connection string.
        ...timings,
        durationMs: Date.now() - startedAt,
        requestId: response.headers.get('x-request-id'),
        isolateRequest,
      })
    )
    if (resourceRequestClassFrom(request) === 'search') {
      writeRuntimeSafely(bindings, {
        environment: bindings.RESOURCE_ENVIRONMENT,
        event: 'request',
        route: runtimeRouteFrom(request),
        status: String(response.status),
        cache: cacheStatus,
        durationMs: Date.now() - startedAt,
        sqlStatements: timings.sqlStatements,
        originRead,
        success: response.status < 500,
      })
    }
    return respond(response)
  },
})

export default makeResourceWorker() satisfies ExportedHandler<Env>
