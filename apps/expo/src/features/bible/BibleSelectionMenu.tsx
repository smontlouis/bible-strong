import type { RefObject } from 'react'
import type { SheetRef } from '~common/sheet'
import type { AnnotationToolbarProps } from './AnnotationControls'
import type { SelectedVersesModalProps } from './SelectedVersesModal'

export type BibleSelectionMenuProps = {
  ref: RefObject<SheetRef | null>
  isAnnotating: boolean
  verses: SelectedVersesModalProps | null
  annotation: Omit<AnnotationToolbarProps, 'ref'>
}

/** Native keeps the selection sheet; the menu is a desktop web form. */
export default function BibleSelectionMenu(_props: BibleSelectionMenuProps) {
  return null
}
