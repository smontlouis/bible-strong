import { useRef, type RefObject } from 'react'
import Animated, { FadeIn } from 'react-native-reanimated'
import type { SheetRef } from '~common/sheet'
import type { AnnotationToolbarProps } from './AnnotationControls'
import AnnotationSheetContent from './AnnotationSheetContent'
import BibleSelectionMenu from './BibleSelectionMenu'
import PassageExportSheet from './passageExport/PassageExportSheet'
import SelectedVersesModal, { type SelectedVersesModalProps } from './SelectedVersesModal'
import Sheet from './SelectedVersesModal/SelectionSheet'
import useSelectionMenuLayout from './SelectedVersesModal/useSelectionMenuLayout'

export type BibleSelectionSheetProps = {
  ref: RefObject<SheetRef | null>
  /** Words are selected or annotations edited (annotation mode), rather than verses. */
  isAnnotating: boolean
  /** The selected verses, or nothing when the reader holds no personal data. */
  verses: Omit<SelectedVersesModalProps, 'ref' | 'onExportPassage'> | null
  annotation: Omit<AnnotationToolbarProps, 'ref'>
}

// The content that comes in fades over the one it replaces, while the sheet takes its height
const CONTENT_ENTERING = FadeIn.duration(200)

/**
 * What the reader selected in the Bible and what can be done with it: one sheet whose content
 * follows the selection, from verses to words. Dragging a handle off selected verses keeps the
 * sheet in place and changes what it shows. On desktop, one menu beside the verse instead.
 */
export default function BibleSelectionSheet({
  ref,
  isAnnotating,
  verses,
  annotation,
}: BibleSelectionSheetProps) {
  const exportSheetRef = useRef<SheetRef>(null)
  // Choosing verses for a study keeps the sheet on desktop too
  const showsMenu = useSelectionMenuLayout() && !verses?.isSelectionMode
  const versesProps = verses && {
    ...verses,
    ref,
    onExportPassage: () => exportSheetRef.current?.present(),
  }
  const exportSheet = verses && (
    <PassageExportSheet
      ref={exportSheetRef}
      sourceType="selection"
      selectedVerses={verses.selectedVerses}
      version={verses.version}
    />
  )

  if (showsMenu) {
    return (
      <>
        <BibleSelectionMenu
          ref={ref}
          isAnnotating={isAnnotating}
          verses={versesProps}
          annotation={annotation}
        />
        {exportSheet}
      </>
    )
  }

  // Swiped away: the words or the verses are let go, as the closing button of each content does
  const handleDismiss = () => {
    if (isAnnotating) annotation.onClose()
    else verses?.clearSelectedVerses()
  }

  return (
    <>
      <Sheet ref={ref} backdrop={false} onDismiss={handleDismiss}>
        {isAnnotating ? (
          <Animated.View key="annotation" entering={CONTENT_ENTERING}>
            <AnnotationSheetContent {...annotation} />
          </Animated.View>
        ) : versesProps ? (
          <Animated.View key="verses" entering={CONTENT_ENTERING}>
            <SelectedVersesModal {...versesProps} />
          </Animated.View>
        ) : null}
      </Sheet>
      {exportSheet}
    </>
  )
}
