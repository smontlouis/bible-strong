import { atom, getDefaultStore } from 'jotai/vanilla'
import { useEffect } from 'react'
import { Sheet } from '~common/sheet'
import BibleSelect from '~features/bible/BibleSelect'
import { useSheet } from '~helpers/useSheet'
import wait from '~helpers/wait'
import { getDefaultBibleTab, useBibleTabActions } from '../../../../state/tabs'
import { selectBibleReferenceDataAtom } from './atoms'

export interface SelectBibleReferenceModalProps {
  isOpen: boolean
  onClose: () => void
}

const bibleAtom = atom(getDefaultBibleTab())

const SelectBibleReferenceModal = ({ isOpen, onClose }: SelectBibleReferenceModalProps) => {
  const actions = useBibleTabActions(bibleAtom)
  const { ref, open, close } = useSheet()

  useEffect(() => {
    if (isOpen) {
      open()
    }
  }, [isOpen, open])

  const getBibleData = async () => {
    close()
    await wait(500)
    const store = getDefaultStore()
    store.get(selectBibleReferenceDataAtom).onSelect?.(store.get(bibleAtom).data.temp)
    actions.resetTempSelected()
  }

  return (
    <Sheet ref={ref} onDismiss={onClose} snapPoints={[0.9]}>
      <BibleSelect bibleAtom={bibleAtom} onComplete={getBibleData} />
    </Sheet>
  )
}

export default SelectBibleReferenceModal
