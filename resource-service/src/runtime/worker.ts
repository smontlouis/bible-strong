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
