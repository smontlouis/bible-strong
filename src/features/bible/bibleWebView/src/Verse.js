import { Component, h } from 'preact'
import picostyle from 'picostyle'

import { dispatch, NAVIGATE_TO_BIBLE_VERSE_DETAIL, TOGGLE_SELECTED_VERSE } from './dispatch'
import colors from '../../../../themes/colors'
const styled = picostyle(h)

const scaleFontSize = (value, scale) => `${value + (scale * 0.1 * value)}px` // Scale

const VerseText = styled('span')(({ settings: { fontSizeScale } }) => ({
  fontSize: scaleFontSize(20, fontSizeScale),
  lineHeight: scaleFontSize(34, fontSizeScale)
}))

const NumberText = styled('span')(({ settings: { fontSizeScale } }) => ({
  fontSize: scaleFontSize(28, fontSizeScale),
  padding: '0 10px'
}))

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

  render ({ verse, isSelected, highlightedColor, settings }, { isFocused }) {
    return (
      <ContainerText
        isFocused={isFocused}
        isSelected={isSelected}
        highlightedColor={highlightedColor}
        onClick={this.toggleSelectVerse}
        onTouchStart={this.onTouchStart}
        onTouchEnd={this.onTouchEnd}
      >
        <NumberText settings={settings}>{verse.Verset}</NumberText>
        <VerseText settings={settings}>{verse.Texte}</VerseText>
      </ContainerText>
    )
  }
}

export default Verse
