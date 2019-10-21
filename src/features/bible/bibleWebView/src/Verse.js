import React, { Component } from 'react'
import { keyframes } from '@emotion/core'
import styled from '@emotion/styled'

import {
  dispatch,
  NAVIGATE_TO_BIBLE_VERSE_DETAIL,
  NAVIGATE_TO_VERSE_NOTES,
  TOGGLE_SELECTED_VERSE,
  NAVIGATE_TO_BIBLE_NOTE
} from './dispatch'

import NotesCount from './NotesCount'
import NotesText from './NotesText'
import InterlinearVerse from './InterlinearVerse'

function convertHex(hex, opacity) {
  hex = hex.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  const result = `rgba(${r},${g},${b},${opacity / 100})`
  return result
}

export const scaleFontSize = (value, scale) => `${value + scale * 0.1 * value}px` // Scale

const VerseText = styled('span')(({ settings: { fontSizeScale } }) => ({
  fontSize: scaleFontSize(19, fontSizeScale),
  lineHeight: scaleFontSize(30, fontSizeScale)
}))

const NumberText = styled('span')(({ settings: { fontSizeScale } }) => ({
  fontSize: scaleFontSize(14, fontSizeScale)
}))

const zoom = keyframes({
  '0%': {
    background: convertHex('#95afc0', 0)
  },
  '50%': {
    background: convertHex('#95afc0', 30)
  },
  '100%': {
    background: convertHex('#95afc0', 0)
  }
})

const ContainerText = styled('span')(
  ({ isFocused, isSelected, highlightedColor, isVerseToScroll, settings: { theme, colors } }) => {
    let background = 'transparent'
    if (highlightedColor && !isSelected) {
      background = convertHex(colors[theme][highlightedColor], 50)
    }
    if (isFocused) {
      background = 'rgba(0,0,0,0.1)'
    }
    return {
      fontFamily: 'LiterataBook',
      transition: 'background 0.3s ease',
      background,
      padding: '4px',
      borderBottom: isSelected ? '2px dashed rgb(52,73,94)' : 'none',
      WebkitTouchCallout: 'none',
      MozUserSelect: 'none',
      msUserSelect: 'none',
      KhtmlUserSelect: 'none',
      WebkitUserSelect: 'none',
      ...(isVerseToScroll
        ? {
            animation: `0.75s ease 0s 3 normal none running ${zoom}`
          }
        : {})
    }
  }
)

const Wrapper = styled('span')(({ settings: { textDisplay } }) => ({
  display: textDisplay,
  ...(textDisplay === 'block' && {
    marginBottom: '5px'
  })
}))

class Verse extends Component {
  state = {
    isFocused: false
  }

  componentDidMount() {
    this.detectScroll = window.addEventListener('scroll', () => {
      if (!this.moved) this.moved = true
    })
  }

  componentWillUnmount() {
    this.detectScroll = window.removeEventListener('scroll')
  }

  navigateToVerseNotes = () => {
    const {
      verse: { Livre, Chapitre, Verset }
    } = this.props
    dispatch({
      type: NAVIGATE_TO_VERSE_NOTES,
      payload: `${Livre}-${Chapitre}-${Verset}`
    })
  }

  navigateToBibleVerseDetail = (additionnalParams = {}) => {
    dispatch({
      type: NAVIGATE_TO_BIBLE_VERSE_DETAIL,
      params: {
        ...additionnalParams,
        verse: this.props.verse
      }
    })
  }

  navigateToNote = id => {
    dispatch({
      type: NAVIGATE_TO_BIBLE_NOTE,
      payload: id
    })
  }

  onPress = () => {
    const {
      isSelectedMode,
      isSelectionMode,
      settings: { press }
    } = this.props

    // If selection mode verse, always toggle on press
    if (isSelectionMode && isSelectionMode.includes('verse')) {
      this.toggleSelectVerse()
      return
    }

    // If selection mode verse, always toggle on press
    if (isSelectionMode && isSelectionMode.includes('strong')) {
      this.navigateToBibleVerseDetail({ isSelectionMode })
      return
    }

    if (isSelectedMode || press === 'longPress') {
      this.toggleSelectVerse()
    } else {
      this.navigateToBibleVerseDetail()
    }
  }

  onLongPress = () => {
    const {
      settings: { press },
      isSelectionMode
    } = this.props

    // If selection mode, do nothing on long press
    if (isSelectionMode) {
      return
    }

    this.shouldShortPress = false

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
    const {
      verse: { Livre, Chapitre, Verset }
    } = this.props
    dispatch({
      type: TOGGLE_SELECTED_VERSE,
      payload: `${Livre}-${Chapitre}-${Verset}`
    })
  }

  onTouchStart = e => {
    this.shouldShortPress = true
    this.moved = false

    this.setState({ isFocused: true })

    // On long press
    this.buttonPressTimer = setTimeout(this.onLongPress, 400)
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

  onTouchMove = e => {
    this.moved = true
    if (this.state.isFocused) this.setState({ isFocused: false })
  }

  render() {
    const {
      verse,
      isSelected,
      highlightedColor,
      notesCount,
      settings,
      isVerseToScroll,
      notesText,
      isSelectionMode,
      version,
      isHebreu
    } = this.props
    const { isFocused } = this.state

    const inlineNotedVerses = settings.notesDisplay === 'inline'

    if (version === 'INT') {
      return <InterlinearVerse isHebreu={isHebreu} settings={settings} verse={verse} />
    }

    return (
      <Wrapper settings={settings} id={`verset-${verse.Verset}`}>
        <ContainerText
          settings={settings}
          isFocused={isFocused}
          isSelected={isSelected}
          isVerseToScroll={isVerseToScroll && verse.Verset != 1}
          highlightedColor={highlightedColor}>
          <NumberText settings={settings}>{verse.Verset} </NumberText>
          {notesCount && !inlineNotedVerses && !isSelectionMode && (
            <NotesCount
              settings={settings}
              onClick={this.navigateToVerseNotes}
              count={notesCount}
            />
          )}
          <VerseText
            settings={settings}
            onTouchStart={this.onTouchStart}
            onTouchEnd={this.onTouchEnd}
            onTouchMove={this.onTouchMove}
            onTouchCancel={this.onTouchCancel}>
            {verse.Texte}
          </VerseText>
        </ContainerText>
        {notesText && inlineNotedVerses && !isSelectionMode && (
          <NotesText settings={settings} onClick={this.navigateToNote} notesText={notesText} />
        )}
      </Wrapper>
    )
  }
}

export default Verse
