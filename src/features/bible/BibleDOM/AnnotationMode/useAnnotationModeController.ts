'use dom'

import { useEffect, RefObject } from 'react'
import { Verse as TVerse } from '~common/types'
import { WordToken } from '~helpers/wordTokenizer'
import { Dispatch, WebViewProps } from '../BibleDOMWrapper'
import { HighlightRect } from './HighlightComponents'
import { SelectionRange } from './selectionUtils'
import { useTouchSelection } from './useTouchSelection'
import { useAnnotationEvents } from './useAnnotationEvents'

/** Callbacks for gesture handling passed through to touch selection */
interface AnnotationModeCallbacks {
  /** Called on single tap - receives verseKey and touch position */
  onTapVerse?: (verseKey: string, position: { x: number; y: number }) => void
  /** Called on double tap - receives verseKey and touch position */
  onDoubleTapVerse?: (verseKey: string, position: { x: number; y: number }) => void
  /** Called on long press */
  onLongPressVerse?: (verseKey: string) => void
  /** Called when horizontal drag detected in normal mode - triggers entry into annotation mode */
  onEnterAnnotationModeFromDrag?: () => void
  /** Called to notify which verse is currently being touched (for visual feedback) */
  onTouchedVerseChange?: (verseKey: string | null) => void
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
  annotationMode: boolean | undefined
  verses: TVerse[]
  dispatch: Dispatch
  // Selection state (managed by parent)
  selection: SelectionRange | null
  setSelection: (value: SelectionRange | null | ((prev: SelectionRange | null) => SelectionRange | null)) => void
  getTokens: (verseKey: string, text: string) => WordToken[]
  // Highlight data
  highlightRects: HighlightRect[]
  selectionHandlePositions: {
    start: { x: number; y: number } | null
    end: { x: number; y: number } | null
  }
  selectedAnnotationId: string | null | undefined
  /** Whether drag-to-annotation is allowed (disabled when verses are selected in normal mode) */
  canDragToAnnotate?: boolean
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
  annotationMode,
  verses,
  dispatch,
  selection,
  setSelection,
  getTokens,
  highlightRects,
  selectionHandlePositions,
  selectedAnnotationId,
  canDragToAnnotate = true,
  triggers = {},
  callbacks = {},
}: UseAnnotationModeControllerProps): UseAnnotationModeControllerReturn {
  const { clearSelectionTrigger, applyAnnotationTrigger, eraseSelectionTrigger } = triggers
  const {
    onTapVerse,
    onDoubleTapVerse,
    onLongPressVerse,
    onEnterAnnotationModeFromDrag,
    onTouchedVerseChange,
    onTapEmpty,
    onSwipe,
  } = callbacks

  // Touch selection hook (handles all gestures)
  const { lastDragEndRef } = useTouchSelection({
    containerRef,
    selection,
    setSelection: fn => setSelection(fn),
    verses,
    getTokens,
    getSelectionHandlePositions: () => selectionHandlePositions,
    highlightRects,
    annotationMode: annotationMode ?? false,
    canDragToAnnotate,
    callbacks: {
      onTapVerse,
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
      onEnterAnnotationModeFromDrag,
      onTouchedVerseChange,
      onTapEmpty,
      onSwipe,
    },
  })

  // Annotation events hook (only active in annotation mode)
  useAnnotationEvents({
    selection: annotationMode ? selection : null,
    setSelection,
    verses,
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
