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

interface TouchState {
  startPos: { x: number; y: number }
  startWord: WordPosition | null
  isDragging: boolean
  hasMoved: boolean
  dragHandle: 'start' | 'end' | null
}

export interface TouchSelectionConfig {
  containerRef: RefObject<HTMLDivElement | null>
  selection: SelectionRange | null
  setSelection: (fn: (prev: SelectionRange | null) => SelectionRange | null) => void
  verses: TVerse[]
  getTokens: (verseKey: string, text: string) => WordToken[]
  getSelectionHandlePositions: () => { start: Position | null; end: Position | null }
  highlightRects: HighlightRect[]
  // Safe area inset from native side (CSS env vars don't work in Expo DOM WebView)
  safeAreaTop: number
  onDragStart?: () => void
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
  safeAreaTop,
  onDragStart,
}: TouchSelectionConfig): {
  lastDragEndRef: RefObject<number>
} {
  const touchStateRef = useRef<TouchState>({
    startPos: { x: 0, y: 0 },
    startWord: null,
    isDragging: false,
    hasMoved: false,
    dragHandle: null,
  })
  const autoScrollRef = useRef<number | null>(null)
  const currentTouchPosRef = useRef<Position | null>(null)
  const lastDragEndRef = useRef<number>(0)

  // Get word position at a given screen coordinate
  const getWordAtPoint = (clientX: number, clientY: number): WordPosition | null => {
    console.log('[DEBUG touch]', { clientX, clientY })

    const containerRect = containerRef.current?.getBoundingClientRect()
    console.log('[DEBUG container]', containerRect)

    const caretInfo = getCaretInfoFromPoint(clientX, clientY, safeAreaTop)
    if (!caretInfo) {
      console.log('[DEBUG touch] no caretInfo found')
      return null
    }

    const verseContainer = findVerseContainer(caretInfo.targetElement)
    if (!verseContainer) {
      console.log('[DEBUG touch] no verseContainer found')
      return null
    }

    const verseKey = verseContainer.getAttribute('data-verse-key')
    if (!verseKey) {
      console.log('[DEBUG touch] no verseKey found')
      return null
    }

    const verse = verses.find(v => `${v.Livre}-${v.Chapitre}-${v.Verset}` === verseKey)
    if (!verse) {
      console.log('[DEBUG touch] verse not found for key:', verseKey)
      return null
    }

    const tokens = getTokens(verseKey, verse.Texte)
    const wordIndex = getWordIndexFromCharOffset(tokens, caretInfo.charOffset)

    if (wordIndex === null) {
      console.log('[DEBUG touch] wordIndex is null for charOffset:', caretInfo.charOffset)
      return null
    }

    console.log('[DEBUG word found]', { verseKey, wordIndex })
    return { verseKey, wordIndex }
  }

  // Check if a touch point is near a selection handle
  const isNearHandle = (
    touchX: number,
    touchY: number,
    handlePos: Position | null
  ): boolean => {
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

  // Native touch event handlers with { passive: false } to allow preventDefault
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 1) return

      const touch = e.touches[0]
      const touchState = touchStateRef.current

      // Reset touch state
      touchState.startPos = { x: touch.clientX, y: touch.clientY }
      touchState.isDragging = false
      touchState.hasMoved = false
      touchState.dragHandle = null

      currentTouchPosRef.current = { x: touch.clientX, y: touch.clientY }

      // Check if touching a selection handle - if so, immediately start dragging
      if (selection) {
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

      // Find the word at touch start (for potential horizontal drag)
      touchState.startWord = getWordAtPoint(touch.clientX, touch.clientY)
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) return

      const touch = e.touches[0]
      const touchState = touchStateRef.current

      currentTouchPosRef.current = { x: touch.clientX, y: touch.clientY }

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

      // If already marked as scroll, do nothing
      if (touchState.hasMoved) {
        return
      }

      const deltaX = Math.abs(touch.clientX - touchState.startPos.x)
      const deltaY = Math.abs(touch.clientY - touchState.startPos.y)

      // Direction detection for horizontal drag (not handle)
      if (!touchState.isDragging && !touchState.hasMoved) {
        if (deltaY > DRAG_THRESHOLD) {
          // Vertical movement dominant -> it's a scroll, let it happen
          touchState.hasMoved = true
          return
        } else if (deltaX > DRAG_THRESHOLD && deltaX > deltaY && touchState.startWord) {
          // Horizontal movement dominant -> activate drag mode
          touchState.isDragging = true
          e.preventDefault() // Start blocking scroll now
          onDragStart?.() // Clear any selected annotation
          setSelection(() => ({ start: touchState.startWord!, end: touchState.startWord! }))
        }
      }
    }

    const handleTouchEnd = () => {
      const touchState = touchStateRef.current

      stopAutoScroll()
      currentTouchPosRef.current = null

      if (touchState.isDragging) {
        lastDragEndRef.current = Date.now()
      }

      // Reset touch state
      touchState.isDragging = false
      touchState.hasMoved = false
      touchState.dragHandle = null
      touchState.startWord = null
    }

    // { passive: false } allows preventDefault() to work
    container.addEventListener('touchstart', handleTouchStart, { passive: false })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd)
    container.addEventListener('touchcancel', handleTouchEnd)

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
      container.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [selection, verses, onDragStart])

  return { lastDragEndRef }
}
