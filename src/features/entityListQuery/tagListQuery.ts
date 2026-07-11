import type { Tag } from '~common/types'
import { entitiesArray } from '~redux/modules/user/tags'
import { searchWithMatches } from '~features/search/shared/searchFuzzy'
import type { TagListQueryState } from './tagListQueryState'

type TagEntityType = (typeof entitiesArray)[number]

export type TagEntityInventory = Partial<Record<TagEntityType, Readonly<Record<string, unknown>>>>

export type TagListRow = {
  id: string
  title: string
  itemCount: number
  tag: Tag
}

const getLiveItemCount = (tag: Tag, inventory: TagEntityInventory): number =>
  entitiesArray.reduce((total, entityType) => {
    const tagReferences = tag[entityType]
    const liveEntities = inventory[entityType]
    if (!tagReferences || !liveEntities) return total

    return (
      total +
      Object.keys(tagReferences).filter(entityId => liveEntities[entityId] !== undefined).length
    )
  }, 0)

export const buildTagListRows = (
  tags: readonly Tag[],
  inventory: TagEntityInventory
): TagListRow[] =>
  tags
    .filter(tag => tag.id)
    .map(tag => ({
      id: tag.id,
      title: tag.name,
      itemCount: getLiveItemCount(tag, inventory),
      tag,
    }))

const compareTitle = (left: TagListRow, right: TagListRow) =>
  left.title.localeCompare(right.title, undefined, { sensitivity: 'base' }) ||
  left.id.localeCompare(right.id)

const compareRows = (sort: TagListQueryState['sort']) => (left: TagListRow, right: TagListRow) => {
  switch (sort) {
    case 'name-desc':
      return (
        -left.title.localeCompare(right.title, undefined, { sensitivity: 'base' }) ||
        left.id.localeCompare(right.id)
      )
    case 'count-asc':
      return left.itemCount - right.itemCount || left.id.localeCompare(right.id)
    case 'count-desc':
      return right.itemCount - left.itemCount || left.id.localeCompare(right.id)
    case 'name-asc':
    default:
      return compareTitle(left, right)
  }
}

export const queryTagList = (
  rows: readonly TagListRow[],
  state: TagListQueryState
): TagListRow[] => {
  const matchingRows = state.query.trim() ? searchWithMatches([...rows], state.query) : [...rows]

  return matchingRows.sort(compareRows(state.sort))
}
