import { atom, getDefaultStore } from 'jotai/vanilla'
import { useAtomValue } from 'jotai/react'
import { useEffect, useRef } from 'react'
import ContextualSheet from '~common/ContextualPanel/ContextualSheet'
import type { SheetRef } from '~common/sheet'
import { useBookPanelScreens } from '~features/bible/BibleSelectorTrigger.web'
import { getDefaultBibleTab, useBibleTabActions } from '~state/tabs'
import { selectBibleReferenceDataAtom } from './atoms'
import type { SelectBibleReferenceModalProps } from './SelectBibleReferenceModal'
export type { SelectBibleReferenceModalProps } from './SelectBibleReferenceModal'

const bibleAtom = atom(getDefaultBibleTab())
export default function SelectBibleReferenceModal({
  isOpen,
  onClose,
}: SelectBibleReferenceModalProps) {
  const ref = useRef<SheetRef>(null)
  const bible = useAtomValue(bibleAtom)
  const actions = useBibleTabActions(bibleAtom)
  const complete = () => {
    const store = getDefaultStore()
    store.get(selectBibleReferenceDataAtom).onSelect?.(store.get(bibleAtom).data.temp)
    ref.current?.dismiss()
    actions.resetTempSelected()
  }
  const panel = useBookPanelScreens({
    data: bible.data,
    actions: { ...actions, validateTempSelected: complete },
    forceVerses: true,
    onLongSelect: (book, chapter, verse) => {
      actions.setTempSelectedBook(book)
      actions.setTempSelectedChapter(chapter)
      actions.setTempSelectedVerse(verse)
      complete()
    },
  })
  useEffect(() => {
    if (isOpen) ref.current?.present()
    else ref.current?.dismiss()
  }, [isOpen])
  return (
    <ContextualSheet
      ref={ref}
      panelInitialScreen="books"
      panelScreens={panel.screens}
      panelWidth={400}
      onPresent={panel.reset}
      onDismiss={onClose}
    />
  )
}
