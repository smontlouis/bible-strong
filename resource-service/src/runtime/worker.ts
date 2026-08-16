import { makeResourceWebHandler } from '../http/app'
import type { BibleChapterRepositoryService } from '../domain/bibleChapter'
import type { NaveRepositoryService } from '../domain/nave'
import type { StrongBibleRepositoryService } from '../domain/strongBible'
import { makeNeonBibleChapterRepository } from '../repositories/bibleChapterRepository'
import { makeNeonNaveRepository } from '../repositories/naveRepository'
import { makeNeonStrongBibleRepository } from '../repositories/strongBibleRepository'

export type ResourceWorkerBindings = {
  RESOURCE_DATABASE_URL: string
}

export const makeResourceWorkerHandler = (
  repository: BibleChapterRepositoryService,
  naveRepository?: NaveRepositoryService,
  strongBibleRepository?: StrongBibleRepositoryService
) => makeResourceWebHandler(repository, naveRepository, { strongBible: strongBibleRepository })

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
  const web = makeResourceWorkerHandler(repository, naveRepository, strongBibleRepository)
  cached = { connectionString, web }
  return web
}

export default {
  fetch(request: Request, bindings: ResourceWorkerBindings): Promise<Response> {
    return getWorkerHandler(bindings.RESOURCE_DATABASE_URL).handler(request)
  },
}
