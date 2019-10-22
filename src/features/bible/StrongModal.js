import React, { useState, useEffect } from 'react'
import { ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import Modal from 'react-native-modal'
import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'
import { useSelector, useDispatch } from 'react-redux'
import { getBottomSpace } from 'react-native-iphone-x-helper'
import { withNavigation } from 'react-navigation'
import compose from 'recompose/compose'

import Empty from '~common/Empty'
import loadStrongReference from '~helpers/loadStrongReference'
import verseToReference from '~helpers/verseToReference'
import TextInput from '~common/ui/TextInput'
import Text from '~common/ui/Text'
import Box from '~common/ui/Box'
import Chip from '~common/ui/Chip'
import Loading from '~common/Loading'
import { addTag, toggleTagEntity } from '~redux/modules/user'
import { hp } from '~helpers/utils'
import StrongCard from '~features/bible/StrongCard'

const StylizedModal = styled(Modal)({
  justifyContent: 'flex-end',
  margin: 0
})

const Container = styled.View(({ theme }) => ({
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

const StrongModal = ({ onClosed, theme, selectedCode = {}, navigation, version }) => {
  const [isLoading, setIsLoading] = useState(true)
  const [strongReference, setStrongReference] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (version !== 'INT') {
      onClosed()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  useEffect(() => {
    const loadStrong = async () => {
      if (selectedCode?.reference) {
        setError(false)
        setIsLoading(true)
        const strongReference = await loadStrongReference(selectedCode.reference, selectedCode.book)
        setStrongReference(strongReference)
        setIsLoading(false)

        if (strongReference.error) {
          setError(true)
          setIsLoading(false)
        }
      }
      if (!selectedCode?.reference) {
        setError(true)
      }
    }

    loadStrong()
  }, [selectedCode])

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
        {error ? (
          <Empty
            source={require('~assets/images/empty.json')}
            message="Une erreur est survenue..."
          />
        ) : isLoading ? (
          <Box flex center>
            <ActivityIndicator color={theme.colors.grey} />
          </Box>
        ) : (
          <StrongCard
            theme={theme}
            navigation={navigation}
            book={selectedCode.book}
            strongReference={strongReference}
            isModal
            onClosed={onClosed}
          />
        )}
      </Container>
    </StylizedModal>
  )
}

export default compose(withNavigation)(StrongModal)
