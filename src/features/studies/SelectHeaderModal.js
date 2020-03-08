import React from 'react'
import Modal from 'react-native-modal'

import styled from '@emotion/native'

import { getBottomSpace } from 'react-native-iphone-x-helper'
import Text from '~common/ui/Text'

const StylizedModal = styled(Modal)({
  justifyContent: 'flex-end',
  margin: 0
})

const Container = styled.View(({ theme }) => ({
  height: 150 + getBottomSpace(),
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

const headings = [
  { label: 'Normal', value: null },
  { label: 'Titre', value: 1 },
  { label: 'Sous-titre', value: 2 }
]

const ChooseHeaderModal = ({
  isOpen,
  onClosed,
  toggleHeaderModal,
  dispatchToWebView,
  activeFormats
}) => {
  return (
    <StylizedModal
      backdropOpacity={0.3}
      isVisible={isOpen}
      avoidKeyboard
      onBackButtonPress={onClosed}
      onBackdropPress={onClosed}>
      <Container>
        {headings.map(h => (
          <Touchy
            key={h.label}
            onPress={() => {
              dispatchToWebView('TOGGLE_FORMAT', {
                type: 'HEADER',
                value: h.value
              })
              onClosed()
            }}>
            <Text
              fontSize={16}
              bold
              color={activeFormats.header === h.value ? 'primary' : 'default'}>
              {h.label}
            </Text>
          </Touchy>
        ))}
      </Container>
    </StylizedModal>
  )
}

export default ChooseHeaderModal
