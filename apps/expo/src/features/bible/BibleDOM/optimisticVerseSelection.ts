import { useEffect, useState } from 'react'

import type { VerseTarget } from './AnnotationMode/verseTargets'

// A toggle the native side never reflects (it ignored it, or the selection changed meanwhile)
// stops being shown after this delay, and the selection it sent back is shown again.
const UNCONFIRMED_TOGGLE_LIFETIME = 1500

export interface VerseSelection {
  selectedVerses: Record<string, boolean>
  selectedVersesVersion: string
}

/**
 * A verse the reader selected or unselected in the Bible view, shown before the selection the
 * native side holds comes back with it.
 */
export interface OptimisticVerseToggle {
  verseKey: string
  version: string
  selected: boolean
  /** The tap still waits to rule out a double tap: nothing was sent to the native side yet. */
  held: boolean
  updatedAt: number
}

const isVerseSelected = (selection: VerseSelection, { verseKey, version }: VerseTarget) =>
  Boolean(selection.selectedVerses[verseKey]) && selection.selectedVersesVersion === version

const applyToggle = (
  selection: VerseSelection,
  { verseKey, version, selected }: OptimisticVerseToggle
): VerseSelection => {
  if (!selected) {
    if (!isVerseSelected(selection, { verseKey, version })) return selection
    const { [verseKey]: _unselected, ...selectedVerses } = selection.selectedVerses
    return { ...selection, selectedVerses }
  }
  // As on the native side, a selection stays in one version: a verse of another one starts anew.
  const selectedVerses = version === selection.selectedVersesVersion ? selection.selectedVerses : {}
  return {
    selectedVerses: { ...selectedVerses, [verseKey]: true },
    selectedVersesVersion: version,
  }
}

export const applyVerseToggles = (
  selection: VerseSelection,
  toggles: readonly OptimisticVerseToggle[]
): VerseSelection => toggles.reduce(applyToggle, selection)

/** The toggle a tap on this verse makes, given the selection shown. */
export const createVerseToggle = (
  shown: VerseSelection,
  target: VerseTarget,
  held: boolean,
  now: number
): OptimisticVerseToggle => ({
  verseKey: target.verseKey,
  version: target.version,
  selected: !isVerseSelected(shown, target),
  held,
  updatedAt: now,
})

/** Toggles sent to the native side whose effect its selection now shows. */
export const isVerseToggleConfirmed = (selection: VerseSelection, toggle: OptimisticVerseToggle) =>
  !toggle.held && isVerseSelected(selection, toggle) === toggle.selected

const isSameVerse = (toggle: OptimisticVerseToggle, target: VerseTarget) =>
  toggle.verseKey === target.verseKey && toggle.version === target.version

/**
 * Shows a verse as selected or unselected the moment it is tapped, instead of after the round
 * trip through the native side. `selection` is what the native side holds; `shownSelection`
 * adds the taps it has not reflected yet, and `decidedSelection` leaves out the taps still
 * held back to rule out a double tap.
 */
export function useOptimisticVerseSelection(selection: VerseSelection) {
  const [toggles, setToggles] = useState<OptimisticVerseToggle[]>([])
  // Every verse was unselected at this time: none is shown until the native side follows
  const [clearedAt, setClearedAt] = useState<number | null>(null)
  const { selectedVerses, selectedVersesVersion } = selection
  const isReturnedSelectionEmpty = Object.keys(selectedVerses).length === 0

  useEffect(() => {
    if (clearedAt === null) return
    if (isReturnedSelectionEmpty) {
      setClearedAt(null)
      return
    }
    const timer = setTimeout(
      () => setClearedAt(null),
      Math.max(0, clearedAt + UNCONFIRMED_TOGGLE_LIFETIME - Date.now())
    )
    return () => clearTimeout(timer)
  }, [clearedAt, isReturnedSelectionEmpty])

  // The selection the toggles apply to: none while a clearing is on its way to the native side
  const baseSelection: VerseSelection =
    clearedAt === null ? selection : { selectedVerses: {}, selectedVersesVersion }

  // A toggle is no longer needed once the selection coming back from the native side shows it
  useEffect(() => {
    setToggles(previous => {
      const returned = { selectedVerses, selectedVersesVersion }
      const pending = previous.filter(toggle => !isVerseToggleConfirmed(returned, toggle))
      return pending.length === previous.length ? previous : pending
    })
  }, [selectedVerses, selectedVersesVersion])

  useEffect(() => {
    if (!toggles.length) return
    const oldest = Math.min(...toggles.map(toggle => toggle.updatedAt))
    const timer = setTimeout(
      () => {
        const now = Date.now()
        setToggles(previous =>
          previous.filter(toggle => now - toggle.updatedAt < UNCONFIRMED_TOGGLE_LIFETIME)
        )
      },
      Math.max(0, oldest + UNCONFIRMED_TOGGLE_LIFETIME - Date.now())
    )
    return () => clearTimeout(timer)
  }, [toggles])

  const shownSelection = applyVerseToggles(baseSelection, toggles)
  const decidedSelection = applyVerseToggles(
    baseSelection,
    toggles.filter(toggle => !toggle.held)
  )

  // A tap held back to rule out a double tap: shown already, sent once the tap is confirmed
  const showHeldToggle = (target: VerseTarget) => {
    setToggles(previous => {
      if (previous.some(toggle => toggle.held && isSameVerse(toggle, target))) return previous
      const others = previous.filter(toggle => !isSameVerse(toggle, target))
      const decided = applyVerseToggles(
        baseSelection,
        others.filter(toggle => !toggle.held)
      )
      return [...others, createVerseToggle(decided, target, true, Date.now())]
    })
  }

  // A toggle sent to the native side: the held one becomes sent, otherwise a new one is shown
  const showSentToggle = (target: VerseTarget) => {
    setToggles(previous => {
      const now = Date.now()
      const held = previous.find(toggle => toggle.held && isSameVerse(toggle, target))
      if (held) {
        return previous.map(toggle =>
          toggle === held ? { ...toggle, held: false, updatedAt: now } : toggle
        )
      }
      const others = previous.filter(toggle => !isSameVerse(toggle, target))
      const decided = applyVerseToggles(
        baseSelection,
        previous.filter(toggle => !toggle.held)
      )
      return [...others, createVerseToggle(decided, target, false, now)]
    })
  }

  const discardHeldToggles = () => {
    setToggles(previous =>
      previous.some(toggle => toggle.held) ? previous.filter(toggle => !toggle.held) : previous
    )
  }

  // Every verse unselected: by a tap away from the text, or by words taking over the selection
  const showClearedSelection = () => {
    setToggles([])
    setClearedAt(Date.now())
  }

  return {
    shownSelection,
    decidedSelection,
    showHeldToggle,
    showSentToggle,
    discardHeldToggles,
    showClearedSelection,
  }
}
