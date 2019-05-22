import { Component, h } from 'preact'
import picostyle from 'picostyle'

import { SEND_INITIAL_DATA } from './dispatch'
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
    selectedVerses: {},
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
          const { verses, selectedVerses, highlightedVerses } = response
          self.setState({
            verses,
            selectedVerses,
            highlightedVerses
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
      <Container>
        {
          state.verses.map((verse) => {
            const { Livre, Chapitre, Verset } = verse
            const isSelected = !!state.selectedVerses[`${Livre}-${Chapitre}-${Verset}`]
            const isHighlighted = !!state.highlightedVerses[`${Livre}-${Chapitre}-${Verset}`]
            const highlightedColor = isHighlighted && state.highlightedVerses[`${Livre}-${Chapitre}-${Verset}`].color

            return (
              <Verse
                verse={verse}
                isSelected={isSelected}
                highlightedColor={highlightedColor}
              />
            )
          })
        }
      </Container>
    )
  }
}

export default VersesRenderer
