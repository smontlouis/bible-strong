import type { BibleResource, VerseIds } from '~common/types'

export const RESOURCE_SIDEBAR_TYPES: BibleResource[] = [
  'strong',
  'dictionary',
  'nave',
  'reference',
  'commentary',
  'compare',
]
export function parseResourceSidebarParams(resourceType?: string, selectedVerses?: string) {
  const type = RESOURCE_SIDEBAR_TYPES.find(type => type === resourceType) ?? 'strong'
  let verses: VerseIds = {}
  try {
    const parsed: unknown = JSON.parse(selectedVerses ?? '{}')
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      verses = Object.fromEntries(
        Object.entries(parsed).filter(
          ([key, value]) => value === true && /^[1-9]\d*-[1-9]\d*-[1-9]\d*$/.test(key)
        )
      )
    }
  } catch {
    /* An invalid URL renders the empty state. */
  }
  return { resourceType: type, selectedVerses: verses }
}
