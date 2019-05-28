import { Component, h } from 'preact'
import picostyle from 'picostyle'

import { dispatch, NAVIGATE_TO_BIBLE_VERSE_DETAIL,
  NAVIGATE_TO_VERSE_NOTES, TOGGLE_SELECTED_VERSE } from './dispatch'
import { getColors } from '../../../../themes/getColors'
import NotesCount from './NotesCount'

function convertHex (hex, opacity) {
  hex = hex.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  const result = 'rgba(' + r + ',' + g + ',' + b + ',' + opacity / 100 + ')'
  return result
}

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

const ContainerText = styled('span')(({ isFocused, isSelected, highlightedColor, settings: { theme } }) => {
  let background = 'transparent'
  if (highlightedColor && !isSelected) {
    background = `${convertHex(getColors[theme][highlightedColor], 50)}`
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

const Wrapper = styled('span')(({ settings: { textDisplay } }) => ({
  display: textDisplay
}))

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

  navigateToVerseNotes = () => {
    const { verse: { Livre, Chapitre, Verset } } = this.props
    dispatch({
      type: NAVIGATE_TO_VERSE_NOTES,
      payload: `${Livre}-${Chapitre}-${Verset}`
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

  render ({ verse, isSelected, highlightedColor, notesCount, settings }, { isFocused }) {
    return (
      <Wrapper settings={settings} id={`verset-${verse.Verset}`}>
        <ContainerText
          settings={settings}
          isFocused={isFocused}
          isSelected={isSelected}
          highlightedColor={highlightedColor}
          onTouchStart={this.onTouchStart}
          onTouchEnd={this.onTouchEnd}
        >
          <NumberText
            settings={settings}
            onClick={this.navigateToBibleVerseDetail}
          >
            {verse.Verset}
          </NumberText>
          {
            notesCount &&
            <NotesCount
              settings={settings}
              onClick={this.navigateToVerseNotes}
              count={notesCount}
            />
          }
          <VerseText
            settings={settings}
            onClick={this.toggleSelectVerse}
          >
            {verse.Texte}
          </VerseText>
        </ContainerText>
      </Wrapper>

    )
  }
}

export default Verse
