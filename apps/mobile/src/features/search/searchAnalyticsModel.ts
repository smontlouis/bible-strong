import type { StrongLexiconSearchResult } from '~features/resources/strongLexiconAccess'
import type {
  SearchAnalyticsInputKind,
  SearchAnalyticsMatchKind,
  SearchAnalyticsResultType,
  SearchAnalyticsSource,
} from '~features/resources/searchAnalyticsContract'
import type { SearchResult } from '~helpers/biblesDb'
import type { SearchItemFilters } from '~state/searchFilters'
import type { SQLiteSearchResultSection } from './searchResultsModel'
import type { SearchEntityResult } from './shared/searchResultTypes'

const HEBREW_PATTERN = /[\u0590-\u05ff]/u
const GREEK_PATTERN = /[\u0370-\u03ff\u1f00-\u1fff]/u

const comparableText = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/[’‘`]/gu, "'")
    .toLocaleLowerCase('und')
    .trim()

export const getSearchAnalyticsInputKind = ({
  query,
  isBibleReference,
  isStrongReference,
  strongResults,
}: {
  query: string
  isBibleReference: boolean
  isStrongReference: boolean
  strongResults: readonly StrongLexiconSearchResult[]
}): SearchAnalyticsInputKind => {
  if (isBibleReference) return 'reference'
  if (isStrongReference) return 'strong'
  if (HEBREW_PATTERN.test(query)) return 'hebrew'
  if (GREEK_PATTERN.test(query)) return 'greek'

  const comparableQuery = comparableText(query)
  if (
    comparableQuery &&
    strongResults.some(result => comparableText(result.transliteration) === comparableQuery)
  ) {
    return 'transliteration'
  }

  return query.trim().split(/\s+/u).filter(Boolean).length >= 3 ? 'natural_language' : 'keyword'
}

export const getPublicSearchSources = (filters: SearchItemFilters): SearchAnalyticsSource[] =>
  (['passages', 'strong', 'dictionary', 'nave'] as const).filter(source => filters[source])

export const getPublicSearchResultCounts = (sections: readonly SQLiteSearchResultSection[]) => {
  const count = (id: SQLiteSearchResultSection['id']) =>
    sections.find(section => section.id === id)?.count ?? 0
  const references = count('reference')
  const passages = count('passages')
  const strong = count('strong')
  const dictionary = count('dictionary')
  const nave = count('nave')
  return {
    total: references + passages + strong + dictionary + nave,
    references,
    passages,
    strong,
    dictionary,
    nave,
  }
}

export const getPassageMatchAnalytics = (
  results: readonly SearchResult[]
): { matchKind: SearchAnalyticsMatchKind; topicId?: string } => {
  const kinds = [...new Set(results.flatMap(result => (result.match ? [result.match.kind] : [])))]
  return {
    matchKind: kinds.length > 1 ? 'mixed' : (kinds[0] ?? 'none'),
    topicId: results.find(result => result.match?.topicId)?.match?.topicId,
  }
}

export const getOpenedResultAnalytics = (
  item: SearchEntityResult,
  sections: readonly SQLiteSearchResultSection[]
): { type: SearchAnalyticsResultType; key?: string; rank: number } | undefined => {
  if (item.type === 'notes' || item.type === 'links' || item.type === 'studies') return undefined
  const section = sections.find(candidate => candidate.items.some(result => result.id === item.id))
  const rank = Math.max(0, (section?.items.findIndex(result => result.id === item.id) ?? -1) + 1)

  if (item.referenceSegment) {
    const segment = item.referenceSegment
    return {
      type: 'reference',
      key: `reference:${segment.book}-${segment.chapter}-${segment.startVerse}-${segment.endVerse}`,
      rank,
    }
  }
  if (item.passage) {
    const passage = item.passage
    return {
      type: 'passage',
      key: `passage:${passage.version}:${passage.book}-${passage.chapter}-${passage.verse}`,
      rank,
    }
  }
  if (item.strongReference) {
    return { type: 'strong', key: `strong:${item.strongReference.code}`, rank }
  }
  if (item.type === 'dictionary') return { type: 'dictionary', rank }
  if (item.type === 'nave') return { type: 'nave', rank }
  return undefined
}
