import { useContext, useRef } from 'react'
import type { VerseIds } from '~common/types'
import { BibleViewportContext } from './BibleViewport.web'
import { moveVerseSelection } from './bibleKeyboardActions'
import type { BibleReaderShortcutsProps } from './BibleReaderShortcuts'
import { useBibleKeyboardShortcut } from './useBibleKeyboardShortcut'

// The reader's header covers the top of the text: a verse under it is not the one being read.
const COVERED_TOP = 120

/** The verses of the version on screen, in reading order, as the reader clicks them. */
const getVerseElements = (viewport: HTMLElement, version: string) => {
  const elements = [...viewport.querySelectorAll<HTMLElement>('[data-verse-key]')]
  const inVersion = elements.filter(element => element.dataset.version === version)
  return inVersion.length ? inVersion : elements
}

/**
 * The reader's keys: ← and → change chapter, J and K select the next or previous verse (the menu
 * beside it follows), Shift extends the selection. With no selection yet, J and K start at the
 * first verse under the header.
 */
export default function BibleReaderShortcuts({
  tabId,
  version,
  selectedVerses,
  canChangeChapter,
  canSelect,
  onPreviousChapter,
  onNextChapter,
  onSelect,
}: BibleReaderShortcutsProps) {
  const viewportRef = useContext(BibleViewportContext)
  const head = useRef<string | undefined>(undefined)

  const move = (direction: 1 | -1, extend: boolean) => () => {
    const viewport = viewportRef?.current
    if (!viewport) return
    const elements = getVerseElements(viewport, version)
    const verseKeys = [...new Set(elements.map(element => element.dataset.verseKey ?? ''))]
    const next = moveVerseSelection(
      verseKeys,
      Object.keys(selectedVerses),
      direction,
      extend,
      head.current
    )
    if (next) {
      head.current = next.head
      onSelect(Object.fromEntries(next.keys.map(key => [key, true])) as VerseIds)
      return
    }
    const top = viewport.getBoundingClientRect().top + COVERED_TOP
    const start = elements.find(element => {
      const rect = element.getBoundingClientRect()
      return rect.height > 0 && rect.bottom > top
    })?.dataset.verseKey
    if (!start) return
    head.current = start
    onSelect({ [start]: true } as VerseIds)
  }

  const chapter = { enabled: canChangeChapter }
  useBibleKeyboardShortcut('previousChapter', tabId, onPreviousChapter, chapter)
  useBibleKeyboardShortcut('nextChapter', tabId, onNextChapter, chapter)
  const verse = { enabled: canSelect, repeat: true, besideVerseMenu: true }
  useBibleKeyboardShortcut('nextVerse', tabId, move(1, false), verse)
  useBibleKeyboardShortcut('previousVerse', tabId, move(-1, false), verse)
  useBibleKeyboardShortcut('extendNext', tabId, move(1, true), verse)
  useBibleKeyboardShortcut('extendPrevious', tabId, move(-1, true), verse)
  return null
}
