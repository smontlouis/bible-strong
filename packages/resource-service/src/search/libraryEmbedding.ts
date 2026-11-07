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
  options: { maxAttempts?: number } = {}
): LibraryEmbeddingProvider =>
  makeLibraryEmbeddingProvider({
    async run(model, input) {
      const body = JSON.stringify({ ...input, model })
      const maxAttempts = Math.max(1, options.maxAttempts ?? 1)
      for (let attempt = 0; ; attempt += 1) {
        const last = attempt === maxAttempts - 1
        let response: Response
        try {
          response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body,
          })
        } catch (error) {
          if (last) throw error
          await new Promise(resolve => setTimeout(resolve, Math.min(8_000, 250 * 2 ** attempt)))
          continue
        }
        if (response.ok) return response.json()
        if (![429, 500, 502, 503, 504].includes(response.status) || last)
          throw new Error(`LIBRARY_EMBEDDING_HTTP_${response.status}`)
        await response.body?.cancel()
        await new Promise(resolve => setTimeout(resolve, Math.min(8_000, 250 * 2 ** attempt)))
      }
    },
  })
