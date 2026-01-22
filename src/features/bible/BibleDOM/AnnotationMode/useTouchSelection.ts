'use dom'

import { useEffect, useRef, RefObject } from 'react'
import { Verse as TVerse } from '~common/types'
import { WordToken, getWordIndexFromCharOffset } from '~helpers/wordTokenizer'
import { SelectionRange, WordPosition } from './selectionUtils'
import { HighlightRect } from './HighlightComponents'
import { getCaretInfoFromPoint, findVerseContainer } from './domUtils'

// Drag selection constants
const DRAG_THRESHOLD = 10 // pixels to detect horizontal drag vs scroll
const AUTO_SCROLL_ZONE_TOP = 100 // pixels from top edge to trigger auto-scroll up
const AUTO_SCROLL_ZONE_BOTTOM = 280 // pixels from bottom edge to trigger auto-scroll down
const AUTO_SCROLL_SPEED = 5 // pixels per frame

// Gesture timing constants
const DOUBLE_TAP_DELAY = 200 // ms between taps for double-tap detection
const LONG_PRESS_DELAY = 400 // ms for long-press detection

// Swipe detection constants
const SWIPE_VELOCITY_THRESHOLD = 0.3 // px/ms - separates fast swipe from slow drag
const SWIPE_MIN_DISTANCE = 50 // pixels - minimum distance for valid swipe
const SWIPE_MAX_TIME = 300 // ms - window of time for a swipe
const VELOCITY_SAMPLE_COUNT = 5 // number of samples for averaging velocity

interface VelocitySample {
  time: number
  x: number
}

interface TouchState {
  startPos: { x: number; y: number }
  startWord: WordPosition | null
  startVerseKey: string | null
  isDragging: boolean
  isSwipe: boolean
  hasMoved: boolean
  dragHandle: 'start' | 'end' | null
  // Unified gesture state
  longPressTimer: ReturnType<typeof setTimeout> | null
  lastTapTime: number
  lastTapVerseKey: string | null
  longPressFired: boolean
  // Swipe detection state
  startTime: number
  velocitySamples: VelocitySample[]
}

/** Callbacks for gesture handling */
export interface TouchSelectionCallbacks {
  /** Called on single tap - receives verseKey and touch position for word-level selection */
  onTapVerse?: (verseKey: string, position: { x: number; y: number }) => void
  /** Called on double tap - receives verseKey and touch position for selecting the word */
  onDoubleTapVerse?: (verseKey: string, position: { x: number; y: number }) => void
  /** Called on long press */
  onLongPressVerse?: (verseKey: string) => void
  /** Called when drag starts */
  onDragStart?: () => void
  /** Called when horizontal drag detected in normal mode - triggers entry into annotation mode */
  onEnterAnnotationModeFromDrag?: () => void
  /** Called to notify which verse is currently being touched (for visual feedback) */
  onTouchedVerseChange?: (verseKey: string | null) => void
  /** Called when tapping on empty space (not on a verse) - useful for clearing selection */
  onTapEmpty?: () => void
  /** Called on horizontal swipe (fast movement) - for chapter navigation */
  onSwipe?: (direction: 'left' | 'right') => void
}

export interface TouchSelectionConfig {
  containerRef: RefObject<HTMLDivElement | null>
  selection: SelectionRange | null
  setSelection: (fn: (prev: SelectionRange | null) => SelectionRange | null) => void
  verses: TVerse[]
  getTokens: (verseKey: string, text: string) => WordToken[]
  getSelectionHandlePositions: () => { start: Position | null; end: Position | null }
  highlightRects: HighlightRect[]
  /** Whether annotation mode is currently active */
  annotationMode: boolean
  /** Whether drag-to-annotation is allowed (disabled when verses are selected in normal mode) */
  canDragToAnnotate?: boolean
  /** Gesture callbacks */
  callbacks?: TouchSelectionCallbacks
}

interface Position {
  x: number
  y: number
}

export function useTouchSelection({
  containerRef,
  selection,
  setSelection,
  verses,
  getTokens,
  getSelectionHandlePositions,
  annotationMode,
  canDragToAnnotate = true,
  callbacks = {},
}: TouchSelectionConfig): {
  lastDragEndRef: RefObject<number>
} {
  const {
    onTapVerse,
    onDoubleTapVerse,
    onLongPressVerse,
    onDragStart,
    onEnterAnnotationModeFromDrag,
    onTouchedVerseChange,
    onTapEmpty,
    onSwipe,
  } = callbacks
  const touchStateRef = useRef<TouchState>({
    startPos: { x: 0, y: 0 },
    startWord: null,
    startVerseKey: null,
    isDragging: false,
    isSwipe: false,
    hasMoved: false,
    dragHandle: null,
    longPressTimer: null,
    lastTapTime: 0,
    lastTapVerseKey: null,
    longPressFired: false,
    startTime: 0,
    velocitySamples: [],
  })
  const autoScrollRef = useRef<number | null>(null)
  const currentTouchPosRef = useRef<Position | null>(null)
  const lastDragEndRef = useRef<number>(0)
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Get word position at a given screen coordinate
  const getWordAtPoint = (clientX: number, clientY: number): WordPosition | null => {
    const caretInfo = getCaretInfoFromPoint(clientX, clientY)
    if (!caretInfo) return null

    const verseContainer = findVerseContainer(caretInfo.targetElement)
    if (!verseContainer) return null

    const verseKey = verseContainer.getAttribute('data-verse-key')
    if (!verseKey) return null

    const verse = verses.find(v => `${v.Livre}-${v.Chapitre}-${v.Verset}` === verseKey)
    if (!verse) return null

    const tokens = getTokens(verseKey, verse.Texte)
    const wordIndex = getWordIndexFromCharOffset(tokens, caretInfo.charOffset)

    if (wordIndex === null) return null

    return { verseKey, wordIndex }
  }

  // Get verse key at a given screen coordinate (without word index)
  const getVerseKeyAtPoint = (clientX: number, clientY: number): string | null => {
    const caretInfo = getCaretInfoFromPoint(clientX, clientY)
    if (!caretInfo) return null

    const verseContainer = findVerseContainer(caretInfo.targetElement)
    if (!verseContainer) return null

    return verseContainer.getAttribute('data-verse-key')
  }

  // Check if a touch point is near a selection handle
  const isNearHandle = (touchX: number, touchY: number, handlePos: Position | null): boolean => {
    if (!handlePos) return false
    const containerRect = containerRef.current?.getBoundingClientRect()
    if (!containerRect) return false

    const HANDLE_HIT_RADIUS = 30 // Enlarged touch area
    const handleScreenX = containerRect.left + handlePos.x
    const handleScreenY = containerRect.top + handlePos.y

    const dx = touchX - handleScreenX
    const dy = touchY - handleScreenY
    return Math.sqrt(dx * dx + dy * dy) < HANDLE_HIT_RADIUS
  }

  // Auto-scroll functionality
  const stopAutoScroll = () => {
    if (autoScrollRef.current) {
      cancelAnimationFrame(autoScrollRef.current)
      autoScrollRef.current = null
    }
  }

  const startAutoScroll = (direction: number) => {
    if (autoScrollRef.current) return

    const scroll = () => {
      window.scrollBy(0, direction)

      // Update selection during auto-scroll if we have current touch position
      if (currentTouchPosRef.current && touchStateRef.current.isDragging) {
        const wordPos = getWordAtPoint(currentTouchPosRef.current.x, currentTouchPosRef.current.y)
        if (wordPos) {
          updateSelectionDuringDrag(wordPos)
        }
      }

      autoScrollRef.current = requestAnimationFrame(scroll)
    }
    autoScrollRef.current = requestAnimationFrame(scroll)
  }

  // Update selection during drag
  const updateSelectionDuringDrag = (wordPos: WordPosition) => {
    const touchState = touchStateRef.current

    setSelection(prev => {
      if (!prev) {
        // Create initial selection from start word to current word
        if (!touchState.startWord) return null
        return { start: touchState.startWord, end: wordPos }
      }

      if (touchState.dragHandle === 'start') {
        // Dragging start handle: update start position
        return { start: wordPos, end: prev.end }
      } else {
        // Dragging end handle or normal drag: update end position
        return { start: prev.start, end: wordPos }
      }
    })
  }

  // Clear timers helper
  const clearTimers = () => {
    const touchState = touchStateRef.current
    if (touchState.longPressTimer) {
      clearTimeout(touchState.longPressTimer)
      touchState.longPressTimer = null
    }
    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current)
      singleTapTimerRef.current = null
    }
  }

  // Calculate average velocity from recent samples
  const calculateAverageVelocity = (
    samples: VelocitySample[],
    currentTime: number,
    currentX: number
  ): number => {
    if (samples.length === 0) return 0

    // Use first sample for velocity calculation (most accurate for initial gesture)
    const firstSample = samples[0]
    const timeDelta = currentTime - firstSample.time
    if (timeDelta <= 0) return 0

    const distanceDelta = Math.abs(currentX - firstSample.x)
    return distanceDelta / timeDelta // px/ms
  }

  // Native touch event handlers with { passive: false } to allow preventDefault
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 1) return

      const touch = e.touches[0]
      const touchState = touchStateRef.current

      // Clear previous timers
      clearTimers()

      const now = Date.now()

      // Reset touch state
      touchState.startPos = { x: touch.clientX, y: touch.clientY }
      touchState.isDragging = false
      touchState.isSwipe = false
      touchState.hasMoved = false
      touchState.dragHandle = null
      touchState.longPressFired = false
      touchState.startTime = now
      touchState.velocitySamples = [{ time: now, x: touch.clientX }]

      currentTouchPosRef.current = { x: touch.clientX, y: touch.clientY }

      // Find verse at touch point
      const wordPos = getWordAtPoint(touch.clientX, touch.clientY)
      touchState.startWord = wordPos
      touchState.startVerseKey =
        wordPos?.verseKey || getVerseKeyAtPoint(touch.clientX, touch.clientY)

      // Notify touched verse for visual feedback
      if (touchState.startVerseKey) {
        onTouchedVerseChange?.(touchState.startVerseKey)
      }

      // Check if touching a selection handle - if so, immediately start dragging (annotation mode only)
      if (selection && annotationMode) {
        const handlePositions = getSelectionHandlePositions()

        if (isNearHandle(touch.clientX, touch.clientY, handlePositions.start)) {
          touchState.dragHandle = 'start'
          touchState.isDragging = true
          e.preventDefault() // Block scroll immediately for handle drag
          return
        }

        if (isNearHandle(touch.clientX, touch.clientY, handlePositions.end)) {
          touchState.dragHandle = 'end'
          touchState.isDragging = true
          e.preventDefault() // Block scroll immediately for handle drag
          return
        }
      }

      // Start long-press timer (only if we found a verse)
      if (touchState.startVerseKey) {
        touchState.longPressTimer = setTimeout(() => {
          if (!touchState.hasMoved && !touchState.isDragging && touchState.startVerseKey) {
            touchState.longPressFired = true
            onTouchedVerseChange?.(null) // Clear touched state
            onLongPressVerse?.(touchState.startVerseKey)
          }
        }, LONG_PRESS_DELAY)
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) return

      const touch = e.touches[0]
      const touchState = touchStateRef.current
      const now = Date.now()

      currentTouchPosRef.current = { x: touch.clientX, y: touch.clientY }

      // Track velocity samples
      touchState.velocitySamples.push({ time: now, x: touch.clientX })
      if (touchState.velocitySamples.length > VELOCITY_SAMPLE_COUNT) {
        touchState.velocitySamples.shift()
      }

      // If already dragging (handle or horizontal), block scroll and update selection
      if (touchState.isDragging) {
        e.preventDefault()

        const wordPos = getWordAtPoint(touch.clientX, touch.clientY)
        if (wordPos) {
          updateSelectionDuringDrag(wordPos)
        }

        // Auto-scroll when near edges
        const screenY = touch.clientY
        if (screenY < AUTO_SCROLL_ZONE_TOP) {
          startAutoScroll(-AUTO_SCROLL_SPEED)
        } else if (screenY > window.innerHeight - AUTO_SCROLL_ZONE_BOTTOM) {
          startAutoScroll(AUTO_SCROLL_SPEED)
        } else {
          stopAutoScroll()
        }
        return
      }

      // If already in swipe mode, let browser handle the swipe
      if (touchState.isSwipe) {
        return
      }

      // If already marked as scroll, do nothing
      if (touchState.hasMoved) {
        return
      }

      const deltaX = Math.abs(touch.clientX - touchState.startPos.x)
      const deltaY = Math.abs(touch.clientY - touchState.startPos.y)

      // Direction detection for horizontal drag (not handle)
      if (deltaY > DRAG_THRESHOLD) {
        // Vertical movement dominant -> it's a scroll, let it happen
        touchState.hasMoved = true
        // Clear long-press timer
        if (touchState.longPressTimer) {
          clearTimeout(touchState.longPressTimer)
          touchState.longPressTimer = null
        }
        // Clear touched state
        onTouchedVerseChange?.(null)
        return
      }

      // Horizontal movement detection - use velocity to decide swipe vs drag
      if (deltaX > DRAG_THRESHOLD && deltaX > deltaY) {
        // Clear long-press timer
        if (touchState.longPressTimer) {
          clearTimeout(touchState.longPressTimer)
          touchState.longPressTimer = null
        }

        // Clear touched state
        onTouchedVerseChange?.(null)

        // Calculate velocity to decide between swipe and drag
        const velocity = calculateAverageVelocity(touchState.velocitySamples, now, touch.clientX)

        if (velocity >= SWIPE_VELOCITY_THRESHOLD) {
          // Fast movement -> swipe (chapter navigation)
          touchState.isSwipe = true
          // Don't preventDefault - let browser handle the natural scroll/swipe
          return
        }

        // Slow movement -> drag (text selection)
        // Only activate drag mode if we have a word to start from
        if (touchState.startWord) {
          if (!annotationMode) {
            // Normal mode - check if drag-to-annotation is allowed
            if (!canDragToAnnotate) {
              // Drag not allowed (verses are selected), treat as scroll
              touchState.hasMoved = true
              return
            }
            // Enter annotation mode via drag
            touchState.isDragging = true
            e.preventDefault() // Start blocking scroll now
            onEnterAnnotationModeFromDrag?.()
            // Create initial selection
            setSelection(() => ({ start: touchState.startWord!, end: touchState.startWord! }))
          } else {
            // Annotation mode - continue with selection
            touchState.isDragging = true
            e.preventDefault() // Start blocking scroll now
            onDragStart?.() // Clear any selected annotation
            setSelection(() => ({ start: touchState.startWord!, end: touchState.startWord! }))
          }
        }
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      const touchState = touchStateRef.current
      const now = Date.now()

      stopAutoScroll()

      // Get final touch position for swipe detection
      const changedTouch = e.changedTouches?.[0]
      const finalX = changedTouch?.clientX ?? currentTouchPosRef.current?.x ?? touchState.startPos.x

      currentTouchPosRef.current = null

      // Clear long-press timer
      if (touchState.longPressTimer) {
        clearTimeout(touchState.longPressTimer)
        touchState.longPressTimer = null
      }

      // Clear touched state
      onTouchedVerseChange?.(null)

      // Check for swipe completion
      if (touchState.isSwipe) {
        const elapsedTime = now - touchState.startTime
        const totalDistance = Math.abs(finalX - touchState.startPos.x)
        const direction = finalX < touchState.startPos.x ? 'left' : 'right'

        // Validate swipe: enough distance and within time window
        if (totalDistance >= SWIPE_MIN_DISTANCE && elapsedTime < SWIPE_MAX_TIME) {
          onSwipe?.(direction)
        }

        // Reset swipe state and return early
        touchState.isSwipe = false
        touchState.isDragging = false
        touchState.hasMoved = false
        touchState.dragHandle = null
        touchState.startWord = null
        touchState.startVerseKey = null
        touchState.longPressFired = false
        touchState.velocitySamples = []
        return
      }

      if (touchState.isDragging) {
        lastDragEndRef.current = Date.now()
      }

      // Gesture detection (only if not dragging and not moved and long-press didn't fire)
      if (!touchState.isDragging && !touchState.hasMoved && !touchState.longPressFired) {
        const verseKey = touchState.startVerseKey
        if (verseKey) {
          // Check for double-tap
          if (
            touchState.lastTapVerseKey === verseKey &&
            now - touchState.lastTapTime < DOUBLE_TAP_DELAY
          ) {
            // Double-tap detected - clear pending single tap timer
            if (singleTapTimerRef.current) {
              clearTimeout(singleTapTimerRef.current)
              singleTapTimerRef.current = null
            }
            // Store position of the second tap for word selection
            const doubleTapPosition = { ...touchState.startPos }
            touchState.lastTapTime = 0
            touchState.lastTapVerseKey = null
            onDoubleTapVerse?.(verseKey, doubleTapPosition)
          } else {
            // Potential single tap - defer to allow double-tap detection
            // Store position for the tap callback
            const tapPosition = { ...touchState.startPos }
            touchState.lastTapTime = now
            touchState.lastTapVerseKey = verseKey
            singleTapTimerRef.current = setTimeout(() => {
              // Only fire if no double-tap happened
              if (touchState.lastTapVerseKey === verseKey) {
                onTapVerse?.(verseKey, tapPosition)
                touchState.lastTapVerseKey = null
              }
              singleTapTimerRef.current = null
            }, DOUBLE_TAP_DELAY)
          }
        } else {
          // Tapped on empty space (not on a verse)
          onTapEmpty?.()
        }
      }

      // Reset touch state
      touchState.isDragging = false
      touchState.isSwipe = false
      touchState.hasMoved = false
      touchState.dragHandle = null
      touchState.startWord = null
      touchState.startVerseKey = null
      touchState.longPressFired = false
      touchState.velocitySamples = []
    }

    const handleTouchCancel = () => {
      clearTimers()
      onTouchedVerseChange?.(null)

      const touchState = touchStateRef.current
      touchState.isDragging = false
      touchState.isSwipe = false
      touchState.hasMoved = false
      touchState.dragHandle = null
      touchState.startWord = null
      touchState.startVerseKey = null
      touchState.longPressFired = false
      touchState.velocitySamples = []
      touchState.lastTapTime = 0
      touchState.lastTapVerseKey = null

      stopAutoScroll()
      currentTouchPosRef.current = null
    }

    // { passive: false } allows preventDefault() to work
    container.addEventListener('touchstart', handleTouchStart, { passive: false })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd)
    container.addEventListener('touchcancel', handleTouchCancel)

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
      container.removeEventListener('touchcancel', handleTouchCancel)
      clearTimers()
    }
  }, [
    selection,
    verses,
    annotationMode,
    canDragToAnnotate,
    onDragStart,
    onEnterAnnotationModeFromDrag,
    onTapVerse,
    onDoubleTapVerse,
    onLongPressVerse,
    onTouchedVerseChange,
    onSwipe,
  ])

  return { lastDragEndRef }
}
