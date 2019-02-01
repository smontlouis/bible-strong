import React from 'react'
import styled from '@emotion/native'
import { Transition } from 'react-navigation-fluid-transitions'
import Carousel from 'react-native-snap-carousel'
import { connect } from 'react-redux'

import verseToStrong from '@helpers/verseToStrong'
import loadStrongReferences from '@helpers/loadStrongReferences'
import loadStrongVerse from '@helpers/loadStrongVerse'
import * as BibleActions from '@modules/bible'

import Container from '@ui/Container'
import Box from '@ui/Box'
import Paragraph from '@ui/Paragraph'
import Header from '@components/Header'
import StrongCard from '@components/StrongCard'
import Loading from '@components/Loading'
import BibleVerseDetailFooter from '@components/BibleVerseDetailFooter'

import { viewportWidth, wp } from '@helpers/utils'
import formatVerseContent from '@helpers/formatVerseContent'
import { CarouselProvider } from '@helpers/CarouselContext'
import loadCountVerses from '@helpers/loadCountVerses'

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

@connect(
  ({ bible }, ownProps) => ({
    verse: {
      Livre: bible.selectedBook.Numero,
      Chapitre: bible.selectedChapter,
      Verset: bible.selectedVerse
    }
  }),
  BibleActions
)
class BibleVerseDetailScreen extends React.Component {
  state = {
    formattedVerse: '',
    isCarouselLoading: true,
    strongReferences: [],
    currentStrongReference: 0
  }

  componentDidMount () {
    this.loadPage()
  }

  componentDidUpdate (prevProps) {
    if (prevProps.verse.Verset !== this.props.verse.Verset) {
      this.loadPage()
    }
  }

  loadPage = async () => {
    const { verse } = this.props
    const strongVerse = await loadStrongVerse(verse)
    const { versesInCurrentChapter } = await loadCountVerses(verse)
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
      this.setState({
        isCarouselLoading: false,
        strongReferences,
        currentStrongReference: strongReferences[0]
      })
    })
  }

  findRefIndex = ref =>
    this.state.strongReferences.findIndex(r => r.Code === Number(ref))

  goToCarouselItem = ref => {
    this._carousel.snapToItem(this.findRefIndex(ref))
  }

  onSnapToItem = index => {
    this.setState({
      currentStrongReference: this.state.strongReferences[index]
    })
  }

  renderItem = ({ item, index }) => (
    <StrongCard
      navigation={this.props.navigation}
      book={this.props.verse.Livre}
      strongReference={item}
      index={index}
    />
  )

  render () {
    const {
      verse,
      verse: { Verset },
      goToNextVerse,
      goToPrevVerse
    } = this.props

    const { isCarouselLoading } = this.state

    const { title: headerTitle } = formatVerseContent([verse])

    if (!this.state.formattedTexte) {
      return <Loading />
    }

    return (
      <Container>
        <Header noBorder hasBackButton title={headerTitle} />
        <Box paddingTop={6} flex>
          <Transition>
            <StyledVerse>
              <VersetWrapper>
                <NumberText>{Verset}</NumberText>
              </VersetWrapper>
              <CarouselProvider
                value={{
                  currentStrongReference: this.state.currentStrongReference,
                  goToCarouselItem: this.goToCarouselItem
                }}
              >
                <VerseText>{this.state.formattedTexte}</VerseText>
              </CarouselProvider>
            </StyledVerse>
          </Transition>
          <Transition>
            <BibleVerseDetailFooter
              {...{
                verseNumber: Verset,
                goToNextVerse,
                goToPrevVerse,
                versesInCurrentChapter: this.versesInCurrentChapter
              }}
            />
          </Transition>
          <Box flex>
            {isCarouselLoading && <Loading />}
            {!isCarouselLoading && (
              <Carousel
                ref={c => {
                  this._carousel = c
                }}
                data={this.state.strongReferences}
                renderItem={this.renderItem}
                activeSlideAlignment='start'
                sliderWidth={sliderWidth}
                itemWidth={itemWidth}
                inactiveSlideScale={1}
                inactiveSlideOpacity={0.3}
                containerCustomStyle={{
                  marginTop: 15,
                  paddingLeft: 20,
                  overflow: 'visible',
                  flex: 1,
                  borderTopColor: 'rgb(230,230,230)',
                  borderTopWidth: 1
                }}
                contentContainerCustomStyle={{}}
                onSnapToItem={this.onSnapToItem}
                useScrollView={false}
                initialNumToRender={2}
                // slideStyle={{ flex: 1 }}
                // enableMomentum
                // decelerationRate={0.1}
              />
            )}
          </Box>
        </Box>
      </Container>
    )
  }
}

export default BibleVerseDetailScreen
