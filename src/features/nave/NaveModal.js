import React from 'react'
import styled from '@emotion/native'
import Modal from 'react-native-modal'
import { getBottomSpace } from 'react-native-iphone-x-helper'
import { withNavigation } from 'react-navigation'
import compose from 'recompose/compose'

import { hp } from '~helpers/utils'

import CardWrapper from './NaveModalCard'

const StylizedModal = styled(Modal)({
  justifyContent: 'flex-end',
  alignItems: 'center',
  zIndex: 10,
  margin: 0
})

const Container = styled.View(({ theme }) => ({
  maxWidth: 600,
  width: '100%',
  height: hp(40),
  backgroundColor: theme.colors.reverse,
  shadowColor: theme.colors.default,
  shadowOffset: { width: 0, height: -1 },
  shadowOpacity: 0.2,
  shadowRadius: 7,
  elevation: 2,
  paddingBottom: getBottomSpace(),
  borderTopLeftRadius: 30,
  borderTopRightRadius: 30
}))

const NaveModal = ({ onClosed, theme, selectedVerse, version }) => {
  return (
    <StylizedModal
      backdropOpacity={0.3}
      isVisible={!!selectedVerse}
      onBackdropPress={onClosed}
      onBackButtonPress={onClosed}
    >
      <Container>
        <CardWrapper {...{ theme, selectedVerse, onClosed, version }} />
      </Container>
    </StylizedModal>
  )
}

export default compose(withNavigation)(NaveModal)
