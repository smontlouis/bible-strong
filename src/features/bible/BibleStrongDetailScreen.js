import React from 'react'
import styled from '@emotion/native'
import { Icon } from 'expo'
import { ScrollView, Platform, Share } from 'react-native'

import Container from '~common/ui/Container'
import Text from '~common/ui/Text'
import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'

import StylizedHTMLView from '~common/StylizedHTMLView'
import waitForDB from '~common/WaitForDB'
import OccurrencesFoundByBookList from './OccurrencesFoundByBookList'

import capitalize from '~helpers/capitalize'
import loadStrongVersesCountByBook from '~helpers/loadStrongVersesCountByBook'

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

const Touchable = styled.TouchableOpacity(() => ({
  flexDirection: 'row',
  alignItems: 'flex-start'
}))

class BibleStrongDetailScreen extends React.Component {
  state = {
    versesCountByBook: [],
    concordanceLoading: true
  }

  async componentDidMount () {
    const {
      book,
      strongReference: { Code }
    } = this.props.navigation.state.params

    const versesCountByBook = await loadStrongVersesCountByBook(book, Code)
    this.setState({ versesCountByBook, concordanceLoading: false })
  }

  shareContent = () => {
    const {
      strongReference: {
        Code,
        Hebreu,
        Grec,
        Mot,
        Phonetique,
        Definition,
        Type,
        LSG
      }
    } = this.props.navigation.state.params

    let toCopy = Phonetique ? `${Mot} ${Phonetique}\n` : `${Mot}`
    toCopy += Type ? `${Type}\n---\n\n` : `---\n\n`
    toCopy += Hebreu ? `Mot Hébreu: ${Hebreu}\n\n` : ''
    toCopy += Grec ? `Mot Grec: ${Grec}\n\n` : ''
    if (Definition) {
      let def = Definition.replace('<p>', '')
      def = def.replace('</p>', '')
      def = def.replace(/<\/?[^>]+><\/?[^>]+>/ig, '\n')
      def = def.replace(/<\/?[^>]+>/ig, '\n')
      toCopy += `Définition - ${Code}\n${def}\n\n`
    }
    toCopy += LSG ? `Généralement traduit par:\n${LSG}` : ''

    Share.share({ message: toCopy })
  }

  goBack = () => {
    this.props.navigation.goBack()
  }

  render () {
    const {
      strongReference,
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

    return (
      <Container marginTop={Platform.OS === 'ios' ? 0 : 25}>
        <Box padding={20}>
          <Box>
            <Box style={{ flexDirection: 'row' }}>
              <Touchable onPress={() => this.props.navigation.goBack()} style={{ flex: 1 }}>
                <Text title fontSize={22} flex>
                  {capitalize(Mot)}
                  {!!Phonetique && (
                    <Text title darkGrey fontSize={16}>
                      {' '}
                      {Phonetique}
                    </Text>
                  )}
                </Text>
              </Touchable>
              <Touchable onPress={this.shareContent}>
                <Icon.Feather
                  style={{ paddingTop: 10, paddingHorizontal: 5, marginRight: 10 }}
                  name='share-2'
                  size={20}
                  color='black'
                />
              </Touchable>
              <Touchable onPress={this.goBack}>
                <Icon.Feather
                  style={{ paddingTop: 10, paddingHorizontal: 5 }}
                  name='minimize-2'
                  size={20}
                  color='black'
                />
              </Touchable>
            </Box>
            {!!Type && (
              <Text titleItalic darkGrey>
                {Type}
              </Text>
            )}

            <TitleBorder />
          </Box>
        </Box>
        <ScrollView flex={1} style={{ paddingLeft: 20, paddingRight: 20 }}>
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
            {(this.state.versesCountByBook.length > 0 || this.state.concordanceLoading) && (
              <OccurrencesFoundByBookList
                strongReference={strongReference}
                navigation={this.props.navigation}
                versesCountByBook={this.state.versesCountByBook}
                loading={this.state.concordanceLoading}
              />
            )}
          </Box>
        </ScrollView>
      </Container>
    )
  }
}

export default waitForDB(BibleStrongDetailScreen)
