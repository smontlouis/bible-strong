export type WorkspaceShortcut = 'new' | 'close' | 'previous' | 'next' | 'switcher' | 'sidebar'
type ShortcutEvent = {
  keyCode?: number
  getModifierState?: KeyboardEvent['getModifierState']
} & Pick<
  KeyboardEvent,
  'key' | 'code' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'isComposing'
>
export function workspaceShortcut(
  event: ShortcutEvent,
  mac: boolean
): WorkspaceShortcut | undefined {
  if (
    event.isComposing ||
    event.key === 'AltGraph' ||
    (typeof event.getModifierState === 'function'
      ? event.getModifierState('AltGraph')
      : event.ctrlKey && event.altKey)
  )
    return
  const mod = mac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey
  // Option can replace event.key with a symbol. Chromium/WebKit's legacy virtual
  // letter code preserves the layout's letter (unlike physical event.code on AZERTY).
  const virtualLetter =
    event.keyCode && event.keyCode >= 65 && event.keyCode <= 90
      ? String.fromCharCode(event.keyCode)
      : undefined
  const letter = /^[a-z]$/i.test(event.key)
    ? `Key${event.key.toUpperCase()}`
    : virtualLetter
      ? `Key${virtualLetter}`
      : event.code
  if (mod && event.altKey && !event.shiftKey) {
    if (letter === 'KeyN') return 'new'
    if (letter === 'KeyW') return 'close'
  }
  if (mod && !event.altKey && !event.shiftKey && letter === 'KeyB') return 'sidebar'
  if (!event.ctrlKey && !event.metaKey && event.altKey && !event.shiftKey) {
    if (event.key === 'ArrowUp') return 'previous'
    if (event.key === 'ArrowDown') return 'next'
  }
  if (
    letter === 'KeyQ' &&
    !event.metaKey &&
    (mac ? event.ctrlKey && !event.altKey : event.altKey && !event.ctrlKey)
  )
    return 'switcher'
}

export function isEditingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      !!target.closest(
        'input, textarea, select, [role="textbox"], [contenteditable]:not([contenteditable="false"])'
      ))
  )
}

export function cycleIndex(index: number, direction: number, count: number) {
  return count ? (index + direction + count) % count : -1
}
