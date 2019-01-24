import React from 'react'
import styled from '@emotion/native'
import { Transition } from 'react-navigation-fluid-transitions'

import Container from '@ui/Container'
import Box from '@ui/Box'
import Header from '@components/Header'

const VerseText = styled.Text(() => ({
  flex: 1
}))

const VersetWrapper = styled.View(({ isHighlight, isSelected, theme }) => ({
  width: 25,
  marginRight: 5,
  borderRightWidth: 3,
  borderRightColor: 'transparent',
  alignItems: 'flex-end'
}))

const NumberText = styled.Text({
  marginTop: 0,
  fontSize: 9,
  justifyContent: 'flex-end',
  marginRight: 3
})

const StyledVerse = styled.View({
  paddingLeft: 0,
  paddingRight: 10,
  marginBottom: 5,
  flexDirection: 'row'
})

export default class LinksScreen extends React.Component {
  render () {
    const {
      text,
      verse: { Livre, Chapitre, Verset }
    } = this.props.navigation.state.params
    return (
      <Container>
        <Header hasBackButton title='Détails' />
        <Box paddingTop={20}>
          <Transition shared={`${Livre}-${Chapitre}-${Verset}`}>
            <StyledVerse>
              <VersetWrapper>
                <NumberText>{Verset}</NumberText>
              </VersetWrapper>
              <VerseText>{text}</VerseText>
            </StyledVerse>
          </Transition>
        </Box>
      </Container>
    )
  }
}
