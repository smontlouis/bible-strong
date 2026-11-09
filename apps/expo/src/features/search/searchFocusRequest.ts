import { atom } from 'jotai'

/**
 * A request, with the time it was made, to put the cursor in the search field: the desktop app's
 * ⌘F opens the search tab, which may not exist yet. A request older than a moment is stale,
 * so a search tab opened later for another reason does not take the focus.
 */
export const searchFocusRequestAtom = atom<number | null>(null)

export const SEARCH_FOCUS_REQUEST_TTL_MS = 2000
