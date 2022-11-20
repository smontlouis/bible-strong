import React from 'react'
import styled from '@emotion/native'
import Carousel from 'react-native-snap-carousel'
import { connect } from 'react-redux'
import compose from 'recompose/compose'
import { withTheme } from '@emotion/react'

import { getStatusBarHeight } from 'react-native-iphone-x-helper'
import verseToStrong from '~helpers/verseToStrong'
import loadStrongReferences from '~helpers/loadStrongReferences'
import loadStrongVerse from '~helpers/loadStrongVerse'
import waitForStrongDB from '~common/waitForStrongDB'
import * as BibleActions from '~redux/modules/bible'
import DictionnaryIcon from '~common/DictionnaryIcon'
import Link from '~common/Link'

import Container from '~common/ui/Container'
import RoundedCorner from '~common/ui/RoundedCorner'
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
import { withTranslation } from 'react-i18next'
import countLsgChapters from '~assets/bible_versions/countLsgChapters'

const slideWidth = wp(60)
const itemHorizontalMargin = wp(2)
const sliderWidth = viewportWidth
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

class BibleVerseDetailScreen extends React.Component {
  state = {
    error: false,
    isCarouselLoading: true,
    strongReferences: [],
    currentStrongReference: 0,
    verse: this.props.verse,
    versesInCurrentChapter: null,
  }

  componentDidMount() {
    this.loadPage()
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.verse.Verset !== this.state.verse.Verset) {
      this.loadPage()
    }
  }

  updateVerse = value => {
    this.setState(state => ({
      verse: {
        ...state.verse,
        Verset: Number(state.verse.Verset) + value,
      },
    }))
  }

  loadPage = async () => {
    const { verse } = this.state
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
          this._carousel.snapToItem(0, false)
        }
      )
    })
  }

  findRefIndex = ref =>
    this.state.strongReferences.findIndex(r => r.Code === Number(ref))

  goToCarouselItem = ref => {
    this._carousel.snapToItem(this.findRefIndex(ref))
  }

  onSnapToItem = index => {
    this.setState({
      currentStrongReference: this.state.strongReferences[index],
    })
  }

  renderItem = ({ item, index }) => {
    const { isSelectionMode } = this.props.navigation.state.params || {}
    return (
      <StrongCard
        theme={this.props.theme}
        isSelectionMode={isSelectionMode}
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
      isCarouselLoading,
      versesInCurrentChapter,
    } = this.state

    const { theme, t } = this.props

    const { title: headerTitle } = formatVerseContent([verse])

    if (this.state.error) {
      return (
        <Container>
          <Header hasBackButton title={t('Désolé...')} />
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
        contentContainerStyle={{ paddingBottom: 20 }}
        scrollIndicatorInsets={{ right: 1 }}
      >
        <Box background paddingTop={getStatusBarHeight()} />
        <Header
          fontSize={18}
          background
          hasBackButton
          title={`${headerTitle} ${
            headerTitle.length < 12 ? t('- Strong LSG') : ''
          }`}
          rightComponent={
            <Link
              route="DictionnaireVerseDetail"
              params={{ verse }}
              replace
              padding
            >
              <Box position="relative" overflow="visibility">
                <DictionnaryIcon color={theme.colors.secondary} />
              </Box>
            </Link>
          }
        />
        <Box>
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
                  this.updateVerse(+1)
                  this.setState({ isCarouselLoading: true })
                },
                goToPrevVerse: () => {
                  this.updateVerse(-1)
                  this.setState({ isCarouselLoading: true })
                },
                versesInCurrentChapter,
              }}
            />
          </Box>
          <Box grey>
            <RoundedCorner />
          </Box>
          <Box grey>
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
                }}
                contentContainerCustomStyle={{}}
                onSnapToItem={this.onSnapToItem}
                useScrollView={false}
                initialNumToRender={2}
              />
            )}
          </Box>
        </Box>
      </StyledScrollView>
    )
  }
}

export default compose(
  withTheme,
  withTranslation(),
  connect((state, ownProps) => {
    const { verse } = ownProps.navigation.state.params || {}
    return {
      verse,
    }
  }, BibleActions),
  waitForStrongDB
)(BibleVerseDetailScreen)
