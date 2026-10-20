import type { ComponentProps } from 'react'
import type { FeatherIcon } from '~common/ui/Icon'

export type PersonalContent = 'highlights' | 'bookmarks' | 'notes' | 'study' | 'links' | 'tags'

/**
 * The icon of what the reader makes, the same on every surface. Its color is the universe of the
 * same name (`resolveUniverseColors`).
 */
export const personalContentIcons = {
  highlights: 'edit-3',
  bookmarks: 'bookmark',
  notes: 'file-text',
  study: 'feather',
  links: 'link',
  tags: 'tag',
} as const satisfies Record<PersonalContent, ComponentProps<typeof FeatherIcon>['name']>
