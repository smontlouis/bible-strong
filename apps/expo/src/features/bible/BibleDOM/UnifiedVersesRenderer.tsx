'use dom'

import InlineCommentaryChips from './InlineCommentaryChips'
import { styled } from 'goober'
import { Bookmark, Verse as TVerse } from '~common/types'
import { HighlightsObj } from '~redux/modules/user'
import {
  ParallelVerse,
  PericopeChapter,
  RootStyles,
  TaggedVerse,
  VerseRelationItem,
  WebViewProps,
} from './BibleDOMWrapper'
import { ParallelDisplayMode } from 'src/state/tabs'
import Verse, { type VerseContentProps } from './Verse'
import ParallelVerseRow from './ParallelVerseRow'
import { PericopeHeaders, getPericopeVerse } from './PericopeHeaders'
import type { CrossVersionAnnotation } from '~redux/selectors/bible'
import {
  createVerseKey,
  getAdjacentFocusVerses,
  getFadePosition,
  getFocusVerseNumbers,
  getParallelChapterRows,
  type ParallelChapterRow,
  getTaggedVersesByLastVerse,
  getVersesWithWordAnnotations,
  shouldRenderVerseInFocusedContext,
} from './verseRenderingModel'
import type { VerseTarget } from './AnnotationMode/domUtils'
import type { ResolvedPassageMediaChapter } from '../passageMedia'
import type { PassageMediaGallerySection } from './passageMediaGallery'

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const Span = styled('span')({
  position: 'relative',
  zIndex: 1,
})

// ============================================================================
// COMPONENT
// ============================================================================

export interface UnifiedVersesRendererProps {
  inlineCommentaries?: WebViewProps['inlineCommentaries']
  verses: TVerse[]
  parallelVerses: ParallelVerse[]
  focusVerses: WebViewProps['focusVerses']
  selectedVerses: { [key: string]: boolean }
  // The version the selected verses belong to
  selectedVersesVersion: string
  highlightedVerses: HighlightsObj
  settings: RootStyles['settings']
  verseToScroll: number | undefined
  contextDisplayMode: WebViewProps['contextDisplayMode']
  isPassagePreview?: boolean
  version: string
  interlinearMode?: WebViewProps['interlinearMode']
  pericopeChapter: PericopeChapter
  // Section headings of the parallel versions
  parallelPericopeChapters?: Record<string, PericopeChapter | undefined>
  isSelectionMode: WebViewProps['isSelectionMode']
  selectedCode: WebViewProps['selectedCode']
  isHebreu: boolean
  isParallelVerse: boolean
  wordAnnotations: WebViewProps['wordAnnotations']
  wordAnnotationsInOtherVersions?: Record<string, CrossVersionAnnotation[]>
  taggedVerses: TaggedVerse[] | null
  bookmarkedVerses?: Record<number, Bookmark>
  annotationNotesCountByVerse: { [key: string]: number }
  relationItemsCount: { [key: string]: number }
  relationItemsText: { [key: string]: VerseRelationItem[] }
  versesWithAnnotationNotes?: Record<string, boolean>
  navigateToPericope: () => void
  // Annotation mode props
  annotationMode?: boolean
  // Currently touched verse, in its version (for visual feedback)
  touchedVerse?: VerseTarget | null
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
  // Red words of every version on screen
  redWordsByVersion: Record<string, Record<string, { start: number; end: number }[]> | null>
  passageMediaAfterVerses: ResolvedPassageMediaChapter['afterVerses']
  passageMediaGallerySections: PassageMediaGallerySection[]
}

export function UnifiedVersesRenderer({
  inlineCommentaries,
  verses,
  parallelVerses,
  focusVerses,
  selectedVerses,
  selectedVersesVersion,
  highlightedVerses,
  settings,
  verseToScroll,
  contextDisplayMode,
  isPassagePreview = false,
  version,
  interlinearMode,
  pericopeChapter,
  parallelPericopeChapters,
  isSelectionMode,
  selectedCode,
  isHebreu,
  isParallelVerse,
  wordAnnotations,
  wordAnnotationsInOtherVersions,
  taggedVerses,
  bookmarkedVerses,
  annotationNotesCountByVerse,
  relationItemsCount,
  relationItemsText,
  versesWithAnnotationNotes,
  navigateToPericope,
  annotationMode,
  touchedVerse,
  taggedVersesInChapter,
  versesWithNonHighlightTags,
  columnWidth = 75,
  parallelDisplayMode = 'horizontal',
  redWordsByVersion,
  passageMediaAfterVerses,
  passageMediaGallerySections,
}: UnifiedVersesRendererProps) {
  // Pre-compute numeric focus verses once to avoid repeated .map(Number) calls
  const focusVersesNumeric = getFocusVerseNumbers(focusVerses)
  const isContextFocused = contextDisplayMode === 'focused'

  // Calculate adjacent verses for fade effect in focused context mode
  const adjacentVerses = getAdjacentFocusVerses(focusVersesNumeric)

  // Pre-compute whether verses are selected (avoids Object.keys() per iteration)
  const hasSelectedVerses = Object.keys(selectedVerses).length > 0

  // Pre-compute tagged verses lookup: O(m) once instead of O(n*m) per verse
  const taggedVersesByLastVerse = getTaggedVersesByLastVerse(taggedVerses)

  // Pre-compute which verses have word annotations: O(a*r) once instead of O(n*a*r)
  const versesWithWordAnnotationsByKey = getVersesWithWordAnnotations(wordAnnotations, version)
  const parallelVersesWithWordAnnotations = isParallelVerse
    ? parallelVerses.map(parallel => ({
        version: parallel.id,
        verseKeys: getVersesWithWordAnnotations(wordAnnotations, parallel.id),
      }))
    : []
  const pericopeByVersion: Record<string, PericopeChapter | undefined> = {
    ...parallelPericopeChapters,
    [version]: pericopeChapter,
  }
  const redWords = redWordsByVersion[version]

  const chapterRows: ParallelChapterRow[] = isParallelVerse
    ? getParallelChapterRows(verses, parallelVerses, version, interlinearMode)
    : verses.map(verse => ({ verse, rows: [] }))

  return (
    <>
      {!annotationMode && !(isPassagePreview && isContextFocused) && (
        <InlineCommentaryChips chips={inlineCommentaries?.introduction} settings={settings} />
      )}
      {chapterRows.map(({ verse, rows: parallelVerse }) => {
        if (verse.Verset == 0) return null

        const { Livre, Chapitre, Verset } = verse
        const verseNumber = Number(Verset)
        const verseKey = createVerseKey(verse)

        // Apply before annotation/parallel rendering too: previews contain the passage alone.
        if (
          isPassagePreview &&
          !shouldRenderVerseInFocusedContext({
            verseNumber,
            isContextFocused,
            hasFocusVerses: Boolean(focusVersesNumeric?.length),
            isFocused: focusVersesNumeric?.includes(verseNumber),
            hideAdjacentVerses: true,
          })
        )
          return null

        const pericope = getPericopeVerse(pericopeChapter, verseNumber)
        const tag = taggedVersesByLastVerse.get(verseKey)
        const bookmark = bookmarkedVerses?.[verseNumber]
        const annotationNotesCount = annotationNotesCountByVerse[Verset]
        const relationCount = relationItemsCount[Verset]
        const relationItems = relationItemsText[Verset]
        const otherVersionAnnotations = wordAnnotationsInOtherVersions?.[verseKey]
        const touchedVersion = touchedVerse?.verseKey === verseKey ? touchedVerse.version : null
        const isTouched = touchedVersion === version
        const selectedVersion = selectedVerses[verseKey] ? selectedVersesVersion : null

        // Parallel reading, reading and annotation alike: every version of the verse.
        if (isParallelVerse) {
          const isFocused = focusVersesNumeric
            ? focusVersesNumeric.includes(verseNumber)
            : undefined
          const fadePosition = annotationMode
            ? undefined
            : getFadePosition(verseNumber, isContextFocused, adjacentVerses)
          if (
            !annotationMode &&
            !shouldRenderVerseInFocusedContext({
              verseNumber,
              isContextFocused,
              hasFocusVerses: Boolean(focusVerses),
              isFocused,
              fadePosition,
            })
          ) {
            return null
          }

          const highlight = annotationMode ? undefined : highlightedVerses[verseKey]
          const verseContent: VerseContentProps = {
            verse,
            settings,
            isSelectionMode: annotationMode ? undefined : isSelectionMode,
            annotationMode,
            bookmark,
            relationCount,
            relationItems,
            taggedItemsCount: taggedVersesInChapter?.[verseNumber] || 0,
            tag,
            otherVersionAnnotations,
            passageMedia: passageMediaAfterVerses[verseNumber],
            passageMediaGallerySections,
          }

          return (
            <Span key={verseKey}>
              <ParallelVerseRow
                verse={verse}
                cells={parallelVerse}
                displayMode={parallelDisplayMode}
                columnWidth={columnWidth}
                settings={settings}
                isHebreu={isHebreu}
                selectedCode={annotationMode ? null : selectedCode}
                isSelectionMode={annotationMode ? undefined : isSelectionMode}
                annotationMode={Boolean(annotationMode)}
                isSelectedMode={!annotationMode && hasSelectedVerses}
                selectedVersion={annotationMode ? null : selectedVersion}
                touchedVersion={touchedVersion}
                highlightedColor={
                  highlight?.color as
                    | keyof RootStyles['settings']['colors'][keyof RootStyles['settings']['colors']]
                    | undefined
                }
                isVerseToScroll={!annotationMode && !isContextFocused && verseToScroll == Verset}
                isFocused={annotationMode ? undefined : isFocused}
                fadePosition={fadePosition}
                pericopeByVersion={pericopeByVersion}
                navigateToPericope={navigateToPericope}
                redWordsByVersion={redWordsByVersion}
                versionsWithWordAnnotations={
                  new Set([
                    ...(versesWithWordAnnotationsByKey.has(verseKey) ? [version] : []),
                    ...parallelVersesWithWordAnnotations
                      .filter(parallel => parallel.verseKeys.has(verseKey))
                      .map(parallel => parallel.version),
                  ])
                }
                verseContent={verseContent}
                commentaryChips={
                  annotationMode ? undefined : inlineCommentaries?.afterVerses[verseNumber]
                }
              />
            </Span>
          )
        }

        // In annotation mode, use simplified rendering (no interlinear, etc.)
        if (annotationMode) {
          return (
            <Span key={verseKey}>
              <PericopeHeaders
                pericope={pericope}
                headings={verse.Headings}
                settings={settings}
                annotationMode={annotationMode}
                navigateToPericope={navigateToPericope}
              />
              <Verse
                isHebreu={isHebreu}
                version={version}
                verse={verse}
                settings={settings}
                isSelected={false}
                isSelectedMode={false}
                isSelectionMode={undefined}
                highlightedColor={undefined}
                annotationNotesCount={annotationNotesCount}
                relationCount={relationCount}
                relationItems={relationItems}
                isVerseToScroll={false}
                selectedCode={null}
                tag={tag}
                annotationMode={annotationMode}
                bookmark={bookmark}
                isTouched={isTouched}
                otherVersionAnnotations={otherVersionAnnotations}
                hasAnnotationNotes={versesWithAnnotationNotes?.[String(Verset)]}
                taggedItemsCount={taggedVersesInChapter?.[verseNumber] || 0}
                hasNonHighlightTags={versesWithNonHighlightTags?.[verseNumber]}
                redWords={redWords}
                passageMedia={passageMediaAfterVerses[verseNumber]}
                passageMediaGallerySections={passageMediaGallerySections}
              />
            </Span>
          )
        }

        // Normal mode rendering

        // In focused context mode, only show focused verses and adjacent fading verses
        const isFocused = focusVersesNumeric ? focusVersesNumeric.includes(verseNumber) : undefined
        const fadePosition = getFadePosition(verseNumber, isContextFocused, adjacentVerses)
        if (
          !shouldRenderVerseInFocusedContext({
            verseNumber,
            isContextFocused,
            hasFocusVerses: Boolean(focusVerses),
            isFocused,
            fadePosition,
          })
        ) {
          return null
        }

        const isSelected = selectedVersion === version
        const isHighlighted = Boolean(highlightedVerses[verseKey])
        const highlightedColor = isHighlighted
          ? (highlightedVerses[verseKey]
              .color as keyof RootStyles['settings']['colors'][keyof RootStyles['settings']['colors']])
          : undefined

        const isVerseToScroll = !isContextFocused && verseToScroll == Verset
        const hasWordAnnotations = versesWithWordAnnotationsByKey.has(verseKey)

        return (
          <Span key={verseKey}>
            <PericopeHeaders
              pericope={pericope}
              headings={verse.Headings}
              settings={settings}
              annotationMode={annotationMode}
              navigateToPericope={navigateToPericope}
            />
            <Verse
              isHebreu={isHebreu}
              version={version}
              interlinearMode={interlinearMode}
              verse={verse}
              settings={settings}
              isSelected={isSelected}
              isSelectedMode={hasSelectedVerses}
              isSelectionMode={isSelectionMode}
              highlightedColor={highlightedColor}
              annotationNotesCount={annotationNotesCount}
              relationCount={relationCount}
              relationItems={relationItems}
              isVerseToScroll={isVerseToScroll}
              selectedCode={selectedCode}
              isFocused={isFocused}
              tag={tag}
              bookmark={bookmark}
              fadePosition={fadePosition}
              hasWordAnnotations={hasWordAnnotations}
              hasAnnotationNotes={versesWithAnnotationNotes?.[String(Verset)]}
              otherVersionAnnotations={otherVersionAnnotations}
              isTouched={isTouched}
              annotationMode={annotationMode}
              taggedItemsCount={taggedVersesInChapter?.[verseNumber] || 0}
              hasNonHighlightTags={versesWithNonHighlightTags?.[verseNumber]}
              redWords={redWords}
              passageMedia={passageMediaAfterVerses[verseNumber]}
              passageMediaGallerySections={passageMediaGallerySections}
            />
            <InlineCommentaryChips
              chips={inlineCommentaries?.afterVerses[verseNumber]}
              settings={settings}
            />
          </Span>
        )
      })}
    </>
  )
}
