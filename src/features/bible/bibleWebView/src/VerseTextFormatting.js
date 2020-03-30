import React, { useState, useEffect } from 'react'
import styled from '@emotion/styled'

import verseToStrong from './verseToStrong'
import { VerseProvider } from './VerseContext'
import { scaleFontSize } from './scaleFontSize'

const VerseText = styled('span')(
  ({ isParallel, settings: { fontSizeScale, fontFamily } }) => ({
    fontFamily,

    fontSize: scaleFontSize(isParallel ? 16 : 19, fontSizeScale),
    lineHeight: scaleFontSize(isParallel ? 26 : 32, fontSizeScale)
  })
)

const NumberText = styled('span')(({ settings: { fontSizeScale } }) => ({
  fontSize: scaleFontSize(14, fontSizeScale)
}))

const VerseTextFormatting = ({ isParallel, selectedCode, verse, settings }) => {
  const [text, setText] = useState(verse.Texte)

  useEffect(() => {
    setText(verse.Texte)
  }, [verse.Texte])

  useEffect(() => {
    verseToStrong(
      { Texte: verse.Texte, Livre: verse.Livre },
      settings,
      selectedCode
    ).then(formattedText => {
      setText(formattedText)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verse.Livre, verse.Texte])

  return (
    <VerseProvider
      value={{
        selectedCode,
        settings
      }}
    >
      <NumberText settings={settings}>{verse.Verset} </NumberText>
      <VerseText isParallel={isParallel} settings={settings}>
        {text}
      </VerseText>
    </VerseProvider>
  )
}

export default VerseTextFormatting
