/* eslint-disable import/first */
jest.mock('../BibleReferenceWidget', () => ({
  parseBibleReference: jest.fn(() => []),
}))

jest.mock('~i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string) => key,
  },
}))

import { getSearchResultsModel, shouldShowSearchResultsList } from '../searchResultsModel'
import type { SearchEntityResult } from '../shared/searchResultTypes'

const t = (key: string) => key

const emptyLoading = {
  passages: false,
  notes: false,
  links: false,
  studies: false,
  strong: false,
  dictionary: false,
  nave: false,
}

const allFilters = {
  passages: true,
  notes: true,
  links: true,
  studies: true,
  strong: true,
  dictionary: true,
  nave: true,
}

const baseInput = {
  query: 'note',
  debouncedQuery: 'note',
  itemFilters: allFilters,
  noteResults: [],
  linkResults: [],
  studyResults: [],
  strongResults: [],
  dictionaryResults: [],
  naveResults: [],
  passageResults: [],
  totalPassageCount: 0,
  searchError: null,
  loading: emptyLoading,
  t,
}

const noteResult: SearchEntityResult = {
  id: 'note:1',
  type: 'notes',
  iconType: 'notes',
  title: 'Note 1',
  subtitle: 'Note',
}

describe('searchResultsModel', () => {
  it('shows results for browse mode regardless of query length', () => {
    expect(
      shouldShowSearchResultsList({
        query: '',
        debouncedQuery: '',
        browseItemType: 'notes',
      })
    ).toBe(true)
  })

  it('requires the minimum query length outside browse mode', () => {
    expect(shouldShowSearchResultsList({ query: 'a', debouncedQuery: 'a' })).toBe(false)
    expect(shouldShowSearchResultsList({ query: 'ab', debouncedQuery: 'ab' })).toBe(true)
  })

  it('builds enabled result sections in search display order', () => {
    const model = getSearchResultsModel({
      ...baseInput,
      noteResults: [noteResult],
      linkResults: [
        {
          id: 'link:1',
          type: 'links',
          iconType: 'links',
          title: 'Link 1',
          subtitle: 'Link',
        },
      ],
    })

    expect(model.sections.map(section => section.id)).toEqual(['notes', 'links'])
    expect(model.sections[0].items).toEqual([noteResult])
  })

  it('keeps an empty passages section visible while passages are loading', () => {
    const model = getSearchResultsModel({
      ...baseInput,
      loading: { ...emptyLoading, passages: true },
    })

    expect(model.sections).toEqual([
      expect.objectContaining({
        id: 'passages',
        items: [],
      }),
    ])
  })

  it('reports browse loading for the active browse item type only', () => {
    const model = getSearchResultsModel({
      ...baseInput,
      browseItemType: 'strong',
      loading: { ...emptyLoading, strong: true, dictionary: true },
    })

    expect(model.isBrowseLoading).toBe(true)
    expect(model.showNoResults).toBe(false)
  })

  it('reports no results when the visible query has no sections and nothing is loading', () => {
    const model = getSearchResultsModel(baseInput)

    expect(model.showNoResults).toBe(true)
    expect(model.shouldRenderSearchList).toBe(true)
  })
})
