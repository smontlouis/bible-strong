import { useAtomValue } from 'jotai/react'
import { atom } from 'jotai/vanilla'
import React, { useEffect } from 'react'
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
  const bible = useAtomValue(bibleAtom)
  const actions = useBibleTabActions(bibleAtom)
  const [canGetData, setCanGetData] = React.useState(false)
  const { ref, open, close } = useSheet()
  const { onSelect } = useAtomValue(selectBibleReferenceDataAtom)

  useEffect(() => {
    if (isOpen) {
      open()
    }
  }, [isOpen, open])

  const getBibleData = async () => {
    close()
    await wait(500)
    // We can't retrieve latest bible data here for some reason, maybe closure
    setCanGetData(true)
  }

  // Trigger onSelect when we have the latest bible data
  useEffect(() => {
    if (canGetData && onSelect) {
      onSelect(bible.data.temp)
      setCanGetData(false)
      actions.resetTempSelected()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bible, canGetData, onSelect])

  return (
    <Sheet ref={ref} onDismiss={onClose} snapPoints={[0.9]}>
      <BibleSelect bibleAtom={bibleAtom} onComplete={getBibleData} />
    </Sheet>
  )
}

export default SelectBibleReferenceModal
