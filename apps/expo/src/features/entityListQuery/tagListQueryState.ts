export type TagListSort = 'name-asc' | 'name-desc' | 'count-asc' | 'count-desc'

export type TagListQueryState = {
  query: string
  sort: TagListSort
}

export const defaultTagListQueryState: TagListQueryState = {
  query: '',
  sort: 'name-asc',
}

const tagListSorts: readonly TagListSort[] = ['name-asc', 'name-desc', 'count-asc', 'count-desc']

export const migrateTagListQueryState = (value: unknown): TagListQueryState => {
  if (!value || typeof value !== 'object') return defaultTagListQueryState

  const candidate = value as Partial<TagListQueryState>
  const query = typeof candidate.query === 'string' ? candidate.query : ''
  const sort = tagListSorts.includes(candidate.sort as TagListSort)
    ? (candidate.sort as TagListSort)
    : defaultTagListQueryState.sort

  return { query, sort }
}
