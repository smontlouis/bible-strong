import type { SearchItemType } from '~state/searchFilters'
import type { SearchEntityResult } from '~features/search/shared/searchResultTypes'
import { getBook } from '~helpers/bibleBookCatalog'
import generateUUID from '~helpers/generateUUID'
import { getDefaultBibleTab, type TabItem, type VersionCode } from '~state/tabs'

export const paletteScopes = [
  { type: 'bible', key: 'Bible', source: undefined },
  { type: 'compare', key: 'tabs.compare', source: undefined },
  { type: 'commentary', key: 'tabs.commentary', source: undefined },
  { type: 'plan', key: 'Plans', source: undefined },
  { type: 'notes', key: 'tabs.notes', source: 'notes' },
  { type: 'study', key: 'Études', source: 'studies' },
  { type: 'strong', key: 'tabs.strong', source: 'strong' },
  { type: 'nave', key: 'tabs.nave', source: 'nave' },
  { type: 'dictionary', key: 'tabs.dictionary', source: 'dictionary' },
] as const satisfies readonly {
  type: TabItem['type']
  key: string
  source: SearchItemType | undefined
}[]
export type PaletteScope = (typeof paletteScopes)[number]
export type PassageScope = 'bible' | 'compare' | 'commentary'
export const isPassageScope = (
  scope?: PaletteScope
): scope is Extract<PaletteScope, { type: PassageScope }> =>
  scope?.type === 'bible' || scope?.type === 'compare' || scope?.type === 'commentary'

export function createScopedPassageTab(
  scope: PassageScope,
  item: SearchEntityResult,
  version: VersionCode
): TabItem | undefined {
  const reference = item.referenceSegment
  if (!reference) return undefined
  const book = getBook(reference.book)
  if (!book) return undefined
  const keys = Array.from(
    { length: reference.endVerse - reference.startVerse + 1 },
    (_, index) => `${reference.book}-${reference.chapter}-${reference.startVerse + index}`
  )
  const base = { id: generateUUID(), title: item.title, isRemovable: true }
  if (scope === 'compare')
    return {
      ...base,
      type: 'compare',
      data: { selectedVerses: Object.fromEntries(keys.map(key => [key, true])) },
    }
  if (scope === 'commentary') return { ...base, type: 'commentary', data: { verse: keys[0] } }
  const tab = getDefaultBibleTab(version)
  const selection = {
    selectedBook: book,
    selectedChapter: reference.chapter,
    selectedVerse: reference.startVerse,
  }
  return {
    ...tab,
    ...base,
    data: {
      ...tab.data,
      ...selection,
      temp: selection,
      focusVerses: reference.isWholeChapter
        ? undefined
        : keys.map((_, index) => reference.startVerse + index),
      contextDisplayMode: reference.isWholeChapter ? 'fullChapter' : 'focused',
    },
  }
}
