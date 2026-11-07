// Serves the library search (ADR-0103) on 127.0.0.1 for the study assistant's bench and for
// manual checks: the same input and result as the LibrarySearch entrypoint, over the database of
// RESOURCE_DATABASE_URL (local by default) and the development embedding Worker.
//   yarn workspace @bible-strong/resource-service topics:embeddings:dev   # terminal 1
//   yarn workspace @bible-strong/resource-service library:search:dev      # terminal 2
//   curl -s localhost:8792/search -d '{"query":"le millénium","traditions":["Adventiste"]}'
// With CLOUDFLARE_ACCOUNT_ID, queries are embedded through the Workers AI REST API instead
// (0.2 to 0.7 s, against several seconds through `wrangler dev`), with CLOUDFLARE_API_TOKEN or
// the logged-in Wrangler session; terminal 1 is then not needed.
import { execFileSync } from 'node:child_process'
import { createServer } from 'node:http'

import { makeLocalDatabase } from '../database/localDatabase'
import { searchLibrary } from '../repositories/librarySearchRepository'
import { makeHttpLibraryEmbeddingProvider, makeLibraryEmbeddingProvider } from './libraryEmbedding'
import { parseLibrarySearchInput } from './librarySearchInput'

const port = Number(process.env.RESOURCE_LIBRARY_SEARCH_PORT ?? 8792)
const database = makeLocalDatabase({
  connectionString:
    process.env.RESOURCE_DATABASE_URL ??
    'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong',
  maxConnections: 4,
})
const wranglerToken = () =>
  execFileSync('npx', ['wrangler', 'auth', 'token'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
    .trim()
    .split('\n')
    .at(-1) ?? ''

const restProvider = (account: string) => {
  let bearer = process.env.CLOUDFLARE_API_TOKEN ?? wranglerToken()
  return makeLibraryEmbeddingProvider({
    async run(model, input) {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const response = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`,
          {
            method: 'POST',
            headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' },
            body: JSON.stringify(input),
          }
        )
        // The Wrangler session token expires within the hour.
        if (response.status === 401 && !process.env.CLOUDFLARE_API_TOKEN) {
          bearer = wranglerToken()
          continue
        }
        if (!response.ok) throw new Error(`LIBRARY_EMBEDDING_HTTP_${response.status}`)
        return ((await response.json()) as { result: unknown }).result
      }
      throw new Error('LIBRARY_EMBEDDING_UNAUTHORIZED')
    },
  })
}

const provider = process.env.CLOUDFLARE_ACCOUNT_ID
  ? restProvider(process.env.CLOUDFLARE_ACCOUNT_ID)
  : makeHttpLibraryEmbeddingProvider(
      process.env.RESOURCE_LIBRARY_EMBEDDING_URL ?? 'http://127.0.0.1:8791',
      { maxAttempts: 3 }
    )

const server = createServer(async (request, response) => {
  const answer = (status: number, body: unknown) => {
    response.writeHead(status, { 'content-type': 'application/json' })
    response.end(JSON.stringify(body))
  }
  if (request.method !== 'POST' || request.url !== '/search')
    return answer(404, { error: 'NOT_FOUND' })
  let text = ''
  for await (const chunk of request) {
    text += chunk
    if (text.length > 10_000) return answer(413, { error: 'TOO_LARGE' })
  }
  let input
  try {
    input = parseLibrarySearchInput(JSON.parse(text))
  } catch {
    return answer(400, { error: 'LIBRARY_SEARCH_INVALID_INPUT' })
  }
  try {
    answer(200, await searchLibrary(database, provider, input))
  } catch (error) {
    console.error(error)
    answer(500, { error: 'LIBRARY_SEARCH_FAILED' })
  }
})

server.listen(port, '127.0.0.1', () =>
  console.log(`Library search on http://127.0.0.1:${port}/search`)
)
