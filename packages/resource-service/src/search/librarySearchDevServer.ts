// Serves the library search (ADR-0103) on 127.0.0.1 for the study assistant's bench and for
// manual checks: the same input and result as the LibrarySearch entrypoint, over the database of
// RESOURCE_DATABASE_URL (local by default) and the development embedding Worker.
//   yarn workspace @bible-strong/resource-service topics:embeddings:dev   # terminal 1
//   yarn workspace @bible-strong/resource-service library:search:dev      # terminal 2
//   curl -s localhost:8792/search -d '{"query":"le millénium","traditions":["Réformé"]}'
//   curl -s localhost:8792/read -d '{"collection":"<collection>","language":"en","documentKey":"<key>"}'
// With CLOUDFLARE_ACCOUNT_ID, queries are embedded through the Workers AI REST API instead
// (0.2 to 0.7 s, against several seconds through `wrangler dev`), with CLOUDFLARE_API_TOKEN or
// the logged-in Wrangler session; terminal 1 is then not needed.
// With RESOURCE_LIBRARY_VECTOR_BACKEND=vectorize as well, the nearest passages by meaning come from
// the production Vectorize indexes through their REST API, as the Worker's bindings read them;
// RESOURCE_LIBRARY_VECTORIZE_PRECISE=off keeps Vectorize's compressed scores.
import { createServer } from 'node:http'

import { makeLocalDatabase } from '../database/localDatabase'
import { readLibraryDocument } from '../repositories/libraryDocumentRepository'
import { searchLibrary } from '../repositories/librarySearchRepository'
import { makeHttpLibraryEmbeddingProvider, withHedgedQueryEmbedding, withQueryEmbeddingCache } from './libraryEmbedding'
import { makeRestLibraryEmbeddingProvider } from './libraryEmbeddingRest'
import { makeVectorizeLibrarySearch } from './libraryVectorIndex'
import { makeRestLibraryVectorizeClients } from './libraryVectorizeRest'
import { parseLibraryDocumentInput, parseLibrarySearchInput } from './librarySearchInput'

const port = Number(process.env.RESOURCE_LIBRARY_SEARCH_PORT ?? 8792)
const database = makeLocalDatabase({
  connectionString:
    process.env.RESOURCE_DATABASE_URL ??
    'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong',
  // As many as the Worker opens for a search by perspective, with room for the lexical one.
  maxConnections: 6,
})
// A late query vector is asked twice, as in the Worker. A bench measures answers, not speed: from a
// laptop the vector is given 10 s before the words alone serve (RESOURCE_LIBRARY_EMBEDDING_TIMEOUT_MS).
const provider = withQueryEmbeddingCache(
  withHedgedQueryEmbedding(
    process.env.CLOUDFLARE_ACCOUNT_ID
      ? makeRestLibraryEmbeddingProvider(process.env.CLOUDFLARE_ACCOUNT_ID)
      : makeHttpLibraryEmbeddingProvider(
          process.env.RESOURCE_LIBRARY_EMBEDDING_URL ?? 'http://127.0.0.1:8791',
          { maxAttempts: 3 }
        ),
    { timeoutMs: Number(process.env.RESOURCE_LIBRARY_EMBEDDING_TIMEOUT_MS ?? 10_000) }
  )
)

if (process.env.RESOURCE_LIBRARY_VECTOR_BACKEND === 'vectorize' && !process.env.CLOUDFLARE_ACCOUNT_ID)
  throw new Error('RESOURCE_LIBRARY_VECTOR_BACKEND=vectorize needs CLOUDFLARE_ACCOUNT_ID')
const vectors =
  process.env.RESOURCE_LIBRARY_VECTOR_BACKEND === 'vectorize'
    ? makeVectorizeLibrarySearch(makeRestLibraryVectorizeClients(process.env.CLOUDFLARE_ACCOUNT_ID!), {
        precise: process.env.RESOURCE_LIBRARY_VECTORIZE_PRECISE !== 'off',
      })
    : undefined

const server = createServer(async (request, response) => {
  const answer = (status: number, body: unknown) => {
    response.writeHead(status, { 'content-type': 'application/json' })
    response.end(JSON.stringify(body))
  }
  if (request.method !== 'POST' || (request.url !== '/search' && request.url !== '/read'))
    return answer(404, { error: 'NOT_FOUND' })
  let text = ''
  for await (const chunk of request) {
    text += chunk
    if (text.length > 10_000) return answer(413, { error: 'TOO_LARGE' })
  }
  try {
    if (request.url === '/read') {
      let input
      try {
        input = parseLibraryDocumentInput(JSON.parse(text))
      } catch {
        return answer(400, { error: 'LIBRARY_DOCUMENT_INVALID_INPUT' })
      }
      return answer(200, await readLibraryDocument(database, input))
    }
    let input
    try {
      input = parseLibrarySearchInput(JSON.parse(text))
    } catch {
      return answer(400, { error: 'LIBRARY_SEARCH_INVALID_INPUT' })
    }
    answer(200, await searchLibrary(database, provider, input, { vectors }))
  } catch (error) {
    console.error(error)
    answer(500, { error: 'LIBRARY_SEARCH_FAILED' })
  }
})

server.listen(port, '127.0.0.1', () =>
  console.log(`Library search on http://127.0.0.1:${port}/search`)
)
