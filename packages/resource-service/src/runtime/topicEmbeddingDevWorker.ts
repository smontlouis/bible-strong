import { TOPIC_EMBEDDING_MODEL } from '../search/topicEmbedding'

const DEV_EMBEDDING_MODELS = [TOPIC_EMBEDDING_MODEL, '@cf/baai/bge-m3'] as const

type DevEmbeddingModel = (typeof DEV_EMBEDDING_MODELS)[number]
type DevWorkersAiBinding = {
  run(model: DevEmbeddingModel, input: Record<string, unknown>): Promise<unknown>
}

export default {
  async fetch(request: Request, bindings: { AI: DevWorkersAiBinding }): Promise<Response> {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
    const input = (await request.json()) as {
      text?: unknown
      instruction?: unknown
      model?: unknown
    }
    const model = input.model ?? TOPIC_EMBEDDING_MODEL
    if (
      !Array.isArray(input.text) ||
      input.text.length === 0 ||
      input.text.length > 100 ||
      input.text.some(value => typeof value !== 'string' || !value.trim()) ||
      (input.instruction !== undefined && typeof input.instruction !== 'string') ||
      !DEV_EMBEDDING_MODELS.some(candidate => candidate === model)
    ) {
      return Response.json({ error: 'INVALID_EMBEDDING_INPUT' }, { status: 400 })
    }
    const output = await bindings.AI.run(model as DevEmbeddingModel, {
      text: input.text,
      ...(input.instruction ? { instruction: input.instruction } : {}),
    })
    return Response.json(output)
  },
}
