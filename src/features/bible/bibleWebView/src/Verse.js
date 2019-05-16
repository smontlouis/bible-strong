import { Component, h } from 'preact'
import picostyle from 'picostyle'
import { dispatch, NAVIGATE_TO_BIBLE_VERSE_DETAIL, TOGGLE_SELECTED_VERSE } from './dispatch'
const styled = picostyle(h)

const VerseText = styled('span')({
  fontSize: '20px',
  lineHeight: '34px'
})

const NumberText = styled('span')({
  fontSize: '28px',
  padding: '0 10px'
})

const ContainerText = styled('span')(({ isFocused, isSelected }) => ({
  fontFamily: 'Literata Book',
  background: isFocused ? 'rgba(0,0,0,0.2)' : 'transparent',
  '-webkit-touch-callout': 'none',
  padding: '4px',
  borderBottom: isSelected ? '1px dashed blue' : 'none'
}))

class Verse extends Component {
  state = {
    focused: false
  }
  navigateToBibleVerseDetail = () => {
    dispatch({
      type: NAVIGATE_TO_BIBLE_VERSE_DETAIL,
      payload: this.props.verset
    })
  }

  toggleSelectVerse = () => {
    const { verse: { Livre, Chapitre, Verset } } = this.props
    dispatch({
      type: TOGGLE_SELECTED_VERSE,
      payload: `${Livre}-${Chapitre}-${Verset}`
    })
  }

  onTouchStart = () => {
    this.setState({ isFocused: true })
  }

  onTouchEnd = () => {
    this.setState({ isFocused: false })
  }

  render ({ verse, isSelected }, { isFocused }) {
    return (
      <ContainerText
        isFocused={isFocused}
        isSelected={isSelected}
        onClick={this.toggleSelectVerse}
        onTouchStart={this.onTouchStart}
        onTouchEnd={this.onTouchEnd}
      >
        <NumberText>{verse.Verset}</NumberText>
        <VerseText>{verse.Texte}</VerseText>
      </ContainerText>
    )
  }
}

export default Verse
