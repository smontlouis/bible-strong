import type { RootState } from '~redux/modules/reducer'
import type { SearchItemFilters, SearchItemType } from '~state/searchFilters'
import { searchWithMatches } from './shared/searchFuzzy'
import {
  getSortedLinkSearchItems,
  getSortedNoteSearchItems,
  getSortedStudySearchItems,
} from './shared/searchItems'
import { SEARCH_MIN_QUERY_LENGTH } from './searchResultsModel'

// A separate compiler scope keeps local indexing independent of remote-query renders.
export function usePersonalSearchResults(
  query: string,
  browseItemType: SearchItemType | undefined,
  filters: SearchItemFilters,
  notes: RootState['user']['bible']['notes'],
  links: RootState['user']['bible']['links'],
  studies: RootState['user']['bible']['studies'],
  t: (key: string) => string
) {
  'use memo'

  const trimmed = query.trim()
  const searching = trimmed.length >= SEARCH_MIN_QUERY_LENGTH
  const noteItems =
    filters.notes && (searching || browseItemType === 'notes')
      ? getSortedNoteSearchItems(notes, t)
      : []
  const linkItems =
    filters.links && (searching || browseItemType === 'links')
      ? getSortedLinkSearchItems(links, t)
      : []
  const studyItems =
    filters.studies && (searching || browseItemType === 'studies')
      ? getSortedStudySearchItems(studies, t)
      : []
  return {
    noteResults: searching
      ? searchWithMatches(noteItems, trimmed)
      : browseItemType === 'notes'
        ? noteItems
        : [],
    linkResults: searching
      ? searchWithMatches(linkItems, trimmed)
      : browseItemType === 'links'
        ? linkItems
        : [],
    studyResults: searching
      ? searchWithMatches(studyItems, trimmed)
      : browseItemType === 'studies'
        ? studyItems
        : [],
  }
}
