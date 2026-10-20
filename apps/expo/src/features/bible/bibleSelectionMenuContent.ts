import type { PanelScreen } from '~common/ContextualPanel/types'
import type { VerseMenuTarget } from './VerseMenu.web'

/** The desktop selection menu shows either the selected verses or the annotation tools. */
export const BIBLE_SELECTION_MENU_WIDTH = 288

/** What the desktop selection menu shows for one kind of selection, beside its verse. */
export type BibleSelectionMenuContent = {
  target: VerseMenuTarget
  accessibilityLabel: string
  screens: Record<string, PanelScreen>
  onOpenChange: (isOpen: boolean) => void
  /** The menu closed itself: Escape, or a screen that finished its task. */
  onClose: () => void
}
