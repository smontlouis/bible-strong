import React from 'react'
import styled from '@emotion/native'
import { Transition } from 'react-navigation-fluid-transitions'

import getDB from '@helpers/database'
import verseToStrong from '@helpers/verseToStrong'

import Container from '@ui/Container'
import Box from '@ui/Box'
import Text from '@ui/Text'
import Header from '@components/Header'

const VerseText = styled.View(() => ({
  flex: 1,
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  flexDirection: 'row'
}))

const VersetWrapper = styled.View(({ isHighlight, isSelected, theme }) => ({
  width: 25,
  marginRight: 5,
  borderRightWidth: 3,
  borderRightColor: 'transparent',
  alignItems: 'flex-end'
}))

const NumberText = styled(Text)({
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
  state = { formattedVerse: '' }
  componentWillMount () {
    this.loadStrongVerse()
  }

  loadStrongVerse = () => {
    const {
      verse: { Livre, Chapitre, Verset }
    } = this.props.navigation.state.params

    const part = Livre > 39 ? 'LSGSNT2' : 'LSGSAT2'
    this.setState({ isLoading: true })
    getDB().transaction(
      tx => {
        tx.executeSql(
          `SELECT Texte 
            FROM ${part}
            WHERE LIVRE = ${Livre}
            AND CHAPITRE  = ${Chapitre}
            AND VERSET = ${Verset}`,
          [],
          (_, { rows: { _array } }) => {
            this.formatVerse(_array[0])
          },
          (txObj, error) => console.log(error)
        )
      },
      error => console.log('something went wrong:' + error),
      () => console.log('db transaction is a success')
    )
  }

  formatVerse (verse) {
    verseToStrong(verse)
      .then(v => this.setState({ formattedVerse: v }))
      .catch(err => console.log(err))
  }

  render () {
    const {
      verse: { Livre, Chapitre, Verset, Texte }
    } = this.props.navigation.state.params
    return (
      <Container>
        <Header hasBackButton isModal title='Détails' />
        <Box paddingTop={20}>
          <Transition appear='left'>
            <StyledVerse>
              <VersetWrapper>
                <NumberText>{Verset}</NumberText>
              </VersetWrapper>
              <VerseText>
                {this.state.formattedVerse || <Text>{Texte}</Text>}
              </VerseText>
            </StyledVerse>
          </Transition>
        </Box>
      </Container>
    )
  }
}
