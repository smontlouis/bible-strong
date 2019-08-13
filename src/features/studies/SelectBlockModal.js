import React from 'react'
import Modal from 'react-native-modal'

import styled from '@emotion/native'

import Text from '~common/ui/Text'
import { getBottomSpace } from 'react-native-iphone-x-helper'

const StylizedModal = styled(Modal)({
  justifyContent: 'flex-end',
  margin: 0
})

const Container = styled.View(({ theme }) => ({
  height: 230 + getBottomSpace(),
  display: 'flex',
  backgroundColor: theme.colors.reverse,
  borderRadius: 3,
  shadowColor: theme.colors.default,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 2,
  paddingBottom: getBottomSpace()
}))

const Touchy = styled.TouchableOpacity(({ theme }) => ({
  flex: 1,
  alignItems: 'flex-start',
  justifyContent: 'center',
  paddingLeft: 20,
  paddingRight: 20,
  borderBottomColor: theme.colors.border,
  borderBottomWidth: 1,
  overflow: 'hidden'
}))

const SelectBlockModal = ({
  isOpen,
  onClosed,
  toggleHeaderModal,
  dispatchToWebView,
  activeFormats,
  navigateBibleView
}) => {
  return (
    <StylizedModal
      backdropOpacity={0.3}
      isVisible={isOpen}
      avoidKeyboard
      onBackButtonPress={onClosed}
      onBackdropPress={onClosed}
    >
      <Container>
        <Touchy onPress={() => {
          dispatchToWebView('BLOCK_DIVIDER')
          onClosed()
        }}>
          <Text>Séparateur</Text>
        </Touchy>
        <Touchy onPress={() => navigateBibleView('verse')}>
          <Text>Insérer un lien verset</Text>
        </Touchy>
        <Touchy onPress={() => navigateBibleView('verse-block')}>
          <Text>Insérer un bloc verset</Text>
        </Touchy>
        <Touchy onPress={() => navigateBibleView('strong')}>
          <Text>Insérer un lien strong</Text>
        </Touchy>
        <Touchy onPress={() => navigateBibleView('strong-block')}>
          <Text>Insérer un bloc strong</Text>
        </Touchy>
      </Container>
    </StylizedModal>
  )
}

export default SelectBlockModal
