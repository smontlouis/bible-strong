/** Fixed visual centers in the map's original 1671 × 941 coordinate system. */
export const islandActions = [
  { id: 'guestbook', x: 836, y: 465 },
  { id: 'dictionary', x: 300, y: 275 },
  { id: 'lexicon', x: 836, y: 220 },
  { id: 'references', x: 1380, y: 275 },
  { id: 'themes', x: 330, y: 650 },
  { id: 'comparison', x: 836, y: 770 },
  { id: 'commentaries', x: 1375, y: 690 },
] as const

export type IslandActionId = (typeof islandActions)[number]['id']
