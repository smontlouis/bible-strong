// Library embeddings from Node through the Workers AI REST API (ADR-0103): 0.2 to 0.7 s a query,
// against several seconds through `wrangler dev`. CLOUDFLARE_API_TOKEN, or else the logged-in
// Wrangler session, which this module renews when it expires. Node only: never in the Worker.
import { execFileSync } from 'node:child_process'

import { makeLibraryEmbeddingProvider } from './libraryEmbedding'

const wranglerToken = () =>
  execFileSync('npx', ['wrangler', 'auth', 'token'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
    .trim()
    .split('\n')
    .at(-1) ?? ''

export function makeRestLibraryEmbeddingProvider(
  account: string,
  options: { maxAttempts?: number } = {}
) {
  let bearer = process.env.CLOUDFLARE_API_TOKEN ?? wranglerToken()
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3)
  return makeLibraryEmbeddingProvider({
    async run(model, input) {
      for (let attempt = 1; ; attempt += 1) {
        let response: Response
        try {
          response = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`,
            {
              method: 'POST',
              headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' },
              body: JSON.stringify(input),
            }
          )
        } catch (error) {
          if (attempt >= maxAttempts) throw error
          await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt))
          continue
        }
        // The Wrangler session token expires within the hour.
        if (response.status === 401 && !process.env.CLOUDFLARE_API_TOKEN && attempt < maxAttempts) {
          await response.body?.cancel()
          bearer = wranglerToken()
          continue
        }
        if (response.ok) return ((await response.json()) as { result: unknown }).result
        if (![429, 500, 502, 503, 504].includes(response.status) || attempt >= maxAttempts)
          throw new Error(`LIBRARY_EMBEDDING_HTTP_${response.status}`)
        await response.body?.cancel()
        await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt))
      }
    },
  })
}
