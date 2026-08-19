import { makeResourceWebHandler } from '../http/app'
import { parseResourceCorsOrigins } from '../http/cors'
import type { BibleChapterRepositoryService } from '../domain/bibleChapter'
import type { BibleSearchRepositoryService } from '../domain/bibleSearch'
import type { NaveRepositoryService } from '../domain/nave'
import type { DictionaryRepositoryService } from '../domain/dictionary'
import type { StrongBibleRepositoryService } from '../domain/strongBible'
import type { InterlinearBibleRepositoryService } from '../domain/interlinearBible'
import type { StrongLexiconRepositoryService } from '../domain/strongLexicon'
import type { SupplementaryRepositoryService } from '../domain/supplementary'
import type { TimelineRepositoryService } from '../domain/timeline'
import { makeNeonBibleChapterRepository } from '../repositories/bibleChapterRepository'
import { makeNeonBibleSearchRepository } from '../repositories/bibleSearchRepository'
import { makeNeonNaveRepository } from '../repositories/naveRepository'
import { makeNeonDictionaryRepository } from '../repositories/dictionaryRepository'
import { makeNeonStrongBibleRepository } from '../repositories/strongBibleRepository'
import { makeNeonInterlinearBibleRepository } from '../repositories/interlinearBibleRepository'
import { makeNeonStrongLexiconRepository } from '../repositories/strongLexiconRepository'
import { makeNeonSupplementaryRepository } from '../repositories/supplementaryRepository'
import { makeNeonTimelineRepository } from '../repositories/timelineRepository'

export type ResourceWorkerBindings = {
  RESOURCE_DATABASE_URL: string
  RESOURCE_WEB_ORIGINS?: string
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
  bibleSearchRepository?: BibleSearchRepositoryService,
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
    },
    { corsAllowedOrigins }
  )

let cached:
  | {
      connectionString: string
      corsOrigins: string
      web: ReturnType<typeof makeResourceWebHandler>
    }
  | undefined

const getWorkerHandler = (connectionString: string, corsOrigins: string) => {
  if (cached?.connectionString === connectionString && cached.corsOrigins === corsOrigins) {
    return cached.web
  }
  const { repository } = makeNeonBibleChapterRepository({ connectionString })
  const { repository: bibleSearchRepository } = makeNeonBibleSearchRepository({ connectionString })
  const { repository: naveRepository } = makeNeonNaveRepository({ connectionString })
  const { repository: dictionaryRepository } = makeNeonDictionaryRepository({ connectionString })
  const { repository: strongBibleRepository } = makeNeonStrongBibleRepository({ connectionString })
  const { repository: interlinearBibleRepository } = makeNeonInterlinearBibleRepository({
    connectionString,
  })
  const { repository: strongLexiconRepository } = makeNeonStrongLexiconRepository({
    connectionString,
  })
  const { repository: supplementaryRepository } = makeNeonSupplementaryRepository({
    connectionString,
  })
  const { repository: timelineRepository } = makeNeonTimelineRepository({ connectionString })
  const web = makeResourceWorkerHandler(
    repository,
    naveRepository,
    dictionaryRepository,
    strongBibleRepository,
    interlinearBibleRepository,
    strongLexiconRepository,
    supplementaryRepository,
    timelineRepository,
    bibleSearchRepository,
    parseResourceCorsOrigins(corsOrigins)
  )
  cached = { connectionString, corsOrigins, web }
  return web
}

export default {
  fetch(request: Request, bindings: ResourceWorkerBindings): Promise<Response> {
    return getWorkerHandler(
      bindings.RESOURCE_DATABASE_URL,
      bindings.RESOURCE_WEB_ORIGINS ?? ''
    ).handler(request)
  },
}
