import {
  getSearchResultsPresentation,
  type SearchResultsSnapshot,
} from '../searchResultsPresentation'

const snapshot = (query: string, loading: boolean, hasResults: boolean): SearchResultsSnapshot => ({
  query,
  context: 'LSG:all',
  model: {
    hasSearchQuery: true,
    showResultsList: true,
    shouldRenderSearchList: true,
    isBrowseLoading: false,
    isLoading: loading,
    showNoResults: !loading && !hasResults,
    sections: hasResults
      ? [
          {
            id: 'notes',
            title: 'Notes',
            count: 1,
            itemFilterType: 'notes',
            items: [
              { id: 'note:1', type: 'notes', iconType: 'notes', title: query, subtitle: 'Note' },
            ],
          },
        ]
      : [],
  },
})

it('retains the actual old rows and their query until new results or a final empty result arrive', () => {
  const previous = snapshot('Dieu parle tantôt cependant', false, true)
  expect(getSearchResultsPresentation(snapshot('Dieu parle tantôt', true, false), previous)).toBe(
    previous
  )
  const partial = snapshot('Dieu parle tantôt', true, true)
  expect(getSearchResultsPresentation(partial, previous)).toBe(partial)
  const empty = snapshot('Dieu parle tantôt', false, false)
  expect(getSearchResultsPresentation(empty, previous)).toBe(empty)
})

it('never retains old results after clearing or changing the filters/version', () => {
  const previous = snapshot('Dieu parle', false, true)
  const cleared = snapshot('', true, false)
  expect(getSearchResultsPresentation(cleared, previous)).toBe(cleared)
  const filtered = { ...snapshot('Dieu', true, false), context: 'KJV:passages' }
  expect(getSearchResultsPresentation(filtered, previous)).toBe(filtered)
})
