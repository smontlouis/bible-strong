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

import {
  getSearchFacets,
  getSearchResultsModel,
  getSectionsForFacet,
  shouldShowSearchResultsList,
} from '../searchResultsModel'
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

  it('displays and opens the matched STEP Strong identity', () => {
    const model = getSearchResultsModel({
      ...baseInput,
      strongResults: [
        {
          id: 11446,
          stepCode: 'H0310A',
          classicStrong: 'H0310',
          language: 'hebrew',
          original: 'כֵּן',
          transliteration: 'kēn',
          gloss: 'ainsi',
        },
      ],
    })

    expect(model.sections[0].items[0]).toEqual(
      expect.objectContaining({
        chip: 'H0310A',
        endpoint: expect.objectContaining({ code: '310A' }),
        strongReference: { language: 'hebrew', code: 'H0310A' },
      })
    )
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

  it('does not report no results while a Strong example is still loading', () => {
    const model = getSearchResultsModel({
      ...baseInput,
      query: 'H430',
      debouncedQuery: 'H430',
      loading: { ...emptyLoading, strong: true },
    })

    expect(model.isLoading).toBe(true)
    expect(model.showNoResults).toBe(false)
  })

  it('starts loading immediately when a Strong example is waiting for debounce', () => {
    const model = getSearchResultsModel({
      ...baseInput,
      query: 'G26',
      debouncedQuery: '',
    })

    expect(model.isLoading).toBe(true)
    expect(model.showNoResults).toBe(false)
    expect(model.shouldRenderSearchList).toBe(true)
  })

  it('reports no results when the visible query has no sections and nothing is loading', () => {
    const model = getSearchResultsModel(baseInput)

    expect(model.showNoResults).toBe(true)
    expect(model.shouldRenderSearchList).toBe(true)
  })

  it('builds result facets by source and aggregates the global count', () => {
    const model = getSearchResultsModel({
      ...baseInput,
      noteResults: [noteResult],
      strongResults: [
        {
          id: 26,
          stepCode: 'G0026',
          classicStrong: 'G0026',
          language: 'greek',
          original: 'ἀγάπη',
          transliteration: 'agapē',
          gloss: 'amour',
        },
      ],
    })

    expect(getSearchFacets(model.sections)).toEqual([
      { id: 'all', count: 2 },
      { id: 'notes', count: 1 },
      { id: 'strong', count: 1 },
    ])
  })

  it('filters result sections without mutating the search source filters', () => {
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

    expect(getSectionsForFacet(model.sections, 'notes').map(section => section.id)).toEqual([
      'notes',
    ])
    expect(getSectionsForFacet(model.sections, 'all')).toBe(model.sections)
  })

  it('keeps passage facets first even when passage results arrive last', () => {
    expect(
      getSearchFacets([
        {
          id: 'notes',
          title: 'Notes',
          count: 1,
          items: [],
          itemFilterType: 'notes',
        },
        {
          id: 'passages',
          title: 'Passages',
          count: 12,
          items: [],
          itemFilterType: 'passages',
        },
      ])
    ).toEqual([
      { id: 'all', count: 13 },
      { id: 'passages', count: 12 },
      { id: 'notes', count: 1 },
    ])
  })
})
