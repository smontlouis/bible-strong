import type { Theme } from './index'
import { colorWithOpacity } from './colorValues'

/**
 * Visual identity of each universe. State colors (selected/disabled) stay with the control.
 *
 * What the reader makes (highlights, bookmarks, notes, studies, links, tags) keeps the same
 * color in every theme where a theme token would collide: `primary` turns teal in the dark
 * themes, like links, and `quint` turns pink.
 */
export const universeColors = {
  bible: 'tertiary',
  strong: 'primary',
  dictionary: 'secondary',
  nave: 'quint',
  commentary: '#26A69A',
  references: 'quart',
  highlights: 'secondary',
  bookmarks: '#5983F0',
  notes: 'color2',
  study: 'tertiary',
  links: '#26A69A',
  tags: '#8E6CEF',
  word: 'tertiary',
  compare: 'tertiary',
  plan: 'tertiary',
  timeline: 'tertiary',
  search: 'tertiary',
  default: 'grey',
} as const satisfies Record<string, keyof Theme['colors'] | `#${string}`>

export type Universe = keyof typeof universeColors

// Names used by tabs, search results and relation endpoints refer to the same identity.
const aliases = {
  passages: 'bible',
  verse: 'bible',
  note: 'notes',
  studies: 'study',
  externalLink: 'links',
  // A word annotation is a highlight drawn on words, and is counted with them.
  annotation: 'highlights',
  highlight: 'highlights',
  bookmark: 'bookmarks',
  tag: 'tags',
  reference: 'references',
  'commentary-resource': 'commentary',
  new: 'default',
} as const satisfies Record<string, Universe>

export type UniverseItem = Universe | keyof typeof aliases

export const getUniverseColor = (item: UniverseItem): string => {
  const universe = item in aliases ? aliases[item as keyof typeof aliases] : (item as Universe)
  return universeColors[universe]
}

/** Pure resolver: also works with the palette passed across an Expo DOM boundary. */
export const resolveUniverseColors = (colors: Theme['colors'], item: UniverseItem) => {
  const token = getUniverseColor(item)
  const foreground = colors[token as keyof typeof colors] ?? token
  return { foreground, background: colorWithOpacity(foreground, 0.12)! }
}
