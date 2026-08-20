import { makeResourceWebHandler } from '../http/app'
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
  RESOURCE_API_CACHE_EPOCH,
  routeResourceApiRequest,
} from './resourceApiCache'
import { protectResourceRequest } from './resourceRequestProtection'

export const RESOURCE_API_PATH_PREFIX = '/v1/'
export { enforceResourceApiAppCheck, routeResourceApiRequest }

export const makeResourceWorkerHandler = (
  repository: BibleChapterRepositoryService,
  naveRepository?: NaveRepositoryService,
  dictionaryRepository?: DictionaryRepositoryService,
  strongBibleRepository?: StrongBibleRepositoryService,
  interlinearBibleRepository?: InterlinearBibleRepositoryService,
  strongLexiconRepository?: StrongLexiconRepositoryService,
  supplementaryRepository?: SupplementaryRepositoryService,
  timelineRepository?: TimelineRepositoryService,
  bibleSearchRepository?: BibleSearchRepositoryService
) =>
  makeResourceWebHandler(repository, naveRepository, {
    bibleSearch: bibleSearchRepository,
    dictionary: dictionaryRepository,
    strongBible: strongBibleRepository,
    interlinearBible: interlinearBibleRepository,
    strongLexicon: strongLexiconRepository,
    supplementary: supplementaryRepository,
    timeline: timelineRepository,
  })

export default {
  async fetch(request: Request, bindings: Env, ctx: ExecutionContext): Promise<Response> {
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
        search: bindings.SEARCH_RATE_LIMITER,
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

    return routeResourceApiRequest({
      request,
      authorize: async () => true,
      cache: edgeCache,
      cacheEpoch: await RESOURCE_API_CACHE_EPOCH,
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
        const database = makeHyperdriveDatabase(bindings.HYPERDRIVE.connectionString)
        const web = makeResourceWorkerHandler(
          makeKyselyBibleChapterRepository(database),
          makeKyselyNaveRepository(database),
          makeKyselyDictionaryRepository(database),
          makeKyselyStrongBibleRepository(database),
          makeKyselyInterlinearBibleRepository(database),
          makeKyselyStrongLexiconRepository(database),
          makeKyselySupplementaryRepository(database),
          makeKyselyTimelineRepository(database),
          makeKyselyBibleSearchRepository(database)
        )

        try {
          return await web.handler(request)
        } finally {
          await database.destroy()
        }
      },
    })
  },
} satisfies ExportedHandler<Env>
