import { formatShortcut, type ShortcutId } from './keymap'

/**
 * A ref that gives a button the browser's tooltip, its label followed by its shortcut: React
 * Native Web forwards no `title`. Without `enabled`, the tooltip goes.
 */
export function shortcutTitle(id: ShortcutId, label: string, enabled = true) {
  return (node: unknown) => {
    if (node instanceof HTMLElement) node.title = enabled ? `${label} (${formatShortcut(id)})` : ''
  }
}
