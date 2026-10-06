import { useEffect, useRef, useState, type RefObject } from 'react'
import { useI18n } from '@/locales'
import { hideAnchoredPopoverOnScroll, placePopover } from '../resources/popoverPlacement'
import type { BibleNote } from './bibleLayout'

/**
 * The card opened by a note mark. A mark is a plain link to its note under the text; where
 * the browser supports popovers, a click shows the note next to the mark instead of
 * leaving the verse.
 */
export default function BibleNotePopover({
  containerRef,
  notes,
  reference,
}: {
  /** The element whose `a[data-note]` marks open the card. */
  containerRef: RefObject<HTMLElement | null>
  notes: readonly BibleNote[]
  /** Names the verse of a note, such as `Matthieu 5:3`. */
  reference: (verse: number) => string
}) {
  const t = useI18n()
  const popoverRef = useRef<HTMLDivElement>(null)
  const [note, setNote] = useState<BibleNote>()

  useEffect(() => {
    const container = containerRef.current
    const popover = popoverRef.current
    if (!container || !popover || typeof popover.showPopover !== 'function') return

    let opener: HTMLAnchorElement | undefined
    const onClick = (event: MouseEvent) => {
      const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
      if (event.defaultPrevented || event.button !== 0 || modified) return
      const mark = (event.target as Element).closest<HTMLAnchorElement>('a[data-note]')
      const selected = mark && notes.find(candidate => String(candidate.id) === mark.dataset.note)
      if (!mark || !selected) return
      event.preventDefault()

      const reopening = opener === mark && popover.matches(':popover-open')
      if (popover.matches(':popover-open')) popover.hidePopover()
      // A second click on the same mark only closes its card.
      if (reopening) return
      placePopover(popover, mark)
      setNote(selected)
      popover.showPopover()
      opener = mark
      mark.setAttribute('aria-expanded', 'true')
    }
    const onToggle = (event: Event) => {
      if ((event as ToggleEvent).newState === 'closed') opener?.removeAttribute('aria-expanded')
    }

    container.addEventListener('click', onClick)
    popover.addEventListener('toggle', onToggle)
    const stopHidingOnScroll = hideAnchoredPopoverOnScroll(popover)
    return () => {
      container.removeEventListener('click', onClick)
      popover.removeEventListener('toggle', onToggle)
      stopHidingOnScroll()
    }
  }, [containerRef, notes])

  return (
    // `popover` is not typed by React 18; the attribute reaches the DOM as written.
    <div ref={popoverRef} {...{ popover: 'auto' }} className="resource-popover" role="note">
      {note && (
        <>
          <p className="resource-muted text-sm font-semibold">
            {t('bible.note')} {note.id} · {reference(note.verse)}
          </p>
          <div
            className="bible-note-popover__body"
            dangerouslySetInnerHTML={{ __html: note.html }}
          />
        </>
      )}
    </div>
  )
}
