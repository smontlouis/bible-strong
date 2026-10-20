'use dom'

import { useEffect, RefObject } from 'react'
import { Verse as TVerse } from '~common/types'
import { WordToken } from '~helpers/wordTokenizer'
import { Dispatch, WebViewProps } from '../BibleDOMWrapper'
import { HighlightRect } from './HighlightComponents'
import { SelectionRange } from './selectionUtils'
import { useTouchSelection } from './useTouchSelection'
import { useAnnotationEvents } from './useAnnotationEvents'
import type { VerseTarget } from './verseTargets'

/** Callbacks for gesture handling passed through to touch selection */
interface AnnotationModeCallbacks {
  onMouseSelectionStart?: (verse: VerseTarget) => boolean
  /** Called on single tap - receives the verse (and its version) and touch position */
  onTapVerse?: (verse: VerseTarget, position: { x: number; y: number }) => void
  /** Whether a tap on this verse waits to rule out a double tap */
  shouldWaitForDoubleTap?: (verse: VerseTarget) => boolean
  /** Called when a tap is held back to rule out a double tap, before onTapVerse */
  onTapVerseHeld?: (verse: VerseTarget) => void
  /** Called on double tap - receives the verse (and its version) and touch position */
  onDoubleTapVerse?: (verse: VerseTarget, position: { x: number; y: number }) => void
  /** Called on long press */
  onLongPressVerse?: (verse: VerseTarget) => void
  /** Called to notify which verse is currently being touched (for visual feedback) */
  onTouchedVerseChange?: (verse: VerseTarget | null) => void
  /** Called when tapping on empty space (not on a verse) - useful for clearing selection */
  onTapEmpty?: () => void
  /** Called on horizontal swipe (fast movement) - for chapter navigation */
  onSwipe?: (direction: 'left' | 'right') => void
}

/** Triggers from native side to control annotation actions */
interface AnnotationModeTriggers {
  clearSelectionTrigger?: number
  applyAnnotationTrigger?: WebViewProps['applyAnnotationTrigger']
  eraseSelectionTrigger?: number
}

interface UseAnnotationModeControllerProps {
  // Core
  containerRef: RefObject<HTMLDivElement | null>
  // The element the highlight layer is drawn in
  highlightOriginRef: RefObject<HTMLDivElement | null>
  annotationMode: boolean | undefined
  // The verses of every version on screen
  versesByVersion: Record<string, TVerse[]>
  dispatch: Dispatch
  // Selection state (managed by parent)
  selection: SelectionRange | null
  setSelection: (
    value: SelectionRange | null | ((prev: SelectionRange | null) => SelectionRange | null)
  ) => void
  getTokens: (verseKey: string, text: string) => WordToken[]
  // Highlight data
  highlightRects: HighlightRect[]
  selectionHandlePositions: {
    start: { x: number; y: number } | null
    end: { x: number; y: number } | null
  }
  selectedAnnotationId: string | null | undefined
  // Triggers from native side
  triggers?: AnnotationModeTriggers
  // Gesture callbacks
  callbacks?: AnnotationModeCallbacks
}

interface UseAnnotationModeControllerReturn {
  lastDragEndRef: RefObject<number>
}

export function useAnnotationModeController({
  containerRef,
  highlightOriginRef,
  annotationMode,
  versesByVersion,
  dispatch,
  selection,
  setSelection,
  getTokens,
  highlightRects,
  selectionHandlePositions,
  selectedAnnotationId,
  triggers = {},
  callbacks = {},
}: UseAnnotationModeControllerProps): UseAnnotationModeControllerReturn {
  const { clearSelectionTrigger, applyAnnotationTrigger, eraseSelectionTrigger } = triggers
  const {
    onMouseSelectionStart,
    onTapVerse,
    shouldWaitForDoubleTap,
    onTapVerseHeld,
    onDoubleTapVerse,
    onLongPressVerse,
    onTouchedVerseChange,
    onTapEmpty,
    onSwipe,
  } = callbacks

  // Touch selection hook (handles all gestures)
  const { lastDragEndRef } = useTouchSelection({
    containerRef,
    highlightOriginRef,
    selection,
    setSelection: fn => setSelection(fn),
    versesByVersion,
    getTokens,
    getSelectionHandlePositions: () => selectionHandlePositions,
    highlightRects,
    annotationMode: annotationMode ?? false,
    callbacks: {
      onMouseSelectionStart,
      onTapVerse,
      shouldWaitForDoubleTap,
      onTapVerseHeld,
      onDoubleTapVerse,
      onLongPressVerse,
      onDragStart: () => {
        if (selectedAnnotationId) {
          dispatch({
            type: 'ANNOTATION_SELECTED',
            payload: { annotationId: null },
          }).catch(console.error)
        }
      },
      onTouchedVerseChange,
      onTapEmpty,
      onSwipe,
    },
  })

  // Annotation events hook (only active in annotation mode)
  useAnnotationEvents({
    selection: annotationMode ? selection : null,
    setSelection,
    versesByVersion,
    dispatch,
    getTokens,
    clearSelectionTrigger,
    applyAnnotationTrigger,
    eraseSelectionTrigger,
  })

  // Selection changed notification (only in annotation mode)
  // Debounced to only dispatch when user stops dragging (300ms delay)
  useEffect(() => {
    if (!annotationMode) return

    const timeoutId = setTimeout(() => {
      // Dispatch to native
      dispatch({
        type: 'SELECTION_CHANGED',
        payload: { hasSelection: selection !== null, selection },
      }).catch(console.error)
    }, 300) // 300ms debounce - waits for user to stop dragging

    return () => clearTimeout(timeoutId)
  }, [selection, annotationMode])

  // Clear selection when exiting annotation mode
  useEffect(() => {
    if (!annotationMode) {
      setSelection(null)
    }
  }, [annotationMode])

  return {
    lastDragEndRef,
  }
}
