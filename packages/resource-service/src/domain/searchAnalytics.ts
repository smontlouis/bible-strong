import { Context, Effect } from 'effect'

import type { SearchAnalyticsEventDto } from '@bible-strong/resource-domain/contracts/searchAnalyticsContract'
import type { SanitizedSearchAnalyticsEvent } from '../analytics/searchAnalytics'
import { sanitizeSearchAnalyticsEvent } from '../analytics/searchAnalytics'

export type SearchAnalyticsSinkService = {
  record: (event: SanitizedSearchAnalyticsEvent) => Effect.Effect<void>
}

export class SearchAnalyticsSink extends Context.Tag('SearchAnalyticsSink')<
  SearchAnalyticsSink,
  SearchAnalyticsSinkService
>() {}

export const recordSearchAnalytics = (event: SearchAnalyticsEventDto) =>
  Effect.gen(function* () {
    const sanitized = sanitizeSearchAnalyticsEvent(event)
    if (!sanitized) return false
    yield* (yield* SearchAnalyticsSink).record(sanitized)
    return true
  })

export const noOpSearchAnalyticsSink: SearchAnalyticsSinkService = {
  record: () => Effect.void,
}
