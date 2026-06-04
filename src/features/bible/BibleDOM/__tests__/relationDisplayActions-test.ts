import type { VerseRelationItem } from '../BibleDOMWrapper'
import {
  NAVIGATE_TO_BIBLE_LINK,
  NAVIGATE_TO_BIBLE_NOTE,
  NAVIGATE_TO_RELATION_ENDPOINT,
  NAVIGATE_TO_VERSE_STUDY_RELATIONS,
  SHOW_TOAST,
} from '../dispatch'
import {
  getRelationItemNavigationActions,
  getVerseStudyRelationsPayload,
} from '../relationDisplayActions'

const createRelationItem = (overrides: Partial<VerseRelationItem>): VerseRelationItem => ({
  key: 'relation-1:verse:1-1-1',
  relationId: 'relation-1',
  relationType: 'linked',
  relationKind: 'manual',
  targetEndpoint: { type: 'study', studyId: 'study-1' },
  targetType: 'study',
  label: 'Study',
  targetIsAvailable: true,
  targetEntityExists: true,
  verseIds: ['1-1-1'],
  updatedAt: 1,
  ...overrides,
})

describe('relationDisplayActions', () => {
  it('builds the Relation list payload for grouped and inline Relation display', () => {
    expect(getVerseStudyRelationsPayload('1-1-1')).toBe('1-1-1')
    expect(
      getVerseStudyRelationsPayload(
        '1-1-1',
        createRelationItem({ relationId: 'relation-2', verseIds: ['1-1-1', '1-1-2'] })
      )
    ).toEqual({
      verseKey: '1-1-1',
      verseIds: ['1-1-1', '1-1-2'],
      relationId: 'relation-2',
    })
  })

  it('opens existing Note targets directly', () => {
    expect(
      getRelationItemNavigationActions(
        '1-1-1',
        createRelationItem({
          targetEndpoint: { type: 'note', noteId: 'note-1' },
          targetType: 'note',
          verseIds: ['1-1-1', '1-1-2'],
        })
      )
    ).toEqual([
      {
        type: NAVIGATE_TO_BIBLE_NOTE,
        payload: {
          noteId: 'note-1',
          verseIds: ['1-1-1', '1-1-2'],
        },
      },
    ])
  })

  it('warns and falls back to the Relation list for missing Notes', () => {
    expect(
      getRelationItemNavigationActions(
        '1-1-1',
        createRelationItem({
          targetEndpoint: { type: 'note', noteId: 'note-1' },
          targetType: 'note',
          targetEntityExists: false,
        })
      )
    ).toEqual([
      {
        type: SHOW_TOAST,
        payload: {
          type: 'warning',
          message: "Cette note n'existe plus. Vous pouvez supprimer la relation.",
        },
      },
      {
        type: NAVIGATE_TO_VERSE_STUDY_RELATIONS,
        payload: {
          verseKey: '1-1-1',
          verseIds: ['1-1-1'],
          relationId: 'relation-1',
        },
      },
    ])
  })

  it('opens existing external Links directly', () => {
    expect(
      getRelationItemNavigationActions(
        '1-1-1',
        createRelationItem({
          targetEndpoint: {
            type: 'externalLink',
            linkId: 'link-1',
            sourceKey: '',
            url: 'https://example.com',
          },
          targetType: 'externalLink',
        })
      )
    ).toEqual([{ type: NAVIGATE_TO_BIBLE_LINK, payload: 'link-1' }])
  })

  it('falls back to endpoint opening for available targets', () => {
    const item = createRelationItem({
      targetEndpoint: { type: 'strong', language: 'greek', code: '25' },
      targetType: 'strong',
    })

    expect(getRelationItemNavigationActions('1-1-1', item)).toEqual([
      { type: NAVIGATE_TO_RELATION_ENDPOINT, payload: item.targetEndpoint },
    ])
  })

  it('falls back to Relation list display for unavailable targets', () => {
    expect(
      getRelationItemNavigationActions(
        '1-1-1',
        createRelationItem({
          targetEndpoint: { type: 'study', studyId: 'missing-study' },
          targetType: 'study',
          targetIsAvailable: false,
        })
      )
    ).toEqual([
      {
        type: NAVIGATE_TO_VERSE_STUDY_RELATIONS,
        payload: {
          verseKey: '1-1-1',
          verseIds: ['1-1-1'],
          relationId: 'relation-1',
        },
      },
    ])
  })
})
