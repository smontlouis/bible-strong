import type {
  SearchAnalyticsEventName,
  SearchAnalyticsInputKind,
  SearchAnalyticsMatchKind,
  SearchAnalyticsOrigin,
  SearchAnalyticsOutcome,
  SearchAnalyticsResultType,
  SearchAnalyticsSource,
} from './searchAnalyticsContract'

export type SearchAnalyticsEvent = {
  event: SearchAnalyticsEventName
  query: string
  language: 'fr' | 'en'
  origin: SearchAnalyticsOrigin
  inputKind: SearchAnalyticsInputKind
  sources: SearchAnalyticsSource[]
  versionIds: string[]
  outcome: SearchAnalyticsOutcome
  resultCounts: {
    total: number
    references: number
    passages: number
    strong: number
    dictionary: number
    nave: number
  }
  matchKind: SearchAnalyticsMatchKind
  topicId?: string
  durationMs?: number
  clickedResultType?: SearchAnalyticsResultType
  clickedResultKey?: string
  clickedRank?: number
}

export type SearchAnalyticsAccess = {
  record: (event: SearchAnalyticsEvent) => Promise<void>
}

export const noOpSearchAnalyticsAccess: SearchAnalyticsAccess = {
  record: async () => undefined,
}

export const createHttpSearchAnalyticsAccess = ({
  baseUrl,
  fetcher = fetch,
  isOnline,
  timeoutMs = 3_000,
}: {
  baseUrl: string
  fetcher?: typeof fetch
  isOnline: () => Promise<boolean>
  timeoutMs?: number
}): SearchAnalyticsAccess => ({
  record: async event => {
    if (!(await isOnline())) return

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetcher(`${baseUrl.replace(/\/+$/u, '')}/v1/search-events`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify(event),
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`SEARCH_ANALYTICS_HTTP_${response.status}`)
    } finally {
      clearTimeout(timeout)
    }
  },
})
