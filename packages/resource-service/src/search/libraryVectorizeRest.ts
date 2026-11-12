// The library's Vectorize indexes from Node, through the REST API (amendment of 2026-11-12 to
// ADR-0103): the development server and the benches search the same indexes as the Worker's
// bindings. CLOUDFLARE_API_TOKEN, or else the logged-in Wrangler session, renewed when it expires.
// Node only.
import type { LibraryLanguage } from './libraryDocuments'
import { wranglerToken } from './libraryEmbeddingRest'
import { LIBRARY_VECTOR_INDEX_NAMES, type LibraryVectorizeClient } from './libraryVectorIndex'

export function makeRestLibraryVectorizeClients(
  account: string
): Record<LibraryLanguage, LibraryVectorizeClient> {
  let bearer = process.env.CLOUDFLARE_API_TOKEN ?? wranglerToken()
  const client = (index: string): LibraryVectorizeClient => ({
    async query(vector, options) {
      for (let attempt = 1; ; attempt += 1) {
        const response = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${account}/vectorize/v2/indexes/${index}/query`,
          {
            method: 'POST',
            headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' },
            body: JSON.stringify({ vector, ...options }),
          }
        )
        if (response.ok)
          return ((await response.json()) as { result: Awaited<ReturnType<LibraryVectorizeClient['query']>> })
            .result
        const detail = (await response.text()).slice(0, 300)
        if (response.status === 401 && !process.env.CLOUDFLARE_API_TOKEN && attempt < 3) {
          bearer = wranglerToken()
          continue
        }
        if (![429, 500, 502, 503, 504].includes(response.status) || attempt >= 3)
          throw new Error(`LIBRARY_VECTORIZE_HTTP_${response.status} ${detail}`)
        await new Promise(resolve => setTimeout(resolve, 250 * 2 ** attempt))
      }
    },
  })
  return { fr: client(LIBRARY_VECTOR_INDEX_NAMES.fr), en: client(LIBRARY_VECTOR_INDEX_NAMES.en) }
}
