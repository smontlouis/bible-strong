import React, { useEffect } from 'react'
import { styled } from 'goober'

import {
  NAVIGATE_TO_BIBLE_VERSE_DETAIL,
  NAVIGATE_TO_VERSE_STUDY_RELATIONS,
  OPEN_BOOKMARK_MODAL,
  OPEN_CANONICAL_BIBLE_NOTE,
  OPEN_CROSS_VERSION_MODAL,
  OPEN_VERSE_TAGS_MODAL,
} from './dispatch'
import VersionAnnotationIndicator, { CrossVersionAnnotation } from './VersionAnnotationIndicator'

import { scaleFontSize } from './scaleFontSize'
import { scaleLineHeight } from './scaleLineHeight'
import BookmarkIcon from './BookmarkIcon'
import RelationsCount from './RelationsCount'
import RelationsText from './RelationsText'
import TagsIndicator from './TagsIndicator'
import { RootState } from '~redux/modules/reducer'
import { useDispatch } from './DispatchProvider'
import { Bookmark, SelectedCode, StudyNavigateBibleType, Verse as TVerse } from '~common/types'
import { RootStyles, TaggedVerse, VerseRelationItem } from './BibleDOMWrapper'
import { BibleStrongRef } from './BibleStrongReference'
import { verseToRedWords } from './verseToRedWords'
import { ContainerText, resolveHighlightInfo } from './ContainerText'
import { convertHex } from './convertHex'
import { HIGHLIGHT_BACKGROUND_OPACITY, getContrastTextColor } from '~helpers/highlightUtils'
import { isDarkTheme } from './utils'
// Keep optional verse renderers in the main DOM bundle: EAS Update stores DOM assets under
// hashed flat paths, so React.lazy chunks cannot be resolved by the production WebView.
import StructuredInterlinearVerse from './StructuredInterlinearVerse'
import ReverseInterlinearVerse from './ReverseInterlinearVerse'
import VerseTags from './VerseTags'
import { useTranslations } from './TranslationsContext'
import {
  getRelationItemNavigationActions,
  getVerseStudyRelationsPayload,
} from './relationDisplayActions'
import {
  buildCanonicalVersePresentation,
  shouldInsertCanonicalParagraphBreak,
  shouldInsertCanonicalBlockBreakBeforeVerse,
  type CanonicalVersePresentationNode,
} from './canonicalVersePresentation'
import { getCanonicalBibleNoteLabel, type CanonicalBibleNote } from '~helpers/canonicalBibleNotes'
import { isInterlinearModeEnabled, type InterlinearMode } from '~helpers/interlinearDisplayMode'
import { shouldHighlightOnlyVerseNumber } from './verseRenderingModel'
import { getBibleTextFontSize } from './verseTypography'
import type { ResolvedPassageMedia } from '../passageMedia'
import PassageMediaThumbnails from './PassageMediaThumbnails'
import type { PassageMediaGallerySection } from './passageMediaGallery'

const VerseText = styled('span')<RootStyles>(({ settings: { fontSizeScale, lineHeight } }) => ({
  fontSize: getBibleTextFontSize(fontSizeScale),
  lineHeight: scaleLineHeight(32, lineHeight, fontSizeScale),
  whiteSpace: 'pre-line',
}))

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

// harness-allow-styled: this renders an HTML button inside the Bible DOM WebView,
// where React Native UI primitives cannot be used.
const CanonicalNoteButton = styled('button')<RootStyles & { isDisabled?: boolean }>(
  ({ isDisabled, settings: { theme, colors, fontSizeScale } }) => ({
    appearance: 'none',
    WebkitAppearance: 'none',
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: scaleFontSize(8, fontSizeScale),
    padding: 0,
    marginInline: '2px',
    border: 0,
    background: 'transparent',
    color: colors[theme].primary,
    fontFamily: 'Georgia, serif',
    fontSize: scaleFontSize(11, fontSizeScale),
    fontStyle: 'italic',
    fontWeight: 700,
    lineHeight: 1,
    verticalAlign: 'super',
    cursor: 'pointer',
    pointerEvents: isDisabled ? 'none' : 'auto',
    opacity: isDisabled ? 0.65 : 1,
    '&::before': {
      content: '""',
      position: 'absolute',
      inset: '-6px',
    },
    '&::after': {
      content: 'attr(data-note-label)',
    },
    '&:active': {
      opacity: 0.55,
    },
  })
)

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
        contentVisibility: 'auto',
        containIntrinsicSize: 'auto 80px',
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

// Stands in for the text of a verse a version omits in parallel display
const MissingVerseText = styled('span')<RootStyles>(({ settings: { theme, colors } }) => ({
  color: colors[theme].grey,
}))

const DARK_THEMES = new Set(['dark', 'black', 'mauve', 'night'])

const getRedColor = (settings: RootState['user']['bible']['settings']): string => {
  return DARK_THEMES.has(settings.theme) ? '#FF6B6B' : '#CC0000'
}

const getVerseText = ({
  verse,
  version,
  annotationMode,
  selectedCode,
  settings,
  redWords,
  openCanonicalBibleNoteLabel,
  onOpenCanonicalNote,
}: {
  verse: TVerse
  version: string
  annotationMode: boolean
  selectedCode: SelectedCode | null
  settings: RootState['user']['bible']['settings']
  redWords?: Record<string, { start: number; end: number }[]> | null
  openCanonicalBibleNoteLabel: string
  onOpenCanonicalNote: (note: CanonicalBibleNote) => void
}): (string | JSX.Element)[] => {
  const verseKey = `${verse.Livre}-${verse.Chapitre}-${verse.Verset}`

  if (verse.TextRevision) {
    const hasVisibleStrong = !annotationMode && Boolean(verse.StrongSpans)
    const redColor = getRedColor(settings)
    const presentation = buildCanonicalVersePresentation({
      text: verse.Texte,
      startTags: verse.StartTags,
      layout: verse.Layout,
      notes: verse.Notes,
      strongSpans: hasVisibleStrong ? verse.StrongSpans : [],
      redWordRanges: !annotationMode && !hasVisibleStrong ? (redWords?.[verseKey] ?? []) : [],
      wordsOfJesusDisplay: !annotationMode && settings.redWordsDisplay,
    })
    return renderCanonicalPresentation(presentation, {
      book: verse.Livre,
      version,
      chapter: verse.Chapitre,
      verse: verse.Verset,
      isDisabled: annotationMode,
      selectedCode,
      settings,
      redColor,
      openCanonicalBibleNoteLabel,
      onOpenCanonicalNote,
    })
  }

  // Red words - only in non-annotation mode, when data exists
  if (!annotationMode && redWords && redWords[verseKey]) {
    const redColor = getRedColor(settings)
    return verseToRedWords(verse.Texte, redWords[verseKey], redColor)
  }

  return [verse.Texte]
}

const renderCanonicalPresentation = (
  nodes: CanonicalVersePresentationNode[],
  options: {
    book: string | number
    version: string
    chapter: string | number
    verse: string | number
    isDisabled: boolean
    selectedCode: SelectedCode | null
    settings: RootState['user']['bible']['settings']
    redColor: string
    openCanonicalBibleNoteLabel: string
    onOpenCanonicalNote: (note: CanonicalBibleNote) => void
  },
  keyPrefix = 'canonical'
): (string | JSX.Element)[] =>
  nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`
    if (node.kind === 'text') return node.text
    if (node.kind === 'strong-reference') {
      return (
        <BibleStrongRef
          key={key}
          book={options.book}
          version={options.version}
          identities={node.identities}
          morphologies={node.morphologies}
          occurrenceId={`${options.book}:${options.chapter}:${options.verse}:${options.version}:${key}`}
          word={node.word}
          chapter={options.chapter}
          verse={options.verse}
          isDisabled={options.isDisabled}
          selectedCode={options.selectedCode}
          settings={options.settings}
        />
      )
    }
    if (node.kind === 'paragraph-start') {
      if (
        node.offset === 0 ||
        !shouldInsertCanonicalParagraphBreak({
          offset: node.offset,
          verse: options.verse,
          textDisplay: options.settings.textDisplay,
        })
      ) {
        return <React.Fragment key={key} />
      }
      return <br key={key} />
    }
    if (node.kind === 'line-start') {
      return (
        <React.Fragment key={key}>
          {node.offset > 0 && <br />}
          <span aria-hidden style={{ display: 'inline-block', width: '0.75em' }} />
        </React.Fragment>
      )
    }
    if (node.kind === 'note-reference') {
      const noteLabel = getCanonicalBibleNoteLabel(node.note.markup) ?? 'i'
      return (
        <CanonicalNoteButton
          key={key}
          settings={options.settings}
          type="button"
          isDisabled={options.isDisabled}
          disabled={options.isDisabled}
          aria-hidden={options.isDisabled}
          aria-label={options.isDisabled ? undefined : options.openCanonicalBibleNoteLabel}
          data-ignore-verse-touch
          data-note-label={noteLabel}
          onClick={
            options.isDisabled
              ? undefined
              : event => {
                  event.preventDefault()
                  event.stopPropagation()
                  options.onOpenCanonicalNote(node.note)
                }
          }
        />
      )
    }

    const children = renderCanonicalPresentation(node.children, options, key)
    switch (node.tag.toLocaleLowerCase()) {
      case 'p':
        return <React.Fragment key={key}>{children}</React.Fragment>
      case 'lg':
      case 'list':
        return (
          <span key={key} data-canonical-poetry-group style={{ display: 'contents' }}>
            {children}
          </span>
        )
      case 'l':
      case 'item':
        return (
          <span key={key} data-canonical-poetry-line style={{ display: 'contents' }}>
            {children}
          </span>
        )
      case 'i':
        return node.attributes?.type === 'bold' ? (
          <strong key={key}>{children}</strong>
        ) : (
          <em key={key}>{children}</em>
        )
      case 'sup':
        return <sup key={key}>{children}</sup>
      case 'divinename':
      case 'small-caps':
        return (
          <span key={key} style={{ fontVariantCaps: 'small-caps' }}>
            {children}
          </span>
        )
      case 'red-word':
        return (
          <span key={key} style={{ color: options.redColor }}>
            {children}
          </span>
        )
      case 'span':
        return node.attributes?.type === 'x-p' || node.attributes?.['data-osis-tag'] === 'lb' ? (
          <br key={key} />
        ) : (
          <span key={key}>{children}</span>
        )
      default:
        return <span key={key}>{children}</span>
    }
  })

type HighlightColor = keyof RootStyles['settings']['colors'][keyof RootStyles['settings']['colors']]

// Keep background highlights off the verse text when word annotations or
// the translated Strong presentation add their own inline decorations.
const getNumberHighlight = ({
  highlightedColor,
  hasWordAnnotations,
  isStrongModeVerse,
  settings,
}: {
  highlightedColor?: HighlightColor
  hasWordAnnotations?: boolean
  isStrongModeVerse?: boolean
  settings: RootState['user']['bible']['settings']
}): { show: boolean; bg?: string; color?: string } => {
  if (
    !highlightedColor ||
    !shouldHighlightOnlyVerseNumber({ hasWordAnnotations, isStrongModeVerse })
  ) {
    return { show: false }
  }

  return getVerseNumberHighlight(highlightedColor, settings)
}

/** The colors of a verse number that carries the verse highlight. */
export const getVerseNumberHighlight = (
  highlightedColor: HighlightColor,
  settings: RootState['user']['bible']['settings']
): { show: boolean; bg?: string; color?: string } => {
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

// ============================================================================
// VERSE-LEVEL CONTENT
// What belongs to the verse whatever its version: shown once per verse, inside the verse
// when one version is read, in the row of the verse when several are.
// ============================================================================

export interface VerseContentProps {
  verse: TVerse
  settings: RootState['user']['bible']['settings']
  isSelectionMode: StudyNavigateBibleType | undefined
  annotationMode?: boolean
  bookmark?: Bookmark
  relationCount?: number
  relationItems?: VerseRelationItem[]
  taggedItemsCount?: number
  tag: TaggedVerse | undefined
  otherVersionAnnotations?: CrossVersionAnnotation[]
  passageMedia?: ResolvedPassageMedia[]
  passageMediaGallerySections: PassageMediaGallerySection[]
}

const getVerseKey = ({ Livre, Chapitre, Verset }: TVerse) => `${Livre}-${Chapitre}-${Verset}`

/** Bookmark, relation count and tag count, shown next to the verse number. */
export const VerseMarkers = ({
  verse,
  settings,
  isSelectionMode,
  annotationMode = false,
  bookmark,
  relationCount,
  taggedItemsCount = 0,
}: VerseContentProps) => {
  const dispatch = useDispatch()

  const openBookmarkModal = () => {
    if (bookmark) {
      dispatch({
        type: OPEN_BOOKMARK_MODAL,
        payload: bookmark,
      })
    }
  }

  const navigateToVerseStudyRelations = (relationItem?: VerseRelationItem) => {
    dispatch({
      type: NAVIGATE_TO_VERSE_STUDY_RELATIONS,
      payload: getVerseStudyRelationsPayload(getVerseKey(verse), relationItem),
    })
  }

  const navigateToVerseTags = () => {
    dispatch({
      type: OPEN_VERSE_TAGS_MODAL,
      payload: getVerseKey(verse),
    })
  }

  return (
    <>
      {bookmark && !isSelectionMode && (
        <BookmarkIcon
          settings={settings}
          color={bookmark.color}
          onClick={openBookmarkModal}
          isDisabled={annotationMode}
        />
      )}
      {relationCount &&
        (settings.relationsDisplay || 'inline') !== 'inline' &&
        !isSelectionMode && (
          <RelationsCount
            settings={settings}
            onClick={navigateToVerseStudyRelations}
            count={relationCount}
            isDisabled={annotationMode}
          />
        )}
      {taggedItemsCount > 0 && settings.tagsDisplay !== 'inline' && !isSelectionMode && (
        <TagsIndicator
          count={taggedItemsCount}
          settings={settings}
          onClick={navigateToVerseTags}
          isDisabled={annotationMode}
        />
      )}
    </>
  )
}

export const hasVerseMarkers = ({
  settings,
  isSelectionMode,
  bookmark,
  relationCount,
  taggedItemsCount = 0,
}: VerseContentProps) =>
  !isSelectionMode &&
  Boolean(
    bookmark ||
    (relationCount && (settings.relationsDisplay || 'inline') !== 'inline') ||
    (taggedItemsCount > 0 && settings.tagsDisplay !== 'inline')
  )

export const VersePassageMedia = ({
  settings,
  annotationMode = false,
  passageMedia,
  passageMediaGallerySections,
}: VerseContentProps) =>
  passageMedia ? (
    <PassageMediaThumbnails
      items={passageMedia}
      gallerySections={passageMediaGallerySections}
      placement="inline"
      settings={settings}
      isDisabled={annotationMode}
    />
  ) : null

/** What follows the verse text: annotations in other versions, inline tags and relations. */
export const VerseEndContent = ({
  verse,
  settings,
  isSelectionMode,
  annotationMode = false,
  relationItems,
  tag,
  otherVersionAnnotations,
}: VerseContentProps) => {
  const dispatch = useDispatch()

  const navigateToRelationItem = (item: VerseRelationItem) => {
    getRelationItemNavigationActions(getVerseKey(verse), item).forEach(action => {
      dispatch(action)
    })
  }

  const openCrossVersionModal = () => {
    if (otherVersionAnnotations && otherVersionAnnotations.length > 0) {
      dispatch({
        type: OPEN_CROSS_VERSION_MODAL,
        payload: {
          verseKey: getVerseKey(verse),
          versions: otherVersionAnnotations,
        },
      })
    }
  }

  return (
    <>
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
      {relationItems &&
        (settings.relationsDisplay || 'inline') === 'inline' &&
        !isSelectionMode && (
          <RelationsText
            settings={settings}
            onClick={navigateToRelationItem}
            relationItems={relationItems}
            isDisabled={annotationMode}
          />
        )}
    </>
  )
}

export const hasVerseEndContent = ({
  settings,
  isSelectionMode,
  relationItems,
  tag,
  otherVersionAnnotations,
  passageMedia,
}: VerseContentProps) =>
  Boolean(passageMedia?.length) ||
  Boolean(tag && settings.tagsDisplay === 'inline') ||
  (!isSelectionMode &&
    (Boolean(otherVersionAnnotations?.length) ||
      Boolean(relationItems?.length && (settings.relationsDisplay || 'inline') === 'inline')))

interface Props {
  verse: TVerse
  isSelectedMode: boolean
  isSelectionMode: StudyNavigateBibleType | undefined
  settings: RootState['user']['bible']['settings']
  // Empty row of a version that omits this verse in parallel display
  isMissingVerse?: boolean
  // One version of a parallel row: the row carries the verse anchor and the verse-level content
  isParallelCell?: boolean
  // Vertical parallel display: the verse group header shows the number
  hideNumber?: boolean
  isSelected: boolean
  highlightedColor?: keyof RootStyles['settings']['colors'][keyof RootStyles['settings']['colors']]
  annotationNotesCount?: number
  isVerseToScroll: boolean
  relationCount?: number
  relationItems?: VerseRelationItem[]
  version: string
  interlinearMode?: InterlinearMode
  isHebreu: boolean
  selectedCode: SelectedCode | null
  isFocused?: boolean
  tag: TaggedVerse | undefined
  bookmark?: Bookmark
  fadePosition?: 'top' | 'bottom'
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
  // Red words data
  redWords?: Record<string, { start: number; end: number }[]> | null
  passageMedia?: ResolvedPassageMedia[]
  passageMediaGallerySections: PassageMediaGallerySection[]
}

const Verse = ({
  verse,
  isSelected,
  highlightedColor,
  annotationNotesCount,
  settings,
  isVerseToScroll,
  relationCount,
  relationItems,
  isSelectionMode,
  version,
  interlinearMode,
  isHebreu,
  selectedCode,
  isSelectedMode,
  isFocused,
  isMissingVerse = false,
  isParallelCell = false,
  hideNumber = false,
  tag,
  bookmark,
  fadePosition,
  hasWordAnnotations,
  otherVersionAnnotations,
  isTouched = false,
  annotationMode = false,
  taggedItemsCount = 0,
  redWords,
  passageMedia,
  passageMediaGallerySections,
}: Props) => {
  const dispatch = useDispatch()
  const translations = useTranslations()

  const isStrongModeVerse = Boolean(verse.StrongSpans)
  const isStrongVersion = isStrongModeVerse || Boolean(verse.ReverseInterlinearSpans)

  const text = getVerseText({
    verse,
    version,
    annotationMode,
    selectedCode,
    settings,
    redWords,
    openCanonicalBibleNoteLabel: translations.openCanonicalBibleNote,
    onOpenCanonicalNote: note => {
      dispatch({
        type: OPEN_CANONICAL_BIBLE_NOTE,
        payload: note,
      })
    },
  })

  const paragraphBreakBeforeVerse =
    Boolean(verse.TextRevision) &&
    shouldInsertCanonicalBlockBreakBeforeVerse({
      layout: verse.Layout,
      verse: verse.Verset,
      textDisplay: settings.textDisplay,
    })

  const verseKey = `${verse.Livre}-${verse.Chapitre}-${verse.Verset}`

  const numberHighlight = getNumberHighlight({
    highlightedColor,
    hasWordAnnotations,
    isStrongModeVerse,
    settings,
  })

  const verseContent: VerseContentProps = {
    verse,
    settings,
    isSelectionMode,
    annotationMode,
    bookmark,
    relationCount,
    relationItems,
    taggedItemsCount,
    tag,
    otherVersionAnnotations,
    passageMedia,
    passageMediaGallerySections,
  }

  // Notify the annotation highlight system that DOM layout may have changed.
  // This fires per-verse rather than once at the parent level because each verse
  // independently determines when its Strong's content renders (based on its own
  // Texte/Livre/annotationMode). A single parent-level effect would need to track
  // all verse texts, adding complexity without a clear performance win since the
  // event is debounced by requestAnimationFrame.
  useEffect(() => {
    if (!isStrongVersion) return
    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent('layoutChanged'))
    })
  }, [isStrongVersion, verse.Livre, verse.Texte, annotationMode])

  return (
    <>
      {/* Parallel rows already set each verse apart: a paragraph would only lower one version */}
      {paragraphBreakBeforeVerse && !isParallelCell && <br />}
      <Wrapper
        settings={settings}
        id={isParallelCell ? undefined : `verset-${verse.Verset}`}
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
          {!hideNumber && (version !== 'BHG' || Number(verse.Verset) !== 0) && (
            <NumberText
              isFocused={isFocused}
              settings={settings}
              highlightBg={numberHighlight.bg}
              highlightColor={numberHighlight.color}
            >
              {verse.Verset}{' '}
            </NumberText>
          )}
          {!isParallelCell && <VerseMarkers {...verseContent} />}

          <VerseText
            key={[
              version,
              verseKey,
              annotationMode ? 'annotation' : 'reading',
              interlinearMode || '',
              settings.textDisplay,
              verse.TextRevision || verse.Texte,
              verse.StrongSpans?.length || 0,
              verse.ReverseInterlinearSpans?.length || 0,
              verse.InterlinearTokens?.length || 0,
              JSON.stringify(redWords?.[verseKey] || []),
            ].join(':')}
            settings={settings}
            data-verse-text
            data-version={version}
            data-verse-key={verseKey}
          >
            {verse.ReverseInterlinearSpans?.length ? (
              <ReverseInterlinearVerse
                settings={settings}
                verse={verse}
                version={version}
                selectedCode={selectedCode}
              />
            ) : version === 'BHG' &&
              isInterlinearModeEnabled(interlinearMode) &&
              verse.InterlinearTokens?.length ? (
              <StructuredInterlinearVerse
                isHebreu={isHebreu}
                settings={settings}
                verse={verse}
                version={version}
                selectedCode={selectedCode}
                mode={interlinearMode}
              />
            ) : isMissingVerse ? (
              <MissingVerseText settings={settings}>—</MissingVerseText>
            ) : (
              text
            )}
          </VerseText>
          {!isParallelCell && <VersePassageMedia {...verseContent} />}
        </ContainerText>
        {!isParallelCell && <VerseEndContent {...verseContent} />}
      </Wrapper>
    </>
  )
}

export default Verse
