import { atom } from 'jotai/vanilla'

// Navigation history is independent of the renderer's cache, which can be evicted.
export const recentCommandTabIdsAtom = atom<string[]>([])
