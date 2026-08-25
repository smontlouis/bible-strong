export const TOPIC_EMBEDDING_MODEL = '@cf/qwen/qwen3-embedding-0.6b'
export const TOPIC_EMBEDDING_DIMENSIONS = 1024
export const TOPIC_EMBEDDING_CONTRACT = 'bible-topic-qwen3-v2'
export const TOPIC_EMBEDDING_MIN_SIMILARITY = 0.445
export const TOPIC_QUERY_INSTRUCTION =
  'Given a French or English Bible-topic query, retrieve the most relevant biblical topic.'

export type TopicEmbeddingProvider = {
  readonly model: typeof TOPIC_EMBEDDING_MODEL
  readonly dimensions: typeof TOPIC_EMBEDDING_DIMENSIONS
  readonly contract: typeof TOPIC_EMBEDDING_CONTRACT
  embedDocuments(texts: readonly string[]): Promise<number[][]>
  embedQuery(text: string): Promise<number[]>
}

type WorkersAiEmbeddingOutput = {
  data?: number[][]
}

export type WorkersAiBinding = {
  run(model: typeof TOPIC_EMBEDDING_MODEL, input: Record<string, unknown>): Promise<unknown>
}

export const normalizeTopicSearchText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

export const stripTopicQueryPrompt = (value: string) =>
  normalizeTopicSearchText(value)
    .replace(/^(?:je cherche |montre moi |trouve moi )/, '')
    .replace(/^(?:des )?(?:passages?|versets?) (?:bibliques? )?(?:a propos de |sur |pour )/, '')
    .replace(/^(?:que dit la bible (?:a propos de |sur )|what does the bible say about )/, '')
    .replace(/^(?:l |la |le |les |un |une |des )/, '')
    .trim()

export const createTopicEmbeddingDocument = ({
  canonicalName,
  englishAliases,
  frenchAliases,
}: {
  canonicalName: string
  englishAliases: readonly string[]
  frenchAliases: readonly string[]
}) =>
  [
    `Canonical biblical topic: ${canonicalName}`,
    englishAliases.length ? `English aliases: ${englishAliases.join('; ')}` : undefined,
    frenchAliases.length ? `Validated French aliases: ${frenchAliases.join('; ')}` : undefined,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n')

const readEmbeddingOutput = (value: unknown, expectedCount: number): number[][] => {
  const output = value as WorkersAiEmbeddingOutput
  if (
    !Array.isArray(output.data) ||
    output.data.length !== expectedCount ||
    output.data.some(
      vector =>
        !Array.isArray(vector) ||
        vector.length !== TOPIC_EMBEDDING_DIMENSIONS ||
        vector.some(component => !Number.isFinite(component))
    )
  ) {
    throw new Error('TOPIC_EMBEDDING_INVALID_RESPONSE')
  }
  return output.data
}

export const makeWorkersAiTopicEmbeddingProvider = (
  binding: WorkersAiBinding
): TopicEmbeddingProvider => ({
  model: TOPIC_EMBEDDING_MODEL,
  dimensions: TOPIC_EMBEDDING_DIMENSIONS,
  contract: TOPIC_EMBEDDING_CONTRACT,
  async embedDocuments(texts) {
    if (texts.length === 0) return []
    return readEmbeddingOutput(
      await binding.run(TOPIC_EMBEDDING_MODEL, { text: [...texts] }),
      texts.length
    )
  },
  async embedQuery(text) {
    const query = stripTopicQueryPrompt(text)
    const [embedding] = readEmbeddingOutput(
      await binding.run(TOPIC_EMBEDDING_MODEL, {
        text: [`Instruct: ${TOPIC_QUERY_INSTRUCTION}\nQuery: ${query}`],
      }),
      1
    )
    return embedding
  },
})

export const makeHttpTopicEmbeddingProvider = (
  endpoint: string,
  options: { maxAttempts?: number } = {}
): TopicEmbeddingProvider => {
  const binding: WorkersAiBinding = {
    async run(_model, input) {
      const body = JSON.stringify(input)
      const maxAttempts = Math.max(1, options.maxAttempts ?? 1)
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        let response: Response
        try {
          response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body,
          })
        } catch (error) {
          if (attempt === maxAttempts - 1) throw error
          await new Promise(resolve => setTimeout(resolve, Math.min(8_000, 250 * 2 ** attempt)))
          continue
        }
        if (response.ok) return response.json()
        const retryable = [429, 500, 502, 503, 504].includes(response.status)
        if (!retryable || attempt === maxAttempts - 1) {
          throw new Error(`TOPIC_EMBEDDING_HTTP_${response.status}`)
        }
        await new Promise(resolve => setTimeout(resolve, Math.min(8_000, 250 * 2 ** attempt)))
      }
      throw new Error('TOPIC_EMBEDDING_HTTP_RETRY_EXHAUSTED')
    },
  }
  return makeWorkersAiTopicEmbeddingProvider(binding)
}
