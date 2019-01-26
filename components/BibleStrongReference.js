// @flow
import React from 'react'
import { pure, compose } from 'recompose'
import { withNavigation } from 'react-navigation'
import styled from '@emotion/native'

import Paragraph from '@ui/Paragraph'

const StyledText = styled(Paragraph)(({ isFromConcordance, theme }) => ({
  backgroundColor: theme.colors.border,
  paddingLeft: 3,
  paddingRight: 3,
  ...(isFromConcordance
    ? {
      color: 'red',
      fontWeight: 'bold',
      fontSize: 12
    }
    : {})
}))

const openModal = (navigation, reference, book) =>
  navigation.navigate('strongModal', { reference, book })

const BibleStrongRef = ({
  navigation,
  reference,
  word,
  book,
  isFromConcordance
}) => (
  <StyledText
    isFromConcordance={isFromConcordance}
    onPress={() => !isFromConcordance && openModal(navigation, reference, book)}
  >
    {isFromConcordance && ' '}
    {word || reference}
  </StyledText>
)

export default compose(
  withNavigation,
  pure
)(BibleStrongRef)
