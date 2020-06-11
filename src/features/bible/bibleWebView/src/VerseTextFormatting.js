import React, { useState, useEffect } from 'react'
import styled from '@emotion/styled'

import verseToStrong from './verseToStrong'
import { VerseProvider } from './VerseContext'
import { scaleFontSize } from './scaleFontSize'
import NotesCount from './NotesCount'
import NotesText from './NotesText'
import { Wrapper, ContainerText } from './Verse'

const VerseText = styled('span')(
  ({ isParallel, settings: { fontSizeScale, fontFamily } }) => ({
    fontFamily,

    fontSize: scaleFontSize(isParallel ? 16 : 19, fontSizeScale),
    lineHeight: scaleFontSize(isParallel ? 26 : 32, fontSizeScale),
  })
)

const NumberText = styled('span')(({ settings: { fontSizeScale } }) => ({
  fontSize: scaleFontSize(14, fontSizeScale),
}))

const VerseTextFormatting = ({
  isParallel,
  selectedCode,
  verse,
  settings,
  isFocused,
  isTouched,
  isSelected,
  isVerseToScroll,
  highlightedColor,
  onTouchStart,
  onTouchEnd,
  onTouchMove,
  onTouchCancel,
  notesCount,
  inlineNotedVerses,
  isSelectionMode,
  notesText,
  navigateToNote,
  navigateToVerseNotes,
}) => {
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
        settings,
        onTouchMove,
      }}
    >
      <Wrapper settings={settings} id={`verset-${verse.Verset}`}>
        <ContainerText
          isFocused={isFocused}
          settings={settings}
          isTouched={isTouched}
          isSelected={isSelected}
          isVerseToScroll={isVerseToScroll && verse.Verset != 1}
          highlightedColor={highlightedColor}
        >
          <NumberText settings={settings}>{verse.Verset} </NumberText>
          {notesCount && !inlineNotedVerses && !isSelectionMode && (
            <NotesCount
              settings={settings}
              onClick={navigateToVerseNotes}
              count={notesCount}
            />
          )}
          <VerseText
            isParallel={isParallel}
            settings={settings}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            onTouchMove={onTouchMove}
            onTouchCancel={onTouchCancel}
          >
            {text}
          </VerseText>
        </ContainerText>
        {notesText && inlineNotedVerses && !isSelectionMode && (
          <NotesText
            isParallel={isParallel}
            settings={settings}
            onClick={navigateToNote}
            notesText={notesText}
          />
        )}
      </Wrapper>
    </VerseProvider>
  )
}

export default VerseTextFormatting
