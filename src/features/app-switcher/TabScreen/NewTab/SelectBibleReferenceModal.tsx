import { StackNavigationProp } from '@react-navigation/stack'
import { useAtomValue } from 'jotai/react'
import { atom } from 'jotai/vanilla'
import React, { useEffect } from 'react'
import Modal from '~common/Modal'
import BibleSelect from '~features/bible/BibleSelect'
import { useBottomSheet } from '~helpers/useBottomSheet'
import wait from '~helpers/wait'
import {
  BibleTab,
  getDefaultBibleTab,
  useBibleTabActions,
} from '../../../../state/tabs'

export interface SelectBibleReferenceModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (data: BibleTab['data']['temp']) => void
  navigation: StackNavigationProp<any, any>
}

const bibleAtom = atom(getDefaultBibleTab())

const SelectBibleReferenceModal = ({
  isOpen,
  onClose,
  onSelect,
}: SelectBibleReferenceModalProps) => {
  const bible = useAtomValue(bibleAtom)
  const actions = useBibleTabActions(bibleAtom)
  const [canGetData, setCanGetData] = React.useState(false)
  const { ref, open, close } = useBottomSheet()

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
    if (canGetData) {
      onSelect(bible.data.temp)
      setCanGetData(false)
      actions.resetTempSelected()
    }
  }, [bible, canGetData])

  return (
    <Modal.Body
      ref={ref}
      onModalClose={onClose}
      enableDynamicSizing={false}
      snapPoints={['90%']}
      withPortal
      enableScrollView={false}
    >
      <BibleSelect bibleAtom={bibleAtom} onComplete={getBibleData} />
    </Modal.Body>
  )
}

export default SelectBibleReferenceModal
