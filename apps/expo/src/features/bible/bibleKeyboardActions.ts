import type { StrongMode } from '~helpers/strongBiblePublications'

export function nextAvailableStrongMode(
  current: StrongMode,
  strongAvailable: boolean,
  interlinearAvailable: boolean
): StrongMode {
  const modes: StrongMode[] = ['hidden']
  if (strongAvailable) modes.push('visible')
  if (strongAvailable && interlinearAvailable) modes.push('reverse-interlinear')
  return modes[(modes.indexOf(current) + 1) % modes.length]
}

export function parseVerseDestination(value: string, verseCount?: number): number | undefined {
  if (!verseCount || !/^\d+$/.test(value.trim())) return
  const verse = Number(value.trim())
  return Number.isInteger(verse) && verse >= 1 && verse <= verseCount ? verse : undefined
}

export function isBibleShortcut(
  event: Pick<
    KeyboardEvent,
    'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'repeat' | 'isComposing'
  >,
  key: 'v' | 's'
) {
  return (
    event.key.toLowerCase() === key &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    !event.repeat &&
    !event.isComposing
  )
}
