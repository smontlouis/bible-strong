import React, { useState, useEffect } from 'react'
import { ActivityIndicator } from 'react-native'
import Modal from 'react-native-modal'
import styled from '@emotion/native'
import { getBottomSpace } from 'react-native-iphone-x-helper'
import { withNavigation } from 'react-navigation'
import compose from 'recompose/compose'

import waitForStrongModal from '~common/waitForStrongModal'
import Empty from '~common/Empty'
import Box from '~common/ui/Box'
import loadStrongReference from '~helpers/loadStrongReference'
import { hp } from '~helpers/utils'
import StrongCard from '~features/bible/StrongCard'

const StylizedModal = styled(Modal)({
  justifyContent: 'flex-end',
  zIndex: 10,
  margin: 0
})

const Container = styled.View(({ theme }) => ({
  height: hp(30),
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

const StrongCardWrapper = waitForStrongModal(({ theme, navigation, selectedCode, onClosed }) => {
  const [isLoading, setIsLoading] = useState(true)
  const [strongReference, setStrongReference] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const loadStrong = async () => {
      if (selectedCode?.reference) {
        setError(false)
        setIsLoading(true)
        const strongReference = await loadStrongReference(selectedCode.reference, selectedCode.book)
        setStrongReference(strongReference)

        if (strongReference?.error) {
          setError(true)
          setIsLoading(false)
          return
        }

        setIsLoading(false)
      }
      if (!selectedCode?.reference) {
        setError(true)
      }
    }

    loadStrong()
  }, [selectedCode])

  if (error) {
    return (
      <Empty source={require('~assets/images/empty.json')} message="Une erreur est survenue..." />
    )
  }

  if (isLoading) {
    return (
      <Box flex center>
        <ActivityIndicator color={theme.colors.grey} />
      </Box>
    )
  }
  return (
    <StrongCard
      theme={theme}
      navigation={navigation}
      book={selectedCode.book}
      strongReference={strongReference}
      isModal
      onClosed={onClosed}
    />
  )
})

const StrongModal = ({ onClosed, theme, selectedCode = {}, navigation, version }) => {
  useEffect(() => {
    if (version !== 'INT' || version === 'LSGS') {
      onClosed()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  return (
    <StylizedModal
      hasBackdrop={false}
      backdropOpacity={0.3}
      coverScreen={false}
      isVisible={!!selectedCode}
      onBackButtonPress={onClosed}
      // swipeDirection="down"
      // onSwipeComplete={onClosed}
      avoidKeyboard>
      <Container>
        <StrongCardWrapper {...{ theme, navigation, selectedCode, onClosed }} />
      </Container>
    </StylizedModal>
  )
}

export default compose(withNavigation)(StrongModal)
