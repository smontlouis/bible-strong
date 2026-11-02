import { Component, type RefObject } from 'react'
import type { Verse } from '~common/types'
import { getDOMScrollTarget, getDOMScrollTop, scrollDOMTo } from './domScroll'
import { findReadingAnchor, getReadingAnchorOffset, type ReadingAnchor } from './readingAnchor'

type ReadingPositionKeeperProps = {
  verses: Verse[]
  version: string
  /** Book and chapter: a move elsewhere drops the place kept. */
  location: string
  isDisabled: boolean
  readingLine: number
  containerRef: RefObject<HTMLElement | null>
}

const getRenderedVerses = () => [...document.querySelectorAll('[id^="verset-"]')]

const getFirstVerseText = (verses: Verse[]) => verses[0]?.Texte

/**
 * Keeps the reader on the same verse when the version changes. It measures once, in the instant
 * before the new version reaches the page: the text of the old one is still there, and scrolling
 * costs nothing. The new text may come later, so the place waits for it.
 */
export default class ReadingPositionKeeper extends Component<ReadingPositionKeeperProps> {
  private kept: { anchor: ReadingAnchor; previousText: string | undefined } | null = null

  getSnapshotBeforeUpdate(previous: ReadingPositionKeeperProps) {
    const { version, isDisabled, readingLine, containerRef } = this.props
    if (previous.version !== version && !isDisabled) {
      const isAtTop = getDOMScrollTop(getDOMScrollTarget(containerRef.current)) <= 0
      const anchor = isAtTop ? null : findReadingAnchor(getRenderedVerses(), readingLine)
      this.kept = anchor && { anchor, previousText: getFirstVerseText(previous.verses) }
    }
    return null
  }

  componentDidUpdate(previous: ReadingPositionKeeperProps) {
    const { verses, location, readingLine, containerRef } = this.props
    if (!this.kept) return
    if (previous.location !== location) {
      this.kept = null
      return
    }
    if (!verses.length || getFirstVerseText(verses) === this.kept.previousText) return

    const offset = getReadingAnchorOffset(getRenderedVerses(), this.kept.anchor, readingLine)
    this.kept = null
    if (offset === null) return
    const target = getDOMScrollTarget(containerRef.current)
    window.disableSwipeDownEvent = true
    scrollDOMTo(target, { top: getDOMScrollTop(target) + offset })
    setTimeout(() => {
      window.disableSwipeDownEvent = false
    }, 400)
  }

  render() {
    return null
  }
}
