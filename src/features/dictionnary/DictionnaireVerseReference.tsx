import styled from '@emotion/native'
import React from 'react'

import Paragraph from '~common/ui/Paragraph'
import { CarouselConsumer } from '~helpers/CarouselContext'

interface SelectedProps {
  isSelected: boolean
}

const StyledView = styled.TouchableOpacity<SelectedProps>(({ isSelected, theme }) => ({
  backgroundColor: isSelected ? theme.colors.secondary : theme.colors.lightSecondary,
  borderRadius: 5,
  paddingLeft: 3,
  paddingRight: 3,
  marginBottom: 5,
  overflow: 'hidden',
}))

const StyledText = styled(Paragraph)<SelectedProps>(({ isSelected, theme }) => ({
  color: isSelected ? theme.colors.reverse : theme.colors.default,
}))

interface DictionnaireRefProps {
  word: string
}

const DictionnaireRef = ({ word }: DictionnaireRefProps) => {
  const lowerWord = word.toLowerCase()

  return (
    <CarouselConsumer>
      {value => {
        if (!('current' in value)) {
          return null
        }

        const isSelected = value.current === lowerWord

        return (
          <>
            <StyledView
              activeOpacity={0.5}
              onPress={() => value.setCurrent(lowerWord)}
              isSelected={isSelected}
            >
              <StyledText isSelected={isSelected}>{word}</StyledText>
            </StyledView>
            <Paragraph> </Paragraph>
          </>
        )
      }}
    </CarouselConsumer>
  )
}

export default DictionnaireRef
