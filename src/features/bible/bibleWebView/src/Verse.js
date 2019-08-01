import { Component, h } from 'preact'
import picostyle, { keyframes } from 'picostyle'

import {
  dispatch,
  NAVIGATE_TO_BIBLE_VERSE_DETAIL,
  NAVIGATE_TO_VERSE_NOTES,
  TOGGLE_SELECTED_VERSE,
  NAVIGATE_TO_BIBLE_NOTE
} from './dispatch'

import { getColors } from '../../../../themes/getColors'
import NotesCount from './NotesCount'
import NotesText from './NotesText'

function convertHex (hex, opacity) {
  hex = hex.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  const result = 'rgba(' + r + ',' + g + ',' + b + ',' + opacity / 100 + ')'
  return result
}

const styled = picostyle(h)

export const scaleFontSize = (value, scale) => `${value + (scale * 0.1 * value)}px` // Scale

const VerseText = styled('span')(({ settings: { fontSizeScale } }) => ({
  fontSize: scaleFontSize(19, fontSizeScale),
  lineHeight: scaleFontSize(30, fontSizeScale)
}))

const NumberText = styled('span')(({ settings: { fontSizeScale } }) => ({
  fontSize: scaleFontSize(14, fontSizeScale)
}))

const zoom = keyframes({
  from: {
    opacity: '0.2'
  },
  to: {
    opacity: '1'
  }
})

const ContainerText = styled('span')(({ isFocused, isSelected, highlightedColor, isVerseToScroll, settings: { theme } }) => {
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
    borderBottom: isSelected ? '2px dashed rgb(52,73,94)' : 'none',
    '-moz-user-select': 'none',
    '-ms-user-select': 'none',
    '-khtml-user-select': 'none',
    '-webkit-user-select': 'none',
    ...isVerseToScroll ? {
      animation: `1s ease 0s 3 normal none running ${zoom}`
    } : {}
  }
})

const Wrapper = styled('span')(({ settings: { textDisplay } }) => ({
  display: textDisplay,
  ...textDisplay === 'block' && {
    marginBottom: '5px'
  }
}))

class Verse extends Component {
  state = {
    focused: false
  }

  componentDidMount () {
    this.detectScroll = window.addEventListener('scroll', () => { if (!this.moved) this.moved = true })
  }

  componentWillUnmount () {
    this.detectScroll = window.removeEventListener('scroll')
  }

  navigateToVerseNotes = () => {
    const { verse: { Livre, Chapitre, Verset } } = this.props
    dispatch({
      type: NAVIGATE_TO_VERSE_NOTES,
      payload: `${Livre}-${Chapitre}-${Verset}`
    })
  }

  onPress = () => {
    const { isSelectedMode, settings: { press } } = this.props

    console.log('shortpress')

    if (isSelectedMode || press === 'longPress') {
      this.toggleSelectVerse()
    } else {
      this.navigateToBibleVerseDetail()
    }
  }

  onLongPress = () => {
    const { settings: { press } } = this.props

    this.shouldShortPress = false
    console.log('longpress, moved: ', this.moved)

    if (this.moved === false) {
      if (press === 'shortPress') {
        this.toggleSelectVerse()
      } else {
        this.setState({ isFocused: false })
        this.navigateToBibleVerseDetail()
      }
    }
  }

  toggleSelectVerse = () => {
    const { verse: { Livre, Chapitre, Verset } } = this.props
    dispatch({
      type: TOGGLE_SELECTED_VERSE,
      payload: `${Livre}-${Chapitre}-${Verset}`
    })
  }

  navigateToBibleVerseDetail= () => {
    dispatch({
      type: NAVIGATE_TO_BIBLE_VERSE_DETAIL,
      payload: this.props.verse.Verset
    })
  }

  navigateToNote = (id) => {
    dispatch({
      type: NAVIGATE_TO_BIBLE_NOTE,
      payload: id
    })
  }

  onTouchStart = (e) => {
    this.shouldShortPress = true
    this.moved = false

    this.setState({ isFocused: true })

    // On long press
    this.buttonPressTimer = setTimeout(this.onLongPress, 700)
  }

  onTouchEnd = () => {
    this.setState({ isFocused: false })
    clearTimeout(this.buttonPressTimer)

    if (this.shouldShortPress && this.moved === false) {
      this.onPress()
    }
  }

  onTouchCancel = e => {
    clearTimeout(this.buttonPressTimer)
  }

  onTouchMove = (e) => {
    this.moved = true
    if (this.state.isFocused) this.setState({ isFocused: false })
  };

  render ({ verse, isSelected, highlightedColor, notesCount, settings, isVerseToScroll, notesText }, { isFocused }) {
    const inlineNotedVerses = settings.notesDisplay === 'inline'
    return (
      <Wrapper settings={settings} id={`verset-${verse.Verset}`}>
        <ContainerText
          settings={settings}
          isFocused={isFocused}
          isSelected={isSelected}
          isVerseToScroll={isVerseToScroll}
          highlightedColor={highlightedColor}
        >
          <NumberText
            settings={settings}
          >
            {verse.Verset}
            {' '}
          </NumberText>
          {
            (notesCount && !inlineNotedVerses) &&
            <NotesCount
              settings={settings}
              onClick={this.navigateToVerseNotes}
              count={notesCount}
            />
          }
          <VerseText
            settings={settings}
            onTouchStart={this.onTouchStart}
            onTouchEnd={this.onTouchEnd}
            onTouchMove={this.onTouchMove}
            onTouchCancel={this.onTouchCancel}
          >
            {verse.Texte}
          </VerseText>
        </ContainerText>
        {
          (notesText && inlineNotedVerses) &&
            <NotesText
              settings={settings}
              onClick={this.navigateToNote}
              notesText={notesText}
            />
        }
      </Wrapper>

    )
  }
}

export default Verse
