import React, { useState, useEffect } from 'react'
import styled from '@emotion/styled'

import verseToStrong from './verseToStrong'
import { VerseProvider } from './VerseContext'
import { scaleFontSize } from './scaleFontSize'

const VerseText = styled('span')(({ settings: { fontSizeScale } }) => ({
  fontFamily: 'LiterataBook',
  fontSize: scaleFontSize(19, fontSizeScale),
  lineHeight: scaleFontSize(30, fontSizeScale)
}))

const NumberText = styled('span')(({ settings: { fontSizeScale } }) => ({
  fontSize: scaleFontSize(14, fontSizeScale)
}))

const VerseTextFormatting = ({ selectedCode, verse, settings }) => {
  const [text, setText] = useState(verse.Texte)

  useEffect(() => {
    setText(verse.Texte)
  }, [verse.Texte])

  useEffect(() => {
    verseToStrong({ Texte: verse.Texte, Livre: verse.Livre }, settings, selectedCode).then(
      formattedText => {
        setText(formattedText)
      }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verse.Livre, verse.Texte])

  return (
    <VerseProvider
      value={{
        selectedCode,
        settings
      }}>
      <NumberText settings={settings}>{verse.Verset} </NumberText>
      <VerseText settings={settings}>{text}</VerseText>
    </VerseProvider>
  )
}

export default VerseTextFormatting
