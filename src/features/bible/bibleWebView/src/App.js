import React, { Component } from 'react'
import styled from '@emotion/styled'
import {
  ADD_PARALLEL_VERSION,
  REMOVE_PARALLEL_VERSION,
  SEND_INITIAL_DATA,
  CONSOLE_LOG,
  THROW_ERROR,
  dispatch,
  NAVIGATE_TO_PERICOPE,
  NAVIGATE_TO_VERSION,
  SWIPE_RIGHT,
  SWIPE_LEFT
} from './dispatch'
import Verse from './Verse'
import Comment from './Comment'
import ErrorBoundary from './ErrorBoundary'
import ChevronDownIcon from './ChevronDownIcon'
import ExternalIcon from './ExternalIcon'
import MinusIcon from './MinusIcon'
import PlusIcon from './PlusIcon'
import { desktopMode } from './env'
import { scaleFontSize } from './scaleFontSize'

import './polyfills'
import './swiped-events'

const exists = obj => {
  if (!obj || obj.error) {
    return false
  }

  return true
}

const extractParallelVerse = (i, parallelVerses, verse, version) => [
  { version, verse },
  ...parallelVerses.map(p => ({ version: p.id, verse: p.verses[i] })),
]

const extractParallelVersionTitles = (parallelVerses, currentVersion) => [
  currentVersion,
  ...parallelVerses.map(p => p.id),
]

const Container = styled('div')(
  ({ settings: { alignContent, theme, colors }, rtl, isParallelVerse }) => ({
    maxWidth: isParallelVerse ? 'none' : '800px',
    margin: '0 auto',
    padding: isParallelVerse ? '10px 0' : '10px 15px',
    paddingBottom: '210px',
    textAlign: alignContent,
    background: colors[theme].reverse,
    color: colors[theme].default,
    direction: rtl ? 'rtl' : 'ltr',
    ...(rtl ? { textAlign: 'right' } : {}),
  })
)

const RightDirection = styled('div')(({ settings: { theme, colors } }) => ({
  textAlign: 'right',
  marginBottom: 20,
  fontFamily: 'arial',
  fontSize: 13,
  color: colors[theme].darkGrey,
}))

const IntMode = styled('div')(({ settings: { theme, colors } }) => ({
  textAlign: 'right',
  marginBottom: 20,
  fontFamily: 'arial',
  fontSize: 13,
  color: colors[theme].default,
}))

const Span = styled('span')({})

const H1 = styled('h1')(
  ({ settings: { fontSizeScale, fontFamily }, isHebreu }) => ({
    fontFamily,
    fontSize: scaleFontSize(28, fontSizeScale),
    textAlign: isHebreu ? 'right' : 'left',
  })
)

const H2 = styled('h2')(
  ({ settings: { fontSizeScale, fontFamily }, isHebreu }) => ({
    fontFamily,
    fontSize: scaleFontSize(24, fontSizeScale),
    textAlign: isHebreu ? 'right' : 'left',
  })
)

const H3 = styled('h3')(
  ({ settings: { fontSizeScale, fontFamily }, isHebreu }) => ({
    fontFamily,
    fontSize: scaleFontSize(20, fontSizeScale),
    textAlign: isHebreu ? 'right' : 'left',
  })
)

const H4 = styled('h4')(
  ({ settings: { fontSizeScale, fontFamily }, isHebreu }) => ({
    fontFamily,
    fontSize: scaleFontSize(18, fontSizeScale),
    textAlign: isHebreu ? 'right' : 'left',
  })
)

const VersionTitle = styled('div')(
  ({ settings: { fontSizeScale, fontFamily } }) => ({
    fontFamily,
    fontWeight: 'bold',
    fontSize: scaleFontSize(18, fontSizeScale),
  })
)

const VersionsContainer = styled('div')(({ settings: { theme, colors } }) => ({
  display: 'flex',
  position: 'sticky',
  top: 0,
  background: colors[theme].reverse,
  paddingTop: '5px',
  paddingBottom: '10px',
}))

const mediaQueries = ['@media (min-width: 640px)']

const ResponsivePlusIcon = styled(PlusIcon)(
  ({ settings: { theme, colors } }) => ({
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    right: '0',
    color: colors[theme].primary,
    display: 'none',

    [mediaQueries[0]]: {
      display: 'block',
    },
  })
)

const getPericopeVerse = (pericopeChapter, verse) => {
  if (pericopeChapter && pericopeChapter[verse]) {
    return pericopeChapter[verse]
  }

  return {}
}

class VersesRenderer extends Component {
  state = {
    verses: [],
    parallelVerses: [],
    secondaryVerses: [],
    comments: null,
    focusVerses: [],
    selectedVerses: {},
    highlightedVerses: {},
    notedVersesCount: {},
    notedVersesText: {},
    settings: {},
    verseToScroll: null,
    version: 'LSG',
    pericopeChapter: {},
    chapter: '',
    isSelectionMode: '',
    selectedCode: null,
    isINTComplete: true,
  }

  componentDidMount() {

    document.addEventListener('swiped-left', function(e) {
      dispatch({
        type: SWIPE_LEFT,
      })
    });

    document.addEventListener('swiped-right', function(e) {
      dispatch({
        type: SWIPE_RIGHT,
      })
    });

    dispatch({
      type: CONSOLE_LOG,
      payload: 'I did mount',
    })

    // ONLY FOR DEV MODE ON DESKTOP
    if (desktopMode) {
      this.setState({
        focusVerses: this.props.focusVerses,
        verses: this.props.verses,
        parallelVerses: this.props.parallelVerses,
        secondaryVerses: this.props.secondaryVerses || [],
        settings: this.props.settings,
        verseToScroll: this.props.verseToScroll,
        notedVersesCount: this.getNotedVersesCount(
          this.props.verses,
          this.props.notedVerses
        ),
        notedVersesText: this.getNotedVersesText(
          this.props.verses,
          this.props.notedVerses
        ),
        selectedVerses: this.props.selectedVerses,
        version: this.props.version,
        pericopeChapter: this.props.pericopeChapter,
        selectedCode: this.props.selectedCode,
        comments: this.transformComments(
          this.props.comments,
          this.props.verses.length
        ),
      })
      // // Load font
      // const literate = require('./literata').default
      // const style = document.createElement('style')
      // style.innerHTML = literate
      // document.head.appendChild(style)
    }

    this.receiveDataFromApp()
  }

  componentDidUpdate(prevProps, prevState) {
    if (
      prevState &&
      prevState.chapter !== this.state.chapter &&
      this.state.verseToScroll === 1
    ) {
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
        document
          .querySelector(`#verset-${this.state.verseToScroll}`)
          .scrollIntoView()
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
            ...value,
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

  // I want comments to be displayed AFTER related verses, not before.
  transformComments = (comments, versesLength) => {
    if (!comments) return null

    return Object.entries(comments).reduce((acc, [key, value], i) => {
      if (key === 0) {
        return { ...acc, [key]: value }
      }

      // If array is a next item, take this as the new key
      if (Object.entries(comments)[i + 1]) {
        const newKey = Number(Object.keys(comments)[i + 1]) - 1
        return { ...acc, [newKey]: value }
      } // Else it's the last item, choose versesLength
      return { ...acc, [versesLength]: value }
    }, {})
  }

  receiveDataFromApp = () => {
    const self = this
    document.addEventListener('message', event => {
      try {
        const response = event.data

        switch (response.type) {
          case SEND_INITIAL_DATA: {
            const {
              verses,
              parallelVerses,
              focusVerses,
              secondaryVerses,
              comments,
              selectedVerses,
              highlightedVerses,
              notedVerses,
              settings,
              verseToScroll,
              version,
              pericopeChapter,
              chapter,
              isSelectionMode,
              selectedCode,
              fontFamily,
            } = response

            self.setState({
              verses: exists(verses)
                ? verses.sort((a, b) => a.Verset - b.Verset)
                : null,
              parallelVerses,
              focusVerses,
              secondaryVerses: secondaryVerses
                ? secondaryVerses.sort((a, b) => a.Verset - b.Verset)
                : null,
              comments: this.transformComments(comments, verses.length),
              selectedVerses,
              highlightedVerses,
              notedVerses,
              notedVersesCount: this.getNotedVersesCount(verses, notedVerses),
              notedVersesText: this.getNotedVersesText(verses, notedVerses),
              settings: { ...settings, fontFamily },
              verseToScroll,
              version,
              pericopeChapter,
              chapter,
              isSelectionMode,
              selectedCode,
            })
            break
          }
          default:
            break
        }
      } catch (err) {
        dispatch({
          type: THROW_ERROR,
          payload: `${err}`,
        })
      }
    })
  }

  navigateToPericope = () => {
    dispatch({
      type: NAVIGATE_TO_PERICOPE,
    })
  }

  navigateToVersion = (version, index) => {
    dispatch({
      type: NAVIGATE_TO_VERSION,
      payload: { version, index },
    })
  }

  removeParallelVersion = index => {
    dispatch({
      type: REMOVE_PARALLEL_VERSION,
      payload: index,
    })
  }

  addParallelVersion = () => {
    dispatch({
      type: ADD_PARALLEL_VERSION,
    })
  }

  render() {
    if (!this.state.verses) {
      return (
        <div
          style={{
            height: '100vh',
            fontFamily: 'arial',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textTransform: 'uppercase',
          }}
        >
          Une erreur est survenue.
        </div>
      )
    }

    if (!this.state.verses.length) {
      return null
    }

    const isHebreu =
      this.state.version === 'BHS' ||
      (this.state.version === 'INT' && Number(this.state.verses[0].Livre) < 40)
    const introComment = this.state.comments && this.state.comments[0]
    const isParallelVerse =
      this.state.parallelVerses && !!this.state.parallelVerses.length
    const parallelVersionTitles =
      isParallelVerse &&
      extractParallelVersionTitles(
        this.state.parallelVerses,
        this.state.version
      )

    return (
      <Container
        rtl={isHebreu}
        settings={this.state.settings}
        isParallelVerse={isParallelVerse}
      >
        {isParallelVerse && (
          <VersionsContainer settings={this.state.settings}>
            {parallelVersionTitles.map((p, i) => (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <VersionTitle
                  onClick={() => this.navigateToVersion(p, i)}
                  style={{ paddingLeft: i === 0 ? '0px' : '10px' }}
                  key={i}
                  settings={this.state.settings}
                >
                  {p}
                  <ChevronDownIcon style={{ marginLeft: 4 }} />
                </VersionTitle>
                {i !== 0 && (
                  <MinusIcon
                    onClick={() => this.removeParallelVersion(i)}
                    style={{ marginLeft: 20, opacity: 0.5 }}
                  />
                )}
              </div>
            ))}
            {this.state.parallelVerses.length < 3 && (
              <ResponsivePlusIcon
                settings={this.state.settings}
                onClick={() => this.addParallelVersion()}
              />
            )}
          </VersionsContainer>
        )}
        {this.state.version === 'INT' && (
          <IntMode
            settings={this.state.settings}
            onClick={() =>
              this.setState({ isINTComplete: !this.state.isINTComplete })
            }
          >
            {this.state.isINTComplete ? 'Mode complet' : 'Mode simple'}
          </IntMode>
        )}
        {isHebreu && (
          <RightDirection settings={this.state.settings}>
            Sens de la lecture ←
          </RightDirection>
        )}
        {!!introComment && this.state.settings.commentsDisplay && (
          <Comment
            isIntro
            id="comment-0"
            settings={this.state.settings}
            comment={introComment}
          />
        )}

        {this.state.verses.map((verse, i) => {
          if (verse.Verset == 0) return null

          const { Livre, Chapitre, Verset } = verse
          const isSelected = !!this.state.selectedVerses[
            `${Livre}-${Chapitre}-${Verset}`
          ]
          const isSelectedMode = !!Object.keys(this.state.selectedVerses).length
          const isHighlighted = !!this.state.highlightedVerses[
            `${Livre}-${Chapitre}-${Verset}`
          ]
          const highlightedColor =
            isHighlighted &&
            this.state.highlightedVerses[`${Livre}-${Chapitre}-${Verset}`].color
          const notesCount = this.state.notedVersesCount[Verset]
          const notesText = this.state.notedVersesText[Verset]
          const comment = this.state.comments && this.state.comments[Verset]
          const isFocused = this.state.focusVerses
            ? this.state.focusVerses.includes(Number(Verset))
            : undefined
          const isVerseToScroll = this.state.verseToScroll == Verset
          const secondaryVerse =
            this.state.secondaryVerses && this.state.secondaryVerses[i]
          const parallelVerse =
            isParallelVerse &&
            extractParallelVerse(
              i,
              this.state.parallelVerses,
              verse,
              this.state.version
            )

          const { h1, h2, h3, h4 } = getPericopeVerse(
            this.state.pericopeChapter,
            Verset
          )

          return (
            <Span key={`${Livre}-${Chapitre}-${Verset}`}>
              {h1 && (
                <H1
                  isHebreu={isHebreu}
                  settings={this.state.settings}
                  onClick={this.navigateToPericope}
                >
                  {h1}
                  <ExternalIcon />
                </H1>
              )}
              {h2 && (
                <H2
                  isHebreu={isHebreu}
                  settings={this.state.settings}
                  onClick={this.navigateToPericope}
                >
                  {h2}
                  <ExternalIcon />
                </H2>
              )}
              {h3 && (
                <H3
                  isHebreu={isHebreu}
                  settings={this.state.settings}
                  onClick={this.navigateToPericope}
                >
                  {h3}
                  <ExternalIcon />
                </H3>
              )}
              {h4 && (
                <H4
                  isHebreu={isHebreu}
                  settings={this.state.settings}
                  onClick={this.navigateToPericope}
                >
                  {h4}
                  <ExternalIcon />
                </H4>
              )}
              {/* <ErrorBoundary> */}
              <Verse
                isHebreu={isHebreu}
                version={this.state.version}
                verse={verse}
                isParallelVerse={isParallelVerse}
                parallelVerse={parallelVerse}
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
                isFocused={isFocused}
                isINTComplete={this.state.isINTComplete}
              />
              {/* </ErrorBoundary> */}
              {!!comment && this.state.settings.commentsDisplay && (
                <Comment
                  id={`comment-${verse.Verset}`}
                  settings={this.state.settings}
                  comment={comment}
                />
              )}
            </Span>
          )
        })}
      </Container>
    )
  }
}

export default VersesRenderer
