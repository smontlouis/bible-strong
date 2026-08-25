import {
  removeEntityFromTagAssignments,
  removeTagAssignments,
  renameTagAssignment,
  toggleTagAssignment,
  type BibleEntityCollection,
  type BibleTagAssignmentsState,
  type TaggableEntity,
} from '../tagAssignments'

type CompleteBibleTagAssignmentsState = BibleTagAssignmentsState &
  Record<TaggableEntity, BibleEntityCollection>

const createBible = (): CompleteBibleTagAssignmentsState => ({
  tags: {
    'tag-1': { id: 'tag-1', name: 'Tag 1' },
  },
  highlights: {},
  notes: {},
  links: {},
  studies: {},
  strongsHebreu: {},
  strongsGrec: {},
  words: {},
  naves: {},
  wordAnnotations: {},
})

describe('tagAssignments', () => {
  it('assigns a tag bidirectionally to one entity', () => {
    const bible = createBible()
    bible.studies['study-1'] = { id: 'study-1', title: 'Study', tags: {} }

    toggleTagAssignment(bible, { entity: 'studies', id: 'study-1' }, 'tag-1')

    expect(bible.studies['study-1'].tags?.['tag-1']).toEqual({
      id: 'tag-1',
      name: 'Tag 1',
    })
    expect(bible.tags['tag-1'].studies?.['study-1']).toBe(true)
  })

  it('unassigns a tag bidirectionally from one entity', () => {
    const bible = createBible()
    bible.tags['tag-1'].studies = { 'study-1': true }
    bible.studies['study-1'] = {
      id: 'study-1',
      title: 'Study',
      tags: { 'tag-1': { id: 'tag-1', name: 'Tag 1' } },
    }

    toggleTagAssignment(bible, { entity: 'studies', id: 'study-1' }, 'tag-1')

    expect(bible.studies['study-1'].tags?.['tag-1']).toBeUndefined()
    expect(bible.tags['tag-1'].studies?.['study-1']).toBeUndefined()
  })

  it('uses the first id to decide a multi-entity toggle', () => {
    const bible = createBible()
    bible.tags['tag-1'].highlights = { '1-1-1': true }
    bible.highlights['1-1-1'] = {
      color: 'red',
      date: Date.now(),
      tags: { 'tag-1': { id: 'tag-1', name: 'Tag 1' } },
    }
    bible.highlights['1-1-2'] = {
      color: 'blue',
      date: Date.now(),
      tags: {},
    }

    toggleTagAssignment(
      bible,
      { entity: 'highlights', ids: { '1-1-1': true, '1-1-2': true } },
      'tag-1'
    )

    expect(bible.highlights['1-1-1'].tags?.['tag-1']).toBeUndefined()
    expect(bible.highlights['1-1-2'].tags?.['tag-1']).toBeUndefined()
    expect(bible.tags['tag-1'].highlights?.['1-1-1']).toBeUndefined()
    expect(bible.tags['tag-1'].highlights?.['1-1-2']).toBeUndefined()
  })

  it('deletes empty placeholder highlights after unassigning the last tag', () => {
    const bible = createBible()
    bible.tags['tag-1'].highlights = { '1-1-1': true }
    bible.highlights['1-1-1'] = {
      color: '',
      date: Date.now(),
      tags: { 'tag-1': { id: 'tag-1', name: 'Tag 1' } },
    }

    toggleTagAssignment(bible, { entity: 'highlights', ids: { '1-1-1': true } }, 'tag-1')

    expect(bible.highlights['1-1-1']).toBeUndefined()
  })

  it('deletes ephemeral tag-only entities after unassigning their last tag', () => {
    const bible = createBible()
    bible.tags['tag-1'].words = { alliance: true }
    bible.words.alliance = {
      id: 'alliance',
      title: 'Alliance',
      tags: { 'tag-1': { id: 'tag-1', name: 'Tag 1' } },
    }

    toggleTagAssignment(bible, { entity: 'words', id: 'alliance' }, 'tag-1')

    expect(bible.words.alliance).toBeUndefined()
  })

  it('renames embedded tag refs across taggable entities', () => {
    const bible = createBible()
    bible.studies['study-1'] = {
      id: 'study-1',
      tags: { 'tag-1': { id: 'tag-1', name: 'Tag 1' } },
    }
    bible.notes['note-1'] = {
      id: 'note-1',
      tags: { 'tag-1': { id: 'tag-1', name: 'Tag 1' } },
    }

    renameTagAssignment(bible, 'tag-1', 'Renamed')

    expect(bible.tags['tag-1'].name).toBe('Renamed')
    expect(bible.studies['study-1'].tags?.['tag-1'].name).toBe('Renamed')
    expect(bible.notes['note-1'].tags?.['tag-1'].name).toBe('Renamed')
  })

  it('removes tag refs across taggable entities', () => {
    const bible = createBible()
    bible.tags['tag-1'].notes = { 'note-1': true }
    bible.notes['note-1'] = {
      id: 'note-1',
      tags: { 'tag-1': { id: 'tag-1', name: 'Tag 1' } },
    }

    removeTagAssignments(bible, 'tag-1')

    expect(bible.tags['tag-1']).toBeUndefined()
    expect(bible.notes['note-1'].tags?.['tag-1']).toBeUndefined()
  })

  it('removes deleted entity ids from every tag index', () => {
    const bible = createBible()
    bible.tags['tag-1'].notes = { 'note-1': true, 'note-2': true }

    removeEntityFromTagAssignments(bible, 'notes', 'note-1')

    expect(bible.tags['tag-1'].notes?.['note-1']).toBeUndefined()
    expect(bible.tags['tag-1'].notes?.['note-2']).toBe(true)
  })
})
