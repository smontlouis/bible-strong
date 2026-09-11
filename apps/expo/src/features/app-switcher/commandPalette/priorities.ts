import type { TabItem } from '~state/tabs'
import type { CatalogResult } from '~features/search/discovery/catalogSearch'
import type { SearchEntityResult } from '~features/search/shared/searchResultTypes'
import type { SearchItemType } from '~state/searchFilters'

export const contentPriority: SearchItemType[] = [
  'strong',
  'dictionary',
  'nave',
  'notes',
  'studies',
  'links',
  'passages',
]
const strongKey = (value: string) => value.toUpperCase().replace(/^([GH])0+(\d)/, '$1$2')
export function tabContentKey(tab: TabItem | CatalogResult['tab']): string | undefined {
  switch (tab.type) {
    case 'notes':
      return tab.data.noteId ? `note:${tab.data.noteId}` : undefined
    case 'study':
      return tab.data.studyId ? `study:${tab.data.studyId}` : undefined
    case 'strong':
      return tab.data.reference ? `strong:${strongKey(String(tab.data.reference))}` : undefined
    case 'dictionary':
      return tab.data.word ? `dictionary:${tab.data.word.toLocaleLowerCase()}` : undefined
    case 'nave':
      return tab.data.name_lower ? `nave:${tab.data.name_lower.toLocaleLowerCase()}` : undefined
    case 'plan':
      return `plan:${tab.data.planId}`
    case 'commentary-resource':
      return `commentary:${tab.data.projectionId}`
    case 'timeline':
      return tab.data.eventSlug
        ? `event:${tab.data.eventSlug}`
        : tab.data.sectionIndex !== undefined
          ? `period:${tab.data.sectionIndex}`
          : undefined
    default:
      return undefined
  }
}
export function resultContentKey(item: SearchEntityResult): string | undefined {
  const endpoint = item.endpoint
  if (!endpoint) return undefined
  switch (endpoint.type) {
    case 'note':
      return `note:${endpoint.noteId}`
    case 'study':
      return `study:${endpoint.studyId}`
    case 'strong':
      return `strong:${strongKey(endpoint.code)}`
    case 'dictionary':
      return `dictionary:${endpoint.word.toLocaleLowerCase()}`
    case 'nave':
      return `nave:${endpoint.nameLower.toLocaleLowerCase()}`
    default:
      return undefined
  }
}
