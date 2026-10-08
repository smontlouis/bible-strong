import { Effect } from 'effect'

import type { SanitizedSearchAnalyticsEvent } from '../analytics/searchAnalytics'
import type { SearchAnalyticsSinkService } from '../domain/searchAnalytics'
import { valueOrNone, type SearchAnalyticsDataset } from './searchRuntimeAnalytics'

export { makeMetadataOnlyAiGatewayOptions, writeSearchRuntimeEvent } from './searchRuntimeAnalytics'

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
