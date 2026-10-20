import {
  useContext,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import ContextualPanel from '~common/ContextualPanel'
import type {
  PanelController,
  PanelNavigation,
  PanelPlacement,
  PanelScreen,
} from '~common/ContextualPanel/types'
import { useEntityTagsScreen } from '~common/ContextualPanel/useEntityTagsScreen'
import type { SheetRef } from '~common/sheet'
import { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useBibleBookmarkScreens } from '~features/bookmarks/useBibleBookmarkScreens'
import { useAddToStudyScreens } from '~features/studies/useAddToStudyScreens'
import { BibleViewportContext } from '../BibleViewport.web'
import { getSelectedVersesBookmarkLocation } from '../selectedVersesActions'
import {
  SelectionMenuContext,
  type SelectionMenu as SelectionMenuValue,
} from './selectionMenuContext'
import { SELECTION_SHORTCUTS, type SelectionShortcut } from './selectionShortcuts'
import type { SelectionMenuProps } from './SelectionMenu'

export const SELECTION_MENU_WIDTH = 288
// Space kept between the reading column and the menu beside it
const COLUMN_GAP = 24

type Anchor = { left: number; top: number; width: number; height: number }
type Placement = { anchor: Anchor; placement: PanelPlacement; beside: boolean }

/** Typing in a field keeps its keys. */
const isEditableTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || !!target.closest('input, textarea, select, [contenteditable]'))

const getVerseElement = (root: ParentNode, verseKey: string | undefined, version: string) => {
  if (!verseKey) return undefined
  const elements = [...root.querySelectorAll<HTMLElement>(`[data-verse-key="${verseKey}"]`)]
  return elements.find(element => element.dataset.version === version) ?? elements[0]
}

/**
 * Beside the reading column when its margin has room, so the menu hides no verse the reader may
 * still add; under (or over) the verse when the columns fill the reader.
 */
const getPlacement = (
  viewport: HTMLElement,
  verse: HTMLElement | undefined,
  column: { left: number; right: number } | undefined
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
  const room = SELECTION_MENU_WIDTH + COLUMN_GAP * 2
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

/**
 * The desktop form of the selected verses sheet: a menu of the same three groups, opened beside
 * the last verse selected. It stays open while the reader adds or removes verses and follows that
 * verse as the reader scrolls, moving under that verse when a panel leaves no margin beside the
 * column. It steps aside while the reader is off screen. Its own button and Escape end the
 * selection.
 */
export default function SelectionMenu({
  ref,
  reference,
  selectedVerses,
  version,
  header,
  children,
  shortcuts,
  onSelectStudy,
  onClose,
}: SelectionMenuProps) {
  const { t } = useTranslation()
  const viewportRef = useContext(BibleViewportContext)
  const controller = useRef<PanelController>(null)
  const anchorRef = useRef<HTMLDivElement | null>(null)
  const navigation = useRef<PanelNavigation | null>(null)
  // Set before the menu closes itself: the selection outlives that close.
  const closingQuietly = useRef(false)
  const [isOpen, setOpen] = useState(false)
  const [isRequested, setRequested] = useState(false)
  const [isReaderShown, setReaderShown] = useState(true)
  const [placement, setPlacement] = useState<{ placement: PanelPlacement; beside: boolean }>({
    placement: 'right top',
    beside: true,
  })
  const shouldShow = isRequested && isReaderShown

  const tags = useEntityTagsScreen('highlights', selectedVerses)
  const location = getSelectedVersesBookmarkLocation(selectedVerses)
  const bookmark = useBibleBookmarkScreens(
    location?.book ?? 1,
    location?.chapter ?? 1,
    version,
    location?.verse
  )
  const study = useAddToStudyScreens({ onSelect: onSelectStudy, reference })

  const menu: SelectionMenuValue = {
    openScreen: name => navigation.current?.open(name),
  }

  // The reader presents the menu at each change of the selection and dismisses it once empty.
  useImperativeHandle(ref, (): SheetRef => {
    const present = () => {
      setRequested(true)
    }
    const dismiss = () => setRequested(false)
    return {
      present,
      presentAt: present,
      resizeTo: () => {},
      dismiss,
      close: dismiss,
      forceClose: dismiss,
    }
  })

  // A selection made before the window grew to the desktop width opens the menu at once.
  useEffect(() => {
    if (Object.keys(selectedVerses).length) setRequested(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (shouldShow && !isOpen) controller.current?.open?.()
    if (!shouldShow && isOpen) {
      closingQuietly.current = true
      controller.current?.dismiss()
    }
  }, [shouldShow, isOpen])

  // While verses are selected, each frame checks that the reader is still on screen and moves the
  // menu with the last verse selected, as the reader scrolls or a panel narrows it. The anchor
  // lives outside the reader, so that scrolling the reader does not close the popover, and its
  // height changes by a fraction of a pixel at each move: the popover only repositions itself
  // when its anchor resizes.
  useLayoutEffect(() => {
    const viewport = viewportRef?.current
    const anchor = anchorRef.current
    if (!isRequested || !viewport || !anchor) return
    const verseKeys = Object.keys(selectedVerses)
    const lastVerseKey = verseKeys[verseKeys.length - 1]
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
      const width = viewport.getBoundingClientRect().width
      if (width !== viewportWidth) {
        viewportWidth = width
        column = getColumn(viewport)
      }
      const next = getPlacement(viewport, getVerseElement(viewport, lastVerseKey, version), column)
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
  }, [isRequested, isOpen, selectedVerses, version, viewportRef])

  useEffect(() => {
    if (!isRequested) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || isEditableTarget(event.target)) return
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (!isOpen) return
      const command = event.metaKey || event.ctrlKey
      if (command && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'c') {
        // Copying text the reader selected by hand keeps the browser's behaviour.
        if (!window.getSelection()?.isCollapsed || !shortcuts.copy) return
        event.preventDefault()
        shortcuts.copy(menu)
        return
      }
      if (command || event.altKey || event.repeat) return
      const action = (Object.keys(SELECTION_SHORTCUTS) as SelectionShortcut[]).find(
        name => SELECTION_SHORTCUTS[name] === event.key.toUpperCase()
      )
      const handler = action && shortcuts[action]
      if (!handler) return
      event.preventDefault()
      handler(menu)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const screens: Record<string, PanelScreen> = {
    actions: {
      title: reference,
      width: SELECTION_MENU_WIDTH,
      headerRight: (
        <TouchableBox
          accessibilityRole="button"
          accessibilityLabel={t('Désélectionner')}
          onPress={onClose}
          className="w-[28px] h-[28px] items-center justify-center rounded-md"
        >
          <FeatherIcon name="x" size={17} color="tertiary" />
        </TouchableBox>
      ),
      headerContent: header,
      content: nav => {
        navigation.current = nav
        return (
          <SelectionMenuContext.Provider value={menu}>{children}</SelectionMenuContext.Provider>
        )
      },
    },
    tags: {
      ...tags.screen,
      width: 320,
      headerContent: (
        <>
          <Text className="px-3 text-[12px] text-tertiary">{reference}</Text>
          {tags.screen.headerContent}
        </>
      ),
    },
    ...Object.fromEntries(
      Object.entries(bookmark.screens).map(([name, screen]) => [
        name,
        { ...screen, width: 360, ...(name === 'bookmark' ? { onEnter: bookmark.prepare } : {}) },
      ])
    ),
    ...Object.fromEntries(
      Object.entries(study.screens).map(([name, screen]) => [name, { ...screen, width: 340 }])
    ),
  }

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
        accessibilityLabel={reference}
        initialScreen="actions"
        width={SELECTION_MENU_WIDTH}
        placement={placement.placement}
        noFlip={placement.beside}
        nonModal
        screens={screens}
        onOpen={() => setOpen(true)}
        onClose={() => {
          setOpen(false)
          navigation.current = null
          tags.reset()
          study.reset()
          // Escape inside the menu, or a screen that finished its task, ends the selection.
          if (closingQuietly.current) closingQuietly.current = false
          else onClose()
        }}
      />
    </>
  )
}
