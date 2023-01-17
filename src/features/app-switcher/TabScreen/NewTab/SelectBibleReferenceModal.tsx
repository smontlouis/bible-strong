import { atom } from 'jotai'
import React, { useEffect } from 'react'
import { withNavigation } from 'react-navigation'
import { NavigationStackProp } from 'react-navigation-stack'
import Modal from '~common/Modal'
import BibleSelectTabNavigator from '~navigation/BibleSelectTabNavigator'
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
  const [bible, actions] = useBibleTabActions(bibleAtom)
  const [canGetData, setCanGetData] = React.useState(false)

  const getBibleData = () => {
    onClose()
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

  // This whole component is a very ugly hack using the BibleSelectTabNavigator and an on-the-fly bible atom to get a bible reference from a modal
  const screenProps = {
    mainNavigation: {
      goBack: getBibleData,
    },
    bibleAtom,
  }
  return (
    <Modal.Body
      isOpen={isOpen}
      onClose={onClose}
      withPortal
      style={{ paddingTop: 40 }}
    >
      <BibleSelectTabNavigator
        screenProps={screenProps}
        navigation={navigation}
      />
    </Modal.Body>
  )
}

export default withNavigation(SelectBibleReferenceModal)
