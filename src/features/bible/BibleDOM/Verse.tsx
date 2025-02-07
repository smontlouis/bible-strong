import { useState, useEffect, useCallback, useRef } from 'react'
import { styled } from 'goober'

import {
  NAVIGATE_TO_BIBLE_VERSE_DETAIL,
  NAVIGATE_TO_VERSE_NOTES,
  TOGGLE_SELECTED_VERSE,
  NAVIGATE_TO_BIBLE_NOTE,
} from './dispatch'

import { scaleFontSize } from './scaleFontSize'
import { scaleLineHeight } from './scaleLineHeight'
import NotesCount from './NotesCount'
import NotesText from './NotesText'
import { RootState } from '~redux/modules/reducer'
import { useDispatch } from './DispatchProvider'
import {
  SelectedCode,
  StudyNavigateBibleType,
  Verse as TVerse,
} from '~common/types'
import { NotedVerse, RootStyles, TaggedVerse } from './BibleDOMWrapper'
import VerseTextFormatting from './VerseTextFormatting'
import { ContainerText } from './ContainerText'
import InterlinearVerseComplete from './InterlinearVerseComplete'
import InterlinearVerse from './InterlinearVerse'
import VerseTags from './VerseTags'

const VerseText = styled('span')<RootStyles & { isParallel?: boolean }>(
  ({ isParallel, settings: { fontSizeScale, lineHeight } }) => ({
    fontSize: scaleFontSize(isParallel ? 16 : 19, fontSizeScale),
    lineHeight: scaleLineHeight(
      isParallel ? 26 : 32,
      lineHeight,
      fontSizeScale
    ),
  })
)

const NumberText = styled<RootStyles & { isFocused?: boolean }>('span')(
  ({ isFocused, settings: { fontSizeScale } }) => ({
    fontSize: scaleFontSize(14, fontSizeScale),
  })
)

const Wrapper = styled('span')<RootStyles>(({ settings: { textDisplay } }) => ({
  display: textDisplay,
  ...(textDisplay === 'block'
    ? {
        marginBottom: '5px',
      }
    : {}),
}))

const Spacer = styled('div')(() => ({
  marginTop: '5px',
}))

interface Props {
  verse: TVerse
  isSelectedMode: boolean
  isSelectionMode: StudyNavigateBibleType | undefined
  settings: RootState['user']['bible']['settings']
  parallelVerse?: {
    version: string
    verse: TVerse
  }[]
  secondaryVerse?: TVerse | null
  isSelected: boolean
  highlightedColor?: keyof RootStyles['settings']['colors'][keyof RootStyles['settings']['colors']]
  notesCount: number
  isVerseToScroll: boolean
  notesText: NotedVerse[]
  version: string
  isHebreu: boolean
  selectedCode: SelectedCode | null
  isFocused?: boolean
  isParallel?: boolean
  isParallelVerse?: boolean
  isINTComplete?: boolean
  tag: TaggedVerse | undefined
}

const Verse = ({
  verse,
  parallelVerse,
  secondaryVerse,
  isSelected,
  highlightedColor,
  notesCount,
  settings,
  isVerseToScroll,
  notesText,
  isSelectionMode,
  version,
  isHebreu,
  selectedCode,
  isSelectedMode,
  isFocused,
  isParallel,
  isParallelVerse,
  isINTComplete,
  tag,
}: Props) => {
  const [isTouched, setIsTouched] = useState(false)
  const detectScrollRef = useRef<any>()
  const movedRef = useRef(false)
  const shouldShortPressRef = useRef(false)
  const buttonPressTimerRef = useRef<any>()
  const dispatch = useDispatch()

  useEffect(() => {
    const handleScroll = () => {
      if (!movedRef.current) movedRef.current = true
    }

    detectScrollRef.current = window.addEventListener('scroll', handleScroll)

    return () => {
      window.removeEventListener('scroll', detectScrollRef.current)
    }
  }, [])

  const navigateToVerseNotes = useCallback(() => {
    const { Livre, Chapitre, Verset } = verse
    dispatch({
      type: NAVIGATE_TO_VERSE_NOTES,
      payload: `${Livre}-${Chapitre}-${Verset}`,
    })
  }, [verse])

  const navigateToBibleVerseDetail = useCallback(
    (additionnalParams = {}) => {
      dispatch({
        type: NAVIGATE_TO_BIBLE_VERSE_DETAIL,
        params: {
          ...additionnalParams,
          verse,
        },
      })
    },
    [verse]
  )

  const navigateToNote = useCallback((id: string) => {
    dispatch({
      type: NAVIGATE_TO_BIBLE_NOTE,
      payload: id,
    })
  }, [])

  const toggleSelectVerse = useCallback(() => {
    const { Livre, Chapitre, Verset } = verse
    dispatch({
      type: TOGGLE_SELECTED_VERSE,
      payload: `${Livre}-${Chapitre}-${Verset}`,
    })
  }, [verse])

  const onPress = useCallback(() => {
    // If selection mode verse, always toggle on press
    if (isSelectionMode && isSelectionMode.includes('verse')) {
      toggleSelectVerse()
      return
    }

    // If selection mode verse, always toggle on press
    if (isSelectionMode && isSelectionMode.includes('strong')) {
      navigateToBibleVerseDetail({ isSelectionMode })
      return
    }

    if (isSelectedMode || settings.press === 'longPress') {
      toggleSelectVerse()
    } else {
      navigateToBibleVerseDetail()
    }
  }, [
    isSelectionMode,
    isSelectedMode,
    settings.press,
    toggleSelectVerse,
    navigateToBibleVerseDetail,
  ])

  const onLongPress = useCallback(() => {
    // If selection mode, do nothing on long press
    if (isSelectionMode) {
      return
    }

    shouldShortPressRef.current = false

    if (movedRef.current === false) {
      if (settings.press === 'shortPress') {
        toggleSelectVerse()
      } else {
        setIsTouched(false)
        navigateToBibleVerseDetail()
      }
    }
  }, [
    isSelectionMode,
    settings.press,
    toggleSelectVerse,
    navigateToBibleVerseDetail,
  ])

  const onTouchStart = useCallback(() => {
    shouldShortPressRef.current = true
    movedRef.current = false

    setIsTouched(true)

    // On long press
    buttonPressTimerRef.current = setTimeout(onLongPress, 400)
  }, [onLongPress])

  const onTouchEnd = useCallback(() => {
    setIsTouched(false)
    clearTimeout(buttonPressTimerRef.current)

    if (shouldShortPressRef.current && movedRef.current === false) {
      onPress()
    }
  }, [onPress])

  const onTouchCancel = useCallback(() => {
    clearTimeout(buttonPressTimerRef.current)
  }, [])

  const onTouchMove = useCallback(() => {
    movedRef.current = true
    if (isTouched) setIsTouched(false)
  }, [isTouched])

  if (isParallelVerse && parallelVerse) {
    return (
      <div style={{ display: 'flex' }}>
        {parallelVerse.map((p, i) => {
          if (!p.verse) {
            return null
          }
          return (
            <div
              key={i}
              style={{
                flex: 1,
                padding: '5px 0',
                paddingLeft: i === 0 ? '0px' : '10px',
              }}
            >
              <Verse
                isParallel
                isHebreu={isHebreu}
                verse={p.verse}
                version={p.version}
                settings={settings}
                isSelected={isSelected}
                isSelectedMode={isSelectedMode}
                isSelectionMode={isSelectionMode}
                highlightedColor={highlightedColor}
                notesCount={notesCount}
                notesText={notesText}
                isVerseToScroll={isVerseToScroll}
                selectedCode={selectedCode}
                isFocused={isFocused}
                tag={tag}
              />
            </div>
          )
        })}
      </div>
    )
  }

  if (version === 'LSGS' || version === 'KJVS') {
    return (
      <VerseTextFormatting
        isParallel={isParallel}
        selectedCode={selectedCode}
        verse={verse}
        settings={settings}
        isFocused={isFocused}
        isTouched={isTouched}
        isSelected={isSelected}
        isVerseToScroll={isVerseToScroll && Number(verse.Verset) !== 1}
        highlightedColor={highlightedColor}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchMove={onTouchMove}
        onTouchCancel={onTouchCancel}
        notesCount={notesCount}
        inlineNotedVerses={settings.notesDisplay === 'inline'}
        isSelectionMode={isSelectionMode}
        notesText={notesText}
        navigateToVerseNotes={navigateToVerseNotes}
        navigateToNote={navigateToNote}
        tag={tag}
      />
    )
  }

  if (version === 'INT') {
    if (isINTComplete) {
      return (
        <InterlinearVerseComplete
          secondaryVerse={secondaryVerse}
          isHebreu={isHebreu}
          settings={settings}
          verse={verse}
          selectedCode={selectedCode}
        />
      )
    }
    return (
      <InterlinearVerse
        secondaryVerse={secondaryVerse}
        isHebreu={isHebreu}
        settings={settings}
        verse={verse}
        selectedCode={selectedCode}
      />
    )
  }

  let array: (string | JSX.Element)[] = verse.Texte.split(/(\n)/g)

  if (array.length > 1) {
    array = array.map((c, i) => (c === '\n' ? <Spacer key={i} /> : c))
  }

  return (
    <Wrapper settings={settings} id={`verset-${verse.Verset}`}>
      <ContainerText
        isFocused={isFocused}
        settings={settings}
        isTouched={isTouched}
        isSelected={isSelected}
        isVerseToScroll={isVerseToScroll && Number(verse.Verset) !== 1}
        highlightedColor={highlightedColor}
      >
        <NumberText isFocused={isFocused} settings={settings}>
          {verse.Verset}{' '}
        </NumberText>
        {notesCount &&
          settings.notesDisplay !== 'inline' &&
          !isSelectionMode && (
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
          {array}
        </VerseText>
        {tag && <VerseTags settings={settings} tag={tag} />}
      </ContainerText>
      {notesText && settings.notesDisplay === 'inline' && !isSelectionMode && (
        <NotesText
          isParallel={isParallel}
          settings={settings}
          onClick={navigateToNote}
          notesText={notesText}
        />
      )}
    </Wrapper>
  )
}

export default Verse
