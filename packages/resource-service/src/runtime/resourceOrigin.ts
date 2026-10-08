// Everything a read needs once the edge cache has not answered it: the HTTP application
// (Effect), the database client and the repositories, search included. The Worker imports
// this module dynamically, on the first request of an isolate that reaches the database, so
// an isolate that only serves cached answers never evaluates it.
import {
  makeResourceRequestServices,
  makeSharedResourceWebHandler,
  type ResourceRequestServices,
} from '../http/app'
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
import {
  makeWorkersAiTopicEmbeddingProvider,
  TOPIC_EMBEDDING_CONTRACT,
  type WorkersAiBinding,
} from '../search/topicEmbedding'
import { makeAnalyticsEngineSearchSink } from './searchAnalyticsEngine'
import type { SearchAnalyticsDataset, writeSearchRuntimeEvent } from './searchRuntimeAnalytics'

// Building the HTTP application takes about 11 ms of CPU, fifty times what answering a
// request does, and an isolate serves nothing else meanwhile: under concurrent uncached
// reads Cloudflare then starts more isolates. So each isolate builds it once. Nothing that
// belongs to a request is in it: repositories and their database handle come with each
// request (`resourceRequestServicesFor`).
let application:
  { origins: string; web: ReturnType<typeof makeSharedResourceWebHandler> } | undefined

export const resourceApplicationFor = (corsAllowedOrigins: readonly string[]) => {
  // The allowed origins come from a binding and do not change while an isolate lives.
  const origins = corsAllowedOrigins.join(',')
  if (application?.origins !== origins) {
    application = { origins, web: makeSharedResourceWebHandler({ corsAllowedOrigins }) }
  }
  return application.web
}

export type ResourceOriginRead = {
  request: Request
  corsAllowedOrigins: readonly string[]
  hyperdriveConnectionString: string
  /** Calls Workers AI; the Worker adds its gateway options. */
  runTopicEmbedding: WorkersAiBinding['run']
  searchProductAnalytics: SearchAnalyticsDataset
  analyticsEnabled: boolean
  environment: string
  writeRuntimeEvent: (event: Parameters<typeof writeSearchRuntimeEvent>[1]) => void
  /** Called once per SQL statement, for the request log. */
  onSqlStatement: () => void
  /** Time one SQL statement took, the wait for its connection included. */
  onSqlDuration?: (durationMs: number) => void
  /** Time the connection to Hyperdrive took to open, when the request opened one. */
  onDatabaseConnection?: (durationMs: number) => void
}

/**
 * The repositories of one request and the database handle they share. Whoever asks for them
 * closes the database when the request is answered.
 */
export const resourceRequestServicesFor = ({
  request,
  hyperdriveConnectionString,
  runTopicEmbedding,
  searchProductAnalytics,
  analyticsEnabled,
  environment,
  writeRuntimeEvent,
  onSqlStatement,
  onSqlDuration = () => undefined,
  onDatabaseConnection,
}: Omit<ResourceOriginRead, 'corsAllowedOrigins'>): {
  services: ResourceRequestServices
  close: () => Promise<void>
} => {
  const searchAnalytics = makeAnalyticsEngineSearchSink({
    dataset: searchProductAnalytics,
    enabled: analyticsEnabled,
    environment,
    reportFailure: cause =>
      console.error(
        JSON.stringify({
          message: 'search product analytics write failed',
          error: cause instanceof Error ? cause.name : 'UnknownError',
        })
      ),
  })
  // Search events are only recorded: they open no database.
  if (new URL(request.url).pathname === '/v1/search-events') {
    return {
      services: makeResourceRequestServices(undefined, undefined, { searchAnalytics }),
      close: async () => undefined,
    }
  }

  const statementStarts = new WeakMap<object, number>()
  const database = makeHyperdriveDatabase(
    hyperdriveConnectionString,
    onDatabaseConnection
  ).withPlugin({
    transformQuery(args) {
      onSqlStatement()
      statementStarts.set(args.queryId, Date.now())
      return args.node
    },
    async transformResult(args) {
      const startedAt = statementStarts.get(args.queryId)
      if (startedAt !== undefined) onSqlDuration(Date.now() - startedAt)
      return args.result
    },
  })
  const topicEmbeddingProvider = makeWorkersAiTopicEmbeddingProvider({
    run: async (model, input) => {
      const embeddingStartedAt = Date.now()
      try {
        const output = await runTopicEmbedding(model, input)
        writeRuntimeEvent({
          environment,
          event: 'embedding',
          route: 'topic-query-embedding',
          model,
          contract: TOPIC_EMBEDDING_CONTRACT,
          durationMs: Date.now() - embeddingStartedAt,
        })
        return output
      } catch (cause) {
        writeRuntimeEvent({
          environment,
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
  return {
    services: makeResourceRequestServices(
      makeKyselyBibleChapterRepository(database),
      makeKyselyNaveRepository(database),
      {
        dictionary: makeKyselyDictionaryRepository(database),
        strongBible: makeKyselyStrongBibleRepository(database),
        interlinearBible: makeKyselyInterlinearBibleRepository(database),
        strongLexicon: makeKyselyStrongLexiconRepository(database),
        supplementary: makeKyselySupplementaryRepository(database),
        timeline: makeKyselyTimelineRepository(database),
        bibleSearch: makeKyselyBibleSearchRepository(database, {
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
      }
    ),
    close: () => database.destroy(),
  }
}

export const readResourceOrigin = async ({
  corsAllowedOrigins,
  ...read
}: ResourceOriginRead): Promise<Response> => {
  const { services, close } = resourceRequestServicesFor(read)
  try {
    return await resourceApplicationFor(corsAllowedOrigins).handler(read.request, services)
  } finally {
    await close()
  }
}
