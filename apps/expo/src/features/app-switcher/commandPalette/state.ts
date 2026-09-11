import { atom } from 'jotai/vanilla'

// Navigation history is independent of the renderer's cache, which can be evicted.
export const recentCommandTabIdsAtom = atom<string[]>([])

// All Web launchers and keyboard shortcuts share this global dialog.
export const commandPaletteOpenAtom = atom(false)
export const commandPaletteReturnFocusAtom = atom<HTMLElement | null>(null)

// One-shot scope supplied by category launchers; the new-tab page stays intact.
export const commandPaletteScopeAtom = atom<string | undefined>(undefined)
