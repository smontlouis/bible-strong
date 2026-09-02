import { makeResourceWebHandler } from '../http/app'
import { makeResourcePreflightResponse, parseResourceCorsOrigins } from '../http/cors'
import type { BibleChapterRepositoryService } from '../domain/bibleChapter'
import type { BibleSearchRepositoryService } from '../domain/bibleSearch'
import type { NaveRepositoryService } from '../domain/nave'
import type { DictionaryRepositoryService } from '../domain/dictionary'
import type { StrongBibleRepositoryService } from '../domain/strongBible'
import type { InterlinearBibleRepositoryService } from '../domain/interlinearBible'
import type { StrongLexiconRepositoryService } from '../domain/strongLexicon'
import type { SupplementaryRepositoryService } from '../domain/supplementary'
import type { TimelineRepositoryService } from '../domain/timeline'
import { makeHyperdriveDatabase } from '../database/hyperdriveDatabase'
import { makeKyselyBibleChapterRepository } from '../repositories/bibleChapterRepository'
import { makeKyselyBibleSearchRepository } from '../repositories/bibleSearchRepository'
import { makeKyselyNaveRepository } from '../repositories/naveRepository'
import { makeKyselyDictionaryRepository } from '../repositories/dictionaryRepository'
import { makeKyselyStrongBibleRepository } from '../repositories/strongBibleRepository'
import { makeKyselyInterlinearBibleRepository } from '../repositories/interlinearBibleRepository'
import { makeKyselyStrongLexiconRepository } from '../repositories/strongLexiconRepository'
import { makeKyselySupplementaryRepository } from '../repositories/supplementaryRepository'
import { makeKyselyTimelineRepository } from '../repositories/timelineRepository'
import { routeR2ArtifactRequest } from './r2ArtifactDelivery'
import { createFirebaseAppCheckConfig, verifyFirebaseAppCheckRequest } from './firebaseAppCheck'
import {
  enforceResourceApiAppCheck,
  RESOURCE_API_CACHE_REVISION,
  routeResourceApiRequest,
} from './resourceApiCache'
import { protectResourceRequest } from './resourceRequestProtection'
import { resourceRequestClassFrom } from './resourceRoutePolicy'
import {
  makeWorkersAiTopicEmbeddingProvider,
  TOPIC_EMBEDDING_CONTRACT,
} from '../search/topicEmbedding'
import type { SearchAnalyticsSinkService } from '../domain/searchAnalytics'
import {
  makeAnalyticsEngineSearchSink,
  makeMetadataOnlyAiGatewayOptions,
  writeSearchRuntimeEvent,
} from './searchAnalyticsEngine'

export const RESOURCE_API_PATH_PREFIX = '/v1/'
export { enforceResourceApiAppCheck, routeResourceApiRequest }
const SEARCH_ANALYTICS_MAX_BODY_BYTES = 4_096

export const makeResourceWorkerHandler = (
  repository: BibleChapterRepositoryService,
  naveRepository?: NaveRepositoryService,
  dictionaryRepository?: DictionaryRepositoryService,
  strongBibleRepository?: StrongBibleRepositoryService,
  interlinearBibleRepository?: InterlinearBibleRepositoryService,
  strongLexiconRepository?: StrongLexiconRepositoryService,
  supplementaryRepository?: SupplementaryRepositoryService,
  timelineRepository?: TimelineRepositoryService,
  bibleSearchRepository?: BibleSearchRepositoryService,
  searchAnalytics?: SearchAnalyticsSinkService,
  corsAllowedOrigins: readonly string[] = []
) =>
  makeResourceWebHandler(
    repository,
    naveRepository,
    {
      bibleSearch: bibleSearchRepository,
      dictionary: dictionaryRepository,
      strongBible: strongBibleRepository,
      interlinearBible: interlinearBibleRepository,
      strongLexicon: strongLexiconRepository,
      supplementary: supplementaryRepository,
      timeline: timelineRepository,
      searchAnalytics,
    },
    { corsAllowedOrigins }
  )

const analyticsEnabled = (bindings: Env) => bindings.SEARCH_ANALYTICS_ENABLED === 'true'

const runtimeRouteFrom = (request: Request): string => {
  const url = new URL(request.url)
  if (url.pathname === '/v1/search-events') return 'search-events'
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

export default {
  async fetch(request: Request, bindings: Env, ctx: ExecutionContext): Promise<Response> {
    const corsAllowedOrigins = parseResourceCorsOrigins(bindings.RESOURCE_WEB_ORIGINS)
    const preflight = makeResourcePreflightResponse(request, corsAllowedOrigins)
    if (preflight) return preflight
    const isSearchAnalyticsRequest = new URL(request.url).pathname === '/v1/search-events'
    const appCheckConfig = createFirebaseAppCheckConfig({
      projectNumber: bindings.FIREBASE_APP_CHECK_PROJECT_NUMBER,
      allowedAppIds: bindings.FIREBASE_APP_CHECK_ALLOWED_APP_IDS,
    })
    const authorize = (candidate: Request) =>
      verifyFirebaseAppCheckRequest(candidate, appCheckConfig)
    const protectionFailure = await protectResourceRequest({
      request,
      authorize,
      limiters: {
        reading: bindings.READING_RATE_LIMITER,
        search: isSearchAnalyticsRequest
          ? bindings.SEARCH_ANALYTICS_RATE_LIMITER
          : bindings.SEARCH_RATE_LIMITER,
        artifact: bindings.ARTIFACT_RATE_LIMITER,
      },
      reportLimited: (category, requestId) => {
        console.warn(
          JSON.stringify({
            message: 'resource request rate limited',
            category,
            requestId,
            path: new URL(request.url).pathname,
          })
        )
      },
      reportFailure: (category, requestId, cause) => {
        console.error(
          JSON.stringify({
            message: 'resource rate limit binding failure',
            category,
            requestId,
            path: new URL(request.url).pathname,
            error: cause instanceof Error ? cause.message : String(cause),
          })
        )
      },
    })
    if (protectionFailure) return protectionFailure

    if (isSearchAnalyticsRequest) {
      const declaredBodyBytes = Number(request.headers.get('content-length'))
      if (
        Number.isFinite(declaredBodyBytes) &&
        declaredBodyBytes > SEARCH_ANALYTICS_MAX_BODY_BYTES
      ) {
        return new Response(null, {
          status: 413,
          headers: { 'cache-control': 'private, no-store' },
        })
      }
      const body = await request.arrayBuffer()
      if (body.byteLength > SEARCH_ANALYTICS_MAX_BODY_BYTES) {
        return new Response(null, {
          status: 413,
          headers: { 'cache-control': 'private, no-store' },
        })
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
    if (artifactResponse) return artifactResponse

    const startedAt = Date.now()
    let sqlStatements = 0
    const searchAnalytics = makeAnalyticsEngineSearchSink({
      dataset: bindings.SEARCH_PRODUCT_ANALYTICS,
      enabled: analyticsEnabled(bindings),
      environment: bindings.RESOURCE_ENVIRONMENT,
      reportFailure: cause =>
        console.error(
          JSON.stringify({
            message: 'search product analytics write failed',
            error: cause instanceof Error ? cause.name : 'UnknownError',
          })
        ),
    })
    const response = await routeResourceApiRequest({
      request,
      authorize: async () => true,
      cache: edgeCache,
      cacheEpoch:
        request.method === 'GET' ? await RESOURCE_API_CACHE_REVISION(request) : 'uncached-request',
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
        if (isSearchAnalyticsRequest) {
          const analyticsWeb = makeResourceWebHandler(
            undefined,
            undefined,
            { searchAnalytics },
            { corsAllowedOrigins }
          )
          try {
            return await analyticsWeb.handler(request)
          } finally {
            await analyticsWeb.dispose()
          }
        }

        const database = makeHyperdriveDatabase(bindings.HYPERDRIVE.connectionString).withPlugin({
          transformQuery(args) {
            sqlStatements += 1
            return args.node
          },
          async transformResult(args) {
            return args.result
          },
        })
        const topicEmbeddingProvider = makeWorkersAiTopicEmbeddingProvider({
          run: async (model, input) => {
            const embeddingStartedAt = Date.now()
            try {
              const output = await bindings.AI.run(
                model,
                input,
                makeMetadataOnlyAiGatewayOptions({
                  gatewayId: bindings.AI_GATEWAY_ID,
                  environment: bindings.RESOURCE_ENVIRONMENT,
                  contract: TOPIC_EMBEDDING_CONTRACT,
                  enabled: analyticsEnabled(bindings),
                })
              )
              writeRuntimeSafely(bindings, {
                environment: bindings.RESOURCE_ENVIRONMENT,
                event: 'embedding',
                route: 'topic-query-embedding',
                model,
                contract: TOPIC_EMBEDDING_CONTRACT,
                durationMs: Date.now() - embeddingStartedAt,
              })
              return output
            } catch (cause) {
              writeRuntimeSafely(bindings, {
                environment: bindings.RESOURCE_ENVIRONMENT,
                event: 'embedding',
                route: 'topic-query-embedding',
                model,
                contract: TOPIC_EMBEDDING_CONTRACT,
                errorClass: cause instanceof Error ? cause.name : 'UnknownError',
                durationMs: Date.now() - embeddingStartedAt,
                success: false,
              })
              throw cause
            }
          },
        })
        const web = makeResourceWorkerHandler(
          makeKyselyBibleChapterRepository(database),
          makeKyselyNaveRepository(database),
          makeKyselyDictionaryRepository(database),
          makeKyselyStrongBibleRepository(database),
          makeKyselyInterlinearBibleRepository(database),
          makeKyselyStrongLexiconRepository(database),
          makeKyselySupplementaryRepository(database),
          makeKyselyTimelineRepository(database),
          makeKyselyBibleSearchRepository(database, {
            embeddingProvider: topicEmbeddingProvider,
            reportEmbeddingFailure: cause =>
              console.error(
                JSON.stringify({
                  message: 'topic embedding unavailable; semantic search skipped',
                  model: topicEmbeddingProvider.model,
                  errorClass: cause instanceof Error ? cause.name : 'UnknownError',
                })
              ),
          }),
          searchAnalytics,
          corsAllowedOrigins
        )

        try {
          return await web.handler(request)
        } finally {
          await database.destroy()
        }
      },
    })
    console.log(
      JSON.stringify({
        message: 'resource API request',
        requestClass: resourceRequestClassFrom(request),
        method: request.method,
        path: new URL(request.url).pathname,
        status: response.status,
        cache: response.headers.get('x-resource-cache') ?? 'BYPASS',
        originRead: request.method === 'GET' && response.headers.get('x-resource-cache') !== 'HIT',
        sqlStatements,
        durationMs: Date.now() - startedAt,
        requestId: response.headers.get('x-request-id'),
      })
    )
    if (resourceRequestClassFrom(request) === 'search') {
      writeRuntimeSafely(bindings, {
        environment: bindings.RESOURCE_ENVIRONMENT,
        event: 'request',
        route: runtimeRouteFrom(request),
        status: String(response.status),
        cache: response.headers.get('x-resource-cache') ?? 'BYPASS',
        durationMs: Date.now() - startedAt,
        sqlStatements,
        originRead: request.method === 'GET' && response.headers.get('x-resource-cache') !== 'HIT',
        success: response.status < 500,
      })
    }
    return response
  },
} satisfies ExportedHandler<Env>
