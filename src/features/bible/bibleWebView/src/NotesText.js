import { h } from 'preact'
import picostyle from 'picostyle'

import { scaleFontSize } from './Verse'
import { getColors } from '../../../../themes/getColors'
import truncate from '../../../../helpers/truncate'

const styled = picostyle(h)

const Div = styled('span')(({ settings: { fontSizeScale, theme } }) => ({
  fontFamily: 'Literata Book',
  '-webkit-touch-callout': 'none',
  '-moz-user-select': 'none',
  '-ms-user-select': 'none',
  '-khtml-user-select': 'none',
  '-webkit-user-select': 'none',
  fontSize: scaleFontSize(19, fontSizeScale),
  lineHeight: scaleFontSize(30, fontSizeScale),
  color: getColors[theme].quart
}))

const Verse = styled('span')(({ settings: { fontSizeScale } }) => ({
  paddingLeft: '3px',
  fontSize: scaleFontSize(14, fontSizeScale)
}))

const NotesText = ({ notesText, settings, onClick }) => {
  return (
    <span>
      {notesText.map(note => (
        <Div settings={settings} onClick={() => onClick(note.key)}>
          [<Verse settings={settings}>({note.verses}) </Verse>
          <span>{truncate(note.description, 230)}</span>]
        </Div>
      ))}
    </span>
  )
}

export default NotesText
