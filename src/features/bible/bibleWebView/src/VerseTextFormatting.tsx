import { useState, useEffect } from 'preact/hooks'
import { styled } from 'goober'

import verseToStrong from './verseToStrong'
import { VerseProvider } from './VerseContext'
import { scaleFontSize } from './scaleFontSize'
import NotesCount from './NotesCount'
import NotesText from './NotesText'
import { Wrapper, ContainerText } from './Verse'
import VerseTags from './VerseTags'
import {
  PropsWithDiv,
  SelectedCode,
  Verse as VerseProps,
  Settings,
  Notes,
  TagProps,
} from './types'

const VerseText = styled('span')(
  ({
    isParallel,
    settings: { fontSizeScale, fontFamily },
  }: PropsWithDiv<{ isParallel: boolean }>) => ({
    fontFamily,

    fontSize: scaleFontSize(isParallel ? 16 : 19, fontSizeScale),
    lineHeight: scaleFontSize(isParallel ? 26 : 32, fontSizeScale),
  })
)

const NumberText = styled('span')(
  ({ settings: { fontSizeScale } }: PropsWithDiv<{}>) => ({
    fontSize: scaleFontSize(14, fontSizeScale),
  })
)

interface Props {
  isParallel: boolean
  selectedCode: SelectedCode
  verse: VerseProps
  settings: Settings
  isFocused: boolean
  isTouched: boolean
  isSelected: boolean
  isVerseToScroll: boolean
  highlightedColor: string
  onTouchStart: (event: React.TouchEvent<HTMLSpanElement>) => void
  onTouchEnd: (event: React.TouchEvent<HTMLSpanElement>) => void
  onTouchMove: (event: React.TouchEvent<HTMLSpanElement>) => void
  onTouchCancel: (event: React.TouchEvent<HTMLSpanElement>) => void
  notesCount: number
  inlineNotedVerses: boolean
  isSelectionMode:
    | 'inline-verse'
    | 'block-verse'
    | 'inline-strong'
    | 'block-strong'
  notesText: Notes
  navigateToNote: (id: string) => void
  navigateToVerseNotes: () => void
  tag: TagProps | undefined
}

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
  tag,
}: Props) => {
  const [text, setText] = useState<any>(verse.Texte)

  useEffect(() => {
    setText(verse.Texte)
  }, [verse.Texte])

  useEffect(() => {
    verseToStrong({ Texte: verse.Texte, Livre: verse.Livre }).then(
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
          isVerseToScroll={isVerseToScroll && Number(verse.Verset) !== 1}
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
          {tag && <VerseTags settings={settings} tag={tag} />}
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
