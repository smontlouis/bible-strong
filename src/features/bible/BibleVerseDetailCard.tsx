import styled from '@emotion/native'
import { withTheme } from '@emotion/react'
import React from 'react'
import Carousel from 'react-native-reanimated-carousel'
import compose from 'recompose/compose'

import waitForStrongDB from '~common/waitForStrongDB'
import loadStrongReferences from '~helpers/loadStrongReferences'
import loadStrongVerse from '~helpers/loadStrongVerse'
import verseToStrong from '~helpers/verseToStrong'

import Empty from '~common/Empty'
import Loading from '~common/Loading'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import Paragraph from '~common/ui/Paragraph'
import RoundedCorner from '~common/ui/RoundedCorner'
import StrongCard from './StrongCard'

import BibleVerseDetailFooter from './BibleVerseDetailFooter'

import { withTranslation } from 'react-i18next'
import { withNavigation } from 'react-navigation'
import countLsgChapters from '~assets/bible_versions/countLsgChapters'
import { CarouselProvider } from '~helpers/CarouselContext'
import { hp, wp } from '~helpers/utils'

const slideWidth = wp(60)
const itemHorizontalMargin = wp(2)
const itemWidth = slideWidth + itemHorizontalMargin * 2

const VerseText = styled.View(() => ({
  flex: 1,
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  flexDirection: 'row',
}))

const VersetWrapper = styled.View(() => ({
  width: 25,
  marginRight: 5,
  borderRightWidth: 3,
  borderRightColor: 'transparent',
  alignItems: 'flex-end',
}))

const NumberText = styled(Paragraph)({
  marginTop: 0,
  fontSize: 9,
  justifyContent: 'flex-end',
  marginRight: 3,
})

const StyledVerse = styled.View(({ theme }) => ({
  paddingLeft: 0,
  paddingRight: 10,
  marginBottom: 5,
  flexDirection: 'row',
}))

const CountChip = styled.View(({ theme }) => ({
  width: 14,
  height: 14,
  borderRadius: 7,
  backgroundColor: theme.colors.border,
  position: 'absolute',
  justifyContent: 'center',
  alignItems: 'center',
  bottom: -5,
  right: -5,
}))

const StyledScrollView = styled.ScrollView(({ theme }) => ({
  backgroundColor: theme.colors.lightGrey,
}))

class BibleVerseDetailCard extends React.Component {
  state = {
    error: false,
    isCarouselLoading: true,
    strongReferences: [],
    currentStrongReference: 0,
    versesInCurrentChapter: null,
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

    const versesInCurrentChapter =
      countLsgChapters[`${verse.Livre}-${verse.Chapitre}`]

    this.setState({ versesInCurrentChapter })

    this.formatVerse(strongVerse)
  }

  formatVerse = async strongVerse => {
    const {
      verse: { Livre },
    } = this.props
    const { formattedTexte, references } = await verseToStrong(strongVerse)
    this.setState({ formattedTexte }, async () => {
      const strongReferences = await loadStrongReferences(references, Livre)
      this.setState(
        {
          isCarouselLoading: false,
          strongReferences,
          currentStrongReference: strongReferences[0],
        },
        () => {
          this._carousel?.scrollTo({ index: 0, animated: false })
        }
      )
    })
  }

  findRefIndex = ref =>
    this.state.strongReferences.findIndex(r => r.Code === Number(ref))

  goToCarouselItem = ref => {
    this.setState({
      currentStrongReference: this.state.strongReferences.find(
        r => r.Code === Number(ref)
      ),
    })
  }

  onSnapToItem = index => {
    this.setState({
      currentStrongReference: this.state.strongReferences[index],
    })
  }

  renderItem = ({ item, index }) => {
    return (
      <StrongCard
        theme={this.props.theme}
        isSelectionMode={this.props.isSelectionMode}
        navigation={this.props.navigation}
        book={this.props.verse.Livre}
        strongReference={item}
        index={index}
      />
    )
  }

  render() {
    const { isCarouselLoading, versesInCurrentChapter } = this.state

    const {
      verse: { Verset },
    } = this.props

    if (this.state.error) {
      return (
        <Container>
          <Empty
            source={require('~assets/images/empty.json')}
            message={`Impossible de charger la strong pour ce verset...${
              this.state.error === 'CORRUPTED_DATABASE'
                ? t(
                    '\n\nVotre base de données semble être corrompue. Rendez-vous dans la gestion de téléchargements pour retélécharger la base de données.'
                  )
                : ''
            }`}
          />
        </Container>
      )
    }

    if (!this.state.formattedTexte) {
      return <Loading />
    }

    return (
      <StyledScrollView
        contentContainerStyle={{ paddingBottom: 20, minHeight: hp(75)  }}
        scrollIndicatorInsets={{ right: 1 }}
      >
        <Box background paddingTop={10}>
          <StyledVerse>
            <VersetWrapper>
              <NumberText>{Verset}</NumberText>
            </VersetWrapper>
            <CarouselProvider
              value={{
                currentStrongReference: this.state.currentStrongReference,
                goToCarouselItem: this.goToCarouselItem,
              }}
            >
              <VerseText>{this.state.formattedTexte}</VerseText>
            </CarouselProvider>
          </StyledVerse>
          <BibleVerseDetailFooter
            {...{
              verseNumber: Verset,
              goToNextVerse: () => {
                this.props.updateVerse(+1)
                this.setState({ isCarouselLoading: true })
              },
              goToPrevVerse: () => {
                this.props.updateVerse(-1)
                this.setState({ isCarouselLoading: true })
              },
              versesInCurrentChapter,
            }}
          />
        </Box>
        <Box bg="lightGrey">
          <RoundedCorner />
        </Box>
        <Box flex bg="lightGrey">
          {isCarouselLoading && <Loading />}
          {!isCarouselLoading && (
            <Carousel
              ref={c => {
                this._carousel = c
              }}
              mode="horizontal-stack"
              scrollAnimationDuration={300}
              width={itemWidth}
              panGestureHandlerProps={{
                activeOffsetX: [-10, 10],
              }}
              modeConfig={{
                opacityInterval: 0.8,
                scaleInterval: 0,
                stackInterval: itemWidth,
                rotateZDeg: 0,
              }}
              style={{
                marginTop: 15,
                paddingLeft: 20,
                overflow: 'visible',
                flex: 1,
              }}
              data={this.state.strongReferences}
              renderItem={this.renderItem}
              onSnapToItem={this.onSnapToItem}
              defaultIndex={this.state.strongReferences.findIndex(
                r => r.Code === this.state.currentStrongReference.Code
              )}
            />
          )}
        </Box>
      </StyledScrollView>
    )
  }
}

export default compose(
  withTheme,
  withTranslation(),
  waitForStrongDB(),
  withNavigation
)(BibleVerseDetailCard)
