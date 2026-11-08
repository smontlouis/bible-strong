import { SHORTCUTS, type ShortcutId, isMacPlatform } from '~features/keyboard-shortcuts/keymap'

/** The menu items that run a workspace shortcut (`apps/desktop/src-tauri/src/menu.rs`). */
export const MENU_SHORTCUTS = [
  'newTab',
  'closeTab',
  'palette',
  'sidebar',
] as const satisfies readonly ShortcutId[]

export type MenuShortcut = (typeof MENU_SHORTCUTS)[number]

export const isMenuShortcut = (id: string): id is MenuShortcut =>
  (MENU_SHORTCUTS as readonly string[]).includes(id)

/**
 * The key press the shortcut's listeners already handle, so the menu and the chord run the same
 * code. The menu acts when the page did not take the chord: a click, a Windows accelerator
 * (which the webview never receives), or a macOS key equivalent the page left unhandled.
 */
export const shortcutKeyboardEvent = (id: MenuShortcut, mac = isMacPlatform()): KeyboardEvent => {
  const [chord] = SHORTCUTS[id]
  const letter = /^[A-Z]$/.test(chord.key)
  return new KeyboardEvent('keydown', {
    key: letter ? chord.key.toLowerCase() : chord.key,
    code: letter ? `Key${chord.key}` : chord.key,
    bubbles: true,
    cancelable: true,
    metaKey: mac && 'command' in chord && !!chord.command,
    ctrlKey: mac
      ? 'workspace' in chord && !!chord.workspace
      : 'command' in chord && !!chord.command,
    altKey: !mac && 'workspace' in chord && !!chord.workspace,
    shiftKey: 'shift' in chord && chord.shift === true,
  })
}
