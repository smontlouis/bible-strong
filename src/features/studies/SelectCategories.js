import React from 'react'
import styled from '@emotion/native'
import Modal from 'react-native-modalbox'
import { ScrollView, Easing } from 'react-native'

import Box from '~common/ui/Box'
import Link from '~common/Link'
import Text from '~common/ui/Text'

const StylizedModal = styled(Modal)({
  backgroundColor: 'white',
  height: 200
})

const SelectCategories = ({ isOpen, setIsOpen }) => {
  return (
    <StylizedModal
      isOpen={isOpen}
      onClosed={() => setIsOpen(false)}
      animationDuration={300}
      position='top'
      entry='top'
      swipeToClose
      backdropOpacity={0.1}
      easing={Easing.linear}
    >
      <Text>Toutes les notes</Text>
    </StylizedModal>
  )
}

export default SelectCategories
