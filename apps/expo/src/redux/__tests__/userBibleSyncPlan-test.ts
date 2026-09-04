import {
  groupUserBibleSyncOperations,
  planBookmarkSync,
  planHighlightSync,
  planLinkSync,
  planNoteSync,
  planStudyRelationSync,
  planTagSync,
  planToggleTagEntitySync,
  planWordAnnotationSync,
} from '../userBibleSyncPlan'

describe('userBibleSyncPlan', () => {
  it('plans simple user Bible subcollection writes', () => {
    expect(planBookmarkSync({ bookmarks: { b: {} } })).toEqual([
      { type: 'subcollection', collection: 'bookmarks', actionName: 'bookmarks_sync' },
    ])
    expect(planTagSync({ tags: { t: {} } })).toEqual([
      { type: 'subcollection', collection: 'tags', actionName: 'tags_sync' },
    ])
    expect(planStudyRelationSync({ relations: { r: {} } })).toEqual([
      { type: 'relations', actionName: 'relations_sync' },
    ])
  })

  it('plans notes and relation projections in the same retry group', () => {
    const operations = planNoteSync({ notes: { 'note-1': {} }, relations: { r1: {} } })

    expect(operations).toEqual([
      { type: 'subcollection', collection: 'notes', actionName: 'notes_sync' },
      { type: 'relations', actionName: 'notes_sync' },
    ])
    expect(groupUserBibleSyncOperations(operations)).toEqual([
      { actionName: 'notes_sync', operations },
    ])
  })

  it('plans link tag cascades as their own retry group', () => {
    const operations = planLinkSync({ links: { link: {} }, relations: { r1: {} }, tags: { t: {} } })

    expect(groupUserBibleSyncOperations(operations).map(group => group.actionName)).toEqual([
      'links_sync',
      'tags_sync_from_link',
    ])
  })

  it('plans highlight tag cascades only when highlights changed', () => {
    expect(planHighlightSync({ tags: { t: {} } })).toEqual([])
    expect(planHighlightSync({ highlights: { h: {} }, tags: { t: {} } })).toEqual([
      { type: 'subcollection', collection: 'highlights', actionName: 'highlights_sync' },
      { type: 'subcollection', collection: 'tags', actionName: 'tags_sync_from_highlight' },
    ])
  })

  it('plans word annotation cascades for tags, notes, and relations', () => {
    const operations = planWordAnnotationSync({
      wordAnnotations: { a: {} },
      tags: { t: {} },
      notes: { n: {} },
      relations: { r: {} },
    })

    expect(operations).toEqual([
      {
        type: 'subcollection',
        collection: 'wordAnnotations',
        actionName: 'word_annotations_sync',
      },
      {
        type: 'subcollection',
        collection: 'tags',
        actionName: 'tags_sync_from_word_annotation',
      },
      {
        type: 'subcollection',
        collection: 'notes',
        actionName: 'notes_sync_from_word_annotation',
      },
      { type: 'relations', actionName: 'relations_sync_from_word_annotation' },
    ])
  })

  it('plans toggleTagEntity by every changed user-data subcollection except tags special case', () => {
    const operations = planToggleTagEntitySync(
      {
        tags: { t: {} },
        highlights: { h: {} },
        relationPairs: { p: {} },
      },
      ['tags', 'tabGroups', 'highlights', 'relationPairs', 'notes']
    )

    expect(operations).toEqual([
      { type: 'subcollection', collection: 'tags', actionName: 'tags_sync_toggle' },
      {
        type: 'subcollection',
        collection: 'highlights',
        actionName: 'highlights_sync_toggle',
      },
      {
        type: 'subcollection',
        collection: 'relationPairs',
        actionName: 'relationPairs_sync_toggle',
      },
    ])
  })
})
