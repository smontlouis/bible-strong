import { Component, h } from 'preact'
import picostyle from 'picostyle'

import { dispatch, NAVIGATE_TO_BIBLE_VERSE_DETAIL, TOGGLE_SELECTED_VERSE } from './dispatch'
import colors from '../../../../themes/colors'
const styled = picostyle(h)

const VerseText = styled('span')({
  fontSize: '20px',
  lineHeight: '34px'
})

const NumberText = styled('span')({
  fontSize: '28px',
  padding: '0 10px'
})

const ContainerText = styled('span')(({ isFocused, isSelected, highlightedColor }) => {
  let background = 'transparent'
  if (highlightedColor && !isSelected) {
    background = colors[highlightedColor]
  }
  if (isFocused) {
    background = 'rgba(0,0,0,0.1)'
  }
  return {
    fontFamily: 'Literata Book',
    transition: 'background 0.3s ease',
    background,
    '-webkit-touch-callout': 'none',
    padding: '4px',
    borderBottom: isSelected ? '2px dashed #34495e' : 'none'
  }
})

class Verse extends Component {
  state = {
    focused: false
  }
  navigateToBibleVerseDetail = () => {
    dispatch({
      type: NAVIGATE_TO_BIBLE_VERSE_DETAIL,
      payload: this.props.verse.Verset
    })
  }

  toggleSelectVerse = () => {
    const { verse: { Livre, Chapitre, Verset } } = this.props
    dispatch({
      type: TOGGLE_SELECTED_VERSE,
      payload: `${Livre}-${Chapitre}-${Verset}`
    })
  }

  onTouchStart = () => {
    this.setState({ isFocused: true })

    // On long press
    // this.buttonPressTimer = setTimeout(this.navigateToBibleVerseDetail, 500)
  }

  onTouchEnd = () => {
    this.setState({ isFocused: false })
    clearTimeout(this.buttonPressTimer)
  }

  render ({ verse, isSelected, highlightedColor }, { isFocused }) {
    return (
      <ContainerText
        isFocused={isFocused}
        isSelected={isSelected}
        highlightedColor={highlightedColor}
        onClick={this.toggleSelectVerse}
        onTouchStart={this.onTouchStart}
        onTouchEnd={this.onTouchEnd}
      >
        <NumberText>{verse.Verset}</NumberText>
        <VerseText>{verse.Texte}</VerseText>
      </ContainerText>
    )
  }
}

export default Verse
