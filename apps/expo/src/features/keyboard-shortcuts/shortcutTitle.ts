import type { ShortcutId } from './keymap'

/** Native buttons show no tooltip. */
export function shortcutTitle(_id: ShortcutId, _label: string, _enabled = true) {
  return undefined
}
