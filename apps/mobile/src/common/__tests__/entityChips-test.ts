import { getEntityChipListState } from '../entityChips'
import type { Tag } from '../types'

const tags: Record<string, Tag> = {
  one: { id: 'one', name: 'One' },
  two: { id: 'two', name: 'Two' },
  three: { id: 'three', name: 'Three' },
}

describe('entityChips', () => {
  it('builds tag chips and relation count chips in display order', () => {
    expect(
      getEntityChipListState({
        tags,
        relationCount: 2,
        canOpenRelations: true,
      }).items
    ).toEqual([
      { type: 'tag', id: 'one', label: 'One' },
      { type: 'tag', id: 'two', label: 'Two' },
      { type: 'tag', id: 'three', label: 'Three' },
      { type: 'relation', id: 'relations', label: '2' },
    ])
  })

  it('omits relation chips when there is no action to open relations', () => {
    expect(
      getEntityChipListState({
        tags,
        relationCount: 2,
        canOpenRelations: false,
      }).items
    ).toEqual([
      { type: 'tag', id: 'one', label: 'One' },
      { type: 'tag', id: 'two', label: 'Two' },
      { type: 'tag', id: 'three', label: 'Three' },
    ])
  })

  it('limits tag chips while preserving expansion metadata', () => {
    expect(
      getEntityChipListState({
        tags,
        limit: 1,
        isExpanded: false,
      })
    ).toEqual({
      hasMoreTags: true,
      hiddenTagCount: 2,
      items: [{ type: 'tag', id: 'one', label: 'One' }],
    })
  })

  it('shows every tag when expanded', () => {
    expect(
      getEntityChipListState({
        tags,
        limit: 1,
        isExpanded: true,
      })
    ).toEqual({
      hasMoreTags: true,
      hiddenTagCount: 0,
      items: [
        { type: 'tag', id: 'one', label: 'One' },
        { type: 'tag', id: 'two', label: 'Two' },
        { type: 'tag', id: 'three', label: 'Three' },
      ],
    })
  })
})
