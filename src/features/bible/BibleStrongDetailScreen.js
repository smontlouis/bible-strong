import React from 'react'
import styled from '@emotion/native'
import { connect } from 'react-redux'
import * as Icon from '@expo/vector-icons'
import { Share } from 'react-native'
import compose from 'recompose/compose'

import Container from '~common/ui/Container'
import ScrollView from '~common/ui/ScrollView'
import Header from '~common/Header'
import Empty from '~common/Empty'
import Text from '~common/ui/Text'
import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import { MAX_WIDTH } from '~helpers/useDimensions'
import MultipleTagsModal from '~common/MultipleTagsModal'
import TagList from '~common/TagList'

import StylizedHTMLView from '~common/StylizedHTMLView'
import waitForStrongDB from '~common/waitForStrongDB'
import OccurrencesFoundByBookList from './OccurrencesFoundByBookList'

import capitalize from '~helpers/capitalize'
import loadStrongVersesCountByBook from '~helpers/loadStrongVersesCountByBook'
import loadStrongReference from '~helpers/loadStrongReference'
import { setHistory } from '~redux/modules/user'
import { timeout } from '~helpers/timeout'

const TitleBorder = styled.View(({ theme }) => ({
  marginTop: 10,
  width: 35,
  height: 3,
  backgroundColor: theme.colors.primary,
}))

const ViewItem = styled.View(() => ({
  marginTop: 15,
}))

const SubTitle = styled(Text)({
  fontSize: 16,
  marginBottom: 3,
})

const Word = styled(Text)(({ theme }) => ({
  fontSize: 18,
  fontWeight: 'bold',
  color: theme.colors.default,
}))

const Touchable = styled.TouchableOpacity(() => ({
  flexDirection: 'row',
  alignItems: 'flex-start',
}))

const FeatherIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.default,
}))

class BibleStrongDetailScreen extends React.Component {
  state = {
    error: false,
    strongReference: null,
    versesCountByBook: [],
    concordanceLoading: true,
    multipleTagsItem: false,
  }

  componentDidMount() {
    this.loadData()
  }

  loadData = async () => {
    const { book, reference } = this.props.navigation.state.params

    let { strongReference } = this.props.navigation.state.params
    if (reference) {
      strongReference = await loadStrongReference(reference, book)
      if (strongReference?.error) {
        this.setState({ error: strongReference.error })
        return
      }
    }

    this.props.dispatch(
      setHistory({
        ...strongReference,
        book,
        type: 'strong',
      })
    )
    this.setState({ strongReference })

    await timeout(1500)
    const versesCountByBook = await loadStrongVersesCountByBook(
      book,
      strongReference.Code
    )
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
        LSG,
      },
    } = this.state

    let toCopy = Phonetique ? `${Mot} ${Phonetique}\n` : `${Mot}`
    toCopy += Type ? `${Type}\n---\n\n` : '---\n\n'
    toCopy += Hebreu ? `Mot Hébreu: ${Hebreu}\n\n` : ''
    toCopy += Grec ? `Mot Grec: ${Grec}\n\n` : ''
    if (Definition) {
      let def = Definition.replace('<p>', '')
      def = def.replace('</p>', '')
      def = def.replace(/<\/?[^>]+><\/?[^>]+>/gi, '\n')
      def = def.replace(/<\/?[^>]+>/gi, '\n')
      toCopy += `Définition - ${Code}\n${def}\n\n`
    }
    toCopy += LSG ? `Généralement traduit par:\n${LSG}` : ''
    toCopy += '\n\n https://bible-strong.app'

    Share.share({ message: toCopy })
  }

  goBack = () => {
    this.props.navigation.goBack()
  }

  linkToStrong = (url, reference) => {
    const {
      navigation,
      navigation: {
        state: {
          params: { book },
        },
      },
    } = this.props

    navigation.navigate({
      routeName: 'BibleStrongDetail',
      params: { book, reference },
      key: `bible-strong-detail-${reference}`,
    })
  }

  setMultipleTagsItem = value => this.setState({ multipleTagsItem: value })

  render() {
    if (this.state.error) {
      return (
        <Container>
          <Header hasBackButton title="Désolé..." />
          <Empty
            source={require('~assets/images/empty.json')}
            message={`Impossible de charger la strong pour ce verset...${
              this.state.error === 'CORRUPTED_DATABASE'
                ? '\n\nVotre base de données semble être corrompue. Rendez-vous dans la gestion de téléchargements pour retélécharger la base de données.'
                : ''
            }`}
          />
        </Container>
      )
    }

    if (!this.state.strongReference) {
      return null
    }

    const {
      strongReference,
      multipleTagsItem,
      strongReference: {
        Code,
        Hebreu,
        Grec,
        Mot,
        Phonetique,
        Definition,
        Origine,
        Type,
        LSG,
      },
    } = this.state

    const { tags } = this.props

    return (
      <Container>
        <Box
          padding={20}
          maxWidth={MAX_WIDTH}
          width="100%"
          marginLeft="auto"
          marginRight="auto"
        >
          <Box>
            <Box style={{ flexDirection: 'row' }}>
              <Touchable
                onPress={() => this.props.navigation.goBack()}
                style={{ flex: 1 }}
              >
                <Text title fontSize={22} flex>
                  {capitalize(Mot)}
                  {!!Phonetique && (
                    <Text title color="darkGrey" fontSize={16}>
                      {' '}
                      {Phonetique}
                    </Text>
                  )}
                </Text>
              </Touchable>
              <Touchable
                onPress={() =>
                  this.setMultipleTagsItem({
                    id: Code,
                    title: Mot,
                    entity: Grec ? 'strongsGrec' : 'strongsHebreu',
                  })
                }
              >
                <FeatherIcon
                  style={{
                    paddingTop: 10,
                    paddingHorizontal: 5,
                    marginRight: 10,
                  }}
                  name="tag"
                  size={20}
                />
              </Touchable>
              <Touchable onPress={this.shareContent}>
                <FeatherIcon
                  style={{
                    paddingTop: 10,
                    paddingHorizontal: 5,
                    marginRight: 10,
                  }}
                  name="share-2"
                  size={20}
                />
              </Touchable>
              <Touchable onPress={this.goBack}>
                <FeatherIcon
                  style={{ paddingTop: 10, paddingHorizontal: 5 }}
                  name="minimize-2"
                  size={20}
                />
              </Touchable>
            </Box>
            {!!Type && (
              <Text titleItalic color="darkGrey">
                {Type}
              </Text>
            )}

            <TitleBorder />
          </Box>
        </Box>
        <ScrollView style={{ paddingLeft: 20, paddingRight: 20, flex: 1 }}>
          <Box>
            {tags && (
              <Box marginBottom={10}>
                <TagList tags={tags} />
              </Box>
            )}

            {!!Hebreu && (
              <ViewItem>
                <Paragraph color="darkGrey" style={{ fontSize: 15 }}>
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
                <SubTitle color="tertiary">Définition - {Code}</SubTitle>
                <StylizedHTMLView
                  value={Definition}
                  onLinkPress={this.linkToStrong}
                />
              </ViewItem>
            )}
            {!!LSG && (
              <ViewItem>
                <SubTitle color="tertiary">Généralement traduit par</SubTitle>
                <Paragraph>{LSG}</Paragraph>
              </ViewItem>
            )}
            {!!Origine && (
              <ViewItem>
                <SubTitle color="tertiary">Origine du mot</SubTitle>
                <StylizedHTMLView
                  value={Origine}
                  onLinkPress={this.linkToStrong}
                />
              </ViewItem>
            )}
            {(this.state.versesCountByBook.length > 0 ||
              this.state.concordanceLoading) && (
              <OccurrencesFoundByBookList
                strongReference={strongReference}
                navigation={this.props.navigation}
                versesCountByBook={this.state.versesCountByBook}
                loading={this.state.concordanceLoading}
              />
            )}
          </Box>
        </ScrollView>
        <MultipleTagsModal
          multiple
          item={multipleTagsItem}
          onClosed={() => this.setMultipleTagsItem(false)}
        />
      </Container>
    )
  }
}

export default compose(
  waitForStrongDB,
  connect((state, props) => {
    const { strongReference, reference, book } = props.navigation.state.params
    const code = strongReference?.Code || reference

    const strongPart = book > 39 ? 'strongsGrec' : 'strongsHebreu'
    return {
      tags: state.user.bible[strongPart][code]?.tags,
    }
  })
)(BibleStrongDetailScreen)
