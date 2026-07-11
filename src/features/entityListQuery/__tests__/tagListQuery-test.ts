import type { Tag } from '~common/types'
import { buildTagListRows, queryTagList, type TagEntityInventory } from '../tagListQuery'
import { defaultTagListQueryState, migrateTagListQueryState } from '../tagListQueryState'

const tags: Tag[] = [
  {
    id: 'grace',
    name: 'Grâce',
    highlights: { '1-1-1': true },
    notes: { missing: true },
  },
  {
    id: 'study-b',
    name: 'Étude',
    notes: { 'note-1': true, 'note-2': true },
  },
  {
    id: 'study-a',
    name: 'Étude',
    studies: { 'study-1': true, missing: true },
  },
]

const inventory: TagEntityInventory = {
  highlights: { '1-1-1': {} },
  notes: { 'note-1': {}, 'note-2': {} },
  studies: { 'study-1': {} },
}

describe('tag list query', () => {
  it('searches tag names with the global accent-insensitive semantics before sorting', () => {
    const rows = buildTagListRows(tags, inventory)

    expect(queryTagList(rows, { query: 'etude', sort: 'name-desc' }).map(row => row.id)).toEqual([
      'study-a',
      'study-b',
    ])
  })

  it('sorts by live attached entities and ignores stale tag references', () => {
    const rows = buildTagListRows(tags, inventory)

    expect(rows.map(row => [row.id, row.itemCount])).toEqual([
      ['grace', 1],
      ['study-b', 2],
      ['study-a', 1],
    ])
    expect(queryTagList(rows, { query: '', sort: 'count-desc' }).map(row => row.id)).toEqual([
      'study-b',
      'grace',
      'study-a',
    ])
  })

  it('uses tag identity as the deterministic tie-breaker', () => {
    const rows = buildTagListRows(tags, inventory)

    expect(queryTagList(rows, { query: '', sort: 'name-asc' }).map(row => row.id)).toEqual([
      'study-a',
      'study-b',
      'grace',
    ])
  })
})

describe('tag list query migration', () => {
  it('preserves valid persisted values and fills missing fields', () => {
    expect(migrateTagListQueryState({ query: 'grâce', sort: 'count-desc' })).toEqual({
      query: 'grâce',
      sort: 'count-desc',
    })
    expect(migrateTagListQueryState({ query: 'grâce' })).toEqual({
      query: 'grâce',
      sort: 'name-asc',
    })
  })

  it('repairs invalid persisted values without retaining unsupported state', () => {
    expect(migrateTagListQueryState({ query: 42, sort: 'recent', removed: true })).toEqual(
      defaultTagListQueryState
    )
  })
})
