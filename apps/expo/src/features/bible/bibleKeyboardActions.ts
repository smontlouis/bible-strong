import type { StrongMode } from '~helpers/strongBiblePublications'

export function nextAvailableStrongMode(
  current: StrongMode,
  strongAvailable: boolean,
  interlinearAvailable: boolean
): StrongMode {
  const modes: StrongMode[] = ['hidden']
  if (strongAvailable) modes.push('visible')
  if (strongAvailable && interlinearAvailable) modes.push('transliteration', 'reverse-interlinear')
  return modes[(modes.indexOf(current) + 1) % modes.length]
}

export function parseVerseDestination(value: string, verseCount?: number): number | undefined {
  if (!verseCount || !/^\d+$/.test(value.trim())) return
  const verse = Number(value.trim())
  return Number.isInteger(verse) && verse >= 1 && verse <= verseCount ? verse : undefined
}

/**
 * The selection after J or K: the next or previous verse alone or, with Shift, every verse from
 * where the selection started to the one reached. `head` is the end that moved last. The verse
 * reached comes last in the returned keys: the reader scrolls to it and the menu follows it.
 */
export function moveVerseSelection(
  verseKeys: string[],
  selectedKeys: string[],
  direction: 1 | -1,
  extend: boolean,
  head?: string
): { keys: string[]; head: string } | undefined {
  const positions = selectedKeys.map(key => verseKeys.indexOf(key)).filter(index => index >= 0)
  if (!positions.length) return
  const first = Math.min(...positions)
  const last = Math.max(...positions)
  const headIndex = head === undefined ? -1 : verseKeys.indexOf(head)
  const from = headIndex === first || headIndex === last ? headIndex : direction > 0 ? last : first
  const reached = Math.min(verseKeys.length - 1, Math.max(0, from + direction))
  const key = verseKeys[reached]
  if (!extend) return { keys: [key], head: key }
  const anchor = from === last ? first : last
  const range = verseKeys.slice(Math.min(anchor, reached), Math.max(anchor, reached) + 1)
  return { keys: [...range.filter(verse => verse !== key), key], head: key }
}
