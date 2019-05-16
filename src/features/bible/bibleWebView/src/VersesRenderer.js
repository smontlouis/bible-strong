import { Component, h } from 'preact'
import picostyle from 'picostyle'

const styled = picostyle(h)

const VerseText = styled('span')({
  fontFamily: 'Literata Book'
})

class VersesRenderer extends Component {
  constructor (props) {
    super(props)

    this.state.verses = []
  }
  componentDidMount () {
    const self = this
    this.setState({ verses: this.props.verses })
    document.addEventListener('message', (message) => {
      const parsedMessage = JSON.parse(message.data)
      self.setState({ verses: parsedMessage.arrayVerses })
    })
  }

  render (props, state) {
    if (!state.verses.length) {
      return null
    }

    return (
      <div>
        {
          state.verses.map(({ Verset, Texte }) => (
            <span>
              <span>{Verset}</span>
              <VerseText>{Texte}</VerseText>
            </span>
          ))
        }
      </div>
    )
  }
}

export default VersesRenderer
