'use dom'

import React, { useEffect, useRef, useState } from 'react'
import { styled } from 'goober'
import { BIBLE_READING_HORIZONTAL_PADDING, PARALLEL_COLUMN_GAP } from '~common/readingLayout'
import type { SelectedCode, StudyNavigateBibleType, Verse as TVerse } from '~common/types'
import type { BibleError } from '~helpers/bibleErrors'
import type { ParallelDisplayMode } from 'src/state/tabs'
import type { ColumnTextModeControls, PericopeChapter, RootStyles } from './BibleDOMWrapper'
import InlineCommentaryChips, { type LabeledCommentaryChip } from './InlineCommentaryChips'
import { PericopeHeaders, getPericopeVerse, hasPericopeHeadings } from './PericopeHeaders'
import { NAVIGATE_TO_VERSION, OPEN_COLUMN_TEXT_MODE } from './dispatch'
import VersionChip from './VersionChip'
import { useDispatch } from './DispatchProvider'
import { useTranslations } from './TranslationsContext'
import Verse, {
  VerseEndContent,
  VerseMarkers,
  VersePassageMedia,
  getVerseNumberHighlight,
  hasVerseEndContent,
  hasVerseMarkers,
  type VerseContentProps,
} from './Verse'
import type { FadePosition, ParallelVerseRow as ParallelVerseCell } from './verseRenderingModel'
import { scaleFontSize } from './scaleFontSize'

type RedWords = Record<string, { start: number; end: number }[]> | null | undefined
type HighlightColor = keyof RootStyles['settings']['colors'][keyof RootStyles['settings']['colors']]

// A verse-level block longer than this share of the screen would hide the versions it
// follows: it then stays in the flow instead of sticking to the bottom.
const STICKY_VERSE_END_MAX_SCREEN_SHARE = 0.4

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

// Version title for vertical display mode: the version's chip, before its text
const VerticalVersionTitle = styled('div')({
  // Inline, as the pill it replaces: the verse's text follows it
  display: 'inline-flex',
  marginTop: '8px',
  marginBottom: '4px',
  marginInlineEnd: '6px',
})

// The vertical title repeats on every verse: a little lower than the column titles
const VERTICAL_VERSION_CHIP_HEIGHT = 28

// Separator between verse groups in vertical mode
const VerseGroupSeparator = styled('div')<RootStyles>(({ settings: { theme, colors } }) => ({
  height: '1px',
  backgroundColor: colors[theme].border,
  marginTop: '40px',
  marginBottom: '40px',
}))

// Horizontal mode: the verse-level content under a row, kept in view whatever column
// the reader scrolled to.
const VerseBand = styled('div')<RootStyles & { $dimmed: boolean }>(({ $dimmed }) => ({
  position: 'sticky',
  left: 0,
  width: 'calc(100vw - 30px)',
  maxWidth: '100%',
  boxSizing: 'border-box',
  paddingBottom: '8px',
  opacity: $dimmed ? 0.3 : 1,
  transition: 'opacity 0.3s ease',
  zIndex: 1,
}))

// Vertical mode: the verse number and its markers, kept in view over the stacked versions.
const VerseGroupHeader = styled('div')<RootStyles & { $dimmed: boolean }>(
  ({ settings: { theme, colors, fontSizeScale }, $dimmed }) => ({
    position: 'sticky',
    top: 'var(--header-height)',
    zIndex: 2,
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '2px',
    paddingBlock: '6px',
    backgroundColor: colors[theme].reverse,
    fontSize: scaleFontSize(14, fontSizeScale),
    opacity: $dimmed ? 0.3 : 1,
    transition: 'opacity 0.3s ease, top 0.3s cubic-bezier(.13,.69,.5,.98)',
  })
)

const GroupNumber = styled('span')<RootStyles & { $bg?: string; $color?: string }>(
  ({ settings: { fontSizeScale }, $bg, $color }) => ({
    fontSize: scaleFontSize(14, fontSizeScale),
    fontWeight: 'bold',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '18px',
    padding: '2px 4px',
    marginRight: '4px',
    ...($bg ? { backgroundColor: $bg, borderRadius: '3px' } : {}),
    ...($color ? { color: $color } : {}),
  })
)

/** Sticks to the bottom of the screen while the reader goes through the verse's versions. */
const StickyVerseEnd = ({
  settings,
  isDimmed,
  children,
}: RootStyles & { isDimmed: boolean; children: React.ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null)
  const [isSticky, setIsSticky] = useState(true)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const update = () =>
      setIsSticky(element.offsetHeight <= window.innerHeight * STICKY_VERSE_END_MAX_SCREEN_SHARE)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [])

  const { theme, colors } = settings
  return (
    <div
      ref={ref}
      style={{
        position: isSticky ? 'sticky' : 'static',
        bottom: 'var(--footer-height, 0px)',
        transition: 'opacity 0.3s ease, bottom 0.3s cubic-bezier(.13,.69,.5,.98)',
        zIndex: 2,
        paddingBlock: '6px',
        backgroundColor: colors[theme].reverse,
        borderTop: isSticky ? `1px solid ${colors[theme].border}` : undefined,
        opacity: isDimmed ? 0.3 : 1,
      }}
    >
      {children}
    </div>
  )
}

const getParallelErrorMessage = (
  error: BibleError,
  translations: ReturnType<typeof useTranslations>
): string => {
  switch (error.type) {
    case 'BIBLE_NOT_FOUND':
      return translations.parallelVersionNotFound
    case 'CHAPTER_NOT_FOUND':
      return translations.parallelChapterNotFound
    default:
      return translations.parallelLoadError
  }
}

export interface ParallelVerseRowProps {
  verse: TVerse
  cells: ParallelVerseCell[]
  displayMode: ParallelDisplayMode
  columnWidth: number
  settings: RootStyles['settings']
  isHebreu: boolean
  selectedCode: SelectedCode | null
  isSelectionMode: StudyNavigateBibleType | undefined
  annotationMode: boolean
  // Some verse of the chapter is selected
  isSelectedMode: boolean
  // The version this verse is selected in, if it is
  selectedVersion: string | null
  // The version of this verse under the reader's finger, if any
  touchedVersion: string | null
  highlightedColor?: HighlightColor
  isVerseToScroll: boolean
  isFocused?: boolean
  fadePosition?: FadePosition
  pericopeByVersion: Record<string, PericopeChapter | undefined>
  navigateToPericope: () => void
  redWordsByVersion: Record<string, RedWords>
  // Versions in which word annotations mark this verse
  versionsWithWordAnnotations: Set<string>
  // Verse-level content: shown once for the verse, whatever the number of versions
  verseContent: VerseContentProps
  commentaryChips?: readonly LabeledCommentaryChip[]
  // The Strong and interlinear segments of each version's chip, the main version first
  textModeControls?: ColumnTextModeControls[]
}

/**
 * One verse in several versions: side by side (horizontal) or stacked (vertical).
 * Each version shows its own text, word annotations, red words and headings; the
 * verse-level content (bookmark, counts, tags, relations, media, commentaries) is shown once.
 */
const ParallelVerseRow = ({
  verse,
  cells,
  displayMode,
  columnWidth,
  settings,
  isHebreu,
  selectedCode,
  isSelectionMode,
  annotationMode,
  isSelectedMode,
  selectedVersion,
  touchedVersion,
  highlightedColor,
  isVerseToScroll,
  isFocused,
  fadePosition,
  pericopeByVersion,
  navigateToPericope,
  redWordsByVersion,
  versionsWithWordAnnotations,
  verseContent,
  commentaryChips,
  textModeControls,
}: ParallelVerseRowProps) => {
  const dispatch = useDispatch()
  const translations = useTranslations()
  const isVertical = displayMode === 'vertical'
  const verseNumber = Number(verse.Verset)
  const isRowDimmed = isSelectedMode && !selectedVersion
  const hasMarkers = hasVerseMarkers(verseContent)
  const hasEndContent = hasVerseEndContent(verseContent) || Boolean(commentaryChips?.length)

  const getCellPericope = (cell: ParallelVerseCell) =>
    getPericopeVerse(pericopeByVersion[cell.version], verseNumber)

  const renderHeadings = (cell: ParallelVerseCell) => (
    <PericopeHeaders
      pericope={getCellPericope(cell)}
      headings={cell.verse.Headings}
      settings={settings}
      annotationMode={annotationMode}
      navigateToPericope={navigateToPericope}
      isCompact={!isVertical}
    />
  )

  // Vertical display: the main version's headings open the verse group, above its number.
  // Horizontal display: headings get a row of their own, above the verse.
  const renderCell = (cell: ParallelVerseCell, index: number) => (
    <>
      {isVertical && index > 0 && renderHeadings(cell)}
      {isVertical && (
        <VerticalVersionTitle data-ignore-verse-touch>
          <VersionChip
            settings={settings}
            version={cell.version}
            controls={textModeControls?.[index]}
            height={VERTICAL_VERSION_CHIP_HEIGHT}
            onVersionPress={() => {
              dispatch({
                type: NAVIGATE_TO_VERSION,
                payload: { version: cell.version, index },
              })
            }}
            onTextModePress={kind => {
              dispatch({
                type: OPEN_COLUMN_TEXT_MODE,
                payload: { kind, column: index },
              })
            }}
          />
        </VerticalVersionTitle>
      )}
      {cell.error ? (
        <ParallelError settings={settings}>
          {getParallelErrorMessage(cell.error, translations)}
        </ParallelError>
      ) : (
        <Verse
          isParallelCell
          hideNumber={isVertical}
          isHebreu={isHebreu}
          verse={cell.verse}
          version={cell.version}
          interlinearMode={cell.interlinearMode}
          settings={settings}
          isSelected={selectedVersion === cell.version}
          isSelectedMode={isSelectedMode}
          isSelectionMode={isSelectionMode}
          highlightedColor={highlightedColor}
          hasWordAnnotations={versionsWithWordAnnotations.has(cell.version)}
          isVerseToScroll={index === 0 && isVerseToScroll}
          selectedCode={selectedCode}
          isFocused={isFocused}
          fadePosition={fadePosition}
          tag={undefined}
          isTouched={touchedVersion === cell.version}
          isMissingVerse={cell.isMissing}
          annotationMode={annotationMode}
          redWords={redWordsByVersion[cell.version]}
          passageMediaGallerySections={verseContent.passageMediaGallerySections}
        />
      )}
    </>
  )

  const endContent = (
    <>
      <VersePassageMedia {...verseContent} />
      <VerseEndContent {...verseContent} />
      <InlineCommentaryChips chips={commentaryChips} settings={settings} />
    </>
  )

  if (isVertical) {
    const numberHighlight = highlightedColor
      ? getVerseNumberHighlight(highlightedColor, settings)
      : { show: false }

    return (
      <div id={`verset-${verse.Verset}`}>
        {cells[0] && renderHeadings(cells[0])}
        <VerseGroupHeader settings={settings} $dimmed={isRowDimmed}>
          <GroupNumber
            settings={settings}
            $bg={numberHighlight.show ? numberHighlight.bg : undefined}
            $color={numberHighlight.show ? numberHighlight.color : undefined}
          >
            {verse.Verset}
          </GroupNumber>
          {hasMarkers && <VerseMarkers {...verseContent} />}
        </VerseGroupHeader>
        {cells.map((cell, index) => (
          // A version can be shown twice: columns are keyed by position
          <div key={`${index}:${cell.version}`}>{renderCell(cell, index)}</div>
        ))}
        {hasEndContent && (
          <StickyVerseEnd settings={settings} isDimmed={isRowDimmed}>
            {endContent}
          </StickyVerseEnd>
        )}
        <VerseGroupSeparator settings={settings} />
      </div>
    )
  }

  const columnStyle = (index: number): React.CSSProperties => ({
    width: `calc(${columnWidth}vw - ${PARALLEL_COLUMN_GAP}px)`,
    transition: 'width 0.4s ease-in-out',
    flexShrink: 0,
    padding: '5px 5px',
    paddingLeft: index === 0 ? 0 : PARALLEL_COLUMN_GAP,
    boxSizing: 'border-box',
  })

  return (
    <div
      id={`verset-${verse.Verset}`}
      style={{
        width: 'max-content',
        // The scroller's end padding, carried by the row: WebKit leaves a scroller's end padding
        // out of its scroll width. The negative margin keeps engines that count it from doubling it.
        paddingInlineEnd: BIBLE_READING_HORIZONTAL_PADDING,
        marginInlineEnd: -BIBLE_READING_HORIZONTAL_PADDING,
      }}
    >
      {/* A version's headings would push down its verse alone: they share a row, so that
          every version starts the verse at the same height */}
      {cells.some(cell => hasPericopeHeadings(getCellPericope(cell))) && (
        <div style={{ display: 'flex' }}>
          {cells.map((cell, index) => (
            <div
              key={`${index}:${cell.version}`}
              style={{ ...columnStyle(index), paddingBlock: 0 }}
            >
              {renderHeadings(cell)}
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex' }}>
        {cells.map((cell, index) => (
          <div key={`${index}:${cell.version}`} style={columnStyle(index)}>
            {renderCell(cell, index)}
          </div>
        ))}
      </div>
      {(hasMarkers || hasEndContent) && (
        <VerseBand settings={settings} $dimmed={isRowDimmed}>
          {hasMarkers && <VerseMarkers {...verseContent} />}
          {endContent}
        </VerseBand>
      )}
    </div>
  )
}

export default ParallelVerseRow
