import { IS_DESKTOP } from '~desktop/isDesktopBuild'
import { findShortcut, type ShortcutEvent } from '~features/keyboard-shortcuts/keymap'

const SHARED_SHORTCUTS = [
  'newTab',
  'closeTab',
  'previousTab',
  'nextTab',
  'recentTabs',
  'sidebar',
  'guide',
] as const
// A browser keeps ⌘1–9 and ⌘F for its own tabs and its find bar.
const DESKTOP_SHORTCUTS = ['goToTab', 'find'] as const

export type WorkspaceShortcut =
  | (typeof SHARED_SHORTCUTS)[number]
  | (typeof DESKTOP_SHORTCUTS)[number]

const WORKSPACE_SHORTCUTS: readonly WorkspaceShortcut[] = IS_DESKTOP
  ? [...SHARED_SHORTCUTS, ...DESKTOP_SHORTCUTS]
  : SHARED_SHORTCUTS

export function workspaceShortcut(
  event: ShortcutEvent,
  mac: boolean
): WorkspaceShortcut | undefined {
  return findShortcut(event, WORKSPACE_SHORTCUTS, mac)
}

export function cycleIndex(index: number, direction: number, count: number) {
  return count ? (index + direction + count) % count : -1
}
