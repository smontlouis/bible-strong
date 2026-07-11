/* eslint-disable import/first */
jest.mock('~helpers/atomWithAsyncStorage', () => () => ({}))

import {
  createBasicMigration,
  migrateHighlightsListQueryState,
  migrateStudiesListQueryState,
  migrateWordAnnotationsListQueryState,
} from '~state/entityListFilters'

describe('persisted entity list query state', () => {
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
  })
})
