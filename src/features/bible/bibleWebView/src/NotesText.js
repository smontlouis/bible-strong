import React from 'react'
import styled from '@emotion/styled'
import truncate from './truncate'
import { scaleFontSize } from './scaleFontSize'

const Div = styled('span')(
  ({ settings: { fontSizeScale, theme, colors, fontFamily } }) => ({
    fontFamily,
    webkitTouchCallout: 'none',
    mozUserSelect: 'none',
    msUserSelect: 'none',
    khtmlUserSelect: 'none',
    webkitUserSelect: 'none',
    fontSize: scaleFontSize(19, fontSizeScale),
    lineHeight: scaleFontSize(29, fontSizeScale),
    color: colors[theme].quart
  })
)

const Verse = styled('span')(({ settings: { fontSizeScale } }) => ({
  paddingLeft: '3px',
  fontSize: scaleFontSize(14, fontSizeScale)
}))

const NotesText = ({ notesText, settings, onClick }) => {
  return (
    <span>
      {notesText.map(note => (
        <Div
          key={note.key}
          settings={settings}
          onClick={() => onClick(note.key)}>
          [<Verse settings={settings}>({note.verses}) </Verse>
          <span>{truncate(note.description, 10)}</span>]
        </Div>
      ))}
    </span>
  )
}

export default NotesText
