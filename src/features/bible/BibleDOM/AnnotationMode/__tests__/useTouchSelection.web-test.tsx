/** @jest-environment jsdom */

import React, { act, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import type { Verse } from '~common/types'
import type { WordToken } from '~helpers/wordTokenizer'
import type { SelectionRange } from '../selectionUtils'
import { useTouchSelection, type TouchSelectionCallbacks } from '../useTouchSelection'

jest.mock('../domUtils', () => ({
  findVerseContainer: (element: Element | null) => element?.closest('[data-verse-key]') ?? null,
  getCaretInfoFromPoint: (x: number) => ({
    charOffset: x < 50 ? 0 : 6,
    targetElement: globalThis.document.querySelector('[data-verse-key]'),
  }),
  isIgnoredVerseTouchTarget: () => false,
}))

jest.mock('../../domScroll', () => ({
  getDOMScrollTarget: () => null,
  scrollDOMBy: () => undefined,
}))

const verse = {
  Livre: 1,
  Chapitre: 1,
  Verset: 1,
  Texte: 'Au commencement',
} as Verse

const tokens: WordToken[] = [
  { word: 'Au', index: 0, isWhitespace: false, charStart: 0, charEnd: 2 },
  { word: ' ', index: -1, isWhitespace: true, charStart: 2, charEnd: 3 },
  { word: 'commencement', index: 1, isWhitespace: false, charStart: 3, charEnd: 15 },
]

const Harness = ({
  annotationMode,
  callbacks,
  onSelectionChange,
}: {
  annotationMode: boolean
  callbacks: TouchSelectionCallbacks
  onSelectionChange?: (selection: SelectionRange | null) => void
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [selection, setSelectionState] = useState<SelectionRange | null>(null)

  useTouchSelection({
    containerRef,
    selection,
    setSelection: update => {
      setSelectionState(previous => {
        const next = update(previous)
        onSelectionChange?.(next)
        return next
      })
    },
    verses: [verse],
    getTokens: () => tokens,
    getSelectionHandlePositions: () => ({ start: null, end: null }),
    highlightRects: [],
    annotationMode,
    callbacks,
  })

  return (
    <div ref={containerRef}>
      <span data-verse-key="1-1-1">Au commencement</span>
    </div>
  )
}

describe('Web mouse gestures for Bible annotations', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    jest.useFakeTimers()
    ;(
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    jest.useRealTimers()
  })

  it('opens the verse resource on mouse long press without firing a click', () => {
    const onLongPressVerse = jest.fn()
    const onTapVerse = jest.fn()
    act(() => {
      root.render(<Harness annotationMode={false} callbacks={{ onLongPressVerse, onTapVerse }} />)
    })
    const target = host.querySelector('[data-verse-key]')!

    act(() => {
      target.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 10, clientY: 10 })
      )
      jest.advanceTimersByTime(401)
      window.dispatchEvent(
        new MouseEvent('mouseup', { bubbles: true, button: 0, clientX: 10, clientY: 10 })
      )
      target.dispatchEvent(
        new MouseEvent('click', { bubbles: true, button: 0, clientX: 10, clientY: 10 })
      )
      jest.advanceTimersByTime(250)
    })

    expect(onLongPressVerse).toHaveBeenCalledWith('1-1-1')
    expect(onTapVerse).not.toHaveBeenCalled()
  })

  it('keeps annotation mode active while dragging and suppresses the trailing click', () => {
    const onTapVerse = jest.fn()
    const onDragStart = jest.fn()
    const onSelectionChange = jest.fn()
    act(() => {
      root.render(
        <Harness
          annotationMode
          callbacks={{ onTapVerse, onDragStart }}
          onSelectionChange={onSelectionChange}
        />
      )
    })
    const target = host.querySelector('[data-verse-key]')!

    act(() => {
      target.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 10, clientY: 10 })
      )
      window.dispatchEvent(
        new MouseEvent('mousemove', { bubbles: true, buttons: 1, clientX: 70, clientY: 10 })
      )
      window.dispatchEvent(
        new MouseEvent('mouseup', { bubbles: true, button: 0, clientX: 70, clientY: 10 })
      )
      target.dispatchEvent(
        new MouseEvent('click', { bubbles: true, button: 0, clientX: 70, clientY: 10 })
      )
      jest.advanceTimersByTime(250)
    })

    expect(onDragStart).toHaveBeenCalledTimes(1)
    expect(onSelectionChange).toHaveBeenLastCalledWith({
      start: { verseKey: '1-1-1', wordIndex: 0 },
      end: { verseKey: '1-1-1', wordIndex: 1 },
    })
    expect(onTapVerse).not.toHaveBeenCalled()
  })
})
