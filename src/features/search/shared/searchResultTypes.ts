import type { FuseResultMatch } from 'fuse.js'
import type { SearchResult } from '~helpers/biblesDb'
import type { RelationEndpoint } from '~features/studyRelations/domain'
import type { SearchItemType } from '~state/searchFilters'
import type { ParsedSegment } from '~features/search/BibleReferenceWidget'

export type MatchRange = [number, number]
export type SearchReferenceMode = 'navigation' | 'target'

export type SearchEntityResult = {
  id: string
  type: SearchItemType
  title: string
  chip?: string
  subtitle?: string
  description?: string
  iconType: SearchItemType
  endpoint?: RelationEndpoint
  passage?: SearchResult
  referenceSegment?: ParsedSegment
  matches?: readonly FuseResultMatch[]
}

export type SearchEntityResultWithEndpoint = SearchEntityResult & {
  endpoint: RelationEndpoint
}
