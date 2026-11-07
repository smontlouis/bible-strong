// What the LibrarySearch entrypoint runs (ADR-0103), loaded on its first call so that the
// Worker starts without the database client and the search modules.
import { makeHyperdriveDatabase } from '../database/hyperdriveDatabase'
import { searchLibrary } from '../repositories/librarySearchRepository'
import {
  LIBRARY_EMBEDDING_CONTRACT,
  makeLibraryEmbeddingProvider,
} from '../search/libraryEmbedding'
import { parseLibrarySearchInput } from '../search/librarySearchInput'
import { makeMetadataOnlyAiGatewayOptions } from './searchRuntimeAnalytics'

export async function runLibrarySearch(bindings: Env, value: unknown) {
  const input = parseLibrarySearchInput(value)
  const database = makeHyperdriveDatabase(bindings.HYPERDRIVE.connectionString)
  try {
    const provider = makeLibraryEmbeddingProvider({
      run: (model, payload) =>
        bindings.AI.run(
          model,
          payload,
          makeMetadataOnlyAiGatewayOptions({
            gatewayId: bindings.AI_GATEWAY_ID,
            environment: bindings.RESOURCE_ENVIRONMENT,
            contract: LIBRARY_EMBEDDING_CONTRACT,
            enabled: bindings.SEARCH_ANALYTICS_ENABLED === 'true',
          })
        ),
    })
    const started = Date.now()
    const result = await searchLibrary(database, provider, input)
    console.log(
      JSON.stringify({
        message: 'library search',
        hits: result.hits.length,
        semantic: result.semantic,
        durationMs: Date.now() - started,
        ...result.timings,
      })
    )
    return result
  } finally {
    await database.destroy()
  }
}
