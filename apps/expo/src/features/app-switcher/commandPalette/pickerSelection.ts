import { paletteScopes, createScopedPassageTab } from './scopes'
import { getTabForSearchResult } from './searchResultTab'
import type { SearchItemType } from '~state/searchFilters'
import type { SearchEntityResult } from '~features/search/shared/searchResultTypes'
import type { TabItem, VersionCode } from '~state/tabs'
import generateUUID from '~helpers/generateUUID'

export function getPickerAllowedSources(scope?: string): SearchItemType[] {
  const selected = paletteScopes.find(item => item.type === scope)
  if (selected?.source) return [selected.source]
  if (scope === 'bible' || scope === 'compare') return ['passages']
  if (scope === 'commentary' || scope === 'plan' || scope === 'timeline') return [scope]
  return [
    'passages',
    'notes',
    'studies',
    'strong',
    'dictionary',
    'nave',
    'commentary',
    'plan',
    'timeline',
  ]
}

export function getPickerResultTab(
  item: SearchEntityResult,
  version: VersionCode,
  scope?: string
): TabItem | undefined {
  if (!getPickerAllowedSources(scope).includes(item.type)) return undefined
  if (item.catalogResult) return { ...item.catalogResult.tab, id: generateUUID() }
  if (item.referenceSegment)
    return createScopedPassageTab(scope === 'compare' ? 'compare' : 'bible', item, version)
  const endpoint = item.endpoint
  if (endpoint?.type === 'verse' && endpoint.verseKeys.length) {
    if (scope === 'compare')
      return {
        id: generateUUID(),
        title: item.title,
        type: 'compare',
        isRemovable: true,
        data: { selectedVerses: Object.fromEntries(endpoint.verseKeys.map(key => [key, true])) },
      }
    const [book, chapter, verse] = endpoint.verseKeys[0].split('-').map(Number)
    const verses = endpoint.verseKeys
      .map(key => key.split('-').map(Number))
      .filter(parts => parts[0] === book && parts[1] === chapter)
      .map(parts => parts[2])
    return createScopedPassageTab(
      'bible',
      {
        ...item,
        referenceSegment: {
          book,
          chapter,
          startVerse: verse,
          endVerse: Math.max(...verses),
          isWholeChapter: false,
        },
      },
      (endpoint.version as VersionCode) || version
    )
  }
  return getTabForSearchResult(item, version)
}
