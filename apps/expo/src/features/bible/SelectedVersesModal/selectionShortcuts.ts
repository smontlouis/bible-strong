/** Keys of the desktop selection menu, shown beside each action. */
export const SELECTION_SHORTCUTS = {
  note: 'N',
  tag: 'T',
  link: 'L',
  bookmark: 'B',
  focus: 'F',
  references: 'R',
  compare: 'C',
} as const

export type SelectionShortcut = keyof typeof SELECTION_SHORTCUTS

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '')

/** Copying the selection keeps the system's own key. */
export const COPY_SHORTCUT = isMac ? '⌘C' : 'Ctrl+C'
