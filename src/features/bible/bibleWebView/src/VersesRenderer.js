import { Component, h } from 'preact'
import picostyle from 'picostyle'

import Verse from './Verse'
const styled = picostyle(h)

const Container = styled('div')({
  maxWidth: '320px',
  width: '100%',
  margin: '0 auto',
  textAlign: 'justify'
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
      <Container>
        {
          state.verses.map(({ Verset, Texte }) => (
            <Verse verset={Verset} texte={Texte} />
          ))
        }
      </Container>
    )
  }
}

export default VersesRenderer
