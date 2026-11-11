// What the LibrarySearch entrypoint runs (ADR-0103), loaded on its first call so that the
// Worker starts without the database client and the search modules.
import { makeHyperdriveDatabase } from '../database/hyperdriveDatabase'
import { readLibraryDocument } from '../repositories/libraryDocumentRepository'
import { searchLibrary } from '../repositories/librarySearchRepository'
import {
  LIBRARY_EMBEDDING_CONTRACT,
  makeLibraryEmbeddingProvider,
  withQueryEmbeddingCache,
} from '../search/libraryEmbedding'
import { parseLibraryDocumentInput, parseLibrarySearchInput } from '../search/librarySearchInput'
import { makeMetadataOnlyAiGatewayOptions } from './searchRuntimeAnalytics'

export async function runLibrarySearch(bindings: Env, value: unknown) {
  const input = parseLibrarySearchInput(value)
  // Two connections: the search by words runs beside the search by meaning. A search by
  // perspective runs its lists on three more (a Worker request may open six).
  const database = makeHyperdriveDatabase(
    bindings.HYPERDRIVE.connectionString,
    undefined,
    input.perPerspective ? 5 : 2
  )
  try {
    const provider = withQueryEmbeddingCache(makeLibraryEmbeddingProvider({
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
    }))
    const started = Date.now()
    const result = await searchLibrary(database, provider, input)
    console.log(
      JSON.stringify({
        message: 'library search',
        hits: result.hits.length,
        ...(result.perspectiveHits ? { perspectiveHits: result.perspectiveHits.length } : {}),
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

export async function runLibraryRead(bindings: Env, value: unknown) {
  const input = parseLibraryDocumentInput(value)
  const database = makeHyperdriveDatabase(bindings.HYPERDRIVE.connectionString)
  try {
    const started = Date.now()
    const result = await readLibraryDocument(database, input)
    console.log(
      JSON.stringify({
        message: 'library read',
        collection: input.collection,
        found: Boolean(result),
        durationMs: Date.now() - started,
      })
    )
    return result
  } finally {
    await database.destroy()
  }
}
