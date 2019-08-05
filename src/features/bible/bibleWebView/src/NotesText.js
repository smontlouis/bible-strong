import React from 'react'
import styled from '@emotion/styled'

import { scaleFontSize } from './Verse'
import { getColors } from '../../../../themes/getColors'
import truncate from '../../../../helpers/truncate'

const Div = styled('span')(({ settings: { fontSizeScale, theme } }) => ({
  fontFamily: 'LiterataBook',
  WebkitTouchCallout: 'none',
  MozUserSelect: 'none',
  msUserSelect: 'none',
  KhtmlUserSelect: 'none',
  WebkitUserSelect: 'none',
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
        <Div key={note.key} settings={settings} onClick={() => onClick(note.key)}>
          [<Verse settings={settings}>({note.verses}) </Verse>
          <span>{truncate(note.description, 230)}</span>]
        </Div>
      ))}
    </span>
  )
}

export default NotesText
