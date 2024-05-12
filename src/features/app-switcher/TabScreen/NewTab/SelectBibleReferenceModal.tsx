import { useAtomValue } from 'jotai/react'
import { atom } from 'jotai/vanilla'
import React, { useEffect } from 'react'
import { withNavigation } from 'react-navigation'
import { NavigationStackProp } from 'react-navigation-stack'
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
  navigation: NavigationStackProp
}

const bibleAtom = atom(getDefaultBibleTab())

const SelectBibleReferenceModal = ({
  isOpen,
  onClose,
  onSelect,
  navigation,
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
    navigation.navigate('Livres')
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
      withPortal
      style={{ paddingTop: 40 }}
    >
      <BibleSelect bibleAtom={bibleAtom} onComplete={getBibleData} />
    </Modal.Body>
  )
}

export default withNavigation(SelectBibleReferenceModal)
