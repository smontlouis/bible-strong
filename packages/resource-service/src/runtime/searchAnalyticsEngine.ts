import { Effect } from 'effect'

import type { SanitizedSearchAnalyticsEvent } from '../analytics/searchAnalytics'
import type { SearchAnalyticsSinkService } from '../domain/searchAnalytics'

const valueOrNone = (value: string | undefined) => value ?? 'none'

type SearchAnalyticsDataset = {
  writeDataPoint(event: { indexes?: string[]; blobs?: string[]; doubles?: number[] }): void
}

export const makeMetadataOnlyAiGatewayOptions = ({
  gatewayId,
  environment,
  contract,
  enabled,
}: {
  gatewayId: string
  environment: string
  contract: string
  enabled: boolean
}) => ({
  // Cloudflare keeps model/cost/duration metadata but never the embedding input or output.
  extraHeaders: { 'cf-aig-collect-log-payload': 'false' },
  gateway: {
    id: gatewayId,
    skipCache: true,
    collectLog: enabled,
    metadata: {
      environment,
      purpose: 'topic-query-embedding',
      contract,
    },
  },
})

export const writeSearchRuntimeEvent = (
  dataset: SearchAnalyticsDataset,
  {
    environment,
    event,
    route,
    status,
    cache,
    model,
    contract,
    errorClass,
    durationMs = 0,
    sqlStatements = 0,
    originRead = false,
    success = true,
  }: {
    environment: string
    event: 'request' | 'embedding'
    route: string
    status?: string
    cache?: string
    model?: string
    contract?: string
    errorClass?: string
    durationMs?: number
    sqlStatements?: number
    originRead?: boolean
    success?: boolean
  }
) => {
  dataset.writeDataPoint({
    indexes: [`${environment}:search-runtime:${event}`],
    blobs: [
      event,
      environment,
      route,
      valueOrNone(status),
      valueOrNone(cache),
      valueOrNone(model),
      valueOrNone(contract),
      valueOrNone(errorClass),
    ],
    doubles: [durationMs, sqlStatements, originRead ? 1 : 0, success ? 1 : 0],
  })
}

export const makeAnalyticsEngineSearchSink = ({
  dataset,
  enabled,
  environment,
  reportFailure = () => undefined,
}: {
  dataset: SearchAnalyticsDataset
  enabled: boolean
  environment: string
  reportFailure?: (cause: unknown) => void
}): SearchAnalyticsSinkService => ({
  record: (event: SanitizedSearchAnalyticsEvent) =>
    Effect.sync(() => {
      if (!enabled) return
      try {
        dataset.writeDataPoint({
          indexes: [`${environment}:search-product:${event.language}`],
          blobs: [
            event.event,
            event.query,
            event.queryKey,
            event.language,
            event.origin,
            event.inputKind,
            event.sources.join(','),
            event.versionIds.join(','),
            event.outcome,
            event.matchKind,
            valueOrNone(event.topicId),
            valueOrNone(event.clickedResultType),
            valueOrNone(event.clickedResultKey),
          ],
          doubles: [
            event.resultCounts.total,
            event.resultCounts.references,
            event.resultCounts.passages,
            event.resultCounts.strong,
            event.resultCounts.dictionary,
            event.resultCounts.nave,
            event.durationMs ?? 0,
            event.clickedRank ?? 0,
            event.query.length,
            event.origin === 'example' ? 1 : 0,
          ],
        })
      } catch (cause) {
        reportFailure(cause)
      }
    }),
})
