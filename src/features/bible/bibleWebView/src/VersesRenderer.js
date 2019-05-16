import { Component, h } from 'preact'
import picostyle from 'picostyle'

import { SEND_INITIAL_DATA, SEND_HIGHLIGHTED_VERSES } from './dispatch'
import Verse from './Verse'
const styled = picostyle(h)

const Container = styled('div')({
  maxWidth: '320px',
  width: '100%',
  margin: '0 auto',
  textAlign: 'justify'
})
class VersesRenderer extends Component {
  state = {
    verses: [],
    highlightedVerses: {}
  }

  componentDidMount () {
    this.setState({ verses: this.props.verses })
    this.receiveDataFromApp()
    window.oncontextmenu = function (event) {
      event.preventDefault()
      event.stopPropagation()
      return false
    }
  }

  receiveDataFromApp = () => {
    const self = this
    document.addEventListener('message', (message) => {
      const response = JSON.parse(message.data)

      switch (response.type) {
        case SEND_INITIAL_DATA: {
          self.setState({ verses: response.arrayVerses, highlightedVerses: response.highlightedVerses })
          break
        }
        case SEND_HIGHLIGHTED_VERSES: {
          self.setState({ highlightedVerses: response.highlightedVerses })
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
      <Container>
        {
          state.verses.map((verse) => {
            const { Livre, Chapitre, Verset } = verse
            const isSelected = !!state.highlightedVerses[`${Livre}-${Chapitre}-${Verset}`]
            return (
              <Verse verse={verse} isSelected={isSelected} />
            )
          })
        }
      </Container>
    )
  }
}

export default VersesRenderer
