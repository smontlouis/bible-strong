import { SHORTCUTS, type ShortcutId, isMacPlatform } from '~features/keyboard-shortcuts/keymap'

/** The menu items that run a workspace shortcut (`apps/desktop/src-tauri/src/menu.rs`). */
export const MENU_SHORTCUTS = [
  'newTab',
  'closeTab',
  'previousTab',
  'nextTab',
  'find',
  'palette',
  'sidebar',
  'previousChapter',
  'nextChapter',
  'goToVerse',
  'strongMode',
  'compare',
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

/** The workspace's own actions, which its listener ignores from a field. */
const PAGE_ACTIONS: readonly MenuShortcut[] = [
  'newTab',
  'closeTab',
  'previousTab',
  'nextTab',
  'find',
]

/**
 * Where the key press goes. A bare key acts on the Bible only outside a field, and the tabs and
 * the search are the workspace's: a menu item chosen while a field has the focus still means
 * them, so their key press goes to the page. The other chords go where the focus is, where an
 * editor may take them (⌘B, ⌘K).
 */
export const menuShortcutTarget = (id: MenuShortcut, doc: Document = document): EventTarget => {
  const [chord] = SHORTCUTS[id]
  const modified =
    ('command' in chord && !!chord.command) || ('workspace' in chord && !!chord.workspace)
  return modified && !PAGE_ACTIONS.includes(id) ? (doc.activeElement ?? doc.body) : doc.body
}

export const runMenuShortcut = (id: MenuShortcut) => {
  menuShortcutTarget(id).dispatchEvent(shortcutKeyboardEvent(id))
}
