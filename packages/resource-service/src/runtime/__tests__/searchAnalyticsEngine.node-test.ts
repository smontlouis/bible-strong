import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { Effect } from 'effect'

import {
  SearchAnalyticsEventDto,
  SearchAnalyticsResultCountsDto,
} from '../../../../src/features/resources/searchAnalyticsContract'
import { sanitizeSearchAnalyticsEvent } from '../../analytics/searchAnalytics'
import {
  makeAnalyticsEngineSearchSink,
  makeMetadataOnlyAiGatewayOptions,
  writeSearchRuntimeEvent,
} from '../searchAnalyticsEngine'

const makeDataset = () => {
  const points: { indexes?: string[]; blobs?: string[]; doubles?: number[] }[] = []
  return {
    points,
    dataset: {
      writeDataPoint: (point: (typeof points)[number]) => points.push(point),
    },
  }
}

const makeEvent = () =>
  sanitizeSearchAnalyticsEvent(
    new SearchAnalyticsEventDto({
      event: 'search_performed',
      query: 'Grâce et anxiété',
      language: 'fr',
      origin: 'example',
      inputKind: 'natural_language',
      sources: ['passages', 'strong'],
      versionIds: ['LSG'],
      outcome: 'success',
      resultCounts: new SearchAnalyticsResultCountsDto({
        total: 22,
        references: 0,
        passages: 20,
        strong: 2,
        dictionary: 0,
        nave: 0,
      }),
      matchKind: 'semantic',
      topicId: 'topic:anxiety',
      durationMs: 420,
    })
  )!

describe('Analytics Engine search sinks', () => {
  it('writes the versioned product dimensions in stable positions', async () => {
    const { dataset, points } = makeDataset()
    const sink = makeAnalyticsEngineSearchSink({
      dataset,
      enabled: true,
      environment: 'test',
    })

    await Effect.runPromise(sink.record(makeEvent()))

    assert.equal(points.length, 1)
    assert.deepEqual(points[0]?.indexes, ['test:search-product:fr'])
    assert.deepEqual(points[0]?.blobs?.slice(0, 6), [
      'search_performed',
      'Grâce et anxiété',
      'grace et anxiete',
      'fr',
      'example',
      'natural_language',
    ])
    assert.deepEqual(points[0]?.doubles, [22, 0, 20, 2, 0, 0, 420, 0, 16, 1])
  })

  it('honors the analytics kill switch', async () => {
    const { dataset, points } = makeDataset()
    const sink = makeAnalyticsEngineSearchSink({
      dataset,
      enabled: false,
      environment: 'test',
    })

    await Effect.runPromise(sink.record(makeEvent()))

    assert.equal(points.length, 0)
  })

  it('keeps runtime metrics separate from product search content', () => {
    const { dataset, points } = makeDataset()

    writeSearchRuntimeEvent(dataset, {
      environment: 'test',
      event: 'embedding',
      route: 'topic-query-embedding',
      model: '@cf/qwen/qwen3-embedding-0.6b',
      contract: 'qwen3-embedding-v1',
      durationMs: 84,
      success: true,
    })

    assert.deepEqual(points[0]?.indexes, ['test:search-runtime:embedding'])
    assert.deepEqual(points[0]?.doubles, [84, 0, 0, 1])
    assert.equal(points[0]?.blobs?.includes('Grâce et anxiété'), false)
  })

  it('enables AI Gateway metadata while explicitly suppressing payload storage', () => {
    assert.deepEqual(
      makeMetadataOnlyAiGatewayOptions({
        gatewayId: 'search-embeddings',
        environment: 'test',
        contract: 'qwen3-embedding-v1',
        enabled: true,
      }),
      {
        extraHeaders: { 'cf-aig-collect-log-payload': 'false' },
        gateway: {
          id: 'search-embeddings',
          skipCache: true,
          collectLog: true,
          metadata: {
            environment: 'test',
            purpose: 'topic-query-embedding',
            contract: 'qwen3-embedding-v1',
          },
        },
      }
    )
  })

  it('disables the AI Gateway log through the same kill switch', () => {
    const options = makeMetadataOnlyAiGatewayOptions({
      gatewayId: 'search-embeddings',
      environment: 'test',
      contract: 'qwen3-embedding-v1',
      enabled: false,
    })

    assert.equal(options.gateway.collectLog, false)
  })
})
