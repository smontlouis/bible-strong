import type { ReactNode, Ref } from 'react'
import type { VerseIds } from '~common/types'
import type { SheetRef } from '~common/sheet'
import type { SelectionMenu as SelectionMenuValue } from './selectionMenuContext'
import type { SelectionShortcut } from './selectionShortcuts'

export type SelectionMenuProps = {
  ref?: Ref<SheetRef>
  reference: string
  selectedVerses: VerseIds
  version: string
  /** Colors and tabs, above the actions. */
  header: ReactNode
  /** The active tab's actions. */
  children: ReactNode
  shortcuts: Partial<Record<SelectionShortcut | 'copy', (menu: SelectionMenuValue) => void>>
  onSelectStudy?: (studyId: string, format: 'inline' | 'block') => Promise<void>
  /** The menu closed: the selection is over. */
  onClose: () => void
}

/** Native keeps the selection sheet; the menu is a desktop web form. */
export default function SelectionMenu(_props: SelectionMenuProps) {
  return null
}
