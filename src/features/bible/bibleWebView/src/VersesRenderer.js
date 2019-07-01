import { Component, h } from 'preact'
import picostyle from 'picostyle'

import { getColors } from '../../../../themes/getColors'
import { SEND_INITIAL_DATA } from './dispatch'
import Verse from './Verse'
import { desktopMode } from './env'

const styled = picostyle(h)

const Container = styled('div')(({ settings: { alignContent, theme }, isReadOnly }) => ({
  maxWidth: '320px',
  width: '100%',
  margin: '0 auto',
  textAlign: alignContent,
  background: getColors[theme].reverse,
  color: getColors[theme].default,
  pointerEvents: isReadOnly ? 'none' : 'auto'
}))

class VersesRenderer extends Component {
  state = {
    verses: [],
    selectedVerses: {},
    highlightedVerses: {},
    notedVerses: {},
    settings: {},
    verseToScroll: null,
    isReadOnly: false
  }

  componentDidMount () {
    if (desktopMode) {
      this.setState({
        verses: this.props.verses,
        settings: this.props.settings,
        verseToScroll: this.props.verseToScroll,
        selectedVerses: this.props.selectedVerses
      })
    }
    this.receiveDataFromApp()
  }

  componentDidUpdate (prevProps, prevState) {
    if (prevState && prevState.settings.theme !== this.state.settings.theme) {
      document.body.style.backgroundColor = getColors[this.state.settings.theme].reverse
    }
    if (prevState && prevState.verseToScroll !== this.state.verseToScroll) {
      setTimeout(() => {
        document.querySelector(`#verset-${this.state.verseToScroll}`).scrollIntoView()
      }, 200)
    }
  }

  getNotedVerses = (verses, notedVerses) => {
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
    // dispatch({ type: CONSOLE_LOG, payload: { verses, newNotedVerses } })
    return newNotedVerses
  }

  receiveDataFromApp = () => {
    const self = this
    document.addEventListener('message', (message) => {
      const response = JSON.parse(message.data)

      switch (response.type) {
        case SEND_INITIAL_DATA: {
          const { verses, selectedVerses, highlightedVerses, notedVerses, settings, verseToScroll, isReadOnly } = response
          self.setState({
            verses,
            selectedVerses,
            highlightedVerses,
            notedVerses: this.getNotedVerses(verses, notedVerses),
            settings,
            verseToScroll,
            isReadOnly
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
            const notesCount = state.notedVerses[`${Verset}`]

            return (
              <Verse
                verse={verse}
                settings={state.settings}
                isSelected={isSelected}
                isSelectedMode={isSelectedMode}
                highlightedColor={highlightedColor}
                notesCount={notesCount}
              />
            )
          })
        }
      </Container>
    )
  }
}

export default VersesRenderer
