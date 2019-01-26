import React from 'react'
import styled from '@emotion/native'
import { Transition } from 'react-navigation-fluid-transitions'
import Carousel from 'react-native-snap-carousel'

import verseToStrong from '@helpers/verseToStrong'
import loadStrongReferences from '@helpers/loadStrongReferences'
import loadStrongVerse from '@helpers/loadStrongVerse'

import Container from '@ui/Container'
import Box from '@ui/Box'
import Paragraph from '@ui/Paragraph'
import Header from '@components/Header'
import StrongCard from '@components/StrongCard'
import Loading from '@components/Loading'

import { viewportWidth, wp } from '@helpers/utils'

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

const StyledVerse = styled.View({
  paddingLeft: 0,
  paddingRight: 10,
  marginBottom: 5,
  flexDirection: 'row'
})

export default class BibleVerseDetailScreen extends React.Component {
  state = {
    formattedVerse: '',
    isCarouselLoading: true,
    strongReferences: []
  }

  async componentDidMount () {
    const { verse } = this.props.navigation.state.params
    const strongVerse = await loadStrongVerse(verse)
    this.formatVerse(strongVerse)
  }

  formatVerse = async strongVerse => {
    const {
      verse: { Livre }
    } = this.props.navigation.state.params
    const { formattedTexte, references } = await verseToStrong(strongVerse)
    this.setState({ formattedTexte }, async () => {
      const strongReferences = await loadStrongReferences(references, Livre)
      this.setState({ isCarouselLoading: false, strongReferences })
    })
  }

  renderItem = ({ item, index }) => (
    <StrongCard strongReference={item} index={index} />
  )

  render () {
    const {
      verse: { Livre, Chapitre, Verset, Texte }
    } = this.props.navigation.state.params
    const { isCarouselLoading } = this.state

    return (
      <Container>
        <Header hasBackButton isModal title='Détails' />
        <Box paddingTop={20} flex>
          <Transition shared={`${Livre}-${Chapitre}-${Verset}`}>
            <StyledVerse>
              <VersetWrapper>
                <NumberText>{Verset}</NumberText>
              </VersetWrapper>
              <VerseText>
                {this.state.formattedTexte || <Paragraph>{Texte}</Paragraph>}
              </VerseText>
            </StyledVerse>
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
                  marginLeft: 20,
                  overflow: 'visible',
                  flex: 1
                }}
                contentContainerCustomStyle={{ paddingVertical: 10 }}
                // slideStyle={{ flex: 1 }}
                // enableMomentum
                // decelerationRate={0.1}
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
