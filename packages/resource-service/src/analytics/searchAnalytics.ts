import type { SearchAnalyticsEventDto } from '@bible-strong/mobile/src/features/resources/searchAnalyticsContract'

const MAX_QUERY_LENGTH = 160
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu
const URL_PATTERN = /\b(?:https?:\/\/|www\.)\S+/giu
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/giu
const LONG_SECRET_PATTERN = /\b[A-Za-z0-9_-]{40,}\b/gu
const PHONE_PATTERN = /\b(?:\+?\d[\d .()/-]{6,}\d)\b/gu
const SAFE_TOPIC_PATTERN = /^topic:[a-z0-9_:-]{1,120}$/u
const SAFE_RESULT_KEY_PATTERN = /^[A-Za-z0-9:._-]{1,128}$/u
const SAFE_VERSION_PATTERN = /^[A-Za-z0-9._-]{1,32}$/u

const cleanWhitespace = (value: string) =>
  value.normalize('NFC').replace(/[’‘`]/gu, "'").replace(/\s+/gu, ' ').trim()

export const redactSearchQuery = (value: string): string =>
  cleanWhitespace(value)
    .replace(URL_PATTERN, '[url]')
    .replace(EMAIL_PATTERN, '[email]')
    .replace(JWT_PATTERN, '[secret]')
    .replace(BEARER_PATTERN, 'Bearer [secret]')
    .replace(LONG_SECRET_PATTERN, '[secret]')
    .replace(PHONE_PATTERN, '[telephone]')
    .slice(0, MAX_QUERY_LENGTH)

export const searchQueryGroupKey = (value: string): string =>
  cleanWhitespace(value)
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLocaleLowerCase('und')
    .slice(0, MAX_QUERY_LENGTH)

const clampCounter = (value: number) => Math.min(1_000_000, Math.max(0, Math.trunc(value)))

export type SanitizedSearchAnalyticsEvent = Omit<
  SearchAnalyticsEventDto,
  'query' | 'topicId' | 'clickedResultKey' | 'versionIds' | 'sources' | 'resultCounts'
> & {
  query: string
  queryKey: string
  topicId?: string
  clickedResultKey?: string
  versionIds: string[]
  sources: SearchAnalyticsEventDto['sources'][number][]
  resultCounts: {
    total: number
    references: number
    passages: number
    strong: number
    dictionary: number
    nave: number
  }
}

export const sanitizeSearchAnalyticsEvent = (
  event: SearchAnalyticsEventDto
): SanitizedSearchAnalyticsEvent | undefined => {
  const query = redactSearchQuery(event.query)
  if (!query) return undefined

  const sources = [...new Set(event.sources)]
  if (!sources.length) return undefined

  return {
    ...event,
    query,
    queryKey: searchQueryGroupKey(query),
    sources,
    versionIds: [...new Set(event.versionIds.filter(value => SAFE_VERSION_PATTERN.test(value)))],
    resultCounts: {
      total: clampCounter(event.resultCounts.total),
      references: clampCounter(event.resultCounts.references),
      passages: clampCounter(event.resultCounts.passages),
      strong: clampCounter(event.resultCounts.strong),
      dictionary: clampCounter(event.resultCounts.dictionary),
      nave: clampCounter(event.resultCounts.nave),
    },
    ...(event.topicId && SAFE_TOPIC_PATTERN.test(event.topicId)
      ? { topicId: event.topicId }
      : { topicId: undefined }),
    ...(event.clickedResultKey && SAFE_RESULT_KEY_PATTERN.test(event.clickedResultKey)
      ? { clickedResultKey: event.clickedResultKey }
      : { clickedResultKey: undefined }),
  }
}
