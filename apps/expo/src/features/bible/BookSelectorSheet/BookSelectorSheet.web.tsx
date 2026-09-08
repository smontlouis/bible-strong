import { useState } from 'react'
import { useAtomValue } from 'jotai/react'
import type { RefObject } from 'react'
import type { SheetRef } from '~common/sheet'
import ContextualSheet from '~common/ContextualPanel/ContextualSheet'
import { getDefaultBibleTab } from '~state/tabs'
import { useBookPanelScreens } from '../BibleSelectorTrigger.web'
import { bookSelectorDataAtom } from './state'
export { bookSelectorDataAtom } from './state'

export default function BookSelectorSheet({
  sheetRef,
}: {
  sheetRef: RefObject<SheetRef | null>
  selectedBookNum?: number
}) {
  const state = useAtomValue(bookSelectorDataAtom)
  const [fallback] = useState(() => getDefaultBibleTab().data)
  const panel = useBookPanelScreens({ ...state, data: state.data ?? fallback })
  return (
    <ContextualSheet
      ref={sheetRef}
      panelInitialScreen="books"
      panelScreens={panel.screens}
      panelWidth={400}
      onPresent={panel.reset}
      onClose={panel.reset}
    />
  )
}
