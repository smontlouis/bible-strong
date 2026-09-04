export const SUBCOLLECTION_NAMES = [
  'bookmarks',
  'highlights',
  'notes',
  'links',
  'relations',
  'relationIndex',
  'relationPairs',
  'tags',
  'strongsHebreu',
  'strongsGrec',
  'words',
  'naves',
  'tabGroups',
  'wordAnnotations',
] as const

export type SubcollectionName = (typeof SUBCOLLECTION_NAMES)[number]
