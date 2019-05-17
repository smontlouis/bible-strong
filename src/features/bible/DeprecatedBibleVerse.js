import React, { Component } from 'react'
import styled from '@emotion/native'
import { pure, compose } from 'recompose'
import { connect } from 'react-redux'
// import { Icon } from 'expo'

import Paragraph from '~common/ui/Paragraph'
import * as BibleActions from '~redux/modules/bible'

const Text = styled.Text({})

const NumberText = styled(Paragraph)(({ theme }) => ({
  fontWeight: 'bold'

}))

const VerseText = styled(Paragraph)(({ isSelected, theme }) => ({
  ...(isSelected
    ? {
      textDecorationLine: 'underline',
      textDecorationColor: theme.colors.tertiary,
      textDecorationStyle: 'dotted'
    }
    : {})
}))

// const BookMarkIcon = styled(Icon)({
//   marginTop: 5,
//   marginRight: 2
// })

class BibleVerse extends Component {
  componentWillMount () {
    if (this.props.getPosition) setTimeout(this.getVerseMeasure)
  }

  onVersePress = () => {
    if (this.props.isReadOnly) {
      return null
    }

    const {
      verse: { Livre, Chapitre, Verset },
      addSelectedVerse,
      removeSelectedVerse,
      isSelected
    } = this.props

    if (isSelected) {
      removeSelectedVerse(`${Livre}-${Chapitre}-${Verset}`)
    } else {
      addSelectedVerse(`${Livre}-${Chapitre}-${Verset}`)
    }
  }

  onLongVersePress = () => {
    if (this.props.isReadOnly) {
      return null
    }

    const { verse } = this.props
    this.props.setSelectedVerse(Number(verse.Verset))
    this.props.navigation.navigate('BibleVerseDetail')
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
      verse: { Verset, Texte },
      isSelected,
      isHighlighted,
      isFavorited
    } = this.props

    return (
      // <Container onPress={this.onVersePress} onLongPress={this.onLongVersePress} activeOpacity={0.8}>
      <>
        {/* {Verset && (
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
        )} */}
        { Verset && <>
          <Text>{`   `}</Text>
          <NumberText>{Verset}</NumberText>
          <Text>{` · `}</Text>
        </> }
        <VerseText onPress={this.onVersePress} isHighlight={isHighlighted} isSelected={isSelected}>
          {Texte}
        </VerseText>
        </>
    // </Container>
    )
  }
}

export default compose(
  pure,
  connect(
    (state, { verse: { Livre, Chapitre, Verset } }) => ({
      isSelected: !!state.bible.selectedVerses[
        `${Livre}-${Chapitre}-${Verset}`
      ]
      // isHighlighted: !!state.getIn(['user', 'bible', 'highlights', `${Livre}-${Chapitre}-${Verset}`]),
      // isFavorited: !!state.getIn(['user', 'bible', 'favorites', `${Livre}-${Chapitre}-${Verset}`])
    }),
    { ...BibleActions }
  )
)(BibleVerse)
