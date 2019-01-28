import React, { Component } from 'react'
import styled from '@emotion/native'
import { pure, compose } from 'recompose'
import { connect } from 'react-redux'
import { Icon } from 'expo'
import { Transition } from 'react-navigation-fluid-transitions'

import Paragraph from '@ui/Paragraph'
import * as BibleActions from '@modules/bible'

const Container = styled.TouchableOpacity({
  paddingLeft: 0,
  paddingRight: 10,
  marginBottom: 5,
  flexDirection: 'row'
})

const VersetWrapper = styled.View(({ isHighlight, isSelected, theme }) => ({
  width: 25,
  marginRight: 5,
  borderRightWidth: 3,
  borderRightColor: 'transparent',
  alignItems: 'flex-end',

  ...(isHighlight
    ? {
      borderRightColor: theme.colors.secondary
    }
    : {})

  // ...(isSelected
  //   ? {
  //     borderRightColor: theme.colors.tertiary
  //   }
  //   : {})
}))

const NumberText = styled(Paragraph)({
  marginTop: 0,
  fontSize: 9,
  justifyContent: 'flex-end',
  marginRight: 3
})

const VerseText = styled(Paragraph)(({ isSelected, theme }) => ({
  flex: 1,
  ...(isSelected
    ? {
      textDecorationLine: 'underline',
      textDecorationColor: theme.colors.tertiary,
      textDecorationStyle: 'dotted'
    }
    : {})
}))

const BookMarkIcon = styled(Icon)({
  marginTop: 5,
  marginRight: 2
})

class BibleVerse extends Component {
  componentWillMount () {
    if (this.props.getPosition) setTimeout(this.getVerseMeasure)
  }

  onVersePress = () => {
    const { verse } = this.props
    this.props.setSelectedVerse(verse.Verset)
    this.props.navigation.navigate('BibleVerseDetail')
    // const {
    //   verse: { Livre, Chapitre, Verset },
    //   addSelectedVerse,
    //   removeSelectedVerse,
    //   isSelected
    // } = this.props

    // if (isSelected) {
    //   removeSelectedVerse(`${Livre}-${Chapitre}-${Verset}`)
    // } else {
    //   addSelectedVerse(`${Livre}-${Chapitre}-${Verset}`)
    // }
  }

  getVerseMeasure = () => {
    const { verse, getPosition } = this.props
    if (this.bibleVerse) {
      this.bibleVerse.measure((x, y, width, height, px, py) => {
        getPosition(verse.Verset, { x, y, width, height, px, py })
      })
    }
  }

  render () {
    const {
      verse: { Livre, Chapitre, Verset, Texte },
      isSelected,
      isHighlighted,
      isFavorited
    } = this.props
    return (
      <Transition shared={`${Livre}-${Chapitre}-${Verset}`}>
        <Container onPress={this.onVersePress} activeOpacity={0.8}>
          {Verset && (
            <VersetWrapper
              ref={r => {
                this.bibleVerse = r
              }}
              collapsable={false}
              onLayout={() => {}}
              isHighlight={isHighlighted}
              isSelected={isSelected}
            >
              <NumberText>{Verset}</NumberText>
              {isFavorited && (
                <BookMarkIcon.Feather
                  name={'bookmark'}
                  size={15}
                  color='#C22839'
                />
              )}
            </VersetWrapper>
          )}
          <VerseText isHighlight={isHighlighted} isSelected={isSelected}>
            {Texte}
          </VerseText>
        </Container>
      </Transition>
    )
  }
}

export default compose(
  pure,
  connect(
    (state, { verse: { Livre, Chapitre, Verset } }) => ({
      isSelected: !!state.bible.highlightedVerses[
        `${Livre}-${Chapitre}-${Verset}`
      ]
      // isHighlighted: !!state.getIn(['user', 'bible', 'highlights', `${Livre}-${Chapitre}-${Verset}`]),
      // isFavorited: !!state.getIn(['user', 'bible', 'favorites', `${Livre}-${Chapitre}-${Verset}`])
    }),
    { ...BibleActions }
  )
)(BibleVerse)
