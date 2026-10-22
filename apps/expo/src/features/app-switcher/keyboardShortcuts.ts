import { findShortcut, type ShortcutEvent } from '~features/keyboard-shortcuts/keymap'

const WORKSPACE_SHORTCUTS = [
  'newTab',
  'closeTab',
  'previousTab',
  'nextTab',
  'recentTabs',
  'sidebar',
  'guide',
] as const

export type WorkspaceShortcut = (typeof WORKSPACE_SHORTCUTS)[number]

export function workspaceShortcut(
  event: ShortcutEvent,
  mac: boolean
): WorkspaceShortcut | undefined {
  return findShortcut(event, WORKSPACE_SHORTCUTS, mac)
}

export function cycleIndex(index: number, direction: number, count: number) {
  return count ? (index + direction + count) % count : -1
}
