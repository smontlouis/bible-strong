import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  createTopicEmbeddingDocument,
  makeHttpTopicEmbeddingProvider,
  makeWorkersAiTopicEmbeddingProvider,
  stripTopicQueryPrompt,
  TOPIC_EMBEDDING_DIMENSIONS,
  TOPIC_QUERY_INSTRUCTION,
} from '../topicEmbedding'

describe('topic embedding contract', () => {
  it('normalizes conversational French prompts without changing their meaning', () => {
    assert.equal(stripTopicQueryPrompt('Passages sur l’anxiété'), 'anxiete')
    assert.equal(stripTopicQueryPrompt('Que dit la Bible sur la colère ?'), 'colere')
  })

  it('keeps canonical and validated multilingual labels in a versioned document', () => {
    assert.equal(
      createTopicEmbeddingDocument({
        canonicalName: 'Forgiveness',
        englishAliases: ['forgiving others'],
        frenchAliases: ['pardon', 'pardonner'],
      }),
      'Canonical biblical topic: Forgiveness\n' +
        'English aliases: forgiving others\n' +
        'Validated French aliases: pardon; pardonner'
    )
  })

  it('uses the asymmetric Qwen query/document contract and validates dimensions', async () => {
    const calls: Record<string, unknown>[] = []
    const provider = makeWorkersAiTopicEmbeddingProvider({
      async run(_model, input) {
        calls.push(input)
        const texts = input.text as string[]
        return {
          data: texts.map(() =>
            Array.from({ length: TOPIC_EMBEDDING_DIMENSIONS }, (_, index) => (index === 0 ? 1 : 0))
          ),
        }
      },
    })

    await provider.embedDocuments(['Canonical biblical topic: Anxiety'])
    await provider.embedQuery('Passages sur l’anxiété')

    assert.deepEqual(calls[0], { text: ['Canonical biblical topic: Anxiety'] })
    assert.deepEqual(calls[1], {
      text: [`Instruct: ${TOPIC_QUERY_INSTRUCTION}\nQuery: anxiete`],
    })
  })

  it('keeps retries opt-in for batch ingestion', async () => {
    const originalFetch = globalThis.fetch
    let calls = 0
    globalThis.fetch = async () => {
      calls += 1
      if (calls === 1) return new Response(null, { status: 503 })
      return Response.json({
        data: [Array.from({ length: TOPIC_EMBEDDING_DIMENSIONS }, () => 0)],
      })
    }

    try {
      await makeHttpTopicEmbeddingProvider('https://embedding.test', {
        maxAttempts: 2,
      }).embedQuery('anxiété')
      assert.equal(calls, 2)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
