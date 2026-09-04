import type { Tag } from '~common/types'
import { entitiesArray } from '~redux/modules/user/tags'
import { searchWithMatches } from '~features/search/shared/searchFuzzy'
import type { TagListQueryState } from './tagListQueryState'

type TagEntityType = (typeof entitiesArray)[number]

export type TagEntityInventory = Partial<Record<TagEntityType, Readonly<Record<string, unknown>>>>

export type TagEntityCounts = Record<TagEntityType, number>

export type TagListRow = {
  id: string
  title: string
  itemCount: number
  counts: TagEntityCounts
  tag: Tag
}

const getLiveEntityIds = (
  tag: Tag,
  inventory: TagEntityInventory,
  entityType: TagEntityType
): string[] => {
  const tagReferences = tag[entityType]
  const liveEntities = inventory[entityType]
  if (!tagReferences || !liveEntities) return []

  return Object.keys(tagReferences).filter(entityId => liveEntities[entityId] !== undefined)
}

const getLiveEntitySummary = (
  tag: Tag,
  inventory: TagEntityInventory
): { counts: TagEntityCounts; itemCount: number } => {
  let itemCount = 0
  const counts = Object.fromEntries(
    entitiesArray.map(entityType => {
      const liveEntityIds = getLiveEntityIds(tag, inventory, entityType)
      itemCount += liveEntityIds.length

      if (entityType === 'highlights') {
        const highlights = inventory.highlights
        const dates = new Set(
          liveEntityIds.map(entityId => (highlights?.[entityId] as { date?: number })?.date)
        )
        return [entityType, dates.size]
      }

      return [entityType, liveEntityIds.length]
    })
  ) as TagEntityCounts

  return { counts, itemCount }
}

export const buildTagListRows = (
  tags: readonly Tag[],
  inventory: TagEntityInventory
): TagListRow[] =>
  tags
    .filter(tag => tag.id)
    .map(tag => {
      const { counts, itemCount } = getLiveEntitySummary(tag, inventory)

      return { id: tag.id, title: tag.name, itemCount, counts, tag }
    })

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
