/* eslint-disable import/first */
jest.mock('~helpers/atomWithAsyncStorage', () => () => ({}))

import {
  createBasicMigration,
  migrateHighlightsListQueryState,
  migrateStudiesListQueryState,
  migrateWordAnnotationsListQueryState,
  shouldClearPersistedReferenceFilter,
} from '~state/entityListFilters'

describe('persisted entity list query state', () => {
  it('keeps a reference filter until its backing collection is authoritative', () => {
    expect(
      shouldClearPersistedReferenceFilter({
        hasReference: true,
        referenceExists: false,
        referenceDataReady: false,
      })
    ).toBe(false)

    expect(
      shouldClearPersistedReferenceFilter({
        hasReference: true,
        referenceExists: false,
        referenceDataReady: true,
      })
    ).toBe(true)
  })

  it('repairs invalid fields independently without clearing valid query state', () => {
    expect(
      createBasicMigration('newest')({ query: 'grâce', sort: 'unknown', tagId: 'tag-1' })
    ).toEqual({ query: 'grâce', sort: 'newest', tagId: 'tag-1' })

    expect(
      migrateStudiesListQueryState({
        query: 'paul',
        sort: 'title-asc',
        tagId: 'tag-2',
        publication: 'unknown',
      })
    ).toEqual({ query: 'paul', sort: 'title-asc', tagId: 'tag-2', publication: 'all' })
  })

  it('repairs invalid Bible locations while preserving unrelated filters', () => {
    expect(
      migrateHighlightsListQueryState({ colorId: 'color1', testament: 'old', book: 99 })
    ).toMatchObject({ colorId: 'color1', testament: 'old', book: undefined })

    expect(
      migrateWordAnnotationsListQueryState({
        version: 'LSG',
        testament: 'new',
        book: -1,
        view: 'date',
        sort: 'oldest',
      })
    ).toMatchObject({ version: 'LSG', testament: 'new', book: null, view: 'date', sort: 'oldest' })

    expect(migrateHighlightsListQueryState({ testament: 'old', book: 50 })).toMatchObject({
      testament: 'old',
      book: undefined,
    })
    expect(migrateWordAnnotationsListQueryState({ testament: 'new', book: 20 })).toMatchObject({
      testament: 'new',
      book: null,
    })
  })
})
