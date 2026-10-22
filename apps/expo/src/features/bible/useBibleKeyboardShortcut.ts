import type { ShortcutId } from '~features/keyboard-shortcuts/keymap'

export type BibleKeyboardShortcutOptions = {
  enabled?: boolean
  /** A held key repeats the action, as moving from verse to verse. */
  repeat?: boolean
  /** Keeps working while the menu beside the selected verses shows, which otherwise owns letters. */
  besideVerseMenu?: boolean
}

export function useBibleKeyboardShortcut(
  _shortcut: ShortcutId,
  _tabId: string,
  _run: () => void,
  _options?: BibleKeyboardShortcutOptions
) {
  return false
}
