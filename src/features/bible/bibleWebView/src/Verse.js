import { Component, h } from 'preact'
import picostyle from 'picostyle'
import { dispatch, NAVIGATE_TO_BIBLE_VERSE_DETAIL } from './dispatch'
const styled = picostyle(h)

const VerseText = styled('span')({
  fontFamily: 'Literata Book',
  fontSize: '20px',
  lineHeight: '34px'
})

const NumberText = styled('span')({
  fontFamily: 'Literata Book',
  fontSize: '28px',
  padding: '0 10px'
})

class Verse extends Component {
  navigateToBibleVerseDetail = () => {
    dispatch({
      type: NAVIGATE_TO_BIBLE_VERSE_DETAIL,
      payload: this.props.verset
    })
  }

  render ({ verset, texte }, state) {
    return (
      <span onClick={this.navigateToBibleVerseDetail}>
        <NumberText>{verset}</NumberText>
        <VerseText>{texte}</VerseText>
      </span>
    )
  }
}

export default Verse
