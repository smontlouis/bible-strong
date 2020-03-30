import React from 'react'
import styled from '@emotion/styled'
import truncate from './truncate'
import { scaleFontSize } from './scaleFontSize'

const Div = styled('span')(
  ({ isParallel, settings: { fontSizeScale, theme, colors, fontFamily } }) => ({
    fontFamily,
    webkitTouchCallout: 'none',
    mozUserSelect: 'none',
    msUserSelect: 'none',
    khtmlUserSelect: 'none',
    webkitUserSelect: 'none',
    color: colors[theme].quart,

    fontSize: scaleFontSize(isParallel ? 16 : 19, fontSizeScale),
    lineHeight: scaleFontSize(isParallel ? 26 : 32, fontSizeScale)
  })
)

const Verse = styled('span')(({ isParallel, settings: { fontSizeScale } }) => ({
  paddingLeft: '3px',
  fontSize: scaleFontSize(isParallel ? 9 : 14, fontSizeScale)
}))

const NotesText = ({ notesText, settings, onClick, isParallel }) => {
  return (
    <span>
      {notesText.map(note => (
        <Div
          key={note.key}
          settings={settings}
          isParallel={isParallel}
          onClick={() => onClick(note.key)}
        >
          [
          <Verse isParallel={isParallel} settings={settings}>
            ({note.verses}){' '}
          </Verse>
          <span>{truncate(note.description, 10)}</span>]
        </Div>
      ))}
    </span>
  )
}

export default NotesText
