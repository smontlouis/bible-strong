import React from 'react'
import Modal from 'react-native-modal'
import * as Icon from '@expo/vector-icons'

import { withTheme } from 'emotion-theming'
import styled from '@emotion/native'

import { getBottomSpace } from 'react-native-iphone-x-helper'
import Text from '~common/ui/Text'

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
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'flex-start',
  paddingLeft: 20,
  paddingRight: 20,
  borderBottomColor: theme.colors.border,
  borderBottomWidth: 1,
  overflow: 'hidden'
}))

const SelectBlockModal = ({
  isOpen,
  onClosed,
  dispatchToWebView,
  navigateBibleView,
  theme
}) => {
  return (
    <StylizedModal
      backdropOpacity={0.3}
      isVisible={isOpen}
      avoidKeyboard
      onBackButtonPress={onClosed}
      onBackdropPress={onClosed}>
      <Container>
        <Touchy
          onPress={() => {
            dispatchToWebView('BLOCK_DIVIDER')
            onClosed()
          }}>
          <Icon.Feather size={24} name="minus" style={{ marginRight: 15 }} />
          <Text>Séparateur</Text>
        </Touchy>
        <Touchy onPress={() => navigateBibleView('verse')}>
          <Icon.Feather
            color={theme.colors.quint}
            size={24}
            name="link-2"
            style={{ marginRight: 15 }}
          />
          <Text>Insérer un lien de verset</Text>
        </Touchy>
        <Touchy onPress={() => navigateBibleView('verse-block')}>
          <Icon.MaterialCommunityIcons
            color={theme.colors.quint}
            size={24}
            name="text"
            style={{ marginRight: 15 }}
          />
          <Text>Insérer un texte de verset</Text>
        </Touchy>
        <Touchy onPress={() => navigateBibleView('strong')}>
          <Icon.Feather
            color={theme.colors.primary}
            size={24}
            name="link-2"
            style={{ marginRight: 15 }}
          />
          <Text>Insérer un lien de strong</Text>
        </Touchy>
        <Touchy onPress={() => navigateBibleView('strong-block')}>
          <Icon.MaterialCommunityIcons
            color={theme.colors.primary}
            size={24}
            name="text"
            style={{ marginRight: 15 }}
          />
          <Text>Insérer un texte de strong</Text>
        </Touchy>
      </Container>
    </StylizedModal>
  )
}

export default withTheme(SelectBlockModal)
