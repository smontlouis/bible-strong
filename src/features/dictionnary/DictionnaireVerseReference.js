// @flow
import React from 'react'
import { compose } from 'recompose'
import { withNavigation } from 'react-navigation'
import styled from '@emotion/native'

import { CarouselConsumer } from '~helpers/CarouselContext'
import Paragraph from '~common/ui/Paragraph'

const StyledView = styled.TouchableOpacity(({ isSelected, theme }) => ({
  backgroundColor: isSelected ? theme.colors.secondary : theme.colors.lightSecondary,
  borderRadius: 5,
  paddingLeft: 3,
  paddingRight: 3,
  marginBottom: 5,
  overflow: 'hidden'
}))

const StyledText = styled(Paragraph)(({ isSelected, theme }) => ({
  color: isSelected ? theme.colors.reverse : theme.colors.default
}))

const DictionnaireRef = ({ word }) => {
  return (
    <CarouselConsumer>
      {({ current, setCurrent }) => (
        <>
          <StyledView
            activeOpacity={0.5}
            onPress={() => setCurrent(word)}
            isSelected={current === word}>
            <StyledText isSelected={current === word}>{word}</StyledText>
          </StyledView>
          <Paragraph> </Paragraph>
        </>
      )}
    </CarouselConsumer>
  )
}

export default compose(withNavigation)(DictionnaireRef)
