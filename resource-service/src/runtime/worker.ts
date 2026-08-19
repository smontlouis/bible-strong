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

export const RESOURCE_API_PATH_PREFIX = '/v1/'

export const enforceResourceApiAppCheck = async (
  request: Request,
  authorize: (request: Request) => Promise<boolean>
): Promise<Response | undefined> => {
  if (!new URL(request.url).pathname.startsWith(RESOURCE_API_PATH_PREFIX)) return undefined
  return (await authorize(request)) ? undefined : new Response(null, { status: 401 })
}

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
  async fetch(request: Request, bindings: Env): Promise<Response> {
    const appCheckConfig = createFirebaseAppCheckConfig({
      projectNumber: bindings.FIREBASE_APP_CHECK_PROJECT_NUMBER,
      allowedAppIds: bindings.FIREBASE_APP_CHECK_ALLOWED_APP_IDS,
    })
    const artifactResponse = await routeR2ArtifactRequest({
      request,
      bucket: bindings.RESOURCE_ARTIFACTS,
      authorize: candidate => verifyFirebaseAppCheckRequest(candidate, appCheckConfig),
    })
    if (artifactResponse) return artifactResponse

    const appCheckFailure = await enforceResourceApiAppCheck(request, candidate =>
      verifyFirebaseAppCheckRequest(candidate, appCheckConfig)
    )
    if (appCheckFailure) return appCheckFailure

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
} satisfies ExportedHandler<Env>
