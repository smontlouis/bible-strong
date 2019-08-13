import React from 'react'
import styled from '@emotion/native'
import Carousel from 'react-native-snap-carousel'
import { connect } from 'react-redux'
import compose from 'recompose/compose'
import { withTheme } from 'emotion-theming'

import truncate from '~helpers/truncate'
import verseToStrong from '~helpers/verseToStrong'
import loadStrongReferences from '~helpers/loadStrongReferences'
import loadStrongVerse from '~helpers/loadStrongVerse'
import WaitForDB from '~common/WaitForDB'
import * as BibleActions from '~redux/modules/bible'

import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import Header from '~common/Header'
import Loading from '~common/Loading'
import StrongCard from './StrongCard'
import Empty from '~common/Empty'

import BibleVerseDetailFooter from './BibleVerseDetailFooter'

import { viewportWidth, wp } from '~helpers/utils'
import formatVerseContent from '~helpers/formatVerseContent'
import { CarouselProvider } from '~helpers/CarouselContext'
import loadCountVerses from '~helpers/loadCountVerses'

const slideWidth = wp(60)
const itemHorizontalMargin = wp(2)
const sliderWidth = viewportWidth
const itemWidth = slideWidth + itemHorizontalMargin * 2

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

const NumberText = styled(Paragraph)({
  marginTop: 0,
  fontSize: 9,
  justifyContent: 'flex-end',
  marginRight: 3
})

const StyledVerse = styled.View(({ theme }) => ({
  paddingLeft: 0,
  paddingRight: 10,
  marginBottom: 5,
  flexDirection: 'row'
}))

class BibleVerseDetailScreen extends React.Component {
  state = {
    error: false,
    formattedVerse: '',
    isCarouselLoading: true,
    strongReferences: [],
    currentStrongReference: 0
  }

  componentDidMount() {
    this.loadPage()
  }

  componentDidUpdate(prevProps) {
    if (prevProps.verse.Verset !== this.props.verse.Verset) {
      this.loadPage()
    }
  }

  loadPage = async () => {
    const { verse } = this.props
    const strongVerse = await loadStrongVerse(verse)

    if (!strongVerse) {
      this.setState({ error: true })
      return
    }

    const { versesInCurrentChapter } = await loadCountVerses(verse.Livre, verse.Chapitre)
    this.versesInCurrentChapter = versesInCurrentChapter
    this.formatVerse(strongVerse)
  }

  formatVerse = async strongVerse => {
    const {
      verse: { Livre }
    } = this.props
    const { formattedTexte, references } = await verseToStrong(strongVerse)
    this.setState({ formattedTexte }, async () => {
      const strongReferences = await loadStrongReferences(references, Livre)
      this.setState(
        {
          isCarouselLoading: false,
          strongReferences,
          currentStrongReference: strongReferences[0]
        },
        () => {
          this._carousel.snapToItem(0, false)
        }
      )
    })
  }

  findRefIndex = ref => this.state.strongReferences.findIndex(r => r.Code === Number(ref))

  goToCarouselItem = ref => {
    this._carousel.snapToItem(this.findRefIndex(ref))
  }

  onSnapToItem = index => {
    this.setState({
      currentStrongReference: this.state.strongReferences[index]
    })
  }

  renderItem = ({ item, index }) => {
    const params = this.props.navigation.state.params || {}
    return (
      <StrongCard
        isSelectionMode={params.isSelectionMode}
        navigation={this.props.navigation}
        book={this.props.verse.Livre}
        strongReference={item}
        index={index}
      />
    )
  }

  render() {
    const {
      verse,
      verse: { Verset },
      theme,
      goToNextVerse,
      goToPrevVerse
    } = this.props

    const { isCarouselLoading } = this.state

    const { title: headerTitle } = formatVerseContent([verse])

    if (this.state.error) {
      return (
        <Container>
          <Header noBorder hasBackButton title="Désolé..." />
          <Empty
            source={require('~assets/images/empty.json')}
            message="Impossible de charger la strong pour ce verset..."
          />
        </Container>
      )
    }

    if (!this.state.formattedTexte) {
      return <Loading />
    }

    return (
      <Container>
        <Header
          noBorder
          hasBackButton
          title={`${headerTitle} ${headerTitle.length < 20 ? '- Strong LSG' : ''}`}
        />
        <Box paddingTop={6} flex>
          <StyledVerse>
            <VersetWrapper>
              <NumberText>{Verset}</NumberText>
            </VersetWrapper>
            <CarouselProvider
              value={{
                currentStrongReference: this.state.currentStrongReference,
                goToCarouselItem: this.goToCarouselItem
              }}>
              <VerseText>{this.state.formattedTexte}</VerseText>
            </CarouselProvider>
          </StyledVerse>
          <BibleVerseDetailFooter
            {...{
              verseNumber: Verset,
              goToNextVerse: () => {
                goToNextVerse()
                this.setState({ isCarouselLoading: true })
              },
              goToPrevVerse: () => {
                goToPrevVerse()
                this.setState({ isCarouselLoading: true })
              },
              versesInCurrentChapter: this.versesInCurrentChapter
            }}
          />
          <Box flex>
            {isCarouselLoading && <Loading />}
            {!isCarouselLoading && (
              <Carousel
                ref={c => {
                  this._carousel = c
                }}
                data={this.state.strongReferences}
                renderItem={this.renderItem}
                activeSlideAlignment="start"
                sliderWidth={sliderWidth}
                itemWidth={itemWidth}
                inactiveSlideScale={1}
                inactiveSlideOpacity={0.3}
                containerCustomStyle={{
                  marginTop: 15,
                  paddingLeft: 20,
                  overflow: 'visible',
                  flex: 1,
                  borderTopColor: theme.colors.border,
                  borderTopWidth: 1
                }}
                contentContainerCustomStyle={{}}
                onSnapToItem={this.onSnapToItem}
                useScrollView={false}
                initialNumToRender={2}
              />
            )}
          </Box>
        </Box>
      </Container>
    )
  }
}

export default compose(
  withTheme,
  connect(
    ({ bible }, ownProps) => ({
      verse: {
        Livre: bible.selectedBook.Numero,
        Chapitre: bible.selectedChapter,
        Verset: bible.selectedVerse
      }
    }),
    BibleActions
  ),
  WaitForDB
)(BibleVerseDetailScreen)
