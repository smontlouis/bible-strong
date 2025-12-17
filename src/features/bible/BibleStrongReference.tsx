import styled from '@emotion/native'
import React, { memo } from 'react'

import { CarouselConsumer } from '~helpers/CarouselContext'

import Paragraph from '~common/ui/Paragraph'

const StyledView = styled.TouchableOpacity(({ isSelected, theme }: any) => ({
  backgroundColor: isSelected ? theme.colors.primary : theme.colors.lightPrimary,
  borderRadius: 5,
  paddingLeft: 3,
  paddingRight: 3,
  marginBottom: 5,
  overflow: 'hidden',
}))

const StyledCircle = styled.TouchableOpacity(({ theme, isSelected }: any) => ({
  width: 25,
  height: 25,
  borderRadius: 25 / 2,
  backgroundColor: theme.colors.lightPrimary,
  alignItems: 'center',
  justifyContent: 'center',
}))

const StyledInsideCircle = styled.View(({ theme, isSelected, isConcordance }: any) => ({
  width: 15,
  height: 15,
  borderRadius: 15 / 2,
  backgroundColor: isSelected || isConcordance ? theme.colors.primary : theme.colors.lightPrimary,
  alignItems: 'center',
  justifyContent: 'center',
}))

const StyledText = styled(Paragraph)(({ isFromConcordance, isSelected, theme }: any) => ({
  color: isSelected ? theme.colors.reverse : theme.colors.default,
  ...(isFromConcordance
    ? {
        color: 'red',
        fontWeight: 'bold',
        fontSize: 12,
      }
    : {}),
}))

const ConcordanceText = styled(Paragraph)(({ isConcordance, theme }: any) => ({
  ...(isConcordance
    ? {
        color: theme.colors.primary,
        textDecorationLine: 'underline',
        textDecorationStyle: 'solid',
        textDecorationColor: theme.colors.primary,
      }
    : {}),
}))

const BibleStrongRef = ({ small, reference, word, book, concordanceFor }: any) => {
  if (concordanceFor) {
    const isConcordance = `0${concordanceFor}` === reference || `${concordanceFor}` === reference

    if (!word && !isConcordance) {
      return null
    }

    if (!word) {
      // @ts-ignore
      return <StyledInsideCircle isConcordance={isConcordance} />
    }
    // @ts-ignore
    return (
      <ConcordanceText small={small} isConcordance={isConcordance}>
        {word}
      </ConcordanceText>
    )
  }

  return (
    <CarouselConsumer>
      {({ currentStrongReference, goToCarouselItem }: any) => {
        const isSelected =
          currentStrongReference && currentStrongReference.Code === Number(reference)
        if (!word) {
          return (
            // @ts-ignore
            <StyledCircle
              activeOpacity={0.5}
              onPress={() => goToCarouselItem(reference)}
              isSelected={isSelected}
            >
              {/* @ts-ignore */}
              <StyledInsideCircle isSelected={isSelected} />
            </StyledCircle>
          )
        }

        return (
          // @ts-ignore
          <StyledView
            activeOpacity={0.5}
            onPress={() => goToCarouselItem(reference)}
            isSelected={isSelected}
          >
            {/* @ts-ignore */}
            <StyledText isSelected={isSelected}>{word}</StyledText>
          </StyledView>
        )
      }}
    </CarouselConsumer>
  )
}

export default memo(BibleStrongRef)
