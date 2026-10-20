import { useEffect, useRef, RefObject } from 'react'
import { Verse as TVerse } from '~common/types'
import { WordToken, getWordIndexFromCharOffset } from '~helpers/wordTokenizer'
import { SelectionRange, WordPosition } from './selectionUtils'
import { HighlightRect } from './HighlightComponents'
import { findVerseContainer, getCaretInfoFromPoint, isIgnoredVerseTouchTarget } from './domUtils'
import {
  createVerseCellKey,
  getVerseTarget,
  isSameVerseColumn,
  type VerseTarget,
} from './verseTargets'
import { getDOMScrollTarget, scrollDOMBy } from '../domScroll'

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

/** A word under the finger, in the version and parallel column it is shown in. */
type WordTarget = WordPosition & Pick<VerseTarget, 'version' | 'column'>

interface TouchState {
  startPos: { x: number; y: number }
  startWord: WordTarget | null
  startVerse: VerseTarget | null
  isDragging: boolean
  isSwipe: boolean
  hasMoved: boolean
  dragHandle: 'start' | 'end' | null
  // Unified gesture state
  longPressTimer: ReturnType<typeof setTimeout> | null
  longPressFired: boolean
  // Swipe detection state
  startTime: number
  velocitySamples: VelocitySample[]
}

/** A tap held back until a second tap on the same verse can no longer make it a double tap */
interface HeldTap {
  verse: VerseTarget
  position: Position
  // The verse of one version tapped (double taps need the same verse of the same version)
  cellKey: string
  endedAt: number
  timer: ReturnType<typeof setTimeout>
}

const INITIAL_TOUCH_STATE: Omit<TouchState, 'longPressTimer'> = {
  startPos: { x: 0, y: 0 },
  startWord: null,
  startVerse: null,
  isDragging: false,
  isSwipe: false,
  hasMoved: false,
  dragHandle: null,
  longPressFired: false,
  startTime: 0,
  velocitySamples: [],
}

/**
 * Resets the mutable touch state fields that should be cleared between gestures.
 * A held tap lives outside it: double taps are detected across gestures.
 */
function resetTouchState(state: TouchState): void {
  state.isDragging = false
  state.isSwipe = false
  state.hasMoved = false
  state.dragHandle = null
  state.startWord = null
  state.startVerse = null
  state.longPressFired = false
  state.velocitySamples = []
}

/** Callbacks for gesture handling */
export interface TouchSelectionCallbacks {
  /** Called on single tap - receives the verse and touch position for word-level selection */
  onTapVerse?: (verse: VerseTarget, position: { x: number; y: number }) => void
  /**
   * Whether a tap on this verse waits to see if a second one follows. Without a double tap
   * that could do anything there, the tap is reported at once. Defaults to waiting.
   */
  shouldWaitForDoubleTap?: (verse: VerseTarget) => boolean
  /** Called when a tap is held back to rule out a double tap, before onTapVerse */
  onTapVerseHeld?: (verse: VerseTarget) => void
  /** Called on double tap - receives the verse and touch position for selecting the word */
  onDoubleTapVerse?: (verse: VerseTarget, position: { x: number; y: number }) => void
  /** Called on long press */
  onLongPressVerse?: (verse: VerseTarget) => void
  /** Allow a mouse drag to enter annotation mode from reading mode. */
  onMouseSelectionStart?: (verse: VerseTarget) => boolean
  /** Called when drag starts */
  onDragStart?: () => void
  /** Called to notify which verse is currently being touched (for visual feedback) */
  onTouchedVerseChange?: (verse: VerseTarget | null) => void
  /** Called when tapping on empty space (not on a verse) - useful for clearing selection */
  onTapEmpty?: () => void
  /** Called on horizontal swipe (fast movement) - for chapter navigation */
  onSwipe?: (direction: 'left' | 'right') => void
}

export interface TouchSelectionConfig {
  containerRef: RefObject<HTMLDivElement | null>
  /** The element selection handle positions are relative to (the highlight layer's host) */
  highlightOriginRef?: RefObject<HTMLDivElement | null>
  selection: SelectionRange | null
  setSelection: (fn: (prev: SelectionRange | null) => SelectionRange | null) => void
  versesByVersion: Record<string, TVerse[]>
  getTokens: (verseKey: string, text: string) => WordToken[]
  getSelectionHandlePositions: () => { start: Position | null; end: Position | null }
  highlightRects: HighlightRect[]
  /** Whether annotation mode is currently active */
  annotationMode: boolean
  /** Gesture callbacks */
  callbacks?: TouchSelectionCallbacks
}

interface Position {
  x: number
  y: number
}

const toVerseTarget = ({ verseKey, version, column }: WordTarget): VerseTarget =>
  column === undefined ? { verseKey, version } : { verseKey, version, column }

const createSelection = (start: WordTarget, end: WordPosition): SelectionRange => ({
  start: { verseKey: start.verseKey, wordIndex: start.wordIndex },
  end: { verseKey: end.verseKey, wordIndex: end.wordIndex },
  version: start.version,
  ...(start.column === undefined ? {} : { column: start.column }),
})

export function useTouchSelection({
  containerRef,
  highlightOriginRef = containerRef,
  selection,
  setSelection,
  versesByVersion,
  getTokens,
  getSelectionHandlePositions,
  annotationMode,
  callbacks = {},
}: TouchSelectionConfig): {
  lastDragEndRef: RefObject<number>
} {
  const touchStateRef = useRef<TouchState>({
    ...INITIAL_TOUCH_STATE,
    longPressTimer: null,
  })
  const autoScrollRef = useRef<number | null>(null)
  const currentTouchPosRef = useRef<Position | null>(null)
  const lastDragEndRef = useRef<number>(0)
  const heldTapRef = useRef<HeldTap | null>(null)

  // Store frequently-changing values in refs so the touch listener effect
  // does not need to tear down and re-attach on every change.
  const selectionRef = useRef(selection)
  const versesByVersionRef = useRef(versesByVersion)
  const getTokensRef = useRef(getTokens)
  const getSelectionHandlePositionsRef = useRef(getSelectionHandlePositions)
  const annotationModeRef = useRef(annotationMode)
  const setSelectionRef = useRef(setSelection)
  const callbacksRef = useRef(callbacks)

  useEffect(() => {
    selectionRef.current = selection
    versesByVersionRef.current = versesByVersion
    getTokensRef.current = getTokens
    getSelectionHandlePositionsRef.current = getSelectionHandlePositions
    annotationModeRef.current = annotationMode
    setSelectionRef.current = setSelection
    callbacksRef.current = callbacks
  }, [
    annotationMode,
    callbacks,
    getSelectionHandlePositions,
    getTokens,
    selection,
    setSelection,
    versesByVersion,
  ])

  // Get word position at a given screen coordinate, in the version and column shown there
  const getWordAtPoint = (clientX: number, clientY: number): WordTarget | null => {
    const caretInfo = getCaretInfoFromPoint(clientX, clientY)
    if (!caretInfo) return null

    const verseTarget = getVerseTarget(findVerseContainer(caretInfo.targetElement))
    if (!verseTarget) return null
    const { verseKey, version } = verseTarget

    const verse = versesByVersionRef.current[version]?.find(
      v => `${v.Livre}-${v.Chapitre}-${v.Verset}` === verseKey
    )
    if (!verse) return null

    const tokens = getTokensRef.current(verseKey, verse.Texte)
    const wordIndex = getWordIndexFromCharOffset(tokens, caretInfo.charOffset)

    if (wordIndex === null) return null

    return { ...verseTarget, wordIndex }
  }

  // Get the verse at a given screen coordinate (without word index)
  const getVerseAtPoint = (clientX: number, clientY: number): VerseTarget | null => {
    const caretInfo = getCaretInfoFromPoint(clientX, clientY)
    if (!caretInfo) return null

    return getVerseTarget(findVerseContainer(caretInfo.targetElement))
  }

  // Check if a touch point is near a selection handle
  const isNearHandle = (touchX: number, touchY: number, handlePos: Position | null): boolean => {
    if (!handlePos) return false
    const containerRect = highlightOriginRef.current?.getBoundingClientRect()
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
      scrollDOMBy(getDOMScrollTarget(containerRef.current), { top: direction })

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

  // Update selection during drag. A selection never leaves the column it started in:
  // words of another column are ignored, even when it shows the same version.
  const updateSelectionDuringDrag = (word: WordTarget) => {
    const touchState = touchStateRef.current
    const wordPos = { verseKey: word.verseKey, wordIndex: word.wordIndex }

    setSelectionRef.current(prev => {
      if (!prev) {
        if (!touchState.startWord || !isSameVerseColumn(touchState.startWord, word)) return null
        return createSelection(touchState.startWord, wordPos)
      }
      if (!isSameVerseColumn(prev, word)) return prev

      if (touchState.dragHandle === 'start') {
        return { ...prev, start: wordPos }
      } else {
        return { ...prev, end: wordPos }
      }
    })
  }

  const clearLongPressTimer = () => {
    const touchState = touchStateRef.current
    if (touchState.longPressTimer) {
      clearTimeout(touchState.longPressTimer)
      touchState.longPressTimer = null
    }
  }

  // Forgets the held tap without reporting it (it became a double tap, or the view went away)
  const dropHeldTap = () => {
    const heldTap = heldTapRef.current
    if (heldTap) clearTimeout(heldTap.timer)
    heldTapRef.current = null
  }

  // Reports the held tap now: its delay ran out, or another verse was tapped
  const releaseHeldTap = () => {
    const heldTap = heldTapRef.current
    if (!heldTap) return
    dropHeldTap()
    callbacksRef.current.onTapVerse?.(heldTap.verse, heldTap.position)
  }

  const isDoubleTapOfHeldTap = (cellKey: string, now: number) => {
    const heldTap = heldTapRef.current
    return heldTap?.cellKey === cellKey && now - heldTap.endedAt < DOUBLE_TAP_DELAY
  }

  // A single tap is held back only where a double tap could follow and do something.
  // A tap on another verse first reports the one still held, so no tap is ever lost.
  const handleSingleTap = (verse: VerseTarget, position: Position, now: number) => {
    releaseHeldTap()
    const cbs = callbacksRef.current
    if (!(cbs.shouldWaitForDoubleTap?.(verse) ?? true)) {
      cbs.onTapVerse?.(verse, position)
      return
    }

    heldTapRef.current = {
      verse,
      position,
      cellKey: createVerseCellKey(verse),
      endedAt: now,
      timer: setTimeout(releaseHeldTap, DOUBLE_TAP_DELAY),
    }
    cbs.onTapVerseHeld?.(verse)
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

  // Attach native touch event handlers once and read latest values from refs.
  // This avoids tearing down and re-attaching listeners when props change.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let lastTouchEndAt = 0
    let mouseIsDown = false
    let suppressMouseClickUntil = 0

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 1) return

      const touch = e.touches[0]
      const touchState = touchStateRef.current
      const cbs = callbacksRef.current

      clearLongPressTimer()

      const now = Date.now()

      touchState.startPos = { x: touch.clientX, y: touch.clientY }
      touchState.isDragging = false
      touchState.isSwipe = false
      touchState.hasMoved = false
      touchState.dragHandle = null
      touchState.longPressFired = false
      touchState.startTime = now
      touchState.velocitySamples = [{ time: now, x: touch.clientX }]

      currentTouchPosRef.current = { x: touch.clientX, y: touch.clientY }

      if (isIgnoredVerseTouchTarget(e.target)) {
        touchState.hasMoved = true
        touchState.startWord = null
        touchState.startVerse = null
        cbs.onTouchedVerseChange?.(null)
        return
      }

      const wordPos = getWordAtPoint(touch.clientX, touch.clientY)
      touchState.startWord = wordPos
      touchState.startVerse = wordPos
        ? toVerseTarget(wordPos)
        : getVerseAtPoint(touch.clientX, touch.clientY)

      if (touchState.startVerse) {
        cbs.onTouchedVerseChange?.(touchState.startVerse)
      }

      // Check if touching a selection handle (annotation mode only)
      if (selectionRef.current && annotationModeRef.current) {
        const handlePositions = getSelectionHandlePositionsRef.current()

        if (isNearHandle(touch.clientX, touch.clientY, handlePositions.start)) {
          touchState.dragHandle = 'start'
          touchState.isDragging = true
          e.preventDefault()
          return
        }

        if (isNearHandle(touch.clientX, touch.clientY, handlePositions.end)) {
          touchState.dragHandle = 'end'
          touchState.isDragging = true
          e.preventDefault()
          return
        }
      }

      // Start long-press timer (only if we found a verse)
      if (touchState.startVerse) {
        touchState.longPressTimer = setTimeout(() => {
          if (!touchState.hasMoved && !touchState.isDragging && touchState.startVerse) {
            touchState.longPressFired = true
            callbacksRef.current.onTouchedVerseChange?.(null)
            callbacksRef.current.onLongPressVerse?.(touchState.startVerse)
          }
        }, LONG_PRESS_DELAY)
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) return

      const touch = e.touches[0]
      const touchState = touchStateRef.current
      const cbs = callbacksRef.current
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

      if (touchState.isSwipe) return
      if (touchState.hasMoved) return

      const deltaX = Math.abs(touch.clientX - touchState.startPos.x)
      const deltaY = Math.abs(touch.clientY - touchState.startPos.y)

      // Vertical movement dominant -> scroll
      if (deltaY > DRAG_THRESHOLD) {
        touchState.hasMoved = true
        if (touchState.longPressTimer) {
          clearTimeout(touchState.longPressTimer)
          touchState.longPressTimer = null
        }
        cbs.onTouchedVerseChange?.(null)
        return
      }

      // Horizontal movement detection - use velocity to decide swipe vs drag
      if (deltaX > DRAG_THRESHOLD && deltaX > deltaY) {
        if (touchState.longPressTimer) {
          clearTimeout(touchState.longPressTimer)
          touchState.longPressTimer = null
        }
        cbs.onTouchedVerseChange?.(null)

        const velocity = calculateAverageVelocity(touchState.velocitySamples, now, touch.clientX)

        if (velocity >= SWIPE_VELOCITY_THRESHOLD) {
          touchState.isSwipe = true
          return
        }

        // Slow movement -> drag (text selection)
        if (touchState.startWord) {
          if (!annotationModeRef.current) {
            touchState.hasMoved = true
            return
          } else {
            touchState.isDragging = true
            e.preventDefault()
            cbs.onDragStart?.()
            const startWord = touchState.startWord
            setSelectionRef.current(() => createSelection(startWord, startWord))
          }
        }
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      lastTouchEndAt = Date.now()
      const touchState = touchStateRef.current
      const cbs = callbacksRef.current
      const now = Date.now()

      stopAutoScroll()

      const changedTouch = e.changedTouches?.[0]
      const finalX = changedTouch?.clientX ?? currentTouchPosRef.current?.x ?? touchState.startPos.x

      currentTouchPosRef.current = null

      if (touchState.longPressTimer) {
        clearTimeout(touchState.longPressTimer)
        touchState.longPressTimer = null
      }

      cbs.onTouchedVerseChange?.(null)

      // Swipe completion
      if (touchState.isSwipe) {
        const elapsedTime = now - touchState.startTime
        const totalDistance = Math.abs(finalX - touchState.startPos.x)
        const direction = finalX < touchState.startPos.x ? 'left' : 'right'

        if (totalDistance >= SWIPE_MIN_DISTANCE && elapsedTime < SWIPE_MAX_TIME) {
          cbs.onSwipe?.(direction)
        }

        resetTouchState(touchState)
        return
      }

      if (touchState.isDragging) {
        lastDragEndRef.current = Date.now()
      }

      // Gesture detection (only if not dragging and not moved and long-press didn't fire)
      if (!touchState.isDragging && !touchState.hasMoved && !touchState.longPressFired) {
        const verse = touchState.startVerse
        if (verse) {
          if (isDoubleTapOfHeldTap(createVerseCellKey(verse), now)) {
            dropHeldTap()
            cbs.onDoubleTapVerse?.(verse, { ...touchState.startPos })
          } else {
            handleSingleTap(verse, { ...touchState.startPos }, now)
          }
        } else {
          cbs.onTapEmpty?.()
        }
      }

      resetTouchState(touchState)
    }

    const handleTouchCancel = () => {
      clearLongPressTimer()
      callbacksRef.current.onTouchedVerseChange?.(null)

      resetTouchState(touchStateRef.current)

      stopAutoScroll()
      currentTouchPosRef.current = null
    }

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || Date.now() - lastTouchEndAt < 700) return
      if (isIgnoredVerseTouchTarget(e.target)) return

      const touchState = touchStateRef.current
      const cbs = callbacksRef.current
      const now = Date.now()

      clearLongPressTimer()
      mouseIsDown = true
      touchState.startPos = { x: e.clientX, y: e.clientY }
      touchState.isDragging = false
      touchState.isSwipe = false
      touchState.hasMoved = false
      touchState.dragHandle = null
      touchState.longPressFired = false
      touchState.startTime = now
      touchState.velocitySamples = []
      currentTouchPosRef.current = { x: e.clientX, y: e.clientY }

      const wordPos = getWordAtPoint(e.clientX, e.clientY)
      touchState.startWord = wordPos
      touchState.startVerse = wordPos
        ? toVerseTarget(wordPos)
        : getVerseAtPoint(e.clientX, e.clientY)

      // Handles sit outside the text lines, so test them before requiring a verse under the pointer
      if (selectionRef.current && annotationModeRef.current) {
        const handlePositions = getSelectionHandlePositionsRef.current()
        if (isNearHandle(e.clientX, e.clientY, handlePositions.start)) {
          touchState.dragHandle = 'start'
          touchState.isDragging = true
          e.preventDefault()
          return
        }
        if (isNearHandle(e.clientX, e.clientY, handlePositions.end)) {
          touchState.dragHandle = 'end'
          touchState.isDragging = true
          e.preventDefault()
          return
        }
      }

      if (!touchState.startVerse) return
      cbs.onTouchedVerseChange?.(touchState.startVerse)

      touchState.longPressTimer = setTimeout(() => {
        if (!mouseIsDown || touchState.hasMoved || touchState.isDragging) return
        if (!touchState.startVerse) return

        touchState.longPressFired = true
        suppressMouseClickUntil = Date.now() + 700
        callbacksRef.current.onTouchedVerseChange?.(null)
        callbacksRef.current.onLongPressVerse?.(touchState.startVerse)
      }, LONG_PRESS_DELAY)
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!mouseIsDown) return

      const touchState = touchStateRef.current
      currentTouchPosRef.current = { x: e.clientX, y: e.clientY }

      if (touchState.isDragging) {
        e.preventDefault()
        const wordPos = getWordAtPoint(e.clientX, e.clientY)
        if (wordPos) updateSelectionDuringDrag(wordPos)
        if (e.clientY < AUTO_SCROLL_ZONE_TOP) {
          startAutoScroll(-AUTO_SCROLL_SPEED)
        } else if (e.clientY > window.innerHeight - AUTO_SCROLL_ZONE_BOTTOM) {
          startAutoScroll(AUTO_SCROLL_SPEED)
        } else {
          stopAutoScroll()
        }
        return
      }

      const deltaX = Math.abs(e.clientX - touchState.startPos.x)
      const deltaY = Math.abs(e.clientY - touchState.startPos.y)
      if (Math.max(deltaX, deltaY) <= DRAG_THRESHOLD) return

      if (touchState.longPressTimer) {
        clearTimeout(touchState.longPressTimer)
        touchState.longPressTimer = null
      }
      callbacksRef.current.onTouchedVerseChange?.(null)

      if (
        touchState.startWord &&
        (annotationModeRef.current ||
          callbacksRef.current.onMouseSelectionStart?.(toVerseTarget(touchState.startWord)))
      ) {
        touchState.isDragging = true
        suppressMouseClickUntil = Date.now() + 700
        e.preventDefault()
        callbacksRef.current.onDragStart?.()
        const startWord = touchState.startWord
        const pointedWord = getWordAtPoint(e.clientX, e.clientY)
        const currentWord =
          pointedWord && isSameVerseColumn(pointedWord, startWord) ? pointedWord : startWord
        setSelectionRef.current(() => createSelection(startWord, currentWord))
        return
      }

      touchState.hasMoved = true
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (!mouseIsDown) return
      mouseIsDown = false
      stopAutoScroll()

      const touchState = touchStateRef.current
      if (touchState.longPressTimer) {
        clearTimeout(touchState.longPressTimer)
        touchState.longPressTimer = null
      }
      callbacksRef.current.onTouchedVerseChange?.(null)
      currentTouchPosRef.current = null

      if (touchState.isDragging) {
        e.preventDefault()
        lastDragEndRef.current = Date.now()
        suppressMouseClickUntil = Date.now() + 700
      } else if (touchState.hasMoved || touchState.longPressFired) {
        suppressMouseClickUntil = Date.now() + 700
      }

      resetTouchState(touchState)
    }

    const handleContextMenu = (e: MouseEvent) => {
      const verseContainer = e.target instanceof Element ? findVerseContainer(e.target) : null
      if (verseContainer) e.preventDefault()
    }

    // Desktop browsers don't emit TouchEvents for mouse clicks. Expo DOM
    // renders inline on web, so mirror the tap/double-tap behavior with mouse
    // events while ignoring the synthetic click generated after a real touch.
    const handleClick = (e: MouseEvent) => {
      if (
        Date.now() - lastTouchEndAt < 700 ||
        Date.now() < suppressMouseClickUntil ||
        isIgnoredVerseTouchTarget(e.target)
      )
        return

      const verse = getVerseTarget(
        e.target instanceof Element ? findVerseContainer(e.target) : null
      )
      if (!verse) {
        callbacksRef.current.onTapEmpty?.()
        return
      }

      // The browser reports a double click itself (dblclick): the second click of one only
      // replaces the tap held by the first, which dblclick then drops.
      if (isDoubleTapOfHeldTap(createVerseCellKey(verse), Date.now())) dropHeldTap()
      handleSingleTap(verse, { x: e.clientX, y: e.clientY }, Date.now())
    }

    const handleDoubleClick = (e: MouseEvent) => {
      if (
        Date.now() - lastTouchEndAt < 700 ||
        Date.now() < suppressMouseClickUntil ||
        isIgnoredVerseTouchTarget(e.target)
      )
        return

      const verse = getVerseTarget(
        e.target instanceof Element ? findVerseContainer(e.target) : null
      )
      if (!verse) return

      dropHeldTap()
      callbacksRef.current.onDoubleTapVerse?.(verse, { x: e.clientX, y: e.clientY })
    }

    // { passive: false } allows preventDefault() to work
    container.addEventListener('touchstart', handleTouchStart, { passive: false })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd)
    container.addEventListener('touchcancel', handleTouchCancel)
    container.addEventListener('click', handleClick)
    container.addEventListener('dblclick', handleDoubleClick)
    container.addEventListener('mousedown', handleMouseDown)
    container.addEventListener('contextmenu', handleContextMenu)
    window.addEventListener('mousemove', handleMouseMove, { passive: false })
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
      container.removeEventListener('touchcancel', handleTouchCancel)
      container.removeEventListener('click', handleClick)
      container.removeEventListener('dblclick', handleDoubleClick)
      container.removeEventListener('mousedown', handleMouseDown)
      container.removeEventListener('contextmenu', handleContextMenu)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      stopAutoScroll()
      clearLongPressTimer()
      dropHeldTap()
    }
  }, [])

  return { lastDragEndRef }
}
