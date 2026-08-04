import styled from '@emotion/native'
import React from 'react'
import type { LayoutChangeEvent, TextStyle } from 'react-native'

import Paragraph from '~common/ui/Paragraph'
import { StrongResourceScrollConsumer } from './StrongResourceScrollContext'

type SelectableProps = {
  isSelected?: boolean
}

export type StrongVerseTextStyle = Pick<TextStyle, 'fontSize' | 'lineHeight'>

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
  marginHorizontal: 3,
}))

const StyledInsideCircle = styled.View<SelectableProps & { isConcordance?: boolean }>(
  ({ theme, isSelected, isConcordance }) => ({
    width: isConcordance ? 12 : 15,
    height: isConcordance ? 12 : 15,
    borderRadius: isConcordance ? 15 : 15 / 2,
    marginHorizontal: isConcordance ? 4 : 0,
    marginTop: isConcordance ? 0 : 0,
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
  textStyle?: StrongVerseTextStyle
  occurrenceIndex: number
  selectionTargets?: Array<{ reference: string; occurrenceIndex: number }>
}

const BibleStrongRef = ({
  small,
  reference,
  word,
  concordanceFor,
  textStyle,
  occurrenceIndex,
  selectionTargets,
}: BibleStrongRefProps) => {
  if (concordanceFor) {
    const isConcordance = `0${concordanceFor}` === reference || `${concordanceFor}` === reference

    if (!word && !isConcordance) {
      return null
    }

    if (!word) {
      return <StyledInsideCircle isConcordance={isConcordance} />
    }

    return (
      <ConcordanceText small={small} isConcordance={isConcordance} style={textStyle}>
        {word}
      </ConcordanceText>
    )
  }

  return (
    <StrongResourceScrollConsumer>
      {value => {
        if (!value) return null
        const { currentTarget, registerStrongWordLayout, scrollToStrongCard } = value
        const registerLayout = (event: LayoutChangeEvent) => {
          for (const target of selectionTargets ?? [{ reference, occurrenceIndex }]) {
            registerStrongWordLayout(target.occurrenceIndex, event.nativeEvent.layout.x)
          }
        }
        const isSelected = Boolean(
          currentTarget &&
          (selectionTargets ?? [{ reference, occurrenceIndex }]).some(
            target =>
              Number(currentTarget.code) === Number(target.reference) &&
              currentTarget.occurrenceIndex === target.occurrenceIndex
          )
        )
        if (!word) {
          return (
            <StyledCircle
              activeOpacity={0.5}
              onPress={() => scrollToStrongCard(reference, occurrenceIndex)}
              onLayout={registerLayout}
              isSelected={isSelected}
            >
              <StyledInsideCircle isSelected={isSelected} />
            </StyledCircle>
          )
        }

        return (
          <StyledView
            activeOpacity={0.5}
            onPress={() => scrollToStrongCard(reference, occurrenceIndex)}
            onLayout={registerLayout}
            isSelected={isSelected}
          >
            <StyledText isSelected={isSelected} style={textStyle}>
              {word}
            </StyledText>
          </StyledView>
        )
      }}
    </StrongResourceScrollConsumer>
  )
}

export default BibleStrongRef
