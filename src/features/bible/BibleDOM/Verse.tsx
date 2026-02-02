import { useEffect } from 'react'
import { styled } from 'goober'

import {
  NAVIGATE_TO_BIBLE_VERSE_DETAIL,
  NAVIGATE_TO_VERSE_LINKS,
  NAVIGATE_TO_BIBLE_NOTE,
  OPEN_BOOKMARK_MODAL,
  NAVIGATE_TO_BIBLE_LINK,
  OPEN_CROSS_VERSION_MODAL,
  OPEN_VERSE_TAGS_MODAL,
  OPEN_VERSE_NOTES_MODAL,
} from './dispatch'
import VersionAnnotationIndicator, { CrossVersionAnnotation } from './VersionAnnotationIndicator'

import { scaleFontSize } from './scaleFontSize'
import { scaleLineHeight } from './scaleLineHeight'
import LinksCount from './LinksCount'
import LinksText from './LinksText'
import NotesCount from './NotesCount'
import NotesText from './NotesText'
import BookmarkIcon from './BookmarkIcon'
import TagsIndicator from './TagsIndicator'
import { RootState } from '~redux/modules/reducer'
import { useDispatch } from './DispatchProvider'
import { Bookmark, SelectedCode, StudyNavigateBibleType, Verse as TVerse } from '~common/types'
import { LinkedVerse, NotedVerse, RootStyles, TaggedVerse } from './BibleDOMWrapper'
import verseToStrong from './verseToStrong'
import { ContainerText, resolveHighlightInfo } from './ContainerText'
import { convertHex } from './convertHex'
import { HIGHLIGHT_BACKGROUND_OPACITY, getContrastTextColor } from '~helpers/highlightUtils'
import { isDarkTheme } from './utils'
import InterlinearVerseComplete from './InterlinearVerseComplete'
import InterlinearVerse from './InterlinearVerse'
import VerseTags from './VerseTags'
import CloseContextTag from './CloseContextTag'
import { BibleError } from '~helpers/bibleErrors'
import { useTranslations } from './TranslationsContext'

const VerseText = styled('span')<RootStyles & { isParallel?: boolean }>(
  ({ isParallel, settings: { fontSizeScale, lineHeight } }) => ({
    fontSize: scaleFontSize(isParallel ? 16 : 19, fontSizeScale),
    lineHeight: scaleLineHeight(isParallel ? 26 : 32, lineHeight, fontSizeScale),
    whiteSpace: 'pre-line',
  })
)

const NumberText = styled<
  RootStyles & { isFocused?: boolean; highlightBg?: string; highlightColor?: string }
>('span')(({ isFocused, highlightBg, highlightColor, settings: { fontSizeScale } }) => ({
  fontSize: scaleFontSize(14, fontSizeScale),
  display: 'inline-flex',
  marginRight: '4px',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '2px 2px',
  minWidth: '18px',
  ...(highlightBg && {
    backgroundColor: highlightBg,
    borderRadius: '3px',
    ...(highlightColor && { color: highlightColor }),
  }),
}))

const Wrapper = styled('span')<
  RootStyles & {
    isSelectedMode?: boolean
    isSelected?: boolean
    fadePosition?: 'top' | 'bottom'
  }
>(({ settings: { textDisplay, theme, colors }, isSelectedMode, isSelected, fadePosition }) => ({
  display: textDisplay,
  transition: 'opacity 0.3s ease',
  position: 'relative',
  zIndex: 1,
  ...(textDisplay === 'block'
    ? {
        marginBottom: '5px',
      }
    : {}),
  ...(isSelectedMode && !isSelected
    ? {
        opacity: 0.3,
      }
    : {}),
  ...(fadePosition
    ? {
        pointerEvents: 'none',
        filter: 'blur(4px)',
      }
    : {}),
}))

const ParallelError = styled('div')<RootStyles>(
  ({ settings: { theme, colors, fontFamily, fontSizeScale } }) => ({
    fontFamily,
    fontSize: scaleFontSize(13, fontSizeScale),
    color: colors[theme].darkGrey,
    padding: '8px',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 1.4,
  })
)

const getVerseText = ({
  verse,
  version,
  annotationMode,
  isParallel,
  selectedCode,
  settings,
}: {
  verse: TVerse
  version: string
  annotationMode: boolean
  isParallel?: boolean
  selectedCode: SelectedCode | null
  settings: RootState['user']['bible']['settings']
}): (string | JSX.Element)[] => {
  const isStrongVersion = version === 'LSGS' || version === 'KJVS'

  if (isStrongVersion) {
    return annotationMode
      ? [verse.Texte]
      : verseToStrong({
          Texte: verse.Texte,
          Livre: verse.Livre,
          isParallel,
          isDisabled: annotationMode,
          selectedCode,
          settings,
        })
  }

  return [verse.Texte]
}

// When verse has both a background-type highlight AND word annotations,
// show highlight on number instead of full verse background
const getNumberHighlight = ({
  highlightedColor,
  hasWordAnnotations,
  settings,
}: {
  highlightedColor?: keyof RootStyles['settings']['colors'][keyof RootStyles['settings']['colors']]
  hasWordAnnotations?: boolean
  settings: RootState['user']['bible']['settings']
}): { show: boolean; bg?: string; color?: string } => {
  if (!highlightedColor || !hasWordAnnotations) {
    return { show: false }
  }

  const { theme, colors, customHighlightColors, defaultColorTypes } = settings
  const highlightInfo = resolveHighlightInfo(
    highlightedColor,
    colors[theme],
    customHighlightColors,
    defaultColorTypes || {}
  )

  if (highlightInfo.type !== 'background' || highlightInfo.hex === 'transparent') {
    return { show: false }
  }

  return {
    show: true,
    bg: convertHex(highlightInfo.hex, HIGHLIGHT_BACKGROUND_OPACITY),
    color: getContrastTextColor(highlightInfo.hex, isDarkTheme(theme)),
  }
}

interface Props {
  verse: TVerse
  isSelectedMode: boolean
  isSelectionMode: StudyNavigateBibleType | undefined
  settings: RootState['user']['bible']['settings']
  parallelVerse?: {
    version: string
    verse: TVerse
    error?: BibleError
  }[]
  secondaryVerse?: TVerse | null
  isSelected: boolean
  highlightedColor?: keyof RootStyles['settings']['colors'][keyof RootStyles['settings']['colors']]
  notesCount: number
  isVerseToScroll: boolean
  notesText: NotedVerse[]
  linksCount?: number
  linksText?: LinkedVerse[]
  version: string
  isHebreu: boolean
  selectedCode: SelectedCode | null
  isFocused?: boolean
  isParallel?: boolean
  isParallelVerse?: boolean
  isINTComplete?: boolean
  tag: TaggedVerse | undefined
  bookmark?: Bookmark
  fadePosition?: 'top' | 'bottom'
  isLastFocusVerse?: boolean
  hasWordAnnotations?: boolean
  hasAnnotationNotes?: boolean
  otherVersionAnnotations?: CrossVersionAnnotation[]
  // Prop for touch visual feedback (managed by parent via useTouchSelection)
  isTouched?: boolean
  // Prop to dim decorations in annotation mode
  annotationMode?: boolean
  // Prop to show tags indicator with count
  taggedItemsCount?: number
  // Prop indicating if this verse has non-highlight tags (for conditional display)
  hasNonHighlightTags?: boolean
  // Number of columns for parallel verse display (1 = single version, 2+ = parallel)
  columnCount?: number
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
  linksCount,
  linksText,
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
  bookmark,
  fadePosition,
  isLastFocusVerse,
  hasWordAnnotations,
  hasAnnotationNotes,
  otherVersionAnnotations,
  isTouched = false,
  annotationMode = false,
  taggedItemsCount = 0,
  hasNonHighlightTags = false,
  columnCount = 1,
}: Props) => {
  const dispatch = useDispatch()
  const translations = useTranslations()

  const openVerseNotesModal = () => {
    const { Livre, Chapitre, Verset } = verse
    dispatch({
      type: OPEN_VERSE_NOTES_MODAL,
      payload: `${Livre}-${Chapitre}-${Verset}`,
    })
  }

  const navigateToVerseTags = () => {
    const { Livre, Chapitre, Verset } = verse
    dispatch({
      type: OPEN_VERSE_TAGS_MODAL,
      payload: `${Livre}-${Chapitre}-${Verset}`,
    })
  }

  const navigateToBibleVerseDetail = (additionnalParams = {}) => {
    dispatch({
      type: NAVIGATE_TO_BIBLE_VERSE_DETAIL,
      params: {
        ...additionnalParams,
        verse,
      },
    })
  }

  const navigateToNote = (id: string) => {
    dispatch({
      type: NAVIGATE_TO_BIBLE_NOTE,
      payload: id,
    })
  }

  const openBookmarkModal = () => {
    if (bookmark) {
      dispatch({
        type: OPEN_BOOKMARK_MODAL,
        payload: bookmark,
      })
    }
  }
  const navigateToVerseLinks = () => {
    const { Livre, Chapitre, Verset } = verse
    dispatch({
      type: NAVIGATE_TO_VERSE_LINKS,
      payload: `${Livre}-${Chapitre}-${Verset}`,
    })
  }

  const navigateToLink = (id: string) => {
    dispatch({
      type: NAVIGATE_TO_BIBLE_LINK,
      payload: id,
    })
  }

  const openCrossVersionModal = () => {
    if (otherVersionAnnotations && otherVersionAnnotations.length > 0) {
      const { Livre, Chapitre, Verset } = verse
      dispatch({
        type: OPEN_CROSS_VERSION_MODAL,
        payload: {
          verseKey: `${Livre}-${Chapitre}-${Verset}`,
          versions: otherVersionAnnotations,
        },
      })
    }
  }

  const isStrongVersion = version === 'LSGS' || version === 'KJVS'

  const text = getVerseText({
    verse,
    version,
    annotationMode,
    isParallel,
    selectedCode,
    settings,
  })

  const verseKey = `${verse.Livre}-${verse.Chapitre}-${verse.Verset}`

  const numberHighlight = getNumberHighlight({ highlightedColor, hasWordAnnotations, settings })

  // Dispatch layoutChanged for Strong's versions when content changes
  useEffect(() => {
    if (!isStrongVersion) return
    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent('layoutChanged'))
    })
  }, [isStrongVersion, verse.Livre, verse.Texte, annotationMode])

  if (isParallelVerse && parallelVerse) {
    return (
      <div
        style={{
          display: 'flex',
          width: columnCount > 1 ? `${columnCount * 75}vw` : '100%',
        }}
      >
        {parallelVerse.map((p, i) => {
          // Show error message if parallel version failed to load
          if (p.error) {
            const errorMessage =
              p.error.type === 'BIBLE_NOT_FOUND'
                ? translations.parallelVersionNotFound
                : p.error.type === 'CHAPTER_NOT_FOUND'
                  ? translations.parallelChapterNotFound
                  : translations.parallelLoadError
            return (
              <div
                key={i}
                style={{
                  width: columnCount > 1 ? '75vw' : '100%',
                  flexShrink: 0,
                  scrollSnapAlign: 'start',
                  padding: '5px 5px',
                  paddingLeft: i === 0 ? '0px' : '10px',
                  boxSizing: 'border-box',
                }}
              >
                <ParallelError settings={settings}>{errorMessage}</ParallelError>
              </div>
            )
          }
          if (!p.verse) {
            return (
              <div
                key={i}
                style={{
                  width: columnCount > 1 ? '75vw' : '100%',
                  flexShrink: 0,
                  scrollSnapAlign: 'start',
                  padding: '5px 5px',
                  paddingLeft: i === 0 ? '0px' : '10px',
                  boxSizing: 'border-box',
                }}
              />
            )
          }
          return (
            <div
              key={i}
              style={{
                width: columnCount > 1 ? '75vw' : '100%',
                flexShrink: 0,
                scrollSnapAlign: 'start',
                padding: '5px 5px',
                paddingLeft: i === 0 ? '0px' : '10px',
                boxSizing: 'border-box',
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
                linksCount={linksCount}
                linksText={linksText}
                isVerseToScroll={isVerseToScroll}
                selectedCode={selectedCode}
                isFocused={isFocused}
                tag={tag}
                isTouched={isTouched}
              />
            </div>
          )
        })}
      </div>
    )
  }

  if (version === 'INT' || version === 'INT_EN') {
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

  return (
    <Wrapper
      settings={settings}
      id={`verset-${verse.Verset}`}
      isSelectedMode={isSelectedMode}
      isSelected={isSelected}
      fadePosition={fadePosition}
    >
      <ContainerText
        isFocused={isFocused}
        settings={settings}
        isTouched={isTouched}
        isSelected={isSelected}
        isVerseToScroll={isVerseToScroll && Number(verse.Verset) !== 1}
        highlightedColor={numberHighlight.show ? undefined : highlightedColor}
      >
        <NumberText
          isFocused={isFocused}
          settings={settings}
          highlightBg={numberHighlight.bg}
          highlightColor={numberHighlight.color}
        >
          {verse.Verset}{' '}
        </NumberText>
        {bookmark && !isSelectionMode && (
          <BookmarkIcon
            settings={settings}
            color={bookmark.color}
            onClick={openBookmarkModal}
            isDisabled={annotationMode}
          />
        )}
        {notesCount &&
          (settings.notesDisplay !== 'inline' || hasAnnotationNotes) &&
          !isSelectionMode && (
            <NotesCount
              settings={settings}
              onClick={openVerseNotesModal}
              count={notesCount}
              isDisabled={annotationMode}
            />
          )}
        {linksCount && (settings.linksDisplay || 'inline') !== 'inline' && !isSelectionMode && (
          <LinksCount
            settings={settings}
            onClick={navigateToVerseLinks}
            count={linksCount}
            linkType={linksText?.[0]?.linkType}
            isDisabled={annotationMode}
          />
        )}
        {taggedItemsCount > 0 &&
          (settings.tagsDisplay !== 'inline' || hasNonHighlightTags) &&
          !isSelectionMode && (
            <TagsIndicator
              count={taggedItemsCount}
              settings={settings}
              onClick={navigateToVerseTags}
              isDisabled={annotationMode}
            />
          )}

        <VerseText
          isParallel={isParallel}
          settings={settings}
          id={`verse-text-${verseKey}`}
          data-verse-key={verseKey}
        >
          {text}
        </VerseText>
      </ContainerText>
      {otherVersionAnnotations && otherVersionAnnotations.length > 0 && !isSelectionMode && (
        <VersionAnnotationIndicator
          versions={otherVersionAnnotations}
          settings={settings}
          onClick={openCrossVersionModal}
          isDisabled={annotationMode}
        />
      )}
      {tag && settings.tagsDisplay === 'inline' && (
        <VerseTags settings={settings} tag={tag} isDisabled={annotationMode} />
      )}
      {isLastFocusVerse && <CloseContextTag settings={settings} isDisabled={annotationMode} />}
      {notesText && settings.notesDisplay === 'inline' && !isSelectionMode && (
        <NotesText
          isParallel={isParallel}
          settings={settings}
          onClick={navigateToNote}
          notesText={notesText}
          isDisabled={annotationMode}
        />
      )}
      {linksText && (settings.linksDisplay || 'inline') === 'inline' && !isSelectionMode && (
        <LinksText
          isParallel={isParallel}
          settings={settings}
          onClick={navigateToLink}
          linksText={linksText}
          isDisabled={annotationMode}
        />
      )}
    </Wrapper>
  )
}

export default Verse
