// The library's Vectorize indexes from Node, through the REST API (amendment of 2026-11-12 to
// ADR-0103): the development server and the benches search the same indexes as the Worker's
// bindings, and the index runs keep them in step with Neon. CLOUDFLARE_API_TOKEN, or else the
// logged-in Wrangler session, renewed when it expires. Node only.
import type { LibraryVectorStore } from '../repositories/libraryVectorSync'
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

/**
 * Writes and lists the indexes: upserts as NDJSON (at most 5,000 vectors or 100 MB a request,
 * not compressed), deletions by at most 100 identifiers, listings by pages of 1,000.
 */
export function makeRestLibraryVectorStore(account: string): LibraryVectorStore {
  let bearer = process.env.CLOUDFLARE_API_TOKEN ?? wranglerToken()
  const call = async (
    language: LibraryLanguage,
    operation: string,
    init: { method: 'GET' | 'POST'; body?: string; contentType?: string; query?: string }
  ) => {
    for (let attempt = 1; ; attempt += 1) {
      let response: Response
      try {
        response = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${account}/vectorize/v2/indexes/${LIBRARY_VECTOR_INDEX_NAMES[language]}/${operation}${init.query ?? ''}`,
          {
            method: init.method,
            headers: {
              authorization: `Bearer ${bearer}`,
              ...(init.contentType ? { 'content-type': init.contentType } : {}),
            },
            body: init.body,
          }
        )
      } catch (error) {
        // A dropped connection, as seen during the first upload of 2026-11-12.
        if (attempt >= 5) throw error
        await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt))
        continue
      }
      if (response.ok) return ((await response.json()) as { result: unknown }).result
      const detail = (await response.text()).slice(0, 300)
      if (response.status === 401 && !process.env.CLOUDFLARE_API_TOKEN && attempt < 5) {
        bearer = wranglerToken()
        continue
      }
      if (![429, 500, 502, 503, 504].includes(response.status) || attempt >= 5)
        throw new Error(`LIBRARY_VECTORIZE_HTTP_${response.status} ${detail}`)
      await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt))
    }
  }
  return {
    async upsert(language, records) {
      if (!records.length) return
      await call(language, 'upsert', {
        method: 'POST',
        contentType: 'application/x-ndjson',
        body: records.map(record => JSON.stringify(record)).join('\n'),
      })
    },
    async delete(language, ids) {
      if (!ids.length) return
      await call(language, 'delete_by_ids', {
        method: 'POST',
        contentType: 'application/json',
        body: JSON.stringify({ ids }),
      })
    },
    async *listIds(language) {
      let cursor: string | undefined
      do {
        const page = (await call(language, 'list', {
          method: 'GET',
          query: `?count=1000${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
        })) as { vectors: { id: string }[]; isTruncated: boolean; nextCursor?: string | null }
        yield page.vectors.map(vector => vector.id)
        cursor = page.isTruncated ? (page.nextCursor ?? undefined) : undefined
      } while (cursor)
    },
  }
}
