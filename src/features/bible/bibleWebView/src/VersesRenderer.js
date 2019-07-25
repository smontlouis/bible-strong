import { Component, h } from 'preact'
import picostyle from 'picostyle'

import { getColors } from '../../../../themes/getColors'
import { SEND_INITIAL_DATA, CONSOLE_LOG, dispatch } from './dispatch'
import Verse from './Verse'
import { desktopMode } from './env'

const styled = picostyle(h)

const Container = styled('div')(({ settings: { alignContent, theme }, isReadOnly }) => ({
  // maxWidth: '320px',
  padding: '10px 15px',
  paddingBottom: '40px',
  // width: '100%',
  // margin: '0 auto',
  textAlign: alignContent,
  background: getColors[theme].reverse,
  color: getColors[theme].default,
  pointerEvents: isReadOnly ? 'none' : 'auto'
}))

const scaleFontSize = (value, scale) => `${value + (scale * 0.1 * value)}px` // Scale

const headingStyle = {
  fontFamily: 'Literata Book',
  textAlign: 'left'
}

const H1 = styled('h1')(({ settings: { fontSizeScale } }) => ({
  ...headingStyle,
  fontSize: scaleFontSize(28, fontSizeScale)
}))

const H2 = styled('h2')(({ settings: { fontSizeScale } }) => ({
  ...headingStyle,
  fontSize: scaleFontSize(24, fontSizeScale)
}))

const H3 = styled('h3')(({ settings: { fontSizeScale } }) => ({
  ...headingStyle,
  fontSize: scaleFontSize(20, fontSizeScale)
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
    selectedVerses: {},
    highlightedVerses: {},
    notedVerses: {},
    notedVersesCount: {},
    notedVersesText: {},
    settings: {},
    verseToScroll: null,
    isReadOnly: false,
    version: 'LSG',
    pericopeChapter: {},
    chapter: ''
  }

  componentDidMount () {
    dispatch({
      type: CONSOLE_LOG,
      payload: 'I did mount'
    })
    // ONLY FOR DEV MODE ON DESKTOP
    if (desktopMode) {
      this.setState({
        verses: this.props.verses,
        notedVerses: this.props.notedVerses,
        settings: this.props.settings,
        verseToScroll: this.props.verseToScroll,
        notedVersesCount: this.getNotedVersesCount(this.props.verses, this.props.notedVerses),
        notedVersesText: this.getNotedVersesText(this.props.verses, this.props.notedVerses),
        selectedVerses: this.props.selectedVerses,
        version: this.props.version,
        pericopeChapter: this.props.pericopeChapter
      })
    }

    this.receiveDataFromApp()
  }

  componentDidUpdate (prevProps, prevState) {
    if (prevState && prevState.chapter !== this.state.chapter && this.state.verseToScroll === 1) {
      window.scrollTo(0, 0)
    }
    if (prevState && prevState.settings.theme !== this.state.settings.theme) {
      document.body.style.backgroundColor = getColors[this.state.settings.theme].reverse
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
    let newNotedVerses = {}
    if (verses.length) {
      const { Livre, Chapitre } = verses[0]
      Object.keys(notedVerses).map(key => {
        let firstVerseRef = key.split('/')[0]
        let bookNumber = parseInt(firstVerseRef.split('-')[0])
        let chapterNumber = parseInt(firstVerseRef.split('-')[1])
        let verseNumber = firstVerseRef.split('-')[2]
        if (bookNumber === Livre && chapterNumber === Chapitre) {
          if (newNotedVerses[verseNumber]) newNotedVerses[verseNumber] = newNotedVerses[verseNumber] + 1
          else newNotedVerses[verseNumber] = 1
        }
      })
    }
    return newNotedVerses
  }

  getNotedVersesText = (verses, notedVerses) => {
    let newNotedVerses = {}
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
            key: key,
            verses: (versesInArray.length > 1) ? `${versesInArray[0].split('-')[2]}-${versesInArray[versesInArray.length - 1].split('-')[2]}` : versesInArray[0].split('-')[2],
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
    document.addEventListener('messages', (event) => {
      const response = event.detail

      switch (response.type) {
        case SEND_INITIAL_DATA: {
          const {
            verses,
            selectedVerses,
            highlightedVerses,
            notedVerses,
            settings,
            verseToScroll,
            isReadOnly,
            version,
            pericopeChapter,
            chapter
          } = response

          self.setState({
            verses,
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
            chapter
          })
          break
        }
      }
    })
  }

  render (props, state) {
    if (!state.verses.length) {
      return null
    }

    return (
      <Container settings={state.settings} isReadOnly={state.isReadOnly}>
        {
          state.verses.map((verse) => {
            const { Livre, Chapitre, Verset } = verse
            const isSelected = !!state.selectedVerses[`${Livre}-${Chapitre}-${Verset}`]
            const isSelectedMode = !!Object.keys(state.selectedVerses).length
            const isHighlighted = !!state.highlightedVerses[`${Livre}-${Chapitre}-${Verset}`]
            const highlightedColor = isHighlighted && state.highlightedVerses[`${Livre}-${Chapitre}-${Verset}`].color
            const notesCount = state.notedVersesCount[`${Verset}`]
            const notesText = state.notedVersesText[`${Verset}`]
            const isVerseToScroll = this.state.verseToScroll == Verset

            const { h1, h2, h3 } = getPericopeVerse(state.pericopeChapter, Verset)

            return (
              <span>
                {
                  h1 && <H1 settings={state.settings}>{h1}</H1>
                }
                {
                  h2 && <H2 settings={state.settings}>{h2}</H2>
                }
                {
                  h3 && <H3 settings={state.settings}>{h3}</H3>
                }
                <Verse
                  verse={verse}
                  settings={state.settings}
                  isSelected={isSelected}
                  isSelectedMode={isSelectedMode}
                  highlightedColor={highlightedColor}
                  notesCount={notesCount}
                  notesText={notesText}
                  isVerseToScroll={isVerseToScroll}
                />
              </span>
            )
          })
        }
      </Container>
    )
  }
}

export default VersesRenderer
