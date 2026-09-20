import type { SearchItemType } from '~state/searchFilters'
import type { SearchEntityResult } from '~features/search/shared/searchResultTypes'
import type { TabItem, VersionCode } from '~state/tabs'
import { createPassageTab } from '../tabOpenRequest'

export const paletteScopes = [
  { type: 'bible', key: 'Passage', source: undefined },
  { type: 'compare', key: 'tabs.compare', source: undefined },
  { type: 'commentary', key: 'tabs.commentary', source: undefined },
  { type: 'plan', key: 'Plans & Méditations', source: undefined },
  { type: 'timeline', key: 'tabs.timeline', source: undefined },
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
export type PassageScope = 'bible' | 'compare'
export const isPassageScope = (
  scope?: PaletteScope
): scope is Extract<PaletteScope, { type: 'bible' | 'compare' }> =>
  scope?.type === 'bible' || scope?.type === 'compare'

export function createScopedPassageTab(
  scope: PassageScope,
  item: SearchEntityResult,
  version: VersionCode
): TabItem | undefined {
  const reference = item.referenceSegment
  if (!reference) return undefined
  return createPassageTab({
    tabType: scope,
    book: reference.book,
    chapter: reference.chapter,
    startVerse: reference.startVerse,
    endVerse: reference.endVerse,
    version,
    isWholeChapter: reference.isWholeChapter,
    title: item.title,
  })
}
