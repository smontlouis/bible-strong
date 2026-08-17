import { makeResourceWebHandler } from '../http/app'
import type { BibleChapterRepositoryService } from '../domain/bibleChapter'
import type { NaveRepositoryService } from '../domain/nave'
import type { StrongBibleRepositoryService } from '../domain/strongBible'
import type { InterlinearBibleRepositoryService } from '../domain/interlinearBible'
import { makeNeonBibleChapterRepository } from '../repositories/bibleChapterRepository'
import { makeNeonNaveRepository } from '../repositories/naveRepository'
import { makeNeonStrongBibleRepository } from '../repositories/strongBibleRepository'
import { makeNeonInterlinearBibleRepository } from '../repositories/interlinearBibleRepository'

export type ResourceWorkerBindings = {
  RESOURCE_DATABASE_URL: string
}

export const makeResourceWorkerHandler = (
  repository: BibleChapterRepositoryService,
  naveRepository?: NaveRepositoryService,
  strongBibleRepository?: StrongBibleRepositoryService,
  interlinearBibleRepository?: InterlinearBibleRepositoryService
) =>
  makeResourceWebHandler(repository, naveRepository, {
    strongBible: strongBibleRepository,
    interlinearBible: interlinearBibleRepository,
  })

let cached:
  | {
      connectionString: string
      web: ReturnType<typeof makeResourceWebHandler>
    }
  | undefined

const getWorkerHandler = (connectionString: string) => {
  if (cached?.connectionString === connectionString) return cached.web
  const { repository } = makeNeonBibleChapterRepository({ connectionString })
  const { repository: naveRepository } = makeNeonNaveRepository({ connectionString })
  const { repository: strongBibleRepository } = makeNeonStrongBibleRepository({ connectionString })
  const { repository: interlinearBibleRepository } = makeNeonInterlinearBibleRepository({
    connectionString,
  })
  const web = makeResourceWorkerHandler(
    repository,
    naveRepository,
    strongBibleRepository,
    interlinearBibleRepository
  )
  cached = { connectionString, web }
  return web
}

export default {
  fetch(request: Request, bindings: ResourceWorkerBindings): Promise<Response> {
    return getWorkerHandler(bindings.RESOURCE_DATABASE_URL).handler(request)
  },
}
