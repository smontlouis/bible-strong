import styled from '@emotion/native'
import React from 'react'

import Paragraph from '~common/ui/Paragraph'
import { CarouselConsumer } from '~helpers/CarouselContext'

const StyledView = styled.TouchableOpacity(({ isSelected, theme }) => ({
  backgroundColor: isSelected
    ? theme.colors.secondary
    : theme.colors.lightSecondary,
  borderRadius: 5,
  paddingLeft: 3,
  paddingRight: 3,
  marginBottom: 5,
  overflow: 'hidden',
}))

const StyledText = styled(Paragraph)(({ isSelected, theme }) => ({
  color: isSelected ? theme.colors.reverse : theme.colors.default,
}))

const DictionnaireRef = ({ word }) => {
  return (
    <CarouselConsumer>
      {({ current, setCurrent }) => (
        <>
          <StyledView
            activeOpacity={0.5}
            onPress={() => setCurrent(word.toLowerCase())}
            isSelected={current === word.toLowerCase()}
          >
            <StyledText isSelected={current === word.toLowerCase()}>
              {word}
            </StyledText>
          </StyledView>
          <Paragraph> </Paragraph>
        </>
      )}
    </CarouselConsumer>
  )
}

export default DictionnaireRef
