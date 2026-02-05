'use dom'

import { styled } from 'goober'
import { Verse as TVerse } from '~common/types'
import { HighlightsObj } from '~redux/modules/user'
import {
  LinkedVerse,
  NotedVerse,
  ParallelVerse,
  PericopeChapter,
  RootStyles,
  TaggedVerse,
  WebViewProps,
} from './BibleDOMWrapper'
import { ParallelDisplayMode } from 'src/state/tabs'
import Comment from './Comment'
import ExternalIcon from './ExternalIcon'
import Verse from './Verse'
import { scaleFontSize } from './scaleFontSize'
import type { CrossVersionAnnotation } from '~redux/selectors/bible'
import { BibleError } from '~helpers/bibleErrors'

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const Span = styled('span')({
  position: 'relative',
  zIndex: 1,
})

const H1 = styled('h1')<RootStyles>(({ settings: { fontSizeScale, fontFamily } }) => ({
  fontFamily,
  fontSize: scaleFontSize(28, fontSizeScale),
  textAlign: 'start',
  position: 'relative',
  zIndex: 1,
}))

const H2 = styled('h2')<RootStyles>(({ settings: { fontSizeScale, fontFamily } }) => ({
  fontFamily,
  fontSize: scaleFontSize(24, fontSizeScale),
  textAlign: 'start',
  position: 'relative',
  zIndex: 1,
}))

const H3 = styled('h3')<RootStyles>(({ settings: { fontSizeScale, fontFamily } }) => ({
  fontFamily,
  fontSize: scaleFontSize(20, fontSizeScale),
  textAlign: 'start',
  position: 'relative',
  zIndex: 1,
}))

const H4 = styled('h4')<RootStyles>(({ settings: { fontSizeScale, fontFamily } }) => ({
  fontFamily,
  fontSize: scaleFontSize(18, fontSizeScale),
  textAlign: 'start',
  position: 'relative',
  zIndex: 1,
}))

// ============================================================================
// HELPERS
// ============================================================================

const getPericopeVerse = (pericopeChapter: PericopeChapter, verse: number) => {
  if (pericopeChapter && pericopeChapter[verse]) {
    return pericopeChapter[verse]
  }
  return {}
}

/**
 * Determines the fade position for a verse in readonly mode.
 * Returns 'top' for the verse before the focus range, 'bottom' for the verse after.
 */
const getFadePosition = (
  verset: number,
  isReadOnly: boolean | undefined,
  adjacentVerses: { prev: number; next: number } | null
): 'top' | 'bottom' | undefined => {
  if (!isReadOnly || !adjacentVerses) return undefined
  if (verset === adjacentVerses.prev) return 'top'
  if (verset === adjacentVerses.next) return 'bottom'
  return undefined
}

const extractParallelVerse = (
  i: number,
  parallelVerses: ParallelVerse[],
  verse: TVerse,
  version: string
): { version: string; verse: TVerse; error?: BibleError }[] => {
  const result: { version: string; verse: TVerse; error?: BibleError }[] = [{ version, verse }]

  parallelVerses.forEach(({ id, verses, error }) => {
    const parallelVerse = verses?.[i]
    if (parallelVerse) {
      result.push({
        version: id,
        verse: parallelVerse,
        error,
      })
    } else {
      // Push a placeholder for missing verse
      result.push({
        version: id,
        verse: { ...verse, Texte: '' },
        error,
      })
    }
  })

  return result
}

// ============================================================================
// COMPONENT
// ============================================================================

export interface UnifiedVersesRendererProps {
  verses: TVerse[]
  parallelVerses: ParallelVerse[]
  focusVerses: WebViewProps['focusVerses']
  secondaryVerses: TVerse[] | null
  selectedVerses: { [key: string]: boolean }
  highlightedVerses: HighlightsObj
  settings: RootStyles['settings']
  verseToScroll: number | undefined
  isReadOnly: WebViewProps['isReadOnly']
  version: string
  pericopeChapter: PericopeChapter
  isSelectionMode: WebViewProps['isSelectionMode']
  selectedCode: WebViewProps['selectedCode']
  isINTComplete: boolean
  isHebreu: boolean
  isParallelVerse: boolean
  comments: { [key: string]: string } | null
  wordAnnotations: WebViewProps['wordAnnotations']
  wordAnnotationsInOtherVersions?: Record<string, CrossVersionAnnotation[]>
  taggedVerses: TaggedVerse[] | null
  bookmarkedVerses?: Record<number, any>
  notedVersesCount: { [key: string]: number }
  notedVersesText: { [key: string]: NotedVerse[] }
  linkedVersesCount: { [key: string]: number }
  linkedVersesText: { [key: string]: LinkedVerse[] }
  versesWithAnnotationNotes?: Set<string>
  navigateToPericope: () => void
  // Annotation mode props
  annotationMode?: boolean
  // Currently touched verse key (for visual feedback)
  touchedVerseKey?: string | null
  // Verses with tagged items count (for showing tags indicator with count)
  taggedVersesInChapter?: Record<number, number>
  // Verses with non-highlight tags (for showing tags indicator when tagsDisplay is 'inline')
  versesWithNonHighlightTags?: Record<number, boolean>
  // Number of columns for parallel verse display (1 = single version, 2+ = parallel)
  columnCount?: number
  // Width of each column in parallel mode (percentage: 75 or 50)
  columnWidth?: number
  // Display mode for parallel verses (horizontal = side by side, vertical = stacked)
  parallelDisplayMode?: ParallelDisplayMode
  // Red words data
  redWords?: Record<string, { start: number; end: number }[]> | null
}

export function UnifiedVersesRenderer({
  verses,
  parallelVerses,
  focusVerses,
  secondaryVerses,
  selectedVerses,
  highlightedVerses,
  settings,
  verseToScroll,
  isReadOnly,
  version,
  pericopeChapter,
  isSelectionMode,
  selectedCode,
  isINTComplete,
  isHebreu,
  isParallelVerse,
  comments,
  wordAnnotations,
  wordAnnotationsInOtherVersions,
  taggedVerses,
  bookmarkedVerses,
  notedVersesCount,
  notedVersesText,
  linkedVersesCount,
  linkedVersesText,
  versesWithAnnotationNotes,
  navigateToPericope,
  annotationMode,
  touchedVerseKey,
  taggedVersesInChapter,
  versesWithNonHighlightTags,
  columnCount = 1,
  columnWidth = 75,
  parallelDisplayMode = 'horizontal',
  redWords,
}: UnifiedVersesRendererProps) {
  // Calculate adjacent verses for fade effect in readonly mode
  const adjacentVerses = focusVerses
    ? {
        prev: Math.min(...focusVerses.map(Number)) - 1,
        next: Math.max(...focusVerses.map(Number)) + 1,
      }
    : null

  // Calculate last focus verse for close context button
  const lastFocusVerse = focusVerses ? Math.max(...focusVerses.map(Number)) : null

  return (
    <>
      {verses.map((verse, i) => {
        if (verse.Verset == 0) return null

        const { Livre, Chapitre, Verset } = verse
        const verseKey = `${Livre}-${Chapitre}-${Verset}`

        // In annotation mode, skip complex rendering for parallel verses, interlinear, etc.
        // Use simplified rendering
        if (annotationMode) {
          // Skip verse 0
          if (Verset === 0) return null

          const { h1, h2, h3, h4 } = getPericopeVerse(pericopeChapter, Number(Verset))

          // Get decoration data for this verse
          const tag = taggedVerses?.find(v => v.lastVerse === verseKey)
          const bookmark = bookmarkedVerses?.[Number(Verset)]
          const notesCount = notedVersesCount[Verset]
          const notesText = notedVersesText[Verset]
          const linksCount = linkedVersesCount[Verset]
          const linksText = linkedVersesText[Verset]
          const otherVersionAnnotations = wordAnnotationsInOtherVersions?.[verseKey]
          const isTouched = touchedVerseKey === verseKey

          return (
            <Span key={verseKey}>
              {h1 && <H1 settings={settings}>{h1}</H1>}
              {h2 && <H2 settings={settings}>{h2}</H2>}
              {h3 && <H3 settings={settings}>{h3}</H3>}
              {h4 && <H4 settings={settings}>{h4}</H4>}
              <Verse
                isHebreu={isHebreu}
                version={version}
                verse={verse}
                settings={settings}
                isSelected={false}
                isSelectedMode={false}
                isSelectionMode={undefined}
                highlightedColor={undefined}
                notesCount={notesCount}
                notesText={notesText}
                linksCount={linksCount}
                linksText={linksText}
                isVerseToScroll={false}
                selectedCode={null}
                tag={tag}
                annotationMode={annotationMode}
                bookmark={bookmark}
                isTouched={isTouched}
                otherVersionAnnotations={otherVersionAnnotations}
                hasAnnotationNotes={versesWithAnnotationNotes?.has(String(Verset))}
                taggedItemsCount={taggedVersesInChapter?.[Number(Verset)] || 0}
                hasNonHighlightTags={versesWithNonHighlightTags?.[Number(Verset)]}
                redWords={redWords}
              />
            </Span>
          )
        }

        // Normal mode rendering (existing NormalVersesRenderer logic)

        // In readonly mode, only show focused verses and adjacent fading verses
        const isFocused = focusVerses
          ? focusVerses.some(v => Number(v) === Number(Verset))
          : undefined
        const fadePosition = getFadePosition(Number(Verset), isReadOnly, adjacentVerses)
        if (isReadOnly && focusVerses && !isFocused && !fadePosition) return null

        const isSelected = Boolean(selectedVerses[verseKey])
        const isSelectedMode = Boolean(Object.keys(selectedVerses).length)
        const isHighlighted = Boolean(highlightedVerses[verseKey])
        const tag: TaggedVerse | undefined = taggedVerses?.find(v => v.lastVerse === verseKey)
        const highlightedColor = isHighlighted
          ? (highlightedVerses[verseKey]
              .color as keyof RootStyles['settings']['colors'][keyof RootStyles['settings']['colors']])
          : undefined

        const notesCount = notedVersesCount[Verset]
        const notesText = notedVersesText[Verset]
        const linksCount = linkedVersesCount[Verset]
        const linksText = linkedVersesText[Verset]
        const comment = comments?.[Verset]
        const isVerseToScroll = !isReadOnly && verseToScroll == Verset
        const secondaryVerse = secondaryVerses && secondaryVerses[i]
        const parallelVerse = isParallelVerse
          ? extractParallelVerse(i, parallelVerses, verse, version)
          : []

        const { h1, h2, h3, h4 } = getPericopeVerse(pericopeChapter, Number(Verset))

        const bookmark = bookmarkedVerses?.[Number(Verset)]

        // Show close context button on last focus verse when not in readonly mode
        const isLastFocusVerse =
          !isReadOnly && lastFocusVerse !== null && Number(Verset) === lastFocusVerse

        // Check if this verse has word annotations
        const hasWordAnnotations =
          wordAnnotations &&
          Object.values(wordAnnotations).some(
            ann => ann.version === version && ann.ranges.some(r => r.verseKey === verseKey)
          )

        // Get annotations in other versions for this verse
        const otherVersionAnnotations = wordAnnotationsInOtherVersions?.[verseKey]

        // Check if this verse is currently touched
        const isTouched = touchedVerseKey === verseKey

        return (
          <Span key={verseKey}>
            {h1 && (
              <H1 settings={settings} onClick={navigateToPericope}>
                {h1}
                <ExternalIcon />
              </H1>
            )}
            {h2 && (
              <H2 settings={settings} onClick={navigateToPericope}>
                {h2}
                <ExternalIcon />
              </H2>
            )}
            {h3 && (
              <H3 settings={settings} onClick={navigateToPericope}>
                {h3}
                <ExternalIcon />
              </H3>
            )}
            {h4 && (
              <H4 settings={settings} onClick={navigateToPericope}>
                {h4}
                <ExternalIcon />
              </H4>
            )}
            <Verse
              isHebreu={isHebreu}
              version={version}
              verse={verse}
              isParallelVerse={isParallelVerse}
              parallelVerse={parallelVerse}
              secondaryVerse={secondaryVerse}
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
              isINTComplete={isINTComplete}
              tag={tag}
              bookmark={bookmark}
              fadePosition={fadePosition}
              isLastFocusVerse={isLastFocusVerse}
              hasWordAnnotations={hasWordAnnotations}
              hasAnnotationNotes={versesWithAnnotationNotes?.has(String(Verset))}
              otherVersionAnnotations={otherVersionAnnotations}
              isTouched={isTouched}
              annotationMode={annotationMode}
              taggedItemsCount={taggedVersesInChapter?.[Number(Verset)] || 0}
              hasNonHighlightTags={versesWithNonHighlightTags?.[Number(Verset)]}
              columnCount={columnCount}
              columnWidth={columnWidth}
              parallelDisplayMode={parallelDisplayMode}
              redWords={redWords}
            />
            {!!comment && settings.commentsDisplay && (
              <Comment id={`comment-${verse.Verset}`} settings={settings} comment={comment} />
            )}
          </Span>
        )
      })}
    </>
  )
}
