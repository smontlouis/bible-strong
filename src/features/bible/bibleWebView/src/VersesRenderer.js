import React, { Component } from 'react'
import styled from '@emotion/styled'

import { SEND_INITIAL_DATA, CONSOLE_LOG, THROW_ERROR, dispatch } from './dispatch'
import Verse from './Verse'
import Comment from './Comment'
import ErrorBoundary from './ErrorBoundary'
import { desktopMode } from './env'
import { scaleFontSize } from './scaleFontSize'

if (!Object.entries) {
  Object.entries = function(obj) {
    const ownProps = Object.keys(obj)
    let i = ownProps.length
    const resArray = new Array(i) // preallocate the Array
    while (i--) resArray[i] = [ownProps[i], obj[ownProps[i]]]

    return resArray
  }
}

const Container = styled('div')(({ settings: { alignContent, theme, colors }, rtl }) => ({
  padding: '10px 15px',
  paddingBottom: '210px',
  textAlign: alignContent,
  background: colors[theme].reverse,
  color: colors[theme].default,
  direction: rtl ? 'rtl' : 'ltr',
  ...(rtl && { textAlign: 'right' })
}))

const RightDirection = styled('div')(({ settings: { theme, colors } }) => ({
  textAlign: 'right',
  marginBottom: 20,
  fontFamily: 'arial',
  fontSize: 13,
  color: colors[theme].darkGrey
}))

const headingStyle = {
  fontFamily: 'LiterataBook'
}

const Span = styled('span')({})

const H1 = styled('h1')(({ settings: { fontSizeScale }, isHebreu }) => ({
  ...headingStyle,
  fontSize: scaleFontSize(28, fontSizeScale),
  textAlign: isHebreu ? 'right' : 'left'
}))

const H2 = styled('h2')(({ settings: { fontSizeScale }, isHebreu }) => ({
  ...headingStyle,
  fontSize: scaleFontSize(24, fontSizeScale),
  textAlign: isHebreu ? 'right' : 'left'
}))

const H3 = styled('h3')(({ settings: { fontSizeScale }, isHebreu }) => ({
  ...headingStyle,
  fontSize: scaleFontSize(20, fontSizeScale),
  textAlign: isHebreu ? 'right' : 'left'
}))

const H4 = styled('h4')(({ settings: { fontSizeScale }, isHebreu }) => ({
  ...headingStyle,
  fontSize: scaleFontSize(18, fontSizeScale),
  textAlign: isHebreu ? 'right' : 'left'
}))

const getPericopeVerse = (pericopeChapter, verse) => {
  if (pericopeChapter && pericopeChapter[verse]) {
    return pericopeChapter[verse]
  }

  return {}
}

class VersesRenderer extends Component {
  state = {
    verses: [],
    secondaryVerses: [],
    comments: null,
    selectedVerses: {},
    highlightedVerses: {},
    notedVersesCount: {},
    notedVersesText: {},
    settings: {},
    verseToScroll: null,
    isReadOnly: false,
    version: 'LSG',
    pericopeChapter: {},
    chapter: '',
    isSelectionMode: '',
    selectedCode: null
  }

  componentDidMount() {
    dispatch({
      type: CONSOLE_LOG,
      payload: 'I did mount'
    })
    // ONLY FOR DEV MODE ON DESKTOP
    // TODO: TO DELETE
    if (desktopMode) {
      // this.setState({
      //   verses: this.props.verses,
      //   secondaryVerses: this.props.secondaryVerses || [],
      //   settings: this.props.settings,
      //   verseToScroll: this.props.verseToScroll,
      //   notedVersesCount: this.getNotedVersesCount(this.props.verses, this.props.notedVerses),
      //   notedVersesText: this.getNotedVersesText(this.props.verses, this.props.notedVerses),
      //   selectedVerses: this.props.selectedVerses,
      //   version: this.props.version,
      //   pericopeChapter: this.props.pericopeChapter,
      //   selectedCode: this.props.selectedCode,
      //   comments: this.props.comments
      // })
      // // // Load font
      // const literate = require('../../../studies/studiesWebView/src/literata').default
      // const style = document.createElement('style')
      // style.innerHTML = literate
      // document.head.appendChild(style)
    }

    this.receiveDataFromApp()
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState && prevState.chapter !== this.state.chapter && this.state.verseToScroll === 1) {
      window.scrollTo(0, 0)
    }
    if (prevState && prevState.settings.theme !== this.state.settings.theme) {
      document.body.style.backgroundColor = this.state.settings.colors[
        this.state.settings.theme
      ].reverse
    }
    if (prevState && prevState.verseToScroll !== this.state.verseToScroll) {
      if (!prevState.verseToScroll && this.state.verseToScroll === 1) {
        return
      }
      // dispatch({ type: CONSOLE_LOG, payload: `${prevState} ${prevState.verseToScroll}, ${this.state.verseToScroll}` })
      setTimeout(() => {
        document.querySelector(`#verset-${this.state.verseToScroll}`).scrollIntoView()
      }, 200)
    }
  }

  getNotedVersesCount = (verses, notedVerses) => {
    const newNotedVerses = {}
    if (verses.length) {
      const { Livre, Chapitre } = verses[0]
      Object.keys(notedVerses).map(key => {
        const firstVerseRef = key.split('/')[0]
        const bookNumber = parseInt(firstVerseRef.split('-')[0])
        const chapterNumber = parseInt(firstVerseRef.split('-')[1])
        const verseNumber = firstVerseRef.split('-')[2]
        if (bookNumber === Livre && chapterNumber === Chapitre) {
          if (newNotedVerses[verseNumber])
            newNotedVerses[verseNumber] = newNotedVerses[verseNumber] + 1
          else newNotedVerses[verseNumber] = 1
        }
      })
    }
    return newNotedVerses
  }

  getNotedVersesText = (verses, notedVerses) => {
    const newNotedVerses = {}
    if (verses.length) {
      const { Livre, Chapitre } = verses[0]
      Object.entries(notedVerses).map(([key, value]) => {
        const versesInArray = key.split('/')

        const lastVerseRef = versesInArray[versesInArray.length - 1]
        const bookNumber = parseInt(lastVerseRef.split('-')[0])
        const chapterNumber = parseInt(lastVerseRef.split('-')[1])
        const verseNumber = lastVerseRef.split('-')[2]

        if (bookNumber === Livre && chapterNumber === Chapitre) {
          const verseToPush = {
            key,
            verses:
              versesInArray.length > 1
                ? `${versesInArray[0].split('-')[2]}-${
                    versesInArray[versesInArray.length - 1].split('-')[2]
                  }`
                : versesInArray[0].split('-')[2],
            ...value
          }
          if (newNotedVerses[verseNumber]) {
            newNotedVerses[verseNumber].push(verseToPush)
          } else {
            newNotedVerses[verseNumber] = [verseToPush]
          }
        }
      })
    }
    return newNotedVerses
  }

  receiveDataFromApp = () => {
    const self = this
    document.addEventListener('messages', event => {
      try {
        const response = event.detail

        switch (response.type) {
          case SEND_INITIAL_DATA: {
            const {
              verses,
              secondaryVerses,
              comments,
              selectedVerses,
              highlightedVerses,
              notedVerses,
              settings,
              verseToScroll,
              isReadOnly,
              version,
              pericopeChapter,
              chapter,
              isSelectionMode,
              selectedCode
            } = response

            self.setState({
              verses: verses.sort((a, b) => a.Verset - b.Verset),
              secondaryVerses: secondaryVerses
                ? secondaryVerses.sort((a, b) => a.Verset - b.Verset)
                : null,
              comments,
              selectedVerses,
              highlightedVerses,
              notedVerses,
              notedVersesCount: this.getNotedVersesCount(verses, notedVerses),
              notedVersesText: this.getNotedVersesText(verses, notedVerses),
              settings,
              verseToScroll,
              isReadOnly,
              version,
              pericopeChapter,
              chapter,
              isSelectionMode,
              selectedCode
            })
            break
          }
          default:
            break
        }
      } catch (err) {
        dispatch({
          type: THROW_ERROR,
          payload: `${err}`
        })
      }
    })
  }

  render() {
    if (!this.state.verses.length) {
      return null
    }

    const isHebreu = this.state.version === 'INT' && Number(this.state.verses[0].Livre) < 40
    const introComment = this.state.comments && this.state.comments[0]

    return (
      <Container rtl={isHebreu} settings={this.state.settings} isReadOnly={this.state.isReadOnly}>
        {isHebreu && (
          <RightDirection settings={this.state.settings}>Sens de la lecture ←</RightDirection>
        )}
        {!!introComment && this.state.settings.commentsDisplay && (
          <Comment isIntro id="comment-0" settings={this.state.settings} comment={introComment} />
        )}

        {this.state.verses.map((verse, i) => {
          const { Livre, Chapitre, Verset } = verse
          const isSelected = !!this.state.selectedVerses[`${Livre}-${Chapitre}-${Verset}`]
          const isSelectedMode = !!Object.keys(this.state.selectedVerses).length
          const isHighlighted = !!this.state.highlightedVerses[`${Livre}-${Chapitre}-${Verset}`]
          const highlightedColor =
            isHighlighted && this.state.highlightedVerses[`${Livre}-${Chapitre}-${Verset}`].color
          const notesCount = this.state.notedVersesCount[`${Verset}`]
          const notesText = this.state.notedVersesText[`${Verset}`]
          const comment = this.state.comments && this.state.comments[Verset]
          const isVerseToScroll = this.state.verseToScroll == Verset
          const secondaryVerse = this.state.secondaryVerses && this.state.secondaryVerses[i]

          const { h1, h2, h3, h4 } = getPericopeVerse(this.state.pericopeChapter, Verset)

          return (
            <Span key={`${Livre}-${Chapitre}-${Verset}`}>
              {h1 && (
                <H1 isHebreu={isHebreu} settings={this.state.settings}>
                  {h1}
                </H1>
              )}
              {h2 && (
                <H2 isHebreu={isHebreu} settings={this.state.settings}>
                  {h2}
                </H2>
              )}
              {h3 && (
                <H3 isHebreu={isHebreu} settings={this.state.settings}>
                  {h3}
                </H3>
              )}
              {h4 && (
                <H4 isHebreu={isHebreu} settings={this.state.settings}>
                  {h4}
                </H4>
              )}
              {!!comment && this.state.settings.commentsDisplay && (
                <Comment
                  id={`comment-${verse.Verset}`}
                  settings={this.state.settings}
                  comment={comment}
                />
              )}
              <ErrorBoundary>
                <Verse
                  isHebreu={isHebreu}
                  version={this.state.version}
                  verse={verse}
                  secondaryVerse={secondaryVerse}
                  settings={this.state.settings}
                  isSelected={isSelected}
                  isSelectedMode={isSelectedMode}
                  isSelectionMode={this.state.isSelectionMode}
                  highlightedColor={highlightedColor}
                  notesCount={notesCount}
                  notesText={notesText}
                  isVerseToScroll={isVerseToScroll}
                  selectedCode={this.state.selectedCode}
                />
              </ErrorBoundary>
            </Span>
          )
        })}
      </Container>
    )
  }
}

export default VersesRenderer
