import React from 'react'
import styled from '@emotion/native'
import { Icon } from 'expo'
import { ScrollView, Platform } from 'react-native'
import { Transition } from 'react-navigation-fluid-transitions'

import Container from '@ui/Container'
import Text from '@ui/Text'
import Box from '@ui/Box'
import Paragraph from '@ui/Paragraph'

import StylizedHTMLView from '@components/StylizedHTMLView'
import OccurrencesFoundByBookList from '@components/OccurrencesFoundByBookList'

import capitalize from '@helpers/capitalize'
import loadStrongVersesCountByBook from '@helpers/loadStrongVersesCountByBook'

const TitleBorder = styled.View(({ theme }) => ({
  marginTop: 10,
  width: 35,
  height: 3,
  backgroundColor: theme.colors.primary
}))

const ViewItem = styled.View(() => ({
  marginTop: 15
}))

const SubTitle = styled(Text)({
  fontSize: 16,
  marginBottom: 3
})

const Word = styled(Text)({
  fontSize: 18,
  fontWeight: 'bold',
  color: '#000'
})

const CloseStrongIcon = styled.TouchableOpacity(() => ({
  marginLeft: 15,
  paddingTop: 5
}))

class BibleStrongDetailScreen extends React.Component {
  state = {
    versesCountByBook: []
  }

  async componentDidMount () {
    const {
      book,
      strongReference: { Code }
    } = this.props.navigation.state.params

    const versesCountByBook = await loadStrongVersesCountByBook(book, Code)
    this.setState({ versesCountByBook })
  }
  render () {
    const {
      strongReference: {
        Code,
        Hebreu,
        Grec,
        Mot,
        Phonetique,
        Definition,
        Origine,
        Type,
        LSG
      }
    } = this.props.navigation.state.params

    console.log(this.state.versesCountByBook)
    return (
      <Container marginTop={Platform.OS === 'ios' ? 0 : 25}>
        <Box padding={20}>
          <Transition shared={Code}>
            <Box>
              <Box row alignItems='flex-start'>
                <Text title fontSize={22} flex>
                  {capitalize(Mot)}
                  {!!Phonetique && (
                    <Text title darkGrey fontSize={16}>
                      {' '}
                      {Phonetique}
                    </Text>
                  )}
                </Text>
                <CloseStrongIcon onPress={() => this.props.navigation.goBack()}>
                  <Icon.AntDesign name='shrink' size={20} color='black' />
                </CloseStrongIcon>
              </Box>
              {!!Type && (
                <Text titleItalic darkGrey>
                  {Type}
                </Text>
              )}

              <TitleBorder />
            </Box>
          </Transition>
        </Box>
        <ScrollView flex={1} style={{ padding: 20 }}>
          <Transition anchor={Code}>
            <Box>
              {!!Hebreu && (
                <ViewItem>
                  <Paragraph darkGrey style={{ fontSize: 15 }}>
                    Mot Hébreu:&nbsp;
                    <Word>{Hebreu}</Word>
                  </Paragraph>
                </ViewItem>
              )}
              {!!Grec && (
                <ViewItem>
                  <Paragraph>
                    Mot Grec:&nbsp;
                    <Word>{Grec}</Word>
                  </Paragraph>
                </ViewItem>
              )}
              {!!Definition && (
                <ViewItem>
                  <SubTitle darkGrey>Définition - {Code}</SubTitle>
                  <StylizedHTMLView value={Definition} onLinkPress={() => {}} />
                </ViewItem>
              )}
              {!!LSG && (
                <ViewItem>
                  <SubTitle darkGrey>Généralement traduit par</SubTitle>
                  <Paragraph>{LSG}</Paragraph>
                </ViewItem>
              )}
              {!!Origine && (
                <ViewItem>
                  <SubTitle darkGrey>Origine du mot</SubTitle>
                  <StylizedHTMLView value={Origine} onLinkPress={() => {}} />
                </ViewItem>
              )}
              {this.state.versesCountByBook.length > 0 && (
                <OccurrencesFoundByBookList
                  versesCountByBook={this.state.versesCountByBook}
                />
              )}
            </Box>
          </Transition>
        </ScrollView>
      </Container>
    )
  }
}

export default BibleStrongDetailScreen
