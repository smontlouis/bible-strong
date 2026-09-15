import type { getSearchResultsModel } from './searchResultsModel'

export type SearchResultsSnapshot = {
  query: string
  context: string
  model: ReturnType<typeof getSearchResultsModel>
}

/** Keep the previous list usable until the new query has something to show. */
export function getSearchResultsPresentation(
  current: SearchResultsSnapshot,
  previous: SearchResultsSnapshot | null
): SearchResultsSnapshot {
  return previous &&
    current.query.trim() &&
    current.query !== previous.query &&
    current.context === previous.context &&
    current.model.isLoading &&
    !current.model.sections.some(section => section.items.length) &&
    previous.model.sections.some(section => section.items.length)
    ? previous
    : current
}
