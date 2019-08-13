import React from 'react'
import Modal from 'react-native-modal'

import { withTheme } from 'emotion-theming'
import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'

import TouchableCircle from '~features/bible/TouchableCircle'
import TouchableIcon from '~features/bible/TouchableIcon'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

import Color from 'color'
import { TouchableOpacity } from 'react-native-gesture-handler'
import { getBottomSpace } from 'react-native-iphone-x-helper'

const StylizedModal = styled(Modal)({
  justifyContent: 'flex-end',
  margin: 0
})

const Container = styled.View(({ theme }) => ({
  display: 'flex',
  backgroundColor: theme.colors.reverse,
  borderRadius: 3,
  shadowColor: theme.colors.default,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 2,
  padding: 15,
  paddingBottom: getBottomSpace() || 15
}))

const colors = ['#cc0000', '#f1c232', '#6aa84f', '#45818e', '#3d85c6', '#674ea7', '#a64d79']
const lighten = ['0.3', '0.5', '0.7', '0.9']

const SelectColorModal = ({
  isOpen,
  onClosed,
  toggleHeaderModal,
  dispatchToWebView,
  activeFormats,
  navigateBibleView,
  theme
}) => {
  const setColor = (color) => {
    dispatchToWebView('TOGGLE_FORMAT', { type: isOpen === 'background' ? 'BACKGROUND' : 'COLOR', value: color })
    onClosed()
  }
  return (
    <StylizedModal
      backdropOpacity={0.3}
      isVisible={!!isOpen}
      avoidKeyboard
      onBackButtonPress={onClosed}
      onBackdropPress={onClosed}
    >
      <Container>
        <Box row marginBottom={15} padding={5} alignItems='center'>
          <Icon.Feather onPress={() => setColor(false)} name='x-circle' size={23} style={{ marginRight: 10 }} />
          <Text onPress={() => setColor(false)} fontSize={18}>Aucune</Text>
        </Box>
        {
          lighten.map((l) => (
            <Box key={l} row marginBottom={l === '0.9' ? 0 : 10}>
              {
                colors.map(c => (
                  <TouchableCircle key={c} size={27} color={Color(c).lighten(l).string()} onPress={() => setColor(Color(c).lighten(l).string())} />
                ))
              }
            </Box>
          ))

        }
      </Container>
    </StylizedModal>
  )
}

export default withTheme(SelectColorModal)
