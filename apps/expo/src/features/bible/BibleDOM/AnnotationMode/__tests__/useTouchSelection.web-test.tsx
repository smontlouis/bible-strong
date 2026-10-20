/** @jest-environment jsdom */

import React, { act, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import type { Verse } from '~common/types'
import type { WordToken } from '~helpers/wordTokenizer'
import type { SelectionRange } from '../selectionUtils'
import { useTouchSelection, type TouchSelectionCallbacks } from '../useTouchSelection'

// Two parallel columns: the first under x < 100, the second beyond. Each column starts a word
// at 0 and 6. Below y = 100 there is no verse, like the gap between lines where handles sit.
jest.mock('../domUtils', () => ({
  findVerseContainer: (element: Element | null) => element?.closest('[data-verse-key]') ?? null,
  getCaretInfoFromPoint: (x: number, y: number) =>
    y < 100
      ? {
          charOffset: x % 100 < 50 ? 0 : 6,
          targetElement: globalThis.document.querySelectorAll('[data-verse-text]')[x < 100 ? 0 : 1],
        }
      : null,
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
  sameVersionColumns = false,
  initialSelection = null,
  handlePositions = { start: null, end: null },
}: {
  annotationMode: boolean
  callbacks: TouchSelectionCallbacks
  onSelectionChange?: (selection: SelectionRange | null) => void
  // LSG shown in both parallel columns instead of LSG and KJV
  sameVersionColumns?: boolean
  initialSelection?: SelectionRange | null
  handlePositions?: {
    start: { x: number; y: number } | null
    end: { x: number; y: number } | null
  }
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [selection, setSelectionState] = useState<SelectionRange | null>(initialSelection)

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
    versesByVersion: { LSG: [verse], KJV: [{ ...verse, Texte: 'In the beginning' }] },
    getTokens: () => tokens,
    getSelectionHandlePositions: () => handlePositions,
    highlightRects: [],
    annotationMode,
    callbacks,
  })

  if (sameVersionColumns) {
    return (
      <div ref={containerRef}>
        <span data-verse-text data-version="LSG" data-verse-key="1-1-1" data-column="0">
          Au commencement
        </span>
        <span data-verse-text data-version="LSG" data-verse-key="1-1-1" data-column="1">
          Au commencement
        </span>
      </div>
    )
  }

  return (
    <div ref={containerRef}>
      <span data-verse-text data-version="LSG" data-verse-key="1-1-1">
        Au commencement
      </span>
      <span data-verse-text data-version="KJV" data-verse-key="1-1-1">
        In the beginning
      </span>
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

    expect(onLongPressVerse).toHaveBeenCalledWith({ verseKey: '1-1-1', version: 'LSG' })
    expect(onTapVerse).not.toHaveBeenCalled()
  })

  it('drags a selection handle pressed outside the text lines', () => {
    const onSelectionChange = jest.fn()
    act(() => {
      root.render(
        <Harness
          annotationMode
          callbacks={{}}
          onSelectionChange={onSelectionChange}
          initialSelection={{
            start: { verseKey: '1-1-1', wordIndex: 0 },
            end: { verseKey: '1-1-1', wordIndex: 0 },
            version: 'LSG',
          }}
          handlePositions={{ start: { x: 20, y: 0 }, end: { x: 20, y: 150 } }}
        />
      )
    })
    const container = host.firstElementChild!

    act(() => {
      container.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 20, clientY: 150 })
      )
      window.dispatchEvent(
        new MouseEvent('mousemove', { bubbles: true, buttons: 1, clientX: 70, clientY: 10 })
      )
      window.dispatchEvent(
        new MouseEvent('mouseup', { bubbles: true, button: 0, clientX: 70, clientY: 10 })
      )
    })

    expect(onSelectionChange).toHaveBeenLastCalledWith({
      start: { verseKey: '1-1-1', wordIndex: 0 },
      end: { verseKey: '1-1-1', wordIndex: 1 },
      version: 'LSG',
    })
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
      version: 'LSG',
    })
    expect(onTapVerse).not.toHaveBeenCalled()
  })
  it('enters annotation mode from a reading-mode mouse drag and suppresses the trailing click', () => {
    const onTapVerse = jest.fn()
    const onDragStart = jest.fn()
    const onMouseSelectionStart = jest.fn(() => true)
    const onSelectionChange = jest.fn()
    act(() => {
      root.render(
        <Harness
          annotationMode={false}
          callbacks={{ onTapVerse, onDragStart, onMouseSelectionStart }}
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

    expect(onMouseSelectionStart).toHaveBeenCalledTimes(1)
    expect(onMouseSelectionStart).toHaveBeenCalledWith({ verseKey: '1-1-1', version: 'LSG' })
    expect(onDragStart).toHaveBeenCalledTimes(1)
    expect(onSelectionChange).toHaveBeenLastCalledWith({
      start: { verseKey: '1-1-1', wordIndex: 0 },
      end: { verseKey: '1-1-1', wordIndex: 1 },
      version: 'LSG',
    })
    expect(onTapVerse).not.toHaveBeenCalled()
  })
  it('keeps a selection in the version it started in when dragged over another column', () => {
    const onSelectionChange = jest.fn()
    act(() => {
      root.render(<Harness annotationMode callbacks={{}} onSelectionChange={onSelectionChange} />)
    })
    const target = host.querySelector('[data-version="LSG"]')!

    act(() => {
      target.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 10, clientY: 10 })
      )
      window.dispatchEvent(
        new MouseEvent('mousemove', { bubbles: true, buttons: 1, clientX: 70, clientY: 10 })
      )
      window.dispatchEvent(
        new MouseEvent('mousemove', { bubbles: true, buttons: 1, clientX: 110, clientY: 10 })
      )
      window.dispatchEvent(
        new MouseEvent('mouseup', { bubbles: true, button: 0, clientX: 110, clientY: 10 })
      )
    })

    expect(onSelectionChange).toHaveBeenLastCalledWith({
      start: { verseKey: '1-1-1', wordIndex: 0 },
      end: { verseKey: '1-1-1', wordIndex: 1 },
      version: 'LSG',
    })
  })

  it('keeps a selection in the column it started in when another column shows the same version', () => {
    const onSelectionChange = jest.fn()
    act(() => {
      root.render(
        <Harness
          annotationMode
          callbacks={{}}
          onSelectionChange={onSelectionChange}
          sameVersionColumns
        />
      )
    })
    const target = host.querySelector('[data-column="0"]')!

    act(() => {
      target.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 10, clientY: 10 })
      )
      window.dispatchEvent(
        new MouseEvent('mousemove', { bubbles: true, buttons: 1, clientX: 70, clientY: 10 })
      )
      window.dispatchEvent(
        new MouseEvent('mousemove', { bubbles: true, buttons: 1, clientX: 110, clientY: 10 })
      )
      window.dispatchEvent(
        new MouseEvent('mouseup', { bubbles: true, button: 0, clientX: 110, clientY: 10 })
      )
    })

    expect(onSelectionChange).toHaveBeenLastCalledWith({
      start: { verseKey: '1-1-1', wordIndex: 0 },
      end: { verseKey: '1-1-1', wordIndex: 1 },
      version: 'LSG',
      column: 0,
    })
  })

  it('starts a selection in the column it is dragged from', () => {
    const onSelectionChange = jest.fn()
    act(() => {
      root.render(
        <Harness
          annotationMode
          callbacks={{}}
          onSelectionChange={onSelectionChange}
          sameVersionColumns
        />
      )
    })
    const target = host.querySelector('[data-column="1"]')!

    act(() => {
      target.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 110, clientY: 10 })
      )
      window.dispatchEvent(
        new MouseEvent('mousemove', { bubbles: true, buttons: 1, clientX: 170, clientY: 10 })
      )
      window.dispatchEvent(
        new MouseEvent('mouseup', { bubbles: true, button: 0, clientX: 170, clientY: 10 })
      )
    })

    expect(onSelectionChange).toHaveBeenLastCalledWith({
      start: { verseKey: '1-1-1', wordIndex: 0 },
      end: { verseKey: '1-1-1', wordIndex: 1 },
      version: 'LSG',
      column: 1,
    })
  })

  it('reports the version of the verse a mouse long press lands on', () => {
    const onLongPressVerse = jest.fn()
    act(() => {
      root.render(<Harness annotationMode={false} callbacks={{ onLongPressVerse }} />)
    })
    const target = host.querySelector('[data-version="KJV"]')!

    act(() => {
      target.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 110, clientY: 10 })
      )
      jest.advanceTimersByTime(401)
      window.dispatchEvent(
        new MouseEvent('mouseup', { bubbles: true, button: 0, clientX: 110, clientY: 10 })
      )
    })

    expect(onLongPressVerse).toHaveBeenCalledWith({ verseKey: '1-1-1', version: 'KJV' })
  })

  it.each([false, undefined])(
    'does not select when reading mode rejects dragging (%s)',
    allowed => {
      const onMouseSelectionStart = jest.fn(() => false)
      const onSelectionChange = jest.fn()
      act(() => {
        root.render(
          <Harness
            annotationMode={false}
            callbacks={allowed === undefined ? {} : { onMouseSelectionStart }}
            onSelectionChange={onSelectionChange}
          />
        )
      })
      const target = host.querySelector('[data-verse-key]')!
      act(() => {
        target.dispatchEvent(
          new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 70, clientY: 10 })
        )
        window.dispatchEvent(
          new MouseEvent('mousemove', { bubbles: true, buttons: 1, clientX: 10, clientY: 10 })
        )
        window.dispatchEvent(
          new MouseEvent('mouseup', { bubbles: true, button: 0, clientX: 10, clientY: 10 })
        )
      })
      expect(onSelectionChange).not.toHaveBeenCalled()
    }
  )
})
