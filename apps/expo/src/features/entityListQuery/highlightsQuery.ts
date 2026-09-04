import type { HighlightFilters, TagsObj, Verse, VerseIds } from '~common/types'
import { isBookInTestament } from '~helpers/bibleBookCatalog'
import type { HighlightsObj } from '~redux/modules/user'

export type GroupedHighlightData = {
  date: number
  color: string
  version?: string
  highlightsObj: Verse[]
  stringIds: VerseIds
  tags: TagsObj
}

export type GroupedHighlights = GroupedHighlightData[]

const matchesLocationFilter = (
  book: number,
  filters: Pick<HighlightFilters, 'book' | 'testament'>
): boolean => {
  if (filters.book) return book === filters.book
  if (filters.testament === 'old') return isBookInTestament(book, 'old')
  if (filters.testament === 'new') return isBookInTestament(book, 'new')
  return true
}

export const buildGroupedHighlights = (
  highlights: HighlightsObj,
  filters: HighlightFilters
): GroupedHighlights => {
  const groupsByDate = new Map<number, GroupedHighlightData>()

  for (const [highlightId, highlight] of Object.entries(highlights)) {
    if (filters.colorId && highlight.color !== filters.colorId) continue
    if (filters.tagId && !highlight.tags?.[filters.tagId]) continue

    const [Livre, Chapitre, Verset] = highlightId.split('-').map(Number)
    if (!matchesLocationFilter(Livre, filters)) continue

    let group = groupsByDate.get(highlight.date)
    if (!group) {
      group = {
        date: highlight.date,
        color: highlight.color,
        version: highlight.version,
        highlightsObj: [],
        stringIds: {},
        tags: {},
      }
      groupsByDate.set(highlight.date, group)
    }

    group.stringIds[highlightId] = true
    group.highlightsObj.push({ Livre, Chapitre, Verset, Texte: '' })
    Object.assign(group.tags, highlight.tags)
  }

  for (const group of groupsByDate.values()) {
    group.highlightsObj.sort((left, right) => Number(left.Verset) - Number(right.Verset))
  }

  return Array.from(groupsByDate.values()).sort((left, right) => right.date - left.date)
}
