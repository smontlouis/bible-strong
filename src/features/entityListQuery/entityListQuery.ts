import { searchWithMatches, type SearchableTextItem } from '~features/search/shared/searchFuzzy'

export type EntityListSort =
  | 'newest'
  | 'oldest'
  | 'title-asc'
  | 'title-desc'
  | 'created-newest'
  | 'created-oldest'

export type EntityListRow = SearchableTextItem & {
  id: string
  date?: number
  createdAt?: number
}

const titleCompare = (left: EntityListRow, right: EntityListRow) =>
  left.title.localeCompare(right.title, undefined, { sensitivity: 'base' }) ||
  left.id.localeCompare(right.id)

export const queryEntityList = <T extends EntityListRow>(
  rows: readonly T[],
  state: { query: string; sort: EntityListSort }
): T[] => {
  const matching = state.query.trim() ? searchWithMatches([...rows], state.query) : [...rows]

  return matching.sort((left, right) => {
    switch (state.sort) {
      case 'oldest':
        return Number(left.date || 0) - Number(right.date || 0) || left.id.localeCompare(right.id)
      case 'title-asc':
        return titleCompare(left, right)
      case 'title-desc':
        return -titleCompare(left, right) || left.id.localeCompare(right.id)
      case 'created-newest':
        return (
          Number(right.createdAt || 0) - Number(left.createdAt || 0) ||
          left.id.localeCompare(right.id)
        )
      case 'created-oldest':
        return (
          Number(left.createdAt || 0) - Number(right.createdAt || 0) ||
          left.id.localeCompare(right.id)
        )
      case 'newest':
      default:
        return Number(right.date || 0) - Number(left.date || 0) || left.id.localeCompare(right.id)
    }
  }) as T[]
}
