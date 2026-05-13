import styled from '@emotion/native'
import React from 'react'

import { CarouselConsumer } from '~helpers/CarouselContext'

import Paragraph from '~common/ui/Paragraph'
import type { CarouselContextValue } from '~helpers/CarouselContext'

type SelectableProps = {
  isSelected?: boolean
}

const isStrongCarouselValue = (
  value: CarouselContextValue
): value is Extract<CarouselContextValue, { currentStrongReference: unknown }> =>
  'currentStrongReference' in value

const StyledView = styled.TouchableOpacity<SelectableProps>(({ isSelected, theme }) => ({
  backgroundColor: isSelected ? theme.colors.primary : theme.colors.lightPrimary,
  borderRadius: 5,
  paddingLeft: 3,
  paddingRight: 3,
  marginBottom: 5,
  overflow: 'hidden',
}))

const StyledCircle = styled.TouchableOpacity<SelectableProps>(({ theme }) => ({
  width: 25,
  height: 25,
  borderRadius: 25 / 2,
  backgroundColor: theme.colors.lightPrimary,
  alignItems: 'center',
  justifyContent: 'center',
}))

const StyledInsideCircle = styled.View<SelectableProps & { isConcordance?: boolean }>(
  ({ theme, isSelected, isConcordance }) => ({
    width: 15,
    height: 15,
    borderRadius: 15 / 2,
    backgroundColor: isSelected || isConcordance ? theme.colors.primary : theme.colors.lightPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  })
)

const StyledText = styled(Paragraph)<SelectableProps & { isFromConcordance?: boolean }>(
  ({ isFromConcordance, isSelected, theme }) => ({
    color: isSelected ? theme.colors.reverse : theme.colors.default,
    ...(isFromConcordance
      ? {
          color: 'red',
          fontWeight: 'bold',
          fontSize: 12,
        }
      : {}),
  })
)

const ConcordanceText = styled(Paragraph)<{ isConcordance?: boolean }>(
  ({ isConcordance, theme }) => ({
    ...(isConcordance
      ? {
          color: theme.colors.primary,
          textDecorationLine: 'underline',
          textDecorationStyle: 'solid',
          textDecorationColor: theme.colors.primary,
        }
      : {}),
  })
)

type BibleStrongRefProps = {
  small?: boolean
  reference: string
  word?: string
  book?: string | number
  concordanceFor?: string | number
}

const BibleStrongRef = ({ small, reference, word, concordanceFor }: BibleStrongRefProps) => {
  if (concordanceFor) {
    const isConcordance = `0${concordanceFor}` === reference || `${concordanceFor}` === reference

    if (!word && !isConcordance) {
      return null
    }

    if (!word) {
      return <StyledInsideCircle isConcordance={isConcordance} />
    }

    return (
      <ConcordanceText small={small} isConcordance={isConcordance}>
        {word}
      </ConcordanceText>
    )
  }

  return (
    <CarouselConsumer>
      {value => {
        if (!isStrongCarouselValue(value)) return null
        const { currentStrongReference, goToCarouselItem } = value
        const isSelected = currentStrongReference
          ? Number(currentStrongReference.Code) === Number(reference)
          : false
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
            <StyledText isSelected={isSelected}>{word}</StyledText>
          </StyledView>
        )
      }}
    </CarouselConsumer>
  )
}

export default BibleStrongRef
