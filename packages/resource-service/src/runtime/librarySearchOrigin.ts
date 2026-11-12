// What the LibrarySearch entrypoint runs (ADR-0103), loaded on its first call so that the
// Worker starts without the database client and the search modules.
import { makeHyperdriveDatabase } from '../database/hyperdriveDatabase'
import { readLibraryDocument } from '../repositories/libraryDocumentRepository'
import { searchLibrary } from '../repositories/librarySearchRepository'
import {
  LIBRARY_EMBEDDING_CONTRACT,
  makeLibraryEmbeddingProvider,
  withHedgedQueryEmbedding,
  withQueryEmbeddingCache,
  type QueryEmbeddingReport,
} from '../search/libraryEmbedding'
import { parseLibraryDocumentInput, parseLibrarySearchInput } from '../search/librarySearchInput'
import { makeVectorizeLibrarySearch } from '../search/libraryVectorIndex'
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
    // A late query vector is asked twice, and given up after 2 s for the words alone (amendment of
    // 2026-11-12 to ADR-0103). No report: the vector came from the isolate's cache.
    let embeddingReport: QueryEmbeddingReport | undefined
    const provider = withQueryEmbeddingCache(
      withHedgedQueryEmbedding(
        makeLibraryEmbeddingProvider({
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
        }),
        { onSettled: report => (embeddingReport = report) }
      )
    )
    // The nearest passages by meaning come from Vectorize or from Neon's HNSW index (amendment of
    // 2026-11-12 to ADR-0103); the rest of the search is the same.
    const vectorBackend = (bindings.LIBRARY_VECTOR_BACKEND as string) === 'vectorize' ? 'vectorize' : 'pgvector'
    const started = Date.now()
    const result = await searchLibrary(database, provider, input, {
      ...(vectorBackend === 'vectorize'
        ? {
            vectors: makeVectorizeLibrarySearch({
              fr: bindings.LIBRARY_VECTORS_FR,
              en: bindings.LIBRARY_VECTORS_EN,
            }),
          }
        : {}),
    })
    console.log(
      JSON.stringify({
        message: 'library search',
        vectorBackend,
        ...(embeddingReport ? { embeddingAttempts: embeddingReport.attempts, embeddingTimedOut: embeddingReport.timedOut } : {}),
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
