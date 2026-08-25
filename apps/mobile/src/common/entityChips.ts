import type { Tag } from './types'

export type EntityChip =
  | {
      type: 'tag'
      id: string
      label: string
    }
  | {
      type: 'relation'
      id: 'relations'
      label: string
    }

export type EntityChipListState = {
  items: EntityChip[]
  hiddenTagCount: number
  hasMoreTags: boolean
}

export const getEntityChipListState = ({
  tags,
  relationCount = 0,
  canOpenRelations = false,
  limit = 0,
  isExpanded = false,
}: {
  tags?: Record<string, Tag>
  relationCount?: number
  canOpenRelations?: boolean
  limit?: number
  isExpanded?: boolean
}): EntityChipListState => {
  const allTags = Object.values(tags || {})
  const hasTagLimit = limit > 0
  const hasMoreTags = hasTagLimit && allTags.length > limit
  const visibleTags = hasTagLimit && !isExpanded ? allTags.slice(0, limit) : allTags
  const hiddenTagCount = hasMoreTags && !isExpanded ? allTags.length - limit : 0

  return {
    hasMoreTags,
    hiddenTagCount,
    items: [
      ...visibleTags.map(tag => ({
        type: 'tag' as const,
        id: tag.id,
        label: tag.name,
      })),
      ...(relationCount > 0 && canOpenRelations
        ? [
            {
              type: 'relation' as const,
              id: 'relations' as const,
              label: String(relationCount),
            },
          ]
        : []),
    ],
  }
}
