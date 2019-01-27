// @flow
import React from 'react'
import { pure, compose } from 'recompose'
import { withNavigation } from 'react-navigation'
import styled from '@emotion/native'

import { CarouselConsumer } from '@helpers/CarouselContext'

import Paragraph from '@ui/Paragraph'

const StyledView = styled.TouchableOpacity(({ isSelected, theme }) => ({
  backgroundColor: isSelected
    ? theme.colors.primary
    : theme.colors.lightPrimary,
  borderRadius: 2,
  paddingLeft: 3,
  paddingRight: 3,
  marginBottom: 5,
  overflow: 'hidden'
}))

const StyledCircle = styled.TouchableOpacity(({ theme, isSelected }) => ({
  width: 25,
  height: 25,
  borderRadius: 25 / 2,
  backgroundColor: theme.colors.lightPrimary,
  alignItems: 'center',
  justifyContent: 'center'
}))

const StyledInsideCircle = styled.View(({ theme, isSelected }) => ({
  width: 15,
  height: 15,
  borderRadius: 15 / 2,
  backgroundColor: isSelected
    ? theme.colors.primary
    : theme.colors.lightPrimary,
  alignItems: 'center',
  justifyContent: 'center'
}))

const StyledText = styled(Paragraph)(
  ({ isFromConcordance, isSelected, theme }) => ({
    color: isSelected ? theme.colors.reverse : theme.colors.default,
    ...(isFromConcordance
      ? {
        color: 'red',
        fontWeight: 'bold',
        fontSize: 12
      }
      : {})
  })
)

const BibleStrongRef = ({
  navigation,
  reference,
  word,
  book,
  isFromConcordance
}) => (
  <CarouselConsumer>
    {({ currentStrongReference, goToCarouselItem }) => {
      const isSelected = currentStrongReference.Code === Number(reference)
      if (!word) {
        return (
          <StyledCircle
            activeOpacity={0.5}
            onPress={() => goToCarouselItem(reference)}
            isSelected={isSelected}
          >
            <StyledInsideCircle isSelected={isSelected} />
          </StyledCircle>
        )
      }

      return (
        <StyledView
          activeOpacity={0.5}
          onPress={() => goToCarouselItem(reference)}
          isSelected={isSelected}
        >
          <StyledText
            isSelected={isSelected}
            isFromConcordance={isFromConcordance}
          >
            {isFromConcordance && ' '}
            {word}
          </StyledText>
        </StyledView>
      )
    }}
  </CarouselConsumer>
)

export default compose(
  withNavigation,
  pure
)(BibleStrongRef)
