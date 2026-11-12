// The vector space of the library search index (ADR-0103). Same model as the thematic search
// (Qwen3-Embedding, multilingual, 1,024 dimensions), its own contract: documents are passages
// with a heading, queries carry a retrieval instruction. Changing either means a full rebuild.

export const LIBRARY_EMBEDDING_MODEL = '@cf/qwen/qwen3-embedding-0.6b'
export const LIBRARY_EMBEDDING_DIMENSIONS = 1024
export const LIBRARY_EMBEDDING_CONTRACT = 'library-qwen3-v1'
export const LIBRARY_QUERY_INSTRUCTION =
  'Given a Bible study question in French, English or Spanish, retrieve passages of commentaries, dictionaries, topical indexes, people profiles or timeline events that help answer it.'

export type LibraryEmbeddingProvider = {
  readonly model: typeof LIBRARY_EMBEDDING_MODEL
  readonly contract: typeof LIBRARY_EMBEDDING_CONTRACT
  embedDocuments(texts: readonly string[]): Promise<number[][]>
  embedQuery(text: string): Promise<number[]>
}

export type LibraryEmbeddingBinding = {
  run(model: typeof LIBRARY_EMBEDDING_MODEL, input: { text: string[] }): Promise<unknown>
}

/** The text that is embedded for a passage: its heading, then its content. */
export const libraryEmbeddingDocument = (heading: string, content: string) =>
  `${heading}\n${content}`

export const libraryEmbeddingQuery = (query: string) =>
  `Instruct: ${LIBRARY_QUERY_INSTRUCTION}\nQuery: ${query.replace(/\s+/gu, ' ').trim()}`

const readVectors = (value: unknown, expectedCount: number): number[][] => {
  const data = (value as { data?: unknown })?.data
  if (
    !Array.isArray(data) ||
    data.length !== expectedCount ||
    data.some(
      vector =>
        !Array.isArray(vector) ||
        vector.length !== LIBRARY_EMBEDDING_DIMENSIONS ||
        vector.some(component => typeof component !== 'number' || !Number.isFinite(component))
    )
  )
    throw new Error('LIBRARY_EMBEDDING_INVALID_RESPONSE')
  return data as number[][]
}

export const makeLibraryEmbeddingProvider = (
  binding: LibraryEmbeddingBinding
): LibraryEmbeddingProvider => ({
  model: LIBRARY_EMBEDDING_MODEL,
  contract: LIBRARY_EMBEDDING_CONTRACT,
  async embedDocuments(texts) {
    if (texts.length === 0) return []
    return readVectors(
      await binding.run(LIBRARY_EMBEDDING_MODEL, { text: [...texts] }),
      texts.length
    )
  },
  async embedQuery(text) {
    const [vector] = readVectors(
      await binding.run(LIBRARY_EMBEDDING_MODEL, { text: [libraryEmbeddingQuery(text)] }),
      1
    )
    return vector
  },
})

/** pgvector literal for a halfvec or vector parameter. */
export const vectorLiteral = (vector: readonly number[]) => `[${vector.join(',')}]`

/**
 * For the index command: the development embedding Worker (`topics:embeddings:dev`, remote
 * Workers AI) answers at this endpoint. Capacity and transient errors are retried.
 */
export const makeHttpLibraryEmbeddingProvider = (
  endpoint: string,
  /**
   * maxAttempts bounds retries of an unreachable endpoint (a restarting `wrangler dev`);
   * maxStatusAttempts those of a 429 or 5xx answer, which may come from the content itself.
   */
  options: { maxAttempts?: number; maxStatusAttempts?: number } = {}
): LibraryEmbeddingProvider =>
  makeLibraryEmbeddingProvider({
    async run(model, input) {
      const body = JSON.stringify({ ...input, model })
      const maxAttempts = Math.max(1, options.maxAttempts ?? 1)
      const maxStatusAttempts = Math.max(1, options.maxStatusAttempts ?? maxAttempts)
      const wait = (attempt: number) =>
        new Promise(resolve => setTimeout(resolve, Math.min(8_000, 250 * 2 ** attempt)))
      for (let attempt = 0, statusAttempt = 0; ; ) {
        let response: Response
        try {
          response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body,
          })
        } catch (error) {
          attempt += 1
          if (attempt >= maxAttempts) throw error
          await wait(attempt)
          continue
        }
        if (response.ok) return response.json()
        statusAttempt += 1
        if (![429, 500, 502, 503, 504].includes(response.status) || statusAttempt >= maxStatusAttempts)
          throw new Error(`LIBRARY_EMBEDDING_HTTP_${response.status}`)
        await response.body?.cancel()
        await wait(statusAttempt)
      }
    },
  })


/** A query embedding not back after this is asked again (amendment of 2026-11-12 to ADR-0103). */
export const QUERY_EMBEDDING_HEDGE_MS = 600
/** Past this the query has no vector: the search goes on by words alone. */
export const QUERY_EMBEDDING_TIMEOUT_MS = 2000

export type QueryEmbeddingReport = { attempts: number; timedOut: boolean }

/**
 * The same provider, asking for a query vector a second time when the first call is late, and
 * giving up after a bound (amendment of 2026-11-12 to ADR-0103). Workers AI serves Qwen3 with a
 * heavy tail that falls at random, call by call: 0.5 s median but 4 to 5.4 s at the 95th
 * percentile, where BGE-M3 called alternately stayed under 0.7 s. A second identical call usually
 * comes back in 0.3 to 0.5 s; the first answer serves, the other is ignored. A first call that fails
 * early starts the second at once. Documents are embedded as before.
 */
export function withHedgedQueryEmbedding(
  provider: LibraryEmbeddingProvider,
  options: {
    hedgeAfterMs?: number
    timeoutMs?: number
    onSettled?: (report: QueryEmbeddingReport) => void
  } = {}
): LibraryEmbeddingProvider {
  const hedgeAfterMs = options.hedgeAfterMs ?? QUERY_EMBEDDING_HEDGE_MS
  const timeoutMs = options.timeoutMs ?? QUERY_EMBEDDING_TIMEOUT_MS
  return {
    model: provider.model,
    contract: provider.contract,
    embedDocuments: texts => provider.embedDocuments(texts),
    embedQuery(text) {
      return new Promise<number[]>((resolve, reject) => {
        let done = false,
          attempts = 0,
          running = 0
        const finish = (outcome: () => void, timedOut = false) => {
          done = true
          clearTimeout(hedge)
          clearTimeout(deadline)
          options.onSettled?.({ attempts, timedOut })
          outcome()
        }
        const launch = () => {
          if (done || attempts >= 2) return
          attempts += 1
          running += 1
          provider.embedQuery(text).then(
            vector => {
              if (!done) finish(() => resolve(vector))
            },
            error => {
              running -= 1
              if (done) return
              if (attempts < 2) launch()
              else if (running === 0) finish(() => reject(error))
            }
          )
        }
        const hedge = setTimeout(launch, hedgeAfterMs)
        const deadline = setTimeout(
          () => finish(() => reject(new Error('LIBRARY_EMBEDDING_TIMEOUT')), true),
          timeoutMs
        )
        launch()
      })
    },
  }
}

const QUERY_CACHE_ENTRIES = 64
const QUERY_CACHE_TTL_MS = 10 * 60_000
const queryCache = new Map<string, { vector: Promise<number[]>; at: number }>()

/**
 * The same provider, remembering the vectors of the last queries in this isolate (amendment of
 * 2026-11-11 to ADR-0103): the assistant searches the same question twice, the second time within
 * each tradition once its router has called the point debated, and the second embedding then costs
 * nothing. A query still being embedded is awaited, not embedded again; a failure is forgotten.
 */
export function withQueryEmbeddingCache(provider: LibraryEmbeddingProvider): LibraryEmbeddingProvider {
  return {
    model: provider.model,
    contract: provider.contract,
    embedDocuments: texts => provider.embedDocuments(texts),
    embedQuery(text) {
      const key = `${provider.model}\n${provider.contract}\n${libraryEmbeddingQuery(text)}`
      const cached = queryCache.get(key)
      if (cached && Date.now() - cached.at < QUERY_CACHE_TTL_MS) return cached.vector
      const vector = provider.embedQuery(text)
      queryCache.delete(key)
      queryCache.set(key, { vector, at: Date.now() })
      vector.catch(() => queryCache.delete(key))
      while (queryCache.size > QUERY_CACHE_ENTRIES) queryCache.delete(queryCache.keys().next().value!)
      return vector
    },
  }
}
