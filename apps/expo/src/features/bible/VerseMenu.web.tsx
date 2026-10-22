import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ContextualPanel from '~common/ContextualPanel'
import type { PanelController, PanelPlacement, PanelScreen } from '~common/ContextualPanel/types'
import { BibleViewportContext } from './BibleViewport.web'

// Space kept between the reading column and the menu beside it
const COLUMN_GAP = 24

type Anchor = { left: number; top: number; width: number; height: number }
type Placement = { anchor: Anchor; placement: PanelPlacement; beside: boolean }

/** The verse a menu follows: parallel reading can show a version in several columns. */
export type VerseMenuTarget = {
  verseKey: string | undefined
  version: string
  column?: number
}

const getVerseElement = (root: ParentNode, { verseKey, version, column }: VerseMenuTarget) => {
  if (!verseKey) return undefined
  const elements = [...root.querySelectorAll<HTMLElement>(`[data-verse-key="${verseKey}"]`)]
  const inVersion = elements.filter(element => element.dataset.version === version)
  return (
    (column === undefined
      ? undefined
      : inVersion.find(element => element.dataset.column === String(column))) ??
    inVersion[0] ??
    elements[0]
  )
}

/**
 * Beside the reading column when its margin has room, so the menu hides no verse the reader may
 * still reach; under (or over) the verse when the columns fill the reader.
 */
const getPlacement = (
  viewport: HTMLElement,
  verse: HTMLElement | undefined,
  column: { left: number; right: number } | undefined,
  width: number
): Placement => {
  const bounds = viewport.getBoundingClientRect()
  if (!verse || !column) {
    return {
      anchor: { left: bounds.right - COLUMN_GAP, top: bounds.top + 80, width: 1, height: 1 },
      placement: 'left top',
      beside: true,
    }
  }
  const lines = verse.getClientRects()
  const box = verse.getBoundingClientRect()
  const top = lines[0]?.top ?? box.top
  const height = Math.max(1, (lines[lines.length - 1]?.bottom ?? box.bottom) - top)
  const room = width + COLUMN_GAP * 2
  if (bounds.right - column.right >= room) {
    return {
      anchor: { left: column.right + COLUMN_GAP - 8, top, width: 1, height },
      placement: 'right top',
      beside: true,
    }
  }
  if (column.left - bounds.left >= room) {
    return {
      anchor: { left: column.left - COLUMN_GAP + 8, top, width: 1, height },
      placement: 'left top',
      beside: true,
    }
  }
  return {
    anchor: { left: box.left, top, width: Math.max(1, box.width), height },
    placement: 'bottom start',
    beside: false,
  }
}

/** The horizontal extent of the verses on screen: the reading column, or every column. */
const getColumn = (viewport: HTMLElement) => {
  let left = Infinity
  let right = -Infinity
  viewport.querySelectorAll<HTMLElement>('[data-verse-text]').forEach(element => {
    const rect = element.getBoundingClientRect()
    if (!rect.width) return
    left = Math.min(left, rect.left)
    right = Math.max(right, rect.right)
  })
  return Number.isFinite(left) ? { left, right } : undefined
}

/** The reader is on screen: not unmounted, collapsed, hidden or moved out of the window. */
const isShown = (element: HTMLElement) => {
  if (!element.isConnected) return false
  const rect = element.getBoundingClientRect()
  if (rect.width < 1 || rect.height < 1 || rect.right <= 0 || rect.left >= window.innerWidth)
    return false
  return element.checkVisibility?.({ opacityProperty: true, visibilityProperty: true }) ?? true
}

type VerseMenuProps = {
  /** The reader wants the menu: it shows whenever the reader is on screen. */
  isRequested: boolean
  target: VerseMenuTarget
  accessibilityLabel: string
  initialScreen: string
  width: number
  screens: Record<string, PanelScreen>
  onOpenChange: (isOpen: boolean) => void
  /** The menu closed itself (Escape inside it, or a screen that finished its task). */
  onClose: () => void
}

/**
 * A desktop menu beside a verse of the reader. It follows that verse as the reader scrolls, moving
 * under it when a panel leaves no margin beside the column, and steps aside while the reader is off
 * screen.
 */
export default function VerseMenu({
  isRequested,
  target,
  accessibilityLabel,
  initialScreen,
  width,
  screens,
  onOpenChange,
  onClose,
}: VerseMenuProps) {
  const viewportRef = useContext(BibleViewportContext)
  const controller = useRef<PanelController>(null)
  const anchorRef = useRef<HTMLDivElement | null>(null)
  // Set before the menu closes itself: the reader asked for that close.
  const closingQuietly = useRef(false)
  const [isOpen, setOpen] = useState(false)
  const [isReaderShown, setReaderShown] = useState(true)
  const [placement, setPlacement] = useState<{ placement: PanelPlacement; beside: boolean }>({
    placement: 'right top',
    beside: true,
  })
  const shouldShow = isRequested && isReaderShown

  useEffect(() => {
    if (shouldShow && !isOpen) controller.current?.open?.()
    if (!shouldShow && isOpen) {
      closingQuietly.current = true
      controller.current?.dismiss()
    }
  }, [shouldShow, isOpen])

  // While the menu is requested, each frame checks that the reader is still on screen and moves the
  // menu with its verse, as the reader scrolls or a panel narrows it. The anchor lives outside the
  // reader, so that scrolling the reader does not close the popover, and its height changes by a
  // fraction of a pixel at each move: the popover only repositions itself when its anchor resizes.
  const { verseKey, version, column: targetColumn } = target
  useLayoutEffect(() => {
    const viewport = viewportRef?.current
    const anchor = anchorRef.current
    if (!isRequested || !viewport || !anchor) return
    let column: ReturnType<typeof getColumn>
    let viewportWidth = -1
    let lastAnchor = ''
    let tick = 0
    let frame = 0
    const update = () => {
      frame = requestAnimationFrame(update)
      const shown = isShown(viewport)
      setReaderShown(shown)
      if (!shown || !isOpen) return
      const nextWidth = viewport.getBoundingClientRect().width
      if (nextWidth !== viewportWidth) {
        viewportWidth = nextWidth
        column = getColumn(viewport)
      }
      const verse = getVerseElement(viewport, { verseKey, version, column: targetColumn })
      const next = getPlacement(viewport, verse, column, width)
      const key = [next.anchor.left, next.anchor.top, next.anchor.width, next.anchor.height]
        .map(value => Math.round(value * 2))
        .join(':')
      if (key === lastAnchor) return
      lastAnchor = key
      tick = (tick + 1) % 2
      anchor.style.left = `${next.anchor.left}px`
      anchor.style.top = `${next.anchor.top}px`
      anchor.style.width = `${next.anchor.width}px`
      anchor.style.height = `${next.anchor.height + tick * 0.5}px`
      setPlacement(current =>
        current.placement === next.placement && current.beside === next.beside
          ? current
          : { placement: next.placement, beside: next.beside }
      )
    }
    update()
    return () => cancelAnimationFrame(frame)
  }, [isRequested, isOpen, verseKey, version, targetColumn, width, viewportRef])

  return (
    <>
      {createPortal(
        <div
          ref={anchorRef}
          aria-hidden
          style={{ position: 'fixed', pointerEvents: 'none', visibility: 'hidden' }}
        />,
        document.body
      )}
      <ContextualPanel
        controllerRef={controller}
        anchorRef={anchorRef}
        trigger={null}
        accessibilityLabel={accessibilityLabel}
        initialScreen={initialScreen}
        width={width}
        placement={placement.placement}
        noFlip={placement.beside}
        nonModal
        screens={screens}
        onOpen={() => {
          setOpen(true)
          onOpenChange(true)
        }}
        onClose={() => {
          setOpen(false)
          onOpenChange(false)
          if (closingQuietly.current) closingQuietly.current = false
          else onClose()
        }}
      />
    </>
  )
}
