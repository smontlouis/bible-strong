import { useImperativeHandle, useState } from 'react'
import type { SheetRef } from '~common/sheet'
import type { SelectedVersesModalProps } from './SelectedVersesModal'
import useVerseSelectionMenu from './SelectedVersesModal/useVerseSelectionMenu'
import type { BibleSelectionMenuProps } from './BibleSelectionMenu'
import { BIBLE_SELECTION_MENU_WIDTH } from './bibleSelectionMenuContent'
import useAnnotationSelectionMenu from './useAnnotationSelectionMenu'
import VerseMenu from './VerseMenu.web'

/**
 * The desktop form of the selection sheet: one menu beside the verse, showing the selected verses
 * or the annotation tools. Dragging a handle off selected verses keeps the menu open and changes
 * what it shows, as the sheet does on a phone.
 */
export default function BibleSelectionMenu({ verses, ...props }: BibleSelectionMenuProps) {
  // A reader without personal data selects nothing
  if (!verses) return null
  return <SelectionMenu {...props} verses={verses} />
}

function SelectionMenu({
  ref,
  isAnnotating,
  verses,
  annotation,
}: BibleSelectionMenuProps & { verses: SelectedVersesModalProps }) {
  // A selection made before the window grew to the desktop width opens the menu at once
  const [isRequested, setRequested] = useState(
    () => isAnnotating || Object.keys(verses.selectedVerses).length > 0
  )

  // The reader presents the menu at each change of the selection and dismisses it once empty.
  useImperativeHandle(ref, (): SheetRef => {
    const present = () => setRequested(true)
    const dismiss = () => setRequested(false)
    return {
      present,
      presentAt: present,
      resizeTo: () => {},
      dismiss,
      dismissThen: action => {
        dismiss()
        action()
      },
      close: dismiss,
      forceClose: dismiss,
    }
  })

  const versesMenu = useVerseSelectionMenu(verses, isRequested && !isAnnotating)
  const annotationMenu = useAnnotationSelectionMenu(annotation, isRequested && isAnnotating)
  const menu = isAnnotating ? annotationMenu : versesMenu

  return (
    <VerseMenu
      isRequested={isRequested}
      target={menu.target}
      accessibilityLabel={menu.accessibilityLabel}
      initialScreen="actions"
      width={BIBLE_SELECTION_MENU_WIDTH}
      screens={menu.screens}
      onOpenChange={open => {
        versesMenu.onOpenChange(open)
        annotationMenu.onOpenChange(open)
      }}
      onClose={menu.onClose}
    />
  )
}
