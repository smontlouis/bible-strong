import { makeResourceWebHandler } from '../http/app'
import type { BibleChapterRepositoryService } from '../domain/bibleChapter'
import type { NaveRepositoryService } from '../domain/nave'
import type { DictionaryRepositoryService } from '../domain/dictionary'
import type { StrongBibleRepositoryService } from '../domain/strongBible'
import type { InterlinearBibleRepositoryService } from '../domain/interlinearBible'
import type { StrongLexiconRepositoryService } from '../domain/strongLexicon'
import type { SupplementaryRepositoryService } from '../domain/supplementary'
import { makeNeonBibleChapterRepository } from '../repositories/bibleChapterRepository'
import { makeNeonNaveRepository } from '../repositories/naveRepository'
import { makeNeonDictionaryRepository } from '../repositories/dictionaryRepository'
import { makeNeonStrongBibleRepository } from '../repositories/strongBibleRepository'
import { makeNeonInterlinearBibleRepository } from '../repositories/interlinearBibleRepository'
import { makeNeonStrongLexiconRepository } from '../repositories/strongLexiconRepository'
import { makeNeonSupplementaryRepository } from '../repositories/supplementaryRepository'

export type ResourceWorkerBindings = {
  RESOURCE_DATABASE_URL: string
}

export const makeResourceWorkerHandler = (
  repository: BibleChapterRepositoryService,
  naveRepository?: NaveRepositoryService,
  dictionaryRepository?: DictionaryRepositoryService,
  strongBibleRepository?: StrongBibleRepositoryService,
  interlinearBibleRepository?: InterlinearBibleRepositoryService,
  strongLexiconRepository?: StrongLexiconRepositoryService,
  supplementaryRepository?: SupplementaryRepositoryService
) =>
  makeResourceWebHandler(repository, naveRepository, {
    dictionary: dictionaryRepository,
    strongBible: strongBibleRepository,
    interlinearBible: interlinearBibleRepository,
    strongLexicon: strongLexiconRepository,
    supplementary: supplementaryRepository,
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
  const web = makeResourceWorkerHandler(
    repository,
    naveRepository,
    dictionaryRepository,
    strongBibleRepository,
    interlinearBibleRepository,
    strongLexiconRepository,
    supplementaryRepository
  )
  cached = { connectionString, web }
  return web
}

export default {
  fetch(request: Request, bindings: ResourceWorkerBindings): Promise<Response> {
    return getWorkerHandler(bindings.RESOURCE_DATABASE_URL).handler(request)
  },
}
