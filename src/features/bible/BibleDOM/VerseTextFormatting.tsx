import { useState, useEffect } from 'react'
import { styled } from 'goober'

import verseToStrong from './verseToStrong'
import { VerseProvider } from './VerseContext'
import { scaleFontSize } from './scaleFontSize'
import NotesCount from './NotesCount'
import NotesText from './NotesText'
import { ContainerText } from './ContainerText'
import { NotedVerse, RootStyles, TaggedVerse } from './BibleDOMWrapper'
import { SelectedCode, StudyNavigateBibleType, Verse } from '~common/types'
import { RootState } from '~redux/modules/reducer'
import VerseTags from './VerseTags'

export const Wrapper = styled('span')<RootStyles>(
  ({ settings: { textDisplay } }) => ({
    display: textDisplay,
    ...(textDisplay === 'block'
      ? {
          marginBottom: '5px',
        }
      : {}),
  })
)

const VerseText = styled('span')<RootStyles & { isParallel?: boolean }>(
  ({ isParallel, settings: { fontSizeScale, fontFamily } }) => ({
    fontFamily,

    fontSize: scaleFontSize(isParallel ? 16 : 19, fontSizeScale),
    lineHeight: scaleFontSize(isParallel ? 26 : 32, fontSizeScale),
  })
)

const NumberText = styled('span')<RootStyles>(
  ({ settings: { fontSizeScale } }) => ({
    fontSize: scaleFontSize(14, fontSizeScale),
  })
)

interface Props {
  isParallel?: boolean
  selectedCode?: SelectedCode | null
  verse: Verse
  settings: RootState['user']['bible']['settings']
  isFocused?: boolean
  isTouched?: boolean
  isSelected?: boolean
  isVerseToScroll?: boolean
  highlightedColor?: keyof RootStyles['settings']['colors'][keyof RootStyles['settings']['colors']]
  onTouchStart: (event: React.TouchEvent<HTMLSpanElement>) => void
  onTouchEnd: (event: React.TouchEvent<HTMLSpanElement>) => void
  onTouchMove: (event: React.TouchEvent<HTMLSpanElement>) => void
  onTouchCancel: (event: React.TouchEvent<HTMLSpanElement>) => void
  notesCount: number
  inlineNotedVerses: boolean
  isSelectionMode: StudyNavigateBibleType | undefined
  notesText: NotedVerse[]
  navigateToNote: (id: string) => void
  navigateToVerseNotes: () => void
  tag: TaggedVerse | undefined
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
