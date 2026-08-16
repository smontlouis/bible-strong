import { makeResourceWebHandler } from '../http/app'
import type { BibleChapterRepositoryService } from '../domain/bibleChapter'
import { makeNeonBibleChapterRepository } from '../repositories/bibleChapterRepository'

export type ResourceWorkerBindings = {
  RESOURCE_DATABASE_URL: string
}

export const makeResourceWorkerHandler = (repository: BibleChapterRepositoryService) =>
  makeResourceWebHandler(repository)

let cached:
  | {
      connectionString: string
      web: ReturnType<typeof makeResourceWebHandler>
    }
  | undefined

const getWorkerHandler = (connectionString: string) => {
  if (cached?.connectionString === connectionString) return cached.web
  const { repository } = makeNeonBibleChapterRepository({ connectionString })
  const web = makeResourceWorkerHandler(repository)
  cached = { connectionString, web }
  return web
}

export default {
  fetch(request: Request, bindings: ResourceWorkerBindings): Promise<Response> {
    return getWorkerHandler(bindings.RESOURCE_DATABASE_URL).handler(request)
  },
}
